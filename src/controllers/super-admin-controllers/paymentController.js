const {
  createPayment,
  getPayments,
  getPaymentById,
  updatePaymentStatus,
  deletePayment
} = require('../../models/super-admin-models/paymentModel');
const { generatePaymentNotifications } = require('../../models/super-admin-models/notificationModel');
const { successResponse } = require('../../utils/successResponse');
const { errorResponse } = require('../../utils/errorResponse');

const recordPayment = async (req, res) => {
  try {
    const paymentData = req.body;
    const newPayment = await createPayment(paymentData);

    try {
      await generatePaymentNotifications({
  company_id: newPayment.company_id,
  amount: newPayment.amount,
  payment_status: newPayment.status,
  payment_reference: newPayment.transaction_id
});
    } catch (notificationError) {
      console.error('Failed to generate payment notification:', notificationError);
    }

    return successResponse(res, "Payment recorded successfully", {
      payment: newPayment
    }, 201);
  } catch (error) {
    if (error.message.includes('foreign key')) {
      return errorResponse(res, 400, "Invalid Company ID or Invoice ID");
    }
    return errorResponse(res, 500, "Failed to record payment");
  }
};

const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, company_id, status, startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const payments = await getPayments(
      parseInt(limit),
      offset,
      company_id,
      status,
      startDate,
      endDate
    );

    if (payments.length === 0) {
      return successResponse(res, "No payments found", {
        payments: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalCount: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    const totalCount = payments[0]?.total_count || 0;
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    const paymentsData = payments.map(payment => {
      const { total_count, ...paymentData } = payment;
      return paymentData;
    });

    return successResponse(res, "Payments retrieved successfully", {
      payments: paymentsData,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount: parseInt(totalCount),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve payments");
  }
};

const getPaymentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await getPaymentById(id);

    if (!payment) {
      return errorResponse(res, 404, "Payment not found");
    }

    return successResponse(res, "Payment details retrieved successfully", {
      payment
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve payment details");
  }
};

const modifyPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const existingPayment = await getPaymentById(id);
    if (!existingPayment) {
      return errorResponse(res, 404, "Payment not found");
    }

    const updatedPayment = await updatePaymentStatus(id, status);

    if (!updatedPayment) {
      return errorResponse(res, 500, "Failed to update payment status");
    }

    return successResponse(res, "Payment status updated successfully", {
      payment: updatedPayment
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to update payment status");
  }
};

const voidPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const existingPayment = await getPaymentById(id);
    if (!existingPayment) {
      return errorResponse(res, 404, "Payment not found");
    }

    const deletedPayment = await deletePayment(id);

    if (!deletedPayment) {
      return errorResponse(res, 500, "Failed to delete payment");
    }

    return successResponse(res, "Payment voided successfully", {
      voidedPayment: {
        id: deletedPayment.id,
        company_id: deletedPayment.company_id,
        amount: deletedPayment.amount,
        transaction_id: deletedPayment.transaction_id
      }
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to delete payment");
  }
};

module.exports = {
  recordPayment,
  getAllPayments,
  getPaymentDetails,
  modifyPaymentStatus,
  voidPayment
};
