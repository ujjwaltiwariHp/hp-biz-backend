const express = require("express");
const router = express.Router();
const {
  getUserLogs,
  getSystemEventLogs,
  getActivityDashboard,
  getStaffActivitySummary,
  exportLogs,
  cleanupOldLogs,
  getFilterOptions
} = require("../controllers/loggingController");
const { authenticateAny, adminOnly, requirePermission } = require("../middleware/auth");
const { attachTimezone } = require('../middleware/timezoneMiddleware');

const {
    getCompanySubscriptionAndUsage,
    checkSubscriptionActive,
    requireFeature
} = require('../middleware/subscriptionMiddleware');

const loggingChain = [
    authenticateAny,
    attachTimezone,
    getCompanySubscriptionAndUsage,
    checkSubscriptionActive,
    requireFeature('view_logs')
];

router.get("/filters", ...loggingChain, getFilterOptions);

router.get("/activity", ...loggingChain, getUserLogs);

router.get("/system", authenticateAny, adminOnly, attachTimezone, getSystemEventLogs);

router.get("/dashboard", ...loggingChain, getActivityDashboard);

router.get("/staff/activity/:staff_id", authenticateAny, attachTimezone, requirePermission('staff_view'), getStaffActivitySummary);

router.get("/export", authenticateAny, adminOnly, attachTimezone, exportLogs);

router.post("/cleanup", authenticateAny, adminOnly, attachTimezone, cleanupOldLogs);

module.exports = router;