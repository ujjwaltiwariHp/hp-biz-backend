const express = require('express');
const { globalLogActivity } = require('../middleware/loggingMiddleware');
const { attachTimezone } = require('../middleware/timezoneMiddleware');
const {
  getStaffPerformance,
  getAllStaffPerformance,
  getPerformanceDashboard,
  getCompanyPerformance,
  getStaffTimeline,
  getLeadConversionReport,
  getSourcePerformanceReport,
  generateCustomReport
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

router.get('/staff/:staffId', ...reportsChain, getStaffPerformance);

router.get('/staff/:staffId/timeline', ...reportsChain, getStaffTimeline);

router.get('/company', ...reportsChain, getCompanyPerformance);

router.get('/reports/lead-conversion', ...reportsChain, getLeadConversionReport);

router.get('/reports/source-performance', ...reportsChain, getSourcePerformanceReport);

router.post('/reports/custom', ...reportsChain, generateCustomReport);

module.exports = router;