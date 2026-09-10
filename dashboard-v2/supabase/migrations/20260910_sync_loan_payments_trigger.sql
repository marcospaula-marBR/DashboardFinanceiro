-- ==============================================================================
-- MIGRATION: 20260910_sync_loan_payments_trigger.sql
-- DESCRIÇÃO: Gatilho no PostgreSQL para manter 'loan_payments.employee_id'
--            automaticamente sincronizado com 'employee_loans.employee_id'
--            sempre que um contrato for criado, reatribuído ou transferido.
-- ==============================================================================

-- 1. Função de sincronização para a tabela de produção (employee_loans -> loan_payments)
CREATE OR REPLACE FUNCTION public.fn_sync_loan_payments_employee_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o employee_id do contrato mudou
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    UPDATE public.loan_payments
    SET employee_id = NEW.employee_id,
        updated_at = NOW()
    WHERE contract_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Gatilho na tabela employee_loans
DROP TRIGGER IF EXISTS trg_sync_loan_payments_employee_id ON public.employee_loans;

CREATE TRIGGER trg_sync_loan_payments_employee_id
AFTER UPDATE OF employee_id ON public.employee_loans
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_loan_payments_employee_id();

-- 3. Função de sincronização para a tabela de testes (employee_loans_test -> loan_payments_test)
CREATE OR REPLACE FUNCTION public.fn_sync_loan_payments_test_employee_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    UPDATE public.loan_payments_test
    SET employee_id = NEW.employee_id,
        updated_at = NOW()
    WHERE contract_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Gatilho na tabela employee_loans_test
DROP TRIGGER IF EXISTS trg_sync_loan_payments_test_employee_id ON public.employee_loans_test;

CREATE TRIGGER trg_sync_loan_payments_test_employee_id
AFTER UPDATE OF employee_id ON public.employee_loans_test
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_loan_payments_test_employee_id();

-- 5. Comentário explicativo no catálogo PostgreSQL
COMMENT ON FUNCTION public.fn_sync_loan_payments_employee_id() IS 
'Garante paridade atômica entre o titular do contrato (employee_loans) e as parcelas filhas (loan_payments).';
