const express = require('express');
const router = express.Router();

const {
  getCompanies,
  getCompany,
  activateCompanyAccount,
  deactivateCompanyAccount,
  updateSubscription,
  removeCompany,
  getDashboard,
  getUsageReport
} = require('../../controllers/super-admin-controllers/companyController');

const {
  validateCompanyId,
  validateCompanyQuery,
  validateSubscriptionUpdate,
  validateUsageReport
} = require('../../middleware/super-admin-middleware/companyValidation');

const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');

router.use(authenticateSuperAdmin);

/**
 * @swagger
 * components:
 *   schemas:
 *     Company:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Company ID
 *         unique_company_id:
 *           type: string
 *           description: Unique company identifier
 *         company_name:
 *           type: string
 *           description: Company name
 *         admin_email:
 *           type: string
 *           description: Admin email address
 *         admin_name:
 *           type: string
 *           description: Admin name
 *         phone:
 *           type: string
 *           description: Company phone number
 *         address:
 *           type: string
 *           description: Company address
 *         website:
 *           type: string
 *           description: Company website
 *         industry:
 *           type: string
 *           description: Company industry
 *         company_size:
 *           type: string
 *           description: Company size
 *         subscription_start_date:
 *           type: string
 *           format: date-time
 *           description: Subscription start date
 *         subscription_end_date:
 *           type: string
 *           format: date-time
 *           description: Subscription end date
 *         is_active:
 *           type: boolean
 *           description: Company active status
 *         email_verified:
 *           type: boolean
 *           description: Email verification status
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         package_name:
 *           type: string
 *           description: Subscription package name
 *         package_price:
 *           type: number
 *           description: Package price
 *         duration_type:
 *           type: string
 *           description: Package duration type
 *
 *     CompanyStats:
 *       type: object
 *       properties:
 *         total_staff:
 *           type: integer
 *           description: Total staff count
 *         total_leads:
 *           type: integer
 *           description: Total leads count
 *         leads_this_month:
 *           type: integer
 *           description: Leads created this month
 *         total_activities:
 *           type: integer
 *           description: Total activities count
 *
 *     DashboardStats:
 *       type: object
 *       properties:
 *         total_companies:
 *           type: integer
 *           description: Total companies count
 *         active_companies:
 *           type: integer
 *           description: Active companies count
 *         inactive_companies:
 *           type: integer
 *           description: Inactive companies count
 *         new_companies_this_month:
 *           type: integer
 *           description: New companies this month
 *
 *     UsageReport:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Company ID
 *         company_name:
 *           type: string
 *           description: Company name
 *         unique_company_id:
 *           type: string
 *           description: Unique company identifier
 *         package_name:
 *           type: string
 *           description: Subscription package name
 *         staff_count:
 *           type: integer
 *           description: Staff count
 *         leads_count:
 *           type: integer
 *           description: Leads count in date range
 *         activities_count:
 *           type: integer
 *           description: Activities count in date range
 *
 *     SubscriptionUpdate:
 *       type: object
 *       required:
 *         - subscription_package_id
 *         - subscription_start_date
 *         - subscription_end_date
 *       properties:
 *         subscription_package_id:
 *           type: integer
 *           description: Subscription package ID
 *         subscription_start_date:
 *           type: string
 *           format: date
 *           description: Subscription start date (YYYY-MM-DD)
 *         subscription_end_date:
 *           type: string
 *           format: date
 *           description: Subscription end date (YYYY-MM-DD)
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/v1/super-admin/companies/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Super Admin - Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       $ref: '#/components/schemas/DashboardStats'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/dashboard', getDashboard);

/**
 * @swagger
 * /api/v1/super-admin/companies:
 *   get:
 *     summary: Get all companies with pagination and filters
 *     tags: [Super Admin - Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by company name, email, or ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by company status
 *     responses:
 *       200:
 *         description: Companies retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     companies:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Company'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalCount:
 *                           type: integer
 *                         hasNext:
 *                           type: boolean
 *                         hasPrev:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', validateCompanyQuery, getCompanies);

/**
 * @swagger
 * /api/v1/super-admin/companies/usage-report:
 *   get:
 *     summary: Get company usage report for a date range
 *     tags: [Super Admin - Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *         example: "2025-08-01"
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *         example: "2025-09-30"
 *     responses:
 *       200:
 *         description: Usage report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     report:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UsageReport'
 *                     period:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date
 *                         endDate:
 *                           type: string
 *                           format: date
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalCompanies:
 *                           type: integer
 *                         totalLeads:
 *                           type: integer
 *                         totalActivities:
 *                           type: integer
 *       400:
 *         description: Bad request - Invalid dates or missing parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/usage-report', validateUsageReport, getUsageReport);

/**
 * @swagger
 * /api/v1/super-admin/companies/{id}:
 *   get:
 *     summary: Get a specific company by ID
 *     tags: [Super Admin - Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Company retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     company:
 *                       $ref: '#/components/schemas/Company'
 *                     stats:
 *                       $ref: '#/components/schemas/CompanyStats'
 *       400:
 *         description: Invalid company ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', validateCompanyId, getCompany);

/**
 * @swagger
 * /api/v1/super-admin/companies/{id}/activate:
 *   put:
 *     summary: Activate a company account
 *     tags: [Super Admin - Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Company activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     company:
 *                       $ref: '#/components/schemas/Company'
 *       400:
 *         description: Invalid company ID or company already active
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id/activate', validateCompanyId, activateCompanyAccount);

/**
 * @swagger
 * /api/v1/super-admin/companies/{id}/deactivate:
 *   put:
 *     summary: Deactivate a company account
 *     tags: [Super Admin - Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Company deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     company:
 *                       $ref: '#/components/schemas/Company'
 *       400:
 *         description: Invalid company ID or company already inactive
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id/deactivate', validateCompanyId, deactivateCompanyAccount);

/**
 * @swagger
 * /api/v1/super-admin/companies/{id}/subscription:
 *   put:
 *     summary: Update company subscription
 *     tags: [Super Admin - Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscriptionUpdate'
 *     responses:
 *       200:
 *         description: Company subscription updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     company:
 *                       $ref: '#/components/schemas/Company'
 *       400:
 *         description: Invalid company ID, missing data, or invalid subscription package
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id/subscription', validateSubscriptionUpdate, updateSubscription);

/**
 * @swagger
 * /api/v1/super-admin/companies/{id}:
 *   delete:
 *     summary: Delete a company
 *     tags: [Super Admin - Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Company deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCompany:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         company_name:
 *                           type: string
 *                         unique_company_id:
 *                           type: string
 *       400:
 *         description: Invalid company ID or company has associated data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Company not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', validateCompanyId, removeCompany);

module.exports = router;