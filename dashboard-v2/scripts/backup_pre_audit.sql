-- =============================================================================
-- backup_pre_audit.sql
-- Snapshot das tabelas de produção no próprio Supabase
-- Data: 2026-06-16 | Pré-auditoria de parcelas excedentes
--
-- COMO USAR:
--   Cole este script inteiro no Supabase SQL Editor e execute.
--   Ele cria cópias com sufixo _bkp_20260616 que NÃO são tocadas pelo app.
--
-- COMO RESTAURAR (se precisar):
--   Veja a seção "RESTAURAÇÃO" no final deste arquivo.
-- =============================================================================

-- ─── PASSO 1: Criar snapshots ────────────────────────────────────────────────

-- Remove snapshots anteriores se existirem (idempotente)
DROP TABLE IF EXISTS employee_loans_bkp_20260616;
DROP TABLE IF EXISTS loan_payments_bkp_20260616;

-- Cria cópia completa de employee_loans (contratos)
CREATE TABLE employee_loans_bkp_20260616 AS
SELECT * FROM employee_loans;

-- Cria cópia completa de loan_payments (parcelas — alvo da auditoria)
CREATE TABLE loan_payments_bkp_20260616 AS
SELECT * FROM loan_payments;


-- ─── PASSO 2: Verificar integridade dos snapshots ────────────────────────────

SELECT
  'employee_loans'            AS tabela_original,
  'employee_loans_bkp_20260616' AS tabela_backup,
  (SELECT COUNT(*) FROM employee_loans)              AS registros_originais,
  (SELECT COUNT(*) FROM employee_loans_bkp_20260616) AS registros_backup,
  CASE
    WHEN (SELECT COUNT(*) FROM employee_loans) = (SELECT COUNT(*) FROM employee_loans_bkp_20260616)
    THEN '✅ OK — contagens idênticas'
    ELSE '❌ DIVERGÊNCIA — verifique!'
  END AS status

UNION ALL

SELECT
  'loan_payments'              AS tabela_original,
  'loan_payments_bkp_20260616' AS tabela_backup,
  (SELECT COUNT(*) FROM loan_payments)               AS registros_originais,
  (SELECT COUNT(*) FROM loan_payments_bkp_20260616)  AS registros_backup,
  CASE
    WHEN (SELECT COUNT(*) FROM loan_payments) = (SELECT COUNT(*) FROM loan_payments_bkp_20260616)
    THEN '✅ OK — contagens idênticas'
    ELSE '❌ DIVERGÊNCIA — verifique!'
  END AS status;


-- ─── PASSO 3: Relatório de parcelas por status (diagnóstico pré-auditoria) ──

SELECT
  status,
  COUNT(*)                                          AS total_parcelas,
  ROUND(SUM(amount)::NUMERIC, 2)                    AS valor_total,
  ROUND(AVG(amount)::NUMERIC, 2)                    AS valor_medio
FROM loan_payments
GROUP BY status
ORDER BY status;


-- ─── PASSO 4: Contratos com possível excesso de parcelas pagas ───────────────

SELECT
  lp.contract_id,
  el.amount                                         AS valor_contrato,
  el.installments                                   AS parcelas_esperadas,
  COUNT(*) FILTER (WHERE lp.status = 'PAGO')        AS parcelas_pagas,
  COUNT(*) FILTER (WHERE lp.status = 'PAGO') - el.installments AS excesso,
  e.full_name                                       AS colaborador
FROM loan_payments lp
JOIN employee_loans el ON el.id = lp.contract_id
JOIN employees e       ON e.id  = el.employee_id
GROUP BY lp.contract_id, el.amount, el.installments, e.full_name
HAVING COUNT(*) FILTER (WHERE lp.status = 'PAGO') > el.installments
ORDER BY excesso DESC;


-- =============================================================================
-- RESTAURAÇÃO (use APENAS se precisar desfazer alterações)
-- =============================================================================
/*

-- Restaurar employee_loans
TRUNCATE TABLE employee_loans;
INSERT INTO employee_loans SELECT * FROM employee_loans_bkp_20260616;

-- Restaurar loan_payments
TRUNCATE TABLE loan_payments;
INSERT INTO loan_payments SELECT * FROM loan_payments_bkp_20260616;

-- Verificar após restauração
SELECT 'employee_loans restaurado', COUNT(*) FROM employee_loans;
SELECT 'loan_payments restaurado',  COUNT(*) FROM loan_payments;

*/
-- =============================================================================
