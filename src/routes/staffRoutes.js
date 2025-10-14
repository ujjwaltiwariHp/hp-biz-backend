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
const { attachTimezone } = require('../middleware/timezoneMiddleware'); // ADDED

const router = express.Router();

// Fetching Lists/Stats/Individual Staff (GET) - Timestamps are relevant
router.get('/', authenticateAny, attachTimezone, requirePermission('user_management'), getAllStaff);
router.get('/roles', authenticateAny, attachTimezone, getCompanyRoles);
router.get('/designations', authenticateAny, attachTimezone, getDesignationOptions);
router.get('/statuses', authenticateAny, attachTimezone, getStatusOptions);
router.get('/stats', authenticateAny, attachTimezone, requirePermission('user_management'), getStaffStats);
router.get('/:id', authenticateAny, attachTimezone, requirePermission('user_management'), getStaffById);
router.get('/:id/performance', authenticateAny, attachTimezone, requirePermission('user_management'), getStaffPerformance);

// Creation/Modification (POST/PUT) - Timestamps and input conversion may be relevant
router.post('/create', authenticateAny, attachTimezone, requirePermission('user_management'), validateStaffData, createStaff);
router.put('/:id', authenticateAny, attachTimezone, requirePermission('user_management'), updateStaff);
router.put('/status/:id', authenticateAny, attachTimezone, requirePermission('user_management'), updateStaffStatus);

router.delete('/delete/:id', authenticateAny, attachTimezone, requirePermission('user_management'), logActivity, deleteStaff);

module.exports = router;