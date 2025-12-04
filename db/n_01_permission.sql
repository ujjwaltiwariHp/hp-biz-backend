
UPDATE roles
SET permissions = json_build_object(
    -- 1. USER MANAGEMENT
    'user_management',
    CASE
        -- If already migrated (is an array), keep existing value
        WHEN json_typeof(permissions->'user_management') = 'array' THEN permissions->'user_management'
        -- If TRUE -> Grant Full Access
        WHEN (permissions->>'user_management')::boolean = true THEN '["view", "create", "update", "delete", "manage_status"]'::json
        -- Else -> Grant No Access
        ELSE '[]'::json
    END,

    -- 2. LEAD MANAGEMENT
    'lead_management',
    CASE
        WHEN json_typeof(permissions->'lead_management') = 'array' THEN permissions->'lead_management'

        -- SPECIAL CASE: 'Staff' Role (Case Insensitive)
        -- Give them View, Create, Update permissions ONLY (No Delete)
        WHEN LOWER(role_name) = 'staff' AND (permissions->>'lead_management')::boolean = true
            THEN '["view", "create", "update"]'::json

        -- DEFAULT: Give Full Access (including Delete, Import, Export) to others (Admin, Manager)
        WHEN (permissions->>'lead_management')::boolean = true
            THEN '["view", "create", "update", "delete", "import", "export", "transfer", "assign", "manage_settings"]'::json

        ELSE '[]'::json
    END,

    -- 3. REPORTS
    'reports',
    CASE
        WHEN json_typeof(permissions->'reports') = 'array' THEN permissions->'reports'
        WHEN (permissions->>'reports')::boolean = true THEN '["view", "export"]'::json
        ELSE '[]'::json
    END,

    -- 4. SETTINGS
    'settings',
    CASE
        WHEN json_typeof(permissions->'settings') = 'array' THEN permissions->'settings'
        WHEN (permissions->>'settings')::boolean = true THEN '["view", "update"]'::json
        ELSE '[]'::json
    END,

    -- 5. ROLE MANAGEMENT
    'role_management',
    CASE
        WHEN json_typeof(permissions->'role_management') = 'array' THEN permissions->'role_management'
        WHEN (permissions->>'role_management')::boolean = true THEN '["view", "create", "update", "delete"]'::json
        ELSE '[]'::json
    END
);