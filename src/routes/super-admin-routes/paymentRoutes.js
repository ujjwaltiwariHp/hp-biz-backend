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

router.use(authenticateSuperAdmin);

router.post('/', validatePaymentRecord, recordPayment);

router.get('/get', validatePaymentQuery, getAllPayments);

router.get('/get/:id', validatePaymentId, getPaymentDetails);

router.put('/update/:id', validatePaymentStatusUpdate, modifyPaymentStatus);

router.delete('/:id', validatePaymentId, voidPayment);

module.exports = router;
