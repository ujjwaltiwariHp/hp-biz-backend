const express = require('express');
const { globalLogActivity } = require('../middleware/loggingMiddleware');
const { attachTimezone } = require('../middleware/timezoneMiddleware');
const {
  getDashboard,
  getStaffReport,
  getCompanyReport,
  generateCustomReport,
  downloadStaffPdf,
  downloadCompanyPdf
} = require('../controllers/performanceController');

const { authenticateAny, requirePermission } = require('../middleware/auth');
const { requireFeature, getCompanySubscriptionAndUsage } = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(globalLogActivity);

const reportsChain = [
  authenticateAny,
  attachTimezone,
  getCompanySubscriptionAndUsage,
  requireFeature('view_reports'),
  requirePermission('reports', 'view')
];

router.get('/dashboard', ...reportsChain, getDashboard);

router.get('/company-report', ...reportsChain, getCompanyReport);
router.get('/company-report/download', ...reportsChain, downloadCompanyPdf);

router.get('/staff-report/:staffId', ...reportsChain, getStaffReport);
router.get('/staff-report/:staffId/download', ...reportsChain, downloadStaffPdf);

router.post('/reports/custom', ...reportsChain, generateCustomReport);

module.exports = router;