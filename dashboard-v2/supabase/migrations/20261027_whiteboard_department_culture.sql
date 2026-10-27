-- ==============================================================================
-- MIGRAÇÃO: MENSAGENS DE CULTURA POR DEPARTAMENTO NA LOUSA OPERACIONAL
-- Projeto: Lousa Operacional Multissetores — Mar Brasil
-- Arquivo: 20261027_whiteboard_department_culture.sql
-- ==============================================================================

-- 1. ADICIONAR COLUNAS DE CULTURA NA TABELA WHITEBOARD_DEPARTMENTS
ALTER TABLE public.whiteboard_departments 
ADD COLUMN IF NOT EXISTS institutional_phrase TEXT DEFAULT 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
ADD COLUMN IF NOT EXISTS institutional_tag TEXT DEFAULT 'MANUAL CULTURA MAR BRASIL',
ADD COLUMN IF NOT EXISTS culture_phrase TEXT,
ADD COLUMN IF NOT EXISTS culture_tag TEXT;

-- 2. POLÍTICA DE ATUALIZAÇÃO / ESCRITA EM WHITEBOARD_DEPARTMENTS
DROP POLICY IF EXISTS "Atualizacao colaborativa de departamentos da lousa" ON public.whiteboard_departments;
CREATE POLICY "Atualizacao colaborativa de departamentos da lousa" 
ON public.whiteboard_departments
FOR ALL 
TO anon, authenticated 
USING (true)
WITH CHECK (true);

-- 3. SEMEADURA DAS MENSAGENS PADRÃO POR SETOR
UPDATE public.whiteboard_departments
SET culture_phrase = 'PAGAR CERTO, FATURAR CERTO, FECHAR CERTO!',
    culture_tag = 'MANUAL DE CULTURA FINANCEIRA',
    institutional_phrase = 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
    institutional_tag = 'MANUAL CULTURA MAR BRASIL'
WHERE slug = 'financeiro';

UPDATE public.whiteboard_departments
SET culture_phrase = 'AGILIDADE, SEGURANÇA E PONTUALIDADE EM CADA OPERAÇÃO!',
    culture_tag = 'MANUAL DE CULTURA OPERACIONAL',
    institutional_phrase = 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
    institutional_tag = 'MANUAL CULTURA MAR BRASIL'
WHERE slug = 'operacional';

UPDATE public.whiteboard_departments
SET culture_phrase = 'RELACIONAMENTO, FOCO NO CLIENTE E RESULTADO COM EXCELÊNCIA!',
    culture_tag = 'MANUAL DE CULTURA COMERCIAL',
    institutional_phrase = 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
    institutional_tag = 'MANUAL CULTURA MAR BRASIL'
WHERE slug = 'comercial';

UPDATE public.whiteboard_departments
SET culture_phrase = 'DESENVOLVIMENTO, CUIDADO E ENGAJAMENTO DE PESSOAS!',
    culture_tag = 'MANUAL DE CULTURA GENTE & GESTÃO',
    institutional_phrase = 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
    institutional_tag = 'MANUAL CULTURA MAR BRASIL'
WHERE slug = 'recursos_humanos';

UPDATE public.whiteboard_departments
SET culture_phrase = 'ESTABILIDADE, INOVAÇÃO E SEGURANÇA TECNOLÓGICA!',
    culture_tag = 'MANUAL DE CULTURA TI',
    institutional_phrase = 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
    institutional_tag = 'MANUAL CULTURA MAR BRASIL'
WHERE slug = 'ti';

UPDATE public.whiteboard_departments
SET culture_phrase = 'CONFORMIDADE, SEGURANÇA JURÍDICA E INTEGRIDADE!',
    culture_tag = 'MANUAL DE CULTURA JURÍDICA',
    institutional_phrase = 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
    institutional_tag = 'MANUAL CULTURA MAR BRASIL'
WHERE slug = 'juridico';
