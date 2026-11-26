-- ==============================================================================
-- LIMPEZA FASE 3: REMOÇÃO DE TABELAS E VIEWS SEM USO NO SUPABASE
-- Versão: v.02.60.39
-- Data: 2026-11-26
-- Status: AGUARDANDO EXECUÇÃO EXPLÍCITA NO SUPABASE SQL EDITOR
--
-- Pré-Auditoria Executada em 2026-11-26 (após execução da Fase 2):
--   • Objetos em public antes da Fase 3: 75 (73 tabelas + 2 views)
--   • Bloco 1 (Ativo): 27 objetos sem uso por nenhuma página ativa nem pelo
--     workflow automático .github/workflows/omie_sync.yml (2 views + 25 tabelas)
--   • Preservadas intactas:
--       - 31 tabelas em uso ativo pelo Dashboard v2 e HTMLs ativas
--       - 4 tabelas _test (Modo Teste de Empréstimos / People)
--       - 7 tabelas gravadas diariamente por omie_sync.yml / omie_supabase_ingest.py
--         (omie_cp_allocations, omie_cp_categorias, omie_cp_departamentos,
--          omie_cp_titulos, omie_mov_saidas, omie_sync_logs, omie_dim_dre)
--       - 6 tabelas do subprojeto corporate-profile-hub (comentadas no Bloco 2)
--   • Backups locais completos em JSON gerados em:
--       C:\Users\MarBrasil\.gemini\antigravity\brain\e21921fe-f240-49b8-b685-1625e60c6c18\scratch\supabase_backup_fase2_20261126\
--       C:\Users\MarBrasil\.gemini\antigravity\brain\e21921fe-f240-49b8-b685-1625e60c6c18\scratch\supabase_backup_fase3_20261126\
--   • IMPORTANTE: Este script NÃO usa CASCADE para evitar remoções silenciosas.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- BLOCO 1A (ATIVO): 2 VIEWS RESTANTES SEM USO NA INTERFACE
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_notas_fiscais_completas;
DROP VIEW IF EXISTS public.v_loans_consolidated;

-- ------------------------------------------------------------------------------
-- BLOCO 1B (ATIVO): 11 TABELAS DOS MÓDULOS REMOVIDOS NA FASE 1 E FASE 2
-- (Ordem segura de dependência: filhas antes das pais)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.comissoes;
DROP TABLE IF EXISTS public.recebimentos;
DROP TABLE IF EXISTS public.notas_fiscais;
DROP TABLE IF EXISTS public.contratos_base;
DROP TABLE IF EXISTS public.equipe;
DROP TABLE IF EXISTS public.impostos_trimestrais;

DROP TABLE IF EXISTS public.fluxo_caixa_projetado;
DROP TABLE IF EXISTS public.logs_sincronizacao_fluxo;
DROP TABLE IF EXISTS public.omie_raw;
DROP TABLE IF EXISTS public.omie_sync_raw;
DROP TABLE IF EXISTS public.omie_dre;

-- ------------------------------------------------------------------------------
-- BLOCO 1C (ATIVO): 14 TABELAS LEGADAS SEM USO EM NENHUMA PÁGINA ATIVA
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.user_permissions;
DROP TABLE IF EXISTS public.user_profiles;
DROP TABLE IF EXISTS public.modules;
DROP TABLE IF EXISTS public.financeiro_detalhado;
DROP TABLE IF EXISTS public.omie_olap_raw;
DROP TABLE IF EXISTS public.despesas;
DROP TABLE IF EXISTS public.dre_categoria_override;
DROP TABLE IF EXISTS public.headcount_mensal;
DROP TABLE IF EXISTS public.orcamentos;
DROP TABLE IF EXISTS public.event_rules_config;
DROP TABLE IF EXISTS public.people_employment_bonds;
DROP TABLE IF EXISTS public.erp_config;
DROP TABLE IF EXISTS public.sync_log;
DROP TABLE IF EXISTS public.dre_simulations;

-- ------------------------------------------------------------------------------
-- BLOCO 2 (OPCIONAL / COMENTADO): 6 TABELAS DO SUBPROJETO corporate-profile-hub
-- Descomente somente se confirmar que o subprojeto corporate-profile-hub não
-- utiliza mais este mesmo banco Supabase.
-- Nota: /api/omie/sync-raw (também legado) consultava public.companies.
-- ------------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.company_documents;
-- DROP TABLE IF EXISTS public.company_bank_data;
-- DROP TABLE IF EXISTS public.company_contacts;
-- DROP TABLE IF EXISTS public.company_branding;
-- DROP TABLE IF EXISTS public.company_addresses;
-- DROP TABLE IF EXISTS public.companies;

COMMIT;

-- ------------------------------------------------------------------------------
-- BLOCO 3: CONFERÊNCIA PÓS-EXECUÇÃO (SOMENTE LEITURA)
-- Esperado após Bloco 1: 48 BASE TABLE e 0 VIEW
-- ------------------------------------------------------------------------------
SELECT
  table_type,
  COUNT(*) AS total_objetos
FROM information_schema.tables
WHERE table_schema = 'public'
GROUP BY table_type
ORDER BY table_type;
