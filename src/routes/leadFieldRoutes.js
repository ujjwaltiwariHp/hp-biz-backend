const express = require('express');
const router = express.Router();
const {
  getCompanyFields,
  createField,
  updateField,
  deleteField
} = require('../controllers/leadFieldController');

const { authenticateAny, requirePermission } = require('../middleware/auth');
const { attachTimezone } = require('../middleware/timezoneMiddleware');
const { getCompanySubscriptionAndUsage } = require('../middleware/subscriptionMiddleware');


const viewChain = [authenticateAny, attachTimezone];

const adminChain = [
    authenticateAny,
    attachTimezone,
    getCompanySubscriptionAndUsage,
    requirePermission('settings')
];

// ROUTES
router.get('/', ...viewChain, getCompanyFields);
router.post('/create', ...adminChain, createField);
router.put('/:id', ...adminChain, updateField);
router.delete('/delete/:id', ...adminChain, deleteField);

module.exports = router;