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
const { requireSuperAdminPermission } = require('../../middleware/super-admin-middleware/superAdminPermissionMiddleware'); // ADDED IMPORT

router.use(authenticateSuperAdmin);

// View routes (Sub-Admin allowed)
router.get('/', requireSuperAdminPermission('notifications', 'view'), validateNotificationQuery, getNotifications);
router.get('/expiring-subscriptions', requireSuperAdminPermission('notifications', 'view'), validateExpiringSubscriptions, getExpiringSubscriptionsController);

// CRUD routes (Super-Admin only)
router.post('/send-renewal-reminder', requireSuperAdminPermission('notifications', 'create'), validateRenewalReminder, sendRenewalReminder);
router.post('/generate', requireSuperAdminPermission('notifications', 'create'), generateNotifications);

// Status update (CRUD action)
router.put('/:id/mark-read', requireSuperAdminPermission('notifications', 'update'), validateNotificationId, markAsRead);

module.exports = router;