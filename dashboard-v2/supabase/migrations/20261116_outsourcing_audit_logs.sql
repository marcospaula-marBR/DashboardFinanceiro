-- ==============================================================================
-- MIGRAÇÃO: AUDITORIA RELACIONAL & SNAPSHOTS DO MÓDULO DE TERCEIRIZAÇÃO
-- Versão: v.02.60.03
-- Data: 2026-11-16
-- ==============================================================================

-- 1. ÍNDICES DE PERFORMANCE NA TABELA RELACIONAL EXISTENTE public.audit_logs
-- Permite consultas rápidas por módulo (outsourcing_audit_logs / outsourcing_snapshots),
-- ação executada e ordenação cronológica descendente.

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_created
  ON public.audit_logs (table_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON public.audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON public.audit_logs (user_id, created_at DESC);

-- 2. TABELA DEDICADA PARA AUDITORIA ESTRUTURADA DE TERCEIRIZAÇÃO (OPCIONAL / FUTURO)
-- Complementa public.audit_logs com colunas tipadas para competência, métricas
-- e identificação automática via auth.uid().

CREATE TABLE IF NOT EXISTS public.outsourcing_audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id        UUID DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name     TEXT NOT NULL DEFAULT 'Sistema',
  actor_email    TEXT,
  competencia    TEXT NOT NULL,
  action         TEXT NOT NULL,
  summary        TEXT NOT NULL,
  details        TEXT,
  metrics        JSONB,
  old_data       JSONB,
  new_data       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_outsourcing_audit_logs_comp_created
  ON public.outsourcing_audit_logs (competencia, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outsourcing_audit_logs_action
  ON public.outsourcing_audit_logs (action, created_at DESC);

ALTER TABLE public.outsourcing_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de auditoria de terceirizacao" ON public.outsourcing_audit_logs;
CREATE POLICY "Leitura de auditoria de terceirizacao"
  ON public.outsourcing_audit_logs
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Insercao de auditoria de terceirizacao" ON public.outsourcing_audit_logs;
CREATE POLICY "Insercao de auditoria de terceirizacao"
  ON public.outsourcing_audit_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 3. RECARREGAR SCHEMA DO POSTGREST
NOTIFY pgrst, 'reload schema';
