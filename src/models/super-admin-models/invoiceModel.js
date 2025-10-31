const pool = require('../../config/database');

const generateUniqueInvoiceNumber = async () => {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = `INV-${year}-`;

  const query = `
    SELECT invoice_number
    FROM invoices
    WHERE invoice_number LIKE $1
    ORDER BY invoice_number DESC
    LIMIT 1
  `;
  const result = await pool.query(query, [`${prefix}%`]);

  let nextSequence = 1;
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].invoice_number.split('-').pop();
    nextSequence = parseInt(lastNumber) + 1;
  }

  return `${prefix}${String(nextSequence).padStart(5, '0')}`;
};

const createInvoice = async (invoiceData) => {
  try {
    const {
      company_id,
      subscription_package_id,
      amount,
      tax_amount = 0,
      total_amount,
      currency = 'USD',
      billing_period_start,
      billing_period_end,
      due_date,

      payment_method = null,
      payment_reference = null,
      payment_notes = null
    } = invoiceData;

    const invoice_number = await generateUniqueInvoiceNumber();

    const query = `
      INSERT INTO invoices (
        company_id, subscription_package_id, invoice_number, amount, tax_amount,
        total_amount, currency, billing_period_start, billing_period_end, due_date, status,
        payment_method, payment_reference, payment_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12, $13)
      RETURNING *
    `;

    const params = [
      company_id,
      subscription_package_id,
      invoice_number,
      amount,
      tax_amount,
      total_amount,
      currency,
      billing_period_start,
      billing_period_end,
      due_date,
      payment_method,
      payment_reference,
      payment_notes
    ];

    const result = await pool.query(query, params);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const getAllInvoicesData = async (limit = 10, offset = 0, filters = {}) => {
  try {
    let query = `
      SELECT
        i.id, i.invoice_number, i.company_id, i.total_amount, i.due_date,
        i.status, i.created_at,
        c.company_name, c.unique_company_id,
        sp.name as package_name,
        COUNT(*) OVER() as total_count
      FROM invoices i
      JOIN companies c ON i.company_id = c.id
      JOIN subscription_packages sp ON i.subscription_package_id = sp.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (filters.company_id) {
      query += ` AND i.company_id = $${paramIndex}`;
      params.push(filters.company_id);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND i.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND i.created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND i.created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    throw error;
  }
};

const getInvoiceById = async (id) => {
  try {
    const query = `
      SELECT
        i.*,
        c.company_name, c.admin_email as billing_email, c.address as billing_address,
        sp.name as package_name
      FROM invoices i
      JOIN companies c ON i.company_id = c.id
      JOIN subscription_packages sp ON i.subscription_package_id = sp.id
      WHERE i.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const updateInvoice = async (id, updateData) => {
  try {
    const fields = [];
    const params = [id];
    let paramIndex = 2;

    // Dynamically build the update query for all fields, including new manual columns
    for (const key in updateData) {
      fields.push(`${key} = $${paramIndex}`);
      params.push(updateData[key]);
      paramIndex++;
    }

    if (fields.length === 0) {
      return getInvoiceById(id);
    }

    const query = `
      UPDATE invoices
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, params);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const deleteInvoice = async (id) => {
  try {
    const query = `DELETE FROM invoices WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const getUnpaidPaymentsByCompanyId = async (companyId) => {
  try {
    const query = `
      SELECT id, amount, payment_date
      FROM payments
      WHERE company_id = $1 AND invoice_id IS NULL AND status = 'completed'
      ORDER BY payment_date ASC
    `;
    const result = await pool.query(query, [companyId]);
    return result.rows;
  } catch (error) {
    throw error;
  }
};

const linkPaymentToInvoice = async (paymentId, invoiceId) => {
  try {
    const query = `
      UPDATE payments
      SET invoice_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    await pool.query(query, [paymentId, invoiceId]);
  } catch (error) {
    throw error;
  }
};

const getPaymentById = async (paymentId) => {
  try {
    const query = `
      SELECT id, company_id, amount, status
      FROM payments
      WHERE id = $1 AND status = 'completed'
    `;
    const result = await pool.query(query, [paymentId]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createInvoice,
  getAllInvoicesData,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getUnpaidPaymentsByCompanyId,
  linkPaymentToInvoice,
  getPaymentById
};
