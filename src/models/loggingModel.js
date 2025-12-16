const pool = require('../config/database');
const sseService = require('../services/sseService');

const normalizeIPForDisplay = (ip) => {
  if (!ip) return 'N/A';
  if (ip.startsWith('::ffff:')) return ip.substring(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
};

const logUserActivity = async (activityData) => {
  const {
    staff_id,
    company_id,
    super_admin_id,
    action_type,
    resource_type,
    resource_id,
    action_details,
    ip_address
  } = activityData;

  try {
    const query = `
      INSERT INTO user_activity_logs (
        staff_id, company_id, super_admin_id, action_type, resource_type,
        resource_id, action_details, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const values = [
      staff_id || null,
      company_id || null,
      super_admin_id || null,
      action_type,
      resource_type || 'unknown',
      resource_id || null,
      action_details || '',
      ip_address || '0.0.0.0'
    ];

    const result = await pool.query(query, values);
    const logEntry = result.rows[0];

    if (logEntry) {
      const logPayload = { ...logEntry, ip_address: normalizeIPForDisplay(logEntry.ip_address) };
      if (company_id) {
        sseService.publish(`c_${company_id}`, 'new_activity_log', logPayload);
      }
      sseService.broadcast('sa_new_activity_log', logPayload);
    }

    return logEntry;
  } catch (error) {
    return null;
  }
};

const logSystemEvent = async (logData) => {
  const {
    company_id,
    staff_id,
    super_admin_id,
    log_level,
    log_category,
    message,
    ip_address
  } = logData;

  try {
    const query = `
      INSERT INTO system_logs (
        company_id, staff_id, super_admin_id, log_level, log_category, message, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::inet, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const values = [
      company_id || null,
      staff_id || null,
      super_admin_id || null,
      log_level || 'INFO',
      log_category || 'general',
      message,
      ip_address || '0.0.0.0'
    ];

    const result = await pool.query(query, values);
    const logEntry = result.rows[0];

    if (logEntry) {
       const logPayload = { ...logEntry, ip_address: normalizeIPForDisplay(logEntry.ip_address) };
       if (company_id) {
         sseService.publish(`c_${company_id}`, 'new_system_log', logPayload);
       }
       sseService.broadcast('sa_new_system_log', logPayload);
    }

    return logEntry;
  } catch (error) {
    return null;
  }
};

const getUserActivityLogs = async (filters = {}) => {
  const {
    staff_id,
    company_id,
    super_admin_id,
    action_type,
    resource_type,
    start_date,
    end_date,
    search,
    page = 1,
    limit = 50
  } = filters;

  let query = `
    SELECT
      ual.id, ual.staff_id, ual.company_id, ual.super_admin_id,
      ual.action_type, ual.resource_type, ual.resource_id, ual.action_details,
      HOST(ual.ip_address) as ip_address,
      TO_CHAR(ual.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,

      CASE
        WHEN ual.super_admin_id IS NOT NULL THEN sa.name
        WHEN ual.staff_id IS NOT NULL THEN COALESCE(s.first_name || ' ' || s.last_name, 'Staff')
        WHEN ual.company_id IS NOT NULL AND ual.staff_id IS NULL THEN COALESCE(c.admin_name, 'Company Admin')
        ELSE 'System'
      END as user_name,

      CASE
        WHEN ual.super_admin_id IS NOT NULL THEN sa.email
        WHEN ual.staff_id IS NOT NULL THEN s.email
        WHEN ual.company_id IS NOT NULL THEN c.admin_email
        ELSE 'System'
      END as email,

      CASE
        WHEN ual.super_admin_id IS NOT NULL THEN 'Super Admin'
        WHEN ual.company_id IS NOT NULL THEN c.company_name
        ELSE 'System'
      END as company_name,

      CASE
        WHEN ual.super_admin_id IS NOT NULL THEN 'Super Admin'
        WHEN ual.staff_id IS NOT NULL THEN 'Staff'
        WHEN ual.company_id IS NOT NULL THEN 'Company Admin'
        ELSE 'System'
      END as user_type

    FROM user_activity_logs ual
    LEFT JOIN staff s ON ual.staff_id = s.id
    LEFT JOIN companies c ON ual.company_id = c.id
    LEFT JOIN super_admins sa ON ual.super_admin_id = sa.id
    WHERE 1=1
  `;

  const values = [];
  let paramCount = 1;

  if (search && search.trim() !== '') {
    query += ` AND (
      ual.action_details ILIKE $${paramCount} OR
      ual.action_type ILIKE $${paramCount} OR
      c.company_name ILIKE $${paramCount} OR
      s.first_name ILIKE $${paramCount} OR
      s.last_name ILIKE $${paramCount} OR
      s.email ILIKE $${paramCount} OR
      sa.email ILIKE $${paramCount} OR
      sa.name ILIKE $${paramCount}
    )`;
    values.push(`%${search.trim()}%`);
    paramCount++;
  }

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

  if (super_admin_id) {
    query += ` AND ual.super_admin_id = $${paramCount}`;
    values.push(super_admin_id);
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

  query += ` ORDER BY ual.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
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
    staff_id,
    company_id,
    super_admin_id,
    log_level,
    log_category,
    start_date,
    end_date,
    search,
    page = 1,
    limit = 50
  } = filters;

  let query = `
    SELECT
      sl.id, sl.company_id, sl.staff_id, sl.super_admin_id,
      sl.log_level, sl.log_category, sl.message,
      HOST(sl.ip_address) as ip_address,
      TO_CHAR(sl.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,

      CASE
        WHEN sl.super_admin_id IS NOT NULL THEN sa.name
        WHEN sl.staff_id IS NOT NULL THEN s.first_name
        WHEN sl.company_id IS NOT NULL THEN c.admin_name
        ELSE 'System'
      END as user_name,

      CASE
        WHEN sl.super_admin_id IS NOT NULL THEN sa.email
        WHEN sl.staff_id IS NOT NULL THEN s.email
        WHEN sl.company_id IS NOT NULL THEN c.admin_email
        ELSE ''
      END as email,

      COALESCE(c.company_name, 'System') as company_name

    FROM system_logs sl
    LEFT JOIN companies c ON sl.company_id = c.id
    LEFT JOIN staff s ON sl.staff_id = s.id
    LEFT JOIN super_admins sa ON sl.super_admin_id = sa.id
    WHERE 1=1
  `;

  const values = [];
  let paramCount = 1;

  if (search && search.trim() !== '') {
    query += ` AND (
      sl.message ILIKE $${paramCount} OR
      sl.log_category ILIKE $${paramCount} OR
      c.company_name ILIKE $${paramCount} OR
      s.first_name ILIKE $${paramCount} OR
      s.last_name ILIKE $${paramCount} OR
      s.email ILIKE $${paramCount} OR
      sa.email ILIKE $${paramCount} OR
      sa.name ILIKE $${paramCount}
    )`;
    values.push(`%${search.trim()}%`);
    paramCount++;
  }

  if (company_id !== undefined) {
      if (company_id === null) query += ` AND sl.company_id IS NULL`;
      else {
          query += ` AND sl.company_id = $${paramCount}`;
          values.push(company_id);
          paramCount++;
      }
  }

  if (staff_id) {
    query += ` AND sl.staff_id = $${paramCount}`;
    values.push(staff_id);
    paramCount++;
  }

  if (super_admin_id) {
    query += ` AND sl.super_admin_id = $${paramCount}`;
    values.push(super_admin_id);
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

  query += ` ORDER BY sl.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  values.push(limit, (page - 1) * limit);

  try {
    const result = await pool.query(query, values);
    return result.rows.map(log => ({
        ...log,
        ip_address: normalizeIPForDisplay(log.ip_address)
    }));
  } catch (error) {
    throw new Error('Error fetching system logs: ' + error.message);
  }
};

const getTotalLogsCount = async (filters = {}) => {
  const { staff_id, company_id, super_admin_id, action_type, resource_type, start_date, end_date, search } = filters;

  let query = `
    SELECT COUNT(*) as total
    FROM user_activity_logs ual
    LEFT JOIN staff s ON ual.staff_id = s.id
    LEFT JOIN companies c ON ual.company_id = c.id
    LEFT JOIN super_admins sa ON ual.super_admin_id = sa.id
    WHERE 1=1
  `;

  const values = [];
  let paramCount = 1;

  if (search && search.trim() !== '') {
    query += ` AND (
      ual.action_details ILIKE $${paramCount} OR
      ual.action_type ILIKE $${paramCount} OR
      c.company_name ILIKE $${paramCount} OR
      s.first_name ILIKE $${paramCount} OR
      s.last_name ILIKE $${paramCount} OR
      s.email ILIKE $${paramCount} OR
      sa.email ILIKE $${paramCount} OR
      sa.name ILIKE $${paramCount}
    )`;
    values.push(`%${search.trim()}%`);
    paramCount++;
  }

  if (company_id !== undefined) {
    if (company_id === null) query += ` AND ual.company_id IS NULL`;
    else { query += ` AND ual.company_id = $${paramCount}`; values.push(company_id); paramCount++; }
  }
  if (staff_id) { query += ` AND ual.staff_id = $${paramCount}`; values.push(staff_id); paramCount++; }
  if (super_admin_id) { query += ` AND ual.super_admin_id = $${paramCount}`; values.push(super_admin_id); paramCount++; }
  if (action_type) { query += ` AND ual.action_type = $${paramCount}`; values.push(action_type); paramCount++; }
  if (resource_type) { query += ` AND ual.resource_type = $${paramCount}`; values.push(resource_type); paramCount++; }
  if (start_date) { query += ` AND ual.created_at >= $${paramCount}`; values.push(start_date); paramCount++; }
  if (end_date) { query += ` AND ual.created_at <= $${paramCount}`; values.push(end_date); paramCount++; }

  try {
    const result = await pool.query(query, values);
    return parseInt(result.rows[0].total);
  } catch (error) {
    throw new Error('Error getting total logs count');
  }
};

const getTotalSystemLogsCount = async (filters = {}) => {
    const { staff_id, company_id, super_admin_id, log_level, log_category, start_date, end_date, search } = filters;

    let query = `
      SELECT COUNT(*) as total
      FROM system_logs sl
      LEFT JOIN companies c ON sl.company_id = c.id
      LEFT JOIN staff s ON sl.staff_id = s.id
      LEFT JOIN super_admins sa ON sl.super_admin_id = sa.id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (search && search.trim() !== '') {
      query += ` AND (
        sl.message ILIKE $${paramCount} OR
        sl.log_category ILIKE $${paramCount} OR
        c.company_name ILIKE $${paramCount} OR
        s.first_name ILIKE $${paramCount} OR
        s.last_name ILIKE $${paramCount} OR
        s.email ILIKE $${paramCount} OR
        sa.email ILIKE $${paramCount} OR
        sa.name ILIKE $${paramCount}
      )`;
      values.push(`%${search.trim()}%`);
      paramCount++;
    }

    if (company_id !== undefined) {
      if (company_id === null) query += ` AND sl.company_id IS NULL`;
      else { query += ` AND sl.company_id = $${paramCount}`; values.push(company_id); paramCount++; }
    }
    if (staff_id) { query += ` AND sl.staff_id = $${paramCount}`; values.push(staff_id); paramCount++; }
    if (super_admin_id) { query += ` AND sl.super_admin_id = $${paramCount}`; values.push(super_admin_id); paramCount++; }
    if (log_level) { query += ` AND sl.log_level = $${paramCount}`; values.push(log_level); paramCount++; }
    if (log_category) { query += ` AND sl.log_category = $${paramCount}`; values.push(log_category); paramCount++; }
    if (start_date) { query += ` AND sl.created_at >= $${paramCount}`; values.push(start_date); paramCount++; }
    if (end_date) { query += ` AND sl.created_at <= $${paramCount}`; values.push(end_date); paramCount++; }

    try {
      const result = await pool.query(query, values);
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new Error('Error getting total logs count');
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

const getActionTypes = async (company_id) => {
    try {
        const query = `SELECT DISTINCT action_type FROM user_activity_logs WHERE company_id = $1`;
        const result = await pool.query(query, [company_id]);
        return result.rows.map(row => row.action_type);
    } catch { return []; }
};

const getResourceTypes = async (company_id) => {
    try {
        const query = `SELECT DISTINCT resource_type FROM user_activity_logs WHERE company_id = $1`;
        const result = await pool.query(query, [company_id]);
        return result.rows.map(row => row.resource_type);
    } catch { return []; }
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