const pool = require("../config/database");

const getDashboardMetrics = async (companyId) => {
    const client = await pool.connect();
    try {
        // 1. Total Leads
        const totalLeadsQuery = `
      SELECT COUNT(*)::integer as count 
      FROM leads 
      WHERE company_id = $1
    `;

        // 2. New Leads 
        // Definition: No follow-up created AND No significant activity (excluding creation/assignment)
        const newLeadsQuery = `
      SELECT COUNT(l.id)::integer as count
      FROM leads l
      WHERE l.company_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM follow_up_reminders f 
        WHERE f.lead_id = l.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM lead_activities a 
        WHERE a.lead_id = l.id 
        AND a.activity_type NOT IN ('creation', 'assignment', 'lead_transfer')
      )
    `;

        // 3. Total Follow Ups
        const totalFollowUpsQuery = `
      SELECT COUNT(*)::integer as count 
      FROM follow_up_reminders 
      WHERE company_id = $1
    `;

        // 4. App Users (Staff)
        const appUsersQuery = `
      SELECT COUNT(*)::integer as count 
      FROM staff 
      WHERE company_id = $1 
      AND status = 'active'
    `;

        const [totalLeadsResult, newLeadsResult, followUpsResult, appUsersResult] = await Promise.all([
            client.query(totalLeadsQuery, [companyId]),
            client.query(newLeadsQuery, [companyId]),
            client.query(totalFollowUpsQuery, [companyId]),
            client.query(appUsersQuery, [companyId])
        ]);

        return {
            total_leads: totalLeadsResult.rows[0]?.count || 0,
            new_leads: newLeadsResult.rows[0]?.count || 0,
            total_follow_ups: followUpsResult.rows[0]?.count || 0,
            app_users: appUsersResult.rows[0]?.count || 0
        };

    } catch (error) {
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getDashboardMetrics
};
