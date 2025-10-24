const express = require('express');
const router = express.Router();
const {
  getAllCompanyLogs,
  getCompanyLogs,
  getAllSystemLogs,
  exportAllCompanyLogs
} = require('../../controllers/super-admin-controllers/loggingController');
const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');
const { requireSuperAdminPermission } = require('../../middleware/super-admin-middleware/superAdminPermissionMiddleware'); // ADDED IMPORT

// All are view/reporting functions, so all require 'view' permission.
router.get('/system', authenticateSuperAdmin, requireSuperAdminPermission('logging', 'view'), getAllSystemLogs);

router.get('/export', authenticateSuperAdmin, requireSuperAdminPermission('logging', 'view'), exportAllCompanyLogs);

router.get('/activity', authenticateSuperAdmin, requireSuperAdminPermission('logging', 'view'), getAllCompanyLogs);

router.get('/company/:companyId/activity', authenticateSuperAdmin, requireSuperAdminPermission('logging', 'view'), getCompanyLogs);

module.exports = router;