const express = require("express");
const router = express.Router();
const {
  getUserLogs,
  getSystemEventLogs,
  getActivityDashboard,
  getStaffActivitySummary,
  exportLogs,
  cleanupOldLogs
} = require("../controllers/loggingController");
const { authenticateAny, adminOnly, requirePermission } = require("../middleware/auth");

/**
 * @swagger
 * tags:
 *   name: Logging
 *   description: System and user activity logging APIs
 */

/**
 * @swagger
 * /api/v1/logs/activity:
 *   get:
 *     summary: Get user activity logs
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: staff_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: action_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 50
 *     responses:
 *       200:
 *         description: User activity logs retrieved
 *       401:
 *         description: Unauthorized
 */
router.get("/activity", authenticateAny, getUserLogs);

/**
 * @swagger
 * /api/v1/logs/system:
 *   get:
 *     summary: Get system logs
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: log_level
 *         schema:
 *           type: string
 *           example: error
 *       - in: query
 *         name: log_category
 *         schema:
 *           type: string
 *           example: database
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: System logs retrieved
 *       401:
 *         description: Unauthorized
 */
router.get("/system", authenticateAny, adminOnly, getSystemEventLogs);

/**
 * @swagger
 * /api/v1/logs/dashboard:
 *   get:
 *     summary: Get activity dashboard summary
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           example: 7
 *     responses:
 *       200:
 *         description: Activity summary retrieved
 *       401:
 *         description: Unauthorized
 */
router.get("/dashboard", authenticateAny, getActivityDashboard);

/**
 * @swagger
 * /api/v1/logs/staff/activity/{staff_id}:
 *   get:
 *     summary: Get specific staff activity summary
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staff_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Staff activity summary retrieved
 *       401:
 *         description: Unauthorized
 */
router.get("/staff/activity/:staff_id", authenticateAny, requirePermission('staff_view'), getStaffActivitySummary);

/**
 * @swagger
 * /api/v1/logs/export:
 *   get:
 *     summary: Export logs as CSV
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [activity, system]
 *           example: activity
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: CSV file exported
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 */
router.get("/export", authenticateAny, adminOnly, exportLogs);

/**
 * @swagger
 * /api/v1/logs/cleanup:
 *   post:
 *     summary: Cleanup old logs beyond given days
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               days_to_keep:
 *                 type: integer
 *                 example: 90
 *     responses:
 *       200:
 *         description: Logs cleaned successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/cleanup", authenticateAny, adminOnly, cleanupOldLogs);

module.exports = router;
