"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { PortalNavigation } from '@/components/collaborative-portal/PortalNavigation';
import { CollaborativePortalService } from '@/services/collaborative-portal.service';
import { CollaborativeActivity, ActivityUrgencyGroup } from '@/types/collaborative-portal';
import { getResponsibleColor } from '@/services/war-room.service';
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
  Smartphone
} from 'lucide-react';

export default function MinhasAtividadesPage() {
  const [activeMember, setActiveMember] = useState<string>('MANUS');
  const [allActivities, setAllActivities] = useState<CollaborativeActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [ackLoadingId, setAckLoadingId] = useState<string | null>(null);
  const [deviceConnected, setDeviceConnected] = useState<boolean>(false);
  const [deviceLabel, setDeviceLabel] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setDeviceConnected(Notification.permission === 'granted');
      const isWindows = /Windows/i.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);
      setDeviceLabel(isWindows ? 'Windows 11 (Google Chrome)' : isAndroid ? 'Motorola Android (Chrome)' : 'Google Chrome');
    }
  }, []);

  const handleEnableDevicePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Seu navegador atual não suporta notificações Web Push nativas.');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        const isWindows = /Windows/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);
        const label = isWindows 
          ? 'Windows 11 (Google Chrome)' 
          : isAndroid 
          ? 'Motorola Android (Chrome)' 
          : 'Google Chrome';

        await CollaborativePortalService.registerMemberDevice({
          memberName: activeMember,
          deviceLabel: label,
          deviceType: isWindows ? 'desktop' : isAndroid ? 'mobile' : 'other',
        });

        setDeviceConnected(true);
        new Notification(`🔔 Notificações Ativadas — ${activeMember}`, {
          body: `Aparelho conectado! Você receberá avisos automáticos de novas tarefas atribuídas a você.`,
          icon: '/Favicon.png',
        });
      }
    } catch (e) {
      console.warn('Erro ao habilitar notificações:', e);
    }
  };

  const handleTestDeviceNotification = () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`🚨 Alerta Teste: ${activeMember}`, {
        body: 'Notificação teste entregue com sucesso pela Central Mar Brasil.',
        icon: '/Favicon.png',
      });
    }
  };

  // Carregar dados das atividades
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

  useEffect(() => {
    loadData();
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
      // Recarrega dados após confirmação
      await loadData();
    } catch (e) {
      console.error('Erro ao confirmar ciência:', e);
    } finally {
      setAckLoadingId(null);
    }
  };

  const memberColor = getResponsibleColor(activeMember);

  // Lista de seções com metadados e ícones
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
      title: '🔴 Urgentes (Atenção Imediata & Ciência)',
      icon: Flame,
      colorClass: 'text-rose-400',
      bgClass: 'bg-rose-950/20',
      borderClass: 'border-rose-500/40',
      emptyText: 'Nenhuma demanda urgente atribuída no momento.',
    },
    {
      key: 'atrasadas',
      title: '🚨 Atrasadas (Vencidas)',
      icon: AlertTriangle,
      colorClass: 'text-amber-400',
      bgClass: 'bg-amber-950/20',
      borderClass: 'border-amber-500/40',
      emptyText: 'Parabéns! Nenhuma atividade em atraso.',
    },
    {
      key: 'hoje',
      title: '🟠 Vencem Hoje',
      icon: Clock,
      colorClass: 'text-amber-300',
      bgClass: 'bg-amber-950/15',
      borderClass: 'border-amber-500/30',
      emptyText: 'Nenhuma obrigação vence no dia de hoje.',
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
      {/* NAVEGAÇÃO UNIFICADA */}
      <PortalNavigation 
        activeMember={activeMember}
        onSelectMember={setActiveMember}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-5">
        
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
                Acompanhe suas demandas, prazos e confirme ciência de atividades críticas.
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

        {/* CARD DE HABILITAÇÃO DE DISPOSITIVOS & WEB PUSH (WINDOWS 11 / MOTOROLA ANDROID) */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-slate-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-2 rounded-xl flex-shrink-0 ${
              deviceConnected 
                ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-400' 
                : 'bg-cyan-950/60 border border-cyan-500/50 text-cyan-400'
            }`}>
              {deviceConnected ? <CheckCircle2 size={20} /> : <Bell size={20} className="animate-bounce" />}
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase font-mono flex items-center gap-2">
                <span>{deviceConnected ? 'Notificações Ativas neste Aparelho' : 'Receber Alertas neste Aparelho'}</span>
                <span className="text-[10px] px-2 py-0.2 rounded font-mono font-bold uppercase bg-slate-800 text-slate-300">
                  {activeMember}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {deviceConnected
                  ? `Este dispositivo (${deviceLabel}) está conectado para receber alertas de novas tarefas atribuídas a ${activeMember}.`
                  : `Habilite o Google Chrome (no seu Windows 11 ou celular Motorola Android) para receber avisos automáticos e som sempre que uma nova tarefa for designada a você.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!deviceConnected ? (
              <button
                type="button"
                onClick={handleEnableDevicePush}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-cyan-950/60 min-h-[44px]"
              >
                <Bell size={15} />
                <span>Ativar Alertas para {activeMember}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTestDeviceNotification}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-700 min-h-[44px]"
              >
                <Sparkles size={13} className="text-cyan-400" />
                <span>Enviar Teste</span>
              </button>
            )}
          </div>
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
                <section 
                  key={section.key} 
                  className={`rounded-2xl border ${section.borderClass} ${section.bgClass} overflow-hidden shadow-lg`}
                >
                  {/* CABEÇALHO DO GRUPO */}
                  <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={section.colorClass} />
                      <h2 className="text-xs sm:text-sm font-black text-white uppercase font-mono tracking-wide">
                        {section.title}
                      </h2>
                    </div>
                    <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                      {items.length}
                    </span>
                  </div>

                  {/* LISTA DE CARDS */}
                  <div className="p-3 sm:p-4 space-y-2.5">
                    {items.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center gap-1.5">
                        <Inbox size={20} className="text-slate-600" />
                        <span>{section.emptyText}</span>
                      </div>
                    ) : (
                      items.map(activity => {
                        return (
                          <div
                            key={activity.id}
                            className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                              activity.concluido
                                ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                                : activity.prioridade === 'urgente'
                                ? 'bg-[#0e0a13] border-rose-500/50 shadow-md shadow-rose-950/30'
                                : 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              {/* INFORMAÇÕES DA ATIVIDADE */}
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                                    {activity.origemTitulo}
                                  </span>

                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${activity.prazoInfo.badgeClass}`}>
                                    {activity.prazoInfo.rotulo}
                                  </span>

                                  {activity.prioridade === 'urgente' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded font-black bg-rose-600 text-white uppercase">
                                      🚨 Urgente
                                    </span>
                                  )}
                                </div>

                                <h3 className={`text-xs sm:text-sm font-bold ${
                                  activity.concluido ? 'line-through text-slate-400' : 'text-white'
                                }`}>
                                  {activity.titulo}
                                </h3>

                                <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                                  <span>Responsáveis:</span>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {activity.responsaveis.map(resp => {
                                      const respCol = getResponsibleColor(resp);
                                      return (
                                        <span
                                          key={resp}
                                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${respCol.badgeClass}`}
                                        >
                                          {resp}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>

                                {activity.observacao && (
                                  <p className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                                    Obs: {activity.observacao}
                                  </p>
                                )}
                              </div>

                              {/* ÁREA DE AÇÃO: CONFIRMAÇÃO DE CIÊNCIA (SOMENTE LEITURA / ADMIN CONTROLA O RESTO) */}
                              <div className="shrink-0 flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                                {activity.requiresAck && (
                                  <>
                                    {activity.ackStatus === 'confirmada' ? (
                                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-bold">
                                        <ShieldCheck size={15} />
                                        <span>Ciência Confirmada</span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleConfirmAck(activity)}
                                        disabled={ackLoadingId === activity.id}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-md shadow-emerald-950/60 min-h-[44px]"
                                        title="Confirmar ciência individual desta demanda urgente"
                                      >
                                        <Check size={16} />
                                        <span>
                                          {ackLoadingId === activity.id 
                                            ? 'Confirmando...' 
                                            : '✅ CONFIRMAR CIÊNCIA'}
                                        </span>
                                      </button>
                                    )}
                                  </>
                                )}

                                {activity.concluido && (
                                  <span className="text-[11px] font-bold text-slate-400">
                                    Finalizada
                                  </span>
                                )}
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
