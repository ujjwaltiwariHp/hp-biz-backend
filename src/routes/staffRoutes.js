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
  updateMyPassword,
  updateMyProfile,
  getMyProfile
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

router.get('/', ...subscriptionChain, requirePermission('user_management', 'view'), getAllStaff);

router.get('/roles', ...subscriptionChain, getCompanyRoles);
router.get('/designations', ...subscriptionChain, getDesignationOptions);
router.get('/statuses', ...subscriptionChain, getStatusOptions);

router.get('/stats', ...subscriptionChain, requirePermission('user_management', 'view'), getStaffStats);

router.get('/profileByStaff', authenticateAny, attachTimezone, getMyProfile);
router.put('/update-profile', authenticateAny, attachTimezone, uploadProfilePicture, compressProfilePicture, updateMyProfile);
router.put('/update-password', authenticateAny, attachTimezone, updateMyPassword);

router.get('/:id', ...subscriptionChain, requirePermission('user_management', 'view'), getStaffById);

router.get('/:id/performance', ...subscriptionChain, requirePermission('user_management', 'view'), getStaffPerformance);

router.post('/create',
    ...subscriptionChain,
    requirePermission('user_management', 'create'),
    checkStaffLimit,
    uploadProfilePicture,
    compressProfilePicture,
    validateStaffData,
    createStaff
);

router.put('/:id',
    ...subscriptionChain,
    requirePermission('user_management', 'update'),
    uploadProfilePicture,
    compressProfilePicture,
    updateStaff
);

router.put('/status/:id', ...subscriptionChain, requirePermission('user_management', 'manage_status'), updateStaffStatus);

router.delete('/delete/:id', ...subscriptionChain, requirePermission('user_management', 'delete'), logActivity, deleteStaff);

module.exports = router;