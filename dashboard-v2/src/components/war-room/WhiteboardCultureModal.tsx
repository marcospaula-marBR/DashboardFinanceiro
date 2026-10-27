"use client";

import React, { useState, useEffect } from 'react';
import { WhiteboardCultureMessages, WhiteboardDepartment } from '@/types/war-room';
import { getDefaultCultureMessages } from '@/services/war-room.service';
import { 
  X, 
  Save, 
  RotateCcw, 
  Sparkles, 
  Building2, 
  Quote, 
  CheckCircle2, 
  Info 
} from 'lucide-react';

interface WhiteboardCultureModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: WhiteboardDepartment;
  currentMessages?: WhiteboardCultureMessages;
  onSave: (messages: WhiteboardCultureMessages) => void;
}

export function WhiteboardCultureModal({
  isOpen,
  onClose,
  department,
  currentMessages,
  onSave,
}: WhiteboardCultureModalProps) {
  const defaultMessages = getDefaultCultureMessages(department?.slug || 'financeiro', department?.name);

  const [esquerdoFrase, setEsquerdoFrase] = useState('');
  const [esquerdoTag, setEsquerdoTag] = useState('');
  const [direitoFrase, setDireitoFrase] = useState('');
  const [direitoTag, setDireitoTag] = useState('');

  useEffect(() => {
    if (isOpen) {
      const initial = currentMessages || defaultMessages;
      setEsquerdoFrase(initial.sloganEsquerdo?.frase || defaultMessages.sloganEsquerdo?.frase || '');
      setEsquerdoTag(initial.sloganEsquerdo?.tag || defaultMessages.sloganEsquerdo?.tag || '');
      setDireitoFrase(initial.sloganDireito?.frase || defaultMessages.sloganDireito?.frase || '');
      setDireitoTag(initial.sloganDireito?.tag || defaultMessages.sloganDireito?.tag || '');
    }
  }, [isOpen, currentMessages, department?.slug]);

  if (!isOpen) return null;

  const handleRestoreDefaults = () => {
    setEsquerdoFrase(defaultMessages.sloganEsquerdo?.frase || '');
    setEsquerdoTag(defaultMessages.sloganEsquerdo?.tag || '');
    setDireitoFrase(defaultMessages.sloganDireito?.frase || '');
    setDireitoTag(defaultMessages.sloganDireito?.tag || '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: WhiteboardCultureMessages = {
      sloganEsquerdo: {
        frase: esquerdoFrase.trim().toUpperCase() || defaultMessages.sloganEsquerdo?.frase || 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!',
        tag: esquerdoTag.trim().toUpperCase() || defaultMessages.sloganEsquerdo?.tag || 'MANUAL CULTURA MAR BRASIL',
      },
      sloganDireito: {
        frase: direitoFrase.trim().toUpperCase() || defaultMessages.sloganDireito?.frase || 'FOCO, COMPROMISSO E EXCELÊNCIA!',
        tag: direitoTag.trim().toUpperCase() || defaultMessages.sloganDireito?.tag || `MANUAL DE CULTURA ${(department?.badge_label || department?.slug || 'GERAL').toUpperCase()}`,
      },
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-[#090e1d] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Quote size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-wide uppercase flex items-center gap-2">
                <span>Mensagens de Cultura da Lousa</span>
                <span 
                  className="text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider uppercase border"
                  style={{
                    backgroundColor: `${department.color_hex}15`,
                    borderColor: `${department.color_hex}40`,
                    color: department.color_hex,
                  }}
                >
                  {department.badge_label || department.slug.toUpperCase()}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Personalize os slogans e mensagens culturais exibidos na Lousa de <strong className="text-slate-200">{department.name}</strong>.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO COM PREVIEW AO VIVO */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* PRÉ-VISUALIZAÇÃO AO VIVO DOS SLOGANS */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase font-bold">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Sparkles size={13} />
                <span>Pré-visualização ao vivo no Cabeçalho:</span>
              </span>
              <span className="text-slate-500 text-[10px]">Visão Superior da Lousa</span>
            </div>

            <div className="p-3 rounded-lg bg-[#070c18] border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              {/* PREVIEW ESQUERDO */}
              <div className="flex items-center gap-2 w-full sm:w-1/2">
                <div className="w-1.5 h-6 bg-cyan-500 rounded-full flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-black tracking-wide text-white uppercase truncate">
                    {esquerdoFrase || 'PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!'}
                  </div>
                  <span className="inline-block text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 uppercase mt-0.5">
                    {esquerdoTag || 'MANUAL CULTURA MAR BRASIL'}
                  </span>
                </div>
              </div>

              <div className="hidden sm:block h-8 w-px bg-slate-800" />

              {/* PREVIEW DIREITO */}
              <div className="flex items-center gap-2 w-full sm:w-1/2 justify-end text-right">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-black tracking-wide text-white uppercase truncate">
                    {direitoFrase || 'FOCO, COMPROMISSO E EXCELÊNCIA!'}
                  </div>
                  <span className="inline-block text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 uppercase mt-0.5">
                    {direitoTag || `MANUAL DE CULTURA ${department.badge_label}`}
                  </span>
                </div>
                <div className="w-1.5 h-6 bg-amber-500 rounded-full flex-shrink-0" />
              </div>
            </div>
          </div>

          {/* BLOCO 1: SLOGAN ESQUERDO (INSTITUCIONAL / PROPÓSITO) */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>1. Slogan Esquerdo (Cultura Corporativa / Propósito Geral)</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Exibido à esquerda</span>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Frase de Efeito / Mantra:
                </label>
                <input
                  type="text"
                  value={esquerdoFrase}
                  onChange={(e) => setEsquerdoFrase(e.target.value)}
                  placeholder="Ex: PESSOAS, TÉCNICA E PROPÓSITO EM CADA ENTREGA!"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs sm:text-sm focus:border-cyan-400 focus:outline-none min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Tag / Rótulo de Identificação:
                </label>
                <input
                  type="text"
                  value={esquerdoTag}
                  onChange={(e) => setEsquerdoTag(e.target.value)}
                  placeholder="Ex: MANUAL CULTURA MAR BRASIL"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs sm:text-sm focus:border-cyan-400 focus:outline-none min-h-[44px]"
                  required
                />
              </div>
            </div>
          </div>

          {/* BLOCO 2: SLOGAN DIREITO (CULTURA DO SETOR) */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>2. Slogan Direito (Cultura Específica deste Departamento)</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Exibido à direita</span>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Frase de Efeito / Mantra do Setor:
                </label>
                <input
                  type="text"
                  value={direitoFrase}
                  onChange={(e) => setDireitoFrase(e.target.value)}
                  placeholder="Ex: PAGAR CERTO, FATURAR CERTO, FECHAR CERTO!"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs sm:text-sm focus:border-amber-400 focus:outline-none min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Tag / Rótulo do Manual do Setor:
                </label>
                <input
                  type="text"
                  value={direitoTag}
                  onChange={(e) => setDireitoTag(e.target.value)}
                  placeholder={`Ex: MANUAL DE CULTURA ${department.badge_label}`}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs sm:text-sm focus:border-amber-400 focus:outline-none min-h-[44px]"
                  required
                />
              </div>
            </div>
          </div>

          {/* INFORMATIVO EXECUTIVO */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-400">
            <Info size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <p>
              Cada departamento possui autonomia completa para definir e alterar suas mensagens. As alterações são sincronizadas imediatamente com o Supabase e mantidas no cache local de todos que visualizam o setor <strong className="text-slate-200">{department.name}</strong>.
            </p>
          </div>

          {/* BOTÃO PARA RESTAURAR PADRÃO DO SETOR */}
          <div className="flex justify-start">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all min-h-[36px]"
              title="Restaurar os slogans recomendados para este setor"
            >
              <RotateCcw size={13} className="text-amber-400" />
              <span>Restaurar Slogans Recomendados do Setor</span>
            </button>
          </div>

          {/* AÇÕES DE RODAPÉ */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-all min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-all shadow-md shadow-cyan-950 min-h-[44px]"
            >
              <Save size={14} />
              <span>Salvar Mensagens</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
