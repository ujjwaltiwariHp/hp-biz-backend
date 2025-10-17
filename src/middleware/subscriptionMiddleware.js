const moment = require('moment-timezone');
const { errorResponse } = require('../utils/errorResponse');
const { getCurrentStaffCount } = require('../models/staffModel');
const { getLeadsCreatedThisMonth } = require('../models/leadsModel');


const getCompanySubscriptionAndUsage = async (req, res, next) => {
    if (!req.company || !req.company.id) {
        return errorResponse(res, 401, 'Authentication required to check subscription status.');
    }

    try {
        const companyId = req.company.id;
        const packageData = req.company;

        if (!packageData.subscription_package_id) {
            return errorResponse(res, 403, 'No active subscription found. Please contact support.');
        }

        const [currentStaffCount, leadsThisMonth] = await Promise.all([
            getCurrentStaffCount(companyId),
            getLeadsCreatedThisMonth(companyId)
        ]);

        const features = Array.isArray(packageData.features) ? packageData.features : (typeof packageData.features === 'string' ? JSON.parse(packageData.features) : []);

        req.company.subscription = {
            package_name: packageData.package_name,
            features: features,
            max_staff_count: parseInt(packageData.max_staff_count, 10) || 0,
            max_leads_per_month: parseInt(packageData.max_leads_per_month, 10) || 0,
            is_trial: packageData.is_trial,
            expires_at: packageData.subscription_end_date
        };

        req.company.usage = {
            staff_count: currentStaffCount,
            leads_this_month: leadsThisMonth
        };

        next();
    } catch (error) {
        console.error('Subscription/Usage Fetch Error:', error);
        return errorResponse(res, 500, 'Internal error during subscription validation.');
    }
};

const checkSubscriptionActive = (req, res, next) => {
    const sub = req.company.subscription;
    // Note: req.company.is_active is used directly from the initial auth fetch now.
    const companyActive = req.company.is_active;
    const isExpired = sub.expires_at && moment(sub.expires_at).isSameOrBefore(moment.utc());

    if (!companyActive || isExpired) {
        return errorResponse(res, 403, 'Subscription expired or inactive. Please renew your plan.');
    }
    next();
};

const checkStaffLimit = (req, res, next) => {
    const sub = req.company.subscription;
    const usage = req.company.usage;

    if (usage.staff_count >= sub.max_staff_count) {
        return errorResponse(res, 403, `Staff limit reached (${usage.staff_count}/${sub.max_staff_count}). Upgrade your plan to add more staff members.`);
    }
    next();
};

const checkLeadLimit = (req, res, next) => {
    const sub = req.company.subscription;
    const usage = req.company.usage;

    let leadsToCreate = 1;
    if (req.path.includes('bulk-upload') && req.leadsToCreate) {
        leadsToCreate = req.leadsToCreate.length;
    }

    // Allows unlimited leads if the limit is 0 or less (often used for unlimited plans)
    if (sub.max_leads_per_month <= 0) {
        return next();
    }

    const remainingLimit = sub.max_leads_per_month - usage.leads_this_month;

    if (remainingLimit <= 0) {
        return errorResponse(res, 403, `Monthly lead creation limit reached (${usage.leads_this_month}/${sub.max_leads_per_month}). Your lead count resets on the first of next month.`);
    }

    if (leadsToCreate > remainingLimit) {
        return errorResponse(res, 403, `Cannot process. You can only create ${remainingLimit} more leads this month (Limit: ${sub.max_leads_per_month}).`);
    }

    next();
};

const requireFeature = (featureName) => {
    return (req, res, next) => {
        const sub = req.company.subscription;
        if (!sub.features.includes(featureName)) {
            return errorResponse(res, 403, `Feature '${featureName}' is not enabled in your current subscription plan. Please upgrade.`);
        }
        next();
    };
};


module.exports = {
    getCompanySubscriptionAndUsage,
    checkSubscriptionActive,
    checkStaffLimit,
    checkLeadLimit,
    requireFeature
};
