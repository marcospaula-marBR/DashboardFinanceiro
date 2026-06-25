"use client";

import { useState } from "react";
import { Employee, getRemunerationLabel } from "@/types/loans";
import { Building2, Clock, AlertCircle, Phone, Copy, Check, UserRound } from "lucide-react";
import { 
  isExternalEntity, 
  formatWhatsAppLink, 
  PeopleClassificationBadge, 
  RelationshipNatureBadge, 
  PeopleHealthBadge,
  formatCompanyTime
} from "./PeopleBadges";

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
  Ativo: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Férias: "bg-amber-50 text-amber-700 border-amber-100",
  Inativo: "bg-red-50 text-red-600 border-red-100",
  Provisão: "bg-blue-50 text-blue-700 border-blue-100",
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
  const [copied, setCopied] = useState(false);

  const statusStyle = STATUS_STYLES[employee.status] ?? "bg-slate-50 text-slate-600 border-slate-200";
  const remLabel = getRemunerationLabel(employee.linkType);
  const isExternal = isExternalEntity(employee.entityType);

  const displayName = isExternal && employee.corporate_name ? employee.corporate_name : employee.name;

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

  const waLink = formatWhatsAppLink(employee.phone_professional);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = employee.executive_link || `${window.location.origin}/people?employeeId=${employee.id}&tab=fichaExecutiva`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className={`bg-white rounded-2xl border transition-all hover:shadow-md p-4 active:scale-[0.99] cursor-pointer relative ${
        isExternal ? "border-amber-200/60 bg-gradient-to-br from-white to-amber-50/10" : "border-slate-200"
      }`}
      onClick={() => onClick(employee.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(employee.id)}
      aria-label={`Abrir perfil de ${displayName}`}
    >
      {/* Indicadores de Status & Alertas no topo */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {hasAuditIssues && (
          <span className="text-amber-500 shrink-0 cursor-help" title="Possui pendências de auditoria">
            <AlertCircle size={14} className="fill-amber-50" />
          </span>
        )}
        <span className={`text-[9px] font-black border uppercase px-2 py-0.5 rounded-full shrink-0 ${statusStyle}`}>
          {employee.status}
        </span>
      </div>

      <div className="flex items-start gap-3">
        {/* Avatar / Logo */}
        {isExternal ? (
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 shadow-inner">
            <Building2 size={22} />
          </div>
        ) : (
          <img
            src={avatarSrc}
            alt={displayName}
            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 shadow-sm"
          />
        )}

        <div className="flex-1 min-w-0 pr-16">
          <div className="flex items-center gap-1">
            <p className="font-black text-sm text-slate-900 truncate tracking-tight">
              {displayName}
            </p>
            <div className="flex items-center gap-0.5 shrink-0">
              {hasGlosa && <span title="Houve Glosa na NF" className="text-[11px] cursor-help">⚠️</span>}
              {hasLoan && <span title="Possui Empréstimo Ativo" className="text-[11px] cursor-help">💸</span>}
              {hasNoRaise && <span title={`Sem Revisão Valor Base há mais de ${noRaiseMonths} meses`} className="text-[11px] cursor-help">⏳</span>}
              {hasNoPromo && <span title={`Sem Nível/Função há mais de ${noPromoMonths} meses`} className="text-[11px] cursor-help">🎯</span>}
            </div>
          </div>

          {/* Subtítulos */}
          {isExternal ? (
            <div className="mt-0.5 space-y-0.5">
              {employee.responsible_name && (
                <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                  <UserRound size={10} className="text-slate-400" />
                  RT: {employee.responsible_name}
                </p>
              )}
              {employee.pj_type && (
                <p className="text-[9px] text-slate-400 font-mono">
                  CNPJ: {employee.pj_type}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-0.5">
              {employee.job_role && (
                <p className="text-[10px] text-slate-500 font-medium truncate">
                  {employee.job_role}
                </p>
              )}
            </div>
          )}

          {/* Badges do Cockpit */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <PeopleClassificationBadge level={employee.nivel} degree={employee.grau} />
            <RelationshipNatureBadge nature={employee.relationshipNature} />
          </div>
        </div>
      </div>

      {/* Meio: Setor, Cadeira, Custo */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Building2 size={12} />
            <span className="text-[11px] font-semibold text-slate-600">
              {employee.department || "Sem Setor"}
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock size={12} />
              <span className="text-[11px] text-slate-500">
                {startFormatted}
              </span>
            </div>
            {employee.start_date && (
              <span className="text-[9px] font-medium text-slate-400 ml-4">
                {formatCompanyTime(employee.start_date)}
              </span>
            )}
          </div>
        </div>

        {showValues && employee.remuneration > 0 ? (
          <div className="text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              {remLabel.short}
            </p>
            <p className="text-sm font-black text-emerald-600 tabular-nums">
              {BRL.format(employee.remuneration)}
            </p>
          </div>
        ) : (
          <div className="text-right">
            <span className="text-[10px] text-slate-400 italic">
              {showValues ? "Sem custos" : "Valores ocultos"}
            </span>
          </div>
        )}
      </div>

      {/* Rodapé: Indicador de Saúde Cadastral e Ações Rápidas */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <PeopleHealthBadge employee={employee} />
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Botão WhatsApp */}
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 rounded-lg transition-all border border-emerald-100"
              title={`Chamar no WhatsApp Profissional: ${employee.phone_professional}`}
            >
              <Phone size={13} className="fill-emerald-600/10" />
            </a>
          ) : (
            <span 
              className="p-1.5 bg-slate-50 text-slate-300 rounded-lg border border-slate-100 cursor-not-allowed"
              title="WhatsApp indisponível (Telefone Profissional ausente)"
            >
              <Phone size={13} />
            </span>
          )}

          {/* Copiar Link Executivo */}
          <button
            onClick={handleCopyLink}
            className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[10px] font-black ${
              copied
                ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
            }`}
            title="Copiar Link Executivo"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copiado!" : "Link"}
          </button>

          {/* Excluir */}
          <button
            onClick={() => onDelete(employee)}
            className="text-[10px] text-red-500 hover:text-red-700 font-bold hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-100"
            aria-label={`Excluir ${displayName}`}
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
