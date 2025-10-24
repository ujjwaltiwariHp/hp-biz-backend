const { verifyToken } = require('../../utils/jwtHelper');
const { getSuperAdminById } = require('../../models/super-admin-models/authModel');
const { errorResponse } = require('../../utils/errorResponse');

const safeParsePermissions = (permissionsData) => {
    if (typeof permissionsData === 'string') {
        try {
            if (!permissionsData.trim()) {
                return { "all": ["view"] };
            }
            return JSON.parse(permissionsData);
        } catch (e) {
            return { "all": ["view"] };
        }
    }
    return permissionsData || { "all": ["view"] };
};

const authenticateSuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, "Access denied. No valid token provided");
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded || decoded.type !== 'super_admin') {
      return errorResponse(res, 401, "Access denied. Invalid token");
    }

    const superAdminProfile = await getSuperAdminById(decoded.id);
    if (!superAdminProfile) {
      return errorResponse(res, 401, "Access denied. Super admin not found");
    }

    const parsedPermissions = safeParsePermissions(superAdminProfile.permissions);

    req.superAdmin = {
        ...superAdminProfile,
        id: decoded.id,
        is_super_admin: decoded.is_super_admin,
        permissions: parsedPermissions,
    };
    req.token = token;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return errorResponse(res, 401, "Access denied. Invalid or expired token");
    }
    return errorResponse(res, 500, "Internal server error");
  }
};

module.exports = { authenticateSuperAdmin };
