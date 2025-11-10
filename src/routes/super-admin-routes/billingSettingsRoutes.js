const express = require('express');
const router = express.Router();

const {
  getBillingSettings,
  updateBillingSettings
} = require('../../controllers/super-admin-controllers/billingSettingsController');

const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');
const { requireSuperAdminPermission } = require('../../middleware/super-admin-middleware/superAdminPermissionMiddleware');
const { handleUnifiedUpload } = require('../../middleware/qrCodeUpload'); // IMPORT NEW MIDDLEWARE

router.use(authenticateSuperAdmin);

router.get('/', requireSuperAdminPermission('billing_settings', 'view'), getBillingSettings);

// MODIFIED: The PUT route now handles both file and form data in one step.
router.put('/',
    requireSuperAdminPermission('billing_settings', 'update'),
    handleUnifiedUpload, // Step 1: Use multer to process 'multipart/form-data'
    updateBillingSettings // Step 2: Controller handles URL generation and DB save
);

module.exports = router;