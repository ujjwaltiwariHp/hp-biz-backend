const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  signup,
  verifyOTP,
  setPassword,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
  getTimezones,
  getCommonTimezones,
  getAvailablePackages,
  selectInitialSubscription
} = require('../controllers/authController');

const {
  authenticate,
  authenticateAny
} = require('../middleware/auth');

const {
  validateAdminEmail,
  validateOTP,
  validatePassword,
  validateLogin
} = require('../middleware/validation');

const { attachTimezone } = require('../middleware/timezoneMiddleware');
const { logActivity, logLoginActivity } = require('../middleware/loggingMiddleware');
const { getCompanySubscriptionAndUsage } = require('../middleware/subscriptionMiddleware');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.'
  }
});

router.post('/signup', authLimiter, validateAdminEmail, signup);

router.post('/verify-otp', authLimiter, validateOTP, verifyOTP);

router.post('/set-password', authLimiter, validatePassword, setPassword);

router.post('/login', authLimiter, validateLogin, login);

router.post('/forgot-password', authLimiter, validateAdminEmail, forgotPassword);

router.post('/reset-password', authLimiter, validatePassword, resetPassword);

router.get('/packages', authenticate, attachTimezone, getAvailablePackages);

router.post('/select-subscription',
    authenticate,
    attachTimezone,
    getCompanySubscriptionAndUsage,
    selectInitialSubscription
);

router.get('/profile', authenticateAny, attachTimezone, getProfile);

router.put('/update-profile', authenticate, attachTimezone, updateProfile);

router.put('/change-password', authenticateAny, attachTimezone, (req, res, next) => {
  const { new_password, current_password } = req.body;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 6 characters long"
    });
  }

  if (req.userType === 'admin' && !current_password) {
    return res.status(400).json({
      success: false,
      message: "Current password is required"
    });
  }

  next();
}, changePassword);

router.post('/logout', authenticateAny, attachTimezone, logActivity, logout);

router.get('/timezones', authenticateAny, getTimezones);

router.get('/timezones/common', authenticateAny, getCommonTimezones);

module.exports = router;