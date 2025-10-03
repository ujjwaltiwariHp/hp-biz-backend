const express = require('express');
const router = express.Router();

const {
  generateInvoice,
  getAllInvoices,
  getInvoiceDetails,
  updateInvoiceDetails,
  removeInvoice,
  downloadInvoice,
  sendInvoiceEmailController
} = require('../../controllers/super-admin-controllers/invoiceController');

const {
  validateInvoiceGenerate,
  validateInvoiceQuery,
  validateInvoiceId,
  validateInvoiceUpdate
} = require('../../middleware/super-admin-middleware/invoiceValidation');

const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');

router.use(authenticateSuperAdmin);

router.post('/generate', validateInvoiceGenerate, generateInvoice);

router.get('/get', validateInvoiceQuery, getAllInvoices);

router.get('/get/:id', validateInvoiceId, getInvoiceDetails);

router.get('/:id/download', validateInvoiceId, downloadInvoice);

router.post('/:id/send', validateInvoiceId, sendInvoiceEmailController);

router.put('/:id', validateInvoiceUpdate, updateInvoiceDetails);

router.delete('/delete/:id', validateInvoiceId, removeInvoice);

module.exports = router;
