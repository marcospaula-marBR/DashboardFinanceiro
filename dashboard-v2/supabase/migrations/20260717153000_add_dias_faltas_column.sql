-- Migration: Adiciona coluna dias_faltas para quantitativo de faltas no custo CLT
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS dias_faltas NUMERIC DEFAULT 0;

-- Recarrega o cache de schemas para a API reconhecer as colunas imediatamente
NOTIFY pgrst, 'reload schema';
