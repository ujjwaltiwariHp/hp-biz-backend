const Notifications = require("../models/notificationsModel");
const { createNotification: createSuperAdminNotification } = require('../models/super-admin-models/notificationModel');
const { sendNotificationEmail, sendAdminNotificationEmail, sendSubscriptionActivationEmail } = require("./emailService");
const pool = require("../config/database");
const admin = require('../config/firebase');
const { getTokensByUserIds, deleteDeviceToken } = require('../models/deviceTokenModel');

const sendPushNotification = async (userIds, payload, userType = 'staff') => {
  if (!userIds || (Array.isArray(userIds) && userIds.length === 0)) return;

  const targetIds = Array.isArray(userIds) ? userIds : [userIds];

  try {
    const tokens = await getTokensByUserIds(targetIds, userType);

    if (tokens.length === 0) {
      console.log(`No devices found for User IDs: ${targetIds}`);
      return;
    }

    console.log(`Attempting to send Push to ${tokens.length} devices...`);

    const message = {
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: {
        ...payload.data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: 'high'
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      },
      tokens: tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log('Firebase Response:', JSON.stringify(response.responses));

    if (response.failureCount > 0) {
      console.log(`Failed to send to ${response.failureCount} devices.`);
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorInfo = resp.error;
          console.log('FCM Send Error:', errorInfo);
          if (errorInfo.code === 'messaging/registration-token-not-registered' ||
            errorInfo.code === 'messaging/invalid-argument') {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        await Promise.all(failedTokens.map(token => deleteDeviceToken(token)));
      }
    }
  } catch (error) {
    console.error('Push Notification System Error:', error);
  }
};

const createLeadStatusChangeNotification = async (leadId, oldStatus, newStatus, changedBy, companyId) => {
  try {
    const leadResult = await pool.query(
      `SELECT l.first_name, l.last_name, l.assigned_to, s.first_name as staff_first_name, s.last_name as staff_last_name
       FROM leads l
       LEFT JOIN staff s ON l.assigned_to = s.id
       WHERE l.id = $1 AND l.company_id = $2`,
      [leadId, companyId]
    );

    if (leadResult.rows.length === 0) return;

    const lead = leadResult.rows[0];

    const changedByResult = await pool.query(
      `SELECT first_name, last_name FROM staff WHERE id = $1 AND company_id = $2`,
      [changedBy, companyId]
    );

    const changedByName = changedByResult.rows.length > 0
      ? `${changedByResult.rows[0].first_name} ${changedByResult.rows[0].last_name}`
      : 'Someone';

    const notifications = [];

    if (lead.assigned_to && lead.assigned_to !== changedBy) {
      notifications.push({
        company_id: companyId,
        staff_id: lead.assigned_to,
        title: "Lead Status Updated",
        message: `Status of lead ${lead.first_name} ${lead.last_name} changed from "${oldStatus}" to "${newStatus}" by ${changedByName}`,
        type: "status_change",
        related_lead_id: leadId,
        priority: "normal"
      });
    }

    if (notifications.length > 0) {
      await Notifications.createBulkNotifications(notifications);

      await Promise.all(notifications.map(notification =>
        sendPushNotification(notification.staff_id, {
          title: notification.title,
          body: notification.message,
          data: {
            leadId: String(leadId),
            type: 'status_change',
            companyId: String(companyId)
          }
        })
      ));
    }
  } catch (error) {
    console.error('Error creating status change notification:', error);
  }
};

const createLeadAssignmentNotification = async (leadId, assignedTo, assignedBy, companyId) => {
  try {
    const leadResult = await pool.query(
      `SELECT l.first_name, l.last_name
       FROM leads l
       WHERE l.id = $1 AND l.company_id = $2`,
      [leadId, companyId]
    );

    if (leadResult.rows.length === 0) return;

    const lead = leadResult.rows[0];

    const assignedStaffResult = await pool.query(
      `SELECT first_name, last_name FROM staff WHERE id = $1 AND company_id = $2`,
      [assignedTo, companyId]
    );

    const assignedByResult = await pool.query(
      `SELECT first_name, last_name FROM staff WHERE id = $1 AND company_id = $2`,
      [assignedBy, companyId]
    );

    if (assignedStaffResult.rows.length === 0) return;

    const assignedByName = assignedByResult.rows.length > 0
      ? `${assignedByResult.rows[0].first_name} ${assignedByResult.rows[0].last_name}`
      : 'Admin';

    const notifications = [];

    if (assignedTo !== assignedBy) {
      notifications.push({
        company_id: companyId,
        staff_id: assignedTo,
        title: "New Lead Assigned",
        message: `You have been assigned a new lead: ${lead.first_name} ${lead.last_name} by ${assignedByName}`,
        type: "lead_assignment",
        related_lead_id: leadId,
        priority: "high"
      });
    }

    if (notifications.length > 0) {
      await Notifications.createBulkNotifications(notifications);

      await Promise.all(notifications.map(notification =>
        sendPushNotification(notification.staff_id, {
          title: notification.title,
          body: notification.message,
          data: {
            leadId: String(leadId),
            type: 'lead_assignment',
            companyId: String(companyId)
          }
        })
      ));
    }
  } catch (error) {
    console.error('Error creating assignment notification:', error);
  }
};

const createBulkAssignmentNotification = async (leadIds, assignedTo, assignedBy, companyId) => {
  try {
    if (!leadIds || leadIds.length === 0) return;

    const leadsResult = await pool.query(
      `SELECT COUNT(*) as count FROM leads WHERE id = ANY($1) AND company_id = $2`,
      [leadIds, companyId]
    );

    const leadCount = parseInt(leadsResult.rows[0].count);
    if (leadCount === 0) return;

    const assignedStaffResult = await pool.query(
      `SELECT first_name, last_name FROM staff WHERE id = $1 AND company_id = $2`,
      [assignedTo, companyId]
    );

    const assignedByResult = await pool.query(
      `SELECT first_name, last_name FROM staff WHERE id = $1 AND company_id = $2`,
      [assignedBy, companyId]
    );

    if (assignedStaffResult.rows.length === 0) return;

    const assignedByName = assignedByResult.rows.length > 0
      ? `${assignedByResult.rows[0].first_name} ${assignedByResult.rows[0].last_name}`
      : 'Admin';

    const notifications = [];

    if (assignedTo !== assignedBy) {
      notifications.push({
        company_id: companyId,
        staff_id: assignedTo,
        title: "Multiple Leads Assigned",
        message: `You have been assigned ${leadCount} new leads by ${assignedByName}`,
        type: "bulk_assignment",
        related_lead_id: null,
        priority: "high"
      });
    }

    if (notifications.length > 0) {
      await Notifications.createBulkNotifications(notifications);

      await Promise.all(notifications.map(notification =>
        sendPushNotification(notification.staff_id, {
          title: notification.title,
          body: notification.message,
          data: {
            type: 'bulk_assignment',
            count: String(leadCount),
            companyId: String(companyId)
          }
        })
      ));
    }
  } catch (error) {
    console.error('Error creating bulk assignment notification:', error);
  }
};

const createCustomNotification = async (companyId, staffIdOrType, title, message, type = 'general', priority = 'normal', relatedLeadId = null) => {
  try {
    let targetStaffIds = [];

    if (staffIdOrType === 'admin') {
      const adminResult = await pool.query(
        `SELECT s.id FROM staff s
         INNER JOIN companies c ON s.company_id = c.id
         WHERE c.id = $1 AND s.email = c.admin_email`,
        [companyId]
      );
      if (adminResult.rows.length > 0) {
        targetStaffIds.push(adminResult.rows[0].id);
      }
    } else if (Array.isArray(staffIdOrType)) {
      targetStaffIds = staffIdOrType;
    } else {
      targetStaffIds = [staffIdOrType];
    }

    await Promise.all(targetStaffIds.map(async (staffId) => {
      await Notifications.createNotification({
        company_id: companyId,
        staff_id: staffId,
        title,
        message,
        type,
        related_lead_id: relatedLeadId,
        priority
      });

      await sendPushNotification(staffId, {
        title: title,
        body: message,
        data: {
          type: type,
          leadId: relatedLeadId ? String(relatedLeadId) : '',
          companyId: String(companyId)
        }
      });
    }));

  } catch (error) {
    console.error('Error creating custom notification:', error);
  }
};

const createLeadActivityNotification = async (leadId, activityType, staffId, companyId) => {
  try {
    const leadResult = await pool.query(
      `SELECT l.first_name, l.last_name, l.assigned_to
       FROM leads l
       WHERE l.id = $1 AND l.company_id = $2`,
      [leadId, companyId]
    );

    if (leadResult.rows.length === 0) return;

    const lead = leadResult.rows[0];

    const staffResult = await pool.query(
      `SELECT first_name, last_name FROM staff WHERE id = $1`,
      [staffId]
    );

    if (staffResult.rows.length === 0) return;

    const staffName = `${staffResult.rows[0].first_name} ${staffResult.rows[0].last_name}`;

    const activityMessages = {
      'call': `${staffName} made a call to lead ${lead.first_name} ${lead.last_name}`,
      'email': `${staffName} sent an email to lead ${lead.first_name} ${lead.last_name}`,
      'meeting': `${staffName} scheduled a meeting with lead ${lead.first_name} ${lead.last_name}`,
      'note': `${staffName} added a note to lead ${lead.first_name} ${lead.last_name}`,
      'status_change': `${staffName} changed the status of lead ${lead.first_name} ${lead.last_name}`,
      'update': `${staffName} updated information for lead ${lead.first_name} ${lead.last_name}`,
      'deletion': `${staffName} deleted lead ${lead.first_name} ${lead.last_name}`
    };

    const message = activityMessages[activityType] ||
      `${staffName} performed an activity (${activityType}) on lead ${lead.first_name} ${lead.last_name}`;

    const notifications = [];

    if (lead.assigned_to && lead.assigned_to !== staffId) {
      notifications.push({
        company_id: companyId,
        staff_id: lead.assigned_to,
        title: "Lead Activity",
        message,
        type: "lead_activity",
        related_lead_id: leadId,
        priority: "low"
      });
    }

    if (notifications.length > 0) {
      await Notifications.createBulkNotifications(notifications);

      await Promise.all(notifications.map(notification =>
        sendPushNotification(notification.staff_id, companyId, {
          title: notification.title,
          body: notification.message,
          data: {
            leadId: String(leadId),
            type: 'lead_activity',
            companyId: String(companyId)
          }
        })
      ));
    }
  } catch (error) {
    console.error('Error creating activity notification:', error);
  }
};

const createLeadCreationNotification = async (leadId, createdBy, companyId) => {
  try {
    const leadResult = await pool.query(
      `SELECT l.first_name, l.last_name, l.assigned_to
       FROM leads l
       WHERE l.id = $1 AND l.company_id = $2`,
      [leadId, companyId]
    );

    if (leadResult.rows.length === 0) return;

    const lead = leadResult.rows[0];

    const creatorResult = await pool.query(
      `SELECT first_name, last_name FROM staff WHERE id = $1`,
      [createdBy]
    );

    if (creatorResult.rows.length === 0) return;

    const creatorName = `${creatorResult.rows[0].first_name} ${creatorResult.rows[0].last_name}`;
    const companyResult = await pool.query(
      `SELECT admin_email, company_name FROM companies WHERE id = $1`,
      [companyId]
    );

    if (companyResult.rows.length > 0) {
      const companyEmail = companyResult.rows[0].admin_email;
      const adminResult = await pool.query(
        `SELECT s.id FROM staff s
         INNER JOIN companies c ON s.company_id = c.id
         WHERE c.id = $1 AND s.email = c.admin_email`,
        [companyId]
      );

      if (adminResult.rows.length > 0 && adminResult.rows[0].id !== createdBy) {
        await Notifications.createNotification({
          company_id: companyId,
          staff_id: adminResult.rows[0].id,
          title: "New Lead Created",
          message: `${creatorName} created a new lead: ${lead.first_name} ${lead.last_name}`,
          type: "lead_creation",
          related_lead_id: leadId,
          priority: "normal"
        });

        await sendPushNotification(adminResult.rows[0].id, {
          title: "New Lead Created",
          body: `${creatorName} created a new lead: ${lead.first_name} ${lead.last_name}`,
          data: {
            leadId: String(leadId),
            type: 'lead_creation',
            companyId: String(companyId)
          }
        });
      }
    }
  } catch (error) {
    console.error('Error creating lead creation notification:', error);
  }
};

const createLeadUpdateNotification = async (leadId, updatedBy, companyId, updateDescription) => {
  try {
    const leadResult = await pool.query(
      `SELECT l.first_name, l.last_name, l.assigned_to
       FROM leads l
       WHERE l.id = $1 AND l.company_id = $2`,
      [leadId, companyId]
    );

    if (leadResult.rows.length === 0) return;

    const lead = leadResult.rows[0];

    const updaterResult = await pool.query(
      `SELECT first_name, last_name FROM staff WHERE id = $1`,
      [updatedBy]
    );

    if (updaterResult.rows.length === 0) return;

    const updaterName = `${updaterResult.rows[0].first_name} ${updaterResult.rows[0].last_name}`;

    const notifications = [];

    if (lead.assigned_to && lead.assigned_to !== updatedBy) {
      notifications.push({
        company_id: companyId,
        staff_id: lead.assigned_to,
        title: "Lead Updated",
        message: `${updaterName} updated lead ${lead.first_name} ${lead.last_name}: ${updateDescription}`,
        type: "lead_update",
        related_lead_id: leadId,
        priority: "low"
      });
    }

    if (notifications.length > 0) {
      await Notifications.createBulkNotifications(notifications);

      await Promise.all(notifications.map(notification =>
        sendPushNotification(notification.staff_id, {
          title: notification.title,
          body: notification.message,
          data: {
            leadId: String(leadId),
            type: 'lead_update',
            companyId: String(companyId)
          }
        })
      ));
    }
  } catch (error) {
    console.error('Error creating lead update notification:', error);
  }
};

const createSubscriptionActivationNotification = async (companyData, packageData, endDate, superAdminName, invoiceData, pdfBuffer) => {
  try {
    const { id: companyId, company_name } = companyData;
    const packageName = packageData.name;
    const formattedEndDate = new Date(endDate).toLocaleDateString();

    await sendSubscriptionActivationEmail(companyData, packageData, endDate, invoiceData, pdfBuffer);

    const notificationMessage = `Subscription activated for ${company_name} on ${packageName} plan until ${formattedEndDate}. Approved by ${superAdminName}.`;

    await createSuperAdminNotification({
      company_id: companyId,
      super_admin_id: null,
      title: "Subscription Activated",
      message: notificationMessage,
      notification_type: "subscription_activated",
      priority: "high",
      metadata: {
        package_name: packageName,
        end_date: endDate,
        approved_by: superAdminName,
        invoice_number: invoiceData.invoice_number
      }
    });

  } catch (error) {
    console.error('Error creating subscription activation notification:', error);
  }
};

const createPaymentReceivedNotification = async (companyData, invoiceData, verifiedBySuperAdminId) => {
  try {
    const { id: companyId, company_name } = companyData;
    const { id: invoiceId, invoice_number, total_amount, currency } = invoiceData;

    const message = `Payment of ${currency} ${total_amount} received for ${company_name} (Invoice #${invoice_number}). Verified by SA:${verifiedBySuperAdminId}. Awaiting Final Approval.`;

    await createSuperAdminNotification({
      company_id: companyId,
      super_admin_id: null,
      title: "Payment Verified - Approval Needed",
      message: message,
      notification_type: "payment_received",
      priority: "high",
      metadata: {
        action_required: "approve_subscription",
        company_id: companyId,
        invoice_id: invoiceId,
        invoice_number: invoice_number,
        amount: total_amount
      }
    });

  } catch (error) {
    console.error('Error creating payment received notification:', error);
  }
};

const createFollowUpNotification = async (leadId, assignedTo, createdBy, companyId, reminderTime) => {
  try {
    const leadResult = await pool.query(
      `SELECT l.first_name, l.last_name FROM leads l WHERE l.id = $1 AND l.company_id = $2`,
      [leadId, companyId]
    );

    if (leadResult.rows.length === 0) return;
    const lead = leadResult.rows[0];

    const leadName = `${lead.first_name} ${lead.last_name}`;
    const message = `New follow-up set for lead: ${leadName}`;

    await Notifications.createNotification({
      company_id: companyId,
      staff_id: assignedTo,
      title: "Follow-up Set",
      message: message,
      type: "follow_up_set",
      related_lead_id: leadId,
      priority: "normal"
    });

    await sendPushNotification(assignedTo, {
      title: "Follow-up Set",
      body: message,
      data: {
        leadId: String(leadId),
        type: 'follow_up',
        companyId: String(companyId)
      }
    });

  } catch (error) {
    console.error('Error creating follow-up notification:', error);
  }
};

const createBulkTransferNotification = async (leadIdsOrCount, assignedTo, assignedBy, companyId, assignedByType = 'staff') => {
  try {
    let count = 0;
    let ids = [];

    if (Array.isArray(leadIdsOrCount)) {
      count = leadIdsOrCount.length;
      ids = leadIdsOrCount;
    } else {
      count = leadIdsOrCount;
    }

    if (count === 0) return;

    let senderName = 'System';
    if (assignedByType === 'staff') {
      const assignedByResult = await pool.query(
        `SELECT first_name, last_name FROM staff WHERE id = $1`,
        [assignedBy]
      );
      senderName = assignedByResult.rows[0]
        ? `${assignedByResult.rows[0].first_name} ${assignedByResult.rows[0].last_name}`
        : 'Colleague';
    } else {
      const companyResult = await pool.query(
        `SELECT admin_name FROM companies WHERE id = $1`,
        [assignedBy]
      );
      senderName = companyResult.rows[0] ? `${companyResult.rows[0].admin_name} (Admin)` : 'Company Admin';
    }

    //  If count > 3, send ONE summary. Else, send individual notifications.
    if (count > 3) {
      const title = "Bulk Leads Received";
      const message = `You have received ${count} new leads transferred from ${senderName}.`;

      await Notifications.createNotification({
        company_id: companyId,
        staff_id: assignedTo,
        title,
        message,
        type: 'bulk_assignment',
        related_lead_id: ids.length > 0 ? ids[0] : null, // Link the first lead for reference
        priority: "high"
      });

      await sendPushNotification(assignedTo, {
        title,
        body: message,
        data: {
          type: 'bulk_assignment',
          count: String(count),
          companyId: String(companyId)
        }
      });

    } else {
      if (ids.length > 0) {
        for (const leadId of ids) {
          const leadResult = await pool.query(`SELECT first_name, last_name FROM leads WHERE id = $1`, [leadId]);
          const leadName = leadResult.rows[0] ? `${leadResult.rows[0].first_name} ${leadResult.rows[0].last_name}` : 'Lead';

          const title = "Lead Transferred";
          const message = `${senderName} has transferred lead "${leadName}" to you.`;

          await Notifications.createNotification({
            company_id: companyId,
            staff_id: assignedTo,
            title,
            message,
            type: 'lead_assignment',
            related_lead_id: leadId,
            priority: "high"
          });

          await sendPushNotification(assignedTo, {
            title,
            body: message,
            data: {
              type: 'lead_assignment',
              leadId: String(leadId),
              companyId: String(companyId)
            }
          });
        }
      } else {
        const title = "Leads Received";
        const message = `You have received ${count} new lead(s) from ${senderName}.`;
        await sendPushNotification(assignedTo, { title, body: message, data: { type: 'bulk_assignment', companyId: String(companyId) } });
      }
    }

  } catch (error) {
    console.error('Error creating transfer notification:', error);
  }
};



const createUpgradeRequestNotification = async (companyId, companyName, invoiceData, packageName, durationType) => {
  try {
    const { id: invoiceId, invoice_number, total_amount, currency } = invoiceData;

    const message = `Upgrade requested by ${companyName} to ${packageName} (${durationType}). Invoice #${invoice_number} generated for ${currency} ${total_amount}. Awaiting Payment.`;

    await createSuperAdminNotification({
      company_id: companyId,
      super_admin_id: null,
      title: "Subscription Upgrade Requested",
      message: message,
      notification_type: "upgrade_requested",
      priority: "high",
      metadata: {
        action_required: "verify_payment",
        company_id: companyId,
        invoice_id: invoiceId,
        invoice_number: invoice_number,
        amount: total_amount,
        package_name: packageName
      }
    });

  } catch (error) {
    console.error('Error creating upgrade request notification:', error);
  }
};

module.exports = {
  createUpgradeRequestNotification,
  createLeadStatusChangeNotification,
  createLeadAssignmentNotification,
  createBulkAssignmentNotification,
  createCustomNotification,
  createLeadActivityNotification,
  createLeadCreationNotification,
  createLeadUpdateNotification,
  createSubscriptionActivationNotification,
  createPaymentReceivedNotification,
  createFollowUpNotification,
  createBulkTransferNotification,
  sendPushNotification
};