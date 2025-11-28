
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS id_proof_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS id_proof_number VARCHAR(100);

COMMENT ON COLUMN staff.address IS 'Residential address of the staff member';
COMMENT ON COLUMN staff.nationality IS 'Nationality (e.g., Indian, American)';
COMMENT ON COLUMN staff.employee_id IS 'Internal company Employee ID (e.g., EMP-001)';
COMMENT ON COLUMN staff.id_proof_type IS 'Type of ID provided (e.g., Aadhar Card, Passport)';
COMMENT ON COLUMN staff.id_proof_number IS 'The unique number on the ID proof';

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_employee_id_company
ON staff(company_id, employee_id)
WHERE employee_id IS NOT NULL;