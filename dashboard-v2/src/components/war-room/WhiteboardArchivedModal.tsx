"use client";

import React, { useState, useMemo } from 'react';
import { WhiteboardItem } from '@/types/war-room';
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
} from 'lucide-react';

interface ArchivedEntry {
  item: WhiteboardItem;
  colunaId: string;
  colunaTitulo: string;
}

interface WhiteboardArchivedModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivedItems: ArchivedEntry[];
  onRestore: (columnId: string, itemId: string) => void;
  onDeletePermanent: (columnId: string, itemId: string) => void;
}

export function WhiteboardArchivedModal({
  isOpen,
  onClose,
  archivedItems,
  onRestore,
  onDeletePermanent,
}: WhiteboardArchivedModalProps) {
  const [search, setSearch] = useState('');
  const [selectedColumn, setSelectedColumn] = useState<string>('all');
  const [selectedResp, setSelectedResp] = useState<string>('all');

  // Listas de filtros únicos
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

  // Itens filtrados
  const filtered = useMemo(() => {
    return archivedItems.filter((entry) => {
      // Filtro de coluna
      if (selectedColumn !== 'all' && entry.colunaId !== selectedColumn) {
        return false;
      }
      // Filtro de responsável
      if (
        selectedResp !== 'all' &&
        entry.item.responsavel?.toUpperCase() !== selectedResp.toUpperCase()
      ) {
        return false;
      }
      // Filtro de busca textual
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
      <div className="bg-[#070c18] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800/80 bg-[#090e1a]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Archive size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black uppercase text-white font-mono tracking-wider">
                  Histórico de Demandas Finalizadas & Arquivadas
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300">
                  {archivedItems.length} arquivada{archivedItems.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Consulte pendências concluídas com data de arquivamento, responsável e restauração em 1 clique
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

        {/* BARRA DE FILTROS E BUSCA */}
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

        {/* LISTAGEM DE ITENS ARQUIVADOS */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                <Archive size={24} />
              </div>
              <div className="max-w-md">
                <p className="text-sm font-bold text-slate-300 font-mono">
                  {archivedItems.length === 0
                    ? 'Nenhuma demanda arquivada no momento'
                    : 'Nenhuma demanda corresponde aos filtros aplicados'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {archivedItems.length === 0
                    ? 'Ao concluir ou marcar uma demanda como finalizada nas colunas da lousa, ela será armazenada aqui para consulta e auditoria contínua.'
                    : 'Tente ajustar os termos de busca ou selecione outra coluna/responsável.'}
                </p>
              </div>
            </div>
          ) : (
            filtered.map(({ item, colunaId, colunaTitulo }) => (
              <div
                key={item.id}
                className="p-3 sm:p-3.5 rounded-xl bg-[#090e1a] border border-slate-800/90 hover:border-slate-700 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="mt-0.5 w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={13} />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    {/* LINHA DE BADGES: COLUNA + RESPONSÁVEL */}
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

                      {item.prioridade && item.prioridade !== 'normal' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-amber-950/40 border border-amber-500/40 text-amber-300">
                          {item.prioridade}
                        </span>
                      )}
                    </div>

                    {/* TEXTO DA DEMANDA */}
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
                  {/* RESTAURAR */}
                  <button
                    type="button"
                    onClick={() => onRestore(colunaId, item.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50 hover:text-white text-xs font-bold font-mono transition-all"
                    title="Restaurar de volta para a coluna ativa da lousa"
                  >
                    <RotateCcw size={12} />
                    <span>Restaurar</span>
                  </button>

                  {/* EXCLUIR DEFINITIVAMENTE */}
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Excluir permanentemente do histórico a demanda "${item.texto}"?`
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
            ))
          )}
        </div>

        {/* RODAPÉ */}
        <div className="p-3 sm:p-4 border-t border-slate-800/80 bg-[#090e1a] flex items-center justify-between text-xs font-mono text-slate-400">
          <span>
            Exibindo <strong className="text-white">{filtered.length}</strong> de{' '}
            <strong className="text-white">{archivedItems.length}</strong> arquivadas
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
