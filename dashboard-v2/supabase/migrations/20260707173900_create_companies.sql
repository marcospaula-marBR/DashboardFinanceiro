-- Migration: Criação da tabela de empresas (Institutional)

CREATE TABLE IF NOT EXISTS public.companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    razao_social TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    insc_estadual TEXT,
    insc_municipal TEXT,
    endereco TEXT,
    atividade TEXT,
    email TEXT,
    telefone TEXT,
    video_url TEXT,
    contatos_setorizados JSONB DEFAULT '[]'::jsonb,
    links_cnds JSONB DEFAULT '[]'::jsonb,
    documentos_oficiais JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilita RLS (segurança padrão)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Permite que qualquer pessoa veja os dados (Leitura pública para o portal Institucional)
CREATE POLICY "Permitir leitura pública" 
ON public.companies FOR SELECT 
USING (true);

-- Permite inserção/atualização apenas para admins (você via Supabase Studio)
-- A política default do Supabase bloqueia inserções sem Auth se não houver política explícita liberando, 
-- o que já garante que ninguém na web conseguirá alterar os dados sem autenticação.

-- Insere os dados base para que a página não quebre
INSERT INTO public.companies (
    slug, name, razao_social, cnpj, insc_estadual, insc_municipal, endereco, 
    atividade, email, telefone, video_url, contatos_setorizados, links_cnds, documentos_oficiais
) VALUES 
(
    'MarBR', 
    'Mar Brasil', 
    'Mar Brasil Serviços Terceirizados e Logística Ltda', 
    '24.891.127/0001-45', 
    '144.592.831.110', 
    '4.892.110-3', 
    'Av. Conselheiro Nébias, 754 - Boqueirão, Santos - SP, CEP 11045-002', 
    'Prestação de Serviços Terceirizados, Limpeza Urbana e Apoio Logístico', 
    'contato@marbrasil.com.br', 
    '(13) 3221-5000', 
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    '[
        {"setor": "Comercial & Novos Negócios", "fone": "1332215000", "email": "comercial@marbrasil.com.br"},
        {"setor": "Recursos Humanos & Vagas", "fone": "1332215001", "email": "vagas@marbrasil.com.br"},
        {"setor": "Financeiro & Faturamento", "fone": "1332215002", "email": "financeiro@marbrasil.com.br"},
        {"setor": "Ouvidoria & Suporte", "fone": "1332215003", "email": "ouvidoria@marbrasil.com.br"}
    ]'::jsonb,
    '[
        {"titulo": "Certidão Conjunta Federal (Receita/PGFN)", "url": "https://onedrive.live.com/placeholder-federal-marbr"},
        {"titulo": "Certidão de Regularidade do FGTS (CRF)", "url": "https://onedrive.live.com/placeholder-fgts-marbr"},
        {"titulo": "Certidão Negativa Trabalhista (BNDT)", "url": "https://onedrive.live.com/placeholder-bndt-marbr"},
        {"titulo": "Certidão Negativa Estadual (SEFAZ SP)", "url": "https://onedrive.live.com/placeholder-estadual-marbr"},
        {"titulo": "Certidão Negativa Municipal (Santos)", "url": "https://onedrive.live.com/placeholder-municipal-marbr"}
    ]'::jsonb,
    '[
        {"titulo": "Contrato Social Consolidado", "tipo": "PDF", "tamanho": "2.4 MB", "url": "/Manual_de_Cultura.pdf"},
        {"titulo": "Cartão CNPJ Ativo", "tipo": "PDF", "tamanho": "180 KB", "url": "/Manual_de_Cultura.pdf"},
        {"titulo": "Manual de Cultura do Grupo", "tipo": "PDF", "tamanho": "12.0 MB", "url": "/Manual_de_Cultura.pdf"}
    ]'::jsonb
),
(
    'DZM', 
    'DZM', 
    'DZM Empreendimentos e Construções Civis Ltda', 
    '38.412.923/0001-88', 
    'Isento', 
    '8.412.302-9', 
    'Av. Ana Costa, 291 - Gonzaga, Santos - SP, CEP 11060-001', 
    'Incorporação de Empreendimentos Imobiliários e Construção Civil', 
    'diretoria@dzm.com.br', 
    '(13) 3289-4000', 
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    '[
        {"setor": "Comercial & Vendas", "fone": "1332894000", "email": "vendas@dzm.com.br"},
        {"setor": "Recursos Humanos & Vagas", "fone": "1332894001", "email": "rh@dzm.com.br"},
        {"setor": "Financeiro & Contabilidade", "fone": "1332894002", "email": "financeiro@dzm.com.br"},
        {"setor": "Suporte & Ouvidoria", "fone": "1332894003", "email": "ouvidoria@dzm.com.br"}
    ]'::jsonb,
    '[
        {"titulo": "Certidão Conjunta Federal (Receita/PGFN)", "url": "https://onedrive.live.com/placeholder-federal-dzm"},
        {"titulo": "Certidão de Regularidade do FGTS (CRF)", "url": "https://onedrive.live.com/placeholder-fgts-dzm"},
        {"titulo": "Certidão Negativa Trabalhista (BNDT)", "url": "https://onedrive.live.com/placeholder-bndt-dzm"},
        {"titulo": "Certidão Negativa Estadual (SEFAZ SP)", "url": "https://onedrive.live.com/placeholder-estadual-dzm"},
        {"titulo": "Certidão Negativa Municipal (Santos)", "url": "https://onedrive.live.com/placeholder-municipal-dzm"}
    ]'::jsonb,
    '[
        {"titulo": "Contrato Social Consolidado", "tipo": "PDF", "tamanho": "1.9 MB", "url": "/Manual_de_Cultura.pdf"},
        {"titulo": "Cartão CNPJ Ativo", "tipo": "PDF", "tamanho": "175 KB", "url": "/Manual_de_Cultura.pdf"},
        {"titulo": "Manual de Cultura do Grupo", "tipo": "PDF", "tamanho": "12.0 MB", "url": "/Manual_de_Cultura.pdf"}
    ]'::jsonb
);
