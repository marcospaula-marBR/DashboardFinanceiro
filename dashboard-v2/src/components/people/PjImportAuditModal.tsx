"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  Search,
  Check,
  RefreshCw,
  Sparkles,
  Link as LinkIcon
} from "lucide-react";
import { parsePjFile, PjParseResult, PjParsedEmployee } from "@/utils/diannaPjFileParser";
import { findBestNameMatch } from "@/utils/nameSimilarity";
import { PeopleHRService } from "@/services/people-hr.service";
import { Employee } from "@/types/loans";

interface PjImportAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingEmployees: Employee[];
  onImportSuccess: () => void;
}

export interface PjEmployeeAuditMatch {
  parsedEmp: PjParsedEmployee;
  selectedMatchId: string; // 'NEW' ou id do colaborador no Supabase
  matchScore: number;
  matchedName?: string;
  isSelected: boolean;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PjImportAuditModal({
  isOpen,
  onClose,
  existingEmployees,
  onImportSuccess
}: PjImportAuditModalProps) {
  const [parseResult, setParseResult] = useState<PjParseResult | null>(null);
  const [auditMatches, setAuditMatches] = useState<PjEmployeeAuditMatch[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadDefaultDiannaPj();
    }
  }, [isOpen]);

  const loadDefaultDiannaPj = async () => {
    try {
      setIsParsing(true);
      setParseError(null);
      const res = await fetch("/Dianna.xlsx");
      if (!res.ok) throw new Error("Planilha Dianna.xlsx não encontrada na pasta public.");
      const buf = await res.arrayBuffer();
      const result = await parsePjFile(buf, "Dianna.xlsx");
      processResult(result);
    } catch (err: any) {
      console.warn("Dianna.xlsx padrão não carregou, aguardando upload manual:", err.message);
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const processResult = (result: PjParseResult) => {
    setParseResult(result);

    const matches: PjEmployeeAuditMatch[] = result.employees.map((emp) => {
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
        isSelected: true,
      };
    });

    setAuditMatches(matches);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsParsing(true);
      setParseError(null);
      const result = await parsePjFile(file, file.name);
      processResult(result);
    } catch (err: any) {
      setParseError(err.message || "Erro ao processar arquivo Dianna PJ.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdateMatchSelection = (empId: string, matchId: string) => {
    setAuditMatches((prev) =>
      prev.map((item) => (item.parsedEmp.id === empId ? { ...item, selectedMatchId: matchId } : item))
    );
  };

  const handleToggleSelectAll = () => {
    const allSelected = auditMatches.every((m) => m.isSelected);
    setAuditMatches((prev) => prev.map((item) => ({ ...item, isSelected: !allSelected })));
  };

  const handleToggleSelect = (empId: string) => {
    setAuditMatches((prev) =>
      prev.map((item) => (item.parsedEmp.id === empId ? { ...item, isSelected: !item.isSelected } : item))
    );
  };

  const handleSaveToDatabase = async () => {
    if (!parseResult || auditMatches.length === 0) return;
    const selectedMatches = auditMatches.filter((m) => m.isSelected);
    if (selectedMatches.length === 0) return;

    try {
      setIsSaving(true);
      const monthlyCostsToInsert: any[] = [];

      for (const item of selectedMatches) {
        const pEmp = item.parsedEmp;
        let targetEmployeeId = item.selectedMatchId;

        // Se for "NEW" ou não possuir ID cadastrado, cria um novo colaborador PJ no Supabase
        if (targetEmployeeId === "NEW") {
          const newEmpObj: Partial<Employee> = {
            name: pEmp.cleanName,
            linkType: "PJ",
            status: pEmp.status === "Inativo" ? "Inativo" : "Ativo",
            department: pEmp.setor || "Operacional",
            job_role: pEmp.ultimoCargo || pEmp.cargoInicial || "Prestador PJ",
            start_date: pEmp.dataInicial,
            remuneration_fixed: pEmp.costsByCompetencia[Object.keys(pEmp.costsByCompetencia).pop() || ""]?.valor_fixo || 0,
            remuneration: pEmp.costsByCompetencia[Object.keys(pEmp.costsByCompetencia).pop() || ""]?.valor_fixo || 0,
          };
          const created = await PeopleHRService.insertEmployee(newEmpObj);
          if (created && created.id) {
            targetEmployeeId = created.id;
          }
        }

        if (targetEmployeeId && targetEmployeeId !== "NEW") {
          Object.keys(pEmp.costsByCompetencia).forEach((comp) => {
            const cost = pEmp.costsByCompetencia[comp];
            monthlyCostsToInsert.push({
              employee_id: targetEmployeeId,
              competencia: comp,
              vinculo_tipo: "MEI",
              valor_fixo: cost.valor_fixo,
              valor_bonus: cost.valor_bonus,
              valor_comissao: cost.valor_comissao,
              valor_incentivos: cost.valor_incentivos,
              valor_ajuda_custo: cost.valor_conectividade,
              valor_glosa_base: cost.valor_glosa_base,
              valor_glosa_bonus: cost.valor_glosa_bonus,
              valor_deducoes: cost.valor_deducoes,
              valor_liquido: cost.total_liquido,
            });
          });
        }
      }

      if (monthlyCostsToInsert.length > 0) {
        await PeopleHRService.saveMonthlyCostsBatch(monthlyCostsToInsert);
      }

      onImportSuccess();
      onClose();
    } catch (err: any) {
      alert("Erro ao salvar lançamentos Dianna PJ: " + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const totalCompsCount = parseResult?.competencias.length || 1;

  // Calculos do topo conforme imagem
  const sumFixo = parseResult?.totalFixo || 0;
  const sumBonus = parseResult?.totalBonus || 0;
  const sumComissao = parseResult?.totalComissao || 0;
  const sumIncentivos = parseResult?.totalIncentivos || 0;
  const sumConectividade = parseResult?.totalConectividade || 0;
  const sumGlosaBase = parseResult?.totalGlosaBase || 0;
  const sumGlosaBonus = parseResult?.totalGlosaBonus || 0;
  const sumDeducoes = parseResult?.totalDeducoes || 0;
  const sumTotalReal = parseResult?.totalFolhaAmount || 0;

  const mediaFixo = totalCompsCount > 0 ? sumFixo / totalCompsCount : 0;
  const mediaBonus = totalCompsCount > 0 ? sumBonus / totalCompsCount : 0;
  const mediaComissao = totalCompsCount > 0 ? sumComissao / totalCompsCount : 0;
  const mediaIncentivos = totalCompsCount > 0 ? sumIncentivos / totalCompsCount : 0;
  const mediaConectividade = totalCompsCount > 0 ? sumConectividade / totalCompsCount : 0;
  const mediaTotalReal = totalCompsCount > 0 ? sumTotalReal / totalCompsCount : 0;

  const filteredMatches = auditMatches.filter(
    (m) =>
      m.parsedEmp.cleanName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (m.parsedEmp.setor && m.parsedEmp.setor.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  const selectedCount = auditMatches.filter((m) => m.isSelected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Auditoria e Importação Dianna (PJ)
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                  Prestadores PJ / MEI
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Auditoria executiva com inteligência de associação de nomes por similaridade
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors shadow-sm">
              <Upload className="w-4 h-4 text-teal-600" />
              <span>Carregar Planilha Dianna</span>
              <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileUpload} />
            </label>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {isParsing && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200/80">
              <RefreshCw className="w-10 h-10 text-teal-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-800">Analisando dados Dianna (PJ)...</p>
              <p className="text-xs text-slate-500">Calculando similaridade de nomes e cruzando com colaboradores do sistema</p>
            </div>
          )}

          {parseError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {parseResult && !isParsing && (
            <>
              {/* BLOCO EXEC: RESUMO DE GANHOS RECEBIDOS (CONFORME IMAGEM DO USUÁRIO) */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Resumo de Ganhos Recebidos
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {/* Card FIXO */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fixo</span>
                    <div className="mt-2">
                      <div className="text-lg font-black text-slate-900 tabular-nums">{BRL.format(sumFixo)}</div>
                      <div className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-tight">
                        Média: {BRL.format(mediaFixo)}
                      </div>
                    </div>
                  </div>

                  {/* Card BÔNUS */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bônus</span>
                    <div className="mt-2">
                      <div className="text-lg font-black text-slate-900 tabular-nums">{BRL.format(sumBonus)}</div>
                      <div className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-tight">
                        Média: {BRL.format(mediaBonus)}
                      </div>
                    </div>
                  </div>

                  {/* Card COMISSÕES */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Comissões</span>
                    <div className="mt-2">
                      <div className="text-lg font-black text-slate-900 tabular-nums">{BRL.format(sumComissao)}</div>
                      <div className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-tight">
                        Média: {BRL.format(mediaComissao)}
                      </div>
                    </div>
                  </div>

                  {/* Card INCENTIVOS */}
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Incentivos</span>
                    <div className="mt-2">
                      <div className="text-lg font-black text-emerald-700 tabular-nums">{BRL.format(sumIncentivos)}</div>
                      <div className="text-[10px] font-semibold text-emerald-600/80 mt-1 uppercase tracking-tight">
                        Média: {BRL.format(mediaIncentivos)}
                      </div>
                    </div>
                  </div>

                  {/* Card CONECTIVIDADE */}
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Conectividade</span>
                    <div className="mt-2">
                      <div className="text-lg font-black text-emerald-700 tabular-nums">{BRL.format(sumConectividade)}</div>
                      <div className="text-[10px] font-semibold text-emerald-600/80 mt-1 uppercase tracking-tight">
                        Média: {BRL.format(mediaConectividade)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCO EXEC: DESCONTOS, AJUSTES E RESULTADO FINAL (CONFORME IMAGEM) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                <div className="md:col-span-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Descontos e Ajustes
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {/* GLOSA BASE */}
                    <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Glosa Base</span>
                      <div className="mt-2">
                        <div className="text-lg font-black text-rose-700 tabular-nums">{BRL.format(sumGlosaBase)}</div>
                      </div>
                    </div>

                    {/* GLOSA BÔNUS */}
                    <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Glosa Bônus</span>
                      <div className="mt-2">
                        <div className="text-lg font-black text-rose-700 tabular-nums">{BRL.format(sumGlosaBonus)}</div>
                      </div>
                    </div>

                    {/* DEDUÇÕES */}
                    <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Deduções</span>
                      <div className="mt-2">
                        <div className="text-lg font-black text-rose-700 tabular-nums">{BRL.format(sumDeducoes)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RESULTADO FINAL */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Resultado Final
                  </h3>
                  <div className="p-4 bg-emerald-100/70 rounded-2xl border border-emerald-300 shadow-sm flex flex-col justify-between h-[84px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-wider">Total Real</span>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight">
                        Média: {BRL.format(mediaTotalReal)}
                      </span>
                    </div>
                    <div className="text-xl font-black text-emerald-950 tabular-nums mt-1">
                      {BRL.format(sumTotalReal)}
                    </div>
                  </div>
                </div>
              </div>

              {/* LISTA DE PRESTADORES PJ COM SELETOR DE ASSOCIAÇÃO INTELIGENTE */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleSelectAll}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {selectedCount === auditMatches.length ? "Desmarcar Todos" : "Marcar Todos"}
                      </span>
                    </button>
                    <span className="text-xs text-slate-500 font-medium">
                      {selectedCount} de {auditMatches.length} prestadores selecionados
                    </span>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar prestador PJ..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto pr-1">
                  {filteredMatches.map((item) => {
                    const emp = item.parsedEmp;

                    return (
                      <div
                        key={emp.id}
                        className={`py-3.5 px-3 rounded-2xl border transition-all my-1.5 flex flex-wrap items-center justify-between gap-4 ${
                          item.isSelected
                            ? "bg-white border-slate-200 shadow-sm"
                            : "bg-slate-50 border-slate-100 opacity-50"
                        }`}
                      >
                        {/* Checkbox + Dados da Planilha */}
                        <div className="flex items-center gap-3 min-w-[280px]">
                          <input
                            type="checkbox"
                            checked={item.isSelected}
                            onChange={() => handleToggleSelect(emp.id)}
                            className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{emp.cleanName}</span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  emp.status === "Ativo"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {emp.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>Setor: {emp.setor || "Operacional"}</span>
                              <span>•</span>
                              <span>Competências: {Object.keys(emp.costsByCompetencia).length}</span>
                            </div>
                          </div>
                        </div>

                        {/* SELETOR DE ASSOCIAÇÃO INTELIGENTE POR SIMILARIDADE */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium hidden sm:inline">Vínculo:</span>
                          <select
                            value={item.selectedMatchId}
                            onChange={(e) => handleUpdateMatchSelection(emp.id, e.target.value)}
                            aria-label={`Vínculo do Sistema para ${emp.cleanName}`}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border focus:outline-none transition-colors ${
                              item.selectedMatchId === "NEW"
                                ? "bg-blue-50 border-blue-200 text-blue-800"
                                : "bg-emerald-50 border-emerald-200 text-emerald-800"
                            }`}
                          >
                            <option value="NEW">✨ Criar como Novo Prestador PJ</option>
                            {existingEmployees.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                🔗 Vincular a: {ex.name} ({ex.linkType || "PJ"})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* BADGE DE SIMILARIDADE E TOTAL */}
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <div className="text-xs font-black text-slate-900 tabular-nums">
                              {BRL.format(emp.totalCalculado)}
                            </div>
                            <div className="text-[10px] text-slate-400">Total Desembolsado PJ</div>
                          </div>

                          <div className="min-w-[130px]">
                            {item.selectedMatchId !== "NEW" ? (
                              <span className="text-[11px] font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                {item.matchScore >= 0.95
                                  ? "100% Exato"
                                  : `${Math.round(item.matchScore * 100)}% Semelhante`}
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg flex items-center justify-center gap-1">
                                <Sparkles className="w-3 h-3 text-blue-500" /> Novo Cadastro
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {parseResult ? `${selectedCount} prestadores selecionados para carga PJ` : "Aguardando arquivo Dianna PJ"}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              disabled={!parseResult || selectedCount === 0 || isSaving}
              onClick={handleSaveToDatabase}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-600/20 flex items-center gap-2 transition-colors"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sincronizando Dianna PJ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sincronizar e Salvar Dados PJ no Banco</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
