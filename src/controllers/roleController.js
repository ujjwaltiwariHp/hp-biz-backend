const Role = require("../models/roleModel");
const { successResponse } = require("../utils/successResponse");
const { errorResponse } = require("../utils/errorResponse");

const getAllRoles = async (req, res) => {
  try {
    const companyId = req.company.id;
    const roles = await Role.getAllRoles(companyId);

    if (!roles || roles.length === 0) {
      return successResponse(res, "No roles found", []);
    }

    return successResponse(res, "Roles fetched successfully", roles);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getRoleById = async (req, res) => {
  try {
    const companyId = req.company.id;
    const role = await Role.getRoleById(req.params.id, companyId);

    if (!role) {
      return successResponse(res, "No role found", {});
    }

    return successResponse(res, "Role details fetched", role);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};


const createRole = async (req, res) => {
  try {
    const { role_name, description, permissions } = req.body;
    const company_id = req.company.id;
    console.log(req.body);


    if (!role_name || !description) {
      return errorResponse(res, 400, "Role name and description are required");
    }

    const validPermissions = ['user_management', 'lead_management', 'reports', 'settings', 'role_management'];
    const permissionObj = {};
    validPermissions.forEach(permission => {
      permissionObj[permission] = permissions && permissions[permission] === true;
    });

    const roleData = {
      company_id,
      role_name: role_name.trim(),
      description: description.trim(),
      permissions: permissionObj
    };

    const createdRole = await Role.createRole(roleData);
    const newRole = await Role.getRoleById(createdRole.id, company_id);

    return successResponse(res, "Role created successfully", newRole, 201);
  } catch (err) {
    if (err.message === "Role name already exists") {
      return errorResponse(res, 409, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const updateRole = async (req, res) => {
  try {
    const { role_name, description, permissions } = req.body;
    const companyId = req.company.id;
    const roleId = req.params.id;

    if (!description) {
      return errorResponse(res, 400, "Description is required");
    }

    const validPermissions = ['user_management', 'lead_management', 'reports', 'settings', 'role_management'];
    const permissionObj = {};
    validPermissions.forEach(permission => {
      permissionObj[permission] = permissions && permissions[permission] === true;
    });

    const updateData = {
      role_name: role_name ? role_name.trim() : undefined,
      description: description.trim(),
      permissions: permissionObj
    };

    const updatedRole = await Role.updateRole(roleId, updateData, companyId);
    if (!updatedRole) {
      return errorResponse(res, 404, "Role not found");
    }

    const freshRole = await Role.getRoleById(roleId, companyId);
    return successResponse(res, "Role updated successfully", freshRole);
  } catch (err) {
    if (err.message === "Role name already exists") {
      return errorResponse(res, 409, err.message);
    }
    if (err.message === "Role not found") {
      return errorResponse(res, 404, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const deleteRole = async (req, res) => {
  try {
    const companyId = req.company.id;
    const deleted = await Role.deleteRole(req.params.id, companyId);

    if (!deleted) {
      return errorResponse(res, 404, "Role not found");
    }

    return successResponse(res, "Role deleted successfully");
  } catch (err) {
    if (err.message === "Role not found") {
      return errorResponse(res, 404, err.message);
    }
    if (err.message === "Cannot delete default role") {
      return errorResponse(res, 403, err.message);
    }
    if (err.message === "Cannot delete role with assigned staff members") {
      return errorResponse(res, 403, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const getStaffCountByRole = async (req, res) => {
  try {
    const companyId = req.company.id;
    const roleStats = await Role.getStaffCountByRole(companyId);
    return successResponse(res, "Role statistics fetched", roleStats);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getRolePermissions = async (req, res) => {
  try {
    const roleId = req.params.id;
    const permissions = await Role.getRolePermissions(roleId);

    if (!permissions) {
      return errorResponse(res, 404, "Role not found");
    }

    return successResponse(res, "Role permissions fetched", { permissions });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getAvailablePermissions = async (req, res) => {
  try {
    const permissions = Role.getAvailablePermissions();
    return successResponse(res, "Available permissions fetched", permissions);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const createDefaultRoles = async (req, res) => {
  try {
    const companyId = req.company.id;
    await Role.createDefaultRoles(companyId);
    return successResponse(res, "Default roles created successfully");
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const checkPermission = async (req, res) => {
  try {
    const { permission_key } = req.params;
    const userPermissions = req.staff?.permissions || {};

    if (req.userType === 'admin') {
      return successResponse(res, "Permission check completed", { has_permission: true });
    }

    const hasPermission = Role.hasPermission(userPermissions, permission_key);
    return successResponse(res, "Permission check completed", {
      has_permission: hasPermission,
      permission_key,
      user_permissions: userPermissions
    });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getStaffCountByRole,
  getRolePermissions,
  getAvailablePermissions,
  createDefaultRoles,
  checkPermission
};
