const LeadDistribution = require("../models/leadDistributionModel");
const { successResponse } = require("../utils/responseFormatter");
const { errorResponse } = require("../utils/errorResponse");
const NotificationService = require("../services/notificationService");

const getDistributionSettings = async (req, res) => {
  try {
    const companyId = req.company.id;
    const settings = await LeadDistribution.getDistributionSettings(companyId);

    if (!settings) {
      return successResponse(res, "No distribution settings found", null, 200, req);
    }

    return successResponse(res, "Distribution settings fetched successfully", settings, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const updateDistributionSettings = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { distribution_type } = req.body;

    if (!distribution_type || !['manual', 'automatic', 'round_robin', 'performance_based'].includes(distribution_type)) {
      return errorResponse(res, 400, "Valid distribution type is required (manual, automatic, round_robin, performance_based)");
    }

    const existingSettings = await LeadDistribution.getDistributionSettings(companyId);

    let settings;
    if (existingSettings) {
      settings = await LeadDistribution.updateDistributionSettings(companyId, req.body);
    } else {
      settings = await LeadDistribution.createDistributionSettings(companyId, req.body);
    }

    return successResponse(res, "Distribution settings updated successfully", settings, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const manualAssignLeads = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { assignments } = req.body;

    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return errorResponse(res, 400, "Assignments array is required with format: [{staff_id: 1, lead_ids: [1,2,3]}]");
    }

    let assignedBy = null;
    if (req.staff) {
      assignedBy = req.staff.id;
    } else if (req.company) {
      assignedBy = req.company.id;
    }

    const results = await LeadDistribution.bulkAssignLeads(assignments, assignedBy, companyId);

    const totalAssigned = results.reduce((sum, result) => sum + result.assigned_leads.length, 0);

    for (const result of results) {
      const staffId = result.staff_id;
      const leadIds = result.assigned_leads.map(l => l.id);

      if (leadIds.length === 1) {
        await NotificationService.createLeadAssignmentNotification(
          leadIds[0],
          staffId,
          assignedBy,
          companyId
        );
      } else if (leadIds.length > 1) {
        await NotificationService.createBulkAssignmentNotification(
          leadIds,
          staffId,
          assignedBy,
          companyId
        );
      }
    }

    return successResponse(res, "Leads assigned manually", {
      total_assigned: totalAssigned,
      assignments: results
    }, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const automaticAssignLeads = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { count = 10 } = req.body;

    if (count <= 0 || count > 100) {
      return errorResponse(res, 400, "Count must be between 1 and 100");
    }

    const unassignedLeads = await LeadDistribution.getUnassignedLeads(companyId, count);

    if (unassignedLeads.length === 0) {
      return successResponse(res, "No unassigned leads available", { assigned_count: 0 }, 200, req);
    }

    const staffWorkload = await LeadDistribution.getStaffWorkload(companyId);

    if (staffWorkload.length === 0) {
      return errorResponse(res, 400, "No active staff members available for assignment");
    }

    let assignedBy = null;
    if (req.staff) {
      assignedBy = req.staff.id;
    } else if (req.company) {
      assignedBy = req.company.id;
    }

    const assignments = [];
    let staffIndex = 0;

    for (const lead of unassignedLeads) {
      const staff = staffWorkload[staffIndex % staffWorkload.length];

      let existingAssignment = assignments.find(a => a.staff_id === staff.id);
      if (!existingAssignment) {
        existingAssignment = { staff_id: staff.id, lead_ids: [] };
        assignments.push(existingAssignment);
      }

      existingAssignment.lead_ids.push(lead.id);
      staffIndex++;
    }

    const results = await LeadDistribution.bulkAssignLeads(assignments, assignedBy, companyId);
    const totalAssigned = results.reduce((sum, result) => sum + result.assigned_leads.length, 0);

    for (const result of results) {
      const staffId = result.staff_id;
      const leadIds = result.assigned_leads.map(l => l.id);

      if (leadIds.length === 1) {
        await NotificationService.createLeadAssignmentNotification(
          leadIds[0],
          staffId,
          assignedBy,
          companyId
        );
      } else if (leadIds.length > 1) {
        await NotificationService.createBulkAssignmentNotification(
          leadIds,
          staffId,
          assignedBy,
          companyId
        );
      }
    }

    return successResponse(res, "Leads assigned automatically based on workload", {
      total_assigned: totalAssigned,
      assignments: results
    }, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const roundRobinAssignLeads = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { count = 10 } = req.body;

    if (count <= 0 || count > 100) {
      return errorResponse(res, 400, "Count must be between 1 and 100");
    }

    const unassignedLeads = await LeadDistribution.getUnassignedLeads(companyId, count);

    if (unassignedLeads.length === 0) {
      return successResponse(res, "No unassigned leads available", { assigned_count: 0 }, 200, req);
    }

    const activeStaff = await LeadDistribution.getActiveStaff(companyId);

    if (activeStaff.length === 0) {
      return errorResponse(res, 400, "No active staff members available for assignment");
    }

    let assignedBy = null;
    if (req.staff) {
      assignedBy = req.staff.id;
    } else if (req.company) {
      assignedBy = req.company.id;
    }

    const results = [];
    const notificationMap = {};

    for (let i = 0; i < unassignedLeads.length; i++) {
      const lead = unassignedLeads[i];

      const nextStaff = await LeadDistribution.getNextRoundRobinStaff(companyId);

      if (!nextStaff) {
        continue;
      }

      const assignedLeads = await LeadDistribution.assignLeadsToStaff([lead.id], nextStaff.id, assignedBy, companyId);

      if (assignedLeads.length > 0) {
        await LeadDistribution.updateLastAssigned(companyId, nextStaff.id);

        let existingResult = results.find(r => r.staff_id === nextStaff.id);
        if (!existingResult) {
          existingResult = { staff_id: nextStaff.id, staff_name: `${nextStaff.first_name} ${nextStaff.last_name}`, assigned_leads: [] };
          results.push(existingResult);
        }
        existingResult.assigned_leads.push(...assignedLeads);

        if (!notificationMap[nextStaff.id]) {
          notificationMap[nextStaff.id] = [];
        }
        notificationMap[nextStaff.id].push(lead.id);
      }
    }

    for (const [staffId, leadIds] of Object.entries(notificationMap)) {
      if (leadIds.length === 1) {
        await NotificationService.createLeadAssignmentNotification(
          leadIds[0],
          parseInt(staffId),
          assignedBy,
          companyId
        );
      } else if (leadIds.length > 1) {
        await NotificationService.createBulkAssignmentNotification(
          leadIds,
          parseInt(staffId),
          assignedBy,
          companyId
        );
      }
    }

    const totalAssigned = results.reduce((sum, result) => sum + result.assigned_leads.length, 0);

    return successResponse(res, "Leads assigned using round robin method", {
      total_assigned: totalAssigned,
      assignments: results
    }, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const performanceBasedAssignLeads = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { count = 10 } = req.body;

    if (count <= 0 || count > 100) {
      return errorResponse(res, 400, "Count must be between 1 and 100");
    }

    const unassignedLeads = await LeadDistribution.getUnassignedLeads(companyId, count);

    if (unassignedLeads.length === 0) {
      return successResponse(res, "No unassigned leads available", { assigned_count: 0 }, 200, req);
    }

    const staffPerformance = await LeadDistribution.getStaffPerformance(companyId);

    if (staffPerformance.length === 0) {
      return errorResponse(res, 400, "No active staff members available for assignment");
    }

    let assignedBy = null;
    if (req.staff) {
      assignedBy = req.staff.id;
    } else if (req.company) {
      assignedBy = req.company.id;
    }

    const totalStaff = staffPerformance.length;
    const leadsPerTopPerformer = Math.ceil(count * 0.6);
    const remainingLeads = count - leadsPerTopPerformer;

    const assignments = [];
    let leadIndex = 0;

    for (let i = 0; i < staffPerformance.length && leadIndex < unassignedLeads.length; i++) {
      const staff = staffPerformance[i];
      let leadsToAssign;

      if (i === 0) {
        leadsToAssign = Math.min(leadsPerTopPerformer, unassignedLeads.length - leadIndex);
      } else {
        const remainingStaff = totalStaff - 1;
        leadsToAssign = remainingStaff > 0 ? Math.ceil(remainingLeads / remainingStaff) : 0;
      }

      if (leadsToAssign > 0) {
        const leadsForThisStaff = unassignedLeads.slice(leadIndex, leadIndex + leadsToAssign);
        const leadIds = leadsForThisStaff.map(lead => lead.id);

        assignments.push({
          staff_id: staff.id,
          lead_ids: leadIds
        });

        leadIndex += leadsToAssign;
      }
    }

    const results = await LeadDistribution.bulkAssignLeads(assignments, assignedBy, companyId);
    const totalAssigned = results.reduce((sum, result) => sum + result.assigned_leads.length, 0);

    for (const result of results) {
      const staffId = result.staff_id;
      const leadIds = result.assigned_leads.map(l => l.id);

      if (leadIds.length === 1) {
        await NotificationService.createLeadAssignmentNotification(
          leadIds[0],
          staffId,
          assignedBy,
          companyId
        );
      } else if (leadIds.length > 1) {
        await NotificationService.createBulkAssignmentNotification(
          leadIds,
          staffId,
          assignedBy,
          companyId
        );
      }
    }

    return successResponse(res, "Leads assigned based on performance", {
      total_assigned: totalAssigned,
      assignments: results
    }, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getStaffWorkload = async (req, res) => {
  try {
    const companyId = req.company.id;
    const workload = await LeadDistribution.getStaffWorkload(companyId);
    return successResponse(res, "Staff workload fetched successfully", workload, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getUnassignedLeads = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { limit } = req.query;

    const unassignedLeads = await LeadDistribution.getUnassignedLeads(companyId, limit ? parseInt(limit) : null);

    return successResponse(res, "Unassigned leads fetched successfully", {
      count: unassignedLeads.length,
      leads: unassignedLeads
    }, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

module.exports = {
  getDistributionSettings,
  updateDistributionSettings,
  manualAssignLeads,
  automaticAssignLeads,
  roundRobinAssignLeads,
  performanceBasedAssignLeads,
  getStaffWorkload,
  getUnassignedLeads
};