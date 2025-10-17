const Lead = require("../models/leadsModel");
const { successResponse } = require("../utils/responseFormatter");
const { errorResponse } = require("../utils/errorResponse");
const NotificationService = require("../services/notificationService");
const { parseAndConvertToUTC } = require('../utils/timezoneHelper');
const Staff = require("../models/staffModel");

const createLead = async (req, res) => {
  try {
    const company_id = req.company.id;
    const { first_name, last_name, email, phone, lead_source_id, assigned_to, tag, next_follow_up } = req.body;

    if (!first_name || !last_name || (!email && !phone) || !lead_source_id) {
      return errorResponse(res, 400, "First name, last name, email/phone, and lead source are required");
    }

    let created_by, assigned_by, created_by_type, assigned_by_type;

    if (req.staff) {
      created_by = req.staff.id;
      created_by_type = 'staff';
      if (assigned_to) {
        assigned_by = req.staff.id;
        assigned_by_type = 'staff';
      }
    } else if (req.company) {
      created_by = req.company.id;
      created_by_type = 'company';
      if (assigned_to) {
        assigned_by = req.company.id;
        assigned_by_type = 'company';
      }
    }

    const leadData = {
      company_id,
      created_by,
      created_by_type,
      assigned_by: assigned_by || null,
      assigned_by_type: assigned_by_type || null,
      ...req.body
    };

    if (next_follow_up) {
      leadData.next_follow_up = parseAndConvertToUTC(next_follow_up, req.timezone);
    }

    const newLead = await Lead.createLead(leadData);
    if (tag && typeof tag === 'string') {
      let applied_by = null;
      if (req.staff) {
        applied_by = req.staff.id;
      }
      await Lead.applyTagsToLead(newLead.id, [tag.toLowerCase()], applied_by, company_id);
    }

    const createdLeadWithDetails = await Lead.getLeadByIdWithTags(newLead.id, company_id);

    if (created_by && created_by_type === 'staff') {
      await Lead.trackLeadCreation(newLead.id, created_by, company_id);
    }

    if (assigned_to && assigned_by) {
      await NotificationService.createLeadAssignmentNotification(
        newLead.id,
        assigned_to,
        assigned_by,
        company_id
      );
    }

    if (created_by_type === 'staff' && created_by) {
      await NotificationService.createLeadCreationNotification(
        newLead.id,
        created_by,
        company_id
      );
    }

    return successResponse(res, "Lead created successfully", createdLeadWithDetails, 201, req);
  } catch (err) {
    return errorResponse(res, 500, "Failed to create lead. " + err.message);
  }
};

const updateLead = async (req, res) => {
  try {
    const companyId = req.company.id;
    const updateData = { ...req.body };
    const { tag, next_follow_up } = req.body;

    const currentLead = await Lead.getLeadById(req.params.id, companyId);
    if (!currentLead) return errorResponse(res, 404, "Lead not found or unauthorized");

    let userType = null;
    let userId = null;

    if (next_follow_up) {
      updateData.next_follow_up = parseAndConvertToUTC(next_follow_up, req.timezone);
    }

    if (req.body.assigned_to) {
      if (req.staff) {
        updateData.assigned_by = req.staff.id;
        updateData.assigned_by_type = 'staff';
        userId = req.staff.id;
        userType = 'staff';
      } else if (req.company) {
        updateData.assigned_by = req.company.id;
        updateData.assigned_by_type = 'company';
        userId = req.company.id;
        userType = 'company';
      }

      if (currentLead.assigned_to !== req.body.assigned_to) {
        await NotificationService.createLeadAssignmentNotification(
          req.params.id,
          req.body.assigned_to,
          updateData.assigned_by,
          companyId
        );

        if (userId && userType === 'staff') {
          await Lead.trackLeadAssignment(req.params.id, req.body.assigned_to, userId, companyId);
        }
      }
    }

    const updatedLead = await Lead.updateLead(req.params.id, updateData, companyId);

    if (tag && typeof tag === 'string') {
      let applied_by = null;
      if (req.staff) {
        applied_by = req.staff.id;
      }
      await Lead.updateLeadTags(req.params.id, [tag.toLowerCase()], applied_by, companyId);
    }

    const leadWithDetails = await Lead.getLeadByIdWithTags(updatedLead.id, companyId);
    if (userType === 'staff' && userId) {
      await NotificationService.createLeadUpdateNotification(
        req.params.id,
        userId,
        companyId,
        'Lead information updated'
      );
    }

    return successResponse(res, "Lead updated successfully", leadWithDetails, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const bulkUploadLeads = async (req, res) => {
  try {
    const { leadsToCreate, processingErrors, lead_source_id } = req;
    const companyId = req.company.id;
    const BATCH_SIZE = 25000;

    let created_by, assigned_by, created_by_type, assigned_by_type;
    let defaultStatusId = 1;

    if (req.staff) {
      created_by = req.staff.id;
      created_by_type = 'staff';
      if (req.body.assigned_to) {
        assigned_by = req.staff.id;
        assigned_by_type = 'staff';
      }
    } else if (req.company) {
      created_by = req.company.id;
      created_by_type = 'company';
      if (req.body.assigned_to) {
        assigned_by = req.company.id;
        assigned_by_type = 'company';
      }
    }

    if (processingErrors && processingErrors.length > 0) {
      return errorResponse(res, 400, "File contains invalid rows.", { errors: processingErrors });
    }

    let successCount = 0, failedCount = 0, finalErrors = [];
    const totalBatches = Math.ceil(leadsToCreate.length / BATCH_SIZE);

    for (let i = 0; i < leadsToCreate.length; i += BATCH_SIZE) {
      const batch = leadsToCreate.slice(i, i + BATCH_SIZE);
      const currentBatch = (i / BATCH_SIZE) + 1;

      const preparedBatch = batch.map(lead => ({
        company_id: companyId,
        lead_source_id: parseInt(lead_source_id),
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        address: lead.address || null,
        remarks: lead.remarks || null,
        company_name: lead.company_name || null,
        job_title: lead.job_title || null,
        status_id: lead.status_id || defaultStatusId,
        assigned_to: req.body.assigned_to || null,
        created_by,
        created_by_type,
        assigned_by: assigned_by || null,
        assigned_by_type: assigned_by_type || null
      }));

      try {
        const result = await Lead.bulkCreateLeadsWithCopy(preparedBatch, defaultStatusId);
        successCount += result.rowCount;
      } catch (dbError) {
        failedCount += batch.length;
        finalErrors.push(`Batch starting at index ${i} failed: ${dbError.message}`);
      }
    }

    if (created_by_type === 'staff' && successCount > 0) {
      await NotificationService.createCustomNotification(
        companyId,
        'admin',
        'Bulk Lead Upload Complete',
        `${successCount} leads were imported successfully.`,
        'bulk_upload',
        'normal'
      );
    }

    return successResponse(res, "Bulk upload complete.", {
      totalRows: leadsToCreate.length,
      imported: successCount,
      skipped: 0,
      failed: failedCount,
      errors: finalErrors
    }, 200, req);

  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};


const updateLeadStatus = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { status_id } = req.body;

    if (!status_id) return errorResponse(res, 400, "Status ID is required");

    const currentLead = await Lead.getLeadById(req.params.id, companyId);
    if (!currentLead) return errorResponse(res, 404, "Lead not found or unauthorized");

    const oldStatusId = currentLead.status_id;
    const updatedLead = await Lead.updateLeadStatusOnly(req.params.id, status_id, companyId);

    let trackingUserId, userType;
    if (req.staff) {
      trackingUserId = req.staff.id;
      userType = 'staff';
    } else if (req.company) {
      trackingUserId = req.company.id;
      userType = 'company';
    }

    if (trackingUserId && userType === 'staff' && oldStatusId !== status_id) {
      await Lead.trackLeadStatusChange(req.params.id, oldStatusId, status_id, trackingUserId, companyId);
      const oldStatus = await Lead.getStatusNameById(oldStatusId, companyId);
      const newStatus = await Lead.getStatusNameById(status_id, companyId);

      await Lead.trackLeadStatusChange(req.params.id, oldStatusId, status_id, trackingUserId, companyId);
      await NotificationService.createLeadStatusChangeNotification(
        req.params.id,
        oldStatus,
        newStatus,
        trackingUserId,
        companyId
      );

      await NotificationService.createLeadActivityNotification(
        req.params.id,
        'status_change',
        trackingUserId,
        companyId
      );
    }

    return successResponse(res, "Lead status updated", updatedLead, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getLeads = async (req, res) => {
  try {
    const companyId = req.company.id;
    const leads = await Lead.getLeadsWithTags(companyId);
    return successResponse(res, "Leads fetched successfully", leads, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getLeadById = async (req, res) => {
  try {
    const companyId = req.company.id;
    const lead = await Lead.getLeadByIdWithTags(req.params.id, companyId);
    if (!lead) {
      return errorResponse(res, 404, "Lead not found or unauthorized");
    }
    return successResponse(res, "Lead details fetched", lead, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const deleteLead = async (req, res) => {
  try {
    const companyId = req.company.id;
    const deleted = await Lead.deleteLead(req.params.id, companyId);
    if (!deleted) {
      return errorResponse(res, 404, "Lead not found or unauthorized");
    }
    if (req.staff) {
      await NotificationService.createLeadActivityNotification(
        req.params.id,
        'deletion',
        req.staff.id,
        companyId
      );
    }

    return successResponse(res, "Lead deleted successfully", {}, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const searchLeads = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { date_from, date_to, ...queryFilters } = req.query;

    const filters = {
      status_ids: queryFilters.status_ids ? queryFilters.status_ids.split(',').map(id => parseInt(id)) : null,
      tag_ids: queryFilters.tag_ids ? queryFilters.tag_ids.split(',').map(id => parseInt(id)) : null,
      tag_names: queryFilters.tag_names ? queryFilters.tag_names.split(',').map(name => name.toLowerCase()) : null,
      source_ids: queryFilters.source_ids ? queryFilters.source_ids.split(',').map(id => parseInt(id)) : null,
      assigned_to: queryFilters.assigned_to ? queryFilters.assigned_to.split(',').map(id => parseInt(id)) : null,
      search: queryFilters.search || null,
      limit: queryFilters.limit ? parseInt(queryFilters.limit) : null,
      offset: queryFilters.offset ? parseInt(queryFilters.offset) : null
    };

    if (date_from) {
      filters.date_from = parseAndConvertToUTC(date_from, req.timezone);
    }
    if (date_to) {
      const dateToInclusive = new Date(new Date(date_to).getTime() + (24 * 60 * 60 * 1000));
      filters.date_to = parseAndConvertToUTC(dateToInclusive.toISOString(), req.timezone);
    }

    const leads = await Lead.searchLeads(companyId, filters);
    return successResponse(res, "Leads fetched successfully", leads, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};


const getLeadStatuses = async (req, res) => {
  try {
    const statuses = await Lead.getLeadStatuses(req.company.id);
    return successResponse(res, "Lead statuses fetched successfully", statuses, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getLeadStatusById = async (req, res) => {
  try {
    const companyId = req.company.id;
    const status = await Lead.getLeadStatusById(req.params.id, companyId);
    if (!status) {
      return errorResponse(res, 404, "Lead status not found or unauthorized");
    }
    return successResponse(res, "Lead status details fetched", status, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const createLeadStatus = async (req, res) => {
  try {
    const company_id = req.company.id;
    const { status_name } = req.body;

    if (!status_name) {
      return errorResponse(res, 400, "Status name is required");
    }

    const newStatus = await Lead.createLeadStatus({ ...req.body, company_id });
    return successResponse(res, "Lead status created successfully", newStatus, 201, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const updateLeadStatusRecord = async (req, res) => {
  try {
    const companyId = req.company.id;
    const updatedStatus = await Lead.updateLeadStatus(req.params.id, req.body, companyId);
    if (!updatedStatus) {
      return errorResponse(res, 404, "Lead status not found or unauthorized");
    }
    return successResponse(res, "Lead status updated successfully", updatedStatus, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const deleteLeadStatus = async (req, res) => {
  try {
    const companyId = req.company.id;
    const deleted = await Lead.deleteLeadStatus(req.params.id, companyId);
    if (!deleted) {
      return errorResponse(res, 404, "Lead status not found or unauthorized");
    }
    return successResponse(res, "Lead status deleted successfully", {}, 200, req);
  } catch (err) {
    if (err.message.includes("Cannot delete status")) {
      return errorResponse(res, 400, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const getLeadSources = async (req, res) => {
  try {
    const sources = await Lead.getLeadSources(req.company.id);
    return successResponse(res, "Lead sources fetched successfully", sources, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getLeadSourceById = async (req, res) => {
  try {
    const companyId = req.company.id;
    const source = await Lead.getLeadSourceById(req.params.id, companyId);
    if (!source) {
      return errorResponse(res, 404, "Lead source not found or unauthorized");
    }
    return successResponse(res, "Lead source details fetched", source, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const createLeadSource = async (req, res) => {
  try {
    const company_id = req.company.id;
    const { source_name } = req.body;

    if (!source_name) {
      return errorResponse(res, 400, "Source name is required");
    }

    const newSource = await Lead.createLeadSource({ ...req.body, company_id });
    return successResponse(res, "Lead source created successfully", newSource, 201, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const updateLeadSource = async (req, res) => {
  try {
    const companyId = req.company.id;
    const updatedSource = await Lead.updateLeadSource(req.params.id, req.body, companyId);
    if (!updatedSource) {
      return errorResponse(res, 404, "Lead source not found or unauthorized");
    }
    return successResponse(res, "Lead source updated successfully", updatedSource, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const deleteLeadSource = async (req, res) => {
  try {
    const companyId = req.company.id;
    const deleted = await Lead.deleteLeadSource(req.params.id, companyId);
    if (!deleted) {
      return errorResponse(res, 404, "Lead source not found or unauthorized");
    }
    return successResponse(res, "Lead source deleted successfully", {}, 200, req);
  } catch (err) {
    if (err.message.includes("Cannot delete source")) {
      return errorResponse(res, 400, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const getLeadAssignmentHistory = async (req, res) => {
  try {
    const companyId = req.company.id;
    const staffId = req.query.staff_id ? parseInt(req.query.staff_id) : null;
    const history = await Lead.getLeadAssignmentHistory(companyId, staffId);
    return successResponse(res, "Lead assignment history fetched successfully", history, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getLeadTags = async (req, res) => {
  try {
    const tags = await Lead.getLeadTags(req.company.id);
    return successResponse(res, "Lead tags fetched successfully", tags, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getLeadTagById = async (req, res) => {
  try {
    const companyId = req.company.id;
    const tag = await Lead.getLeadTagById(req.params.id, companyId);
    if (!tag) {
      return errorResponse(res, 404, "Lead tag not found or unauthorized");
    }
    return successResponse(res, "Lead tag details fetched", tag, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const applyTagToLead = async (req, res) => {
  try {
    const companyId = req.company.id;
    const leadId = req.params.id;
    const { tag_id, tag_name } = req.body;

    let tagId = tag_id;

    if (tag_name && !tag_id) {
      tagId = await Lead.getTagIdByName(tag_name.toLowerCase(), companyId);
      if (!tagId) {
        return errorResponse(res, 404, `Tag "${tag_name}" not found`);
      }
    }

    if (!tagId) {
      return errorResponse(res, 400, "Tag ID or tag name is required");
    }

    let applied_by = null;
    if (req.staff) {
      applied_by = req.staff.id;
    }

    const appliedTag = await Lead.applyTagToLead(leadId, tagId, applied_by, companyId);
    return successResponse(res, "Tag applied to lead successfully", appliedTag, 201, req);
  } catch (err) {
    if (err.message.includes("Lead not found") || err.message.includes("Tag not found")) {
      return errorResponse(res, 404, err.message);
    }
    if (err.message.includes("already applied")) {
      return errorResponse(res, 409, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const removeTagFromLead = async (req, res) => {
  try {
    const companyId = req.company.id;
    const leadId = req.params.id;
    const tagId = req.params.tagId;

    const removed = await Lead.removeTagFromLead(leadId, tagId, companyId);
    if (!removed) {
      return errorResponse(res, 404, "Tag mapping not found or unauthorized");
    }
    return successResponse(res, "Tag removed from lead successfully", {}, 200, req);
  } catch (err) {
    if (err.message.includes("Lead not found")) {
      return errorResponse(res, 404, err.message);
    }
    return errorResponse(res, 500, err.message);
  }
};

const getLeadTagsByLeadId = async (req, res) => {
  try {
    const companyId = req.company.id;
    const leadId = req.params.id;

    const tags = await Lead.getLeadTagsByLeadId(leadId, companyId);
    return successResponse(res, "Lead tags fetched successfully", tags, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const getLeadDetails = async (req, res) => {
  try {
    const companyId = req.company.id;
    const leadId = req.params.id;

    const leadData = await Lead.getLeadHistoryComplete(leadId, companyId);
    if (!leadData) {
      return errorResponse(res, 404, "Lead not found or unauthorized");
    }

    const response = {
      id: leadData.id,
      name: `${leadData.first_name} ${leadData.last_name}`,
      added_at: leadData.created_at,
      updated_at: leadData.updated_at,
      status: {
        name: leadData.lead_status,
        color: leadData.status_color
      },
      lead_details: {
        first_name: leadData.first_name,
        last_name: leadData.last_name,
        email: leadData.email,
        phone: leadData.phone,
        company_name: leadData.company_name,
        job_title: leadData.job_title,
        industry: leadData.industry,
        address: leadData.address,
        remarks: leadData.remarks,
        lead_value: leadData.lead_value,
        currency: leadData.currency,
        notes: leadData.notes,
        internal_notes: leadData.internal_notes,
        priority_level: leadData.priority_level,
        lead_score: leadData.lead_score,
        best_time_to_call: leadData.best_time_to_call,
        timezone: leadData.timezone,
        utm_source: leadData.utm_source,
        utm_medium: leadData.utm_medium,
        utm_campaign: leadData.utm_campaign,
        referral_source: leadData.referral_source,
        lead_source: leadData.lead_source,
        lead_source_type: leadData.lead_source_type,
        assigned_staff: leadData.assigned_staff_first_name && leadData.assigned_staff_last_name ?
          `${leadData.assigned_staff_first_name} ${leadData.assigned_staff_last_name}` : null,
        created_by: leadData.created_by_name,
        assigned_by: leadData.assigned_by_name,
        assigned_at: leadData.assigned_at,
        last_contacted: leadData.last_contacted,
        next_follow_up: leadData.next_follow_up,
        created_at: leadData.created_at,
        updated_at: leadData.updated_at
      },
    };

    return successResponse(res, "Lead details fetched successfully", response, 200, req);
  } catch (err) {
    return errorResponse(res, 500, "Failed to fetch lead details. " + err.message);
  }
};

const getLeadHistory = async (req, res) => {
  try {
    const companyId = req.company.id;
    const leadId = req.params.id;

    const response = await Lead.getLeadHistoryComplete(leadId, companyId);
    return successResponse(res, "Lead history fetched successfully", response, 200, req);
  } catch (err) {
    if (err.message === "Lead not found or unauthorized") {
      return errorResponse(res, 404, err.message);
    }
    return errorResponse(res, 500, "Failed to fetch lead history. " + err.message);
  }
};
const getLeadFollowUps = async (req, res) => {
  try {
    const companyId = req.company.id;
    const leadId = req.params.id;

    const lead = await Lead.getLeadDetailsForUI(leadId, companyId);
    if (!lead) {
      return errorResponse(res, 404, "Lead not found or unauthorized");
    }

    const followUps = await Lead.getLeadFollowUpsExact(leadId, companyId);

    const response = {
      lead: {
        id: lead.id,
        name: `${lead.first_name} ${lead.last_name}`,
        added_at: lead.created_at,
        updated_at: lead.updated_at,
        status: {
          name: lead.status_name,
          color: lead.status_color
        }
      },
      followUps: followUps
    };

    return successResponse(res, "Lead follow-ups fetched successfully", response, 200, req);
  } catch (err) {
    return errorResponse(res, 500, "Failed to fetch lead follow-ups. " + err.message);
  }
};

const createFollowUp = async (req, res) => {
  try {
    const leadId = req.params.id;
    const { remarks, reminder_time } = req.body;
    const companyId = req.company?.id;

    if (!remarks) return errorResponse(res, 400, "Remarks for follow-up are required");

    const leadExists = await Lead.getLeadById(leadId, companyId);
    if (!leadExists) return errorResponse(res, 404, "Lead not found or unauthorized");

    let created_by, created_by_type, assigned_staff_id;

    if (req.staff) {
      created_by = req.staff.id;
      created_by_type = 'staff';
      assigned_staff_id = leadExists.assigned_to || req.staff.id;
    } else if (req.company) {
      created_by = req.company.id;
      created_by_type = 'company';
      assigned_staff_id = leadExists.assigned_to;

      if (!assigned_staff_id) {
        const staffList = await Staff.getAllStaff(companyId);
        if (!staffList || staffList.length === 0) {
          return errorResponse(res, 400, "Cannot create follow-up: no staff available in the company to assign it to.");
        }
        assigned_staff_id = staffList[0].id;
      }
    } else {
      return errorResponse(res, 401, "Unauthorized user");
    }

    if (!assigned_staff_id) {
      return errorResponse(res, 400, "Follow-up must be assigned to a staff member.");
    }

    const followUpData = {
      lead_id: leadId,
      staff_id: assigned_staff_id,
      company_id: companyId,
      message: remarks,
      priority: 'normal',
      created_by,
      created_by_type
    };

    if (reminder_time) {
      followUpData.reminder_time = parseAndConvertToUTC(reminder_time, req.timezone);
    } else {
      followUpData.reminder_time = new Date();
    }

    const newFollowUp = await Lead.createFollowUp(followUpData);

    if (created_by_type === 'staff') {
      await NotificationService.createFollowUpNotification(
        leadId,
        assigned_staff_id,
        created_by,
        companyId,
        newFollowUp.reminder_time
      );
    }

    const createdByName = req.staff
      ? `${req.staff.first_name} ${req.staff.last_name}`
      : req.company
      ? req.company.admin_name
      : 'System';

    return successResponse(res, "Follow-up created successfully", {
      id: newFollowUp.id,
      lead_id: newFollowUp.lead_id,
      follow_up_time: newFollowUp.reminder_time,
      created_at: newFollowUp.created_at,
      created_by: createdByName,
      remarks: newFollowUp.message
    }, 201, req);
  } catch (err) {
    return errorResponse(res, 500, "Failed to create follow-up. " + err.message);
  }
};

const updateFollowUp = async (req, res) => {
  try {
    const followUpId = req.params.id;
    const { remarks, is_completed, reminder_time } = req.body;
    const companyId = req.company?.id;

    const existingFollowUp = await Lead.getFollowUpById(followUpId, companyId);
    if (!existingFollowUp) return errorResponse(res, 404, "Follow-up not found or unauthorized");

    const updateData = {};
    if (remarks !== undefined) updateData.message = remarks;
    if (is_completed !== undefined) updateData.is_completed = is_completed;

    if (reminder_time !== undefined) {
      updateData.reminder_time = parseAndConvertToUTC(reminder_time, req.timezone);
    }

    const updatedFollowUp = await Lead.updateFollowUp(followUpId, updateData, companyId);

    return successResponse(res, "Follow-up updated successfully", {
      id: updatedFollowUp.id,
      follow_up_time: updatedFollowUp.reminder_time,
      updated_at: updatedFollowUp.updated_at,
      remarks: updatedFollowUp.message,
      is_completed: updatedFollowUp.is_completed,
      completed_at: updatedFollowUp.completed_at
    }, 200, req);
  } catch (err) {
    return errorResponse(res, 500, "Failed to update follow-up. " + err.message);
  }
};

const getAllFollowUps = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { date_from, date_to, ...queryFilters } = req.query;

    const filters = {
      staff_id: queryFilters.staff_id ? parseInt(queryFilters.staff_id) : null,
      is_completed: queryFilters.is_completed !== undefined ? queryFilters.is_completed === 'true' : undefined,
      limit: queryFilters.limit ? parseInt(queryFilters.limit) : null
    };

    if (date_from) {
      filters.date_from = parseAndConvertToUTC(date_from, req.timezone);
    }
    if (date_to) {
      const dateToInclusive = new Date(new Date(date_to).getTime() + (24 * 60 * 60 * 1000));
      filters.date_to = parseAndConvertToUTC(dateToInclusive.toISOString(), req.timezone);
    }

    const followUps = await Lead.getAllFollowUps(companyId, filters);
    return successResponse(res, "Follow-ups fetched successfully", followUps, 200, req);
  } catch (err) {
    return errorResponse(res, 500, "Failed to fetch follow-ups. " + err.message);
  }
};

const deleteFollowUp = async (req, res) => {
  try {
    const companyId = req.company.id;
    const followUpId = req.params.id;

    const existingFollowUp = await Lead.getFollowUpById(followUpId, companyId);
    if (!existingFollowUp) {
      return errorResponse(res, 404, "Follow-up not found or unauthorized");
    }

    const deleted = await Lead.deleteFollowUp(followUpId, companyId);
    if (!deleted) {
      return errorResponse(res, 500, "Failed to delete follow-up");
    }

    let userType, userId;
    if (req.staff) {
      userType = 'staff';
      userId = req.staff.id;
    } else if (req.company) {
      userType = 'company';
      userId = req.company.id;
    }

    if (userId && userType === 'staff') {
      await Lead.createLeadActivity({
        lead_id: existingFollowUp.lead_id,
        staff_id: userId,
        activity_type: 'follow_up_deleted',
        new_value: 'Follow-up removed',
        description: 'Follow-up reminder deleted'
      });

      await NotificationService.createLeadActivityNotification(
        existingFollowUp.lead_id,
        'follow_up_deletion',
        userId,
        companyId
      );
    }

    return successResponse(res, "Follow-up deleted successfully", {}, 200, req);
  } catch (err) {
    return errorResponse(res, 500, "Failed to delete follow-up. " + err.message);
  }
};

const getFollowUpById = async (req, res) => {
  try {
    const companyId = req.company.id;
    const followUpId = req.params.id;

    const followUp = await Lead.getFollowUpById(followUpId, companyId);
    if (!followUp) {
      return errorResponse(res, 404, "Follow-up not found or unauthorized");
    }

    return successResponse(res, "Follow-up fetched successfully", followUp, 200, req);
  } catch (err) {
    return errorResponse(res, 500, "Failed to fetch follow-up. " + err.message);
  }
};

const markFollowUpComplete = async (req, res) => {
  try {
    const companyId = req.company.id;
    const followUpId = req.params.id;

    const existingFollowUp = await Lead.getFollowUpById(followUpId, companyId);
    if (!existingFollowUp) {
      return errorResponse(res, 404, "Follow-up not found or unauthorized");
    }

    const completedFollowUp = await Lead.markFollowUpComplete(followUpId, companyId);

    let userType, userId;
    if (req.staff) {
      userType = 'staff';
      userId = req.staff.id;
    } else if (req.company) {
      userType = 'company';
      userId = req.company.id;
    }

    if (userId && userType === 'staff') {
      await Lead.trackLeadActivity(
        existingFollowUp.lead_id,
        userId,
        'follow_up_completed',
        'Follow-up marked as completed',
        null,
        null,
        {
          follow_up_id: followUpId,
          company_id: companyId
        }
      );
    }

    return successResponse(res, "Follow-up marked as completed successfully", completedFollowUp, 200, req);
  } catch (err) {
    return errorResponse(res, 500, "Failed to complete follow-up. " + err.message);
  }
};

const updateLeadFollowUp = async (req, res) => {
  try {
    const leadId = req.params.leadId;
    const followUpId = req.params.followUpId;
    const { remarks, is_completed, reminder_time } = req.body;
    const companyId = req.company?.id;

    const leadExists = await Lead.getLeadById(leadId, companyId);
    if (!leadExists) return errorResponse(res, 404, "Lead not found or unauthorized");

    const existingFollowUp = await Lead.getFollowUpById(followUpId, companyId);
    if (!existingFollowUp || existingFollowUp.lead_id != leadId) {
      return errorResponse(res, 404, "Follow-up not found or unauthorized");
    }

    const updateData = {};
    if (remarks !== undefined) updateData.message = remarks;
    if (is_completed !== undefined) updateData.is_completed = is_completed;

    if (reminder_time !== undefined) {
      updateData.reminder_time = parseAndConvertToUTC(reminder_time, req.timezone);
    }

    const updatedFollowUp = await Lead.updateFollowUp(followUpId, updateData, companyId);

    return successResponse(res, "Follow-up updated successfully", {
      id: updatedFollowUp.id,
      follow_up_time: updatedFollowUp.reminder_time,
      updated_at: updatedFollowUp.updated_at,
      remarks: updatedFollowUp.message,
      is_completed: updatedFollowUp.is_completed,
      completed_at: updatedFollowUp.completed_at
    }, 200, req);
  } catch (err) {
    return errorResponse(res, 500, "Failed to update follow-up. " + err.message);
  }
};

const deleteLeadFollowUp = async (req, res) => {
  try {
    const leadId = req.params.leadId;
    const followUpId = req.params.followUpId;
    const companyId = req.company?.id;

    const leadExists = await Lead.getLeadById(leadId, companyId);
    if (!leadExists) return errorResponse(res, 404, "Lead not found or unauthorized");
    const existingFollowUp = await Lead.getFollowUpById(followUpId, companyId);
    if (!existingFollowUp || existingFollowUp.lead_id != leadId) {
      return errorResponse(res, 404, "Follow-up not found or unauthorized");
    }

    const deleted = await Lead.deleteFollowUp(followUpId, companyId);
    if (!deleted) {
      return errorResponse(res, 500, "Failed to delete follow-up");
    }

    let userType, userId;
    if (req.staff) {
      userType = 'staff';
      userId = req.staff.id;
    } else if (req.company) {
      userType = 'company';
      userId = req.company.id;
    }

    if (userId && userType === 'staff') {
      await Lead.trackLeadActivity(
        leadId,
        userId,
        'follow_up_deleted',
        'Follow-up reminder deleted',
        null,
        'Follow-up removed',
        {
          follow_up_id: followUpId,
          company_id: companyId
        }
      );

      await NotificationService.createLeadActivityNotification(
        leadId,
        'follow_up_deletion',
        userId,
        companyId
      );
    }

    return successResponse(res, "Follow-up deleted successfully", {}, 200, req);
  } catch (err) {
    return errorResponse(res, 500, "Failed to delete follow-up. " + err.message);
  }
};

module.exports = {
  createLead,
  bulkUploadLeads,
  getLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  deleteLead,
  searchLeads,
  getLeadStatuses,
  getLeadStatusById,
  createLeadStatus,
  updateLeadStatusRecord,
  deleteLeadStatus,
  getLeadSources,
  getLeadSourceById,
  createLeadSource,
  updateLeadSource,
  deleteLeadSource,
  getLeadAssignmentHistory,
  getLeadTags,
  getLeadTagById,
  applyTagToLead,
  removeTagFromLead,
  getLeadTagsByLeadId,
  getLeadDetails,
  getLeadHistory,
  getLeadFollowUps,
  createFollowUp,
  getAllFollowUps,
  getFollowUpById,
  updateFollowUp,
  deleteFollowUp,
  markFollowUpComplete,
  updateLeadFollowUp,
  deleteLeadFollowUp
};
