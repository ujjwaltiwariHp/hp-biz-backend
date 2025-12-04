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

router.get('/dashboard', authenticateAny, attachTimezone, requirePermission('reports', 'view'), getPerformanceDashboard);

router.get('/staff', authenticateAny, attachTimezone, requirePermission('reports', 'view'), getAllStaffPerformance);

router.get('/staff/:staffId', authenticateAny, attachTimezone, requirePermission('reports', 'view'), getStaffPerformance);

router.get('/staff/:staffId/timeline', authenticateAny, attachTimezone, requirePermission('reports', 'view'), getStaffTimeline);

router.get('/company', authenticateAny, attachTimezone, requirePermission('reports', 'view'), getCompanyPerformance);

router.get('/reports/lead-conversion', authenticateAny, attachTimezone, requirePermission('reports', 'view'), getLeadConversionReport);

router.get('/reports/source-performance', authenticateAny, attachTimezone, requirePermission('reports', 'view'), getSourcePerformanceReport);

router.post('/reports/custom', authenticateAny, attachTimezone, requirePermission('reports', 'view'), generateCustomReport);

module.exports = router;