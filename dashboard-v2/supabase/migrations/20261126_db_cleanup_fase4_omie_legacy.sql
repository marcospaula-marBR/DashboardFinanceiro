-- ==============================================================================
-- LIMPEZA FASE 4: DESCOMISSIONAMENTO DAS 7 TABELAS LEGADAS DO PIPELINE ANTIGO
--                 E SANEAMENTO DE PLACEHOLDERS NAS DIMENSÕES OMIE
-- Versão: v.02.60.40
-- Data: 2026-11-26
-- Status: AGUARDANDO EXECUÇÃO EXPLÍCITA NO SUPABASE SQL EDITOR (APÓS CONFIRMAR NOVO WORKFLOW)
--
-- Pré-requisitos atendidos pelo código em v.02.60.40:
--   • .github/workflows/omie_sync.yml e sincronizar_omie.ps1 migrados para
--     sync_omie_unified_v4.py (que grava exclusivamente em omie_financas_unificado
--     e nas 3 tabelas ativas: omie_dim_categorias, omie_dim_projetos, omie_dim_fornecedores).
--   • Nenhum componente do Dashboard v2 lê as 7 tabelas do Bloco 1.
--   • IMPORTANTE: Este script NÃO usa CASCADE para evitar remoções silenciosas.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- BLOCO 1 (ATIVO): 7 TABELAS LEGADAS DO ANTIGO omie_supabase_ingest.py (~235k linhas)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.omie_cp_allocations;
DROP TABLE IF EXISTS public.omie_cp_departamentos;
DROP TABLE IF EXISTS public.omie_cp_categorias;
DROP TABLE IF EXISTS public.omie_cp_titulos;
DROP TABLE IF EXISTS public.omie_mov_saidas;
DROP TABLE IF EXISTS public.omie_dim_dre;
DROP TABLE IF EXISTS public.omie_sync_logs;

-- ------------------------------------------------------------------------------
-- BLOCO 2 (ATIVO): SANEAMENTO DE REGISTROS *_ID_PLACEHOLDER NAS DIMENSÕES ATIVAS
-- ------------------------------------------------------------------------------
DELETE FROM public.omie_dim_categorias
WHERE empresa_id IN ('DZM_ID_PLACEHOLDER', 'MARBRASIL_ID_PLACEHOLDER');

DELETE FROM public.omie_dim_fornecedores
WHERE empresa_id IN ('DZM_ID_PLACEHOLDER', 'MARBRASIL_ID_PLACEHOLDER');

COMMIT;

-- ------------------------------------------------------------------------------
-- BLOCO 3: CONFERÊNCIA PÓS-EXECUÇÃO (SOMENTE LEITURA)
-- Esperado após Fase 4: 41 BASE TABLE e 0 VIEW
-- ------------------------------------------------------------------------------
SELECT
  table_type,
  COUNT(*) AS total_objetos
FROM information_schema.tables
WHERE table_schema = 'public'
GROUP BY table_type
ORDER BY table_type;
