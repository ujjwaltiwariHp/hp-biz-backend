const {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  togglePackageStatus,
  checkPackageExists,
  getActivePackages,
  countActiveCompaniesByPackage
} = require('../../models/super-admin-models/subscriptionModel');
const { successResponse } = require('../../utils/successResponse');
const { errorResponse } = require('../../utils/errorResponse');

const getPackages = async (req, res) => {
  try {
    const { active_only } = req.query;

    let packages;
    if (active_only === 'true') {
      packages = await getActivePackages();
    } else {
      packages = await getAllPackages();
    }

    return successResponse(res, "Subscription packages retrieved successfully", {
      packages
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve subscription packages");
  }
};

const getPackage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "Invalid package ID provided");
    }

    const packageData = await getPackageById(id);
    if (!packageData) {
      return errorResponse(res, 404, "Subscription package not found");
    }

    return successResponse(res, "Subscription package retrieved successfully", {
      package: packageData
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve subscription package");
  }
};

const createSubscriptionPackage = async (req, res) => {
  try {
    const { name, duration_type, price, features, max_staff_count, max_leads_per_month, is_trial, trial_duration_days, max_custom_fields } = req.body;

    const packageExists = await checkPackageExists(name);
    if (packageExists) {
      return errorResponse(res, 400, "Package with this name already exists");
    }

    if (parseFloat(price) < 0) {
      return errorResponse(res, 400, "Price cannot be negative");
    }

    if (parseInt(max_staff_count) < 0 || parseInt(max_leads_per_month) < 0) {
      return errorResponse(res, 400, "Staff count and leads count cannot be negative");
    }

    if (is_trial && (!trial_duration_days || parseInt(trial_duration_days) <= 0)) {
        return errorResponse(res, 400, "Trial duration days must be a positive integer when is_trial is true");
    }

    const packageData = await createPackage({
      name,
      duration_type,
      price,
      features: features || [],
      max_staff_count,
      max_leads_per_month,
      is_trial: is_trial || false,
      trial_duration_days: trial_duration_days || 0,
      max_custom_fields: max_custom_fields || 0
    });

    return successResponse(res, "Subscription package created successfully", {
      package: packageData
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to create subscription package");
  }
};

const updateSubscriptionPackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, duration_type, price, features, max_staff_count, max_leads_per_month, is_trial, trial_duration_days, is_active, max_custom_fields } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "Invalid package ID provided");
    }

    const existingPackage = await getPackageById(id);
    if (!existingPackage) {
      return errorResponse(res, 404, "Subscription package not found");
    }

    const packageExists = await checkPackageExists(name, id);
    if (packageExists) {
      return errorResponse(res, 400, "Package with this name already exists");
    }

    const updateData = {
        name,
        duration_type,
        price,
        features: features || [],
        max_staff_count,
        max_leads_per_month,
        is_trial: is_trial !== undefined ? is_trial : existingPackage.is_trial,
        trial_duration_days: trial_duration_days !== undefined ? trial_duration_days : existingPackage.trial_duration_days,
        is_active,
        max_custom_fields
    };

    if (updateData.is_trial && (!updateData.trial_duration_days || parseInt(updateData.trial_duration_days) <= 0)) {
        return errorResponse(res, 400, "Trial duration days must be a positive integer when is_trial is true");
    }

    if (parseFloat(updateData.price) < 0 || parseInt(updateData.max_staff_count) < 0 || parseInt(updateData.max_leads_per_month) < 0) {
      return errorResponse(res, 400, "Price, staff count, and leads count cannot be negative");
    }

    const updatedPackage = await updatePackage(id, updateData);

    if (!updatedPackage) {
      return errorResponse(res, 500, "Failed to update subscription package");
    }

    return successResponse(res, "Subscription package updated successfully", {
      package: updatedPackage
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to update subscription package");
  }
};

const removePackage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "Invalid package ID provided");
    }

    const existingPackage = await getPackageById(id);
    if (!existingPackage) {
      return errorResponse(res, 404, "Subscription package not found");
    }

    if (existingPackage.company_count > 0) {
      return errorResponse(res, 400, "Cannot delete package that is assigned to companies");
    }

    const deletedPackage = await deletePackage(id);

    if (!deletedPackage) {
      return errorResponse(res, 500, "Failed to delete subscription package");
    }

    return successResponse(res, "Subscription package deleted successfully", {
      deletedPackage: {
        id: deletedPackage.id,
        name: deletedPackage.name,
        price: deletedPackage.price
      }
    });
  } catch (error) {
    if (error.message.includes('foreign key') || error.message.includes('constraint')) {
      return errorResponse(res, 400, "Cannot delete package that is assigned to companies");
    }
    return errorResponse(res, 500, "Failed to delete subscription package");
  }
};

const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "Invalid package ID provided");
    }

    const existingPackage = await getPackageById(id);
    if (!existingPackage) {
      return errorResponse(res, 404, "Subscription package not found");
    }

    if (existingPackage.is_active) {
        const activeCompanyCount = await countActiveCompaniesByPackage(id);
        if (activeCompanyCount > 0) {
            return errorResponse(res, 400, `Cannot deactivate package. ${activeCompanyCount} active companies are currently subscribed to it.`);
        }
    }

    const updatedPackage = await togglePackageStatus(id);

    if (!updatedPackage) {
      return errorResponse(res, 500, "Failed to update package status");
    }

    const statusText = updatedPackage.is_active ? 'activated' : 'deactivated';

    return successResponse(res, `Subscription package ${statusText} successfully`, {
      package: updatedPackage
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to toggle package status");
  }
};

module.exports = {
  getPackages,
  getPackage,
  createSubscriptionPackage,
  updateSubscriptionPackage,
  removePackage,
  toggleStatus
};