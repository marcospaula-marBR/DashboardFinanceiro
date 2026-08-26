-- =======================================================
-- MIGRATION V6: dre_lancamentos (fornecedor + conta_corrente)
-- Adiciona suporte a filtros por Fornecedor e Conta Corrente na DRE
--
-- COMO EXECUTAR:
-- 1. Abra o Supabase Studio: https://supabase.com/dashboard
-- 2. Vá em "SQL Editor"
-- 3. Cole todo este conteúdo e clique em "Run"
-- =======================================================

-- 1. ADICIONAR COLUNAS COM VALORES DEFAULT RESILIENTES
ALTER TABLE public.dre_lancamentos 
  ADD COLUMN IF NOT EXISTS fornecedor text NOT NULL DEFAULT 'Sem Fornecedor',
  ADD COLUMN IF NOT EXISTS conta_corrente text NOT NULL DEFAULT 'Sem Conta Corrente';

-- 2. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON COLUMN public.dre_lancamentos.fornecedor IS 'Nome fantasia ou razão social do fornecedor/prestador/cliente do lançamento (Omie: "Cliente ou Fornecedor").';
COMMENT ON COLUMN public.dre_lancamentos.conta_corrente IS 'Conta bancária ou caixa de movimentação do recurso (Omie: "Conta Corrente").';

-- 3. ATUALIZAR CONSTRAINT DE UNICIDADE DIMENSIONAL
-- Remove constraint antiga se existir
ALTER TABLE public.dre_lancamentos 
  DROP CONSTRAINT IF EXISTS dre_lancamentos_empresa_departamento_conta_dre_projeto_ca_key,
  DROP CONSTRAINT IF EXISTS dre_lancamentos_dim_unique;

-- Cria nova constraint única incluindo fornecedor e conta_corrente
ALTER TABLE public.dre_lancamentos 
  ADD CONSTRAINT dre_lancamentos_dim_unique 
  UNIQUE (empresa, departamento, conta_dre, projeto, categoria, fornecedor, conta_corrente, periodo, fonte);

-- 4. ÍNDICES PARA OTIMIZAÇÃO DE BUSCA E FILTRAGEM
CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_fornecedor
  ON public.dre_lancamentos(fornecedor);

CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_conta_corrente
  ON public.dre_lancamentos(conta_corrente);

CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_empresa_fornecedor
  ON public.dre_lancamentos(empresa, fornecedor);

CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_empresa_conta_corrente
  ON public.dre_lancamentos(empresa, conta_corrente);
