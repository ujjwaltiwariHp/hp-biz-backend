const {
  createInvoice,
  getAllInvoicesData,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getUnpaidPaymentsByCompanyId,
  linkPaymentToInvoice,
  getPaymentById
} = require('../../models/super-admin-models/invoiceModel');
const { updateSubscriptionStatusManual, getCompanyById } = require('../../models/super-admin-models/companyModel');
const { logSystemEvent } = require('../../models/loggingModel');
const { successResponse } = require('../../utils/successResponse');
const { errorResponse } = require('../../utils/errorResponse');
const { calculateTaxAndTotal } = require('../../utils/calculationHelper');
const { generateInvoicePdf } = require('../../utils/pdfGenerator');
const { sendInvoiceEmail } = require('../../services/emailService');
const { createNotification } = require('../../models/super-admin-models/notificationModel');
const { getSettings: getBillingSettings } = require('../../models/super-admin-models/billingSettingsModel'); // ADDED IMPORT

const generateInvoice = async (req, res) => {
  try {
    const { company_id, subscription_package_id, amount, billing_period_start, billing_period_end, due_date, payment_id } = req.body;

    let baseAmount = parseFloat(amount);
    let payment = null;

    if (payment_id) {
      payment = await getPaymentById(payment_id);
      if (!payment) {
        return errorResponse(res, 400, "Payment not found or not completed");
      }
      baseAmount = parseFloat(payment.amount);
    }

    if (isNaN(baseAmount) || baseAmount <= 0) {
      return errorResponse(res, 400, "Invalid or missing invoice amount.");
    }

    const { tax_amount, total_amount, tax_rate_display } = await calculateTaxAndTotal(baseAmount);

    const invoiceData = {
      company_id: payment ? payment.company_id : company_id,
      subscription_package_id,
      amount: baseAmount,
      tax_amount,
      total_amount,
      currency: 'USD'
    };

    const newInvoice = await createInvoice(invoiceData);

    if (!newInvoice) {
      return errorResponse(res, 500, "Failed to generate invoice");
    }

    let appliedPayments = [];
    let outstandingBalance = newInvoice.total_amount;

    if (payment) {
      await linkPaymentToInvoice(payment.id, newInvoice.id);
      outstandingBalance -= payment.amount;
      appliedPayments.push({ payment_id: payment.id, applied_amount: payment.amount });
    } else {
      const unpaidPayments = await getUnpaidPaymentsByCompanyId(company_id);
      for (const pay of unpaidPayments) {
        if (outstandingBalance <= 0) break;
        const amountToApply = Math.min(outstandingBalance, pay.amount);
        await linkPaymentToInvoice(pay.id, newInvoice.id);
        outstandingBalance -= amountToApply;
        appliedPayments.push({ payment_id: pay.id, applied_amount: amountToApply });
      }
    }
    return successResponse(res, { invoice: { ...newInvoice, tax_rate_display }, applied_payments: appliedPayments, outstanding_balance: outstandingBalance });
  } catch (error) {
    if (error.code === '23503') {
      return errorResponse(res, 400, "Invalid Company ID or Subscription Package ID");
    }
    return errorResponse(res, 500, "Failed to generate invoice");
  }
};

const getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, company_id, status, startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const filters = { company_id, status, startDate, endDate };

    const invoices = await getAllInvoicesData(parseInt(limit), offset, filters);

    if (!invoices || invoices.length === 0) {
      return successResponse(res, "No invoices found matching the criteria", {
        invoices: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalCount: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    const totalCount = invoices[0]?.total_count || 0;
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    const invoicesData = invoices.map(invoice => {
      const { total_count, ...invoiceData } = invoice;
      return invoiceData;
    });

    return successResponse(res, "Invoices retrieved successfully", {
      invoices: invoicesData,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount: parseInt(totalCount),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve invoices");
  }
};

const getInvoiceDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await getInvoiceById(parseInt(id));

    if (!invoice) {
      return errorResponse(res, 404, "Invoice not found");
    }

    return successResponse(res, "Invoice details retrieved successfully", {
      invoice
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve invoice details");
  }
};

const updateInvoiceDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const updateBody = req.body;

    if (updateBody.status === 'payment_received' || updateBody.status === 'paid') {
      const existingInvoice = await getInvoiceById(parseInt(id));
      if (!existingInvoice) {
        return errorResponse(res, 404, "Invoice not found");
      }

      if (existingInvoice.status !== 'payment_received' && existingInvoice.status !== 'paid' && existingInvoice.status !== 'approved') {
          req.params.id = id;
          req.body.invoice_id = id;
          req.body.payment_method = req.body.payment_method || 'manual_override';
          req.body.payment_reference = req.body.payment_reference || `INV-${existingInvoice.invoice_number}-PAY-MANUAL`;
          return markPaymentReceived(req, res);
      }
    }

    const existingInvoice = await getInvoiceById(parseInt(id));
    if (!existingInvoice) {
      return errorResponse(res, 404, "Invoice not found");
    }

    if (updateBody.amount) {
      const { tax_amount, total_amount } = await calculateTaxAndTotal(updateBody.amount);
      updateBody.tax_amount = tax_amount;
      updateBody.total_amount = total_amount;
    }

    const updatedInvoice = await updateInvoice(parseInt(id), updateBody);

    if (!updatedInvoice) {
      return errorResponse(res, 500, "Failed to update invoice");
    }

    if (updateBody.status && updateBody.status !== existingInvoice.status) {
        await logSystemEvent({
            company_id: updatedInvoice.company_id,
            log_level: 'INFO',
            log_category: 'INVOICE',
            message: `Invoice #${updatedInvoice.invoice_number} status manually updated to ${updatedInvoice.status}.`
        });
    }

    return successResponse(res, "Invoice updated successfully", {
      invoice: updatedInvoice
    });
  } catch (error) {
    if (error.message.includes('Cannot mark payment as received')) {
        return errorResponse(res, 400, "Payment is already marked as verified or processed.");
    }
    if (error.code === '23503') {
      return errorResponse(res, 400, "Invalid foreign key provided");
    }
    return errorResponse(res, 500, "Failed to update invoice");
  }
};

const removeInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedInvoice = await deleteInvoice(parseInt(id));

    if (!deletedInvoice) {
      return errorResponse(res, 404, "Invoice not found");
    }

    return successResponse(res, "Invoice deleted successfully", {
      deletedInvoice: {
        id: deletedInvoice.id,
        invoice_number: deletedInvoice.invoice_number,
        company_id: deletedInvoice.company_id
      }
    });
  } catch (error) {
    if (error.code === '23503') {
      return errorResponse(res, 400, "Cannot delete invoice. It has associated payments that must be removed first");
    }
    return errorResponse(res, 500, "Failed to delete invoice");
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const [invoice, billingSettings] = await Promise.all([ // MODIFICATION: Fetch billingSettings
      getInvoiceById(parseInt(id)),
      getBillingSettings()
    ]);

    if (!invoice) {
      return errorResponse(res, 404, "Invoice not found");
    }

    const pdfBuffer = await generateInvoicePdf(invoice, billingSettings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoice_number}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF Generation Error:", error);
    return errorResponse(res, 500, "Failed to generate PDF for invoice");
  }
};

const sendInvoiceEmailController = async (req, res) => {
  try {
    const { id } = req.params;
    const [invoice, billingSettings] = await Promise.all([ // MODIFICATION: Fetch billingSettings
      getInvoiceById(parseInt(id)),
      getBillingSettings()
    ]);

    if (!invoice) {
      return errorResponse(res, 404, "Invoice not found");
    }

    const pdfBuffer = await generateInvoicePdf(invoice, billingSettings);

    await sendInvoiceEmail(invoice, pdfBuffer);

    const updatedInvoice = await updateInvoice(parseInt(id), { status: 'sent' });

    return successResponse(res, "Invoice sent successfully via email", {
      invoice_id: updatedInvoice.id,
      invoice_number: updatedInvoice.invoice_number,
      email: updatedInvoice.billing_email
    });
  } catch (error) {
    console.error("Error sending invoice email:", error);
    return errorResponse(res, 500, "Failed to send invoice email");
  }
};

const markPaymentReceived = async (req, res) => {
    const invoiceId = parseInt(req.params.id || req.body.invoice_id);
    const { payment_method, payment_reference, payment_notes } = req.body;
    const superAdminId = req.superAdmin.id;

    try {
        const invoice = await getInvoiceById(invoiceId);

        if (!invoice) {
            return errorResponse(res, 404, 'Invoice not found');
        }

        if (invoice.status === 'paid' || invoice.status === 'rejected' || invoice.status === 'payment_received' || invoice.status === 'approved') {
            return errorResponse(res, 400, `Cannot mark payment as received. Invoice status is ${invoice.status}.`);
        }

        const updatedInvoice = await updateInvoice(invoiceId, {
            status: 'payment_received',
            payment_method,
            payment_reference,
            payment_notes,
            admin_verified_at: new Date().toISOString(),
            admin_verified_by: superAdminId
        });

        const updatedCompany = await updateSubscriptionStatusManual(updatedInvoice.company_id, superAdminId, 'payment_received', {});

        await logSystemEvent({
            company_id: updatedInvoice.company_id,
            log_level: 'INFO',
            log_category: 'INVOICE_PAYMENT',
            message: `Payment manually verified for Invoice #${updatedInvoice.invoice_number} by SA:${superAdminId}. Status: payment_received.`
        });

        try {
            const company = await getCompanyById(updatedInvoice.company_id);
            const companyName = company?.company_name || 'Unknown Company';

            await createNotification({
                company_id: updatedInvoice.company_id,
                super_admin_id: superAdminId,
                title: 'PAYMENT VERIFIED - READY FOR APPROVAL',
                message: `Payment for Invoice #${updatedInvoice.invoice_number} from ${companyName} has been verified as received. Subscription is ready for activation.`,
                notification_type: 'payment_received',
                priority: 'urgent',
                metadata: {
                    invoice_id: updatedInvoice.id,
                    company_id: updatedInvoice.company_id,
                    company_name: companyName
                }
            });
        } catch (notificationError) {
        }

        return successResponse(res, 'Payment marked as received and verified. Ready for Subscription Approval.', {
            invoice: updatedInvoice,
            company_status: updatedCompany.subscription_status
        }, 200, req);

    } catch (error) {
        return errorResponse(res, 500, 'Failed to mark payment as received.');
    }
};


module.exports = {
  generateInvoice,
  getAllInvoices,
  getInvoiceDetails,
  updateInvoiceDetails,
  removeInvoice,
  downloadInvoice,
  sendInvoiceEmailController,
  markPaymentReceived
};