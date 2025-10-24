const { errorResponse } = require('../../utils/errorResponse');

const checkPermission = (permissions, resource, action) => {
    // If no permissions object, deny access
    if (!permissions || typeof permissions !== 'object') {
        console.warn('No permissions object found');
        return false;
    }

    // Check for super admin with full access
    if (permissions.all) {
        if (Array.isArray(permissions.all)) {
            if (permissions.all.includes('crud') || permissions.all.includes(action)) {
                return true;
            }
        }
    }

    // Check for resource-specific permissions
    if (permissions[resource]) {
        const allowedActions = permissions[resource];

        // If allowedActions is an array
        if (Array.isArray(allowedActions)) {
            if (allowedActions.includes(action)) {
                return true;
            }
            if (allowedActions.includes('crud')) {
                return true;
            }
        }
    }

    console.warn(`Permission denied: resource="${resource}", action="${action}", available permissions:`, permissions);
    return false;
};

const requireSuperAdminPermission = (resource, action) => {
    return (req, res, next) => {
        // Verify super admin is authenticated
        if (!req.superAdmin) {
            return errorResponse(res, 401, "Authentication required");
        }

        // For super admins (full access), skip permission check
        if (req.superAdmin.is_super_admin === true) {
            return next();
        }

        // Get permissions
        const permissions = req.superAdmin?.permissions;

        if (!permissions) {
            console.warn(`No permissions found for super admin ${req.superAdmin.id}`);
            return errorResponse(res, 403, "Authorization required. Permissions not found.");
        }

        // Check if user has permission
        if (checkPermission(permissions, resource, action)) {
            return next();
        }

        // Provide helpful error message
        return errorResponse(res, 403, `Permission Denied. You do not have ${action} access to ${resource}.`);
    };
};

module.exports = {
    requireSuperAdminPermission,
    checkPermission
};