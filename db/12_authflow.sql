ALTER TABLE company_sessions
ADD COLUMN IF NOT EXISTS access_token VARCHAR(500);