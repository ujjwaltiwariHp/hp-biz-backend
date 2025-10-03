const express = require('express');
const {
  getAllStaff,
  getCompanyRoles,
  getDesignationOptions,
  getStatusOptions,
  getStaffStats,
  getStaffById,
  createStaff,
  updateStaff,
  updateStaffStatus,
  deleteStaff,
  getStaffPerformance
} = require('../controllers/staffController');

const { authenticateAny, requirePermission } = require('../middleware/auth');
const { validateStaffData } = require('../middleware/validation');
const { logActivity } = require('../middleware/loggingMiddleware');

const router = express.Router();


/**
 * @swagger
 * /api/v1/staff:
 *   get:
 *     summary: Get all employees
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staff list fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/', authenticateAny, requirePermission('user_management'), getAllStaff);

/**
 * @swagger
 * /api/v1/staff/roles:
 *   get:
 *     summary: Get company roles
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/roles', authenticateAny, getCompanyRoles);

/**
 * @swagger
 * /api/v1/staff/designations:
 *   get:
 *     summary: Get designation options
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Designations fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/designations', authenticateAny, getDesignationOptions);

/**
 * @swagger
 * /api/v1/staff/statuses:
 *   get:
 *     summary: Get status options
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statuses fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/statuses', authenticateAny, getStatusOptions);

/**
 * @swagger
 * /api/v1/staff/stats:
 *   get:
 *     summary: Get staff statistics
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staff statistics fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/stats', authenticateAny, requirePermission('user_management'), getStaffStats);

/**
 * @swagger
 * /api/v1/staff/{id}:
 *   get:
 *     summary: Get staff by ID
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     responses:
 *       200:
 *         description: Staff details fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Staff not found
 */
router.get('/:id', authenticateAny, requirePermission('user_management'), getStaffById);

/**
 * @swagger
 * /api/v1/staff/create:
 *   post:
 *     summary: Create new employee
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, email, role_id]
 *             properties:
 *               first_name:
 *                 type: string
 *                 minLength: 2
 *                 example: "John"
 *               last_name:
 *                 type: string
 *                 minLength: 2
 *                 example: "Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@company.com"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               designation:
 *                 type: string
 *                 example: "Manager"
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *                 default: active
 *               role_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Employee created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       409:
 *         description: Email already exists
 */
router.post('/create', authenticateAny, requirePermission('user_management'), validateStaffData, createStaff);

/**
 * @swagger
 * /api/v1/staff/{id}:
 *   put:
 *     summary: Update employee by ID
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *                 minLength: 2
 *               last_name:
 *                 type: string
 *                 minLength: 2
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               designation:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *               role_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Employee updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Staff not found
 *       409:
 *         description: Email already exists
 */
router.put('/:id', authenticateAny, requirePermission('user_management'), updateStaff);

/**
 * @swagger
 * /api/v1/staff/status/{id}:
 *   put:
 *     summary: Update employee status
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *                 example: "active"
 *     responses:
 *       200:
 *         description: Employee status updated successfully
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions or cannot deactivate last admin
 *       404:
 *         description: Staff not found
 */
router.put('/status/:id', authenticateAny, requirePermission('user_management'), updateStaffStatus);

/**
 * @swagger
 * /api/v1/staff/delete/{id}:
 *   delete:
 *     summary: Delete employee by ID
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     responses:
 *       200:
 *         description: Employee deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions or cannot delete last admin
 *       404:
 *         description: Staff not found
 */
router.delete('/delete/:id', authenticateAny, requirePermission('user_management'), logActivity, deleteStaff);

/**
 * @swagger
 * /api/v1/staff/{id}/performance:
 *   get:
 *     summary: Get employee performance metrics
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     responses:
 *       200:
 *         description: Employee performance fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Staff not found
 */
router.get('/:id/performance', authenticateAny, requirePermission('user_management'), getStaffPerformance);

module.exports = router;
