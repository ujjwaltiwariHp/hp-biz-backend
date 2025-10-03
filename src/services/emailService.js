const nodemailer = require('nodemailer');
const pool = require("../config/database");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendSignupOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: `"HPBIZ" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Welcome to HPBIZ – Verify Your Account',
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff7e6; padding: 30px; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #f0c14b;">
        <h1 style="color: #000; text-align: center; margin-bottom: 20px;">HPBIZ</h1>
        <h2 style="color: #333; text-align: center;">Verify Your Account</h2>
        <p style="color: #555; text-align: center;">Use the following OTP to complete your signup process:</p>
        <div style="background: #ffcc00; color: #000; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; text-align: center; margin: 25px auto; max-width: 200px;">
          ${otp}
        </div>
        <p style="color: #333; text-align: center;">This OTP is valid for <b>${process.env.OTP_EXPIRE_MINUTES || 10} minutes</b>.</p>
        <p style="color: #999; font-size: 12px; text-align: center;">If you didn't sign up for HPBIZ, please ignore this email.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};

const sendResetOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: `"HPBIZ" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'HPBIZ – Reset Your Password',
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff7e6; padding: 30px; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #f0c14b;">
        <h1 style="color: #000; text-align: center; margin-bottom: 20px;">HPBIZ</h1>
        <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
        <p style="color: #555; text-align: center;">Use the following OTP to reset your password:</p>
        <div style="background: #000; color: #ffcc00; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; text-align: center; margin: 25px auto; max-width: 200px;">
          ${otp}
        </div>
        <p style="color: #333; text-align: center;">This OTP is valid for <b>${process.env.OTP_EXPIRE_MINUTES || 10} minutes</b>.</p>
        <p style="color: #999; font-size: 12px; text-align: center;">If you didn't request a password reset, please ignore this email.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};

const sendStaffWelcomeEmail = async (staffEmail, staffName, tempPassword, loginUrl) => {
  const mailOptions = {
    from: `"HPBIZ" <${process.env.EMAIL_FROM}>`,
    to: staffEmail,
    subject: `Welcome to HPBIZ, ${staffName}! Your New Account is Ready`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff7e6; padding: 20px; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #f0c14b; text-align: center;">
        <h1 style="color: #000; text-align: center; font-size: 28px; margin-bottom: 20px;">HPBIZ</h1>
        <h2 style="color: #333; font-size: 22px; margin-top: 0;">Your New Account Has Been Created</h2>
        <p style="color: #555; line-height: 1.6;">Hello ${staffName},</p>
        <p style="color: #555; line-height: 1.6;">An account has been created for you. Please use the following temporary credentials to log in and set up your permanent password.</p>

        <div style="background: #ffcc00; padding: 25px; border-radius: 8px; margin: 30px auto; max-width: 400px; text-align: left;">
          <p style="margin: 0; font-size: 16px; color: #000;"><strong>Username:</strong> <span style="font-weight: normal;">${staffEmail}</span></p>
          <p style="margin: 10px 0 0; font-size: 16px; color: #000;"><strong>Temporary Password:</strong> <span style="font-weight: normal; color: #d63333;">${tempPassword}</span></p>
        </div>

        <p style="color: #555; line-height: 1.6;">For your security, you will be prompted to create a new password immediately after your first successful login.</p>

        <div style="margin-top: 40px; margin-bottom: 20px;">
          <a href="${loginUrl}" style="background-color: #000; color: #ffcc00; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
            Log In to Your Account
          </a>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't expect this email, please ignore it or contact your administrator.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
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

    const mailOptions = {
      from: `"HPBIZ - ${company_name}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: `HPBIZ Notification: ${title}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8f9fa; padding: 30px; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #dee2e6;">
          <div style="background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #000; text-align: center; margin-bottom: 10px; font-size: 24px;">HPBIZ</h1>
            <h2 style="color: #333; text-align: center; font-size: 18px; margin-bottom: 30px;">${company_name}</h2>

            <div style="background: #fff7e6; padding: 20px; border-radius: 8px; border-left: 4px solid #ffcc00; margin-bottom: 20px;">
              <h3 style="color: #333; margin: 0 0 10px 0; font-size: 16px;">${title}</h3>
              <p style="color: #555; margin: 0; line-height: 1.6;">${message}</p>
            </div>

            <p style="color: #666; font-size: 14px; text-align: center; margin-bottom: 10px;">
              Hello ${first_name}, you have received this notification from your HPBIZ dashboard.
            </p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.APP_LOGIN_URL || 'https://hp-bliz-url.com/login'}"
                 style="background-color: #000; color: #ffcc00; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                View in Dashboard
              </a>
            </div>
          </div>

          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
            This is an automated notification from HPBIZ. If you wish to stop receiving email notifications, please update your settings in your dashboard.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending notification email:', error);
  }
};

const sendAdminNotificationEmail = async (adminEmail, companyName, title, message) => {
  try {
    const mailOptions = {
      from: `"HPBIZ - ${companyName}" <${process.env.EMAIL_FROM}>`,
      to: adminEmail,
      subject: `HPBIZ Admin Alert: ${title}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8f9fa; padding: 30px; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #dee2e6;">
          <div style="background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #000; text-align: center; margin-bottom: 10px; font-size: 24px;">HPBIZ</h1>
            <h2 style="color: #333; text-align: center; font-size: 18px; margin-bottom: 30px;">Admin Notification - ${companyName}</h2>

            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
              <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">${title}</h3>
              <p style="color: #856404; margin: 0; line-height: 1.6;">${message}</p>
            </div>

            <p style="color: #666; font-size: 14px; text-align: center; margin-bottom: 10px;">
              This is an admin notification about activities in your company's HPBIZ account.
            </p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.APP_LOGIN_URL || 'https://hp-bliz-url.com/login'}"
                 style="background-color: #000; color: #ffcc00; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Access Admin Dashboard
              </a>
            </div>
          </div>

          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
            This is an automated admin notification from HPBIZ. These notifications keep you informed about important activities in your account.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending admin notification email:', error);
  }
};

const sendInvoiceEmail = async (invoiceData, pdfBuffer) => {
  try {
    const {
      billing_email,
      company_name,
      invoice_number,
      total_amount,
      currency,
      due_date,
      billing_period_start,
      billing_period_end
    } = invoiceData;

    const mailOptions = {
      from: `"HPBIZ Billing" <${process.env.EMAIL_FROM}>`,
      to: billing_email,
      subject: `Invoice ${invoice_number} from HPBIZ`,
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8f9fa; padding: 30px; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #dee2e6;">
          <div style="background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #000; text-align: center; margin-bottom: 10px; font-size: 28px;">HPBIZ</h1>
            <h2 style="color: #333; text-align: center; font-size: 20px; margin-bottom: 30px;">Invoice Notification</h2>

            <p style="color: #555; font-size: 16px; line-height: 1.6;">Dear ${company_name},</p>
            <p style="color: #555; font-size: 16px; line-height: 1.6;">Thank you for your business. Please find attached your invoice for the recent subscription period.</p>

            <div style="background: #fff7e6; padding: 25px; border-radius: 8px; border-left: 4px solid #ffcc00; margin: 25px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Invoice Number:</td>
                  <td style="padding: 8px 0; color: #000; font-weight: bold; text-align: right; font-size: 14px;">${invoice_number}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Billing Period:</td>
                  <td style="padding: 8px 0; color: #000; text-align: right; font-size: 14px;">${new Date(billing_period_start).toLocaleDateString()} - ${new Date(billing_period_end).toLocaleDateString()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Due Date:</td>
                  <td style="padding: 8px 0; color: #d63333; font-weight: bold; text-align: right; font-size: 14px;">${new Date(due_date).toLocaleDateString()}</td>
                </tr>
                <tr style="border-top: 2px solid #ffcc00;">
                  <td style="padding: 15px 0 8px 0; color: #000; font-weight: bold; font-size: 16px;">Total Amount:</td>
                  <td style="padding: 15px 0 8px 0; color: #27ae60; font-weight: bold; text-align: right; font-size: 20px;">${currency} ${parseFloat(total_amount).toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <p style="color: #555; font-size: 14px; line-height: 1.6; text-align: center; margin: 25px 0;">
              The detailed invoice is attached as a PDF document. Please review it and process the payment by the due date.
            </p>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <p style="color: #666; font-size: 13px; margin: 0; text-align: center;">
                <strong>Payment Instructions:</strong><br>
                Please remit payment to the account details mentioned in the attached invoice.
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.APP_LOGIN_URL || 'https://hpbiz.com/login'}"
                 style="background-color: #000; color: #ffcc00; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                View in Dashboard
              </a>
            </div>

            <p style="color: #555; font-size: 14px; line-height: 1.6; margin-top: 30px;">
              If you have any questions about this invoice, please don't hesitate to contact our billing department.
            </p>

            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              Best regards,<br>
              <strong>HPBIZ Billing Team</strong>
            </p>
          </div>

          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
            This is an automated invoice notification from HPBIZ. For billing inquiries, please contact us at ${process.env.EMAIL_FROM}.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `invoice-${invoice_number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Invoice email sent successfully' };
  } catch (error) {
    console.error('Error sending invoice email:', error);
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