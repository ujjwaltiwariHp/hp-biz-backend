const express = require('express');
const router = express.Router();

const {
  getPackages,
  getPackage,
  createSubscriptionPackage,
  updateSubscriptionPackage,
  removePackage,
  toggleStatus
} = require('../../controllers/super-admin-controllers/subscriptionController');

const {
  validatePackageId,
  validatePackageQuery,
  validatePackageCreation,
  validatePackageUpdate
} = require('../../middleware/super-admin-middleware/subscriptionValidation');

const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');
const { requireSuperAdminPermission } = require('../../middleware/super-admin-middleware/superAdminPermissionMiddleware');

router.use(authenticateSuperAdmin);


router.get('/', requireSuperAdminPermission('subscriptions', 'view'), validatePackageQuery, getPackages);
router.get('/:id', requireSuperAdminPermission('subscriptions', 'view'), validatePackageId, getPackage);


router.post('/',
    requireSuperAdminPermission('subscriptions', 'create'),
    validatePackageCreation,
    createSubscriptionPackage
);

router.put('/:id',
    requireSuperAdminPermission('subscriptions', 'update'),
    validatePackageUpdate,
    updateSubscriptionPackage
);

router.put('/:id/toggle-status',
    requireSuperAdminPermission('subscriptions', 'update'),
    validatePackageId,
    toggleStatus
);

router.delete('/:id',
    requireSuperAdminPermission('subscriptions', 'delete'),
    validatePackageId,
    removePackage
);

module.exports = router;