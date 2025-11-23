CREATE TABLE IF NOT EXISTS super_admin_sessions (
    id SERIAL PRIMARY KEY,
    super_admin_id INTEGER NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_token ON super_admin_sessions(refresh_token);