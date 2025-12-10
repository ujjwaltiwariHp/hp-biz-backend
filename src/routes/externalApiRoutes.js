const express = require('express');
const rateLimit = require('express-rate-limit');
const { createLead, getLeads, getLeadById } = require('../controllers/leadsController');
const { authenticateAny } = require('../middleware/auth');
const { attachTimezone } = require('../middleware/timezoneMiddleware');

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: "Too many requests from this IP, please try again after a minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const externalApiStack = [apiLimiter, authenticateAny, attachTimezone];

router.post('/leads/create', ...externalApiStack, createLead);
router.get('/leads/get', ...externalApiStack, getLeads);
router.get('/leads/get/:id', ...externalApiStack, getLeadById);

module.exports = router;