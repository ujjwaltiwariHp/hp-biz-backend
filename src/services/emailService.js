const brevo = require('@getbrevo/brevo');
const pool = require("../config/database");

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

const sendSignupOTPEmail = async (email, otp) => {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.sender = {
      name: "HPBIZ",
      email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com"
    };
    sendSmtpEmail.to = [{ email: email }];
    sendSmtpEmail.subject = "Welcome to HPBIZ – Verify Your Account";
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: white; padding: 30px; border-radius: 10px;">
          <h1 style="color: #000; text-align: center;">HPBIZ</h1>
          <h2 style="color: #333; text-align: center;">Verify Your Account</h2>
          <p style="text-align: center; color: #666;">Your OTP code is:</p>
          <div style="background: #ffcc00; color: #000; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="text-align: center; color: #666;">Valid for ${process.env.OTP_EXPIRE_MINUTES || 10} minutes</p>
        </div>
      </div>
    `;

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Signup OTP email sent successfully');
  } catch (error) {
    console.error('Brevo email error:', error);
    throw new Error('Failed to send email');
  }
};

const sendResetOTPEmail = async (email, otp) => {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.sender = {
      name: "HPBIZ",
      email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com"
    };
    sendSmtpEmail.to = [{ email: email }];
    sendSmtpEmail.subject = "HPBIZ – Reset Your Password";
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: white; padding: 30px; border-radius: 10px;">
          <h1 style="color: #000; text-align: center;">HPBIZ</h1>
          <h2 style="color: #333; text-align: center;">Password Reset</h2>
          <p style="text-align: center; color: #666;">Your reset OTP is:</p>
          <div style="background: #000; color: #ffcc00; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="text-align: center; color: #666;">Valid for ${process.env.OTP_EXPIRE_MINUTES || 10} minutes</p>
        </div>
      </div>
    `;

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Reset OTP email sent successfully');
  } catch (error) {
    console.error('Brevo email error:', error);
    throw new Error('Failed to send email');
  }
};

const sendStaffWelcomeEmail = async (staffEmail, staffName, tempPassword, loginUrl) => {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.sender = {
      name: "HPBIZ",
      email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com"
    };
    sendSmtpEmail.to = [{ email: staffEmail }];
    sendSmtpEmail.subject = `Welcome to HPBIZ, ${staffName}!`;
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="text-align: center;">Welcome ${staffName}!</h1>
        <p>Your account has been created:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Email:</strong> ${staffEmail}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
        </div>
        <p style="text-align: center;">
          <a href="${loginUrl}" style="background: #000; color: #ffcc00; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Login Now
          </a>
        </p>
      </div>
    `;

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

    const { first_name, email, company_name } = staffResult.rows[0];

    const settingsResult = await pool.query(
      `SELECT email_notifications FROM company_settings WHERE company_id = $1`,
      [companyId]
    );

    const emailNotificationsEnabled = settingsResult.rows.length > 0 ?
      settingsResult.rows[0].email_notifications : true;

    if (!emailNotificationsEnabled) return;

    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.sender = {
      name: "HPBIZ",
      email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com"
    };
    sendSmtpEmail.to = [{ email: email }];
    sendSmtpEmail.subject = `HPBIZ: ${title}`;
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>${company_name}</h2>
        <h3>${title}</h3>
        <p>Hello ${first_name},</p>
        <p>${message}</p>
      </div>
    `;

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Notification email sent successfully');
  } catch (error) {
    console.error('Notification email error:', error);
  }
};

const sendAdminNotificationEmail = async (adminEmail, companyName, title, message) => {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.sender = {
      name: "HPBIZ",
      email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com"
    };
    sendSmtpEmail.to = [{ email: adminEmail }];
    sendSmtpEmail.subject = `HPBIZ Admin: ${title}`;
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>${companyName} - Admin Alert</h2>
        <h3>${title}</h3>
        <p>${message}</p>
      </div>
    `;

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Admin notification email sent successfully');
  } catch (error) {
    console.error('Admin notification error:', error);
  }
};

const sendInvoiceEmail = async (invoiceData, pdfBuffer) => {
  try {
    const {
      billing_email,
      company_name,
      invoice_number,
      total_amount,
      currency
    } = invoiceData;

    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.sender = {
      name: "HPBIZ",
      email: process.env.EMAIL_FROM || "ujjwaltiwari.hp@gmail.com"
    };
    sendSmtpEmail.to = [{ email: billing_email }];
    sendSmtpEmail.subject = `Invoice ${invoice_number} from HPBIZ`;
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>Invoice for ${company_name}</h1>
        <p><strong>Invoice #:</strong> ${invoice_number}</p>
        <p><strong>Amount:</strong> ${currency} ${parseFloat(total_amount).toFixed(2)}</p>
        <p>Please find your invoice attached.</p>
      </div>
    `;
    sendSmtpEmail.attachment = [
      {
        name: `invoice-${invoice_number}.pdf`,
        content: pdfBuffer.toString('base64')
      }
    ];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Invoice email sent successfully');
    return { success: true, message: 'Invoice email sent' };
  } catch (error) {
    console.error('Invoice email error:', error);
    throw error;
  }
};

module.exports = {
  sendSignupOTPEmail,
  sendResetOTPEmail,
  sendStaffWelcomeEmail,
  sendNotificationEmail,
  sendAdminNotificationEmail,
  sendInvoiceEmail
};