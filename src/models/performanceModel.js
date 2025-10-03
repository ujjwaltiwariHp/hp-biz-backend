const pool = require("../config/database");

const getStaffPerformanceMetrics = async (staffId, companyId, periodType = 'monthly', periodStart = null, periodEnd = null) => {
  let dateFilter = '';
  const params = [staffId, companyId];

  if (periodStart && periodEnd) {
    dateFilter = ` AND l.created_at >= $3 AND l.created_at <= $4`;
    params.push(periodStart, periodEnd);
  } else {
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

    dateFilter = ` AND l.created_at >= $3`;
    params.push(startDate);
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
     WHERE la.staff_id = $1 AND l.company_id = $2 ${dateFilter}`,
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

  if (periodStart && periodEnd) {
    dateFilter = ` AND l.created_at >= $2 AND l.created_at <= $3`;
    params.push(periodStart, periodEnd);
  } else {
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

    dateFilter = ` AND l.created_at >= $2`;
    params.push(startDate);
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

  dateFilter = ` AND l.created_at >= $2`;
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

const getCompanyPerformanceMetrics = async (companyId, periodType = 'monthly', periodStart = null, periodEnd = null) => {
  let dateFilter = '';
  const params = [companyId];

  if (periodStart && periodEnd) {
    dateFilter = ` AND l.created_at >= $2 AND l.created_at <= $3`;
    params.push(periodStart, periodEnd);
  } else {
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

    dateFilter = ` AND l.created_at >= $2`;
    params.push(startDate);
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
     GROUP BY lso.id, lso.source_name
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

  if (periodStart && periodEnd) {
    dateFilter = ` AND l.created_at >= $2 AND l.created_at <= $3`;
    params.push(periodStart, periodEnd);
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

  if (periodStart && periodEnd) {
    dateFilter = ` AND l.created_at >= $2 AND l.created_at <= $3`;
    params.push(periodStart, periodEnd);
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

module.exports = {
  getStaffPerformanceMetrics,
  getAllStaffPerformance,
  getStaffTimeline,
  getKpiDashboardData,
  getCompanyPerformanceMetrics,
  getLeadConversionReport,
  getSourcePerformanceReport
};