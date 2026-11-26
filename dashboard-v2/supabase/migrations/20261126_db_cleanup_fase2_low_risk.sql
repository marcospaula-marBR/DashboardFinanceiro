-- ==============================================================================
-- LIMPEZA FASE 2: REMOÇÃO SEGURA DE BACKUPS CONGELADOS, TABELAS VAZIAS ÓRFÃS
--                 E VIEWS LEGADAS NÃO UTILIZADAS NO SUPABASE
-- Versão: v.02.60.38
-- Data: 2026-11-26
-- Status: AGUARDANDO EXECUÇÃO EXPLÍCITA NO SUPABASE SQL EDITOR
--
-- Pré-Auditoria Executada em 2026-11-26 (Somente-Leitura via REST/OpenAPI):
--   • Total de objetos no schema public antes da limpeza: 107 (98 tabelas + 9 views)
--   • Bloco 1 (Ativo — Baixo Risco): 32 objetos (13 backups + 11 vazias órfãs + 8 views legadas)
--   • Backup local em JSON gerado antes desta migração em:
--     C:\Users\MarBrasil\.gemini\antigravity\brain\e21921fe-f240-49b8-b685-1625e60c6c18\scratch\supabase_backup_fase2_20261126\
--   • IMPORTANTE: Este script NÃO usa CASCADE no Bloco 1 para evitar remoções silenciosas.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- GUARDA DE SEGURANÇA: ABORTA SE ALGUMA DAS 11 TABELAS VAZIAS RECEBEU DADOS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_table TEXT;
  v_cnt BIGINT;
  v_empty_tables TEXT[] := ARRAY[
    'clara_category_mappings',
    'clara_config',
    'clara_department_mappings',
    'clara_sync_logs',
    'contract_equipment',
    'financeiro_consolidado',
    'loan_operations_history',
    'notification_deliveries',
    'omie_contas_pagar',
    'omie_sync_data',
    'organization_members'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_empty_tables LOOP
    IF to_regclass('public.' || quote_ident(v_table)) IS NOT NULL THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I', v_table) INTO v_cnt;
      IF v_cnt > 0 THEN
        RAISE EXCEPTION 'Limpeza abortada: a tabela órfã public.% agora contém % registros. Revise antes de remover.', v_table, v_cnt;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- BLOCO 1A (ATIVO): 13 TABELAS DE BACKUP CONGELADAS (_bkp_ / _backup)
-- Backup JSON completo salvo em scratch/supabase_backup_fase2_20261126/
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.employees_bkp_20260624_pre_people_ui;
DROP TABLE IF EXISTS public.employees_test_bkp_20260624_pre_people_ui;
DROP TABLE IF EXISTS public.employees_loan_backup;
DROP TABLE IF EXISTS public.employee_loans_bkp_20260616;
DROP TABLE IF EXISTS public.employee_loans_bkp_20260624_pre_people_ui;
DROP TABLE IF EXISTS public.employee_loans_test_bkp_20260624_pre_people_ui;
DROP TABLE IF EXISTS public.employee_history_bkp_20260624_pre_people_ui;
DROP TABLE IF EXISTS public.employment_contracts_bkp_20260624_pre_people_ui;
DROP TABLE IF EXISTS public.loan_payments_backup;
DROP TABLE IF EXISTS public.loan_payments_bkp_20260616;
DROP TABLE IF EXISTS public.loan_payments_bkp_20260624_pre_people_ui;
DROP TABLE IF EXISTS public.loan_payments_test_bkp_20260624_pre_people_ui;
DROP TABLE IF EXISTS public.people_monthly_costs_bkp_20260624_pre_people_ui;

-- ------------------------------------------------------------------------------
-- BLOCO 1B (ATIVO): 11 TABELAS VAZIAS E SEM REFERÊNCIA NO CÓDIGO-FONTE
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.clara_category_mappings;
DROP TABLE IF EXISTS public.clara_config;
DROP TABLE IF EXISTS public.clara_department_mappings;
DROP TABLE IF EXISTS public.clara_sync_logs;
DROP TABLE IF EXISTS public.contract_equipment;
DROP TABLE IF EXISTS public.financeiro_consolidado;
DROP TABLE IF EXISTS public.loan_operations_history;
DROP TABLE IF EXISTS public.notification_deliveries;
DROP TABLE IF EXISTS public.omie_contas_pagar;
DROP TABLE IF EXISTS public.omie_sync_data;
DROP TABLE IF EXISTS public.organization_members;

-- ------------------------------------------------------------------------------
-- BLOCO 1C (ATIVO): 8 VIEWS SQL LEGADAS SEM CONSULTA NAS TELAS ATIVAS
-- (Ordem segura de dependência; NÃO afeta o bucket Storage 'contracts')
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.loan_projections;
DROP VIEW IF EXISTS public.loan_stats;
DROP VIEW IF EXISTS public.employee_loans_summary;
DROP VIEW IF EXISTS public.contracts;
DROP VIEW IF EXISTS public.contracts_expanded;
DROP VIEW IF EXISTS public.dados_csv;
DROP VIEW IF EXISTS public.dre_mensal;
DROP VIEW IF EXISTS public.dre_base_dashboard;

-- ------------------------------------------------------------------------------
-- BLOCO 2 (OPCIONAL / COMENTADO): TABELAS DOS MÓDULOS REMOVIDOS NA FASE 1,
-- FLUXO DE CAIXA (FASE 2) E TABELAS VAZIAS DE SYNC ANTIGO
-- Descomente somente as linhas que desejar remover definitivamente após validar
-- que não precisará mais destes dados históricos no banco.
-- (Todos os registros não-vazios já possuem cópia JSON em scratch/.)
-- ------------------------------------------------------------------------------
-- -- Fluxo de Caixa (página removida na Fase 2)
-- DROP TABLE IF EXISTS public.fluxo_caixa_projetado;
-- DROP TABLE IF EXISTS public.logs_sincronizacao_fluxo;
-- DROP TABLE IF EXISTS public.omie_dim_dre;
--
-- -- Recebíveis, Comissões e Gestão Integrada (páginas removidas na Fase 1)
-- DROP VIEW IF EXISTS public.v_notas_fiscais_completas;
-- DROP TABLE IF EXISTS public.comissoes;
-- DROP TABLE IF EXISTS public.recebimentos;
-- DROP TABLE IF EXISTS public.contratos_base;
-- DROP TABLE IF EXISTS public.equipe;
-- DROP TABLE IF EXISTS public.notas_fiscais;
-- DROP TABLE IF EXISTS public.impostos_trimestrais;
--
-- -- Tabelas vazias de rotas/scripts legados de sincronização Omie
-- DROP TABLE IF EXISTS public.omie_raw;
-- DROP TABLE IF EXISTS public.omie_sync_raw;
-- DROP TABLE IF EXISTS public.omie_dre;

COMMIT;

-- ------------------------------------------------------------------------------
-- BLOCO 3: CONFERÊNCIA PÓS-EXECUÇÃO (SOMENTE LEITURA)
-- ------------------------------------------------------------------------------
SELECT
  table_type,
  COUNT(*) AS total_objetos
FROM information_schema.tables
WHERE table_schema = 'public'
GROUP BY table_type
ORDER BY table_type;
