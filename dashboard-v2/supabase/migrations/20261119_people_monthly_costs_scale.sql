-- ==============================================================================
-- MIGRAÇÃO FASE 3: ESCALA, UNICIDADE ATÔMICA E ANALYTICS DE CUSTOS (PEOPLE)
-- Versão: v.02.60.22
-- Data: 2026-11-19
-- Status: AGUARDANDO APROVAÇÃO EXPLÍCITA PARA EXECUÇÃO NO SUPABASE SQL EDITOR
--
-- Pré-Auditoria Executada em 2026-11-19 (Somente-Leitura):
--   • Total de linhas em public.people_monthly_costs: 2.152
--   • Duplicatas exatas (employee_id, competencia): 0
--   • Duplicatas no mesmo mês (employee_id, YYYY-MM): 0
--   • Linhas com dia != '01': 1 registro legado
--     (id = 'bd9cd59d-4bc2-43cf-ac8b-bc3f2556f25c', competencia = '2026-06-09',
--      vinculo_tipo = 'MEI', valor_liquido = 2959.31)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. GUARDA DE SEGURANÇA (ABORTA SE HOUVER QUALQUER DUPLICATA REAL)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT employee_id, competencia
    FROM public.people_monthly_costs
    GROUP BY employee_id, competencia
    HAVING COUNT(*) > 1
  ) d;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Migração abortada: existem % pares duplicados (employee_id, competencia) em people_monthly_costs. Resolva antes de criar a constraint UNIQUE.', v_dup_count;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. NORMALIZAÇÃO OPCIONAL DO REGISTRO LEGADO COM DIA != 01 (DESCOMENTE SE DESEJAR)
--    Auditado sem conflito no mês 2026-06 para o mesmo employee_id.
-- ------------------------------------------------------------------------------
-- UPDATE public.people_monthly_costs
-- SET competencia = date_trunc('month', competencia)::date
-- WHERE EXTRACT(DAY FROM competencia) <> 1;

-- ------------------------------------------------------------------------------
-- 3. CONSTRAINT UNIQUE ESTRUTURAL + ÍNDICES COMPOSTOS DE ALTA PERFORMANCE
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_people_monthly_costs_employee_competencia'
      AND conrelid = 'public.people_monthly_costs'::regclass
  ) THEN
    ALTER TABLE public.people_monthly_costs
      ADD CONSTRAINT uq_people_monthly_costs_employee_competencia
      UNIQUE (employee_id, competencia);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pmc_competencia_vinculo
  ON public.people_monthly_costs (competencia DESC, vinculo_tipo);

CREATE INDEX IF NOT EXISTS idx_pmc_employee_competencia_desc
  ON public.people_monthly_costs (employee_id, competencia DESC);

CREATE INDEX IF NOT EXISTS idx_pmc_origem_competencia
  ON public.people_monthly_costs (origem, competencia DESC);

-- ------------------------------------------------------------------------------
-- 4. RPC ATÔMICA DE GRAVAÇÃO EM LOTE (< 300ms EM 1 ÚNICA TRANSAÇÃO)
--    Elimina o gargalo N+1 (200+ chamadas HTTP sequenciais).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_people_monthly_costs_batch(p_records JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_min_comp DATE;
  v_max_comp DATE;
BEGIN
  IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' OR jsonb_array_length(p_records) = 0 THEN
    RETURN jsonb_build_object('upserted_count', 0, 'competencia_min', NULL, 'competencia_max', NULL);
  END IF;

  WITH normalized AS (
    SELECT
      (r->>'employee_id')::uuid AS employee_id,
      date_trunc('month', (r->>'competencia')::date)::date AS competencia,
      CASE
        WHEN UPPER(COALESCE(r->>'vinculo_tipo', 'CLT')) = 'CLT' THEN 'CLT'
        ELSE 'MEI'
      END AS vinculo_tipo,
      NULLIF(r->>'valor_holerite', '')::numeric AS valor_holerite,
      NULLIF(r->>'valor_adiantamento', '')::numeric AS valor_adiantamento,
      NULLIF(r->>'valor_hora_extra', '')::numeric AS valor_hora_extra,
      NULLIF(r->>'valor_adicional_not', '')::numeric AS valor_adicional_not,
      NULLIF(r->>'valor_vr', '')::numeric AS valor_vr,
      NULLIF(r->>'valor_vt', '')::numeric AS valor_vt,
      NULLIF(r->>'valor_ajuda_custo', '')::numeric AS valor_ajuda_custo,
      NULLIF(r->>'valor_cesta', '')::numeric AS valor_cesta,
      NULLIF(r->>'valor_ferias', '')::numeric AS valor_ferias,
      NULLIF(r->>'valor_rescisao', '')::numeric AS valor_rescisao,
      NULLIF(r->>'valor_decimo_terceiro', '')::numeric AS valor_decimo_terceiro,
      NULLIF(r->>'valor_descontos', '')::numeric AS valor_descontos,
      COALESCE(NULLIF(r->>'valor_liquido', '')::numeric, 0) AS valor_liquido,
      COALESCE(NULLIF(r->>'origem', ''), 'manual') AS origem,
      r->>'observacao' AS observacao,
      NULLIF(r->>'valor_fixo', '')::numeric AS valor_fixo,
      NULLIF(r->>'valor_bonus', '')::numeric AS valor_bonus,
      NULLIF(r->>'valor_comissao', '')::numeric AS valor_comissao,
      NULLIF(r->>'valor_incentivos', '')::numeric AS valor_incentivos,
      NULLIF(r->>'valor_glosa_base', '')::numeric AS valor_glosa_base,
      NULLIF(r->>'valor_glosa_bonus', '')::numeric AS valor_glosa_bonus,
      NULLIF(r->>'valor_deducoes', '')::numeric AS valor_deducoes,
      NULLIF(r->>'valor_faltas', '')::numeric AS valor_faltas,
      NULLIF(r->>'valor_consignado', '')::numeric AS valor_consignado,
      NULLIF(r->>'banco_horas', '')::numeric AS banco_horas,
      NULLIF(r->>'dias_faltas', '')::numeric AS dias_faltas,
      CASE
        WHEN r ? 'verbas_adicionais' AND jsonb_typeof(r->'verbas_adicionais') = 'object'
        THEN r->'verbas_adicionais'
        ELSE NULL
      END AS verbas_adicionais,
      ordinality
    FROM jsonb_array_elements(p_records) WITH ORDINALITY AS t(r, ordinality)
    WHERE NULLIF(r->>'employee_id', '') IS NOT NULL
      AND NULLIF(r->>'competencia', '') IS NOT NULL
  ),
  deduped AS (
    SELECT DISTINCT ON (employee_id, competencia)
      *
    FROM normalized
    ORDER BY employee_id, competencia, ordinality DESC
  ),
  upserted AS (
    INSERT INTO public.people_monthly_costs (
      employee_id, competencia, vinculo_tipo,
      valor_holerite, valor_adiantamento, valor_hora_extra, valor_adicional_not,
      valor_vr, valor_vt, valor_ajuda_custo, valor_cesta,
      valor_ferias, valor_rescisao, valor_decimo_terceiro, valor_descontos,
      valor_liquido, origem, observacao,
      valor_fixo, valor_bonus, valor_comissao, valor_incentivos,
      valor_glosa_base, valor_glosa_bonus, valor_deducoes,
      valor_faltas, valor_consignado, banco_horas, dias_faltas,
      verbas_adicionais
    )
    SELECT
      employee_id, competencia, vinculo_tipo,
      valor_holerite, valor_adiantamento, valor_hora_extra, valor_adicional_not,
      valor_vr, valor_vt, valor_ajuda_custo, valor_cesta,
      valor_ferias, valor_rescisao, valor_decimo_terceiro, valor_descontos,
      valor_liquido, origem, observacao,
      valor_fixo, valor_bonus, valor_comissao, valor_incentivos,
      valor_glosa_base, valor_glosa_bonus, valor_deducoes,
      valor_faltas, valor_consignado, banco_horas, dias_faltas,
      verbas_adicionais
    FROM deduped
    ON CONFLICT (employee_id, competencia) DO UPDATE SET
      vinculo_tipo          = EXCLUDED.vinculo_tipo,
      valor_holerite        = COALESCE(EXCLUDED.valor_holerite, public.people_monthly_costs.valor_holerite),
      valor_adiantamento    = COALESCE(EXCLUDED.valor_adiantamento, public.people_monthly_costs.valor_adiantamento),
      valor_hora_extra      = COALESCE(EXCLUDED.valor_hora_extra, public.people_monthly_costs.valor_hora_extra),
      valor_adicional_not   = COALESCE(EXCLUDED.valor_adicional_not, public.people_monthly_costs.valor_adicional_not),
      valor_vr              = COALESCE(EXCLUDED.valor_vr, public.people_monthly_costs.valor_vr),
      valor_vt              = COALESCE(EXCLUDED.valor_vt, public.people_monthly_costs.valor_vt),
      valor_ajuda_custo     = COALESCE(EXCLUDED.valor_ajuda_custo, public.people_monthly_costs.valor_ajuda_custo),
      valor_cesta           = COALESCE(EXCLUDED.valor_cesta, public.people_monthly_costs.valor_cesta),
      valor_ferias          = COALESCE(EXCLUDED.valor_ferias, public.people_monthly_costs.valor_ferias),
      valor_rescisao        = COALESCE(EXCLUDED.valor_rescisao, public.people_monthly_costs.valor_rescisao),
      valor_decimo_terceiro = COALESCE(EXCLUDED.valor_decimo_terceiro, public.people_monthly_costs.valor_decimo_terceiro),
      valor_descontos       = COALESCE(EXCLUDED.valor_descontos, public.people_monthly_costs.valor_descontos),
      valor_liquido         = EXCLUDED.valor_liquido,
      origem                = EXCLUDED.origem,
      observacao            = COALESCE(EXCLUDED.observacao, public.people_monthly_costs.observacao),
      valor_fixo            = COALESCE(EXCLUDED.valor_fixo, public.people_monthly_costs.valor_fixo),
      valor_bonus           = COALESCE(EXCLUDED.valor_bonus, public.people_monthly_costs.valor_bonus),
      valor_comissao        = COALESCE(EXCLUDED.valor_comissao, public.people_monthly_costs.valor_comissao),
      valor_incentivos      = COALESCE(EXCLUDED.valor_incentivos, public.people_monthly_costs.valor_incentivos),
      valor_glosa_base      = COALESCE(EXCLUDED.valor_glosa_base, public.people_monthly_costs.valor_glosa_base),
      valor_glosa_bonus     = COALESCE(EXCLUDED.valor_glosa_bonus, public.people_monthly_costs.valor_glosa_bonus),
      valor_deducoes        = COALESCE(EXCLUDED.valor_deducoes, public.people_monthly_costs.valor_deducoes),
      valor_faltas          = COALESCE(EXCLUDED.valor_faltas, public.people_monthly_costs.valor_faltas),
      valor_consignado      = COALESCE(EXCLUDED.valor_consignado, public.people_monthly_costs.valor_consignado),
      banco_horas           = COALESCE(EXCLUDED.banco_horas, public.people_monthly_costs.banco_horas),
      dias_faltas           = COALESCE(EXCLUDED.dias_faltas, public.people_monthly_costs.dias_faltas),
      verbas_adicionais     = COALESCE(EXCLUDED.verbas_adicionais, public.people_monthly_costs.verbas_adicionais)
    RETURNING competencia
  )
  SELECT COUNT(*), MIN(competencia), MAX(competencia)
  INTO v_count, v_min_comp, v_max_comp
  FROM upserted;

  RETURN jsonb_build_object(
    'upserted_count', v_count,
    'competencia_min', v_min_comp,
    'competencia_max', v_max_comp
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_people_monthly_costs_batch(JSONB) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. VIEW ENRIQUECIDA POR NATUREZA JURÍDICA (CLT / ESTAGIO / PJ)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_people_monthly_costs_enriched AS
SELECT
  pmc.id,
  pmc.employee_id,
  pmc.competencia,
  pmc.vinculo_tipo,
  CASE
    WHEN UPPER(COALESCE(e.employment_type, '')) LIKE '%ESTAG%' THEN 'ESTAGIO'
    WHEN pmc.vinculo_tipo = 'CLT' OR UPPER(COALESCE(e.employment_type, '')) LIKE '%CLT%' THEN 'CLT'
    ELSE 'PJ'
  END AS legal_nature,
  CASE
    WHEN (pmc.vinculo_tipo <> 'CLT' AND UPPER(COALESCE(e.employment_type, '')) NOT LIKE '%ESTAG%' AND NULLIF(TRIM(COALESCE(e.corporate_name, '')), '') IS NOT NULL)
    THEN TRIM(e.corporate_name)
    ELSE COALESCE(e.full_name, 'Sem nome')
  END AS display_name,
  e.full_name AS employee_name,
  e.corporate_name,
  COALESCE(e.company, 'MarBR') AS company,
  e.department,
  e.job_role,
  e.employment_type,
  e.status AS employee_status,
  e.document_id,
  e.pj_type AS cnpj,
  e.remuneration_fixed,
  pmc.valor_holerite,
  pmc.valor_fixo,
  pmc.valor_hora_extra,
  pmc.valor_adicional_not,
  pmc.valor_adiantamento,
  pmc.valor_vt,
  pmc.valor_vr,
  pmc.valor_cesta,
  pmc.valor_bonus,
  pmc.valor_comissao,
  pmc.valor_incentivos,
  pmc.valor_ajuda_custo,
  pmc.valor_ferias,
  pmc.valor_rescisao,
  pmc.valor_decimo_terceiro,
  pmc.valor_descontos,
  pmc.valor_glosa_base,
  pmc.valor_glosa_bonus,
  pmc.valor_deducoes,
  pmc.valor_liquido,
  pmc.origem,
  pmc.observacao,
  pmc.created_at
FROM public.people_monthly_costs pmc
LEFT JOIN public.employees e ON e.id = pmc.employee_id;

GRANT SELECT ON public.vw_people_monthly_costs_enriched TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC AGREGADORA DE KPIs POR COMPETÊNCIA X EMPRESA X NATUREZA JURÍDICA
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_people_monthly_costs_kpis(
  p_year INT DEFAULT NULL,
  p_company TEXT DEFAULT NULL
)
RETURNS TABLE (
  competencia DATE,
  company TEXT,
  legal_nature TEXT,
  rows_count BIGINT,
  total_liquido NUMERIC,
  total_vt NUMERIC,
  total_vr_cesta NUMERIC,
  total_bonus NUMERIC,
  total_premiacao NUMERIC,
  total_descontos NUMERIC,
  total_adiantamento NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.competencia,
    v.company,
    v.legal_nature,
    COUNT(*)::BIGINT AS rows_count,
    ROUND(COALESCE(SUM(v.valor_liquido), 0), 2) AS total_liquido,
    ROUND(COALESCE(SUM(CASE WHEN v.legal_nature <> 'PJ' THEN COALESCE(v.valor_vt, 0) ELSE 0 END), 0), 2) AS total_vt,
    ROUND(COALESCE(SUM(CASE WHEN v.legal_nature = 'CLT' THEN COALESCE(v.valor_cesta, 0) + COALESCE(v.valor_vr, 0) ELSE 0 END), 0), 2) AS total_vr_cesta,
    ROUND(COALESCE(SUM(COALESCE(v.valor_bonus, 0)), 0), 2) AS total_bonus,
    ROUND(COALESCE(SUM(COALESCE(v.valor_ajuda_custo, 0)), 0), 2) AS total_premiacao,
    ROUND(COALESCE(SUM(CASE WHEN v.legal_nature = 'PJ' THEN COALESCE(v.valor_deducoes, 0) + COALESCE(v.valor_glosa_base, 0) + COALESCE(v.valor_glosa_bonus, 0) ELSE COALESCE(v.valor_descontos, 0) END), 0), 2) AS total_descontos,
    ROUND(COALESCE(SUM(CASE WHEN v.legal_nature <> 'PJ' THEN COALESCE(v.valor_adiantamento, 0) ELSE 0 END), 0), 2) AS total_adiantamento
  FROM public.vw_people_monthly_costs_enriched v
  WHERE (p_year IS NULL OR EXTRACT(YEAR FROM v.competencia)::INT = p_year)
    AND (p_company IS NULL OR p_company = '' OR UPPER(v.company) = UPPER(p_company))
  GROUP BY v.competencia, v.company, v.legal_nature
  ORDER BY v.competencia DESC, v.company ASC, v.legal_nature ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_people_monthly_costs_kpis(INT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. RECARREGAR SCHEMA DO POSTGREST
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==============================================================================
-- ROLLBACK MANUAL (SE NECESSÁRIO REVERTER ESTA MIGRAÇÃO):
--   DROP FUNCTION IF EXISTS public.get_people_monthly_costs_kpis(INT, TEXT);
--   DROP VIEW IF EXISTS public.vw_people_monthly_costs_enriched;
--   DROP FUNCTION IF EXISTS public.upsert_people_monthly_costs_batch(JSONB);
--   ALTER TABLE public.people_monthly_costs DROP CONSTRAINT IF EXISTS uq_people_monthly_costs_employee_competencia;
--   DROP INDEX IF EXISTS public.idx_pmc_competencia_vinculo;
--   DROP INDEX IF EXISTS public.idx_pmc_employee_competencia_desc;
--   DROP INDEX IF EXISTS public.idx_pmc_origem_competencia;
-- ==============================================================================
