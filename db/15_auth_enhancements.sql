
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS password_status VARCHAR(20) DEFAULT 'temporary'
    CHECK (password_status IN ('temporary', 'active', 'expired')),
ADD COLUMN IF NOT EXISTS temp_password_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_password_change_at TIMESTAMP;


CREATE OR REPLACE VIEW view_auth_identities AS
SELECT
    'company'::varchar as user_type,
    id as user_id,
    id as company_id,
    company_name as label,
    admin_email as email,
    CASE WHEN is_active THEN 'active' ELSE 'inactive' END as status,
    'active'::varchar as password_status
FROM companies
UNION ALL
SELECT
    'staff'::varchar as user_type,
    s.id as user_id,
    s.company_id,
    c.company_name as label,
    s.email,
    s.status,
    s.password_status
FROM staff s
JOIN companies c ON s.company_id = c.id
WHERE s.status != 'deleted';


DELETE FROM temp_signups;

ALTER TABLE temp_signups DROP CONSTRAINT IF EXISTS temp_signups_pkey;


ALTER TABLE temp_signups
ADD COLUMN IF NOT EXISTS company_id INTEGER,
ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'company';


ALTER TABLE temp_signups
ADD PRIMARY KEY (email, company_id, user_type);

CREATE INDEX IF NOT EXISTS idx_staff_email_company ON staff(email, company_id);