const express = require('express');
const { globalLogActivity } = require('../middleware/loggingMiddleware');
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

router.get('/dashboard', authenticateAny, requirePermission('view_reports'), getPerformanceDashboard);

router.get('/staff', authenticateAny, getAllStaffPerformance);

router.get('/staff/:staffId', authenticateAny, getStaffPerformance);

router.get('/staff/:staffId/timeline', authenticateAny, getStaffTimeline);

router.get('/company', authenticateAny, requirePermission('view_reports'), getCompanyPerformance);

router.get('/reports/lead-conversion', authenticateAny, requirePermission('view_reports'), getLeadConversionReport);

router.get('/reports/source-performance', authenticateAny, requirePermission('view_reports'), getSourcePerformanceReport);

router.post('/reports/custom', authenticateAny, requirePermission('view_reports'), generateCustomReport);

module.exports = router;