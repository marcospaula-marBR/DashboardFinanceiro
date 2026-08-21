"use client";

import React, { useState } from 'react';
import { X, Printer, ShieldAlert, CheckCircle2, AlertTriangle, Building2, User, KeyRound, ExternalLink, Calendar, CheckSquare, Square } from 'lucide-react';
import { Employee, EmployeeSystemAccess } from '@/types/loans';
import { getCompanyLogoUrl } from './PeopleBadges';

interface OffboardingChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  onRevokeAccesses?: (employeeId: string, revokedSystemIds: string[]) => void;
}

export function OffboardingChecklistModal({
  isOpen,
  onClose,
  employee,
  onRevokeAccesses
}: OffboardingChecklistModalProps) {
  const accesses: EmployeeSystemAccess[] = employee.system_accesses || employee.metadata?.system_accesses || [];
  
  // Estado local para os checkboxes de revogação
  const [checkedRevoked, setCheckedRevoked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    accesses.forEach(a => {
      init[a.system_id] = !!a.revoked_at || a.is_active === false;
    });
    return init;
  });

  const [revocationNotes, setRevocationNotes] = useState('');
  const [responsibleName, setResponsibleName] = useState('Gestor de Segurança / TI');

  if (!isOpen) return null;

  const toggleCheck = (sysId: string) => {
    setCheckedRevoked(prev => ({
      ...prev,
      [sysId]: !prev[sysId]
    }));
  };

  const totalAccesses = accesses.length;
  const revokedCount = Object.values(checkedRevoked).filter(Boolean).length;
  const pendingCount = totalAccesses - revokedCount;

  const isPJ = employee.linkType === 'PJ' || employee.linkType === 'MEI';
  const displayName = isPJ && employee.corporate_name ? employee.corporate_name : employee.name;
  const companyLogoUrl = getCompanyLogoUrl(employee.company);

  // Impressão Formal do Termo de Revogação de Acessos
  const handlePrintTermo = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para imprimir o termo de revogação de acessos.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Termo de Revogação de Acessos e Offboarding — ${displayName}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 20px; font-size: 12px; line-height: 1.5; }
          .header { border-bottom: 2.5px solid #dc2626; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
          .header h1 { font-size: 18px; margin: 0; color: #991b1b; font-weight: 800; text-transform: uppercase; }
          .header p { margin: 3px 0 0 0; color: #64748b; font-size: 11px; font-weight: 600; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 15px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 11px; }
          .grid-item strong { color: #475569; text-transform: uppercase; font-size: 9px; display: block; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background: #f1f5f9; color: #334155; font-weight: 800; text-transform: uppercase; font-size: 10px; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
          td { padding: 8px; border: 1px solid #e2e8f0; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
          .badge-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
          .badge-warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .badge-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
          .signatures { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; }
          .sig-line { border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11px; font-weight: 700; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Termo de Revogação de Acessos &amp; Segurança (Offboarding)</h1>
            <p>Auditoria e Controle de Descredenciamento de Sistemas Corporativos e Bancários</p>
          </div>
          <div style="text-align: right;">
            ${companyLogoUrl ? `<img src="${companyLogoUrl}" style="max-height: 40px; max-width: 140px; object-fit: contain;" />` : ''}
            <p style="font-size: 10px; color: #64748b; margin: 4px 0 0 0;">Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>

        <div class="card">
          <div class="grid">
            <div class="grid-item"><strong>Colaborador / Entidade:</strong> ${displayName}</div>
            <div class="grid-item"><strong>CPF / CNPJ:</strong> ${employee.document_id || employee.pj_type || '-'}</div>
            <div class="grid-item"><strong>Empresa / Vínculo:</strong> ${employee.company} (${employee.linkType})</div>
            <div class="grid-item"><strong>Cadeira / Setor:</strong> ${employee.job_role || '-'} • ${employee.department || '-'}</div>
            <div class="grid-item"><strong>Data do Desligamento:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>
            <div class="grid-item"><strong>Responsável pela Homologação:</strong> ${responsibleName}</div>
          </div>
        </div>

        <h3 style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-top: 20px; margin-bottom: 6px;">
          Relação de Sistemas, Bancos e Credenciais Mapeadas (${totalAccesses} Sistemas)
        </h3>

        <table>
          <thead>
            <tr>
              <th style="width: 25px;">#</th>
              <th>Sistema / Plataforma</th>
              <th>Categoria</th>
              <th>Origem</th>
              <th>Nível de Acesso</th>
              <th>Identificador / Login</th>
              <th style="text-align: center;">Status de Revogação</th>
            </tr>
          </thead>
          <tbody>
            ${accesses.map((a, i) => {
              const isRevoked = checkedRevoked[a.system_id];
              return `
                <tr>
                  <td style="text-align: center;">${i + 1}</td>
                  <td><strong>${a.system_name}</strong></td>
                  <td>${a.category}</td>
                  <td>${a.origin === 'interno' ? 'Interno' : 'Contrato'}</td>
                  <td><span class="badge ${a.access_level === 'Estratégico' ? 'badge-danger' : a.access_level === 'Tático' ? 'badge-warning' : 'badge-success'}">${a.access_level}</span></td>
                  <td><code>${a.user_identifier || employee.email || '-'}</code></td>
                  <td style="text-align: center;">
                    ${isRevoked ? '<span class="badge badge-danger">✓ REVOGADO</span>' : '<span class="badge badge-warning">⚠️ PENDENTE</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        ${revocationNotes ? `
          <div class="card" style="margin-top: 15px; background: #fffdf5; border-color: #fef3c7;">
            <strong style="color: #92400e; font-size: 10px; text-transform: uppercase;">Observações do Descredenciamento:</strong>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #451a03;">${revocationNotes}</p>
          </div>
        ` : ''}

        <div class="signatures">
          <div>
            <div class="sig-line">${responsibleName}<br/><span style="font-size: 9px; font-weight: normal; color: #64748b;">Responsável pela Revogação de Acessos / TI</span></div>
          </div>
          <div>
            <div class="sig-line">${displayName}<br/><span style="font-size: 9px; font-weight: normal; color: #64748b;">Assinatura do Colaborador / Representante</span></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleApplyRevocations = () => {
    const revokedIds = Object.entries(checkedRevoked)
      .filter(([_, isRevoked]) => isRevoked)
      .map(([id]) => id);

    if (onRevokeAccesses) {
      onRevokeAccesses(employee.id, revokedIds);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header com Alerta de Segurança */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white uppercase">
                  Checklist de Desligamento &amp; Offboarding
                </h2>
                <span className="bg-rose-500/20 text-rose-300 text-[10px] font-black px-2 py-0.5 rounded-md uppercase border border-rose-500/30">
                  Segurança
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Revogação de acessos a sistemas, bancos e ERPs para <strong className="text-white">{displayName}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Status Tracker */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <KeyRound size={16} className="text-slate-500" />
              <span>Total de Sistemas: <strong>{totalAccesses}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 size={14} />
              <span>Revogados: <strong>{revokedCount}</strong></span>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center gap-1.5 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                <AlertTriangle size={14} />
                <span>Pendentes: <strong>{pendingCount}</strong></span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const allRevoked: Record<string, boolean> = {};
                accesses.forEach(a => { allRevoked[a.system_id] = true; });
                setCheckedRevoked(allRevoked);
              }}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition-all"
            >
              Marcar Todos como Revogados
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {accesses.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">Nenhum sistema vinculado</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Este colaborador não possui registros de sistemas ou acessos bancários cadastrados na plataforma.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              {accesses.map((acc) => {
                const isRevoked = checkedRevoked[acc.system_id];
                return (
                  <div
                    key={acc.system_id}
                    onClick={() => toggleCheck(acc.system_id)}
                    className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                      isRevoked ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600"
                        onClick={(e) => { e.stopPropagation(); toggleCheck(acc.system_id); }}
                      >
                        {isRevoked ? (
                          <CheckSquare size={20} className="text-rose-600" />
                        ) : (
                          <Square size={20} className="text-slate-400" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-xs font-black uppercase tracking-tight ${isRevoked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {acc.system_name}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {acc.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                          <span>Login/Identificador: <strong className="text-slate-700">{acc.user_identifier || employee.email || 'Não informado'}</strong></span>
                          <span>•</span>
                          <span>Origem: {acc.origin === 'interno' ? 'Interno' : 'Contrato'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                        acc.access_level === 'Estratégico'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : acc.access_level === 'Tático'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        Nível {acc.access_level}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${
                        isRevoked ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {isRevoked ? 'Revogado' : 'Ativo'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dados do Descredenciamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Responsável pelo Descredenciamento
              </label>
              <input
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Nome do Gestor / Responsável de TI"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Observações de Auditoria / Homologação
              </label>
              <input
                type="text"
                value={revocationNotes}
                onChange={(e) => setRevocationNotes(e.target.value)}
                placeholder="Ex: Senhas trocadas, 2FA desativado, token físico devolvido..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
          </div>
        </div>

        {/* Footer com Ações */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintTermo}
              disabled={accesses.length === 0}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
            >
              <Printer size={16} className="text-slate-600" />
              <span>Imprimir Termo de Revogação (PDF)</span>
            </button>

            <button
              onClick={handleApplyRevocations}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
            >
              <CheckCircle2 size={16} />
              <span>Salvar Status de Revogação</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
