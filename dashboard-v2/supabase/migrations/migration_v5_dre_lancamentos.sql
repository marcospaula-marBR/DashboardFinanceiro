-- =======================================================
-- MIGRATION V5: dre_lancamentos
-- Tabela de lançamentos DRE separados por origem
--
-- COMO EXECUTAR:
-- 1. Abra o Supabase Studio: https://supabase.com/dashboard
-- 2. Vá em "SQL Editor"
-- 3. Cole todo este conteúdo e clique em "Run"
-- =======================================================

-- 1. CRIAR TABELA PRINCIPAL
CREATE TABLE IF NOT EXISTS public.dre_lancamentos (
  id            uuid              DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa       text              NOT NULL,
  departamento  text              NOT NULL DEFAULT '',
  conta_dre     text              NOT NULL DEFAULT '',
  projeto       text              NOT NULL DEFAULT '',       -- 'N/D' para dados fora do Omie
  categoria     text              NOT NULL,
  periodo       text              NOT NULL,                  -- formato: "Jan/24", "Jun/25"
  valor         numeric(15,2)     NOT NULL DEFAULT 0,
  fonte         text              NOT NULL CHECK (fonte IN ('omie', 'manual')),
  created_at    timestamptz       DEFAULT now(),
  updated_at    timestamptz       DEFAULT now(),

  -- Chave única por combinação dimensional + fonte
  -- Garante que upsert Omie nunca sobrescreva manual e vice-versa
  UNIQUE (empresa, departamento, conta_dre, projeto, categoria, periodo, fonte)
);

-- 2. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON TABLE  public.dre_lancamentos IS 'Lançamentos DRE separados por fonte. fonte=omie: upsert a cada novo CSV. fonte=manual: permanente, nunca sobrescrito pelo Omie.';
COMMENT ON COLUMN public.dre_lancamentos.fonte IS 'omie = dados do ERP Omie (Mar Brasil, DZM jun/25+). manual = dados históricos ou empresas fora do Omie (Conectius, Ybox, pré-jun/25).';
COMMENT ON COLUMN public.dre_lancamentos.periodo IS 'Competência no formato Mmm/YY, ex: Jan/24, Jun/25, Mai/26';

-- 3. HABILITAR ROW LEVEL SECURITY (padrão do projeto)
ALTER TABLE public.dre_lancamentos ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE ACESSO (mesmo padrão das tabelas existentes)
-- Permite leitura pública autenticada
CREATE POLICY "dre_lancamentos_select"
  ON public.dre_lancamentos
  FOR SELECT
  USING (true);

-- Permite escrita via service_role (scripts e API interna)
CREATE POLICY "dre_lancamentos_insert"
  ON public.dre_lancamentos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "dre_lancamentos_update"
  ON public.dre_lancamentos
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "dre_lancamentos_delete"
  ON public.dre_lancamentos
  FOR DELETE
  USING (true);

-- 5. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_empresa
  ON public.dre_lancamentos(empresa);

CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_periodo
  ON public.dre_lancamentos(periodo);

CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_fonte
  ON public.dre_lancamentos(fonte);

CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_categoria
  ON public.dre_lancamentos(categoria);

-- Índice composto para os filtros mais comuns do dashboard
CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_empresa_periodo
  ON public.dre_lancamentos(empresa, periodo);

-- 6. TRIGGER para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_dre_lancamentos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dre_lancamentos_updated_at
  BEFORE UPDATE ON public.dre_lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dre_lancamentos_updated_at();

-- =======================================================
-- VERIFICAÇÃO APÓS EXECUÇÃO:
-- Execute as queries abaixo para confirmar que deu certo:
--
-- SELECT COUNT(*) FROM public.dre_lancamentos;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'dre_lancamentos' ORDER BY ordinal_position;
-- =======================================================
