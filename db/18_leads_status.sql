DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lead_sources' AND column_name='is_active') THEN
        ALTER TABLE lead_sources ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END
$$;

-- Ensure existing sources are active by default
UPDATE lead_sources SET is_active = TRUE WHERE is_active IS NULL;