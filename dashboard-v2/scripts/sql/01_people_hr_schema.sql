-- ==============================================================================
-- MIGRATION: PEOPLE HR V2 (Event Sourcing & Ciclo de Vida)
-- ==============================================================================

-- 1. ATUALIZAR TABELA MESTRE (employees)
-- Adicionando novas colunas caso ainda não existam. O Supabase permite blocos anônimos para evitar erros.
DO $$
BEGIN
    -- Informações Pessoais / Documentos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='rg') THEN
        ALTER TABLE employees ADD COLUMN rg VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='telefone_pessoal') THEN
        ALTER TABLE employees ADD COLUMN telefone_pessoal VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='email_pessoal') THEN
        ALTER TABLE employees ADD COLUMN email_pessoal VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='endereco_completo') THEN
        ALTER TABLE employees ADD COLUMN endereco_completo TEXT;
    END IF;

    -- Pessoa de Referência (Emergência/Contato)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='pessoa_referencia_nome') THEN
        ALTER TABLE employees ADD COLUMN pessoa_referencia_nome VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='pessoa_referencia_telefone') THEN
        ALTER TABLE employees ADD COLUMN pessoa_referencia_telefone VARCHAR(20);
    END IF;

    -- METADATA: Campo dinâmico em formato JSONB para suportar crescimento futuro sem alterar schema
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='metadata') THEN
        ALTER TABLE employees ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;


-- ==============================================================================
-- 2. CRIAR TABELA DE CONTRATOS (employment_contracts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS employment_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Atributos de Regime e Empresa Contratante
    regime VARCHAR(50) NOT NULL, -- Ex: 'PJ', 'CLT', 'MEI', 'ESTAGIARIO'
    contracting_company VARCHAR(255), -- Empresa do nosso grupo que está contratando
    
    -- Dados Específicos de PJ (Deixados como opcionais pois não aplicam a CLT)
    pj_cnpj VARCHAR(20),
    pj_razao_social VARCHAR(255),
    pj_nome_fantasia VARCHAR(255),
    pj_endereco_completo TEXT,
    
    -- Financeiro / Remuneração do Contrato (Fotografia do momento)
    remuneration_base NUMERIC(10, 2) DEFAULT 0,
    remuneration_bonus NUMERIC(10, 2) DEFAULT 0,
    remuneration_incentives NUMERIC(10, 2) DEFAULT 0,
    remuneration_allowances NUMERIC(10, 2) DEFAULT 0,
    remuneration_commissions NUMERIC(10, 2) DEFAULT 0,
    
    -- Linha do Tempo e Ciclo de Vida
    start_date DATE NOT NULL,
    expiration_date DATE, -- Para gestão de renovações
    end_date DATE, -- Data efetiva de encerramento
    trigger_reason VARCHAR(255), -- Ex: "Novo Contrato", "Renovação Automática", "Aumento Salarial"
    status VARCHAR(50) DEFAULT 'Ativo', -- Ativo, Vencido, Encerrado
    
    -- Coluna Coringa para Dados de Contrato Específicos
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e Politicas básicas (Apenas autenticados podem ver)
ALTER TABLE employment_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON employment_contracts;
CREATE POLICY "Enable read access for authenticated users" ON employment_contracts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON employment_contracts;
CREATE POLICY "Enable insert access for authenticated users" ON employment_contracts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON employment_contracts;
CREATE POLICY "Enable update access for authenticated users" ON employment_contracts FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON employment_contracts;
CREATE POLICY "Enable delete access for authenticated users" ON employment_contracts FOR DELETE TO authenticated USING (true);


-- ==============================================================================
-- 3. CRIAR TABELA DE ALOCAÇÃO (contract_allocations)
-- ==============================================================================
-- Registra ONDE a pessoa trabalha dentro de um contrato (Departamento, Projeto)
CREATE TABLE IF NOT EXISTS contract_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES employment_contracts(id) ON DELETE CASCADE,
    
    department VARCHAR(255),
    project VARCHAR(255),
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE contract_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON contract_allocations;
CREATE POLICY "Enable read access for authenticated users" ON contract_allocations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON contract_allocations;
CREATE POLICY "Enable all access for authenticated users" ON contract_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ==============================================================================
-- 4. CRIAR TABELA DE EVENTOS (employee_events)
-- ==============================================================================
-- Histórico imutável de coisas que acontecem (Pagamentos, Faltas, Advertências, Bônus)
CREATE TABLE IF NOT EXISTS employee_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES employment_contracts(id) ON DELETE SET NULL, -- Opcional
    
    event_type VARCHAR(100) NOT NULL, -- 'PAGAMENTO', 'FALTA', 'FERIAS', etc.
    event_date DATE NOT NULL,
    amount NUMERIC(10, 2), -- Valor monetário se aplicável
    description TEXT,
    
    metadata JSONB DEFAULT '{}'::jsonb, -- Para detalhes do evento
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE employee_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON employee_events;
CREATE POLICY "Enable read access for authenticated users" ON employee_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employee_events;
CREATE POLICY "Enable all access for authenticated users" ON employee_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
