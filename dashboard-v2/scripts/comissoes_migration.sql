-- SQL MIGRATION FOR COMMISSIONS & CONTRACTS DASHBOARD (PHASE 2)
-- EXECUTE THIS IN SUPABASE SQL EDITOR

-- 1. Add employee_id to equipe to link with employees table
ALTER TABLE equipe ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- 2. Add paid_date to comissoes to track payment dates for history
ALTER TABLE comissoes ADD COLUMN IF NOT EXISTS paid_date DATE;

-- 3. Add status to recebimentos to track expected vs received amounts
ALTER TABLE recebimentos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pago';

-- 4. Link existing equipe members to their corresponding employees (by name match)
UPDATE equipe SET employee_id = '4220fd77-21bf-4e49-aaa7-86a559edfc60' WHERE id = 'a8f31ce9-aea2-4342-93bd-4f35ed10de98'; -- Carlos Henrique
UPDATE equipe SET employee_id = '2be1f1dc-7144-4fcd-9847-2b70f2fa5712' WHERE id = '7a758fde-988e-4a3d-b075-6b5f5df443a8'; -- Geovanna Chaves
UPDATE equipe SET employee_id = 'c180ebc1-e3a8-48fc-91e2-9365f05e3aff' WHERE id = '9f3bbda1-b2cf-4bf1-a2b9-237a1713e1c3'; -- Felipe Prado
