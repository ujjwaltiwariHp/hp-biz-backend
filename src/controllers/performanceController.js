const Performance = require("../models/performanceModel");
const { successResponse } = require("../utils/responseFormatter");
const { errorResponse } = require("../utils/errorResponse");
const { parseAndConvertToUTC } = require('../utils/timezoneHelper');
const { generateStaffReportPdf, generateCompanyReportPdf } = require('../utils/reportPdfGenerator');

const getDates = (req) => {
  let start = req.query.period_start ? parseAndConvertToUTC(req.query.period_start, req.timezone) : null;
  let end = req.query.period_end ? parseAndConvertToUTC(req.query.period_end, req.timezone) : null;
  return { start, end };
};

const getFilters = (req) => {
  const statusIds = req.query.status_ids ? req.query.status_ids.split(',').map(Number) : [];
  const sourceIds = req.query.source_ids ? req.query.source_ids.split(',').map(Number) : [];
  return { statusIds, sourceIds };
};

const getDashboard = async (req, res) => {
  try {
    const data = await Performance.getKpiDashboardData(req.company.id, req.query.period_type || 'monthly');
    return successResponse(res, "Dashboard data fetched", data, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getStaffReport = async (req, res) => {
  try {
    const { company } = req;
    const staffId = parseInt(req.params.staffId);
    const { start, end } = getDates(req);
    const { statusIds, sourceIds } = getFilters(req);

    if (isNaN(staffId)) return errorResponse(res, 400, "Invalid Staff ID");

    const statusData = await Performance.getStatusBreakdown(company.id, { periodStart: start, periodEnd: end, staffIds: [staffId], statusIds, sourceIds });
    const opsData = await Performance.getUserLeadOpsReport(company.id, { periodStart: start, periodEnd: end, staffIds: [staffId] });
    const timeline = await Performance.getStaffTimeline(staffId, company.id);
    const activityCounts = await Performance.getStaffPerformanceMetrics(staffId, company.id, null, start, end);

    let totalLeads = 0, closed = 0;
    statusData.forEach(s => {
      totalLeads += s.count;
      if (s.is_converted) closed += s.count;
    });

    const ops = opsData[0] || {};

    const report = {
      id: staffId,
      name: ops.first_name ? `${ops.first_name} ${ops.last_name}` : 'Staff',
      metrics: {
        total_leads: totalLeads,
        closed_leads: closed,
        conversion_rate: totalLeads ? ((closed/totalLeads)*100).toFixed(2) : 0,
        ...activityCounts
      },
      operations: {
        worked: ops.worked_count || 0,
        not_worked: ops.not_worked_count || 0,
        transferred_in: ops.transferred_in || 0,
        transferred_out: ops.transferred_out || 0,
        follow_ups: ops.follow_ups_count || 0
      },
      status_breakdown: statusData,
      timeline
    };

    return successResponse(res, "Staff report generated", report, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getCompanyReport = async (req, res) => {
  try {
    const { company } = req;
    const { start, end } = getDates(req);
    const filters = getFilters(req);

    const overview = await Performance.getCompanyOverview(company.id, start, end);
    const funnel = await Performance.getStatusBreakdown(company.id, { periodStart: start, periodEnd: end, ...filters });
    const sources = await Performance.getSourcePerformance(company.id, start, end);
    const topStaff = await Performance.getTopPerformers(company.id, start, end);
    const activeStaff = await Performance.getMostActiveStaff(company.id, start, end);

    const report = {
      overview,
      funnel_status: funnel,
      lead_sources: sources,
      top_performers: topStaff,
      most_active_users: activeStaff
    };

    return successResponse(res, "Company report generated", report, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const generateCustomReport = async (req, res) => {
  try {
    const { company } = req;
    const {
        report_type,
        period_start: raw_period_start,
        period_end: raw_period_end,
        staff_ids,
        status_ids,
        source_ids
    } = req.body;

    const start = raw_period_start ? parseAndConvertToUTC(raw_period_start, req.timezone) : null;
    const end = raw_period_end ? parseAndConvertToUTC(raw_period_end, req.timezone) : null;

    const staffIds = staff_ids ? (Array.isArray(staff_ids) ? staff_ids.map(Number) : [Number(staff_ids)]) : [];
    const statusIds = status_ids ? (Array.isArray(status_ids) ? status_ids.map(Number) : [Number(status_ids)]) : [];
    const sourceIds = source_ids ? (Array.isArray(source_ids) ? source_ids.map(Number) : [Number(source_ids)]) : [];

    let data = {};

    switch (report_type) {
        case 'company_report':
            data = await Performance.getCompanyOverview(company.id, start, end);
            break;
        case 'staff_report':
             if (staffIds.length === 0) return errorResponse(res, 400, "Staff IDs required");
             const opsData = await Performance.getUserLeadOpsReport(company.id, { periodStart: start, periodEnd: end, staffIds });
             data = { staff_data: opsData };
             break;
        default:
            return errorResponse(res, 400, "Invalid report type");
    }

    return successResponse(res, "Custom report generated", data, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const downloadStaffPdf = async (req, res) => {
  try {
    const { company } = req;
    const staffId = parseInt(req.params.staffId);
    const { start, end } = getDates(req);

    const [statusData, opsData, activityCounts, timeline] = await Promise.all([
        Performance.getStatusBreakdown(company.id, { periodStart: start, periodEnd: end, staffIds: [staffId] }),
        Performance.getUserLeadOpsReport(company.id, { periodStart: start, periodEnd: end, staffIds: [staffId] }),
        Performance.getStaffPerformanceMetrics(staffId, company.id, null, start, end),
        Performance.getStaffTimeline(staffId, company.id)
    ]);

    const ops = opsData[0] || {};
    let totalLeads = 0, closed = 0;
    statusData.forEach(s => { totalLeads += s.count; if (s.is_converted) closed += s.count; });

    const data = {
      name: ops.first_name ? `${ops.first_name} ${ops.last_name}` : 'Staff Member',
      totalLeads,
      conversion_rate: totalLeads ? ((closed/totalLeads)*100).toFixed(2) : 0,
      total_deal_value: 0,
      worked_count: ops.worked_count || 0,
      calls_made: activityCounts.calls_made,
      emails_sent: activityCounts.emails_sent,
      meetings_held: activityCounts.meetings_held,
      followUps: ops.follow_ups_count || 0,
      transferred_out: ops.transferred_out || 0,
      status_breakdown: statusData,
      timeline
    };

    const pdfBuffer = await generateStaffReportPdf(data.name, {
      start: start ? start.toISOString().split('T')[0] : 'All Time',
      end: end ? end.toISOString().split('T')[0] : 'Present'
    }, data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=staff-${staffId}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const downloadCompanyPdf = async (req, res) => {
  try {
    const { company } = req;
    const { start, end } = getDates(req);

    const overview = await Performance.getCompanyOverview(company.id, start, end);
    const funnel = await Performance.getStatusBreakdown(company.id, { periodStart: start, periodEnd: end });
    const sources = await Performance.getSourcePerformance(company.id, start, end);
    const topStaff = await Performance.getTopPerformers(company.id, start, end);

    const data = {
        overview,
        funnel_status: funnel,
        lead_sources: sources,
        top_performers: topStaff.map(s => ({ name: `${s.first_name} ${s.last_name}`, total_deal_value: 0, closed: s.closed }))
    };

    const pdfBuffer = await generateCompanyReportPdf(company.company_name, {
        start: start ? start.toISOString().split('T')[0] : 'All Time',
        end: end ? end.toISOString().split('T')[0] : 'Present'
    }, data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=company-report.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

module.exports = {
  getDashboard,
  getStaffReport,
  getCompanyReport,
  generateCustomReport,
  downloadStaffPdf,
  downloadCompanyPdf
};