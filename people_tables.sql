-- SQL MIGRATION FOR PEOPLE COCKPIT (PHASE 1)
-- EXECUTE THIS IN SUPABASE SQL EDITOR

-- 1. Create Trayectory/Bonds Table
CREATE TABLE IF NOT EXISTS people_employment_bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  vinculo TEXT NOT NULL CHECK (vinculo IN ('CLT', 'MEI', 'Estagiário', 'PJ')),
  empresa TEXT NOT NULL,
  centro_custo TEXT,
  setor TEXT,
  cargo TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  motivo_fim TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and Create Policies
ALTER TABLE people_employment_bonds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON people_employment_bonds;
CREATE POLICY "service_role_all" ON people_employment_bonds FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_read" ON people_employment_bonds;
CREATE POLICY "anon_read" ON people_employment_bonds FOR SELECT TO anon USING (true);

-- 2. Create Monthly Costs Table
CREATE TABLE IF NOT EXISTS people_monthly_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  competencia DATE NOT NULL, -- YYYY-MM-01 format
  vinculo_tipo TEXT NOT NULL CHECK (vinculo_tipo IN ('CLT', 'MEI')),
  valor_holerite NUMERIC,
  valor_adiantamento NUMERIC,
  valor_hora_extra NUMERIC,
  valor_adicional_not NUMERIC,
  valor_vr NUMERIC,
  valor_vt NUMERIC,
  valor_ajuda_custo NUMERIC,
  valor_cesta NUMERIC,
  valor_ferias NUMERIC,
  valor_rescisao NUMERIC,
  valor_decimo_terceiro NUMERIC,
  valor_descontos NUMERIC,
  valor_liquido NUMERIC NOT NULL,
  origem TEXT NOT NULL DEFAULT 'dianna_import',
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and Create Policies
ALTER TABLE people_monthly_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON people_monthly_costs;
CREATE POLICY "service_role_all" ON people_monthly_costs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_read" ON people_monthly_costs;
CREATE POLICY "anon_read" ON people_monthly_costs FOR SELECT TO anon USING (true);
