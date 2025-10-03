const { body, param, query, validationResult } = require('express-validator');
const { errorResponse } = require('../../utils/errorResponse');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 400, errors.array()[0].msg);
  }
  next();
};

const validateCompanyId = [
  param('id').isInt({ min: 1 }).withMessage('Valid company ID is required'),
  handleValidationErrors
];

const validateCompanyQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isLength({ max: 255 }).withMessage('Search term is too long'),
  query('status').optional().isIn(['active', 'inactive']).withMessage('Status must be either active or inactive'),
  handleValidationErrors
];

const validateSubscriptionUpdate = [
  param('id').isInt({ min: 1 }).withMessage('Valid company ID is required'),
  body('subscription_package_id').isInt({ min: 1 }).withMessage('Valid subscription package ID is required'),
  body('subscription_start_date').isISO8601().withMessage('Valid subscription start date is required'),
  body('subscription_end_date').isISO8601().withMessage('Valid subscription end date is required'),
  body('subscription_end_date').custom((value, { req }) => {
    if (new Date(value) <= new Date(req.body.subscription_start_date)) {
      throw new Error('Subscription end date must be after start date');
    }
    return true;
  }),
  handleValidationErrors
];

const validateUsageReport = [
  query('startDate').isISO8601().withMessage('Valid start date is required'),
  query('endDate').isISO8601().withMessage('Valid end date is required'),
  query('endDate').custom((value, { req }) => {
    if (new Date(value) <= new Date(req.query.startDate)) {
      throw new Error('End date must be after start date');
    }
    return true;
  }),
  handleValidationErrors
];

module.exports = {
  validateCompanyId,
  validateCompanyQuery,
  validateSubscriptionUpdate,
  validateUsageReport
};