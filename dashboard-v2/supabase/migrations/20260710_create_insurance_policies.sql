-- Migration: Criação da tabela de Apólices de Seguro
-- Versão: v.02.48.97
-- Data: 2026-07-10

CREATE TABLE IF NOT EXISTS insurance_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identificação
  contratante TEXT NOT NULL DEFAULT '',      -- Empresa contratante: Mar Brasil | DZM
  tipo TEXT NOT NULL DEFAULT '',            -- Tipo de seguro: Automóvel, Saúde, RC, etc.
  segurado TEXT DEFAULT '',                 -- Bem ou pessoa segurada
  
  -- Seguradora e Apólice
  seguradora TEXT DEFAULT '',              -- Nome da seguradora
  apolice TEXT DEFAULT '',                 -- Número da apólice
  senha TEXT DEFAULT '',                   -- Senha do portal da seguradora
  assistencia_24h TEXT DEFAULT '',         -- Telefone emergência 24h
  
  -- Vigência
  inicio DATE,                             -- Início da vigência
  vencimento DATE,                         -- Fim da vigência
  
  -- Financeiro
  premio NUMERIC(12,2) DEFAULT 0,          -- Prêmio total
  parcelas_total INTEGER DEFAULT 1,        -- Quantidade de parcelas
  valor_parcela NUMERIC(12,2) DEFAULT 0,  -- Valor por parcela
  dia_pgto TEXT DEFAULT '',               -- Dia de pagamento
  formato_parcelas TEXT DEFAULT '',        -- Recorrente, Mensal, Anual, etc.
  
  -- Corretor
  corretor TEXT DEFAULT '',               -- Nome do corretor
  telefone_corretor TEXT DEFAULT '',      -- WhatsApp/Telefone do corretor
  email_corretor TEXT DEFAULT '',         -- E-mail do corretor
  indicador TEXT DEFAULT '',             -- Quem indicou o corretor/seguro
  
  -- Controle
  ativo BOOLEAN DEFAULT TRUE,            -- Apólice ativa?
  observacoes TEXT DEFAULT '',           -- Observações livres
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_insurance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_insurance_updated_at
  BEFORE UPDATE ON insurance_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_insurance_updated_at();

-- RLS (Row Level Security) — permissivo como demais tabelas do projeto
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON insurance_policies
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_insurance_contratante ON insurance_policies(contratante);
CREATE INDEX IF NOT EXISTS idx_insurance_tipo ON insurance_policies(tipo);
CREATE INDEX IF NOT EXISTS idx_insurance_vencimento ON insurance_policies(vencimento);
CREATE INDEX IF NOT EXISTS idx_insurance_ativo ON insurance_policies(ativo);

-- Comentários para documentação
COMMENT ON TABLE insurance_policies IS 'Apólices de seguro do Grupo Mar Brasil. Migrada do sistema legado (seguros.html + dados-seguros.csv) em 2026-07-10.';
COMMENT ON COLUMN insurance_policies.senha IS 'Senha do portal da seguradora. Exibida à mostra na interface (campo sensível, uso interno).';
