const pool = require("../config/database");

// --- 1. Basic Activity Counts (Used for Overview) ---
const getStaffPerformanceMetrics = async (staffId, companyId, periodType, periodStart, periodEnd, filters = {}) => {
  const params = [staffId, companyId];
  let paramIndex = 3;
  let dateFilter = '';

  // Use 'la' alias for date filter on activities
  if (periodStart) { dateFilter += ` AND la.created_at >= $${paramIndex}`; params.push(periodStart); paramIndex++; }
  if (periodEnd) { dateFilter += ` AND la.created_at <= $${paramIndex}`; params.push(periodEnd); paramIndex++; }

  // Simplified to just get Activity Counts
  // lead_activities does not have company_id, so we join leads to be safe and accurate
  const query = `
    SELECT
       COUNT(CASE WHEN la.activity_type = 'call' THEN 1 END) as calls_made,
       COUNT(CASE WHEN la.activity_type = 'email' THEN 1 END) as emails_sent,
       COUNT(CASE WHEN la.activity_type = 'meeting' THEN 1 END) as meetings_held
     FROM lead_activities la
     JOIN leads l ON la.lead_id = l.id
     WHERE la.staff_id = $1 AND l.company_id = $2 ${dateFilter}
  `;

  const result = await pool.query(query, params);
  return result.rows[0] || { calls_made: 0, emails_sent: 0, meetings_held: 0 };
};

// --- 2. Timeline ---
const getStaffTimeline = async (staffId, companyId, days = 30) => {
  const query = `
    (SELECT l.assigned_at as created_at, 'assignment' as activity_type,
            COALESCE(l.first_name || ' ' || l.last_name, l.company_name) as lead_name,
            NULL as description
     FROM leads l
     WHERE l.assigned_to = $1 AND l.company_id = $2 AND l.assigned_at >= CURRENT_DATE - make_interval(days => $3))
    UNION ALL
    (SELECT la.created_at, la.activity_type,
            COALESCE(l.first_name || ' ' || l.last_name, l.company_name) as lead_name,
            la.description
     FROM lead_activities la
     JOIN leads l ON la.lead_id = l.id
     WHERE la.staff_id = $1 AND l.company_id = $2 AND la.created_at >= CURRENT_DATE - make_interval(days => $3))
    ORDER BY created_at DESC LIMIT 50
  `;
  const result = await pool.query(query, [staffId, companyId, days]);
  return result.rows.map(row => ({
    date: new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    action: row.description || `${row.activity_type} - ${row.lead_name}`
  }));
};

// --- 3. Dashboard KPIs ---
const getKpiDashboardData = async (companyId, periodType) => {
  const now = new Date();
  let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  if (periodType === 'weekly') startDate.setDate(now.getDate() - 7);
  if (periodType === 'daily') startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const query = `
    SELECT s.id, s.first_name, s.last_name,
           COUNT(l.id) as total_leads,
           COUNT(CASE WHEN ls.conversion_stage = 'converted' THEN 1 END) as closed
    FROM staff s
    LEFT JOIN leads l ON s.id = l.assigned_to AND l.company_id = $1 AND l.created_at >= $2
    LEFT JOIN lead_statuses ls ON l.status_id = ls.id
    WHERE s.company_id = $1 AND s.status = 'active'
    GROUP BY s.id, s.first_name, s.last_name
    ORDER BY closed DESC
  `;
  const result = await pool.query(query, [companyId, startDate]);

  const staffList = result.rows.map(r => ({ ...r, total_leads: +r.total_leads, closed: +r.closed }));
  const totalLeads = staffList.reduce((sum, s) => sum + s.total_leads, 0);

  return {
    totalLeads,
    staffPerformance: staffList.slice(0, 10),
    topPerformer: staffList[0] || null,
    barChartData: staffList.slice(0, 5).map(s => ({ value: s.closed, label: s.first_name, frontColor: '#4E79A7' })),
    pieChartData: staffList.slice(0, 5).map((s, i) => ({ value: s.total_leads, color: ['#4E79A7','#F28E2B','#76B7B2','#59A14F','#E15759'][i], label: s.first_name }))
  };
};

// --- 4. Company Overview Metrics ---
const getCompanyOverview = async (companyId, periodStart, periodEnd) => {
  let dateFilter = '';
  const params = [companyId];
  if (periodStart) { dateFilter += ` AND l.created_at >= $2`; params.push(periodStart); }
  if (periodEnd) { dateFilter += ` AND l.created_at <= $${params.length + 1}`; params.push(periodEnd); }

  const query = `
    SELECT COUNT(*) as total_leads,
           COUNT(DISTINCT l.assigned_to) as active_staff_count,
           COUNT(CASE WHEN ls.conversion_stage = 'converted' THEN 1 END) as converted_count
    FROM leads l
    LEFT JOIN lead_statuses ls ON l.status_id = ls.id
    WHERE l.company_id = $1 ${dateFilter}
  `;
  const result = await pool.query(query, params);
  const data = result.rows[0];
  return {
    total_leads: +data.total_leads,
    active_staff_count: +data.active_staff_count,
    conversion_rate: data.total_leads > 0 ? ((data.converted_count / data.total_leads) * 100).toFixed(2) : 0
  };
};

// --- 5. Status Breakdown ---
const getStatusBreakdown = async (companyId, filters) => {
  const { periodStart, periodEnd, staffIds, statusIds, sourceIds } = filters;
  let whereClause = 'WHERE ls.company_id = $1';
  const params = [companyId];
  let idx = 2;

  let joinLeads = `LEFT JOIN leads l ON ls.id = l.status_id AND l.company_id = $1`;

  if (periodStart) { joinLeads += ` AND l.created_at >= $${idx++}`; params.push(periodStart); }
  if (periodEnd) { joinLeads += ` AND l.created_at <= $${idx++}`; params.push(periodEnd); }
  if (staffIds?.length) { joinLeads += ` AND l.assigned_to = ANY($${idx++})`; params.push(staffIds); }
  if (sourceIds?.length) { joinLeads += ` AND l.lead_source_id = ANY($${idx++})`; params.push(sourceIds); }

  if (statusIds?.length) { whereClause += ` AND ls.id = ANY($${idx++})`; params.push(statusIds); }

  const query = `
    SELECT ls.id, ls.status_name, ls.status_color, ls.conversion_stage,
           COUNT(l.id) as count
    FROM lead_statuses ls
    ${joinLeads}
    ${whereClause}
    GROUP BY ls.id, ls.status_name, ls.status_color, ls.conversion_stage, ls.sort_order
    ORDER BY ls.sort_order ASC
  `;

  const result = await pool.query(query, params);
  const total = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
  return result.rows.map(r => ({
    ...r,
    count: +r.count,
    percentage: total > 0 ? ((r.count / total) * 100).toFixed(2) : 0,
    is_converted: r.conversion_stage === 'converted'
  }));
};

// --- 6. Optimized User Operations (Worked/Not Worked/Follow-ups) ---
const getUserLeadOpsReport = async (companyId, filters) => {
  const { periodStart, periodEnd, staffIds } = filters;
  const params = [companyId];
  let idx = 2;

  let dateClause = '';
  // Used for activities/reminders filters
  let actDateClause = '';
  let leadDateClause = ''; // Explicitly for leads table if needed separate

  if (periodStart) {
    dateClause += ` AND l.created_at >= $${idx}`;
    actDateClause += ` AND la.created_at >= $${idx}`;
    leadDateClause += ` AND l.created_at >= $${idx}`;
    params.push(periodStart); idx++;
  }
  if (periodEnd) {
    dateClause += ` AND l.created_at <= $${idx}`;
    actDateClause += ` AND la.created_at <= $${idx}`;
    leadDateClause += ` AND l.created_at <= $${idx}`;
    params.push(periodEnd); idx++;
  }

  let staffClause = '';
  if (staffIds?.length) { staffClause = ` AND s.id = ANY($${idx})`; params.push(staffIds); idx++; }

  // CTE approach for accuracy and performance
  // 1. Worked Leads: DISTINCT leads that have an activity (call/email/note) OR a reminder by this staff
  // 2. Transfers: Count transfers OUT
  // 3. Follow-ups: Count pending reminders or leads with future next_follow_up
  const query = `
    WITH staff_activities AS (
      SELECT la.staff_id, la.lead_id
      FROM lead_activities la
      JOIN leads l ON la.lead_id = l.id
      WHERE l.company_id = $1 ${actDateClause}
    ),
    staff_reminders AS (
      SELECT fr.staff_id, fr.lead_id
      FROM follow_up_reminders fr
      WHERE fr.company_id = $1 ${actDateClause.replace(/la\./g, 'fr.')}
    ),
    staff_transfers_out AS (
      SELECT la.staff_id, COUNT(*) as count
      FROM lead_activities la
      JOIN leads l ON la.lead_id = l.id
      WHERE l.company_id = $1 AND la.activity_type = 'lead_transfer' ${actDateClause}
      GROUP BY la.staff_id
    )
    SELECT s.id, s.first_name, s.last_name,
      COUNT(DISTINCT l.id) as total_leads,
      -- Worked Count: Has activity OR has reminder OR last_contacted is set
      COUNT(DISTINCT CASE
         WHEN l.last_contacted IS NOT NULL
           OR sa.lead_id IS NOT NULL
           OR sr.lead_id IS NOT NULL
         THEN l.id
      END) as worked_count,
      -- Not Worked: Total - Worked (Simplified logic in JS usually, but here in SQL)
      COUNT(DISTINCT CASE
         WHEN l.last_contacted IS NULL
           AND sa.lead_id IS NULL
           AND sr.lead_id IS NULL
         THEN l.id
      END) as not_worked_count,
      -- Follow-ups: Leads with a future follow-up date assigned to this user
      COUNT(DISTINCT CASE WHEN l.next_follow_up IS NOT NULL AND l.next_follow_up >= CURRENT_DATE THEN l.id END) as follow_ups_count,
      COALESCE(st.count, 0) as transferred_out,
      COUNT(DISTINCT CASE WHEN l.assigned_by IS NOT NULL AND l.assigned_by != s.id THEN l.id END) as transferred_in
    FROM staff s
    LEFT JOIN leads l ON s.id = l.assigned_to AND l.company_id = $1 ${leadDateClause}
    LEFT JOIN staff_activities sa ON s.id = sa.staff_id AND l.id = sa.lead_id
    LEFT JOIN staff_reminders sr ON s.id = sr.staff_id AND l.id = sr.lead_id
    LEFT JOIN staff_transfers_out st ON s.id = st.staff_id
    WHERE s.company_id = $1 AND s.status = 'active' ${staffClause}
    GROUP BY s.id, s.first_name, s.last_name, st.count
    ORDER BY total_leads DESC
  `;

  const result = await pool.query(query, params);
  return result.rows.map(r => ({
    ...r,
    worked_count: +r.worked_count,
    not_worked_count: +r.not_worked_count,
    transferred_out: +r.transferred_out,
    transferred_in: +r.transferred_in,
    follow_ups_count: +r.follow_ups_count
  }));
};

// --- 7. Source & Other Helpers ---
const getSourcePerformance = async (companyId, start, end) => {
  let dateFilter = '';
  const params = [companyId];
  if(start) { dateFilter+=` AND l.created_at >= $2`; params.push(start); }
  if(end) { dateFilter+=` AND l.created_at <= $${params.length+1}`; params.push(end); }

  const query = `
    SELECT lso.source_name, COUNT(l.id) as total_leads
    FROM lead_sources lso
    LEFT JOIN leads l ON lso.id = l.lead_source_id AND l.company_id = $1 ${dateFilter}
    WHERE lso.company_id = $1
    GROUP BY lso.id, lso.source_name ORDER BY total_leads DESC
  `;
  return (await pool.query(query, params)).rows;
};

const getMostActiveStaff = async (companyId, start, end) => {
  let dateFilter = '';
  const params = [companyId];
  if(start) { dateFilter+=` AND ual.created_at >= $2`; params.push(start); }
  if(end) { dateFilter+=` AND ual.created_at <= $${params.length+1}`; params.push(end); }

  const query = `
    SELECT s.first_name, s.last_name, COUNT(ual.id) as action_count
    FROM user_activity_logs ual
    JOIN staff s ON ual.staff_id = s.id
    WHERE ual.company_id = $1 ${dateFilter}
    AND ual.action_type NOT IN ('SEARCH', 'LOGOUT', 'VIEW_LEAD')
    GROUP BY s.id, s.first_name, s.last_name ORDER BY action_count DESC LIMIT 5
  `;
  return (await pool.query(query, params)).rows;
};

const getTopPerformers = async (companyId, start, end) => {
  let dateFilter = '';
  const params = [companyId];
  if(start) { dateFilter+=` AND l.created_at >= $2`; params.push(start); }
  if(end) { dateFilter+=` AND l.created_at <= $${params.length+1}`; params.push(end); }

  const query = `
    SELECT s.first_name, s.last_name, COUNT(l.id) as closed
    FROM staff s
    JOIN leads l ON s.id = l.assigned_to
    JOIN lead_statuses ls ON l.status_id = ls.id
    WHERE s.company_id = $1 AND ls.conversion_stage = 'converted' ${dateFilter}
    GROUP BY s.id, s.first_name, s.last_name ORDER BY closed DESC LIMIT 5
  `;
  return (await pool.query(query, params)).rows;
};

module.exports = {
  getStaffPerformanceMetrics,
  getStaffTimeline,
  getKpiDashboardData,
  getCompanyOverview,
  getStatusBreakdown,
  getUserLeadOpsReport,
  getSourcePerformance,
  getMostActiveStaff,
  getTopPerformers
};