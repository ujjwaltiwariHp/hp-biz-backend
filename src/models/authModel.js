const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const generateUniqueId = () => {
  return 'COMP_' + uuidv4().substring(0, 8).toUpperCase();
};

const createCompany = async ({ admin_email }) => {
  let unique_company_id = generateUniqueId();
  let isUnique = false;

  while (!isUnique) {
    const { rows: existing } = await pool.query(
      'SELECT id FROM companies WHERE unique_company_id = $1',
      [unique_company_id]
    );
    if (existing.length === 0) {
      isUnique = true;
    } else {
      unique_company_id = generateUniqueId();
    }
  }

  const query = `
    INSERT INTO companies (
      unique_company_id,
      company_name,
      admin_email,
      password_hash,
      admin_name,
      email_verified,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id, unique_company_id, company_name, admin_email, password_hash, admin_name, email_verified, is_active,
    TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
    TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at;
  `;

  const { rows } = await pool.query(query, [
    unique_company_id,
    'Company Name',
    admin_email,
    '',
    'Admin User'
  ]);

  return rows[0];
};

const updateCompanyProfile = async (companyId, profileData) => {
  const allowedFields = [
    'company_name', 'admin_name', 'phone', 'address',
    'website', 'industry', 'company_size'
  ];

  const updateFields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(profileData).forEach((key) => {
    if (allowedFields.includes(key) && profileData[key] !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      values.push(profileData[key]);
      paramCount++;
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No valid fields to update");
  }

  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(companyId);

  const query = `
    UPDATE companies
    SET ${updateFields.join(", ")}
    WHERE id = $${paramCount} AND email_verified = TRUE
    RETURNING id, unique_company_id, company_name, admin_email, admin_name,
             phone, address, website, industry, company_size, email_verified,
             is_active, subscription_package_id, subscription_start_date, subscription_end_date,
             TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
             TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at;
  `;

  const { rows } = await pool.query(query, values);
  return rows[0];
};

const getCompanyByEmail = async (admin_email) => {
  const { rows } = await pool.query(
    `SELECT id, unique_company_id, company_name, admin_email, admin_name, password_hash,
            phone, address, website, industry, company_size, email_verified, is_active,
            TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
            TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
     FROM companies WHERE admin_email = $1`,
    [admin_email]
  );
  return rows[0];
};

const getCompanyById = async (id) => {
  try {
    const { rows } = await pool.query(
      `SELECT
          c.id, c.unique_company_id, c.company_name, c.admin_email, c.admin_name,
          c.phone, c.address, c.website, c.industry, c.company_size, c.password_hash,
          c.email_verified, c.is_active, c.subscription_package_id, c.subscription_start_date, c.subscription_end_date,
          sp.name AS package_name, sp.max_staff_count, sp.max_leads_per_month, sp.features, sp.is_trial,
          TO_CHAR(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
          TO_CHAR(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
       FROM companies c
       LEFT JOIN subscription_packages sp ON c.subscription_package_id = sp.id
       WHERE c.id = $1`,
      [id]
    );

    const company = rows.length ? rows[0] : null;

    // Parse features field if it's a string (as returned by pg when JSON/JSONB is selected)
    if (company && company.features && typeof company.features === 'string') {
        try {
            company.features = JSON.parse(company.features);
        } catch (e) {
            company.features = [];
        }
    }

    return company;
  } catch (error) {
    throw new Error("Database error while fetching company");
  }
};

const assignTrialSubscription = async (companyId, packageId, endDate) => {
  const query = `
    UPDATE companies
    SET
        subscription_package_id = $2,
        subscription_start_date = CURRENT_TIMESTAMP,
        subscription_end_date = $3,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, is_active, subscription_package_id, subscription_end_date;
  `;

  const { rows } = await pool.query(query, [
    companyId,
    packageId,
    endDate
  ]);

  return rows[0];
};


const updateCompanyPassword = async (admin_email, password) => {
  const hashedPassword = await bcrypt.hash(password, 12);
  const query = `
    UPDATE companies
    SET password_hash = $1,
        email_verified = TRUE,
        updated_at = CURRENT_TIMESTAMP
    WHERE admin_email = $2
    RETURNING id, unique_company_id, company_name, admin_email, admin_name, email_verified, is_active,
    TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
    TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at;
  `;
  const { rows } = await pool.query(query, [hashedPassword, admin_email]);
  return rows[0];
};

const updateCompanyVerification = async (admin_email, email_verified) => {
  const query = `
    UPDATE companies
    SET email_verified = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE admin_email = $2
    RETURNING id, unique_company_id, company_name, admin_email, admin_name, email_verified, is_active,
    TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
    TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at;
  `;
  const { rows } = await pool.query(query, [email_verified, admin_email]);
  return rows[0];
};

const verifyPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

const createOTP = async ({ email, otp, otp_type = 'signup', expires_at }) => {
  const query = `
    INSERT INTO otp_verifications (email, otp, otp_type, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [email, otp, otp_type, expires_at]);
  return rows[0];
};

const getValidOTP = async (email, otp) => {
  const query = `
    SELECT * FROM otp_verifications
    WHERE email = $1
      AND otp = $2
      AND otp_type = 'signup'
      AND expires_at > NOW()
      AND is_used = FALSE
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [email, otp]);
  return rows[0];
};

const markOTPAsUsed = async (id) => {
  const query = 'UPDATE otp_verifications SET is_used = TRUE, used_at = NOW() WHERE id = $1';
  await pool.query(query, [id]);
};

const cleanExpiredOTPs = async () => {
  const query = 'DELETE FROM otp_verifications WHERE expires_at < NOW()';
  await pool.query(query);
};

const createResetOTP = async ({ email, otp, expires_at }) => {
  const query = `
    INSERT INTO otp_verifications (email, otp, otp_type, expires_at)
    VALUES ($1, $2, 'reset', $3)
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [email, otp, expires_at]);
  return rows[0];
};

const getValidResetOTP = async (email, otp) => {
  const query = `
    SELECT * FROM otp_verifications
    WHERE email = $1
      AND otp = $2
      AND otp_type = 'reset'
      AND expires_at > NOW()
      AND is_used = FALSE
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [email, otp]);
  return rows[0];
};

const invalidateSession = async (companyId) => {
  return true;
};

module.exports = {
  createCompany,
  getCompanyByEmail,
  updateCompanyProfile,
  getCompanyById,
  updateCompanyPassword,
  updateCompanyVerification,
  verifyPassword,
  createOTP,
  getValidOTP,
  markOTPAsUsed,
  cleanExpiredOTPs,
  createResetOTP,
  getValidResetOTP,
  invalidateSession,
  assignTrialSubscription
};