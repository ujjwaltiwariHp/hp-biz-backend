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
  getStaffPerformance,
  updateMyPassword
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

const { uploadProfilePicture, compressProfilePicture } = require('../middleware/imageUpload');

const router = express.Router();

const subscriptionChain = [authenticateAny, attachTimezone, getCompanySubscriptionAndUsage, checkSubscriptionActive];

router.get('/', ...subscriptionChain, requirePermission('user_management'), getAllStaff);
router.get('/roles', ...subscriptionChain, getCompanyRoles);
router.get('/designations', ...subscriptionChain, getDesignationOptions);
router.get('/statuses', ...subscriptionChain, getStatusOptions);
router.get('/stats', ...subscriptionChain, requirePermission('user_management'), getStaffStats);
router.get('/:id', ...subscriptionChain, requirePermission('user_management'), getStaffById);
router.get('/:id/performance', ...subscriptionChain, requirePermission('user_management'), getStaffPerformance);

router.post('/create',
    ...subscriptionChain,
    requirePermission('user_management'),
    checkStaffLimit,
    uploadProfilePicture,
    compressProfilePicture,
    validateStaffData,
    createStaff
);

router.put('/:id',
    ...subscriptionChain,
    requirePermission('user_management'),
    uploadProfilePicture,
    compressProfilePicture,
    updateStaff
);

router.put('/status/:id', ...subscriptionChain, requirePermission('user_management'), updateStaffStatus);

router.delete('/delete/:id', ...subscriptionChain, requirePermission('user_management'), logActivity, deleteStaff);

router.put('/update-password', authenticateAny, attachTimezone, updateMyPassword);

module.exports = router;