"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, History, Loader2, RotateCcw } from "lucide-react";
import {
  ImportSnapshotRecord,
  listRecentImportSnapshots,
  rollbackImportSnapshot,
} from "@/services/people-cost-import-audit.service";
import { formatCurrency } from "@/services/loans.service";

interface ImportSnapshotsHistoryPanelProps {
  onRollbackSuccess: () => void;
}

const SCOPE_LABELS: Record<ImportSnapshotRecord["scope"], string> = {
  CLT_FOLHA: "Folha CLT",
  CLT_BENEFICIOS: "Benefícios CLT",
  PJ_OMIE: "Conciliação PJ (Omie)",
  PJ_NFSE: "XML NFS-e (PJ)",
  EXCEL_RETROATIVO: "Planilha Excel",
};

export function ImportSnapshotsHistoryPanel({
  onRollbackSuccess,
}: ImportSnapshotsHistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<ImportSnapshotRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listRecentImportSnapshots(8);
      setSnapshots(list);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const handleRollback = async (snap: ImportSnapshotRecord) => {
    const ok = window.confirm(
      `Deseja desfazer o lote "${snap.fileName}" da competência ${snap.competencia.slice(0, 7)}?\n\n` +
        `• ${snap.previousRowsCount} lançamento(s) anterior(es) serão restaurados.\n` +
        `• ${snap.newlyCreatedCount} lançamento(s) criado(s) exclusivamente neste lote serão removidos.`
    );
    if (!ok) return;

    try {
      setRollingBackId(snap.id);
      const res = await rollbackImportSnapshot(snap.id);
      alert(
        `Rollback concluído para ${res.competencia.slice(0, 7)}: ${res.restoredCount} restaurado(s) e ${res.deletedCount} removido(s).`
      );
      await loadSnapshots();
      onRollbackSuccess();
    } catch (err) {
      alert(
        `Falha ao desfazer lote: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setRollingBackId(null);
    }
  };

  if (!isLoading && snapshots.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto mt-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="w-full min-h-[44px] px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200">
          <History size={15} className="text-emerald-600 shrink-0" />
          <span>Histórico de Lotes Gravados &amp; Rollback (1-Clique)</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {snapshots.length}
          </span>
        </div>
        {isOpen ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-2">
          {isLoading ? (
            <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              <span>Carregando snapshots de auditoria...</span>
            </div>
          ) : (
            snapshots.map((snap) => {
              const dt = snap.createdAt
                ? new Date(snap.createdAt).toLocaleString("pt-BR")
                : "—";
              return (
                <div
                  key={snap.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-slate-800 dark:text-slate-100">
                        {SCOPE_LABELS[snap.scope] || snap.scope}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                        {snap.competencia.slice(0, 7)}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[240px]">
                        {snap.fileName}
                      </span>
                      {snap.rolledBack && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          Revertido
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {dt} • {snap.totalRowsCommitted} registros •{" "}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {formatCurrency(snap.totalAmountCommitted)}
                      </strong>{" "}
                      • motor: {snap.engine}
                    </div>
                  </div>

                  {!snap.rolledBack && (
                    <button
                      type="button"
                      disabled={rollingBackId === snap.id}
                      onClick={() => handleRollback(snap)}
                      className="min-h-[36px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 hover:bg-rose-50 text-rose-700 dark:text-rose-400 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {rollingBackId === snap.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                      <span>Desfazer Lote</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
