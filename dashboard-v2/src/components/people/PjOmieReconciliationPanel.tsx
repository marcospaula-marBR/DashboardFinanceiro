"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Database,
  FileCode2,
  Loader2,
  RefreshCw,
  Search,
  Square,
  Upload,
} from "lucide-react";
import type { Employee, MonthlyCost } from "@/types/loans";
import { PeopleHRService } from "@/services/people-hr.service";
import { formatCurrency } from "@/services/loans.service";
import {
  cleanDigits,
  normalizeCompanyKey,
  normalizeEntityName,
  OmiePjDateMode,
  OmiePjStatusFilter,
  PjOmieReconciliationItem,
  PjOmieReconciliationResult,
  UnmatchedActivePj,
} from "@/services/people-omie-pj-reconciliation.service";
import {
  computeFileSha256Hex,
  createPreCommitImportSnapshot,
} from "@/services/people-cost-import-audit.service";
import type { ParsedNfseRecord } from "@/services/people-ingestion-parser.service";

interface PjStagingRow {
  id: string;
  employeeId: string;
  razaoSocial: string;
  nomeRepresentante: string;
  cnpj: string;
  company: string;
  linkType: "PJ" | "MEI";
  escopo: string;
  valor_fixo: number;
  valor_bonus: number;
  valor_comissao: number;
  valor_incentivos: number;
  valor_ajuda_custo: number;
  valor_deducoes: number;
  contractBase: number;
  matchMethod: "CNPJ" | "RAZAO_SOCIAL" | "SIMILARIDADE" | "XML_NFSE";
  sourceTag: "omie_pj_sync" | "xml_nfse";
  titlesCount: number;
  alreadyInDb: boolean;
  existingDbLiquido?: number;
  observacao: string;
  omieTitles: PjOmieReconciliationItem["omieTitles"];
  isSelected: boolean;
}

interface PjOmieReconciliationPanelProps {
  existingEmployees: Employee[];
  initialCompetencia: string;
  onBack: () => void;
  onCommitted: () => void;
}

function round2(v: number): number {
  const n = Number.isFinite(v) ? v : 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function PjOmieReconciliationPanel({
  existingEmployees,
  initialCompetencia,
  onBack,
  onCommitted,
}: PjOmieReconciliationPanelProps) {
  const [competencia, setCompetencia] = useState<string>(
    initialCompetencia ? initialCompetencia.slice(0, 7) : new Date().toISOString().slice(0, 7)
  );
  const [dateMode, setDateMode] = useState<OmiePjDateMode>("next_month_due");
  const [statusFilter, setStatusFilter] = useState<OmiePjStatusFilter>("all_valid");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyDivergent, setOnlyDivergent] = useState<boolean>(false);

  const [rows, setRows] = useState<PjStagingRow[]>([]);
  const [unmatchedPjs, setUnmatchedPjs] = useState<UnmatchedActivePj[]>([]);
  const [showUnmatched, setShowUnmatched] = useState<boolean>(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [metaWindow, setMetaWindow] = useState<{
    start: string;
    end: string;
    scanned: number;
    matched: number;
  } | null>(null);

  const [isLoadingOmie, setIsLoadingOmie] = useState<boolean>(false);
  const [isParsingXml, setIsParsingXml] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [lastFileHash, setLastFileHash] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string>("Conciliação Omie PJ");

  const pjEmployees = useMemo(
    () =>
      existingEmployees.filter((e) => {
        const lt = String(e.linkType || e.employment_type || "").toUpperCase();
        return lt.includes("PJ") || lt.includes("MEI");
      }),
    [existingEmployees]
  );

  const loadFromOmie = useCallback(async () => {
    try {
      setIsLoadingOmie(true);
      setErrorMessage(null);
      setInfoMessage(null);

      const params = new URLSearchParams({
        competencia,
        dateMode,
        statusFilter,
        company: companyFilter,
      });

      const res = await fetch(`/api/people/reconcile-pj-omie?${params.toString()}`);
      const json = (await res.json()) as PjOmieReconciliationResult & { error?: string };

      if (!res.ok) {
        throw new Error(json.error || `Falha na consulta Omie (${res.status})`);
      }

      const mapped: PjStagingRow[] = (json.items || []).map((item) => ({
        id: `omie-${item.employeeId}`,
        employeeId: item.employeeId,
        razaoSocial: item.razaoSocial,
        nomeRepresentante: item.nomeRepresentante,
        cnpj: item.cnpj,
        company: item.company,
        linkType: item.linkType,
        escopo: item.escopo,
        valor_fixo: item.valor_fixo,
        valor_bonus: item.valor_bonus,
        valor_comissao: item.valor_comissao,
        valor_incentivos: item.valor_incentivos,
        valor_ajuda_custo: item.valor_ajuda_custo,
        valor_deducoes: item.valor_deducoes,
        contractBase: item.contractBase,
        matchMethod: item.matchMethod,
        sourceTag: "omie_pj_sync",
        titlesCount: item.titlesCount,
        alreadyInDb: item.alreadyInDb,
        existingDbLiquido: item.existingDbLiquido,
        observacao: `Conciliado via Omie (${item.titlesCount} título${item.titlesCount === 1 ? "" : "s"} • janela ${json.omieWindowStart} a ${json.omieWindowEnd})`,
        omieTitles: item.omieTitles || [],
        isSelected: true,
      }));

      setRows(mapped);
      setUnmatchedPjs(json.unmatchedActivePjs || []);
      setMetaWindow({
        start: json.omieWindowStart,
        end: json.omieWindowEnd,
        scanned: json.scannedTitlesCount,
        matched: json.matchedTitlesCount,
      });
      setLastFileHash(null);
      setLastFileName(`Conciliação Omie PJ (${competencia})`);
      setInfoMessage(
        `${mapped.length} contratadas PJ/MEI conciliadas a partir de ${json.matchedTitlesCount} títulos no Omie (${json.omieWindowStart} a ${json.omieWindowEnd}).`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao conciliar títulos PJ no Omie.");
    } finally {
      setIsLoadingOmie(false);
    }
  }, [competencia, dateMode, statusFilter, companyFilter]);

  useEffect(() => {
    loadFromOmie();
  }, [loadFromOmie]);

  const handleImportNfseXmlFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsParsingXml(true);
      setErrorMessage(null);
      setInfoMessage(null);

      let importedCount = 0;
      let unmatchedXmlCount = 0;
      const newByEmpId = new Map<string, PjStagingRow>();
      rows.forEach((r) => newByEmpId.set(r.employeeId, { ...r }));

      let firstHash = "";
      const fileNames: string[] = [];

      for (const file of Array.from(files)) {
        fileNames.push(file.name);
        if (!firstHash) {
          firstHash = await computeFileSha256Hex(file);
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "nfse_xml");

        const res = await fetch("/api/people/parse-payroll-batch", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || `Falha ao ler XML ${file.name}`);
        }

        const nfseList: ParsedNfseRecord[] = Array.isArray(json.nfseRecords) ? json.nfseRecords : [];
        for (const nf of nfseList) {
          const nfCnpj = cleanDigits(nf.prestadorCnpj);
          const nfRazaoNorm = normalizeEntityName(nf.prestadorRazaoSocial);

          const matchedEmp = pjEmployees.find((emp) => {
            const empCnpj = cleanDigits(emp.pj_type || emp.document_id);
            if (nfCnpj.length === 14 && empCnpj === nfCnpj) return true;
            const corpNorm = normalizeEntityName(emp.corporate_name);
            const nameNorm = normalizeEntityName(emp.name);
            return Boolean(nfRazaoNorm && (corpNorm === nfRazaoNorm || nameNorm === nfRazaoNorm));
          });

          if (!matchedEmp) {
            unmatchedXmlCount += 1;
            continue;
          }

          importedCount += 1;
          const prev = newByEmpId.get(matchedEmp.id);
          const linkUpper = String(matchedEmp.linkType || matchedEmp.employment_type || "PJ").toUpperCase();
          const obsNote = `NFS-e nº ${nf.numeroNf || "S/N"} (${nf.dataEmissao || competencia}) — XML determinístico`;

          if (prev && prev.sourceTag === "xml_nfse") {
            prev.valor_fixo = round2(prev.valor_fixo + nf.valorServicos);
            prev.valor_deducoes = round2(prev.valor_deducoes + nf.totalRetencoes);
            prev.titlesCount += 1;
            prev.observacao = `${prev.observacao} | ${obsNote}`;
          } else {
            newByEmpId.set(matchedEmp.id, {
              id: `nfse-${matchedEmp.id}`,
              employeeId: matchedEmp.id,
              razaoSocial: String(matchedEmp.corporate_name || nf.prestadorRazaoSocial || matchedEmp.name),
              nomeRepresentante: String(matchedEmp.name || ""),
              cnpj: String(matchedEmp.pj_type || nf.prestadorCnpj || ""),
              company: normalizeCompanyKey(matchedEmp.company) || "MarBR",
              linkType: linkUpper.includes("MEI") ? "MEI" : "PJ",
              escopo: String(matchedEmp.job_role || matchedEmp.department || "Prestação de Serviços"),
              valor_fixo: round2(nf.valorServicos),
              valor_bonus: 0,
              valor_comissao: 0,
              valor_incentivos: 0,
              valor_ajuda_custo: 0,
              valor_deducoes: round2(nf.totalRetencoes),
              contractBase: round2(Number(matchedEmp.remuneration_fixed || matchedEmp.remuneration || 0)),
              matchMethod: "XML_NFSE",
              sourceTag: "xml_nfse",
              titlesCount: 1,
              alreadyInDb: prev?.alreadyInDb || false,
              existingDbLiquido: prev?.existingDbLiquido,
              observacao: obsNote,
              omieTitles: prev?.omieTitles || [],
              isSelected: true,
            });
          }
        }
      }

      const updatedRows = Array.from(newByEmpId.values()).sort((a, b) =>
        a.razaoSocial.localeCompare(b.razaoSocial)
      );
      setRows(updatedRows);
      if (firstHash) setLastFileHash(firstHash);
      setLastFileName(fileNames.join(", ").slice(0, 120));
      setInfoMessage(
        `${importedCount} NFS-e XML conciliada(s) em < 50ms.${unmatchedXmlCount > 0 ? ` ${unmatchedXmlCount} XML(s) sem CNPJ correspondente no cadastro PJ.` : ""}`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao importar XML de NFS-e.");
    } finally {
      setIsParsingXml(false);
      e.target.value = "";
    }
  };

  const updateRowField = (
    rowId: string,
    field:
      | "valor_fixo"
      | "valor_bonus"
      | "valor_comissao"
      | "valor_incentivos"
      | "valor_ajuda_custo"
      | "valor_deducoes"
      | "isSelected",
    value: number | boolean
  ) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
  };

  const toggleExpandRow = (rowId: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const isRowDivergent = (r: PjStagingRow): boolean => {
    if (r.contractBase <= 0) return false;
    const delta = Math.abs(r.valor_fixo - r.contractBase);
    const pct = (delta / r.contractBase) * 100;
    return pct >= 20 && delta >= 50;
  };

  const visibleRows = useMemo(() => {
    const q = normalizeEntityName(searchQuery);
    return rows.filter((r) => {
      const matchSearch =
        !q ||
        normalizeEntityName(r.razaoSocial).includes(q) ||
        normalizeEntityName(r.nomeRepresentante).includes(q) ||
        cleanDigits(r.cnpj).includes(cleanDigits(searchQuery)) ||
        normalizeEntityName(r.escopo).includes(q);
      const matchDiv = !onlyDivergent || isRowDivergent(r);
      return matchSearch && matchDiv;
    });
  }, [rows, searchQuery, onlyDivergent]);

  const divergentCount = useMemo(() => rows.filter(isRowDivergent).length, [rows]);

  const selectedStats = useMemo(() => {
    const sel = rows.filter((r) => r.isSelected);
    const honorarios = round2(sel.reduce((s, r) => s + r.valor_fixo, 0));
    const variavel = round2(
      sel.reduce((s, r) => s + r.valor_bonus + r.valor_comissao + r.valor_incentivos, 0)
    );
    const conectividade = round2(sel.reduce((s, r) => s + r.valor_ajuda_custo, 0));
    const bruto = round2(honorarios + variavel + conectividade);
    const deducoes = round2(sel.reduce((s, r) => s + r.valor_deducoes, 0));
    const liquido = round2(Math.max(0, bruto - deducoes));
    return { count: sel.length, honorarios, variavel, conectividade, bruto, deducoes, liquido };
  }, [rows]);

  const handleToggleSelectAll = () => {
    const allSel = visibleRows.length > 0 && visibleRows.every((r) => r.isSelected);
    const visibleIds = new Set(visibleRows.map((r) => r.id));
    setRows((prev) =>
      prev.map((r) => (visibleIds.has(r.id) ? { ...r, isSelected: !allSel } : r))
    );
  };

  const handleCommitPjBatch = async () => {
    const selected = rows.filter((r) => r.isSelected);
    if (selected.length === 0) {
      alert("Selecione pelo menos uma contratada PJ/MEI para gravar.");
      return;
    }

    try {
      setIsCommitting(true);
      setErrorMessage(null);
      const compDate = `${competencia}-01`;

      // Captura snapshot pré-lote para Rollback em 1 clique
      const existingInComp = await PeopleHRService.getMonthlyCostsByCompetencia(compDate);
      const selectedEmpIds = new Set(selected.map((r) => r.employeeId));
      const previousRows = existingInComp.filter((c) => selectedEmpIds.has(c.employee_id));

      const hasXml = selected.some((r) => r.sourceTag === "xml_nfse");
      await createPreCommitImportSnapshot({
        competencia: compDate,
        scope: hasXml ? "PJ_NFSE" : "PJ_OMIE",
        engine: hasXml ? "deterministic_xml_nfse" : "omie_pj_reconciliation",
        fileName: lastFileName,
        fileHash: lastFileHash,
        previousRows,
        committedEmployeeIds: selected.map((r) => r.employeeId),
        totalAmountCommitted: selectedStats.liquido,
      });

      const batch: Partial<MonthlyCost>[] = selected.map((r) => {
        const bruto = round2(
          r.valor_fixo + r.valor_bonus + r.valor_comissao + r.valor_incentivos + r.valor_ajuda_custo
        );
        const liquido = round2(Math.max(0, bruto - r.valor_deducoes));
        return {
          employee_id: r.employeeId,
          competencia: compDate,
          // people_monthly_costs possui CHECK (vinculo_tipo IN ('CLT', 'MEI')) — 'MEI' representa toda prestação PJ/MEI
          vinculo_tipo: "MEI",
          valor_fixo: round2(r.valor_fixo),
          valor_bonus: round2(r.valor_bonus),
          valor_comissao: round2(r.valor_comissao),
          valor_incentivos: round2(r.valor_incentivos),
          valor_ajuda_custo: round2(r.valor_ajuda_custo),
          valor_deducoes: round2(r.valor_deducoes),
          valor_liquido: liquido,
          origem: r.sourceTag,
          observacao: r.observacao,
        };
      });

      await PeopleHRService.saveMonthlyCostsBatch(batch);
      alert(
        `Sucesso! ${batch.length} faturamentos PJ/MEI gravados para ${competencia} com snapshot de rollback salvo.`
      );
      onCommitted();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Erro ao gravar conciliação PJ no Supabase."
      );
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* BARRA DE CONTROLES B2B */}
      <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-teal-50/40 dark:bg-teal-950/20 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
          >
            <ArrowLeft size={14} />
            <span>Fontes</span>
          </button>

          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 border border-teal-300 dark:border-teal-800 rounded-xl px-2.5 py-1.5">
            <Calendar size={14} className="text-teal-600" />
            <span className="text-[10px] font-black uppercase text-slate-400">Competência:</span>
            <input
              type="month"
              value={competencia}
              onChange={(e) => e.target.value && setCompetencia(e.target.value)}
              className="text-xs font-black bg-transparent text-slate-900 dark:text-white outline-none cursor-pointer"
            />
          </div>

          <select
            value={dateMode}
            onChange={(e) => setDateMode(e.target.value as OmiePjDateMode)}
            className="min-h-[38px] px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
            title="Janela de vencimento consultada no Omie"
          >
            <option value="next_month_due">Omie: Venc. Mês Seguinte (Competência)</option>
            <option value="same_month_due">Omie: Venc. Mesmo Mês</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OmiePjStatusFilter)}
            className="min-h-[38px] px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
          >
            <option value="all_valid">Pagos + A Vencer</option>
            <option value="paid_only">Somente Pagos</option>
          </select>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5">
            <Building2 size={13} className="text-teal-600" />
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="text-xs font-bold bg-transparent text-slate-800 dark:text-slate-200 outline-none"
            >
              <option value="all">Todas Contratantes</option>
              <option value="MarBR">MarBR</option>
              <option value="DZM">DZM</option>
              <option value="G2">G2</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadFromOmie}
            disabled={isLoadingOmie}
            className="min-h-[38px] px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {isLoadingOmie ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span>Atualizar Omie</span>
          </button>

          <label className="min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-800 hover:bg-teal-50 text-teal-800 dark:text-teal-300 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-2xs">
            {isParsingXml ? <Loader2 size={14} className="animate-spin" /> : <FileCode2 size={14} />}
            <span>+ XML NFS-e</span>
            <input
              type="file"
              accept=".xml,text/xml,application/xml"
              multiple
              onChange={handleImportNfseXmlFiles}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* MENSAGENS E BUSCA */}
      {(errorMessage || infoMessage) && (
        <div className="px-4 pt-2.5 space-y-1.5">
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}
          {infoMessage && (
            <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs font-bold text-teal-800 dark:text-teal-300 flex flex-wrap items-center justify-between gap-2">
              <span>{infoMessage}</span>
              {metaWindow && (
                <span className="text-[10px] font-mono opacity-80">
                  {metaWindow.scanned} títulos analisados • {metaWindow.matched} conciliados
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* CARDS KPI B2B */}
      <div className="p-3 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[9px] font-black text-slate-500 uppercase block">Contratadas Sel.</span>
            <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
              {selectedStats.count} PJ/MEI
            </span>
          </div>
          <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[9px] font-black text-slate-500 uppercase block">1. Honorários Base</span>
            <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(selectedStats.honorarios)}
            </span>
          </div>
          <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-sky-200 dark:border-sky-900/60">
            <span className="text-[9px] font-black text-sky-700 uppercase block">2. + Variável</span>
            <span className="text-sm font-black text-sky-700 dark:text-sky-300 tabular-nums">
              +{formatCurrency(selectedStats.variavel)}
            </span>
          </div>
          <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-teal-200 dark:border-teal-900/60">
            <span className="text-[9px] font-black text-teal-700 uppercase block">3. + Conectividade</span>
            <span className="text-sm font-black text-teal-700 dark:text-teal-300 tabular-nums">
              +{formatCurrency(selectedStats.conectividade)}
            </span>
          </div>
          <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-300 dark:border-blue-800">
            <span className="text-[9px] font-black text-blue-800 dark:text-blue-300 uppercase block">= Valor Bruto NF</span>
            <span className="text-sm font-black text-blue-900 dark:text-blue-200 tabular-nums">
              {formatCurrency(selectedStats.bruto)}
            </span>
          </div>
          <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-300 dark:border-rose-800">
            <span className="text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase block">(-) Glosas / Ded.</span>
            <span className="text-sm font-black text-rose-700 dark:text-rose-400 tabular-nums">
              -{formatCurrency(selectedStats.deducoes)}
            </span>
          </div>
          <div className="p-2 bg-emerald-100/80 dark:bg-emerald-950/80 rounded-xl border-2 border-emerald-500 col-span-2 sm:col-span-1">
            <span className="text-[9px] font-black text-emerald-800 dark:text-emerald-300 uppercase block">= Valor Líquido NF</span>
            <span className="text-sm font-black text-emerald-900 dark:text-emerald-200 tabular-nums">
              {formatCurrency(selectedStats.liquido)}
            </span>
          </div>
        </div>

        {/* BARRA DE BUSCA + FILTRO DE DIVERGÊNCIA + SEM TÍTULO */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar razão social, CNPJ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-52 outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {divergentCount > 0 && (
              <button
                type="button"
                onClick={() => setOnlyDivergent((p) => !p)}
                className={`px-2.5 py-1.5 text-xs font-black rounded-xl border flex items-center gap-1.5 ${
                  onlyDivergent
                    ? "bg-amber-600 text-white border-amber-700"
                    : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                }`}
              >
                <AlertTriangle size={12} />
                <span>≠ Contrato ({divergentCount})</span>
              </button>
            )}
          </div>

          {unmatchedPjs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUnmatched((p) => !p)}
              className="px-2.5 py-1.5 text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5"
            >
              {showUnmatched ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Contratadas Ativas sem Título no Omie ({unmatchedPjs.length})</span>
            </button>
          )}
        </div>

        {showUnmatched && unmatchedPjs.length > 0 && (
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-h-40 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {unmatchedPjs.map((u) => (
                <div
                  key={u.employeeId}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-[11px]"
                >
                  <div className="min-w-0">
                    <div className="font-black text-slate-800 dark:text-slate-100 truncate">
                      {u.razaoSocial}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">
                      {u.company} • {u.cnpj || "Sem CNPJ"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatCurrency(u.contractBase)}
                    </div>
                    {u.alreadyInDb && (
                      <span className="text-[9px] font-black text-emerald-700 uppercase">Já lançado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TABELA B2B EDITÁVEL */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-3">
        {isLoadingOmie ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 size={32} className="animate-spin text-teal-600 mb-3" />
            <p className="text-xs font-black uppercase tracking-wider">
              Consultando títulos PAGAR no Omie e conciliando por CNPJ / Razão Social...
            </p>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400 text-center">
            <Database size={40} className="opacity-30 mb-2" />
            <p className="text-sm font-black text-slate-600 dark:text-slate-300">
              Nenhum faturamento PJ conciliado nesta janela do Omie
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Alterne entre &quot;Venc. Mês Seguinte&quot; e &quot;Venc. Mesmo Mês&quot; acima ou importe arquivos XML de NFS-e diretamente.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-850 z-10 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-2 py-2 w-8 text-center">
                  <button type="button" onClick={handleToggleSelectAll}>
                    {visibleRows.every((r) => r.isSelected) ? (
                      <CheckSquare size={15} className="text-teal-600" />
                    ) : (
                      <Square size={15} className="text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-600">
                  Contratada (Razão Social) / CNPJ
                </th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-slate-700 text-right whitespace-nowrap">
                  Honorários Base ✏️
                </th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-sky-700 text-right bg-sky-500/10 whitespace-nowrap">
                  + Bônus ✏️
                </th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-sky-700 text-right bg-sky-500/10 whitespace-nowrap">
                  + Comissões ✏️
                </th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-sky-700 text-right bg-sky-500/10 whitespace-nowrap">
                  + Incentivos ✏️
                </th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-teal-700 text-right bg-teal-500/10 whitespace-nowrap">
                  + Conectividade ✏️
                </th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-blue-800 text-right bg-blue-500/10 whitespace-nowrap">
                  = Bruto NF
                </th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-rose-600 text-right bg-rose-500/10 whitespace-nowrap">
                  (-) Glosas/Ded. ✏️
                </th>
                <th className="px-3 py-2 text-[10px] font-black uppercase text-emerald-800 text-right bg-emerald-500/20 whitespace-nowrap">
                  = Líquido NF
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleRows.map((row) => {
                const bruto = round2(
                  row.valor_fixo +
                    row.valor_bonus +
                    row.valor_comissao +
                    row.valor_incentivos +
                    row.valor_ajuda_custo
                );
                const liquido = round2(Math.max(0, bruto - row.valor_deducoes));
                const divergent = isRowDivergent(row);
                const isExpanded = expandedRowIds.has(row.id);

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-850/40 ${
                        !row.isSelected ? "opacity-40" : ""
                      } ${row.alreadyInDb ? "bg-amber-500/5" : ""}`}
                    >
                      <td className="px-2 py-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => updateRowField(row.id, "isSelected", !row.isSelected)}
                        >
                          {row.isSelected ? (
                            <CheckSquare size={15} className="text-teal-600" />
                          ) : (
                            <Square size={15} className="text-slate-400" />
                          )}
                        </button>
                      </td>

                      <td className="px-3 py-2 align-middle">
                        <div className="flex items-start gap-1.5">
                          {row.omieTitles.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpandRow(row.id)}
                              className="p-0.5 mt-0.5 rounded text-slate-400 hover:text-teal-600"
                              title="Auditar títulos individuais do Omie"
                            >
                              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </button>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                                {row.razaoSocial}
                              </span>
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                                {row.matchMethod === "XML_NFSE"
                                  ? "XML NFS-e"
                                  : `${row.titlesCount} título${row.titlesCount === 1 ? "" : "s"}`}
                              </span>
                              {row.alreadyInDb && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                  Já Lançado ({formatCurrency(row.existingDbLiquido || 0)})
                                </span>
                              )}
                              {divergent && (
                                <span
                                  className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300"
                                  title={`Contrato vigente: ${formatCurrency(row.contractBase)} | Omie/NF Base: ${formatCurrency(row.valor_fixo)}`}
                                >
                                  ≠ Contrato ({formatCurrency(row.contractBase)})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {row.company} • {row.linkType} • {row.cnpj || "CNPJ n/d"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {(
                        [
                          "valor_fixo",
                          "valor_bonus",
                          "valor_comissao",
                          "valor_incentivos",
                          "valor_ajuda_custo",
                        ] as const
                      ).map((field) => (
                        <td key={field} className="px-2 py-2 text-right align-middle">
                          <input
                            type="number"
                            step="0.01"
                            value={row[field] === 0 ? "" : row[field]}
                            onChange={(e) =>
                              updateRowField(row.id, field, parseFloat(e.target.value) || 0)
                            }
                            placeholder="0,00"
                            className="w-20 px-1.5 py-1 text-xs font-bold text-right bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </td>
                      ))}

                      <td className="px-2 py-2 text-right tabular-nums font-black text-blue-900 dark:text-blue-200 align-middle bg-blue-500/5 whitespace-nowrap">
                        {formatCurrency(bruto)}
                      </td>

                      <td className="px-2 py-2 text-right align-middle bg-rose-500/5">
                        <input
                          type="number"
                          step="0.01"
                          value={row.valor_deducoes === 0 ? "" : row.valor_deducoes}
                          onChange={(e) =>
                            updateRowField(row.id, "valor_deducoes", parseFloat(e.target.value) || 0)
                          }
                          placeholder="0,00"
                          className="w-20 px-1.5 py-1 text-xs font-bold text-right text-rose-700 bg-white dark:bg-slate-950 border border-rose-300 rounded-lg outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </td>

                      <td className="px-3 py-2 text-right tabular-nums font-black align-middle bg-emerald-500/10 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 text-emerald-900 dark:text-emerald-200">
                          {formatCurrency(liquido)}
                        </span>
                      </td>
                    </tr>

                    {isExpanded && row.omieTitles.length > 0 && (
                      <tr className="bg-slate-50/90 dark:bg-slate-950/60">
                        <td colSpan={10} className="px-6 py-2.5">
                          <div className="text-[10px] font-black uppercase text-teal-700 mb-1.5">
                            Títulos Omie Consolidados ({row.omieTitles.length})
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                            {row.omieTitles.map((t, idx) => (
                              <div
                                key={`${t.omieId}-${idx}`}
                                className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {t.categoria}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Venc: {t.dataVencimento} • {t.status}
                                    {t.numeroDocumento ? ` • Doc ${t.numeroDocumento}` : ""}
                                  </div>
                                </div>
                                <span className="font-black text-slate-900 dark:text-white tabular-nums shrink-0">
                                  {formatCurrency(t.valor)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* RODAPÉ DE GRAVAÇÃO B2B */}
      <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <strong className="text-slate-900 dark:text-white">{selectedStats.count}</strong> contratadas selecionadas • Valor Líquido NF:{" "}
          <strong className="text-emerald-700 dark:text-emerald-400">{formatCurrency(selectedStats.liquido)}</strong>
        </div>

        <button
          type="button"
          disabled={isCommitting || selectedStats.count === 0}
          onClick={handleCommitPjBatch}
          className="min-h-[44px] px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md disabled:opacity-50"
        >
          {isCommitting ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          <span>{isCommitting ? "Gravando Conciliação PJ..." : "Gravar Faturamentos PJ/MEI"}</span>
        </button>
      </div>
    </div>
  );
}
