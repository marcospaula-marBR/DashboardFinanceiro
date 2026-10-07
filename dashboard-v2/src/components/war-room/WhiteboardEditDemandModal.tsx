"use client";

import React, { useState, useEffect } from 'react';
import { WhiteboardColumn, WhiteboardItem } from '@/types/war-room';
import { calculatePrazoInfo, extractResponsaveisList, getResponsibleColor } from '@/services/war-room.service';
import { X, Save, Trash2, Archive, User, AlertCircle, ArrowRightLeft, FileText, Calendar, Clock, Plus, Users } from 'lucide-react';

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
      responsaveis?: string[];
      dataLimite?: string;
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
  const [selectedResponsaveis, setSelectedResponsaveis] = useState<string[]>([]);
  const [customRespInput, setCustomRespInput] = useState('');
  const [dataLimite, setDataLimite] = useState('');
  const [targetColId, setTargetColId] = useState(columnId);
  const [destaque, setDestaque] = useState(false);
  const [prioridade, setPrioridade] = useState<'normal' | 'alta' | 'urgente'>('normal');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (item) {
      setTexto(item.texto || '');
      setSelectedResponsaveis(extractResponsaveisList(item));
      setCustomRespInput('');
      setDataLimite(item.dataLimite || '');
      setTargetColId(columnId);
      setDestaque(!!item.destaque);
      setPrioridade(item.prioridade || 'normal');
      setObservacao(item.observacao || '');
    }
  }, [item, columnId, isOpen]);

  if (!isOpen || !item) return null;

  const currentColumn = colunas.find(c => c.id === columnId);

  const handleToggleResp = (name: string) => {
    const upper = name.trim().toUpperCase();
    if (!upper) return;
    setSelectedResponsaveis(prev =>
      prev.includes(upper) ? prev.filter(r => r !== upper) : [...prev, upper]
    );
  };

  const handleAddCustomResp = () => {
    if (!customRespInput.trim()) return;
    const parsed = extractResponsaveisList(customRespInput);
    setSelectedResponsaveis(prev => Array.from(new Set([...prev, ...parsed])));
    setCustomRespInput('');
  };

  const handleRemoveResp = (name: string) => {
    setSelectedResponsaveis(prev => prev.filter(r => r !== name));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;

    onSave(columnId, item.id, {
      texto: texto.trim().toUpperCase(),
      responsavel: selectedResponsaveis.length > 0 ? selectedResponsaveis.join(', ') : undefined,
      responsaveis: selectedResponsaveis,
      dataLimite: dataLimite.trim() || undefined,
      destaque,
      prioridade,
      observacao: observacao.trim() || undefined,
      novaColunaId: targetColId,
    });
    onClose();
  };

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

  const prazoInfo = calculatePrazoInfo(dataLimite, item.concluido);

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

  const quickResponsibles = ['MANUS', 'CLARA', 'MARCO', 'ALDO', 'DAUREN', 'PRISCILLA', 'ADRIANA', 'FINANCEIRO', 'JURÍDICO', 'CONTÁBIL', 'TI'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#090e1a] border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#070c18]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <div>
              <h3 className="text-sm sm:text-base font-black uppercase text-white font-mono tracking-wider">
                Editar Tarefa Operacional
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Altere coluna de destino, executores responsáveis, prazos e notas
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
              Descrição da Tarefa *
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
              Coluna / Demanda de Destino
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
                A tarefa será transferida de &ldquo;{currentColumn?.titulo}&rdquo; para a demanda selecionada ao salvar.
              </p>
            )}
          </div>

          {/* MÚLTIPLOS RESPONSÁVEIS PELA AÇÃO HUMANA */}
          <div className="bg-[#050811] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Users size={14} className="text-rose-400" />
                Usuários Responsáveis ({selectedResponsaveis.length})
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Permite múltiplos executores</span>
            </div>

            {/* CHIPS DOS RESPONSÁVEIS SELECIONADOS */}
            <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] p-2 rounded-lg bg-[#090e1a] border border-slate-700/80">
              {selectedResponsaveis.length === 0 ? (
                <span className="text-xs text-slate-500 italic">Nenhum responsável atribuído (clique nos atalhos abaixo ou adicione)</span>
              ) : (
                selectedResponsaveis.map((resp) => {
                  const respColor = getResponsibleColor(resp);
                  return (
                    <span
                      key={resp}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase shadow-sm border ${respColor.badgeClass}`}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: respColor.hex }} />
                      <span>{resp}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveResp(resp)}
                        className="opacity-70 hover:opacity-100 rounded p-0.5 transition-opacity"
                        title={`Remover ${resp}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  );
                })
              )}
            </div>

            {/* INPUT PARA DIGITAR E ADICIONAR NOVO RESPONSÁVEL */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                list="modal-resp-suggestions"
                value={customRespInput}
                onChange={(e) => setCustomRespInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomResp();
                  }
                }}
                placeholder="Digitar outro responsável e pressionar Adicionar..."
                className="flex-1 bg-[#090e1a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400 uppercase font-mono"
              />
              <button
                type="button"
                onClick={handleAddCustomResp}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 text-xs font-bold font-mono transition-colors"
              >
                <Plus size={12} />
                <span>Adicionar</span>
              </button>
            </div>

            {/* PÍLULAS DE ATALHO RÁPIDO (TOGGLE) COM CORES OFICIAIS */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 font-mono">Atalhos rápidos:</span>
              {quickResponsibles.map((r) => {
                const isSelected = selectedResponsaveis.includes(r);
                const respColor = getResponsibleColor(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleToggleResp(r)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 shadow-sm ${
                      isSelected
                        ? respColor.pillActiveClass
                        : `${respColor.pillInactiveClass} hover:opacity-100`
                    }`}
                    title={isSelected ? `Clique para remover ${r}` : `Clique para adicionar ${r}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: respColor.hex }} />
                    <span>{isSelected ? '✓' : '+'}</span>
                    <span>{r}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DATA LIMITE (PRAZO) COM SINALIZAÇÃO SEMÂNTICA POR CORES */}
          <div className="bg-[#050811] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Calendar size={14} className="text-cyan-400" />
                Data Limite da Tarefa (Prazo)
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
