const { body, query, param, validationResult } = require('express-validator');
const { errorResponse } = require('../../utils/errorResponse');

const invoiceStatuses = [
  'draft',
  'pending',
  'sent',
  'payment_received',
  'paid',
  'partially_paid',
  'overdue',
  'void',
  'cancelled',
  'rejected'
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 400, errors.array()[0].msg);
  }
  next();
};
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

    const { tax_amount, total_amount } = calculateTaxAndTotal(baseAmount);

    const invoiceData = {
      company_id: payment ? payment.company_id : company_id,
      subscription_package_id,
      amount: baseAmount,
      tax_amount,
      total_amount,
      billing_period_start,
      billing_period_end,
      due_date,
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

    if (outstandingBalance <= 0) {
      await updateInvoice(newInvoice.id, { status: 'paid', payment_date: new Date().toISOString() });
      newInvoice.status = 'paid';
    } else if (appliedPayments.length > 0 && outstandingBalance > 0) {
      newInvoice.status = 'partial_paid';
    }

    return successResponse(res, { invoice: newInvoice, applied_payments: appliedPayments, outstanding_balance: outstandingBalance });
  } catch (error) {
    console.error("Error generating invoice:", error);
    if (error.code === '23503') {
      return errorResponse(res, 400, "Invalid Company ID or Subscription Package ID");
    }
    return errorResponse(res, 500, "Failed to generate invoice");
  }
};
const validateInvoiceGenerate = [
  body('company_id').isInt({ min: 1 }).withMessage('Valid Company ID is required'),
  body('subscription_package_id').isInt({ min: 1 }).withMessage('Subscription Package ID is required'),
  body('billing_period_start').isISO8601().toDate().withMessage('Start date must be a valid date (YYYY-MM-DD)'),
  body('billing_period_end').isISO8601().toDate().withMessage('End date must be a valid date (YYYY-MM-DD)'),
  body('due_date').isISO8601().toDate().withMessage('Due date must be a valid date (YYYY-MM-DD)'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
  handleValidationErrors
];

const validateInvoiceQuery = [
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'),
  query('company_id').optional().isInt({ min: 1 }).toInt().withMessage('Company ID filter must be a valid integer'),
  query('status').optional().isIn(invoiceStatuses).withMessage(`Status filter must be one of: ${invoiceStatuses.join(', ')}`),
  query('startDate').optional().isISO8601().toDate().withMessage('Start date filter must be a valid date (YYYY-MM-DD)'),
  query('endDate').optional().isISO8601().toDate().withMessage('End date filter must be a valid date (YYYY-MM-DD)'),
  (req, res, next) => {
    const { startDate, endDate } = req.query;
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return errorResponse(res, 400, "Start date cannot be after end date");
    }
    handleValidationErrors(req, res, next);
  }
];

const validateInvoiceId = [
  param('id').isInt({ min: 1 }).withMessage('Invoice ID must be a valid integer'),
  handleValidationErrors
];

const validateInvoiceUpdate = [
  param('id').isInt({ min: 1 }).withMessage('Invoice ID must be a valid integer'),
  body('status').optional().isIn(invoiceStatuses).withMessage(`Status must be one of: ${invoiceStatuses.join(', ')}`),
  body('amount').optional().isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
  body('tax_amount').optional().isFloat({ gte: 0 }).withMessage('Tax amount must be a non-negative number'),
  body('due_date').optional().isISO8601().toDate().withMessage('Due date must be a valid date (YYYY-MM-DD)'),
  handleValidationErrors
];

module.exports = {
  validateInvoiceGenerate,
  validateInvoiceQuery,
  validateInvoiceId,
  validateInvoiceUpdate
};
