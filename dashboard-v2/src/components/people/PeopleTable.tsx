"use client";

import { useState } from "react";
import { Trash2, UserCog, FileText, AlertCircle } from "lucide-react";
import { Employee, AuditIssue } from "@/types/loans";
import { getRemunerationLabel } from "@/types/loans";
import { formatCurrency } from "@/services/loans.service";
import { PeopleMobileCard } from "./PeopleMobileCard";

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

const VINCULO_STYLES: Record<string, string> = {
  CLT: 'bg-blue-50 text-blue-700 border-blue-100',
  MEI: 'bg-orange-50 text-orange-700 border-orange-100',
  PJ: 'bg-orange-50 text-orange-700 border-orange-100',
  Estagiário: 'bg-purple-50 text-purple-700 border-purple-100',
};

export function PeopleTable({ employees, onEdit, onDelete, onEmployeeClick, showValues, auditIssues = {}, noRaiseMonths, noPromoMonths }: PeopleTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
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
              <th className="py-4 px-6 min-w-[250px]">Colaborador / Cargo</th>
              <th className="py-4 px-4 text-center">Empresa</th>
              <th className="py-4 px-4 text-center">Vínculo</th>
              <th className="py-4 px-4 text-right">Remuneração</th>
              <th className="py-4 px-4 text-center">Aditivos</th>
              <th className="py-4 px-4 text-center">Início</th>
              <th className="py-4 px-4 text-center">Vencimento</th>
              <th className="py-4 px-6 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedEmployees.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-sm italic">
                  Nenhum colaborador encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              paginatedEmployees.map((emp) => {
                const statusStyle = STATUS_STYLES[emp.status] || STATUS_STYLES.default;
                const vincStyle = VINCULO_STYLES[emp.linkType] || 'bg-slate-50 text-slate-600 border-slate-200';
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

                return (
                  <tr 
                    key={emp.id} 
                    className="hover:bg-slate-50/50 transition-all cursor-pointer group"
                    onClick={() => onEmployeeClick(emp.id)}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img 
                          src={emp.photo_url || emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=e2e8f0&color=475569&bold=true`}
                          alt={emp.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-600 transition-colors">
                              {emp.name}
                            </p>
                            {empIssues.length > 0 && (
                              <span 
                                className="inline-flex items-center justify-center text-amber-500 hover:text-amber-600 transition-colors shrink-0" 
                                title={`Auditoria: Encontrada(s) ${empIssues.length} inconsistência(s) de dados. Abra a Ficha RH para detalhes e correção.`}
                              >
                                <AlertCircle size={13} className="fill-amber-50" />
                              </span>
                            )}
                            <div className="flex items-center gap-0.5 ml-1">
                              {hasGlosa && <span title="Houve Glosa na NF" className="text-[13px] shrink-0 cursor-help opacity-90 hover:opacity-100 transition-opacity">⚠️</span>}
                              {hasLoan && <span title="Possui Empréstimo Ativo" className="text-[13px] shrink-0 cursor-help opacity-90 hover:opacity-100 transition-opacity">💸</span>}
                              {hasNoRaise && <span title={`Sem Aumento há mais de ${noRaiseMonths} meses`} className="text-[13px] shrink-0 cursor-help opacity-90 hover:opacity-100 transition-opacity">⏳</span>}
                              {hasNoPromo && <span title={`Sem Promoção há mais de ${noPromoMonths} meses`} className="text-[13px] shrink-0 cursor-help opacity-90 hover:opacity-100 transition-opacity">🎯</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${statusStyle}`}>
                              {emp.status}
                            </span>
                            {emp.job_role && (
                              <span className="text-[10px] font-medium text-slate-400 truncate max-w-[150px]">
                                {emp.job_role}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-sm">
                        {emp.company}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${vincStyle}`}>
                        {emp.linkType}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-sm font-bold text-slate-700 tabular-nums">
                      {showValues ? (
                        emp.remuneration > 0 ? formatCurrency(emp.remuneration) : '—'
                      ) : (
                        <span className="text-slate-300 font-normal">••••••</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {(emp.aditivoCount || 0) > 0 ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
                          <FileText size={10} />
                          <span>{emp.aditivoCount}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-medium">Nenhum</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center text-xs text-slate-500 tabular-nums">
                      {emp.start_date ? new Date(emp.start_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
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
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => onEdit(emp.id)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
                          title="Editar"
                        >
                          <UserCog size={15} />
                        </button>
                        <button 
                          onClick={() => onDelete(emp)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-all"
                          title="Excluir"
                        >
                          <Trash2 size={15} />
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

      {/* Mobile view */}
      <div className="md:hidden p-4 space-y-3 bg-slate-50/30">
        {paginatedEmployees.length === 0 ? (
          <p className="py-8 text-center text-slate-400 text-sm italic">
            Nenhum colaborador encontrado para os filtros selecionados.
          </p>
        ) : (
          paginatedEmployees.map((emp) => {
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

            return (
              <div key={emp.id} className="relative group" onClick={() => onEmployeeClick(emp.id)}>
                <PeopleMobileCard 
                  employee={emp}
                  onClick={onEmployeeClick}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  showValues={showValues}
                  hasAuditIssues={empIssues.length > 0}
                  hasGlosa={hasGlosa}
                  hasLoan={hasLoan}
                  hasNoRaise={hasNoRaise}
                  hasNoPromo={hasNoPromo}
                  noRaiseMonths={noRaiseMonths}
                  noPromoMonths={noPromoMonths}
                />
                <div className="absolute top-4 right-14 flex gap-1" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => onEdit(emp.id)}
                    className="p-2 bg-white/90 backdrop-blur border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl shadow-sm active:scale-90 transition-transform"
                    title="Editar"
                  >
                    <UserCog size={14} />
                  </button>
                  <button 
                    onClick={() => onDelete(emp)}
                    className="p-2 bg-white/90 backdrop-blur border border-slate-200 text-slate-400 hover:text-red-600 rounded-xl shadow-sm active:scale-90 transition-transform"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
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
