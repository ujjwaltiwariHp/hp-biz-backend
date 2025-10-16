const {
  createSuperAdmin,
  getSuperAdminByEmail,
  getSuperAdminById,
  getAllSuperAdmins,
  updateSuperAdminPassword,
  updateSuperAdminProfile,
  verifyPassword,
  updateSuperAdminStatus,
  deleteSuperAdmin,
  getSuperAdminRoleById
} = require('../../models/super-admin-models/authModel');

const { generateToken } = require('../../utils/jwtHelper');
const { errorResponse } = require('../../utils/errorResponse');
const { successResponse } = require('../../utils/responseFormatter');
const pool = require('../../config/database');

const safeParsePermissions = (permissionsData) => {
    if (!permissionsData) return { "all": ["view"] };

    if (typeof permissionsData === 'object' && !Array.isArray(permissionsData)) {
        if (permissionsData.length > 0 && typeof permissionsData[0] === 'string') {
            return { "all": ["view"] };
        }
        return permissionsData;
    }

    if (typeof permissionsData === 'string') {
        try {
            return JSON.parse(permissionsData);
        } catch (e) {
            return { "all": ["view"] };
        }
    }

    if (Array.isArray(permissionsData)) {
        return { "all": ["view"] };
    }

    return { "all": ["view"] };
};


const login = async (req, res) => {
  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, "Email and password are required");
    }

    const superAdmin = await getSuperAdminByEmail(email);

    if (!superAdmin) {
      return errorResponse(res, 401, "Invalid credentials");
    }

    const trimmedPassword = password.trim();
    const isValidPassword = await verifyPassword(trimmedPassword, superAdmin.password_hash);

    if (!isValidPassword) {
      return errorResponse(res, 401, "Invalid credentials");
    }

    if (superAdmin.status === 'inactive') {
      return errorResponse(res, 403, "Account is currently inactive");
    }

    let permissions = { "all": ["view"] };
    if (superAdmin.super_admin_role_id) {
      const superAdminRole = await getSuperAdminRoleById(superAdmin.super_admin_role_id);
      if (superAdminRole) {
        permissions = safeParsePermissions(superAdminRole.permissions);

      }
    }


    const token = generateToken({
      id: superAdmin.id,
      email: superAdmin.email,
      type: 'super_admin',
      is_super_admin: superAdmin.is_super_admin || false,
      permissions: permissions
    });

    res.cookie("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/"
    });

    const superAdminProfile = await getSuperAdminById(superAdmin.id);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        superAdmin: {
          ...superAdminProfile,
          permissions: permissions
        }
      },
      meta: {
        timezone: 'UTC',
        timezone_abbr: 'UTC'
      }
    });

  } catch (error) {
    return errorResponse(res, 500, "Internal server error during login operation");
  }
};

const createAdmin = async (req, res) => {
  try {
    const { email, password, name, role_id } = req.body;

    if (!email || !password || !name || !role_id) {
      return errorResponse(res, 400, "Email, password, name, and role_id are required");
    }

    const existingAdmin = await getSuperAdminByEmail(email);
    if (existingAdmin) {
      return errorResponse(res, 409, "Email already exists");
    }

    const selectedRole = await getSuperAdminRoleById(role_id);
    if (!selectedRole) {
        return errorResponse(res, 400, "Invalid role ID provided.");
    }

    const is_super_admin_flag = selectedRole.role_name === 'Super Admin';

    const newAdmin = await createSuperAdmin({
        email,
        password,
        name,
        super_admin_role_id: role_id,
        is_super_admin: is_super_admin_flag
    });

    return successResponse(res, "Super Admin created successfully", {
      superAdmin: newAdmin
    }, 201, req);
  } catch (error) {
    return errorResponse(res, 500, "Failed to create Super Admin");
  }
};

const getProfile = async (req, res) => {
  try {
    const superAdmin = await getSuperAdminById(req.superAdmin.id);

    if (!superAdmin) {
      return errorResponse(res, 404, "Super Admin profile not found");
    }

    return successResponse(res, "Profile fetched successfully", {
      id: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      is_super_admin: req.superAdmin.is_super_admin,
      permissions: req.superAdmin.permissions,
      created_at: superAdmin.created_at,
      updated_at: superAdmin.updated_at
    }, 200, req);
  } catch (error) {
    return errorResponse(res, 500, "Failed to fetch profile");
  }
};

const getAllAdmins = async (req, res) => {
  try {
    const admins = await getAllSuperAdmins();
    return successResponse(res, "All Super Admins retrieved successfully", {
      superAdmins: admins
    }, 200, req);
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve Super Admins");
  }
};

const updateProfile = async (req, res) => {
  try {
    const { email, name } = req.body;
    const adminId = req.superAdmin.id;

    if (email) {
      const existingAdmin = await getSuperAdminByEmail(email);
      if (existingAdmin && existingAdmin.id !== adminId) {
        return errorResponse(res, 409, "Email is already in use by another admin");
      }
    }

    if (!email && !name) {
      return errorResponse(res, 400, "No valid fields provided for update");
    }

    const updatedAdmin = await updateSuperAdminProfile(adminId, { email, name });

    return successResponse(res, "Profile updated successfully", {
      superAdmin: updatedAdmin
    }, 200, req);
  } catch (error) {
    if (error.message && error.message.includes('unique')) {
      return errorResponse(res, 409, "Email is already in use by another admin");
    }
    return errorResponse(res, 500, "Failed to update profile");
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.superAdmin.id;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, 400, "Current and new passwords are required");
    }

    const superAdmin = await getSuperAdminByEmail(req.superAdmin.email);

    if (!superAdmin) {
      return errorResponse(res, 404, "Super Admin not found");
    }

    const isValidPassword = await verifyPassword(currentPassword.trim(), superAdmin.password_hash);

    if (!isValidPassword) {
      return errorResponse(res, 401, "Current password is incorrect");
    }

    const updatedAdmin = await updateSuperAdminPassword(adminId, newPassword);

    return successResponse(res, "Password changed successfully", {
      superAdmin: updatedAdmin
    }, 200, req);
  } catch (error) {
    return errorResponse(res, 500, "Failed to change password");
  }
};

const logout = async (req, res) => {
  try {
    res.clearCookie("auth-token", { path: "/" });

    return successResponse(res, "Logged out successfully", {}, 200, req);
  } catch (error) {
    return errorResponse(res, 500, "Failed to log out");
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const currentAdminId = req.superAdmin.id;

    if (isNaN(id)) {
      return errorResponse(res, 400, "Invalid admin ID");
    }

    if (currentAdminId === id) {
      return errorResponse(res, 400, "Cannot delete your own active admin account");
    }

    const adminToDelete = await getSuperAdminById(id);
    if (!adminToDelete) {
      return errorResponse(res, 404, "Super Admin not found");
    }

    const primaryAdminRoleId = 1;
    if (adminToDelete.super_admin_role_id === primaryAdminRoleId) {
        return errorResponse(res, 403, "Cannot delete a primary Super Admin account with full privileges.");
    }

    const deletedAdmin = await deleteSuperAdmin(id);
    if (!deletedAdmin) {
      return errorResponse(res, 404, "Super Admin not found");
    }

    return successResponse(res, `Super Admin ${deletedAdmin.email} deleted successfully`, {}, 200, req);
  } catch (error) {
    return errorResponse(res, 500, "Failed to delete Super Admin");
  }
};

const toggleAdminStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 400, "Invalid admin ID");
    }

    if (req.superAdmin.id === id) {
      return errorResponse(res, 400, "Cannot change the status of your own active admin account");
    }

    const currentAdmin = await getSuperAdminById(id);
    if (!currentAdmin) {
      return errorResponse(res, 404, "Super Admin not found");
    }

    const newStatus = currentAdmin.status === 'active' ? 'inactive' : 'active';
    const updatedAdmin = await updateSuperAdminStatus(id, newStatus);

    return successResponse(res, `Super Admin status updated to ${newStatus}`, {
      superAdmin: updatedAdmin
    }, 200, req);
  } catch (error) {
    return errorResponse(res, 500, "Failed to toggle Super Admin status");
  }
};

const getSuperAdminRoles = async (req, res) => {
    try {
        const roles = await pool.query(`SELECT id, role_name, description, permissions FROM super_admin_roles ORDER BY id`);
        return successResponse(res, "Super Admin roles fetched successfully", { roles: roles.rows }, 200, req);
    } catch (error) {
        return errorResponse(res, 500, "Failed to fetch roles.");
    }
};

const updateSuperAdminRolePermissions = async (req, res) => {
    try {
        const roleId = parseInt(req.params.id);
        const { permissions } = req.body;

        if (isNaN(roleId)) {
          return errorResponse(res, 400, "Invalid role ID");
        }

        if (!permissions || typeof permissions !== 'object') {
             return errorResponse(res, 400, "Valid permissions object is required.");
        }

        const result = await pool.query(
            `UPDATE super_admin_roles SET permissions = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, role_name, permissions`,
            [JSON.stringify(permissions), roleId]
        );

        if (result.rowCount === 0) {
            return errorResponse(res, 404, "Role not found.");
        }

        return successResponse(res, "Role permissions updated successfully", { role: result.rows[0] }, 200, req);

    } catch (error) {
        return errorResponse(res, 500, "Failed to update role permissions.");
    }
};

module.exports = {
  login,
  createAdmin,
  getProfile,
  getAllAdmins,
  updateProfile,
  changePassword,
  logout,
  deleteAdmin,
  toggleAdminStatus,
  getSuperAdminRoles,
  updateSuperAdminRolePermissions
};