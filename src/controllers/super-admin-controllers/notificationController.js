const {
  getAllNotifications,
  getExpiringSubscriptions,
  createNotification,
  markNotificationAsRead,
  markAllRead,
  getNotificationById,
  getNotificationStats,
  generateExpiringNotifications
} = require('../../models/super-admin-models/notificationModel');
const { getCompanyById } = require('../../models/super-admin-models/companyModel');
const { successResponse } = require('../../utils/successResponse');
const { errorResponse } = require('../../utils/errorResponse');

const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', type = '', priority = '', is_read = '', startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const filters = { search, type, priority, is_read, startDate, endDate };
    const notifications = await getAllNotifications(parseInt(limit), offset, filters);

    if (notifications.length === 0) {
      return successResponse(res, "No notifications found", {
        notifications: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalCount: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    const totalCount = notifications[0]?.total_count || 0;
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    const notificationsData = notifications.map(notification => {
      const { total_count, ...notificationData } = notification;
      return notificationData;
    });

    return successResponse(res, "Notifications retrieved successfully", {
      notifications: notificationsData,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount: parseInt(totalCount),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve notifications");
  }
};

const getExpiringSubscriptionsController = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    if (isNaN(parseInt(days)) || parseInt(days) < 1 || parseInt(days) > 365) {
      return errorResponse(res, 400, "Days must be a number between 1 and 365");
    }

    const companies = await getExpiringSubscriptions(parseInt(days));

    if (companies.length === 0) {
      return successResponse(res, "No expiring subscriptions found", {
        companies: [],
        threshold_days: parseInt(days)
      });
    }

    return successResponse(res, "Expiring subscriptions retrieved successfully", {
      companies,
      threshold_days: parseInt(days),
      total_count: companies.length
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve expiring subscriptions");
  }
};

const sendRenewalReminder = async (req, res) => {
  try {
    const { company_id, message, send_email } = req.body;

    if (!company_id) {
      return errorResponse(res, 400, "Company ID is required");
    }

    const company = await getCompanyById(company_id);
    if (!company) {
      return errorResponse(res, 404, "Company not found");
    }

    if (!company.subscription_end_date) {
      return errorResponse(res, 400, "Company does not have an active subscription");
    }

    const daysRemaining = Math.ceil((new Date(company.subscription_end_date) - new Date()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return errorResponse(res, 400, "Company subscription has already expired");
    }

    const notificationMessage = message || `Your subscription will expire in ${daysRemaining} days. Please renew to continue using our services.`;

    const notificationData = {
      company_id,
      super_admin_id: req.superAdmin.id,
      title: 'Subscription Renewal Reminder',
      message: notificationMessage,
      notification_type: 'renewal_reminder',
      priority: daysRemaining <= 7 ? 'high' : 'normal',
      metadata: {
        days_remaining: daysRemaining,
        subscription_end_date: company.subscription_end_date,
        send_email: send_email || false,
        sent_by: req.superAdmin.name
      }
    };

    const notification = await createNotification(notificationData);

    if (!notification) {
      return errorResponse(res, 500, "Failed to create renewal reminder");
    }

    return successResponse(res, "Renewal reminder sent successfully", {
      notification,
      company: {
        id: company.id,
        company_name: company.company_name,
        admin_email: company.admin_email,
        days_remaining: daysRemaining
      }
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to send renewal reminder");
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "Invalid notification ID provided");
    }

    const notification = await getNotificationById(id);
    if (!notification) {
      return errorResponse(res, 404, "Notification not found");
    }

    if (notification.is_read) {
      return errorResponse(res, 400, "Notification is already marked as read");
    }

    const updatedNotification = await markNotificationAsRead(id);

    if (!updatedNotification) {
      return errorResponse(res, 500, "Failed to mark notification as read");
    }

    return successResponse(res, "Notification marked as read successfully", {
      notification: updatedNotification
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to mark notification as read");
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const updatedIds = await markAllRead();

    return successResponse(res, "All notifications marked as read successfully", {
      marked_count: updatedIds.length
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to mark all notifications as read");
  }
};

const generateNotifications = async (req, res) => {
  try {
    const notifications = await generateExpiringNotifications();

    return successResponse(res, "Notifications generated successfully", {
      generated_count: notifications.length,
      notifications
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to generate notifications");
  }
};

const getNotificationStatsController = async (req, res) => {
  try {
    const stats = await getNotificationStats();

    return successResponse(res, "Notification statistics retrieved successfully", {
      stats
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve notification statistics");
  }
};

module.exports = {
  getNotifications,
  getExpiringSubscriptionsController,
  sendRenewalReminder,
  markAsRead,
  markAllAsRead,
  generateNotifications,
  getNotificationStatsController
};