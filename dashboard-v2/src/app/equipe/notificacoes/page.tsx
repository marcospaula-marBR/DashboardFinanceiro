"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PortalNavigation } from '@/components/collaborative-portal/PortalNavigation';
import { CollaborativePortalService } from '@/services/collaborative-portal.service';
import { PortalNotification, RegisteredDevice, NotificationPriority } from '@/types/collaborative-portal';
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
  Laptop
} from 'lucide-react';

export default function NotificacoesPage() {
  const [activeMember, setActiveMember] = useState<string>('MANUS');
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'urgent' | 'important' | 'info'>('all');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [testSent, setTestSent] = useState<boolean>(false);

  // Carregar dados
  useEffect(() => {
    CollaborativePortalService.getNotifications().then(setNotifications);
    setDevices(CollaborativePortalService.getRegisteredDevices());

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Solicitar ativação de notificações nativas Web Push
  const handleEnablePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Seu navegador atual não suporta notificações Web Push nativas.');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);

      if (perm === 'granted') {
        // Detectar tipo de aparelho
        const isWindows = /Windows/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);
        const label = isWindows 
          ? 'Windows 11 (Google Chrome)' 
          : isAndroid 
          ? 'Motorola Android (Chrome)' 
          : 'Navegador Web';

        const newDevice: RegisteredDevice = {
          id: `dev-${Date.now()}`,
          deviceLabel: label,
          deviceType: isWindows ? 'desktop' : isAndroid ? 'mobile' : 'other',
          active: true,
          lastSeenAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        CollaborativePortalService.saveDevice(newDevice);
        setDevices(CollaborativePortalService.getRegisteredDevices());

        // Disparo teste imediato de boas-vindas
        new Notification('🔔 Mar Brasil — Notificações Ativadas', {
          body: `Dispositivo ${label} conectado com sucesso à Central de Notificações.`,
          icon: '/Favicon.png',
        });
      }
    } catch (e) {
      console.error('Erro ao solicitar permissão de push:', e);
    }
  };

  // Enviar Notificação de Teste
  const handleSendTestNotification = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification('🚨 TESTE: Mar Brasil Operacional', {
        body: 'Notificação teste entregue com sucesso em seu dispositivo.',
        icon: '/Favicon.png',
      });
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } else {
      handleEnablePush();
    }
  };

  // Remover dispositivo
  const handleRemoveDevice = (id: string) => {
    CollaborativePortalService.removeDevice(id);
    setDevices(CollaborativePortalService.getRegisteredDevices());
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
      {/* NAVEGAÇÃO UNIFICADA */}
      <PortalNavigation 
        activeMember={activeMember}
        onSelectMember={setActiveMember}
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
                          href="/minhas-atividades"
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
