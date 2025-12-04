const jwt = require('jsonwebtoken');
const { getCompanyById } = require('../models/authModel');
const { getStaffById } = require('../models/staffModel');
const { errorResponse } = require('../utils/errorResponse');
const { getSuperAdminById } = require('../models/super-admin-models/authModel');
const moment = require('moment');

const safeVerify = (token) => {
  if (!token || typeof token !== 'string') return null;
  if (token.split('.').length !== 3) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;

    if (!token) {
      return errorResponse(res, 401, "Access token required");
    }

    const decoded = safeVerify(token);

    if (!decoded) {
      return errorResponse(res, 401, "Invalid or malformed token");
    }

    if (decoded.type !== 'company') {
      return errorResponse(res, 401, "Company admin access required");
    }

    const company = await getCompanyById(decoded.id);
    if (!company) {
      return errorResponse(res, 401, "Invalid or expired token or inactive subscription");
    }

    if (!company.email_verified) {
      return errorResponse(res, 403, "Account not verified.");
    }

    const requiresPlanSelection = !company.subscription_package_id;
    const subscriptionEndDate = moment(company.subscription_end_date);
    const isStatusCheckEndpoint = req.path === '/subscription-status' || req.path === '/api/v1/auth/subscription-status';

    if (requiresPlanSelection) {
      // Allow access to select a plan
    } else if (!isStatusCheckEndpoint) {
      const PENDING_STATUSES = ['pending', 'payment_received'];

      if (PENDING_STATUSES.includes(company.subscription_status)) {
        return errorResponse(res, 403, "Subscription pending approval. Please wait for admin verification.");
      }

      if (!company.is_active || subscriptionEndDate.isBefore(moment())) {
        return errorResponse(res, 403, "Subscription inactive or expired. Please renew your plan.");
      }
    }

    req.company = company;
    req.userType = 'admin';
    next();

  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && !error.message.includes('jwt') && !error.message.includes('token')) {
        console.error('Auth Error:', error.message);
    }
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

    const decoded = safeVerify(token);

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
    if (!company || !company.is_active) {
      return errorResponse(res, 401, "Company not found or inactive subscription");
    }

    req.staff = staff;
    req.company = company;
    req.userType = 'staff';
    next();

  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && !error.message.includes('jwt') && !error.message.includes('token')) {
        console.error('Auth Staff Error:', error.message);
    }
    return errorResponse(res, 401, "Invalid or expired token");
  }
};

const authenticateAny = async (req, res, next) => {
  try {
    let token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return errorResponse(res, 401, "Access token required");
    }

    const decoded = safeVerify(token);

    if (!decoded) {
      return errorResponse(res, 401, "Invalid or malformed token");
    }

    if (decoded.type === 'staff') {
      const staff = await getStaffById(decoded.id, decoded.company_id);
      if (!staff || staff.status !== 'active') {
        return errorResponse(res, 401, "Invalid or expired token");
      }

      const company = await getCompanyById(decoded.company_id);
      if (!company || !company.is_active) {
        return errorResponse(res, 401, "Company not found or inactive subscription");
      }

      req.staff = staff;
      req.company = company;
      req.userType = 'staff';

    } else if (decoded.type === 'company') {
      const company = await getCompanyById(decoded.id);

      if (!company || (!company.is_active && company.subscription_package_id)) {
        return errorResponse(res, 401, "Invalid or expired token or inactive subscription");
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
    if (error.name !== 'JsonWebTokenError' && !error.message.includes('jwt') && !error.message.includes('token')) {
        console.error("Auth Middleware Error:", error.message);
    }
    return errorResponse(res, 401, "Invalid or expired token");
  }
};

const requirePermission = (permissionKey, action = null) => {
  return (req, res, next) => {
    if (req.userType === 'admin') {
      return next();
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