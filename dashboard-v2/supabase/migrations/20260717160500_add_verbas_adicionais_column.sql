-- Migration: Adiciona coluna verbas_adicionais JSONB para suportar verbas extra-folha customizadas
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS verbas_adicionais JSONB DEFAULT '{}'::jsonb;

-- Recarrega o cache de schemas do PostgREST
NOTIFY pgrst, 'reload schema';
