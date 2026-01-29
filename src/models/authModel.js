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
    'website', 'industry', 'company_size', 'profile_picture'
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
             profile_picture,
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
            profile_picture,
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
          c.email_verified, c.is_active, c.subscription_package_id, c.subscription_start_date, c.subscription_end_date, c.subscription_status,
          c.profile_picture,
          sp.name AS package_name, sp.max_staff_count, sp.max_leads_per_month, sp.features, sp.is_trial, sp.max_custom_fields,
          TO_CHAR(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
          TO_CHAR(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
       FROM companies c
       LEFT JOIN subscription_packages sp ON c.subscription_package_id = sp.id
       WHERE c.id = $1`,
      [id]
    );

    const company = rows.length ? rows[0] : null;

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

const getCompanyByApiKey = async (apiKey) => {
  try {
    const { rows } = await pool.query(
      `SELECT
          c.id, c.unique_company_id, c.company_name, c.admin_email, c.admin_name,
          c.is_active, c.subscription_package_id, c.subscription_start_date, c.subscription_end_date,
          c.subscription_status,
          sp.name AS package_name, sp.max_staff_count, sp.max_leads_per_month, sp.features,
          ls.id as source_id, ls.source_name
       FROM lead_sources ls
       JOIN companies c ON ls.company_id = c.id
       LEFT JOIN subscription_packages sp ON c.subscription_package_id = sp.id
       WHERE ls.api_key = $1 AND ls.is_active = TRUE AND c.is_active = TRUE`,
      [apiKey]
    );

    const company = rows.length ? rows[0] : null;

    if (company && company.features && typeof company.features === 'string') {
        try {
            company.features = JSON.parse(company.features);
        } catch (e) {
            company.features = [];
        }
    }

    return company;
  } catch (error) {
    throw new Error("Database error while verifying API key");
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

const getCompanySubscriptionStatus = async (companyId) => {
  try {
    const { rows } = await pool.query(
      `SELECT
        c.id,
        c.company_name,
        c.admin_email,
        c.subscription_status,
        c.subscription_package_id,
        c.is_active,
        c.subscription_end_date,
        sp.name as package_name,
        i.invoice_number,
        i.status as invoice_status,
        i.total_amount,
        i.currency,
        TO_CHAR(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
        TO_CHAR(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
      FROM companies c
      LEFT JOIN subscription_packages sp ON c.subscription_package_id = sp.id
      LEFT JOIN invoices i ON i.company_id = c.id
        AND i.subscription_package_id = c.subscription_package_id
      WHERE c.id = $1
      ORDER BY i.created_at DESC
      LIMIT 1`,
      [companyId]
    );

    return rows[0] || null;
  } catch (error) {
    throw error;
  }
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

// --- UPDATED OTP FUNCTIONS FOR COMPOSITE KEY SUPPORT ---

const upsertTempSignup = async ({ email, otp, expires_at, company_id, user_type = 'company' }) => {
  // CRITICAL FIX: Default company_id to 0 if null/undefined to satisfy NOT NULL PK
  const safeCompanyId = company_id || 0;

  const query = `
    INSERT INTO temp_signups (
      email, otp, otp_expires_at, company_id, user_type, attempt_count, last_attempt_at
    )
    VALUES ($1, $2, $3, $4, $5, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (email, company_id, user_type)
    DO UPDATE SET
      otp = $2,
      otp_expires_at = $3,
      is_verified = FALSE,
      attempt_count = temp_signups.attempt_count + 1,
      last_attempt_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const { rows } = await pool.query(query, [email, otp, expires_at, safeCompanyId, user_type]);
  return rows[0];
};

const getTempSignup = async (email, company_id = null, user_type = 'company') => {
  // CRITICAL FIX: Default to 0 for retrieval too
  const safeCompanyId = company_id || 0;

  let query = 'SELECT * FROM temp_signups WHERE email = $1 AND user_type = $2 AND company_id = $3';
  const params = [email, user_type, safeCompanyId];

  const { rows } = await pool.query(query, params);
  return rows[0];
};

const markTempSignupVerified = async (email, company_id = null, user_type = 'company') => {
  const safeCompanyId = company_id || 0;

  let query = 'UPDATE temp_signups SET is_verified = TRUE WHERE email = $1 AND user_type = $2 AND company_id = $3';
  const params = [email, user_type, safeCompanyId];

  await pool.query(query, params);
};

const deleteTempSignup = async (email, company_id = null, user_type = 'company') => {
  const safeCompanyId = company_id || 0;

  let query = 'DELETE FROM temp_signups WHERE email = $1 AND user_type = $2 AND company_id = $3';
  const params = [email, user_type, safeCompanyId];

  await pool.query(query, params);
};

// --- SESSION MANAGEMENT ---

const createCompanySession = async (companyId, refreshToken, ip, userAgent, location) => {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO company_sessions (company_id, refresh_token, ip_address, user_agent, expires_at, login_location)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [companyId, refreshToken, ip, userAgent, expiresAt, location ? JSON.stringify(location) : null]
  );
};

const findCompanySession = async (refreshToken) => {
  const { rows } = await pool.query(
    'SELECT * FROM company_sessions WHERE refresh_token = $1 AND expires_at > NOW()',
    [refreshToken]
  );
  return rows[0];
};

const deleteCompanySession = async (refreshToken) => {
  await pool.query('DELETE FROM company_sessions WHERE refresh_token = $1', [refreshToken]);
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
  assignTrialSubscription,
  getCompanySubscriptionStatus,
  upsertTempSignup,
  getTempSignup,
  markTempSignupVerified,
  deleteTempSignup,
  createCompanySession,
  findCompanySession,
  deleteCompanySession,
  getCompanyByApiKey
};