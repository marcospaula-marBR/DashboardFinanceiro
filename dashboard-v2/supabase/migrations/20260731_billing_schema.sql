-- ============================================================================
-- MIGRATION: MÓDULO DE FATURAMENTOS & PARAMETRIZAÇÃO DE CONTRATOS OMIE v.02.55.00
-- ============================================================================

-- 1. Tabela de Parametrização de Contratos (Regras que nunca virão do Omie)
CREATE TABLE IF NOT EXISTS public.billing_contracts (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    contract_number TEXT NOT NULL,
    contract_name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    segment_type TEXT NOT NULL DEFAULT 'B2B', -- 'B2G', 'B2B', 'B2C' (Consumidor Final exclusivo)
    is_outsourced BOOLEAN NOT NULL DEFAULT FALSE,
    has_commission BOOLEAN NOT NULL DEFAULT FALSE,
    value_non_commissionable NUMERIC(15,2) DEFAULT 0.00,
    commission_mode TEXT DEFAULT 'percent', -- 'percent' ou 'fixed'
    commission_rate NUMERIC(10,4) DEFAULT 0.00,
    commission_participants JSONB DEFAULT '[]'::jsonb, -- Colaboradores do People ou Setores
    segment_allocations JSONB DEFAULT '["B2B"]'::jsonb, -- Marcadores de rateio de despesas
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Faturamentos / Invoices Sincronizados e Tratados
CREATE TABLE IF NOT EXISTS public.billing_invoices (
    id TEXT PRIMARY KEY,
    omie_id BIGINT,
    company_name TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    contract_id TEXT REFERENCES public.billing_contracts(id) ON DELETE SET NULL,
    contract_number TEXT,
    contract_name TEXT,
    client_id BIGINT,
    client_name TEXT NOT NULL,
    segment_type TEXT NOT NULL DEFAULT 'B2B',
    is_outsourced BOOLEAN NOT NULL DEFAULT FALSE,
    date_registration DATE,
    date_issue DATE,
    date_due DATE,
    date_payment DATE,
    value_gross NUMERIC(15,2) DEFAULT 0.00,
    value_discount NUMERIC(15,2) DEFAULT 0.00,
    value_interest_penalty NUMERIC(15,2) DEFAULT 0.00,
    value_fees NUMERIC(15,2) DEFAULT 0.00,
    tax_pis NUMERIC(15,2) DEFAULT 0.00,
    tax_cofins NUMERIC(15,2) DEFAULT 0.00,
    tax_iss NUMERIC(15,2) DEFAULT 0.00,
    tax_inss NUMERIC(15,2) DEFAULT 0.00,
    tax_irrf NUMERIC(15,2) DEFAULT 0.00,
    tax_retained_total NUMERIC(15,2) DEFAULT 0.00,
    value_net NUMERIC(15,2) DEFAULT 0.00,
    status TEXT DEFAULT 'EM_ABERTO', -- 'EM_ABERTO', 'RECEBIDO', 'CANCELADO'
    commission_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Auditoria e Aprovação de Mudanças do Omie
CREATE TABLE IF NOT EXISTS public.billing_sync_audit (
    id TEXT PRIMARY KEY,
    sync_timestamp TIMESTAMPTZ DEFAULT NOW(),
    omie_id BIGINT NOT NULL,
    invoice_number TEXT NOT NULL,
    company_name TEXT NOT NULL,
    change_type TEXT NOT NULL, -- 'NEW_INVOICE', 'VALUE_CHANGE', 'STATUS_CHANGE', 'DATE_CHANGE'
    old_data JSONB,
    new_data JSONB NOT NULL,
    audit_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REJECTED'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_billing_invoices_company ON public.billing_invoices(company_name);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_date_reg ON public.billing_invoices(date_registration);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON public.billing_invoices(status);
CREATE INDEX IF NOT EXISTS idx_billing_audit_status ON public.billing_sync_audit(audit_status);
