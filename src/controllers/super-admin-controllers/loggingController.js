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
      user_id,
      super_admin_id,
      action_type,
      resource_type,
      start_date,
      end_date,
      search,
      page = 1,
      limit = 50
    } = req.query;

    let final_company_id = undefined;
    if (company_id !== undefined) {
        if (company_id === 'null') {
            final_company_id = null;
        } else if (!isNaN(parseInt(company_id))) {
            final_company_id = parseInt(company_id);
        }
    }

    const target_user_id = staff_id ? parseInt(staff_id) : (user_id ? parseInt(user_id) : null);
    const target_super_admin_id = super_admin_id ? parseInt(super_admin_id) : null;

    const filters = {
      company_id: final_company_id,
      staff_id: target_user_id,
      super_admin_id: target_super_admin_id,
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
      getTotalLogsCount(filters)
    ]);

    const totalPages = Math.ceil(totalCount / parsedLimit);

    return successResponse(res, "All activity logs retrieved successfully", {
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
    console.error('Get all logs error:', error);
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
      super_admin_id,
      log_level,
      log_category,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;

    let final_company_id = undefined;
    if (company_id !== undefined) {
        if (company_id === 'null') {
            final_company_id = null;
        } else if (!isNaN(parseInt(company_id))) {
            final_company_id = parseInt(company_id);
        }
    }

    const filters = {
      company_id: final_company_id,
      staff_id: staff_id ? parseInt(staff_id) : null,
      super_admin_id: super_admin_id ? parseInt(super_admin_id) : null,
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
      user_id,
      super_admin_id,
      action_type,
      resource_type
    } = req.query;

    let logs;
    let filename;

    let final_company_id = undefined;
    if (company_id !== undefined) {
        if (company_id === 'null') {
            final_company_id = null;
        } else if (!isNaN(parseInt(company_id))) {
            final_company_id = parseInt(company_id);
        }
    }

    const target_user_id = staff_id ? parseInt(staff_id) : (user_id ? parseInt(user_id) : null);
    const target_super_admin_id = super_admin_id ? parseInt(super_admin_id) : null;

    const baseFilters = {
        company_id: final_company_id,
        staff_id: target_user_id,
        super_admin_id: target_super_admin_id,
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
      filename = `logs-activity-${Date.now()}.csv`;
    } else if (type === 'system') {
      logs = await getSystemLogs(baseFilters);
      filename = `logs-system-${Date.now()}.csv`;
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

  const sanitize = (str) => {
    if (!str) return '';
    const s = String(str).replace(/"/g, '""');
    if (/^[=+\-@]/.test(s)) {
      return `'${s}`;
    }
    return s;
  };

  let headers;
  let rows;

  if (type === 'activity') {
    headers = [
      'Date',
      'User Name',
      'User Type',
      'Company',
      'Email',
      'Action Type',
      'Resource Type',
      'Resource ID',
      'Action Details',
      'IP Address'
    ];

    rows = logs.map(log => {
      return [
        log.created_at,
        log.user_name || 'Unknown',
        log.user_type || 'Unknown',
        log.company_name || 'N/A',
        log.email || 'N/A',
        log.action_type || 'N/A',
        log.resource_type || 'N/A',
        log.resource_id || 'N/A',
        log.action_details || '',
        log.ip_address || 'N/A'
      ];
    });
  } else {
    headers = [
      'Date',
      'Company',
      'User Name',
      'Email',
      'Level',
      'Category',
      'IP Address',
      'Message'
    ];

    rows = logs.map(log => {
      return [
        log.created_at,
        log.company_name || 'N/A',
        log.user_name || 'Unknown',
        log.email || 'N/A',
        log.log_level || 'N/A',
        log.log_category || 'N/A',
        log.ip_address || 'N/A',
        log.message || ''
      ];
    });
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${sanitize(field)}"`).join(','))
  ].join('\n');

  return csvContent;
};

module.exports = {
  getAllCompanyLogs,
  getCompanyLogs,
  getAllSystemLogs,
  exportAllCompanyLogs
};