import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase } from '@/lib/supabase';
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '@/lib/web-push.config';

export const runtime = 'nodejs';

// Configura VAPID do Web Push uma única vez
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

interface DispatchPushBody {
  title: string;
  body: string;
  priority?: string;
  category?: string;
  targetType?: 'all' | 'member';
  targetMemberName?: string;
  activityId?: string;
  url?: string;
  tag?: string;
}

export async function POST(req: NextRequest) {
  try {
    const data: DispatchPushBody = await req.json();
    const {
      title,
      body,
      priority = 'info',
      targetType = 'all',
      targetMemberName,
      activityId,
      url = '/minhas-atividades',
      tag,
    } = data;

    if (!title || !body) {
      return NextResponse.json({ error: 'Título e mensagem são obrigatórios' }, { status: 400 });
    }

    // 1. Buscar assinaturas ativas no Supabase
    let query = supabase
      .from('push_subscriptions')
      .select('*')
      .eq('active', true);

    if (targetType === 'member' && targetMemberName) {
      query = query.eq('member_name', targetMemberName.trim().toUpperCase());
    }

    const { data: subs, error: subsErr } = await query;

    if (subsErr) {
      console.error('[WebPush Dispatch] Erro ao consultar push_subscriptions:', subsErr);
      return NextResponse.json({ error: subsErr.message }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum dispositivo cadastrado para o destinatário informado.',
        deliveredCount: 0,
        totalChecked: 0,
      });
    }

    // 2. Montar payload do Web Push (JSON recebido pelo Service Worker)
    const payload = JSON.stringify({
      title,
      body,
      priority,
      url,
      activityId,
      tag: tag || `push-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    });

    let deliveredCount = 0;
    let failedCount = 0;
    const expiredIds: string[] = [];

    // 3. Disparar notificações em paralelo para todos os endpoints válidos
    const pushPromises = subs.map(async (sub) => {
      // Se não for um endpoint HTTP real (ex: mocks antigos), pula
      if (!sub.endpoint || !sub.endpoint.startsWith('http')) {
        return;
      }

      if (!sub.p256dh || !sub.auth || sub.p256dh === 'browser_p256dh') {
        return;
      }

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payload, {
          urgency: 'high', // Forçar alta prioridade no Google FCM para acordar celulares em repouso
          TTL: 86400, // 24 horas de resguardo no servidor FCM
        });
        deliveredCount++;
      } catch (err: any) {
        failedCount++;
        console.warn(`[WebPush] Falha no envio para ${sub.member_name} (${sub.device_label}):`, err?.statusCode || err?.message);
        
        // 410 (Gone) ou 404 (Not Found) indica inscrição expirada no FCM
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredIds.push(sub.id);
        }
      }
    });

    await Promise.all(pushPromises);

    // 4. Desativar assinaturas que o Google FCM informou estarem expiradas
    if (expiredIds.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ active: false })
        .in('id', expiredIds);
    }

    return NextResponse.json({
      success: true,
      deliveredCount,
      failedCount,
      totalChecked: subs.length,
      targetType,
      targetMemberName: targetMemberName || null,
    });
  } catch (err: any) {
    console.error('[WebPush Dispatch] Erro interno:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno', success: false }, { status: 500 });
  }
}
