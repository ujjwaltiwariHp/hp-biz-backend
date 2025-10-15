const express = require("express");
const router = express.Router();

const {
  login,
  createAdmin,
  getProfile,
  getAllAdmins,
  updateProfile,
  changePassword,
  logout,
  deleteAdmin,
  toggleAdminStatus,
  getSuperAdminRoles,
  updateSuperAdminRolePermissions
} = require("../../controllers/super-admin-controllers/authController");

const { authenticateSuperAdmin } = require("../../middleware/super-admin-middleware/authMiddleware");
const { requireSuperAdminPermission } = require("../../middleware/super-admin-middleware/superAdminPermissionMiddleware");
const {
  validateSuperAdminCreation,
  validateSuperAdminLogin,
  validateProfileUpdate,
  validatePasswordChange,
} = require("../../middleware/super-admin-middleware/authValidation");
const { attachTimezoneForSuperAdmin } = require('../../middleware/timezoneMiddleware');
const authChain = [authenticateSuperAdmin, attachTimezoneForSuperAdmin];
router.post("/login", validateSuperAdminLogin, login);

router.get("/profile", authChain, getProfile);
router.put("/profile", authChain, validateProfileUpdate, updateProfile);
router.put("/change-password", authChain, validatePasswordChange, changePassword);
router.post("/logout", authChain, logout);


router.get("/roles", authChain, requireSuperAdminPermission('super_admin_roles', 'view'), getSuperAdminRoles);

router.put("/roles/:id/permissions", authChain, requireSuperAdminPermission('super_admin_roles', 'update'), updateSuperAdminRolePermissions);

router.post("/create", authChain, requireSuperAdminPermission('super_admins', 'create'), validateSuperAdminCreation, createAdmin);

router.get("/all", authChain, requireSuperAdminPermission('super_admins', 'view'), getAllAdmins);


router.delete('/delete/:id', authChain, requireSuperAdminPermission('super_admins', 'delete'), deleteAdmin);

router.put('/toggle-status/:id', authChain, requireSuperAdminPermission('super_admins', 'update'), toggleAdminStatus);

module.exports = router;