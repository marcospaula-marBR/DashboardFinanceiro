"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  X, 
  User, 
  Trash2, 
  Check, 
  AlertTriangle, 
  ArrowRight, 
  Palette, 
  Link2, 
  Users, 
  CheckCircle2,
  HelpCircle,
  Plus,
  Edit3,
  Search,
  Trophy,
  Award,
  TrendingUp,
  BarChart3,
  Flame,
  Clock,
  Sparkles
} from 'lucide-react';
import { CollaborativePortalService } from '@/services/collaborative-portal.service';
import { WarRoomService, getResponsibleColor } from '@/services/war-room.service';

interface EmployeeOption {
  id: string;
  full_name: string;
  job_role?: string;
  department?: string;
  email?: string;
  phone_professional?: string;
}

// Paleta Executiva Estrita da Mar Brasil (PURPLE BAN RIGOROSO: sem roxo/violeta)
export const APPROVED_MEMBER_COLORS = [
  { name: 'Ciano Vibrante', hex: '#06b6d4', class: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500' },
  { name: 'Verde Esmeralda', hex: '#10b981', class: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500' },
  { name: 'Âmbar Ouro', hex: '#f59e0b', class: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500' },
  { name: 'Azul Royal', hex: '#3b82f6', class: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500' },
  { name: 'Laranja Mar Brasil', hex: '#f97316', class: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500' },
  { name: 'Rosa Coral', hex: '#f43f5e', class: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500' },
  { name: 'Menta Teal', hex: '#14b8a6', class: 'bg-teal-500', text: 'text-teal-400', border: 'border-teal-500' },
  { name: 'Azul Sky', hex: '#0ea5e9', class: 'bg-sky-500', text: 'text-sky-400', border: 'border-sky-500' },
  { name: 'Verde Lima', hex: '#84cc16', class: 'bg-lime-500', text: 'text-lime-400', border: 'border-lime-500' },
  { name: 'Vermelho Carmim', hex: '#ef4444', class: 'bg-red-500', text: 'text-red-400', border: 'border-red-500' },
];

interface WhiteboardMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberName: string | null; // Se fornecido, modo edição direta
  allMembers: string[];
  totalTasksCount?: number;
  initialTab?: 'list' | 'form' | 'ranking';
  responsibleCountsMap?: Record<string, { total: number; concluidos: number; pendentes: number; atrasados: number }>;
  onSaveMember: (oldName: string | null, newName: string, selectedColorHex?: string, linkedEmployeeId?: string) => void;
  onDeleteMember?: (memberName: string, reassignedTo?: string | null) => void;
}

export function WhiteboardMemberModal({
  isOpen,
  onClose,
  memberName,
  allMembers,
  totalTasksCount = 0,
  initialTab = 'list',
  responsibleCountsMap,
  onSaveMember,
  onDeleteMember,
}: WhiteboardMemberModalProps) {
  // Aba ativa: 'list' (gerenciar todos), 'ranking' (produtividade), 'form' (editar/criar)
  const [activeTab, setActiveTab] = useState<'list' | 'ranking' | 'form'>(initialTab);
  const [selectedTargetMember, setSelectedTargetMember] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [selectedColorHex, setSelectedColorHex] = useState(APPROVED_MEMBER_COLORS[0].hex);
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string>('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [rankingSortBy, setRankingSortBy] = useState<'concluidos' | 'taxa' | 'total'>('concluidos');

  // Estados de confirmação de exclusão
  const [isDeletingStep, setIsDeletingStep] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string>('');
  const [reassignTo, setReassignTo] = useState<string>('');

  // Carregar lista de colaboradores de employees do Supabase para o vínculo
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingEmployees(true);

    async function loadEmployees() {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, full_name, job_role, department, email, phone_professional')
          .eq('active', true)
          .order('full_name');

        if (isMounted && data && !error) {
          setEmployees(data);
        }
      } catch (err) {
        console.warn('[WhiteboardMemberModal] Erro ao carregar colaboradores:', err);
      } finally {
        if (isMounted) {
          setLoadingEmployees(false);
        }
      }
    }

    loadEmployees();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Inicializar dados do membro quando o modal abre ou initialTab muda
  useEffect(() => {
    if (memberName) {
      setSelectedTargetMember(memberName);
      setNome(memberName);
      setActiveTab('form');
      setIsDeletingStep(false);
      setReassignTo('');
    } else {
      setSelectedTargetMember(null);
      setNome('');
      setActiveTab(initialTab || 'list');
      setIsDeletingStep(false);
      setReassignTo('');
      setSelectedColorHex(APPROVED_MEMBER_COLORS[0].hex);
      setLinkedEmployeeId('');
    }
  }, [memberName, initialTab, isOpen]);

  // Apuração de tarefas por membro (via prop ou fallback do localStorage)
  const effectiveCountsMap = useMemo(() => {
    if (responsibleCountsMap && Object.keys(responsibleCountsMap).length > 0) {
      return responsibleCountsMap;
    }
    try {
      const loaded = WarRoomService.getWhiteboardData();
      const map: Record<string, { total: number; concluidos: number; pendentes: number; atrasados: number }> = {};
      const todayDay = new Date().getDate();

      const registerTask = (resp: string, concluido: boolean, isOverdue: boolean) => {
        const upper = resp.trim().toUpperCase();
        if (!upper) return;
        if (!map[upper]) {
          map[upper] = { total: 0, concluidos: 0, pendentes: 0, atrasados: 0 };
        }
        map[upper].total++;
        if (concluido) {
          map[upper].concluidos++;
        } else {
          map[upper].pendentes++;
          if (isOverdue) map[upper].atrasados++;
        }
      };

      loaded.cronograma?.forEach(blk => {
        blk.itens?.forEach(it => {
          const isOverdue = !it.concluido && it.dia < todayDay;
          const resps = it.responsaveis || (it.responsavel ? [it.responsavel] : []);
          resps.forEach(r => registerTask(r, it.concluido, isOverdue));
        });
      });

      loaded.colunas?.forEach(col => {
        col.itens?.forEach(it => {
          if (!it.arquivado) {
            const resps = it.responsaveis || (it.responsavel ? [it.responsavel] : []);
            resps.forEach(r => registerTask(r, it.concluido, false));
          }
        });
      });

      loaded.gradeSemanal?.forEach(blk => {
        blk.itens?.forEach(it => {
          const resps = it.responsaveis || (it.responsavel ? [it.responsavel] : []);
          resps.forEach(r => registerTask(r, it.concluido, false));
        });
      });

      return map;
    } catch {
      return {};
    }
  }, [responsibleCountsMap, isOpen]);

  // Dados compilados do Ranking de Produtividade
  const rankingData = useMemo(() => {
    const list = allMembers.map(member => {
      const upper = member.trim().toUpperCase();
      const counts = effectiveCountsMap[upper] || { total: 0, concluidos: 0, pendentes: 0, atrasados: 0 };
      const taxa = counts.total > 0 ? Math.round((counts.concluidos / counts.total) * 100) : 0;

      return {
        nome: upper,
        total: counts.total,
        concluidos: counts.concluidos,
        pendentes: counts.pendentes,
        atrasados: counts.atrasados,
        taxaEntrega: taxa,
      };
    });

    return list.sort((a, b) => {
      if (rankingSortBy === 'taxa') {
        if (b.taxaEntrega !== a.taxaEntrega) return b.taxaEntrega - a.taxaEntrega;
        return b.concluidos - a.concluidos;
      }
      if (rankingSortBy === 'total') {
        if (b.total !== a.total) return b.total - a.total;
        return b.concluidos - a.concluidos;
      }
      // Padrão: mais concluídas DESC, depois maior taxa DESC, depois total DESC
      if (b.concluidos !== a.concluidos) return b.concluidos - a.concluidos;
      if (b.taxaEntrega !== a.taxaEntrega) return b.taxaEntrega - a.taxaEntrega;
      return b.total - a.total;
    });
  }, [allMembers, effectiveCountsMap, rankingSortBy]);

  // Resumo Geral da Equipe
  const teamStats = useMemo(() => {
    let total = 0;
    let concluidos = 0;
    let pendentes = 0;
    let atrasados = 0;

    rankingData.forEach(r => {
      total += r.total;
      concluidos += r.concluidos;
      pendentes += r.pendentes;
      atrasados += r.atrasados;
    });

    const taxaGlobal = total > 0 ? Math.round((concluidos / total) * 100) : 0;
    const topPerformer = rankingData.length > 0 && rankingData[0].concluidos > 0 ? rankingData[0] : null;
    
    // Membro com maior taxa (com pelo menos 2 tarefas)
    const candidatesWithTasks = rankingData.filter(r => r.total >= 2);
    const mostEfficient = candidatesWithTasks.length > 0 
      ? [...candidatesWithTasks].sort((a, b) => b.taxaEntrega - a.taxaEntrega)[0]
      : null;

    return {
      total,
      concluidos,
      pendentes,
      atrasados,
      taxaGlobal,
      topPerformer,
      mostEfficient,
    };
  }, [rankingData]);

  if (!isOpen) return null;

  // Iniciar criação de novo membro
  const handleStartNewMember = () => {
    setSelectedTargetMember(null);
    setNome('');
    setSelectedColorHex(APPROVED_MEMBER_COLORS[0].hex);
    setLinkedEmployeeId('');
    setIsDeletingStep(false);
    setActiveTab('form');
  };

  // Iniciar edição de um membro existente
  const handleStartEditMember = (targetName: string) => {
    setSelectedTargetMember(targetName);
    setNome(targetName);
    setIsDeletingStep(false);
    setActiveTab('form');
  };

  // Iniciar exclusão de um membro
  const handleStartDeleteMember = (targetName: string) => {
    setMemberToDelete(targetName);
    setIsDeletingStep(true);
    setReassignTo('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = nome.trim().toUpperCase();
    if (!cleanNome) return;

    onSaveMember(selectedTargetMember, cleanNome, selectedColorHex, linkedEmployeeId || undefined);
    onClose();
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete || !onDeleteMember) return;
    
    // 1. Excluir no estado da lousa com reatribuição opcional
    onDeleteMember(memberToDelete, reassignTo.trim() ? reassignTo.trim().toUpperCase() : null);
    
    // 2. Excluir também no Supabase da tabela whiteboard_member_links
    await CollaborativePortalService.deleteMemberFromDatabase(memberToDelete);

    setIsDeletingStep(false);
    setMemberToDelete('');
    onClose();
  };

  const filteredMembers = allMembers.filter(m => 
    m.toUpperCase().includes(searchFilter.toUpperCase().trim())
  );

  const otherMembers = allMembers.filter(m => m.toUpperCase() !== (memberToDelete || selectedTargetMember)?.toUpperCase());

  // Top 3 do Ranking para o Pódio
  const top1 = rankingData[0];
  const top2 = rankingData[1];
  const top3 = rankingData[2];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#090e1a] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#060a13]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-white font-mono tracking-wide">
                Gestão da Equipe & Produtividade
              </h2>
              <p className="text-[11px] text-slate-400">
                Ranking de entregas concluídas, cadastro e gestão dos membros da Lousa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ABAS DO MODAL (QUANDO NÃO ESTIVER EM CONFIRMAÇÃO DE EXCLUSÃO) */}
        {!isDeletingStep && (
          <div className="flex items-center border-b border-slate-800 bg-slate-950/80 px-3 sm:px-4 pt-2 overflow-x-auto no-scrollbar">
            {/* ABA 1: RANKING DE PRODUTIVIDADE */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('ranking');
                setSelectedTargetMember(null);
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-bold font-mono transition-all border-b-2 flex-shrink-0 ${
                activeTab === 'ranking'
                  ? 'border-amber-400 text-amber-300 bg-slate-900/80 rounded-t-lg shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Trophy size={13} className="text-amber-400" />
              <span>🏆 Produtividade da Equipe</span>
            </button>

            {/* ABA 2: LISTA DE MEMBROS */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('list');
                setSelectedTargetMember(null);
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-bold font-mono transition-all border-b-2 flex-shrink-0 ${
                activeTab === 'list'
                  ? 'border-cyan-400 text-cyan-300 bg-slate-900/80 rounded-t-lg shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users size={13} className="text-cyan-400" />
              <span>👥 Membros ({allMembers.length})</span>
            </button>

            {/* ABA 3: NOVO / EDITAR */}
            <button
              type="button"
              onClick={handleStartNewMember}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-bold font-mono transition-all border-b-2 flex-shrink-0 ${
                activeTab === 'form' && !selectedTargetMember
                  ? 'border-cyan-400 text-cyan-300 bg-slate-900/80 rounded-t-lg shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus size={13} />
              <span>➕ Novo Membro</span>
            </button>

            {selectedTargetMember && activeTab === 'form' && (
              <span className="ml-auto text-[11px] font-mono text-cyan-400 font-bold hidden sm:flex items-center gap-1">
                <span>Editando:</span>
                <span className="text-white bg-slate-800 px-2 py-0.5 rounded">{selectedTargetMember}</span>
              </span>
            )}
          </div>
        )}

        {/* CORPO DO MODAL */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          
          {/* PASSO DE CONFIRMAÇÃO DE EXCLUSÃO */}
          {isDeletingStep ? (
            <div className="space-y-4 p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-600/30 border border-rose-500 text-rose-400 flex-shrink-0">
                  <AlertTriangle size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-rose-200 font-mono">
                    Excluir Membro "{memberToDelete}" da Lousa?
                  </h3>
                  <p className="text-xs text-rose-300/80 mt-1 leading-relaxed">
                    Esta ação removerá este responsável da visualização da Lousa e da Central de Notificações.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                  Reatribuir tarefas pendentes deste membro para:
                </label>
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="">— Apenas remover o membro (Tarefas ficam sem executor) —</option>
                  {otherMembers.map(m => (
                    <option key={m} value={m}>
                      Transferir todas as tarefas para {m}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Selecione outro colega para herdar as tarefas abertas, ou deixe em branco para desatribuir.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-900/40">
                <button
                  type="button"
                  onClick={() => setIsDeletingStep(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all min-h-[42px]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-950 font-mono min-h-[42px]"
                >
                  <Trash2 size={13} />
                  <span>Confirmar Exclusão</span>
                </button>
              </div>
            </div>
          ) : activeTab === 'ranking' ? (

            /* ── ABA 1: RANKING EXECUTIVO DE PRODUTIVIDADE & ENTREGAS ── */
            <div className="space-y-4">
              {/* KPIS GERAIS DA EQUIPE */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono font-bold block">
                    Total Atribuído
                  </span>
                  <div className="text-base sm:text-lg font-black text-white font-mono mt-0.5">
                    {teamStats.total} <span className="text-[10px] font-normal text-slate-400">tarefas</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
                  <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold block flex items-center gap-1">
                    <CheckCircle2 size={11} /> Entregas Feitas
                  </span>
                  <div className="text-base sm:text-lg font-black text-emerald-300 font-mono mt-0.5">
                    {teamStats.concluidos} <span className="text-[10px] font-normal text-emerald-400/80">({teamStats.taxaGlobal}%)</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40">
                  <span className="text-[10px] text-amber-400 uppercase font-mono font-bold block flex items-center gap-1">
                    <Clock size={11} /> Em Andamento
                  </span>
                  <div className="text-base sm:text-lg font-black text-amber-300 font-mono mt-0.5">
                    {teamStats.pendentes} <span className="text-[10px] font-normal text-amber-400/80">pendentes</span>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${
                  teamStats.atrasados > 0 
                    ? 'bg-rose-950/40 border-rose-500/50' 
                    : 'bg-slate-950/80 border-slate-800'
                }`}>
                  <span className={`text-[10px] uppercase font-mono font-bold block flex items-center gap-1 ${
                    teamStats.atrasados > 0 ? 'text-rose-400' : 'text-slate-400'
                  }`}>
                    <AlertTriangle size={11} /> Atrasos
                  </span>
                  <div className={`text-base sm:text-lg font-black font-mono mt-0.5 ${
                    teamStats.atrasados > 0 ? 'text-rose-300' : 'text-slate-300'
                  }`}>
                    {teamStats.atrasados} <span className="text-[10px] font-normal text-slate-400">tarefas</span>
                  </div>
                </div>
              </div>

              {/* PÓDIO EXECUTIVO DOS TOP 3 DESTAQUES */}
              {rankingData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
                      <Sparkles size={13} className="text-amber-400" />
                      <span>Pódio dos Destaques do Mês:</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Tarefas Finalizadas na Lousa
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* 1º LUGAR — OURO */}
                    {top1 && (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-b from-amber-950/30 to-slate-950 border-2 border-amber-500/60 shadow-lg shadow-amber-950/30 relative flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-black uppercase font-mono">
                            🥇 1º Lugar • Ouro
                          </span>
                          <span className="text-[10px] font-mono font-bold text-emerald-400">
                            {top1.taxaEntrega}% entrega
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 my-1.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-sm text-white ${getResponsibleColor(top1.nome).badgeClass}`}>
                            {top1.nome.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-black text-white font-mono uppercase tracking-wide truncate">
                              {top1.nome}
                            </h4>
                            <span className="text-[10px] text-amber-300 font-bold block">
                              Líder de Produtividade
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                          <span className="text-emerald-400 font-bold">
                            ✅ {top1.concluidos} concluídas
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {top1.total} atribuídas
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 2º LUGAR — PRATA */}
                    {top2 && (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-b from-slate-900/60 to-slate-950 border border-slate-600/60 shadow-md relative flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/40 border border-slate-500/50 text-slate-200 text-[10px] font-black uppercase font-mono">
                            🥈 2º Lugar • Prata
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-300">
                            {top2.taxaEntrega}% entrega
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 my-1.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-sm text-white ${getResponsibleColor(top2.nome).badgeClass}`}>
                            {top2.nome.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-black text-white font-mono uppercase tracking-wide truncate">
                              {top2.nome}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-bold block">
                              Alto Rendimento
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                          <span className="text-emerald-400 font-bold">
                            ✅ {top2.concluidos} concluídas
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {top2.total} atribuídas
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 3º LUGAR — BRONZE */}
                    {top3 && (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-b from-orange-950/20 to-slate-950 border border-orange-500/40 shadow-md relative flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-950/40 border border-orange-500/40 text-orange-300 text-[10px] font-black uppercase font-mono">
                            🥉 3º Lugar • Bronze
                          </span>
                          <span className="text-[10px] font-mono font-bold text-orange-300">
                            {top3.taxaEntrega}% entrega
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 my-1.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-sm text-white ${getResponsibleColor(top3.nome).badgeClass}`}>
                            {top3.nome.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-black text-white font-mono uppercase tracking-wide truncate">
                              {top3.nome}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-bold block">
                              Entregas Constantes
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                          <span className="text-emerald-400 font-bold">
                            ✅ {top3.concluidos} concluídas
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {top3.total} atribuídas
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FILTROS DE ORDENAÇÃO DO RANKING */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-mono text-slate-400">
                  Ordenar ranking por:
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRankingSortBy('concluidos')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                      rankingSortBy === 'concluidos'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    🥇 Mais Concluídas
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankingSortBy('taxa')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                      rankingSortBy === 'taxa'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    🎯 Maior Taxa (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankingSortBy('total')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                      rankingSortBy === 'total'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    ⏳ Mais Tarefas
                  </button>
                </div>
              </div>

              {/* LISTA COMPLETA DOS MEMBROS NO RANKING */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {rankingData.map((item, index) => {
                  const respColor = getResponsibleColor(item.nome);
                  const isTop3 = index < 3;

                  return (
                    <div
                      key={item.nome}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all shadow-sm ${
                        index === 0
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : isTop3
                          ? 'bg-slate-950/90 border-slate-700/80'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* POSIÇÃO E IDENTIFICAÇÃO DO MEMBRO */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 text-center font-mono font-black text-xs ${
                          index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-orange-400' : 'text-slate-500'
                        }`}>
                          #{index + 1}
                        </span>

                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs text-white flex-shrink-0 ${respColor.badgeClass}`}>
                          {item.nome.substring(0, 2)}
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide truncate">
                            {item.nome}
                          </h4>
                          
                          {/* BARRA DE PROGRESSO DE CONCLUSÃO */}
                          <div className="w-32 sm:w-44 h-1.5 rounded-full bg-slate-800 overflow-hidden flex mt-1">
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${item.taxaEntrega}%` }}
                            />
                            {item.atrasados > 0 && (
                              <div 
                                className="h-full bg-rose-500 transition-all duration-300"
                                style={{ width: `${item.total > 0 ? (item.atrasados / item.total) * 100 : 0}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* INDICADORES EM PÍLULAS */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end text-xs font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                          ✅ {item.concluidos} concl.
                        </span>

                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-[11px]">
                          ⏳ {item.pendentes} pend.
                        </span>

                        {item.atrasados > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[11px] font-bold">
                            ⚠️ {item.atrasados} atras.
                          </span>
                        )}

                        <span className="px-2.5 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-[11px] font-black">
                          {item.taxaEntrega}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'list' ? (
            
            /* ── ABA 2: LISTA DE MEMBROS CADASTRADOS (COM BOTÃO DE EXCLUIR E EDITAR) ── */
            <div className="space-y-3">
              {/* CAMPO DE BUSCA RÁPIDA */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar membro por nome..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500 min-h-[42px]"
                />
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Clique em <strong>Editar</strong> para renomear/cor ou <strong>Excluir</strong> para remover da lousa.</span>
                <span className="font-mono text-cyan-400">{filteredMembers.length} membros</span>
              </div>

              {/* LISTA EM CARDS */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {filteredMembers.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs font-mono">
                    Nenhum membro encontrado com "{searchFilter}".
                  </div>
                ) : (
                  filteredMembers.map(m => {
                    const respColor = getResponsibleColor(m);
                    const counts = effectiveCountsMap[m.toUpperCase()] || { total: 0, concluidos: 0, pendentes: 0, atrasados: 0 };

                    return (
                      <div
                        key={m}
                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 flex items-center justify-between gap-2 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs text-white flex-shrink-0 ${respColor.badgeClass}`}>
                            {m.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide truncate">
                              {m}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {counts.total} tarefa{counts.total !== 1 ? 's' : ''} ({counts.concluidos} concluída{counts.concluidos !== 1 ? 's' : ''})
                            </span>
                          </div>
                        </div>

                        {/* BOTÕES DE AÇÃO: EDITAR E EXCLUIR */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditMember(m)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 min-h-[36px]"
                            title={`Editar ${m}`}
                          >
                            <Edit3 size={11} className="text-cyan-400" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartDeleteMember(m)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white text-xs font-bold transition-all border border-rose-500/30 hover:border-rose-500 min-h-[36px]"
                            title={`Excluir ${m} da lousa`}
                          >
                            <Trash2 size={11} className="text-rose-400" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (

            /* ── ABA 3: FORMULÁRIO DE EDIÇÃO OU CRIAÇÃO ── */
            <form id="member-form" onSubmit={handleSubmit} className="space-y-4">
              {/* CAMPO: NOME DO MEMBRO */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                  Nome na Lousa (Exibição) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={nome}
                    onChange={(e) => setNome(e.target.value.toUpperCase())}
                    placeholder="EX: MARCOS, MATHEUS, MELISSA, GUILHERME..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm uppercase focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600 min-h-[44px]"
                  />
                  <span className="absolute right-3 top-3 text-[10px] text-slate-500 font-mono font-bold">
                    MAIÚSCULAS
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Ao renomear, todas as tarefas ativas com este nome serão atualizadas automaticamente.
                </p>
              </div>

              {/* SELETOR DE COR EXECUTIVA (PURPLE BAN) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Palette size={13} className="text-cyan-400" />
                    Cor do Crachá / Identidade Visual
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    (Purple Ban Respeitado)
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {APPROVED_MEMBER_COLORS.map(c => {
                    const isSelected = selectedColorHex.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setSelectedColorHex(c.hex)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-mono font-bold transition-all text-left min-h-[42px] ${
                          isSelected
                            ? 'bg-slate-900 border-white ring-2 ring-white/70 text-white shadow-md'
                            : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <span 
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: c.hex }} 
                        />
                        <span className="truncate text-[11px]">{c.name}</span>
                        {isSelected && <Check size={12} className="ml-auto text-emerald-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* VÍNCULO COM COLABORADOR REAL (TABELA EMPLOYEES DO SUPABASE) */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Link2 size={13} className="text-cyan-400" />
                    Vínculo com Colaborador (Supabase)
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    Central de Notificações
                  </span>
                </label>

                <select
                  value={linkedEmployeeId}
                  onChange={(e) => setLinkedEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-500 min-h-[42px]"
                >
                  <option value="">— Sem vínculo específico (Somente nome textual) —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} {emp.job_role ? `• ${emp.job_role}` : ''} {emp.email ? `(${emp.email})` : ''}
                    </option>
                  ))}
                </select>

                <p className="text-[10px] text-slate-400 leading-tight">
                  Vincula este responsável ao cadastro oficial da equipe, permitindo o envio de notificações Web Push personalizadas para seus computadores e celulares Motorola Android.
                </p>
              </div>

              {/* BOTÃO DE EXCLUSÃO DESTACADO QUANDO EM MODO EDIÇÃO */}
              {selectedTargetMember && (
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleStartDeleteMember(selectedTargetMember)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 text-rose-300 hover:text-white hover:bg-rose-900/60 border border-rose-500/40 text-xs font-bold transition-all min-h-[42px]"
                  >
                    <Trash2 size={13} className="text-rose-400" />
                    <span>Excluir Membro "{selectedTargetMember}"</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="text-xs text-slate-400 hover:text-white underline font-mono"
                  >
                    Voltar para lista
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        {!isDeletingStep && (
          <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-800 bg-[#060a13]">
            {activeTab === 'form' ? (
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all min-h-[42px]"
              >
                Voltar à Lista
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all min-h-[42px]"
              >
                Fechar
              </button>
            )}

            {activeTab === 'form' ? (
              <button
                type="submit"
                form="member-form"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md font-mono min-h-[42px]"
              >
                <Check size={14} />
                <span>{selectedTargetMember ? 'Salvar Membro' : 'Criar Membro'}</span>
              </button>
            ) : activeTab === 'ranking' ? (
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-white text-xs font-bold transition-all border border-slate-700 min-h-[42px]"
              >
                <Users size={13} />
                <span>Gerenciar Membros</span>
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
