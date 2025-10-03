const { errorResponse } = require('../utils/errorResponse');

const validateAdminEmail = (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return errorResponse(res, 400, "Admin email is required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return errorResponse(res, 400, "Please provide a valid admin email address");
  }

  req.body.email = email.trim().toLowerCase();
  next();
};

const validateOTP = (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return errorResponse(res, 400, "Admin email and OTP are required");
  }

  if (otp.toString().length !== 4 || !/^\d+$/.test(otp.toString())) {
    return errorResponse(res, 400, "OTP must be 4 digits");
  }

  req.body.email = email.trim().toLowerCase();
  req.body.otp = otp.toString();
  next();
};

const validatePassword = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 400, "Admin email and password are required");
  }

  if (password.length < 6) {
    return errorResponse(res, 400, "Password must be at least 6 characters long");
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < 8 && !(hasUpperCase && hasLowerCase && hasNumbers)) {
    return errorResponse(res, 400, "Password should contain uppercase, lowercase, and numbers for better security");
  }

  req.body.email = email.trim().toLowerCase();
  next();
};

const validateCompanyRegistration = (req, res, next) => {
  const {
    unique_company_id,
    company_name,
    admin_email,
    admin_name,
    password,
    phone,
    industry
  } = req.body;

  if (!unique_company_id || !company_name || !admin_email || !admin_name || !password) {
    return errorResponse(res, 400, "All required fields must be provided");
  }

  if (unique_company_id.length < 3 || unique_company_id.length > 20) {
    return errorResponse(res, 400, "Company ID must be between 3 and 20 characters");
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(unique_company_id)) {
    return errorResponse(res, 400, "Company ID can only contain letters, numbers, hyphens, and underscores");
  }

  if (company_name.trim().length < 2) {
    return errorResponse(res, 400, "Company name must be at least 2 characters long");
  }

  if (admin_name.trim().length < 2) {
    return errorResponse(res, 400, "Admin name must be at least 2 characters long");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(admin_email.trim())) {
    return errorResponse(res, 400, "Please provide a valid admin email address");
  }

  if (password.length < 6) {
    return errorResponse(res, 400, "Password must be at least 6 characters long");
  }

  if (phone && phone.trim() && !/^[\d+\-\s()]{10,}$/.test(phone.trim())) {
    return errorResponse(res, 400, "Invalid phone number format");
  }

  req.body.unique_company_id = unique_company_id.toLowerCase().trim();
  req.body.company_name = company_name.trim();
  req.body.admin_email = admin_email.trim().toLowerCase();
  req.body.admin_name = admin_name.trim();
  req.body.phone = phone ? phone.trim() : null;
  req.body.industry = industry ? industry.trim() : null;

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 400, "Email and password are required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return errorResponse(res, 400, "Please provide a valid email address");
  }

  req.body.email = email.trim().toLowerCase();
  next();
};

const validateStaffData = (req, res, next) => {
  const { first_name, last_name, email, phone, designation, role_id, status } = req.body;

  if (!first_name || !last_name || !email || !role_id) {
    return errorResponse(res, 400, "First name, last name, email, and role are required");
  }

  if (first_name.trim().length < 2) {
    return errorResponse(res, 400, "First name must be at least 2 characters long");
  }

  if (last_name.trim().length < 2) {
    return errorResponse(res, 400, "Last name must be at least 2 characters long");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return errorResponse(res, 400, "Please provide a valid email address");
  }

  if (phone && phone.trim() && !/^[\d+\-\s()]{10,}$/.test(phone.trim())) {
    return errorResponse(res, 400, "Invalid phone number format");
  }

  if (!Number.isInteger(parseInt(role_id)) || parseInt(role_id) <= 0) {
    return errorResponse(res, 400, "Invalid role ID");
  }

  if (status && !['active', 'inactive', 'suspended'].includes(status)) {
    return errorResponse(res, 400, "Status must be 'active', 'inactive', or 'suspended'");
  }

  req.body.first_name = first_name.trim();
  req.body.last_name = last_name.trim();
  req.body.email = email.trim().toLowerCase();
  req.body.phone = phone ? phone.trim() : null;
  req.body.designation = designation ? designation.trim() : null;
  req.body.role_id = parseInt(role_id);

  next();
};

const validateRoleData = (req, res, next) => {
  const { role_name, description, permissions } = req.body;

  if (!role_name || !description) {
    return errorResponse(res, 400, "Role name and description are required");
  }

  if (role_name.trim().length < 2) {
    return errorResponse(res, 400, "Role name must be at least 2 characters long");
  }

  if (role_name.trim().length > 50) {
    return errorResponse(res, 400, "Role name cannot exceed 50 characters");
  }

  if (description.trim().length < 5) {
    return errorResponse(res, 400, "Description must be at least 5 characters long");
  }

  if (description.trim().length > 200) {
    return errorResponse(res, 400, "Description cannot exceed 200 characters");
  }

  if (permissions && typeof permissions !== 'object') {
    return errorResponse(res, 400, "Permissions must be an object");
  }

  const validPermissions = ['user_management', 'lead_management', 'reports', 'settings', 'role_management'];

  if (permissions) {
    for (const key in permissions) {
      if (!validPermissions.includes(key)) {
        return errorResponse(res, 400, `Invalid permission: ${key}`);
      }
      if (typeof permissions[key] !== 'boolean') {
        return errorResponse(res, 400, `Permission ${key} must be a boolean value`);
      }
    }
  }

  req.body.role_name = role_name.trim();
  req.body.description = description.trim();

  next();
};

module.exports = {
  validateAdminEmail,
  validateOTP,
  validatePassword,
  validateCompanyRegistration,
  validateLogin,
  validateStaffData,
  validateRoleData
};