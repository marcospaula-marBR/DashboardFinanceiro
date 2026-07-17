-- Migration: Adiciona colunas de Faltas, Consignados e Banco de Horas na tabela people_monthly_costs
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS valor_faltas NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS valor_consignado NUMERIC DEFAULT 0;
ALTER TABLE people_monthly_costs ADD COLUMN IF NOT EXISTS banco_horas NUMERIC DEFAULT 0;
