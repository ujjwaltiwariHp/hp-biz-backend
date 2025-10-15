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
const { attachTimezone } = require('../middleware/timezoneMiddleware');

const router = express.Router();

router.get('/', authenticateAny, attachTimezone, getNotifications);

router.get('/unread-count', authenticateAny, attachTimezone, getUnreadCount);


router.get('/history', authenticateAny, attachTimezone, getNotificationHistory);

router.get('/settings', authenticateAny, attachTimezone, getNotificationSettings);

router.put('/settings', authenticateAny, attachTimezone, updateNotificationSettings);


router.get('/:id', authenticateAny, attachTimezone, getNotificationById);


router.post('/mark-read/:id', authenticateAny, attachTimezone, markNotificationAsRead);

router.post('/mark-all-read', authenticateAny, attachTimezone, markAllNotificationsAsRead);


router.delete('/:id', authenticateAny, attachTimezone, deleteNotification);

module.exports = router;