"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle, XCircle, ChevronDown, ChevronUp, Loader2, RotateCcw } from "lucide-react";
import { LoansService, formatCurrency, formatDate, AuditContractReport } from "@/services/loans.service";
import { useDataMode } from "@/contexts/DataModeContext";

interface AuditPanelProps {
  onOpenContract?: (employeeId: string) => void;
}

const healthConfig = {
  ok: {
    label: "OK",
    icon: ShieldCheck,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  revisar: {
    label: "Revisar",
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  excesso: {
    label: "Excesso",
    icon: XCircle,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    dot: "bg-red-500",
  },
} as const;

export function AuditPanel({ onOpenContract }: AuditPanelProps) {
  const { isTestMode } = useDataMode();
  const [report, setReport] = useState<AuditContractReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterHealth, setFilterHealth] = useState<"all" | "ok" | "revisar" | "excesso">("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await LoansService.getAuditReport(isTestMode);
      // Ordena: excesso primeiro, revisar segundo, ok por último
      data.sort((a, b) => {
        const order: Record<'ok' | 'revisar' | 'excesso', number> = { excesso: 0, revisar: 1, ok: 2 };
        return order[a.health as keyof typeof order] - order[b.health as keyof typeof order];
      });
      setReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [isTestMode]);

  const filtered = filterHealth === "all" ? report : report.filter(r => r.health === filterHealth);

  const counts = {
    ok: report.filter(r => r.health === "ok").length,
    revisar: report.filter(r => r.health === "revisar").length,
    excesso: report.filter(r => r.health === "excesso").length,
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-600" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
            Painel de Auditoria
          </h3>
          {!isLoading && (
            <span className="text-[10px] text-slate-400 font-semibold">
              {report.length} contratos
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filtros de saúde */}
          {(["all", "excesso", "revisar", "ok"] as const).map(f => {
            const isAll = f === "all";
            const cfg = isAll ? null : healthConfig[f];
            const cnt = isAll ? report.length : counts[f];
            return (
              <button
                key={f}
                onClick={() => setFilterHealth(f)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition border ${
                  filterHealth === f
                    ? isAll
                      ? "bg-slate-800 text-white border-slate-800"
                      : `${cfg!.bg} ${cfg!.text} ${cfg!.border}`
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                {isAll ? "Todos" : cfg!.label} ({cnt})
              </button>
            );
          })}

          <button
            onClick={load}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            title="Atualizar"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Sumário de alertas */}
      {!isLoading && (counts.excesso > 0 || counts.revisar > 0) && (
        <div className="px-4 py-2 bg-amber-50/50 border-b border-amber-100 flex items-center gap-4 text-xs">
          {counts.excesso > 0 && (
            <span className="flex items-center gap-1.5 text-red-700 font-bold">
              <XCircle size={13} />
              {counts.excesso} contrato(s) com excesso de parcelas pagas
            </span>
          )}
          {counts.revisar > 0 && (
            <span className="flex items-center gap-1.5 text-amber-700 font-bold">
              <AlertTriangle size={13} />
              {counts.revisar} contrato(s) com registros incompletos
            </span>
          )}
        </div>
      )}

      {/* Conteúdo */}
      {isLoading ? (
        <div className="p-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-600 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          Nenhum contrato encontrado
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map(row => {
            const cfg = healthConfig[row.health];
            const HIcon = cfg.icon;
            const isExpanded = expandedRows.has(row.contractId);

            return (
              <div key={row.contractId} className="transition-colors hover:bg-slate-50/60">
                {/* Linha principal */}
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                  onClick={() => toggleRow(row.contractId)}
                >
                  {/* Health dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

                  {/* Nome + valor */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {row.employeeName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {formatCurrency(row.amount)} · {row.expectedInstallments}x parcelas
                      {row.requestDate ? ` · ${formatDate(row.requestDate)}` : ""}
                    </p>
                  </div>

                  {/* Contadores */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Pago</p>
                      <p className="text-xs font-black text-emerald-600">{row.paidCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Pendente</p>
                      <p className="text-xs font-black text-amber-600">{row.pendingCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Esperado</p>
                      <p className="text-xs font-black text-slate-700">{row.expectedInstallments}</p>
                    </div>
                  </div>

                  {/* Badge de saúde */}
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border} border shrink-0`}>
                    <HIcon size={10} />
                    {cfg.label}
                  </span>

                  {/* Expand toggle */}
                  {isExpanded
                    ? <ChevronUp size={14} className="text-slate-400 shrink-0" />
                    : <ChevronDown size={14} className="text-slate-400 shrink-0" />
                  }
                </div>

                {/* Detalhes expandidos */}
                {isExpanded && (
                  <div className="px-4 pb-4">
                    {row.health !== "ok" && (
                      <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                        {row.health === "excesso" && (
                          <>⚠️ Este contrato tem <strong>{row.paidCount}</strong> parcelas marcadas como PAGO, mas só deveria ter <strong>{row.expectedInstallments}</strong>. Excesso: <strong>+{row.excess}</strong>. Abra o contrato e use o botão "Estornar" na parcela incorreta.</>
                        )}
                        {row.health === "revisar" && (
                          <>⚠️ Há apenas <strong>{row.totalRecorded}</strong> registro(s) de parcela no banco, mas o contrato tem <strong>{row.expectedInstallments}</strong> previstas. Pode haver parcelas não geradas.</>
                        )}
                      </div>
                    )}

                    {/* Mini timeline das parcelas */}
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {row.payments
                        .sort((a, b) => a.due_date.localeCompare(b.due_date))
                        .map((p, idx) => {
                          const statusColor =
                            p.status === "PAGO"
                              ? "text-emerald-600"
                              : p.status === "PENDENTE"
                              ? "text-slate-500"
                              : "text-amber-600";
                          return (
                            <div key={p.id} className="flex items-center gap-3 py-1 text-[10px]">
                              <span className="text-slate-400 font-mono w-4">{idx + 1}</span>
                              <span className="text-slate-600 font-medium w-20">
                                {formatDate(p.due_date)}
                              </span>
                              <span className={`font-bold uppercase ${statusColor}`}>
                                {p.status}
                              </span>
                              <span className="text-slate-500 font-mono ml-auto">
                                R$ {p.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          );
                        })}
                    </div>

                    {/* Link para abrir no drawer */}
                    <p className="mt-3 text-[10px] text-slate-400 italic">
                      Para corrigir parcelas, abra o colaborador na tabela principal e expanda o contrato.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
