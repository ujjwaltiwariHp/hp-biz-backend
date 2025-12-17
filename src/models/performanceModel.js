const pool = require("../config/database");

const getStaffPerformanceMetrics = async (staffId, companyId, periodType = 'monthly', periodStart = null, periodEnd = null, filters = {}) => {
  let dateFilter = '';
  const params = [staffId, companyId];
  let paramIndex = 3;

  if (periodStart) {
    dateFilter += ` AND l.created_at >= $${paramIndex}`;
    params.push(periodStart);
    paramIndex++;
  }

  if (periodEnd) {
    dateFilter += ` AND l.created_at <= $${paramIndex}`;
    params.push(periodEnd);
    paramIndex++;
  }

  if (filters.statusIds && filters.statusIds.length > 0) {
    dateFilter += ` AND l.status_id = ANY($${paramIndex})`;
    params.push(filters.statusIds);
    paramIndex++;
  }

  if (filters.sourceIds && filters.sourceIds.length > 0) {
    dateFilter += ` AND l.lead_source_id = ANY($${paramIndex})`;
    params.push(filters.sourceIds);
    paramIndex++;
  }

  const staffResult = await pool.query(
    `SELECT s.first_name, s.last_name FROM staff s WHERE s.id = $1 AND s.company_id = $2`,
    [staffId, companyId]
  );

  if (staffResult.rows.length === 0) {
    throw new Error("Staff member not found");
  }

  const staffName = `${staffResult.rows[0].first_name} ${staffResult.rows[0].last_name}`;

  const result = await pool.query(
    `SELECT
       COUNT(*) as total_leads,
       COUNT(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN 1
       END) as closed,
       COUNT(CASE
         WHEN LOWER(ls.status_name) SIMILAR TO '%(follow|pending|contacted|progress)%'
         OR l.next_follow_up IS NOT NULL
         THEN 1
       END) as follow_ups,
       COALESCE(SUM(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN l.lead_value ELSE 0
       END), 0) as total_deal_value,
       COALESCE(AVG(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN l.lead_value
       END), 0) as avg_deal_value,
       ROUND(
         CASE
           WHEN COUNT(*) > 0 THEN
             (COUNT(CASE
               WHEN (
                 ls.conversion_stage = 'converted'
                 OR ls.is_final = true
                 OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
               ) THEN 1
             END)::numeric / COUNT(*)::numeric) * 100
           ELSE 0
         END, 2
       ) as conversion_rate
     FROM leads l
     LEFT JOIN lead_statuses ls ON l.status_id = ls.id
     WHERE l.assigned_to = $1 AND l.company_id = $2 ${dateFilter}`,
    params
  );

  const activitiesResult = await pool.query(
    `SELECT
       COUNT(CASE WHEN activity_type = 'call' THEN 1 END) as calls_made,
       COUNT(CASE WHEN activity_type = 'email' THEN 1 END) as emails_sent,
       COUNT(CASE WHEN activity_type = 'meeting' THEN 1 END) as meetings_held
     FROM lead_activities la
     INNER JOIN leads l ON la.lead_id = l.id
     WHERE la.staff_id = $1 AND l.company_id = $2 ${dateFilter.replace(/l\./g, 'l.')}`,
    params
  );

  const metrics = result.rows[0];
  const activities = activitiesResult.rows[0];

  return {
    id: staffId,
    name: staffName,
    totalLeads: parseInt(metrics.total_leads),
    closed: parseInt(metrics.closed),
    followUps: parseInt(metrics.follow_ups),
    pending: parseInt(metrics.total_leads) - (parseInt(metrics.closed) + parseInt(metrics.follow_ups)),
    total_deal_value: parseFloat(metrics.total_deal_value),
    avg_deal_value: parseFloat(metrics.avg_deal_value),
    conversion_rate: parseFloat(metrics.conversion_rate),
    calls_made: parseInt(activities.calls_made),
    emails_sent: parseInt(activities.emails_sent),
    meetings_held: parseInt(activities.meetings_held)
  };
};

const getAllStaffPerformance = async (companyId, periodType = 'monthly', periodStart = null, periodEnd = null) => {
  let dateFilter = '';
  const params = [companyId];
  let paramIndex = 2;

  if (periodStart) {
    dateFilter += ` AND l.created_at >= $${paramIndex}`;
    params.push(periodStart);
    paramIndex++;
  }

  if (periodEnd) {
    dateFilter += ` AND l.created_at <= $${paramIndex}`;
    params.push(periodEnd);
    paramIndex++;
  }

  const result = await pool.query(
    `SELECT
       s.id,
       s.first_name,
       s.last_name,
       COUNT(l.*) as total_leads,
       COUNT(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN 1
       END) as closed,
       COUNT(CASE
         WHEN LOWER(ls.status_name) SIMILAR TO '%(follow|pending|contacted|progress)%'
         OR l.next_follow_up IS NOT NULL
         THEN 1
       END) as follow_ups,
       COALESCE(SUM(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN l.lead_value ELSE 0
       END), 0) as total_deal_value
     FROM staff s
     LEFT JOIN leads l ON s.id = l.assigned_to AND l.company_id = $1 ${dateFilter}
     LEFT JOIN lead_statuses ls ON l.status_id = ls.id
     WHERE s.company_id = $1 AND s.status = 'active'
     GROUP BY s.id, s.first_name, s.last_name
     ORDER BY total_leads DESC, closed DESC`,
    params
  );

  return result.rows.map(row => ({
    id: row.id,
    name: `${row.first_name} ${row.last_name}`,
    totalLeads: parseInt(row.total_leads) || 0,
    closed: parseInt(row.closed) || 0,
    followUps: parseInt(row.follow_ups) || 0,
    pending: (parseInt(row.total_leads) || 0) - ((parseInt(row.closed) || 0) + (parseInt(row.follow_ups) || 0)),
    total_deal_value: parseFloat(row.total_deal_value) || 0
  }));
};

const getStaffTimeline = async (staffId, companyId, days = 30) => {
  try {
    const assignmentsQuery = `
      SELECT
        l.assigned_at as created_at,
        'assignment' as activity_type,
        COALESCE(CONCAT(l.first_name, ' ', l.last_name), l.company_name) as lead_name,
        ls.status_name,
        l.id as lead_id
      FROM leads l
      LEFT JOIN lead_statuses ls ON l.status_id = ls.id
      WHERE l.assigned_to = $1
        AND l.company_id = $2
        AND l.assigned_at >= CURRENT_DATE - make_interval(days => $3)
        AND l.assigned_at IS NOT NULL
      ORDER BY l.assigned_at DESC
    `;
    const activitiesQuery = `
      SELECT
        la.created_at,
        la.activity_type,
        COALESCE(CONCAT(l.first_name, ' ', l.last_name), l.company_name) as lead_name,
        ls.status_name,
        la.description,
        la.new_value,
        la.old_value,
        la.lead_id
      FROM lead_activities la
      INNER JOIN leads l ON la.lead_id = l.id
      LEFT JOIN lead_statuses ls ON l.status_id = ls.id
      WHERE la.staff_id = $1
        AND l.company_id = $2
        AND la.created_at >= CURRENT_DATE - make_interval(days => $3)
      ORDER BY la.created_at DESC
    `;

    const [assignmentsResult, activitiesResult] = await Promise.all([
      pool.query(assignmentsQuery, [staffId, companyId, days]),
      pool.query(activitiesQuery, [staffId, companyId, days])
    ]);

    const allActivities = [
      ...assignmentsResult.rows.map(row => ({
        ...row,
        description: `Lead assigned: ${row.lead_name}`
      })),
      ...activitiesResult.rows.map(row => ({
        ...row,
        description: row.description || `${row.activity_type} - ${row.lead_name}`
      }))
    ];

    allActivities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const timeline = allActivities.slice(0, 20).map(row => {
      const date = new Date(row.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short'
      });

      let action = '';
      const leadName = row.lead_name || 'Unknown Lead';

      switch (row.activity_type) {
        case 'assignment':
          action = `Lead Assigned (${leadName})`;
          break;
        case 'status_change':
          const newStatus = row.new_value || row.status_name || 'Unknown Status';
          action = `Status Changed to ${newStatus} (${leadName})`;
          break;
        case 'call':
          action = `Call Made (${leadName})`;
          break;
        case 'email':
          action = `Email Sent (${leadName})`;
          break;
        case 'meeting':
          action = `Meeting Scheduled (${leadName})`;
          break;
        case 'note':
          action = `Note Added (${leadName})`;
          break;
        case 'creation':
          action = `Lead Created (${leadName})`;
          break;
        default:
          action = row.description || `Activity on ${leadName}`;
      }

      return {
        date: date,
        action: action
      };
    });

    return timeline;

  } catch (error) {
    throw error;
  }
};

const getKpiDashboardData = async (companyId, periodType = 'monthly') => {
  let dateFilter = '';
  const params = [companyId];
  let paramIndex = 2;

  const now = new Date();
  let startDate;

  switch (periodType) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'yearly':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  dateFilter = ` AND l.created_at >= $${paramIndex}`;
  params.push(startDate);

  const staffPerformance = await pool.query(
    `SELECT
       s.id,
       s.first_name,
       s.last_name,
       COUNT(l.*) as total_leads,
       COUNT(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN 1
       END) as closed,
       COUNT(CASE
         WHEN LOWER(ls.status_name) SIMILAR TO '%(follow|pending|contacted|progress)%'
         OR l.next_follow_up IS NOT NULL
         THEN 1
       END) as follow_ups,
       COALESCE(SUM(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN l.lead_value ELSE 0
       END), 0) as revenue
     FROM staff s
     LEFT JOIN leads l ON s.id = l.assigned_to AND l.company_id = $1 ${dateFilter}
     LEFT JOIN lead_statuses ls ON l.status_id = ls.id
     WHERE s.company_id = $1 AND s.status = 'active'
     GROUP BY s.id, s.first_name, s.last_name
     HAVING COUNT(l.*) > 0
     ORDER BY closed DESC, total_leads DESC`,
    params
  );

  const totalLeadsCount = staffPerformance.rows.reduce((sum, row) => sum + parseInt(row.total_leads), 0);

  const staffList = staffPerformance.rows.map(row => ({
    id: row.id,
    name: `${row.first_name} ${row.last_name}`,
    totalLeads: parseInt(row.total_leads) || 0,
    closed: parseInt(row.closed) || 0,
    followUps: parseInt(row.follow_ups) || 0,
    revenue: parseFloat(row.revenue) || 0
  }));

  const barChartData = staffList.map(staff => ({
    value: staff.closed,
    label: staff.name.split(' ')[0],
    frontColor: '#4E79A7'
  }));

  const pieChartData = staffList.map((staff, index) => {
    const colors = ['#4E79A7', '#F28E2B', '#76B7B2', '#59A14F', '#E15759', '#EDC948', '#B07AA1'];
    const percentage = totalLeadsCount > 0 ? Math.round((staff.totalLeads / totalLeadsCount) * 100) : 0;

    return {
      value: staff.totalLeads,
      color: colors[index % colors.length],
      text: staff.totalLeads.toString(),
      label: staff.name,
      percentage: percentage
    };
  });

  const topPerformer = staffList.length > 0 ? staffList[0] : null;

  return {
    totalLeads: totalLeadsCount,
    staffPerformance: staffList,
    barChartData: barChartData,
    pieChartData: pieChartData,
    topPerformer: topPerformer
  };
};

const getCompanyPerformanceMetrics = async (companyId, periodType = 'monthly', periodStart = null, periodEnd = null, filters = {}) => {
  let dateFilter = '';
  const params = [companyId];
  let paramIndex = 2;

  if (periodStart) {
    dateFilter += ` AND l.created_at >= $${paramIndex}`;
    params.push(periodStart);
    paramIndex++;
  }

  if (periodEnd) {
    dateFilter += ` AND l.created_at <= $${paramIndex}`;
    params.push(periodEnd);
    paramIndex++;
  }

  if (filters.statusIds && filters.statusIds.length > 0) {
    dateFilter += ` AND l.status_id = ANY($${paramIndex})`;
    params.push(filters.statusIds);
    paramIndex++;
  }

  if (filters.sourceIds && filters.sourceIds.length > 0) {
    dateFilter += ` AND l.lead_source_id = ANY($${paramIndex})`;
    params.push(filters.sourceIds);
    paramIndex++;
  }

  const result = await pool.query(
    `SELECT
       COUNT(*) as total_leads,
       COUNT(CASE WHEN l.assigned_to IS NOT NULL THEN 1 END) as leads_assigned,
       COUNT(CASE WHEN l.last_contacted IS NOT NULL THEN 1 END) as leads_contacted,
       COUNT(CASE
         WHEN (
           ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success|lost|rejected)%'
         ) THEN 1
       END) as leads_closed,
       COUNT(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN 1
       END) as leads_converted,
       COALESCE(SUM(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN l.lead_value ELSE 0
       END), 0) as total_revenue,
       COALESCE(AVG(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN l.lead_value
       END), 0) as avg_deal_size,
       ROUND(
         CASE
           WHEN COUNT(*) > 0 THEN
             (COUNT(CASE
               WHEN (
                 ls.conversion_stage = 'converted'
                 OR ls.is_final = true
                 OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
               ) THEN 1
             END)::numeric / COUNT(*)::numeric) * 100
           ELSE 0
         END, 2
       ) as overall_conversion_rate,
       COUNT(DISTINCT l.assigned_to) as active_staff_count
     FROM leads l
     LEFT JOIN lead_statuses ls ON l.status_id = ls.id
     WHERE l.company_id = $1 ${dateFilter}`,
    params
  );

  const sourcePerformanceResult = await pool.query(
    `SELECT
       lso.source_name,
       lso.source_type,
       COUNT(l.*) as leads_count,
       COUNT(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN 1
       END) as converted_count,
       COALESCE(SUM(CASE
         WHEN (
           ls.conversion_stage = 'converted'
           OR ls.is_final = true
           OR LOWER(ls.status_name) SIMILAR TO '%(closed|converted|won|completed|success)%'
         ) THEN l.lead_value ELSE 0
       END), 0) as source_revenue
     FROM leads l
     LEFT JOIN lead_sources lso ON l.lead_source_id = lso.id
     LEFT JOIN lead_statuses ls ON l.status_id = ls.id
     WHERE l.company_id = $1 ${dateFilter}
     GROUP BY lso.id, lso.source_name, lso.source_type
     ORDER BY leads_count DESC`,
    params
  );

  return {
    ...result.rows[0],
    source_performance: sourcePerformanceResult.rows
  };
};

const getLeadConversionReport = async (companyId, periodStart = null, periodEnd = null) => {
  let dateFilter = '';
  const params = [companyId];
  let paramIndex = 2;

  if (periodStart) {
    dateFilter += ` AND l.created_at >= $${paramIndex}`;
    params.push(periodStart);
    paramIndex++;
  }

  if (periodEnd) {
    dateFilter += ` AND l.created_at <= $${paramIndex}`;
    params.push(periodEnd);
    paramIndex++;
  }

  const result = await pool.query(
    `SELECT
       ls.status_name,
       ls.conversion_stage,
       COUNT(l.*) as lead_count,
       COALESCE(SUM(l.lead_value), 0) as total_value,
       COALESCE(AVG(l.lead_value), 0) as avg_value,
       ROUND(
         CASE
           WHEN (SELECT COUNT(*) FROM leads WHERE company_id = $1 ${dateFilter}) > 0 THEN
             (COUNT(l.*)::numeric / (SELECT COUNT(*) FROM leads WHERE company_id = $1 ${dateFilter})::numeric) * 100
           ELSE 0
         END, 2
       ) as percentage_of_total
     FROM lead_statuses ls
     LEFT JOIN leads l ON ls.id = l.status_id AND l.company_id = $1 ${dateFilter}
     WHERE ls.company_id = $1
     GROUP BY ls.id, ls.status_name, ls.conversion_stage
     ORDER BY lead_count DESC`,
    params
  );

  return result.rows;
};

const getSourcePerformanceReport = async (companyId, periodStart = null, periodEnd = null) => {
  let dateFilter = '';
  const params = [companyId];
  let paramIndex = 2;

  if (periodStart) {
    dateFilter += ` AND l.created_at >= $${paramIndex}`;
    params.push(periodStart);
    paramIndex++;
  }

  if (periodEnd) {
    dateFilter += ` AND l.created_at <= $${paramIndex}`;
    params.push(periodEnd);
    paramIndex++;
  }

  const result = await pool.query(
    `SELECT
       lso.source_name,
       lso.source_type,
       COUNT(l.*) as total_leads,
       COUNT(CASE WHEN l.assigned_to IS NOT NULL THEN 1 END) as assigned_leads,
       COUNT(CASE WHEN ls.conversion_stage = 'converted' THEN 1 END) as converted_leads,
       COALESCE(SUM(CASE WHEN ls.conversion_stage = 'converted' THEN l.lead_value ELSE 0 END), 0) as total_revenue,
       ROUND(
         CASE
           WHEN COUNT(l.*) > 0 THEN
             (COUNT(CASE WHEN ls.conversion_stage = 'converted' THEN 1 END)::numeric / COUNT(l.*)::numeric) * 100
           ELSE 0
         END, 2
       ) as conversion_rate,
       COALESCE(AVG(CASE WHEN ls.conversion_stage = 'converted' THEN l.lead_value END), 0) as avg_deal_value
     FROM lead_sources lso
     LEFT JOIN leads l ON lso.id = l.lead_source_id AND l.company_id = $1 ${dateFilter}
     LEFT JOIN lead_statuses ls ON l.status_id = ls.id
     WHERE lso.company_id = $1
     GROUP BY lso.id, lso.source_name, lso.source_type
     ORDER BY total_leads DESC`,
    params
  );

  return result.rows;
};

const getStatusWiseReport = async (companyId, filters) => {
  const { periodStart, periodEnd, statusIds, sourceIds } = filters;
  let dateFilter = '';
  const params = [companyId];
  let paramIndex = 2;

  if (periodStart) {
    dateFilter += ` AND l.created_at >= $${paramIndex}`;
    params.push(periodStart);
    paramIndex++;
  }

  if (periodEnd) {
    dateFilter += ` AND l.created_at <= $${paramIndex}`;
    params.push(periodEnd);
    paramIndex++;
  }

  if (statusIds && statusIds.length > 0) {
    dateFilter += ` AND ls.id = ANY($${paramIndex})`;
    params.push(statusIds);
    paramIndex++;
  }

  if (sourceIds && sourceIds.length > 0) {
    dateFilter += ` AND l.lead_source_id = ANY($${paramIndex})`;
    params.push(sourceIds);
    paramIndex++;
  }

  const result = await pool.query(
    `SELECT
       ls.id,
       ls.status_name,
       ls.status_color,
       COUNT(l.id) as count,
       ROUND(
         (COUNT(l.id)::numeric / NULLIF((SELECT COUNT(*) FROM leads l2 WHERE l2.company_id = $1 ${dateFilter.replace(/l\./g, 'l2.').replace(/ls\./g, 'l2.status_id = ANY')}), 0)) * 100,
         2
       ) as percentage
     FROM lead_statuses ls
     LEFT JOIN leads l ON ls.id = l.status_id AND l.company_id = $1 ${dateFilter}
     WHERE ls.company_id = $1
     GROUP BY ls.id, ls.status_name, ls.status_color
     ORDER BY ls.sort_order ASC`,
    params
  );

  return result.rows;
};

const getUserLeadOpsReport = async (companyId, filters) => {
  const { periodStart, periodEnd, staffIds } = filters;
  let dateFilter = '';
  let activityDateFilter = '';
  let followUpDateFilter = '';
  const params = [companyId];
  let paramIndex = 2;

  if (periodStart) {
    dateFilter += ` AND l.created_at >= $${paramIndex}`;
    activityDateFilter += ` AND la.created_at >= $${paramIndex}`;
    followUpDateFilter += ` AND fr.created_at >= $${paramIndex}`;
    params.push(periodStart);
    paramIndex++;
  }

  if (periodEnd) {
    dateFilter += ` AND l.created_at <= $${paramIndex}`;
    activityDateFilter += ` AND la.created_at <= $${paramIndex}`;
    followUpDateFilter += ` AND fr.created_at <= $${paramIndex}`;
    params.push(periodEnd);
    paramIndex++;
  }

  let userFilter = '';
  if (staffIds && staffIds.length > 0) {
    userFilter = ` AND s.id = ANY($${paramIndex})`;
    params.push(staffIds);
    paramIndex++;
  }

  const result = await pool.query(
    `SELECT
       s.id,
       CONCAT(s.first_name, ' ', s.last_name) as user_name,
       COUNT(DISTINCT l.id) as total_leads,
       COUNT(DISTINCT CASE
         WHEN l.last_contacted IS NOT NULL
           OR EXISTS (SELECT 1 FROM lead_activities la WHERE la.lead_id = l.id AND la.staff_id = s.id ${activityDateFilter.replace(/\$/g, '$')})
           OR EXISTS (SELECT 1 FROM follow_up_reminders fr WHERE fr.lead_id = l.id AND fr.staff_id = s.id ${followUpDateFilter.replace(/\$/g, '$')})
         THEN l.id
       END) as worked_count,
       COUNT(DISTINCT CASE
         WHEN l.last_contacted IS NULL
           AND NOT EXISTS (SELECT 1 FROM lead_activities la WHERE la.lead_id = l.id AND la.staff_id = s.id ${activityDateFilter.replace(/\$/g, '$')})
           AND NOT EXISTS (SELECT 1 FROM follow_up_reminders fr WHERE fr.lead_id = l.id AND fr.staff_id = s.id ${followUpDateFilter.replace(/\$/g, '$')})
         THEN l.id
       END) as not_worked_count,
       (
         SELECT COUNT(*)
         FROM lead_activities la
         WHERE la.staff_id = s.id AND la.activity_type = 'lead_transfer' ${activityDateFilter.replace(/\$/g, '$')}
       ) as transferred_out,
       COUNT(DISTINCT CASE WHEN l.assigned_by IS NOT NULL AND l.assigned_by != s.id THEN l.id END) as transferred_in
     FROM staff s
     LEFT JOIN leads l ON s.id = l.assigned_to AND l.company_id = $1 ${dateFilter}
     WHERE s.company_id = $1 AND s.status = 'active' ${userFilter}
     GROUP BY s.id, s.first_name, s.last_name
     ORDER BY total_leads DESC`,
    params
  );

  return result.rows;
};

const getUserStatusMatrix = async (companyId, filters) => {
  const { periodStart, periodEnd, staffIds, statusIds } = filters;
  let dateFilter = '';
  const params = [companyId];
  let paramIndex = 2;

  if (periodStart) {
    dateFilter += ` AND l.created_at >= $${paramIndex}`;
    params.push(periodStart);
    paramIndex++;
  }

  if (periodEnd) {
    dateFilter += ` AND l.created_at <= $${paramIndex}`;
    params.push(periodEnd);
    paramIndex++;
  }

  let userFilter = '';
  if (staffIds && staffIds.length > 0) {
    userFilter = ` AND s.id = ANY($${paramIndex})`;
    params.push(staffIds);
    paramIndex++;
  }

  let statusFilter = '';
  if (statusIds && statusIds.length > 0) {
    statusFilter = ` AND ls.id = ANY($${paramIndex})`;
    params.push(statusIds);
    paramIndex++;
  }

  const result = await pool.query(
    `SELECT
       s.id as staff_id,
       CONCAT(s.first_name, ' ', s.last_name) as user_name,
       ls.id as status_id,
       ls.status_name,
       ls.status_color,
       COUNT(l.id) as lead_count
     FROM staff s
     CROSS JOIN lead_statuses ls
     LEFT JOIN leads l ON s.id = l.assigned_to AND ls.id = l.status_id AND l.company_id = $1 ${dateFilter}
     WHERE s.company_id = $1 AND s.status = 'active' AND ls.company_id = $1 ${userFilter} ${statusFilter}
     GROUP BY s.id, s.first_name, s.last_name, ls.id, ls.status_name, ls.status_color, ls.sort_order
     ORDER BY s.id, ls.sort_order`,
    params
  );

  const matrix = {};
  result.rows.forEach(row => {
    if (!matrix[row.staff_id]) {
      matrix[row.staff_id] = {
        user_id: row.staff_id,
        user_name: row.user_name,
        statuses: []
      };
    }
    matrix[row.staff_id].statuses.push({
      status_id: row.status_id,
      status_name: row.status_name,
      status_color: row.status_color,
      count: parseInt(row.lead_count)
    });
  });

  return Object.values(matrix);
};

const getMostActiveStaff = async (companyId, startDate, endDate) => {
  const query = `
    SELECT
      s.id,
      CONCAT(s.first_name, ' ', s.last_name) as staff_name,
      COUNT(ual.id) as action_count,
      MAX(ual.created_at) as last_active
    FROM user_activity_logs ual
    JOIN staff s ON ual.staff_id = s.id
    WHERE ual.company_id = $1
      AND ual.created_at >= $2
      AND ual.created_at <= $3
      AND ual.action_type NOT LIKE 'VIEW%'
      AND ual.action_type NOT IN ('SEARCH', 'LOGOUT')
    GROUP BY s.id, s.first_name, s.last_name
    ORDER BY action_count DESC
    LIMIT 5
  `;
  const result = await pool.query(query, [companyId, startDate, endDate]);
  return result.rows;
};

const getMostValuableLeads = async (companyId) => {
  const query = `
    SELECT
      l.id,
      CONCAT(l.first_name, ' ', l.last_name) as lead_name,
      l.company_name,
      l.lead_value,
      ls.status_name,
      COALESCE(s.first_name || ' ' || s.last_name, 'Unassigned') as assigned_to
    FROM leads l
    LEFT JOIN lead_statuses ls ON l.status_id = ls.id
    LEFT JOIN staff s ON l.assigned_to = s.id
    WHERE l.company_id = $1
      AND l.lead_value > 0
      AND ls.is_final = false
    ORDER BY l.lead_value DESC
    LIMIT 5
  `;
  const result = await pool.query(query, [companyId]);
  return result.rows;
};

const getCompanyComprehensiveReport = async (companyId, filters) => {
  const { periodStart, periodEnd } = filters;

  const [
    generalMetrics,
    statusReport,
    sourceReport,
    topActiveStaff,
    topValuableLeads,
    staffPerformance
  ] = await Promise.all([
    getCompanyPerformanceMetrics(companyId, 'custom', periodStart, periodEnd, filters),

    getStatusWiseReport(companyId, filters),

    getSourcePerformanceReport(companyId, periodStart, periodEnd),

    getMostActiveStaff(companyId, periodStart, periodEnd),

    getMostValuableLeads(companyId),

    getAllStaffPerformance(companyId, 'custom', periodStart, periodEnd)
  ]);

  const topPerformers = staffPerformance
    .sort((a, b) => b.total_deal_value - a.total_deal_value)
    .slice(0, 5);

  return {
    overview: {
      total_leads: generalMetrics.total_leads,
      total_revenue: generalMetrics.total_revenue,
      conversion_rate: generalMetrics.overall_conversion_rate,
      active_staff_count: generalMetrics.active_staff_count
    },
    funnel_status: statusReport,
    lead_sources: sourceReport,
    top_performers: topPerformers,
    most_active_users: topActiveStaff,
    high_value_opportunities: topValuableLeads
  };
};

module.exports = {
  getStaffPerformanceMetrics,
  getAllStaffPerformance,
  getStaffTimeline,
  getKpiDashboardData,
  getCompanyPerformanceMetrics,
  getLeadConversionReport,
  getSourcePerformanceReport,
  getStatusWiseReport,
  getUserLeadOpsReport,
  getUserStatusMatrix,
  getCompanyComprehensiveReport,
  getMostActiveStaff,
  getMostValuableLeads
};