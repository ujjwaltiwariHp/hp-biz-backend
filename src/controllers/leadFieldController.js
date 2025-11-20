const LeadField = require("../models/leadFieldDefinitionModel");
const { successResponse } = require("../utils/responseFormatter");
const { errorResponse } = require("../utils/errorResponse");

const getCompanyFields = async (req, res) => {
  try {
    const companyId = req.company.id;
    const fields = await LeadField.getCompanyFieldDefinitions(companyId);

    return successResponse(res, "Custom fields retrieved successfully", fields, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};


const createField = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { field_label, field_type } = req.body;

    if (!field_label || !field_type) {
      return errorResponse(res, 400, "Field label and type are required");
    }

    const newField = await LeadField.createFieldDefinition(companyId, req.body);

    return successResponse(res, "Custom field created successfully", newField, 201, req);
  } catch (err) {
    // Handle specific error for subscription limits
    if (err.message.includes("Limit reached")) {
        return errorResponse(res, 403, err.message);
    }
    if (err.message.includes("unique constraint")) {
        return errorResponse(res, 409, "A field with this name already exists.");
    }
    return errorResponse(res, 500, err.message);
  }
};

// Accessible by: Admin Only
const updateField = async (req, res) => {
  try {
    const companyId = req.company.id;
    const fieldId = req.params.id;

    const updatedField = await LeadField.updateFieldDefinition(fieldId, companyId, req.body);

    if (!updatedField) {
        return errorResponse(res, 404, "Field not found or unauthorized");
    }

    return successResponse(res, "Custom field updated successfully", updatedField, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

const deleteField = async (req, res) => {
  try {
    const companyId = req.company.id;
    const fieldId = req.params.id;

    const deleted = await LeadField.deleteFieldDefinition(fieldId, companyId);

    if (!deleted) {
        return errorResponse(res, 404, "Field not found or unauthorized");
    }

    return successResponse(res, "Custom field deleted successfully", {}, 200, req);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

module.exports = {
  getCompanyFields,
  createField,
  updateField,
  deleteField
};