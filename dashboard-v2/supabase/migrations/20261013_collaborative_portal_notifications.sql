-- ==============================================================================
-- MIGRAÇÃO DEFINITIVA: PORTAL COLABORATIVO DA EQUIPE & CENTRAL DE NOTIFICAÇÕES
-- Projeto: Lousa Operacional & Notificações Inteligentes — Mar Brasil
-- Arquivo: 20261013_collaborative_portal_notifications.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AMPLIAÇÃO DA TABELA PROFILES (PAPÉIS & VÍNCULO AO COLABORADOR REAL)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'colaborador' CHECK (role IN ('admin', 'colaborador')),
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- Garante o perfil administrativo para o administrador do sistema
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = '1972marcosantonio@gmail.com';

-- ------------------------------------------------------------------------------
-- 2. FUNÇÃO DE SEGURANÇA IS_ADMIN() (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND (role = 'admin' OR email = '1972marcosantonio@gmail.com')
  );
$$;

-- ------------------------------------------------------------------------------
-- 3. TABELA DE ESTADO CENTRALIZADO DA LOUSA (FONTE OFICIAL DE VERDADE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whiteboard_state (
    id TEXT PRIMARY KEY DEFAULT 'current_state',
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.whiteboard_state ENABLE ROW LEVEL SECURITY;

-- Colaboradores autenticados podem ler o estado operacional compartilhado
DROP POLICY IF EXISTS "Leitura colaborativa do estado da lousa" ON public.whiteboard_state;
CREATE POLICY "Leitura colaborativa do estado da lousa" 
ON public.whiteboard_state
FOR SELECT 
TO authenticated 
USING (true);

-- Apenas o administrador pode alterar o estado oficial da lousa
DROP POLICY IF EXISTS "Apenas admin modifica o estado da lousa" ON public.whiteboard_state;
CREATE POLICY "Apenas admin modifica o estado da lousa" 
ON public.whiteboard_state
FOR ALL 
TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 4. TABELA DE VÍNCULO ENTRE NOMES DA LOUSA E COLABORADORES REAIS (EMPLOYEES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whiteboard_member_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_name TEXT NOT NULL UNIQUE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    color_hex TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.whiteboard_member_links ENABLE ROW LEVEL SECURITY;

-- Leitura pública para usuários autenticados identificarem responsáveis
DROP POLICY IF EXISTS "Leitura de vinculos de membros da lousa" ON public.whiteboard_member_links;
CREATE POLICY "Leitura de vinculos de membros da lousa" 
ON public.whiteboard_member_links
FOR SELECT 
TO authenticated 
USING (true);

-- Apenas o administrador gerencia vínculos
DROP POLICY IF EXISTS "Apenas admin gerencia vinculos de membros" ON public.whiteboard_member_links;
CREATE POLICY "Apenas admin gerencia vinculos de membros" 
ON public.whiteboard_member_links
FOR ALL 
TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. TABELA DE OFERTAS DE AJUDA COLABORATIVAS (🤝 OFERECER AJUDA)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whiteboard_help_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id TEXT NOT NULL,
    activity_title TEXT NOT NULL,
    task_owner_name TEXT NOT NULL,
    offered_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    offered_by_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    offered_by_name TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'recusada')),
    admin_notes TEXT,
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Previne ofertas de ajuda pendentes duplicadas do mesmo colaborador para a mesma atividade
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_help_offer 
ON public.whiteboard_help_offers (activity_id, offered_by_profile_id) 
WHERE status = 'pendente';

ALTER TABLE public.whiteboard_help_offers ENABLE ROW LEVEL SECURITY;

-- Leitura: admin visualiza tudo; colaboradores visualizam suas ofertas e ofertas em suas tarefas
DROP POLICY IF EXISTS "Visualizacao de ofertas de ajuda" ON public.whiteboard_help_offers;
CREATE POLICY "Visualizacao de ofertas de ajuda" 
ON public.whiteboard_help_offers
FOR SELECT 
TO authenticated 
USING (
  public.is_admin() OR 
  offered_by_profile_id = auth.uid() OR
  task_owner_name IN (
    SELECT wml.member_name 
    FROM public.whiteboard_member_links wml
    WHERE wml.profile_id = auth.uid()
  )
);

-- Inserção: colaborador só pode oferecer ajuda em seu próprio nome
DROP POLICY IF EXISTS "Colaborador registra oferta de ajuda" ON public.whiteboard_help_offers;
CREATE POLICY "Colaborador registra oferta de ajuda" 
ON public.whiteboard_help_offers
FOR INSERT 
TO authenticated 
WITH CHECK (offered_by_profile_id = auth.uid());

-- Atualização: apenas o administrador pode aceitar, recusar ou decidir ofertas de ajuda
DROP POLICY IF EXISTS "Apenas admin decide oferta de ajuda" ON public.whiteboard_help_offers;
CREATE POLICY "Apenas admin decide oferta de ajuda" 
ON public.whiteboard_help_offers
FOR UPDATE 
TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. TABELA DE ASSINATURAS WEB PUSH POR DISPOSITIVO (WINDOWS 11 E ANDROID)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    device_label TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'other')),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Colaborador gerencia apenas seus próprios dispositivos; admin pode auditar
DROP POLICY IF EXISTS "Colaborador gerencia seus dispositivos push" ON public.push_subscriptions;
CREATE POLICY "Colaborador gerencia seus dispositivos push" 
ON public.push_subscriptions
FOR ALL 
TO authenticated 
USING (profile_id = auth.uid() OR public.is_admin())
WITH CHECK (profile_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 7. TABELA DE NOTIFICAÇÕES (DISPAROS E COMUNICADOS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('info', 'important', 'urgent')),
    category TEXT NOT NULL DEFAULT 'task_alert' CHECK (category IN ('task_alert', 'morning_digest', 'manual_broadcast', 'help_offer', 'system')),
    target_type TEXT NOT NULL CHECK (target_type IN ('all', 'employee', 'role')),
    target_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    activity_id TEXT,
    activity_title TEXT,
    requires_ack BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Colaborador lê apenas comunicados gerais ou direcionados a ele; admin lê tudo
DROP POLICY IF EXISTS "Leitura de notificacoes direcionadas" ON public.notifications;
CREATE POLICY "Leitura de notificacoes direcionadas" 
ON public.notifications
FOR SELECT 
TO authenticated 
USING (
  target_type = 'all' OR 
  target_profile_id = auth.uid() OR 
  public.is_admin()
);

-- Apenas o administrador ou funções de backend podem criar/remover notificações
DROP POLICY IF EXISTS "Apenas admin gerencia notificacoes" ON public.notifications;
CREATE POLICY "Apenas admin gerencia notificacoes" 
ON public.notifications
FOR ALL 
TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 8. TABELA DE CONTROLE DE ENTREGAS WEB PUSH (notification_deliveries)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent_to_gateway', 'gateway_accepted', 'failed', 'acknowledged')),
    gateway_status_code INTEGER,
    error_message TEXT,
    attempt_number INTEGER DEFAULT 1,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ
);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visualizacao de status de entrega" ON public.notification_deliveries;
CREATE POLICY "Visualizacao de status de entrega" 
ON public.notification_deliveries
FOR SELECT 
TO authenticated 
USING (profile_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 9. TABELA DE CONFIRMAÇÕES DE CIÊNCIA (notification_acknowledgments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
    activity_id TEXT NOT NULL,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    ip_address TEXT,
    CONSTRAINT uq_ack_activity_profile UNIQUE (activity_id, profile_id)
);

ALTER TABLE public.notification_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário vê suas próprias confirmações; administrador audita todas
DROP POLICY IF EXISTS "Leitura de confirmacoes de ciencia" ON public.notification_acknowledgments;
CREATE POLICY "Leitura de confirmacoes de ciencia" 
ON public.notification_acknowledgments
FOR SELECT 
TO authenticated 
USING (profile_id = auth.uid() OR public.is_admin());

-- Inserção: cada colaborador só pode confirmar sua própria ciência (bloqueia confirmação em nome de terceiros)
DROP POLICY IF EXISTS "Colaborador confirma sua propria ciencia" ON public.notification_acknowledgments;
CREATE POLICY "Colaborador confirma sua propria ciencia" 
ON public.notification_acknowledgments
FOR INSERT 
TO authenticated 
WITH CHECK (profile_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 10. ÍNDICES DE PERFORMANCE E CONSULTAS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_push_sub_profile ON public.push_subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_active ON public.push_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON public.notifications(target_profile_id, target_type, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_ack ON public.notifications(requires_ack, created_at);
CREATE INDEX IF NOT EXISTS idx_ack_activity ON public.notification_acknowledgments(activity_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_help_offers_activity ON public.whiteboard_help_offers(activity_id, status);
CREATE INDEX IF NOT EXISTS idx_help_offers_profile ON public.whiteboard_help_offers(offered_by_profile_id);
CREATE INDEX IF NOT EXISTS idx_member_links_emp ON public.whiteboard_member_links(employee_id);

-- ==============================================================================
-- SCRIPT DE ROLLBACK (DOWN SCRIPT SEGURO)
-- Execute as instruções abaixo caso seja necessária a reversão completa:
-- ==============================================================================
/*
DROP TABLE IF EXISTS public.notification_acknowledgments CASCADE;
DROP TABLE IF EXISTS public.notification_deliveries CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
DROP TABLE IF EXISTS public.whiteboard_help_offers CASCADE;
DROP TABLE IF EXISTS public.whiteboard_member_links CASCADE;
DROP TABLE IF EXISTS public.whiteboard_state CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS employee_id;
*/
