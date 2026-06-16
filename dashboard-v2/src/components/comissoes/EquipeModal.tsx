"use client";

import { useState, useEffect } from "react";
import { Membro } from "@/types/comissoes";
import { X, Search, Loader2, Percent, AlertCircle } from "lucide-react";
import { ComissoesService } from "@/services/comissoes.service";

interface EquipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipe: Membro[];
  onToggle: (id: string, ativo: boolean) => Promise<void>;
  onEnableEmployee: (employeeId: string, name: string, pctPadrao: number) => Promise<void>;
  onUpdateMembroPercent: (id: string, pctPadrao: number) => Promise<void>;
}

export function EquipeModal({
  isOpen,
  onClose,
  equipe,
  onToggle,
  onEnableEmployee,
  onUpdateMembroPercent
}: EquipeModalProps) {
  const [globalEmployees, setGlobalEmployees] = useState<{ id: string; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Controle de loading por ID de ação
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Armazena valores de porcentagem em edição local (membro_id ou employee_id -> string)
  const [localPercentages, setLocalPercentages] = useState<Record<string, string>>({});

  // Carrega colaboradores do People Board
  useEffect(() => {
    if (!isOpen) return;
    
    async function loadGlobalEmployees() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await ComissoesService.getGlobalEmployees();
        setGlobalEmployees(data);
      } catch (err) {
        const msg = (err as { message?: string })?.message || "Erro ao carregar colaboradores do People Board.";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    }

    loadGlobalEmployees();
  }, [isOpen]);

  // Inicializa inputs locais de porcentagem baseando-se na equipe existente
  useEffect(() => {
    const percentages: Record<string, string> = {};
    equipe.forEach(m => {
      percentages[m.id] = (m.pct_padrao * 100).toString();
    });
    setLocalPercentages(prev => ({ ...prev, ...percentages }));
  }, [equipe]);

  if (!isOpen) return null;

  // Filtra a lista de colaboradores pelo termo de busca
  const filteredEmployees = globalEmployees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleCheckbox = async (emp: { id: string; name: string }, member?: Membro) => {
    setActionLoadingId(emp.id);
    try {
      if (member) {
        // Já está na equipe, apenas inverte a ativação
        await onToggle(member.id, !member.ativo);
      } else {
        // Não está na equipe, cria um novo comissão com o percentual padrão ou digitado
        const localPct = localPercentages[emp.id] || "0.35";
        const pctDecimal = parseFloat(localPct) / 100;
        await onEnableEmployee(emp.id, emp.name, isNaN(pctDecimal) ? 0.0035 : pctDecimal);
      }
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Erro desconhecido";
      alert(`Erro: ${msg}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePercentBlur = async (id: string, isEmployeeId: boolean, originalValDecimal: number) => {
    const valStr = localPercentages[id];
    const valDecimal = parseFloat(valStr) / 100;

    if (isNaN(valDecimal) || valDecimal < 0) {
      // Reverte para o original em caso de valor inválido
      setLocalPercentages(prev => ({ ...prev, [id]: (originalValDecimal * 100).toString() }));
      return;
    }

    // Se o valor de fato mudou e já é um membro da equipe
    if (valDecimal !== originalValDecimal && !isEmployeeId) {
      setActionLoadingId(id);
      try {
        await onUpdateMembroPercent(id, valDecimal);
      } catch (err) {
        const msg = (err as { message?: string })?.message || "Erro ao atualizar percentual";
        alert(`Erro ao atualizar percentual: ${msg}`);
        setLocalPercentages(prev => ({ ...prev, [id]: (originalValDecimal * 100).toString() }));
      } finally {
        setActionLoadingId(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Habilitar Comissão de Equipe</h2>
            <p className="text-xs font-semibold text-slate-400 mt-1">Busque colaboradores do People Board e ative suas comissões padrão.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar colaborador no People Board..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-700"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
              <Loader2 size={24} className="animate-spin text-amber-500" />
              <p className="text-xs font-bold">Carregando banco de colaboradores...</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-12">
              Nenhum colaborador ativo encontrado para a busca.
            </p>
          ) : (
            filteredEmployees.map(emp => {
              // Verifica se já existe vínculo na equipe
              const member = equipe.find(
                m => m.employee_id === emp.id || m.nome.toLowerCase() === emp.name.toLowerCase()
              );

              const isChecked = !!(member && member.ativo);
              const isPendingActivation = actionLoadingId === emp.id;

              // Identificador para input local
              const inputId = member ? member.id : emp.id;
              const currentPercentStr = localPercentages[inputId] ?? (member ? (member.pct_padrao * 100).toString() : "0.35");

              return (
                <div 
                  key={emp.id} 
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                    isChecked 
                      ? "border-amber-200 bg-amber-50/20 shadow-sm" 
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`emp-${emp.id}`}
                      checked={isChecked}
                      disabled={isPendingActivation}
                      onChange={() => handleToggleCheckbox(emp, member)}
                      className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500 cursor-pointer disabled:opacity-50"
                    />
                    <label 
                      htmlFor={`emp-${emp.id}`} 
                      className={`text-xs font-black uppercase tracking-tight cursor-pointer ${
                        isChecked ? "text-slate-800" : "text-slate-500"
                      }`}
                    >
                      {emp.name}
                    </label>
                  </div>

                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        className={`w-20 pl-2 pr-6 py-1.5 border rounded-lg text-xs font-black text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all ${
                          isChecked 
                            ? "bg-white border-amber-300 text-slate-800" 
                            : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                        }`}
                        disabled={!isChecked || isPendingActivation}
                        value={currentPercentStr}
                        onChange={e => setLocalPercentages(prev => ({ ...prev, [inputId]: e.target.value }))}
                        onBlur={() => handlePercentBlur(inputId, !member, member ? member.pct_padrao : 0.0035)}
                        placeholder="0.35"
                      />
                      <Percent size={11} className="absolute right-2 text-slate-400" />
                    </div>

                    {isPendingActivation && (
                      <Loader2 size={14} className="animate-spin text-amber-500 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-900 transition-all shadow-sm"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
