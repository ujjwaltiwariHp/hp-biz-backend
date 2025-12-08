const express = require('express');
const router = express.Router();

const {
  getNotifications,
  getExpiringSubscriptionsController,
  sendRenewalReminder,
  markAsRead,
  markAllAsRead, // <--- Imported new controller
  generateNotifications,
  getNotificationStatsController
} = require('../../controllers/super-admin-controllers/notificationController');

const {
  validateNotificationQuery,
  validateExpiringSubscriptions,
  validateRenewalReminder,
  validateNotificationId
} = require('../../middleware/super-admin-middleware/notificationValidation');

const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');
const { requireSuperAdminPermission } = require('../../middleware/super-admin-middleware/superAdminPermissionMiddleware');

router.use(authenticateSuperAdmin);

router.get('/', requireSuperAdminPermission('notifications', 'view'), validateNotificationQuery, getNotifications);
router.get('/stats', requireSuperAdminPermission('notifications', 'view'), getNotificationStatsController);
router.get('/expiring-subscriptions', requireSuperAdminPermission('notifications', 'view'), validateExpiringSubscriptions, getExpiringSubscriptionsController);

router.post('/send-renewal-reminder', requireSuperAdminPermission('notifications', 'create'), validateRenewalReminder, sendRenewalReminder);
router.post('/generate', requireSuperAdminPermission('notifications', 'create'), generateNotifications);

router.put('/mark-all-read', requireSuperAdminPermission('notifications', 'update'), markAllAsRead);

router.put('/:id/mark-read', requireSuperAdminPermission('notifications', 'update'), validateNotificationId, markAsRead);

module.exports = router;