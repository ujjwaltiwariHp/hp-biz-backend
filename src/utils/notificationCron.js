const cron = require('node-cron');
const { generateExpiringNotifications } = require('../models/super-admin-models/notificationModel');

const startNotificationCron = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('Running notification generation cron job...');
      const notifications = await generateExpiringNotifications();
      console.log(`Generated ${notifications.length} notifications`);
    } catch (error) {
      console.error('Error generating notifications:', error);
    }
  });

  console.log('Notification cron job scheduled: Daily at 9:00 AM');
};

module.exports = { startNotificationCron };