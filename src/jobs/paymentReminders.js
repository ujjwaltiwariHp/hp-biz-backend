const cron = require('node-cron');
const pool = require('../config/database');
const { generateInvoicePdf } = require('../utils/pdfGenerator');
const { logSystemEvent } = require('../models/loggingModel');

let emailService;

const REMINDER_CONFIG = [
    { type: '24_hour_after_send', threshold_days: 0, op: '<=', status: 'sent', days_from_creation: 1, max_reminders: 1, log_message: 'First reminder sent (24h after send).' },
    { type: '3_day_before_due', threshold_days: 3, op: '=', status: 'sent', days_from_creation: null, max_reminders: 2, log_message: 'Pre-due date reminder (3 days).' },
    { type: 'due_date', threshold_days: 0, op: '=', status: 'sent', days_from_creation: null, max_reminders: 3, log_message: 'Final reminder on due date.' },
    { type: '7_day_overdue', threshold_days: -7, op: '=', status: 'sent', days_from_creation: null, max_reminders: 4, log_message: 'Overdue reminder (7 days past due).' }
];

const checkAndSendReminders = async () => {
    emailService = require('../services/emailService');

    console.log('Running Payment Reminder Cron Job...');
    let sentCount = 0;

    for (const config of REMINDER_CONFIG) {

        let due_date_clause = '';
        if (config.days_from_creation) {
            due_date_clause = `
                AND i.created_at <= CURRENT_TIMESTAMP - INTERVAL '${config.days_from_creation} days'
                AND i.created_at > CURRENT_TIMESTAMP - INTERVAL '${config.days_from_creation + 1} days'
            `;
        } else {
            due_date_clause = ` AND i.due_date::date ${config.op} (CURRENT_DATE + INTERVAL '${config.threshold_days} days')::date `;
        }

        const query = `
            SELECT i.id, i.invoice_number, i.total_amount, i.currency, i.due_date, i.status,
                   c.admin_email as billing_email, c.company_name, c.admin_name as admin_name
            FROM invoices i
            JOIN companies c ON i.company_id = c.id
            WHERE i.status = $1
              ${due_date_clause}
              AND (
                  SELECT COUNT(*) FROM payment_reminders pr
                  WHERE pr.invoice_id = i.id AND pr.reminder_type = $2
              ) < $3
            ORDER BY i.due_date ASC
        `;

        const params = [config.status, config.type, config.max_reminders];

        try {
            const invoices = await pool.query(query, params);

            for (const invoice of invoices.rows) {
                try {
                    const pdfBuffer = await generateInvoicePdf(invoice);

                    await emailService.sendInvoiceEmail({ ...invoice, status: config.type.includes('overdue') ? 'overdue' : 'pending' }, pdfBuffer);

                    await pool.query(
                        `INSERT INTO payment_reminders (invoice_id, company_id, reminder_type)
                         VALUES ($1, $2, $3)`,
                        [invoice.id, invoice.company_id, config.type]
                    );

                    sentCount++;

                    if (config.type === '7_day_overdue') {
                        await pool.query(`UPDATE invoices SET status = 'overdue' WHERE id = $1`, [invoice.id]);
                        await logSystemEvent({
                            company_id: invoice.company_id,
                            log_level: 'WARNING',
                            log_category: 'INVOICE',
                            message: `Invoice #${invoice.invoice_number} automatically set to OVERDUE.`
                        });
                    }

                } catch (emailError) {
                    await logSystemEvent({
                        company_id: invoice.company_id,
                        log_level: 'ERROR',
                        log_category: 'CRON_REMINDER',
                        message: `Failed to send reminder for Invoice #${invoice.invoice_number} (${config.type}): ${emailError.message}`
                    });
                }
            }

        } catch (queryError) {
            await logSystemEvent({
                company_id: null,
                log_level: 'ERROR',
                log_category: 'CRON_REMINDER',
                message: `Query failure during ${config.type} check: ${queryError.message}`
            });
        }
    }
    console.log(`Payment Reminder Cron Job completed. Total reminders sent: ${sentCount}`);
};

const startPaymentReminderCron = () => {
    cron.schedule('0 10 * * *', checkAndSendReminders, {
        timezone: "UTC"
    });
    console.log('Payment Reminder Cron Job scheduled: Daily at 10:00 UTC.');
};

module.exports = { startPaymentReminderCron };