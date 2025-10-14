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

const router = express.Router();

const timezoneChain = [authenticateAny, attachTimezone];
const permissionChain = [authenticateAny, attachTimezone, requirePermission('lead_management')];

router.get('/sources', ...timezoneChain, getLeadSources);
router.get('/sources/:id', ...timezoneChain, getLeadSourceById);
router.post('/sources/create', ...permissionChain, logActivity, createLeadSource);
router.put('/sources/update/:id', ...permissionChain, logActivity, updateLeadSource);
router.delete('/sources/delete/:id', ...permissionChain, logActivity, deleteLeadSource);

router.get('/statuses', ...timezoneChain, getLeadStatuses);
router.get('/statuses/:id', ...timezoneChain, getLeadStatusById);
router.post('/statuses/create', ...permissionChain, logActivity, createLeadStatus);
router.put('/statuses/update/:id', ...permissionChain, updateLeadStatusRecord);
router.delete('/statuses/delete/:id', ...permissionChain, logActivity, deleteLeadStatus);

router.post('/create', ...permissionChain, createLead);
router.post('/bulk-upload', ...permissionChain, bulkUploadMiddleware, logActivity, bulkUploadLeads);
router.get('/get', ...timezoneChain, getLeads);
router.get('/get/:id', ...timezoneChain, getLeadById);
router.put('/update/:id', ...permissionChain, updateLead);
router.put('/update/status/:id', ...permissionChain, updateLeadStatus);
router.delete('/delete/:id', ...permissionChain, logActivity, deleteLead);
router.get('/search', ...permissionChain, searchLeads);

router.get('/assignment-history', ...permissionChain, getLeadAssignmentHistory);

router.get('/tags', ...timezoneChain, getLeadTags);
router.get('/tags/:id', ...timezoneChain, getLeadTagById);
router.post('/:id/tags/apply', ...permissionChain, applyTagToLead);
router.delete('/:id/tags/:tagId/remove', ...permissionChain, logActivity, removeTagFromLead);
router.get('/:id/tags', ...permissionChain, getLeadTagsByLeadId);

router.get('/:id/details', ...timezoneChain, getLeadDetails);
router.get('/:id/history', ...timezoneChain, getLeadHistory);

router.get('/follow-ups/:id', ...timezoneChain, getLeadFollowUps);
router.post('/:id/follow-ups/create', ...permissionChain, logActivity, createFollowUp);
router.get('/follow-ups', ...timezoneChain, getAllFollowUps);
router.get('/follow-ups/:id', ...timezoneChain, getFollowUpById);
router.put('/follow-ups/:id/update', ...permissionChain, updateFollowUp);
router.delete('/follow-ups/:id/delete', ...permissionChain, logActivity, deleteFollowUp);
router.patch('/follow-ups/:id/complete', ...permissionChain, logActivity, markFollowUpComplete);

router.put('/leads/:leadId/followups/:followUpId', updateLeadFollowUp);
router.delete('/leads/:leadId/followups/:followUpId', deleteLeadFollowUp);

module.exports = router;
