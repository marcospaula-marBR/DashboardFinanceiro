"use client";

import React, { useState } from 'react';
import { WhiteboardColumn, WhiteboardTimelineBlock, FollowTheMoneyRow } from '@/types/war-room';
import { X, Plus, Calendar, DollarSign, CheckSquare } from 'lucide-react';

interface WhiteboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'demanda' | 'cambio' | 'cronograma';
  colunas: WhiteboardColumn[];
  cronograma: WhiteboardTimelineBlock[];
  onAddDemanda: (columnId: string, texto: string) => void;
  onAddCambio: (row: Omit<FollowTheMoneyRow, 'id'>) => void;
  onAddCronograma: (blockId: string, dia: number, descricao: string) => void;
}

export function WhiteboardModal({
  isOpen,
  onClose,
  defaultTab = 'demanda',
  colunas,
  cronograma,
  onAddDemanda,
  onAddCambio,
  onAddCronograma,
}: WhiteboardModalProps) {
  const [activeTab, setActiveTab] = useState<'demanda' | 'cambio' | 'cronograma'>(defaultTab);

  // Estados Demanda
  const [selectedColId, setSelectedColId] = useState(colunas[0]?.id || 'col-1');
  const [demandaTexto, setDemandaTexto] = useState('');

  // Estados Câmbio
  const [cambioData, setCambioData] = useState({
    data: '',
    de: '',
    para: '',
    formato: 'MOEDA',
    moeda: 'USD',
    valor: '',
    diferenca: '—',
    percentual: '—',
  });

  // Estados Cronograma
  const [selectedBlockId, setSelectedBlockId] = useState(cronograma[0]?.id || 'blk-1');
  const [cronogramaDia, setCronogramaDia] = useState(5);
  const [cronogramaDesc, setCronogramaDesc] = useState('');

  if (!isOpen) return null;

  const handleSubmitDemanda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demandaTexto.trim()) return;
    onAddDemanda(selectedColId, demandaTexto.trim());
    setDemandaTexto('');
    onClose();
  };

  const handleSubmitCambio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cambioData.de || !cambioData.para) return;
    onAddCambio({
      data: cambioData.data || '—',
      de: cambioData.de.toUpperCase(),
      para: cambioData.para.toUpperCase(),
      formato: cambioData.formato.toUpperCase(),
      moeda: cambioData.moeda.toUpperCase(),
      valor: cambioData.valor || '—',
      diferenca: cambioData.diferenca || '—',
      percentual: cambioData.percentual || '—',
    });
    setCambioData({
      data: '',
      de: '',
      para: '',
      formato: 'MOEDA',
      moeda: 'USD',
      valor: '',
      diferenca: '—',
      percentual: '—',
    });
    onClose();
  };

  const handleSubmitCronograma = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cronogramaDesc.trim()) return;
    onAddCronograma(selectedBlockId, cronogramaDia, cronogramaDesc.trim());
    setCronogramaDesc('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-[#0b1120] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#070c18]">
          <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <span>GESTÃO RÁPIDA DA LOUSA</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ABAS */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1">
          <button
            onClick={() => setActiveTab('demanda')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'demanda'
                ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckSquare size={13} />
            <span>Nova Demanda</span>
          </button>

          <button
            onClick={() => setActiveTab('cambio')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'cambio'
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign size={13} />
            <span>Linha Câmbio</span>
          </button>

          <button
            onClick={() => setActiveTab('cronograma')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'cronograma'
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar size={13} />
            <span>Vencimento</span>
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <div className="p-5">
          {/* ABA 1: DEMANDA */}
          {activeTab === 'demanda' && (
            <form onSubmit={handleSubmitDemanda} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Coluna de Destino:
                </label>
                <select
                  value={selectedColId}
                  onChange={(e) => setSelectedColId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {colunas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Texto da Demanda:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex: JUSTIFICAR DEPÓSITOS CONTA PESSOAL..."
                  value={demandaTexto}
                  onChange={(e) => setDemandaTexto(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30"
                >
                  Adicionar à Lousa
                </button>
              </div>
            </form>
          )}

          {/* ABA 2: CÂMBIO */}
          {activeTab === 'cambio' && (
            <form onSubmit={handleSubmitCambio} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Data (ex: 23/09):
                  </label>
                  <input
                    type="text"
                    value={cambioData.data}
                    onChange={(e) => setCambioData({ ...cambioData, data: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                    placeholder="23/09"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Formato:
                  </label>
                  <select
                    value={cambioData.formato}
                    onChange={(e) => setCambioData({ ...cambioData, formato: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  >
                    <option value="MOEDA">MOEDA</option>
                    <option value="CC">CC (Cartão)</option>
                    <option value="TED">TED / PIX</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    De (Origem):
                  </label>
                  <input
                    type="text"
                    required
                    value={cambioData.de}
                    onChange={(e) => setCambioData({ ...cambioData, de: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono"
                    placeholder="MARBR"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Para (Destino):
                  </label>
                  <input
                    type="text"
                    required
                    value={cambioData.para}
                    onChange={(e) => setCambioData({ ...cambioData, para: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono"
                    placeholder="DLOCAL-G2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Moeda:
                  </label>
                  <select
                    value={cambioData.moeda}
                    onChange={(e) => setCambioData({ ...cambioData, moeda: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="G$">G$ (Guaranis)</option>
                    <option value="BRL">BRL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Valor:
                  </label>
                  <input
                    type="text"
                    value={cambioData.valor}
                    onChange={(e) => setCambioData({ ...cambioData, valor: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                    placeholder="9,99"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Taxa (%):
                  </label>
                  <input
                    type="text"
                    value={cambioData.percentual}
                    onChange={(e) => setCambioData({ ...cambioData, percentual: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                    placeholder="3,5%"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
                >
                  Adicionar ao Fluxo
                </button>
              </div>
            </form>
          )}

          {/* ABA 3: CRONOGRAMA */}
          {activeTab === 'cronograma' && (
            <form onSubmit={handleSubmitCronograma} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Bloco do Cronograma:
                </label>
                <select
                  value={selectedBlockId}
                  onChange={(e) => setSelectedBlockId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {cronograma.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.intervalo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Dia do Vencimento:
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  required
                  value={cronogramaDia}
                  onChange={(e) => setCronogramaDia(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Descrição (ex: 10 - DZM 6827):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 10 - DZM 6827..."
                  value={cronogramaDesc}
                  onChange={(e) => setCronogramaDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30"
                >
                  Salvar Vencimento
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
