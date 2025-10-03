const pool = require('../../config/database');

const getAllCompanies = async (limit = 10, offset = 0, search = '', status = '') => {
  try {
    let query = `
      SELECT
        c.id, c.unique_company_id, c.company_name, c.admin_email, c.admin_name,
        c.phone, c.address, c.website, c.industry, c.company_size,
        c.subscription_start_date, c.subscription_end_date, c.is_active,
        c.email_verified, c.created_at, c.updated_at,
        sp.name as package_name, sp.price as package_price, sp.duration_type,
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

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    return result.rows;
  } catch (error) {
    throw error;
  }
};

const getCompanyById = async (id) => {
  try {
    const query = `
      SELECT
        c.*,
        sp.name as package_name,
        sp.price as package_price,
        sp.duration_type,
        sp.max_staff_count,
        sp.max_leads_per_month,
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
        COALESCE((SELECT COUNT(*) FROM leads WHERE company_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'), 0)::integer as leads_this_month,
        COALESCE((SELECT COUNT(*) FROM lead_activities WHERE lead_id IN (SELECT id FROM leads WHERE company_id = $1)), 0)::integer as total_activities
    `;
    const result = await pool.query(query, [parseInt(id)]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const getDashboardStats = async () => {
  try {
    const query = `
      SELECT
        COUNT(*)::integer as total_companies,
        COUNT(*) FILTER (WHERE is_active = true)::integer as active_companies,
        COUNT(*) FILTER (WHERE is_active = false)::integer as inactive_companies,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')::integer as new_companies_this_month
      FROM companies
    `;
    const result = await pool.query(query);
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
        COUNT(DISTINCT s.id)::integer as staff_count,
        COUNT(DISTINCT l.id)::integer as leads_count,
        COUNT(DISTINCT la.id)::integer as activities_count
      FROM companies c
      LEFT JOIN subscription_packages sp ON c.subscription_package_id = sp.id
      LEFT JOIN staff s ON c.id = s.company_id
      LEFT JOIN leads l ON c.id = l.company_id AND l.created_at BETWEEN $1 AND $2
      LEFT JOIN lead_activities la ON l.id = la.lead_id AND la.created_at BETWEEN $1 AND $2
      GROUP BY c.id, c.company_name, c.unique_company_id, sp.name
      ORDER BY leads_count DESC
    `;
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getAllCompanies,
  getCompanyById,
  activateCompany,
  deactivateCompany,
  updateCompanySubscription,
  deleteCompany,
  getCompanyStats,
  getDashboardStats,
  getCompanyUsageReport
};