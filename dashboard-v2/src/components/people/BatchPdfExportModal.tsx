"use client";

import React, { useState, useMemo } from 'react';
import { X, Download, Printer, FileText, CheckSquare, Square, Users, Building2, Briefcase, Filter } from 'lucide-react';
import { Employee, EmploymentContract, MonthlyCost, getRemunerationLabel } from '@/types/loans';
import { formatCurrency } from '@/services/loans.service';
import { getCompanyLogoUrl } from './PeopleBadges';

interface BatchPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  allMonthlyCosts?: MonthlyCost[];
  allBonds?: EmploymentContract[];
}

export function BatchPdfExportModal({
  isOpen,
  onClose,
  employees,
  allMonthlyCosts = [],
  allBonds = []
}: BatchPdfExportModalProps) {
  // Filtros de seleção
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedLinkTypes, setSelectedLinkTypes] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // Módulos a incluir
  const [includePersonal, setIncludePersonal] = useState(true);
  const [includeContractual, setIncludeContractual] = useState(true);
  const [includeAddressContact, setIncludeAddressContact] = useState(true);
  const [includeBanking, setIncludeBanking] = useState(true);
  const [includeRemuneration, setIncludeRemuneration] = useState(true);
  const [includeCostsHistory, setIncludeCostsHistory] = useState(true);
  const [includeCostsChart, setIncludeCostsChart] = useState(true);

  // Lista de empresas, setores e vínculos únicos
  const companies = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.company).filter(Boolean))).sort() as string[];
  }, [employees]);

  const departments = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort() as string[];
  }, [employees]);

  const linkTypes = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.linkType).filter(Boolean))).sort() as string[];
  }, [employees]);

  // Colaboradores filtrados com base nas escolhas de empresa, setor e vínculo
  const targetEmployees = useMemo(() => {
    let list = [...employees];
    if (selectedCompanies.length > 0) {
      list = list.filter(e => selectedCompanies.includes(e.company || ''));
    }
    if (selectedDepartments.length > 0) {
      list = list.filter(e => selectedDepartments.includes(e.department || ''));
    }
    if (selectedLinkTypes.length > 0) {
      list = list.filter(e => selectedLinkTypes.includes(e.linkType || ''));
    }
    if (selectedEmployeeIds.length > 0) {
      list = list.filter(e => selectedEmployeeIds.includes(e.id));
    }
    return list;
  }, [employees, selectedCompanies, selectedDepartments, selectedLinkTypes, selectedEmployeeIds]);

  if (!isOpen) return null;

  const handleExportBatchPDF = () => {
    if (targetEmployees.length === 0) {
      alert('Nenhum colaborador selecionado para geração em lote.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups no seu navegador para imprimir a ficha em PDF.');
      return;
    }

    let batchHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fichas de Colaboradores em Lote (${targetEmployees.length} Registros)</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; margin: 0; padding: 0; font-size: 11px; }
          .page-break { page-break-after: always; }
          .header { border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-between: space-between; align-items: center; }
          .section { margin-bottom: 18px; }
          .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
          .field { background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0; }
          .field-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; }
          .field-value { font-size: 11px; font-weight: 700; color: #0f172a; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
          th { background: #f1f5f9; color: #475569; font-weight: 800; text-transform: uppercase; padding: 6px; border: 1px solid #cbd5e1; text-align: left; }
          td { padding: 6px; border: 1px solid #e2e8f0; text-align: left; }
        </style>
      </head>
      <body>
    `;

    targetEmployees.forEach((profile, index) => {
      const empName = profile.name || 'Colaborador';
      const photoUrl = profile.avatar || (profile as any).photo_url || null;
      const companyLogoUrl = getCompanyLogoUrl(profile.company);
      const empCosts = allMonthlyCosts.filter(c => c.employee_id === profile.id);

      // Totalizadores acumulados
      const costTotals = empCosts.length > 0 ? empCosts.reduce((acc, c) => {
        const isCLT = c.vinculo_tipo === 'CLT';
        const realCost = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
        acc.fixed += c.valor_fixo || 0;
        acc.bonus += c.valor_bonus || 0;
        acc.comissao += c.valor_comissao || 0;
        acc.horaExtra += c.valor_hora_extra || 0;
        acc.beneficios += (c.valor_vr || 0) + (c.valor_vt || 0) + (c.valor_cesta || 0) + (c.valor_ajuda_custo || 0);
        acc.fgts += c.valor_fgts || 0;
        acc.decimo += c.valor_decimo_terceiro || 0;
        acc.ferias += c.valor_ferias || 0;
        acc.descontos += c.valor_descontos || 0;
        acc.realCost += realCost;
        return acc;
      }, { fixed: 0, bonus: 0, comissao: 0, horaExtra: 0, beneficios: 0, fgts: 0, decimo: 0, ferias: 0, descontos: 0, realCost: 0 }) : null;

      const avgMonthlyCost = costTotals && empCosts.length > 0 ? costTotals.realCost / empCosts.length : 0;

      batchHtml += `
        <div class="header">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${photoUrl ? `<img src="${photoUrl}" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid #f59e0b;" />` : ''}
            <div>
              <h1 style="font-size: 20px; margin: 0; color: #0f172a; font-weight: 800;">${empName}</h1>
              <p style="margin: 2px 0 0 0; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">
                Ficha Cadastral Executiva • Escopo do Contrato: ${profile.job_role || 'Não informado'}
              </p>
              <p style="margin: 2px 0 0 0; color: #334155; font-size: 10px; font-weight: 600;">
                Empresa: <strong style="color: #b45309;">${profile.company || 'MarBR'}</strong> &nbsp;|&nbsp; Vínculo: <strong>${profile.linkType || 'CLT'}</strong>
              </p>
            </div>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
            ${companyLogoUrl ? `<img src="${companyLogoUrl}" style="max-height: 42px; max-width: 150px; object-fit: contain;" />` : ''}
            <p style="font-size: 9px; color: #94a3b8; margin: 4px 0 0 0;">Lote ${index + 1} de ${targetEmployees.length}</p>
          </div>
        </div>
      `;

      if (includePersonal) {
        batchHtml += `
          <div class="section">
            <div class="section-title">1. Informações Pessoais & Documentos</div>
            <div class="grid-3">
              <div class="field"><span class="field-label">Nome Completo</span><span class="field-value">${profile.name || '-'}</span></div>
              <div class="field"><span class="field-label">CPF</span><span class="field-value">${profile.document_id || '-'}</span></div>
              <div class="field"><span class="field-label">RG</span><span class="field-value">${profile.document_rg || '-'}</span></div>
              <div class="field"><span class="field-label">Razão Social (PJ)</span><span class="field-value">${profile.corporate_name || '-'}</span></div>
              <div class="field"><span class="field-label">CNPJ</span><span class="field-value">${profile.pj_type || '-'}</span></div>
              <div class="field"><span class="field-label">Resp. Legal</span><span class="field-value">${profile.responsible_name || '-'}</span></div>
            </div>
          </div>
        `;
      }

      if (includeContractual) {
        batchHtml += `
          <div class="section">
            <div class="section-title">2. Dados Contratuais & Vínculo</div>
            <div class="grid-3">
              <div class="field"><span class="field-label">Empresa do Vínculo</span><span class="field-value">${profile.company || '-'}</span></div>
              <div class="field"><span class="field-label">Tipo de Vínculo</span><span class="field-value">${profile.linkType || '-'}</span></div>
              <div class="field"><span class="field-label">Setor / Departamento</span><span class="field-value">${profile.department || '-'}</span></div>
              <div class="field"><span class="field-label">Escopo do Contrato</span><span class="field-value">${profile.job_role || '-'}</span></div>
              <div class="field"><span class="field-label">Local de Prestação</span><span class="field-value">${profile.service_location || '-'}</span></div>
              <div class="field"><span class="field-label">Status</span><span class="field-value">${profile.status || '-'}</span></div>
            </div>
          </div>
        `;
      }

      if (includeAddressContact) {
        batchHtml += `
          <div class="section">
            <div class="section-title">3. Endereço & Contatos</div>
            <div class="grid-3">
              <div class="field"><span class="field-label">E-mail Profissional</span><span class="field-value">${profile.email_professional || profile.email || '-'}</span></div>
              <div class="field"><span class="field-label">Telefone</span><span class="field-value">${profile.phone_professional || profile.phone || '-'}</span></div>
              <div class="field"><span class="field-label">Cidade/UF</span><span class="field-value">${profile.city ? profile.city + '/' + (profile.state || '') : '-'}</span></div>
            </div>
          </div>
        `;
      }

      if (includeBanking) {
        batchHtml += `
          <div class="section">
            <div class="section-title">4. Dados Bancários & Chave PIX</div>
            <div class="grid-2">
              <div class="field"><span class="field-label">Chave PIX</span><span class="field-value">${profile.pix_key || '-'}</span></div>
            </div>
          </div>
        `;
      }

      if (includeRemuneration) {
        batchHtml += `
          <div class="section">
            <div class="section-title">5. Remuneração Contratual</div>
            <div class="grid-3">
              <div class="field"><span class="field-label">Remuneração Base</span><span class="field-value">${formatCurrency(profile.remuneration_fixed || profile.remuneration || 0)}</span></div>
              <div class="field"><span class="field-label">Bônus</span><span class="field-value">${formatCurrency(profile.remuneration_bonus || 0)}</span></div>
              <div class="field"><span class="field-label">Comissões</span><span class="field-value">${formatCurrency(profile.remuneration_commission || 0)}</span></div>
            </div>
          </div>
        `;
      }

      if (includeCostsHistory && empCosts.length > 0 && costTotals) {
        const isPJ = profile.linkType === 'PJ' || profile.linkType === 'MEI';
        const sortedCosts = [...empCosts].sort((a, b) => a.competencia.localeCompare(b.competencia));
        const maxCost = Math.max(...sortedCosts.map(c => (c.valor_liquido || 0) + (c.vinculo_tipo === 'CLT' ? (c.valor_adiantamento || 0) : 0)), 1);

        batchHtml += `
          <div class="section">
            <div class="section-title">6. Histórico de Custos Mensais e Totalizadores</div>
            
            <div style="margin-bottom: 12px; background: #fffdf5; border: 1.5px solid #fef3c7; padding: 10px; border-radius: 8px;">
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                <div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">${isPJ ? 'Total Valor Contratual' : 'Total Fixo'}</span><span class="field-value">${formatCurrency(costTotals.fixed)}</span></div>
                <div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">Total Bônus</span><span class="field-value">${formatCurrency(costTotals.bonus)}</span></div>
                <div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">Total Comissões</span><span class="field-value">${formatCurrency(costTotals.comissao)}</span></div>
                ${!isPJ ? `<div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">Total FGTS</span><span class="field-value">${formatCurrency(costTotals.fgts)}</span></div>` : ''}
                <div class="field" style="border-left: 3px solid #10b981;"><span class="field-label" style="color: #047857;">Média Mensal</span><span class="field-value" style="color: #047857;">${formatCurrency(avgMonthlyCost)}</span></div>
                <div class="field" style="border-left: 4px solid #b45309; background: #fef3c7;"><span class="field-label" style="color: #92400e; font-weight:800;">TOTAL ACUMULADO</span><span class="field-value" style="color: #b45309;">${formatCurrency(costTotals.realCost)}</span></div>
              </div>
            </div>

            ${includeCostsChart ? `
              <!-- Gráfico SVG Vetorial de Custo Mês a Mês (Garantido em Impressões PDF) -->
              <div style="margin-top: 10px; margin-bottom: 12px; background: #ffffff; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 8px; font-family: sans-serif;">
                  Gráfico de Custo Mês a Mês (Rótulos em R$)
                </div>
                
                <svg width="100%" height="200" viewBox="0 0 540 200" style="display: block; overflow: visible; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                  <line x1="30" y1="20" x2="540" y2="20" stroke="#f1f5f9" stroke-width="1" />
                  <line x1="30" y1="55" x2="540" y2="55" stroke="#f1f5f9" stroke-width="1" />
                  <line x1="30" y1="90" x2="540" y2="90" stroke="#f1f5f9" stroke-width="1" />
                  <line x1="30" y1="125" x2="540" y2="125" stroke="#cbd5e1" stroke-width="1.5" />

                  ${(() => {
                    const count = sortedCosts.length;
                    const chartW = 510;
                    const slotWidth = chartW / count;
                    const barMaxH = 100;
                    const baseY = 125;

                    return sortedCosts.map((c, idx) => {
                      const barWidth = Math.min(slotWidth * 0.55, 28);
                      const xCenter = 30 + idx * slotWidth + slotWidth / 2;
                      const xBar = xCenter - barWidth / 2;

                      const isCLT = c.vinculo_tipo === 'CLT';
                      const realCost = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
                      const barH = Math.max(8, Math.round((realCost / maxCost) * barMaxH));
                      const yBar = baseY - barH;
                      const yValLabel = yBar - 4;

                      const compParts = c.competencia.split('-');
                      const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                      const mLabel = monthsShort[parseInt(compParts[1] || '1', 10) - 1] + '/' + (compParts[0] || '').slice(2);
                      const valLabel = realCost >= 1000 ? 'R$' + (realCost / 1000).toFixed(1) + 'k' : 'R$' + realCost.toFixed(0);

                      return '<text x="' + xCenter + '" y="' + yValLabel + '" text-anchor="middle" font-size="8" font-weight="800" fill="#047857" font-family="sans-serif">' + valLabel + '</text>' +
                        '<rect x="' + xBar + '" y="' + yBar + '" width="' + barWidth + '" height="' + barH + '" rx="3" ry="3" fill="#10b981" stroke="#059669" stroke-width="1" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;" />' +
                        '<text x="' + xCenter + '" y="' + (baseY + 5) + '" text-anchor="end" font-size="8" font-weight="600" fill="#475569" font-family="sans-serif" transform="rotate(-45 ' + xCenter + ' ' + (baseY + 5) + ')">' + mLabel + '</text>';
                    }).join('');
                  })()}
                </svg>
              </div>
            ` : ''}

            <table>
              <thead>
                <tr>
                  <th>Competência</th>
                  <th>Vínculo</th>
                  <th>${isPJ ? 'Valor Contratual' : 'Fixo'}</th>
                  <th>Bônus</th>
                  <th>Comissão</th>
                  ${!isPJ ? '<th>FGTS</th>' : ''}
                  <th style="text-align: right;">Custo Real</th>
                </tr>
              </thead>
              <tbody>
                ${sortedCosts.map(c => {
                  const isCLT = c.vinculo_tipo === 'CLT';
                  const cReal = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
                  return `
                  <tr>
                    <td><strong>${c.competencia}</strong></td>
                    <td>${c.vinculo_tipo}</td>
                    <td>${formatCurrency(c.valor_fixo || 0)}</td>
                    <td>${formatCurrency(c.valor_bonus || 0)}</td>
                    <td>${formatCurrency(c.valor_comissao || 0)}</td>
                    ${!isPJ ? '<td>' + formatCurrency(c.valor_fgts || 0) + '</td>' : ''}
                    <td style="text-align: right; font-weight: 700; color: #b45309;">${formatCurrency(cReal)}</td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      if (index < targetEmployees.length - 1) {
        batchHtml += `<div class="page-break"></div>`;
      }
    });

    batchHtml += `
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 600);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(batchHtml);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wide">Exportação de Fichas em Lote (PDF)</h2>
              <p className="text-xs text-slate-400">Gere relatórios executivos consolidados para múltiplos colaboradores</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Seleção de Filtros com botões "Todos" e "Limpar" */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Filter size={14} className="text-emerald-600" />
              Filtros para Seleção de Colaboradores ({targetEmployees.length} de {employees.length} selecionados)
            </h3>

            {/* Filtro Empresa */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase text-slate-500">Filtrar por Empresa</label>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <button onClick={() => setSelectedCompanies([...companies])} className="text-emerald-600 hover:underline">Todos</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setSelectedCompanies([])} className="text-slate-400 hover:underline">Limpar</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {companies.map(c => {
                  const sel = selectedCompanies.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedCompanies(sel ? selectedCompanies.filter(x => x !== c) : [...selectedCompanies, c])}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${sel ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtro Setor */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase text-slate-500">Filtrar por Setor / Departamento</label>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <button onClick={() => setSelectedDepartments([...departments])} className="text-emerald-600 hover:underline">Todos</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setSelectedDepartments([])} className="text-slate-400 hover:underline">Limpar</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {departments.map(d => {
                  const sel = selectedDepartments.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => setSelectedDepartments(sel ? selectedDepartments.filter(x => x !== d) : [...selectedDepartments, d])}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${sel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtro Vínculo */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase text-slate-500">Filtrar por Vínculo (CLT / PJ)</label>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <button onClick={() => setSelectedLinkTypes([...linkTypes])} className="text-emerald-600 hover:underline">Todos</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setSelectedLinkTypes([])} className="text-slate-400 hover:underline">Limpar</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {linkTypes.map(l => {
                  const sel = selectedLinkTypes.includes(l);
                  return (
                    <button
                      key={l}
                      onClick={() => setSelectedLinkTypes(sel ? selectedLinkTypes.filter(x => x !== l) : [...selectedLinkTypes, l])}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${sel ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Módulos do Relatório */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Campos & Seções a Incluir no PDF</h3>
            <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-700">
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input type="checkbox" checked={includePersonal} onChange={e => setIncludePersonal(e.target.checked)} className="rounded text-emerald-600" />
                <span>1. Dados Pessoais & Documentos</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input type="checkbox" checked={includeContractual} onChange={e => setIncludeContractual(e.target.checked)} className="rounded text-emerald-600" />
                <span>2. Dados Contratuais & Vínculo</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input type="checkbox" checked={includeAddressContact} onChange={e => setIncludeAddressContact(e.target.checked)} className="rounded text-emerald-600" />
                <span>3. Endereço & Contatos</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input type="checkbox" checked={includeBanking} onChange={e => setIncludeBanking(e.target.checked)} className="rounded text-emerald-600" />
                <span>4. Dados Bancários & PIX</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input type="checkbox" checked={includeRemuneration} onChange={e => setIncludeRemuneration(e.target.checked)} className="rounded text-emerald-600" />
                <span>5. Remuneração Contratual</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input type="checkbox" checked={includeCostsHistory} onChange={e => setIncludeCostsHistory(e.target.checked)} className="rounded text-emerald-600" />
                <span>6. Histórico de Custos Mensais</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 cursor-pointer col-span-2 text-emerald-800">
                <input type="checkbox" checked={includeCostsChart} onChange={e => setIncludeCostsChart(e.target.checked)} className="rounded text-emerald-600" />
                <span>7. Gráfico de Custo Mês a Mês com Rótulos de Valor (R$)</span>
              </label>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">
            Cancelar
          </button>
          <button
            onClick={handleExportBatchPDF}
            disabled={targetEmployees.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase shadow-md transition-all active:scale-95"
          >
            <Printer size={15} />
            Gerar Relatório em Lote ({targetEmployees.length} PDF)
          </button>
        </div>

      </div>
    </div>
  );
}
