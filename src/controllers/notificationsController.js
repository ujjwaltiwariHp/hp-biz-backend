const Notifications = require("../models/notificationsModel");
const { successResponse } = require("../utils/successResponse");
const { errorResponse } = require("../utils/errorResponse");

const getNotifications = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = req.staff ? req.staff.id : null;

    if (!staffId) {
      return errorResponse(res, 403, "Only staff members can access notifications");
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const notifications = await Notifications.getNotifications(staffId, companyId, limit, offset);
    return successResponse(res, "Notifications fetched successfully", notifications);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getNotificationById = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = req.staff ? req.staff.id : null;

    if (!staffId) {
      return errorResponse(res, 403, "Only staff members can access notifications");
    }

    const notification = await Notifications.getNotificationById(req.params.id, staffId, companyId);
    if (!notification) {
      return errorResponse(res, 404, "Notification not found");
    }

    return successResponse(res, "Notification details fetched", notification);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = req.staff ? req.staff.id : null;

    if (!staffId) {
      return errorResponse(res, 403, "Only staff members can mark notifications as read");
    }

    const notification = await Notifications.markNotificationAsRead(req.params.id, staffId, companyId);
    if (!notification) {
      return errorResponse(res, 404, "Notification not found");
    }

    return successResponse(res, "Notification marked as read", notification);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = req.staff ? req.staff.id : null;

    if (!staffId) {
      return errorResponse(res, 403, "Only staff members can mark notifications as read");
    }

    const count = await Notifications.markAllNotificationsAsRead(staffId, companyId);
    return successResponse(res, "All notifications marked as read", { updated_count: count });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = req.staff ? req.staff.id : null;

    if (!staffId) {
      return errorResponse(res, 403, "Only staff members can access notification count");
    }

    const count = await Notifications.getUnreadNotificationCount(staffId, companyId);
    return successResponse(res, "Unread notification count fetched", { unread_count: count });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getNotificationHistory = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = req.staff ? req.staff.id : null;

    if (!staffId) {
      return errorResponse(res, 403, "Only staff members can access notification history");
    }

    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const history = await Notifications.getNotificationHistory(staffId, companyId, limit, offset);
    return successResponse(res, "Notification history fetched successfully", history);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const updateNotificationSettings = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = req.staff ? req.staff.id : null;

    if (!staffId) {
      return errorResponse(res, 403, "Only staff members can update notification settings");
    }

    const { email_notifications } = req.body;

    if (typeof email_notifications !== 'boolean') {
      return errorResponse(res, 400, "email_notifications must be a boolean value");
    }

    const settings = await Notifications.updateNotificationSettings(staffId, companyId, { email_notifications });
    return successResponse(res, "Notification settings updated successfully", settings);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getNotificationSettings = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = req.staff ? req.staff.id : null;

    if (!staffId) {
      return errorResponse(res, 403, "Only staff members can access notification settings");
    }

    const settings = await Notifications.getNotificationSettings(staffId, companyId);
    return successResponse(res, "Notification settings fetched successfully", settings);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const deleteNotification = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = req.staff ? req.staff.id : null;

    if (!staffId) {
      return errorResponse(res, 403, "Only staff members can delete notifications");
    }

    const deleted = await Notifications.deleteNotification(req.params.id, staffId, companyId);
    if (!deleted) {
      return errorResponse(res, 404, "Notification not found");
    }

    return successResponse(res, "Notification deleted successfully");
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

module.exports = {
  getNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  getNotificationHistory,
  updateNotificationSettings,
  getNotificationSettings,
  deleteNotification
};