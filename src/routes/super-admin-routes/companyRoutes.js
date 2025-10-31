const express = require('express');
const router = express.Router();

const {
  getCompanies,
  getCompany,
  activateCompanyAccount,
  deactivateCompanyAccount,
  updateSubscription,
  removeCompany,
  getDashboard,
  getUsageReport,
  createCompanyByAdmin
} = require('../../controllers/super-admin-controllers/companyController');

const {
  initiateSubscriptionRequest,
  approveSubscription,
  rejectSubscription
} = require('../../controllers/super-admin-controllers/subscriptionManagementController');

const {
  validateCompanyId,
  validateCompanyQuery,
  validateSubscriptionUpdate,
  validateUsageReport,
  validateCompanyCreationByAdmin
} = require('../../middleware/super-admin-middleware/companyValidation');

const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');
const { requireSuperAdminPermission } = require('../../middleware/super-admin-middleware/superAdminPermissionMiddleware');

router.use(authenticateSuperAdmin);

router.get('/dashboard', requireSuperAdminPermission('dashboard', 'view'), getDashboard);


router.post('/create',
    requireSuperAdminPermission('companies', 'create'),
    validateCompanyCreationByAdmin,
    createCompanyByAdmin
);


router.get('/', requireSuperAdminPermission('companies', 'view'), validateCompanyQuery, getCompanies);

router.get('/usage-report', requireSuperAdminPermission('reports', 'view'), validateUsageReport, getUsageReport);
router.get('/:id', requireSuperAdminPermission('companies', 'view'), validateCompanyId, getCompany);
router.put('/:id/activate', requireSuperAdminPermission('companies', 'update'), validateCompanyId, activateCompanyAccount);
router.put('/:id/deactivate', requireSuperAdminPermission('companies', 'update'), validateCompanyId, deactivateCompanyAccount);

router.post('/:id/subscription/request',
    requireSuperAdminPermission('companies', 'create'),
    validateSubscriptionUpdate,
    initiateSubscriptionRequest
);

router.post('/:id/subscription/approve',
    requireSuperAdminPermission('companies', 'update'),
    validateCompanyId,
    approveSubscription
);

router.post('/:id/subscription/reject',
    requireSuperAdminPermission('companies', 'update'),
    validateCompanyId,
    rejectSubscription
);

router.put('/:id/subscription', requireSuperAdminPermission('companies', 'update'), validateSubscriptionUpdate, updateSubscription);
router.delete('/:id', requireSuperAdminPermission('companies', 'delete'), validateCompanyId, removeCompany);

module.exports = router;
