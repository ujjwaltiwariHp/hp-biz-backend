const express = require("express");
const router = express.Router();

const {
  login,
  refreshToken,
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


router.post("/refresh-token", attachTimezoneForSuperAdmin, refreshToken);

router.get("/profile", authChain, requireSuperAdminPermission('super_admins', 'view'), getProfile);

// PROFILE UPDATE (CRUD access needed)
router.put("/profile", authChain, requireSuperAdminPermission('super_admins', 'update'), validateProfileUpdate, updateProfile);

// PASSWORD CHANGE (CRUD access needed)
router.put("/change-password", authChain, requireSuperAdminPermission('super_admins', 'update'), validatePasswordChange, changePassword);

// LOGOUT (No permission check needed, but requires auth context to know who is logging out)
router.post("/logout", logout);


// ROLES Management
router.get("/roles", authChain, requireSuperAdminPermission('super_admin_roles', 'view'), getSuperAdminRoles);
router.put("/roles/:id/permissions", authChain, requireSuperAdminPermission('super_admin_roles', 'update'), updateSuperAdminRolePermissions);

// ADMIN Management
router.post("/create", authChain, requireSuperAdminPermission('super_admins', 'create'), validateSuperAdminCreation, createAdmin);
router.get("/all", authChain, requireSuperAdminPermission('super_admins', 'view'), getAllAdmins);

// ADMIN CRUD
router.delete('/delete/:id', authChain, requireSuperAdminPermission('super_admins', 'delete'), deleteAdmin);
router.put('/toggle-status/:id', authChain, requireSuperAdminPermission('super_admins', 'update'), toggleAdminStatus);

module.exports = router;