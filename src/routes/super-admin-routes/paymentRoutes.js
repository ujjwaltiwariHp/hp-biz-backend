const express = require('express');
const router = express.Router();

const {
  recordPayment,
  getAllPayments,
  getPaymentDetails,
  modifyPaymentStatus,
  voidPayment
} = require('../../controllers/super-admin-controllers/paymentController');

const {
  validatePaymentRecord,
  validatePaymentQuery,
  validatePaymentId,
  validatePaymentStatusUpdate
} = require('../../middleware/super-admin-middleware/paymentValidation');

const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');
const { requireSuperAdminPermission } = require('../../middleware/super-admin-middleware/superAdminPermissionMiddleware'); // ADDED IMPORT

router.use(authenticateSuperAdmin);

// CRUD routes (Super-Admin only)
router.post('/', requireSuperAdminPermission('payments', 'create'), validatePaymentRecord, recordPayment);

// View routes (Sub-Admin allowed)
router.get('/get', requireSuperAdminPermission('payments', 'view'), validatePaymentQuery, getAllPayments);
router.get('/get/:id', requireSuperAdminPermission('payments', 'view'), validatePaymentId, getPaymentDetails);

// CRUD routes (Super-Admin only)
router.put('/update/:id', requireSuperAdminPermission('payments', 'update'), validatePaymentStatusUpdate, modifyPaymentStatus);
router.delete('/:id', requireSuperAdminPermission('payments', 'delete'), validatePaymentId, voidPayment);

module.exports = router;