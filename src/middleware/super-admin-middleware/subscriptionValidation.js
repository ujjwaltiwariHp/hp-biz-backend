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
  body('duration_type')
    .notEmpty()
    .withMessage('Duration type is required')
    .isIn(['monthly', 'yearly', 'weekly', 'quarterly'])
    .withMessage('Duration type must be monthly, yearly, weekly, or quarterly'),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
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
  handleValidationErrors
];

const validatePackageUpdate = [
  param('id').isInt({ min: 1 }).withMessage('Valid package ID is required'),
  body('name')
    .notEmpty()
    .withMessage('Package name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Package name must be between 2 and 100 characters'),
  body('duration_type')
    .notEmpty()
    .withMessage('Duration type is required')
    .isIn(['monthly', 'yearly', 'weekly', 'quarterly'])
    .withMessage('Duration type must be monthly, yearly, weekly, or quarterly'),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
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
  handleValidationErrors
];

module.exports = {
  validatePackageId,
  validatePackageQuery,
  validatePackageCreation,
  validatePackageUpdate
};