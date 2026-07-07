-- Populando os dados da Mar Brasil
UPDATE public.companies SET 
    name = 'Mar Brasil', 
    razao_social = 'Mar Brasil Serviços Terceirizados e Logística Ltda', 
    cnpj = '24.891.127/0001-45', 
    insc_estadual = '144.592.831.110', 
    insc_municipal = '4.892.110-3', 
    endereco = 'Av. Conselheiro Nébias, 754 - Boqueirão, Santos - SP, CEP 11045-002', 
    atividade = 'Prestação de Serviços Terceirizados, Limpeza Urbana e Apoio Logístico', 
    email = 'contato@marbrasil.com.br', 
    telefone = '(13) 3221-5000', 
    video_url = 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    contatos_setorizados = '[{"setor": "Comercial & Novos Negócios", "fone": "1332215000", "email": "comercial@marbrasil.com.br"},{"setor": "Recursos Humanos & Vagas", "fone": "1332215001", "email": "vagas@marbrasil.com.br"},{"setor": "Financeiro & Faturamento", "fone": "1332215002", "email": "financeiro@marbrasil.com.br"},{"setor": "Ouvidoria & Suporte", "fone": "1332215003", "email": "ouvidoria@marbrasil.com.br"}]'::jsonb,
    links_cnds = '[{"titulo": "Certidão Conjunta Federal (Receita/PGFN)", "url": "https://onedrive.live.com/placeholder-federal-marbr"},{"titulo": "Certidão de Regularidade do FGTS (CRF)", "url": "https://onedrive.live.com/placeholder-fgts-marbr"},{"titulo": "Certidão Negativa Trabalhista (BNDT)", "url": "https://onedrive.live.com/placeholder-bndt-marbr"},{"titulo": "Certidão Negativa Estadual (SEFAZ SP)", "url": "https://onedrive.live.com/placeholder-estadual-marbr"},{"titulo": "Certidão Negativa Municipal (Santos)", "url": "https://onedrive.live.com/placeholder-municipal-marbr"}]'::jsonb,
    documentos_oficiais = '[{"titulo": "Contrato Social Consolidado", "tipo": "PDF", "tamanho": "2.4 MB", "url": "/Manual_de_Cultura.pdf"},{"titulo": "Cartão CNPJ Ativo", "tipo": "PDF", "tamanho": "180 KB", "url": "/Manual_de_Cultura.pdf"},{"titulo": "Manual de Cultura do Grupo", "tipo": "PDF", "tamanho": "12.0 MB", "url": "/Manual_de_Cultura.pdf"}]'::jsonb
WHERE slug = 'MarBR';

-- Populando os dados da DZM
UPDATE public.companies SET 
    name = 'DZM', 
    razao_social = 'DZM Empreendimentos e Construções Civis Ltda', 
    cnpj = '38.412.923/0001-88', 
    insc_estadual = 'Isento', 
    insc_municipal = '8.412.302-9', 
    endereco = 'Av. Ana Costa, 291 - Gonzaga, Santos - SP, CEP 11060-001', 
    atividade = 'Incorporação de Empreendimentos Imobiliários e Construção Civil', 
    email = 'diretoria@dzm.com.br', 
    telefone = '(13) 3289-4000', 
    video_url = 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    contatos_setorizados = '[{"setor": "Comercial & Vendas", "fone": "1332894000", "email": "vendas@dzm.com.br"},{"setor": "Recursos Humanos & Vagas", "fone": "1332894001", "email": "rh@dzm.com.br"},{"setor": "Financeiro & Contabilidade", "fone": "1332894002", "email": "financeiro@dzm.com.br"},{"setor": "Suporte & Ouvidoria", "fone": "1332894003", "email": "ouvidoria@dzm.com.br"}]'::jsonb,
    links_cnds = '[{"titulo": "Certidão Conjunta Federal (Receita/PGFN)", "url": "https://onedrive.live.com/placeholder-federal-dzm"},{"titulo": "Certidão de Regularidade do FGTS (CRF)", "url": "https://onedrive.live.com/placeholder-fgts-dzm"},{"titulo": "Certidão Negativa Trabalhista (BNDT)", "url": "https://onedrive.live.com/placeholder-bndt-dzm"},{"titulo": "Certidão Negativa Estadual (SEFAZ SP)", "url": "https://onedrive.live.com/placeholder-estadual-dzm"},{"titulo": "Certidão Negativa Municipal (Santos)", "url": "https://onedrive.live.com/placeholder-municipal-dzm"}]'::jsonb,
    documentos_oficiais = '[{"titulo": "Contrato Social Consolidado", "tipo": "PDF", "tamanho": "1.9 MB", "url": "/Manual_de_Cultura.pdf"},{"titulo": "Cartão CNPJ Ativo", "tipo": "PDF", "tamanho": "175 KB", "url": "/Manual_de_Cultura.pdf"},{"titulo": "Manual de Cultura do Grupo", "tipo": "PDF", "tamanho": "12.0 MB", "url": "/Manual_de_Cultura.pdf"}]'::jsonb
WHERE slug = 'DZM';
