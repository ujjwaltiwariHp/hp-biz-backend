const pool = require("../config/database");

const createNotification = async (data) => {
  const {
    company_id,
    staff_id,
    title,
    message,
    type,
    related_lead_id = null,
    priority = 'normal'
  } = data;

  const result = await pool.query(
    `INSERT INTO notifications (company_id, staff_id, title, message, type, related_lead_id, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [company_id, staff_id, title, message, type, related_lead_id, priority]
  );
  return result.rows[0];
};

const getNotifications = async (staffId, companyId, limit = 50, offset = 0) => {
  const result = await pool.query(
    `SELECT n.id, n.title, n.message, n.type, n.related_lead_id, n.is_read,
            n.priority, n.created_at, n.read_at,
            l.first_name as lead_first_name, l.last_name as lead_last_name
     FROM notifications n
     LEFT JOIN leads l ON n.related_lead_id = l.id
     WHERE n.staff_id = $1 AND n.company_id = $2
     ORDER BY n.created_at DESC
     LIMIT $3 OFFSET $4`,
    [staffId, companyId, limit, offset]
  );
  return result.rows;
};

const getNotificationById = async (id, staffId, companyId) => {
  const result = await pool.query(
    `SELECT n.id, n.title, n.message, n.type, n.related_lead_id, n.is_read,
            n.priority, n.created_at, n.read_at,
            l.first_name as lead_first_name, l.last_name as lead_last_name
     FROM notifications n
     LEFT JOIN leads l ON n.related_lead_id = l.id
     WHERE n.id = $1 AND n.staff_id = $2 AND n.company_id = $3`,
    [id, staffId, companyId]
  );
  return result.rows[0];
};

const markNotificationAsRead = async (id, staffId, companyId) => {
  const result = await pool.query(
    `UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND staff_id = $2 AND company_id = $3 RETURNING *`,
    [id, staffId, companyId]
  );
  return result.rows[0];
};

const markAllNotificationsAsRead = async (staffId, companyId) => {
  const result = await pool.query(
    `UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
     WHERE staff_id = $1 AND company_id = $2 AND is_read = FALSE
     RETURNING COUNT(*)`,
    [staffId, companyId]
  );
  return result.rowCount;
};

const getUnreadNotificationCount = async (staffId, companyId) => {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM notifications
     WHERE staff_id = $1 AND company_id = $2 AND is_read = FALSE`,
    [staffId, companyId]
  );
  return parseInt(result.rows[0].count);
};

const getNotificationHistory = async (staffId, companyId, limit = 100, offset = 0) => {
  const result = await pool.query(
    `SELECT n.id, n.title, n.message, n.type, n.related_lead_id, n.is_read,
            n.priority, n.created_at, n.read_at,
            l.first_name as lead_first_name, l.last_name as lead_last_name
     FROM notifications n
     LEFT JOIN leads l ON n.related_lead_id = l.id
     WHERE n.staff_id = $1 AND n.company_id = $2
     ORDER BY n.created_at DESC
     LIMIT $3 OFFSET $4`,
    [staffId, companyId, limit, offset]
  );
  return result.rows;
};

const deleteNotification = async (id, staffId, companyId) => {
  const result = await pool.query(
    `DELETE FROM notifications
     WHERE id = $1 AND staff_id = $2 AND company_id = $3 RETURNING id`,
    [id, staffId, companyId]
  );
  return result.rows.length > 0;
};

const getNotificationSettings = async (staffId, companyId) => {
  const result = await pool.query(
    `SELECT email_notifications FROM company_settings
     WHERE company_id = $1`,
    [companyId]
  );
  return result.rows[0] || { email_notifications: true };
};

const updateNotificationSettings = async (staffId, companyId, settings) => {
  const { email_notifications } = settings;

  const result = await pool.query(
    `UPDATE company_settings SET email_notifications = $1
     WHERE company_id = $2
     RETURNING email_notifications`,
    [email_notifications, companyId]
  );
  return result.rows[0];
};

const createBulkNotifications = async (notifications) => {
  if (!notifications || notifications.length === 0) {
    return [];
  }

  const values = [];
  const placeholders = [];
  let paramCount = 0;

  notifications.forEach((notif, index) => {
    const baseIndex = index * 7;
    placeholders.push(
      `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`
    );
    values.push(
      notif.company_id,
      notif.staff_id,
      notif.title,
      notif.message,
      notif.type,
      notif.related_lead_id || null,
      notif.priority || 'normal'
    );
  });

  const query = `
    INSERT INTO notifications (company_id, staff_id, title, message, type, related_lead_id, priority)
    VALUES ${placeholders.join(', ')}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getAdminStaffId = async (companyId) => {
  const result = await pool.query(
    `SELECT s.id FROM staff s
     INNER JOIN companies c ON s.company_id = c.id
     WHERE c.id = $1 AND s.email = c.admin_email`,
    [companyId]
  );
  return result.rows[0]?.id || null;
};

module.exports = {
  createNotification,
  getNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  getNotificationHistory,
  deleteNotification,
  getNotificationSettings,
  updateNotificationSettings,
  createBulkNotifications,
  getAdminStaffId
};