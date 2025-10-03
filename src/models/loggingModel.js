const pool = require('../config/database');

const logUserActivity = async (activityData) => {
  const {
    staff_id,
    company_id,
    action_type,
    resource_type,
    resource_id,
    action_details,
    ip_address
  } = activityData;

  try {
    const query = `
      INSERT INTO user_activity_logs (
        staff_id, company_id, action_type, resource_type,
        resource_id, action_details, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at
    `;

    const values = [
      staff_id, company_id, action_type, resource_type,
      resource_id, action_details, ip_address
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error logging user activity:', error);
    return null;
  }
};

const logSystemEvent = async (logData) => {
  const {
    company_id,
    staff_id,
    log_level,
    log_category,
    message
  } = logData;

  try {
    const query = `
      INSERT INTO system_logs (
        company_id, staff_id, log_level, log_category, message
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const values = [company_id, staff_id, log_level, log_category, message];

    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    return null;
  }
};

const getUserActivityLogs = async (filters = {}) => {
  const {
    staff_id,
    company_id,
    action_type,
    start_date,
    end_date,
    page = 1,
    limit = 50
  } = filters;

  let query = `
    SELECT
      ual.id,
      ual.staff_id,
      ual.company_id,
      ual.action_type,
      ual.resource_type,
      ual.resource_id,
      ual.action_details,
      ual.ip_address,
      ual.created_at,
      COALESCE(s.first_name, '') as first_name,
      COALESCE(s.last_name, '') as last_name,
      COALESCE(s.email, c.admin_email) as email,
      c.company_name
    FROM user_activity_logs ual
    LEFT JOIN staff s ON ual.staff_id = s.id
    LEFT JOIN companies c ON ual.company_id = c.id
    WHERE 1=1
  `;

  const values = [];
  let paramCount = 1;

  if (company_id) {
    query += ` AND ual.company_id = $${paramCount}`;
    values.push(company_id);
    paramCount++;
  }

  if (staff_id) {
    query += ` AND ual.staff_id = $${paramCount}`;
    values.push(staff_id);
    paramCount++;
  }

  if (action_type) {
    query += ` AND ual.action_type = $${paramCount}`;
    values.push(action_type);
    paramCount++;
  }

  if (start_date) {
    query += ` AND ual.created_at >= $${paramCount}`;
    values.push(start_date);
    paramCount++;
  }

  if (end_date) {
    query += ` AND ual.created_at <= $${paramCount}`;
    values.push(end_date);
    paramCount++;
  }

  query += ` ORDER BY ual.created_at DESC`;
  query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  values.push(limit, (page - 1) * limit);

  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    throw new Error('Error fetching user activity logs: ' + error.message);
  }
};

const getSystemLogs = async (filters = {}) => {
  const {
    company_id,
    staff_id,
    log_level,
    log_category,
    start_date,
    end_date,
    page = 1,
    limit = 50
  } = filters;

  let query = `
    SELECT
      sl.id,
      sl.company_id,
      sl.staff_id,
      sl.log_level,
      sl.log_category,
      sl.message,
      sl.created_at,
      COALESCE(s.first_name, '') as first_name,
      COALESCE(s.last_name, '') as last_name,
      COALESCE(s.email, c.admin_email) as email,
      c.company_name
    FROM system_logs sl
    LEFT JOIN staff s ON sl.staff_id = s.id
    LEFT JOIN companies c ON sl.company_id = c.id
    WHERE 1=1
  `;

  const values = [];
  let paramCount = 1;

  if (company_id) {
    query += ` AND sl.company_id = $${paramCount}`;
    values.push(company_id);
    paramCount++;
  }

  if (staff_id) {
    query += ` AND sl.staff_id = $${paramCount}`;
    values.push(staff_id);
    paramCount++;
  }

  if (log_level) {
    query += ` AND sl.log_level = $${paramCount}`;
    values.push(log_level);
    paramCount++;
  }

  if (log_category) {
    query += ` AND sl.log_category = $${paramCount}`;
    values.push(log_category);
    paramCount++;
  }

  if (start_date) {
    query += ` AND sl.created_at >= $${paramCount}`;
    values.push(start_date);
    paramCount++;
  }

  if (end_date) {
    query += ` AND sl.created_at <= $${paramCount}`;
    values.push(end_date);
    paramCount++;
  }

  query += ` ORDER BY sl.created_at DESC`;
  query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  values.push(limit, (page - 1) * limit);

  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    throw new Error('Error fetching system logs: ' + error.message);
  }
};

const cleanOldLogs = async (daysToKeep = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const activityResult = await pool.query(
      'DELETE FROM user_activity_logs WHERE created_at < $1',
      [cutoffDate]
    );

    const systemResult = await pool.query(
      `DELETE FROM system_logs
       WHERE created_at < $1 AND log_level NOT IN ('ERROR', 'CRITICAL')`,
      [cutoffDate]
    );

    return {
      activity_logs_deleted: activityResult.rowCount,
      system_logs_deleted: systemResult.rowCount
    };
  } catch (error) {
    throw new Error('Error cleaning old logs: ' + error.message);
  }
};

const getActivitySummary = async (company_id, days = 7) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = `
      SELECT
        action_type,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM user_activity_logs
      WHERE company_id = $1 AND created_at >= $2
      GROUP BY action_type, DATE(created_at)
      ORDER BY date DESC, count DESC
    `;

    const result = await pool.query(query, [company_id, startDate]);
    return result.rows;
  } catch (error) {
    throw new Error('Error getting activity summary: ' + error.message);
  }
};

const getTotalLogsCount = async (filters = {}) => {
  const {
    staff_id,
    company_id,
    action_type,
    start_date,
    end_date
  } = filters;

  let query = `
    SELECT COUNT(*) as total
    FROM user_activity_logs ual
    WHERE 1=1
  `;

  const values = [];
  let paramCount = 1;

  if (company_id) {
    query += ` AND ual.company_id = $${paramCount}`;
    values.push(company_id);
    paramCount++;
  }

  if (staff_id) {
    query += ` AND ual.staff_id = $${paramCount}`;
    values.push(staff_id);
    paramCount++;
  }

  if (action_type) {
    query += ` AND ual.action_type = $${paramCount}`;
    values.push(action_type);
    paramCount++;
  }

  if (start_date) {
    query += ` AND ual.created_at >= $${paramCount}`;
    values.push(start_date);
    paramCount++;
  }

  if (end_date) {
    query += ` AND ual.created_at <= $${paramCount}`;
    values.push(end_date);
    paramCount++;
  }

  try {
    const result = await pool.query(query, values);
    return parseInt(result.rows[0].total);
  } catch (error) {
    throw new Error('Error getting total logs count: ' + error.message);
  }
};

module.exports = {
  logUserActivity,
  logSystemEvent,
  getUserActivityLogs,
  getSystemLogs,
  cleanOldLogs,
  getActivitySummary,
  getTotalLogsCount
};