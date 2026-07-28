"use client";

import { useState } from "react";
import { Employee, getRemunerationLabel, inferEntityType } from "@/types/loans";
import { Building2, Clock, AlertCircle, Phone, Copy, Check, UserRound, Calendar, MapPin } from "lucide-react";
import { 
  isExternalEntity, 
  formatWhatsAppLink, 
  PeopleClassificationBadge, 
  RelationshipNatureBadge, 
  PeopleHealthBadge,
  formatCompanyTime,
  getCompanyLogoUrl
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
  hasNoGrade?: boolean;
  noRaiseMonths?: number;
  noPromoMonths?: number;
  noGradeMonths?: number;
  historicoCustoTotal?: number; // Soma total do custo histórico
  historicoCustoMedio?: number; // Média mensal do custo histórico
  expandAll?: boolean;
  onFilterSelect?: (type: 'company' | 'department' | 'job_role' | 'responsible_name' | 'linkType' | 'nature' | 'name' | 'level', value: string) => void;
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
  onEdit,
  showValues,
  hasAuditIssues = false,
  hasGlosa,
  hasLoan,
  hasNoRaise,
  hasNoPromo,
  hasNoGrade,
  noRaiseMonths,
  noPromoMonths,
  noGradeMonths,
  historicoCustoTotal,
  historicoCustoMedio,
  expandAll = false,
  onFilterSelect,
}: PeopleMobileCardProps) {
  const [copied, setCopied] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopyPix = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!employee.pix_key) return;
    navigator.clipboard.writeText(employee.pix_key).then(() => {
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    });
  };

  const statusStyle = STATUS_STYLES[employee.status] ?? "bg-slate-50 text-slate-600 border-slate-200";
  const remLabel = getRemunerationLabel(employee.linkType);
  const resolvedEntityType = inferEntityType(employee);
  const isExternal = isExternalEntity(resolvedEntityType);

  // Razão Social só aparece para entidades externas (PJ/MEI); CLT usa sempre o nome pessoal
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

  const expiryFormatted = employee.contract_expiry_date
    ? new Date(employee.contract_expiry_date + "T12:00:00").toLocaleDateString("pt-BR")
    : null;

  const isExpiringSoon = employee.contract_expiry_date ? (() => {
    const expiry = new Date(employee.contract_expiry_date + 'T12:00:00');
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 10;
  })() : false;

  const waLink = formatWhatsAppLink(employee.phone_professional);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = employee.executive_link || `${window.location.origin}/people?employeeId=${employee.id}&tab=fichaExecutiva`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isExpanded = expandAll || isHovered;

  const hasAnyAlert = hasGlosa || hasLoan || hasNoRaise || hasNoPromo || hasNoGrade;

  return (
    <div
      className={`bg-white rounded-2xl border transition-all hover:shadow-md p-4 active:scale-[0.99] cursor-pointer relative ${
        isExternal ? "border-amber-200/60 bg-gradient-to-br from-white to-amber-50/10" : "border-slate-200"
      }`}
      onClick={() => setIsHovered(!isHovered)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && setIsHovered(!isHovered)}
      aria-label={`Alternar detalhes de ${displayName}`}
    >
      {/* Indicadores de Status & Logotipo da Empresa no topo direito */}
      <div className="absolute top-3.5 right-4 flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
        {/* Linha superior: Alertas de Auditoria + Badge de Status */}
        <div className="flex items-center gap-1.5">
          {hasAuditIssues && (
            <span className="text-amber-500 shrink-0 cursor-help" title="Possui pendências de auditoria">
              <AlertCircle size={14} className="fill-amber-50" />
            </span>
          )}
          <span className={`text-[9px] font-black border uppercase px-2 py-0.5 rounded-full shrink-0 ${statusStyle}`}>
            {employee.status}
          </span>
        </div>

        {/* Linha inferior (Embaixo do Status): Apenas o Logotipo da Empresa do Vínculo */}
        {employee.company && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onFilterSelect?.('company', employee.company);
            }}
            className="inline-flex items-center justify-center px-1.5 py-0.5 bg-white/90 hover:bg-slate-50 border border-slate-200/80 rounded-lg cursor-pointer transition-all shrink-0 shadow-2xs hover:scale-105"
            title={`Empresa do Vínculo: ${employee.company} (Clique para filtrar)`}
          >
            <img 
              src={getCompanyLogoUrl(employee.company)} 
              alt={employee.company} 
              className="h-4 max-w-[55px] object-contain shrink-0" 
            />
          </div>
        )}
      </div>

      <div className="flex items-start gap-3">
        {/* Avatar / Logo & Classification Badge beneath (Tapping/Clicking opens ProfileDrawer) */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onClick(employee.id);
          }}
          className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
          title="Clique na foto para abrir a Ficha do integrante"
        >
          {isExternal && !(employee.photo_url || employee.avatar) ? (
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 shadow-inner hover:scale-105 transition-transform">
              <Building2 size={22} />
            </div>
          ) : (
            <img
              src={avatarSrc}
              alt={displayName}
              className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 shadow-sm hover:scale-105 transition-transform"
            />
          )}
          {/* Nível e Grau (letra+número+estrelas) abaixo da foto */}
          <PeopleClassificationBadge level={employee.nivel} degree={employee.grau} />
        </div>

        <div className="flex-1 min-w-0 pr-24">
          <div className="flex items-center gap-1">
            <p 
              onClick={(e) => {
                e.stopPropagation();
                onFilterSelect?.('name', displayName);
              }}
              className="font-black text-sm text-slate-900 truncate tracking-tight hover:underline cursor-pointer"
              title="Filtrar por este integrante"
            >
              {displayName}
            </p>
          </div>

          {/* Subtítulos */}
          {isExternal ? (
            <div className="mt-0.5 space-y-0.5">
              {employee.responsible_name && (
                <p 
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterSelect?.('responsible_name', employee.responsible_name || '');
                  }}
                  className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  title="Filtrar por este representante"
                >
                  <UserRound size={10} className="text-slate-400" />
                  RL: {employee.responsible_name.toUpperCase()}
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
                <p 
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterSelect?.('job_role', employee.job_role || '');
                  }}
                  className="text-[10px] text-slate-500 font-medium truncate hover:underline cursor-pointer"
                  title="Filtrar por este cargo"
                >
                  {employee.job_role}
                </p>
              )}
            </div>
          )}

          {/* Local de Prestação do Serviço (se preenchido) */}
          {employee.service_location && (
            <p 
              onClick={(e) => {
                e.stopPropagation();
                onFilterSelect?.('location' as any, employee.service_location || '');
              }}
              className="text-[10px] font-bold text-amber-800 flex items-center gap-1 mt-1 hover:underline cursor-pointer truncate"
              title="Local de Prestação do Serviço"
            >
              <MapPin size={10} className="text-amber-500 shrink-0" />
              <span>Local: {employee.service_location}</span>
            </p>
          )}

          {/* Emojis dos indicadores (alertas) acima do vínculo */}
          {hasAnyAlert && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {hasGlosa && <span title="Houve Glosa na NF" className="text-[11px] cursor-help">⚠️</span>}
              {hasLoan && <span title="Possui Empréstimo Ativo" className="text-[11px] cursor-help">💸</span>}
              {hasNoRaise && <span title={`Mesmo Valor Base há mais de ${noRaiseMonths} meses`} className="text-[11px] cursor-help">⏳</span>}
              {hasNoPromo && <span title={`Mesmo Nível há mais de ${noPromoMonths} meses`} className="text-[11px] cursor-help">🎯</span>}
              {hasNoGrade && <span title={`Mesmo Grau há mais de ${noGradeMonths} meses`} className="text-[11px] cursor-help">⭐</span>}
            </div>
          )}

          {/* Badges do Cockpit (Vínculo) */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span 
              onClick={(e) => {
                e.stopPropagation();
                if (employee.relationshipNature) onFilterSelect?.('nature', employee.relationshipNature);
              }}
              className="cursor-pointer hover:scale-105 transition-transform"
              title="Filtrar por esta natureza de relação"
            >
              <RelationshipNatureBadge nature={employee.relationshipNature} />
            </span>
          </div>
        </div>
      </div>

      {/* Detalhes expansíveis (Setor, Início, Vencimento, Custo, PIX, Rodapé) */}
      <div 
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded 
            ? "max-h-[500px] opacity-100 mt-4 pt-3 border-t border-slate-100" 
            : "max-h-0 opacity-0 mt-0 pt-0 border-t-0 border-transparent"
        }`}
      >
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (employee.department) onFilterSelect?.('department', employee.department);
              }}
              className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 cursor-pointer group/dept"
              title="Filtrar por este setor"
            >
              <Building2 size={12} className="group-hover/dept:text-indigo-600" />
              <span className="text-[11px] font-semibold text-slate-600 group-hover/dept:underline">
                {employee.department || "Sem Setor"}
              </span>
            </div>

            {employee.service_location && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterSelect?.('location' as any, employee.service_location || '');
                }}
                className="flex items-center gap-1.5 text-slate-500 hover:text-amber-600 cursor-pointer group/loc"
                title="Local de Prestação do Serviço"
              >
                <MapPin size={12} className="text-amber-500 group-hover/loc:text-amber-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-700 group-hover/loc:underline truncate">
                  Local: {employee.service_location}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock size={12} />
                <span className="text-[10px] text-slate-400">
                  {startFormatted}
                </span>
              </div>
              {employee.start_date && (
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full ml-4 self-start">
                  {formatCompanyTime(employee.start_date)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 mt-1">
              <Calendar size={12} className={isExpiringSoon ? "text-amber-500" : "text-slate-400"} />
              {employee.contract_expiry_date ? (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className={`text-[10px] font-semibold ${isExpiringSoon ? "text-amber-600 font-bold" : "text-slate-500"}`}>
                    Vence: {expiryFormatted}
                  </span>
                  {isExpiringSoon && (
                    <span className="text-[8px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-1 rounded animate-pulse">
                      EXPIRANDO
                    </span>
                  )}
                </div>
              ) : (
                <span className={`text-[10px] font-bold ${
                  employee.linkType === 'PJ' 
                    ? "text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded text-[8px]" 
                    : "text-slate-500 font-medium"
                }`}>
                  {employee.linkType === 'PJ' ? "Falta Vencimento" : "Vence: Indeterminado"}
                </span>
              )}
            </div>
          </div>

          {showValues && employee.remuneration > 0 ? (
            <div className="text-right flex flex-col items-end">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                {remLabel.short}
              </p>
              <p className="text-sm font-black text-emerald-600 tabular-nums">
                {BRL.format(employee.remuneration)}
              </p>
              {/* Detalhamento de Base e Bônus */}
              <div className="mt-0.5 flex flex-col items-end text-[10px] text-slate-400 font-medium">
                {employee.remuneration_fixed !== undefined && employee.remuneration_fixed > 0 && (
                  <span className="tabular-nums">Base: {BRL.format(employee.remuneration_fixed)}</span>
                )}
                {employee.remuneration_bonus !== undefined && employee.remuneration_bonus > 0 && (
                  <span className="tabular-nums text-indigo-500 font-semibold">Bônus: {BRL.format(employee.remuneration_bonus)}</span>
                )}
                {employee.remuneration_commission !== undefined && employee.remuneration_commission > 0 && (
                  <span className="tabular-nums text-purple-500 font-semibold">Comissão: {BRL.format(employee.remuneration_commission)}</span>
                )}
              </div>
              {/* Custo Histórico */}
              {showValues && (historicoCustoTotal !== undefined || historicoCustoMedio !== undefined) && (
                <div className="mt-1 space-y-0.5">
                  {historicoCustoTotal !== undefined && historicoCustoTotal > 0 && (
                    <p className="text-[9px] text-slate-400">
                      Total hist. <span className="font-bold text-slate-600 tabular-nums">{BRL.format(historicoCustoTotal)}</span>
                    </p>
                  )}
                  {historicoCustoMedio !== undefined && historicoCustoMedio > 0 && (
                    <p className="text-[9px] text-slate-400">
                      Média/mês <span className="font-bold text-slate-600 tabular-nums">{BRL.format(historicoCustoMedio)}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-right">
              <span className="text-[10px] text-slate-400 italic">
                {showValues ? "Sem custos" : "Valores ocultos"}
              </span>
            </div>
          )}
        </div>

        {/* Chave PIX se cadastrada */}
        {employee.pix_key && (
          <div className="mt-3 p-2 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-2 group/pix hover:bg-slate-100/50 hover:border-slate-200 transition-all">
            <div className="min-w-0 flex-1 flex items-center gap-2 pl-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-200/50 px-1.5 py-0.5 rounded shrink-0">PIX</span>
              <span className="text-[10px] font-mono font-bold text-slate-700 truncate block">{employee.pix_key}</span>
            </div>
            <button 
              onClick={handleCopyPix}
              className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[9px] font-black shrink-0 shadow-sm ${
                copiedPix
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-white hover:bg-slate-50 text-slate-500 border-slate-200"
              }`}
              title="Copiar Chave PIX"
            >
              {copiedPix ? <Check size={11} /> : <Copy size={11} />}
              {copiedPix ? "Copiado!" : "Copiar"}
            </button>
          </div>
        )}

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

            {/* Abrir Ficha */}
            <button
              onClick={() => onClick(employee.id)}
              className="text-[10px] text-indigo-600 hover:text-indigo-850 font-black hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors border border-indigo-100 hover:border-indigo-200 shadow-sm"
              title="Abrir a Ficha completa deste integrante"
            >
              Ficha
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
    </div>
  );
}
