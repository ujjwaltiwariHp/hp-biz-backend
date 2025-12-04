const cron = require('node-cron');
const pool = require('../config/database');
const { sendPushNotification } = require('../services/notificationService');
const { logSystemEvent } = require('../models/loggingModel');

const checkAndSendFollowUpReminders = async () => {
  console.log('Running Follow-up Reminder Cron Job...');
  let reminderCount = 0;

  try {
    const query = `
      SELECT
        fr.id, fr.lead_id, fr.staff_id, fr.message, fr.reminder_time,
        l.first_name, l.last_name, l.company_id
      FROM follow_up_reminders fr
      JOIN leads l ON fr.lead_id = l.id
      WHERE fr.is_completed = FALSE
        AND fr.reminder_time >= NOW()
        AND fr.reminder_time <= NOW() + INTERVAL '15 minutes'
        AND (fr.last_notification_sent_at IS NULL OR fr.last_notification_sent_at < NOW() - INTERVAL '1 hour')
    `;

    const { rows: reminders } = await pool.query(query);

    if (reminders.length === 0) {
      return;
    }

    for (const reminder of reminders) {
      try {
        const leadName = `${reminder.first_name} ${reminder.last_name}`;

        await sendPushNotification(reminder.staff_id, {
          title: "Follow-up Reminder",
          body: `Reminder: Call ${leadName} soon. Note: ${reminder.message}`,
          data: {
            leadId: String(reminder.lead_id),
            type: 'follow_up_reminder',
            companyId: String(reminder.company_id),
            reminderId: String(reminder.id)
          }
        });

        await pool.query(
          `UPDATE follow_up_reminders SET last_notification_sent_at = NOW() WHERE id = $1`,
          [reminder.id]
        );

        reminderCount++;
      } catch (err) {
        console.error(`Failed to process reminder ID ${reminder.id}:`, err.message);
      }
    }

    if (reminderCount > 0) {
      try {
        await logSystemEvent({
          company_id: null,
          staff_id: null,
          log_level: 'INFO',
          log_category: 'CRON_REMINDER',
          message: `Sent ${reminderCount} follow-up push notifications.`
        });
      } catch (logErr) {
        console.error('Failed to log system event:', logErr.message);
      }
    }

  } catch (error) {
    console.error('Follow-up Reminder Cron Error:', error);
    await logSystemEvent({
      company_id: null,
      log_level: 'ERROR',
      log_category: 'CRON_REMINDER',
      message: `Follow-up cron failed: ${error.message}`
    });
  }
};

const startFollowUpReminderCron = () => {
  cron.schedule('*/15 * * * *', checkAndSendFollowUpReminders);
  console.log('Follow-up Reminder Cron Job scheduled: Every 15 minutes.');
};

module.exports = { startFollowUpReminderCron };