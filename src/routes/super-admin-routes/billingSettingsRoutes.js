const express = require('express');
const router = express.Router();

const {
  getBillingSettings,
  updateBillingSettings
} = require('../../controllers/super-admin-controllers/billingSettingsController');

const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');
const { requireSuperAdminPermission } = require('../../middleware/super-admin-middleware/superAdminPermissionMiddleware');

router.use(authenticateSuperAdmin);

router.get('/', requireSuperAdminPermission('billing_settings', 'view'), getBillingSettings);

router.put('/', requireSuperAdminPermission('billing_settings', 'update'), updateBillingSettings);

module.exports = router;