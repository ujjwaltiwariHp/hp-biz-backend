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
const { requireSuperAdminPermission } = require('../../middleware/super-admin-middleware/superAdminPermissionMiddleware'); // ADDED IMPORT

router.use(authenticateSuperAdmin);

// CRUD routes (Super-Admin only)
router.post('/generate', requireSuperAdminPermission('invoices', 'create'), validateInvoiceGenerate, generateInvoice);

// View routes (Sub-Admin allowed)
router.get('/get', requireSuperAdminPermission('invoices', 'view'), validateInvoiceQuery, getAllInvoices);
router.get('/get/:id', requireSuperAdminPermission('invoices', 'view'), validateInvoiceId, getInvoiceDetails);
router.get('/:id/download', requireSuperAdminPermission('invoices', 'view'), validateInvoiceId, downloadInvoice);

// CRUD routes (Super-Admin only)
router.post('/:id/send', requireSuperAdminPermission('invoices', 'update'), validateInvoiceId, sendInvoiceEmailController);
router.put('/:id', requireSuperAdminPermission('invoices', 'update'), validateInvoiceUpdate, updateInvoiceDetails);
router.delete('/delete/:id', requireSuperAdminPermission('invoices', 'delete'), validateInvoiceId, removeInvoice);

module.exports = router;