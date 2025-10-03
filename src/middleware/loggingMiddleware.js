const { logUserActivity, logSystemEvent } = require('../models/loggingModel');

const logActivity = (req, res, next) => {

  const originalEnd = res.end;
  const originalSend = res.send;

  // Override res.end to capture when response completes
  res.end = function(chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);

    // Log activity after response is sent
    logActivityAfterResponse(req, res);
  };

  // Override res.send as backup
  res.send = function(data) {
    const result = originalSend.call(this, data);

    // Only log if res.end wasn't called
    if (!res.headersSent) {
      setImmediate(() => logActivityAfterResponse(req, res));
    }

    return result;
  };

  next();
};

const logActivityAfterResponse = async (req, res) => {
  try {
    // Skip if response was not successful
    if (!res.statusCode || res.statusCode >= 400) {
      return;
    }

    let staff_id = null;
    let company_id = null;

    // Get user context
    if (req.userType === 'staff' && req.staff) {
      staff_id = req.staff.id;
      company_id = req.staff.company_id || (req.company ? req.company.id : null);
    } else if (req.userType === 'admin' && req.company) {
      company_id = req.company.id;
      staff_id = null;
    }

    // Skip if no company context
    if (!company_id) {
      return;
    }

    const action_type = getActionType(req.method, req.originalUrl);
    const resource_info = getResourceInfo(req.originalUrl, req.body, req.params);

    // Check if we should log this activity
    if (!shouldLogActivity(action_type, req.originalUrl)) {
      return;
    }

    const activityData = {
      staff_id,
      company_id,
      action_type,
      resource_type: resource_info.resource_type,
      resource_id: resource_info.resource_id,
      action_details: `${req.method} ${req.originalUrl}${req.body ? ` - Body: ${JSON.stringify(req.body).substring(0, 200)}` : ''}`,
      ip_address: getClientIP(req)
    };

    // Log the activity
    await logUserActivity(activityData);
    console.log('Activity logged:', activityData); // Debug log

  } catch (error) {
    console.error('Failed to log user activity:', error);
  }
};

const getActionType = (method, url) => {
  if (url.includes('/login')) return 'LOGIN';
  if (url.includes('/logout')) return 'LOGOUT';
  if (url.includes('/register') || url.includes('/signup')) return 'REGISTER';
  if (url.includes('/verify-otp')) return 'VERIFY_OTP';
  if (url.includes('/forgot-password')) return 'FORGOT_PASSWORD';
  if (url.includes('/reset-password')) return 'RESET_PASSWORD';
  if (url.includes('/change-password')) return 'CHANGE_PASSWORD';

  switch (method) {
    case 'GET':
      if (url.includes('/export')) return 'EXPORT';
      if (url.includes('/download')) return 'DOWNLOAD';
      if (url.includes('/dashboard')) return 'VIEW_DASHBOARD';
      if (url.includes('/reports')) return 'VIEW_REPORT';
      if (url.includes('/performance')) return 'VIEW_PERFORMANCE';
      // Don't log regular GET requests unless specific
      return null;
    case 'POST':
      if (url.includes('/bulk')) return 'BULK_CREATE';
      if (url.includes('/import')) return 'IMPORT';
      if (url.includes('/assign')) return 'ASSIGN';
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      if (url.includes('/bulk')) return 'BULK_UPDATE';
      if (url.includes('/assign')) return 'ASSIGN';
      if (url.includes('/status')) return 'UPDATE_STATUS';
      if (url.includes('/complete')) return 'COMPLETE';
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

  // Lead related
  if (url.includes('/leads') || url.includes('/lead/')) {
    resource_type = 'lead';
    const match = url.match(/\/leads?\/(\d+)/) || url.match(/\/lead\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  // Staff related
  else if (url.includes('/staff')) {
    resource_type = 'staff';
    const match = url.match(/\/staff\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  // Company related
  else if (url.includes('/companies') || url.includes('/company')) {
    resource_type = 'company';
    const match = url.match(/\/compan(?:y|ies)\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  // Role related
  else if (url.includes('/roles') || url.includes('/role/')) {
    resource_type = 'role';
    const match = url.match(/\/roles?\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  // Lead sources
  else if (url.includes('/sources') || url.includes('/lead-sources')) {
    resource_type = 'lead_source';
    const match = url.match(/\/(?:sources|lead-sources)\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  // Lead statuses
  else if (url.includes('/statuses') || url.includes('/lead-statuses')) {
    resource_type = 'lead_status';
    const match = url.match(/\/(?:statuses|lead-statuses)\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  // Lead tags
  else if (url.includes('/tags') || url.includes('/lead-tags')) {
    resource_type = 'lead_tag';
    const match = url.match(/\/(?:tags|lead-tags)\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  // Follow-ups
  else if (url.includes('/follow-ups') || url.includes('/reminders')) {
    resource_type = 'follow_up_reminder';
    const match = url.match(/\/(?:follow-ups|reminders)\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  // Performance/Reports
  else if (url.includes('/performance')) {
    resource_type = 'performance';
  }
  else if (url.includes('/reports')) {
    resource_type = 'report';
  }
  else if (url.includes('/dashboard')) {
    resource_type = 'dashboard';
  }
  // Settings
  else if (url.includes('/settings')) {
    resource_type = 'company_settings';
  }
  // Notifications
  else if (url.includes('/notifications')) {
    resource_type = 'notification';
    const match = url.match(/\/notifications\/(\d+)/);
    resource_id = match ? parseInt(match[1]) : (params.id ? parseInt(params.id) : null);
  }
  // Profile
  else if (url.includes('/profile')) {
    resource_type = 'profile';
  }
  // Auth
  else if (url.includes('/auth')) {
    resource_type = 'auth';
  }

  // Try to get ID from body if not found in URL
  if (!resource_id && body && body.id) {
    resource_id = parseInt(body.id);
  }

  return { resource_type, resource_id };
};

const shouldLogActivity = (action_type, url) => {
  // Skip patterns that shouldn't be logged
  const skipPatterns = [
    '/health',
    '/status',
    '/ping',
    '/favicon',
    '/assets',
    '/static',
    '/docs', // Swagger docs
    '/api-docs'
  ];

  // Don't log if no action type
  if (!action_type) {
    return false;
  }

  // Skip certain URLs
  if (skipPatterns.some(pattern => url.includes(pattern))) {
    return false;
  }

  return true;
};

const getClientIP = (req) => {
  return req.ip ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.connection?.socket?.remoteAddress ||
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.headers['cf-connecting-ip'] || // Cloudflare
         req.headers['x-client-ip'] ||
         '0.0.0.0';
};

// Global logging middleware - apply to all routes
const globalLogActivity = (req, res, next) => {
  // Skip certain paths entirely
  if (req.originalUrl.includes('/docs') ||
      req.originalUrl.includes('/health') ||
      req.originalUrl.includes('/favicon')) {
    return next();
  }

  return logActivity(req, res, next);
};

const logSystemActivity = (level, category, message) => {
  return async (req, res, next) => {
    try {
      let staff_id = null;
      let company_id = null;

      if (req.userType === 'staff' && req.staff) {
        staff_id = req.staff.id;
        company_id = req.staff.company_id || (req.company ? req.company.id : null);
      } else if (req.userType === 'admin' && req.company) {
        company_id = req.company.id;
      }

      if (company_id) {
        const logData = {
          company_id,
          staff_id,
          log_level: level.toUpperCase(),
          log_category: category,
          message: `${message} - ${req.method} ${req.originalUrl}`
        };

        await logSystemEvent(logData);
      }
    } catch (error) {
      console.error('Failed to log system activity:', error);
    }

    next();
  };
};

const logError = async (err, req, res, next) => {
  try {
    let staff_id = null;
    let company_id = null;

    if (req.userType === 'staff' && req.staff) {
      staff_id = req.staff.id;
      company_id = req.staff.company_id || (req.company ? req.company.id : null);
    } else if (req.userType === 'admin' && req.company) {
      company_id = req.company.id;
    }

    if (company_id) {
      const logData = {
        company_id,
        staff_id,
        log_level: 'ERROR',
        log_category: 'api',
        message: `Error: ${err.message} - ${req.method} ${req.originalUrl} - IP: ${getClientIP(req)}`
      };

      await logSystemEvent(logData);
    }
  } catch (error) {
    console.error('Failed to log error:', error);
  }

  next(err);
};

const logSecurityEvent = (eventType, message, severity = 'WARNING') => {
  return async (req, res, next) => {
    try {
      let staff_id = null;
      let company_id = null;

      if (req.userType === 'staff' && req.staff) {
        staff_id = req.staff.id;
        company_id = req.staff.company_id || (req.company ? req.company.id : null);
      } else if (req.userType === 'admin' && req.company) {
        company_id = req.company.id;
      }

      if (company_id) {
        const logData = {
          company_id,
          staff_id,
          log_level: severity.toUpperCase(),
          log_category: 'security',
          message: `${eventType}: ${message} - IP: ${getClientIP(req)} - User-Agent: ${req.get('User-Agent') || 'Unknown'}`
        };

        await logSystemEvent(logData);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
    }

    next();
  };
};

module.exports = {
  logActivity,
  globalLogActivity,
  logSystemActivity,
  logError,
  logSecurityEvent
};