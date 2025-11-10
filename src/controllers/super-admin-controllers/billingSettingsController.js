const { getSettings, updateSettings } = require('../../models/super-admin-models/billingSettingsModel');
const { successResponse } = require('../../utils/successResponse');
const { errorResponse } = require('../../utils/errorResponse');

const getBillingSettings = async (req, res) => {
  try {
    const settings = await getSettings();

    if (!settings) {
      return errorResponse(res, 404, "Billing settings configuration not found");
    }

    return successResponse(res, "Billing settings retrieved successfully", { settings });
  } catch (error) {
    console.error("Billing Settings API Error:", error);
    return errorResponse(res, 500, "Failed to retrieve billing settings");
  }
}

const updateBillingSettings = async (req, res) => {
  try {
    const updateData = req.body;

    // --- UNIFIED LOGIC: Handles file from 'multipart/form-data' ---
    if (req.file) {
      // If a new file was uploaded, construct the public URL path
      const publicPath = `/uploads/qr_codes/${req.file.filename}`;
      updateData.qr_code_image_url = publicPath;
    }
    // The database model automatically ignores any fields not in its schema.

    const updatedSettings = await updateSettings(updateData);

    if (!updatedSettings) {
      return errorResponse(res, 500, "Failed to update billing settings");
    }

    return successResponse(res, "Billing settings updated successfully", { settings: updatedSettings });
  } catch (error) {
    return errorResponse(res, 500, "Failed to update billing settings. Please check your input format (e.g., tax rate as decimal)");
  }
};

module.exports = {
  getBillingSettings,
  updateBillingSettings
};