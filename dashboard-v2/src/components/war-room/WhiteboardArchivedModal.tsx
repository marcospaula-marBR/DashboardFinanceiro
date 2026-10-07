"use client";

import React, { useState, useMemo } from 'react';
import { WhiteboardItem, WhiteboardColumn } from '@/types/war-room';
import { calculatePrazoInfo } from '@/services/war-room.service';
import {
  X,
  Archive,
  Search,
  RotateCcw,
  Trash2,
  Calendar,
  User,
  Filter,
  CheckCircle2,
  Layers,
  FileText,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Edit3,
  CheckSquare
} from 'lucide-react';

interface ArchivedEntry {
  item: WhiteboardItem;
  colunaId: string;
  colunaTitulo: string;
}

interface WhiteboardArchivedModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Demandas inteiras (colunas da lousa) arquivadas:
  archivedDemands?: WhiteboardColumn[];
  onRestoreDemand?: (columnId: string) => void;
  onDeleteDemand?: (columnId: string) => void;
  onEditDemand?: (column: WhiteboardColumn) => void;
  // Tarefas individuais arquivadas:
  archivedItems: ArchivedEntry[];
  onRestore: (columnId: string, itemId: string) => void;
  onDeletePermanent: (columnId: string, itemId: string) => void;
}

export function WhiteboardArchivedModal({
  isOpen,
  onClose,
  archivedDemands = [],
  onRestoreDemand,
  onDeleteDemand,
  onEditDemand,
  archivedItems,
  onRestore,
  onDeletePermanent,
}: WhiteboardArchivedModalProps) {
  // Aba ativa: 'demandas' (colunas inteiras) ou 'tarefas' (itens individuais)
  const [activeTab, setActiveTab] = useState<'demandas' | 'tarefas'>('demandas');

  // Estados de busca para demandas
  const [searchDemands, setSearchDemands] = useState('');
  const [expandedDemandId, setExpandedDemandId] = useState<string | null>(null);

  // Estados de busca para tarefas
  const [search, setSearch] = useState('');
  const [selectedColumn, setSelectedColumn] = useState<string>('all');
  const [selectedResp, setSelectedResp] = useState<string>('all');

  // Listas de filtros únicos para tarefas
  const distinctColumns = useMemo(() => {
    const map = new Map<string, string>();
    archivedItems.forEach((entry) => {
      map.set(entry.colunaId, entry.colunaTitulo);
    });
    return Array.from(map.entries()).map(([id, titulo]) => ({ id, titulo }));
  }, [archivedItems]);

  const distinctResponsibles = useMemo(() => {
    const set = new Set<string>();
    archivedItems.forEach((entry) => {
      if (entry.item.responsavel) set.add(entry.item.responsavel.toUpperCase());
    });
    return Array.from(set).sort();
  }, [archivedItems]);

  // Demandas filtradas
  const filteredDemands = useMemo(() => {
    if (!searchDemands.trim()) return archivedDemands;
    const q = searchDemands.trim().toUpperCase();
    return archivedDemands.filter((col) => {
      return (
        col.titulo.toUpperCase().includes(q) ||
        col.subtitulo?.toUpperCase().includes(q) ||
        col.alertaDestaque?.toUpperCase().includes(q) ||
        col.itens.some((it) => it.texto.toUpperCase().includes(q))
      );
    });
  }, [archivedDemands, searchDemands]);

  // Tarefas filtradas
  const filteredTasks = useMemo(() => {
    return archivedItems.filter((entry) => {
      if (selectedColumn !== 'all' && entry.colunaId !== selectedColumn) {
        return false;
      }
      if (
        selectedResp !== 'all' &&
        entry.item.responsavel?.toUpperCase() !== selectedResp.toUpperCase()
      ) {
        return false;
      }
      if (search.trim()) {
        const query = search.trim().toUpperCase();
        const matchesText = entry.item.texto.toUpperCase().includes(query);
        const matchesResp = entry.item.responsavel?.toUpperCase().includes(query);
        const matchesCol = entry.colunaTitulo.toUpperCase().includes(query);
        const matchesObs = entry.item.observacao?.toUpperCase().includes(query);
        if (!matchesText && !matchesResp && !matchesCol && !matchesObs) {
          return false;
        }
      }
      return true;
    });
  }, [archivedItems, selectedColumn, selectedResp, search]);

  if (!isOpen) return null;

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Data não registrada';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#070c18] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* CABEÇALHO COM ABAS */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-[#090e1a]">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Archive size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black uppercase text-white font-mono tracking-wider">
                    Histórico & Arquivamento da Lousa
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300">
                    {archivedDemands.length} demanda{archivedDemands.length !== 1 ? 's' : ''} • {archivedItems.length} tarefa{archivedItems.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Consulte demandas ocultadas da lousa e tarefas finalizadas, com restauração em 1 clique
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Fechar histórico"
            >
              <X size={18} />
            </button>
          </div>

          {/* SELETOR DE ABAS: DEMANDAS VS TAREFAS */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
            <button
              type="button"
              onClick={() => setActiveTab('demandas')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                activeTab === 'demandas'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
              }`}
            >
              <Layers size={13} />
              <span>Demandas Inteiras Ocultadas ({archivedDemands.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tarefas')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                activeTab === 'tarefas'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
              }`}
            >
              <CheckSquare size={13} />
              <span>Tarefas Individuais ({archivedItems.length})</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ABA 1: DEMANDAS INTEIRAS ARQUIVADAS (COLUNAS OCULTADAS DA LOUSA) */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'demandas' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* BUSCA DE DEMANDAS */}
            <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-[#070c18]">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchDemands}
                  onChange={(e) => setSearchDemands(e.target.value)}
                  placeholder="Buscar demanda arquivada por título, subtítulo ou tarefa..."
                  className="w-full bg-[#050811] border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                />
                {searchDemands && (
                  <button
                    type="button"
                    onClick={() => setSearchDemands('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* LISTAGEM DE DEMANDAS ARQUIVADAS */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
              {filteredDemands.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <Layers size={24} />
                  </div>
                  <div className="max-w-md">
                    <p className="text-sm font-bold text-slate-300 font-mono">
                      {archivedDemands.length === 0
                        ? 'Nenhuma demanda arquivada no momento'
                        : 'Nenhuma demanda corresponde à busca'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {archivedDemands.length === 0
                        ? 'Você pode arquivar qualquer demanda inteira clicando no botão "Arquivar" no cabeçalho da coluna na lousa. Ela será ocultada da lousa ativa e poderá ser restaurada a qualquer momento aqui.'
                        : 'Verifique os termos pesquisados.'}
                    </p>
                  </div>
                </div>
              ) : (
                filteredDemands.map((col) => {
                  const prazoInfo = calculatePrazoInfo(col.dataLimite);
                  const totalTarefas = col.itens.length;
                  const concluidas = col.itens.filter((i) => i.concluido).length;
                  const pendentes = totalTarefas - concluidas;
                  const isExpanded = expandedDemandId === col.id;

                  const markerBg =
                    col.corMarcador === 'azul'
                      ? 'bg-blue-500'
                      : col.corMarcador === 'ciano'
                      ? 'bg-cyan-500'
                      : col.corMarcador === 'esmeralda'
                      ? 'bg-emerald-500'
                      : col.corMarcador === 'ambar'
                      ? 'bg-amber-500'
                      : 'bg-rose-500';

                  return (
                    <div
                      key={col.id}
                      className="rounded-xl bg-[#090e1a] border border-slate-800/90 hover:border-slate-700 transition-all shadow-sm overflow-hidden"
                    >
                      {/* LINHA SUPERIOR DO MARCADOR */}
                      <div className={`h-1 w-full ${markerBg}`} />

                      <div className="p-3.5 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* INFORMAÇÕES DA DEMANDA */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-black uppercase font-mono tracking-wide text-white">
                                {col.titulo}
                              </h4>

                              {/* BADGE DE PRAZO DA DEMANDA */}
                              {col.dataLimite && prazoInfo.status !== 'sem_prazo' && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wide ${prazoInfo.badgeClass}`}>
                                  {prazoInfo.rotulo}
                                </span>
                              )}

                              {/* STATUS DE EXECUÇÃO */}
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {concluidas}/{totalTarefas} tarefas executadas
                              </span>
                            </div>

                            {col.subtitulo && (
                              <p className="text-xs text-slate-400 font-mono">
                                {col.subtitulo}
                              </p>
                            )}

                            {col.alertaDestaque && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold">
                                <AlertOctagon size={11} className="text-rose-400" />
                                <span>{col.alertaDestaque}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono pt-1">
                              <span className="flex items-center gap-1">
                                <Calendar size={10} />
                                Arquivada em: {formatDate(col.arquivadoEm)}
                              </span>
                              {pendentes > 0 ? (
                                <span className="text-amber-400/90">• {pendentes} pendência(s) em aberto</span>
                              ) : (
                                <span className="text-emerald-400/90">• Todas as tarefas concluídas</span>
                              )}
                            </div>
                          </div>

                          {/* AÇÕES DA DEMANDA: RESTAURAR, EDITAR, EXPANDIR TAREFAS, EXCLUIR */}
                          <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap flex-shrink-0">
                            {/* BOTÃO EXPANDIR TAREFAS */}
                            {totalTarefas > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedDemandId(isExpanded ? null : col.id)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono border border-slate-800 transition-colors"
                                title={isExpanded ? 'Recolher tarefas' : 'Visualizar tarefas desta demanda'}
                              >
                                <span>{isExpanded ? 'Recolher' : `Ver Tarefas (${totalTarefas})`}</span>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            )}

                            {/* BOTÃO EDITAR */}
                            {onEditDemand && (
                              <button
                                type="button"
                                onClick={() => onEditDemand(col)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 border border-slate-800 transition-colors"
                                title="Editar dados da demanda"
                              >
                                <Edit3 size={13} />
                              </button>
                            )}

                            {/* BOTÃO RESTAURAR NA LOUSA */}
                            {onRestoreDemand && (
                              <button
                                type="button"
                                onClick={() => onRestoreDemand(col.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/70 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900 hover:text-white text-xs font-bold font-mono transition-all shadow-sm"
                                title="Restaurar de volta para a lousa ativa (torna visível novamente)"
                              >
                                <RotateCcw size={13} />
                                <span>Restaurar na Lousa</span>
                              </button>
                            )}

                            {/* BOTÃO EXCLUIR PERMANENTE */}
                            {onDeleteDemand && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Excluir permanentemente a demanda "${col.titulo}" e todas as suas tarefas?`
                                    )
                                  ) {
                                    onDeleteDemand(col.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                                title="Excluir definitivamente"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* LISTA EXPANSÍVEL DE TAREFAS DA DEMANDA */}
                        {isExpanded && totalTarefas > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                            <h5 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                              <CheckSquare size={11} className="text-cyan-400" />
                              Tarefas registradas nesta demanda:
                            </h5>
                            {col.itens.map((it) => {
                              const itPrazo = calculatePrazoInfo(it.dataLimite, it.concluido);
                              return (
                                <div
                                  key={it.id}
                                  className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs font-mono border ${
                                    it.concluido
                                      ? 'bg-slate-950/40 border-slate-800/50 text-slate-500'
                                      : 'bg-slate-950/80 border-slate-800 text-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border ${
                                        it.concluido
                                          ? 'bg-emerald-500 border-emerald-500 text-white'
                                          : 'border-slate-700 bg-slate-900'
                                      }`}
                                    >
                                      {it.concluido && <CheckCircle2 size={10} className="text-white" />}
                                    </div>

                                    {it.responsavel && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-950 border border-rose-500/50 text-rose-300 flex-shrink-0">
                                        {it.responsavel}
                                      </span>
                                    )}

                                    <span className={it.concluido ? 'line-through' : 'font-medium'}>
                                      {it.texto}
                                    </span>
                                  </div>

                                  {/* PRAZO DA TAREFA */}
                                  {it.dataLimite && itPrazo.status !== 'sem_prazo' && (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] flex-shrink-0 ${itPrazo.badgeClass}`}>
                                      {itPrazo.rotuloCurto || itPrazo.rotulo}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ABA 2: TAREFAS INDIVIDUAIS FINALIZADAS & ARQUIVADAS */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'tarefas' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* BARRA DE FILTROS E BUSCA DE TAREFAS */}
            <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-[#070c18] space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                {/* CAMPO DE BUSCA */}
                <div className="sm:col-span-6 relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por descrição, responsável ou nota..."
                    className="w-full bg-[#050811] border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* FILTRO DE COLUNA */}
                <div className="sm:col-span-3">
                  <select
                    value={selectedColumn}
                    onChange={(e) => setSelectedColumn(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  >
                    <option value="all">Todas as Colunas ({archivedItems.length})</option>
                    {distinctColumns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.titulo}
                      </option>
                    ))}
                  </select>
                </div>

                {/* FILTRO DE RESPONSÁVEL */}
                <div className="sm:col-span-3">
                  <select
                    value={selectedResp}
                    onChange={(e) => setSelectedResp(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-rose-300 font-mono focus:outline-none focus:border-cyan-400"
                  >
                    <option value="all">Todos os Responsáveis</option>
                    {distinctResponsibles.map((r) => (
                      <option key={r} value={r}>
                        👤 {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* LISTAGEM DE TAREFAS */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5">
              {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <CheckSquare size={24} />
                  </div>
                  <div className="max-w-md">
                    <p className="text-sm font-bold text-slate-300 font-mono">
                      {archivedItems.length === 0
                        ? 'Nenhuma tarefa individual arquivada no momento'
                        : 'Nenhuma tarefa corresponde aos filtros aplicados'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {archivedItems.length === 0
                        ? 'Ao arquivar tarefas individuais, elas constarão aqui para auditoria e histórico.'
                        : 'Tente ajustar os termos de busca ou selecione outra coluna/responsável.'}
                    </p>
                  </div>
                </div>
              ) : (
                filteredTasks.map(({ item, colunaId, colunaTitulo }) => {
                  const prazoInfo = calculatePrazoInfo(item.dataLimite, item.concluido);
                  return (
                    <div
                      key={item.id}
                      className="p-3 sm:p-3.5 rounded-xl bg-[#090e1a] border border-slate-800/90 hover:border-slate-700 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="mt-0.5 w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 size={13} />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          {/* LINHA DE BADGES: COLUNA + RESPONSÁVEL + PRAZO */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                              <Layers size={10} className="text-cyan-400" />
                              {colunaTitulo}
                            </span>

                            {item.responsavel && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-950/60 border border-rose-500/40 text-rose-300">
                                <User size={10} className="text-rose-400" />
                                {item.responsavel}
                              </span>
                            )}

                            {item.dataLimite && prazoInfo.status !== 'sem_prazo' && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${prazoInfo.badgeClass}`}>
                                {prazoInfo.rotuloCurto || prazoInfo.rotulo}
                              </span>
                            )}

                            {item.prioridade && item.prioridade !== 'normal' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-amber-950/40 border border-amber-500/40 text-amber-300">
                                {item.prioridade}
                              </span>
                            )}
                          </div>

                          {/* TEXTO DA TAREFA */}
                          <p className="text-xs sm:text-sm font-semibold text-slate-200 uppercase font-mono tracking-wide leading-snug">
                            {item.texto}
                          </p>

                          {/* OBSERVAÇÕES SE HOUVER */}
                          {item.observacao && (
                            <p className="text-[11px] text-slate-400 font-mono italic flex items-center gap-1">
                              <FileText size={10} className="text-slate-500 flex-shrink-0" />
                              <span>{item.observacao}</span>
                            </p>
                          )}

                          {/* METADADOS DE DATA */}
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono pt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              Arquivado em: {formatDate(item.arquivadoEm)}
                            </span>
                            {item.finalizadoPor && (
                              <span>• Por: {item.finalizadoPor}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* BOTÕES DE AÇÃO: RESTAURAR & EXCLUIR */}
                      <div className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => onRestore(colunaId, item.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50 hover:text-white text-xs font-bold font-mono transition-all"
                          title="Restaurar de volta para a coluna ativa da lousa"
                        >
                          <RotateCcw size={12} />
                          <span>Restaurar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Excluir permanentemente do histórico a tarefa "${item.texto}"?`
                              )
                            ) {
                              onDeletePermanent(colunaId, item.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Excluir definitivamente"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* RODAPÉ DO MODAL */}
        <div className="p-3 sm:p-4 border-t border-slate-800/80 bg-[#090e1a] flex items-center justify-between text-xs font-mono text-slate-400">
          <span>
            {activeTab === 'demandas' ? (
              <>
                Exibindo <strong className="text-white">{filteredDemands.length}</strong> de{' '}
                <strong className="text-white">{archivedDemands.length}</strong> demandas arquivadas
              </>
            ) : (
              <>
                Exibindo <strong className="text-white">{filteredTasks.length}</strong> de{' '}
                <strong className="text-white">{archivedItems.length}</strong> tarefas arquivadas
              </>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
