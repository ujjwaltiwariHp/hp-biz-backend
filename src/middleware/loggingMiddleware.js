const { logUserActivity, logSystemEvent } = require('../models/loggingModel');

const getClientIP = (req) => {
  if (req.ip) {
      if (req.ip.startsWith('::ffff:')) {
          return req.ip.substring(7);
      }
      if (req.ip === '::1') {
          return '127.0.0.1';
      }
      return req.ip;
  }

  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }

  return req.headers['x-real-ip'] ||
         req.headers['cf-connecting-ip'] ||
         req.headers['x-client-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.connection?.socket?.remoteAddress ||
         '0.0.0.0';
};

const normalizeIP = (ip) => {
  if (!ip) return '0.0.0.0';
  if (ip.startsWith('::ffff:')) return ip.substring(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
};

const logActivity = (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  let responseSent = false;

  const logAfterResponse = () => {
    if (responseSent) return;
    responseSent = true;

    setImmediate(async () => {
      try {
        let staff_id = null;
        let company_id = null;
        let super_admin_id = null;

        if (req.userType === 'staff' && req.staff) {
          staff_id = req.staff.id;
          company_id = req.staff.company_id;
        } else if (req.userType === 'admin' && req.company) {
          company_id = req.company.id;
        } else if (req.userType === 'super_admin' && req.superAdmin) {
          super_admin_id = req.superAdmin.id;

          if (req.params && req.params.companyId) {
            company_id = parseInt(req.params.companyId);
          } else if (req.baseUrl && req.baseUrl.includes('/companies') && req.params && req.params.id) {
            company_id = parseInt(req.params.id);
          } else if (req.body && req.body.company_id) {
            company_id = parseInt(req.body.company_id);
          }
        }

        const action_type = getActionType(req.method, req.originalUrl);

        if (!shouldLogActivity(action_type, req.originalUrl)) {
          return;
        }

        const resource_info = getResourceInfo(req.originalUrl, req.body, req.params);
        const rawIP = getClientIP(req);
        const ip_address = normalizeIP(rawIP);

        let actionDetails = `${req.method} ${req.originalUrl}`;

        if (req.body && req.body.lead_ids && Array.isArray(req.body.lead_ids)) {
            actionDetails += ` (Bulk Action: ${req.body.lead_ids.length} items)`;
        }

        const activityData = {
          staff_id,
          company_id,
          super_admin_id,
          action_type,
          resource_type: resource_info.resource_type,
          resource_id: resource_info.resource_id,
          action_details: actionDetails,
          ip_address
        };

        await logUserActivity(activityData);

      } catch (error) {
        console.error('Failed to log user activity:', error);
      }
    });
  };

  res.send = function(data) {
    logAfterResponse();
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    logAfterResponse();
    return originalJson.call(this, data);
  };

  res.end = function(chunk, encoding) {
    logAfterResponse();
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

const getActionType = (method, url) => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('/login')) return 'LOGIN';
  if (lowerUrl.includes('/logout')) return 'LOGOUT';
  if (lowerUrl.includes('/register') || lowerUrl.includes('/signup')) return 'REGISTER';
  if (lowerUrl.includes('/verify-otp')) return 'VERIFY_OTP';
  if (lowerUrl.includes('/forgot-password')) return 'FORGOT_PASSWORD';
  if (lowerUrl.includes('/reset-password')) return 'RESET_PASSWORD';
  if (lowerUrl.includes('/change-password')) return 'CHANGE_PASSWORD';
  if (lowerUrl.includes('/profile') && method === 'PUT') return 'UPDATE_PROFILE';
  if (lowerUrl.includes('/profile') && method === 'GET') return 'VIEW_PROFILE';

  switch (method) {
    case 'GET':
      if (lowerUrl.includes('/export')) return 'EXPORT';
      if (lowerUrl.includes('/download')) return 'DOWNLOAD';
      if (lowerUrl.includes('/dashboard')) return 'VIEW_DASHBOARD';
      if (lowerUrl.includes('/reports')) return 'VIEW_REPORT';
      if (lowerUrl.includes('/performance')) return 'VIEW_PERFORMANCE';
      if (lowerUrl.includes('/search')) return 'SEARCH';
      if (url.match(/\/\d+$/)) return 'VIEW_DETAILS';
      return 'VIEW';
    case 'POST':
      if (lowerUrl.includes('/bulk')) return 'BULK_CREATE';
      if (lowerUrl.includes('/import')) return 'IMPORT';
      if (lowerUrl.includes('/assign')) return 'ASSIGN';
      if (lowerUrl.includes('/distribute')) return 'DISTRIBUTE';
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      if (lowerUrl.includes('/bulk')) return 'BULK_UPDATE';
      if (lowerUrl.includes('/assign')) return 'ASSIGN';
      if (lowerUrl.includes('/status')) return 'UPDATE_STATUS';
      if (lowerUrl.includes('/complete')) return 'COMPLETE';
      if (lowerUrl.includes('/activate')) return 'ACTIVATE';
      if (lowerUrl.includes('/deactivate')) return 'DEACTIVATE';
      return 'UPDATE';
    case 'DELETE':
      if (lowerUrl.includes('/bulk')) return 'BULK_DELETE';
      return 'DELETE';
    default:
      return 'UNKNOWN';
  }
};

const getResourceInfo = (url, body = {}, params = {}) => {
  let resource_type = 'unknown';
  let resource_id = null;
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('/leads') || lowerUrl.includes('/lead/')) resource_type = 'lead';
  else if (lowerUrl.includes('/staff')) resource_type = 'staff';
  else if (lowerUrl.includes('/companies') || lowerUrl.includes('/company')) resource_type = 'company';
  else if (lowerUrl.includes('/roles') || lowerUrl.includes('/role/')) resource_type = 'role';
  else if (lowerUrl.includes('/sources') || lowerUrl.includes('/lead-sources')) resource_type = 'lead_source';
  else if (lowerUrl.includes('/statuses') || lowerUrl.includes('/lead-statuses')) resource_type = 'lead_status';
  else if (lowerUrl.includes('/tags') || lowerUrl.includes('/lead-tags')) resource_type = 'lead_tag';
  else if (lowerUrl.includes('/follow-ups') || lowerUrl.includes('/reminders')) resource_type = 'follow_up_reminder';
  else if (lowerUrl.includes('/performance')) resource_type = 'performance';
  else if (lowerUrl.includes('/reports')) resource_type = 'report';
  else if (lowerUrl.includes('/dashboard')) resource_type = 'dashboard';
  else if (lowerUrl.includes('/settings')) resource_type = 'company_settings';
  else if (lowerUrl.includes('/notifications')) resource_type = 'notification';
  else if (lowerUrl.includes('/profile')) resource_type = 'profile';
  else if (lowerUrl.includes('/auth')) resource_type = 'auth';

  else if (lowerUrl.includes('/super-admin/')) {
    if (lowerUrl.includes('/subscriptions')) resource_type = 'subscription';
    if (lowerUrl.includes('/payments')) resource_type = 'payment';
    if (lowerUrl.includes('/invoices')) resource_type = 'invoice';
    if (lowerUrl.includes('/logs')) resource_type = 'logging';
    if (lowerUrl.includes('/companies')) resource_type = 'company';
  }

  if (params && params.id) {
    resource_id = parseInt(params.id);
  } else if (params && params.companyId) {
    resource_id = parseInt(params.companyId);
  } else if (params && params.staffId) {
    resource_id = parseInt(params.staffId);
  } else if (body) {
    if (body.id) {
      resource_id = parseInt(body.id);
    } else if (body.lead_ids && Array.isArray(body.lead_ids) && body.lead_ids.length > 0) {
      resource_id = parseInt(body.lead_ids[0]);
    }
  }

  if (isNaN(resource_id)) resource_id = null;

  return { resource_type, resource_id };
};

const shouldLogActivity = (action_type, url) => {
  const skipPatterns = [
    '/health', '/status', '/ping', '/favicon', '/assets',
    '/static', '/docs', '/api-docs', '/swagger', '/activity', '/stream'
  ];

  if (!action_type) return false;
  if (skipPatterns.some(pattern => url.includes(pattern))) return false;

  if (action_type === 'VIEW' &&
      !url.includes('/profile') &&
      !url.includes('/dashboard') &&
      !url.includes('/reports') &&
      !url.match(/\/\d+$/)
    ) {
    return false;
  }

  return true;
};

const globalLogActivity = (req, res, next) => {
  if (req.originalUrl.includes('/docs') ||
      req.originalUrl.includes('/health') ||
      req.originalUrl.includes('/favicon') ||
      req.originalUrl.includes('/swagger')) {
    return next();
  }
  return logActivity(req, res, next);
};

const logSystemActivity = (level, category, message) => {
  return async (req, res, next) => {
    try {
      let staff_id = null;
      let company_id = null;
      let super_admin_id = null;

      if (req.userType === 'staff' && req.staff) {
        staff_id = req.staff.id;
        company_id = req.staff.company_id;
      } else if (req.userType === 'admin' && req.company) {
        company_id = req.company.id;
      } else if (req.userType === 'super_admin' && req.superAdmin) {
        super_admin_id = req.superAdmin.id;
      }

      const rawIP = getClientIP(req);
      const ip_address = normalizeIP(rawIP);

      const logData = {
        company_id,
        staff_id,
        super_admin_id,
        log_level: level.toUpperCase(),
        log_category: category,
        message: `${message} - ${req.method} ${req.originalUrl}`,
        ip_address
      };

      await logSystemEvent(logData);
    } catch (error) {
      console.error('Failed to log system activity:', error);
    }
    next();
  };
};

const logError = async (err, req, res, next) => {
  try {
    let user_id = null;
    let user_type = 'System';
    let company_id = null;
    let email = 'N/A';
    let staff_id_for_log = null;
    let super_admin_id = null;

    if (req.superAdmin) {
      user_id = req.superAdmin.id;
      super_admin_id = req.superAdmin.id;
      user_type = 'Super Admin';
      email = req.superAdmin.email;
    } else if (req.staff) {
      user_id = req.staff.id;
      user_type = 'Staff';
      company_id = req.staff.company_id;
      email = req.staff.email;
      staff_id_for_log = req.staff.id;
    } else if (req.company) {
      user_id = req.company.id;
      user_type = 'Company Admin';
      company_id = req.company.id;
      email = req.company.admin_email;
    }

    const rawIP = getClientIP(req);
    const ip_address = normalizeIP(rawIP);

    const logData = {
      company_id,
      staff_id: staff_id_for_log,
      super_admin_id,
      log_level: 'ERROR',
      log_category: 'api',
      message: `Error: ${err.message} | User: ${email} (${user_type}) | ${req.method} ${req.originalUrl}`,
      ip_address
    };

    await logSystemEvent(logData);
  } catch (error) {
    console.error('Failed to log error:', error);
  }

  next(err);
};

module.exports = {
  logActivity,
  globalLogActivity,
  logSystemActivity,
  logError,
  logSecurityEvent: (eventType, message, severity) => logSystemActivity(severity, 'security', `${eventType}: ${message}`),
  getClientIP
};