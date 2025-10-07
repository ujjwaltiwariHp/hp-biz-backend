const express = require("express");
const router = express.Router();
const {
  getUserLogs,
  getSystemEventLogs,
  getActivityDashboard,
  getStaffActivitySummary,
  exportLogs,
  cleanupOldLogs
} = require("../controllers/loggingController");
const { authenticateAny, adminOnly, requirePermission } = require("../middleware/auth");

router.get("/activity", authenticateAny, getUserLogs);

router.get("/system", authenticateAny, adminOnly, getSystemEventLogs);

router.get("/dashboard", authenticateAny, getActivityDashboard);

router.get("/staff/activity/:staff_id", authenticateAny, requirePermission('staff_view'), getStaffActivitySummary);

router.get("/export", authenticateAny, adminOnly, exportLogs);

router.post("/cleanup", authenticateAny, adminOnly, cleanupOldLogs);

module.exports = router;
