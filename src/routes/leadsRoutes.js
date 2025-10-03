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

const router = express.Router();



/**
 * @swagger
 * /api/v1/leads/sources:
 *   get:
 *     summary: Get all lead sources
 *     tags: [Lead Sources]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of lead sources
 */
router.get('/sources', authenticateAny, getLeadSources);

/**
 * @swagger
 * /api/v1/leads/sources/{id}:
 *   get:
 *     summary: Get lead source by ID
 *     tags: [Lead Sources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Lead source details
 *       404:
 *         description: Lead source not found
 */
router.get('/sources/:id', authenticateAny, getLeadSourceById);

/**
 * @swagger
 * /api/v1/leads/sources/create:
 *   post:
 *     summary: Create a new lead source
 *     tags: [Lead Sources]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [source_name]
 *             properties:
 *               source_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lead source created successfully
 */
router.post('/sources/create', authenticateAny, requirePermission('lead_management'), logActivity, createLeadSource);

/**
 * @swagger
 * /api/v1/leads/sources/update/{id}:
 *   put:
 *     summary: Update lead source
 *     tags: [Lead Sources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               source_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lead source updated
 *       404:
 *         description: Not found
 */
router.put('/sources/update/:id', authenticateAny, requirePermission('lead_management'), logActivity, updateLeadSource);

/**
 * @swagger
 * /api/v1/leads/sources/delete/{id}:
 *   delete:
 *     summary: Delete lead source
 *     tags: [Lead Sources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead source deleted
 *       404:
 *         description: Not found
 */
router.delete('/sources/delete/:id', authenticateAny, requirePermission('lead_management'), logActivity, deleteLeadSource);



/**
 * @swagger
 * /api/v1/leads/statuses:
 *   get:
 *     summary: Get all lead statuses
 *     tags: [Lead Statuses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of lead statuses
 */
router.get('/statuses', authenticateAny, getLeadStatuses);

/**
 * @swagger
 * /api/v1/leads/statuses/{id}:
 *   get:
 *     summary: Get lead status by ID
 *     tags: [Lead Statuses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead status details
 *       404:
 *         description: Not found
 */
router.get('/statuses/:id', authenticateAny, getLeadStatusById);

/**
 * @swagger
 * /api/v1/leads/statuses/create:
 *   post:
 *     summary: Create a new lead status
 *     tags: [Lead Statuses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status_name]
 *             properties:
 *               status_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lead status created successfully
 */
router.post('/statuses/create', authenticateAny, requirePermission('lead_management'), logActivity, createLeadStatus);

/**
 * @swagger
 * /api/v1/leads/statuses/update/{id}:
 *   put:
 *     summary: Update lead status
 *     tags: [Lead Statuses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead status updated successfully
 *       404:
 *         description: Not found
 */
router.put('/statuses/update/:id', authenticateAny, requirePermission('lead_management'), updateLeadStatusRecord);

/**
 * @swagger
 * /api/v1/leads/statuses/delete/{id}:
 *   delete:
 *     summary: Delete lead status
 *     tags: [Lead Statuses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead status deleted successfully
 *       400:
 *         description: Cannot delete status in use
 *       404:
 *         description: Not found
 */
router.delete('/statuses/delete/:id', authenticateAny, requirePermission('lead_management'), logActivity, deleteLeadStatus);



/**
 * @swagger
 * /api/v1/leads/create:
 *   post:
 *     summary: Create a new lead
 *     tags: [Leads CRUD]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, lead_source_id]
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               lead_source_id:
 *                 type: integer
 *               assigned_to:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Lead created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Lead already exists
 */
router.post('/create', authenticateAny, requirePermission('lead_management'), createLead);

/**
 * @swagger
 * /api/v1/leads/bulk-upload:
 *   post:
 *     summary: Bulk upload leads from file
 *     tags: [Leads CRUD]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bulk upload complete
 *       400:
 *         description: Invalid rows in file
 */
router.post('/bulk-upload', authenticateAny, requirePermission('lead_management'), bulkUploadMiddleware, logActivity, bulkUploadLeads);

/**
 * @swagger
 * /api/v1/leads/get:
 *   get:
 *     summary: Get all leads
 *     tags: [Leads CRUD]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of leads
 */
router.get('/get', authenticateAny, getLeads);

/**
 * @swagger
 * /api/v1/leads/get/{id}:
 *   get:
 *     summary: Get lead by ID
 *     tags: [Leads CRUD]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead details
 *       404:
 *         description: Not found
 */
router.get('/get/:id', authenticateAny, getLeadById);

/**
 * @swagger
 * /api/v1/leads/update/{id}:
 *   put:
 *     summary: Update a lead
 *     tags: [Leads CRUD]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead updated successfully
 *       404:
 *         description: Not found
 */
router.put('/update/:id', authenticateAny, requirePermission('lead_management'), updateLead);

/**
 * @swagger
 * /api/v1/leads/update/status/{id}:
 *   put:
 *     summary: Update lead status
 *     tags: [Leads CRUD]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead status updated
 *       404:
 *         description: Not found
 */
router.put('/update/status/:id', authenticateAny, requirePermission('lead_management'), updateLeadStatus);

/**
 * @swagger
 * /api/v1/leads/delete/{id}:
 *   delete:
 *     summary: Delete a lead
 *     tags: [Leads CRUD]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead deleted successfully
 *       404:
 *         description: Not found
 */
router.delete('/delete/:id', authenticateAny, requirePermission('lead_management'), logActivity, deleteLead);

/**
 * @swagger
 * /api/v1/leads/search:
 *   get:
 *     summary: Search leads
 *     tags: [Leads Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search term (name, email, phone)
 *     responses:
 *       200:
 *         description: Matching leads list
 */
router.get('/search', authenticateAny, requirePermission('lead_management'), searchLeads);


/**
 * @swagger
 * /api/v1/leads/assignment-history:
 *   get:
 *     summary: Get lead assignment history
 *     tags: [Leads Details]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assignment history records
 */
router.get('/assignment-history', authenticateAny, requirePermission('lead_management'), getLeadAssignmentHistory);


/**
 * @swagger
 * /api/v1/leads/tags:
 *   get:
 *     summary: Get all lead tags
 *     tags: [Leads Details]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of lead tags
 */
router.get('/tags', authenticateAny, getLeadTags);

/**
 * @swagger
 * /api/v1/leads/tags/{id}:
 *   get:
 *     summary: Get a lead tag by ID
 *     tags: [Leads Details]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Lead tag details
 *       404:
 *         description: Not found
 */
router.get('/tags/:id', authenticateAny, getLeadTagById);

/**
 * @swagger
 * /api/v1/leads/{id}/tags/apply:
 *   post:
 *     summary: Apply a tag to a lead
 *     tags: [Leads Details]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tag_id]
 *             properties:
 *               tag_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Tag applied to lead
 */
router.post('/:id/tags/apply', authenticateAny, requirePermission('lead_management'), applyTagToLead);

/**
 * @swagger
 * /api/v1/leads/{id}/tags/{tagId}/remove:
 *   delete:
 *     summary: Remove a tag from a lead
 *     tags: [Leads Details]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag removed from lead
 */
router.delete('/:id/tags/:tagId/remove', authenticateAny, requirePermission('lead_management'), logActivity, removeTagFromLead);

/**
 * @swagger
 * /api/v1/leads/{id}/tags:
 *   get:
 *     summary: Get tags applied to a lead
 *     tags: [Leads Details]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: List of tags for the lead
 */
router.get('/:id/tags', authenticateAny, requirePermission('lead_management'), getLeadTagsByLeadId);



/**
 * @swagger
 * /api/v1/leads/{id}/details:
 *   get:
 *     summary: Get detailed information about a lead
 *     tags: [Leads Details]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/details', authenticateAny, getLeadDetails);

/**
 * @swagger
 * /api/v1/leads/{id}/history:
 *   get:
 *     summary: Get lead history (status changes, updates, etc.)
 *     tags: [Leads Details]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/history', authenticateAny, getLeadHistory);



/**
 * @swagger
 * /api/v1/leads/{id}/follow-ups:
 *   get:
 *     summary: Get follow-ups for a specific lead
 *     tags: [Leads Followups]
 *     security:
 *       - bearerAuth: []
 */
router.get('/follow-ups/:id', authenticateAny, getLeadFollowUps);

/**
 * @swagger
 * /api/v1/leads/{id}/follow-ups/create:
 *   post:
 *     summary: Create a follow-up for a lead
 *     tags: [Leads Followups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [note, follow_up_date]
 *             properties:
 *               note:
 *                 type: string
 *               follow_up_date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Follow-up created
 */
router.post('/:id/follow-ups/create', authenticateAny, requirePermission('lead_management'), logActivity, createFollowUp);

/**
 * @swagger
 * /api/v1/leads/follow-ups:
 *   get:
 *     summary: Get all follow-ups
 *     tags: [Leads Followups]
 *     security:
 *       - bearerAuth: []
 */
router.get('/follow-ups', authenticateAny, getAllFollowUps);

/**
 * @swagger
 * /api/v1/leads/follow-ups/{id}:
 *   get:
 *     summary: Get follow-up by ID
 *     tags: [Leads Followups]
 *     security:
 *       - bearerAuth: []
 */
router.get('/follow-ups/:id', authenticateAny, getFollowUpById);

/**
 * @swagger
 * /api/v1/leads/follow-ups/{id}/update:
 *   put:
 *     summary: Update a follow-up
 *     tags: [Leads Followups]
 *     security:
 *       - bearerAuth: []
 */
router.put('/follow-ups/:id/update', authenticateAny, requirePermission('lead_management'), updateFollowUp);

/**
 * @swagger
 * /api/v1/leads/follow-ups/{id}/delete:
 *   delete:
 *     summary: Delete a follow-up
 *     tags: [Leads Followups]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/follow-ups/:id/delete', authenticateAny, requirePermission('lead_management'), logActivity, deleteFollowUp);

/**
 * @swagger
 * /api/v1/leads/follow-ups/{id}/complete:
 *   patch:
 *     summary: Mark a follow-up as complete
 *     tags: [Leads Followups]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/follow-ups/:id/complete', authenticateAny, requirePermission('lead_management'), logActivity, markFollowUpComplete);

router.put('/leads/:leadId/followups/:followUpId', updateLeadFollowUp);
router.delete('/leads/:leadId/followups/:followUpId', deleteLeadFollowUp);

module.exports = router;
