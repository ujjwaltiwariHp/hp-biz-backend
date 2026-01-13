const MobileDashboard = require('../models/mobileDashboardModel');
const { successResponse } = require("../utils/responseFormatter");
const { errorResponse } = require("../utils/errorResponse");
const sseService = require('../services/sseService');

const getDashboardData = async (req, res) => {
    try {
        const companyId = req.company.id;
        const metrics = await MobileDashboard.getDashboardMetrics(companyId);

        return successResponse(res, "Mobile dashboard data fetched successfully", metrics, 200, req);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

const broadcastDashboardUpdate = async (companyId) => {
    try {
        const metrics = await MobileDashboard.getDashboardMetrics(companyId);
        sseService.publish(`c_${companyId}`, 'mobile_dashboard_update', metrics);
    } catch (error) {
        console.error("Failed to broadcast mobile dashboard update:", error);
    }
}

module.exports = {
    getDashboardData,
    broadcastDashboardUpdate
};
