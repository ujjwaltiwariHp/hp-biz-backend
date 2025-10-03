const express = require('express');
const router = express.Router();

const {
  getPackages,
  getPackage,
  createSubscriptionPackage,
  updateSubscriptionPackage,
  removePackage,
  toggleStatus
} = require('../../controllers/super-admin-controllers/subscriptionController');

const {
  validatePackageId,
  validatePackageQuery,
  validatePackageCreation,
  validatePackageUpdate
} = require('../../middleware/super-admin-middleware/subscriptionValidation');

const { authenticateSuperAdmin } = require('../../middleware/super-admin-middleware/authMiddleware');

router.use(authenticateSuperAdmin);

/**
 * @swagger
 * tags:
 *   name: Super Admin - Subscriptions
 *   description: Subscription package management
 */

/**
 * @swagger
 * /super-admin/subscriptions:
 *   get:
 *     summary: Get all subscription packages
 *     tags: [Super Admin - Subscriptions]
 *     parameters:
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: boolean
 *         description: Filter only active packages
 *     responses:
 *       200:
 *         description: List of subscription packages
 */
router.get('/', validatePackageQuery, getPackages);

/**
 * @swagger
 * /super-admin/subscriptions/{id}:
 *   get:
 *     summary: Get a subscription package by ID
 *     tags: [Super Admin - Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Subscription package ID
 *     responses:
 *       200:
 *         description: Subscription package details
 */
router.get('/:id', validatePackageId, getPackage);

/**
 * @swagger
 * /super-admin/subscriptions:
 *   post:
 *     summary: Create a new subscription package
 *     tags: [Super Admin - Subscriptions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               duration_type:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               price:
 *                 type: number
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *               max_staff_count:
 *                 type: integer
 *               max_leads_per_month:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Subscription package created
 */
router.post('/', validatePackageCreation, createSubscriptionPackage);

/**
 * @swagger
 * /super-admin/subscriptions/{id}:
 *   put:
 *     summary: Update a subscription package
 *     tags: [Super Admin - Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               duration_type:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               price:
 *                 type: number
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *               max_staff_count:
 *                 type: integer
 *               max_leads_per_month:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Subscription package updated
 */
router.put('/:id', validatePackageUpdate, updateSubscriptionPackage);

/**
 * @swagger
 * /super-admin/subscriptions/{id}/toggle-status:
 *   put:
 *     summary: Toggle subscription package status
 *     tags: [Super Admin - Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Subscription package status updated
 */
router.put('/:id/toggle-status', validatePackageId, toggleStatus);

/**
 * @swagger
 * /super-admin/subscriptions/{id}:
 *   delete:
 *     summary: Delete a subscription package
 *     tags: [Super Admin - Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Subscription package deleted
 */
router.delete('/:id', validatePackageId, removePackage);

module.exports = router;
