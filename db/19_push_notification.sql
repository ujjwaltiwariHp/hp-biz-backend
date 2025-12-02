
CREATE TABLE IF NOT EXISTS device_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('staff', 'company', 'super_admin')),
    fcm_token TEXT NOT NULL UNIQUE,
    device_type VARCHAR(20) DEFAULT 'android',
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_device_tokens_user
ON device_tokens(user_id, user_type);

ALTER TABLE follow_up_reminders ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMP;