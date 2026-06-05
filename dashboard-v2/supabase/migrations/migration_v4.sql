-- 1. ADIÇÃO DE COLUNAS DE CONTATO PROFISSIONAL (PRODUÇÃO & TESTE)
-- Adiciona os campos para armazenar e-mail e telefone corporativo dos colaboradores.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone_professional TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email_professional TEXT;

-- REPETIR ESTRUTURA PARA TABELA DE TESTES
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS phone_professional TEXT;
ALTER TABLE employees_test ADD COLUMN IF NOT EXISTS email_professional TEXT;
