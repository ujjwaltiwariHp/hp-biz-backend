const { errorResponse } = require('../../utils/errorResponse');

const checkPermission = (permissions, resource, action) => {
    if (permissions.all && Array.isArray(permissions.all) && permissions.all.includes('crud')) {
        return true;
    }

    if (permissions[resource]) {
        const allowedActions = permissions[resource];

        if (Array.isArray(allowedActions)) {
            if (allowedActions.includes(action) || allowedActions.includes('crud')) {
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

        return errorResponse(res, 403, `Permission Denied. You lack ${resource}:${action} access.`);
    };
};

module.exports = {
    requireSuperAdminPermission,
};
