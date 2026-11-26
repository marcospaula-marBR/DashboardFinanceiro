-- ==============================================================================
-- OTIMIZAÇÃO DO PLANO FREE SUPABASE (DATABASE SIZE + EGRESS)
-- Versão: v.02.60.41
-- Data: 2026-11-26
-- Status: AGUARDANDO EXECUÇÃO EXPLÍCITA NO SUPABASE SQL EDITOR
--
-- Pré-Auditoria (2026-11-26):
--   • Backup JSON completo de dre_snapshots salvo em:
--     C:\Users\MarBrasil\.gemini\antigravity\brain\e21921fe-f240-49b8-b685-1625e60c6c18\scratch\supabase_backup_free_plan_20261126\dre_snapshots.json
--   • dre_snapshots: 33 linhas (~56,6 MB). Mantém os 3 mais recentes (~5 MB).
--   • omie_financas_unificado: 55.009 linhas (~144 MB), 87% em raw_data com chaves não usadas.
--
-- INSTRUÇÕES DE EXECUÇÃO EM 2 PASSOS NO SUPABASE SQL EDITOR:
--   PASSO 1: Execute este script como está (roda apenas a ETAPA 1 dentro de BEGIN/COMMIT).
--   PASSO 2: Após o COMMIT concluir, copie e rode SEPARADAMENTE os 3 comandos VACUUM FULL
--            da ETAPA 2 (eles precisam rodar fora de bloco BEGIN/COMMIT no Postgres).
-- ==============================================================================

-- ==============================================================================
-- ETAPA 1 (TRANSACIONAL): PODA DE dre_snapshots + COMPACTAÇÃO DE raw_data
-- ==============================================================================
BEGIN;

-- 1A. Guarda de segurança: só remove snapshots antigos se houver mais de 3 registros
DO $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.dre_snapshots;
  IF v_total > 3 THEN
    DELETE FROM public.dre_snapshots
    WHERE id NOT IN (
      SELECT id
      FROM public.dre_snapshots
      ORDER BY created_at DESC, id DESC
      LIMIT 3
    );
    RAISE NOTICE 'dre_snapshots podado: mantidos os 3 registros mais recentes de % totais.', v_total;
  ELSE
    RAISE NOTICE 'dre_snapshots possui apenas % registro(s); nenhuma remoção aplicada.', v_total;
  END IF;
END $$;

-- 1B. Compactação de raw_data em omie_financas_unificado
-- Preserva todos os campos lidos por /dre-caixa, /dre-painel e Conciliação PJ (/people),
-- removendo chaves pesadas não usadas (cnab_integracao_bancaria, boleto, categorias, etc.).
UPDATE public.omie_financas_unificado
SET raw_data = jsonb_strip_nulls(
  jsonb_build_object(
    'codigo_lancamento_omie', raw_data->'codigo_lancamento_omie',
    'status_titulo', raw_data->'status_titulo',
    'id_conta_corrente', raw_data->'id_conta_corrente',
    'nCodCC', raw_data->'nCodCC',
    'cContaCorrente', raw_data->'cContaCorrente',
    'id_origem', raw_data->'id_origem',
    'observacao', raw_data->'observacao',
    'codigo_cliente_fornecedor', raw_data->'codigo_cliente_fornecedor',
    'cnpj_cpf', raw_data->'cnpj_cpf',
    'cCPFCNPJCliente', raw_data->'cCPFCNPJCliente',
    'nm_cliente', raw_data->'nm_cliente',
    'nome_cliente', raw_data->'nome_cliente',
    'codigo_projeto', raw_data->'codigo_projeto',
    'nCodProjeto', raw_data->'nCodProjeto',
    'cCodProjeto', raw_data->'cCodProjeto',
    'numero_parcela', raw_data->'numero_parcela',
    'valor_documento', raw_data->'valor_documento',
    'valor_ir', raw_data->'valor_ir',
    'valor_iss', raw_data->'valor_iss',
    'valor_pis', raw_data->'valor_pis',
    'valor_cofins', raw_data->'valor_cofins',
    'valor_csll', raw_data->'valor_csll',
    'valor_inss', raw_data->'valor_inss',
    'data_vencimento', raw_data->'data_vencimento',
    'data_emissao', raw_data->'data_emissao',
    'cNumeroContrato', raw_data->'cNumeroContrato',
    'numero_pedido', raw_data->'numero_pedido',
    'chave_nfe', raw_data->'chave_nfe',
    'distribuicao', CASE
      WHEN jsonb_typeof(raw_data->'distribuicao') = 'array'
           AND jsonb_array_length(raw_data->'distribuicao') > 1 THEN (
        SELECT jsonb_agg(
          jsonb_strip_nulls(
            jsonb_build_object(
              'cDesDep', d->'cDesDep',
              'nValDep', d->'nValDep',
              'nPerDep', d->'nPerDep'
            )
          )
        )
        FROM jsonb_array_elements(raw_data->'distribuicao') d
      )
      ELSE NULL
    END,
    'info', CASE
      WHEN jsonb_typeof(raw_data->'info') = 'object' THEN NULLIF(
        jsonb_strip_nulls(
          jsonb_build_object(
            'uInc', raw_data->'info'->'uInc',
            'dInc', raw_data->'info'->'dInc'
          )
        ),
        '{}'::jsonb
      )
      ELSE NULL
    END,
    'cabecalho', CASE
      WHEN jsonb_typeof(raw_data->'cabecalho') = 'object' THEN NULLIF(
        jsonb_strip_nulls(
          jsonb_build_object(
            'cNumParcela', raw_data->'cabecalho'->'cNumParcela',
            'numero_parcela', raw_data->'cabecalho'->'numero_parcela'
          )
        ),
        '{}'::jsonb
      )
      ELSE NULL
    END,
    'resumo', CASE
      WHEN jsonb_typeof(raw_data->'resumo') = 'object' THEN NULLIF(
        jsonb_strip_nulls(
          jsonb_build_object(
            'nValPago', raw_data->'resumo'->'nValPago',
            'nValLiquido', raw_data->'resumo'->'nValLiquido'
          )
        ),
        '{}'::jsonb
      )
      ELSE NULL
    END,
    'detalhes', CASE
      WHEN jsonb_typeof(raw_data->'detalhes') = 'object' THEN NULLIF(
        jsonb_strip_nulls(
          jsonb_build_object(
            'nCodTitulo', raw_data->'detalhes'->'nCodTitulo',
            'cCodCateg', raw_data->'detalhes'->'cCodCateg',
            'cDesCateg', raw_data->'detalhes'->'cDesCateg',
            'cOrigem', raw_data->'detalhes'->'cOrigem',
            'cGrupo', raw_data->'detalhes'->'cGrupo',
            'cNatureza', raw_data->'detalhes'->'cNatureza',
            'observacao', raw_data->'detalhes'->'observacao',
            'cObservacao', raw_data->'detalhes'->'cObservacao',
            'cDesMov', raw_data->'detalhes'->'cDesMov',
            'nCodCC', raw_data->'detalhes'->'nCodCC',
            'cContaCorrente', raw_data->'detalhes'->'cContaCorrente',
            'nCodMovCC', raw_data->'detalhes'->'nCodMovCC',
            'cNumDocFiscal', raw_data->'detalhes'->'cNumDocFiscal',
            'nCodCliente', raw_data->'detalhes'->'nCodCliente',
            'cCPFCNPJCliente', raw_data->'detalhes'->'cCPFCNPJCliente',
            'cNomeCliente', raw_data->'detalhes'->'cNomeCliente',
            'cNomPessoa', raw_data->'detalhes'->'cNomPessoa',
            'cCodProjeto', raw_data->'detalhes'->'cCodProjeto',
            'nCodProjeto', raw_data->'detalhes'->'nCodProjeto',
            'cNumParcela', raw_data->'detalhes'->'cNumParcela',
            'cNumParc', raw_data->'detalhes'->'cNumParc',
            'numero_parcela', raw_data->'detalhes'->'numero_parcela',
            'nValorIR', raw_data->'detalhes'->'nValorIR',
            'nValorISS', raw_data->'detalhes'->'nValorISS',
            'nValorPIS', raw_data->'detalhes'->'nValorPIS',
            'nValorCOFINS', raw_data->'detalhes'->'nValorCOFINS',
            'nValorCSLL', raw_data->'detalhes'->'nValorCSLL',
            'nValorINSS', raw_data->'detalhes'->'nValorINSS',
            'nValorTitulo', raw_data->'detalhes'->'nValorTitulo',
            'dDtVenc', raw_data->'detalhes'->'dDtVenc',
            'dDtEmissao', raw_data->'detalhes'->'dDtEmissao',
            'cNumCtr', raw_data->'detalhes'->'cNumCtr',
            'cNumOS', raw_data->'detalhes'->'cNumOS',
            'cChaveNFe', raw_data->'detalhes'->'cChaveNFe',
            'cUsInc', raw_data->'detalhes'->'cUsInc',
            'dDtInc', raw_data->'detalhes'->'dDtInc'
          )
        ),
        '{}'::jsonb
      )
      ELSE NULL
    END
  )
)
WHERE raw_data IS NOT NULL
  AND raw_data <> '{}'::jsonb;

COMMIT;

-- ==============================================================================
-- ETAPA 2 (RODAR SEPARADAMENTE, FORA DE TRANSAÇÃO):
-- Copie apenas as linhas abaixo e execute em uma nova consulta no SQL Editor
-- para devolver imediatamente ao sistema o espaço liberado no disco:
-- ==============================================================================
-- VACUUM FULL ANALYZE public.omie_financas_unificado;
-- VACUUM FULL ANALYZE public.dre_snapshots;
-- VACUUM FULL ANALYZE public.employees;

-- ==============================================================================
-- CONFERÊNCIA DE TAMANHO REAL DAS TABELAS E DO BANCO (SOMENTE LEITURA)
-- ==============================================================================
SELECT
  relname AS tabela,
  pg_size_pretty(pg_total_relation_size(relid)) AS tamanho_total,
  n_live_tup AS linhas_ativas
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;

SELECT pg_size_pretty(pg_database_size(current_database())) AS tamanho_total_banco;
