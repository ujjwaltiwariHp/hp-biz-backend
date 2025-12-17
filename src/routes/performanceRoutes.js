const express = require('express');
const { globalLogActivity } = require('../middleware/loggingMiddleware');
const { attachTimezone } = require('../middleware/timezoneMiddleware');
const {
  getStaffComprehensiveReport,
  getAllStaffPerformance,
  getPerformanceDashboard,
  getCompanyPerformance,
  getStaffTimeline,
  getLeadConversionReport,
  getSourcePerformanceReport,
  getStatusWiseReport,
  getUserOpsReport,
  getUserStatusMatrix,
  generateCustomReport,
  getOverallCompanyReport,
  downloadStaffReportPDF,
  downloadCompanyReportPDF
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


router.get('/dashboard', ...reportsChain, getPerformanceDashboard);

router.get('/staff', ...reportsChain, getAllStaffPerformance);

router.get('/staff/:staffId', ...reportsChain, getStaffComprehensiveReport);

router.get('/staff/:staffId/download', ...reportsChain, downloadStaffReportPDF);

router.get('/staff/:staffId/timeline', ...reportsChain, getStaffTimeline);

router.get('/company', ...reportsChain, getCompanyPerformance);


router.get('/reports/lead-conversion', ...reportsChain, getLeadConversionReport);

router.get('/reports/source-performance', ...reportsChain, getSourcePerformanceReport);


router.get('/reports/status-wise', ...reportsChain, getStatusWiseReport);

router.get('/reports/user-ops', ...reportsChain, getUserOpsReport);

router.get('/reports/user-status-matrix', ...reportsChain, getUserStatusMatrix);


router.get('/reports/overall', ...reportsChain, getOverallCompanyReport);

router.get('/reports/overall/download', ...reportsChain, downloadCompanyReportPDF);

router.post('/reports/custom', ...reportsChain, generateCustomReport);

module.exports = router;