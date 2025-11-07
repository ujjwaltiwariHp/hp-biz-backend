-- 1. Super Admin Table
CREATE TABLE super_admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



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

-- 14. Follow-up Reminders
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
    created_by INTEGER,
    created_by_type VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- 18. User Activity Logs
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

-- 20. Invoices
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 21. Payments
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

-- 22. System Logs
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    staff_id INTEGER REFERENCES staff(id),
    log_level VARCHAR(20) NOT NULL,
    log_category VARCHAR(50),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 23. Super Admin Notifications
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

-- Indexes
CREATE INDEX idx_super_admin_notifications_admin ON super_admin_notifications(super_admin_id, is_read);
CREATE INDEX idx_super_admin_notifications_type ON super_admin_notifications(notification_type);
CREATE INDEX idx_super_admin_notifications_company ON super_admin_notifications(company_id);
CREATE INDEX idx_companies_unique_company_id ON companies(unique_company_id);
CREATE INDEX idx_staff_company_email ON staff(company_id, email);
CREATE INDEX idx_leads_company_id ON leads(company_id);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_status_id ON leads(status_id);
CREATE INDEX idx_leads_created_by_type ON leads(created_by, created_by_type);
CREATE INDEX idx_leads_assigned_by_type ON leads(assigned_by, assigned_by_type);
CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX idx_notifications_staff_unread ON notifications(staff_id, is_read);
CREATE INDEX idx_follow_up_reminders_time ON follow_up_reminders(reminder_time);
CREATE INDEX idx_follow_up_reminders_created_by_type ON follow_up_reminders(created_by, created_by_type);
CREATE INDEX idx_user_activity_logs_staff ON user_activity_logs(staff_id, created_at);
CREATE INDEX idx_staff_sessions_token ON staff_sessions(session_token);
CREATE INDEX idx_invoices_company ON invoices(company_id, status);
CREATE INDEX idx_payments_company_id ON payments(company_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
