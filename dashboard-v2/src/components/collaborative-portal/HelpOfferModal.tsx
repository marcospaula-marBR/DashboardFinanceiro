"use client";

import React, { useState } from 'react';
import { 
  X, 
  HandHeart, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  User, 
  Send,
  ShieldCheck
} from 'lucide-react';
import { CollaborativeActivity } from '@/types/collaborative-portal';

interface HelpOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: CollaborativeActivity | null;
  currentMemberName: string;
  currentProfileId?: string;
  onSubmitOffer: (notes?: string) => Promise<{ success: boolean; message: string }>;
}

export function HelpOfferModal({
  isOpen,
  onClose,
  activity,
  currentMemberName,
  onSubmitOffer,
}: HelpOfferModalProps) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen || !activity) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await onSubmitOffer(notes.trim() || undefined);
      setFeedback(res);
      if (res.success) {
        setTimeout(() => {
          onClose();
          setNotes('');
          setFeedback(null);
        }, 1500);
      }
    } catch {
      setFeedback({ success: false, message: 'Falha ao registrar oferta de ajuda. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  const primaryOwner = activity.responsaveis[0] || 'EQUIPE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#090e1a] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#060a13]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <HandHeart size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-white font-mono tracking-wide">
                🤝 Oferecer Ajuda
              </h2>
              <p className="text-[11px] text-slate-400">
                Colaboração Operacional — Mar Brasil
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* DETALHES DA ATIVIDADE */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {activity.origemTitulo}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${activity.prazoInfo.badgeClass}`}>
                {activity.prazoInfo.rotulo}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">
              {activity.titulo}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-300 pt-1 border-t border-slate-800/60">
              <User size={13} className="text-cyan-400" />
              <span>Responsável Atual: <strong className="text-white">{primaryOwner}</strong></span>
            </div>
          </div>

          {/* COLABORADOR OFERTANTE */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-slate-300">Oferecendo ajuda como:</span>
            </div>
            <span className="text-xs font-black text-emerald-300 font-mono uppercase">
              {currentMemberName}
            </span>
          </div>

          {/* OBSERVAÇÃO OPCIONAL */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Observação ou Proposta de Apoio (Opcional):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Tenho disponibilidade para adiantar o levantamento dos documentos amanhã de manhã..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* ALERTA DE REGRAS OPERACIONAIS */}
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex gap-2.5 text-[11px] text-amber-200/90 leading-relaxed">
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Como funciona:</strong> Sua oferta será registrada e notificada ao administrador e a <strong>{primaryOwner}</strong>. A atribuição da tarefa não muda automaticamente; o gestor decidirá sobre o apoio ou redistribuição.
            </div>
          </div>

          {/* FEEDBACK DE SUCESSO OU ERRO */}
          {feedback && (
            <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
              feedback.success
                ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-300'
                : 'bg-rose-950/50 border-rose-500/60 text-rose-300'
            }`}>
              {feedback.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* BOTÕES DE AÇÃO */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 transition-colors min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-95 transition-all shadow-lg shadow-emerald-950/50 min-h-[44px]"
            >
              {submitting ? (
                <span>Registrando...</span>
              ) : (
                <>
                  <Send size={14} />
                  <span>Confirmar Oferta de Ajuda</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
