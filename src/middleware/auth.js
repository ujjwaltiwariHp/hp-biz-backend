const { verifyToken } = require('../utils/jwtHelper');
const { getCompanyById, getCompanyByApiKey } = require('../models/authModel');
const { getStaffById } = require('../models/staffModel');
const { errorResponse } = require('../utils/errorResponse');
const { getSuperAdminById } = require('../models/super-admin-models/authModel');
const moment = require('moment');

const isBillingOrAuthRoute = (url) => {
  const allowedRoutes = [
    '/select-subscription',
    '/subscription-status',
    '/packages',
    '/logout',
    '/profile',
    '/update-profile',
    '/change-password',
    '/verify-otp'
  ];
  return allowedRoutes.some(route => url.includes(route));
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;

    if (!token) {
      return errorResponse(res, 401, "Access token required");
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 401, "Token expired");
      }
      return errorResponse(res, 401, "Invalid or malformed token");
    }

    if (decoded.type !== 'company') {
      return errorResponse(res, 401, "Company admin access required");
    }

    const company = await getCompanyById(decoded.id);
    if (!company) {
      return errorResponse(res, 401, "Company not found");
    }

    if (!company.email_verified) {
      return errorResponse(res, 403, "Account not verified.");
    }

    const requiresPlanSelection = !company.subscription_package_id;
    const subscriptionEndDate = moment(company.subscription_end_date);
    const isStatusCheckEndpoint = req.originalUrl.includes('/subscription-status');

    if (requiresPlanSelection) {
      if (!isStatusCheckEndpoint && !isBillingOrAuthRoute(req.originalUrl)) {
         return errorResponse(res, 403, "Please select a subscription plan to proceed.");
      }
    } else {
      const PENDING_STATUSES = ['pending', 'payment_received'];
      const isPending = PENDING_STATUSES.includes(company.subscription_status);
      const isExpired = !company.is_active || subscriptionEndDate.isBefore(moment());

      if (isPending || isExpired) {
        if (req.method === 'GET') {
        } else if (isBillingOrAuthRoute(req.originalUrl)) {
        } else {
           return errorResponse(res, 403, "Subscription inactive or expired. Read-only mode active. Please renew your plan.");
        }
      }
    }

    req.company = company;
    req.userType = 'admin';
    next();

  } catch (error) {
    return errorResponse(res, 401, "Authentication failed");
  }
};

const authenticateStaff = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;

    if (!token) {
      return errorResponse(res, 401, "Access token required");
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 401, "Token expired");
      }
      return errorResponse(res, 401, "Invalid or malformed token");
    }

    if (!decoded || decoded.type !== 'staff') {
      return errorResponse(res, 401, "Staff access required or invalid token");
    }

    const staff = await getStaffById(decoded.id, decoded.company_id);
    if (!staff) {
      return errorResponse(res, 401, "Invalid or expired token");
    }

    if (staff.status !== 'active') {
      return errorResponse(res, 401, "Staff account is inactive");
    }

    const company = await getCompanyById(decoded.company_id);
    if (!company) {
      return errorResponse(res, 401, "Company not found");
    }

    const subscriptionEndDate = moment(company.subscription_end_date);
    const isExpired = !company.is_active || subscriptionEndDate.isBefore(moment());
    const isPending = ['pending', 'payment_received'].includes(company.subscription_status);

    if (isExpired || isPending) {
        if (req.method === 'GET') {
        } else if (isBillingOrAuthRoute(req.originalUrl)) {
        } else {
            return errorResponse(res, 403, "Company subscription inactive. Read-only mode active.");
        }
    }

    req.staff = staff;
    req.company = company;
    req.userType = 'staff';
    next();

  } catch (error) {
    return errorResponse(res, 401, "Invalid or expired token");
  }
};

const authenticateAny = async (req, res, next) => {
  try {
    const apiKey = req.header('x-api-key');
    if (apiKey) {
      const company = await getCompanyByApiKey(apiKey);

      if (!company) {
        return errorResponse(res, 401, "Invalid API Key");
      }
      const features = company.features || [];
      if (!features.includes('api_access')) {
        return errorResponse(res, 403, "API Access is not enabled for your subscription plan. Please upgrade.");
      }

      req.company = company;
      req.userType = 'api_client';
      req.isExternalApi = true;
      req.leadSourceId = company.source_id;

      return next();
    }
    let token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return errorResponse(res, 401, "Access token required");
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 401, "Token expired");
      }
      return errorResponse(res, 401, "Invalid or malformed token");
    }

    if (decoded.type === 'staff') {
      const staff = await getStaffById(decoded.id, decoded.company_id);
      if (!staff || staff.status !== 'active') {
        return errorResponse(res, 401, "Invalid or expired token");
      }

      const company = await getCompanyById(decoded.company_id);
      if (!company) {
        return errorResponse(res, 401, "Company not found");
      }

      const subscriptionEndDate = moment(company.subscription_end_date);
      const isExpired = !company.is_active || subscriptionEndDate.isBefore(moment());
      const isPending = ['pending', 'payment_received'].includes(company.subscription_status);

      if (isExpired || isPending) {
          if (req.method !== 'GET' && !isBillingOrAuthRoute(req.originalUrl)) {
              return errorResponse(res, 403, "Company subscription inactive. Read-only mode active.");
          }
      }

      req.staff = staff;
      req.company = company;
      req.userType = 'staff';

    } else if (decoded.type === 'company') {
      const company = await getCompanyById(decoded.id);

      if (!company) {
        return errorResponse(res, 401, "Invalid or expired token");
      }

      const requiresPlanSelection = !company.subscription_package_id;
      const subscriptionEndDate = moment(company.subscription_end_date);
      const isExpired = !company.is_active || subscriptionEndDate.isBefore(moment());
      const isPending = ['pending', 'payment_received'].includes(company.subscription_status);

      if (!requiresPlanSelection && (isExpired || isPending)) {
          if (req.method !== 'GET' && !isBillingOrAuthRoute(req.originalUrl)) {
              return errorResponse(res, 403, "Subscription inactive or expired. Read-only mode active. Please renew your plan.");
          }
      }

      req.company = company;
      req.userType = 'admin';

    } else if (decoded.type === 'super_admin') {
      const superAdmin = await getSuperAdminById(decoded.id);

      if (!superAdmin) {
        return errorResponse(res, 401, "Super Admin not found");
      }

      req.superAdmin = superAdmin;
      req.userType = 'super_admin';

    } else {
      return errorResponse(res, 401, "Invalid token type");
    }

    next();
  } catch (error) {
    return errorResponse(res, 401, "Invalid or expired token");
  }
};

const requirePermission = (permissionKey, action = null) => {
  return (req, res, next) => {
    if (req.userType === 'admin') {
      return next();
    }

    if (req.userType === 'api_client') {
      const allowedApiActions = ['create', 'view'];
      if (allowedApiActions.includes(action)) {
        return next();
      }
      return errorResponse(res, 403, "API Key is not authorized for this action.");
    }

    if (req.staff && req.staff.permissions) {
      const permission = req.staff.permissions[permissionKey];
      if (permission === true) {
        return next();
      }

      if (Array.isArray(permission)) {
        if (!action) {
           return next();
        }
        if (permission.includes(action)) {
          return next();
        }
      }
    }

    return errorResponse(res, 403, `Insufficient permissions. Access to '${permissionKey}' ${action ? `action '${action}'` : ''} denied.`);
  };
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (req.userType === 'admin') {
      return next();
    }

    if (req.staff && allowedRoles.includes(req.staff.role_name)) {
      return next();
    }

    return errorResponse(res, 403, "Insufficient role permissions");
  };
};

const adminOnly = (req, res, next) => {
  if (req.userType !== 'admin') {
    return errorResponse(res, 403, "Admin access only");
  }
  next();
};

const requireAnyPermission = (permissionKeys) => {
  return (req, res, next) => {
    if (req.userType === 'admin') {
      return next();
    }

    if (req.staff && req.staff.permissions) {
      const hasAnyPermission = permissionKeys.some(key => {
        const permission = req.staff.permissions[key];
        return permission === true || (Array.isArray(permission) && permission.length > 0);
      });

      if (hasAnyPermission) {
        return next();
      }
    }

    return errorResponse(res, 403, "Insufficient permissions");
  };
};

const requireAllPermissions = (permissionKeys) => {
  return (req, res, next) => {
    if (req.userType === 'admin') {
      return next();
    }

    if (req.staff && req.staff.permissions) {
      const hasAllPermissions = permissionKeys.every(key => {
        const permission = req.staff.permissions[key];
        return permission === true || (Array.isArray(permission) && permission.length > 0);
      });

      if (hasAllPermissions) {
        return next();
      }
    }

    return errorResponse(res, 403, "Insufficient permissions");
  };
};

const requireStaffOrPermission = (permissionKey, action = null) => {
  return (req, res, next) => {
    if (req.userType === 'admin') {
      return next();
    }

    if (req.userType === 'staff' && req.staff && req.staff.permissions) {
      const permission = req.staff.permissions[permissionKey];

      if (permission === true) {
        return next();
      }

      if (Array.isArray(permission)) {
        if (!action) return next();
        if (permission.includes(action)) return next();
      }
    }

    return errorResponse(res, 403, "Insufficient permissions");
  };
};

module.exports = {
  authenticate,
  authenticateStaff,
  authenticateAny,
  requirePermission,
  requireRole,
  adminOnly,
  requireAnyPermission,
  requireAllPermissions,
  requireStaffOrPermission
};