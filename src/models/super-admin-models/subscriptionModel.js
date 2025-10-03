const pool = require('../../config/database');

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
    return result.rows;
  } catch (error) {
    throw error;
  }
};

const getPackageById = async (id) => {
  try {
    const query = `
      SELECT
        sp.*,
        COUNT(c.id) as company_count
      FROM subscription_packages sp
      LEFT JOIN companies c ON sp.id = c.subscription_package_id
      WHERE sp.id = $1
      GROUP BY sp.id
    `;
    const result = await pool.query(query, [parseInt(id)]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const createPackage = async (packageData) => {
  try {
    const { name, duration_type, price, features, max_staff_count, max_leads_per_month } = packageData;

    const query = `
      INSERT INTO subscription_packages (
        name, duration_type, price, features, max_staff_count, max_leads_per_month
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      name,
      duration_type,
      parseFloat(price),
      JSON.stringify(features),
      parseInt(max_staff_count),
      parseInt(max_leads_per_month)
    ]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const updatePackage = async (id, packageData) => {
  try {
    const { name, duration_type, price, features, max_staff_count, max_leads_per_month } = packageData;

    const query = `
      UPDATE subscription_packages
      SET
        name = $2,
        duration_type = $3,
        price = $4,
        features = $5,
        max_staff_count = $6,
        max_leads_per_month = $7
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [
      parseInt(id),
      name,
      duration_type,
      parseFloat(price),
      JSON.stringify(features),
      parseInt(max_staff_count),
      parseInt(max_leads_per_month)
    ]);

    return result.rows[0];
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
    return result.rows[0];
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
    return result.rows;
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
  getActivePackages
};