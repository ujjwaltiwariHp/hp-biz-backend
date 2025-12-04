const express = require('express');
const {
  getDistributionSettings,
  updateDistributionSettings,
  manualAssignLeads,
  automaticAssignLeads,
  roundRobinAssignLeads,
  performanceBasedAssignLeads,
  getStaffWorkload,
  getUnassignedLeads
} = require('../controllers/leadDistributionController');

const { getLeadAssignmentHistory } = require('../controllers/leadsController');

const { authenticateAny, requirePermission } = require('../middleware/auth');
const { logActivity } = require('../middleware/loggingMiddleware');
const { attachTimezone } = require('../middleware/timezoneMiddleware');

const router = express.Router();

const timezoneChain = [authenticateAny, attachTimezone];

router.get('/settings', ...timezoneChain, requirePermission('lead_management', 'view'), getDistributionSettings);
router.put('/update/settings', ...timezoneChain, requirePermission('lead_management', 'manage_settings'), updateDistributionSettings);

router.post('/assign/manual', ...timezoneChain, requirePermission('lead_management', 'assign'), manualAssignLeads);

router.post('/assign/automatic', ...timezoneChain, requirePermission('lead_management', 'assign'), automaticAssignLeads);
router.post('/assign/round-robin', ...timezoneChain, requirePermission('lead_management', 'assign'), logActivity, roundRobinAssignLeads);
router.post('/assign/performance-based', ...timezoneChain, requirePermission('lead_management', 'assign'), logActivity, performanceBasedAssignLeads);

router.get('/staff/workload', ...timezoneChain, requirePermission('lead_management', 'view'), getStaffWorkload);
router.get('/unassigned', ...timezoneChain, requirePermission('lead_management', 'view'), getUnassignedLeads);

router.get('/assignment-history', ...timezoneChain, requirePermission('lead_management', 'view'), getLeadAssignmentHistory);

module.exports = router;
