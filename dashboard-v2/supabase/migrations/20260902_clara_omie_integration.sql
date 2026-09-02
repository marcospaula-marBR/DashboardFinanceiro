-- ============================================================================
-- MIGRATION: Integração Clara Cartões → Omie
-- Data: 2026-09-02
-- Descrição: Tabelas de controle, auditoria, mapeamento e fila para envio
--            de transações e comprovantes da Clara ao Omie ERP.
-- ============================================================================

-- 1. CONFIGURAÇÕES DA INTEGRAÇÃO
CREATE TABLE IF NOT EXISTS public.clara_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    client_id TEXT,
    client_secret TEXT,
    certificate_pem TEXT,
    private_key_pem TEXT,
    base_url TEXT DEFAULT 'https://public-api.br.clara.com',
    omie_n_cod_cc BIGINT,
    omie_cc_descricao TEXT,
    company_name TEXT DEFAULT 'Mar Brasil',
    auto_sync_enabled BOOLEAN DEFAULT FALSE,
    sync_interval_minutes INT DEFAULT 30,
    safe_mode BOOLEAN DEFAULT TRUE, -- Modo de Teste: gera payload sem disparar IncluirLancCC real
    default_omie_category TEXT,
    default_omie_department TEXT,
    block_if_unmapped BOOLEAN DEFAULT TRUE,
    overlap_days INT DEFAULT 3,
    last_connection_test TIMESTAMPTZ,
    last_connection_status TEXT,
    last_connection_message TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TRANSAÇÕES CLARA & VÍNCULO OMIE
CREATE TABLE IF NOT EXISTS public.clara_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clara_uuid TEXT NOT NULL UNIQUE,
    transaction_type TEXT NOT NULL, -- PURCHASE, REFUND, FEE, CREDIT, PAYMENT
    transaction_status TEXT NOT NULL, -- AUTHORIZED, NOTIFICATION, PRE_AUTHORIZED, REJECTED
    transaction_label TEXT,
    operation_date TIMESTAMPTZ,
    accounting_date TIMESTAMPTZ,
    last_update_date TIMESTAMPTZ,
    
    merchant_name TEXT,
    merchant_category TEXT,
    
    original_amount NUMERIC(14,2),
    original_currency TEXT DEFAULT 'BRL',
    amount NUMERIC(14,2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    
    authorization_number TEXT,
    card_uuid TEXT,
    card_last_digits TEXT,
    
    user_uuid TEXT,
    user_name TEXT,
    user_email TEXT,
    
    billing_statement_uuid TEXT,
    comment TEXT,
    labels JSONB DEFAULT '[]'::jsonb,
    accounting_fields JSONB DEFAULT '{}'::jsonb,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    
    -- Vínculo Omie
    omie_integration_id TEXT, -- cCodIntLanc determinístico
    omie_launch_id BIGINT,   -- nCodLanc retornado pelo Omie
    omie_account_id BIGINT,  -- nCodCC
    omie_category_code TEXT,
    omie_department_code TEXT,
    
    -- Anexos / Comprovantes
    has_attachments BOOLEAN DEFAULT FALSE,
    attachments_count INT DEFAULT 0,
    attachments_synced BOOLEAN DEFAULT FALSE,
    attachments_error TEXT,
    
    -- Status da Ponte
    sync_status TEXT DEFAULT 'PENDING', -- PENDING, MAPPING_REQUIRED, READY, SYNCING, SYNCED, UPDATED, IGNORED, ERROR
    sync_attempts INT DEFAULT 0,
    last_sync_attempt TIMESTAMPTZ,
    last_sync_error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_clara_tx_uuid ON public.clara_transactions(clara_uuid);
CREATE INDEX IF NOT EXISTS idx_clara_tx_status ON public.clara_transactions(sync_status);
CREATE INDEX IF NOT EXISTS idx_clara_tx_op_date ON public.clara_transactions(operation_date DESC);
CREATE INDEX IF NOT EXISTS idx_clara_tx_merchant ON public.clara_transactions(merchant_name);
CREATE INDEX IF NOT EXISTS idx_clara_tx_user ON public.clara_transactions(user_name);
CREATE INDEX IF NOT EXISTS idx_clara_tx_omie_launch ON public.clara_transactions(omie_launch_id);

-- 3. MAPEAMENTO DE CATEGORIAS (Clara -> Omie)
CREATE TABLE IF NOT EXISTS public.clara_category_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clara_category TEXT NOT NULL UNIQUE,
    omie_category_code TEXT NOT NULL,
    omie_category_desc TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MAPEAMENTO DE CENTROS DE CUSTO / DEPARTAMENTOS
CREATE TABLE IF NOT EXISTS public.clara_department_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mapping_type TEXT NOT NULL DEFAULT 'USER', -- USER, LABEL, CARD, FALLBACK
    clara_key TEXT NOT NULL,                  -- Nome do portador, nome do label ou 4 últimos dígitos
    omie_department_code TEXT NOT NULL,
    omie_department_desc TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT clara_dept_unique_key UNIQUE (mapping_type, clara_key)
);

-- 5. HISTÓRICO DE SINCRONIZAÇÕES (Runs)
CREATE TABLE IF NOT EXISTS public.clara_sync_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    trigger_type TEXT NOT NULL, -- MANUAL, SCHEDULED
    status TEXT DEFAULT 'RUNNING', -- RUNNING, SUCCESS, ERROR, PARTIAL
    transactions_received INT DEFAULT 0,
    transactions_created INT DEFAULT 0,
    transactions_updated INT DEFAULT 0,
    transactions_ignored INT DEFAULT 0,
    transactions_synced INT DEFAULT 0,
    transactions_failed INT DEFAULT 0,
    attachments_uploaded INT DEFAULT 0,
    error_message TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_clara_runs_started ON public.clara_sync_runs(started_at DESC);

-- 6. LOGS ATÔMICOS POR TRANSAÇÃO
CREATE TABLE IF NOT EXISTS public.clara_sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID REFERENCES public.clara_transactions(id) ON DELETE CASCADE,
    sync_run_id UUID REFERENCES public.clara_sync_runs(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- IMPORT, MAP, INCLUIR_LANC_CC, INCLUIR_ANEXO, RETRY, IGNORE
    status TEXT NOT NULL, -- SUCCESS, ERROR, SKIPPED
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clara_logs_tx ON public.clara_sync_logs(transaction_id);

-- Habilita RLS
ALTER TABLE public.clara_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clara_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clara_category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clara_department_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clara_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clara_sync_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso aberto com Service Role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clara_config' AND policyname = 'Allow all clara_config') THEN
    CREATE POLICY "Allow all clara_config" ON public.clara_config FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clara_transactions' AND policyname = 'Allow all clara_transactions') THEN
    CREATE POLICY "Allow all clara_transactions" ON public.clara_transactions FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clara_category_mappings' AND policyname = 'Allow all clara_category_mappings') THEN
    CREATE POLICY "Allow all clara_category_mappings" ON public.clara_category_mappings FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clara_department_mappings' AND policyname = 'Allow all clara_department_mappings') THEN
    CREATE POLICY "Allow all clara_department_mappings" ON public.clara_department_mappings FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clara_sync_runs' AND policyname = 'Allow all clara_sync_runs') THEN
    CREATE POLICY "Allow all clara_sync_runs" ON public.clara_sync_runs FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clara_sync_logs' AND policyname = 'Allow all clara_sync_logs') THEN
    CREATE POLICY "Allow all clara_sync_logs" ON public.clara_sync_logs FOR ALL USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;
