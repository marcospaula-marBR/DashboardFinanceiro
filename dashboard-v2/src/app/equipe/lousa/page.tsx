"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { PortalNavigation } from '@/components/collaborative-portal/PortalNavigation';
import { HelpOfferModal } from '@/components/collaborative-portal/HelpOfferModal';
import { CollaborativePortalService } from '@/services/collaborative-portal.service';
import { CollaborativeActivity } from '@/types/collaborative-portal';
import { getResponsibleColor } from '@/services/war-room.service';
import { 
  Users, 
  Search, 
  Filter, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Flame, 
  HandHeart,
  Calendar,
  Layers,
  Info,
  Check,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

export default function LousaEquipePage() {
  const [activeMember, setActiveMember] = useState<string>('CLARA');
  const [allActivities, setAllActivities] = useState<CollaborativeActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros avançados
  const [filterMember, setFilterMember] = useState<string>('TODOS');
  const [filterPriority, setFilterPriority] = useState<string>('TODAS');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal de Oferta de Ajuda
  const [helpOfferActivity, setHelpOfferActivity] = useState<CollaborativeActivity | null>(null);

  // Carregar dados
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await CollaborativePortalService.getAllActivities(activeMember);
      setAllActivities(data);
    } catch (err) {
      console.warn('[LousaEquipe] Erro ao carregar atividades:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeMember]);

  // Lista de todos os responsáveis presentes
  const distinctMembers = useMemo(() => {
    const set = new Set<string>();
    allActivities.forEach(a => a.responsaveis.forEach(r => set.add(r)));
    return Array.from(set).sort();
  }, [allActivities]);

  // Mapa de carga de trabalho por membro (para identificar sobrecargas)
  const workloadMap = useMemo(() => {
    const map: Record<string, { total: number; pendentes: number; atrasadas: number; urgentes: number }> = {};
    
    distinctMembers.forEach(m => {
      map[m] = { total: 0, pendentes: 0, atrasadas: 0, urgentes: 0 };
    });

    allActivities.forEach(a => {
      a.responsaveis.forEach(resp => {
        const upper = resp.toUpperCase();
        if (!map[upper]) {
          map[upper] = { total: 0, pendentes: 0, atrasadas: 0, urgentes: 0 };
        }
        map[upper].total++;
        if (!a.concluido) {
          map[upper].pendentes++;
          if (a.prazoInfo.status === 'atrasado') map[upper].atrasadas++;
          if (a.prioridade === 'urgente') map[upper].urgentes++;
        }
      });
    });

    return map;
  }, [allActivities, distinctMembers]);

  // Atividades filtradas
  const filteredActivities = useMemo(() => {
    return allActivities.filter(act => {
      // Filtro por Membro
      if (filterMember !== 'TODOS') {
        const matchesMember = act.responsaveis.some(r => r.toUpperCase() === filterMember.toUpperCase());
        if (!matchesMember) return false;
      }

      // Filtro por Prioridade
      if (filterPriority === 'URGENTES' && act.prioridade !== 'urgente') return false;
      if (filterPriority === 'ALTAS' && act.prioridade !== 'alta') return false;
      if (filterPriority === 'NORMAIS' && act.prioridade !== 'normal') return false;

      // Filtro por Situação
      if (filterStatus === 'ABERTAS' && act.concluido) return false;
      if (filterStatus === 'CONCLUIDAS' && !act.concluido) return false;
      if (filterStatus === 'ATRASADAS' && (act.concluido || act.prazoInfo.status !== 'atrasado')) return false;
      if (filterStatus === 'HOJE' && (act.concluido || act.prazoInfo.status !== 'hoje')) return false;

      // Filtro por Busca de Texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText = 
          act.titulo.toLowerCase().includes(q) ||
          act.origemTitulo.toLowerCase().includes(q) ||
          act.responsaveis.some(r => r.toLowerCase().includes(q));
        if (!matchesText) return false;
      }

      return true;
    });
  }, [allActivities, filterMember, filterPriority, filterStatus, searchQuery]);

  // Manipulador de envio de oferta de ajuda
  const handleOfferHelpSubmit = async (notes?: string) => {
    if (!helpOfferActivity) return { success: false, message: 'Atividade inválida' };

    const primaryOwner = helpOfferActivity.responsaveis[0] || 'EQUIPE';

    const res = await CollaborativePortalService.submitHelpOffer({
      activityId: helpOfferActivity.id,
      activityTitle: helpOfferActivity.titulo,
      taskOwnerName: primaryOwner,
      offeredByName: activeMember,
      offeredByProfileId: `profile-${activeMember.toLowerCase()}`,
      notes,
    });

    if (res.success) {
      await loadData();
    }
    return res;
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 pb-24 md:pb-12">
      {/* NAVEGAÇÃO UNIFICADA */}
      <PortalNavigation 
        activeMember={activeMember}
        onSelectMember={setActiveMember}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-5">
        
        {/* BANNER DE TRANSPARÊNCIA OPERACIONAL */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#080d19] to-[#0c162b] border border-cyan-900/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h1 className="text-base sm:text-lg font-black text-white uppercase font-mono tracking-wide">
                Lousa da Equipe — Mar Brasil
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                Transparência Operacional
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Visualização colaborativa das demandas de toda a equipe. Acompanhe responsabilidades, identifique prazos em risco e utilize a função <strong>🤝 Oferecer Ajuda</strong> para colaborar.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 shrink-0">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Modo Somente Leitura (Gestão Admin)</span>
          </div>
        </div>

        {/* RADAR DE CARGA DE TRABALHO POR COLABORADOR */}
        <div className="p-3 sm:p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} className="text-cyan-400" />
              <span>Carga de Trabalho da Equipe (Toque para filtrar)</span>
            </span>
            <span className="text-[10px] text-slate-500">
              {distinctMembers.length} integrantes operacionais
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setFilterMember('TODOS')}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterMember === 'TODOS'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Todos ({allActivities.length})
            </button>

            {distinctMembers.map(member => {
              const info = workloadMap[member] || { total: 0, pendentes: 0, atrasadas: 0, urgentes: 0 };
              const col = getResponsibleColor(member);
              const isSelected = filterMember.toUpperCase() === member.toUpperCase();

              return (
                <button
                  key={member}
                  onClick={() => setFilterMember(isSelected ? 'TODOS' : member)}
                  className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    isSelected
                      ? `${col.badgeClass} ring-2 ring-cyan-400 shadow-md scale-105`
                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${col.dotClass}`} />
                  <span>{member}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/80 font-mono">
                    {info.pendentes}
                  </span>
                  {info.atrasadas > 0 && (
                    <span className="text-[9px] px-1 py-0.2 rounded-full bg-rose-500 text-white font-black animate-pulse">
                      🚨 {info.atrasadas}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* BUSCA DE TEXTO */}
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar atividade, obrigação ou demanda..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* SELETOR DE PRIORIDADE */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="TODAS">Todas as Prioridades</option>
              <option value="URGENTES">🚨 Apenas Urgentes</option>
              <option value="ALTAS">Alta Prioridade</option>
              <option value="NORMAIS">Prioridade Normal</option>
            </select>

            {/* SELETOR DE SITUAÇÃO */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="TODOS">Todas as Situações</option>
              <option value="ABERTAS">Em Aberto</option>
              <option value="ATRASADAS">🚨 Apenas Atrasadas</option>
              <option value="HOJE">🟠 Vencem Hoje</option>
              <option value="CONCLUIDAS">✅ Concluídas</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>Exibindo <strong>{filteredActivities.length}</strong> de {allActivities.length} atividades</span>
            {(filterMember !== 'TODOS' || filterPriority !== 'TODAS' || filterStatus !== 'TODOS' || searchQuery) && (
              <button
                onClick={() => {
                  setFilterMember('TODOS');
                  setFilterPriority('TODAS');
                  setFilterStatus('TODOS');
                  setSearchQuery('');
                }}
                className="text-cyan-400 hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* LISTAGEM DE ATIVIDADES DA EQUIPE */}
        <div className="space-y-3">
          {filteredActivities.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
              Nenhuma atividade corresponde aos filtros selecionados.
            </div>
          ) : (
            filteredActivities.map(activity => {
              const isOwner = activity.responsaveis.some(r => r.toUpperCase() === activeMember.toUpperCase());
              const canOfferHelp = !isOwner && !activity.concluido;

              return (
                <div
                  key={activity.id}
                  className={`p-4 rounded-xl border transition-all ${
                    activity.concluido
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      : activity.prazoInfo.status === 'atrasado'
                      ? 'bg-[#0f0b12] border-rose-500/40 shadow-sm'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    {/* INFORMAÇÕES */}
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

                        {activity.helpOffersCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                            🤝 {activity.helpOffersCount} oferta(s) de ajuda
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
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${respCol.badgeClass}`}
                              >
                                {resp}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* AÇÃO: OFERECER AJUDA (COLABORAÇÃO OPERACIONAL) */}
                    <div className="shrink-0 flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                      {canOfferHelp && (
                        <>
                          {activity.userHasPendingHelpOffer ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-400 text-xs font-bold">
                              <Check size={14} />
                              <span>Oferta Enviada</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => setHelpOfferActivity(activity)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/50 text-xs font-bold transition-all active:scale-95 min-h-[44px]"
                              title="Oferecer apoio nesta atividade para o colega"
                            >
                              <HandHeart size={15} />
                              <span>🤝 OFERECER AJUDA</span>
                            </button>
                          )}
                        </>
                      )}

                      {isOwner && (
                        <span className="text-[11px] font-bold text-cyan-400 bg-cyan-950/40 px-2 py-1 rounded-lg border border-cyan-500/20">
                          Sua demanda
                        </span>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>

      {/* MODAL DE OFERECER AJUDA */}
      <HelpOfferModal
        isOpen={Boolean(helpOfferActivity)}
        onClose={() => setHelpOfferActivity(null)}
        activity={helpOfferActivity}
        currentMemberName={activeMember}
        onSubmitOffer={handleOfferHelpSubmit}
      />
    </div>
  );
}
