-- 1. HIGIENIZAÇÃO DA BASE DE DADOS (CADASTRO ÚNICO)
-- Remove todos os colaboradores que não possuem nenhum registro de empréstimo histórico ou ativo,
-- garantindo a integridade da tabela de empréstimos sem risco de perda de histórico financeiro.

DELETE FROM employees
WHERE id NOT IN (
  SELECT DISTINCT employee_id 
  FROM employee_loans
);

DELETE FROM employees_test
WHERE id NOT IN (
  SELECT DISTINCT employee_id 
  FROM employee_loans_test
);

-- 2. ADIÇÃO DE NOVAS COLUNAS CADASTRAIS (PRODUÇÃO & TESTE)

-- Colunas de Controle Trabalhista e Localidade
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_outsourced BOOLEAN DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS service_location TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_regime TEXT;

-- Colunas de Endereço do CNPJ (Para colaboradores PJ)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cnpj_zip_code TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cnpj_street TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cnpj_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cnpj_complement TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cnpj_neighborhood TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cnpj_city TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cnpj_state TEXT;

-- Colunas da Ficha Executiva
ALTER TABLE employees ADD COLUMN IF NOT EXISTS executive_summary TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS executive_link TEXT;

-- REPETIR ESTRUTURA PARA TABELA DE TESTES
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS is_outsourced BOOLEAN DEFAULT FALSE;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS service_location TEXT;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS tax_regime TEXT;

ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS cnpj_zip_code TEXT;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS cnpj_street TEXT;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS cnpj_number TEXT;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS cnpj_complement TEXT;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS cnpj_neighborhood TEXT;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS cnpj_city TEXT;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS cnpj_state TEXT;

ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS executive_summary TEXT;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS executive_link TEXT;
