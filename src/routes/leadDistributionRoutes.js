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

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: LeadsDistribution
 *   description: Leads distribution management endpoints
 */

/**
 * @swagger
 * /leads/settings:
 *   get:
 *     summary: Get distribution settings
 *     tags: [LeadsDistribution]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched settings
 */
router.get('/settings', authenticateAny, getDistributionSettings);

/**
 * @swagger
 * /leads/update/settings:
 *   put:
 *     summary: Update distribution settings
 *     tags: [LeadsDistribution]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               distribution_type:
 *                 type: string
 *                 enum: [manual, automatic, round_robin, performance_based]
 *               is_active:
 *                 type: boolean
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Distribution settings updated
 */
router.put('/update/settings', authenticateAny, requirePermission('lead_management'), updateDistributionSettings);

/**
 * @swagger
 * /leads/assign/manual:
 *   post:
 *     summary: Manually assign leads to staff
 *     tags: [LeadsDistribution]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assignments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     staff_id:
 *                       type: integer
 *                     lead_ids:
 *                       type: array
 *                       items:
 *                         type: integer
 *     responses:
 *       200:
 *         description: Leads assigned manually
 */
router.post('/assign/manual', authenticateAny, requirePermission('lead_management'), manualAssignLeads);

/**
 * @swagger
 * /leads/assign/automatic:
 *   post:
 *     summary: Automatically assign leads based on staff workload
 *     tags: [LeadsDistribution]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               count:
 *                 type: integer
 *                 default: 10
 *     responses:
 *       200:
 *         description: Leads assigned automatically
 */
router.post('/assign/automatic', authenticateAny, requirePermission('lead_management'), automaticAssignLeads);

/**
 * @swagger
 * /leads/assign/round-robin:
 *   post:
 *     summary: Assign leads using round robin method
 *     tags: [LeadsDistribution]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               count:
 *                 type: integer
 *                 default: 10
 *     responses:
 *       200:
 *         description: Leads assigned using round robin
 */
router.post('/assign/round-robin', authenticateAny, requirePermission('lead_management'), logActivity, roundRobinAssignLeads);

/**
 * @swagger
 * /leads/assign/performance-based:
 *   post:
 *     summary: Assign leads based on staff performance
 *     tags: [LeadsDistribution]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               count:
 *                 type: integer
 *                 default: 10
 *     responses:
 *       200:
 *         description: Leads assigned based on performance
 */
router.post('/assign/performance-based', authenticateAny, requirePermission('lead_management'), logActivity, performanceBasedAssignLeads);

/**
 * @swagger
 * /leads/staff/workload:
 *   get:
 *     summary: Get staff workload
 *     tags: [LeadsDistribution]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staff workload fetched successfully
 */
router.get('/staff/workload', authenticateAny, getStaffWorkload);

/**
 * @swagger
 * /leads/unassigned:
 *   get:
 *     summary: Get unassigned leads
 *     tags: [LeadsDistribution]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of leads to fetch
 *     responses:
 *       200:
 *         description: List of unassigned leads
 */
router.get('/unassigned', authenticateAny, getUnassignedLeads);

/**
 * @swagger
 * /leads/assignment-history:
 *   get:
 *     summary: Get lead assignment history
 *     tags: [LeadsDistribution]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: staff_id
 *         schema:
 *           type: integer
 *         description: Filter by staff ID
 *     responses:
 *       200:
 *         description: Lead assignment history fetched successfully
 */
router.get('/assignment-history', authenticateAny, requirePermission('lead_management'), getLeadAssignmentHistory);

module.exports = router;
