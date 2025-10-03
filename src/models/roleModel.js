const pool = require("../config/database");

const createDefaultRoles = async (companyId) => {
  const defaultRoles = [
    {
      role_name: 'Admin',
      description: 'Full access to all features and settings',
      permissions: {
        "user_management": true,
        "lead_management": true,
        "reports": true,
        "settings": true,
        "role_management": true
      },
      is_default: true
    },
    {
      role_name: 'Manager',
      description: 'Manage staff and leads with reporting access',
      permissions: {
        "user_management": true,
        "lead_management": true,
        "reports": true,
        "settings": false,
        "role_management": false
      },
      is_default: true
    },
    {
      role_name: 'Staff',
      description: 'Basic lead management access',
      permissions: {
        "user_management": false,
        "lead_management": true,
        "reports": false,
        "settings": false,
        "role_management": false
      },
      is_default: true
    }
  ];

  for (const role of defaultRoles) {
    await pool.query(
      `INSERT INTO roles (company_id, role_name, description, permissions, is_default, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (company_id, role_name) DO NOTHING`,
      [companyId, role.role_name, role.description, JSON.stringify(role.permissions), role.is_default, true]
    );
  }
};

const getAllRoles = async (companyId) => {
  const result = await pool.query(
    "SELECT * FROM roles WHERE company_id = $1 AND is_active = true ORDER BY is_default DESC, role_name",
    [companyId]
  );
  return result.rows.map(role => ({
    ...role,
    permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions
  }));
};

const getRoleById = async (id, companyId) => {
  const result = await pool.query(
    "SELECT * FROM roles WHERE id = $1 AND company_id = $2",
    [id, companyId]
  );

  if (result.rows[0]) {
    const role = result.rows[0];
    return {
      ...role,
      permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions
    };
  }
  return null;
};

const createRole = async (data) => {
  const { company_id, role_name, description, permissions } = data;
  const existing = await pool.query(
    "SELECT id FROM roles WHERE company_id = $1 AND role_name = $2",
    [company_id, role_name]
  );

  if (existing.rows.length > 0) {
    throw new Error("Role name already exists");
  }

  const result = await pool.query(
    `INSERT INTO roles (company_id, role_name, description, permissions, is_default, is_active, created_at)
     VALUES ($1, $2, $3, $4, false, true, CURRENT_TIMESTAMP) RETURNING *`,
    [company_id, role_name, description, JSON.stringify(permissions)]
  );

  const newRole = result.rows[0];
  return {
    ...newRole,
    permissions: typeof newRole.permissions === 'string' ? JSON.parse(newRole.permissions) : newRole.permissions
  };
};

const updateRole = async (id, data, companyId) => {
  const { role_name, description, permissions } = data;
  const roleCheck = await pool.query(
    "SELECT id, is_default FROM roles WHERE id = $1 AND company_id = $2",
    [id, companyId]
  );

  if (!roleCheck.rows[0]) {
    throw new Error("Role not found");
  }

  const isDefault = roleCheck.rows[0].is_default;
  let query, params;

  if (isDefault) {
    query = `UPDATE roles SET description=$1, permissions=$2, updated_at=CURRENT_TIMESTAMP
             WHERE id=$3 AND company_id=$4 RETURNING *`;
    params = [description, JSON.stringify(permissions), id, companyId];
  } else {
    if (role_name) {
      const existing = await pool.query(
        "SELECT id FROM roles WHERE company_id = $1 AND role_name = $2 AND id != $3",
        [companyId, role_name, id]
      );

      if (existing.rows.length > 0) {
        throw new Error("Role name already exists");
      }
    }

    query = `UPDATE roles SET role_name=$1, description=$2, permissions=$3, updated_at=CURRENT_TIMESTAMP
             WHERE id=$4 AND company_id=$5 RETURNING *`;
    params = [role_name || roleCheck.rows[0].role_name, description, JSON.stringify(permissions), id, companyId];
  }

  const result = await pool.query(query, params);

  const updatedRole = result.rows[0];
  return {
    ...updatedRole,
    permissions: typeof updatedRole.permissions === 'string' ? JSON.parse(updatedRole.permissions) : updatedRole.permissions
  };
};

const deleteRole = async (id, companyId) => {
  const roleCheck = await pool.query(
    `SELECT r.id, r.is_default, COUNT(s.id) as staff_count
     FROM roles r
     LEFT JOIN staff s ON r.id = s.role_id AND s.status = 'active'
     WHERE r.id = $1 AND r.company_id = $2
     GROUP BY r.id, r.is_default`,
    [id, companyId]
  );

  if (!roleCheck.rows[0]) {
    throw new Error("Role not found");
  }

  const role = roleCheck.rows[0];
  if (role.is_default) {
    throw new Error("Cannot delete default role");
  }
  if (parseInt(role.staff_count) > 0) {
    throw new Error("Cannot delete role with assigned staff members");
  }

  const result = await pool.query(
    "DELETE FROM roles WHERE id=$1 AND company_id=$2 AND is_default=false RETURNING id",
    [id, companyId]
  );

  return result.rows.length > 0;
};

const getRolePermissions = async (roleId) => {
  const result = await pool.query(
    "SELECT permissions FROM roles WHERE id = $1",
    [roleId]
  );

  if (result.rows[0]) {
    const permissions = result.rows[0].permissions;
    return typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
  }

  return null;
};

const hasPermission = (userPermissions, permissionKey) => {
  if (!userPermissions || typeof userPermissions !== 'object') return false;
  return userPermissions[permissionKey] === true;
};

const getStaffCountByRole = async (companyId) => {
  const result = await pool.query(
    `SELECT r.id, r.role_name, r.description, r.is_default,
            COUNT(s.id) as total_staff,
            COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_staff,
            COUNT(CASE WHEN s.status = 'inactive' THEN 1 END) as inactive_staff,
            COUNT(CASE WHEN s.status = 'suspended' THEN 1 END) as suspended_staff
     FROM roles r
     LEFT JOIN staff s ON r.id = s.role_id
     WHERE r.company_id = $1 AND r.is_active = true
     GROUP BY r.id, r.role_name, r.description, r.is_default
     ORDER BY r.is_default DESC, r.role_name`,
    [companyId]
  );

  return result.rows.map(row => ({
    ...row,
    total_staff: parseInt(row.total_staff) || 0,
    active_staff: parseInt(row.active_staff) || 0,
    inactive_staff: parseInt(row.inactive_staff) || 0,
    suspended_staff: parseInt(row.suspended_staff) || 0
  }));
};

const getAvailablePermissions = () => {
  return [
    {
      key: 'user_management',
      label: 'User Management',
      description: 'Create, edit, and manage staff members'
    },
    {
      key: 'lead_management',
      label: 'Lead Management',
      description: 'View, create, edit, and manage leads'
    },
    {
      key: 'reports',
      label: 'Reports',
      description: 'Access to reports and analytics'
    },
    {
      key: 'settings',
      label: 'Settings',
      description: 'Manage company settings and configuration'
    },
    {
      key: 'role_management',
      label: 'Role Management',
      description: 'Create, edit, and manage user roles'
    }
  ];
};

module.exports = {
  createDefaultRoles,
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  hasPermission,
  getStaffCountByRole,
  getAvailablePermissions
};