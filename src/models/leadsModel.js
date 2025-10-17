const pool = require("../config/database");
const { pipeline } = require('stream');
const { from: copyFrom } = require('pg-copy-streams');
const { Readable } = require('stream');


const ensureDefaultTagsExist = async (companyId) => {
  const defaultTags = [
    { name: 'high', color: '#dc3545' },
    { name: 'medium', color: '#ffc107' },
    { name: 'low', color: '#28a745' }
  ];

  const tagIds = {};

  for (const tag of defaultTags) {
    let existingTag = await pool.query(
      "SELECT id FROM lead_tags WHERE tag_name = $1 AND company_id = $2",
      [tag.name, companyId]
    );

    if (existingTag.rows.length === 0) {
      const newTag = await pool.query(
        `INSERT INTO lead_tags (company_id, tag_name, tag_color, description)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [companyId, tag.name, tag.color, `${tag.name.charAt(0).toUpperCase() + tag.name.slice(1)} priority tag`]
      );
      tagIds[tag.name] = newTag.rows[0].id;
    } else {
      tagIds[tag.name] = existingTag.rows[0].id;
    }
  }

  return tagIds;
};

const createLead = async (data) => {
  const {
    company_id,
    lead_source_id,
    first_name,
    last_name,
    email,
    phone,
    assigned_to,
    created_by,
    created_by_type,
    assigned_by,
    assigned_by_type,
    ...otherData
  } = data;

  const leadColumns = [
    'company_id', 'lead_source_id', 'status_id', 'assigned_to', 'first_name', 'last_name',
    'email', 'phone', 'address', 'remarks', 'company_name', 'job_title', 'industry',
    'lead_value', 'currency', 'notes', 'internal_notes', 'priority_level', 'lead_score',
    'best_time_to_call', 'timezone', 'utm_source', 'utm_medium', 'utm_campaign',
    'referral_source', 'created_by', 'created_by_type', 'assigned_by', 'assigned_by_type',
    'assigned_at', 'next_follow_up', 'lead_data'
  ];

  const processedData = {
    company_id,
    lead_source_id,
    first_name,
    last_name,
    email,
    phone,
    assigned_to,
    created_by,
    created_by_type,
    assigned_by,
    assigned_by_type,
    assigned_at: assigned_to ? new Date() : null,
    currency: otherData.currency || 'USD',
    priority_level: otherData.priority_level || 1,
    lead_score: otherData.lead_score || 0,
    ...otherData
  };

  const { lead_data, ...finalFields } = processedData;
  const finalData = {
    ...finalFields,
    lead_data: JSON.stringify(lead_data || {})
  };

  const columns = [];
  const values = [];
  const placeholders = [];

  leadColumns.forEach((column) => {
    if (finalData.hasOwnProperty(column) && finalData[column] !== undefined) {
      columns.push(column);
      values.push(finalData[column]);
      placeholders.push(`$${values.length}`);
    }
  });

  const query = `INSERT INTO leads (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

  const result = await pool.query(query, values);
  return result.rows[0];
};

const bulkCreateLeadsWithCopy = async (leadsBatch, defaultStatusId) => {
  if (leadsBatch.length === 0) return { rowCount: 0 };

  const client = await pool.connect();

  try {
    const now = new Date().toISOString();

    const csvData = leadsBatch.map(lead => {
      const statusId = lead.status_id ? parseInt(lead.status_id, 10) : defaultStatusId;
      const assignedTo = lead.assigned_to && !isNaN(parseInt(lead.assigned_to, 10)) ? parseInt(lead.assigned_to, 10) : null;
      const assignedAt = assignedTo ? now : null;

      return [
        lead.company_id || '',
        lead.lead_source_id || '',
        statusId || defaultStatusId,
        assignedTo || '',
        lead.first_name || '',
        lead.last_name || '',
        lead.email || '',
        lead.phone || '',
        lead.address || '',
        lead.remarks || '',
        lead.company_name || '',
        lead.job_title || '',
        lead.created_by || '',
        lead.created_by_type || '',
        lead.assigned_by || '',
        lead.assigned_by_type || '',
        assignedAt || ''
      ].join('\t');
    }).join('\n');

    const stream = client.query(copyFrom(`
      COPY leads (
        company_id, lead_source_id, status_id, assigned_to,
        first_name, last_name, email, phone, address, remarks,
        company_name, job_title, created_by, created_by_type,
        assigned_by, assigned_by_type, assigned_at
      ) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '')
    `));

    const dataStream = Readable.from([csvData]);

    await new Promise((resolve, reject) => {
      pipeline(dataStream, stream, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return { rowCount: leadsBatch.length };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
};

const updateLead = async (id, data, companyId) => {
  const allowedFields = [
    "first_name", "last_name", "email", "phone", "address", "remarks",
    "company_name", "job_title", "industry", "status_id", "assigned_to",
    "lead_value", "currency", "notes", "internal_notes", "priority_level",
    "lead_score", "best_time_to_call", "timezone", "utm_source", "utm_medium",
    "utm_campaign", "referral_source", "next_follow_up", "lead_source_id",
    "assigned_by", "assigned_by_type"
  ];

  const updateFields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(data).forEach((key) => {
    if (allowedFields.includes(key) && data[key] !== undefined) {
      if (key === 'assigned_to' && data[key]) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;

        updateFields.push(`assigned_at = CURRENT_TIMESTAMP`);

        if (data.assigned_by) {
          updateFields.push(`assigned_by = $${paramCount}`);
          values.push(data.assigned_by);
          paramCount++;
        }

        if (data.assigned_by_type) {
          updateFields.push(`assigned_by_type = $${paramCount}`);
          values.push(data.assigned_by_type);
          paramCount++;
        }

      } else if (key !== 'assigned_by' && key !== 'assigned_by_type') {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;
      }
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No valid fields to update");
  }

  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id, companyId);
  const whereClause = `WHERE id = $${paramCount} AND company_id = $${paramCount + 1}`;
  const query = `UPDATE leads SET ${updateFields.join(", ")} ${whereClause} RETURNING *`;

  const result = await pool.query(query, values);
  return result.rows[0];
};

const getTagIdByName = async (tagName, companyId) => {
  await ensureDefaultTagsExist(companyId);

  const result = await pool.query(
    "SELECT id FROM lead_tags WHERE LOWER(tag_name) = LOWER($1) AND company_id = $2",
    [tagName.toLowerCase(), companyId]
  );
  return result.rows[0]?.id;
};

const applyTagsToLead = async (leadId, tags, appliedBy, companyId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const leadCheck = await client.query(
      "SELECT id FROM leads WHERE id = $1 AND company_id = $2",
      [leadId, companyId]
    );

    if (leadCheck.rows.length === 0) {
      throw new Error("Lead not found or unauthorized");
    }

    await ensureDefaultTagsExist(companyId);

    for (const tagName of tags) {
      const tagId = await getTagIdByName(tagName, companyId);

      if (!tagId) {
        continue;
      }

      const existingMapping = await client.query(
        "SELECT id FROM lead_tag_mappings WHERE lead_id = $1 AND tag_id = $2",
        [leadId, tagId]
      );

      if (existingMapping.rows.length === 0) {
        await client.query(
          `INSERT INTO lead_tag_mappings (lead_id, tag_id, applied_by)
           VALUES ($1, $2, $3)`,
          [leadId, tagId, appliedBy]
        );
      }
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const updateLeadTags = async (leadId, tags, appliedBy, companyId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const leadCheck = await client.query(
      "SELECT id FROM leads WHERE id = $1 AND company_id = $2",
      [leadId, companyId]
    );

    if (leadCheck.rows.length === 0) {
      throw new Error("Lead not found or unauthorized");
    }

    await ensureDefaultTagsExist(companyId);

    await client.query(
      "DELETE FROM lead_tag_mappings WHERE lead_id = $1",
      [leadId]
    );

    for (const tagName of tags) {
      const tagId = await getTagIdByName(tagName, companyId);

      if (tagId) {
        await client.query(
          `INSERT INTO lead_tag_mappings (lead_id, tag_id, applied_by)
           VALUES ($1, $2, $3)`,
          [leadId, tagId, appliedBy]
        );
      } else {
      }
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getLeads = async (companyId) => {
  await ensureDefaultTagsExist(companyId);

  const result = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.email, l.phone, l.created_at,
            ls.source_name as lead_source,
            lt.status_name as lead_status,
            s.first_name as assigned_staff_first_name,
            ltag.tag_name as tag
     FROM leads l
     LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
     LEFT JOIN lead_statuses lt ON l.status_id = lt.id
     LEFT JOIN staff s ON l.assigned_to = s.id
     LEFT JOIN lead_tag_mappings ltm ON l.id = ltm.lead_id
     LEFT JOIN lead_tags ltag ON ltm.tag_id = ltag.id
     WHERE l.company_id = $1
     ORDER BY l.created_at DESC`,
    [companyId]
  );
  return result.rows;
};

const getLeadById = async (id, companyId) => {
  await ensureDefaultTagsExist(companyId);

  const result = await pool.query(
    `SELECT l.*,
            ls.source_name as lead_source,
            ls.source_type as lead_source_type,
            lt.status_name as lead_status,
            s.first_name as assigned_staff_first_name,
            s.last_name as assigned_staff_last_name,
            ltag.tag_name as tag,
            CASE
              WHEN l.created_by_type = 'staff' THEN
                (SELECT CONCAT(first_name, ' ', last_name) FROM staff WHERE id = l.created_by)
              WHEN l.created_by_type = 'company' THEN
                (SELECT admin_name FROM companies WHERE id = l.created_by)
              ELSE NULL
            END as created_by_name,
            CASE
              WHEN l.assigned_by_type = 'staff' THEN
                (SELECT CONCAT(first_name, ' ', last_name) FROM staff WHERE id = l.assigned_by)
              WHEN l.assigned_by_type = 'company' THEN
                (SELECT admin_name FROM companies WHERE id = l.assigned_by)
              ELSE NULL
            END as assigned_by_name
     FROM leads l
     LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
     LEFT JOIN lead_statuses lt ON l.status_id = lt.id
     LEFT JOIN staff s ON l.assigned_to = s.id
     LEFT JOIN lead_tag_mappings ltm ON l.id = ltm.lead_id
     LEFT JOIN lead_tags ltag ON ltm.tag_id = ltag.id
     WHERE l.id = $1 AND l.company_id = $2`,
    [id, companyId]
  );
  return result.rows[0];
};

const updateLeadStatusOnly = async (id, statusId, companyId) => {
  const result = await pool.query(
    `UPDATE leads SET status_id = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND company_id = $3 RETURNING *`,
    [statusId, id, companyId]
  );
  return result.rows[0];
};

const trackLeadStatusChange = async (leadId, oldStatusId, newStatusId, changedBy, companyId) => {
  const result = await pool.query(
    `INSERT INTO lead_activities (lead_id, staff_id, activity_type, old_value, new_value, description)
     SELECT $1, $2, 'status_change',
            (SELECT status_name FROM lead_statuses WHERE id = $3),
            (SELECT status_name FROM lead_statuses WHERE id = $4),
            'Lead status changed'
     WHERE EXISTS (SELECT 1 FROM leads WHERE id = $1 AND company_id = $5)
     RETURNING *`,
    [leadId, changedBy, oldStatusId, newStatusId, companyId]
  );
  return result.rows[0];
};

const trackLeadAssignment = async (leadId, assignedTo, assignedBy, companyId) => {
  const result = await pool.query(
    `INSERT INTO lead_activities (lead_id, staff_id, activity_type, new_value, description)
     SELECT $1, $2, 'assignment',
            (SELECT CONCAT(first_name, ' ', last_name) FROM staff WHERE id = $3),
            'Lead assigned to staff member'
     WHERE EXISTS (SELECT 1 FROM leads WHERE id = $1 AND company_id = $4)
     RETURNING *`,
    [leadId, assignedBy, assignedTo, companyId]
  );
  return result.rows[0];
};

const trackLeadCreation = async (leadId, createdBy, companyId) => {
  const result = await pool.query(
    `INSERT INTO lead_activities (lead_id, staff_id, activity_type, description)
     VALUES ($1, $2, 'creation', 'Lead created')
     RETURNING *`,
    [leadId, createdBy, companyId]
  );
  return result.rows[0];
};

const deleteLead = async (id, companyId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "DELETE FROM notifications WHERE related_lead_id = $1 AND company_id = $2",
      [id, companyId]
    );
    const leadResult = await client.query(
      "DELETE FROM leads WHERE id = $1 AND company_id = $2 RETURNING id",
      [id, companyId]
    );

    await client.query('COMMIT');
    return leadResult.rows.length > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const searchLeads = async (companyId, filters) => {
  await ensureDefaultTagsExist(companyId);

  let query = `
    SELECT l.id, l.first_name, l.last_name, l.email, l.phone, l.created_at,
           ls.source_name as lead_source,
           lt.status_name as lead_status,
           s.first_name as assigned_staff_first_name,
           ltag.tag_name as tag
    FROM leads l
    LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
    LEFT JOIN lead_statuses lt ON l.status_id = lt.id
    LEFT JOIN staff s ON l.assigned_to = s.id
    LEFT JOIN lead_tag_mappings ltm ON l.id = ltm.lead_id
    LEFT JOIN lead_tags ltag ON ltm.tag_id = ltag.id
    WHERE l.company_id = $1
  `;

  const params = [companyId];
  let paramCount = 1;

  if (filters.status_ids && filters.status_ids.length > 0) {
    paramCount++;
    query += ` AND l.status_id = ANY($${paramCount})`;
    params.push(filters.status_ids);
  }

  if (filters.tag_names && filters.tag_names.length > 0) {
    paramCount++;
    query += ` AND l.id IN (
      SELECT DISTINCT ltm2.lead_id
      FROM lead_tag_mappings ltm2
      JOIN lead_tags lt2 ON ltm2.tag_id = lt2.id
      WHERE LOWER(lt2.tag_name) = ANY($${paramCount})
    )`;
    params.push(filters.tag_names.map(name => name.toLowerCase()));
  }

  if (filters.tag_ids && filters.tag_ids.length > 0) {
    paramCount++;
    query += ` AND l.id IN (
      SELECT DISTINCT ltm2.lead_id
      FROM lead_tag_mappings ltm2
      WHERE ltm2.tag_id = ANY($${paramCount})
    )`;
    params.push(filters.tag_ids);
  }

  if (filters.source_ids && filters.source_ids.length > 0) {
    paramCount++;
    query += ` AND l.lead_source_id = ANY($${paramCount})`;
    params.push(filters.source_ids);
  }

  if (filters.assigned_to && filters.assigned_to.length > 0) {
    paramCount++;
    query += ` AND l.assigned_to = ANY($${paramCount})`;
    params.push(filters.assigned_to);
  }

  if (filters.search) {
    paramCount++;
    query += ` AND (
      LOWER(l.first_name) LIKE LOWER($${paramCount}) OR
      LOWER(l.last_name) LIKE LOWER($${paramCount}) OR
      LOWER(l.email) LIKE LOWER($${paramCount}) OR
      l.phone LIKE $${paramCount}
    )`;
    params.push(`%${filters.search}%`);
  }

  if (filters.date_from) {
    paramCount++;
    query += ` AND l.created_at >= $${paramCount}`;
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    paramCount++;
    query += ` AND l.created_at <= $${paramCount}`;
    params.push(filters.date_to);
  }

  query += ` ORDER BY l.created_at DESC`;

  if (filters.limit) {
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(filters.limit);
  }

  if (filters.offset) {
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(filters.offset);
  }

  const result = await pool.query(query, params);
  return result.rows;
};

const getLeadsWithTags = async (companyId) => {
  await ensureDefaultTagsExist(companyId);

  const result = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.email, l.phone, l.created_at,
            ls.source_name as lead_source,
            lt.status_name as lead_status,
            s.first_name as assigned_staff_first_name,
            ltag.tag_name as tag
     FROM leads l
     LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
     LEFT JOIN lead_statuses lt ON l.status_id = lt.id
     LEFT JOIN staff s ON l.assigned_to = s.id
     LEFT JOIN lead_tag_mappings ltm ON l.id = ltm.lead_id
     LEFT JOIN lead_tags ltag ON ltm.tag_id = ltag.id
     WHERE l.company_id = $1
     ORDER BY l.created_at DESC`,
    [companyId]
  );
  return result.rows;
};

const getLeadByIdWithTags = async (id, companyId) => {
  await ensureDefaultTagsExist(companyId);

  const result = await pool.query(
    `SELECT l.id, l.company_id, l.lead_source_id, l.assigned_to, l.status_id,
            l.first_name, l.last_name, l.email, l.phone, l.address, l.remarks,
            l.company_name, l.job_title, l.industry, l.lead_value, l.currency,
            l.notes, l.internal_notes, l.priority_level, l.lead_score,
            l.assigned_at, l.assigned_by, l.created_by, l.last_contacted,
            l.next_follow_up, l.best_time_to_call, l.timezone, l.utm_source,
            l.utm_medium, l.utm_campaign, l.referral_source, l.created_at, l.updated_at,
            l.created_by_type, l.assigned_by_type,
            ls.source_name as lead_source,
            ls.source_type as lead_source_type,
            lt.status_name as lead_status,
            s.first_name as assigned_staff_first_name,
            s.last_name as assigned_staff_last_name,
            ltag.tag_name as tag,
            CASE
              WHEN l.created_by_type = 'staff' THEN
                (SELECT CONCAT(first_name, ' ', last_name) FROM staff WHERE id = l.created_by)
              WHEN l.created_by_type = 'company' THEN
                (SELECT admin_name FROM companies WHERE id = l.created_by)
              ELSE NULL
            END as created_by_name,
            CASE
              WHEN l.assigned_by_type = 'staff' THEN
                (SELECT CONCAT(first_name, ' ', last_name) FROM staff WHERE id = l.assigned_by)
              WHEN l.assigned_by_type = 'company' THEN
                (SELECT admin_name FROM companies WHERE id = l.assigned_by)
              ELSE NULL
            END as assigned_by_name
     FROM leads l
     LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
     LEFT JOIN lead_statuses lt ON l.status_id = lt.id
     LEFT JOIN staff s ON l.assigned_to = s.id
     LEFT JOIN lead_tag_mappings ltm ON l.id = ltm.lead_id
     LEFT JOIN lead_tags ltag ON ltm.tag_id = ltag.id
     WHERE l.id = $1 AND l.company_id = $2`,
    [id, companyId]
  );
  return result.rows[0];
};

const getLeadStatuses = async (companyId) => {
  const result = await pool.query(
    "SELECT id, status_name, status_color, sort_order, is_default, is_final, conversion_stage, created_at FROM lead_statuses WHERE company_id = $1 ORDER BY sort_order ASC",
    [companyId]
  );
  return result.rows;
};

const getLeadStatusById = async (id, companyId) => {
  const result = await pool.query(
    "SELECT id, status_name, status_color, sort_order, is_default, is_final, conversion_stage, created_at FROM lead_statuses WHERE id = $1 AND company_id = $2",
    [id, companyId]
  );
  return result.rows[0];
};

const createLeadStatus = async (data) => {
  const {
    company_id,
    status_name,
    status_color = '#007bff',
    sort_order = 0,
    is_default = false,
    is_final = false,
    conversion_stage
  } = data;

  const result = await pool.query(
    `INSERT INTO lead_statuses (company_id, status_name, status_color, sort_order, is_default, is_final, conversion_stage)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [company_id, status_name, status_color, sort_order, is_default, is_final, conversion_stage]
  );
  return result.rows[0];
};

const updateLeadStatus = async (id, data, companyId) => {
  const allowedFields = ["status_name", "status_color", "sort_order", "is_default", "is_final", "conversion_stage"];
  const updateFields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(data).forEach((key) => {
    if (allowedFields.includes(key) && data[key] !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      values.push(data[key]);
      paramCount++;
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No valid fields to update");
  }

  const whereClause = `WHERE id = $${paramCount} AND company_id = $${paramCount + 1}`;
  values.push(id, companyId);

  const query = `UPDATE lead_statuses SET ${updateFields.join(", ")} ${whereClause} RETURNING *`;

  const result = await pool.query(query, values);
  return result.rows[0];
};

const deleteLeadStatus = async (id, companyId) => {
  const leadsCheck = await pool.query(
    "SELECT COUNT(*) as count FROM leads WHERE status_id = $1 AND company_id = $2",
    [id, companyId]
  );

  if (parseInt(leadsCheck.rows[0].count) > 0) {
    throw new Error("Cannot delete status as it is being used by existing leads");
  }

  const result = await pool.query(
    "DELETE FROM lead_statuses WHERE id = $1 AND company_id = $2 RETURNING id",
    [id, companyId]
  );
  return result.rows.length > 0;
};

const isLeadExists = async (email, phone, companyId) => {
  const result = await pool.query(
    `SELECT id FROM leads WHERE company_id = $1 AND (email = $2 OR phone = $3)`,
    [companyId, email, phone]
  );
  return result.rows.length > 0;
};

const getLeadSources = async (companyId) => {
  const result = await pool.query(
    "SELECT id, source_name, source_type, webhook_url, api_key, is_active, created_at FROM lead_sources WHERE company_id = $1",
    [companyId]
  );
  return result.rows;
};

const getLeadSourceById = async (id, companyId) => {
  const result = await pool.query(
    "SELECT id, source_name, source_type, webhook_url, api_key, is_active, total_leads_received, created_at FROM lead_sources WHERE id = $1 AND company_id = $2",
    [id, companyId]
  );
  return result.rows[0];
};

const createLeadSource = async (data) => {
  const { company_id, source_name, source_type = 'manual' } = data;
  const result = await pool.query(
    `INSERT INTO lead_sources (company_id, source_name, source_type)
     VALUES ($1, $2, $3) RETURNING *`,
    [company_id, source_name, source_type]
  );
  return result.rows[0];
};

const updateLeadSource = async (id, data, companyId) => {
  const allowedFields = ["source_name", "source_type", "webhook_url", "api_key", "is_active"];
  const updateFields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(data).forEach((key) => {
    if (allowedFields.includes(key) && data[key] !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      values.push(data[key]);
      paramCount++;
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No valid fields to update");
  }

  values.push(id, companyId);
  const whereClause = `WHERE id = $${paramCount} AND company_id = $${paramCount + 1}`;
  const query = `UPDATE lead_sources SET ${updateFields.join(", ")} ${whereClause} RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0];
};

const deleteLeadSource = async (id, companyId) => {
  const leadsCheck = await pool.query(
    "SELECT COUNT(*) as count FROM leads WHERE lead_source_id = $1 AND company_id = $2",
    [id, companyId]
  );

  if (parseInt(leadsCheck.rows[0].count) > 0) {
    throw new Error("Cannot delete source as it is being used by existing leads");
  }

  const result = await pool.query(
    "DELETE FROM lead_sources WHERE id = $1 AND company_id = $2 RETURNING id",
    [id, companyId]
  );
  return result.rows.length > 0;
};

const validateLeadsForAssignment = async (leadIds, companyId) => {
  const result = await pool.query(
    `SELECT id FROM leads WHERE id = ANY($1) AND company_id = $2 AND assigned_to IS NULL`,
    [leadIds, companyId]
  );
  return result.rows.map(row => row.id);
};

const getLeadAssignmentHistory = async (companyId, staffId = null) => {
  let query = `
    SELECT l.id, l.first_name, l.last_name, l.email,
           s1.first_name as assigned_to_name,
           s2.first_name as assigned_by_name,
           l.assigned_at
    FROM leads l
    LEFT JOIN staff s1 ON l.assigned_to = s1.id
    LEFT JOIN staff s2 ON l.assigned_by = s2.id
    WHERE l.company_id = $1 AND l.assigned_to IS NOT NULL
  `;

  const params = [companyId];

  if (staffId) {
    query += ` AND l.assigned_to = $2`;
    params.push(staffId);
  }

  query += ` ORDER BY l.assigned_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

const getStatusNameById = async (statusId, companyId) => {
  const result = await pool.query(
    "SELECT status_name FROM lead_statuses WHERE id = $1 AND company_id = $2",
    [statusId, companyId]
  );
  return result.rows[0]?.status_name || null;
};

const getLeadCurrentStatus = async (leadId, companyId) => {
  const result = await pool.query(
    `SELECT lt.status_name
     FROM leads l
     LEFT JOIN lead_statuses lt ON l.status_id = lt.id
     WHERE l.id = $1 AND l.company_id = $2`,
    [leadId, companyId]
  );
  return result.rows[0]?.status_name || null;
};

const getLeadTags = async (companyId) => {
  await ensureDefaultTagsExist(companyId);

  const result = await pool.query(
    "SELECT id, tag_name, tag_color, description, created_at FROM lead_tags WHERE company_id = $1 ORDER BY tag_name ASC",
    [companyId]
  );
  return result.rows;
};

const getLeadTagById = async (id, companyId) => {
  const result = await pool.query(
    "SELECT id, tag_name, tag_color, description, created_at FROM lead_tags WHERE id = $1 AND company_id = $2",
    [id, companyId]
  );
  return result.rows[0];
};

const applyTagToLead = async (leadId, tagId, appliedBy, companyId) => {
  const leadCheck = await pool.query(
    "SELECT id FROM leads WHERE id = $1 AND company_id = $2",
    [leadId, companyId]
  );

  if (leadCheck.rows.length === 0) {
    throw new Error("Lead not found or unauthorized");
  }

  const tagCheck = await pool.query(
    "SELECT id FROM lead_tags WHERE id = $1 AND company_id = $2",
    [tagId, companyId]
  );

  if (tagCheck.rows.length === 0) {
    throw new Error("Tag not found or unauthorized");
  }

  const existingMapping = await pool.query(
    "SELECT id FROM lead_tag_mappings WHERE lead_id = $1 AND tag_id = $2",
    [leadId, tagId]
  );

  if (existingMapping.rows.length > 0) {
    throw new Error("Tag already applied to this lead");
  }

  const result = await pool.query(
    `INSERT INTO lead_tag_mappings (lead_id, tag_id, applied_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [leadId, tagId, appliedBy]
  );
  return result.rows[0];
};

const removeTagFromLead = async (leadId, tagId, companyId) => {
  const leadCheck = await pool.query(
    "SELECT id FROM leads WHERE id = $1 AND company_id = $2",
    [leadId, companyId]
  );

  if (leadCheck.rows.length === 0) {
    throw new Error("Lead not found or unauthorized");
  }

  const result = await pool.query(
    "DELETE FROM lead_tag_mappings WHERE lead_id = $1 AND tag_id = $2 RETURNING id",
    [leadId, tagId]
  );
  return result.rows.length > 0;
};

const getLeadTagsByLeadId = async (leadId, companyId) => {
  await ensureDefaultTagsExist(companyId);

  const result = await pool.query(
    `SELECT lt.id, lt.tag_name, lt.tag_color, lt.description, ltm.applied_at
     FROM lead_tags lt
     INNER JOIN lead_tag_mappings ltm ON lt.id = ltm.tag_id
     INNER JOIN leads l ON ltm.lead_id = l.id
     WHERE ltm.lead_id = $1 AND l.company_id = $2`,
    [leadId, companyId]
  );
  return result.rows;
};

const getLeadTimelineForHistory = async (leadId, companyId) => {
  const result = await pool.query(
    `SELECT * FROM (
      SELECT
        l.created_at as timestamp,
        EXTRACT(DAY FROM l.created_at) as day,
        TO_CHAR(l.created_at, 'Mon') as month,
        'New' as activity_type,
        CONCAT('Looking for ', COALESCE(l.company_name, 'services'), ' initially looking for quote.') as description,
        ls.status_name as status_name,
        ls.status_color as status_color,
        l.remarks as remarks,
        1 as sort_priority
      FROM leads l
      LEFT JOIN lead_statuses ls ON l.status_id = ls.id
      WHERE l.id = $1 AND l.company_id = $2

      UNION ALL

      SELECT
        la.created_at as timestamp,
        EXTRACT(DAY FROM la.created_at) as day,
        TO_CHAR(la.created_at, 'Mon') as month,
        CASE
          WHEN la.activity_type = 'status_change' THEN 'Contacted'
          WHEN la.activity_type = 'call' THEN 'Called'
          WHEN la.activity_type = 'email' THEN 'Emailed'
          WHEN la.activity_type = 'meeting' THEN 'Meeting'
          WHEN la.activity_type = 'note' THEN 'Note Added'
          ELSE INITCAP(la.activity_type)
        END as activity_type,
        COALESCE(la.description,
          CASE
            WHEN la.activity_type = 'status_change' THEN CONCAT('Status changed to ', la.new_value)
            WHEN la.activity_type = 'call' THEN 'Phone call made'
            WHEN la.activity_type = 'email' THEN 'Email sent'
            ELSE la.activity_type
          END
        ) as description,
        CASE
          WHEN la.activity_type = 'status_change' THEN la.new_value
          ELSE NULL
        END as status_name,
        CASE
          WHEN la.activity_type = 'status_change' THEN (
            SELECT status_color FROM lead_statuses
            WHERE status_name = la.new_value AND company_id = $2 LIMIT 1
          )
          ELSE NULL
        END as status_color,
        la.description as remarks,
        2 as sort_priority
      FROM lead_activities la
      INNER JOIN leads l ON la.lead_id = l.id
      WHERE la.lead_id = $1 AND l.company_id = $2

      UNION ALL

      SELECT
        fr.created_at as timestamp,
        EXTRACT(DAY FROM fr.created_at) as day,
        TO_CHAR(fr.created_at, 'Mon') as month,
        'Follow Up' as activity_type,
        CONCAT('Follow-up scheduled: ', COALESCE(fr.message, 'No remarks')) as description,
        NULL as status_name,
        NULL as status_color,
        fr.message as remarks,
        3 as sort_priority
      FROM follow_up_reminders fr
      INNER JOIN leads l ON fr.lead_id = l.id
      WHERE fr.lead_id = $1 AND l.company_id = $2

      UNION ALL

      SELECT
        fr.completed_at as timestamp,
        EXTRACT(DAY FROM fr.completed_at) as day,
        TO_CHAR(fr.completed_at, 'Mon') as month,
        'Follow Up Completed' as activity_type,
        CONCAT('Follow-up completed: ', COALESCE(fr.message, 'No remarks')) as description,
        NULL as status_name,
        NULL as status_color,
        fr.message as remarks,
        4 as sort_priority
      FROM follow_up_reminders fr
      INNER JOIN leads l ON fr.lead_id = l.id
      WHERE fr.lead_id = $1 AND l.company_id = $2
        AND fr.is_completed = true
        AND fr.completed_at IS NOT NULL

    ) combined_timeline
    ORDER BY timestamp DESC, sort_priority ASC`,
    [leadId, companyId]
  );

  return result.rows.map(item => {
    const baseItem = {
      day: parseInt(item.day),
      month: item.month,
      activity_type: item.activity_type,
      description: item.description,
      timestamp: item.timestamp
    };

    if (item.activity_type === 'New') {
      baseItem.status = item.status_name ? {
        name: item.status_name,
        color: item.status_color
      } : null;
      if (item.remarks) {
        baseItem.remarks = item.remarks;
      }
    } else if (item.activity_type === 'Contacted' || item.activity_type.includes('status')) {
      if (item.status_name) {
        baseItem.status = {
          name: item.status_name,
          color: item.status_color
        };
      }
    } else if (item.activity_type.includes('Follow Up')) {
      if (item.remarks) {
        baseItem.remarks = item.remarks;
      }
      if (item.activity_type === 'Follow Up') {
        baseItem.scheduled_time = item.timestamp;
      }
    }

    return baseItem;
  });
};

const getLeadDetailsForUI = async (id, companyId) => {
  const result = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.created_at, l.updated_at,
            ls.status_name, ls.status_color, l.remarks
     FROM leads l
     LEFT JOIN lead_statuses ls ON l.status_id = ls.id
     WHERE l.id = $1 AND l.company_id = $2`,
    [id, companyId]
  );
  return result.rows[0];
};

const getLeadHistoryComplete = async (leadId, companyId) => {
  const result = await pool.query(
    `SELECT l.*,
            ls.source_name as lead_source,
            ls.source_type as lead_source_type,
            lt.status_name as lead_status,
            lt.status_color,
            s.first_name as assigned_staff_first_name,
            s.last_name as assigned_staff_last_name,
            CASE
              WHEN l.created_by_type = 'staff' THEN
                (SELECT CONCAT(first_name, ' ', last_name) FROM staff WHERE id = l.created_by)
              WHEN l.created_by_type = 'company' THEN
                (SELECT admin_name FROM companies WHERE id = l.created_by)
              ELSE NULL
            END as created_by_name,
            CASE
              WHEN l.assigned_by_type = 'staff' THEN
                (SELECT CONCAT(first_name, ' ', last_name) FROM staff WHERE id = l.assigned_by)
              WHEN l.assigned_by_type = 'company' THEN
                (SELECT admin_name FROM companies WHERE id = l.assigned_by)
              ELSE NULL
            END as assigned_by_name
     FROM leads l
     LEFT JOIN lead_sources ls ON l.lead_source_id = ls.id
     LEFT JOIN lead_statuses lt ON l.status_id = lt.id
     LEFT JOIN staff s ON l.assigned_to = s.id
     WHERE l.id = $1 AND l.company_id = $2`,
    [leadId, companyId]
  );
  return result.rows[0];
};

const getLeadActivitiesForHistory = async (leadId, companyId) => {
  const result = await pool.query(
    `SELECT
       EXTRACT(DAY FROM la.created_at) as day,
       TO_CHAR(la.created_at, 'Mon') as month,
       la.activity_type,
       la.description,
       la.new_value,
       la.created_at,
       CASE
         WHEN la.activity_type = 'status_change' THEN (
           SELECT json_build_object('name', status_name, 'color', status_color)
           FROM lead_statuses
           WHERE status_name = la.new_value AND company_id = $2
         )
         ELSE NULL
       END as status_info
     FROM lead_activities la
     INNER JOIN leads l ON la.lead_id = l.id
     WHERE la.lead_id = $1 AND l.company_id = $2
     ORDER BY la.created_at DESC`,
    [leadId, companyId]
  );
  return result.rows;
};

const getLeadFollowUpsExact = async (leadId, companyId) => {
  const result = await pool.query(
    `SELECT fr.id, fr.reminder_time as follow_up_time,
            fr.created_at,
            fr.message as remarks,
            fr.is_completed,
            fr.completed_at,
            CASE
              WHEN fr.created_by IS NOT NULL AND fr.created_by_type = 'staff' THEN
                (SELECT CONCAT(first_name, ' ', last_name) FROM staff WHERE id = fr.created_by)
              WHEN fr.created_by IS NOT NULL AND fr.created_by_type = 'company' THEN
                (SELECT admin_name FROM companies WHERE id = fr.created_by)
              ELSE 'System'
            END as created_by
     FROM follow_up_reminders fr
     INNER JOIN leads l ON fr.lead_id = l.id
     WHERE fr.lead_id = $1 AND l.company_id = $2
     ORDER BY fr.reminder_time ASC`,
    [leadId, companyId]
  );
  return result.rows;
};


const createFollowUp = async (data) => {
  const {
    lead_id,
    staff_id,
    company_id,
    reminder_time,
    message,  // already mapped from remarks in controller
    priority = 'normal',
    reminder_type = 'general',
    created_by,
    created_by_type
  } = data;

  const result = await pool.query(
    `INSERT INTO follow_up_reminders
      (lead_id, staff_id, company_id, reminder_time, message, priority, reminder_type, created_by, created_by_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [lead_id, staff_id, company_id, reminder_time, message, priority, reminder_type, created_by, created_by_type]
  );
  return result.rows[0];
};

const updateFollowUp = async (id, data, companyId) => {
  const allowedFields = ["reminder_time", "message", "priority", "reminder_type", "staff_id", "is_completed"];
  const updateFields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(data).forEach((key) => {
    if (allowedFields.includes(key) && data[key] !== undefined) {
      if (key === 'is_completed') {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;
        updateFields.push(data[key] ? `completed_at = CURRENT_TIMESTAMP` : `completed_at = NULL`);
      } else {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;
      }
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No valid fields to update");
  }

  values.push(id, companyId);
  const whereClause = `WHERE id = $${paramCount} AND company_id = $${paramCount + 1}`;
  const query = `UPDATE follow_up_reminders SET ${updateFields.join(", ")} ${whereClause} RETURNING *`;

  const result = await pool.query(query, values);
  return result.rows[0];
};



const getAllFollowUps = async (companyId, filters = {}) => {
  let query = `
    SELECT fr.id, fr.reminder_time as follow_up_time, fr.message as remarks,
           fr.priority, fr.reminder_type, fr.is_completed, fr.completed_at, fr.created_at,
           l.first_name, l.last_name, l.email,
           s.first_name as staff_first_name, s.last_name as staff_last_name,
           CASE
             WHEN fr.created_by IS NOT NULL AND fr.created_by_type = 'staff' THEN
               (SELECT CONCAT(first_name, ' ', last_name) FROM staff WHERE id = fr.created_by)
             WHEN fr.created_by IS NOT NULL AND fr.created_by_type = 'company' THEN
               (SELECT admin_name FROM companies WHERE id = fr.created_by)
             ELSE 'System'
           END as created_by
    FROM follow_up_reminders fr
    INNER JOIN leads l ON fr.lead_id = l.id
    LEFT JOIN staff s ON fr.staff_id = s.id
    WHERE fr.company_id = $1
  `;

  const params = [companyId];
  let paramCount = 1;

  if (filters.staff_id) {
    paramCount++;
    query += ` AND fr.staff_id = $${paramCount}`;
    params.push(filters.staff_id);
  }

  if (filters.is_completed !== undefined) {
    paramCount++;
    query += ` AND fr.is_completed = $${paramCount}`;
    params.push(filters.is_completed);
  }

  if (filters.date_from) {
    paramCount++;
    query += ` AND fr.reminder_time >= $${paramCount}`;
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    paramCount++;
    query += ` AND fr.reminder_time <= $${paramCount}`;
    params.push(filters.date_to);
  }

  query += ` ORDER BY fr.reminder_time ASC`;

  if (filters.limit) {
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(filters.limit);
  }

  const result = await pool.query(query, params);
  return result.rows;
};

const getFollowUpById = async (id, companyId) => {
  const result = await pool.query(
    `SELECT fr.id, fr.lead_id, fr.staff_id, fr.reminder_time as follow_up_time,
            fr.message as remarks, fr.priority, fr.reminder_type, fr.is_completed,
            fr.completed_at, fr.created_at, fr.created_by_type,
            l.first_name, l.last_name, l.email,
            s.first_name as staff_first_name, s.last_name as staff_last_name,
            CASE
              WHEN fr.created_by IS NOT NULL AND fr.created_by_type = 'staff' THEN
                (SELECT CONCAT(first_name, ' ', last_name) FROM staff WHERE id = fr.created_by)
              WHEN fr.created_by IS NOT NULL AND fr.created_by_type = 'company' THEN
                (SELECT admin_name FROM companies WHERE id = fr.created_by)
              ELSE 'System'
            END as created_by
     FROM follow_up_reminders fr
     INNER JOIN leads l ON fr.lead_id = l.id
     LEFT JOIN staff s ON fr.staff_id = s.id
     WHERE fr.id = $1 AND fr.company_id = $2`,
    [id, companyId]
  );
  return result.rows[0];
};


const deleteFollowUp = async (id, companyId) => {
  const result = await pool.query(
    "DELETE FROM follow_up_reminders WHERE id = $1 AND company_id = $2 RETURNING id",
    [id, companyId]
  );
  return result.rows.length > 0;
};

const markFollowUpComplete = async (id, companyId) => {
  const result = await pool.query(
    `UPDATE follow_up_reminders SET is_completed = true, completed_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND company_id = $2 RETURNING *`,
    [id, companyId]
  );
  return result.rows[0];
};
const trackLeadActivity = async (leadId, staffId, activityType, description, oldValue = null, newValue = null, metadata = null) => {
  const query = `
    INSERT INTO lead_activities (
      lead_id, staff_id, activity_type, description, old_value, new_value, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  const result = await pool.query(query, [
    leadId, staffId, activityType, description, oldValue, newValue,
    metadata ? JSON.stringify(metadata) : null
  ]);

  return result.rows[0];
};

const getLeadHistoryWithTimeline = async (leadId, companyId) => {
  const leadCheck = await pool.query(
    "SELECT id FROM leads WHERE id = $1 AND company_id = $2",
    [leadId, companyId]
  );

  if (leadCheck.rows.length === 0) {
    throw new Error("Lead not found or unauthorized");
  }

  const leadData = await pool.query(
    `SELECT l.id, l.first_name, l.last_name, l.created_at, l.updated_at,
            ls.status_name, ls.status_color, l.remarks
     FROM leads l
     LEFT JOIN lead_statuses ls ON l.status_id = ls.id
     WHERE l.id = $1 AND l.company_id = $2`,
    [leadId, companyId]
  );

  if (leadData.rows.length === 0) {
    throw new Error("Lead not found or unauthorized");
  }

  const timeline = await pool.query(
    `SELECT * FROM (
      SELECT
        l.created_at as timestamp,
        EXTRACT(DAY FROM l.created_at) as day,
        TO_CHAR(l.created_at, 'Mon') as month,
        'New' as activity_type,
        CONCAT('Looking for ', COALESCE(l.company_name, 'services'), ' initially looking for quote.') as description,
        ls.status_name as status_name,
        ls.status_color as status_color,
        l.remarks as remarks,
        1 as sort_priority
      FROM leads l
      LEFT JOIN lead_statuses ls ON l.status_id = ls.id
      WHERE l.id = $1 AND l.company_id = $2

      UNION ALL

      SELECT
        la.created_at as timestamp,
        EXTRACT(DAY FROM la.created_at) as day,
        TO_CHAR(la.created_at, 'Mon') as month,
        CASE
          WHEN la.activity_type = 'status_change' THEN 'Contacted'
          WHEN la.activity_type = 'call' THEN 'Called'
          WHEN la.activity_type = 'email' THEN 'Emailed'
          WHEN la.activity_type = 'meeting' THEN 'Meeting'
          WHEN la.activity_type = 'note' THEN 'Note Added'
          WHEN la.activity_type = 'assignment' THEN 'Assigned'
          WHEN la.activity_type = 'creation' THEN 'Created'
          ELSE INITCAP(la.activity_type)
        END as activity_type,
        COALESCE(la.description,
          CASE
            WHEN la.activity_type = 'status_change' THEN CONCAT('Status changed to ', la.new_value)
            WHEN la.activity_type = 'call' THEN 'Phone call made'
            WHEN la.activity_type = 'email' THEN 'Email sent'
            WHEN la.activity_type = 'assignment' THEN CONCAT('Lead assigned to ', la.new_value)
            WHEN la.activity_type = 'creation' THEN 'Lead created'
            ELSE la.activity_type
          END
        ) as description,
        CASE
          WHEN la.activity_type = 'status_change' THEN la.new_value
          ELSE NULL
        END as status_name,
        CASE
          WHEN la.activity_type = 'status_change' THEN (
            SELECT status_color FROM lead_statuses
            WHERE status_name = la.new_value AND company_id = $2 LIMIT 1
          )
          ELSE NULL
        END as status_color,
        la.description as remarks,
        2 as sort_priority
      FROM lead_activities la
      INNER JOIN leads l ON la.lead_id = l.id
      WHERE la.lead_id = $1 AND l.company_id = $2

      UNION ALL

      SELECT
        fr.created_at as timestamp,
        EXTRACT(DAY FROM fr.created_at) as day,
        TO_CHAR(fr.created_at, 'Mon') as month,
        'Follow Up' as activity_type,
        CONCAT('Follow-up scheduled: ', COALESCE(fr.message, 'No remarks')) as description,
        NULL as status_name,
        NULL as status_color,
        fr.message as remarks,
        3 as sort_priority
      FROM follow_up_reminders fr
      INNER JOIN leads l ON fr.lead_id = l.id
      WHERE fr.lead_id = $1 AND l.company_id = $2

      UNION ALL

      SELECT
        fr.completed_at as timestamp,
        EXTRACT(DAY FROM fr.completed_at) as day,
        TO_CHAR(fr.completed_at, 'Mon') as month,
        'Follow Up Completed' as activity_type,
        CONCAT('Follow-up completed: ', COALESCE(fr.message, 'No remarks')) as description,
        NULL as status_name,
        NULL as status_color,
        fr.message as remarks,
        4 as sort_priority
      FROM follow_up_reminders fr
      INNER JOIN leads l ON fr.lead_id = l.id
      WHERE fr.lead_id = $1 AND l.company_id = $2
        AND fr.is_completed = true
        AND fr.completed_at IS NOT NULL

    ) combined_timeline
    ORDER BY timestamp DESC, sort_priority ASC`,
    [leadId, companyId]
  );

  const lead = leadData.rows[0];
  const timelineData = timeline.rows.map(item => {
    const baseItem = {
      day: parseInt(item.day),
      month: item.month,
      activity_type: item.activity_type,
      description: item.description,
      timestamp: item.timestamp
    };

    if (item.activity_type === 'New') {
      baseItem.status = item.status_name ? {
        name: item.status_name,
        color: item.status_color
      } : null;
      if (item.remarks) {
        baseItem.remarks = item.remarks;
      }
    } else if (item.activity_type === 'Contacted' || item.activity_type.includes('status')) {
      if (item.status_name) {
        baseItem.status = {
          name: item.status_name,
          color: item.status_color
        };
      }
    } else if (item.activity_type.includes('Follow Up')) {
      if (item.remarks) {
        baseItem.remarks = item.remarks;
      }
      if (item.activity_type === 'Follow Up') {
        baseItem.scheduled_time = item.timestamp;
      }
    }

    return baseItem;
  });

  return {
    lead: {
      id: lead.id,
      name: `${lead.first_name} ${lead.last_name}`,
      added_at: lead.created_at,
      updated_at: lead.updated_at,
      status: {
        name: lead.status_name,
        color: lead.status_color
      }
    },
    timeline: timelineData
  };
};

const getLeadsCreatedThisMonth = async (companyId) => {
  const result = await pool.query(
    `SELECT COUNT(id)::integer as count FROM leads
     WHERE company_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)`,
    [companyId]
  );
  return result.rows[0]?.count || 0;
};

const getLeadsTotalCount = async (companyId) => {
  const result = await pool.query(
    `SELECT COUNT(id)::integer as count FROM leads
     WHERE company_id = $1`,
    [companyId]
  );
  return result.rows[0]?.count || 0;
};


module.exports = {
  createLead,
  bulkCreateLeadsWithCopy,
  getLeads,
  getLeadById,
  updateLead,
  updateLeadStatusOnly,
  trackLeadStatusChange,
  trackLeadAssignment,
  trackLeadCreation,
  deleteLead,
  searchLeads,
  getLeadsWithTags,
  getLeadByIdWithTags,
  getLeadStatuses,
  getLeadStatusById,
  createLeadStatus,
  updateLeadStatus,
  deleteLeadStatus,
  isLeadExists,
  getLeadSources,
  getLeadSourceById,
  createLeadSource,
  updateLeadSource,
  deleteLeadSource,
  validateLeadsForAssignment,
  getLeadAssignmentHistory,
  getStatusNameById,
  getLeadCurrentStatus,
  applyTagsToLead,
  updateLeadTags,
  getLeadTags,
  getLeadTagById,
  applyTagToLead,
  removeTagFromLead,
  getLeadTagsByLeadId,
  ensureDefaultTagsExist,
  getLeadDetailsForUI,
  getLeadHistoryComplete,
  getLeadActivitiesForHistory,
  getLeadTimelineForHistory,
  getLeadFollowUpsExact,
  createFollowUp,
  getAllFollowUps,
  getFollowUpById,
  updateFollowUp,
  deleteFollowUp,
  markFollowUpComplete,
  trackLeadActivity,
  getLeadHistoryWithTimeline,
  getLeadsCreatedThisMonth,
  getLeadsTotalCount

};