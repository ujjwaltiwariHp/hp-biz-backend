const express = require('express');
const {
  createLead,
  bulkUploadLeads,
  getLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  deleteLead,
  searchLeads,
  getLeadStatuses,
  getLeadStatusById,
  createLeadStatus,
  updateLeadStatusRecord,
  deleteLeadStatus,
  getLeadSources,
  getLeadSourceById,
  createLeadSource,
  updateLeadSource,
  deleteLeadSource,
  getLeadAssignmentHistory,
  getLeadTags,
  getLeadTagById,
  applyTagToLead,
  removeTagFromLead,
  getLeadTagsByLeadId,
  getLeadDetails,
  getLeadHistory,
  getLeadFollowUps,
  createFollowUp,
  getAllFollowUps,
  getFollowUpById,
  updateFollowUp,
  deleteFollowUp,
  markFollowUpComplete,
  updateLeadFollowUp,
  deleteLeadFollowUp
} = require('../controllers/leadsController');

const { authenticateAny, requirePermission } = require('../middleware/auth');
const bulkUploadMiddleware = require('../middleware/fileUpload');
const { logActivity } = require('../middleware/loggingMiddleware');
const { attachTimezone } = require('../middleware/timezoneMiddleware');
const {
    getCompanySubscriptionAndUsage,
    checkSubscriptionActive,
    checkLeadLimit,
    requireFeature
} = require('../middleware/subscriptionMiddleware');

const router = express.Router();

const timezoneChain = [authenticateAny, attachTimezone];
const subscriptionChain = [authenticateAny, attachTimezone, getCompanySubscriptionAndUsage, checkSubscriptionActive];
const permissionChain = [...subscriptionChain, requirePermission('lead_management')];

router.get('/sources', ...subscriptionChain, getLeadSources);
router.get('/sources/:id', ...subscriptionChain, getLeadSourceById);
router.post('/sources/create', ...permissionChain, logActivity, createLeadSource);
router.put('/sources/update/:id', ...permissionChain, logActivity, updateLeadSource);
router.delete('/sources/delete/:id', ...permissionChain, logActivity, deleteLeadSource);

router.get('/statuses', ...subscriptionChain, getLeadStatuses);
router.get('/statuses/:id', ...subscriptionChain, getLeadStatusById);
router.post('/statuses/create', ...permissionChain, logActivity, createLeadStatus);
router.put('/statuses/update/:id', ...permissionChain, updateLeadStatusRecord);
router.delete('/statuses/delete/:id', ...permissionChain, logActivity, deleteLeadStatus);

// Lead Creation with Limit Check
router.post('/create',
    ...permissionChain,
    checkLeadLimit,
    createLead
);
// Bulk Upload with Feature and Limit Check
router.post('/bulk-upload',
    ...permissionChain,
    requireFeature('bulk_upload'),
    bulkUploadMiddleware,
    checkLeadLimit,
    logActivity,
    bulkUploadLeads
);

router.get('/get', ...subscriptionChain, getLeads);
router.get('/get/:id', ...subscriptionChain, getLeadById);
router.put('/update/:id', ...permissionChain, updateLead);
router.put('/update/status/:id', ...permissionChain, updateLeadStatus);
router.delete('/delete/:id', ...permissionChain, logActivity, deleteLead);
router.get('/search', ...permissionChain, searchLeads);

router.get('/assignment-history', ...permissionChain, getLeadAssignmentHistory);

router.get('/tags', ...subscriptionChain, getLeadTags);
router.get('/tags/:id', ...subscriptionChain, getLeadTagById);
router.post('/:id/tags/apply', ...permissionChain, applyTagToLead);
router.delete('/:id/tags/:tagId/remove', ...permissionChain, logActivity, removeTagFromLead);
router.get('/:id/tags', ...permissionChain, getLeadTagsByLeadId);

router.get('/:id/details', ...subscriptionChain, getLeadDetails);
router.get('/:id/history', ...subscriptionChain, getLeadHistory);

router.get('/follow-ups/:leadsId', ...subscriptionChain, getLeadFollowUps);
router.post('/:id/follow-ups/create', ...permissionChain, logActivity, createFollowUp);
router.get('/follow-ups', ...subscriptionChain, getAllFollowUps);
router.get('/follow-ups/:followUpId', ...subscriptionChain, getFollowUpById);
router.put('/follow-ups/:id/update', ...permissionChain, updateFollowUp);
router.delete('/follow-ups/:id/delete', ...permissionChain, logActivity, deleteFollowUp);
router.patch('/follow-ups/:id/complete', ...permissionChain, logActivity, markFollowUpComplete);

router.put('/leads/:leadId/followups/:followUpId', updateLeadFollowUp);
router.delete('/leads/:leadId/followups/:followUpId', deleteLeadFollowUp);

module.exports = router;
