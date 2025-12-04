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

router.post('/create', requirePermission('role_management', 'create'), createRole);

router.get('/', requirePermission('role_management', 'view'), getAllRoles);
router.get('/:id', requirePermission('role_management', 'view'), getRoleById);

router.put('/update/:id', requirePermission('role_management', 'update'), updateRole);

router.delete('/delete/:id', requirePermission('role_management', 'delete'), logActivity, deleteRole);


router.get('/permissions', requirePermission('role_management', 'view'), getAvailablePermissions);


router.get('/stats', requirePermission('user_management', 'view'), getStaffCountByRole);


router.post('/create-default', adminOnly, logActivity, createDefaultRoles);


router.get('/check-permission/:permission_key', checkPermission);

router.get('/:id/permissions', requirePermission('role_management', 'view'), getRolePermissions);

module.exports = router;