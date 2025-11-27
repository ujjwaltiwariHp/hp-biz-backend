const pool = require("../config/database");
const bcrypt = require('bcryptjs');

const getAllStaff = async (companyId) => {
  const result = await pool.query(
    `SELECT s.id, s.first_name, s.last_name, s.email, s.phone, s.designation,
            s.status, s.is_first_login,
            TO_CHAR(s.last_login AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_login,
            TO_CHAR(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
            TO_CHAR(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at,
            r.role_name, r.permissions, r.id as role_id
     FROM staff s
     LEFT JOIN roles r ON s.role_id = r.id
     WHERE s.company_id = $1
     ORDER BY s.created_at DESC`,
    [companyId]
  );
  return result.rows;
};

const getStaffById = async (id, companyId) => {
  const result = await pool.query(
    `SELECT s.id, s.company_id, s.first_name, s.last_name, s.email, s.phone,
            s.designation, s.status, s.is_first_login,
            TO_CHAR(s.last_login AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_login,
            TO_CHAR(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
            TO_CHAR(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at,
            r.role_name, r.permissions, r.id as role_id,
            c.company_name, c.unique_company_id
     FROM staff s
     LEFT JOIN roles r ON s.role_id = r.id
     LEFT JOIN companies c ON s.company_id = c.id
     WHERE s.id = $1 AND s.company_id = $2`,
    [id, companyId]
  );
  return result.rows[0];
};


const createStaff = async (data) => {
  const {
    company_id,
    first_name,
    last_name,
    email,
    phone,
    designation,
    role_id,
    status,
  } = data;

  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
  const password_hash = await bcrypt.hash(tempPassword, 12);

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const result = await pool.query(
    `INSERT INTO staff
     (company_id, role_id, first_name, last_name, email, phone, password_hash,
      designation, status, is_first_login, password_status, temp_password_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'temporary', $10)
     RETURNING id, company_id, first_name, last_name, email, phone, designation, status, is_first_login,
     TO_CHAR(last_login AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_login,
     TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
     TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at`,
    [company_id, role_id, first_name, last_name, email, phone, password_hash,
     designation, status, expiresAt]
  );

  return {
    staff: result.rows[0],
    tempPassword
  };
};

const updateStaff = async (id, data, companyId) => {
  const allowedFields = ['first_name', 'last_name', 'email', 'phone', 'designation', 'role_id', 'status', 'last_login'];
  const updateFields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(data).forEach(key => {
    if (allowedFields.includes(key) && data[key] !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      values.push(data[key]);
      paramCount++;
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No valid fields to update");
  }

  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

  values.push(id, companyId);
  const whereClause = `WHERE id = $${paramCount} AND company_id = $${paramCount + 1}`;

  const query = `UPDATE staff SET ${updateFields.join(', ')} ${whereClause}
    RETURNING id, company_id, first_name, last_name, email, phone, designation, status, is_first_login,
    TO_CHAR(last_login AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_login,
    TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
    TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at`;

  const result = await pool.query(query, values);
  return result.rows[0];
};

const deleteStaff = async (id, companyId) => {
  const staffCheck = await pool.query(
    `SELECT s.id, r.role_name FROM staff s
     LEFT JOIN roles r ON s.role_id = r.id
     WHERE s.id = $1 AND s.company_id = $2`,
    [id, companyId]
  );

  if (!staffCheck.rows[0]) {
    return false;
  }

  if (staffCheck.rows[0].role_name === 'Admin') {
    const adminCount = await pool.query(
      `SELECT COUNT(*) as count FROM staff s
       JOIN roles r ON s.role_id = r.id
       WHERE s.company_id = $1 AND r.role_name = 'Admin' AND s.status = 'active'`,
      [companyId]
    );

    if (parseInt(adminCount.rows[0].count) <= 1) {
      throw new Error("Cannot delete the last admin user");
    }
  }

  const result = await pool.query(
    "DELETE FROM staff WHERE id=$1 AND company_id=$2 RETURNING id",
    [id, companyId]
  );
  return result.rows.length > 0;
};

const updateStaffStatus = async (id, status, companyId) => {
  if (status !== 'active') {
    const staffCheck = await pool.query(
      `SELECT r.role_name FROM staff s
       JOIN roles r ON s.role_id = r.id
       WHERE s.id = $1 AND s.company_id = $2`,
      [id, companyId]
    );

    if (staffCheck.rows[0] && staffCheck.rows[0].role_name === 'Admin') {
      const adminCount = await pool.query(
        `SELECT COUNT(*) as count FROM staff s
         JOIN roles r ON s.role_id = r.id
         WHERE s.company_id = $1 AND r.role_name = 'Admin' AND s.status = 'active'`,
        [companyId]
      );

      if (parseInt(adminCount.rows[0].count) <= 1) {
        throw new Error("Cannot deactivate the last admin user");
      }
    }
  }

  const result = await pool.query(
    `UPDATE staff SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND company_id=$3
    RETURNING id, company_id, first_name, last_name, email, phone, designation, status, is_first_login,
    TO_CHAR(last_login AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_login,
    TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
    TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at`,
    [status, id, companyId]
  );
  return result.rows[0];
};


const staffLogin = async (email, password, companyId) => {
  const query = `
    SELECT s.id, s.company_id, s.first_name, s.last_name, s.email, s.phone,
           s.designation, s.status, s.is_first_login, s.password_hash,
           s.password_status, s.temp_password_expires_at,
           TO_CHAR(s.last_login AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_login,
           TO_CHAR(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
           TO_CHAR(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at,
           c.company_name, c.unique_company_id, r.role_name, r.permissions
    FROM staff s
    JOIN companies c ON s.company_id = c.id
    LEFT JOIN roles r ON s.role_id = r.id
    WHERE s.email = $1 AND s.company_id = $2 AND s.status = 'active'
  `;

  const result = await pool.query(query, [email, companyId]);

  if (!result.rows[0]) return null;

  const staff = result.rows[0];

  if (staff.password_status === 'temporary' && staff.temp_password_expires_at) {
    if (new Date() > new Date(staff.temp_password_expires_at)) {
      throw new Error("Temporary password has expired. Please contact your administrator.");
    }
  }

  const isValidPassword = await bcrypt.compare(password, staff.password_hash);

  if (!isValidPassword) return null;

  return staff;
};

const activateStaffPassword = async (staffId, newPassword) => {
  const password_hash = await bcrypt.hash(newPassword, 12);

  const result = await pool.query(
    `UPDATE staff
     SET password_hash = $1,
         password_status = 'active',
         temp_password_expires_at = NULL,
         last_password_change_at = CURRENT_TIMESTAMP,
         is_first_login = false,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, email, password_status`,
    [password_hash, staffId]
  );

  return result.rows[0];
};

const updateStaffPassword = async (staffId, newPassword) => {
  const password_hash = await bcrypt.hash(newPassword, 12);

  const result = await pool.query(
    `UPDATE staff
     SET password_hash=$1, is_first_login=false, updated_at=CURRENT_TIMESTAMP
     WHERE id=$2
     RETURNING id, company_id, first_name, last_name, email, phone, designation, status, is_first_login,
     TO_CHAR(last_login AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last_login,
     TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
     TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at`,
    [password_hash, staffId]
  );

  return result.rows[0];
};

const getCompanyRoles = async (companyId) => {
  const result = await pool.query(
    "SELECT id, role_name, description FROM roles WHERE company_id = $1 AND is_active = true ORDER BY role_name",
    [companyId]
  );
  return result.rows;
};

const getStaffPerformance = async (id, companyId) => {
  const staff = await getStaffById(id, companyId);
  if (!staff) return null;

  const performanceResult = await pool.query(
    `SELECT staff_id, period_type,
     TO_CHAR(period_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as period_start,
     total_leads_assigned, leads_contacted, leads_qualified, leads_converted, conversion_rate, avg_response_time, activities_count
     FROM staff_performance
     WHERE staff_id = $1 AND period_type = 'monthly'
     AND period_start = DATE_TRUNC('month', CURRENT_DATE)
     ORDER BY period_start DESC LIMIT 1`,
    [id]
  );

  if (performanceResult.rows[0]) {
    return performanceResult.rows[0];
  }

  return {
    staff_id: id,
    period_type: 'monthly',
    period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    total_leads_assigned: 0,
    leads_contacted: 0,
    leads_qualified: 0,
    leads_converted: 0,
    conversion_rate: 0.0,
    avg_response_time: 0,
    activities_count: 0
  };
};

const isEmailUnique = async (email, companyId, excludeId = null) => {
  let query = "SELECT id FROM staff WHERE email = $1 AND company_id = $2";
  let params = [email, companyId];

  if (excludeId) {
    query += " AND id != $3";
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rows.length === 0;
};

const getStaffStats = async (companyId) => {
  const result = await pool.query(
    `SELECT
       COUNT(*) as total_staff,
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active_staff,
       COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_staff,
       COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_staff,
       COUNT(CASE WHEN is_first_login = true THEN 1 END) as pending_first_login
     FROM staff
     WHERE company_id = $1`,
    [companyId]
  );

  return result.rows[0];
};

const getCurrentStaffCount = async (companyId) => {
  const result = await pool.query(
    `SELECT COUNT(id)::integer as count FROM staff
     WHERE company_id = $1 AND status = 'active'`,
    [companyId]
  );
  return result.rows[0]?.count || 0;
};


const getDesignationOptions = async () => {
  const designations = [
    { value: 'Manager', label: 'Manager' },
    { value: 'Team Lead', label: 'Team Lead' },
    { value: 'Senior Executive', label: 'Senior Executive' },
    { value: 'Executive', label: 'Executive' },
    { value: 'Junior Executive', label: 'Junior Executive' },
    { value: 'Trainee', label: 'Trainee' },
    { value: 'Intern', label: 'Intern' },
    { value: 'Sales Representative', label: 'Sales Representative' },
    { value: 'Account Manager', label: 'Account Manager' },
    { value: 'Business Development', label: 'Business Development' }
  ];

  return designations;
};

const getStatusOptions = async () => {
  const statuses = [
    { value: 'active', label: 'Active', color: '#28a745' },
    { value: 'inactive', label: 'Inactive', color: '#6c757d' },
    { value: 'suspended', label: 'Suspended', color: '#dc3545' }
  ];

  return statuses;
};

const hasPermission = (userPermissions, permissionKey) => {
  if (!userPermissions || typeof userPermissions !== 'object') return false;
  return userPermissions[permissionKey] === true;
};

const createStaffSession = async (staffId, refreshToken, ip, userAgent) => {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO staff_sessions (staff_id, refresh_token, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [staffId, refreshToken, ip, userAgent, expiresAt]
  );
};

const findStaffSession = async (refreshToken) => {
  const { rows } = await pool.query(
    'SELECT * FROM staff_sessions WHERE refresh_token = $1 AND expires_at > NOW()',
    [refreshToken]
  );
  return rows[0];
};

const deleteStaffSession = async (refreshToken) => {
  await pool.query('DELETE FROM staff_sessions WHERE refresh_token = $1', [refreshToken]);
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  updateStaffStatus,
  staffLogin,
  activateStaffPassword,
  updateStaffPassword,
  getCompanyRoles,
  getStaffPerformance,
  hasPermission,
  isEmailUnique,
  getStaffStats,
  getCurrentStaffCount,
  getDesignationOptions,
  getStatusOptions,
  createStaffSession,
  findStaffSession,
  deleteStaffSession
};