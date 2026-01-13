const express = require('express');
const { getStatus, getUpgradeCalculation, initiateUpgrade } = require('../controllers/subscriptionUpgradeController');
const { authenticateAny } = require('../middleware/auth');
const { attachTimezone } = require('../middleware/timezoneMiddleware');

const router = express.Router();

const authChain = [authenticateAny, attachTimezone];

// GET /api/v1/subscription-upgrade/status
router.get('/status', ...authChain, getStatus);

// POST /api/v1/subscription-upgrade/calculate
router.post('/calculate', ...authChain, getUpgradeCalculation);

// POST /api/v1/subscription-upgrade/request
router.post('/request', ...authChain, initiateUpgrade);

module.exports = router;
