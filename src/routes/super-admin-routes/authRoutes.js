const express = require("express");
const router = express.Router();

const {
  login,
  createAdmin,
  getProfile,
  getAllAdmins,
  updateProfile,
  changePassword,
  logout,
  deleteAdmin,
  toggleAdminStatus
} = require("../../controllers/super-admin-controllers/authController");

const { authenticateSuperAdmin } = require("../../middleware/super-admin-middleware/authMiddleware");
const {
  validateSuperAdminCreation,
  validateSuperAdminLogin,
  validateProfileUpdate,
  validatePasswordChange,
} = require("../../middleware/super-admin-middleware/authValidation");

/**
 * @swagger
 * tags:
 *   name: Super Admin - Auth
 *   description: Super admin authentication endpoints
 */

/**
 * @swagger
 * /api/v1/super-admin/auth/login:
 *   post:
 *     summary: Super admin login
 *     tags: [Super Admin - Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", validateSuperAdminLogin, login);

/**
 * @swagger
 * /api/v1/super-admin/auth/create:
 *   post:
 *     summary: Create a new super admin
 *     tags: [Super Admin - Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 example: newadmin@example.com
 *               password:
 *                 type: string
 *                 example: strongPassword123
 *               name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: Super admin created successfully
 *       409:
 *         description: Email already exists
 */
router.post("/create", authenticateSuperAdmin, validateSuperAdminCreation, createAdmin);

/**
 * @swagger
 * /api/v1/super-admin/auth/profile:
 *   get:
 *     summary: Get super admin profile
 *     tags: [Super Admin - Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 */
router.get("/profile", authenticateSuperAdmin, getProfile);

/**
 * @swagger
 * /api/v1/super-admin/auth/all:
 *   get:
 *     summary: Get all super admins
 *     tags: [Super Admin - Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of super admins
 */
router.get("/all", authenticateSuperAdmin, getAllAdmins);

/**
 * @swagger
 * /api/v1/super-admin/auth/profile:
 *   put:
 *     summary: Update super admin profile
 *     tags: [Super Admin - Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: updatedadmin@example.com
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       409:
 *         description: Email already exists
 */
router.put("/profile", authenticateSuperAdmin, validateProfileUpdate, updateProfile);

/**
 * @swagger
 * /api/v1/super-admin/auth/change-password:
 *   put:
 *     summary: Change super admin password
 *     tags: [Super Admin - Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: oldPassword123
 *               newPassword:
 *                 type: string
 *                 example: newStrongPassword456
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Current password is incorrect
 */
router.put("/change-password", authenticateSuperAdmin, validatePasswordChange, changePassword);

/**
 * @swagger
 * /api/v1/super-admin/auth/logout:
 *   post:
 *     summary: Logout super admin
 *     tags: [Super Admin - Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post("/logout", authenticateSuperAdmin, logout);

router.delete('/delete/:id', authenticateSuperAdmin, deleteAdmin);
router.put('/toggle-status/:id', authenticateSuperAdmin, toggleAdminStatus);

module.exports = router;
