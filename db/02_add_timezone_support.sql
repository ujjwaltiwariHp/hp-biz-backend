
ALTER TABLE super_admins
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS preferred_display_timezone VARCHAR(50) DEFAULT 'UTC';

-- Add timezone columns to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Add timezone columns to staff table
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS timezone_preference VARCHAR(20) DEFAULT 'company';
-- Options: 'company', 'device', 'custom'

-- Add comments for clarity
COMMENT ON COLUMN super_admins.timezone IS 'Super admin personal timezone';
COMMENT ON COLUMN super_admins.preferred_display_timezone IS 'Timezone for super admin dashboard display';
COMMENT ON COLUMN companies.timezone IS 'Company default timezone';
COMMENT ON COLUMN staff.timezone IS 'Staff custom timezone (only used if preference is custom)';
COMMENT ON COLUMN staff.timezone_preference IS 'Timezone preference: company, device, or custom';

-- Update existing company_settings to ensure timezone is set
UPDATE company_settings
SET timezone = 'UTC'
WHERE timezone IS NULL;

-- Add indexes for timezone queries
CREATE INDEX IF NOT EXISTS idx_companies_timezone ON companies(timezone);
CREATE INDEX IF NOT EXISTS idx_staff_timezone ON staff(company_id, timezone_preference);