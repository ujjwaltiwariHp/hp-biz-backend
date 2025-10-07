-- 1. Super Admin Table
CREATE TABLE super_admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE super_admins
ADD COLUMN status VARCHAR(20) DEFAULT 'active'
CHECK (status IN ('active', 'inactive'));

SELECT * FROM super_admins;

-- {
    -- "email": "ujjwalnew@gmail.com",
    -- "password": "NewSecurePassword123"
-- }
DELETE FROM super_admins WHERE id = 3;

SELECT * FROM super_admins;


-- 2. Subscription Packages Table
CREATE TABLE subscription_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    duration_type VARCHAR(20) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    features JSON,
    max_staff_count INTEGER,
    max_leads_per_month INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Companies Table
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    unique_company_id VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    admin_email VARCHAR(255) UNIQUE NOT NULL,
    admin_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    website VARCHAR(255),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    subscription_package_id INTEGER REFERENCES subscription_packages(id),
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    is_active BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM companies;

SELECT COUNT(*) FROM companies;
SELECT * FROM companies LIMIT 5;

DELETE FROM companies WHERE id = 8;

-- 4. OTP Verifications Table
CREATE TABLE otp_verifications (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(10) NOT NULL,
    otp_type VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM otp_verifications;

-- 5. Roles Table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSON,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, role_name)
);

SELECT * FROM roles;

-- 6. Staff Table
CREATE TABLE staff (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    designation VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    is_first_login BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    profile_picture VARCHAR(500),
    created_by INTEGER REFERENCES staff(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, email)
);

SELECT * FROM staff;
SELECT * FROM staff WHERE id >1;

SELECT status, is_first_login FROM staff WHERE email = 'ujjwaltiwaridaza@gmail.com';

SELECT is_active FROM companies WHERE id = (SELECT company_id FROM staff WHERE email = 'ujjwaltiwaridaza@gmail.com');

-- 7. Lead Sources Table
CREATE TABLE lead_sources (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    source_name VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_config JSON,
    webhook_url VARCHAR(500),
    api_key VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    total_leads_received INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, source_name)
);

select * from lead_sources;

-- 8. Lead Statuses Table
CREATE TABLE lead_statuses (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    status_name VARCHAR(100) NOT NULL,
    status_color VARCHAR(7) DEFAULT '#007bff',
    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    is_final BOOLEAN DEFAULT false,
    conversion_stage VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, status_name)
);

UPDATE lead_statuses
SET conversion_stage = 'converted', is_final = true
WHERE status_name = 'Closed' AND company_id = 7; -- Replace 7 with your actual company ID

UPDATE lead_statuses
SET conversion_stage = 'converted', is_final = true
WHERE status_name = 'Converted' AND company_id = 7; -- Replace 7 with your actual company ID

-- 9. Lead Tags Table
CREATE TABLE lead_tags (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    tag_name VARCHAR(100) NOT NULL,
    tag_color VARCHAR(7) DEFAULT '#28a745',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, tag_name)
);

-- 10. Leads Table
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    lead_source_id INTEGER REFERENCES lead_sources(id),
    assigned_to INTEGER REFERENCES staff(id),
    status_id INTEGER REFERENCES lead_statuses(id),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    company_name VARCHAR(255),
    job_title VARCHAR(100),
    industry VARCHAR(100),
    lead_value DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    lead_data JSON,
    notes TEXT,
    internal_notes TEXT,
    priority_level INTEGER DEFAULT 1,
    lead_score INTEGER DEFAULT 0,
    assigned_at TIMESTAMP,
    assigned_by INTEGER REFERENCES staff(id),
    created_by INTEGER REFERENCES staff(id),
    last_contacted TIMESTAMP,
    next_follow_up TIMESTAMP,
    best_time_to_call VARCHAR(100),
    timezone VARCHAR(50),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    referral_source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE leads ADD COLUMN address VARCHAR(255);

ALTER TABLE leads ADD COLUMN remarks VARCHAR(255);

-- Remove the foreign key constraints and make them nullable
ALTER TABLE leads DROP CONSTRAINT leads_created_by_fkey;
ALTER TABLE leads DROP CONSTRAINT leads_assigned_by_fkey;

-- Add them back as nullable
ALTER TABLE leads ADD CONSTRAINT leads_created_by_fkey
FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL;

ALTER TABLE leads ADD CONSTRAINT leads_assigned_by_fkey
FOREIGN KEY (assigned_by) REFERENCES staff(id) ON DELETE SET NULL;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_created_by_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_assigned_by_fkey;

-- Add new columns to leads table
ALTER TABLE leads ADD COLUMN created_by_type VARCHAR(10);
ALTER TABLE leads ADD COLUMN assigned_by_type VARCHAR(10);

-- Add indexes for better performance
CREATE INDEX idx_leads_created_by_type ON leads(created_by, created_by_type);
CREATE INDEX idx_leads_assigned_by_type ON leads(assigned_by, assigned_by_type);

-- Update lead_activities table to support both staff and company tracking
ALTER TABLE lead_activities ADD COLUMN user_type VARCHAR(10);
ALTER TABLE lead_activities RENAME COLUMN staff_id TO user_id;

ALTER TABLE lead_activities DROP CONSTRAINT IF EXISTS lead_activities_staff_id_fkey;


ALTER TABLE lead_activities
ADD CONSTRAINT lead_activities_staff_id_fkey
FOREIGN KEY (staff_id) REFERENCES staff(id)
ON DELETE SET NULL;  -- or CASCADE, depending on what you had before


SELECT * FROM leads;

-- 11. Lead Tag Mappings
CREATE TABLE lead_tag_mappings (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES lead_tags(id) ON DELETE CASCADE,
    applied_by INTEGER REFERENCES staff(id),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lead_id, tag_id)
);

-- 12. Lead Activities
CREATE TABLE lead_activities (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES staff(id),
    activity_type VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    description TEXT,
    call_duration INTEGER,
    email_subject VARCHAR(255),
    meeting_date TIMESTAMP,
    metadata JSON,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM lead_activities;

ALTER TABLE lead_activities ADD COLUMN staff_id INTEGER REFERENCES staff(id);

-- 13. Notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    related_lead_id INTEGER REFERENCES leads(id),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM notifications;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'lead_activities';

UPDATE lead_activities
SET staff_id = user_id
WHERE user_id IS NOT NULL;

-- If you want to copy existing user_id data to staff_id
UPDATE lead_activities
SET staff_id = user_id
WHERE user_id IS NOT NULL AND user_type = 'staff';

-- Remove the extra columns you don't need
ALTER TABLE lead_activities DROP COLUMN user_id;
ALTER TABLE lead_activities DROP COLUMN user_type;



-- 14. Follow-up Reminders
CREATE TABLE follow_up_reminders (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    reminder_time TIMESTAMP NOT NULL,
    reminder_type VARCHAR(50) DEFAULT 'general',
    message TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_by INTEGER REFERENCES staff(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM follow_up_reminders WHERE id = 124 AND company_id = 7;

SELECT * FROM follow_up_reminders;

-- Add created_by_type column (already done)
ALTER TABLE follow_up_reminders ADD COLUMN created_by_type VARCHAR(10);

-- Allow created_by to be either staff.id OR company.id
-- Option 1: remove foreign key to staff.id (simpler)
ALTER TABLE follow_up_reminders DROP CONSTRAINT IF EXISTS follow_up_reminders_created_by_fkey;


ALTER TABLE follow_up_reminders
ALTER COLUMN reminder_time SET DEFAULT CURRENT_TIMESTAMP;


-- Add created_by_type column to follow_up_reminders table
ALTER TABLE follow_up_reminders ADD COLUMN created_by_type VARCHAR(10);

-- Update existing records to set created_by_type based on created_by values
UPDATE follow_up_reminders
SET created_by_type = 'staff'
WHERE created_by IS NOT NULL;

-- Add index for better performance
CREATE INDEX idx_follow_up_reminders_created_by_type ON follow_up_reminders(created_by, created_by_type);

-- 15. Company Settings
CREATE TABLE company_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    business_hours JSON,
    timezone VARCHAR(50) DEFAULT 'UTC',
    default_lead_source_id INTEGER REFERENCES lead_sources(id),
    default_lead_status_id INTEGER REFERENCES lead_statuses(id),
    auto_assign_leads BOOLEAN DEFAULT false,
    email_notifications BOOLEAN DEFAULT true,
    date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id)
);

INSERT INTO company_settings (company_id, email_notifications)
SELECT id, true
FROM companies
WHERE id NOT IN (SELECT company_id FROM company_settings);

-- 16. Lead Distribution Settings
CREATE TABLE lead_distribution_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    distribution_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    settings JSON,
    round_robin_order JSON,
    last_assigned_to INTEGER REFERENCES staff(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. Staff Performance Tracking
CREATE TABLE staff_performance (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    leads_assigned INTEGER DEFAULT 0,
    leads_contacted INTEGER DEFAULT 0,
    leads_qualified INTEGER DEFAULT 0,
    leads_converted INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    total_deal_value DECIMAL(12,2) DEFAULT 0,
    calls_made INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    performance_score DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(staff_id, period_type, period_start)
);

-- 18. User Activity Logs (Essential CRUD operations only)
CREATE TABLE user_activity_logs (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    action_details TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM user_activity_logs;

-- 19. Staff Sessions
CREATE TABLE staff_sessions (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    logout_time TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(staff_id, session_token)
);

-- 20. Billing & Invoices
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    subscription_package_id INTEGER REFERENCES subscription_packages(id),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_period_start DATE,
    billing_period_end DATE,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    payment_date TIMESTAMP,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE invoices
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


-- 21. System Logs (Essential system events only)
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    staff_id INTEGER REFERENCES staff(id),
    log_level VARCHAR(20) NOT NULL,
    log_category VARCHAR(50),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 21. Payments Table (for actual payment records)
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE RESTRICT NOT NULL,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- e.g., 'bank_transfer', 'credit_card', 'paypal', 'other'
    transaction_id VARCHAR(255) UNIQUE, -- Unique ID from payment gateway
    payment_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL, -- e.g., 'pending', 'completed', 'failed', 'refunded'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Create indexes for better performance
CREATE INDEX idx_companies_unique_company_id ON companies(unique_company_id);
CREATE INDEX idx_staff_company_email ON staff(company_id, email);
CREATE INDEX idx_leads_company_id ON leads(company_id);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_status_id ON leads(status_id);
CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX idx_notifications_staff_unread ON notifications(staff_id, is_read);
CREATE INDEX idx_follow_up_reminders_time ON follow_up_reminders(reminder_time);
CREATE INDEX idx_user_activity_logs_staff ON user_activity_logs(staff_id, created_at);
CREATE INDEX idx_staff_sessions_token ON staff_sessions(session_token);
CREATE INDEX idx_invoices_company ON invoices(company_id, status);

CREATE INDEX idx_payments_company_id ON payments(company_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);