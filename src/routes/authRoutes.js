const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  checkEmail,
  signup,
  verifyOTP,
  setPassword,
  login,
  setInitialPassword,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
  getTimezones,
  getCommonTimezones,
  getAvailablePackages,
  selectInitialSubscription,
  getSubscriptionStatus
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
const { logActivity } = require('../middleware/loggingMiddleware');
const { getCompanySubscriptionAndUsage } = require('../middleware/subscriptionMiddleware');
const { uploadProfilePicture, compressProfilePicture } = require('../middleware/imageUpload');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.'
  }
});

router.post('/check-email', authLimiter, checkEmail);
router.post('/login', authLimiter, validateLogin, login);
router.post('/refresh-token', attachTimezone, refreshToken);
router.post('/logout', authenticateAny, attachTimezone, logActivity, logout);

router.post('/signup', authLimiter, validateAdminEmail, signup);
router.post('/verify-otp', authLimiter, validateOTP, verifyOTP);
router.post('/set-password', authLimiter, validatePassword, setPassword);

router.post('/forgot-password', authLimiter, validateAdminEmail, forgotPassword);
router.post('/reset-password', authLimiter, validatePassword, resetPassword);

router.post('/set-initial-password', authenticateAny, attachTimezone, setInitialPassword);

router.put('/change-password', authenticateAny, attachTimezone, (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Request body is empty or missing. Ensure Content-Type header is set to 'application/json'."
    });
  }

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

router.get('/profile', authenticateAny, attachTimezone, getProfile);
router.put('/update-profile', authenticate, attachTimezone,uploadProfilePicture, compressProfilePicture, updateProfile);

router.get('/packages', authenticate, attachTimezone, getAvailablePackages);
router.post('/select-subscription', authenticate, attachTimezone, getCompanySubscriptionAndUsage, selectInitialSubscription);
router.get('/subscription-status', authenticate, attachTimezone, getSubscriptionStatus);

router.get('/timezones', getTimezones);
router.get('/timezones/common', getCommonTimezones);

module.exports = router;