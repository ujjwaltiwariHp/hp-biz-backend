const Performance = require("../models/performanceModel");
const { successResponse } = require("../utils/responseFormatter");
const { errorResponse } = require("../utils/errorResponse");
const { parseAndConvertToUTC } = require('../utils/timezoneHelper');

const getStaffPerformance = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = parseInt(req.params.staffId);
    const periodType = req.query.period_type || 'monthly';

    let periodStart = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
    let periodEnd = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;

    if (!staffId || isNaN(staffId)) {
      return errorResponse(res, 400, "Valid staff ID is required");
    }

    if (req.staff && req.staff.id !== staffId) {
      const isAuthorized = req.staff.role_permissions?.includes('view_all_performance') || false;
      if (!isAuthorized) {
        return errorResponse(res, 403, "Not authorized to view other staff performance");
      }
    }

    const performance = await Performance.getStaffPerformanceMetrics(
      staffId, companyId, periodType, periodStart, periodEnd
    );

    const timeline = await Performance.getStaffTimeline(staffId, companyId, 30);

    const responseData = {
      ...performance,
      timeline: timeline || []
    };

    return successResponse(res, "Staff performance data fetched successfully", responseData, 200, req);
  } catch (err) {
    if (err.message === "Staff member not found") {
      return errorResponse(res, 404, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const getAllStaffPerformance = async (req, res) => {
  try {
    const companyId = req.company.id;
    const periodType = req.query.period_type || 'monthly';

    let periodStart = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
    let periodEnd = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;

    const staffPerformance = await Performance.getAllStaffPerformance(
      companyId, periodType, periodStart, periodEnd
    );

    return successResponse(res, "Staff performance list fetched successfully", staffPerformance, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getPerformanceDashboard = async (req, res) => {
  try {
    const companyId = req.company.id;
    const periodType = req.query.period_type || 'monthly';

    const dashboardData = await Performance.getKpiDashboardData(companyId, periodType);

    const responseData = {
      staffPerformance: dashboardData.staffPerformance,
      kpiOverview: {
        totalLeads: dashboardData.totalLeads,
        barChartData: dashboardData.barChartData
      },
      leadsDistribution: {
        totalLeads: dashboardData.totalLeads,
        pieChartData: dashboardData.pieChartData,
        topPerformer: dashboardData.topPerformer
      }
    };

    return successResponse(res, "Performance dashboard data fetched successfully", responseData, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getCompanyPerformance = async (req, res) => {
  try {
    const companyId = req.company.id;
    const periodType = req.query.period_type || 'monthly';

    let periodStart = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
    let periodEnd = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;

    const performance = await Performance.getCompanyPerformanceMetrics(
      companyId, periodType, periodStart, periodEnd
    );

    return successResponse(res, "Company performance metrics fetched successfully", performance, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getLeadConversionReport = async (req, res) => {
  try {
    const companyId = req.company.id;

    let periodStart = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
    let periodEnd = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;

    const report = await Performance.getLeadConversionReport(companyId, periodStart, periodEnd);

    return successResponse(res, "Lead conversion report generated successfully", report, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getSourcePerformanceReport = async (req, res) => {
  try {
    const companyId = req.company.id;

    let periodStart = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
    let periodEnd = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;

    const report = await Performance.getSourcePerformanceReport(companyId, periodStart, periodEnd);

    return successResponse(res, "Source performance report generated successfully", report, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getStaffTimeline = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = parseInt(req.params.staffId);
    const days = req.query.days ? parseInt(req.query.days) : 30;

    if (!staffId || isNaN(staffId)) {
      return errorResponse(res, 400, "Valid staff ID is required");
    }

    if (req.staff && req.staff.id !== staffId) {
      const isAuthorized = req.staff.role_permissions?.includes('view_all_performance') || false;
      if (!isAuthorized) {
        return errorResponse(res, 403, "Not authorized to view other staff timeline");
      }
    }

    const timeline = await Performance.getStaffTimeline(staffId, companyId, days);

    return successResponse(res, "Staff timeline fetched successfully", timeline, 200, req);
  } catch (err) {
    if (err.message === "Staff member not found") {
      return errorResponse(res, 404, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const generateCustomReport = async (req, res) => {
  try {
    const companyId = req.company.id;

    if (!req.body || typeof req.body !== 'object') {
      return errorResponse(res, 400, "Request body is required");
    }

    const {
      report_type,
      period_start: raw_period_start,
      period_end: raw_period_end,
      staff_ids
    } = req.body;

    if (!report_type) {
      return errorResponse(res, 400, "Report type is required");
    }

    let period_start = raw_period_start ? parseAndConvertToUTC(raw_period_start, req.timezone) : null;
    let period_end = raw_period_end ? parseAndConvertToUTC(raw_period_end, req.timezone) : null;

    let reportData = {};

    switch (report_type) {
      case 'staff_performance':
        if (!staff_ids || !Array.isArray(staff_ids) || staff_ids.length === 0) {
          return errorResponse(res, 400, "Staff IDs are required for staff performance report");
        }

        const staffReports = [];
        for (const staffId of staff_ids) {
          if (isNaN(parseInt(staffId))) {
            continue;
          }

          try {
            const performance = await Performance.getStaffPerformanceMetrics(
              parseInt(staffId), companyId, 'custom', period_start, period_end
            );
            const timeline = await Performance.getStaffTimeline(parseInt(staffId), companyId, 30);

            staffReports.push({
              ...performance,
              timeline: timeline
            });
          } catch (err) {
            continue;
          }
        }

        if (staffReports.length === 0) {
          return errorResponse(res, 404, "No valid staff members found for the provided IDs");
        }

        reportData = { staff_reports: staffReports };
        break;

      case 'conversion_analysis':
        reportData = await Performance.getLeadConversionReport(companyId, period_start, period_end);
        break;

      case 'source_analysis':
        reportData = await Performance.getSourcePerformanceReport(companyId, period_start, period_end);
        break;

      case 'company_overview':
        reportData = await Performance.getCompanyPerformanceMetrics(
          companyId, 'custom', period_start, period_end
        );
        break;

      case 'dashboard_summary':
        reportData = await Performance.getKpiDashboardData(companyId, 'custom');
        break;

      default:
        return errorResponse(res, 400, "Invalid report type. Supported types: staff_performance, conversion_analysis, source_analysis, company_overview, dashboard_summary");
    }

    return successResponse(res, "Custom report generated successfully", {
      report_type,
      generated_at: new Date(),
      period: { start: raw_period_start, end: raw_period_end },
      data: reportData
    }, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

module.exports = {
  getStaffPerformance,
  getAllStaffPerformance,
  getPerformanceDashboard,
  getCompanyPerformance,
  getStaffTimeline,
  getLeadConversionReport,
  getSourcePerformanceReport,
  generateCustomReport
};