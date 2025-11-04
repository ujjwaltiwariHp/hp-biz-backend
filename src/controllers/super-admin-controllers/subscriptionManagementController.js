const moment = require('moment-timezone');
const { getCompanyById, updateSubscriptionStatusManual } = require('../../models/super-admin-models/companyModel');
const { getPackageById } = require('../../models/super-admin-models/subscriptionModel');
const { createInvoice, getInvoiceById, updateInvoice } = require('../../models/super-admin-models/invoiceModel');
const { createSubscriptionActivationNotification } = require('../../services/notificationService');
const { calculateTaxAndTotal } = require('../../utils/calculationHelper');
const { calculateEndDate } = require('../../utils/subscriptionHelper');
const { successResponse } = require('../../utils/successResponse');
const { errorResponse } = require('../../utils/errorResponse');
const { logSystemEvent } = require('../../models/loggingModel');
const { generateInvoicePdf } = require('../../utils/pdfGenerator');


const initiateSubscriptionRequest = async (req, res) => {
  const companyId = req.params.id;
  const { subscription_package_id, duration_type, due_date_days = 7 } = req.body;
  const superAdminId = req.superAdmin.id;
  const timezone = req.timezone;

  try {
    const [company, packageData] = await Promise.all([
      getCompanyById(companyId),
      getPackageById(subscription_package_id)
    ]);

    if (!company || !packageData) {
      return errorResponse(res, 404, 'Company or Subscription Package not found.');
    }

    if (company.subscription_status === 'approved') {
        return errorResponse(res, 400, 'Company already has an active subscription.');
    }

    const baseAmount = parseFloat(packageData.price);
    const { tax_amount, total_amount } = calculateTaxAndTotal(baseAmount);

    const startDate = moment().tz(timezone).startOf('day');
    const endDate = calculateEndDate(startDate, duration_type, 1, timezone);
    const dueDate = moment().tz(timezone).add(due_date_days, 'days').endOf('day');


    const newInvoice = await createInvoice({
      company_id: companyId,
      subscription_package_id,
      amount: baseAmount,
      tax_amount,
      total_amount,
      currency: 'USD',
      billing_period_start: startDate.toISOString(),
      billing_period_end: endDate.toISOString(),
      due_date: dueDate.toISOString()
    });


    const updatedCompany = await updateSubscriptionStatusManual(companyId, superAdminId, 'pending', {
        subscription_package_id,
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: endDate.toISOString()
    });

    await logSystemEvent({
        company_id: companyId,
        log_level: 'INFO',
        log_category: 'SUBSCRIPTION',
        message: `Subscription request initiated for Invoice #${newInvoice.invoice_number} by SA:${superAdminId}. Status: pending.`
    });

    return successResponse(res, 'Subscription request initiated and invoice created.', {
      company: updatedCompany,
      invoice: newInvoice
    }, 201, req);

  } catch (error) {
    console.error('Initiate Subscription Request Error:', error);
    return errorResponse(res, 500, 'Failed to initiate subscription request.');
  }
};

const markPaymentReceived = async (req, res) => {
    const companyId = req.params.id;
    const { invoice_id, payment_method, payment_reference, payment_notes } = req.body;
    const superAdminId = req.superAdmin.id;

    try {
        const [company, invoice] = await Promise.all([
            getCompanyById(companyId),
            getInvoiceById(invoice_id)
        ]);

        if (!company || !invoice) {
            return errorResponse(res, 404, 'Company or Invoice not found.');
        }

        if (invoice.status !== 'sent' && invoice.status !== 'overdue') {
            return errorResponse(res, 400, `Invoice status is ${invoice.status}. Cannot mark payment received.`);
        }

        await updateInvoice(invoice_id, {
            status: 'payment_received',
            payment_method,
            payment_reference,
            payment_notes,
            admin_verified_at: new Date().toISOString(),
            admin_verified_by: superAdminId
        });

        const updatedCompany = await updateSubscriptionStatusManual(companyId, superAdminId, 'payment_received', {});

        await logSystemEvent({
            company_id: companyId,
            log_level: 'INFO',
            log_category: 'INVOICE_PAYMENT',
            message: `Payment verified and status set to 'payment_received' for Invoice #${invoice.invoice_number} by SA:${superAdminId}.`
        });

        return successResponse(res, 'Payment marked as received and verified. Ready for Subscription Approval.', {
            company: updatedCompany,
            invoice_status: 'payment_received'
        }, 200, req);

    } catch (error) {
        console.error('Mark Payment Received Error:', error);
        return errorResponse(res, 500, 'Failed to mark payment as received.');
    }
};

const approveSubscription = async (req, res) => {
    const companyId = req.params.id;
    const { invoice_id, start_date_override } = req.body;
    const superAdminName = req.superAdmin.name;

    try {
        const [company, invoice] = await Promise.all([
            getCompanyById(companyId),
            getInvoiceById(invoice_id)
        ]);

        if (!company || !invoice) {
            return errorResponse(res, 404, 'Company or Invoice not found.');
        }

        if (company.subscription_status !== 'payment_received') {
            return errorResponse(res, 400, 'Subscription is not in a payment_received status. Verification required.');
        }

        const packageId = invoice.subscription_package_id || company.subscription_package_id;

        if (!packageId) {
            return errorResponse(res, 400, 'Subscription package ID not found in invoice or company record.');
        }

        const packageData = await getPackageById(packageId);

        if (!packageData) {
            return errorResponse(res, 400, 'Invalid subscription package assigned.');
        }

        const startDate = start_date_override
          ? moment(start_date_override).tz(req.timezone).startOf('day')
          : moment().tz(req.timezone).startOf('day');

        const endDate = calculateEndDate(startDate, packageData.duration_type, 1, req.timezone);

        const updatedCompany = await updateSubscriptionStatusManual(companyId, req.superAdmin.id, 'approve', {
            subscription_package_id: packageId,
            subscription_start_date: startDate.toISOString(),
            subscription_end_date: endDate.toISOString()
        });

        const updatedInvoice = await updateInvoice(invoice_id, {
            status: 'paid',
            payment_date: new Date().toISOString()
        });

        const pdfBuffer = await generateInvoicePdf({
            ...invoice,
            ...updatedInvoice,
            package_name: packageData.name
        });

        await createSubscriptionActivationNotification(
            company,
            packageData,
            endDate.toISOString(),
            superAdminName,
            updatedInvoice,
            pdfBuffer
        );

        try {
            await logSystemEvent({
                company_id: companyId,
                log_level: 'SUCCESS',
                log_category: 'SUBSCRIPTION',
                message: `Subscription successfully APPROVED and activated by SA:${req.superAdmin.id}. End date: ${moment(endDate).format('YYYY-MM-DD')}.`
            });
        } catch (logError) {
            console.error('Non-critical: Failed to log system event after successful activation:', logError);
        }

        return successResponse(res, 'Subscription approved and company activated successfully.', {
            company: updatedCompany,
            package_name: packageData.name,
            new_end_date: endDate.toISOString()
        }, 200, req);

    } catch (error) {
        console.error('Approve Subscription Error:', error);
        return errorResponse(res, 500, 'Failed to approve subscription and activate company.');
    }
};
const rejectSubscription = async (req, res) => {
    const companyId = req.params.id;
    const { invoice_id, rejection_reason, rejection_note } = req.body;

    try {
        const [company, invoice] = await Promise.all([
            getCompanyById(companyId),
            getInvoiceById(invoice_id)
        ]);

        if (!company || !invoice) {
            return errorResponse(res, 404, 'Company or Invoice not found.');
        }
        if (company.subscription_status === 'approved' || company.subscription_status === 'rejected') {
            return errorResponse(res, 400, `Cannot reject subscription in '${company.subscription_status}' status.`);
        }

        await updateInvoice(invoice_id, {
            status: 'rejected',
            rejection_reason,
            rejection_note,
            admin_verified_at: new Date().toISOString(),
            admin_verified_by: req.superAdmin.id
        });

        const updatedCompany = await updateSubscriptionStatusManual(companyId, req.superAdmin.id, 'reject', {});

        await logSystemEvent({
            company_id: companyId,
            log_level: 'WARNING',
            log_category: 'SUBSCRIPTION',
            message: `Subscription REJECTED by SA:${req.superAdmin.id} for Invoice #${invoice.invoice_number}. Reason: ${rejection_reason}.`
        });

        return successResponse(res, 'Subscription request rejected and invoice cancelled.', {
            company: updatedCompany,
            invoice_status: 'rejected'
        }, 200, req);

    } catch (error) {
        console.error('Reject Subscription Error:', error);
        return errorResponse(res, 500, 'Failed to reject subscription request.');
    }
};

module.exports = {
    initiateSubscriptionRequest,
    markPaymentReceived,
    approveSubscription,
    rejectSubscription
};