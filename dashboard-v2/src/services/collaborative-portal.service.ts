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
  RegisteredDevice
} from '@/types/collaborative-portal';
import { 
  WarRoomService, 
  DEFAULT_WHITEBOARD_DATA, 
  calculatePrazoInfo, 
  extractResponsaveisList 
} from '@/services/war-room.service';
import { WhiteboardDataState } from '@/types/war-room';

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

    return activities;
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
   * Obtém as notificações do colaborador
   */
  static async getNotifications(profileId?: string): Promise<PortalNotification[]> {
    try {
      if (profileId) {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .or(`target_type.eq.all,target_profile_id.eq.${profileId}`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (data && !error && data.length > 0) {
          return data.map(n => ({
            id: n.id,
            title: n.title,
            body: n.body,
            priority: n.priority as any,
            category: n.category as any,
            activityId: n.activity_id,
            activityTitle: n.activity_title,
            requiresAck: n.requires_ack,
            acknowledged: false,
            createdAt: n.created_at,
            read: true,
          }));
        }
      }
    } catch {
      // Fallback
    }

    return this.getLocalNotifications();
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

    // Dispositivo padrão atual detectado
    const isWindows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    const deviceLabel = isWindows 
      ? 'Windows 11 (Google Chrome)' 
      : isAndroid 
      ? 'Motorola Android (Chrome)' 
      : 'Navegador Web Ativo';

    return [
      {
        id: 'dev-current',
        deviceLabel,
        deviceType: isWindows ? 'desktop' : isAndroid ? 'mobile' : 'other',
        active: true,
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }
    ];
  }

  /**
   * Salva dispositivo cadastrado
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
        activityTitle: '25 - MANUS / CLARA - DZM',
        requiresAck: false,
        acknowledged: false,
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      }
    ];
  }
}
