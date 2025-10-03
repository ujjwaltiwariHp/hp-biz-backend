const pool = require('../../config/database');
const bcrypt = require('bcryptjs');

const createSuperAdmin = async ({ email, password, name }) => {
  const hashedPassword = await bcrypt.hash(password, 12);
  const query = `
    INSERT INTO super_admins (email, password_hash, name)
    VALUES ($1, $2, $3)
    RETURNING id, email, name, created_at
  `;
  const { rows } = await pool.query(query, [email, hashedPassword, name]);
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
    'SELECT id, email, name, created_at, updated_at FROM super_admins WHERE id = $1',
    [id]
  );
  return rows[0];
};

const getAllSuperAdmins = async () => {
  const { rows } = await pool.query(
    'SELECT id, email, name, created_at, updated_at FROM super_admins'
  );
  return rows;
};

const updateSuperAdminPassword = async (id, password) => {
  const hashedPassword = await bcrypt.hash(password, 12);
  const query = `
    UPDATE super_admins
    SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, email, name, updated_at
  `;
  const { rows } = await pool.query(query, [hashedPassword, id]);
  return rows[0];
};

const updateSuperAdminProfile = async (id, { email }) => {
  const query = `
    UPDATE super_admins
    SET email = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, email, name, updated_at
  `;
  const { rows } = await pool.query(query, [email, id]);
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
    RETURNING id, email, name, status, updated_at
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
};