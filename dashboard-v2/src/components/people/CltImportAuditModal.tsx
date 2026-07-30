"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  CheckSquare,
  Square,
  Loader2,
  Database,
  ArrowRight,
  UserPlus,
  RefreshCw,
  ShieldCheck,
  Building2,
  Calendar,
  Briefcase
} from "lucide-react";
import { parseCltFile, CltParseResult, CltParsedEmployee } from "@/utils/cltFileParser";
import { findBestNameMatch } from "@/utils/nameSimilarity";
import { PeopleHRService } from "@/services/people-hr.service";
import { Employee } from "@/types/loans";
import { formatCurrency } from "@/services/loans.service";

interface CltImportAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingEmployees: Employee[];
}

interface EmployeeAuditMatch {
  parsedEmp: CltParsedEmployee;
  selectedMatchId: string; // 'NEW' ou ID do colaborador existente
  matchScore: number;
  matchedName?: string;
  isSelected: boolean;
}

export function CltImportAuditModal({
  isOpen,
  onClose,
  onSuccess,
  existingEmployees
}: CltImportAuditModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<CltParseResult | null>(null);
  const [auditMatches, setAuditMatches] = useState<EmployeeAuditMatch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<"DEFAULT" | "CUSTOM">("DEFAULT");

  // Carrega o arquivo padrão public/CLT.xlsx quando o modal abre
  useEffect(() => {
    if (isOpen) {
      loadDefaultCltFile();
    } else {
      setParseResult(null);
      setAuditMatches([]);
      setError(null);
    }
  }, [isOpen]);

  const loadDefaultCltFile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSourceMode("DEFAULT");

      const response = await fetch("/CLT.xlsx");
      if (!response.ok) {
        throw new Error("Não foi possível carregar a planilha padrão public/CLT.xlsx");
      }
      const buffer = await response.arrayBuffer();
      const result = await parseCltFile(buffer, "CLT.xlsx");
      processParseResult(result);
    } catch (err: any) {
      console.error("Erro ao carregar CLT.xlsx:", err);
      setError("Erro ao carregar arquivo padrão: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setError(null);
      setSourceMode("CUSTOM");

      const result = await parseCltFile(file, file.name);
      processParseResult(result);
    } catch (err: any) {
      console.error("Erro ao ler arquivo enviado:", err);
      setError("Erro ao processar arquivo: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Processa resultado e cruza com colaboradores existentes por inteligência de similaridade
  const processParseResult = (result: CltParseResult) => {
    setParseResult(result);

    const matches: EmployeeAuditMatch[] = result.employees.map((emp) => {
      const best = findBestNameMatch(emp.cleanName, existingEmployees);
      let selectedMatchId = "NEW";
      let matchScore = 0;
      let matchedName: string | undefined = undefined;

      if (best) {
        matchScore = best.similarity;
        matchedName = best.matchedEmployeeName;
        if (best.matchedEmployeeId && (best.status === "EXACT" || best.status === "SIMILAR")) {
          selectedMatchId = best.matchedEmployeeId;
        }
      }

      return {
        parsedEmp: emp,
        selectedMatchId,
        matchScore,
        matchedName,
        isSelected: true
      };
    });

    setAuditMatches(matches);
  };

  // Seleção e filtros
  const filteredMatches = useMemo(() => {
    return auditMatches.filter((item) => {
      const emp = item.parsedEmp;
      const matchesSearch =
        searchQuery === "" ||
        emp.cleanName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.setor && emp.setor.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.ultimoCargo && emp.ultimoCargo.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && emp.status === "Ativo") ||
        (statusFilter === "INACTIVE" && emp.status === "Inativo");

      return matchesSearch && matchesStatus;
    });
  }, [auditMatches, searchQuery, statusFilter]);

  const toggleSelectAll = () => {
    const allSelected = filteredMatches.every((m) => m.isSelected);
    setAuditMatches((prev) =>
      prev.map((item) => {
        if (filteredMatches.some((fm) => fm.parsedEmp.id === item.parsedEmp.id)) {
          return { ...item, isSelected: !allSelected };
        }
        return item;
      })
    );
  };

  const toggleSelectItem = (id: string) => {
    setAuditMatches((prev) =>
      prev.map((item) =>
        item.parsedEmp.id === id ? { ...item, isSelected: !item.isSelected } : item
      )
    );
  };

  const updateMatchSelection = (parsedId: string, matchId: string) => {
    setAuditMatches((prev) =>
      prev.map((item) =>
        item.parsedEmp.id === parsedId ? { ...item, selectedMatchId: matchId } : item
      )
    );
  };

  // Sincronização em Lote com Supabase
  const handleExecuteImport = async () => {
    const selected = auditMatches.filter((m) => m.isSelected);
    if (selected.length === 0) {
      alert("Selecione pelo menos um colaborador para importar.");
      return;
    }

    try {
      setIsImporting(true);
      setImportProgress(0);
      setError(null);

      const total = selected.length;
      let countDone = 0;

      for (const item of selected) {
        const pEmp = item.parsedEmp;
        countDone++;
        setImportProgress(Math.round((countDone / total) * 100));
        setImportStatusText(`Sincronizando (${countDone}/${total}): ${pEmp.cleanName}...`);

        let targetEmployeeId = item.selectedMatchId;

        // Se for NOVO colaborador
        if (targetEmployeeId === "NEW") {
          const newProfilePayload: Partial<Employee> = {
            name: pEmp.cleanName,
            corporate_name: pEmp.cleanName,
            company: "MarBR",
            linkType: "CLT",
            status: pEmp.status === "Inativo" ? "Inativo" : "Ativo",
            department: pEmp.setor || "Geral",
            job_role: pEmp.ultimoCargo || pEmp.cargoInicial || "Colaborador",
            start_date: pEmp.dataInicial || undefined,
            resignation_date: pEmp.desligamento || undefined,
            remuneration_fixed: pEmp.costsByCompetencia[Object.keys(pEmp.costsByCompetencia).pop() || ""]?.valor_fixo || 0,
          };

          const created = await PeopleHRService.insertEmployee(newProfilePayload);
          if (created && created.id) {
            targetEmployeeId = created.id;
          }
        } else {
          // Atualiza dados cadastrais se o colaborador estiver inativo/desligado na planilha
          const existing = existingEmployees.find((e) => e.id === targetEmployeeId);
          if (existing) {
            const updatePayload: Partial<Employee> = {};
            // Preserva status Ativo se o colaborador atualmente for PJ ou estiver ativo no app
            if (pEmp.status === "Inativo" && existing.status !== "Inativo" && existing.linkType === "CLT") {
              updatePayload.status = "Inativo";
            }
            if (pEmp.desligamento && !existing.resignation_date && existing.linkType === "CLT") {
              updatePayload.resignation_date = pEmp.desligamento;
            }
            if (pEmp.setor && (!existing.department || existing.department === "Geral")) {
              updatePayload.department = pEmp.setor;
            }
            if (pEmp.ultimoCargo && pEmp.ultimoCargo !== existing.job_role) {
              updatePayload.job_role = pEmp.ultimoCargo;
            }

            // Atualiza remuneração base e total se houver reajuste na competência mais recente
            const sortedComps = Object.keys(pEmp.costsByCompetencia).sort().reverse();
            const latestCompWithSalary = sortedComps.find(c => pEmp.costsByCompetencia[c].valor_fixo > 0);
            if (latestCompWithSalary) {
              const latestSalary = pEmp.costsByCompetencia[latestCompWithSalary].valor_fixo;
              if (latestSalary > 0 && existing.linkType === "CLT" && Math.abs(latestSalary - (existing.remuneration_fixed || 0)) > 0.01) {
                updatePayload.remuneration_fixed = latestSalary;
                updatePayload.remuneration = latestSalary;
              }
            }

            if (Object.keys(updatePayload).length > 0) {
              await PeopleHRService.updateEmployee(targetEmployeeId, updatePayload);
            }
          }
        }

        // Salva/Upsert histórico de custos mensais no Supabase
        if (targetEmployeeId && targetEmployeeId !== "NEW") {
          for (const comp in pEmp.costsByCompetencia) {
            const cost = pEmp.costsByCompetencia[comp];
            await PeopleHRService.upsertMonthlyCost({
              employee_id: targetEmployeeId,
              competencia: comp,
              vinculo_tipo: "CLT",
              valor_fixo: cost.valor_fixo,
              valor_adiantamento: cost.valor_adiantamento,
              valor_hora_extra: cost.valor_hora_extra,
              valor_adicional_not: cost.valor_adicional_not,
              valor_vr: cost.valor_vr,
              valor_vt: cost.valor_vt,
              valor_ajuda_custo: cost.valor_ajuda_custo,
              valor_cesta: cost.valor_cesta,
              valor_bonus: cost.valor_bonus,
              valor_ferias: cost.valor_ferias,
              valor_rescisao: cost.valor_rescisao,
              valor_decimo_terceiro: cost.valor_decimo_terceiro,
              valor_descontos: cost.valor_descontos,
              outros_ajustes: cost.outros_ajustes,
              valor_liquido: cost.total_liquido,
              origem: "dianna_batch_clt",
              observacao: "Importado via planilha CLT (.csv/.xlsx)"
            });
          }
        }
      }

      setImportStatusText("Sincronização concluída com sucesso!");
      setTimeout(() => {
        setIsImporting(false);
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Erro na importação em lote CLT:", err);
      setError("Erro ao executar importação: " + err.message);
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCount = auditMatches.filter((m) => m.isSelected).length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header do Modal */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-400/30">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  Auditoria e Importação da Planilha CLT (.csv / .xlsx)
                </h2>
                <p className="text-xs text-slate-300">
                  {parseResult ? `${parseResult.fileName} • ${parseResult.totalRecordsCount} colaboradores • ${parseResult.competencias.length} competências` : "Carregando planilha..."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Botões de Fonte do Arquivo */}
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer border border-slate-700 transition-all">
                <Upload size={14} className="text-emerald-400" />
                <span>Upload .CSV / .XLSX</span>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleCustomFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={loadDefaultCltFile}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
                title="Recarregar public/CLT.xlsx"
              >
                <RefreshCw size={14} className="text-amber-400" />
                <span>Usar CLT.xlsx Padrão</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Estado de Carregamento */}
          {isLoading && (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 size={36} className="animate-spin text-amber-500" />
              <p className="text-sm font-semibold">Processando e estruturando verbas da planilha CLT...</p>
            </div>
          )}

          {/* Mensagem de Erro */}
          {error && (
            <div className="p-4 m-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center gap-2">
              <AlertTriangle size={18} className="shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Conteúdo Principal do Modal */}
          {!isLoading && parseResult && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
              {/* Barra Superior de Resumo e Filtros */}
              <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6 text-xs">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-400" />
                    <span className="font-semibold text-slate-700">Detectados:</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded-md">
                      {parseResult.totalRecordsCount}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" />
                    <span className="font-semibold text-slate-700">Competências:</span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-md">
                      {parseResult.competencias.length} meses
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span className="font-semibold text-slate-700">Total Folha Auditada:</span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(parseResult.totalFolhaAmount)}
                    </span>
                  </div>
                </div>

                {/* Filtros e Pesquisa */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nome, setor..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 w-56"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium"
                  >
                    <option value="ALL">Todos os Status</option>
                    <option value="ACTIVE">Ativos</option>
                    <option value="INACTIVE">Inativos</option>
                  </select>

                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 transition-all"
                  >
                    {filteredMatches.every((m) => m.isSelected) ? (
                      <CheckSquare size={14} className="text-amber-600" />
                    ) : (
                      <Square size={14} className="text-slate-400" />
                    )}
                    <span>Selecionar Todos</span>
                  </button>
                </div>
              </div>

              {/* Tabela de Auditoria dos Colaboradores */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredMatches.map((item) => {
                  const emp = item.parsedEmp;

                  return (
                    <div
                      key={emp.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        item.isSelected
                          ? "bg-white border-amber-200 shadow-sm"
                          : "bg-slate-100/60 border-slate-200 opacity-60"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        {/* Checkbox + Perfil */}
                        <div className="flex items-center gap-3 min-w-[280px]">
                          <button
                            onClick={() => toggleSelectItem(emp.id)}
                            className="text-slate-400 hover:text-amber-600 transition-all shrink-0"
                          >
                            {item.isSelected ? (
                              <CheckSquare size={18} className="text-amber-600" />
                            ) : (
                              <Square size={18} />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-sm">{emp.cleanName}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  emp.status === "Inativo"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {emp.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                              {emp.setor && (
                                <span className="flex items-center gap-1">
                                  <Building2 size={12} /> {emp.setor}
                                </span>
                              )}
                              {emp.ultimoCargo && (
                                <span className="flex items-center gap-1">
                                  <Briefcase size={12} /> {emp.ultimoCargo}
                                </span>
                              )}
                              {emp.desligamento && (
                                <span className="text-rose-600 font-semibold">
                                  Desligado em: {emp.desligamento}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Inteligência de Vínculo (Similaridade de Nomes) */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">Vínculo do Sistema:</span>
                          <select
                            value={item.selectedMatchId}
                            onChange={(e) => updateMatchSelection(emp.id, e.target.value)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border focus:outline-none ${
                              item.selectedMatchId === "NEW"
                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                : "bg-emerald-50 border-emerald-200 text-emerald-700"
                            }`}
                          >
                            <option value="NEW">✨ Criar como Novo Colaborador CLT</option>
                            {existingEmployees.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                🔗 Vincular a: {ex.name} ({ex.linkType || "CLT"})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Auditoria Financeira e Batimento */}
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Acumulado</p>
                            <p className="text-sm font-black text-slate-800">
                              {formatCurrency(emp.totalCalculado)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold" title="Soma das verbas auditada 100%">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            <span>100% Auditado</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Barra Inferior com Progresso e Ações */}
              <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-4">
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">{selectedCount}</span> de {parseResult.employees.length} colaboradores selecionados para importação.
                </div>

                {isImporting && (
                  <div className="flex-1 max-w-md mx-4">
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                      <span>{importStatusText}</span>
                      <span>{importProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    disabled={isImporting}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={handleExecuteImport}
                    disabled={isImporting || selectedCount === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md disabled:opacity-50 transition-all"
                  >
                    {isImporting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Database size={16} />
                    )}
                    <span>Executar Importação Auditada</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
