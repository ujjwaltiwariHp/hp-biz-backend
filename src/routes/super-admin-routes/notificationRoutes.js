const express = require('express');
const router = express.Router();

const {
  getNotifications,
  getExpiringSubscriptionsController,
  sendRenewalReminder,
  markAsRead,
  generateNotifications
} = require('../../controllers/super-admin-controllers/notificationController');

const {
  validateNotificationQuery,
  validateExpiringSubscriptions,
  validateRenewalReminder,
  validateNotificationId
} = require('../../middleware/super-admin-middleware/notificationValidation');

const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');

router.use(authenticateSuperAdmin);

router.get('/', validateNotificationQuery, getNotifications);

router.get('/expiring-subscriptions', validateExpiringSubscriptions, getExpiringSubscriptionsController);

router.post('/send-renewal-reminder', validateRenewalReminder, sendRenewalReminder);

router.post('/generate', generateNotifications);

router.put('/:id/mark-read', validateNotificationId, markAsRead);

module.exports = router;