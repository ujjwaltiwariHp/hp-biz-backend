
-- 1. Create Super Admin Roles Table
-- This table defines predefined permission groups for Super Admins (Super Admin, Sub-Admin, etc.)
CREATE TABLE super_admin_roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    -- Permissions should be stored as JSON, where keys are resources and values are allowed actions.
    -- Example: {"companies": ["view", "create"], "payments": ["view"]}
    permissions JSON NOT NULL,
    is_internal BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add role_id and is_super_admin flag to super_admins table
ALTER TABLE super_admins
ADD COLUMN super_admin_role_id INTEGER REFERENCES super_admin_roles(id) ON DELETE SET NULL,
ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;

-- 3. Insert default roles
-- Super Admin (Full Access)
INSERT INTO super_admin_roles (role_name, permissions, is_internal)
VALUES ('Super Admin', '{"all": ["crud"]}', TRUE);

-- Sub-Admin (View Only Access) - Default to view only for all main entities
INSERT INTO super_admin_roles (role_name, permissions, is_internal)
VALUES ('Sub-Admin (View)', '{"companies": ["view"], "subscriptions": ["view"], "payments": ["view"], "invoices": ["view"], "super_admins": ["view"]}', TRUE);

-- 4. Update existing super admins to the default 'Super Admin' role
UPDATE super_admins SET super_admin_role_id = (SELECT id FROM super_admin_roles WHERE role_name = 'Super Admin'), is_super_admin = TRUE;



-- Update the Super Admin role permissions
UPDATE super_admin_roles
SET permissions = '{"all": ["crud"]}'::json,
    updated_at = CURRENT_TIMESTAMP
WHERE role_name = 'Super Admin';

-- Verify the fix
SELECT id, role_name, permissions FROM super_admin_roles WHERE role_name = 'Super Admin';


SELECT sa.id, sa.email, sa.is_super_admin, sar.role_name, sar.permissions
FROM super_admins sa
LEFT JOIN super_admin_roles sar ON sa.super_admin_role_id = sar.id
WHERE sa.email = 'superadmin@hpbiz.com';

ALTER TABLE super_admins
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';


CREATE INDEX IF NOT EXISTS idx_super_admins_status
ON super_admins(status);


UPDATE super_admin_roles
SET permissions = '
{
  "dashboard": ["view"],
  "companies": ["view"],
  "subscription": ["view"],
  "payments": ["view"],
  "invoices": ["view"],
  "notifications": ["view"],
  "logging": ["view"],
  "super_admin_roles": ["view"],
  "reports": ["view"],
  "super_admins": ["view"],
  "subscriptions": ["view"]
}'::json,
updated_at = CURRENT_TIMESTAMP
WHERE role_name = 'Sub-Admin (View)';