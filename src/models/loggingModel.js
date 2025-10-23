const pool = require('../config/database');

const normalizeIPForDisplay = (ip) => {
  if (!ip) return 'N/A';
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  if (ip === '::1') {
    return '127.0.0.1';
  }
  return ip;
};

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
        resource_id, action_details, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::inet, CURRENT_TIMESTAMP)
      RETURNING id, TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at
    `;

    const values = [
      staff_id || null,
      company_id || null,
      action_type,
      resource_type || 'unknown',
      resource_id || null,
      action_details || '',
      ip_address || '0.0.0.0'
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
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
        company_id, staff_id, log_level, log_category, message, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING id, TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at
    `;

    const values = [
      company_id || null,
      staff_id || null,
      log_level || 'INFO',
      log_category || 'general',
      message
    ];

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
    resource_type,
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
      HOST(ual.ip_address) as ip_address,
      TO_CHAR(ual.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at,

      CASE
        WHEN ual.company_id IS NULL THEN COALESCE(sa.name, 'Super Admin')
        WHEN ual.staff_id IS NULL THEN COALESCE(c.admin_name, 'Company Admin')
        ELSE COALESCE(s.first_name, '')
      END as first_name,

      CASE
        WHEN ual.company_id IS NULL THEN ''
        WHEN ual.staff_id IS NULL THEN ''
        ELSE COALESCE(s.last_name, '')
      END as last_name,

      COALESCE(s.email, c.admin_email, sa.email, 'System') as email,
      COALESCE(c.company_name, 'System/SuperAdmin') as company_name,

      CASE
        WHEN ual.company_id IS NULL THEN 'Super Admin'
        WHEN ual.staff_id IS NULL THEN 'Admin'
        ELSE 'Staff'
      END as user_type
    FROM user_activity_logs ual
    LEFT JOIN staff s ON ual.staff_id = s.id AND ual.company_id IS NOT NULL
    LEFT JOIN companies c ON ual.company_id = c.id
    LEFT JOIN super_admins sa ON ual.company_id IS NULL AND ual.staff_id = sa.id -- FIX: Correctly join Super Admins on staff_id when company_id is NULL
    WHERE 1=1
  `;

  const values = [];
  let paramCount = 1;

  if (company_id !== undefined) {
    if (company_id === null) {
      query += ` AND ual.company_id IS NULL`;
    } else {
      query += ` AND ual.company_id = $${paramCount}`;
      values.push(company_id);
      paramCount++;
    }
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

  if (resource_type) {
    query += ` AND ual.resource_type = $${paramCount}`;
    values.push(resource_type);
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
    return result.rows.map(log => ({
        ...log,
        ip_address: normalizeIPForDisplay(log.ip_address)
    }));
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
      TO_CHAR(sl.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at,
      COALESCE(c.admin_name, 'System') as first_name,
      '' as last_name,
      COALESCE(c.admin_email, 'System') as email,
      COALESCE(c.company_name, 'System') as company_name
    FROM system_logs sl
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
    values.push(log_level.toUpperCase());
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

    const logsWithIP = result.rows.map(log => {
      const ipMatch = log.message.match(/IP:\s*([^\s-]+)/);
      const rawIp = ipMatch ? ipMatch[1] : null;
      return {
        ...log,
        ip_address: normalizeIPForDisplay(rawIp)
      };
    });
    return logsWithIP;
  } catch (error) {
    throw new Error('Error fetching system logs: ' + error.message);
  }
};

const getTotalSystemLogsCount = async (filters = {}) => {
  const {
    company_id,
    staff_id,
    log_level,
    log_category,
    start_date,
    end_date
  } = filters;

  let query = `
    SELECT COUNT(*) as total
    FROM system_logs sl
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
    values.push(log_level.toUpperCase());
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

  try {
    const result = await pool.query(query, values);
    return parseInt(result.rows[0].total);
  } catch (error) {
    throw new Error('Error getting total system logs count: ' + error.message);
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
    resource_type,
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

  if (company_id !== undefined) {
    if (company_id === null) {
      query += ` AND ual.company_id IS NULL`;
    } else {
      query += ` AND ual.company_id = $${paramCount}`;
      values.push(company_id);
      paramCount++;
    }
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

  if (resource_type) {
    query += ` AND ual.resource_type = $${paramCount}`;
    values.push(resource_type);
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

const getActionTypes = async (company_id) => {
  try {
    const query = `
      SELECT DISTINCT action_type
      FROM user_activity_logs
      WHERE company_id = $1
      ORDER BY action_type
    `;

    const result = await pool.query(query, [company_id]);
    return result.rows.map(row => row.action_type);
  } catch (error) {
    return [];
  }
};

const getResourceTypes = async (company_id) => {
  try {
    const query = `
      SELECT DISTINCT resource_type
      FROM user_activity_logs
      WHERE company_id = $1
      ORDER BY resource_type
    `;

    const result = await pool.query(query, [company_id]);
    return result.rows.map(row => row.resource_type);
  } catch (error) {
    return [];
  }
};

module.exports = {
  logUserActivity,
  logSystemEvent,
  getUserActivityLogs,
  getSystemLogs,
  cleanOldLogs,
  getActivitySummary,
  getTotalLogsCount,
  getTotalSystemLogsCount,
  getActionTypes,
  getResourceTypes
};