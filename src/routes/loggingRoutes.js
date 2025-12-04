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

const timezoneChain = [authenticateAny, attachTimezone];

router.get("/filters", ...timezoneChain, getFilterOptions);

router.get("/activity", ...timezoneChain, getUserLogs);

router.get("/system", authenticateAny, adminOnly, attachTimezone, getSystemEventLogs);

router.get("/dashboard", ...timezoneChain, getActivityDashboard);

router.get("/staff/activity/:staff_id", authenticateAny, attachTimezone, requirePermission('staff_view'), getStaffActivitySummary);

router.get("/export", authenticateAny, adminOnly, attachTimezone, exportLogs);

router.post("/cleanup", authenticateAny, adminOnly, attachTimezone, cleanupOldLogs);

module.exports = router;