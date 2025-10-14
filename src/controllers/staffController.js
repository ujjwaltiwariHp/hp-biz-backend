const Staff = require("../models/staffModel");
const { successResponse, successResponseWithPagination } = require("../utils/responseFormatter");
const { errorResponse } = require("../utils/errorResponse");
const { sendStaffWelcomeEmail } = require('../services/emailService');
const { parseAndConvertToUTC } = require('../utils/timezoneHelper');


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
    const { first_name, last_name, email, phone, designation, status, role_id } = req.body;
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
      role_id: parseInt(role_id)
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
        role_id: staffDetails.role_id
      }
    };

    return successResponse(
      res,
      "Staff created successfully. An email with login instructions has been sent.",
      responseData,
      201,
      req
    );
  } catch (err) {
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

    const updatedStaff = await Staff.updateStaff(req.params.id, otherData, companyId);
    if (!updatedStaff) return errorResponse(res, 404, "Staff not found or unauthorized");
    const staffWithRole = await Staff.getStaffById(req.params.id, companyId);

    return successResponse(res, "Staff updated successfully", staffWithRole, 200, req);
  } catch (err) {
    if (err.message === "Cannot deactivate the last admin user") {
      return errorResponse(res, 403, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const deleteStaff = async (req, res) => {
  try {
    const companyId = req.company.id;
    const deleted = await Staff.deleteStaff(req.params.id, companyId);
    if (!deleted) return errorResponse(res, 404, "Staff not found or unauthorized");
    return successResponse(res, "Staff deleted successfully", {}, 200, req);
  } catch (err) {
    if (err.message === "Cannot delete the last admin user") {
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

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  updateStaffStatus,
  getStaffPerformance,
  getCompanyRoles,
  getStaffStats,
  getDesignationOptions,
  getStatusOptions
};