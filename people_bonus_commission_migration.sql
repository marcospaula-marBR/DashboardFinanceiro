-- SQL MIGRATION FOR REMUNERATION BREAKDOWN (FIXED, BONUS, COMMISSION)
-- EXECUTE THIS IN SUPABASE SQL EDITOR TO UPDATE DB SCHEMA

-- 1. Add columns to employees table (Production)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS remuneration_fixed NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS remuneration_bonus NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS remuneration_commission NUMERIC DEFAULT 0;

-- 2. Add columns to employees_test table (Test environment)
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS remuneration_fixed NUMERIC DEFAULT 0;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS remuneration_bonus NUMERIC DEFAULT 0;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS remuneration_commission NUMERIC DEFAULT 0;

-- 3. Add columns to people_monthly_costs table
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS valor_fixo NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS valor_bonus NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS valor_comissao NUMERIC DEFAULT 0;

-- Optional helper comment: If database columns contain NULL for existing rows,
-- they default to 0. We can run this optional query to populate valor_fixo 
-- with valor_liquido for existing rows where valor_fixo is null or 0:
-- UPDATE people_monthly_costs SET valor_fixo = valor_liquido WHERE COALESCE(valor_fixo, 0) = 0 AND valor_liquido > 0;
