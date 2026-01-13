const Staff = require("../models/staffModel");
const { successResponse, successResponseWithPagination } = require("../utils/responseFormatter");
const { errorResponse } = require("../utils/errorResponse");
const { sendStaffWelcomeEmail } = require('../services/emailService');
const { parseAndConvertToUTC } = require('../utils/timezoneHelper');
const sseService = require('../services/sseService');


const getAllStaff = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staff = await Staff.getAllStaff(companyId);

    if (!staff || staff.length === 0) {
      return successResponse(res, "No staff found", [], 200, req);
    }

    return successResponse(res, "Staff list fetched", staff, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getStaffById = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staff = await Staff.getStaffById(req.params.id, companyId);

    if (!staff) {
      return successResponse(res, "No staff found", null, 200, req);
    }

    return successResponse(res, "Staff details fetched", staff, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const createStaff = async (req, res) => {
  try {
    const {
      first_name, last_name, email, phone, designation, status, role_id,
      address, nationality, employee_id, alternate_phone, id_proof_type, id_proof_number, profile_picture
    } = req.body;
    const company_id = req.company.id;

    if (!first_name || !last_name || !email) {
      return errorResponse(res, 400, "First name, last name, and email are required");
    }

    if (!role_id) {
      return errorResponse(res, 400, "Role is required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 400, "Invalid email format");
    }

    if (status && !['active', 'inactive', 'suspended'].includes(status)) {
      return errorResponse(res, 400, "Status must be 'active', 'inactive', or 'suspended'");
    }

    const roles = await Staff.getCompanyRoles(company_id);
    const roleExists = roles.find(role => role.id == role_id);
    if (!roleExists) {
      return errorResponse(res, 400, "Invalid role selected");
    }

    const isUnique = await Staff.isEmailUnique(email.trim().toLowerCase(), company_id);
    if (!isUnique) {
      return errorResponse(res, 409, "Email already exists in your company");
    }

    const result = await Staff.createStaff({
      company_id,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : null,
      designation: designation ? designation.trim() : null,
      status: status || 'active',
      role_id: parseInt(role_id),
      address: address ? address.trim() : null,
      nationality: nationality ? nationality.trim() : null,
      employee_id: employee_id ? employee_id.trim() : null,
      alternate_phone: alternate_phone ? alternate_phone.trim() : null,
      id_proof_type: id_proof_type ? id_proof_type.trim() : null,
      id_proof_number: id_proof_number ? id_proof_number.trim() : null,
      id_proof_number: id_proof_number ? id_proof_number.trim() : null,
      profile_picture: (profile_picture && (profile_picture.startsWith('/uploads/') || profile_picture.startsWith('http'))) ? profile_picture : null
    });

    const staffDetails = await Staff.getStaffById(result.staff.id, company_id);

    const loginUrl = process.env.APP_LOGIN_URL || 'https://app-login-url.com/login';

    await sendStaffWelcomeEmail(staffDetails.email, staffDetails.first_name, result.tempPassword, loginUrl);

    const responseData = {
      staff: {
        id: staffDetails.id,
        first_name: staffDetails.first_name,
        last_name: staffDetails.last_name,
        email: staffDetails.email,
        phone: staffDetails.phone,
        designation: staffDetails.designation,
        status: staffDetails.status,
        is_first_login: staffDetails.is_first_login,
        created_at: staffDetails.created_at,
        role_name: staffDetails.role_name,
        role_id: staffDetails.role_id,
        address: staffDetails.address,
        nationality: staffDetails.nationality,
        employee_id: staffDetails.employee_id,
        alternate_phone: staffDetails.alternate_phone,
        id_proof_type: staffDetails.id_proof_type,
        id_proof_number: staffDetails.id_proof_number,
        profile_picture: staffDetails.profile_picture
      }
    };

    sseService.publish(`c_${company_id}`, 'staff_list_refresh', { action: 'created', staffId: staffDetails.id });

    return successResponse(
      res,
      "Staff created successfully. An email with login instructions has been sent.",
      responseData,
      201,
      req
    );
  } catch (err) {
    if (err.message && err.message.includes("employee_id")) {
      return errorResponse(res, 409, "Employee ID already exists in this company.");
    }
    return errorResponse(res, 500, "Failed to create staff or send welcome email. " + err.message);
  }
};

const updateStaff = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { email, phone, status, role_id, ...otherData } = req.body;

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return errorResponse(res, 400, "Invalid email format");
      }

      const isUnique = await Staff.isEmailUnique(email.trim().toLowerCase(), companyId, req.params.id);
      if (!isUnique) {
        return errorResponse(res, 409, "Email already exists in your company");
      }
      otherData.email = email.trim().toLowerCase();
    }
    if (role_id) {
      const roles = await Staff.getCompanyRoles(companyId);
      const roleExists = roles.find(role => role.id == role_id);
      if (!roleExists) {
        return errorResponse(res, 400, "Invalid role selected");
      }
      otherData.role_id = parseInt(role_id);
    }

    if (status && !['active', 'inactive', 'suspended'].includes(status)) {
      return errorResponse(res, 400, "Status must be 'active', 'inactive', or 'suspended'");
    }

    if (otherData.first_name) otherData.first_name = otherData.first_name.trim();
    if (otherData.last_name) otherData.last_name = otherData.last_name.trim();
    if (phone) otherData.phone = phone.trim();
    if (otherData.designation) otherData.designation = otherData.designation.trim();
    if (status) otherData.status = status;

    if (otherData.address) otherData.address = otherData.address.trim();
    if (otherData.nationality) otherData.nationality = otherData.nationality.trim();
    if (otherData.employee_id) otherData.employee_id = otherData.employee_id.trim();
    if (otherData.alternate_phone) otherData.alternate_phone = otherData.alternate_phone.trim();
    if (otherData.id_proof_type) otherData.id_proof_type = otherData.id_proof_type.trim();
    if (otherData.id_proof_number) otherData.id_proof_number = otherData.id_proof_number.trim();

    const updatedStaff = await Staff.updateStaff(req.params.id, otherData, companyId);
    if (!updatedStaff) return errorResponse(res, 404, "Staff not found or unauthorized");
    const staffWithRole = await Staff.getStaffById(req.params.id, companyId);

    sseService.publish(`c_${companyId}`, 'staff_list_refresh', { action: 'updated', staffId: req.params.id });

    return successResponse(res, "Staff updated successfully", staffWithRole, 200, req);
  } catch (err) {
    if (err.message === "Cannot deactivate the last admin user") {
      return errorResponse(res, 403, err.message);
    }
    if (err.message && err.message.includes("employee_id")) {
      return errorResponse(res, 409, "Employee ID already exists in this company.");
    }
    return errorResponse(res, 500, err.message);
  }
};

const getMyProfile = async (req, res) => {
  try {
    if (req.userType !== 'staff' || !req.staff) {
      return errorResponse(res, 403, "Only staff members can view their own profile.");
    }

    const staffId = req.staff.id;
    const companyId = req.company.id;
    const staff = await Staff.getStaffById(staffId, companyId);

    if (!staff) {
      return errorResponse(res, 404, "Profile not found.");
    }

    return successResponse(res, "My profile fetched successfully", staff, 200, req);

  } catch (err) {
    console.error("Get My Profile Error:", err);
    return errorResponse(res, 500, err.message);
  }
};

const updateMyProfile = async (req, res) => {
  try {
    if (req.userType !== 'staff' || !req.staff) {
      return errorResponse(res, 403, "Only staff members can update their own profile.");
    }

    const staffId = req.staff.id;
    const companyId = req.company.id;

    const {
      first_name,
      last_name,
      email,
      phone,
      designation,
      address,
      nationality,
      alternate_phone,
      id_proof_type,
      id_proof_number,
      profile_picture
    } = req.body || {};

    const updateData = {};

    if (first_name) updateData.first_name = first_name.trim();
    if (last_name) updateData.last_name = last_name.trim();
    if (phone) updateData.phone = phone.trim();
    if (designation) updateData.designation = designation.trim();
    if (address) updateData.address = address.trim();
    if (nationality) updateData.nationality = nationality.trim();
    if (alternate_phone) updateData.alternate_phone = alternate_phone.trim();
    if (id_proof_type) updateData.id_proof_type = id_proof_type.trim();
    if (id_proof_number) updateData.id_proof_number = id_proof_number.trim();
    if (profile_picture) {
      // FIX: Ignore local mobile file paths
      if (profile_picture.startsWith('/uploads/') || profile_picture.startsWith('http')) {
        updateData.profile_picture = profile_picture;
      }
    }

    if (email) {
      const trimmedEmail = email.trim().toLowerCase();
      if (trimmedEmail !== req.staff.email) {
        const isUnique = await Staff.isEmailUnique(trimmedEmail, companyId, staffId);
        if (!isUnique) {
          return errorResponse(res, 409, "This email is already in use by another staff member.");
        }
        updateData.email = trimmedEmail;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, 400, "No valid fields provided for update. Ensure Content-Type is set correctly.");
    }


    const updatedStaff = await Staff.updateStaff(staffId, updateData, companyId);

    if (!updatedStaff) {
      return errorResponse(res, 500, "Failed to update profile.");
    }

    sseService.publish(`c_${companyId}`, 'staff_list_refresh', { action: 'updated', staffId });

    return successResponse(res, "Profile updated successfully", updatedStaff, 200, req);

  } catch (err) {
    console.error("Update My Profile Error:", err);
    return errorResponse(res, 500, err.message);
  }
};

const deleteStaff = async (req, res) => {
  try {
    const companyId = req.company.id;
    const deleted = await Staff.deleteStaff(req.params.id, companyId);
    if (!deleted) return errorResponse(res, 404, "Staff not found or unauthorized");

    sseService.publish(`c_${companyId}`, 'staff_list_refresh', { action: 'deleted', staffId: req.params.id });

    return successResponse(res, "Staff deleted successfully", {}, 200, req);
  } catch (err) {
    if (err.message === "Cannot delete the last admin user") {
      return errorResponse(res, 403, err.message);
    }
    if (err.message.startsWith("Cannot delete staff with assigned leads")) {
      return errorResponse(res, 403, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const updateStaffStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const companyId = req.company.id;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return errorResponse(res, 400, "Status must be 'active', 'inactive', or 'suspended'");
    }

    const updated = await Staff.updateStaffStatus(req.params.id, status, companyId);
    if (!updated) return errorResponse(res, 404, "Staff not found or unauthorized");

    sseService.publish(`c_${companyId}`, 'staff_list_refresh', { action: 'status_updated', staffId: req.params.id, newStatus: status });

    return successResponse(res, "Staff status updated", updated, 200, req);
  } catch (err) {
    if (err.message === "Cannot deactivate the last admin user") {
      return errorResponse(res, 403, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const getStaffPerformance = async (req, res) => {
  try {
    const companyId = req.company.id;
    const performance = await Staff.getStaffPerformance(req.params.id, companyId);
    if (!performance) return errorResponse(res, 404, "Staff not found or unauthorized");
    return successResponse(res, "Staff performance fetched", performance, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getCompanyRoles = async (req, res) => {
  try {
    const companyId = req.company.id;
    const roles = await Staff.getCompanyRoles(companyId);
    return successResponse(res, "Roles fetched successfully", roles, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getStaffStats = async (req, res) => {
  try {
    const companyId = req.company.id;
    const stats = await Staff.getStaffStats(companyId);
    return successResponse(res, "Staff statistics fetched", stats, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getDesignationOptions = async (req, res) => {
  try {
    const designations = await Staff.getDesignationOptions();
    return successResponse(res, "Designation options fetched", designations, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getStatusOptions = async (req, res) => {
  try {
    const statuses = await Staff.getStatusOptions();
    return successResponse(res, "Status options fetched", statuses, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const updateMyPassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    const staffId = req.staff.id;

    if (!new_password || new_password.length < 6) {
      return errorResponse(res, 400, "Password must be at least 6 characters long");
    }

    await Staff.updateStaffPassword(staffId, new_password);

    return successResponse(res, "Password updated. Welcome aboard!");
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  updateMyProfile,
  getMyProfile,
  deleteStaff,
  updateStaffStatus,
  getStaffPerformance,
  getCompanyRoles,
  getStaffStats,
  getDesignationOptions,
  getStatusOptions,
  updateMyPassword
};