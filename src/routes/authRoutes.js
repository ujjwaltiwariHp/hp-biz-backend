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
  logout
} = require('../controllers/authController');

const {
  authenticateAny
} = require('../middleware/auth');

const {
  validateAdminEmail,
  validateOTP,
  validatePassword,
  validateLogin
} = require('../middleware/validation');

const { logActivity, logLoginActivity } = require('../middleware/loggingMiddleware');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.'
  }
});

/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     summary: Signup with email (company admin)
 *     tags: [Company Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       409:
 *         description: Email already registered
 */
router.post('/signup', authLimiter, validateAdminEmail, signup);

/**
 * @swagger
 * /api/v1/auth/verify-otp:
 *   post:
 *     summary: Verify OTP (signup or reset)
 *     tags: [Company Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/verify-otp', authLimiter, validateOTP, verifyOTP);

/**
 * @swagger
 * /api/v1/auth/set-password:
 *   post:
 *     summary: Set password after signup
 *     tags: [Company Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password set successfully
 */
router.post('/set-password', authLimiter, validatePassword, setPassword);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login as company admin or staff
 *     tags: [Company Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials or account not verified
 */
router.post('/login', authLimiter, validateLogin, login);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request OTP for password reset
 *     tags: [Company Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent to email
 *       404:
 *         description: Company not found
 */
router.post('/forgot-password', authLimiter, validateAdminEmail, forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Company Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post('/reset-password', authLimiter, validatePassword, resetPassword);

/**
 * @swagger
 * /api/v1/auth/update-profile:
 *   put:
 *     summary: Update company profile (only admin can update)
 *     tags: [Company Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               company_name:
 *                 type: string
 *                 example: "Tech Innovators Pvt Ltd"
 *               admin_name:
 *                 type: string
 *                 example: "John Doe"
 *               phone:
 *                 type: string
 *                 example: "+1-234-567-8900"
 *               address:
 *                 type: string
 *                 example: "123 Silicon Valley, CA, USA"
 *               website:
 *                 type: string
 *                 example: "https://www.techinnovators.com"
 *               industry:
 *                 type: string
 *                 example: "Software"
 *               company_size:
 *                 type: string
 *                 enum: [1-10, 11-50, 51-200, 201-1000, 1000+]
 *                 example: "51-200"
 *     responses:
 *       200:
 *         description: Company profile updated successfully
 *       400:
 *         description: Invalid input or no valid fields provided
 *       403:
 *         description: Only company admin can update company profile
 *       404:
 *         description: Company not found or unauthorized
 */
router.put('/update-profile', authenticateAny, updateProfile);

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     summary: Get profile (company admin or staff)
 *     tags: [Company Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile details
 */
router.get('/profile', authenticateAny, getProfile);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   put:
 *     summary: Change password (admin requires current password, staff may not if first login)
 *     tags: [Company Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [new_password]
 *             properties:
 *               current_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 */
router.put('/change-password', authenticateAny, (req, res, next) => {
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

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout and invalidate session
 *     tags: [Company Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', authenticateAny, logActivity, logout);

module.exports = router;
