-- ==============================================================================
-- MIGRAÇÃO: LOUSA MULTISSETORES — ISOLAMENTO POR DEPARTAMENTO & ADMIN MASTER
-- Projeto: Lousa Operacional & Notificações — Mar Brasil
-- Arquivo: 20261027_whiteboard_multidepartment.sql
-- ==============================================================================

-- 1. TABELA DE DEPARTAMENTOS DA LOUSA
CREATE TABLE IF NOT EXISTS public.whiteboard_departments (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    badge_label TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    icon_name TEXT DEFAULT 'Layers',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SEMEADURA DOS DEPARTAMENTOS (PURPLE BAN RIGOROSO)
INSERT INTO public.whiteboard_departments (slug, name, badge_label, color_hex, icon_name, is_active)
VALUES 
  ('financeiro', 'Financeiro & Controladoria', 'FINANCEIRO', '#10b981', 'Landmark', true),
  ('operacional', 'Operações & Logística', 'OPERACIONAL', '#0ea5e9', 'Truck', true),
  ('comercial', 'Comercial & Vendas', 'COMERCIAL', '#f59e0b', 'TrendingUp', true),
  ('recursos_humanos', 'Gente & Gestão (RH)', 'RECURSOS HUMANOS', '#f43f5e', 'Users', true),
  ('ti', 'Tecnologia da Informação (TI)', 'TI', '#06b6d4', 'Terminal', true),
  ('juridico', 'Jurídico & Compliance', 'JURÍDICO', '#84cc16', 'Scale', true)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name,
    badge_label = EXCLUDED.badge_label,
    color_hex = EXCLUDED.color_hex,
    icon_name = EXCLUDED.icon_name,
    is_active = EXCLUDED.is_active;

-- 3. POLÍTICAS RLS PARA DEPARTAMENTOS
ALTER TABLE public.whiteboard_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica de departamentos da lousa" ON public.whiteboard_departments;
CREATE POLICY "Leitura publica de departamentos da lousa" 
ON public.whiteboard_departments
FOR SELECT 
TO anon, authenticated 
USING (true);

-- 4. ATUALIZAR TABELA DE MEMBROS COM DEPARTMENT_SLUG
ALTER TABLE public.whiteboard_member_links 
ADD COLUMN IF NOT EXISTS department_slug TEXT REFERENCES public.whiteboard_departments(slug) DEFAULT 'financeiro';

UPDATE public.whiteboard_member_links 
SET department_slug = 'financeiro' 
WHERE department_slug IS NULL;

-- 5. ASSEGURAR LINHA DO FINANCEIRO EM WHITEBOARD_STATE (MIGRADA DE CURRENT_STATE)
INSERT INTO public.whiteboard_state (id, data, updated_at)
SELECT 'financeiro', data, NOW()
FROM public.whiteboard_state
WHERE id = 'current_state'
ON CONFLICT (id) DO UPDATE 
SET data = EXCLUDED.data,
    updated_at = NOW();

-- Habilitar leitura pública para anon e authenticated em whiteboard_state
DROP POLICY IF EXISTS "Leitura colaborativa do estado da lousa" ON public.whiteboard_state;
CREATE POLICY "Leitura colaborativa do estado da lousa" 
ON public.whiteboard_state
FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Modificacao do estado da lousa" ON public.whiteboard_state;
CREATE POLICY "Modificacao do estado da lousa" 
ON public.whiteboard_state
FOR ALL 
TO anon, authenticated 
USING (true)
WITH CHECK (true);
