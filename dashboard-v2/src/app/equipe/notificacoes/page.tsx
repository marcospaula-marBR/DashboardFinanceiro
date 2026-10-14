"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PortalNavigation } from '@/components/collaborative-portal/PortalNavigation';
import { CollaborativePortalService } from '@/services/collaborative-portal.service';
import { PortalNotification, RegisteredDevice, NotificationPriority } from '@/types/collaborative-portal';
import { supabase } from '@/lib/supabase';
import { 
  Bell, 
  BellRing, 
  Smartphone, 
  Monitor, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Flame, 
  CheckCircle2, 
  Send, 
  Trash2, 
  Info,
  ExternalLink,
  Laptop,
  RefreshCw
} from 'lucide-react';

const CANONICAL_MEMBERS = ['MARCOS', 'MATHEUS', 'MELISSA', 'GUILHERME', 'FINANCEIRO', 'JURÍDICO', 'CONTÁBIL', 'TI'];

function NotificacoesContent() {
  const searchParams = useSearchParams();
  const [activeMember, setActiveMember] = useState<string>('MARCOS');
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'urgent' | 'important' | 'info'>('all');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [testSent, setTestSent] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Sincronizar membro ativo com URL ou LocalStorage
  useEffect(() => {
    const urlMember = searchParams?.get('membro')?.toUpperCase();
    if (urlMember && CANONICAL_MEMBERS.includes(urlMember)) {
      setActiveMember(urlMember);
      if (typeof window !== 'undefined') {
        localStorage.setItem('mb_collaborative_member_name', urlMember);
      }
    } else if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mb_collaborative_member_name')?.toUpperCase();
      if (saved && CANONICAL_MEMBERS.includes(saved)) {
        setActiveMember(saved);
      }
    }
  }, [searchParams]);

  const handleSelectMember = (name: string) => {
    const upper = name.toUpperCase();
    setActiveMember(upper);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mb_collaborative_member_name', upper);
    }
  };

  const [incomingAlert, setIncomingAlert] = useState<{ title: string; body: string } | null>(null);

  // Sintetizador sonoro leve com Web Audio API para alerta audível mesmo em celular
  const playNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174, now + 0.18);
      gain2.gain.setValueAtTime(0.35, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.38);
    } catch {}
  };

  // Carregar dados
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [notifs, devs] = await Promise.all([
        CollaborativePortalService.getNotifications(undefined, activeMember),
        CollaborativePortalService.getAllRegisteredDevices(),
      ]);
      setNotifications(notifs);
      setDevices(devs);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((reg) => console.log('[SW Team] Service Worker registrado:', reg.scope))
          .catch((err) => console.warn('[SW Team] Erro ao registrar SW:', err));
      }

      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
    }
  }, [activeMember]);

  // Disparador universal nativo compatível com Motorola Android (Chrome) e Windows 11
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
    setTimeout(() => setIncomingAlert(null), 5000);

    if (!('Notification' in window)) return;

    if (Notification.permission !== 'granted') {
      try {
        const p = await Notification.requestPermission();
        if (p !== 'granted') return;
      } catch {
        return;
      }
    }

    const options: any = {
      body,
      icon: '/Favicon.png',
      badge: '/Favicon.png',
      tag: tag || `marbrasil-${Date.now()}`,
      vibrate: [200, 100, 200],
      renotify: true,
      data: { url: '/equipe/notificacoes' },
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

  // Rastreamento resiliente de IDs já exibidos/alertados neste dispositivo
  const seenNotificationIdsRef = React.useRef<Set<string>>(new Set());
  const audioCtxRef = React.useRef<AudioContext | null>(null);

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

  // Escuta Realtime de notificações do Supabase com Polling e VisibilityChange
  useEffect(() => {
    if (!activeMember) return;

    const checkRecent = async (alertNew = true) => {
      try {
        const { data: latestNotifs } = await supabase
          .from('notifications')
          .select('*')
          .or(`target_type.eq.all,target_member_name.eq.${activeMember.toUpperCase()}`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (latestNotifs && latestNotifs.length > 0) {
          const nowMs = Date.now();
          for (const notif of latestNotifs) {
            const isUnseen = !seenNotificationIdsRef.current.has(notif.id);
            seenNotificationIdsRef.current.add(notif.id);

            if (isUnseen && alertNew) {
              const createdMs = notif.created_at ? new Date(notif.created_at).getTime() : nowMs;
              if (nowMs - createdMs < 20 * 60 * 1000) {
                triggerNativeNotification(notif.title, notif.body, `notif-${notif.id}`);
              }
            }
          }
          loadData();
        }
      } catch (err) {
        console.warn('[Team Polling] Aviso:', err);
      }
    };

    checkRecent(false);

    const channel = supabase
      .channel(`team-notifs-${activeMember.toLowerCase()}-${Date.now()}`)
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
            loadData();
          }
        }
      )
      .subscribe();

    // Polling inteligente de resguardo a cada 6 segundos
    const interval = setInterval(() => {
      checkRecent(true);
    }, 6000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkRecent(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeMember]);

  // Solicitar ativação de notificações nativas Web Push
  const handleEnablePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Seu navegador atual não suporta notificações Web Push nativas.');
      return;
    }

    try {
      unlockAudioContext();
      const res = await CollaborativePortalService.subscribeDeviceToPush(activeMember);
      if (res.success) {
        setNotificationPermission('granted');
        const devList = await CollaborativePortalService.getAllRegisteredDevices();
        setDevices(devList);
        await triggerNativeNotification(
          `🔔 Mar Brasil — Notificações Ativadas (${activeMember})`,
          `Dispositivo conectado com sucesso para receber tarefas e avisos em tempo real.`,
          `welcome-${Date.now()}`
        );
      } else {
        alert(res.error || 'Não foi possível conectar o dispositivo.');
      }
    } catch (e) {
      console.error('Erro ao solicitar permissão de push:', e);
    }
  };

  // Enviar Notificação de Teste
  const handleSendTestNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      unlockAudioContext();
      await CollaborativePortalService.dispatchPushToServer({
        targetType: 'member',
        targetMemberName: activeMember,
        title: '🚨 TESTE: Mar Brasil Operacional',
        body: `Notificação teste entregue via Google Cloud Messaging no seu aparelho (${activeMember}).`,
        priority: 'urgent',
        tag: `test-${Date.now()}`,
      });
      await triggerNativeNotification(
        '🚨 TESTE: Mar Brasil Operacional',
        'Notificação teste entregue com sucesso em seu dispositivo.',
        `test-${Date.now()}`
      );
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } else {
      handleEnablePush();
    }
  };

  // Remover dispositivo
  const handleRemoveDevice = async (id: string) => {
    await CollaborativePortalService.removeDevice(id);
    const devs = await CollaborativePortalService.getAllRegisteredDevices();
    setDevices(devs);
  };

  // Filtragem por prioridade
  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'urgent') return n.priority === 'urgent';
    if (activeTab === 'important') return n.priority === 'important';
    if (activeTab === 'info') return n.priority === 'info';
    return true;
  });

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

      {/* NAVEGAÇÃO UNIFICADA */}
      <PortalNavigation 
        activeMember={activeMember}
        onSelectMember={handleSelectMember}
        availableMembers={CANONICAL_MEMBERS}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-6">
        
        {/* BANNER PRINCIPAL */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#090e1a] to-[#0c1527] border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <BellRing size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white uppercase font-mono tracking-wide">
                  Central de Notificações Inteligentes
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                  Web Push
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Alertas nativos no Windows 11 e celulares Motorola Android (PWA).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition-colors flex items-center gap-1.5 min-h-[44px]"
              title="Recarregar dispositivos e alertas"
            >
              <RefreshCw size={13} className={`text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </button>

            <button
              onClick={handleSendTestNotification}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition-colors flex items-center gap-1.5 min-h-[44px]"
            >
              <Send size={13} className="text-cyan-400" />
              <span>{testSent ? 'Enviado!' : 'Notificação Teste'}</span>
            </button>
          </div>
        </div>

        {/* CADASTRO DE DISPOSITIVOS E ATIVAÇÃO WEB PUSH */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-white uppercase font-mono flex items-center gap-2">
                <Smartphone size={16} className="text-cyan-400" />
                <span>Dispositivos & Alertas em Segundo Plano</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Receba comunicados e alertas urgentes mesmo com o navegador minimizado.
              </p>
            </div>

            {notificationPermission !== 'granted' ? (
              <button
                onClick={handleEnablePush}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs transition-all shadow-md shadow-cyan-950/50 min-h-[44px]"
              >
                <Bell size={15} />
                <span>🔔 Ativar notificações neste dispositivo</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-500/40">
                <CheckCircle2 size={16} />
                <span>Notificações ativas neste navegador</span>
              </div>
            )}
          </div>

          {/* LISTA DE DISPOSITIVOS CADASTRADOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {devices.map(dev => (
              <div
                key={dev.id}
                className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                    {dev.deviceType === 'desktop' ? <Monitor size={16} /> : <Smartphone size={16} />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {dev.deviceLabel}
                    </h4>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Conectado</span>
                    </span>
                  </div>
                </div>

                {devices.length > 1 && (
                  <button
                    onClick={() => handleRemoveDevice(dev.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Remover dispositivo"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* LIMITAÇÕES TÉCNICAS E RESSALVAS DO BROWSER */}
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 flex gap-2 text-[11px] text-slate-400">
            <Info size={15} className="text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong>Condições de entrega:</strong> A entrega de notificações depende da conectividade, configurações de economia de bateria do Android e permissões do Google Chrome no Windows 11.
            </div>
          </div>
        </div>

        {/* CENTRAL DE NOTIFICAÇÕES (HISTÓRICO E CATEGORIAS) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* ABAS POR CATEGORIA */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'all'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todas ({notifications.length})
              </button>
              <button
                onClick={() => setActiveTab('urgent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'urgent'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🔴 Urgentes
              </button>
              <button
                onClick={() => setActiveTab('important')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'important'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🟠 Importantes
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'info'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🟢 Informativas
              </button>
            </div>

            <span className="text-[11px] text-slate-500">
              {filteredNotifications.length} mensagens no histórico
            </span>
          </div>

          {/* LISTA DE NOTIFICAÇÕES */}
          <div className="space-y-2.5">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
                Nenhuma notificação nesta categoria.
              </div>
            ) : (
              filteredNotifications.map(notif => {
                const isUrgent = notif.priority === 'urgent';
                const isImportant = notif.priority === 'important';

                return (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isUrgent
                        ? 'bg-[#0f0a12] border-rose-500/40'
                        : isImportant
                        ? 'bg-[#100e0a] border-amber-500/40'
                        : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${
                            isUrgent
                              ? 'bg-rose-500 text-white'
                              : isImportant
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-emerald-500 text-slate-950'
                          }`}>
                            {isUrgent ? '🔴 URGENTE' : isImportant ? '🟠 IMPORTANTE' : '🟢 INFORMATIVA'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(notif.createdAt).toLocaleDateString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <h3 className="text-xs sm:text-sm font-bold text-white">
                          {notif.title}
                        </h3>

                        <p className="text-xs text-slate-300">
                          {notif.body}
                        </p>

                        {notif.activityTitle && (
                          <div className="text-[11px] text-cyan-400 font-medium pt-1">
                            Demanda vinculada: <strong>{notif.activityTitle}</strong>
                          </div>
                        )}
                      </div>

                      {/* AÇÃO: ABRIR TAREFA */}
                      <div className="shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                        <Link
                          href={`/minhas-atividades?membro=${encodeURIComponent(activeMember)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors min-h-[44px]"
                        >
                          <span>Abrir Atividade</span>
                          <ExternalLink size={13} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

export default function NotificacoesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050811] flex items-center justify-center text-slate-400">
        Carregando Central de Notificações...
      </div>
    }>
      <NotificacoesContent />
    </Suspense>
  );
}
