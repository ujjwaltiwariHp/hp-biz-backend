const pool = require('../config/database');

const checkEmailIdentity = async (email) => {
  try {
    const query = `
      SELECT
        user_type,
        user_id,
        company_id,
        label,
        email,
        status,
        password_status
      FROM view_auth_identities
      WHERE LOWER(email) = LOWER($1)
    `;

    const result = await pool.query(query, [email.trim()]);
    return result.rows;
  } catch (error) {
    console.error('Error discovering email identity:', error);
    throw new Error('Database error during identity check.');
  }
};

module.exports = { checkEmailIdentity };