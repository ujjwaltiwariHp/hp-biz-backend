const pool = require("../config/database");

const getDistributionSettings = async (companyId) => {
  const result = await pool.query(
    `SELECT * FROM lead_distribution_settings WHERE company_id = $1`,
    [companyId]
  );
  return result.rows[0];
};

const createDistributionSettings = async (companyId, data) => {
  const { distribution_type, settings, is_active = false } = data;

  const result = await pool.query(
    `INSERT INTO lead_distribution_settings (company_id, distribution_type, is_active, settings)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [companyId, distribution_type, is_active, JSON.stringify(settings)]
  );
  return result.rows[0];
};

const updateDistributionSettings = async (companyId, data) => {
  const allowedFields = ["distribution_type", "is_active", "settings", "round_robin_order"];
  const updateFields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(data).forEach((key) => {
    if (allowedFields.includes(key) && data[key] !== undefined) {
      if (key === 'settings' || key === 'round_robin_order') {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(JSON.stringify(data[key]));
      } else {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
      }
      paramCount++;
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No valid fields to update");
  }

  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(companyId);

  const query = `
    UPDATE lead_distribution_settings
    SET ${updateFields.join(", ")}
    WHERE company_id = $${paramCount}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
};

const getActiveStaff = async (companyId) => {
  const result = await pool.query(
    `SELECT id, first_name, last_name, email FROM staff
     WHERE company_id = $1 AND status = 'active'
     ORDER BY id`,
    [companyId]
  );
  return result.rows;
};

const getStaffWorkload = async (companyId) => {
  const result = await pool.query(
    `SELECT s.id, s.first_name, s.last_name,
            COUNT(l.id) as active_leads,
            COALESCE(sp.leads_assigned, 0) as total_assigned_this_month
     FROM staff s
     LEFT JOIN leads l ON s.id = l.assigned_to AND l.status_id NOT IN (
       SELECT id FROM lead_statuses WHERE company_id = $1 AND is_final = true
     )
     LEFT JOIN staff_performance sp ON s.id = sp.staff_id AND sp.period_type = 'monthly'
       AND sp.period_start = DATE_TRUNC('month', CURRENT_DATE)
     WHERE s.company_id = $1 AND s.status = 'active'
     GROUP BY s.id, s.first_name, s.last_name, sp.leads_assigned
     ORDER BY active_leads ASC, total_assigned_this_month ASC`,
    [companyId]
  );
  return result.rows;
};

const getStaffPerformance = async (companyId) => {
  const result = await pool.query(
    `SELECT s.id, s.first_name, s.last_name,
            COALESCE(sp.conversion_rate, 0) as conversion_rate,
            COALESCE(sp.performance_score, 0) as performance_score,
            COALESCE(sp.leads_converted, 0) as leads_converted
     FROM staff s
     LEFT JOIN staff_performance sp ON s.id = sp.staff_id AND sp.period_type = 'monthly'
       AND sp.period_start = DATE_TRUNC('month', CURRENT_DATE)
     WHERE s.company_id = $1 AND s.status = 'active'
     ORDER BY sp.performance_score DESC NULLS LAST, sp.conversion_rate DESC NULLS LAST`,
    [companyId]
  );
  return result.rows;
};

const getNextRoundRobinStaff = async (companyId) => {
  const settingsResult = await pool.query(
    `SELECT round_robin_order, last_assigned_to FROM lead_distribution_settings
     WHERE company_id = $1`,
    [companyId]
  );

  const settings = settingsResult.rows[0];
  if (!settings || !settings.round_robin_order) {
    const activeStaff = await getActiveStaff(companyId);
    if (activeStaff.length === 0) return null;

    const roundRobinOrder = activeStaff.map(staff => staff.id);
    await updateDistributionSettings(companyId, { round_robin_order: roundRobinOrder });
    return activeStaff[0];
  }

  const roundRobinOrder = settings.round_robin_order;
  const lastAssignedIndex = roundRobinOrder.indexOf(settings.last_assigned_to);
  const nextIndex = (lastAssignedIndex + 1) % roundRobinOrder.length;
  const nextStaffId = roundRobinOrder[nextIndex];

  const staffResult = await pool.query(
    `SELECT id, first_name, last_name FROM staff WHERE id = $1 AND company_id = $2 AND status = 'active'`,
    [nextStaffId, companyId]
  );

  return staffResult.rows[0] || null;
};

const updateLastAssigned = async (companyId, staffId) => {
  await pool.query(
    `UPDATE lead_distribution_settings SET last_assigned_to = $1, updated_at = CURRENT_TIMESTAMP
     WHERE company_id = $2`,
    [staffId, companyId]
  );
};

const assignLeadsToStaff = async (leadIds, staffId, assignedBy, companyId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE leads
       SET assigned_to = $1, assigned_by = $2, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($3) AND company_id = $4 AND assigned_to IS NULL
       RETURNING id, first_name, last_name, email`,
      [staffId, assignedBy, leadIds, companyId]
    );

    const assignedLeads = result.rows;

    if (assignedLeads.length > 0) {
      const activityValues = assignedLeads.map((lead, index) => {
      const baseIndex = index * 5;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
    }).join(', ');

   const activityParams = assignedLeads.flatMap(lead => [
    lead.id, assignedBy, 'assigned', null, `Assigned to staff member`
    ]);

      await client.query(
      `INSERT INTO lead_activities (lead_id, staff_id, activity_type, old_value, description)
       VALUES ${activityValues}`,
       activityParams
       );
    }

    await client.query('COMMIT');
    return assignedLeads;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getUnassignedLeads = async (companyId, limit = null) => {
  let query = `
    SELECT l.id, l.first_name, l.last_name, l.email, l.phone, l.created_at,
           ls.source_name as lead_source,
           lt.status_name as lead_status
    FROM leads l
    LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
    LEFT JOIN lead_statuses lt ON l.status_id = lt.id
    WHERE l.company_id = $1 AND l.assigned_to IS NULL
    ORDER BY l.created_at ASC
  `;

  const params = [companyId];

  if (limit) {
    query += ` LIMIT $2`;
    params.push(limit);
  }

  const result = await pool.query(query, params);
  return result.rows;
};

const bulkAssignLeads = async (assignments, assignedBy, companyId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const results = [];

    for (const assignment of assignments) {
      const { lead_ids, staff_id } = assignment;

      const assignResult = await client.query(
        `UPDATE leads
         SET assigned_to = $1, assigned_by = $2, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($3) AND company_id = $4 AND assigned_to IS NULL
         RETURNING id, first_name, last_name, email`,
        [staff_id, assignedBy, lead_ids, companyId]
      );

      const assignedLeads = assignResult.rows;

      if (assignedLeads.length > 0) {
        const activityValues = assignedLeads.map((lead, index) => {
          const baseIndex = index * 5;
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
        }).join(', ');

        const activityParams = assignedLeads.flatMap(lead => [
          lead.id, assignedBy, 'assigned', null, `Manually assigned to staff member`
        ]);

        await client.query(
          `INSERT INTO lead_activities (lead_id, staff_id, activity_type, old_value, description)
           VALUES ${activityValues}`,
          activityParams
        );

        results.push({
          staff_id: staff_id,
          assigned_leads: assignedLeads
        });
      }
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getDistributionSettings,
  createDistributionSettings,
  updateDistributionSettings,
  getActiveStaff,
  getStaffWorkload,
  getStaffPerformance,
  getNextRoundRobinStaff,
  updateLastAssigned,
  assignLeadsToStaff,
  getUnassignedLeads,
  bulkAssignLeads
};