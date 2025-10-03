const { body, query, param, validationResult } = require('express-validator');
const { errorResponse } = require('../../utils/errorResponse');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 400, errors.array()[0].msg);
  }
  next();
};

const validatePaymentRecord = [
  body('company_id').isInt({ gt: 0 }).withMessage('Valid company ID is required'),
  body('invoice_id').optional().isInt({ gt: 0 }).withMessage('Invoice ID must be a valid integer'),
  body('amount').isFloat({ gt: 0 }).withMessage('Valid payment amount is required'),
  body('payment_method').isIn(['bank_transfer', 'credit_card', 'paypal', 'other']).withMessage('Invalid payment method'),
  body('transaction_id').optional().isString().trim().withMessage('Transaction ID must be a string'),
  body('payment_date').isISO8601().toDate().withMessage('Valid payment date is required (YYYY-MM-DD)'),
  body('status').isIn(['pending', 'completed', 'failed', 'refunded']).withMessage('Invalid payment status'),
  handleValidationErrors
];

const validatePaymentQuery = [
  query('page').optional().isInt({ gt: 0 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ gt: 0, le: 100 }).withMessage('Limit must be a positive integer (max 100)'),
  query('company_id').optional().isInt({ gt: 0 }).withMessage('Company ID filter must be a positive integer'),
  query('status').optional().isIn(['pending', 'completed', 'failed', 'refunded']).withMessage('Invalid status filter'),
  query('startDate').optional().isISO8601().toDate().withMessage('Start date must be a valid date (YYYY-MM-DD)'),
  query('endDate').optional().isISO8601().toDate().custom((value, { req }) => {
    if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
      throw new Error('End date must be after start date');
    }
    return true;
  }).withMessage('End date must be a valid date (YYYY-MM-DD)'),
  handleValidationErrors
];

const validatePaymentId = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid payment ID provided'),
  handleValidationErrors
];

const validatePaymentStatusUpdate = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid payment ID provided'),
  body('status').isIn(['pending', 'completed', 'failed', 'refunded']).withMessage('Invalid status provided'),
  handleValidationErrors
];

module.exports = {
  validatePaymentRecord,
  validatePaymentQuery,
  validatePaymentId,
  validatePaymentStatusUpdate
};
