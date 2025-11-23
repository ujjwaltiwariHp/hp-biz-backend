-- Add super_admin_id to user_activity_logs
ALTER TABLE user_activity_logs
ADD COLUMN IF NOT EXISTS super_admin_id INTEGER REFERENCES super_admins(id) ON DELETE SET NULL;

-- Add super_admin_id to system_logs
ALTER TABLE system_logs
ADD COLUMN IF NOT EXISTS super_admin_id INTEGER REFERENCES super_admins(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_super_admin ON user_activity_logs(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_super_admin ON system_logs(super_admin_id);