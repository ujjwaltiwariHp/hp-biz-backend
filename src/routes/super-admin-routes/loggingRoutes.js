const express = require('express');
const router = express.Router();
const {
  getAllCompanyLogs,
  getCompanyLogs,
  getAllSystemLogs,
  exportAllCompanyLogs
} = require('../../controllers/super-admin-controllers/loggingController');
const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');

router.get('/system', authenticateSuperAdmin, getAllSystemLogs);

router.get('/export', authenticateSuperAdmin, exportAllCompanyLogs);

router.get('/activity', authenticateSuperAdmin, getAllCompanyLogs);

router.get('/company/:companyId/activity', authenticateSuperAdmin, getCompanyLogs);

module.exports = router;
