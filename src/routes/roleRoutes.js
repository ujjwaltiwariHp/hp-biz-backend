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
const { attachTimezone } = require('../middleware/timezoneMiddleware');

router.use(authenticateAny);
router.use(attachTimezone);

router.post('/create', requirePermission('role_management'), createRole);
router.get('/', getAllRoles);
router.get('/:id', getRoleById);
router.put('/update/:id', requirePermission('role_management'), updateRole);
router.delete('/delete/:id', requirePermission('role_management'), logActivity, deleteRole);
router.get('/permissions', getAvailablePermissions);
router.get('/stats', requirePermission('user_management'), getStaffCountByRole);
router.post('/create-default', adminOnly, logActivity, createDefaultRoles);
router.get('/check-permission/:permission_key', checkPermission);
router.get('/:id/permissions', getRolePermissions);

module.exports = router;