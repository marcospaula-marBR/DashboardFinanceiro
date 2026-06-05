"use client";
import { Employee, getRemunerationLabel } from "@/types/loans";
import { Building2, Clock, AlertCircle } from "lucide-react";

interface PeopleMobileCardProps {
  employee: Employee;
  onClick: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (employee: Employee) => void;
  showValues: boolean;
  hasAuditIssues?: boolean;
  hasGlosa?: boolean;
  hasLoan?: boolean;
  hasNoRaise?: boolean;
  hasNoPromo?: boolean;
  noRaiseMonths?: number;
  noPromoMonths?: number;
}

const STATUS_STYLES: Record<string, string> = {
  Ativo: "bg-emerald-100 text-emerald-700",
  Férias: "bg-amber-100 text-amber-700",
  Inativo: "bg-red-100 text-red-600",
  Provisão: "bg-blue-100 text-blue-700",
};

const VINCULO_STYLES: Record<string, string> = {
  CLT: "bg-blue-100 text-blue-700",
  MEI: "bg-orange-100 text-orange-700",
  PJ: "bg-orange-100 text-orange-700",
  Estagiário: "bg-purple-100 text-purple-700",
};

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function PeopleMobileCard({
  employee,
  onClick,
  onDelete,
  showValues,
  hasAuditIssues = false,
  hasGlosa,
  hasLoan,
  hasNoRaise,
  hasNoPromo,
  noRaiseMonths,
  noPromoMonths,
}: PeopleMobileCardProps) {
  const statusStyle =
    STATUS_STYLES[employee.status] ?? "bg-slate-100 text-slate-600";
  const vincStyle =
    VINCULO_STYLES[employee.linkType] ?? "bg-slate-100 text-slate-600";
  const remLabel = getRemunerationLabel(employee.linkType);

  const displayName = (employee.linkType === "PJ" || employee.linkType === "MEI") && employee.corporate_name ? employee.corporate_name : employee.name;

  const avatarSrc =
    employee.photo_url ||
    employee.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=e2e8f0&color=475569&bold=true`;

  const startFormatted = employee.start_date
    ? new Date(employee.start_date + "T12:00:00").toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 active:scale-[0.98] transition-transform"
      onClick={() => onClick(employee.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(employee.id)}
      aria-label={`Abrir perfil de ${displayName}`}
    >
      <div className="flex items-center gap-3">
        <img
          src={avatarSrc}
          alt={displayName}
          className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-sm shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-sm text-slate-900 truncate">
              {displayName}
            </p>
            {hasAuditIssues && (
              <span className="text-amber-500 shrink-0">
                <AlertCircle size={13} className="fill-amber-50" />
              </span>
            )}
            <div className="flex items-center gap-0.5 ml-1">
              {hasGlosa && <span title="Houve Glosa na NF" className="text-[13px] shrink-0 cursor-help opacity-90 hover:opacity-100 transition-opacity">⚠️</span>}
              {hasLoan && <span title="Possui Empréstimo Ativo" className="text-[13px] shrink-0 cursor-help opacity-90 hover:opacity-100 transition-opacity">💸</span>}
              {hasNoRaise && <span title={`Sem Revisão Valor Base há mais de ${noRaiseMonths} meses`} className="text-[13px] shrink-0 cursor-help opacity-90 hover:opacity-100 transition-opacity">⏳</span>}
              {hasNoPromo && <span title={`Sem Nível/Função há mais de ${noPromoMonths} meses`} className="text-[13px] shrink-0 cursor-help opacity-90 hover:opacity-100 transition-opacity">🎯</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${vincStyle}`}
            >
              {employee.linkType}
            </span>
            <span className="text-[10px] text-slate-400">•</span>
            <span className="text-[10px] text-slate-500 font-medium truncate">
              {employee.company}
            </span>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${statusStyle}`}
        >
          {employee.status}
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1 text-slate-400">
          <Clock size={11} />
          <span className="text-[11px]">{startFormatted}</span>
        </div>

        {showValues && employee.remuneration > 0 ? (
          <div className="text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase">
              {remLabel.short}
            </p>
            <p className="text-sm font-black text-emerald-600">
              {BRL.format(employee.remuneration)}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-slate-400">
            <Building2 size={11} />
            <span className="text-[11px]">
              {employee.department || employee.job_role || "—"}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(employee);
          }}
          className="text-[10px] text-red-400 hover:text-red-600 font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          aria-label={`Excluir ${displayName}`}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
