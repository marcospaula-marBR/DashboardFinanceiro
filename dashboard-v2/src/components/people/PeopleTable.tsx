"use client";

import { useState } from "react";
import { Trash2, UserCog, AlertCircle, Phone, Copy, Check, Building2, UserRound } from "lucide-react";
import { Employee, AuditIssue } from "@/types/loans";
import { getRemunerationLabel } from "@/types/loans";
import { formatCurrency } from "@/services/loans.service";
import { PeopleMobileCard } from "./PeopleMobileCard";
import { 
  isExternalEntity, 
  formatWhatsAppLink, 
  PeopleClassificationBadge, 
  RelationshipNatureBadge, 
  PeopleHealthBadge,
  formatCompanyTime
} from "./PeopleBadges";

interface PeopleTableProps {
  employees: Employee[];
  onEdit: (id: string) => void;
  onDelete: (employee: Employee) => void;
  onEmployeeClick: (id: string) => void;
  showValues: boolean;
  auditIssues?: Record<string, AuditIssue[]>;
  noRaiseMonths?: number;
  noPromoMonths?: number;
}

const STATUS_STYLES: Record<string, string> = {
  Ativo: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Férias: 'bg-amber-50 text-amber-700 border-amber-100',
  Inativo: 'bg-red-50 text-red-600 border-red-100',
  Provisão: 'bg-blue-50 text-blue-700 border-blue-100',
  default: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function PeopleTable({ employees, onEdit, onDelete, onEmployeeClick, showValues, auditIssues = {}, noRaiseMonths, noPromoMonths }: PeopleTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(employees.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEmployees = employees.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleCopyLink = (e: React.MouseEvent, emp: Employee) => {
    e.stopPropagation();
    const link = emp.executive_link || `${window.location.origin}/people?employeeId=${emp.id}&tab=fichaExecutiva`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(emp.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-tight">
          Listagem de Colaboradores
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px] text-slate-500 font-bold">
            {employees.length} REGISTROS
          </span>
        </h3>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="p-1.5 px-4 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              ANTERIOR
            </button>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Pág {currentPage} de {totalPages}
            </span>
            <button 
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="p-1.5 px-4 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              PRÓXIMO
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-100">
              <th className="py-4 px-6 min-w-[280px]">Integrante / Perfil</th>
              <th className="py-4 px-4 text-center">Classificação PB</th>
              <th className="py-4 px-4 text-center">Vínculo & Natureza</th>
              <th className="py-4 px-4 text-center">Qualidade Cadastral</th>
              <th className="py-4 px-4 text-center">Empresa</th>
              <th className="py-4 px-4 text-right">Custo Contratual</th>
              <th className="py-4 px-4 text-center">Início</th>
              <th className="py-4 px-4 text-center">Vencimento</th>
              <th className="py-4 px-6 text-center">Ações & Contato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedEmployees.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 text-sm italic">
                  Nenhum colaborador encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              paginatedEmployees.map((emp) => {
                const statusStyle = STATUS_STYLES[emp.status] || STATUS_STYLES.default;
                const isExpiringSoon = emp.contract_expiry_date ? (() => {
                  const expiry = new Date(emp.contract_expiry_date + 'T12:00:00');
                  const now = new Date();
                  const diffTime = expiry.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return diffDays >= 0 && diffDays <= 10;
                })() : false;
                
                const empIssues = auditIssues[emp.id] || [];
                const now = new Date();
                const hasGlosa = !!emp.has_invoice_glosa;
                const hasLoan = (emp.balance || 0) > 0;
                let hasNoRaise = false;
                let hasNoPromo = false;

                if (noRaiseMonths) {
                  const dRaise = new Date((emp.last_raise_date || emp.start_date || '') + 'T00:00:00');
                  if (!isNaN(dRaise.getTime())) {
                    const diffMonths = (now.getFullYear() - dRaise.getFullYear()) * 12 + (now.getMonth() - dRaise.getMonth());
                    hasNoRaise = diffMonths >= noRaiseMonths;
                  }
                }
                
                if (noPromoMonths) {
                  const dPromo = new Date((emp.department_start_date || emp.start_date || '') + 'T00:00:00');
                  if (!isNaN(dPromo.getTime())) {
                    const diffMonths = (now.getFullYear() - dPromo.getFullYear()) * 12 + (now.getMonth() - dPromo.getMonth());
                    hasNoPromo = diffMonths >= noPromoMonths;
                  }
                }

                const isExternal = isExternalEntity(emp.entityType);
                const displayName = isExternal && emp.corporate_name ? emp.corporate_name : emp.name;
                const avatarSrc = emp.photo_url || emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=e2e8f0&color=475569&bold=true`;
                const waLink = formatWhatsAppLink(emp.phone_professional);

                return (
                  <tr 
                    key={emp.id} 
                    className="hover:bg-slate-50/50 transition-all cursor-pointer group"
                    onClick={() => onEmployeeClick(emp.id)}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        {isExternal ? (
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                            <Building2 size={18} />
                          </div>
                        ) : (
                          <img 
                            src={avatarSrc}
                            alt={displayName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-100 shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-600 transition-colors">
                              {displayName}
                            </p>
                            {empIssues.length > 0 && (
                              <span className="inline-flex items-center justify-center text-amber-500 hover:text-amber-600 transition-colors shrink-0" title={`Auditoria: Encontrada(s) ${empIssues.length} inconsistência(s) de dados.`}>
                                <AlertCircle size={13} className="fill-amber-50" />
                              </span>
                            )}
                            <div className="flex items-center gap-0.5 ml-1 shrink-0">
                              {hasGlosa && <span title="Houve Glosa na NF" className="text-[11px] cursor-help">⚠️</span>}
                              {hasLoan && <span title="Possui Empréstimo Ativo" className="text-[11px] cursor-help">💸</span>}
                              {hasNoRaise && <span title={`Sem Revisão Valor Base há mais de ${noRaiseMonths} meses`} className="text-[11px] cursor-help">⏳</span>}
                              {hasNoPromo && <span title={`Sem Nível/Função há mais de ${noPromoMonths} meses`} className="text-[11px] cursor-help">🎯</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[8px] px-1.5 py-0.5 rounded border font-black uppercase tracking-wider ${statusStyle}`}>
                              {emp.status}
                            </span>
                            {isExternal ? (
                              emp.responsible_name && (
                                <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[150px] flex items-center gap-0.5">
                                  <UserRound size={8} /> RT: {emp.responsible_name}
                                </span>
                              )
                            ) : (
                              emp.job_role && (
                                <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[150px]">
                                  {emp.job_role}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <PeopleClassificationBadge level={emp.nivel} degree={emp.grau} />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                          {emp.linkType}
                        </span>
                        <RelationshipNatureBadge nature={emp.relationshipNature} />
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <PeopleHealthBadge employee={emp} />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-sm">
                        {emp.company}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-sm font-bold text-slate-700 tabular-nums">
                      {showValues ? (
                        emp.remuneration_fixed && emp.remuneration_fixed > 0 ? formatCurrency(emp.remuneration_fixed) : (emp.remuneration > 0 ? formatCurrency(emp.remuneration) : '—')
                      ) : (
                        <span className="text-slate-300 font-normal">••••••</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {emp.start_date ? (
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            {new Date(emp.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                            {formatCompanyTime(emp.start_date)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {emp.contract_expiry_date ? (
                        <span className={`text-xs font-bold tabular-nums ${isExpiringSoon ? 'text-amber-500' : 'text-slate-600'}`}>
                          {new Date(emp.contract_expiry_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {waLink ? (
                          <a href={waLink} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 rounded-lg transition-all border border-emerald-100" title={`WhatsApp Profissional: ${emp.phone_professional}`}>
                            <Phone size={13} className="fill-emerald-600/10" />
                          </a>
                        ) : (
                          <span className="p-1.5 bg-slate-50 text-slate-300 rounded-lg border border-slate-100 cursor-not-allowed" title="WhatsApp indisponível">
                            <Phone size={13} />
                          </span>
                        )}
                        <button onClick={(e) => handleCopyLink(e, emp)} className={`p-1.5 rounded-lg border transition-all flex items-center gap-0.5 text-[9px] font-black ${copiedId === emp.id ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" : "bg-white hover:bg-slate-50 text-slate-500 border-slate-200"}`} title="Copiar Link Executivo">
                          {copiedId === emp.id ? <Check size={11} /> : <Copy size={11} />}
                          {copiedId === emp.id ? "Copiado!" : "Link"}
                        </button>
                        <button onClick={() => onEdit(emp.id)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all" title="Editar Ficha">
                          <UserCog size={14} />
                        </button>
                        <button onClick={() => onDelete(emp)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-all" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden p-4 space-y-3 bg-slate-50/30">
        {paginatedEmployees.length === 0 ? (
          <p className="py-8 text-center text-slate-400 text-sm italic">
            Nenhum colaborador encontrado para os filtros selecionados.
          </p>
        ) : (
          paginatedEmployees.map((emp) => {
            const empIssues = auditIssues[emp.id] || [];
            const now = new Date();
            let hasNoRaise = false;
            let hasNoPromo = false;

            if (noRaiseMonths) {
              const dRaise = new Date((emp.last_raise_date || emp.start_date || '') + 'T00:00:00');
              if (!isNaN(dRaise.getTime())) {
                const diffMonths = (now.getFullYear() - dRaise.getFullYear()) * 12 + (now.getMonth() - dRaise.getMonth());
                hasNoRaise = diffMonths >= noRaiseMonths;
              }
            }
            if (noPromoMonths) {
              const dPromo = new Date((emp.department_start_date || emp.start_date || '') + 'T00:00:00');
              if (!isNaN(dPromo.getTime())) {
                const diffMonths = (now.getFullYear() - dPromo.getFullYear()) * 12 + (now.getMonth() - dPromo.getMonth());
                hasNoPromo = diffMonths >= noPromoMonths;
              }
            }

            return (
              <div key={emp.id} className="relative group" onClick={() => onEmployeeClick(emp.id)}>
                <PeopleMobileCard 
                  employee={emp}
                  onClick={onEmployeeClick}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  showValues={showValues}
                  hasAuditIssues={empIssues.length > 0}
                  hasGlosa={!!emp.has_invoice_glosa}
                  hasLoan={(emp.balance || 0) > 0}
                  hasNoRaise={hasNoRaise}
                  hasNoPromo={hasNoPromo}
                  noRaiseMonths={noRaiseMonths}
                  noPromoMonths={noPromoMonths}
                />
                <div className="absolute top-4 right-20 flex gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => onEdit(emp.id)} className="p-1.5 bg-white/95 backdrop-blur border border-slate-200 text-slate-500 hover:text-slate-800 rounded-lg shadow-sm active:scale-90 transition-transform" title="Editar Ficha">
                    <UserCog size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
