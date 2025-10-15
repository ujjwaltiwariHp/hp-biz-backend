const pool = require('../../config/database');
const bcrypt = require('bcryptjs');

const ISO_TIMESTAMP = 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"';

const getSuperAdminRoleById = async (roleId) => {
    const { rows } = await pool.query(
        'SELECT id, role_name, permissions::text as permissions FROM super_admin_roles WHERE id = $1',
        [roleId]
    );
    return rows[0];
};

const getSuperAdminRoleByName = async (roleName) => {
    const { rows } = await pool.query(
        'SELECT id, role_name, permissions::text as permissions FROM super_admin_roles WHERE role_name = $1',
        [roleName]
    );
    return rows[0];
};


const createSuperAdmin = async (data) => {
  const { email, password, name, super_admin_role_id, is_super_admin } = data;
  const hashedPassword = await bcrypt.hash(password, 12);
  const query = `
    INSERT INTO super_admins (email, password_hash, name, super_admin_role_id, is_super_admin)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, email, name, is_super_admin, super_admin_role_id, TO_CHAR(created_at AT TIME ZONE 'UTC', '${ISO_TIMESTAMP}') as created_at
  `;
  const { rows } = await pool.query(query, [email, hashedPassword, name, super_admin_role_id, is_super_admin]);
  return rows[0];
};

const getSuperAdminByEmail = async (email) => {
  const { rows } = await pool.query(
    'SELECT * FROM super_admins WHERE email = $1',
    [email]
  );
  return rows[0];
};

const getSuperAdminById = async (id) => {
  const { rows } = await pool.query(
    `SELECT sa.id, sa.email, sa.name, sa.status, sa.is_super_admin, sa.super_admin_role_id, sar.role_name,
            TO_CHAR(sa.created_at AT TIME ZONE 'UTC', '${ISO_TIMESTAMP}') as created_at,
            TO_CHAR(sa.updated_at AT TIME ZONE 'UTC', '${ISO_TIMESTAMP}') as updated_at
     FROM super_admins sa
     LEFT JOIN super_admin_roles sar ON sa.super_admin_role_id = sar.id
     WHERE sa.id = $1`,
    [id]
  );
  return rows[0];
};

const getAllSuperAdmins = async () => {
  const { rows } = await pool.query(
    `SELECT sa.id, sa.email, sa.name, sa.status, sa.is_super_admin, sar.role_name,
            TO_CHAR(sa.created_at AT TIME ZONE 'UTC', '${ISO_TIMESTAMP}') as created_at,
            TO_CHAR(sa.updated_at AT TIME ZONE 'UTC', '${ISO_TIMESTAMP}') as updated_at
     FROM super_admins sa
     LEFT JOIN super_admin_roles sar ON sa.super_admin_role_id = sar.id
     ORDER BY sa.created_at DESC`
  );
  return rows;
};

const updateSuperAdminPassword = async (id, password) => {
  const hashedPassword = await bcrypt.hash(password, 12);
  const query = `
    UPDATE super_admins
    SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, email, name,
    TO_CHAR(updated_at AT TIME ZONE 'UTC', '${ISO_TIMESTAMP}') as updated_at
  `;
  const { rows } = await pool.query(query, [hashedPassword, id]);
  return rows[0];
};

const updateSuperAdminProfile = async (id, data) => {
  const { email, name } = data;
  const query = `
    UPDATE super_admins
    SET email = $1, name = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING id, email, name,
    TO_CHAR(updated_at AT TIME ZONE 'UTC', '${ISO_TIMESTAMP}') as updated_at
  `;
  const { rows } = await pool.query(query, [email, name, id]);
  return rows[0];
};

const verifyPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};


const deleteSuperAdmin = async (id) => {
  const query = `
    DELETE FROM super_admins
    WHERE id = $1
    RETURNING id, email, name
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0];
};

const updateSuperAdminStatus = async (id, status) => {
  const query = `
    UPDATE super_admins
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, email, name, status,
    TO_CHAR(updated_at AT TIME ZONE 'UTC', '${ISO_TIMESTAMP}') as updated_at
  `;
  const { rows } = await pool.query(query, [status, id]);
  return rows[0];
};


module.exports = {
  createSuperAdmin,
  getSuperAdminByEmail,
  getSuperAdminById,
  getAllSuperAdmins,
  updateSuperAdminPassword,
  updateSuperAdminProfile,
  deleteSuperAdmin,
  updateSuperAdminStatus,
  verifyPassword,
  getSuperAdminRoleById,
  getSuperAdminRoleByName,
};
