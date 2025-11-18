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
  updateCompanyVerification,
  getCompanyById,
  getCompanySubscriptionStatus
} = require('../models/authModel');

const { staffLogin: staffLoginModel } = require('../models/staffModel');
const Staff = require("../models/staffModel");

const { updateSubscriptionStatusManual } = require('../models/super-admin-models/companyModel');
const { getPackageById } = require('../models/super-admin-models/subscriptionModel');
const { createInvoice, getInvoiceById, updateInvoice } = require('../models/super-admin-models/invoiceModel');
const { sendInvoiceEmail } = require('../services/emailService');
const { calculateTaxAndTotal } = require('../utils/calculationHelper');
const { calculateEndDate } = require('../utils/subscriptionHelper');
const { logSystemEvent } = require('../models/loggingModel');
const { generateInvoicePdf } = require('../utils/pdfGenerator');

const { getActivePackages} = require('../models/super-admin-models/subscriptionModel');
const { getCurrentStaffCount } = require('../models/staffModel');
const { getLeadsCreatedThisMonth, getLeadsTotalCount } = require('../models/leadsModel');

const pool = require('../config/database');

const { sendSignupOTPEmail, sendResetOTPEmail } = require('../services/emailService');
const { generateOTP } = require('../utils/generateOTP');
const { generateToken } = require('../utils/jwtHelper');
const { errorResponse } = require('../utils/errorResponse');
const { successResponse } = require('../utils/responseFormatter');
const {
  getAllTimezones,
  getCommonTimezones: getCommonTimezonesHelper,
  parseAndConvertToUTC,
  isValidTimezone
} = require('../utils/timezoneHelper');
const { createNotification } = require('../../src/models/super-admin-models/notificationModel');
const moment = require('moment');

const Role = require('../models/roleModel');
const { createDefaultLeadSources, createDefaultLeadStatuses } = require('../models/leadsModel');



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

      return successResponse(res, "OTP sent to your email address", {}, 200, req);
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

    return successResponse(res, "OTP verified successfully", {}, 200, req);

  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const setPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    const company = await getCompanyByEmail(email);
    if (!company) {
      return errorResponse(res, 404, "Company not found");
    }

    await updateCompanyPassword(email, password);
    await updateCompanyVerification(email, true);

    await Role.createDefaultRoles(company.id);
    await createDefaultLeadSources(company.id);
    await createDefaultLeadStatuses(company.id);

    return successResponse(res, "Password set successfully. You can now login.", {}, 200, req);

  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const getAvailablePackages = async (req, res) => {
  try {
    const packages = await getActivePackages();

    const availablePackages = packages.filter(p => {
        return p.is_active;
    });

    return successResponse(res, "Available subscription packages retrieved successfully", {
      packages: availablePackages
    }, 200, req);
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve subscription packages for selection.");
  }
};


const selectInitialSubscription = async (req, res) => {
  const companyId = req.company.id;
  const { package_id, duration_type } = req.body;
  const timezone = req.timezone;

  try {
    const company = req.company;

    if (company.subscription_package_id) {
      return errorResponse(res, 400, "Subscription already selected for this company.");
    }

    const packageData = await getPackageById(package_id);

    if (!packageData || !packageData.is_active) {
      return errorResponse(res, 404, "Invalid or inactive subscription package selected.");
    }

    const isFree = parseFloat(packageData.price) <= 0 || packageData.is_trial;

    if (isFree) {
      const duration = packageData.trial_duration_days || 7;
      const startDate = moment().tz(timezone).startOf('day').toISOString();
      const endDate = moment().tz(timezone).add(duration, 'days').endOf('day').toISOString();

      await updateSubscriptionStatusManual(companyId, null, 'approve', {
        subscription_package_id: package_id,
        subscription_start_date: startDate,
        subscription_end_date: endDate
      });

      await logSystemEvent({
          company_id: companyId,
          log_level: 'INFO',
          log_category: 'SUBSCRIPTION',
          message: `Free subscription selected and immediately activated: ${packageData.name}.`
      });

      return successResponse(res, "Free subscription activated successfully.", {
  package_name: packageData.name,
  redirect_to: 'dashboard',
  subscription_status: 'approved'
}, 200, req);

    } else {

      const baseAmount = parseFloat(packageData.price);
      const { tax_amount, total_amount } = await calculateTaxAndTotal(baseAmount);

      const startDate = moment().tz(timezone).startOf('day');
      const endDate = calculateEndDate(startDate, duration_type, 1, timezone);
      const dueDate = moment().tz(timezone).add(7, 'days').endOf('day');

      await updateSubscriptionStatusManual(companyId, null, 'pending', {
        subscription_package_id: package_id,
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: endDate.toISOString()
      });
      const newInvoice = await createInvoice({
        company_id: companyId,
        subscription_package_id: package_id,
        amount: baseAmount,
        tax_amount,
        total_amount,
        currency: 'USD',
        billing_period_start: startDate.toISOString(),
        billing_period_end: endDate.toISOString(),
        due_date: dueDate.toISOString(),
        status: 'pending'
      });

      const invoiceData = await getInvoiceById(newInvoice.id);
      const pdfBuffer = await generateInvoicePdf(invoiceData);
      await sendInvoiceEmail(invoiceData, pdfBuffer);

      await updateInvoice(newInvoice.id, { status: 'sent' });

      try {
          await createNotification({
              company_id: companyId,
              super_admin_id: null,
              title: 'NEW PAID SUBSCRIPTION REQUEST',
              message: `Company ${company.company_name} selected ${packageData.name} (${invoiceData.currency} ${invoiceData.total_amount}). Invoice #${newInvoice.invoice_number} sent. Awaiting payment.`,
              notification_type: 'payment_pending',
              priority: 'high',
              metadata: {
                  invoice_id: newInvoice.id,
                  package_id: package_id,
                  company_name: company.company_name
              }
          });
      } catch (e) {
          console.error('Non-critical: Failed to send Super Admin notification:', e);
      }

      await logSystemEvent({
          company_id: companyId,
          log_level: 'INFO',
          log_category: 'SUBSCRIPTION',
          message: `Paid subscription request initiated. Invoice #${newInvoice.invoice_number} sent. Status: pending.`
      });

return successResponse(res, "Paid subscription requested. Invoice sent. Awaiting admin payment approval.", {
  invoice_number: newInvoice.invoice_number,
  amount: newInvoice.total_amount,
  redirect_to: 'subscription-pending',
  subscription_status: 'pending'
}, 200, req);
    }

  } catch (error) {
    console.error('Select Initial Subscription Error:', error);
    return errorResponse(res, 500, 'Failed to process subscription selection.');
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
        const detailedCompany = await getCompanyById(company.id);
        const subscriptionEndDate = moment(detailedCompany.subscription_end_date);

        const requiresPlanSelection = !detailedCompany.subscription_package_id;

        if (!requiresPlanSelection && (!detailedCompany.is_active || subscriptionEndDate.isBefore(moment()))) {
          return errorResponse(res, 403, "Your company subscription is inactive or expired. Please renew your plan.");
        }

        const token = generateToken({
          id: detailedCompany.id,
          admin_email: detailedCompany.admin_email,
          type: 'company'
        });

        const responseData = {
          token,
          company: {
            id: detailedCompany.id,
            admin_email: detailedCompany.admin_email,
            company_name: detailedCompany.company_name,
            unique_company_id: detailedCompany.unique_company_id,
            email_verified: detailedCompany.email_verified,
            created_at: detailedCompany.created_at,
            subscription_end_date: detailedCompany.subscription_end_date,
            is_active: detailedCompany.is_active,
            requires_plan_selection: requiresPlanSelection
          }
        };

        return successResponse(res, "Login successful", responseData, 200, req);
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
        return successResponse(res, "Login successful", responseData, 200, req);
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

    return successResponse(res, "Password reset OTP sent to email", {}, 200, req);

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

    return successResponse(res, "Password reset successfully", {}, 200, req);

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
      company_size,
      timezone
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

    if (timezone !== undefined) {
      if (timezone && !isValidTimezone(timezone)) {
        return errorResponse(res, 400, "Invalid timezone. Please provide a valid IANA timezone.");
      }
      await pool.query(
        `INSERT INTO company_settings (company_id, timezone, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (company_id)
         DO UPDATE SET timezone = $2, updated_at = CURRENT_TIMESTAMP`,
        [req.company.id, timezone || 'UTC']
      );

      req.timezone = timezone || 'UTC';

      profileData.timezone = timezone;
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
        message: timezone
          ? `Your company profile has been updated. Timezone changed to ${timezone}`
          : 'Your company profile has been updated.',
        notification_type: 'profile_update',
        priority: 'normal',
        is_read: false,
        metadata: profileData
      });
    } catch (notificationError) {
    }

    return successResponse(res, "Company profile updated successfully", {
      company: updatedCompany
    }, 200, req);

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
      const companyId = company.id;

      const { rows } = await pool.query(
        'SELECT timezone FROM company_settings WHERE company_id = $1',
        [companyId]
      );
      const timezone = rows[0]?.timezone || 'UTC';

      const [
        staffCount,
        leadsThisMonthCount,
        leadsTotalCount
      ] = await Promise.all([
        getCurrentStaffCount(companyId),
        getLeadsCreatedThisMonth(companyId),
        getLeadsTotalCount(companyId)
      ]);

      const subscriptionEndDate = moment(company.subscription_end_date);
      const daysRemaining = subscriptionEndDate.isValid() && subscriptionEndDate.isAfter(moment())
                           ? subscriptionEndDate.diff(moment(), 'days') : 0;

      const packageFeatures = company.features || [];

      const cleanFeatures = Array.isArray(packageFeatures)
        ? packageFeatures.filter(f => !f.includes('max_custom_fields'))
        : [];

      const profileData = {
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
          updated_at: company.updated_at,
          timezone: timezone
        },
        subscription: {
          package_name: company.package_name,
          max_staff: company.max_staff_count,
          max_leads_per_month: company.max_leads_per_month,
          max_custom_fields: company.max_custom_fields,
          expires_at: company.subscription_end_date,
          days_remaining: daysRemaining,
          is_trial: company.is_trial,
          features: cleanFeatures
        },
        usage: {
          staff_count: staffCount,
          staff_limit: company.max_staff_count,
          leads_this_month: leadsThisMonthCount,
          leads_limit: company.max_leads_per_month,
          leads_total: leadsTotalCount
        }
      };

      return successResponse(res, "Profile fetched successfully", profileData, 200, req);
    } else if (req.userType === 'staff') {
      const staff = req.staff;
      const staffData = {
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
      };
      return successResponse(res, "Profile fetched successfully", staffData, 200, req);
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

      return successResponse(res, "Password updated successfully", {}, 200, req);

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

      return successResponse(res, "Password updated successfully", {
        is_first_login: updatedStaff.is_first_login
      }, 200, req);
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

    return successResponse(res, "Logged out successfully", {}, 200, req);
  } catch (error) {
    return errorResponse(res, 500, "Internal server error");
  }
};

const getTimezones = async (req, res) => {
  try {
    const timezones = getAllTimezones();
    return successResponse(res, "Timezones fetched successfully", {
      timezones,
      count: timezones.length
    }, 200, req);
  } catch (error) {
    return errorResponse(res, 500, "Failed to fetch timezones");
  }
};

const getCommonTimezonesController = async (req, res) => {
  try {
    const timezones = getCommonTimezonesHelper();
    return successResponse(res, "Common timezones fetched successfully", {
      timezones,
      count: timezones.length
    }, 200, req);
  } catch (error) {
    return errorResponse(res, 500, "Failed to fetch common timezones");
  }
};

const getSubscriptionStatus = async (req, res) => {
  try {
    if (req.userType !== 'admin') {
      return errorResponse(res, 403, "Only company admin can check subscription status");
    }

    const companyId = req.company.id;
    const statusData = await getCompanySubscriptionStatus(companyId);

    if (!statusData) {
      return errorResponse(res, 404, "Company not found");
    }

    // Determine the frontend state based on subscription_status
    let frontendState = 'unknown';
    let message = '';
    let canAccessDashboard = false;

    switch (statusData.subscription_status) {
      case 'trial':
        frontendState = 'active';
        message = 'Your trial subscription is active';
        canAccessDashboard = true;
        break;

      case 'pending':
        frontendState = 'awaiting_payment';
        message = 'Your subscription request has been submitted. Please complete payment and wait for admin verification.';
        canAccessDashboard = false;
        break;

      case 'payment_received':
        frontendState = 'payment_verified';
        message = 'Payment received! Your subscription is being activated by our admin team.';
        canAccessDashboard = false;
        break;

      case 'approved':
        frontendState = 'active';
        message = 'Your subscription is active';
        canAccessDashboard = true;
        break;

      case 'rejected':
        frontendState = 'rejected';
        message = 'Your subscription request was rejected. Please contact support.';
        canAccessDashboard = false;
        break;

      case 'expired':
        frontendState = 'expired';
        message = 'Your subscription has expired. Please renew to continue.';
        canAccessDashboard = false;
        break;

      case 'cancelled':
        frontendState = 'cancelled';
        message = 'Your subscription has been cancelled.';
        canAccessDashboard = false;
        break;

      default:
        frontendState = 'unknown';
        message = 'Subscription status unknown. Please contact support.';
        canAccessDashboard = false;
    }

    const responseData = {
      subscription_status: statusData.subscription_status,
      frontend_state: frontendState,
      message: message,
      can_access_dashboard: canAccessDashboard,
      is_active: statusData.is_active,
      package_name: statusData.package_name,
      invoice: statusData.invoice_number ? {
        invoice_number: statusData.invoice_number,
        status: statusData.invoice_status,
        amount: statusData.total_amount,
        currency: statusData.currency
      } : null,
      subscription_end_date: statusData.subscription_end_date
    };

    return successResponse(res, "Subscription status retrieved successfully", responseData, 200, req);

  } catch (error) {
    console.error('Get subscription status error:', error);
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
  logout,
  getTimezones,
  getCommonTimezones: getCommonTimezonesController,
  getAvailablePackages,
  selectInitialSubscription,
  getSubscriptionStatus
};