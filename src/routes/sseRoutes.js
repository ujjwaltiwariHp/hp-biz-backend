const express = require('express');
const router = express.Router();
const sseController = require('../controllers/sseController');
const { authenticateAny } = require('../middleware/auth');
const { attachTimezone } = require('../middleware/timezoneMiddleware');

router.get('/stream', authenticateAny, attachTimezone, sseController.subscribe);

module.exports = router;