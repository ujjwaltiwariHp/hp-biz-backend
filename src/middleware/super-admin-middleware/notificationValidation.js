const { body, param, query, validationResult } = require('express-validator');
const { errorResponse } = require('../../utils/errorResponse');

const validateNotificationQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isString().withMessage('Search must be a string')
    .trim(),
  query('type')
    .optional()
    .isIn(['renewal_reminder', 'subscription_expiring', 'payment_received', 'payment_failed', 'company_registered', 'system_alert'])
    .withMessage('Invalid notification type'),
  query('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  query('is_read')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('is_read must be true or false'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 400, errors.array()[0].msg);
    }
    next();
  }
];

const validateExpiringSubscriptions = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 400, errors.array()[0].msg);
    }
    next();
  }
];

const validateRenewalReminder = [
  body('company_id')
    .notEmpty().withMessage('Company ID is required')
    .isInt({ min: 1 }).withMessage('Company ID must be a positive integer'),
  body('message')
    .optional()
    .isString().withMessage('Message must be a string')
    .trim()
    .isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters'),
  body('send_email')
    .optional()
    .isBoolean().withMessage('send_email must be a boolean'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 400, errors.array()[0].msg);
    }
    next();
  }
];

const validateNotificationId = [
  param('id')
    .notEmpty().withMessage('Notification ID is required')
    .isInt({ min: 1 }).withMessage('Notification ID must be a positive integer'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 400, errors.array()[0].msg);
    }
    next();
  }
];

module.exports = {
  validateNotificationQuery,
  validateExpiringSubscriptions,
  validateRenewalReminder,
  validateNotificationId
};