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
  toggleLeadStatus,
  toggleLeadSource,
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
  deleteLeadFollowUp,
  downloadSampleCsv,
  transferLeadController
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
const settingsPermission = [...subscriptionChain, requirePermission('lead_management', 'manage_settings')];

router.get('/sources', ...subscriptionChain, getLeadSources);
router.get('/sources/:id', ...subscriptionChain, getLeadSourceById);
router.post('/sources/create', ...settingsPermission, logActivity, createLeadSource);
router.put('/sources/update/:id', ...settingsPermission, logActivity, updateLeadSource);
router.delete('/sources/delete/:id', ...settingsPermission, logActivity, deleteLeadSource);
router.put('/sources/toggle/:id', ...settingsPermission, logActivity, toggleLeadSource);

router.get('/statuses', ...subscriptionChain, getLeadStatuses);
router.get('/statuses/:id', ...subscriptionChain, getLeadStatusById);
router.post('/statuses/create', ...settingsPermission, logActivity, createLeadStatus);
router.put('/statuses/update/:id', ...settingsPermission, updateLeadStatusRecord);
router.delete('/statuses/delete/:id', ...settingsPermission, logActivity, deleteLeadStatus);
router.put('/statuses/toggle/:id', ...settingsPermission, logActivity, toggleLeadStatus);

router.post('/create',
    ...subscriptionChain,
    requirePermission('lead_management', 'create'),
    checkLeadLimit,
    createLead
);

router.get('/bulk-upload/sample',
    ...subscriptionChain,
    requirePermission('lead_management', 'import'),
    requireFeature('bulk_upload'),
    downloadSampleCsv
);

router.post('/bulk-upload',
    ...subscriptionChain,
    requirePermission('lead_management', 'import'),
    requireFeature('bulk_upload'),
    bulkUploadMiddleware,
    checkLeadLimit,
    logActivity,
    bulkUploadLeads
);

router.get('/get', ...subscriptionChain, requirePermission('lead_management', 'view'), getLeads);
router.get('/get/:id', ...subscriptionChain, requirePermission('lead_management', 'view'), getLeadById);
router.get('/search', ...subscriptionChain, requirePermission('lead_management', 'view'), searchLeads);
router.get('/:id/details', ...subscriptionChain, requirePermission('lead_management', 'view'), getLeadDetails);
router.get('/:id/history', ...subscriptionChain, requirePermission('lead_management', 'view'), getLeadHistory);

router.put('/update/:id', ...subscriptionChain, requirePermission('lead_management', 'update'), updateLead);
router.put('/update/status/:id', ...subscriptionChain, requirePermission('lead_management', 'update'), updateLeadStatus);
router.delete('/delete/:id', ...subscriptionChain, requirePermission('lead_management', 'delete'), logActivity, deleteLead);
router.get('/:id/assignment-history', ...subscriptionChain, requirePermission('lead_management', 'view'), getLeadAssignmentHistory);

router.post('/transfer', ...subscriptionChain, requirePermission('lead_management', 'transfer'), logActivity, transferLeadController);

router.get('/tags', ...subscriptionChain, getLeadTags);
router.get('/tags/:id', ...subscriptionChain, getLeadTagById);
router.post('/:id/tags/apply', ...subscriptionChain, requirePermission('lead_management', 'update'), applyTagToLead);
router.delete('/:id/tags/:tagId/remove', ...subscriptionChain, requirePermission('lead_management', 'update'), logActivity, removeTagFromLead);
router.get('/:id/tags', ...subscriptionChain, getLeadTagsByLeadId);

router.get('/:id/follow-ups', ...subscriptionChain, requirePermission('lead_management', 'view'), getLeadFollowUps);
router.post('/:id/follow-ups/create', ...subscriptionChain, requirePermission('lead_management', 'update'), logActivity, createFollowUp);

router.get('/follow-ups/details/:id', ...subscriptionChain, requirePermission('lead_management', 'view'), getFollowUpById);
router.get('/follow-ups', ...subscriptionChain, requirePermission('lead_management', 'view'), getAllFollowUps);

router.put('/follow-ups/:id/update', ...subscriptionChain, requirePermission('lead_management', 'update'), updateFollowUp);
router.delete('/follow-ups/:id/delete', ...subscriptionChain, requirePermission('lead_management', 'update'), logActivity, deleteFollowUp);
router.patch('/follow-ups/:id/complete', ...subscriptionChain, requirePermission('lead_management', 'update'), logActivity, markFollowUpComplete);

router.put('/leads/:leadId/followups/:followUpId', ...subscriptionChain, requirePermission('lead_management', 'update'), updateLeadFollowUp);
router.delete('/leads/:leadId/followups/:followUpId', ...subscriptionChain, requirePermission('lead_management', 'update'), deleteLeadFollowUp);

module.exports = router;