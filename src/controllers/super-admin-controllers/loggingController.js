const {
  getUserActivityLogs,
  getSystemLogs,
  getTotalLogsCount,
  getTotalSystemLogsCount
} = require('../../models/loggingModel');
const { successResponse } = require('../../utils/successResponse');
const { errorResponse } = require('../../utils/errorResponse');

const getAllCompanyLogs = async (req, res) => {
  try {
    const {
      company_id,
      staff_id,
      action_type,
      resource_type,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;

    // If company_id is provided, use it. If it's not provided, set to undefined
    // to retrieve logs for ALL companies (handled by the fixed model).
    const resolved_company_id = company_id ? parseInt(company_id) : undefined;

    // Allow 'company_id=null' query to fetch ONLY Super Admin actions
    const final_company_id = company_id === 'null' ? null : resolved_company_id;

    const filters = {
      company_id: final_company_id,
      staff_id: staff_id ? parseInt(staff_id) : null,
      action_type,
      resource_type,
      start_date,
      end_date,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    const [logs, totalCount] = await Promise.all([
      getUserActivityLogs(filters),
      getTotalLogsCount(filters)
    ]);

    const totalPages = Math.ceil(totalCount / parsedLimit);

    return successResponse(res, "All company activity logs retrieved successfully", {
      logs,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total_records: totalCount,
        total_pages: totalPages,
        has_next: parsedPage < totalPages,
        has_prev: parsedPage > 1
      }
    });
  } catch (error) {
    console.error('Get all company logs error:', error);
    return errorResponse(res, 500, error.message);
  }
};

const getCompanyLogs = async (req, res) => {
  try {
    const company_id = parseInt(req.params.companyId);
    if (isNaN(company_id)) {
        return errorResponse(res, 400, "Invalid Company ID in URL parameter.");
    }

    const {
      staff_id,
      action_type,
      resource_type,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;

    const filters = {
      company_id,
      staff_id: staff_id ? parseInt(staff_id) : null,
      action_type,
      resource_type,
      start_date,
      end_date,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    const [logs, totalCount] = await Promise.all([
      getUserActivityLogs(filters),
      getTotalLogsCount(filters)
    ]);

    const totalPages = Math.ceil(totalCount / parsedLimit);

    return successResponse(res, "Company activity logs retrieved successfully", {
      logs,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total_records: totalCount,
        total_pages: totalPages,
        has_next: parsedPage < totalPages,
        has_prev: parsedPage > 1
      }
    });
  } catch (error) {
    console.error('Get company logs error:', error);
    return errorResponse(res, 500, error.message);
  }
};

const getAllSystemLogs = async (req, res) => {
  try {
    const {
      company_id,
      staff_id,
      log_level,
      log_category,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;

    // Resolve company_id: undefined for all, parsed ID for filter, null for only system-wide
    const resolved_company_id = company_id ? parseInt(company_id) : undefined;
    const final_company_id = company_id === 'null' ? null : resolved_company_id;

    const filters = {
      company_id: final_company_id,
      staff_id: staff_id ? parseInt(staff_id) : null,
      log_level,
      log_category,
      start_date,
      end_date,
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

    return successResponse(res, "All system logs retrieved successfully", {
      logs,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total_records: totalCount,
        total_pages: totalPages,
        has_next: parsedPage < totalPages,
        has_prev: parsedPage > 1
      }
    });
  } catch (error) {
    console.error('Get all system logs error:', error);
    return errorResponse(res, 500, error.message);
  }
};

const exportAllCompanyLogs = async (req, res) => {
  try {
    const {
      company_id,
      type = 'activity',
      start_date,
      end_date,
      staff_id,
      action_type,
      resource_type
    } = req.query;

    let logs;
    let filename;

    const resolved_company_id = company_id ? parseInt(company_id) : undefined;
    const final_company_id = company_id === 'null' ? null : resolved_company_id;

    const baseFilters = {
        company_id: final_company_id,
        staff_id: staff_id ? parseInt(staff_id) : null,
        start_date,
        end_date,
        limit: 100000
    };

    if (type === 'activity') {
      const filters = {
          ...baseFilters,
          action_type,
          resource_type
      };

      logs = await getUserActivityLogs(filters);
      filename = `superadmin-activity-logs-${Date.now()}.csv`;
    } else if (type === 'system') {
      // System logs do not use action_type/resource_type for filtering
      logs = await getSystemLogs(baseFilters);
      filename = `superadmin-system-logs-${Date.now()}.csv`;
    } else {
        return errorResponse(res, 400, "Invalid export type. Must be 'activity' or 'system'.");
    }

    const csv = convertLogsToCSV(logs, type);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).send(csv);
  } catch (error) {
    console.error('Export logs error:', error);
    return errorResponse(res, 500, error.message);
  }
};

const convertLogsToCSV = (logs, type) => {
  if (logs.length === 0) return 'No data available';

  let headers;
  let rows;

  if (type === 'activity') {
    headers = [
      'Date',
      'Time',
      'Company',
      'User Type',
      'User Name',
      'Email',
      'Action Type',
      'Resource Type',
      'Resource ID',
      'Action Details',
      'IP Address'
    ];

    rows = logs.map(log => {
      const date = new Date(log.created_at);
      return [
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        log.company_name || 'N/A',
        log.user_type || 'Unknown',
        `${log.first_name || ''} ${log.last_name || ''}`.trim() || 'System',
        log.email || 'N/A',
        log.action_type || 'N/A',
        log.resource_type || 'N/A',
        log.resource_id || 'N/A',
        (log.action_details || '').replace(/"/g, '""'),
        log.ip_address || 'N/A'
      ];
    });
  } else {
    headers = [
      'Date',
      'Time',
      'Company',
      'User Name',
      'Email',
      'Staff ID',
      'Level',
      'Category',
      'IP Address',
      'Message'
    ];

    rows = logs.map(log => {
      const date = new Date(log.created_at);
      return [
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        log.company_name || 'N/A',
        `${log.first_name || ''} ${log.last_name || ''}`.trim() || 'System',
        log.email || 'N/A',
        log.staff_id || 'N/A',
        log.log_level || 'N/A',
        log.log_category || 'N/A',
        log.ip_address || 'N/A',
        (log.message || '').replace(/"/g, '""')
      ];
    });
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');

  return csvContent;
};

module.exports = {
  getAllCompanyLogs,
  getCompanyLogs,
  getAllSystemLogs,
  exportAllCompanyLogs
};