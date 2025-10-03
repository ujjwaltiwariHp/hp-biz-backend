const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../../utils/errorResponse');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 400, errors.array()[0].msg);
  }
  next();
};

const validateSuperAdminCreation = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('name').notEmpty().withMessage('Name is required'),
  handleValidationErrors
];

const validateSuperAdminLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

const validateProfileUpdate = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  handleValidationErrors
];

const validatePasswordChange = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) throw new Error('Password confirmation does not match new password');
    return true;
  }),
  handleValidationErrors
];

module.exports = {
  validateSuperAdminCreation,
  validateSuperAdminLogin,
  validateProfileUpdate,
  validatePasswordChange
};
