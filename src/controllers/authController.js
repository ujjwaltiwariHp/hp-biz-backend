const {
  createCompany,
  getCompanyByEmail,
  updateCompanyProfile,
  updateCompanyPassword,
  verifyPassword,
  createOTP,
  getValidOTP,
  markOTPAsUsed,
  createResetOTP,
  getValidResetOTP,
  invalidateSession,
  updateCompanyVerification
} = require('../models/authModel');

const { staffLogin: staffLoginModel } = require('../models/staffModel');
const Staff = require("../models/staffModel");

const { sendSignupOTPEmail, sendResetOTPEmail } = require('../services/emailService');
const { generateOTP } = require('../utils/generateOTP');
const { generateToken } = require('../utils/jwtHelper');
const { errorResponse } = require('../utils/errorResponse');
const { successResponse } = require('../utils/successResponse');
const { createNotification } = require('../../src/models/super-admin-models/notificationModel');

const signup = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return errorResponse(res, 400, "Email is required");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 400, "Please provide a valid email address");
    }

    const existingCompany = await getCompanyByEmail(email);

    if (existingCompany && existingCompany.email_verified) {
      return errorResponse(res, 409, "This email has already been used");
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRE_MINUTES || 10) * 60 * 1000);

    try {
      await createOTP({ email, otp, otp_type: "signup", expires_at: expiresAt });
      await sendSignupOTPEmail(email, otp);

      if (!existingCompany) {
        await createCompany({ admin_email: email });
      }

      return successResponse(res, "OTP sent to your email address");
    } catch (emailError) {
      return errorResponse(res, 500, "Failed to send OTP email");
    }

  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return errorResponse(res, 400, "Email and OTP are required");
    }

    if (otp.length !== 4 || !/^\d+$/.test(otp)) {
      return errorResponse(res, 400, "OTP must be 4 digits");
    }

    let otpRecord = await getValidOTP(email, otp);
    if (!otpRecord) {
      otpRecord = await getValidResetOTP(email, otp);
    }

    if (!otpRecord) {
      return errorResponse(res, 400, "Invalid or expired OTP");
    }

    await markOTPAsUsed(otpRecord.id);

    if (otpRecord.otp_type === 'signup') {
      await updateCompanyVerification(email, true);
    }

    return successResponse(res, "OTP verified successfully");

  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const setPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, "Email and password are required");
    }

    if (password.length < 6) {
      return errorResponse(res, 400, "Password must be at least 6 characters long");
    }

    const company = await getCompanyByEmail(email);
    if (!company) {
      return errorResponse(res, 404, "Company not found");
    }

    await updateCompanyPassword(email, password);
    await updateCompanyVerification(email, true);

    return successResponse(res, "Password set successfully. You can now login.");

  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, "Email and password are required");
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    const company = await getCompanyByEmail(trimmedEmail);
    if (company && company.email_verified && company.password_hash) {
      const isValidPassword = await verifyPassword(trimmedPassword, company.password_hash);
      if (isValidPassword) {
        const token = generateToken({
          id: company.id,
          admin_email: company.admin_email,
          type: 'company'
        });

        const responseData = {
          success: true,
          message: "Login successful",
          token,
          company: {
            id: company.id,
            admin_email: company.admin_email,
            company_name: company.company_name,
            unique_company_id: company.unique_company_id,
            email_verified: company.email_verified,
            created_at: company.created_at
          }
        };

       return res.status(200).json(responseData);
      }
    }

    try {
      const staff = await staffLoginModel(trimmedEmail, trimmedPassword);
      if (staff) {
        await Staff.updateStaff(staff.id, { last_login: new Date() }, staff.company_id);

        const token = generateToken({
          id: staff.id,
          company_id: staff.company_id,
          role: staff.role_name,
          type: 'staff'
        });

        const responseData = {
          success: true,
          message: "Login successful",
          token,
          staff: {
            id: staff.id,
            company_id: staff.company_id,
            company_name: staff.company_name,
            unique_company_id: staff.unique_company_id,
            email: staff.email,
            first_name: staff.first_name,
            last_name: staff.last_name,
            role_name: staff.role_name,
            role_id: staff.role_id,
            permissions: staff.permissions,
            is_first_login: staff.is_first_login,
            designation: staff.designation,
            last_login: staff.last_login
          }
        };
        return res.status(200).json(responseData);
      }
    } catch (staffError) {
    }

    return errorResponse(res, 401, "Invalid credentials or account not verified/active");

  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return errorResponse(res, 400, "Email is required");

    const company = await getCompanyByEmail(email);
    if (!company) {
      return errorResponse(res, 404, "Company not found");
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRE_MINUTES || 10) * 60 * 1000);

    await createResetOTP({ email, otp, expires_at: expiresAt });
    await sendResetOTPEmail(email, otp);

    return successResponse(res, "Password reset OTP sent to email");

  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    const company = await getCompanyByEmail(email);
    if (!company) {
      return errorResponse(res, 404, "Company not found");
    }

    await updateCompanyPassword(email, password);

    return successResponse(res, "Password reset successfully");

  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};


const updateProfile = async (req, res) => {
  try {
    if (req.userType !== 'admin') {
      return errorResponse(res, 403, "Only company admin can update company profile");
    }

    const {
      company_name,
      admin_name,
      phone,
      address,
      website,
      industry,
      company_size
    } = req.body;

    const profileData = {};

    if (company_name !== undefined) {
      if (!company_name.trim()) {
        return errorResponse(res, 400, "Company name cannot be empty");
      }
      profileData.company_name = company_name.trim();
    }

    if (admin_name !== undefined) {
      if (!admin_name.trim()) {
        return errorResponse(res, 400, "Admin name cannot be empty");
      }
      profileData.admin_name = admin_name.trim();
    }

    if (phone !== undefined) {
      if (phone && !/^\+?[\d\s\-\(\)]+$/.test(phone)) {
        return errorResponse(res, 400, "Please provide a valid phone number");
      }
      profileData.phone = phone;
    }

    if (address !== undefined) {
      profileData.address = address;
    }

    if (website !== undefined) {
      if (website && !/^https?:\/\/.+\..+/.test(website)) {
        return errorResponse(res, 400, "Please provide a valid website URL");
      }
      profileData.website = website;
    }

    if (industry !== undefined) {
      profileData.industry = industry;
    }

    if (company_size !== undefined) {
      const validSizes = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
      if (company_size && !validSizes.includes(company_size)) {
        return errorResponse(res, 400, "Invalid company size. Valid options: 1-10, 11-50, 51-200, 201-1000, 1000+");
      }
      profileData.company_size = company_size;
    }

    if (Object.keys(profileData).length === 0) {
      return errorResponse(res, 400, "No valid fields provided for update");
    }

    const updatedCompany = await updateCompanyProfile(req.company.id, profileData);

    if (!updatedCompany) {
      return errorResponse(res, 404, "Company not found or unauthorized");
    }


    try {
      await createNotification({
        company_id: req.company.id,
        title: 'Profile Updated',
        message: 'Your company profile has been updated.',
        notification_type: 'profile_update',
        priority: 'normal',
        is_read: false,
        metadata: profileData
      });
    } catch (notificationError) {
    }

    return successResponse(res, "Company profile updated successfully", {
      company: updatedCompany
    });

  } catch (error) {
    if (error.message.includes("No valid fields")) {
      return errorResponse(res, 400, error.message);
    }
    return errorResponse(res, 500, "Internal server error");
  }
};

const getProfile = async (req, res) => {
  try {
    if (req.userType === 'admin') {
      const company = req.company;
      return res.status(200).json({
        success: true,
        company: {
          id: company.id,
          admin_email: company.admin_email,
          company_name: company.company_name,
          admin_name: company.admin_name,
          phone: company.phone,
          address: company.address,
          website: company.website,
          industry: company.industry,
          company_size: company.company_size,
          unique_company_id: company.unique_company_id,
          email_verified: company.email_verified,
          is_active: company.is_active,
          created_at: company.created_at,
          updated_at: company.updated_at
        }
      });
    } else if (req.userType === 'staff') {
      const staff = req.staff;
      return res.status(200).json({
        success: true,
        staff: {
          id: staff.id,
          company_id: staff.company_id,
          email: staff.email,
          first_name: staff.first_name,
          last_name: staff.last_name,
          phone: staff.phone,
          designation: staff.designation,
          role_name: staff.role_name,
          permissions: staff.permissions,
          status: staff.status,
          last_login: staff.last_login
        }
      });
    }
  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (req.userType === 'admin') {
      const isValidPassword = await verifyPassword(current_password, req.company.password_hash);
      if (!isValidPassword) {
        return errorResponse(res, 401, "Current password is incorrect");
      }

      await updateCompanyPassword(req.company.admin_email, new_password);

      return successResponse(res, "Password updated successfully");

    } else if (req.userType === 'staff') {
      const staffId = req.staff.id;

      if (!req.staff.is_first_login && !current_password) {
        return errorResponse(res, 400, "Current password is required");
      }

      if (!req.staff.is_first_login) {
        const staff = await staffLoginModel(req.staff.email, current_password);
        if (!staff) {
          return errorResponse(res, 401, "Current password is incorrect");
        }
      }

      const updatedStaff = await Staff.updateStaffPassword(staffId, new_password);

      return res.status(200).json({
        success: true,
        message: "Password updated successfully",
        is_first_login: updatedStaff.is_first_login
      });
    }
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const logout = async (req, res) => {
  try {
    if (req.userType === 'admin') {
      const company = req.company;
      await invalidateSession(company.id);
    }

    return successResponse(res, "Logged out successfully");
  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

module.exports = {
  signup,
  verifyOTP,
  setPassword,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout
};