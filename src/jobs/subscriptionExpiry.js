const cron = require('node-cron');
const pool = require('../config/database');
const { deactivateCompany } = require('../models/super-admin-models/companyModel');
const { logSystemEvent } = require('../middleware/loggingMiddleware');

const getExpiredActiveCompanies = async () => {
    try {
        const query = `
            SELECT id, company_name, admin_email, subscription_end_date
            FROM companies
            WHERE is_active = TRUE
              AND subscription_end_date IS NOT NULL
              AND subscription_end_date < CURRENT_TIMESTAMP
        `;
        const result = await pool.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error fetching expired companies:', error);
        logSystemEvent('ERROR', 'CRON', `Failed to query expired companies: ${error.message}`);
        return [];
    }
};

const startSubscriptionCron = () => {
    // Runs daily at 09:00 (9 AM) server time (using the cron syntax '0 9 * * *')
    cron.schedule('0 9 * * *', async () => {
        console.log('Running Subscription Expiry Cron Job...');
        let deactivatedCount = 0;

        try {
            const expiredCompanies = await getExpiredActiveCompanies();

            if (expiredCompanies.length === 0) {
                console.log('No expired subscriptions found for deactivation.');
                logSystemEvent('INFO', 'CRON', 'Subscription check completed. No expirations.');
                return;
            }

            for (const company of expiredCompanies) {
                try {
                    await deactivateCompany(company.id);
                    deactivatedCount++;

                    const logMessage = `Subscription expired for ${company.company_name} (ID: ${company.id}). Account deactivated.`;
                    console.log(logMessage);

                    logSystemEvent('WARNING', 'SUBSCRIPTION', logMessage);

                } catch (deactivationError) {
                    console.error(`Failed to deactivate company ${company.id}: ${deactivationError.message}`);
                    logSystemEvent('ERROR', 'SUBSCRIPTION', `Failed to deactivate company ${company.id}: ${deactivationError.message}`);
                }
            }

            console.log(`Subscription Expiry Cron Job completed. Total deactivated: ${deactivatedCount}`);

        } catch (mainError) {
            console.error('Critical failure in Subscription Expiry Cron Job:', mainError);
            logSystemEvent('CRITICAL', 'CRON', `Critical job failure: ${mainError.message}`);
        }
    }, {
        timezone: "UTC" // Run at 9 AM UTC to ensure consistent daily timing regardless of server location
    });

    console.log('Subscription Expiry Cron Job scheduled: Daily at 09:00 UTC.');
};

module.exports = { startSubscriptionCron };
