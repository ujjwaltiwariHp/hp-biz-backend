const pool = require('../../config/database');

const createPayment = async (paymentData) => {
  const {
    company_id,
    invoice_id,
    amount,
    payment_method,
    transaction_id,
    payment_date,
    status
  } = paymentData;

  try {
    const query = `
      INSERT INTO payments
        (company_id, invoice_id, amount, payment_method, transaction_id, payment_date, status)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await pool.query(query, [
      company_id,
      invoice_id || null,
      amount,
      payment_method,
      transaction_id || null,
      payment_date,
      status
    ]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const getPayments = async (limit = 10, offset = 0, companyId, status, startDate, endDate) => {
  try {
    let query = `
      SELECT
        p.id, p.company_id, p.invoice_id, p.amount, p.payment_method, p.transaction_id,
        p.payment_date, p.status, p.created_at,
        c.company_name, c.unique_company_id,
        COUNT(*) OVER() as total_count
      FROM payments p
      JOIN companies c ON p.company_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (companyId) {
      query += ` AND p.company_id = $${paramIndex}`;
      params.push(parseInt(companyId));
      paramIndex++;
    }

    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (startDate && endDate) {
      query += ` AND p.payment_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(startDate, endDate);
      paramIndex += 2;
    }

    query += ` ORDER BY p.payment_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    return result.rows;
  } catch (error) {
    throw error;
  }
};

const getPaymentById = async (id) => {
  try {
    const query = `
      SELECT
        p.*,
        c.company_name, c.unique_company_id
      FROM payments p
      JOIN companies c ON p.company_id = c.id
      WHERE p.id = $1
    `;

    const result = await pool.query(query, [parseInt(id)]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const updatePaymentStatus = async (id, status) => {
  try {
    const query = `
      UPDATE payments
      SET status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [parseInt(id), status]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const deletePayment = async (id) => {
  try {
    const query = `DELETE FROM payments WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [parseInt(id)]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createPayment,
  getPayments,
  getPaymentById,
  updatePaymentStatus,
  deletePayment
};
