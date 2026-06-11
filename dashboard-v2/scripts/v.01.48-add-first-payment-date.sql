-- SQL v01.48 - Adicionar coluna first_payment_date para controle de vencimento customizado

-- 1. Alterar tabela de produção
ALTER TABLE employee_loans ADD COLUMN IF NOT EXISTS first_payment_date DATE;

-- 2. Alterar tabela de teste
ALTER TABLE employee_loans_test ADD COLUMN IF NOT EXISTS first_payment_date DATE;

-- 3. Mensagem de sucesso
SELECT 'Coluna first_payment_date adicionada com sucesso!' as status;
