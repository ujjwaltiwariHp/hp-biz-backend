const pool = require('../../config/database');
const sseService = require('../../services/sseService');

const getAllNotifications = async (limit = 10, offset = 0, filters = {}) => {
  try {
    const { search = '', type = '', priority = '', is_read = '' } = filters;

    let query = `
      SELECT
        n.id, n.company_id, n.super_admin_id, n.title, n.message,
        n.notification_type, n.priority, n.is_read, n.read_at,
        n.metadata, n.created_at, n.updated_at,
        c.company_name, c.unique_company_id, c.admin_email,
        COUNT(*) OVER() as total_count
      FROM super_admin_notifications n
      LEFT JOIN companies c ON n.company_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (search && search.trim() !== '') {
      query += ` AND (
        n.title ILIKE $${paramIndex} OR
        n.message ILIKE $${paramIndex} OR
        c.company_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (type && type.trim() !== '') {
      query += ` AND n.notification_type = $${paramIndex}`;
      params.push(type.trim());
      paramIndex++;
    }

    if (priority && priority.trim() !== '') {
      query += ` AND n.priority = $${paramIndex}`;
      params.push(priority.trim());
      paramIndex++;
    }

    if (is_read !== '') {
      query += ` AND n.is_read = $${paramIndex}`;
      params.push(is_read === 'true');
      paramIndex++;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    throw error;
  }
};

const getExpiringSubscriptions = async (daysThreshold = 30) => {
  try {
    const query = `
      SELECT
        c.id, c.company_name, c.unique_company_id, c.admin_email, c.admin_name,
        c.phone, c.subscription_start_date, c.subscription_end_date,
        c.is_active, sp.name as package_name, sp.price as package_price,
        sp.duration_type,
        DATE_PART('day', c.subscription_end_date - CURRENT_DATE)::integer as days_remaining
      FROM companies c
      LEFT JOIN subscription_packages sp ON c.subscription_package_id = sp.id
      WHERE c.subscription_end_date IS NOT NULL
        AND c.subscription_end_date <= CURRENT_DATE + INTERVAL '${daysThreshold} days'
        AND c.subscription_end_date >= CURRENT_DATE
        AND c.is_active = true
      ORDER BY c.subscription_end_date ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    throw error;
  }
};

const createNotification = async (notificationData) => {
  try {
    const {
      company_id,
      super_admin_id,
      title,
      message,
      notification_type,
      priority,
      metadata
    } = notificationData;

    const query = `
      INSERT INTO super_admin_notifications (
        company_id, super_admin_id, title, message, notification_type, priority, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await pool.query(query, [
      company_id || null,
      super_admin_id || null,
      title,
      message,
      notification_type,
      priority || 'normal',
      metadata ? JSON.stringify(metadata) : null
    ]);

    const notification = result.rows[0];

    const eventData = {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.notification_type,
        priority: notification.priority,
        is_read: notification.is_read
    };

    if (notification.super_admin_id) {
        const saKey = `sa_${notification.super_admin_id}`;
        sseService.publish(saKey, 'new_sa_notification', eventData);
    } else {
        sseService.broadcast('new_sa_notification', eventData);
    }

    return notification;
  } catch (error) {
    throw error;
  }
};

const markNotificationAsRead = async (id) => {
  try {
    const query = `
      UPDATE super_admin_notifications
      SET is_read = true, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [parseInt(id)]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const getNotificationById = async (id) => {
  try {
    const query = `
      SELECT
        n.*,
        c.company_name, c.unique_company_id, c.admin_email, c.admin_name,
        sa.name as created_by_name, sa.email as created_by_email
      FROM super_admin_notifications n
      LEFT JOIN companies c ON n.company_id = c.id
      LEFT JOIN super_admins sa ON n.super_admin_id = sa.id
      WHERE n.id = $1
    `;

    const result = await pool.query(query, [parseInt(id)]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const getNotificationStats = async () => {
  try {
    const query = `
      SELECT
        COUNT(*)::integer as total_notifications,
        COUNT(*) FILTER (WHERE is_read = false)::integer as unread_notifications,
        COUNT(*) FILTER (WHERE is_read = true)::integer as read_notifications,
        COUNT(*) FILTER (WHERE notification_type = 'subscription_expiring')::integer as expiring_subscriptions,
        COUNT(*) FILTER (WHERE priority = 'high')::integer as high_priority
      FROM super_admin_notifications
    `;

    const result = await pool.query(query);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const checkDuplicateNotification = async (company_id, notification_type, hours = 24) => {
  try {
    const query = `
      SELECT id FROM super_admin_notifications
      WHERE company_id = $1
        AND notification_type = $2
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
      LIMIT 1
    `;

    const result = await pool.query(query, [company_id, notification_type]);
    return result.rows.length > 0;
  } catch (error) {
    throw error;
  }
};

const generateExpiringNotifications = async () => {
  try {
    const thresholds = [30, 15, 7, 3, 1];
    const createdNotifications = [];

    for (const days of thresholds) {
      const query = `
        SELECT
          c.id, c.company_name, c.admin_email,
          DATE_PART('day', c.subscription_end_date - CURRENT_DATE)::integer as days_remaining
        FROM companies c
        WHERE c.subscription_end_date IS NOT NULL
          AND c.subscription_end_date::date = (CURRENT_DATE + INTERVAL '${days} days')::date
          AND c.is_active = true
      `;

      const companies = await pool.query(query);

      for (const company of companies.rows) {
        const isDuplicate = await checkDuplicateNotification(
          company.id,
          'subscription_expiring',
          24
        );

        if (!isDuplicate) {
          const priority = days <= 3 ? 'urgent' : days <= 7 ? 'high' : 'normal';
          const notificationData = {
            company_id: company.id,
            super_admin_id: null,
            title: `Subscription Expiring in ${days} Day${days > 1 ? 's' : ''}`,
            message: `${company.company_name}'s subscription will expire in ${days} day${days > 1 ? 's' : ''}. Contact: ${company.admin_email}`,
            notification_type: 'subscription_expiring',
            priority,
            metadata: {
              days_remaining: company.days_remaining,
              threshold: days
            }
          };

          const notification = await createNotification(notificationData);
          createdNotifications.push(notification);
        }
      }
    }

    return createdNotifications;
  } catch (error) {
    throw error;
  }
};

const generatePaymentNotifications = async (paymentData) => {
  try {
    const { company_id, amount, payment_status, payment_reference } = paymentData;

    const notificationTypes = {
      completed: {
        title: 'Payment Received',
        message: `Payment of ${amount} received successfully. Reference: ${payment_reference}`,
        type: 'payment_received',
        priority: 'normal'
      },
      failed: {
        title: 'Payment Failed',
        message: `Payment of ${amount} failed. Reference: ${payment_reference}`,
        type: 'payment_failed',
        priority: 'high'
      }
    };

    const config = notificationTypes[payment_status];
    if (!config) return null;

    const notificationData = {
      company_id,
      super_admin_id: null,
      title: config.title,
      message: config.message,
      notification_type: config.type,
      priority: config.priority,
      metadata: paymentData
    };

    return await createNotification(notificationData);
  } catch (error) {
    throw error;
  }
};

const generateCompanyRegistrationNotification = async (companyData) => {
  try {
    const { id, company_name, admin_email, subscription_package_id } = companyData;

    const notificationData = {
      company_id: id,
      super_admin_id: null,
      title: 'New Company Registered',
      message: `${company_name} has registered. Admin: ${admin_email}`,
      notification_type: 'company_registered',
      priority: 'normal',
      metadata: {
        subscription_package_id
      }
    };

    return await createNotification(notificationData);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getAllNotifications,
  getExpiringSubscriptions,
  createNotification,
  markNotificationAsRead,
  getNotificationById,
  getNotificationStats,
  generateExpiringNotifications,
  generatePaymentNotifications,
  generateCompanyRegistrationNotification
};