ALTER TABLE companies
ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500);

COMMENT ON COLUMN companies.profile_picture IS 'URL/Path to the company profile photo or logo';