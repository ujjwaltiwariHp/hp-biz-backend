CREATE TABLE IF NOT EXISTS lead_field_definitions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,


    field_key VARCHAR(50) NOT NULL,

    -- The label shown in the Mobile App UI (e.g., "Date of Birth")
    field_label VARCHAR(100) NOT NULL,

    -- The data type for UI rendering in the Mobile App
    field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox', 'textarea', 'email', 'url')),

    -- Stores options for 'dropdown' or 'checkbox' types (e.g., ["Option A", "Option B"])
    options JSONB DEFAULT '[]'::jsonb,

    -- Validation rules for the Create Lead form
    is_required BOOLEAN DEFAULT FALSE,

    -- Controls the order fields appear in the Mobile App
    sort_order INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensures an admin cannot create two fields with the same key (e.g., 'dob')
    UNIQUE(company_id, field_key)
);


-- Index for quickly fetching the form structure for a company
-- This is critical for the "Create Lead" screen load time.
CREATE INDEX IF NOT EXISTS idx_lead_field_defs_company_active
ON lead_field_definitions(company_id, sort_order)
WHERE is_active = TRUE;

COMMENT ON TABLE lead_field_definitions IS 'Defines the template structure for custom lead fields per company.';
COMMENT ON COLUMN lead_field_definitions.field_key IS 'The immutable key used inside the leads.lead_data JSONB column.';
COMMENT ON COLUMN lead_field_definitions.options IS 'JSON array of string options for dropdown/select fields.';