const Performance = require("../models/performanceModel");
const { successResponse } = require("../utils/responseFormatter");
const { errorResponse } = require("../utils/errorResponse");
const { parseAndConvertToUTC } = require('../utils/timezoneHelper');
const { generateStaffReportPdf, generateCompanyReportPdf } = require('../utils/reportPdfGenerator');

const getStaffComprehensiveReport = async (req, res) => {
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

    // Parse filters
    const filters = {
        statusIds: req.query.status_ids ? req.query.status_ids.split(',').map(id => parseInt(id)) : [],
        sourceIds: req.query.source_ids ? req.query.source_ids.split(',').map(id => parseInt(id)) : []
    };

    const [performance, timeline, opsReport, statusMatrix] = await Promise.all([
      Performance.getStaffPerformanceMetrics(staffId, companyId, periodType, periodStart, periodEnd, filters),
      Performance.getStaffTimeline(staffId, companyId, 30),
      Performance.getUserLeadOpsReport(companyId, { periodStart, periodEnd, staffIds: [staffId] }),
      Performance.getUserStatusMatrix(companyId, { periodStart, periodEnd, staffIds: [staffId], ...filters })
    ]);

    const operationalStats = opsReport.length > 0 ? opsReport[0] : {};
    const statusBreakdown = statusMatrix.length > 0 ? statusMatrix[0].statuses : [];

    const responseData = {
      ...performance,
      worked_count: parseInt(operationalStats.worked_count || 0),
      not_worked_count: parseInt(operationalStats.not_worked_count || 0),
      transferred_out: parseInt(operationalStats.transferred_out || 0),
      transferred_in: parseInt(operationalStats.transferred_in || 0),
      status_breakdown: statusBreakdown,
      timeline: timeline || []
    };

    return successResponse(res, "Comprehensive staff report fetched successfully", responseData, 200, req);
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

    const filters = {
        statusIds: req.query.status_ids ? req.query.status_ids.split(',').map(id => parseInt(id)) : [],
        sourceIds: req.query.source_ids ? req.query.source_ids.split(',').map(id => parseInt(id)) : []
    };

    const performance = await Performance.getCompanyPerformanceMetrics(
      companyId, periodType, periodStart, periodEnd, filters
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

const getStatusWiseReport = async (req, res) => {
  try {
    const companyId = req.company.id;
    let periodStart = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
    let periodEnd = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;

    let statusIds = [];
    if (req.query.status_ids) {
      statusIds = req.query.status_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }
    let sourceIds = [];
    if (req.query.source_ids) {
        sourceIds = req.query.source_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }

    const report = await Performance.getStatusWiseReport(companyId, {
      periodStart,
      periodEnd,
      statusIds,
      sourceIds
    });

    return successResponse(res, "Status-wise report generated successfully", report, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getUserOpsReport = async (req, res) => {
  try {
    const companyId = req.company.id;
    let periodStart = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
    let periodEnd = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;

    let staffIds = [];
    if (req.query.staff_ids) {
      staffIds = req.query.staff_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }

    const report = await Performance.getUserLeadOpsReport(companyId, {
      periodStart,
      periodEnd,
      staffIds
    });

    return successResponse(res, "User operations report generated successfully", report, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getUserStatusMatrix = async (req, res) => {
  try {
    const companyId = req.company.id;
    let periodStart = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
    let periodEnd = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;

    let staffIds = [];
    if (req.query.staff_ids) {
      staffIds = req.query.staff_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }

    let statusIds = [];
    if (req.query.status_ids) {
      statusIds = req.query.status_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }

    const report = await Performance.getUserStatusMatrix(companyId, {
      periodStart,
      periodEnd,
      staffIds,
      statusIds
    });

    return successResponse(res, "User status matrix generated successfully", report, 200, req);
  } catch (err) {
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
      staff_ids,
      status_ids,
      source_ids
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
             const [performance, timeline, opsReport, statusMatrix] = await Promise.all([
              Performance.getStaffPerformanceMetrics(parseInt(staffId), companyId, 'custom', period_start, period_end, { statusIds: status_ids, sourceIds: source_ids }),
              Performance.getStaffTimeline(parseInt(staffId), companyId, 30),
              Performance.getUserLeadOpsReport(companyId, { periodStart: period_start, periodEnd: period_end, staffIds: [parseInt(staffId)] }),
              Performance.getUserStatusMatrix(companyId, { periodStart: period_start, periodEnd: period_end, staffIds: [parseInt(staffId)], statusIds: status_ids })
            ]);

            const operationalStats = opsReport.length > 0 ? opsReport[0] : {};
            const statusBreakdown = statusMatrix.length > 0 ? statusMatrix[0].statuses : [];

            staffReports.push({
              ...performance,
              worked_count: parseInt(operationalStats.worked_count || 0),
              not_worked_count: parseInt(operationalStats.not_worked_count || 0),
              status_breakdown: statusBreakdown,
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
          companyId, 'custom', period_start, period_end, { statusIds: status_ids, sourceIds: source_ids }
        );
        break;

      case 'dashboard_summary':
        reportData = await Performance.getKpiDashboardData(companyId, 'custom');
        break;

      case 'status_wise':
        reportData = await Performance.getStatusWiseReport(companyId, {
          periodStart: period_start,
          periodEnd: period_end,
          statusIds: status_ids,
          sourceIds: source_ids
        });
        break;

      case 'user_ops':
        reportData = await Performance.getUserLeadOpsReport(companyId, {
          periodStart: period_start,
          periodEnd: period_end,
          staffIds: staff_ids
        });
        break;

      case 'user_status_matrix':
        reportData = await Performance.getUserStatusMatrix(companyId, {
          periodStart: period_start,
          periodEnd: period_end,
          staffIds: staff_ids,
          statusIds: status_ids
        });
        break;

      default:
        return errorResponse(res, 400, "Invalid report type. Supported types: staff_performance, conversion_analysis, source_analysis, company_overview, dashboard_summary, status_wise, user_ops, user_status_matrix");
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

const getOverallCompanyReport = async (req, res) => {
  try {
    const companyId = req.company.id;
    // Updated: Default to null (All Time) if no dates provided, instead of current month
    let periodStart = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
    let periodEnd = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;

    const reportData = await Performance.getCompanyComprehensiveReport(companyId, {
      periodStart,
      periodEnd
    });

    return successResponse(res, "Overall company performance report generated successfully", reportData, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const downloadStaffReportPDF = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = parseInt(req.params.staffId);

    // Default to null (All Time) if not provided
    let periodStart = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
    let periodEnd = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;

    const filters = {
        statusIds: req.query.status_ids ? req.query.status_ids.split(',').map(id => parseInt(id)) : [],
        sourceIds: req.query.source_ids ? req.query.source_ids.split(',').map(id => parseInt(id)) : []
    };

    const [performance, timeline, opsReport, statusMatrix] = await Promise.all([
      Performance.getStaffPerformanceMetrics(staffId, companyId, 'custom', periodStart, periodEnd, filters),
      Performance.getStaffTimeline(staffId, companyId, 30),
      Performance.getUserLeadOpsReport(companyId, { periodStart, periodEnd, staffIds: [staffId] }),
      Performance.getUserStatusMatrix(companyId, { periodStart, periodEnd, staffIds: [staffId], ...filters })
    ]);

    const operationalStats = opsReport.length > 0 ? opsReport[0] : {};
    const statusBreakdown = statusMatrix.length > 0 ? statusMatrix[0].statuses : [];

    const reportData = {
      ...performance,
      worked_count: parseInt(operationalStats.worked_count || 0),
      not_worked_count: parseInt(operationalStats.not_worked_count || 0),
      transferred_out: parseInt(operationalStats.transferred_out || 0),
      status_breakdown: statusBreakdown,
      timeline: timeline || []
    };

    // Handle display dates for PDF
    const startStr = periodStart ? periodStart.toISOString().split('T')[0] : 'All Time';
    const endStr = periodEnd ? periodEnd.toISOString().split('T')[0] : 'Present';

    const pdfBuffer = await generateStaffReportPdf(reportData.name, {
        start: startStr,
        end: endStr
    }, reportData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=staff-report-${staffId}-${Date.now()}.pdf`);
    res.send(pdfBuffer);

  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const downloadCompanyReportPDF = async (req, res) => {
  try {
    const companyId = req.company.id;
    // Default to null (All Time)
    let periodStart = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
    let periodEnd = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;

    const reportData = await Performance.getCompanyComprehensiveReport(companyId, {
      periodStart,
      periodEnd
    });

    const companyName = req.company.company_name;

    const startStr = periodStart ? periodStart.toISOString().split('T')[0] : 'All Time';
    const endStr = periodEnd ? periodEnd.toISOString().split('T')[0] : 'Present';

    const pdfBuffer = await generateCompanyReportPdf(companyName, {
        start: startStr,
        end: endStr
    }, reportData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=company-report-${Date.now()}.pdf`);
    res.send(pdfBuffer);

  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

module.exports = {
  getStaffComprehensiveReport,
  getAllStaffPerformance,
  getPerformanceDashboard,
  getCompanyPerformance,
  getStaffTimeline,
  getLeadConversionReport,
  getSourcePerformanceReport,
  getStatusWiseReport,
  getUserOpsReport,
  getUserStatusMatrix,
  generateCustomReport,
  getOverallCompanyReport,
  downloadStaffReportPDF,
  downloadCompanyReportPDF
};