const express = require("express");

const router = express.Router();
const {
  getAllRoles,
  getAvailablePermissions,
  getStaffCountByRole,
  createDefaultRoles,
  checkPermission,
  getRoleById,
  getRolePermissions,
  createRole,
  updateRole,
  deleteRole
} = require('../controllers/roleController');

const { authenticateAny, requirePermission, adminOnly } = require('../middleware/auth');
const { logActivity } = require('../middleware/loggingMiddleware');

router.use(authenticateAny);

/**
 * @swagger
 * /api/v1/roles/create:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role_name
 *               - description
 *             properties:
 *               role_name:
 *                 type: string
 *               description:
 *                 type: string
 *               permissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: boolean
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Role name already exists
 */
router.post('/create', requirePermission('role_management'), createRole);

/**
 * @swagger
 * /api/v1/roles:
 *   get:
 *     summary: Get all roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles fetched successfully
 */
router.get('/', getAllRoles);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role details fetched
 *       404:
 *         description: No role found
 */
router.get('/:id', getRoleById);

/**
 * @swagger
 * /api/v1/roles/update/{id}:
 *   put:
 *     summary: Update role by ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role_name:
 *                 type: string
 *               description:
 *                 type: string
 *               permissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: boolean
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       404:
 *         description: Role not found
 */
router.put('/update/:id', requirePermission('role_management'), updateRole);

/**
 * @swagger
 * /api/v1/roles/delete/{id}:
 *   delete:
 *     summary: Delete role by ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       404:
 *         description: Role not found
 *       403:
 *         description: Cannot delete default or assigned role
 */
router.delete('/delete/:id', requirePermission('role_management'), logActivity, deleteRole);

/**
 * @swagger
 * /api/v1/roles/permissions:
 *   get:
 *     summary: Get list of available permissions
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available permissions fetched
 */
router.get('/permissions', getAvailablePermissions);

/**
 * @swagger
 * /api/v1/roles/stats:
 *   get:
 *     summary: Get staff count by role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role statistics fetched
 */
router.get('/stats', requirePermission('user_management'), getStaffCountByRole);

/**
 * @swagger
 * /api/v1/roles/create-default:
 *   post:
 *     summary: Create default roles for a company
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default roles created successfully
 */
router.post('/create-default', adminOnly, logActivity, createDefaultRoles);

/**
 * @swagger
 * /api/v1/roles/check-permission/{permission_key}:
 *   get:
 *     summary: Check if current staff has a permission
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: permission_key
 *         required: true
 *         schema:
 *           type: string
 *         description: Permission key to check
 *     responses:
 *       200:
 *         description: Permission check result
 */
router.get('/check-permission/:permission_key', checkPermission);

/**
 * @swagger
 * /api/v1/roles/{id}/permissions:
 *   get:
 *     summary: Get permissions of a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role permissions fetched
 *       404:
 *         description: Role not found
 */
router.get('/:id/permissions', getRolePermissions);

module.exports = router;
