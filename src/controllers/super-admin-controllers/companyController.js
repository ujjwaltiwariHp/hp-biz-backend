const {
  getAllCompanies,
  getCompanyById,
  activateCompany,
  deactivateCompany,
  updateCompanySubscription,
  deleteCompany,
  getCompanyStats,
  getDashboardStats,
  getCompanyUsageReport
} = require('../../models/super-admin-models/companyModel');
const { successResponse } = require('../../utils/successResponse');
const { errorResponse } = require('../../utils/errorResponse');

const getCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const companies = await getAllCompanies(parseInt(limit), offset, search, status);

    if (companies.length === 0) {
      return successResponse(res, "No companies found", {
        companies: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalCount: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    const totalCount = companies[0]?.total_count || 0;
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    const companiesData = companies.map(company => {
      const { total_count, ...companyData } = company;
      return companyData;
    });

    return successResponse(res, "Companies retrieved successfully", {
      companies: companiesData,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount: parseInt(totalCount),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve companies");
  }
};

const getCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "Invalid company ID provided");
    }

    const company = await getCompanyById(id);

    if (!company) {
      return errorResponse(res, 404, "Company not found");
    }

    const stats = await getCompanyStats(id);

    return successResponse(res, "Company retrieved successfully", {
      company,
      stats
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve company");
  }
};

const activateCompanyAccount = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "Invalid company ID provided");
    }

    const company = await getCompanyById(id);
    if (!company) {
      return errorResponse(res, 404, "Company not found");
    }

    if (company.is_active) {
      return errorResponse(res, 400, "Company is already active");
    }

    const updatedCompany = await activateCompany(id);

    if (!updatedCompany) {
      return errorResponse(res, 500, "Failed to activate company");
    }

    return successResponse(res, "Company activated successfully", {
      company: updatedCompany
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to activate company");
  }
};

const deactivateCompanyAccount = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "Invalid company ID provided");
    }

    const company = await getCompanyById(id);
    if (!company) {
      return errorResponse(res, 404, "Company not found");
    }

    if (!company.is_active) {
      return errorResponse(res, 400, "Company is already inactive");
    }

    const updatedCompany = await deactivateCompany(id);

    if (!updatedCompany) {
      return errorResponse(res, 500, "Failed to deactivate company");
    }

    return successResponse(res, "Company deactivated successfully", {
      company: updatedCompany
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to deactivate company");
  }
};

const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscription_package_id, subscription_start_date, subscription_end_date } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "Invalid company ID provided");
    }

    if (!subscription_package_id || !subscription_start_date || !subscription_end_date) {
      return errorResponse(res, 400, "Missing required subscription data");
    }

    const company = await getCompanyById(id);
    if (!company) {
      return errorResponse(res, 404, "Company not found");
    }

    const startDate = new Date(subscription_start_date);
    const endDate = new Date(subscription_end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return errorResponse(res, 400, "Invalid date format provided");
    }

    if (endDate <= startDate) {
      return errorResponse(res, 400, "Subscription end date must be after start date");
    }

    const updatedCompany = await updateCompanySubscription(id, {
      subscription_package_id,
      subscription_start_date,
      subscription_end_date
    });

    if (!updatedCompany) {
      return errorResponse(res, 500, "Failed to update subscription");
    }

    return successResponse(res, "Company subscription updated successfully", {
      company: updatedCompany
    });
  } catch (error) {
    if (error.message.includes('foreign key')) {
      return errorResponse(res, 400, "Invalid subscription package ID");
    }
    return errorResponse(res, 500, "Failed to update subscription");
  }
};

const removeCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 400, "Invalid company ID provided");
    }

    const company = await getCompanyById(id);
    if (!company) {
      return errorResponse(res, 404, "Company not found");
    }

    const deletedCompany = await deleteCompany(id);

    if (!deletedCompany) {
      return errorResponse(res, 500, "Failed to delete company");
    }

    return successResponse(res, "Company deleted successfully", {
      deletedCompany: {
        id: deletedCompany.id,
        company_name: deletedCompany.company_name,
        unique_company_id: deletedCompany.unique_company_id
      }
    });
  } catch (error) {
    if (error.message.includes('foreign key') || error.message.includes('constraint')) {
      return errorResponse(res, 400, "Cannot delete company. It has associated data that must be removed first");
    }
    return errorResponse(res, 500, "Failed to delete company");
  }
};

const getDashboard = async (req, res) => {
  try {
    const stats = await getDashboardStats();

    if (!stats) {
      return successResponse(res, "Dashboard stats retrieved successfully", {
        stats: {
          total_companies: 0,
          active_companies: 0,
          inactive_companies: 0,
          new_companies_this_month: 0
        }
      });
    }

    return successResponse(res, "Dashboard stats retrieved successfully", {
      stats
    });
  } catch (error) {
    return errorResponse(res, 500, "Failed to retrieve dashboard stats");
  }
};

const getUsageReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return errorResponse(res, 400, "Start date and end date are required");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return errorResponse(res, 400, "Invalid date format provided. Use ISO format (YYYY-MM-DD)");
    }

    const startCheck = start.toISOString().split('T')[0];
    const endCheck = end.toISOString().split('T')[0];

    if (startCheck !== startDate || endCheck !== endDate) {
      return errorResponse(res, 400, "Invalid date provided. Please check the date values (e.g., September has only 30 days)");
    }

    if (end <= start) {
      return errorResponse(res, 400, "End date must be after start date");
    }

    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (end - start > oneYear) {
      return errorResponse(res, 400, "Date range cannot exceed one year");
    }

    const report = await getCompanyUsageReport(startDate, endDate);

    if (!report || report.length === 0) {
      return successResponse(res, "No usage data found for the specified period", {
        report: [],
        period: {
          startDate,
          endDate
        },
        summary: {
          totalCompanies: 0,
          totalLeads: 0,
          totalActivities: 0
        }
      });
    }

    const summary = {
      totalCompanies: report.length,
      totalLeads: report.reduce((sum, company) => sum + company.leads_count, 0),
      totalActivities: report.reduce((sum, company) => sum + company.activities_count, 0)
    };

    return successResponse(res, "Usage report retrieved successfully", {
      report,
      period: {
        startDate,
        endDate
      },
      summary
    });
  } catch (error) {
    console.error('Usage report controller error:', error);
    return errorResponse(res, 500, "Failed to retrieve usage report");
  }
};

module.exports = {
  getCompanies,
  getCompany,
  activateCompanyAccount,
  deactivateCompanyAccount,
  updateSubscription,
  removeCompany,
  getDashboard,
  getUsageReport
};