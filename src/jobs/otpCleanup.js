const cron = require('node-cron');
const { cleanExpiredOTPs } = require('../models/authModel');
const pool = require('../config/database');

const cleanAuthData = async () => {
  try {
    await cleanExpiredOTPs();

    await pool.query("DELETE FROM temp_signups WHERE created_at < NOW() - INTERVAL '24 hours'");

    await pool.query("DELETE FROM company_sessions WHERE expires_at < NOW()");

    await pool.query("DELETE FROM staff_sessions WHERE expires_at < NOW()");

    console.log('Auth System Cleanup: Expired OTPs, Temp Signups, and Sessions removed.');
  } catch (err) {
    console.error('Failed to clean auth data:', err.message);
  }
};

const startOtpCleanupJob = () => {
  cron.schedule('0 * * * *', async () => {
    await cleanAuthData();
  });
};

module.exports = { startOtpCleanupJob };