
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

INSERT INTO super_admin_billing_settings (
    id,
    company_name,
    address,
    email,
    tax_rate,
    currency,
    bank_details,
    qr_code_image_url
)
VALUES (
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

-- If this returns 'f' (false), the table is missing.
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'super_admin_billing_settings'
);