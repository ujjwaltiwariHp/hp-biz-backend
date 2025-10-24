const { errorResponse } = require('../../utils/errorResponse');

const checkPermission = (permissions, resource, action) => {
    if (!permissions || typeof permissions !== 'object') {
        return false;
    }

    if (permissions.all && Array.isArray(permissions.all)) {
        if (permissions.all.includes('crud') || permissions.all.includes(action)) {
            return true;
        }
    }

    if (permissions[resource]) {
        const allowedActions = permissions[resource];

        if (Array.isArray(allowedActions)) {
            if (allowedActions.includes(action)) {
                return true;
            }
            if (allowedActions.includes('crud')) {
                return true;
            }
            if (action === 'view' && allowedActions.includes('view')) {
                return true;
            }
        }
    }

    return false;
};

const requireSuperAdminPermission = (resource, action) => {
    return (req, res, next) => {
        const permissions = req.superAdmin?.permissions;

        if (!permissions) {
            return errorResponse(res, 403, "Authorization required. Permissions not found.");
        }

        if (checkPermission(permissions, resource, action)) {
            return next();
        }

        // Provide more helpful error message
        return errorResponse(res, 403, `Permission Denied. You do not have ${action} access to ${resource}.`);
    };
};

module.exports = {
    requireSuperAdminPermission,
    checkPermission
};