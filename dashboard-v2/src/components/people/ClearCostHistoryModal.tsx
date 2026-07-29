import React, { useState, useMemo } from 'react';
import { X, Trash2, Calendar, AlertTriangle, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { PeopleHRService } from '@/services/people-hr.service';

interface ClearCostHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId?: string;
  employeeName?: string;
  availableCompetencias?: string[];
  onSuccess: () => void;
}

export function ClearCostHistoryModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  availableCompetencias = [],
  onSuccess,
}: ClearCostHistoryModalProps) {
  const [rangeMode, setRangeMode] = useState<'all' | 'custom'>('all');
  const [startComp, setStartComp] = useState<string>('');
  const [endComp, setEndComp] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Competências ordenadas
  const sortedComps = useMemo(() => {
    return [...availableCompetencias].sort();
  }, [availableCompetencias]);

  if (!isOpen) return null;

  const getLastDayOfMonth = (compStr: string): string => {
    const clean = compStr.trim();
    const parts = clean.split('-');
    if (parts.length < 2) return clean;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return clean;
    const lastDay = new Date(year, month, 0).getDate();
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  };

  const handleClearHistory = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      let fromComp: string | undefined = undefined;
      let toComp: string | undefined = undefined;

      if (rangeMode === 'custom') {
        if (startComp) {
          const parts = startComp.split('-');
          fromComp = `${parts[0]}-${parts[1].padStart(2, '0')}-01`;
        }
        if (endComp) {
          toComp = getLastDayOfMonth(endComp);
        }
      }

      const deletedCount = await PeopleHRService.deleteMonthlyCostsByPeriod(
        employeeId,
        fromComp,
        toComp
      );

      setSuccessMsg(`${deletedCount} registro(s) de custo histórico foram excluídos com sucesso.`);
      setIsDeleting(false);

      setTimeout(() => {
        setSuccessMsg(null);
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Erro ao excluir histórico de custos:', err);
      setError(err.message || 'Falha ao excluir histórico de custos.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transition-all">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shadow-inner">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Limpar Custo Histórico
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {employeeName ? `Colaborador: ${employeeName}` : 'Exclusão global por período'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg ? (
            <div className="py-8 text-center flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Exclusão Concluída!</h4>
              <p className="text-xs text-slate-500">{successMsg}</p>
            </div>
          ) : (
            <>
              {/* Seleção do Âmbito do Período */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Período para Limpeza
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRangeMode('all')}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                      rangeMode === 'all'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 font-bold ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <Trash2 size={16} className="mt-0.5 shrink-0 text-rose-500" />
                    <div>
                      <div className="text-xs font-bold">Todo o Histórico</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                        Exclui todas as competências registradas
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRangeMode('custom')}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                      rangeMode === 'custom'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 font-bold ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <Calendar size={16} className="mt-0.5 shrink-0 text-rose-500" />
                    <div>
                      <div className="text-xs font-bold">Período Específico</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                        Selecionar intervalo de competências
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Formulário de Seleção de Competências quando 'custom' */}
              {rangeMode === 'custom' && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        De (Competência Inicial)
                      </label>
                      {sortedComps.length > 0 ? (
                        <select
                          value={startComp}
                          onChange={e => setStartComp(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs py-2 px-3 outline-none focus:border-rose-500 font-semibold"
                        >
                          <option value="">Selecione a inicial...</option>
                          {sortedComps.map(c => (
                            <option key={c} value={c}>
                              {c.substring(0, 7)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="month"
                          value={startComp}
                          onChange={e => setStartComp(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs py-2 px-3 outline-none focus:border-rose-500 font-semibold"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        Até (Competência Final)
                      </label>
                      {sortedComps.length > 0 ? (
                        <select
                          value={endComp}
                          onChange={e => setEndComp(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs py-2 px-3 outline-none focus:border-rose-500 font-semibold"
                        >
                          <option value="">Selecione a final...</option>
                          {sortedComps.map(c => (
                            <option key={c} value={c}>
                              {c.substring(0, 7)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="month"
                          value={endComp}
                          onChange={e => setEndComp(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs py-2 px-3 outline-none focus:border-rose-500 font-semibold"
                        />
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    Serão excluídos todos os custos mensais entre a competência inicial e final selecionadas.
                  </p>
                </div>
              )}

              {/* Aviso de Confirmação Obrigatório */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
                <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-bold block mb-0.5">Atenção: Ação Irreversível</span>
                  Esta ação excluirá permanentemente os lançamentos de custos mensais selecionados do banco de dados.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!successMsg && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleClearHistory}
              disabled={isDeleting}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white transition-all shadow-md shadow-rose-600/20 flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 size={15} />
                  <span>Confirmar e Limpar Histórico</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
