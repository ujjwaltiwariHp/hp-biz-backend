CREATE TABLE IF NOT EXISTS temp_signups (
    email VARCHAR(255) PRIMARY KEY,
    otp VARCHAR(10),
    otp_expires_at TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE, -- True once OTP is entered correctly
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--  Company Sessions: Tracks active logins for Admin
CREATE TABLE IF NOT EXISTS company_sessions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--  Staff Sessions
DROP TABLE IF EXISTS staff_sessions;
CREATE TABLE staff_sessions (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_company_sessions_token ON company_sessions(refresh_token);
CREATE INDEX idx_staff_sessions_token ON staff_sessions(refresh_token);