"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  RefreshCw,
  Download,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Calendar,
  User,
  FileText,
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface OmieCandidate {
  omie_id: string;
  omie_key: string;
  company_name: string;
  nota_fiscal: string;
  numero_nf: string;
  client_code: string;
  client_name: string;
  contract_name: string;
  contract_number: string;
  // Categoria e Projeto Omie
  categoria_code: string;
  categoria_desc: string;
  projeto_code: string;
  projeto_nome: string;
  // Datas
  date_registration: string;
  date_issue: string;
  date_due: string;
  date_payment: string;
  // Valores
  valor_bruto: number;
  valor_liquido: number;
  glosa: number;
  impostos: number;
  status: string;
  // Impostos
  tax_ir: number;
  tax_pis: number;
  tax_cofins: number;
  tax_iss: number;
  tax_inss: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contratos: { id: string; nome_contrato: string }[];
  onImport: (selected: OmieCandidate[], contratoMap: Record<string, string>) => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (v: number) => fmt.format(v);

const formatDateDisplay = (iso?: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

// Estado inicial centralizado para reset limpo
const defaultFormState = () => ({
  startDate: (() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  })(),
  endDate: new Date().toISOString().slice(0, 10),
  filterBy: "date_registration" as "date_registration" | "date_issue" | "date_due",
  company: "ALL" as "ALL" | "Mar Brasil" | "DZM",
});

// ─── Componente ──────────────────────────────────────────────────────────────

export function OmieImportModal({ isOpen, onClose, contratos, onImport }: Props) {
  const [startDate,  setStartDate]    = useState(defaultFormState().startDate);
  const [endDate,    setEndDate]      = useState(defaultFormState().endDate);
  const [filterBy,   setFilterBy]     = useState(defaultFormState().filterBy);
  const [company,    setCompany]      = useState(defaultFormState().company);

  const [step, setStep]               = useState<"params" | "auditing" | "importing">("params");
  const [candidates, setCandidates]   = useState<OmieCandidate[]>([]);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [contratoMap, setContratoMap] = useState<Record<string, string>>({});
  const [logs, setLogs]               = useState<string[]>([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Resetar COMPLETAMENTE ao abrir o modal (corrige o bug de dados persistentes) ──
  useEffect(() => {
    if (isOpen) {
      const defaults = defaultFormState();
      setStartDate(defaults.startDate);
      setEndDate(defaults.endDate);
      setFilterBy(defaults.filterBy);
      setCompany(defaults.company);
      setStep("params");
      setCandidates([]);
      setSelected(new Set());
      setExpanded(new Set());
      setContratoMap({});
      setLogs([]);
      setIsLoading(false);
      setImportError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Step 1 → buscar no Omie ───────────────────────────────────────────────
  const handleSearch = async () => {
    setIsLoading(true);
    setLogs([]);
    setImportError(null);

    try {
      const res = await fetch("/api/recebiveis/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, filterBy, company }),
      });

      const data = await res.json();
      setLogs(data.logs || []);

      if (!res.ok || data.status === "error") {
        setImportError(data.message || "Erro desconhecido na busca ao Omie.");
        return;
      }

      const list: OmieCandidate[] = data.candidates || [];
      setCandidates(list);
      setSelected(new Set(list.map((c) => c.omie_key)));
      const initMap: Record<string, string> = {};
      list.forEach((c) => { initMap[c.omie_key] = ""; });
      setContratoMap(initMap);
      setStep("auditing");

    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Seleção / expansão ────────────────────────────────────────────────────
  const toggleSelect  = (key: string) => setSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleExpand  = (key: string) => setExpanded((prev)  => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleAll = () => {
    setSelected(selected.size === candidates.length
      ? new Set()
      : new Set(candidates.map((c) => c.omie_key))
    );
  };

  // ── Voltar aos parâmetros limpando os resultados anteriores ───────────────
  const handleBack = () => {
    setStep("params");
    setCandidates([]);
    setSelected(new Set());
    setExpanded(new Set());
    setContratoMap({});
    setImportError(null);
    setLogs([]);
  };

  // ── Step 2 → importar selecionados ───────────────────────────────────────
  const handleImport = async () => {
    const toImport = candidates.filter((c) => selected.has(c.omie_key));
    if (toImport.length === 0) {
      setImportError("Selecione ao menos um lançamento para importar.");
      return;
    }
    setStep("importing");
    setImportError(null);
    try {
      await onImport(toImport, contratoMap);
      onClose();
    } catch (err: any) {
      setImportError(err.message || "Erro ao importar os lançamentos.");
      setStep("auditing");
    }
  };

  const allSelected  = selected.size === candidates.length && candidates.length > 0;
  const someSelected = selected.size > 0 && !allSelected;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={step === "params" ? onClose : undefined}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Download size={18} className="text-amber-500" />
              {step === "params"
                ? "Importar do Omie ERP"
                : step === "auditing"
                ? `Auditoria — ${candidates.length} lançamento(s) encontrado(s)`
                : "Importando lançamentos…"}
            </h2>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              {step === "params"
                ? "Defina o período e critério de busca nos dados do Omie."
                : step === "auditing"
                ? "Revise cada lançamento, vincule ao contrato e selecione o que importar."
                : "Gravando os lançamentos selecionados no banco de dados…"}
            </p>
          </div>

          {step !== "importing" && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── STEP 1 — Parâmetros ─────────────────────────────────────────── */}
        {step === "params" && (
          <>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Empresa */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                  Empresa no Omie
                </label>
                <div className="flex gap-2">
                  {(["ALL", "Mar Brasil", "DZM"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setCompany(opt)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${
                        company === opt
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-slate-200 text-slate-500 hover:border-amber-300"
                      }`}
                    >
                      {opt === "ALL" ? "Todas" : opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Critério de data */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                  Filtrar por
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  {[
                    { value: "date_registration", label: "📌 Data de Registro (Contábil)" },
                    { value: "date_issue",        label: "📄 Data de Lançamento" },
                    { value: "date_due",          label: "📅 Data de Vencimento" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setFilterBy(value as any)}
                      className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-left ${
                        filterBy === value
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-slate-200 text-slate-500 hover:border-amber-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Período */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Data Inicial</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Data Final</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 bg-white"
                  />
                </div>
              </div>

              {/* Erro */}
              {importError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700">
                  <AlertTriangle size={14} className="shrink-0" />
                  {importError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-500 hover:text-slate-700 transition-all">
                Cancelar
              </button>
              <button
                onClick={handleSearch}
                disabled={isLoading || !startDate || !endDate}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md disabled:opacity-50"
              >
                {isLoading ? (
                  <><Loader2 size={14} className="animate-spin" />Buscando no Omie…</>
                ) : (
                  <><RefreshCw size={14} />Buscar no Omie</>
                )}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2 — Auditoria ──────────────────────────────────────────── */}
        {step === "auditing" && (
          <>
            {/* Barra de seleção global + resumo do período buscado */}
            <div className="px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-xs font-black text-slate-600 hover:text-amber-700 transition-colors"
                >
                  {allSelected
                    ? <CheckSquare size={16} className="text-amber-500" />
                    : someSelected
                    ? <CheckSquare size={16} className="text-slate-300" />
                    : <Square size={16} className="text-slate-300" />}
                  {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                </button>
                <span className="text-[10px] text-slate-400 font-semibold">
                  📌 {filterBy === "date_registration" ? "Registro" : filterBy === "date_issue" ? "Lançamento" : "Vencimento"} ·{" "}
                  {formatDateDisplay(startDate)} → {formatDateDisplay(endDate)} · {company === "ALL" ? "Todas as empresas" : company}
                </span>
              </div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                {selected.size} / {candidates.length} selecionado(s)
              </span>
            </div>

            {/* Logs compactos */}
            {logs.length > 0 && (
              <div className="px-6 pt-3">
                <div className="bg-slate-50 rounded-xl border border-slate-200 px-3 py-2 space-y-0.5 max-h-16 overflow-y-auto">
                  {logs.map((l, i) => (
                    <p key={i} className="text-[10px] font-mono text-slate-500">{l}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de candidatos */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {candidates.length === 0 ? (
                <div className="py-12 text-center">
                  <AlertTriangle size={32} className="mx-auto mb-3 text-amber-400" />
                  <p className="text-sm font-bold text-slate-600">Nenhum lançamento encontrado no período.</p>
                  <p className="text-xs text-slate-400 mt-1">Tente ajustar as datas ou o critério de busca.</p>
                </div>
              ) : (
                candidates.map((c) => {
                  const isSelected = selected.has(c.omie_key);
                  const isExpanded = expanded.has(c.omie_key);

                  return (
                    <div
                      key={c.omie_key}
                      className={`rounded-xl border transition-all ${
                        isSelected
                          ? "border-amber-400 bg-amber-50/40"
                          : "border-slate-200 bg-white opacity-60"
                      }`}
                    >
                      {/* ── Linha principal ───────────────────────────── */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Checkbox */}
                        <button onClick={() => toggleSelect(c.omie_key)} className="shrink-0">
                          {isSelected
                            ? <CheckSquare size={18} className="text-amber-500" />
                            : <Square size={18} className="text-slate-300" />}
                        </button>

                        {/* Empresa badge */}
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 shrink-0 hidden sm:block">
                          {c.company_name}
                        </span>

                        {/* NF + NF número limpo */}
                        <div className="shrink-0 text-center min-w-[60px]">
                          <p className="text-[9px] font-black text-slate-400 uppercase">NF</p>
                          <p className="text-xs font-black text-slate-800">{c.numero_nf || "S/N"}</p>
                        </div>

                        {/* Separador */}
                        <div className="w-px h-8 bg-slate-200 shrink-0 hidden sm:block" />

                        {/* Cliente + Contrato */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-800 truncate flex items-center gap-1">
                            <User size={11} className="text-slate-400 shrink-0" />
                            {c.client_name}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500 truncate flex items-center gap-1">
                            <FileText size={10} className="text-slate-400 shrink-0" />
                            {c.contract_name || c.contract_number || "Projeto Omie"}
                            {c.contract_number && c.contract_name && ` (${c.contract_number})`}
                          </p>
                        </div>

                        {/* Status */}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                          c.status === "Pago"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-amber-50 text-amber-700 border border-amber-200/60"
                        }`}>
                          {c.status}
                        </span>

                        {/* Vencimento ou Pagamento */}
                        <div className="text-right shrink-0 hidden md:block">
                          {c.status === "Pago" && c.date_payment ? (
                            <>
                              <p className="text-[9px] text-emerald-500 font-black uppercase">Recebido</p>
                              <p className="text-xs font-bold text-emerald-700">{formatDateDisplay(c.date_payment)}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-[9px] text-slate-400 font-black uppercase">Venc.</p>
                              <p className="text-xs font-bold text-slate-700">{formatDateDisplay(c.date_due)}</p>
                            </>
                          )}
                        </div>

                        {/* Valor bruto */}
                        <div className="text-right shrink-0">
                          <p className="text-[9px] text-slate-400 font-black uppercase">Bruto</p>
                          <p className="text-xs font-black text-slate-800">{formatCurrency(c.valor_bruto)}</p>
                        </div>

                        {/* Líquido */}
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-[9px] text-slate-400 font-black uppercase">Líquido</p>
                          <p className="text-xs font-black text-emerald-700">{formatCurrency(c.valor_liquido)}</p>
                        </div>

                        {/* Expand toggle */}
                        <button onClick={() => toggleExpand(c.omie_key)} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {/* ── Painel expandido ──────────────────────────── */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                          
                          {/* Identificação completa */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div className="bg-slate-50 rounded-lg px-3 py-2 col-span-2 sm:col-span-1">
                              <p className="text-[9px] font-black text-slate-400 uppercase">Cliente (Razão Social / ID Omie)</p>
                              <p className="text-xs font-bold text-slate-800 mt-0.5">{c.client_name}</p>
                              <p className="text-[10px] text-slate-400">Cód. Omie: {c.client_code}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg px-3 py-2">
                              <p className="text-[9px] font-black text-slate-400 uppercase">Nota Fiscal / Documento</p>
                              <p className="text-xs font-bold text-slate-800 mt-0.5">{c.nota_fiscal}</p>
                              <p className="text-[10px] text-slate-400">Nº: {c.numero_nf || "S/N"}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg px-3 py-2">
                              <p className="text-[9px] font-black text-slate-400 uppercase">Contrato / Projeto Omie</p>
                              <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{c.contract_name || "—"}</p>
                              <p className="text-[10px] text-slate-400">{c.contract_number || "Sem nº de contrato"}</p>
                            </div>
                          </div>

                          {/* Datas completas */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { label: "📌 Registro",   value: c.date_registration },
                              { label: "📄 Emissão",    value: c.date_issue },
                              { label: "📅 Vencimento", value: c.date_due },
                              { label: "💳 Pagamento",  value: c.date_payment },
                            ].map(({ label, value }) => (
                              <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase">{label}</p>
                                <p className="text-xs font-bold text-slate-700 mt-0.5">
                                  {value ? formatDateDisplay(value) : "—"}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Valores */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { label: "Bruto",    value: c.valor_bruto,   color: "text-slate-800" },
                              { label: "Impostos", value: c.impostos,      color: "text-red-600"   },
                              { label: "Glosa/Desc",value: c.glosa,        color: "text-orange-600"},
                              { label: "Líquido",  value: c.valor_liquido, color: "text-emerald-700" },
                            ].map(({ label, value, color }) => (
                              <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase">{label}</p>
                                <p className={`text-xs font-black mt-0.5 ${color}`}>{formatCurrency(value)}</p>
                              </div>
                            ))}
                          </div>

                          {/* Categoria e Projeto */}
                          {(c.categoria_desc || c.categoria_code || c.projeto_nome || c.projeto_code) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(c.categoria_desc || c.categoria_code) && (
                                <div className="bg-indigo-50/60 rounded-lg px-3 py-2">
                                  <p className="text-[9px] font-black text-indigo-400 uppercase">Categoria Omie</p>
                                  <p className="text-xs font-bold text-slate-800 mt-0.5">
                                    {c.categoria_desc || "—"}
                                  </p>
                                  {c.categoria_code && (
                                    <p className="text-[10px] text-slate-400">Cód: {c.categoria_code}</p>
                                  )}
                                </div>
                              )}
                              {(c.projeto_nome || c.projeto_code) && (
                                <div className="bg-violet-50/60 rounded-lg px-3 py-2">
                                  <p className="text-[9px] font-black text-violet-400 uppercase">Projeto Omie</p>
                                  <p className="text-xs font-bold text-slate-800 mt-0.5">
                                    {c.projeto_nome || "—"}
                                  </p>
                                  {c.projeto_code && (
                                    <p className="text-[10px] text-slate-400">Cód: {c.projeto_code}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Detalhamento fiscal */}
                          <div className="bg-red-50/60 rounded-lg px-3 py-2">
                            <p className="text-[9px] font-black text-red-500 uppercase mb-1">Detalhamento Fiscal Retido</p>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-600 font-semibold">
                              <span>IR: <strong>{formatCurrency(c.tax_ir)}</strong></span>
                              <span>PIS: <strong>{formatCurrency(c.tax_pis)}</strong></span>
                              <span>COFINS: <strong>{formatCurrency(c.tax_cofins)}</strong></span>
                              <span>ISS: <strong>{formatCurrency(c.tax_iss)}</strong></span>
                              <span>INSS: <strong>{formatCurrency(c.tax_inss)}</strong></span>
                            </div>
                          </div>

                          {/* Vínculo com contrato */}
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                              Vincular a Contrato Cadastrado
                              <span className="normal-case font-semibold text-amber-600 ml-1">(sem vínculo o lançamento será ignorado no rateio de comissões)</span>
                            </label>
                            <select
                              value={contratoMap[c.omie_key] || ""}
                              onChange={(e) => setContratoMap((prev) => ({ ...prev, [c.omie_key]: e.target.value }))}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 bg-white"
                            >
                              <option value="">— Não vincular a contrato (importar sem rateio) —</option>
                              {contratos.map((ct) => (
                                <option key={ct.id} value={ct.id}>{ct.nome_contrato}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Erro */}
            {importError && (
              <div className="mx-6 mb-2 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700">
                <AlertTriangle size={14} className="shrink-0" />
                {importError}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button onClick={handleBack} className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-500 hover:text-slate-700 transition-all">
                ← Nova Busca (Alterar Período)
              </button>

              <div className="flex gap-2">
                <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-500 hover:text-slate-700 transition-all">
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={selected.size === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md disabled:opacity-40"
                >
                  <CheckCircle2 size={14} />
                  Importar {selected.size} lançamento(s)
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 3 — Importing spinner ───────────────────────────────────── */}
        {step === "importing" && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 size={40} className="animate-spin text-amber-500" />
            <p className="text-sm font-bold text-slate-600">Gravando lançamentos no banco de dados…</p>
            <p className="text-xs text-slate-400">Aguarde. Isso pode levar alguns segundos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
