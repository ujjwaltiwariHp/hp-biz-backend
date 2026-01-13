const pool = require('../config/database');

// Helper to calculate days between dates
const diffInDays = (d1, d2) => {
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    return Math.floor((t2 - t1) / (1000 * 60 * 60 * 24));
};

const getCurrentSubscriptionState = async (companyId) => {
    try {
        const query = `
            SELECT 
                c.id, c.subscription_package_id, c.subscription_start_date, c.subscription_end_date, c.subscription_status,
                sp.name as package_name, sp.is_trial,
                sp.price_monthly, sp.price_quarterly, sp.price_yearly
            FROM companies c
            LEFT JOIN subscription_packages sp ON c.subscription_package_id = sp.id
            WHERE c.id = $1 AND c.is_active = true
        `;
        const companyRes = await pool.query(query, [companyId]);
        const company = companyRes.rows[0];

        if (!company || !company.subscription_package_id) {
            return null;
        }

        // If trial, value is 0
        if (company.is_trial) {
            return {
                ...company,
                paid_amount: 0,
                total_duration_days: 0,
                is_trial: true
            };
        }

        // Fetch last paid invoice for this package
        const invoiceQuery = `
            SELECT total_amount, billing_period_start, billing_period_end
            FROM invoices
            WHERE company_id = $1 
              AND subscription_package_id = $2
              AND status = 'paid'
            ORDER BY billing_period_start DESC
            LIMIT 1
        `;
        const invoiceRes = await pool.query(invoiceQuery, [companyId, company.subscription_package_id]);
        const lastInvoice = invoiceRes.rows[0];

        let paidAmount = 0;
        let totalDurationDays = 0;

        if (lastInvoice) {
            paidAmount = parseFloat(lastInvoice.total_amount);
            totalDurationDays = diffInDays(lastInvoice.billing_period_start, lastInvoice.billing_period_end);
        } else {
            // Fallback estimation
            if (company.subscription_start_date && company.subscription_end_date) {
                totalDurationDays = diffInDays(company.subscription_start_date, company.subscription_end_date);
            }
            if (!company.subscription_start_date) totalDurationDays = 30; // Default safety

            if (totalDurationDays > 300) paidAmount = parseFloat(company.price_yearly);
            else if (totalDurationDays > 80) paidAmount = parseFloat(company.price_quarterly);
            else paidAmount = parseFloat(company.price_monthly);
        }

        return {
            ...company,
            paid_amount: paidAmount || 0,
            total_duration_days: totalDurationDays || 0,
            is_trial: false
        };

    } catch (error) {
        throw error;
    }
};

const getSubscriptionStatus = async (companyId) => {
    try {
        const state = await getCurrentSubscriptionState(companyId);
        if (!state) return null;

        const now = new Date();
        const endDate = new Date(state.subscription_end_date);
        const daysRemaining = diffInDays(now, endDate);

        return {
            package_name: state.package_name,
            package_id: state.subscription_package_id,
            is_trial: state.is_trial,
            subscription_end_date: state.subscription_end_date,
            days_remaining: daysRemaining > 0 ? daysRemaining : 0,
            status: state.subscription_status
        };
    } catch (error) {
        throw error;
    }
};

const calculateUpgrade = async (companyId, newPackageId, durationType) => {
    try {
        const currentState = await getCurrentSubscriptionState(companyId);

        // 1. Calculate Remaining Value of Current Plan
        let credit = 0;
        let debugInfo = {};

        // Only calculate credit if NOT trial AND active AND not expired
        if (currentState &&
            !currentState.is_trial &&
            currentState.subscription_status === 'approved' &&
            currentState.subscription_end_date &&
            currentState.total_duration_days > 0) {

            const now = new Date();
            const endDate = new Date(currentState.subscription_end_date);
            const daysRemaining = diffInDays(now, endDate);

            if (daysRemaining > 0) {
                const dailyRate = currentState.paid_amount / currentState.total_duration_days;
                credit = dailyRate * daysRemaining;

                debugInfo = {
                    paid_amount: currentState.paid_amount,
                    days_total: currentState.total_duration_days,
                    days_remaining: daysRemaining,
                    daily_rate: dailyRate
                };
            }
        }

        // 2. Get New Package Price
        const pkgQuery = `SELECT * FROM subscription_packages WHERE id = $1`;
        const pkgRes = await pool.query(pkgQuery, [newPackageId]);
        const newPackage = pkgRes.rows[0];

        if (!newPackage) throw new Error("Target subscription package not found.");

        let newPrice = 0;
        let durationDays = 30;

        if (durationType === 'yearly') {
            newPrice = parseFloat(newPackage.price_yearly);
            durationDays = 365;
        } else if (durationType === 'quarterly') {
            newPrice = parseFloat(newPackage.price_quarterly);
            durationDays = 90;
        } else {
            newPrice = parseFloat(newPackage.price_monthly);
            durationDays = 30;
        }

        // 3. Final Calculation
        let payableAmount = newPrice - credit;
        if (payableAmount < 0) payableAmount = 0;

        return {
            current_state: debugInfo,
            new_package: {
                id: newPackage.id,
                name: newPackage.name,
                price: newPrice,
                currency: 'USD',
                duration_days: durationDays
            },
            credit_applied: parseFloat(credit.toFixed(2)),
            final_payable_amount: parseFloat(payableAmount.toFixed(2))
        };

    } catch (error) {
        throw error;
    }
};

module.exports = {
    getCurrentSubscriptionState,
    getSubscriptionStatus, // Exported
    calculateUpgrade
};
