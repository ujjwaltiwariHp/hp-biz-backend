
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial'
CHECK (subscription_status IN ('draft', 'pending', 'payment_received', 'approved', 'rejected', 'expired', 'cancelled', 'trial'));

COMMENT ON COLUMN companies.subscription_status IS
    'The current lifecycle status of the company''s subscription: pending (awaiting payment), payment_received (admin verified), approved (active), rejected, expired, cancelled.';


--  Enhance Invoices table for manual tracking and reminders.
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_notes TEXT,
ADD COLUMN IF NOT EXISTS admin_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS admin_verified_by INTEGER REFERENCES super_admins(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejection_note TEXT;

--  Update Invoices Status Check Constraint.

ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
ADD CONSTRAINT invoices_status_check
CHECK (status IN ('draft', 'pending', 'sent', 'payment_received', 'paid', 'partially_paid', 'overdue', 'void', 'cancelled', 'rejected'));


-- Create Table for Payment Reminder Tracking (used by cron job).
CREATE TABLE IF NOT EXISTS payment_reminders (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL, -- '24_hour_after_send', '3_day_before_due', 'due_date', '7_day_overdue'
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_invoice ON payment_reminders(invoice_id, reminder_type);

--  Add Index for quicker querying/filtering by the new company status.
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status
ON companies (subscription_status, updated_at DESC);