const jwt = require('jsonwebtoken');
const { getCompanyById } = require('../models/authModel');
const { getStaffById } = require('../models/staffModel');
const { errorResponse } = require('../utils/errorResponse');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return errorResponse(res, 401, "Access token required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'company') {
      return errorResponse(res, 401, "Company admin access required");
    }

    const company = await getCompanyById(decoded.id);
    if (!company || !company.is_active) {
      return errorResponse(res, 401, "Invalid or expired token");
    }

    req.company = company;
    req.userType = 'admin';
    next();

  } catch (error) {
    return errorResponse(res, 401, "Invalid or expired token");
  }
};

const authenticateStaff = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return errorResponse(res, 401, "Access token required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'staff') {
      return errorResponse(res, 401, "Staff access required");
    }

    const staff = await getStaffById(decoded.id, decoded.company_id);
    if (!staff) {
      return errorResponse(res, 401, "Invalid or expired token");
    }

    if (staff.status !== 'active') {
      return errorResponse(res, 401, "Account is inactive");
    }

    const company = await getCompanyById(decoded.company_id);
    if (!company) {
      return errorResponse(res, 401, "Company not found");
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
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return errorResponse(res, 401, "Access token required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'staff') {
      const staff = await getStaffById(decoded.id, decoded.company_id);
      if (!staff || staff.status !== 'active') {
        return errorResponse(res, 401, "Invalid or expired token");
      }

      const company = await getCompanyById(decoded.company_id);
      if (!company) {
        return errorResponse(res, 401, "Company not found");
      }

      req.staff = staff;
      req.company = company;
      req.userType = 'staff';
    } else if (decoded.type === 'company') {
      const company = await getCompanyById(decoded.id);
      if (!company) {
        return errorResponse(res, 401, "Invalid or expired token");
      }
      req.company = company;
      req.userType = 'admin';
    } else {
      return errorResponse(res, 401, "Invalid token type");
    }

    next();
  } catch (error) {
    return errorResponse(res, 401, "Invalid or expired token");
  }
};

const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    if (req.userType === 'admin') {
      return next();
    }

    if (req.staff && req.staff.permissions) {
      if (req.staff.permissions[permissionKey] === true) {
        return next();
      }
    }

    return errorResponse(res, 403, "Insufficient permissions");
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
      const hasAnyPermission = permissionKeys.some(key =>
        req.staff.permissions[key] === true
      );

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
      const hasAllPermissions = permissionKeys.every(key =>
        req.staff.permissions[key] === true
      );

      if (hasAllPermissions) {
        return next();
      }
    }

    return errorResponse(res, 403, "Insufficient permissions");
  };
};

const requireStaffOrPermission = (permissionKey) => {
  return (req, res, next) => {
    if (req.userType === 'admin') {
      return next();
    }

    if (req.userType === 'staff' && req.staff && req.staff.permissions) {
      if (req.staff.permissions[permissionKey] === true) {
        return next();
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