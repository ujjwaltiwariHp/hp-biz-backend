const {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  togglePackageStatus,
  checkPackageExists,
  getActivePackages
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
    const { name, duration_type, price, features, max_staff_count, max_leads_per_month } = req.body;

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

    const packageData = await createPackage({
      name,
      duration_type,
      price,
      features: features || [],
      max_staff_count,
      max_leads_per_month
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
    const { name, duration_type, price, features, max_staff_count, max_leads_per_month } = req.body;

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

    if (parseFloat(price) < 0) {
      return errorResponse(res, 400, "Price cannot be negative");
    }

    if (parseInt(max_staff_count) < 0 || parseInt(max_leads_per_month) < 0) {
      return errorResponse(res, 400, "Staff count and leads count cannot be negative");
    }

    const updatedPackage = await updatePackage(id, {
      name,
      duration_type,
      price,
      features: features || [],
      max_staff_count,
      max_leads_per_month
    });

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