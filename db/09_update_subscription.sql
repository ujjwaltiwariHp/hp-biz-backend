
ALTER TABLE subscription_packages
DROP COLUMN IF EXISTS duration_type,
DROP COLUMN IF EXISTS price,
DROP COLUMN IF EXISTS monthly_base_price;

ALTER TABLE subscription_packages
ADD COLUMN price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN price_quarterly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN price_yearly DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE subscription_packages
ADD COLUMN yearly_discount_percent INTEGER NOT NULL DEFAULT 0,
ADD COLUMN currency VARCHAR(5) NOT NULL DEFAULT 'INR';

UPDATE subscription_packages SET max_custom_fields = 0 WHERE is_trial = TRUE;
