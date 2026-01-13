const UpgradeModel = require('../models/subscriptionUpgradeModel');
const InvoiceModel = require('../models/super-admin-models/invoiceModel');
const { successResponse } = require("../utils/responseFormatter");
const { errorResponse } = require("../utils/errorResponse");
const { logSystemEvent } = require('../models/loggingModel');

const getStatus = async (req, res) => {
    try {
        const companyId = req.company.id;
        const status = await UpgradeModel.getSubscriptionStatus(companyId);
        if (!status) return errorResponse(res, 404, "Subscription status not found.");
        return successResponse(res, "Current subscription status fetched.", status, 200, req);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

const getUpgradeCalculation = async (req, res) => {
    try {
        const companyId = req.company.id;
        const { new_package_id, duration_type } = req.body;

        if (!new_package_id || !['monthly', 'quarterly', 'yearly'].includes(duration_type)) {
            return errorResponse(res, 400, "Invalid package ID or duration type (monthly, quarterly, yearly).");
        }

        const calculation = await UpgradeModel.calculateUpgrade(companyId, new_package_id, duration_type);

        return successResponse(res, "Upgrade calculation retrieved.", calculation, 200, req);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

const initiateUpgrade = async (req, res) => {
    try {
        const companyId = req.company.id;
        const { new_package_id, duration_type } = req.body;

        if (!new_package_id || !['monthly', 'quarterly', 'yearly'].includes(duration_type)) {
            return errorResponse(res, 400, "Invalid parameters.");
        }

        const calculation = await UpgradeModel.calculateUpgrade(companyId, new_package_id, duration_type);
        const { final_payable_amount, new_package, credit_applied } = calculation;

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + new_package.duration_days);

        const invoiceData = {
            company_id: companyId,
            subscription_package_id: new_package.id,
            amount: new_package.price,
            tax_amount: 0,
            total_amount: final_payable_amount,
            currency: 'USD',
            billing_period_start: startDate.toISOString(),
            billing_period_end: endDate.toISOString(),
            due_date: startDate.toISOString(),
            payment_notes: `Upgrade to ${new_package.name} (${duration_type}). Credit applied: $${credit_applied}`
        };

        const newInvoice = await InvoiceModel.createInvoice(invoiceData);

        await logSystemEvent({
            company_id: companyId,
            staff_id: req.staff ? req.staff.id : null,
            log_level: 'INFO',
            log_category: 'SUBSCRIPTION',
            message: `Upgrade requested to ${new_package.name}. Invoice ${newInvoice.invoice_number} generated for $${final_payable_amount}.`
        });

        // Notify Super Admin
        const { createUpgradeRequestNotification } = require('../services/notificationService');
        await createUpgradeRequestNotification(companyId, req.company.company_name, newInvoice, new_package.name, duration_type);

        return successResponse(res, "Upgrade invoice created successfully. Please render payment.", {
            invoice: newInvoice,
            calculation: calculation
        }, 201, req);

    } catch (err) {
        return errorResponse(res, 500, "Failed to initiate upgrade. " + err.message);
    }
};

module.exports = {
    getStatus,
    getUpgradeCalculation,
    initiateUpgrade
};
