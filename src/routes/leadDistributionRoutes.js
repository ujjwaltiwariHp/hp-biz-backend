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
const permissionChain = [authenticateAny, attachTimezone, requirePermission('lead_management')];

router.get('/settings', ...timezoneChain, getDistributionSettings);
router.put('/update/settings', ...permissionChain, updateDistributionSettings);
router.post('/assign/manual', ...permissionChain, manualAssignLeads);
router.post('/assign/automatic', ...permissionChain, automaticAssignLeads);
router.post('/assign/round-robin', ...permissionChain, logActivity, roundRobinAssignLeads);
router.post('/assign/performance-based', ...permissionChain, logActivity, performanceBasedAssignLeads);
router.get('/staff/workload', ...timezoneChain, getStaffWorkload);
router.get('/unassigned', ...timezoneChain, getUnassignedLeads);
router.get('/assignment-history', ...permissionChain, getLeadAssignmentHistory);

module.exports = router;
