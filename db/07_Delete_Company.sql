ALTER TABLE system_logs
DROP CONSTRAINT IF EXISTS system_logs_company_id_fkey;

ALTER TABLE system_logs
ADD CONSTRAINT system_logs_company_id_fkey
    FOREIGN KEY (company_id)
    REFERENCES companies(id)
    ON DELETE CASCADE;