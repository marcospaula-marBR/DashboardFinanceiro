"use client";

import React, { useState, useEffect } from 'react';
import { WhiteboardColumn } from '@/types/war-room';
import { calculatePrazoInfo } from '@/services/war-room.service';
import { 
  X, 
  Save, 
  Trash2, 
  Archive, 
  Calendar, 
  AlertOctagon, 
  Palette, 
  Layers,
  Sparkles,
  Clock
} from 'lucide-react';

interface WhiteboardDemandColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  column: WhiteboardColumn | null;
  onSave: (payload: {
    columnId?: string;
    titulo: string;
    subtitulo?: string;
    alertaDestaque?: string;
    dataLimite?: string;
    corMarcador: 'vermelho' | 'azul' | 'ciano' | 'esmeralda' | 'ambar';
  }) => void;
  onArchive?: (columnId: string) => void;
  onDelete?: (columnId: string) => void;
}

export function WhiteboardDemandColumnModal({
  isOpen,
  onClose,
  column,
  onSave,
  onArchive,
  onDelete,
}: WhiteboardDemandColumnModalProps) {
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [alertaDestaque, setAlertaDestaque] = useState('');
  const [dataLimite, setDataLimite] = useState('');
  const [corMarcador, setCorMarcador] = useState<'vermelho' | 'azul' | 'ciano' | 'esmeralda' | 'ambar'>('vermelho');

  useEffect(() => {
    if (column) {
      setTitulo(column.titulo || '');
      setSubtitulo(column.subtitulo || '');
      setAlertaDestaque(column.alertaDestaque || '');
      setDataLimite(column.dataLimite || '');
      setCorMarcador(column.corMarcador || 'vermelho');
    } else {
      setTitulo('');
      setSubtitulo('');
      setAlertaDestaque('');
      setDataLimite('');
      setCorMarcador('vermelho');
    }
  }, [column, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!column;
  const prazoInfo = calculatePrazoInfo(dataLimite);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    onSave({
      columnId: column?.id,
      titulo: titulo.trim().toUpperCase(),
      subtitulo: subtitulo.trim() || undefined,
      alertaDestaque: alertaDestaque.trim() ? alertaDestaque.trim().toUpperCase() : undefined,
      dataLimite: dataLimite.trim() || undefined,
      corMarcador,
    });
    onClose();
  };

  const handleArchive = () => {
    if (!column || !onArchive) return;
    if (window.confirm(`Deseja arquivar a demanda "${column.titulo}"? Ela será ocultada da lousa ativa e poderá ser consultada ou restaurada a qualquer momento.`)) {
      onArchive(column.id);
      onClose();
    }
  };

  const handleDelete = () => {
    if (!column || !onDelete) return;
    if (window.confirm(`ATENÇÃO: Deseja realmente excluir a demanda "${column.titulo}" e todas as suas tarefas? Esta ação não pode ser desfeita.`)) {
      onDelete(column.id);
      onClose();
    }
  };

  // Atalhos rápidos de data limite
  const setQuickPrazo = (diasAdicionais: number) => {
    const d = new Date();
    d.setDate(d.getDate() + diasAdicionais);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDataLimite(`${yyyy}-${mm}-${dd}`);
  };

  const setPrazoFimDoMes = () => {
    const d = new Date();
    const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const yyyy = ultimoDia.getFullYear();
    const mm = String(ultimoDia.getMonth() + 1).padStart(2, '0');
    const dd = String(ultimoDia.getDate()).padStart(2, '0');
    setDataLimite(`${yyyy}-${mm}-${dd}`);
  };

  const coresDisponiveis: Array<{
    valor: 'vermelho' | 'azul' | 'ciano' | 'esmeralda' | 'ambar';
    nome: string;
    bgClass: string;
    borderClass: string;
  }> = [
    { valor: 'vermelho', nome: 'Vermelho / Rose', bgClass: 'bg-rose-500', borderClass: 'border-rose-500' },
    { valor: 'azul', nome: 'Azul Executivo', bgClass: 'bg-blue-500', borderClass: 'border-blue-500' },
    { valor: 'ciano', nome: 'Ciano High-Tech', bgClass: 'bg-cyan-500', borderClass: 'border-cyan-500' },
    { valor: 'esmeralda', nome: 'Verde Esmeralda', bgClass: 'bg-emerald-500', borderClass: 'border-emerald-500' },
    { valor: 'ambar', nome: 'Âmbar Alerta', bgClass: 'bg-amber-500', borderClass: 'border-amber-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#090e1a] border border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#070c18]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <div>
              <h3 className="text-sm sm:text-base font-black uppercase text-white font-mono tracking-wider flex items-center gap-2">
                <Layers size={16} className="text-cyan-400" />
                {isEditing ? 'Editar Demanda (Coluna)' : 'Nova Demanda na Lousa'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {isEditing
                  ? 'Gerencie título, prazo, alertas e visibilidade desta demanda na lousa'
                  : 'Crie uma nova coluna operacional com prazo e marcador personalizado'}
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
          {/* TÍTULO DA DEMANDA */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Título da Demanda (Coluna) *
            </label>
            <input
              type="text"
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: CONTABILIDADE PY, DLOCAL G2, REMESSA CONFORME..."
              className="w-full bg-[#050811] border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-400 uppercase font-mono font-bold shadow-inner"
              required
            />
          </div>

          {/* SUBTÍTULO / ESCOPO */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
              Subtítulo / Escopo da Demanda (Opcional)
            </label>
            <input
              type="text"
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder="Ex: Operações e regularização no Paraguai"
              className="w-full bg-[#050811] border border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-cyan-400 font-mono shadow-inner"
            />
          </div>

          {/* ALERTA EM DESTAQUE */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
              <AlertOctagon size={13} className="text-amber-400" />
              Alerta em Destaque na Demanda (Opcional)
            </label>
            <input
              type="text"
              value={alertaDestaque}
              onChange={(e) => setAlertaDestaque(e.target.value)}
              placeholder="Ex: * SUSPENSAS NOVAS CONTAS, * ATENÇÃO RECEITA FEDERAL"
              className="w-full bg-[#050811] border border-slate-700 rounded-xl p-2.5 text-xs text-amber-300 focus:outline-none focus:border-amber-400 uppercase font-mono shadow-inner"
            />
            {alertaDestaque.trim() && (
              <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/40 flex items-center gap-1.5 animate-pulse">
                <AlertOctagon size={13} className="text-rose-400 flex-shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-300 font-mono">
                  {alertaDestaque.trim().toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* DATA LIMITE (PRAZO) COM PREVIEW SEMÂNTICO E CORES */}
          <div className="bg-[#050811] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Calendar size={14} className="text-cyan-400" />
                Data Limite da Demanda
              </label>
              {dataLimite && prazoInfo.status !== 'sem_prazo' && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wide ${prazoInfo.badgeClass}`}>
                  {prazoInfo.rotulo}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dataLimite}
                onChange={(e) => setDataLimite(e.target.value)}
                className="flex-1 bg-[#090e1a] border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-cyan-400"
              />
              {dataLimite && (
                <button
                  type="button"
                  onClick={() => setDataLimite('')}
                  className="px-2.5 py-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white text-xs border border-slate-800 hover:border-slate-700"
                  title="Limpar prazo"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* ATALHOS RÁPIDOS DE PRAZO */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                <Clock size={10} /> Atalhos:
              </span>
              <button
                type="button"
                onClick={() => setQuickPrazo(0)}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 hover:border-amber-500/50"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setQuickPrazo(3)}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 hover:border-amber-500/50"
              >
                +3 dias
              </button>
              <button
                type="button"
                onClick={() => setQuickPrazo(7)}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800 hover:border-emerald-500/50"
              >
                +7 dias
              </button>
              <button
                type="button"
                onClick={() => setQuickPrazo(15)}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800 hover:border-emerald-500/50"
              >
                +15 dias
              </button>
              <button
                type="button"
                onClick={setPrazoFimDoMes}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 hover:border-cyan-500/50"
              >
                Fim do Mês
              </button>
            </div>
          </div>

          {/* COR DO MARCADOR SUPERIOR */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5">
              <Palette size={13} className="text-cyan-400" />
              Cor do Marcador da Demanda
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {coresDisponiveis.map((c) => {
                const isSelected = corMarcador === c.valor;
                return (
                  <button
                    key={c.valor}
                    type="button"
                    onClick={() => setCorMarcador(c.valor)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-cyan-400 ring-1 ring-cyan-400/50 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${c.bgClass}`} />
                    <span className={`text-xs font-mono font-medium ${isSelected ? 'text-white font-bold' : 'text-slate-400'}`}>
                      {c.nome}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RODAPÉ DE AÇÕES */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* BOTÃO ARQUIVAR DEMANDA INTEIRA */}
              {isEditing && onArchive && (
                <button
                  type="button"
                  onClick={handleArchive}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 hover:bg-amber-900/50 hover:text-white text-xs font-bold transition-all"
                  title="Arquivar demanda inteira e ocultar da lousa ativa"
                >
                  <Archive size={13} />
                  <span>Arquivar Demanda</span>
                </button>
              )}

              {/* BOTÃO EXCLUIR DEMANDA */}
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 hover:bg-rose-900/50 hover:text-white text-xs font-bold transition-all"
                  title="Excluir demanda permanentemente"
                >
                  <Trash2 size={13} />
                  <span>Excluir</span>
                </button>
              )}
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
                <span>{isEditing ? 'Salvar Demanda' : 'Criar Demanda'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
