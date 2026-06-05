-- ============================================================
-- Migration 02: Fix employees_company_check + add HR columns
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Fix company CHECK constraint to include 'G2'
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_company_check;
ALTER TABLE employees ADD CONSTRAINT employees_company_check 
  CHECK (company IN ('MarBR', 'DZM', 'G2'));

-- 2. Add nivel column (Estratégico | Tático | Operacional)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nivel TEXT;

-- 3. Add commission_plan column (plano de comissão por produto)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS commission_plan TEXT DEFAULT '';

-- 4. Add department_start_date (data de início no setor/função atual)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_start_date DATE;

-- ============================================================
-- Verification
-- ============================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employees' 
  AND column_name IN ('nivel', 'commission_plan', 'department_start_date', 'company');
