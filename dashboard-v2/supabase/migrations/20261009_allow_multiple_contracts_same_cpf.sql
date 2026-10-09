-- SQL MIGRATION: Permitir múltiplos contratos/vínculos (CLT + PJ / Estágio + PJ) para a mesma pessoa física (mesmo CPF)
-- Executar no Supabase SQL Editor: https://supabase.com/dashboard/project/ngtjhwswbbivqajtpjvg/sql/new

-- 1. Remover a restrição de unicidade em document_id para permitir histórico e múltiplos contratos por colaborador
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_document_id_key;
ALTER TABLE employees_test DROP CONSTRAINT IF EXISTS employees_test_document_id_key;

-- 2. Garantir que índices de busca por document_id e responsible_cpf continuem otimizados (sem unicidade estrita)
CREATE INDEX IF NOT EXISTS idx_employees_document_id ON employees(document_id);
CREATE INDEX IF NOT EXISTS idx_employees_responsible_cpf ON employees(responsible_cpf);
CREATE INDEX IF NOT EXISTS idx_employees_pj_type ON employees(pj_type);
