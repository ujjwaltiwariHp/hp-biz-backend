const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const generateUniqueId = () => {
  return 'COMP_' + uuidv4().substring(0, 8).toUpperCase();
};

const getAllCompanies = async (limit = 10, offset = 0, search = '', status = '', startDate = null, endDate = null) => {
  try {
    let query = `
      SELECT
        c.id, c.unique_company_id, c.company_name, c.admin_email, c.admin_name,
        c.phone, c.address, c.website, c.industry, c.company_size,
        c.subscription_start_date, c.subscription_end_date, c.is_active, c.subscription_status,
        c.email_verified, c.created_at, c.updated_at,
        sp.name as package_name,
        sp.price_monthly as package_price,
        sp.currency as package_currency,
        COUNT(*) OVER() as total_count
      FROM companies c
      LEFT JOIN subscription_packages sp ON c.subscription_package_id = sp.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (search && search.trim() !== '') {
      query += ` AND (c.company_name ILIKE $${paramIndex} OR c.admin_email ILIKE $${paramIndex} OR c.unique_company_id ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (status && status.trim() !== '') {
      if (status === 'active') {
        query += ` AND c.is_active = true`;
      } else if (status === 'inactive') {
        query += ` AND c.is_active = false`;
      }
    }
    if (startDate) {
      query += ` AND c.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND c.created_at <= $${paramIndex}`;
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      params.push(endDateTime.toISOString());
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    return result.rows;
  } catch (error) {
    throw error;
  }
};

// src/models/super-admin-models/companyModel.js

const getCompanyById = async (id) => {
  try {
    const query = `
      SELECT
        c.*,
        sp.name as package_name,
        sp.price_monthly as package_price,
        sp.currency as package_currency,
        sp.max_staff_count,
        sp.max_leads_per_month,
        sp.features,
        sp.is_trial,
        sp.max_custom_fields,
        (SELECT COUNT(*) FROM staff s WHERE s.company_id = c.id) as staff_count,
        (SELECT COUNT(*) FROM leads l WHERE l.company_id = c.id) as leads_count
      FROM companies c
      LEFT JOIN subscription_packages sp ON c.subscription_package_id = sp.id
      WHERE c.id = $1
    `;

    const result = await pool.query(query, [parseInt(id)]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const activateCompany = async (id) => {
  try {
    const query = `
      UPDATE companies
      SET is_active = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [parseInt(id)]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const deactivateCompany = async (id) => {
  try {
    const query = `
      UPDATE companies
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [parseInt(id)]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const updateCompanySubscription = async (id, subscriptionData) => {
  try {
    const { subscription_package_id, subscription_start_date, subscription_end_date } = subscriptionData;

    const query = `
      UPDATE companies
      SET
        subscription_package_id = $2,
        subscription_start_date = $3,
        subscription_end_date = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [
      parseInt(id),
      parseInt(subscription_package_id),
      subscription_start_date,
      subscription_end_date
    ]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const updateSubscriptionStatusManual = async (companyId, adminId, action, subscriptionData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      subscription_package_id,
      subscription_start_date,
      subscription_end_date
    } = subscriptionData;

    let newStatus = '';
    let isActive = false;
    let queryFields = [];
    const queryValues = [companyId];
    let paramCount = 2;

    if (action === 'approve') {
      if (!subscription_package_id || !subscription_start_date || !subscription_end_date) {
        throw new Error('Missing package ID, start date, or end date for approval');
      }
      newStatus = 'approved';
      isActive = true;

      queryFields.push(`subscription_status = $${paramCount++}`);
      queryValues.push(newStatus);

      queryFields.push(`is_active = $${paramCount++}`);
      queryValues.push(isActive);

      queryFields.push(`subscription_package_id = $${paramCount++}`);
      queryValues.push(parseInt(subscription_package_id));

      queryFields.push(`subscription_start_date = $${paramCount++}`);
      queryValues.push(subscription_start_date);

      queryFields.push(`subscription_end_date = $${paramCount++}`);
      queryValues.push(subscription_end_date);
    } else if (action === 'reject') {
      newStatus = 'rejected';
      isActive = false;

      queryFields.push(`subscription_status = $${paramCount++}`);
      queryValues.push(newStatus);

      queryFields.push(`is_active = $${paramCount++}`);
      queryValues.push(isActive);

      queryFields.push(`subscription_start_date = NULL`);
      queryFields.push(`subscription_end_date = NULL`);

    } else if (action === 'payment_received') {
        newStatus = 'payment_received';
        queryFields.push(`subscription_status = $${paramCount++}`);
        queryValues.push(newStatus);
    } else if (action === 'pending') {
        newStatus = 'pending';

        if (!subscription_package_id || !subscription_start_date || !subscription_end_date) {
             throw new Error('Missing package ID or dates for pending status update.');
        }

        queryFields.push(`subscription_status = $${paramCount++}`);
        queryValues.push(newStatus);

        queryFields.push(`subscription_package_id = $${paramCount++}`);
        queryValues.push(parseInt(subscription_package_id));

        queryFields.push(`subscription_start_date = $${paramCount++}`);
        queryValues.push(subscription_start_date);

        queryFields.push(`subscription_end_date = $${paramCount++}`);
        queryValues.push(subscription_end_date);

    } else {
      throw new Error(`Invalid action: ${action}`);
    }

    const updateCompanyQuery = `
      UPDATE companies
      SET
        ${queryFields.join(', ')},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const updatedCompany = await client.query(updateCompanyQuery, queryValues);

    if (updatedCompany.rows.length === 0) {
      throw new Error('Company not found');
    }

    await client.query('COMMIT');

    return updatedCompany.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const deleteCompany = async (id) => {
  try {
    const query = `DELETE FROM companies WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [parseInt(id)]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const getCompanyStats = async (id) => {
  try {
    const query = `
      SELECT
        COALESCE((SELECT COUNT(*) FROM staff WHERE company_id = $1), 0)::integer as total_staff,
        COALESCE((SELECT COUNT(*) FROM leads WHERE company_id = $1), 0)::integer as total_leads,
        COALESCE((SELECT COUNT(*) FROM leads WHERE company_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)), 0)::integer as leads_this_month,
        COALESCE((SELECT COUNT(*) FROM lead_activities WHERE lead_id IN (SELECT id FROM leads WHERE company_id = $1)), 0)::integer as total_activities
    `;
    const result = await pool.query(query, [parseInt(id)]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const getDashboardStats = async (startDate, endDate) => {
  try {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const query = `
      SELECT
        COUNT(*)::integer as total_companies,
        COUNT(*) FILTER (WHERE is_active = true)::integer as active_companies,
        COUNT(*) FILTER (WHERE is_active = false)::integer as inactive_companies,
        -- Dynamic count based on date range
        COUNT(*) FILTER (WHERE created_at >= $1 AND created_at <= $2)::integer as new_companies_period
      FROM companies
    `;

    const result = await pool.query(query, [start, end]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const getCompanyUsageReport = async (startDate, endDate) => {
  try {
    const query = `
      SELECT
        c.id, c.company_name, c.unique_company_id,
        sp.name as package_name,

        -- 1. Staff Count (Total active staff, independent of date range)
        COALESCE(
          (SELECT COUNT(s.id)::integer FROM staff s
           WHERE s.company_id = c.id AND s.status = 'active'),
        0) as staff_count,

        -- 2. Leads Created in Period
        COALESCE(
          (SELECT COUNT(l.id)::integer FROM leads l
           WHERE l.company_id = c.id AND l.created_at BETWEEN $1 AND $2),
        0) as leads_count,

        -- 3. Activities Logged in Period
        COALESCE(
          (SELECT COUNT(la.id)::integer FROM lead_activities la
           WHERE la.created_at BETWEEN $1 AND $2
           AND la.lead_id IN (SELECT id FROM leads WHERE company_id = c.id)),
        0) as activities_count

      FROM companies c
      LEFT JOIN subscription_packages sp ON c.subscription_package_id = sp.id
      ORDER BY leads_count DESC, activities_count DESC
    `;
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  } catch (error) {
    throw error;
  }
};

const createCompanyBySuperAdmin = async (data) => {
    const {
        company_name,
        admin_email,
        admin_name,
        password,
        subscription_package_id,
        subscription_start_date,
        subscription_end_date,
        is_active = true
    } = data;

    let unique_company_id = generateUniqueId();
    let isUnique = false;

    // Ensure unique_company_id is unique
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

    const hashedPassword = await bcrypt.hash(password, 12);

    const query = `
        INSERT INTO companies (
            unique_company_id, company_name, admin_email, password_hash, admin_name,
            phone, address, industry, company_size, subscription_package_id,
            subscription_start_date, subscription_end_date, is_active, email_verified
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)
        RETURNING id, unique_company_id, company_name, admin_email, admin_name,
                  TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at
    `;

    const values = [
        unique_company_id, company_name, admin_email, hashedPassword, admin_name,
        data.phone || null, data.address || null, data.industry || null, data.company_size || null,
        subscription_package_id, subscription_start_date, subscription_end_date, is_active
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
};

module.exports = {
  getAllCompanies,
  getCompanyById,
  activateCompany,
  deactivateCompany,
  updateCompanySubscription,
  updateSubscriptionStatusManual,
  deleteCompany,
  getCompanyStats,
  getDashboardStats,
  getCompanyUsageReport,
  createCompanyBySuperAdmin
};