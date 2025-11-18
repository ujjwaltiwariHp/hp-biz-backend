-- ================================================================
-- CUSTOM LEAD FIELDS - FIXED MIGRATION FOR RENDER
-- This FIXES the JSON → JSONB conversion issue
-- ================================================================

-- Step 1: FIRST - Convert JSON to JSONB (THIS WAS MISSING!)
ALTER TABLE leads
ALTER COLUMN lead_data TYPE jsonb USING lead_data::jsonb;

-- Step 2: Set defaults on leads table
ALTER TABLE leads
ALTER COLUMN lead_data SET DEFAULT '{}'::jsonb,
ALTER COLUMN lead_data SET NOT NULL;

-- Step 3: Add max_custom_fields to subscription_packages
ALTER TABLE subscription_packages
ADD COLUMN IF NOT EXISTS max_custom_fields INTEGER DEFAULT 0;

-- Step 4: Create audit table
CREATE TABLE IF NOT EXISTS lead_custom_field_audit (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    field_key VARCHAR(255) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Create index for audit table
CREATE INDEX IF NOT EXISTS idx_lead_custom_field_audit_lead
ON lead_custom_field_audit(lead_id, company_id);

-- Step 6: Create GIN index for lead_data (NOW WORKS because it's JSONB!)
CREATE INDEX IF NOT EXISTS idx_leads_lead_data
ON leads USING GIN (lead_data);

-- Step 7: Update subscription packages with limits
UPDATE subscription_packages
SET max_custom_fields = 0
WHERE name = 'Free Trial (30 Days)';

UPDATE subscription_packages
SET max_custom_fields = 5
WHERE name LIKE '%Basic%';

UPDATE subscription_packages
SET max_custom_fields = 15
WHERE name LIKE '%Professional%';

UPDATE subscription_packages
SET max_custom_fields = 50
WHERE name LIKE '%Enterprise%';

-- ================================================================
-- VERIFICATION - Run these to confirm it worked
-- ================================================================

-- Check 1: Verify lead_data is now JSONB
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'leads'
AND column_name = 'lead_data';
-- Should show: lead_data | jsonb | false

-- Check 2: Verify subscription packages
SELECT name, max_custom_fields
FROM subscription_packages
ORDER BY price;

-- Check 3: Verify audit table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'lead_custom_field_audit';

-- Check 4: Verify GIN index created
SELECT indexname
FROM pg_indexes
WHERE tablename = 'leads'
AND indexname LIKE '%lead_data%';

-- ================================================================
-- DYNAMIC SUBSCRIPTION LIMITS - Based on PRICE (Not Name)
-- This works for ANY plan names!
-- ================================================================

-- Step 1: See all your packages with prices
SELECT id, name, price, max_custom_fields
FROM subscription_packages
ORDER BY price ASC;

-- Step 2: Update limits based on PRICE RANGES
-- This way, any plan at this price tier gets these limits automatically

-- FREE TIER (Price = 0)
UPDATE subscription_packages
SET max_custom_fields = 0
WHERE price = 0.00;

-- STARTER/BASIC TIER (Price: 0.01 - 99.99)
UPDATE subscription_packages
SET max_custom_fields = 5
WHERE price > 0.00 AND price < 100.00;

-- PROFESSIONAL/BUSINESS TIER (Price: 100 - 499.99)
UPDATE subscription_packages
SET max_custom_fields = 15
WHERE price >= 100.00 AND price < 500.00;

-- ENTERPRISE TIER (Price: 500+)
UPDATE subscription_packages
SET max_custom_fields = 50
WHERE price >= 500.00;

-- Step 3: Verify all packages got their limits
SELECT id, name, price, max_custom_fields
FROM subscription_packages
ORDER BY price ASC;

-- ================================================================
-- Expected Output:
-- ================================================================
-- id |        name         | price | max_custom_fields
-- ---|---------------------|-------|-------------------
--  1 | Free Trial (30 Days)|  0.00 |                 0
--  2 | Starter Plan        | 29.99 |                 5
--  3 | Business Plan       |199.99 |                15
--  4 | Enterprise Plan     |999.99 |                50
-- (or whatever your plan names are, doesn't matter!)
-- ================================================================