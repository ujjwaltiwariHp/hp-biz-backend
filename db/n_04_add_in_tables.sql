-- lead
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS lead_images JSONB,
ADD COLUMN IF NOT EXISTS location JSONB;

-- company session
ALTER TABLE company_sessions
ADD COLUMN IF NOT EXISTS login_location JSONB;

-- staff session
ALTER TABLE staff_sessions
ADD COLUMN IF NOT EXISTS login_location JSONB;

