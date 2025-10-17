
ALTER TABLE subscription_packages
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_duration_days INTEGER DEFAULT 7;

COMMENT ON COLUMN subscription_packages.is_trial IS
    'Indicates if this package is a designated trial plan.';
COMMENT ON COLUMN subscription_packages.trial_duration_days IS
    'Number of days the trial subscription remains active.';

-- 2️⃣ Index for subscription expiry checks (used by cron jobs)
CREATE INDEX IF NOT EXISTS idx_companies_subscription_expiry
    ON companies (subscription_end_date, is_active);

-- 3️⃣ Ensure one default trial package exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM subscription_packages WHERE name = 'Free Trial (30 Days)'
    ) THEN
        INSERT INTO subscription_packages (
            name,
            duration_type,
            price,
            features,
            max_staff_count,
            max_leads_per_month,
            is_active,
            is_trial,
            trial_duration_days
        )
        VALUES (
            'Free Trial (30 Days)',
            'one_time',
            0.00,
            '[
                "staff_management",
                "lead_creation",
                "basic_reports",
                "email_notifications"
            ]'::jsonb,   -- safer cast
            10,     -- trial staff limit
            500,   -- trial monthly lead limit
            TRUE,  -- active
            TRUE,  -- is_trial
            30     -- 30-day duration
        );
    END IF;
END $$;
