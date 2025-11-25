const {
  getUserActivityLogs,
  getSystemLogs,
  getActivitySummary,
  cleanOldLogs,
  getTotalLogsCount,
  getTotalSystemLogsCount,
  getActionTypes,
  getResourceTypes
} = require('../models/loggingModel');
const { successResponse, successResponseWithPagination } = require('../utils/responseFormatter');
const { errorResponse } = require('../utils/errorResponse');
const { parseAndConvertToUTC } = require('../utils/timezoneHelper');

const getUserLogs = async (req, res) => {
  try {
    const company_id = req.company.id;
    const {
      staff_id,
      action_type,
      resource_type,
      start_date: raw_start_date,
      end_date: raw_end_date,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const start_date = raw_start_date ? parseAndConvertToUTC(raw_start_date, req.timezone) : null;
    const end_date = raw_end_date ? parseAndConvertToUTC(raw_end_date, req.timezone) : null;

    const filters = {
      company_id,
      staff_id: staff_id ? parseInt(staff_id) : null,
      action_type,
      resource_type,
      start_date,
      end_date,
      search,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    const [logs, totalCount] = await Promise.all([
      getUserActivityLogs(filters),
      getTotalLogsCount({
        company_id,
        staff_id: staff_id ? parseInt(staff_id) : null,
        action_type,
        resource_type,
        start_date,
        end_date,
        search
      })
    ]);

    const totalPages = Math.ceil(totalCount / parsedLimit);

    return successResponseWithPagination(res, "User activity logs retrieved successfully", logs, {
      page: parsedPage,
      limit: parsedLimit,
      total_records: totalCount,
      total_pages: totalPages
    }, 200, req);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

const getSystemEventLogs = async (req, res) => {
  try {
    const company_id = req.company.id;

    const {
      staff_id,
      log_level,
      log_category,
      start_date: raw_start_date,
      end_date: raw_end_date,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const start_date = raw_start_date ? parseAndConvertToUTC(raw_start_date, req.timezone) : null;
    const end_date = raw_end_date ? parseAndConvertToUTC(raw_end_date, req.timezone) : null;

    const filters = {
      company_id,
      staff_id: staff_id ? parseInt(staff_id) : null,
      log_level,
      log_category,
      start_date,
      end_date,
      search,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    const [logs, totalCount] = await Promise.all([
        getSystemLogs(filters),
        getTotalSystemLogsCount(filters)
    ]);

    const totalPages = Math.ceil(totalCount / parsedLimit);

    return successResponseWithPagination(res, "System logs retrieved successfully", logs, {
      page: parsedPage,
      limit: parsedLimit,
      total_records: totalCount,
      total_pages: totalPages
    }, 200, req);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

const getActivityDashboard = async (req, res) => {
  try {
    const company_id = req.company.id;
    const { days = 7 } = req.query;

    const summary = await getActivitySummary(company_id, parseInt(days));

    const processedData = processActivitySummary(summary);

    return successResponse(res, "Activity summary retrieved successfully", processedData, 200, req);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

const getStaffActivitySummary = async (req, res) => {
  try {
    const company_id = req.company.id;
    const staff_id = req.params.staff_id;
    const { start_date: raw_start_date, end_date: raw_end_date } = req.query;

    const start_date = raw_start_date ? parseAndConvertToUTC(raw_start_date, req.timezone) : null;
    const end_date = raw_end_date ? parseAndConvertToUTC(raw_end_date, req.timezone) : null;

    const filters = {
      company_id,
      staff_id: parseInt(staff_id),
      start_date,
      end_date,
      limit: 1000
    };

    const logs = await getUserActivityLogs(filters);

    const summary = processStaffActivity(logs);

    return successResponse(res, "Staff activity summary retrieved successfully", summary, 200, req);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

const exportLogs = async (req, res) => {
  try {
    const company_id = req.company.id;
    const {
      type = 'activity',
      start_date: raw_start_date,
      end_date: raw_end_date,
      staff_id,
      action_type,
      search
    } = req.query;

    const start_date = raw_start_date ? parseAndConvertToUTC(raw_start_date, req.timezone) : null;
    const end_date = raw_end_date ? parseAndConvertToUTC(raw_end_date, req.timezone) : null;

    let logs;
    let filename;

    const baseFilters = {
        company_id,
        start_date,
        end_date,
        search,
        limit: 10000
    };

    if (type === 'activity') {
      const filters = {
        ...baseFilters,
        staff_id: staff_id ? parseInt(staff_id) : null,
        action_type
      };
      logs = await getUserActivityLogs(filters);
      filename = `activity-logs-${Date.now()}.csv`;
    } else if (type === 'system') {
      logs = await getSystemLogs(baseFilters);
      filename = `system-logs-${Date.now()}.csv`;
    } else {
        return errorResponse(res, 400, "Invalid export type. Must be 'activity' or 'system'.");
    }

    const csv = convertLogsToCSV(logs, type);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).send(csv);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

const cleanupOldLogs = async (req, res) => {
  try {
    const { days_to_keep = 90 } = req.body;

    const result = await cleanOldLogs(parseInt(days_to_keep));

    return successResponse(res, "Old logs cleaned successfully", result, 200, req);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

const processActivitySummary = (summary) => {
  const actionTypes = {};
  const dailyActivity = {};

  summary.forEach(item => {
    if (!actionTypes[item.action_type]) {
      actionTypes[item.action_type] = 0;
    }
    actionTypes[item.action_type] += parseInt(item.count);

    if (!dailyActivity[item.date]) {
      dailyActivity[item.date] = 0;
    }
    dailyActivity[item.date] += parseInt(item.count);
  });

  return {
    action_types: actionTypes,
    daily_activity: dailyActivity,
    raw_data: summary
  };
};

const processStaffActivity = (logs) => {
  const summary = {
    total_actions: logs.length,
    action_breakdown: {},
    resource_breakdown: {},
    hourly_activity: Array(24).fill(0)
  };

  logs.forEach(log => {
    if (!summary.action_breakdown[log.action_type]) {
      summary.action_breakdown[log.action_type] = 0;
    }
    summary.action_breakdown[log.action_type]++;

    if (!summary.resource_breakdown[log.resource_type]) {
      summary.resource_breakdown[log.resource_type] = 0;
    }
    summary.resource_breakdown[log.resource_type]++;

    // Use current date to determine hour if created_at is a string,
    // ideally it should be parsed back to a Date object first,
    // but here we rely on the model returning a string representation of UTC time.
    const hour = new Date(log.created_at).getHours();
    summary.hourly_activity[hour]++;
  });

  return summary;
};

const convertLogsToCSV = (logs, type) => {
  if (logs.length === 0) return '';

  let headers;
  let rows;

  if (type === 'activity') {
    headers = [
      'Date', 'Staff Name', 'Email', 'Action Type',
      'Resource Type', 'Resource ID', 'Action Details', 'IP Address'
    ];

    rows = logs.map(log => [
      log.created_at, // ISO string from model
      `${log.first_name || ''} ${log.last_name || ''}`.trim() || 'System',
      log.email || '',
      log.action_type || '',
      log.resource_type || '',
      log.resource_id || '',
      log.action_details || '',
      log.ip_address || ''
    ]);
  } else {
    headers = [
      'Date', 'Company', 'Staff Name', 'Level', 'Category', 'Message'
    ];

    rows = logs.map(log => [
      log.created_at, // ISO string from model
      log.company_name || '',
      `${log.first_name || ''} ${log.last_name || ''}`.trim() || 'System',
      log.log_level || '',
      log.log_category || '',
      log.message || ''
    ]);
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field ? String(field).replace(/"/g, '""') : ''}"`).join(','))
  ].join('\n');

  return csvContent;
};

module.exports = {
  getUserLogs,
  getSystemEventLogs,
  getActivityDashboard,
  getStaffActivitySummary,
  exportLogs,
  cleanupOldLogs,
  getActionTypes,
  getResourceTypes
};
