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

const router = express.Router();

router.use(globalLogActivity);

router.get('/dashboard', authenticateAny, attachTimezone, requirePermission('view_reports'), getPerformanceDashboard);

router.get('/staff', authenticateAny, attachTimezone, getAllStaffPerformance);

router.get('/staff/:staffId', authenticateAny, attachTimezone, getStaffPerformance);

router.get('/staff/:staffId/timeline', authenticateAny, attachTimezone, getStaffTimeline);

router.get('/company', authenticateAny, attachTimezone, requirePermission('view_reports'), getCompanyPerformance);

router.get('/reports/lead-conversion', authenticateAny, attachTimezone, requirePermission('view_reports'), getLeadConversionReport);

router.get('/reports/source-performance', authenticateAny, attachTimezone, requirePermission('view_reports'), getSourcePerformanceReport);

router.post('/reports/custom', authenticateAny, attachTimezone, requirePermission('view_reports'), generateCustomReport);

module.exports = router;