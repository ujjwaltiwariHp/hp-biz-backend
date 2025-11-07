const pool = require('../../config/database');

const getSettings = async () => {
  // MODIFICATION: Explicitly reference the table by its schema and name
  const result = await pool.query(`
    SELECT
      id,
      company_name,
      address,
      email,
      phone,
      tax_rate,
      currency,
      bank_details::text as bank_details, /* Explicitly cast to text for safe parsing */
      qr_code_image_url,
      updated_at
    FROM public.super_admin_billing_settings
    WHERE id = 1
  `);

  const settings = result.rows[0];

  if (settings && settings.bank_details && typeof settings.bank_details === 'string') {
      try {
          // Manually parse the JSON text back into a JavaScript object
          settings.bank_details = JSON.parse(settings.bank_details);
      } catch (e) {
          settings.bank_details = null;
      }
  }

  return settings;
};

const updateSettings = async (data) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = [
    'company_name',
    'address',
    'email',
    'phone',
    'tax_rate',
    'currency',
    'bank_details',
    'qr_code_image_url'
  ];

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      if (key === 'bank_details') {
        values.push(JSON.stringify(data[key]));
      } else {
        values.push(data[key]);
      }
      paramIndex++;
    }
  }

  if (fields.length === 0) {
    return getSettings();
  }

  // MODIFICATION: Explicitly reference the table by its schema and name
  const query = `
    UPDATE public.super_admin_billing_settings
    SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return getSettings(); // Fetch updated and parsed settings
};

module.exports = {
  getSettings,
  updateSettings
};