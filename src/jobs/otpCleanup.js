const cron = require('node-cron');
const { cleanExpiredOTPs } = require('../models/authModel');

const startOtpCleanupJob = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      await cleanExpiredOTPs();
      console.log('Expired OTPs cleaned');
    } catch (err) {
      console.error('Failed to clean expired OTPs', err.message);
    }
  });
};

module.exports = { startOtpCleanupJob };
