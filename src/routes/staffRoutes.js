const express = require('express');
const {
  getAllStaff,
  getCompanyRoles,
  getDesignationOptions,
  getStatusOptions,
  getStaffStats,
  getStaffById,
  createStaff,
  updateStaff,
  updateStaffStatus,
  deleteStaff,
  getStaffPerformance
} = require('../controllers/staffController');

const { authenticateAny, requirePermission } = require('../middleware/auth');
const { validateStaffData } = require('../middleware/validation');
const { logActivity } = require('../middleware/loggingMiddleware');
const { attachTimezone } = require('../middleware/timezoneMiddleware');
const {
    getCompanySubscriptionAndUsage,
    checkSubscriptionActive,
    checkStaffLimit
} = require('../middleware/subscriptionMiddleware');

const router = express.Router();

const subscriptionChain = [authenticateAny, attachTimezone, getCompanySubscriptionAndUsage, checkSubscriptionActive];

// Fetching Lists/Stats/Individual Staff (GET) - Added Subscription Check
router.get('/', ...subscriptionChain, requirePermission('user_management'), getAllStaff);
router.get('/roles', ...subscriptionChain, getCompanyRoles);
router.get('/designations', ...subscriptionChain, getDesignationOptions);
router.get('/statuses', ...subscriptionChain, getStatusOptions);
router.get('/stats', ...subscriptionChain, requirePermission('user_management'), getStaffStats);
router.get('/:id', ...subscriptionChain, requirePermission('user_management'), getStaffById);
router.get('/:id/performance', ...subscriptionChain, requirePermission('user_management'), getStaffPerformance);

// Creation/Modification (POST/PUT) - Added Subscription and Limit Checks
router.post('/create',
    ...subscriptionChain,
    requirePermission('user_management'),
    checkStaffLimit,
    validateStaffData,
    createStaff
);
router.put('/:id', ...subscriptionChain, requirePermission('user_management'), updateStaff);
router.put('/status/:id', ...subscriptionChain, requirePermission('user_management'), updateStaffStatus);

router.delete('/delete/:id', ...subscriptionChain, requirePermission('user_management'), logActivity, deleteStaff);

module.exports = router;
