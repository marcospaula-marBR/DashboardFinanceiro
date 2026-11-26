-- ==============================================================================
-- DRE STUDIO - FASE A: SCHEMA ISOLADO (ZERO IMPACTO NOS 3 MÓDULOS ATUAIS)
-- Versão: v.02.61.00
-- Data: 2026-11-26
-- Status: AGUARDANDO EXECUÇÃO EXPLÍCITA NO SUPABASE SQL EDITOR
--
-- Garantias:
--   1. NÃO cria, altera ou remove nada em omie_financas_unificado,
--      dre_lancamentos ou dre_snapshots.
--   2. Cada empresa preserva seu próprio plano de categorias via chave composta
--      (empresa_id, codigo_categoria) e dadosDRE oficiais do Omie.
--   3. Conciliação bancária real preenchida via ListarExtrato (conciliado +
--      data_conciliacao + situacao_extrato).
--   4. Script 100% idempotente (CREATE IF NOT EXISTS + checagem de policies).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.dre_studio_categorias (
  empresa_id TEXT NOT NULL,
  empresa_nome TEXT NOT NULL,
  codigo_categoria TEXT NOT NULL,
  descricao_categoria TEXT NOT NULL,
  codigo_dre TEXT,
  descricao_dre TEXT,
  sinal_dre TEXT,
  nao_exibir_dre BOOLEAN NOT NULL DEFAULT FALSE,
  transferencia BOOLEAN NOT NULL DEFAULT FALSE,
  conta_receita BOOLEAN NOT NULL DEFAULT FALSE,
  conta_despesa BOOLEAN NOT NULL DEFAULT FALSE,
  conta_inativa BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (empresa_id, codigo_categoria)
);

CREATE INDEX IF NOT EXISTS idx_dre_studio_cat_emp_nome
  ON public.dre_studio_categorias (empresa_nome, codigo_categoria);

CREATE TABLE IF NOT EXISTS public.dre_studio_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id TEXT NOT NULL,
  empresa_nome TEXT NOT NULL,
  omie_id BIGINT NOT NULL,
  tipo_registro TEXT NOT NULL,
  departamento_nome TEXT NOT NULL DEFAULT 'Sem Departamento',
  status TEXT,
  valor_documento NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_pago NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_alocado NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_alocado_bruto NUMERIC(15,2) NOT NULL DEFAULT 0,
  sinal SMALLINT NOT NULL DEFAULT -1,
  data_emissao DATE,
  data_registro DATE,
  data_vencimento DATE,
  data_previsao DATE,
  data_pagamento DATE,
  conciliado BOOLEAN NOT NULL DEFAULT FALSE,
  data_conciliacao DATE,
  situacao_extrato TEXT NOT NULL DEFAULT 'Sem extrato',
  categoria_codigo TEXT,
  categoria_nome TEXT,
  codigo_dre TEXT,
  conta_dre TEXT,
  sinal_dre TEXT,
  nao_exibir_dre BOOLEAN NOT NULL DEFAULT FALSE,
  projeto_codigo TEXT,
  projeto_nome TEXT,
  cliente_fornecedor_codigo TEXT,
  cliente_fornecedor TEXT,
  cnpj_cpf TEXT,
  conta_corrente_id TEXT,
  conta_corrente_nome TEXT,
  numero_documento TEXT,
  numero_parcela TEXT,
  chave_nfe TEXT,
  contrato_omie TEXT,
  observacao TEXT,
  impostos_retidos JSONB,
  rateios JSONB,
  raw_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dre_studio_lancamento UNIQUE (empresa_id, tipo_registro, omie_id, departamento_nome)
);

CREATE INDEX IF NOT EXISTS idx_dre_studio_lanc_emp_reg
  ON public.dre_studio_lancamentos (empresa_nome, data_registro);

CREATE INDEX IF NOT EXISTS idx_dre_studio_lanc_emp_pag
  ON public.dre_studio_lancamentos (empresa_nome, data_pagamento);

CREATE INDEX IF NOT EXISTS idx_dre_studio_lanc_emp_venc
  ON public.dre_studio_lancamentos (empresa_nome, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_dre_studio_lanc_emp_cat
  ON public.dre_studio_lancamentos (empresa_id, categoria_codigo);

CREATE INDEX IF NOT EXISTS idx_dre_studio_lanc_conciliado
  ON public.dre_studio_lancamentos (conciliado);

CREATE INDEX IF NOT EXISTS idx_dre_studio_lanc_status
  ON public.dre_studio_lancamentos (status);

ALTER TABLE public.dre_studio_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_studio_lancamentos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dre_studio_categorias' AND policyname = 'dre_studio_cat_service_all'
  ) THEN
    CREATE POLICY "dre_studio_cat_service_all"
      ON public.dre_studio_categorias FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dre_studio_categorias' AND policyname = 'dre_studio_cat_auth_read'
  ) THEN
    CREATE POLICY "dre_studio_cat_auth_read"
      ON public.dre_studio_categorias FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dre_studio_categorias' AND policyname = 'dre_studio_cat_anon_read'
  ) THEN
    CREATE POLICY "dre_studio_cat_anon_read"
      ON public.dre_studio_categorias FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dre_studio_lancamentos' AND policyname = 'dre_studio_lanc_service_all'
  ) THEN
    CREATE POLICY "dre_studio_lanc_service_all"
      ON public.dre_studio_lancamentos FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dre_studio_lancamentos' AND policyname = 'dre_studio_lanc_auth_read'
  ) THEN
    CREATE POLICY "dre_studio_lanc_auth_read"
      ON public.dre_studio_lancamentos FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dre_studio_lancamentos' AND policyname = 'dre_studio_lanc_anon_read'
  ) THEN
    CREATE POLICY "dre_studio_lanc_anon_read"
      ON public.dre_studio_lancamentos FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Verificação somente leitura
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('dre_studio_categorias', 'dre_studio_lancamentos')
ORDER BY table_name;
