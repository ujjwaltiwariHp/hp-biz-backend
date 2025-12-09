const { verifyToken } = require('../../utils/jwtHelper');
const { getSuperAdminById } = require('../../models/super-admin-models/authModel');
const { errorResponse } = require('../../utils/errorResponse');

const safeParsePermissions = (permissionsData) => {
    if (!permissionsData) {
        return { "all": ["view"] };
    }

    if (typeof permissionsData === 'object' && !Array.isArray(permissionsData)) {
        return permissionsData;
    }

    if (typeof permissionsData === 'string') {
        try {
            if (!permissionsData.trim()) {
                return { "all": ["view"] };
            }
            const parsed = JSON.parse(permissionsData);

            if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
            return { "all": ["view"] };
        } catch (e) {
            return { "all": ["view"] };
        }
    }

    return { "all": ["view"] };
};

const authenticateSuperAdmin = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse(res, 401, "Access denied. No valid token provided");
        }

        const token = authHeader.substring(7);
        let decoded;

        try {
            decoded = verifyToken(token);
        } catch (verifyError) {
            if (verifyError.name === 'TokenExpiredError') {
                return errorResponse(res, 401, "Token expired. Please log in again");
            }
            return errorResponse(res, 401, "Access denied. Invalid token");
        }

        if (!decoded || decoded.type !== 'super_admin') {
            return errorResponse(res, 401, "Access denied. Invalid token type");
        }

        let superAdminProfile;
        try {
            superAdminProfile = await getSuperAdminById(decoded.id);
        } catch (dbError) {
            console.error('Database error fetching super admin:', dbError);
            return errorResponse(res, 500, "Database error. Please try again");
        }

        if (!superAdminProfile) {
            return errorResponse(res, 401, "Access denied. Super admin not found");
        }

        if (superAdminProfile.status && superAdminProfile.status === 'inactive') {
            return errorResponse(res, 403, "Your account is inactive. Contact administrator");
        }

        const parsedPermissions = safeParsePermissions(superAdminProfile.permissions);

        req.superAdmin = {
            ...superAdminProfile,
            id: decoded.id,
            is_super_admin: decoded.is_super_admin || superAdminProfile.is_super_admin || false,
            permissions: parsedPermissions,
        };
        req.token = token;

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return errorResponse(res, 500, "Internal server error during authentication");
    }
};

module.exports = { authenticateSuperAdmin };