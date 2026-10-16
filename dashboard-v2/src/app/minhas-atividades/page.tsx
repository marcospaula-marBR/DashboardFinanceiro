"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PortalNavigation } from '@/components/collaborative-portal/PortalNavigation';
import { CollaborativePortalService } from '@/services/collaborative-portal.service';
import { CollaborativeActivity, ActivityUrgencyGroup } from '@/types/collaborative-portal';
import { getResponsibleColor } from '@/services/war-room.service';
import { supabase } from '@/lib/supabase';
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from '@/lib/web-push.config';
import { 
  AlertTriangle, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Flame, 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  Sparkles, 
  Inbox, 
  Bell, 
  BellRing,
  Smartphone,
  UserCheck,
  RefreshCw,
  Megaphone,
  Volume2,
  ChevronDown,
  ChevronUp,
  HelpCircle
} from 'lucide-react';

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

function MinhasAtividadesContent() {
  const searchParams = useSearchParams();
  const [activeMember, setActiveMember] = useState<string>('MARCOS');
  const [availableMembers, setAvailableMembers] = useState<string[]>(OFFICIAL_MEMBERS);
  const [allActivities, setAllActivities] = useState<CollaborativeActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [ackLoadingId, setAckLoadingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [deviceConnected, setDeviceConnected] = useState<boolean>(false);
  const [deviceLabel, setDeviceLabel] = useState<string>('');
  const [justActivatedFeedback, setJustActivatedFeedback] = useState<boolean>(false);

  const [incomingAlert, setIncomingAlert] = useState<{ title: string; body: string } | null>(null);
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([]);
  const [showAndroidBatteryGuide, setShowAndroidBatteryGuide] = useState<boolean>(false);

  // Rastreamento resiliente de IDs já exibidos/alertados neste dispositivo
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Inicializa ou retoma contexto de áudio na primeira interação do usuário na página
  const unlockAudioContext = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch {}
  };

  useEffect(() => {
    const handleGesture = () => unlockAudioContext();
    window.addEventListener('click', handleGesture, { passive: true });
    window.addEventListener('touchstart', handleGesture, { passive: true });
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
  }, []);

  // Sintetizador sonoro leve com Web Audio API para alerta audível mesmo em celular
  const playNotificationSound = () => {
    try {
      unlockAudioContext();
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174, now + 0.18);
      gain2.gain.setValueAtTime(0.4, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.38);
    } catch {}
  };

  // 1. Resolver membro ativo: Parâmetro da URL (?membro=MARCOS) ou LocalStorage ou Padrão MARCOS
  useEffect(() => {
    let resolvedMember = 'MARCOS';

    const urlMember = searchParams.get('membro');
    if (urlMember && urlMember.trim()) {
      resolvedMember = urlMember.trim().toUpperCase();
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('mb_collaborative_member_name', resolvedMember);
        } catch {}
      }
    } else if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mb_collaborative_member_name');
        if (saved && saved.trim()) {
          resolvedMember = saved.trim().toUpperCase();
        }
      } catch {}
    }

    setActiveMember(resolvedMember);
  }, [searchParams]);

  // 2. Registrar Service Worker no navegador e detectar permissão nativa
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((reg) => {
            console.log('[SW] Service Worker registrado:', reg.scope);
            reg.update().catch(() => {});
          })
          .catch((err) => console.warn('[SW] Erro ao registrar SW:', err));
      }

      if ('Notification' in window) {
        setDeviceConnected(Notification.permission === 'granted');
        const isWindows = /Windows/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);
        setDeviceLabel(isWindows ? 'Windows 11 (Google Chrome)' : isAndroid ? 'Motorola Android (Chrome)' : 'Google Chrome');
      }
    }
  }, []);

  // 3. Trocar membro ativo e salvar no localStorage
  const handleSelectMember = (memberName: string) => {
    const upper = memberName.trim().toUpperCase();
    setActiveMember(upper);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mb_collaborative_member_name', upper);
      } catch {}
    }
  };

  // 4.1 Disparador universal nativo compatível com Motorola Android (Chrome) e Windows 11
  const triggerNativeNotification = async (title: string, body: string, tag?: string) => {
    if (typeof window === 'undefined') return;

    // Disparar feedback sonoro e tátil imediato no celular
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
      playNotificationSound();
    } catch {}

    // Exibir banner toast flutuante no topo da tela do celular
    setIncomingAlert({ title, body });
    setTimeout(() => setIncomingAlert(null), 6000);

    if (!('Notification' in window)) return;

    if (Notification.permission !== 'granted') {
      return;
    }

    const options: any = {
      body,
      icon: '/Favicon.png',
      badge: '/Favicon.png',
      tag: tag || `marbrasil-${Date.now()}`,
      vibrate: [200, 100, 200, 100, 300],
      renotify: true,
      data: { url: '/minhas-atividades' },
    };

    // No Android Chrome (PWA / Mobile), showNotification via Service Worker é OBRIGATÓRIO
    if ('serviceWorker' in navigator) {
      try {
        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }

        const readyReg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<ServiceWorkerRegistration | null>((r) => setTimeout(() => r(reg || null), 1200))
        ]);

        const activeReg = readyReg || reg;
        if (activeReg && activeReg.showNotification) {
          await activeReg.showNotification(title, options);
          return;
        }
      } catch (swErr) {
        console.warn('Falha no showNotification do Service Worker, tentando fallback:', swErr);
      }
    }

    // Fallback para Desktop Windows 11 Google Chrome
    try {
      new Notification(title, options);
    } catch (notifErr) {
      console.warn('Erro na instanciação direta de Notification:', notifErr);
    }
  };

  // 4.2 Sincronizar inscrição de Web Push real no Google Cloud Messaging (FCM)
  const syncPushSubscription = async (member: string) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const res = await CollaborativePortalService.subscribeDeviceToPush(member);
      if (res.success) {
        setDeviceConnected(true);
      }
    } catch (err) {
      console.warn('[MinhasAtividades] Erro ao sincronizar push subscription:', err);
    }
  };

  // 4.3 Habilitar Notificações Web Push e Vincular ao Membro
  const handleEnableDevicePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Seu navegador atual não suporta notificações Web Push nativas.');
      return;
    }

    unlockAudioContext();

    try {
      const res = await CollaborativePortalService.subscribeDeviceToPush(activeMember);
      if (res.success) {
        setDeviceConnected(true);
        setJustActivatedFeedback(true);
        setTimeout(() => setJustActivatedFeedback(false), 4000);

        await triggerNativeNotification(
          `🔔 Notificações Ativadas — ${activeMember}`,
          `Aparelho conectado com sucesso ao Google Cloud Messaging! Você receberá avisos automáticos e som na tela.`,
          `activate-${activeMember}`
        );
      } else {
        alert(res.error || 'Não foi possível conectar o dispositivo.');
      }
    } catch (e) {
      console.warn('Erro ao habilitar notificações:', e);
    }
  };

  const handleTestDeviceNotification = async () => {
    unlockAudioContext();
    await CollaborativePortalService.dispatchPushToServer({
      targetType: 'member',
      targetMemberName: activeMember,
      title: `🚨 Alerta Teste — ${activeMember}`,
      body: `Notificação teste entregue com sucesso pela Central Mar Brasil no seu aparelho.`,
      priority: 'urgent',
      tag: `test-${Date.now()}`,
    });
    await triggerNativeNotification(
      `🚨 Alerta Teste — ${activeMember}`,
      `Notificação teste entregue com sucesso pela Central Mar Brasil no seu aparelho.`,
      `test-${Date.now()}`
    );
    setJustActivatedFeedback(true);
    setTimeout(() => setJustActivatedFeedback(false), 3000);
  };

  // 5. Carregar dados das atividades
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await CollaborativePortalService.getAllActivities(activeMember);
      setAllActivities(data);
    } catch (err) {
      console.warn('[MinhasAtividades] Erro ao carregar atividades:', err);
    } finally {
      setLoading(false);
    }
  };

  // 6. Buscar comunicados recentes e disparar alerta apenas se for inédito
  const checkRecentNotifications = async (shouldAlertOnNew = true) => {
    if (!activeMember) return;
    try {
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .or(`target_type.eq.all,target_member_name.eq.${activeMember.toUpperCase()}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (notifs && notifs.length > 0) {
        setRecentAnnouncements(notifs);

        const nowMs = Date.now();
        for (const notif of notifs) {
          const isUnseen = !seenNotificationIdsRef.current.has(notif.id);
          seenNotificationIdsRef.current.add(notif.id);

          if (isUnseen && shouldAlertOnNew) {
            const notifCreatedMs = notif.created_at ? new Date(notif.created_at).getTime() : nowMs;
            const isFresh = nowMs - notifCreatedMs < 20 * 60 * 1000; // Criada nos últimos 20 minutos
            if (isFresh) {
              triggerNativeNotification(notif.title, notif.body, `notif-${notif.id}`);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[MinhasAtividades] Erro ao buscar avisos recentes:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeMember]);

  // 7. Escuta em Tempo Real (Supabase Realtime), Polling e Retomada de Tela (VisibilityChange)
  useEffect(() => {
    if (!activeMember) return;

    // 1. Carga inicial dos comunicados sem alertar retroativamente em massa
    checkRecentNotifications(false);

    // 2. Sincronizar inscrição de push se permissão já estiver ativa
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      syncPushSubscription(activeMember);
    }

    // 3. Canal Realtime Supabase ouvindo INSERT na tabela notifications
    const channel = supabase
      .channel(`mobile-notifs-${activeMember.toLowerCase()}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as any;
          if (!newNotif) return;

          const targetMember = newNotif.target_member_name?.trim().toUpperCase();
          const isForAll = newNotif.target_type === 'all' || !targetMember;
          const isForMe = targetMember === activeMember.toUpperCase();

          if (isForAll || isForMe) {
            seenNotificationIdsRef.current.add(newNotif.id);
            triggerNativeNotification(newNotif.title, newNotif.body, `notif-${newNotif.id}`);
            checkRecentNotifications(false);
            loadData();
          }
        }
      )
      .subscribe((status) => {
        console.log('[Supabase Realtime] Conexão no celular:', status);
      });

    // 4. Polling inteligente a cada 6 segundos para resguardo se WebSocket oscilar
    const interval = setInterval(() => {
      checkRecentNotifications(true);
    }, 6000);

    // 5. Escuta de retorno de tela / desbloqueio de celular (Visibility Change)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkRecentNotifications(true);
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeMember]);

  // Filtrar apenas atividades atribuídas ao membro ativo
  const memberActivities = useMemo(() => {
    return CollaborativePortalService.filterActivitiesForMember(allActivities, activeMember);
  }, [allActivities, activeMember]);

  // Agrupamento nas 6 categorias oficiais
  const grouped = useMemo(() => {
    return CollaborativePortalService.groupActivities(memberActivities);
  }, [memberActivities]);

  // Manipulador de confirmação individual de ciência
  const handleConfirmAck = async (activity: CollaborativeActivity) => {
    setAckLoadingId(activity.id);
    try {
      await CollaborativePortalService.confirmActivityAcknowledgment(
        activity.id,
        activity.titulo,
        activeMember
      );
      await loadData();
    } catch (e) {
      console.error('Erro ao confirmar ciência:', e);
    } finally {
      setAckLoadingId(null);
    }
  };

  // Manipulador de alternância de conclusão da atividade (notifica o Gestor Marcos se concluída)
  const handleToggleActivity = async (activity: CollaborativeActivity) => {
    setCompletingId(activity.id);
    try {
      const res = await CollaborativePortalService.toggleActivityCompletion(activity, activeMember);
      if (res.success) {
        if (res.newState) {
          playNotificationSound();
        }
        await loadData();
      }
    } catch (e) {
      console.error('Erro ao alternar status da atividade:', e);
    } finally {
      setCompletingId(null);
    }
  };

  const memberColor = getResponsibleColor(activeMember);

  const sections: Array<{
    key: ActivityUrgencyGroup;
    title: string;
    icon: any;
    colorClass: string;
    bgClass: string;
    borderClass: string;
    emptyText: string;
  }> = [
    {
      key: 'urgentes',
      title: '🚨 Urgentes & Críticas',
      icon: Flame,
      colorClass: 'text-rose-400',
      bgClass: 'bg-rose-950/20',
      borderClass: 'border-rose-500/40',
      emptyText: 'Nenhuma atividade crítica pendente no momento.',
    },
    {
      key: 'atrasadas',
      title: '⚠️ Prazos Vencidos',
      icon: AlertTriangle,
      colorClass: 'text-amber-400',
      bgClass: 'bg-amber-950/20',
      borderClass: 'border-amber-500/40',
      emptyText: 'Nenhum prazo atrasado registrado.',
    },
    {
      key: 'hoje',
      title: '⭐ Vencem Hoje',
      icon: Clock,
      colorClass: 'text-yellow-400',
      bgClass: 'bg-yellow-950/20',
      borderClass: 'border-yellow-500/40',
      emptyText: 'Nenhuma tarefa com vencimento para hoje.',
    },
    {
      key: 'proximas',
      title: '📅 Próximos Vencimentos',
      icon: Calendar,
      colorClass: 'text-cyan-400',
      bgClass: 'bg-cyan-950/15',
      borderClass: 'border-cyan-500/30',
      emptyText: 'Nenhum vencimento agendado para os próximos dias.',
    },
    {
      key: 'em_andamento',
      title: '🟢 Em Andamento',
      icon: ArrowRight,
      colorClass: 'text-emerald-400',
      bgClass: 'bg-emerald-950/15',
      borderClass: 'border-emerald-500/30',
      emptyText: 'Todas as atividades ativas foram processadas.',
    },
    {
      key: 'concluidas',
      title: '✅ Concluídas',
      icon: CheckCircle2,
      colorClass: 'text-slate-400',
      bgClass: 'bg-slate-900/40',
      borderClass: 'border-slate-800',
      emptyText: 'Histórico de atividades concluídas limpo.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 pb-24 md:pb-12">
      {/* ALERTA VISUAL INSTANTÂNEO FLUTUANTE (FEEDBACK TRÍPLICE NO MOBILE) */}
      {incomingAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md p-4 rounded-2xl bg-gradient-to-r from-emerald-950 to-slate-900 border-2 border-emerald-500 shadow-2xl shadow-emerald-950/80 animate-in slide-in-from-top duration-300">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <BellRing size={20} className="animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-emerald-300 uppercase tracking-wide">
                {incomingAlert.title}
              </h4>
              <p className="text-xs text-white font-medium mt-0.5 leading-snug">
                {incomingAlert.body}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* NAVEGAÇÃO UNIFICADA COM MEMBROS OFICIAIS */}
      <PortalNavigation 
        activeMember={activeMember}
        onSelectMember={handleSelectMember}
        availableMembers={availableMembers}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-5">
        
        {/* SELETOR RÁPIDO DE MEMBRO EM 1 TOQUE (TOUCH-FRIENDLY NO CELULAR) */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
              <UserCheck size={13} className="text-cyan-400" />
              <span>Selecione seu Nome na Equipe:</span>
            </span>
            <span className="text-[10px] text-cyan-300 font-mono font-bold">
              Ativo: {activeMember}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {availableMembers.map(m => {
              const isSelected = m.toUpperCase() === activeMember.toUpperCase();
              const color = getResponsibleColor(m);

              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMember(m)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all border min-h-[42px] ${
                    isSelected
                      ? color.pillActiveClass
                      : 'bg-slate-900/90 border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${color.dotClass}`} />
                  <span>{m}</span>
                  {isSelected && <Check size={12} className="stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* BANNER DO COLABORADOR */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#090e1a] to-[#0c1527] border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-mono font-black text-lg ${memberColor.badgeClass}`}>
              {activeMember.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white uppercase font-mono tracking-wide">
                  Minhas Atividades — {activeMember}
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                  Colaborador
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Acompanhe suas tarefas da lousa e receba alertas automáticos de novas demandas.
              </p>
            </div>
          </div>

          {/* INDICADORES RÁPIDOS */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Total:</span>
              <span className="text-xs font-black text-white">{memberActivities.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center gap-2">
              <span className="text-[11px] text-rose-300">Urgentes:</span>
              <span className="text-xs font-black text-rose-400">{grouped.urgentes.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-2">
              <span className="text-[11px] text-amber-300">Atrasadas:</span>
              <span className="text-xs font-black text-amber-400">{grouped.atrasadas.length}</span>
            </div>
          </div>
        </div>

        {/* FEEDBACK DE ATIVAÇÃO EM TEMPO REAL */}
        {justActivatedFeedback && (
          <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200 shadow-xl">
            <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
            <span>Dispositivo conectado com sucesso! Este aparelho receberá alertas automáticos para {activeMember}.</span>
          </div>
        )}

        {/* CARD DE CONEXÃO DO APARELHO (WINDOWS 11 / MOTOROLA ANDROID) */}
        <div className={`p-4 rounded-2xl border shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          deviceConnected
            ? 'bg-gradient-to-r from-emerald-950/30 via-slate-950 to-slate-950 border-emerald-500/50'
            : 'bg-gradient-to-r from-cyan-950/30 via-slate-950 to-slate-950 border-cyan-500/50'
        }`}>
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`p-2.5 rounded-xl flex-shrink-0 ${
              deviceConnected 
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/50 shadow-md shadow-emerald-950/50' 
                : 'bg-cyan-950 text-cyan-400 border border-cyan-500/50 animate-pulse'
            }`}>
              {deviceConnected ? <CheckCircle2 size={24} /> : <Smartphone size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  {deviceConnected ? 'Aparelho Vinculado com Sucesso' : 'Conectar Alertas no seu Aparelho'}
                </h3>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  deviceConnected 
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50' 
                    : 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                }`}>
                  Titular: {activeMember}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {deviceConnected
                  ? `Seu aparelho (${deviceLabel}) está pronto para receber avisos e som na tela sempre que uma nova tarefa for atribuída a ${activeMember}.`
                  : `Habilite o Google Chrome (no celular Motorola ou Windows 11) para receber alertas automáticos de novas tarefas atribuídas a ${activeMember}.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!deviceConnected ? (
              <button
                type="button"
                onClick={handleEnableDevicePush}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase font-mono tracking-wider transition-all shadow-lg shadow-cyan-950/60 min-h-[46px]"
              >
                <Bell size={16} />
                <span>Ativar Alertas para {activeMember}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleTestDeviceNotification}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 hover:text-white text-xs font-bold transition-all border border-emerald-500/40 min-h-[44px]"
                  title="Enviar uma notificação teste para conferir na tela"
                >
                  <Sparkles size={14} className="text-emerald-400" />
                  <span>Testar Alerta</span>
                </button>
                <button
                  type="button"
                  onClick={handleEnableDevicePush}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all border border-slate-800 min-h-[44px]"
                  title="Atualizar registro deste aparelho"
                >
                  <RefreshCw size={13} />
                  <span>Reconectar</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* GUIA EXECUTIVO: RECEBER ALERTAS COM TELA BLOQUEADA / SEGUNDO PLANO NO ANDROID */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#070b14] overflow-hidden shadow-lg transition-all">
          <button
            type="button"
            onClick={() => setShowAndroidBatteryGuide(prev => !prev)}
            className="w-full p-3.5 sm:p-4 flex items-center justify-between text-left hover:bg-slate-900/40 transition-colors min-h-[48px]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <HelpCircle size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wide truncate">
                  💡 Como receber notificações com tela bloqueada ou app fechado?
                </h4>
                <p className="text-[11px] text-slate-400">
                  Dica de configuração de bateria para celulares Android (Motorola / Chrome)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400 shrink-0 ml-2">
              <span className="text-[10px] font-mono font-bold hidden sm:inline text-amber-400/90">
                {showAndroidBatteryGuide ? 'Recolher' : 'Ver Instruções'}
              </span>
              {showAndroidBatteryGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {showAndroidBatteryGuide && (
            <div className="p-4 pt-1 border-t border-slate-800/80 bg-slate-950/60 space-y-3 text-xs animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {/* PASSO 1: BATERIA IRRESTRITA */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-amber-500/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs uppercase">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">1</span>
                    <span>Bateria Irrestrita</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    No Android, abra <strong>Configurações &gt; Apps &gt; Chrome &gt; Bateria</strong> e marque <strong>"Sem restrições" (ou Irrestrita)</strong>.
                  </p>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    <em>No modo padrão "Otimizada", o Android desliga a conexão do Chrome em segundo plano quando a tela apaga para poupar bateria.</em>
                  </p>
                </div>

                {/* PASSO 2: INSTALAR PWA */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold text-xs uppercase">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px]">2</span>
                    <span>Instalar na Tela Inicial</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    No Chrome, toque nos <strong>3 pontinhos</strong> no topo e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </p>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    <em>Aplicativos instalados recebem prioridade máxima do sistema para emitir som e vibração de alerta.</em>
                  </p>
                </div>

                {/* PASSO 3: SOM E NOTIFICAÇÃO NATIVA */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-xs uppercase">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">3</span>
                    <span>Som & Teste Real</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Certifique-se de que o modo "Não Perturbe" está desativado e clique no botão <strong>"Testar Alerta"</strong> acima para conferir o toque.
                  </p>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    <em>Aparelhos ativos na base recebem automaticamente as novas demandas criadas na Lousa.</em>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CARD EXECUTIVO: COMUNICADOS DA LIDERANÇA & AVISOS RECENTES */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#070b14] via-[#0b1222] to-[#070b14] border border-cyan-900/40 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-cyan-400 animate-pulse" />
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white font-mono">
                Avisos da Liderança & Comunicados Recentes
              </h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-bold">
              {recentAnnouncements.length} {recentAnnouncements.length === 1 ? 'aviso' : 'avisos'}
            </span>
          </div>

          {recentAnnouncements.length === 0 ? (
            <div className="p-4 text-center rounded-xl bg-slate-950/40 border border-slate-900 text-slate-400 text-xs flex items-center justify-center gap-2">
              <Volume2 size={15} className="text-slate-500" />
              <span>Nenhum comunicado recente nas últimas horas. Canal conectado e pronto para alertas.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
              {recentAnnouncements.map((notif) => {
                const isAll = notif.target_type === 'all' || !notif.target_member_name;
                const isUrgent = notif.priority === 'urgent';
                const dateStr = notif.created_at
                  ? new Date(notif.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : '--:--';

                return (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      isUrgent
                        ? 'bg-rose-950/20 border-rose-500/40'
                        : 'bg-slate-900/60 border-slate-800 hover:border-cyan-800/60'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        isUrgent ? 'bg-rose-400 animate-ping' : 'bg-cyan-400'
                      }`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-white uppercase font-mono truncate">
                            {notif.title}
                          </h4>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            isAll
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/40'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                          }`}>
                            {isAll ? '📢 Toda a Equipe' : `👤 Exclusivo: ${notif.target_member_name}`}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {dateStr}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5 leading-snug break-words">
                          {notif.body}
                        </p>
                      </div>
                    </div>

                    {notif.requires_ack && (
                      <span className="text-[10px] font-mono px-2 py-1 rounded bg-amber-950/60 text-amber-300 border border-amber-500/40 font-bold shrink-0 self-start sm:self-center">
                        ⚠️ Requer Atenção
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="text-center py-12 text-slate-500 text-xs">
            Carregando atividades da equipe...
          </div>
        )}

        {/* SEÇÕES DE ATIVIDADES AGRUPADAS */}
        {!loading && (
          <div className="space-y-6">
            {sections.map(section => {
              const items = grouped[section.key];
              const Icon = section.icon;

              return (
                <section key={section.key} className="space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={section.colorClass} />
                      <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white font-mono">
                        {section.title}
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-bold">
                      {items.length} {items.length === 1 ? 'atividade' : 'atividades'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {items.length === 0 ? (
                      <div className="md:col-span-2 p-5 text-center rounded-xl bg-slate-950/40 border border-slate-900 text-slate-500 text-xs flex items-center justify-center gap-2">
                        <Inbox size={14} className="text-slate-600" />
                        <span>{section.emptyText}</span>
                      </div>
                    ) : (
                      items.map(activity => {
                        return (
                          <div
                            key={activity.id}
                            className={`p-3.5 sm:p-4 rounded-xl border transition-all ${section.bgClass} ${section.borderClass} ${
                              activity.concluido ? 'opacity-60' : 'shadow-md'
                            }`}
                          >
                            <div className="flex flex-col gap-2">
                              
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-950/90 text-cyan-300 border border-slate-800 font-mono">
                                      {activity.origemTitulo}
                                    </span>

                                    {activity.prazoInfo && (
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${activity.prazoInfo.badgeClass}`}>
                                        {activity.prazoInfo.rotulo}
                                      </span>
                                    )}

                                    {activity.destaque && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 uppercase font-mono">
                                        ⚡ Destaque
                                      </span>
                                    )}
                                  </div>

                                  <h3 className={`text-xs sm:text-sm font-bold leading-snug ${
                                    activity.concluido ? 'line-through text-slate-400' : 'text-white'
                                  }`}>
                                    {activity.titulo}
                                  </h3>
                                </div>
                              </div>

                              {activity.descricao && activity.descricao !== activity.origemTitulo && (
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                  {activity.descricao}
                                </p>
                              )}

                              {activity.observacao && (
                                <div className="text-[11px] text-slate-300 bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
                                  {activity.observacao}
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-1">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {activity.responsaveis.map(resp => {
                                    const c = getResponsibleColor(resp);
                                    return (
                                      <span
                                        key={resp}
                                        className={`text-[9px] font-black uppercase font-mono px-1.5 py-0.5 rounded border ${c.badgeClass}`}
                                      >
                                        {resp}
                                      </span>
                                    );
                                  })}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  {activity.requiresAck && activity.ackStatus !== 'confirmada' && (
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmAck(activity)}
                                      disabled={ackLoadingId === activity.id}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase font-mono tracking-wider transition-all shadow-md active:scale-95"
                                    >
                                      <ShieldCheck size={13} />
                                      <span>{ackLoadingId === activity.id ? 'Gravando...' : 'Confirmar Ciência'}</span>
                                    </button>
                                  )}

                                  {activity.ackStatus === 'confirmada' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded-md font-mono">
                                      <Check size={11} className="stroke-[3]" />
                                      <span>Ciência Confirmada</span>
                                    </span>
                                  )}

                                  {!activity.concluido ? (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleActivity(activity)}
                                      disabled={completingId === activity.id}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase font-mono tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50 min-h-[36px]"
                                      title="Concluir tarefa e avisar a liderança"
                                    >
                                      <CheckCircle2 size={13} className={completingId === activity.id ? 'animate-spin' : ''} />
                                      <span>{completingId === activity.id ? 'Salvando...' : 'Concluir'}</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleActivity(activity)}
                                      disabled={completingId === activity.id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-mono transition-all border border-slate-800"
                                      title="Reabrir tarefa na lousa"
                                    >
                                      <Check size={11} className="text-emerald-400 stroke-[3]" />
                                      <span>Concluída (Reabrir)</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}

export default function MinhasAtividadesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050811] text-slate-400 flex items-center justify-center text-xs">
        Carregando atividades...
      </div>
    }>
      <MinhasAtividadesContent />
    </Suspense>
  );
}
