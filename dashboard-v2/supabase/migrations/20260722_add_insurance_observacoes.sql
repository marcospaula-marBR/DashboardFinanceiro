-- Migration: Adiciona as colunas observacoes e pdf_url à tabela insurance_policies no Supabase
-- Versão: v.02.50.39
-- Data: 2026-07-22

ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS observacoes TEXT DEFAULT '';
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS pdf_url TEXT DEFAULT '';
