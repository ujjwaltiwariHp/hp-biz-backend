const pool = require('../../config/database');

const jsonParse = (item) => {
    if (item && item.features && typeof item.features === 'string') {
        try {
            item.features = JSON.parse(item.features);
        } catch (e) {
            item.features = [];
        }
    }
    return item;
};

const getAllPackages = async () => {
  try {
    const query = `
      SELECT
        sp.*,
        COUNT(c.id) as company_count
      FROM subscription_packages sp
      LEFT JOIN companies c ON sp.id = c.subscription_package_id
      GROUP BY sp.id
      ORDER BY sp.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows.map(jsonParse);
  } catch (error) {
    throw error;
  }
};

const getPackageById = async (id) => {
  try {
    const packageId = parseInt(id);

    if (isNaN(packageId) || packageId <= 0) {
        return null;
    }

    const query = `
      SELECT
        sp.*,
        COUNT(c.id) as company_count
      FROM subscription_packages sp
      LEFT JOIN companies c ON sp.id = c.subscription_package_id
      WHERE sp.id = $1
      GROUP BY sp.id
    `;
    const result = await pool.query(query, [packageId]);
    return jsonParse(result.rows[0]);
  } catch (error) {
    throw error;
  }
};

const getTrialPackage = async () => {
  try {
    const query = `
      SELECT id, name, max_staff_count, max_leads_per_month, features::text, trial_duration_days
      FROM subscription_packages
      WHERE is_trial = TRUE AND is_active = TRUE
      LIMIT 1
    `;
    const result = await pool.query(query);
    return jsonParse(result.rows[0]);
  } catch (error) {
    throw error;
  }
};

const countActiveCompaniesByPackage = async (packageId) => {
  try {
    const query = `
      SELECT COUNT(id)::integer AS active_company_count
      FROM companies
      WHERE subscription_package_id = $1 AND is_active = TRUE
    `;
    const result = await pool.query(query, [packageId]);
    return parseInt(result.rows[0].active_company_count, 10);
  } catch (error) {
    throw error;
  }
};

const createPackage = async (packageData) => {
  try {
    const { name, duration_type, price, features, max_staff_count, max_leads_per_month, is_trial, trial_duration_days, is_active, max_custom_fields } = packageData;

    const query = `
      INSERT INTO subscription_packages (
        name, duration_type, price, features, max_staff_count, max_leads_per_month, is_trial, trial_duration_days, is_active, max_custom_fields
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await pool.query(query, [
      name,
      duration_type,
      parseFloat(price),
      JSON.stringify(features || []),
      parseInt(max_staff_count),
      parseInt(max_leads_per_month),
      is_trial || false,
      is_trial ? parseInt(trial_duration_days) : 0,
      is_active !== undefined ? is_active : true,
      parseInt(max_custom_fields)
    ]);

    return jsonParse(result.rows[0]);
  } catch (error) {
    throw error;
  }
};

const updatePackage = async (id, packageData) => {
  try {
    const fields = [];
    const values = [parseInt(id)];
    let paramIndex = 2;

    const allowedFields = [
        'name', 'duration_type', 'price', 'max_staff_count',
        'max_leads_per_month', 'is_trial', 'trial_duration_days', 'is_active', 'features',
        'max_custom_fields'
    ];

    allowedFields.forEach(key => {
        if (packageData[key] !== undefined) {
            fields.push(`${key} = $${paramIndex}`);

            if (key === 'features') {
                 values.push(JSON.stringify(packageData[key]));
            } else if (key === 'max_staff_count' || key === 'max_leads_per_month' || key === 'trial_duration_days' || key === 'max_custom_fields') {
                 values.push(parseInt(packageData[key]));
            } else {
                 values.push(packageData[key]);
            }
            paramIndex++;
        }
    });

    if (fields.length === 0) {
      return getPackageById(id);
    }

    const query = `
      UPDATE subscription_packages
      SET
        ${fields.join(', ')},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, values);

    return jsonParse(result.rows[0]);
  } catch (error) {
    throw error;
  }
};

const deletePackage = async (id) => {
  try {
    const query = `DELETE FROM subscription_packages WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [parseInt(id)]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const togglePackageStatus = async (id) => {
  try {
    const query = `
      UPDATE subscription_packages
      SET is_active = NOT is_active
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [parseInt(id)]);
    return jsonParse(result.rows[0]);
  } catch (error) {
    throw error;
  }
};

const checkPackageExists = async (name, excludeId = null) => {
  try {
    let query = `SELECT id FROM subscription_packages WHERE LOWER(name) = LOWER($1)`;
    const params = [name];

    if (excludeId) {
      query += ` AND id != $2`;
      params.push(parseInt(excludeId));
    }

    const result = await pool.query(query, params);
    return result.rows.length > 0;
  } catch (error) {
    throw error;
  }
};

const getActivePackages = async () => {
  try {
    const query = `
      SELECT *
      FROM subscription_packages
      WHERE is_active = true
      ORDER BY price ASC
    `;
    const result = await pool.query(query);
    return result.rows.map(jsonParse);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  togglePackageStatus,
  checkPackageExists,
  getActivePackages,
  getTrialPackage,
  countActiveCompaniesByPackage
};