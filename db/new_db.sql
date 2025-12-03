
-- 1. Super Admin Roles Table
CREATE TABLE super_admin_roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSON NOT NULL,
    is_internal BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Super Admins Table
CREATE TABLE super_admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    preferred_display_timezone VARCHAR(50) DEFAULT 'UTC',
    super_admin_role_id INTEGER REFERENCES super_admin_roles(id) ON DELETE SET NULL,
    is_super_admin BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Subscription Packages Table
CREATE TABLE subscription_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price_quarterly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price_yearly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    yearly_discount_percent INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(5) NOT NULL DEFAULT 'INR',
    features JSON,
    max_staff_count INTEGER,
    max_leads_per_month INTEGER,
    max_custom_fields INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_trial BOOLEAN DEFAULT FALSE,
    trial_duration_days INTEGER DEFAULT 7,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Companies Table
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
    timezone VARCHAR(50) DEFAULT 'UTC',
    profile_picture VARCHAR(500),
    subscription_package_id INTEGER REFERENCES subscription_packages(id),
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    subscription_status VARCHAR(50) DEFAULT 'trial' CHECK (subscription_status IN ('draft', 'pending', 'payment_received', 'approved', 'rejected', 'expired', 'cancelled', 'trial')),
    is_active BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. OTP Verifications Table
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

-- 6. Temp Signups Table
CREATE TABLE temp_signups (
    email VARCHAR(255) NOT NULL,
    company_id INTEGER,
    user_type VARCHAR(20) DEFAULT 'company',
    otp VARCHAR(10),
    otp_expires_at TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (email, company_id, user_type)
);

-- 7. Roles Table
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

-- 8. Staff Table
CREATE TABLE staff (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    alternate_phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    password_status VARCHAR(20) DEFAULT 'temporary' CHECK (password_status IN ('temporary', 'active', 'expired')),
    temp_password_expires_at TIMESTAMP,
    last_password_change_at TIMESTAMP,
    designation VARCHAR(100),
    employee_id VARCHAR(50),
    address TEXT,
    nationality VARCHAR(100),
    id_proof_type VARCHAR(100),
    id_proof_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    timezone VARCHAR(50) DEFAULT NULL,
    timezone_preference VARCHAR(20) DEFAULT 'company',
    is_first_login BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    profile_picture VARCHAR(500),
    created_by INTEGER REFERENCES staff(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, email)
);

-- 9. Lead Sources Table
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

-- 10. Lead Statuses Table
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

-- 11. Lead Tags Table
CREATE TABLE lead_tags (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    tag_name VARCHAR(100) NOT NULL,
    tag_color VARCHAR(7) DEFAULT '#28a745',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, tag_name)
);

-- 12. Leads Table
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
    lead_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    internal_notes TEXT,
    priority_level INTEGER DEFAULT 1,
    lead_score INTEGER DEFAULT 0,
    assigned_at TIMESTAMP,
    assigned_by INTEGER,
    created_by INTEGER,
    last_contacted TIMESTAMP,
    next_follow_up TIMESTAMP,
    best_time_to_call VARCHAR(100),
    timezone VARCHAR(50),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    referral_source VARCHAR(255),
    address VARCHAR(255),
    remarks VARCHAR(255),
    created_by_type VARCHAR(10),
    assigned_by_type VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Lead Field Definitions Table
CREATE TABLE lead_field_definitions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    field_key VARCHAR(50) NOT NULL,
    field_label VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox', 'textarea', 'email', 'url')),
    options JSONB DEFAULT '[]'::jsonb,
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, field_key)
);

-- 14. Lead Custom Field Audit Table
CREATE TABLE lead_custom_field_audit (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    field_key VARCHAR(255) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Lead Tag Mappings Table
CREATE TABLE lead_tag_mappings (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES lead_tags(id) ON DELETE CASCADE,
    applied_by INTEGER REFERENCES staff(id),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lead_id, tag_id)
);

-- 16. Lead Activities Table
CREATE TABLE lead_activities (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
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

-- 17. Notifications Table
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

-- 18. Follow-up Reminders Table
CREATE TABLE follow_up_reminders (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    reminder_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reminder_type VARCHAR(50) DEFAULT 'general',
    message TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    last_notification_sent_at TIMESTAMP,
    created_by INTEGER,
    created_by_type VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 19. Company Settings Table
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

-- 20. Lead Distribution Settings Table
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

-- 21. Staff Performance Table
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

-- 22. User Activity Logs Table
CREATE TABLE user_activity_logs (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    super_admin_id INTEGER REFERENCES super_admins(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    action_details TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 23. Company Sessions Table
CREATE TABLE company_sessions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 24. Staff Sessions Table
CREATE TABLE staff_sessions (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 25. Super Admin Sessions Table
CREATE TABLE super_admin_sessions (
    id SERIAL PRIMARY KEY,
    super_admin_id INTEGER NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
    refresh_token TEXT UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 26. Invoices Table
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
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'sent', 'payment_received', 'paid', 'partially_paid', 'overdue', 'void', 'cancelled', 'rejected')),
    payment_method VARCHAR(100),
    payment_reference VARCHAR(255),
    payment_notes TEXT,
    payment_date TIMESTAMP,
    admin_verified_at TIMESTAMP,
    admin_verified_by INTEGER REFERENCES super_admins(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    rejection_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 27. Payments Table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE RESTRICT NOT NULL,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(255) UNIQUE,
    payment_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 28. Payment Reminders Table
CREATE TABLE payment_reminders (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 29. System Logs Table
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    staff_id INTEGER REFERENCES staff(id),
    super_admin_id INTEGER REFERENCES super_admins(id) ON DELETE SET NULL,
    log_level VARCHAR(20) NOT NULL,
    log_category VARCHAR(50),
    message TEXT NOT NULL,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 30. Super Admin Notifications Table
CREATE TABLE super_admin_notifications (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    super_admin_id INTEGER REFERENCES super_admins(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 31. Super Admin Billing Settings Table
CREATE TABLE super_admin_billing_settings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL DEFAULT 'HPBIZ Billing',
    address TEXT,
    email VARCHAR(255),
    phone VARCHAR(20),
    tax_rate DECIMAL(5,4) DEFAULT 0.0000,
    currency VARCHAR(3) DEFAULT 'USD',
    bank_details JSON,
    qr_code_image_url VARCHAR(500),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_row_check CHECK (id = 1)
);

-- 32. Device Tokens Table
CREATE TABLE device_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('staff', 'company', 'super_admin')),
    fcm_token TEXT NOT NULL UNIQUE,
    device_type VARCHAR(20) DEFAULT 'android',
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- CREATE INDEXES
-- ================================================================

CREATE INDEX idx_super_admin_notifications_admin ON super_admin_notifications(super_admin_id, is_read);
CREATE INDEX idx_super_admin_notifications_type ON super_admin_notifications(notification_type);
CREATE INDEX idx_super_admin_notifications_company ON super_admin_notifications(company_id);
CREATE INDEX idx_super_admins_status ON super_admins(status);
CREATE INDEX idx_companies_unique_company_id ON companies(unique_company_id);
CREATE INDEX idx_companies_timezone ON companies(timezone);
CREATE INDEX idx_companies_subscription_expiry ON companies(subscription_end_date, is_active);
CREATE INDEX idx_companies_subscription_status ON companies(subscription_status, updated_at DESC);
CREATE INDEX idx_staff_company_email ON staff(company_id, email);
CREATE INDEX idx_staff_email_company ON staff(email, company_id);
CREATE INDEX idx_staff_timezone ON staff(company_id, timezone_preference);
CREATE UNIQUE INDEX idx_staff_employee_id_company ON staff(company_id, employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX idx_leads_company_id ON leads(company_id);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_status_id ON leads(status_id);
CREATE INDEX idx_leads_created_by_type ON leads(created_by, created_by_type);
CREATE INDEX idx_leads_assigned_by_type ON leads(assigned_by, assigned_by_type);
CREATE INDEX idx_leads_lead_data ON leads USING GIN (lead_data);
CREATE INDEX idx_lead_field_defs_company_active ON lead_field_definitions(company_id, sort_order) WHERE is_active = TRUE;
CREATE INDEX idx_lead_custom_field_audit_lead ON lead_custom_field_audit(lead_id, company_id);
CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX idx_notifications_staff_unread ON notifications(staff_id, is_read);
CREATE INDEX idx_follow_up_reminders_time ON follow_up_reminders(reminder_time);
CREATE INDEX idx_follow_up_reminders_created_by_type ON follow_up_reminders(created_by, created_by_type);
CREATE INDEX idx_user_activity_logs_staff ON user_activity_logs(staff_id, created_at);
CREATE INDEX idx_user_activity_logs_super_admin ON user_activity_logs(super_admin_id);
CREATE INDEX idx_company_sessions_token ON company_sessions(refresh_token);
CREATE INDEX idx_staff_sessions_token ON staff_sessions(refresh_token);
CREATE INDEX idx_invoices_company ON invoices(company_id, status);
CREATE INDEX idx_payments_company_id ON payments(company_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payment_reminders_invoice ON payment_reminders(invoice_id, reminder_type);
CREATE INDEX idx_system_logs_super_admin ON system_logs(super_admin_id);
CREATE INDEX idx_device_tokens_user ON device_tokens(user_id, user_type);

-- ================================================================
-- CREATE VIEW
-- ================================================================

CREATE VIEW view_auth_identities AS
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

-- ================================================================
-- INSERT DEFAULT DATA
-- ================================================================

INSERT INTO super_admin_roles (role_name, permissions, is_internal) VALUES
('Super Admin', '{"all": ["crud"]}', TRUE),
('Sub-Admin (View)', '{
  "dashboard": ["view"],
  "companies": ["view"],
  "subscription": ["view"],
  "payments": ["view"],
  "invoices": ["view"],
  "notifications": ["view"],
  "logging": ["view"],
  "super_admin_roles": ["view"],
  "reports": ["view"],
  "super_admins": ["view"],
  "subscriptions": ["view"]
}', TRUE);

INSERT INTO subscription_packages (
    name,
    price_monthly,
    price_quarterly,
    price_yearly,
    yearly_discount_percent,
    currency,
    features,
    max_staff_count,
    max_leads_per_month,
    max_custom_fields,
    is_active,
    is_trial,
    trial_duration_days
) VALUES (
    'Free Trial (30 Days)',
    0.00,
    0.00,
    0.00,
    0,
    'INR',
    '["staff_management", "lead_creation", "basic_reports", "email_notifications"]'::json,
    10,
    500,
    0,
    TRUE,
    TRUE,
    30
);

INSERT INTO super_admin_billing_settings (
    id,
    company_name,
    address,
    email,
    tax_rate,
    currency,
    bank_details,
    qr_code_image_url
) VALUES (
    1,
    'HPBIZ Billing',
    '123 SaaS Lane, Cloud City, SA 90210',
    'billing@hpbiz.com',
    0.0000,
    'USD',
    '{"bank_name": "HPBIZ Bank", "account_number": "1234567890", "ifsc_code": "HPBIZ0001"}',
    NULL
);

ALTER SEQUENCE super_admin_billing_settings_id_seq RESTART WITH 2;