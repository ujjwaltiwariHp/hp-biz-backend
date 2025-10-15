const { verifyToken } = require('../../utils/jwtHelper');
const { getSuperAdminById } = require('../../models/super-admin-models/authModel');
const { errorResponse } = require('../../utils/errorResponse');

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
    req.superAdmin = {
        ...superAdminProfile,
        id: decoded.id,
        is_super_admin: decoded.is_super_admin,
        permissions: decoded.permissions,
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
