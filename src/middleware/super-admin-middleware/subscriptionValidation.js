const { body, param, query, validationResult } = require('express-validator');
const { errorResponse } = require('../../utils/errorResponse');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 400, errors.array()[0].msg);
  }
  next();
};

const validatePackageId = [
  param('id').isInt({ min: 1 }).withMessage('Valid package ID is required'),
  handleValidationErrors
];

const validatePackageQuery = [
  query('active_only').optional().isIn(['true', 'false']).withMessage('active_only must be true or false'),
  handleValidationErrors
];

const validatePackageCreation = [
  body('name')
    .notEmpty()
    .withMessage('Package name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Package name must be between 2 and 100 characters'),

  body('price_monthly')
    .notEmpty()
    .withMessage('Monthly price is required')
    .isFloat({ min: 0 })
    .withMessage('Monthly price must be a non-negative number'),

  body('price_quarterly')
    .notEmpty()
    .withMessage('Quarterly price is required')
    .isFloat({ min: 0 })
    .withMessage('Quarterly price must be a non-negative number'),

  body('price_yearly')
    .notEmpty()
    .withMessage('Yearly price is required')
    .isFloat({ min: 0 })
    .withMessage('Yearly price must be a non-negative number'),

  body('yearly_discount_percent')
    .notEmpty()
    .withMessage('Yearly discount percent is required')
    .isInt({ min: 0, max: 100 })
    .withMessage('Yearly discount percent must be between 0 and 100'),

  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array'),

  body('max_staff_count')
    .notEmpty()
    .withMessage('Maximum staff count is required')
    .isInt({ min: 0 })
    .withMessage('Maximum staff count must be a positive integer'),

  body('max_leads_per_month')
    .notEmpty()
    .withMessage('Maximum leads per month is required')
    .isInt({ min: 0 })
    .withMessage('Maximum leads per month must be a positive integer'),

  body('max_custom_fields')
    .notEmpty()
    .withMessage('Maximum custom fields is required')
    .isInt({ min: 0 })
    .withMessage('Maximum custom fields must be a positive integer'),

  body('is_trial')
    .optional()
    .isBoolean()
    .withMessage('is_trial must be a boolean'),

  body('trial_duration_days')
    .if(body('is_trial').equals('true'))
    .notEmpty()
    .withMessage('Trial duration days is required for trial packages')
    .isInt({ min: 1 })
    .withMessage('Trial duration days must be at least 1'),

  handleValidationErrors
];

const validatePackageUpdate = [
  param('id').isInt({ min: 1 }).withMessage('Valid package ID is required'),

  body('name')
    .optional()
    .notEmpty()
    .withMessage('Package name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Package name must be between 2 and 100 characters'),

  // REMOVED duration_type validation

  // NEW Explicit Price Validations (Optional for updates)
  body('price_monthly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Monthly price must be a non-negative number'),

  body('price_quarterly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Quarterly price must be a non-negative number'),

  body('price_yearly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Yearly price must be a non-negative number'),

  body('yearly_discount_percent')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Yearly discount percent must be between 0 and 100'),

  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array'),

  body('max_staff_count')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Maximum staff count must be a positive integer'),

  body('max_leads_per_month')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Maximum leads per month must be a positive integer'),

  body('max_custom_fields')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Maximum custom fields must be a positive integer'),

  body('is_trial')
    .optional()
    .isBoolean()
    .withMessage('is_trial must be a boolean'),

  body('trial_duration_days')
    .if(body('is_trial').equals('true'))
    .optional()
    .isInt({ min: 1 })
    .withMessage('Trial duration days must be at least 1'),

  handleValidationErrors
];

module.exports = {
  validatePackageId,
  validatePackageQuery,
  validatePackageCreation,
  validatePackageUpdate
};