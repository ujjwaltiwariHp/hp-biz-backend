const {
  createSuperAdmin,
  getSuperAdminByEmail,
  getSuperAdminById,
  getAllSuperAdmins,
  updateSuperAdminPassword,
  updateSuperAdminProfile,
  verifyPassword
} = require('../../models/super-admin-models/authModel');

const { generateToken } = require('../../utils/jwtHelper');
const { errorResponse } = require('../../utils/errorResponse');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const superAdmin = await getSuperAdminByEmail(email);
    if (!superAdmin) {
      return errorResponse(res, 401, "Invalid credentials");
    }

    const trimmedPassword = password.trim();
    const isValidPassword = await verifyPassword(trimmedPassword, superAdmin.password_hash);
    if (!isValidPassword) {
      return errorResponse(res, 401, "Invalid credentials");
    }

    const token = generateToken({
      id: superAdmin.id,
      email: superAdmin.email,
      type: 'super_admin'
    });

    res.cookie("auth-token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/"
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      superAdmin: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
        created_at: superAdmin.created_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(res, 500, "Internal server error");
  }
};

const createAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existingAdmin = await getSuperAdminByEmail(email);
    if (existingAdmin) {
      return errorResponse(res, 409, "Email already exists");
    }
    const newAdmin = await createSuperAdmin({ email, password, name });
    return res.status(201).json({
      success: true,
      message: "Super admin created successfully",
      superAdmin: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        created_at: newAdmin.created_at
      }
    });
  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const getProfile = async (req, res) => {
  try {
    const superAdmin = req.superAdmin;
    return res.status(200).json({
      success: true,
      superAdmin: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
        created_at: superAdmin.created_at,
        updated_at: superAdmin.updated_at
      }
    });
  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const getAllAdmins = async (req, res) => {
  try {
    const superAdmins = await getAllSuperAdmins();
    return res.status(200).json({
      success: true,
      superAdmins
    });
  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const updateProfile = async (req, res) => {
  try {
    const { email } = req.body;
    const superAdminId = req.superAdmin.id;

    const updatedSuperAdmin = await updateSuperAdminProfile(superAdminId, { email });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      superAdmin: updatedSuperAdmin
    });

  } catch (error) {
    if (error.code === '23505') {
      return errorResponse(res, 409, "Email already exists");
    }
    return errorResponse(res, 500, "Internal server error");
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const superAdminId = req.superAdmin.id;

    const currentSuperAdmin = await getSuperAdminByEmail(req.superAdmin.email);

    const isValidPassword = await verifyPassword(currentPassword, currentSuperAdmin.password_hash);
    if (!isValidPassword) {
      return errorResponse(res, 400, "Current password is incorrect");
    }

    await updateSuperAdminPassword(superAdminId, newPassword);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const logout = async (req, res) => {
  try {

    res.clearCookie("auth-token", { path: "/" });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const currentAdminId = req.superAdmin.id;

    if (parseInt(id) === currentAdminId) {
      return errorResponse(res, 400, "Cannot delete your own account");
    }

    const deletedAdmin = await deleteSuperAdmin(id);
    if (!deletedAdmin) {
      return errorResponse(res, 404, "Admin not found");
    }

    return res.status(200).json({
      success: true,
      message: "Admin deleted successfully",
      deletedAdmin
    });
  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const toggleAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const currentAdminId = req.superAdmin.id;

    if (parseInt(id) === currentAdminId) {
      return errorResponse(res, 400, "Cannot change your own status");
    }

    if (!['active', 'inactive'].includes(status)) {
      return errorResponse(res, 400, "Invalid status. Must be 'active' or 'inactive'");
    }

    const updatedAdmin = await updateSuperAdminStatus(id, status);
    if (!updatedAdmin) {
      return errorResponse(res, 404, "Admin not found");
    }

    return res.status(200).json({
      success: true,
      message: `Admin status updated to ${status}`,
      admin: updatedAdmin
    });
  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

module.exports = {
  login,
  createAdmin,
  getProfile,
  getAllAdmins,
  updateProfile,
  changePassword,
  deleteAdmin,
  toggleAdminStatus,
  logout
};