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
    // TEMPORARY DEBUG: Log the specific error message
    console.error("Billing Settings API Error:", error);
    return errorResponse(res, 500, "Failed to retrieve billing settings");
  }
}

const updateBillingSettings = async (req, res) => {
  try {
    const updatedSettings = await updateSettings(req.body);

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