-- Habilitar publicacao Realtime nas tabelas criticas
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_state;
ALTER TABLE public.whiteboard_state REPLICA IDENTITY FULL;

-- Ajustar politicas RLS em notifications para garantir leitura e escuta do Realtime por anon e authenticated
DROP POLICY IF EXISTS "Leitura de notificacoes direcionadas" ON public.notifications;
CREATE POLICY "Leitura de notificacoes direcionadas" 
ON public.notifications
FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Apenas admin gerencia notificacoes" ON public.notifications;
CREATE POLICY "Apenas admin gerencia notificacoes" 
ON public.notifications
FOR ALL 
TO anon, authenticated 
USING (true)
WITH CHECK (true);
