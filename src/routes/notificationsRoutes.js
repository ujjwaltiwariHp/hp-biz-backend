const express = require('express');
const {
  getNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  getNotificationHistory,
  updateNotificationSettings,
  getNotificationSettings,
  deleteNotification
} = require('../controllers/notificationsController');

const { authenticateAny } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notification management APIs
 */

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Get all notifications for current staff
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of notifications to fetch
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 */
router.get('/', authenticateAny, getNotifications);

/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Get count of unread notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/unread-count', authenticateAny, getUnreadCount);

/**
 * @swagger
 * /api/v1/notifications/history:
 *   get:
 *     summary: Get notification history
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of notifications to fetch
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 */
router.get('/history', authenticateAny, getNotificationHistory);

/**
 * @swagger
 * /api/v1/notifications/settings:
 *   get:
 *     summary: Get notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/settings', authenticateAny, getNotificationSettings);

/**
 * @swagger
 * /api/v1/notifications/settings:
 *   put:
 *     summary: Update notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email_notifications:
 *                 type: boolean
 */
router.put('/settings', authenticateAny, updateNotificationSettings);

/**
 * @swagger
 * /api/v1/notifications/{id}:
 *   get:
 *     summary: Get notification by ID
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get('/:id', authenticateAny, getNotificationById);

/**
 * @swagger
 * /api/v1/notifications/mark-read/{id}:
 *   post:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/mark-read/:id', authenticateAny, markNotificationAsRead);

/**
 * @swagger
 * /api/v1/notifications/mark-all-read:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/mark-all-read', authenticateAny, markAllNotificationsAsRead);

/**
 * @swagger
 * /api/v1/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.delete('/:id', authenticateAny, deleteNotification);

module.exports = router;