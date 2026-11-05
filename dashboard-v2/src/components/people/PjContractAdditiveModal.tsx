"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  X, 
  FileText, 
  CheckCircle2, 
  Download, 
  ExternalLink, 
  AlertCircle, 
  Calendar, 
  Coins, 
  Briefcase, 
  Clock, 
  ArrowRight, 
  ChevronLeft, 
  Building2, 
  User, 
  Copy, 
  Save, 
  Loader2,
  Sparkles,
  Check
} from "lucide-react";
import { Employee, formatPjRole } from "@/types/loans";
import { PjAdditiveService, PjAdditiveParams, valorPorExtenso } from "@/services/pj-additive.service";
import { formatCurrency } from "@/services/loans.service";

interface PjContractAdditiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Partial<Employee>;
  previousRemuneration?: number;
  newRemuneration?: number;
  previousRole?: string;
  newRole?: string;
  onSaveWithoutAdditive: () => void;
  onConfirmAdditive: (result: {
    startDate: string;
    vigencia: string;
    additionalNotes?: string;
    newRemuneration: number;
    newRole: string;
  }) => Promise<void>;
}

export function PjContractAdditiveModal({
  isOpen,
  onClose,
  employee,
  previousRemuneration = 0,
  newRemuneration = 0,
  previousRole = "",
  newRole = "",
  onSaveWithoutAdditive,
  onConfirmAdditive,
}: PjContractAdditiveModalProps) {
  // Passos: 0 = Pergunta inicial (se quer aditivo), 1 = Coleta de Condições, 2 = Validação Prévia, 3 = Conclusão / ZapSign
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  // Campos do formulário
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [vigenciaMode, setVigenciaMode] = useState<"indeterminado" | "12m" | "6m" | "custom">("indeterminado");
  const [customVigenciaDate, setCustomVigenciaDate] = useState<string>("");
  const [additionalNotes, setAdditionalNotes] = useState<string>("");
  const [amount, setAmount] = useState<number>(newRemuneration || employee.remuneration_fixed || employee.remuneration || 0);
  const [role, setRole] = useState<string>(newRole || employee.job_role || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopiedZapSign, setIsCopiedZapSign] = useState(false);

  // Sincroniza o estado interno sempre que o modal abre ou os dados recebidos mudam
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setAmount(newRemuneration || employee.remuneration_fixed || employee.remuneration || 0);
      setRole(newRole || employee.job_role || "");
      setStartDate(new Date().toISOString().split("T")[0]);
      setVigenciaMode("indeterminado");
      setCustomVigenciaDate("");
      setAdditionalNotes("");
      setIsCopiedZapSign(false);
    }
  }, [isOpen, newRemuneration, newRole, employee]);

  // Vigência calculada
  const calculatedVigencia = useMemo(() => {
    if (vigenciaMode === "indeterminado") return "Prazo Indeterminado";
    if (vigenciaMode === "12m") return "12 (doze) meses a contar da data de início";
    if (vigenciaMode === "6m") return "6 (seis) meses a contar da data de início";
    if (vigenciaMode === "custom" && customVigenciaDate) {
      const [y, m, d] = customVigenciaDate.split("-");
      return `Até ${d}/${m}/${y}`;
    }
    return "Prazo Indeterminado";
  }, [vigenciaMode, customVigenciaDate]);

  // Parâmetros para draft e PDF
  const additiveParams: PjAdditiveParams = useMemo(() => {
    return {
      employee,
      previousRemuneration,
      newRemuneration: amount,
      previousRole,
      newRole: role,
      startDate,
      vigencia: calculatedVigencia,
      additionalNotes,
      companyName: employee.company,
    };
  }, [employee, previousRemuneration, amount, previousRole, role, startDate, calculatedVigencia, additionalNotes]);

  // Rascunho das cláusulas para a pré-visualização
  const draft = useMemo(() => {
    return PjAdditiveService.getAdditiveDraft(additiveParams);
  }, [additiveParams]);

  if (!isOpen) return null;

  // Dispara o download do PDF oficial timbrado
  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    try {
      const doc = await PjAdditiveService.generatePjAdditivePDF(additiveParams);
      const safeName = (employee.corporate_name || employee.name || "PJ")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 30);
      doc.save(`Termo_Aditivo_PJ_${safeName}_${startDate}.pdf`);
    } catch (err: any) {
      alert("Erro ao gerar PDF: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Validação e confirmação final
  const handleValidateAndConfirm = async () => {
    setIsGenerating(true);
    try {
      // 1. Gera o PDF e faz o download imediato
      const doc = await PjAdditiveService.generatePjAdditivePDF(additiveParams);
      const safeName = (employee.corporate_name || employee.name || "PJ")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 30);
      doc.save(`Termo_Aditivo_PJ_${safeName}_${startDate}.pdf`);

      // 2. Chama callback para salvar dados no prontuário, atualizar links_aditivos e histórico
      await onConfirmAdditive({
        startDate,
        vigencia: calculatedVigencia,
        additionalNotes,
        newRemuneration: amount,
        newRole: role,
      });

      // 3. Avança para a tela de instruções ZapSign
      setStep(3);
    } catch (err: any) {
      alert("Erro ao validar e emitir aditivo: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyZapSignInfo = () => {
    const text = `CONTRATANTE: ${draft.companyCreditor.corporateName} (CNPJ: ${draft.companyCreditor.cnpj})
Representante: ${draft.companyCreditor.representativeName} (${draft.companyCreditor.representativeCpf})
CONTRATADA: ${draft.pjName} (CNPJ: ${draft.pjCnpj})
Representante PJ: ${draft.repName} (CPF: ${draft.repCpf})
E-mail: ${employee.email_professional || employee.email || "---"}
WhatsApp: ${employee.phone_professional || employee.phone || "---"}
Novo Valor Mensal: R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
Novo Escopo: ${formatPjRole(role)}
Início das Condições: ${draft.startDateBr}
Vigência: ${calculatedVigencia}`;

    navigator.clipboard.writeText(text);
    setIsCopiedZapSign(true);
    setTimeout(() => setIsCopiedZapSign(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* HEADER EXECUTIVO */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-600/20">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Termo Aditivo de Contrato PJ / MEI
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  ZapSign
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {employee.corporate_name || employee.name} • {employee.company || "Empresa do Grupo"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* PROGRESSO DE ETAPAS */}
        <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${step >= 0 ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600"}`}>
              {step > 0 ? "✓" : "1"}
            </span>
            <span className={`font-bold ${step === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>Decisão</span>
            
            <span className="text-slate-300 dark:text-slate-700">/</span>
            
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${step >= 1 ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600"}`}>
              {step > 1 ? "✓" : "2"}
            </span>
            <span className={`font-bold ${step === 1 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>Condições</span>
            
            <span className="text-slate-300 dark:text-slate-700">/</span>
            
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${step >= 2 ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600"}`}>
              {step > 2 ? "✓" : "3"}
            </span>
            <span className={`font-bold ${step === 2 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>Validação Prévia</span>
            
            <span className="text-slate-300 dark:text-slate-700">/</span>
            
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${step >= 3 ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600"}`}>
              4
            </span>
            <span className={`font-bold ${step === 3 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>ZapSign & SLA</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
            <Clock size={12} />
            <span>SLA: 5 dias para assinatura</span>
          </div>
        </div>

        {/* CORPO DO MODAL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ===================== PASSO 0: PERGUNTA INICIAL ===================== */}
          {step === 0 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-start gap-3.5">
                <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
                  <Sparkles size={18} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
                    Alteração Cadastral PJ Detectada
                  </h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                    Identificamos alterações de condições cadastrais para este prestador de serviços. Como nem toda alteração exige aditivo contratual, informe se deseja gerar formalmente um novo <strong>Termo Aditivo PJ para assinaturas no ZapSign</strong> ou apenas salvar os dados no cadastro.
                  </p>
                </div>
              </div>

              {/* Comparativo Rápido do que mudou */}
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
                  Resumo das Condições Atualizadas
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase">Honorários Mensais (PJ)</span>
                    <div className="flex items-center gap-2">
                      {previousRemuneration > 0 && previousRemuneration !== amount && (
                        <>
                          <span className="text-xs text-slate-400 line-through">
                            {formatCurrency(previousRemuneration)}
                          </span>
                          <ArrowRight size={12} className="text-slate-400" />
                        </>
                      )}
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase">Escopo de Atuação</span>
                    <div className="flex items-center gap-2">
                      {previousRole && previousRole !== role && (
                        <>
                          <span className="text-xs text-slate-400 line-through truncate max-w-[120px]">
                            {previousRole}
                          </span>
                          <ArrowRight size={12} className="text-slate-400" />
                        </>
                      )}
                      <span className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">
                        {role || formatPjRole(role) || "Prestador de Serviços"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explicação de Fluxo e Ações de Decisão */}
              <div className="space-y-3 pt-2">
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                  <FileText size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Como funciona o fluxo:</strong> Ao clicar em <em>Avançar para Visualização da Minuta</em>, o sistema <strong>NÃO</strong> salvará o contrato imediatamente. Você definirá vigência no <strong>Passo 2</strong> e terá a <strong>visualização integral do documento timbrado no Passo 3</strong> para validar todos os dados antes de aprovar.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onSaveWithoutAdditive}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold uppercase tracking-wider transition-all"
                    title="Salvar apenas os dados alterados no cadastro do colaborador sem gerar documento de aditivo"
                  >
                    Não, Apenas Salvar Cadastro
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
                    title="Avançar para definir vigência e validar a minuta timbrada antes de salvar"
                  >
                    <span>Sim, Avançar para Visualização da Minuta</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===================== PASSO 1: CONDIÇÕES DO ADITIVO ===================== */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar size={15} className="text-emerald-600" />
                  Marco Temporal e Condições Específicas
                </h4>
                <span className="text-xs text-slate-400">Etapa 2 de 4</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Data de Início */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    Data de Início das Novas Condições *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400 block">
                    A partir de quando o novo valor ou escopo passa a vigorar.
                  </span>
                </div>

                {/* Vigência */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock size={13} className="text-slate-400" />
                    Prazo de Vigência do Aditivo
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setVigenciaMode("indeterminado")}
                      className={`py-2 px-2 text-center text-xs font-bold rounded-lg border transition-all ${
                        vigenciaMode === "indeterminado"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Indeterminado
                    </button>
                    <button
                      type="button"
                      onClick={() => setVigenciaMode("12m")}
                      className={`py-2 px-2 text-center text-xs font-bold rounded-lg border transition-all ${
                        vigenciaMode === "12m"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      12 Meses
                    </button>
                    <button
                      type="button"
                      onClick={() => setVigenciaMode("custom")}
                      className={`py-2 px-2 text-center text-xs font-bold rounded-lg border transition-all ${
                        vigenciaMode === "custom"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Data Fim
                    </button>
                  </div>

                  {vigenciaMode === "custom" && (
                    <input
                      type="date"
                      value={customVigenciaDate}
                      onChange={(e) => setCustomVigenciaDate(e.target.value)}
                      className="w-full mt-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                    />
                  )}
                </div>
              </div>

              {/* Ajuste de Valor e Escopo se necessário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Coins size={13} className="text-slate-400" />
                    Novo Valor Mensal Líquido (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount || ""}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    placeholder="0.00"
                  />
                  <span className="text-[10px] text-slate-400 block italic">
                    {valorPorExtenso(amount)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Briefcase size={13} className="text-slate-400" />
                    Novo Escopo / Atividades *
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    placeholder="Ex: Terceirizado Analista de Sistemas"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Padronizado com prefixo &quot;Terceirizado&quot; para blindagem PJ.
                  </span>
                </div>
              </div>

              {/* Houve mais alguma alteração? */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Houve mais alguma alteração contratual? (Opcional)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Cláusulas ou notas complementares</span>
                </label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs leading-relaxed focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-y"
                  placeholder="Ex: Incluída cláusula de confidencialidade de código-fonte; repactuada dedicação semanal de 40 horas autônomas; acordada bonificação trimestral vinculada a metas..."
                />
              </div>

              {/* Botões */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
                >
                  <ChevronLeft size={14} /> Voltar
                </button>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
                >
                  <span>Avançar para Visualização Prévia</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ===================== PASSO 2: VALIDAÇÃO PRÉVIA OBRIGATÓRIA ===================== */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    Validação Prévia Completa dos Dados
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Confira todos os dados cadastrais e as cláusulas antes de emitir a minuta oficial.
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  Etapa 3 de 4
                </span>
              </div>

              {/* Qualificação das Partes Lado a Lado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Contratante */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <Building2 size={13} className="text-emerald-600" />
                    <span>Contratante (Empresa do Grupo)</span>
                  </div>
                  <p className="font-black text-slate-900 dark:text-white text-xs">
                    {draft.companyCreditor.corporateName}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    <strong>CNPJ:</strong> {draft.companyCreditor.cnpj}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    <strong>Representante:</strong> {draft.companyCreditor.representativeName} ({draft.companyCreditor.representativeCpf})
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    <strong>Foro:</strong> {draft.companyCreditor.forumCity}
                  </p>
                </div>

                {/* Contratada */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <User size={13} className="text-emerald-600" />
                    <span>Contratada (Prestador PJ)</span>
                  </div>
                  <p className="font-black text-slate-900 dark:text-white text-xs">
                    {draft.pjName}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    <strong>CNPJ:</strong> {draft.pjCnpj}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    <strong>Representante Legal:</strong> {draft.repName} (CPF: {draft.repCpf})
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 truncate">
                    <strong>Endereço:</strong> {draft.pjAddress}
                  </p>
                </div>
              </div>

              {/* Quadro Comparativo de Condições */}
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                  Condições Pactuadas para o Aditivo
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Honorários Mensais</span>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(amount)}
                    </p>
                    <span className="text-[9px] text-slate-400 block italic leading-tight">
                      {valorPorExtenso(amount)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Escopo de Atuação</span>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                      {formatPjRole(role)}
                    </p>
                    <span className="text-[9px] text-slate-400 block">
                      Autonomia e sem subordinação
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Início & Vigência</span>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                      A partir de {draft.startDateBr}
                    </p>
                    <span className="text-[9px] text-slate-400 block truncate">
                      {calculatedVigencia}
                    </span>
                  </div>
                </div>
              </div>

              {/* Espelho da Minuta Timbrada */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Prévia da Minuta Oficial (Texto Jurídico)
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGenerating}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Download size={13} />
                    <span>Baixar PDF de Teste</span>
                  </button>
                </div>

                <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4 font-serif text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-72 overflow-y-auto shadow-inner">
                  <div className="text-center font-bold font-sans text-xs sm:text-sm text-slate-900 dark:text-white uppercase tracking-wide border-b pb-3 border-slate-200 dark:border-slate-800">
                    INSTRUMENTO PARTICULAR DE TERMO ADITIVO AO<br />
                    CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS (PJ)
                  </div>

                  <p>
                    <strong>CONTRATANTE:</strong> {draft.companyCreditor.corporateName}, inscrita no CNPJ sob o nº {draft.companyCreditor.cnpj}, com sede em {draft.companyCreditor.fullAddress}, representada por {draft.companyCreditor.representativeFullText}.
                  </p>

                  <p>
                    <strong>CONTRATADA:</strong> {draft.pjName}, inscrita no CNPJ sob o nº {draft.pjCnpj}, com sede em {draft.pjAddress}, representada por seu(sua) representante legal, {draft.repName}, portador(a) do RG nº {draft.repRg} e CPF nº {draft.repCpf}.
                  </p>

                  <p className="italic">
                    As PARTES têm, entre si, justo e acordado o presente Termo Aditivo mediante as seguintes cláusulas:
                  </p>

                  {draft.clauses.map((c, i) => (
                    <div key={i} className="space-y-1">
                      <strong className="font-sans font-bold text-slate-900 dark:text-white block">
                        {c.title}
                      </strong>
                      <p>{c.text}</p>
                    </div>
                  ))}

                  <div className="pt-4 text-center font-sans font-bold text-slate-500 text-[10px]">
                    {draft.companyCreditor.city || "Praia Grande"} - {draft.companyCreditor.state || "SP"}, {draft.startDateBr}.
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
                >
                  <ChevronLeft size={14} /> Voltar e Ajustar
                </button>

                <button
                  type="button"
                  onClick={handleValidateAndConfirm}
                  disabled={isGenerating}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  <span>Validar e Emitir Minuta (ZapSign / PDF)</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================== PASSO 3: CONCLUSÃO & ZAPSIGN ===================== */}
          {step === 3 && (
            <div className="space-y-6 text-center py-4 animate-in fade-in duration-150">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border-2 border-emerald-500/30">
                <CheckCircle2 size={32} />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Minuta Gerada e Registrada com Sucesso!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  O PDF timbrado oficial foi baixado automaticamente para a sua máquina. A área <strong>&quot;Meus Aditivos&quot;</strong> e a linha do tempo do colaborador já foram alimentadas com status <span className="font-bold text-amber-600 dark:text-amber-400">[Pendente de Assinatura]</span>.
                </p>
              </div>

              {/* Alerta de SLA de 5 Dias */}
              <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl max-w-lg mx-auto text-left flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <strong className="text-amber-900 dark:text-amber-200 font-bold block">
                    Acompanhamento de SLA de 5 Dias Ativado
                  </strong>
                  <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed text-[11px]">
                    A versão final só se torna efetiva após a coleta de todas as assinaturas. Caso o documento assinado no ZapSign não seja anexado em até <strong>5 dias</strong>, o sistema sinalizará automaticamente um alerta no prontuário e nos cards do People.
                  </p>
                </div>
              </div>

              {/* Ações ZapSign */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-all"
                >
                  <Download size={14} />
                  <span>Baixar PDF Novamente</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyZapSignInfo}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-all"
                >
                  {isCopiedZapSign ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{isCopiedZapSign ? "Copiado!" : "Copiar Dados dos Signatários"}</span>
                </button>

                <a
                  href="https://app.zapsign.com.br/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
                >
                  <span>Abrir Painel ZapSign</span>
                  <ExternalLink size={14} />
                </a>
              </div>

              {/* Fechar */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-xs font-black uppercase tracking-wider transition-all"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

