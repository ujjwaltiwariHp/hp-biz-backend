const express = require('express');
const { getDashboardData } = require('../controllers/mobileDashboardController');
const { authenticateAny } = require('../middleware/auth');
const { attachTimezone } = require('../middleware/timezoneMiddleware');
const { getCompanySubscriptionAndUsage, checkSubscriptionActive } = require('../middleware/subscriptionMiddleware');

const router = express.Router();

const dashboardChain = [
    authenticateAny,
    attachTimezone,
    getCompanySubscriptionAndUsage,
    checkSubscriptionActive
];

router.get('/get', ...dashboardChain, getDashboardData);

module.exports = router;
