import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase } from '@/lib/supabase';
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '@/lib/web-push.config';
import { extractResponsaveisList, DEFAULT_WHITEBOARD_DATA } from '@/services/war-room.service';
import { WhiteboardDataState, WhiteboardItem, WhiteboardTimelineItem, WhiteboardWeekdayItem, WeekdayKey } from '@/types/war-room';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Configura VAPID do Web Push
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const OFFICIAL_MEMBERS = [
  'MARCOS',
  'MATHEUS',
  'MELISSA',
  'GUILHERME',
  'FINANCEIRO',
  'JURÍDICO',
  'CONTÁBIL',
  'TI'
];

const WEEKDAY_NAMES = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira'
];

const WEEKDAY_KEYS: WeekdayKey[] = ['seg', 'ter', 'qua', 'qui', 'sex'];

/**
 * Endpoint de Notificação Diária das 09h30 (Segunda a Sexta)
 * Disparado automaticamente via Vercel Cron ou manualmente pelo painel executivo.
 */
export async function GET(req: NextRequest) {
  return handleDailySummary(req);
}

export async function POST(req: NextRequest) {
  return handleDailySummary(req);
}

async function handleDailySummary(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true';

    // 1. Obter data e dia da semana no fuso de Brasília (UTC-3)
    const now = new Date();
    const brasiliaFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });

    const parts = brasiliaFormatter.formatToParts(now);
    const partMap: Record<string, string> = {};
    parts.forEach(p => { partMap[p.type] = p.value; });

    const bDateStr = `${partMap.year}-${String(partMap.month).padStart(2, '0')}-${String(partMap.day).padStart(2, '0')}`;
    const bDayOfMonth = parseInt(partMap.day, 10);
    const jsDay = new Date(`${bDateStr}T12:00:00Z`).getUTCDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
    const isWeekend = jsDay === 0 || jsDay === 6;

    if (isWeekend && !force) {
      return NextResponse.json({
        success: true,
        message: 'Fim de semana (Sábado/Domingo) — Notificações diárias operam de segunda a sexta.',
        date: bDateStr,
        isWeekend: true,
      });
    }

    const weekdayIndex = jsDay >= 1 && jsDay <= 5 ? jsDay - 1 : 0;
    const weekdayName = WEEKDAY_NAMES[weekdayIndex] || 'Dia Útil';
    const currentWeekdayKey = WEEKDAY_KEYS[weekdayIndex] || 'seg';

    // 2. Carregar o estado mais recente da Lousa no Supabase
    let state: WhiteboardDataState = DEFAULT_WHITEBOARD_DATA;
    try {
      const { data: row } = await supabase
        .from('whiteboard_state')
        .select('data')
        .eq('id', 'current_state')
        .maybeSingle();

      if (row?.data) {
        state = row.data as WhiteboardDataState;
      }
    } catch (err) {
      console.warn('[Daily Cron] Aviso ao ler whiteboard_state:', err);
    }

    // 3. Compilar rotinas da Grade Semanal de hoje
    const rotinasHoje: { id: string; descricao: string; responsaveis: string[] }[] = [];
    if (state.gradeSemanal && Array.isArray(state.gradeSemanal)) {
      const bloco = state.gradeSemanal.find(b => b.diaSemana === currentWeekdayKey) || state.gradeSemanal[weekdayIndex];
      if (bloco?.itens) {
        bloco.itens.forEach((it: WhiteboardWeekdayItem) => {
          if (!it.concluido) {
            rotinasHoje.push({
              id: it.id,
              descricao: it.descricao,
              responsaveis: extractResponsaveisList(it.responsaveis || it.responsavel),
            });
          }
        });
      }
    }

    // 4. Compilar obrigações do Cronograma de Vencimentos (hoje e atrasadas)
    const cronogramaHoje: { id: string; dia: number; descricao: string; responsaveis: string[] }[] = [];
    const cronogramaAtrasado: { id: string; dia: number; descricao: string; responsaveis: string[] }[] = [];

    if (state.cronograma) {
      state.cronograma.forEach(blk => {
        (blk.itens || []).forEach(it => {
          if (!it.concluido) {
            const resps = extractResponsaveisList(it.responsaveis || it.responsavel);
            if (it.dia === bDayOfMonth) {
              cronogramaHoje.push({ id: it.id, dia: it.dia, descricao: it.descricao, responsaveis: resps });
            } else if (it.dia < bDayOfMonth) {
              cronogramaAtrasado.push({ id: it.id, dia: it.dia, descricao: it.descricao, responsaveis: resps });
            }
          }
        });
      });
    }

    // 5. Compilar tarefas das Colunas de Demandas
    const demandasHoje: { id: string; texto: string; coluna: string; responsaveis: string[] }[] = [];
    const demandasAtrasadas: { id: string; texto: string; coluna: string; responsaveis: string[] }[] = [];

    if (state.colunas) {
      state.colunas.forEach(col => {
        if (col.arquivado) return;
        (col.itens || []).forEach(it => {
          if (!it.concluido && !it.arquivado) {
            const prazo = it.dataLimite || col.dataLimite;
            const resps = extractResponsaveisList(it.responsaveis || it.responsavel);
            if (prazo) {
              if (prazo.startsWith(bDateStr)) {
                demandasHoje.push({ id: it.id, texto: it.texto, coluna: col.titulo, responsaveis: resps });
              } else if (prazo < bDateStr) {
                demandasAtrasadas.push({ id: it.id, texto: it.texto, coluna: col.titulo, responsaveis: resps });
              }
            }
          }
        });
      });
    }

    const totalHoje = rotinasHoje.length + cronogramaHoje.length + demandasHoje.length;
    const totalAtrasadas = cronogramaAtrasado.length + demandasAtrasadas.length;

    // 6. Buscar aparelhos cadastrados ativos no Supabase
    const { data: allActiveSubs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('active', true);

    if (subsErr) {
      console.error('[Daily Cron] Erro ao buscar push_subscriptions:', subsErr);
    }

    const subs = (allActiveSubs || []).filter(s => s.endpoint?.startsWith('http') && s.p256dh && s.auth && s.p256dh !== 'browser_p256dh');

    let totalPushesDelivered = 0;
    const notificationsToInsert: any[] = [];
    const expiredIds: string[] = [];

    // 7. Notificações Individuais Personalizadas por Membro
    for (const member of OFFICIAL_MEMBERS) {
      const memberRotinas = rotinasHoje.filter(r => r.responsaveis.includes(member) || r.responsaveis.length === 0);
      const memberCronHoje = cronogramaHoje.filter(c => c.responsaveis.includes(member));
      const memberDemandasHoje = demandasHoje.filter(d => d.responsaveis.includes(member));
      const memberCronAtrasado = cronogramaAtrasado.filter(c => c.responsaveis.includes(member));
      const memberDemandasAtrasadas = demandasAtrasadas.filter(d => d.responsaveis.includes(member));

      const memberHojeCount = memberRotinas.length + memberCronHoje.length + memberDemandasHoje.length;
      const memberAtrasadasCount = memberCronAtrasado.length + memberDemandasAtrasadas.length;

      // Se o membro tem atividades hoje ou atrasadas, prepara notificação personalizada
      if (memberHojeCount > 0 || memberAtrasadasCount > 0) {
        const title = `☀️ Bom dia, ${member}! [Resumo 09h30]`;
        const partsMsg: string[] = [];
        if (memberHojeCount > 0) {
          partsMsg.push(`${memberHojeCount} atividade(s) para hoje (${memberRotinas.length} rotinas, ${memberCronHoje.length} vencimentos)`);
        }
        if (memberAtrasadasCount > 0) {
          partsMsg.push(`${memberAtrasadasCount} pendência(s) em atraso`);
        }
        const body = `${partsMsg.join(' • ')}. Toque para abrir suas tarefas.`;

        notificationsToInsert.push({
          title,
          body,
          priority: memberAtrasadasCount > 0 ? 'urgent' : 'important',
          category: 'daily_digest',
          target_type: 'member',
          target_member_name: member,
          url: `/minhas-atividades?membro=${encodeURIComponent(member)}`,
          created_at: new Date().toISOString(),
        });

        // Disparar Web Push para aparelhos deste membro
        const memberSubs = subs.filter(s => s.member_name?.trim().toUpperCase() === member);
        for (const sub of memberSubs) {
          const pushPayload = JSON.stringify({
            title,
            body,
            priority: memberAtrasadasCount > 0 ? 'urgent' : 'important',
            url: `/minhas-atividades?membro=${encodeURIComponent(member)}`,
            tag: `daily-member-${member}-${bDateStr}`,
            timestamp: Date.now(),
          });

          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            }, pushPayload, {
              urgency: 'high',
              TTL: 86400,
            });
            totalPushesDelivered++;
          } catch (err: any) {
            console.warn(`[Daily Cron] Falha no push para ${member}:`, err?.statusCode || err?.message);
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              expiredIds.push(sub.id);
            }
          }
        }
      }
    }

    // 8. Notificação Geral do Painel da Equipe (Broadcast)
    const teamTitle = `☀️ Bom dia, Equipe! [Painel 09h30 • ${weekdayName}]`;
    const teamBody = `Lousa Operacional: ${totalHoje} tarefas para hoje (${rotinasHoje.length} rotinas da semana)${totalAtrasadas > 0 ? ` • ${totalAtrasadas} pendências atrasadas` : ''}. Tenham um excelente dia de trabalho!`;

    notificationsToInsert.push({
      title: teamTitle,
      body: teamBody,
      priority: totalAtrasadas > 0 ? 'urgent' : 'important',
      category: 'daily_digest',
      target_type: 'all',
      target_member_name: null,
      url: '/lousa-operacional',
      created_at: new Date().toISOString(),
    });

    // Disparar Web Push Geral para todos os aparelhos ativos
    for (const sub of subs) {
      const pushPayload = JSON.stringify({
        title: teamTitle,
        body: teamBody,
        priority: totalAtrasadas > 0 ? 'urgent' : 'important',
        url: '/lousa-operacional',
        tag: `daily-team-${bDateStr}`,
        timestamp: Date.now(),
      });

      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, pushPayload, {
          urgency: 'high',
          TTL: 86400,
        });
        totalPushesDelivered++;
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredIds.push(sub.id);
        }
      }
    }

    // 9. Salvar registros na tabela notifications do Supabase
    if (notificationsToInsert.length > 0) {
      try {
        await supabase.from('notifications').insert(notificationsToInsert);
      } catch (insertErr) {
        console.warn('[Daily Cron] Erro ao gravar notificações no banco:', insertErr);
      }
    }

    // 10. Desativar assinaturas expiradas
    if (expiredIds.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ active: false })
        .in('id', expiredIds);
    }

    return NextResponse.json({
      success: true,
      date: bDateStr,
      weekday: weekdayName,
      totalHoje,
      totalRotinasHoje: rotinasHoje.length,
      totalCronogramaHoje: cronogramaHoje.length,
      totalAtrasadas,
      notificationsCreated: notificationsToInsert.length,
      devicesReached: totalPushesDelivered,
      totalSubscribers: subs.length,
    });
  } catch (error: any) {
    console.error('[Daily Cron] Erro fatal no resumo diário:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
