"use client";

import React, { useState, useEffect } from 'react';
import { WhiteboardColumn, WhiteboardItem } from '@/types/war-room';
import { X, Save, Trash2, Archive, User, AlertCircle, ArrowRightLeft, FileText } from 'lucide-react';

interface WhiteboardEditDemandModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnId: string;
  item: WhiteboardItem | null;
  colunas: WhiteboardColumn[];
  onSave: (
    currentColId: string,
    itemId: string,
    updates: {
      texto: string;
      responsavel?: string;
      destaque?: boolean;
      observacao?: string;
      prioridade?: 'normal' | 'alta' | 'urgente';
      novaColunaId?: string;
    }
  ) => void;
  onDelete: (columnId: string, itemId: string) => void;
  onArchive: (columnId: string, itemId: string) => void;
}

export function WhiteboardEditDemandModal({
  isOpen,
  onClose,
  columnId,
  item,
  colunas,
  onSave,
  onDelete,
  onArchive,
}: WhiteboardEditDemandModalProps) {
  const [texto, setTexto] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [targetColId, setTargetColId] = useState(columnId);
  const [destaque, setDestaque] = useState(false);
  const [prioridade, setPrioridade] = useState<'normal' | 'alta' | 'urgente'>('normal');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (item) {
      setTexto(item.texto || '');
      setResponsavel(item.responsavel || '');
      setTargetColId(columnId);
      setDestaque(!!item.destaque);
      setPrioridade(item.prioridade || 'normal');
      setObservacao(item.observacao || '');
    }
  }, [item, columnId, isOpen]);

  if (!isOpen || !item) return null;

  const currentColumn = colunas.find(c => c.id === columnId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;

    onSave(columnId, item.id, {
      texto: texto.trim().toUpperCase(),
      responsavel: responsavel.trim() || undefined,
      destaque,
      prioridade,
      observacao: observacao.trim() || undefined,
      novaColunaId: targetColId,
    });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja excluir a demanda "${item.texto}"?`)) {
      onDelete(columnId, item.id);
      onClose();
    }
  };

  const handleArchive = () => {
    onArchive(columnId, item.id);
    onClose();
  };

  const quickResponsibles = ['MANUS', 'CLARA', 'MARCO', 'ALDO', 'FINANCEIRO', 'JURÍDICO', 'CONTÁBIL'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#090e1a] border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#070c18]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <div>
              <h3 className="text-sm sm:text-base font-black uppercase text-white font-mono tracking-wider">
                Editar Demanda Operacional
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Altere coluna de destino, executor responsável, urgência e notas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TEXTO DA DEMANDA */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Descrição da Demanda *
            </label>
            <textarea
              rows={2}
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Descreva a atividade ou pendência operacional..."
              className="w-full bg-[#050811] border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 uppercase font-mono font-medium resize-none shadow-inner"
              required
            />
          </div>

          {/* COLUNA / PILAR DE DESTINO */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
              <ArrowRightLeft size={13} className="text-cyan-400" />
              Coluna / Pilar Operacional
            </label>
            <select
              value={targetColId}
              onChange={(e) => setTargetColId(e.target.value)}
              className="w-full bg-[#050811] border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-cyan-400"
            >
              {colunas.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.titulo} {col.subtitulo ? `(${col.subtitulo})` : ''}
                </option>
              ))}
            </select>
            {targetColId !== columnId && (
              <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                A demanda será transferida de &ldquo;{currentColumn?.titulo}&rdquo; para a coluna selecionada ao salvar.
              </p>
            )}
          </div>

          {/* RESPONSÁVEL PELA AÇÃO HUMANA */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <User size={13} className="text-rose-400" />
                Responsável pela Ação Humana
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Destaque visual na lousa</span>
            </div>
            <input
              type="text"
              list="modal-resp-suggestions"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Ex: MANUS, CLARA, MARCO, ALDO..."
              className="w-full bg-[#050811] border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-rose-300 focus:outline-none focus:border-rose-400 uppercase font-mono font-bold"
            />
            {/* PÍLULAS DE CLIQUE RÁPIDO */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-500 font-mono">Atalhos:</span>
              {quickResponsibles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResponsavel(r)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all ${
                    responsavel.toUpperCase() === r
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* PRIORIDADE E DESTAQUE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
                Nível de Criticidade
              </label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as any)}
                className="w-full bg-[#050811] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              >
                <option value="normal">Normal</option>
                <option value="alta">Alta Prioridade</option>
                <option value="urgente">Urgente / Crítica</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={destaque}
                  onChange={(e) => setDestaque(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-700"
                />
                <div>
                  <span className="text-xs font-bold text-amber-300 font-mono">Destaque Visual</span>
                  <p className="text-[10px] text-slate-400">Borda iluminada e realce em amarelo âmbar</p>
                </div>
              </label>
            </div>
          </div>

          {/* OBSERVAÇÕES / HISTÓRICO */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
              <FileText size={13} className="text-slate-400" />
              Observações & Detalhes (Opcional)
            </label>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Instruções, links, prazos ou notas internas..."
              className="w-full bg-[#050811] border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 resize-none font-mono"
            />
          </div>

          {/* RODAPÉ DE AÇÕES */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* EXCLUIR */}
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 hover:bg-rose-900/50 hover:text-white text-xs font-bold transition-all"
                title="Excluir demanda permanentemente"
              >
                <Trash2 size={13} />
                <span>Excluir</span>
              </button>

              {/* FINALIZAR & ARQUIVAR */}
              <button
                type="button"
                onClick={handleArchive}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50 hover:text-white text-xs font-bold transition-all"
                title="Marcar como finalizada e arquivar da lousa ativa"
              >
                <Archive size={13} />
                <span>Finalizar & Arquivar</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase font-mono shadow-md transition-all"
              >
                <Save size={13} />
                <span>Salvar Demanda</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
