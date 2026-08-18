-- =============================================================
-- Migration: Modernização do Módulo de Terceirização
-- Versão: v.02.56.16
-- Data: 2026-08-18
-- =============================================================

-- 1. NOVOS CAMPOS DE VERBAS NA TABELA people_monthly_costs
-- Cada campo representa uma verba individual da folha de terceirização

ALTER TABLE people_monthly_costs
  ADD COLUMN IF NOT EXISTS valor_desconto     NUMERIC(12,2) DEFAULT 0,  -- Descontos de folha
  ADD COLUMN IF NOT EXISTS valor_vr           NUMERIC(12,2) DEFAULT 0,  -- Vale Refeição
  ADD COLUMN IF NOT EXISTS valor_vt           NUMERIC(12,2) DEFAULT 0,  -- Vale Transporte
  ADD COLUMN IF NOT EXISTS valor_seguro       NUMERIC(12,2) DEFAULT 0,  -- Seguro de vida/saúde
  ADD COLUMN IF NOT EXISTS valor_fgts         NUMERIC(12,2) DEFAULT 0,  -- FGTS (encargo patronal)
  ADD COLUMN IF NOT EXISTS valor_gps          NUMERIC(12,2) DEFAULT 0,  -- GPS / Perfil previdenciário
  ADD COLUMN IF NOT EXISTS valor_dec_terceiro NUMERIC(12,2) DEFAULT 0,  -- 13º Salário (proporcional manual)
  ADD COLUMN IF NOT EXISTS valor_ferias       NUMERIC(12,2) DEFAULT 0,  -- Férias + 1/3 constitucional (manual)
  ADD COLUMN IF NOT EXISTS employee_type      TEXT DEFAULT 'CLT';       -- CLT | PJ | Estagio | Outro

-- Aplicar as mesmas colunas na tabela de teste
ALTER TABLE people_monthly_costs_test
  ADD COLUMN IF NOT EXISTS valor_desconto     NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_vr           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_vt           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_seguro       NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_fgts         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_gps          NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_dec_terceiro NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_ferias       NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employee_type      TEXT DEFAULT 'CLT';

-- 2. TABELA DE REPASSES DE TERCEIRIZAÇÃO (por competência)
-- Substitui o localStorage por persistência real no Supabase

CREATE TABLE IF NOT EXISTS outsourcing_repasses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia   TEXT NOT NULL,                    -- formato YYYY-MM
  date          DATE NOT NULL,                    -- data do repasse
  bank          TEXT NOT NULL,                    -- banco de origem
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0, -- valor repassado
  notes         TEXT DEFAULT '',                  -- observações / referência
  is_test       BOOLEAN DEFAULT FALSE,            -- flag de ambiente de teste
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por competência
CREATE INDEX IF NOT EXISTS idx_outsourcing_repasses_competencia
  ON outsourcing_repasses(competencia, is_test);

-- 3. TABELA DE CONFIGURAÇÕES DE APURAÇÃO POR COMPETÊNCIA
-- Armazena taxas (ISS, admin fee) por competência no banco

CREATE TABLE IF NOT EXISTS outsourcing_apuracao_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia     TEXT NOT NULL UNIQUE,           -- formato YYYY-MM
  tax_input_mode  TEXT DEFAULT 'rate',            -- 'rate' | 'amount'
  tax_rate        NUMERIC(6,4) DEFAULT 5.0,       -- alíquota ISS (%)
  tax_fixed       NUMERIC(12,2) DEFAULT 0,        -- ISS valor fixo
  admin_fee_mode  TEXT DEFAULT 'rate',            -- 'rate' | 'amount' (percentual ou fixo)
  admin_fee_rate  NUMERIC(6,4) DEFAULT 10.0,      -- taxa administrativa (%)
  admin_fee_fixed NUMERIC(12,2) DEFAULT 0,        -- taxa administrativa valor fixo (R$)
  is_test         BOOLEAN DEFAULT FALSE,
  saved_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outsourcing_config_competencia
  ON outsourcing_apuracao_config(competencia, is_test);

-- 4. RECARREGAR SCHEMA DO POSTGREST
NOTIFY pgrst, 'reload schema';
