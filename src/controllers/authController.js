const {
  createCompany,
  getCompanyByEmail,
  updateCompanyProfile,
  updateCompanyPassword,
  verifyPassword,
  createResetOTP,
  getValidResetOTP,
  invalidateSession,
  updateCompanyVerification,
  getCompanyById,
  getCompanySubscriptionStatus,
  upsertTempSignup,
  getTempSignup,
  markTempSignupVerified,
  deleteTempSignup,
  createCompanySession,
  findCompanySession,
  deleteCompanySession
} = require('../models/authModel');

const Staff = require('../models/staffModel');
const { checkEmailIdentity } = require('../models/authDiscoveryModel');

const { updateSubscriptionStatusManual } = require('../models/super-admin-models/companyModel');
const { getPackageById, getActivePackages } = require('../models/super-admin-models/subscriptionModel');
const { createInvoice, getInvoiceById, updateInvoice } = require('../models/super-admin-models/invoiceModel');
const { sendInvoiceEmail } = require('../services/emailService');
const { calculateTaxAndTotal } = require('../utils/calculationHelper');
const { calculateEndDate } = require('../utils/subscriptionHelper');
const { logSystemEvent } = require('../models/loggingModel');
const { generateInvoicePdf } = require('../utils/pdfGenerator');

const { getCurrentStaffCount } = require('../models/staffModel');
const { getLeadsCreatedThisMonth, getLeadsTotalCount, createDefaultLeadSources, createDefaultLeadStatuses } = require('../models/leadsModel');

const pool = require('../config/database');

const { sendSignupOTPEmail, sendResetOTPEmail } = require('../services/emailService');
const { generateOTP } = require('../utils/generateOTP');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwtHelper');
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

const checkEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponse(res, 400, "Email is required");

    const identities = await checkEmailIdentity(email);

    if (identities.length === 0) {
      return errorResponse(res, 404, "Account not found");
    }

    const accounts = identities.map(id => ({
      user_type: id.user_type,
      company_id: id.company_id,
      company_name: id.label,
      status: id.status,
      requires_password_change: id.password_status === 'temporary'
    }));

    return successResponse(res, "Identity found", {
      email: email,
      count: accounts.length,
      accounts: accounts
    }, 200, req);

  } catch (error) {
    console.error("Check Email Error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

const signup = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return errorResponse(res, 400, "Email is required");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 400, "Please provide a valid email address");
    }

    const trimmedEmail = email.trim().toLowerCase();

    const existingCompany = await getCompanyByEmail(trimmedEmail);

    if (existingCompany && existingCompany.email_verified) {
      return errorResponse(res, 409, "This email has already been used. Please login.");
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRE_MINUTES || 10) * 60 * 1000);

    try {
      // FIX: Explicitly pass company_id: 0 for new signups
      await upsertTempSignup({
        email: trimmedEmail,
        otp,
        expires_at: expiresAt,
        company_id: 0,
        user_type: 'company'
      });

      await sendSignupOTPEmail(trimmedEmail, otp);

      return successResponse(res, "OTP sent to your email address", {}, 200, req);
    } catch (emailError) {
      console.error("Signup Email Error:", emailError);
      return errorResponse(res, 500, "Failed to send OTP email");
    }

  } catch (error) {
    console.error("Signup Controller Error:", error);
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

    const trimmedEmail = email.trim().toLowerCase();

    // FIX: Look for company_id: 0 (new signup)
    const tempSignup = await getTempSignup(trimmedEmail, 0, 'company');

    if (!tempSignup) {
      return errorResponse(res, 400, "No signup request found. Please signup first.");
    }

    if (tempSignup.otp !== otp) {
      return errorResponse(res, 400, "Invalid OTP");
    }

    if (new Date() > new Date(tempSignup.otp_expires_at)) {
      return errorResponse(res, 400, "OTP Expired");
    }

    await markTempSignupVerified(trimmedEmail, 0, 'company');

    return successResponse(res, "OTP verified successfully. Please set your password.", {}, 200, req);

  } catch (error) {
    console.error("Verify OTP Error:", error);
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

    const trimmedEmail = email.trim().toLowerCase();

    // FIX: Look for company_id: 0 (new signup)
    const tempSignup = await getTempSignup(trimmedEmail, 0, 'company');

    if (!tempSignup || !tempSignup.is_verified) {
      return errorResponse(res, 403, "Email not verified. Please verify OTP first.");
    }

    let company = await getCompanyByEmail(trimmedEmail);
    if (!company) {
      company = await createCompany({ admin_email: trimmedEmail });
    }

    await updateCompanyPassword(trimmedEmail, password);
    await updateCompanyVerification(trimmedEmail, true);

    await Role.createDefaultRoles(company.id);
    await createDefaultLeadSources(company.id);
    await createDefaultLeadStatuses(company.id);

    // FIX: Delete the specific temp signup
    await deleteTempSignup(trimmedEmail, 0, 'company');

    return successResponse(res, "Account created successfully. You can now login.", {}, 200, req);

  } catch (error) {
    console.error("Set Password Error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

const login = async (req, res) => {
  try {
    const { email, password, company_id, user_type } = req.body;
    const ip = req.ip || '0.0.0.0';
    const userAgent = req.get('User-Agent');

    if (!email || !password) {
      return errorResponse(res, 400, "Email and password are required");
    }

    const type = user_type || 'company';
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    let userData = null;
    let dbId = null;
    let requiresPasswordChange = false;
    let responsePayload = {};

    if (type === 'company') {
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

          dbId = detailedCompany.id;
          userData = detailedCompany;

          responsePayload = {
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
        }
      }
    } else if (type === 'staff') {
      if (!company_id) {
        return errorResponse(res, 400, "Company ID is required for staff login.");
      }

      try {
        const staff = await Staff.staffLogin(trimmedEmail, trimmedPassword, company_id);
        if (staff) {
          await Staff.updateStaff(staff.id, { last_login: new Date() }, staff.company_id);
          dbId = staff.id;
          userData = staff;
          requiresPasswordChange = (staff.password_status === 'temporary');

          responsePayload = {
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
              last_login: staff.last_login,
              password_status: staff.password_status
            }
          };
        }
      } catch (staffError) {
        return errorResponse(res, 401, staffError.message || "Login failed");
      }
    }

    if (!userData) {
      return errorResponse(res, 401, "Invalid credentials or account not verified/active");
    }

    const tokenPayload = {
      id: dbId,
      type: type,
      ...(type === 'company'
        ? { admin_email: userData.admin_email }
        : { company_id: userData.company_id, role: userData.role_name }
      )
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ ...tokenPayload, version: 1 });

    if (type === 'company') {
      await createCompanySession(dbId, refreshToken, ip, userAgent);
    } else {
      await Staff.createStaffSession(dbId, refreshToken, ip, userAgent);
    }

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return successResponse(res, "Login successful", {
      token: accessToken,
      userType: type,
      requires_password_change: requiresPasswordChange,
      ...responsePayload
    }, 200, req);

  } catch (error) {
    console.error('Login Controller Error:', error);
    return errorResponse(res, 500, "Internal server error");
  }
};

const setInitialPassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    const staffId = req.staff.id;
    const passwordStatus = req.staff.password_status;

    if (passwordStatus !== 'temporary') {
      return errorResponse(res, 400, "Password set up is only allowed for temporary accounts.");
    }

    if (!new_password || new_password.length < 6) {
      return errorResponse(res, 400, "New password must be at least 6 characters long.");
    }

    await Staff.activateStaffPassword(staffId, new_password);

    return successResponse(res, "Password set successfully. Your account is now active.", {}, 200, req);

  } catch (error) {
    console.error("Set Initial Password Error:", error);
    return errorResponse(res, 500, "Failed to set password");
  }
};

const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return errorResponse(res, 401, "No refresh token provided");

    const decoded = verifyToken(token);
    if (!decoded) return errorResponse(res, 403, "Invalid token");

    let session;
    if (decoded.type === 'company') {
      session = await findCompanySession(token);
    } else {
      session = await Staff.findStaffSession(token);
    }

    if (!session) {
      res.clearCookie('refreshToken');
      return errorResponse(res, 403, "Session expired or invalid");
    }

    const payload = {
      id: decoded.id,
      type: decoded.type,
      ...(decoded.type === 'company'
        ? { admin_email: decoded.admin_email }
        : { company_id: decoded.company_id, role: decoded.role }
      )
    };

    const newAccessToken = generateAccessToken(payload);

    return successResponse(res, "Token refreshed", { token: newAccessToken }, 200, req);

  } catch (error) {
    console.error("Refresh Token Error:", error);
    return errorResponse(res, 500, error.message);
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email, company_id, user_type } = req.body;

    if (!email) return errorResponse(res, 400, "Email is required");
    const trimmedEmail = email.trim().toLowerCase();
    const type = user_type || 'company';

    if (type === 'staff' && !company_id) {
      return errorResponse(res, 400, "Company ID is required for staff password reset");
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRE_MINUTES || 10) * 60 * 1000);

    if (type === 'staff') {
      const staffExists = await pool.query(
        "SELECT id FROM staff WHERE email = $1 AND company_id = $2",
        [trimmedEmail, company_id]
      );

      if (staffExists.rows.length === 0) {
        return errorResponse(res, 404, "Staff account not found in this company");
      }

      await upsertTempSignup({
        email: trimmedEmail,
        otp,
        expires_at: expiresAt,
        company_id: company_id,
        user_type: 'staff'
      });
    } else {
      const company = await getCompanyByEmail(trimmedEmail);
      if (!company) return errorResponse(res, 404, "Company account not found");

      await upsertTempSignup({
        email: trimmedEmail,
        otp,
        expires_at: expiresAt,
        company_id: company.id,
        user_type: 'company'
      });
    }

    await sendResetOTPEmail(trimmedEmail, otp);

    return successResponse(res, "Password reset OTP sent to email", {}, 200, req);

  } catch (error) {
    console.error("Forgot Password Error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, password, otp, company_id, user_type } = req.body;

    if (!email || !password || !otp) {
      return errorResponse(res, 400, "Missing required fields");
    }

    const trimmedEmail = email.trim().toLowerCase();
    const type = user_type || 'company';

    const companyToCheck = company_id || (type === 'company' ? (await getCompanyByEmail(trimmedEmail))?.id : null);

    const tempSignupRes = await pool.query(
      `SELECT * FROM temp_signups WHERE email = $1 AND user_type = $2 AND company_id = $3`,
      [trimmedEmail, type, companyToCheck]
    );
    const tempSignup = tempSignupRes.rows[0];

    if (!tempSignup || tempSignup.otp !== otp) {
      return errorResponse(res, 400, "Invalid or expired OTP");
    }

    if (type === 'staff') {
      const staffRes = await pool.query("SELECT id FROM staff WHERE email = $1 AND company_id = $2", [trimmedEmail, company_id]);
      if (staffRes.rows.length === 0) return errorResponse(res, 404, "Staff not found");

      await Staff.activateStaffPassword(staffRes.rows[0].id, password);
    } else {
      await updateCompanyPassword(trimmedEmail, password);
    }

    await pool.query("DELETE FROM temp_signups WHERE email = $1 AND user_type = $2 AND company_id = $3", [trimmedEmail, type, tempSignup.company_id]);

    return successResponse(res, "Password reset successfully", {}, 200, req);

  } catch (error) {
    console.error("Reset Password Error:", error);
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
    console.error("Get Packages Error:", error);
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

    let baseAmount;
    switch (duration_type) {
      case 'monthly':
        baseAmount = parseFloat(packageData.price_monthly);
        break;
      case 'quarterly':
        baseAmount = parseFloat(packageData.price_quarterly);
        break;
      case 'yearly':
        baseAmount = parseFloat(packageData.price_yearly);
        break;
      default:
        return errorResponse(res, 400, "Invalid billing duration type selected.");
    }

    const isFree = packageData.is_trial || baseAmount <= 0;

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
        currency: packageData.currency,
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
    console.error("Update Profile Error:", error);
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
    console.error("Get Profile Error:", error);
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
        const staff = await Staff.staffLogin(req.staff.email, current_password, req.staff.company_id);
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
    console.error("Change Password Error:", err);
    return errorResponse(res, 500, err.message);
  }
};

const logout = async (req, res) => {
  try {
    const token = req.cookies ? req.cookies.refreshToken : null;

    if (token) {
      await Promise.allSettled([
        deleteCompanySession(token),
        Staff.deleteStaffSession(token)
      ]);
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    return successResponse(res, "Logged out successfully", {}, 200, req);
  } catch (error) {
    console.error('Logout Logic Error:', error);
    return errorResponse(res, 500, "Internal server error during logout");
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
  checkEmail,
  setInitialPassword,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  getTimezones,
  getCommonTimezones: getCommonTimezonesController,
  getAvailablePackages,
  selectInitialSubscription,
  getSubscriptionStatus
};