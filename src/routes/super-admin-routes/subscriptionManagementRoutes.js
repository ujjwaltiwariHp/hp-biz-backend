const express = require('express');
const router = express.Router();

const {
  initiateSubscriptionRequest,
  markPaymentReceived,
  approveSubscription,
  rejectSubscription
} = require('../../controllers/super-admin-controllers/subscriptionManagementController');

const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');
const { requireSuperAdminPermission } = require('../../middleware/super-admin-middleware/superAdminPermissionMiddleware');

router.use(authenticateSuperAdmin);

// Initiate subscription request for a company
router.post('/:id/subscription/initiate',
    requireSuperAdminPermission('subscriptions', 'create'),
    initiateSubscriptionRequest
);

// Mark payment as received
router.post('/:id/subscription/mark-received',
    requireSuperAdminPermission('subscriptions', 'update'),
    markPaymentReceived
);

// Approve subscription
router.post('/:id/subscription/approve',
    requireSuperAdminPermission('subscriptions', 'update'),
    approveSubscription
);

// Reject subscription
router.post('/:id/subscription/reject',
    requireSuperAdminPermission('subscriptions', 'update'),
    rejectSubscription
);

module.exports = router;