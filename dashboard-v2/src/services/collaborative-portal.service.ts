/**
 * Collaborative Portal Service — Portal da Equipe & Notificações
 * Mar Brasil — Acesso Colaborativo Transparente e Rastreabilidade
 * @version v.02.59.49
 */

import { supabase } from '@/lib/supabase';
import { 
  CollaborativeActivity, 
  ActivityUrgencyGroup, 
  HelpOffer, 
  PortalNotification,
  RegisteredDevice,
  NotificationPriority
} from '@/types/collaborative-portal';
import { 
  WarRoomService, 
  DEFAULT_WHITEBOARD_DATA, 
  DEFAULT_WEEKDAY_BLOCKS,
  calculatePrazoInfo, 
  extractResponsaveisList 
} from '@/services/war-room.service';
import { WhiteboardDataState, PrazoVisualInfo } from '@/types/war-room';

const LOCAL_HELP_OFFERS_KEY = 'marbrasil_help_offers_v1';
const LOCAL_ACKS_KEY = 'marbrasil_task_acks_v1';
const LOCAL_DEVICES_KEY = 'marbrasil_devices_v1';
const LOCAL_NOTIFICATIONS_KEY = 'marbrasil_notifications_v1';

export class CollaborativePortalService {
  /**
   * Obtém todas as atividades operacionais unificadas (Colunas + Cronograma)
   * Consulta primeiro o Supabase (whiteboard_state); se não disponível ou offline,
   * utiliza o WarRoomService (cache do localStorage / dados padrão da lousa)
   */
  static async getAllActivities(
    currentMemberName?: string,
    currentProfileId?: string
  ): Promise<CollaborativeActivity[]> {
    let whiteboardData: WhiteboardDataState = DEFAULT_WHITEBOARD_DATA;

    // 1. Tentar ler do Supabase (whiteboard_state)
    try {
      const { data, error } = await supabase
        .from('whiteboard_state')
        .select('data')
        .eq('id', 'current_state')
        .maybeSingle();

      if (data && data.data && !error) {
        whiteboardData = data.data as WhiteboardDataState;
      } else {
        whiteboardData = WarRoomService.getWhiteboardData();
      }
    } catch {
      whiteboardData = WarRoomService.getWhiteboardData();
    }

    // 2. Carregar ofertas de ajuda pendentes (Supabase com fallback local)
    const helpOffers = await this.getHelpOffers();

    // 3. Carregar confirmações de ciência registradas
    const acks = await this.getAcknowledgments();

    const activities: CollaborativeActivity[] = [];

    // Processar itens das Colunas Operacionais (Demandas)
    if (whiteboardData.colunas) {
      whiteboardData.colunas.forEach(col => {
        if (col.arquivado) return; // Não exibir colunas arquivadas

        col.itens.forEach(item => {
          if (item.arquivado) return; // Não exibir tarefas arquivadas

          const resps = extractResponsaveisList(item.responsaveis || item.responsavel);
          const deadline = item.dataLimite || col.dataLimite;
          const prazo = calculatePrazoInfo(deadline, item.concluido);
          const isUrgent = item.prioridade === 'urgente' || Boolean(item.destaque && prazo.status === 'atrasado');

          // Contagem de ofertas de ajuda para esta atividade
          const relatedOffers = helpOffers.filter(h => h.activityId === item.id);
          const pendingOffers = relatedOffers.filter(h => h.status === 'pendente');
          const userHasPending = Boolean(
            currentProfileId && 
            pendingOffers.some(h => h.offeredByProfileId === currentProfileId)
          );

          // Confirmação de ciência
          const ackRecord = acks.find(a => a.activityId === item.id);
          const requiresAck = isUrgent && !item.concluido;
          let ackStatus: 'aguardando' | 'confirmada' | 'excedido' | 'nao_requer' = 'nao_requer';

          if (requiresAck) {
            if (ackRecord) {
              ackStatus = 'confirmada';
            } else if (prazo.status === 'atrasado') {
              ackStatus = 'excedido';
            } else {
              ackStatus = 'aguardando';
            }
          } else if (ackRecord) {
            ackStatus = 'confirmada';
          }

          activities.push({
            id: item.id,
            titulo: item.texto,
            descricao: col.subtitulo ? `${col.titulo} — ${col.subtitulo}` : col.titulo,
            origemTipo: 'coluna',
            origemId: col.id,
            origemTitulo: col.titulo.replace(':', ''),
            dataLimite: deadline,
            prazoInfo: prazo,
            concluido: item.concluido,
            destaque: item.destaque,
            prioridade: item.prioridade || (isUrgent ? 'urgente' : 'normal'),
            responsaveis: resps,
            requiresAck,
            ackStatus,
            acknowledgedAt: ackRecord?.acknowledgedAt,
            acknowledgedByName: ackRecord?.memberName,
            helpOffersCount: pendingOffers.length,
            userHasPendingHelpOffer: userHasPending,
            observacao: item.observacao,
          });
        });
      });
    }

    // Processar itens do Cronograma Mensal de Vencimentos
    if (whiteboardData.cronograma) {
      const todayDay = new Date().getDate();
      const hoje = new Date();
      const currentYear = hoje.getFullYear();
      const currentMonth = hoje.getMonth();

      whiteboardData.cronograma.forEach(block => {
        block.itens.forEach(item => {
          const resps = extractResponsaveisList(item.responsaveis || item.responsavel);
          const formatted = WarRoomService.formatTimelineDescription(item.dia, item.descricao);
          const deadline = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(formatted.dia).padStart(2, '0')}`;
          const prazo = calculatePrazoInfo(deadline, item.concluido);
          const isUrgent = prazo.status === 'atrasado' && !item.concluido;

          // Contagem de ofertas de ajuda
          const relatedOffers = helpOffers.filter(h => h.activityId === item.id);
          const pendingOffers = relatedOffers.filter(h => h.status === 'pendente');
          const userHasPending = Boolean(
            currentProfileId && 
            pendingOffers.some(h => h.offeredByProfileId === currentProfileId)
          );

          // Confirmação de ciência
          const ackRecord = acks.find(a => a.activityId === item.id);
          const requiresAck = isUrgent;
          let ackStatus: 'aguardando' | 'confirmada' | 'excedido' | 'nao_requer' = 'nao_requer';

          if (requiresAck) {
            if (ackRecord) {
              ackStatus = 'confirmada';
            } else if (item.dia < todayDay) {
              ackStatus = 'excedido';
            } else {
              ackStatus = 'aguardando';
            }
          } else if (ackRecord) {
            ackStatus = 'confirmada';
          }

          activities.push({
            id: item.id,
            titulo: formatted.descricao,
            descricao: `Cronograma Mensal (Janela ${block.intervalo})`,
            origemTipo: 'cronograma',
            origemId: block.id,
            origemTitulo: `Bloco ${block.intervalo}`,
            dia: formatted.dia,
            dataLimite: deadline,
            prazoInfo: prazo,
            concluido: item.concluido,
            prioridade: isUrgent ? 'urgente' : 'normal',
            responsaveis: resps,
            requiresAck,
            ackStatus,
            acknowledgedAt: ackRecord?.acknowledgedAt,
            acknowledgedByName: ackRecord?.memberName,
            helpOffersCount: pendingOffers.length,
            userHasPendingHelpOffer: userHasPending,
          });
        });
      });
    }

    // Processar rotinas da Grade Semanal Recorrente (Segunda a Sexta)
    const gradeSemanal = (whiteboardData.gradeSemanal && whiteboardData.gradeSemanal.length === 5)
      ? whiteboardData.gradeSemanal
      : DEFAULT_WEEKDAY_BLOCKS;

    if (gradeSemanal && Array.isArray(gradeSemanal)) {
      const hoje = new Date();
      const currentJsDay = hoje.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
      const weekdayKeyMap: Record<string, number> = {
        seg: 1,
        ter: 2,
        qua: 3,
        qui: 4,
        sex: 5,
      };

      gradeSemanal.forEach(block => {
        const blockJsDay = weekdayKeyMap[block.diaSemana] || 1;
        const isToday = currentJsDay === blockJsDay;
        const isPastDay = currentJsDay > blockJsDay && currentJsDay <= 5;

        block.itens.forEach(item => {
          const resps = extractResponsaveisList(item.responsaveis || item.responsavel);
          
          let prazoVisual: PrazoVisualInfo;
          if (item.concluido) {
            prazoVisual = {
              status: 'concluido',
              rotulo: 'Concluído',
              badgeClass: 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300',
              diasRestantes: 0,
            };
          } else if (isToday) {
            prazoVisual = {
              status: 'hoje',
              rotulo: 'Hoje (Rotina)',
              badgeClass: 'bg-cyan-950/80 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400',
              diasRestantes: 0,
            };
          } else if (isPastDay) {
            prazoVisual = {
              status: 'atrasado',
              rotulo: `Atrasada (${block.sigla})`,
              badgeClass: 'bg-rose-950/80 border-rose-500 text-rose-300 ring-1 ring-rose-500/50 animate-pulse',
              diasRestantes: -(currentJsDay - blockJsDay),
            };
          } else {
            const diasFaltam = blockJsDay > currentJsDay ? blockJsDay - currentJsDay : (7 - currentJsDay + blockJsDay);
            prazoVisual = {
              status: 'em_dia',
              rotulo: `Toda ${block.nome.split('-')[0]}`,
              badgeClass: 'bg-slate-900 border-slate-700 text-slate-300',
              diasRestantes: diasFaltam,
            };
          }

          activities.push({
            id: item.id,
            titulo: item.descricao,
            descricao: `Rotina Recorrente Semanal • ${block.nome}`,
            origemTipo: 'rotina_semanal',
            origemId: block.diaSemana,
            origemTitulo: `🗓️ Toda ${block.nome.split('-')[0]}`,
            diaSemana: block.diaSemana,
            prazoInfo: prazoVisual,
            concluido: item.concluido,
            destaque: item.destaque,
            prioridade: (isPastDay && !item.concluido) ? 'urgente' : 'normal',
            responsaveis: resps,
            requiresAck: false,
            ackStatus: 'nao_requer',
            helpOffersCount: 0,
            userHasPendingHelpOffer: false,
          });
        });
      });
    }

    // Desduplicação inteligente por chave normalizada (elimina tarefas duplicadas no mobile)
    const seenMap = new Set<string>();
    const deduplicated: CollaborativeActivity[] = [];

    activities.forEach(act => {
      const normTitle = act.titulo
        .replace(/[*:]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
      
      const dedupeKey = `${act.origemTipo}:${normTitle}`;
      if (!seenMap.has(dedupeKey)) {
        seenMap.add(dedupeKey);
        deduplicated.push(act);
      }
    });

    return deduplicated;
  }

  /**
   * Filtra as atividades de um colaborador específico
   */
  static filterActivitiesForMember(
    activities: CollaborativeActivity[], 
    memberName: string
  ): CollaborativeActivity[] {
    const clean = memberName.trim().toUpperCase();
    if (!clean) return [];

    return activities.filter(act => 
      act.responsaveis.some(r => r.toUpperCase() === clean)
    );
  }

  /**
   * Agrupa atividades nas 6 categorias exigidas pela especificação funcional
   */
  static groupActivities(activities: CollaborativeActivity[]): Record<ActivityUrgencyGroup, CollaborativeActivity[]> {
    const groups: Record<ActivityUrgencyGroup, CollaborativeActivity[]> = {
      urgentes: [],
      atrasadas: [],
      hoje: [],
      proximas: [],
      em_andamento: [],
      concluidas: [],
    };

    activities.forEach(act => {
      if (act.concluido) {
        groups.concluidas.push(act);
        return;
      }

      // Prioridade 1: Urgentes
      if (act.prioridade === 'urgente' || act.requiresAck) {
        groups.urgentes.push(act);
      }

      // Prioridade 2: Atrasadas
      if (act.prazoInfo.status === 'atrasado') {
        groups.atrasadas.push(act);
      } else if (act.prazoInfo.status === 'hoje') {
        // Prioridade 3: Vencem Hoje
        groups.hoje.push(act);
      } else if (act.prazoInfo.status === 'em_dia') {
        // Prioridade 4: Próximos Vencimentos
        groups.proximas.push(act);
      }

      // Prioridade 5: Em Andamento (todas as abertas dentro do prazo)
      if (act.prazoInfo.status !== 'atrasado') {
        groups.em_andamento.push(act);
      }
    });

    return groups;
  }

  /**
   * Registra a confirmação de ciência individual de uma demanda urgente
   */
  static async confirmActivityAcknowledgment(
    activityId: string,
    activityTitle: string,
    memberName: string,
    profileId?: string,
    employeeId?: string
  ): Promise<boolean> {
    const nowIso = new Date().toISOString();

    // 1. Tentar gravar no Supabase
    try {
      if (profileId) {
        const { error } = await supabase
          .from('notification_acknowledgments')
          .insert({
            activity_id: activityId,
            profile_id: profileId,
            employee_id: employeeId || null,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          });

        if (!error) {
          // Sucesso no banco
        }
      }
    } catch (err) {
      console.warn('[CollaborativePortalService] Gravando ciência local:', err);
    }

    // 2. Sempre persistir no cache local com rastreabilidade
    if (typeof window !== 'undefined') {
      try {
        const current = this.getLocalAcknowledgments();
        const existingIndex = current.findIndex(a => a.activityId === activityId && a.memberName === memberName);
        
        const record = {
          activityId,
          activityTitle,
          memberName: memberName.toUpperCase(),
          profileId,
          employeeId,
          acknowledgedAt: nowIso,
        };

        if (existingIndex >= 0) {
          current[existingIndex] = record;
        } else {
          current.push(record);
        }

        localStorage.setItem(LOCAL_ACKS_KEY, JSON.stringify(current));
      } catch (e) {
        console.error('Erro ao salvar ciência localmente:', e);
      }
    }

    return true;
  }

  /**
   * Submete uma oferta de ajuda de um colaborador para uma atividade de colega
   */
  static async submitHelpOffer(params: {
    activityId: string;
    activityTitle: string;
    taskOwnerName: string;
    offeredByName: string;
    offeredByProfileId: string;
    offeredByEmployeeId?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    const nowIso = new Date().toISOString();
    const cleanOwner = params.taskOwnerName.trim().toUpperCase();
    const cleanOfferedBy = params.offeredByName.trim().toUpperCase();

    if (cleanOwner === cleanOfferedBy) {
      return { 
        success: false, 
        message: 'Você já é o responsável por esta atividade.' 
      };
    }

    // 1. Verificar duplicidade de oferta pendente
    const allOffers = await this.getHelpOffers();
    const hasPending = allOffers.some(o => 
      o.activityId === params.activityId && 
      o.offeredByName.toUpperCase() === cleanOfferedBy && 
      o.status === 'pendente'
    );

    if (hasPending) {
      return { 
        success: false, 
        message: 'Você já possui uma oferta de ajuda pendente para esta atividade.' 
      };
    }

    const newOffer: HelpOffer = {
      id: `offer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      activityId: params.activityId,
      activityTitle: params.activityTitle,
      taskOwnerName: cleanOwner,
      offeredByProfileId: params.offeredByProfileId,
      offeredByEmployeeId: params.offeredByEmployeeId,
      offeredByName: cleanOfferedBy,
      notes: params.notes,
      status: 'pendente',
      createdAt: nowIso,
    };

    // 2. Tentar gravar no Supabase
    try {
      const { error } = await supabase
        .from('whiteboard_help_offers')
        .insert({
          activity_id: params.activityId,
          activity_title: params.activityTitle,
          task_owner_name: cleanOwner,
          offered_by_profile_id: params.offeredByProfileId,
          offered_by_employee_id: params.offeredByEmployeeId || null,
          offered_by_name: cleanOfferedBy,
          notes: params.notes || null,
          status: 'pendente',
        });

      if (error) {
        console.warn('[CollaborativePortalService] Gravando oferta de ajuda no cache local:', error);
      }
    } catch (e) {
      console.warn('[CollaborativePortalService] Fallback local para oferta de ajuda:', e);
    }

    // 3. Gravar no cache local
    if (typeof window !== 'undefined') {
      try {
        const localOffers = this.getLocalHelpOffers();
        localOffers.unshift(newOffer);
        localStorage.setItem(LOCAL_HELP_OFFERS_KEY, JSON.stringify(localOffers));
      } catch (e) {
        console.error('Erro ao salvar oferta de ajuda no localStorage:', e);
      }
    }

    return { 
      success: true, 
      message: 'Sua oferta de ajuda foi registrada com sucesso! O administrador e o responsável foram informados.' 
    };
  }

  /**
   * Avalia uma oferta de ajuda (Ação exclusiva do Administrador: Aceitar / Recusar)
   */
  static async decideHelpOffer(
    offerId: string, 
    decision: 'aceita' | 'recusada',
    adminNotes?: string,
    adminProfileId?: string
  ): Promise<boolean> {
    const nowIso = new Date().toISOString();

    // 1. Tentar atualizar no Supabase
    try {
      await supabase
        .from('whiteboard_help_offers')
        .update({
          status: decision,
          admin_notes: adminNotes || null,
          decided_at: nowIso,
          decided_by: adminProfileId || null,
        })
        .eq('id', offerId);
    } catch (e) {
      console.warn('[CollaborativePortalService] Atualização local da decisão de ajuda:', e);
    }

    // 2. Atualizar no cache local
    if (typeof window !== 'undefined') {
      try {
        const localOffers = this.getLocalHelpOffers();
        const idx = localOffers.findIndex(o => o.id === offerId);
        if (idx >= 0) {
          localOffers[idx].status = decision;
          localOffers[idx].adminNotes = adminNotes;
          localOffers[idx].decidedAt = nowIso;
          localStorage.setItem(LOCAL_HELP_OFFERS_KEY, JSON.stringify(localOffers));
        }
      } catch (e) {
        console.error('Erro ao atualizar decisão no cache:', e);
      }
    }

    return true;
  }

  /**
   * Consulta a lista de ofertas de ajuda (com fallback local)
   */
  static async getHelpOffers(): Promise<HelpOffer[]> {
    try {
      const { data, error } = await supabase
        .from('whiteboard_help_offers')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && !error && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          activityId: row.activity_id,
          activityTitle: row.activity_title,
          taskOwnerName: row.task_owner_name,
          offeredByProfileId: row.offered_by_profile_id,
          offeredByEmployeeId: row.offered_by_employee_id,
          offeredByName: row.offered_by_name,
          notes: row.notes,
          status: row.status,
          adminNotes: row.admin_notes,
          decidedAt: row.decided_at,
          decidedByName: row.decided_by,
          createdAt: row.created_at,
        }));
      }
    } catch {
      // Supabase table not created yet or offline
    }

    return this.getLocalHelpOffers();
  }

  /**
   * Consulta confirmações de ciência registradas
   */
  static async getAcknowledgments(): Promise<Array<{
    activityId: string;
    memberName?: string;
    acknowledgedAt: string;
  }>> {
    try {
      const { data, error } = await supabase
        .from('notification_acknowledgments')
        .select('activity_id, acknowledged_at, profiles(full_name)');

      if (data && !error && data.length > 0) {
        return data.map((row: any) => ({
          activityId: row.activity_id,
          memberName: row.profiles?.full_name || 'COLABORADOR',
          acknowledgedAt: row.acknowledged_at,
        }));
      }
    } catch {
      // Ignora erro se tabela não existir
    }

    return this.getLocalAcknowledgments();
  }

  /**
   * Obtém as notificações do colaborador (por perfil ou por nome de membro da Lousa)
   */
  static async getNotifications(profileId?: string, memberName?: string): Promise<PortalNotification[]> {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      const conditions: string[] = ['target_type.eq.all'];
      if (profileId) {
        conditions.push(`target_profile_id.eq.${profileId}`);
      }
      if (memberName) {
        conditions.push(`target_member_name.eq.${memberName.trim().toUpperCase()}`);
      }

      const { data, error } = await query.or(conditions.join(','));

      if (data && !error && data.length > 0) {
        return data.map(n => ({
          id: n.id,
          title: n.title,
          body: n.body,
          priority: n.priority as any,
          category: n.category as any,
          targetType: n.target_type as any,
          targetMemberName: n.target_member_name,
          activityId: n.activity_id,
          activityTitle: n.activity_title,
          requiresAck: n.requires_ack,
          acknowledged: false,
          createdAt: n.created_at,
          read: true,
        }));
      }
    } catch (err) {
      console.warn('[CollaborativePortalService] Fallback de notificações para local:', err);
    }

    const localList = this.getLocalNotifications();
    if (memberName) {
      const clean = memberName.trim().toUpperCase();
      return localList.filter(n => !n.targetMemberName || n.targetMemberName.toUpperCase() === clean || n.targetType === 'all');
    }
    return localList;
  }

  /**
   * DISPARO AUTOMÁTICO DE NOTIFICAÇÃO:
   * Acionado imediatamente quando o administrador cria uma nova tarefa com responsável designado
   * ou atribui um colaborador a uma demanda existente.
   */
  static async createAutomaticTaskNotification({
    taskTitle,
    origin,
    responsaveis,
    prazo,
    isUrgent,
    activityId,
  }: {
    taskTitle: string;
    origin: string;
    responsaveis: string[];
    prazo?: string;
    isUrgent?: boolean;
    activityId?: string;
  }): Promise<void> {
    if (!responsaveis || responsaveis.length === 0) return;

    const distinctResps = Array.from(
      new Set(responsaveis.map(r => r.trim().toUpperCase()).filter(Boolean))
    );
    if (distinctResps.length === 0) return;

    for (const resp of distinctResps) {
      const title = isUrgent
        ? `🚨 Demanda Urgente Atribuída: ${taskTitle}`
        : `📋 Nova Atividade Atribuída: ${taskTitle}`;
      const body = `Você foi designado como responsável por esta demanda em ${origin}.${
        prazo ? ` Prazo: ${prazo}.` : ''
      }`;

      const notifObj: PortalNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title,
        body,
        priority: isUrgent ? 'urgent' : 'important',
        category: 'task_alert',
        targetType: 'member',
        targetMemberName: resp,
        activityTitle: taskTitle,
        activityId,
        requiresAck: Boolean(isUrgent),
        acknowledged: false,
        createdAt: new Date().toISOString(),
        read: false,
      };

      // 1. Persistir no Supabase
      try {
        await supabase.from('notifications').insert({
          title: notifObj.title,
          body: notifObj.body,
          priority: notifObj.priority,
          category: notifObj.category,
          target_type: 'member',
          target_member_name: resp,
          activity_title: taskTitle,
          activity_id: activityId || null,
          requires_ack: notifObj.requiresAck,
        });
      } catch (err) {
        console.warn('[CollaborativePortalService] Erro ao gravar notificação no Supabase:', err);
      }

      // 2. Persistir no cache local
      this.saveLocalNotification(notifObj);

      // 3. Disparar notificação nativa imediata no navegador se compatível e autorizado
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(notifObj.title, {
            body: notifObj.body,
            icon: '/Favicon.png',
            tag: `task-${activityId || Date.now()}`,
          });
        } catch (pushErr) {
          console.warn('Erro ao disparar Web Push no navegador:', pushErr);
        }
      }
    }
  }

  /**
   * Envia um comunicado administrativo manual para toda a equipe ou para um membro específico
   */
  static async sendBroadcastNotification({
    title,
    body,
    priority,
    targetType,
    targetMemberName,
  }: {
    title: string;
    body: string;
    priority: NotificationPriority;
    targetType: 'all' | 'member';
    targetMemberName?: string;
  }): Promise<boolean> {
    const notifObj: PortalNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      body,
      priority,
      category: 'manual_broadcast',
      targetType,
      targetMemberName: targetMemberName ? targetMemberName.trim().toUpperCase() : undefined,
      requiresAck: priority === 'urgent',
      acknowledged: false,
      createdAt: new Date().toISOString(),
      read: false,
    };

    try {
      await supabase.from('notifications').insert({
        title: notifObj.title,
        body: notifObj.body,
        priority: notifObj.priority,
        category: notifObj.category,
        target_type: targetType,
        target_member_name: notifObj.targetMemberName || null,
        requires_ack: notifObj.requiresAck,
      });
    } catch (err) {
      console.warn('[CollaborativePortalService] Erro ao gravar broadcast no Supabase:', err);
    }

    this.saveLocalNotification(notifObj);

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/Favicon.png',
        });
      } catch {}
    }

    return true;
  }

  /**
   * Consulta os dispositivos cadastrados no navegador atual
   */
  static getRegisteredDevices(): RegisteredDevice[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(LOCAL_DEVICES_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Erro ao ler dispositivos locais:', e);
    }

    return [];
  }

  /**
   * Cadastra e vincula o dispositivo atual ao membro selecionado no Supabase e no cache local
   */
  static async registerMemberDevice({
    memberName,
    deviceLabel,
    deviceType,
  }: {
    memberName: string;
    deviceLabel: string;
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'other';
  }): Promise<RegisteredDevice> {
    const cleanMember = memberName.trim().toUpperCase();
    const newDevice: RegisteredDevice = {
      id: `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      memberName: cleanMember,
      deviceLabel,
      deviceType,
      endpoint: `endpoint-${cleanMember}-${Date.now()}`,
      active: true,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // 1. Salvar no Supabase
    try {
      await supabase.from('push_subscriptions').insert({
        member_name: cleanMember,
        device_label: deviceLabel,
        device_type: deviceType,
        endpoint: newDevice.endpoint,
        p256dh: 'browser_p256dh',
        auth: 'browser_auth',
        active: true,
      });
    } catch (err) {
      console.warn('[CollaborativePortalService] Gravando dispositivo local:', err);
    }

    // 2. Salvar no localStorage
    this.saveDevice(newDevice);

    return newDevice;
  }

  /**
   * Retorna todos os dispositivos cadastrados no sistema (do Supabase e local)
   */
  static async getAllRegisteredDevices(): Promise<RegisteredDevice[]> {
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .order('last_seen_at', { ascending: false });

      if (data && !error && data.length > 0) {
        return data.map(d => ({
          id: d.id,
          memberName: d.member_name,
          deviceLabel: d.device_label,
          deviceType: d.device_type as any,
          endpoint: d.endpoint,
          active: d.active,
          lastSeenAt: d.last_seen_at,
          createdAt: d.created_at,
        }));
      }
    } catch (err) {
      console.warn('[CollaborativePortalService] Erro ao carregar dispositivos do Supabase:', err);
    }

    return this.getRegisteredDevices();
  }

  /**
   * Salva dispositivo cadastrado no cache local
   */
  static saveDevice(device: RegisteredDevice): void {
    if (typeof window === 'undefined') return;
    try {
      const list = this.getRegisteredDevices().filter(d => d.id !== device.id);
      list.push(device);
      localStorage.setItem(LOCAL_DEVICES_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Erro ao salvar dispositivo:', e);
    }
  }

  /**
   * Salva uma notificação no cache local
   */
  static saveLocalNotification(notification: PortalNotification): void {
    if (typeof window === 'undefined') return;
    try {
      const list = this.getLocalNotifications();
      list.unshift(notification);
      localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (e) {
      console.error('Erro ao salvar notificação local:', e);
    }
  }

  /**
   * Remove um membro cadastrado da tabela whiteboard_member_links no Supabase
   */
  static async deleteMemberFromDatabase(memberName: string): Promise<void> {
    const clean = memberName.trim().toUpperCase();
    if (!clean) return;
    try {
      await supabase
        .from('whiteboard_member_links')
        .delete()
        .eq('member_name', clean);
    } catch (err) {
      console.warn('[CollaborativePortalService] Erro ao excluir vínculo do membro no Supabase:', err);
    }
  }

  /**
   * Remove dispositivo
   */
  static removeDevice(deviceId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const list = this.getRegisteredDevices().filter(d => d.id !== deviceId);
      localStorage.setItem(LOCAL_DEVICES_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Erro ao remover dispositivo:', e);
    }
  }

  // ── HELPERS LOCAIS DE STORAGE ──
  private static getLocalHelpOffers(): HelpOffer[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(LOCAL_HELP_OFFERS_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Erro ao ler ofertas locais:', e);
    }
    return [];
  }

  private static getLocalAcknowledgments(): Array<{
    activityId: string;
    memberName: string;
    acknowledgedAt: string;
  }> {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(LOCAL_ACKS_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Erro ao ler ciências locais:', e);
    }
    return [];
  }

  private static getLocalNotifications(): PortalNotification[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Erro ao ler notificações locais:', e);
    }

    // Notificações padrão ilustrativas com identidade Mar Brasil
    const today = new Date().toLocaleDateString('pt-BR');
    return [
      {
        id: 'notif-1',
        title: '🔴 Demanda Urgente Atribuída',
        body: 'Nova obrigação crítica requer sua atenção imediata na Lousa Operacional.',
        priority: 'urgent',
        category: 'task_alert',
        activityId: 'it-4-4',
        activityTitle: 'PROCESSO JUNTO À RFB',
        requiresAck: true,
        acknowledged: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        title: '📋 Boletim Matinal Mar Brasil',
        body: `Bom dia! Confira suas prioridades e obrigações operacionais para ${today}.`,
        priority: 'info',
        category: 'morning_digest',
        requiresAck: false,
        acknowledged: false,
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
      {
        id: 'notif-3',
        title: '🟠 Vencimento Próximo',
        body: 'Obrigação com vencimento previsto para as próximas 48h.',
        priority: 'important',
        category: 'task_alert',
        activityId: 'tl-16',
        activityTitle: '25 - FECHAMENTO OPERACIONAL - MARCOS / MATHEUS',
        requiresAck: false,
        acknowledged: false,
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      }
    ];
  }
}
