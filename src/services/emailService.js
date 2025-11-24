const brevo = require('@getbrevo/brevo');
const pool = require("../config/database");
const moment = require('moment-timezone'); // Already imported in related controllers

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

// --- Styling Constants ---
const PRIMARY_COLOR = '#000000'; // Black
const ACCENT_COLOR = '#ffcc00'; // Yellow/Gold
const TEXT_COLOR = '#333333';
const BG_COLOR = '#f9f9f9';
const BORDER_COLOR = '#dddddd';

const BASE_STYLES = `
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 0;
  border: 1px solid ${BORDER_COLOR};
  border-collapse: collapse;
`;
// -------------------------

const formatDate = (date) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });


const getEmailTemplate = (headerTitle, bodyContent, buttonText = null, buttonLink = '#') => {
  return `
    <table width="100%" style="${BASE_STYLES}">
      <tr>
        <td style="background-color: ${PRIMARY_COLOR}; padding: 20px 0; text-align: center;">
          <h1 style="color: ${ACCENT_COLOR}; font-size: 28px; margin: 0;">HPBIZ</h1>
        </td>
      </tr>

      <tr>
        <td style="background-color: #ffffff; padding: 30px;">
          <h2 style="color: ${PRIMARY_COLOR}; font-size: 24px; text-align: center; margin-bottom: 25px;">${headerTitle}</h2>

          ${bodyContent}

          ${buttonText ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${buttonLink}" style="
                background-color: ${ACCENT_COLOR};
                color: ${PRIMARY_COLOR};
                padding: 12px 25px;
                text-decoration: none;
                border-radius: 4px;
                font-weight: bold;
                font-size: 16px;
                display: inline-block;">
                ${buttonText}
              </a>
            </div>
          ` : ''}
        </td>
      </tr>

      <tr>
        <td style="background-color: ${BG_COLOR}; padding: 15px; text-align: center; font-size: 10px; color: #666666;">
          &copy; ${new Date().getFullYear()} HPBIZ. All rights reserved.<br>
          Billing Inquiries: <a href="mailto:billing@supersaas.com" style="color: #666666; text-decoration: underline;">billing@supersaas.com</a>
        </td>
      </tr>
    </table>
  `;
};


const sendSignupOTPEmail = async (email, otp) => {
  const content = `
    <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">Thank you for registering. Please use the verification code below to confirm your account:</p>
    <div style="background-color: ${ACCENT_COLOR}; color: ${PRIMARY_COLOR}; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 4px; margin: 25px 0;">
      ${otp}
    </div>
    <p style="text-align: center; color: #666;">This code is valid for ${process.env.OTP_EXPIRE_MINUTES || 10} minutes.</p>
  `;
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "HPBIZ", email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com" };
    sendSmtpEmail.to = [{ email: email }];
    sendSmtpEmail.subject = "Verify Your HPBIZ Account";
    sendSmtpEmail.htmlContent = getEmailTemplate("Verify Your Account", content);
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Signup OTP email sent successfully');
  } catch (error) {
    console.error('Brevo email error:', error);
    throw new Error('Failed to send email');
  }
};

const sendResetOTPEmail = async (email, otp) => {
  const content = `
    <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">You requested a password reset. Please use the following code to continue the process:</p>
    <div style="background-color: ${ACCENT_COLOR}; color: ${PRIMARY_COLOR}; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 4px; margin: 25px 0;">
      ${otp}
    </div>
    <p style="text-align: center; color: #666;">This code is valid for ${process.env.OTP_EXPIRE_MINUTES || 10} minutes.</p>
  `;
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "HPBIZ", email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com" };
    sendSmtpEmail.to = [{ email: email }];
    sendSmtpEmail.subject = "HPBIZ Password Reset Request";
    sendSmtpEmail.htmlContent = getEmailTemplate("Password Reset", content);
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Reset OTP email sent successfully');
  } catch (error) {
    console.error('Brevo email error:', error);
    throw new Error('Failed to send email');
  }
};



const sendStaffWelcomeEmail = async (staffEmail, staffName, tempPassword, loginUrl) => {
  const content = `
    <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">Welcome to HPBIZ, ${staffName}! Your manager has created an account for you. Below are your login credentials:</p>
    <table style="width: 100%; margin: 20px 0; border: 1px solid ${BORDER_COLOR}; background-color: ${BG_COLOR}; border-collapse: collapse;">
      <tr><td style="padding: 10px; border-bottom: 1px solid ${BORDER_COLOR};"><strong>Email:</strong></td><td style="padding: 10px; border-bottom: 1px solid ${BORDER_COLOR};">${staffEmail}</td></tr>
      <tr><td style="padding: 10px;"><strong>Temporary Password:</strong></td><td style="padding: 10px;">${tempPassword}</td></tr>
    </table>
    <p style="color: ${TEXT_COLOR}; font-size: 14px; line-height: 1.5;">Please log in immediately and change your temporary password.</p>
  `;
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "HPBIZ", email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com" };
    sendSmtpEmail.to = [{ email: staffEmail }];
    sendSmtpEmail.subject = `Welcome to HPBIZ, ${staffName}!`;
    sendSmtpEmail.htmlContent = getEmailTemplate("New Staff Account", content, "Login Now", loginUrl);
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Staff welcome email sent successfully');
  } catch (error) {
    console.error('Brevo email error:', error);
    throw new Error('Failed to send email');
  }
};


const sendNotificationEmail = async (staffId, companyId, title, message) => {
  try {
    const staffResult = await pool.query(
      `SELECT s.first_name, s.email, c.company_name
       FROM staff s
       INNER JOIN companies c ON s.company_id = c.id
       WHERE s.id = $1 AND c.id = $2`,
      [staffId, companyId]
    );

    if (staffResult.rows.length === 0) return;

    const { first_name, email } = staffResult.rows[0];
    const settingsResult = await pool.query(
      `SELECT email_notifications FROM company_settings WHERE company_id = $1`,
      [companyId]
    );

    const emailNotificationsEnabled = settingsResult.rows.length > 0 ? settingsResult.rows[0].email_notifications : true;
    if (!emailNotificationsEnabled) return;

    const content = `
      <p style="color: ${TEXT_COLOR};">Hello ${first_name},</p>
      <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">${message}</p>
    `;

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "HPBIZ", email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com" };
    sendSmtpEmail.to = [{ email: email }];
    sendSmtpEmail.subject = `HPBIZ: ${title}`;
    sendSmtpEmail.htmlContent = getEmailTemplate(title, content);
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Notification email sent successfully');
  } catch (error) {
    console.error('Notification email error:', error);
  }
};

const sendAdminNotificationEmail = async (adminEmail, companyName, title, message) => {
  try {
    const content = `
      <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">${message}</p>
      <p style="color: #999;">Relevant to company: ${companyName}</p>
    `;
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "HPBIZ", email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com" };
    sendSmtpEmail.to = [{ email: adminEmail }];
    sendSmtpEmail.subject = `HPBIZ Admin: ${title}`;
    sendSmtpEmail.htmlContent = getEmailTemplate(title, content);
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Admin notification email sent successfully');
  } catch (error) {
    console.error('Admin notification error:', error);
  }
};


const sendInvoiceEmail = async (invoiceData, pdfBuffer) => {
  try {
    const { billing_email, company_name, invoice_number, total_amount, currency, status, due_date } = invoiceData;

    const subject = status === 'overdue'
      ? `ACTION REQUIRED: OVERDUE Invoice ${invoice_number} from HPBIZ`
      : `HPBIZ Invoice ${invoice_number} (Payment Due)`;

    const bodyMessage = status === 'overdue'
      ? `Your invoice is currently **overdue**. Please find the attached document for the payment amount of **${currency} ${parseFloat(total_amount).toFixed(2)}** and details on how to remit payment immediately.`
      : `Your latest invoice is ready. Please find the attached PDF for the payment amount of **${currency} ${parseFloat(total_amount).toFixed(2)}** and details on how to remit payment.`;

    const content = `
      <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">Dear customer of <strong>${company_name}</strong>,</p>
      <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">${bodyMessage}</p>

      <table style="width: 100%; margin: 20px 0; border: 1px solid ${BORDER_COLOR}; background-color: ${BG_COLOR}; border-collapse: collapse;">
        <tr><td style="padding: 10px;"><strong>Invoice Number:</strong></td><td style="padding: 10px; text-align: right;">${invoice_number}</td></tr>
        <tr><td style="padding: 10px;"><strong>Amount Due:</strong></td><td style="padding: 10px; text-align: right;"><strong>${currency} ${parseFloat(total_amount).toFixed(2)}</strong></td></tr>
        <tr><td style="padding: 10px;"><strong>Due Date:</strong></td><td style="padding: 10px; text-align: right; color: #c0392b;">${formatDate(due_date)}</td></tr>
      </table>
      <p style="color: ${TEXT_COLOR}; font-size: 14px; line-height: 1.5;">Please process the payment before the due date to ensure uninterrupted service. The invoice is attached as a PDF.</p>
    `;

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "HPBIZ", email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com" };
    sendSmtpEmail.to = [{ email: billing_email }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = getEmailTemplate(`Invoice ${invoice_number} Ready`, content, "View Payment Options", "#");
    sendSmtpEmail.attachment = [{ name: `invoice-${invoice_number}.pdf`, content: pdfBuffer.toString('base64') }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Invoice email sent successfully');
    return { success: true, message: 'Invoice email sent' };
  } catch (error) {
    console.error('Invoice email error:', error);
    throw error;
  }
};


const sendSubscriptionActivationEmail = async (companyData, packageData, endDate, invoiceData, pdfBuffer) => {
  try {
    const { admin_email, company_name, admin_name } = companyData;
    const packageName = packageData.name;
    const loginUrl = process.env.APP_LOGIN_URL || 'https://app-login-url.com/login';

    const formattedEndDate = formatDate(endDate);
    const formattedPaidDate = formatDate(invoiceData.payment_date);

    let featuresList = [];
    if (packageData.features && Array.isArray(packageData.features)) {
        featuresList = packageData.features.map(f => `<li style="margin-bottom: 5px;">${f.replace(/_/g, ' ')}</li>`).join('');
    }

    const content = `
      <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">Hello ${admin_name},</p>
      <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">Great news! Your payment for <strong>${company_name}</strong> has been successfully processed and your subscription is now **Active**.</p>
      <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">Your detailed paid invoice is attached. All services are fully enabled.</p>

      <table style="width: 100%; margin: 25px 0; border: 1px solid ${BORDER_COLOR}; background-color: ${BG_COLOR}; border-collapse: collapse;">
        <tr><td colspan="2" style="background-color: ${ACCENT_COLOR}; padding: 10px; color: ${PRIMARY_COLOR};"><strong>SUBSCRIPTION DETAILS</strong></td></tr>
        <tr><td style="padding: 10px; width: 40%; border-bottom: 1px solid ${BORDER_COLOR};"><strong>Plan:</strong></td><td style="padding: 10px; border-bottom: 1px solid ${BORDER_COLOR};">${packageName}</td></tr>
        <tr><td style="padding: 10px; border-bottom: 1px solid ${BORDER_COLOR};"><strong>Paid Amount:</strong></td><td style="padding: 10px; border-bottom: 1px solid ${BORDER_COLOR};">${invoiceData.currency} ${parseFloat(invoiceData.total_amount).toFixed(2)}</td></tr>
        <tr><td style="padding: 10px; border-bottom: 1px solid ${BORDER_COLOR};"><strong>Paid Date:</strong></td><td style="padding: 10px; border-bottom: 1px solid ${BORDER_COLOR};">${formattedPaidDate}</td></tr>
        <tr><td style="padding: 10px;"><strong>Active Until:</strong></td><td style="padding: 10px;">${formattedEndDate}</td></tr>
      </table>

      <p style="color: ${TEXT_COLOR}; font-weight: bold; margin-top: 25px;">Key Features in Your Plan:</p>
      <ul style="color: ${TEXT_COLOR}; list-style-type: square; padding-left: 20px;">
        ${featuresList}
      </ul>
      <p style="color: ${TEXT_COLOR}; margin-top: 25px;">You can log in and start managing your leads and staff immediately.</p>
    `;

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "HPBIZ", email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com" };
    sendSmtpEmail.to = [{ email: admin_email }];
    sendSmtpEmail.subject = `Your HPBIZ Subscription is Active! (Invoice ${invoiceData.invoice_number} Paid)`;
    sendSmtpEmail.htmlContent = getEmailTemplate("Subscription Activated", content, "Go to App Dashboard", loginUrl);

    if (pdfBuffer) {
        sendSmtpEmail.attachment = [{
            name: `INVOICE-${invoiceData.invoice_number}-PAID.pdf`,
            content: pdfBuffer.toString('base64')
        }];
    }

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Subscription activation email (with PAID Invoice) sent successfully');
  } catch (error) {
    console.error('Brevo email error (Activation with Invoice):', error);
    throw new Error('Failed to send activation email with invoice');
  }
};


const sendAdminProvisioningEmail = async (adminEmail, adminName, otp, loginUrl) => {
  const content = `
    <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">Hello ${adminName},</p>
    <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">Your company account has been successfully provisioned by our team.</p>
    <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">To set your secure, permanent password and gain access, please use the OTP below at the login page's 'Forgot Password' link:</p>

    <div style="background-color: ${ACCENT_COLOR}; color: ${PRIMARY_COLOR}; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 4px; margin: 25px 0;">
      ${otp}
    </div>
    <p style="font-size: 12px; color: #666; text-align: center;">Note: You will use your email (${adminEmail}) and the OTP above on the 'Forgot Password' process to set your final password.</p>
  `;

  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "HPBIZ", email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com" };
    sendSmtpEmail.to = [{ email: adminEmail }];
    sendSmtpEmail.subject = `Welcome to HPBIZ, ${adminName}! Your Account is Ready.`;
    sendSmtpEmail.htmlContent = getEmailTemplate("Account Provisioned", content, "Go to Login Page", loginUrl);

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Admin provisioning email sent successfully');
  } catch (error) {
    console.error('Brevo email error (Admin Provisioning):', error);
    throw new Error('Failed to send email');
  }
};

const sendCompanyCreationEmail = async (adminEmail, adminName, companyName, planName, password, loginUrl) => {
  const content = `
    <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">Hello ${adminName},</p>
    <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">A new company account for <strong>${companyName}</strong> has been registered successfully with the <strong>${planName}</strong> subscription plan.</p>

    <p style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.5;">Here are your login credentials:</p>
    <table style="width: 100%; margin: 20px 0; border: 1px solid ${BORDER_COLOR}; background-color: ${BG_COLOR}; border-collapse: collapse;">
      <tr><td style="padding: 10px; border-bottom: 1px solid ${BORDER_COLOR};"><strong>Email:</strong></td><td style="padding: 10px; border-bottom: 1px solid ${BORDER_COLOR};">${adminEmail}</td></tr>
      <tr><td style="padding: 10px;"><strong>Password:</strong></td><td style="padding: 10px;">${password}</td></tr>
    </table>

    <p style="color: ${TEXT_COLOR}; font-size: 14px; line-height: 1.5;">Please log in and change your password immediately for security purposes.</p>
  `;

  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "HPBIZ", email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com" };
    sendSmtpEmail.to = [{ email: adminEmail }];
    sendSmtpEmail.subject = `Welcome to HPBIZ - Your Account is Ready`;
    sendSmtpEmail.htmlContent = getEmailTemplate("Account Created", content, "Login to Dashboard", loginUrl);

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Company creation email sent successfully');
  } catch (error) {
    console.error('Brevo email error (Company Creation):', error);
    throw new Error('Failed to send company creation email');
  }
};


module.exports = {
  sendSignupOTPEmail,
  sendResetOTPEmail,
  sendStaffWelcomeEmail,
  sendNotificationEmail,
  sendAdminNotificationEmail,
  sendInvoiceEmail,
  sendSubscriptionActivationEmail,
  sendAdminProvisioningEmail,
  sendCompanyCreationEmail
};