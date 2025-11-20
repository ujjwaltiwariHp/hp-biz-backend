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

  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }

  if (ip === '::1') {
    return '127.0.0.1';
  }

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

        if (req.userType === 'staff' && req.staff) {
          staff_id = req.staff.id;
          company_id = req.staff.company_id || (req.company ? req.company.id : null);
        } else if (req.userType === 'admin' && req.company) {
          company_id = req.company.id;
          staff_id = null;
        } else if (req.superAdmin) {
            staff_id = req.superAdmin.id;
            company_id = null;
        }

        if (!company_id && !staff_id) {
          return;
        }

        const action_type = getActionType(req.method, req.originalUrl);

        if (!shouldLogActivity(action_type, req.originalUrl)) {
          return;
        }

        const resource_info = getResourceInfo(req.originalUrl, req.body, req.params);
        const rawIP = getClientIP(req);
        const ip_address = normalizeIP(rawIP);

        const actionDetails = `${req.method} ${req.originalUrl}`;

        const activityData = {
          staff_id,
          company_id,
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
  if (url.includes('/login')) return 'LOGIN';
  if (url.includes('/logout')) return 'LOGOUT';
  if (url.includes('/register') || url.includes('/signup')) return 'REGISTER';
  if (url.includes('/verify-otp')) return 'VERIFY_OTP';
  if (url.includes('/forgot-password')) return 'FORGOT_PASSWORD';
  if (url.includes('/reset-password')) return 'RESET_PASSWORD';
  if (url.includes('/change-password')) return 'CHANGE_PASSWORD';
  if (url.includes('/profile') && method === 'PUT') return 'UPDATE_PROFILE';
  if (url.includes('/profile') && method === 'GET') return 'VIEW_PROFILE';

  switch (method) {
    case 'GET':
      if (url.includes('/export')) return 'EXPORT';
      if (url.includes('/download')) return 'DOWNLOAD';
      if (url.includes('/dashboard')) return 'VIEW_DASHBOARD';
      if (url.includes('/reports')) return 'VIEW_REPORT';
      if (url.includes('/performance')) return 'VIEW_PERFORMANCE';
      if (url.includes('/search')) return 'SEARCH';
      if (url.match(/\/\d+$/)) return 'VIEW_DETAILS';
      return 'VIEW';
    case 'POST':
      if (url.includes('/bulk')) return 'BULK_CREATE';
      if (url.includes('/import')) return 'IMPORT';
      if (url.includes('/assign')) return 'ASSIGN';
      if (url.includes('/distribute')) return 'DISTRIBUTE';
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      if (url.includes('/bulk')) return 'BULK_UPDATE';
      if (url.includes('/assign')) return 'ASSIGN';
      if (url.includes('/status')) return 'UPDATE_STATUS';
      if (url.includes('/complete')) return 'COMPLETE';
      if (url.includes('/activate')) return 'ACTIVATE';
      if (url.includes('/deactivate')) return 'DEACTIVATE';
      return 'UPDATE';
    case 'DELETE':
      if (url.includes('/bulk')) return 'BULK_DELETE';
      return 'DELETE';
    default:
      return 'UNKNOWN';
  }
};

const getResourceInfo = (url, body = {}, params = {}) => {
  let resource_type = 'unknown';
  let resource_id = null;

  if (url.includes('/leads') || url.includes('/lead/')) {
    resource_type = 'lead';
    const match = url.match(/\/leads?\/(\d+)/) || url.match(/\/lead\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  else if (url.includes('/staff')) {
    resource_type = 'staff';
    const match = url.match(/\/staff\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  else if (url.includes('/companies') || url.includes('/company')) {
    resource_type = 'company';
    const match = url.match(/\/compan(?:y|ies)\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.companyId ? parseInt(params.companyId) : (params.id ? parseInt(params.id) : null));
  }
  else if (url.includes('/roles') || url.includes('/role/')) {
    resource_type = 'role';
    const match = url.match(/\/roles?\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  else if (url.includes('/sources') || url.includes('/lead-sources')) {
    resource_type = 'lead_source';
    const match = url.match(/\/(?:sources|lead-sources)\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  else if (url.includes('/statuses') || url.includes('/lead-statuses')) {
    resource_type = 'lead_status';
    const match = url.match(/\/(?:statuses|lead-statuses)\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  else if (url.includes('/tags') || url.includes('/lead-tags')) {
    resource_type = 'lead_tag';
    const match = url.match(/\/(?:tags|lead-tags)\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  else if (url.includes('/follow-ups') || url.includes('/reminders')) {
    resource_type = 'follow_up_reminder';
    const match = url.match(/\/(?:follow-ups|reminders)\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  else if (url.includes('/performance')) {
    resource_type = 'performance';
  }
  else if (url.includes('/reports')) {
    resource_type = 'report';
  }
  else if (url.includes('/dashboard')) {
    resource_type = 'dashboard';
  }
  else if (url.includes('/settings')) {
    resource_type = 'company_settings';
  }
  else if (url.includes('/notifications')) {
    resource_type = 'notification';
    const match = url.match(/\/notifications\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  else if (url.includes('/profile')) {
    resource_type = 'profile';
  }
  else if (url.includes('/auth')) {
    resource_type = 'auth';
  }
  else if (url.includes('/super-admin/')) {
    if (url.includes('/subscriptions')) resource_type = 'subscription';
    if (url.includes('/payments')) resource_type = 'payment';
    if (url.includes('/invoices')) resource_type = 'invoice';
    if (url.includes('/logs')) resource_type = 'logging';
    if (url.includes('/companies')) resource_type = 'company';
  }

  if (!resource_id && body && body.id) {
    resource_id = parseInt(body.id);
  }

  return { resource_type, resource_id };
};

const shouldLogActivity = (action_type, url) => {
  const skipPatterns = [
    '/health',
    '/status',
    '/ping',
    '/favicon',
    '/assets',
    '/static',
    '/docs',
    '/api-docs',
    '/swagger',
    '/activity'
  ];

  if (!action_type) {
    return false;
  }

  if (skipPatterns.some(pattern => url.includes(pattern))) {
    return false;
  }

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

      if (req.superAdmin) {
        company_id = null;
        staff_id = null;
      } else if (req.userType === 'staff' && req.staff) {
        staff_id = req.staff.id;
        company_id = req.staff.company_id || (req.company ? req.company.id : null);
      } else if (req.userType === 'admin' && req.company) {
        company_id = req.company.id;
        staff_id = null;
      }

      const rawIP = getClientIP(req);
      const ip_address = normalizeIP(rawIP);

      const logData = {
        company_id,
        staff_id,
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

    if (req.superAdmin) {
      user_id = req.superAdmin.id;
      user_type = 'Super Admin';
      company_id = null;
      email = req.superAdmin.email;
    } else if (req.staff) {
      user_id = req.staff.id;
      user_type = 'Staff';
      company_id = req.staff.company_id;
      email = req.staff.email;
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
      staff_id: user_id,
      log_level: 'ERROR',
      log_category: 'api',
      message: `Error: ${err.message} | User: ${email} (${user_type}, ID: ${user_id}) | ${req.method} ${req.originalUrl} | Stack: ${err.stack?.substring(0, 500)}`,
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