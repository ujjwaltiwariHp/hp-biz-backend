const pool = require("../config/database");

const checkFieldLimit = async (companyId) => {
  const limitResult = await pool.query(
    `SELECT COALESCE(sp.max_custom_fields, 0) as max_fields
     FROM companies c
     LEFT JOIN subscription_packages sp ON c.subscription_package_id = sp.id
     WHERE c.id = $1`,
    [companyId]
  );

  const maxFields = limitResult.rows[0]?.max_fields || 0;

  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM lead_field_definitions
     WHERE company_id = $1 AND is_active = true`,
    [companyId]
  );

  const currentCount = parseInt(countResult.rows[0].count);

  return {
    currentCount,
    maxFields,
    hasReachedLimit: currentCount >= maxFields
  };
};

const createFieldDefinition = async (companyId, data) => {
  const {
    field_key,
    field_label,
    field_type,
    options,
    is_required,
    sort_order
  } = data;

  const { hasReachedLimit, maxFields, currentCount } = await checkFieldLimit(companyId);

  if (hasReachedLimit) {
    throw new Error(`Limit reached. Your plan allows ${maxFields} custom fields. You currently have ${currentCount}.`);
  }

  // Ensure field_key is safe (lowercase, no spaces) if not provided properly
  const safeKey = field_key
    ? field_key.toLowerCase().trim().replace(/\s+/g, '_')
    : field_label.toLowerCase().trim().replace(/\s+/g, '_');

  const result = await pool.query(
    `INSERT INTO lead_field_definitions
     (company_id, field_key, field_label, field_type, options, is_required, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      companyId,
      safeKey,
      field_label,
      field_type,
      JSON.stringify(options || []),
      is_required || false,
      sort_order || 0
    ]
  );

  return result.rows[0];
};

const getCompanyFieldDefinitions = async (companyId) => {
  const result = await pool.query(
    `SELECT id, field_key, field_label, field_type, options, is_required, sort_order
     FROM lead_field_definitions
     WHERE company_id = $1 AND is_active = true
     ORDER BY sort_order ASC, created_at ASC`,
    [companyId]
  );

  // Parse the options JSON back to an array for the frontend
  return result.rows.map(row => ({
    ...row,
    options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options
  }));
};

const updateFieldDefinition = async (id, companyId, data) => {
  const allowedFields = ['field_label', 'field_type', 'options', 'is_required', 'sort_order', 'is_active'];
  const values = [];
  const updates = [];
  let paramCount = 1;

  Object.keys(data).forEach(key => {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = $${paramCount}`);

      if (key === 'options') {
        values.push(JSON.stringify(data[key]));
      } else {
        values.push(data[key]);
      }
      paramCount++;
    }
  });

  if (updates.length === 0) return null;

  values.push(id, companyId);

  const query = `
    UPDATE lead_field_definitions
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramCount} AND company_id = $${paramCount + 1}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
};

const deleteFieldDefinition = async (id, companyId) => {
  const result = await pool.query(
    `UPDATE lead_field_definitions
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND company_id = $2
     RETURNING id`,
    [id, companyId]
  );

  return result.rows.length > 0;
};

module.exports = {
  createFieldDefinition,
  getCompanyFieldDefinitions,
  updateFieldDefinition,
  deleteFieldDefinition
};