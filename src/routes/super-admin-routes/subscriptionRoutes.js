const express = require('express');
const router = express.Router();
const subscriptionController = require('../../controllers/super-admin-controllers/subscriptionController');
const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');
const {
  validatePackageId,
  validatePackageQuery,
  validatePackageCreation,
  validatePackageUpdate
} = require('../../middleware/super-admin-middleware/subscriptionValidation');
const { requireSuperAdminPermission } = require('../../middleware/super-admin-middleware/superAdminPermissionMiddleware');

router.use(authenticateSuperAdmin);

router.get('/features', requireSuperAdminPermission('subscriptions', 'view'), subscriptionController.getFeatureList);

router.get('/', requireSuperAdminPermission('subscriptions', 'view'), validatePackageQuery, subscriptionController.getPackages);
router.get('/:id', requireSuperAdminPermission('subscriptions', 'view'), validatePackageId, subscriptionController.getPackage);

router.post('/',
    requireSuperAdminPermission('subscriptions', 'create'),
    validatePackageCreation,
    subscriptionController.createSubscriptionPackage
);

router.put('/:id',
    requireSuperAdminPermission('subscriptions', 'update'),
    validatePackageUpdate,
    subscriptionController.updateSubscriptionPackage
);

router.put('/:id/toggle-status',
    requireSuperAdminPermission('subscriptions', 'update'),
    validatePackageId,
    subscriptionController.toggleStatus
);

router.delete('/:id',
    requireSuperAdminPermission('subscriptions', 'delete'),
    validatePackageId,
    subscriptionController.removePackage
);

module.exports = router;