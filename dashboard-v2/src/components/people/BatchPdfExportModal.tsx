"use client";

import React, { useState, useMemo } from 'react';
import { 
  X, Download, Printer, FileText, CheckSquare, Square, Users, Building2, Briefcase, 
  Filter, FileSpreadsheet, Search, ShieldCheck, Calculator, AlertCircle, CheckCircle2, ChevronRight, HelpCircle
} from 'lucide-react';
import { Employee, EmploymentContract, MonthlyCost, getRemunerationLabel } from '@/types/loans';
import { formatCurrency } from '@/services/loans.service';
import { getCompanyLogoUrl } from './PeopleBadges';
import { formatCostOrigem, getCostOrigemBadgeStyle } from './ProfileExportModal';

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
  // Modo do relatório e formato
  const [reportMode, setReportMode] = useState<'audit' | 'full'>('audit');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');

  // Filtros de seleção
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedLinkTypes, setSelectedLinkTypes] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');

  // Módulos a incluir (no modo ficha cadastral completa)
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

  // Lista de anos disponíveis nas competências
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allMonthlyCosts.forEach(c => {
      if (c.competencia && c.competencia.length >= 4) {
        years.add(c.competencia.slice(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [allMonthlyCosts]);

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
    if (searchEmployeeQuery.trim()) {
      const q = searchEmployeeQuery.toLowerCase();
      list = list.filter(e => 
        (e.name || '').toLowerCase().includes(q) ||
        (e.document_id || '').includes(q) ||
        (e.job_role || '').toLowerCase().includes(q) ||
        (e.company || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, selectedCompanies, selectedDepartments, selectedLinkTypes, selectedEmployeeIds, searchEmployeeQuery]);

  // Total de competências a serem auditadas no escopo filtrado
  const filteredCostsScope = useMemo(() => {
    const targetIds = new Set(targetEmployees.map(e => e.id));
    return allMonthlyCosts.filter(c => {
      if (!targetIds.has(c.employee_id)) return false;
      if (selectedYear !== 'all') {
        return c.competencia.startsWith(selectedYear);
      }
      return true;
    });
  }, [targetEmployees, allMonthlyCosts, selectedYear]);

  if (!isOpen) return null;

  // Sanitizador de texto para CSV
  const sanitize = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // EXPORTAÇÃO CSV EM LOTE (AUDITORIA CONSOLIDADA OU FICHA COMPLETA)
  const handleExportBatchCSV = () => {
    if (targetEmployees.length === 0) {
      alert('Nenhum contratado selecionado para geração em lote.');
      return;
    }

    let csv = '';

    if (reportMode === 'audit') {
      csv += `"RELATÓRIO CONSOLIDADO DE AUDITORIA DE FATURAMENTO E CUSTOS"\n`;
      csv += `"Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}"\n`;
      csv += `"Escopo: ${targetEmployees.length} contratados selecionados | ${filteredCostsScope.length} competências analisadas"\n`;
      csv += `"Filtro de Ano: ${selectedYear === 'all' ? 'Todas as Competências' : `Ano ${selectedYear}`}"\n\n`;

      csv += `Colaborador;CPF / CNPJ;Empresa;Regime;Cargo / Escopo;Competência;Fonte / Origem da Informação;Valor Previsto Contratual;Valor Fixo Real;Bônus;Comissão;Horas Extras;Benefícios;FGTS;13º & Férias;Glosas / Descontos;Custo Real Desembolsado;Diferença (Real - Previsto);Status Auditoria;Observações\n`;

      let totalGeralPrevisto = 0;
      let totalGeralFixo = 0;
      let totalGeralBonus = 0;
      let totalGeralComissao = 0;
      let totalGeralExtras = 0;
      let totalGeralBeneficios = 0;
      let totalGeralFgts = 0;
      let totalGeralDecFer = 0;
      let totalGeralDescontos = 0;
      let totalGeralReal = 0;

      targetEmployees.forEach(emp => {
        const empCosts = allMonthlyCosts.filter(c => {
          if (c.employee_id !== emp.id) return false;
          if (selectedYear !== 'all') return c.competencia.startsWith(selectedYear);
          return true;
        }).sort((a, b) => a.competencia.localeCompare(b.competencia));

        const previsto = emp.remuneration_fixed || emp.remuneration || 0;

        empCosts.forEach(c => {
          const isCLT = c.vinculo_tipo === 'CLT';
          const cReal = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
          const diff = cReal - previsto;
          const statusAuditoria = Math.abs(diff) < 0.01 ? 'Conciliado' : (diff > 0 ? 'Acima do Previsto (+)' : 'Abaixo do Previsto (-)');
          const origemLabel = formatCostOrigem(c.origem);
          const ben = (c.valor_vr || 0) + (c.valor_vt || 0) + (c.valor_cesta || 0) + (c.valor_ajuda_custo || 0);
          const decFer = (c.valor_decimo_terceiro || 0) + (c.valor_ferias || 0);

          totalGeralPrevisto += previsto;
          totalGeralFixo += (c.valor_fixo || 0);
          totalGeralBonus += (c.valor_bonus || 0);
          totalGeralComissao += (c.valor_comissao || 0);
          totalGeralExtras += (c.valor_hora_extra || 0);
          totalGeralBeneficios += ben;
          totalGeralFgts += (c.valor_fgts || 0);
          totalGeralDecFer += decFer;
          totalGeralDescontos += (c.valor_descontos || 0);
          totalGeralReal += cReal;

          csv += `${sanitize(emp.name)};${sanitize(emp.document_id || emp.pj_type || '-')};${sanitize(emp.company || '-')};${sanitize(emp.linkType || '-')};${sanitize(emp.job_role || '-')};${sanitize(c.competencia.slice(0, 7))};${sanitize(origemLabel)};${previsto.toFixed(2).replace('.', ',')};${(c.valor_fixo || 0).toFixed(2).replace('.', ',')};${(c.valor_bonus || 0).toFixed(2).replace('.', ',')};${(c.valor_comissao || 0).toFixed(2).replace('.', ',')};${(c.valor_hora_extra || 0).toFixed(2).replace('.', ',')};${ben.toFixed(2).replace('.', ',')};${(c.valor_fgts || 0).toFixed(2).replace('.', ',')};${decFer.toFixed(2).replace('.', ',')};${(c.valor_descontos || 0).toFixed(2).replace('.', ',')};${cReal.toFixed(2).replace('.', ',')};${diff.toFixed(2).replace('.', ',')};${sanitize(statusAuditoria)};${sanitize(c.observacao || '')}\n`;
        });
      });

      const totalDiffGeral = totalGeralReal - totalGeralPrevisto;
      const statusGeral = Math.abs(totalDiffGeral) < 0.01 ? 'Conciliado' : (totalDiffGeral > 0 ? 'Acima do Previsto (+)' : 'Abaixo do Previsto (-)');

      csv += `\nTOTAL GERAL CONSOLIDADO;TOTAL GERAL;-;-;-;${filteredCostsScope.length} COMPETÊNCIAS;TOTAL;${totalGeralPrevisto.toFixed(2).replace('.', ',')};${totalGeralFixo.toFixed(2).replace('.', ',')};${totalGeralBonus.toFixed(2).replace('.', ',')};${totalGeralComissao.toFixed(2).replace('.', ',')};${totalGeralExtras.toFixed(2).replace('.', ',')};${totalGeralBeneficios.toFixed(2).replace('.', ',')};${totalGeralFgts.toFixed(2).replace('.', ',')};${totalGeralDecFer.toFixed(2).replace('.', ',')};${totalGeralDescontos.toFixed(2).replace('.', ',')};${totalGeralReal.toFixed(2).replace('.', ',')};${totalDiffGeral.toFixed(2).replace('.', ',')};${sanitize(statusGeral)};-\n`;

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Auditoria_Consolidada_Faturamento_Custos_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onClose();
      return;
    }

    // Modo Fichas Cadastrais
    csv += `"CADASTRO DE CONTRATADOS EM LOTE"\n`;
    csv += `"Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}"\n\n`;
    csv += `Nome;CPF;RG;Gênero;Empresa;Regime;Cargo / Escopo;Setor;Início Contrato;Vencimento Contrato;Status;E-mail;Telefone;Cidade;UF;Chave PIX;Valor Contratual\n`;

    targetEmployees.forEach(e => {
      csv += `${sanitize(e.name)};${sanitize(e.document_id)};${sanitize(e.document_rg)};${sanitize(e.gender)};${sanitize(e.company)};${sanitize(e.linkType)};${sanitize(e.job_role)};${sanitize(e.department)};${sanitize(formatDate(e.start_date))};${sanitize(formatDate(e.contract_expiry_date))};${sanitize(e.status || 'Ativo')};${sanitize(e.email_professional || e.email)};${sanitize(e.phone_professional || e.phone)};${sanitize(e.city)};${sanitize(e.state)};${sanitize(e.pix_key)};${(e.remuneration_fixed || e.remuneration || 0).toFixed(2).replace('.', ',')}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contratados_Lote_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onClose();
  };

  // EXPORTAÇÃO PDF EM LOTE (AUDITORIA CONSOLIDADA OU FICHAS CADASTRAIS)
  const handleExportBatchPDF = () => {
    if (targetEmployees.length === 0) {
      alert('Nenhum contratado selecionado para geração em lote.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups no seu navegador para imprimir o relatório em PDF.');
      return;
    }

    // MODO 1: RELATÓRIO CONSOLIDADO DE AUDITORIA DE FATURAMENTO E CUSTOS
    if (reportMode === 'audit') {
      let totalPrevistoConsolidado = 0;
      let totalRealConsolidado = 0;
      let totalCompetenciasCount = 0;

      // Resumo executivo por colaborador para a tabela da capa
      const collaboratorsSummary = targetEmployees.map(emp => {
        const empCosts = allMonthlyCosts.filter(c => {
          if (c.employee_id !== emp.id) return false;
          if (selectedYear !== 'all') return c.competencia.startsWith(selectedYear);
          return true;
        }).sort((a, b) => a.competencia.localeCompare(b.competencia));

        const previstoMensal = emp.remuneration_fixed || emp.remuneration || 0;
        const previstoTotal = previstoMensal * empCosts.length;
        const realTotal = empCosts.reduce((acc, c) => acc + (c.valor_liquido || 0) + (c.vinculo_tipo === 'CLT' ? (c.valor_adiantamento || 0) : 0), 0);
        const diffTotal = realTotal - previstoTotal;

        totalPrevistoConsolidado += previstoTotal;
        totalRealConsolidado += realTotal;
        totalCompetenciasCount += empCosts.length;

        return {
          emp,
          costs: empCosts,
          previstoMensal,
          previstoTotal,
          realTotal,
          diffTotal,
          status: Math.abs(diffTotal) < 0.01 ? 'Conciliado' : (diffTotal > 0 ? 'Acima (+)' : 'Abaixo (-)')
        };
      });

      const diffGeralTotal = totalRealConsolidado - totalPrevistoConsolidado;

      let auditBatchHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Relatório Consolidado de Auditoria — ${targetEmployees.length} Contratados</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 11px; background: #fff; }
            .page-break { page-break-after: always; }
            .header { border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
            .badge-source { display: inline-block; padding: 2px 5px; border-radius: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; border: 1px solid transparent; }
            .badge-status { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 8.5px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
            th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 9px; text-align: left; padding: 6px 5px; border: 1px solid #e2e8f0; }
            td { padding: 5px; border: 1px solid #e2e8f0; color: #334155; }
            .section-box { margin-bottom: 16px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; page-break-inside: avoid; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <!-- CAPA EXECUTIVA CONSOLIDADA -->
          <div class="header">
            <div>
              <span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 6px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; display: inline-block; margin-bottom: 4px;">
                Auditoria Consolidada de Faturamento &amp; Custos
              </span>
              <h1 style="font-size: 20px; margin: 0; color: #0f172a; font-weight: 800;">
                Relatório de Auditoria Financeira de Contratados
              </h1>
              <p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px; font-weight: 600;">
                Batimento de Valores Previstos em Contrato vs Custos Reais com Rastreabilidade de Fontes (Dianna, Manual, Folha CLT)
              </p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 9.5px; color: #94a3b8; margin: 0;">Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
              <p style="font-size: 10px; font-weight: 700; color: #334155; margin: 2px 0 0 0;">Filtro: ${selectedYear === 'all' ? 'Todas as Competências' : `Competências de ${selectedYear}`}</p>
            </div>
          </div>

          <!-- Cards de KPIs Consolidados -->
          <div style="margin-bottom: 16px; background: #fffdf5; border: 1.5px solid #fde68a; padding: 12px; border-radius: 8px;">
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">
              <div style="background: #ffffff; padding: 8px 10px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block;">Contratados Auditados</span>
                <span style="font-size: 14px; font-weight: 800; color: #0f172a; display: block; margin-top: 2px;">${targetEmployees.length} contratado(s)</span>
              </div>
              <div style="background: #ffffff; padding: 8px 10px; border-radius: 6px; border-left: 3px solid #10b981;">
                <span style="font-size: 9px; font-weight: 700; color: #047857; text-transform: uppercase; display: block;">Competências Analisadas</span>
                <span style="font-size: 14px; font-weight: 800; color: #047857; display: block; margin-top: 2px;">${totalCompetenciasCount} competência(s)</span>
              </div>
              <div style="background: #ffffff; padding: 8px 10px; border-radius: 6px; border-left: 3px solid #6366f1;">
                <span style="font-size: 9px; font-weight: 700; color: #4338ca; text-transform: uppercase; display: block;">Total Previsto Contratual</span>
                <span style="font-size: 14px; font-weight: 800; color: #4338ca; display: block; margin-top: 2px;">${formatCurrency(totalPrevistoConsolidado)}</span>
              </div>
              <div style="background: #ffffff; padding: 8px 10px; border-radius: 6px; border-left: 3px solid #b45309;">
                <span style="font-size: 9px; font-weight: 700; color: #92400e; text-transform: uppercase; display: block;">Total Real Desembolsado</span>
                <span style="font-size: 14px; font-weight: 800; color: #b45309; display: block; margin-top: 2px;">${formatCurrency(totalRealConsolidado)}</span>
              </div>
              <div style="background: ${Math.abs(diffGeralTotal) < 0.01 ? '#ecfdf5' : (diffGeralTotal > 0 ? '#fff1f2' : '#f0f9ff')}; padding: 8px 10px; border-radius: 6px; border-left: 3px solid ${Math.abs(diffGeralTotal) < 0.01 ? '#10b981' : (diffGeralTotal > 0 ? '#f43f5e' : '#0284c7')};">
                <span style="font-size: 9px; font-weight: 700; color: ${Math.abs(diffGeralTotal) < 0.01 ? '#047857' : (diffGeralTotal > 0 ? '#be123c' : '#0369a1')}; text-transform: uppercase; display: block;">Divergência Consolidada</span>
                <span style="font-size: 14px; font-weight: 800; color: ${Math.abs(diffGeralTotal) < 0.01 ? '#047857' : (diffGeralTotal > 0 ? '#be123c' : '#0369a1')}; display: block; margin-top: 2px;">
                  ${diffGeralTotal > 0 ? '+' : ''}${formatCurrency(diffGeralTotal)}
                </span>
              </div>
            </div>
          </div>

          <!-- TABELA DE RESUMO EXECUTIVO (CONCILIAÇÃO POR CONTRATADO) -->
          <div style="margin-bottom: 20px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px;">
              Quadro Geral de Conciliação Financeira por Contratado
            </div>
            <table>
              <thead>
                <tr>
                  <th>Contratado</th>
                  <th>Empresa</th>
                  <th>Regime</th>
                  <th>Cargo / Escopo</th>
                  <th style="text-align: center;">Competências</th>
                  <th style="text-align: right;">Previsto Total</th>
                  <th style="text-align: right;">Custo Real Total</th>
                  <th style="text-align: right;">Divergência</th>
                  <th style="text-align: center;">Status Auditoria</th>
                </tr>
              </thead>
              <tbody>
                ${collaboratorsSummary.map(item => {
                  const isMatch = Math.abs(item.diffTotal) < 0.01;
                  return `
                  <tr>
                    <td><strong>${item.emp.name}</strong></td>
                    <td>${item.emp.company || '-'}</td>
                    <td>${item.emp.linkType || '-'}</td>
                    <td>${item.emp.job_role || '-'}</td>
                    <td style="text-align: center;">${item.costs.length}</td>
                    <td style="text-align: right;">${formatCurrency(item.previstoTotal)}</td>
                    <td style="text-align: right; font-weight: 700; color: #b45309;">${formatCurrency(item.realTotal)}</td>
                    <td style="text-align: right; font-weight: 700; color: ${isMatch ? '#047857' : (item.diffTotal > 0 ? '#be123c' : '#0369a1')};">
                      ${item.diffTotal > 0 ? '+' : ''}${formatCurrency(item.diffTotal)}
                    </td>
                    <td style="text-align: center;">
                      <span class="badge-status" style="background: ${isMatch ? '#ecfdf5' : (item.diffTotal > 0 ? '#fff1f2' : '#f0f9ff')}; color: ${isMatch ? '#047857' : (item.diffTotal > 0 ? '#be123c' : '#0369a1')}; border: 1px solid ${isMatch ? '#a7f3d0' : (item.diffTotal > 0 ? '#fecdd3' : '#bae6fd')};">
                        ${isMatch ? 'Conciliado' : (item.diffTotal > 0 ? 'Acima (+)' : 'Abaixo (-)')}
                      </span>
                    </td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background: #fffbeb; font-weight: 800; color: #92400e; border-top: 2px solid #fde68a;">
                  <td colspan="4">TOTAL GERAL CONSOLIDADO (${targetEmployees.length} CONTRATADOS)</td>
                  <td style="text-align: center;">${totalCompetenciasCount}</td>
                  <td style="text-align: right;">${formatCurrency(totalPrevistoConsolidado)}</td>
                  <td style="text-align: right; color: #b45309;">${formatCurrency(totalRealConsolidado)}</td>
                  <td style="text-align: right; color: ${Math.abs(diffGeralTotal) < 0.01 ? '#047857' : (diffGeralTotal > 0 ? '#be123c' : '#0369a1')};">
                    ${diffGeralTotal > 0 ? '+' : ''}${formatCurrency(diffGeralTotal)}
                  </td>
                  <td style="text-align: center;">${Math.abs(diffGeralTotal) < 0.01 ? '100% OK' : 'Com Divergências'}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="page-break"></div>

          <!-- DETALHAMENTO DE CADA CONTRATADO E SUAS RESPECTIVAS COMPETÊNCIAS -->
          <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 12px; border-bottom: 2px solid #f59e0b; padding-bottom: 4px;">
            Detalhamento Individual de Competências e Fontes dos Contratados
          </div>

          ${collaboratorsSummary.map((item, idx) => {
            const { emp, costs, previstoMensal, previstoTotal, realTotal, diffTotal } = item;
            if (costs.length === 0) return '';

            return `
              <div class="section-box">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
                  <div>
                    <h3 style="font-size: 13px; margin: 0; color: #0f172a; font-weight: 800;">
                      ${idx + 1}. ${emp.name} 
                      <span style="font-size: 10px; font-weight: 600; color: #64748b; margin-left: 6px;">
                        (${emp.linkType || 'CLT'} • ${emp.company || 'MarBR'} • ${emp.job_role || 'Função não informada'})
                      </span>
                    </h3>
                  </div>
                  <div style="font-size: 10px; font-weight: 700; color: #334155;">
                    Previsto Mensal: <strong>${formatCurrency(previstoMensal)}</strong> &nbsp;|&nbsp; 
                    Real Total: <strong style="color: #b45309;">${formatCurrency(realTotal)}</strong> &nbsp;|&nbsp;
                    Diferença: <strong style="color: ${Math.abs(diffTotal) < 0.01 ? '#047857' : (diffTotal > 0 ? '#be123c' : '#0369a1')}">${diffTotal > 0 ? '+' : ''}${formatCurrency(diffTotal)}</strong>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Competência</th>
                      <th>Regime</th>
                      <th>Fonte / Origem da Informação</th>
                      <th>Previsto Contrato</th>
                      <th>Valor Fixo Real</th>
                      <th>Bônus/Comissão</th>
                      <th>Benef./Encargos</th>
                      <th>Descontos</th>
                      <th style="text-align: right;">Custo Real</th>
                      <th style="text-align: right;">Diferença</th>
                      <th style="text-align: center;">Status</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${costs.map(c => {
                      const isCLT = c.vinculo_tipo === 'CLT';
                      const cReal = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
                      const diff = cReal - previstoMensal;
                      const isMatch = Math.abs(diff) < 0.01;
                      const badgeOrigem = getCostOrigemBadgeStyle(c.origem);
                      const benEnc = (c.valor_vr || 0) + (c.valor_vt || 0) + (c.valor_cesta || 0) + (c.valor_ajuda_custo || 0) + (c.valor_fgts || 0);
                      const varTotal = (c.valor_bonus || 0) + (c.valor_comissao || 0);

                      return `
                      <tr>
                        <td><strong>${c.competencia.slice(0, 7)}</strong></td>
                        <td>${c.vinculo_tipo}</td>
                        <td>
                          <span class="badge-source" style="background: ${badgeOrigem.bg}; color: ${badgeOrigem.color}; border-color: ${badgeOrigem.border};">
                            ${formatCostOrigem(c.origem)}
                          </span>
                        </td>
                        <td>${formatCurrency(previstoMensal)}</td>
                        <td>${formatCurrency(c.valor_fixo || 0)}</td>
                        <td>${formatCurrency(varTotal)}</td>
                        <td>${formatCurrency(benEnc)}</td>
                        <td>${formatCurrency(c.valor_descontos || 0)}</td>
                        <td style="text-align: right; font-weight: 700; color: #b45309;">${formatCurrency(cReal)}</td>
                        <td style="text-align: right; font-weight: 700; color: ${isMatch ? '#047857' : (diff > 0 ? '#b91c1c' : '#0369a1')};">
                          ${diff > 0 ? '+' : ''}${formatCurrency(diff)}
                        </td>
                        <td style="text-align: center;">
                          <span class="badge-status" style="background: ${isMatch ? '#ecfdf5' : (diff > 0 ? '#fff1f2' : '#f0f9ff')}; color: ${isMatch ? '#047857' : (diff > 0 ? '#be123c' : '#0369a1')}; border: 1px solid ${isMatch ? '#a7f3d0' : (diff > 0 ? '#fecdd3' : '#bae6fd')};">
                            ${isMatch ? 'Conciliado' : (diff > 0 ? 'Acima (+)' : 'Abaixo (-)')}
                          </span>
                        </td>
                        <td style="font-size: 9px; color: #64748b;">${c.observacao || '-'}</td>
                      </tr>
                      `;
                    }).join('')}
                  </tbody>
                  <tfoot>
                    <tr style="background: #f8fafc; font-weight: 700;">
                      <td colspan="3">SUBTOTAL (${costs.length} COMPETÊNCIAS)</td>
                      <td>${formatCurrency(previstoTotal)}</td>
                      <td colspan="4">-</td>
                      <td style="text-align: right; color: #b45309;">${formatCurrency(realTotal)}</td>
                      <td style="text-align: right; color: ${Math.abs(diffTotal) < 0.01 ? '#047857' : (diffTotal > 0 ? '#be123c' : '#0369a1')};">
                        ${diffTotal > 0 ? '+' : ''}${formatCurrency(diffTotal)}
                      </td>
                      <td style="text-align: center;">${Math.abs(diffTotal) < 0.01 ? 'OK' : 'Divergente'}</td>
                      <td>-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            `;
          }).join('')}

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            }
          </script>
        </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(auditBatchHtml);
      printWindow.document.close();
      return;
    }

    // MODO 2: FICHAS CADASTRAIS COMPLETAS EM LOTE (1 ficha por página)
    let batchHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fichas de Contratados em Lote (${targetEmployees.length} Registros)</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; margin: 0; padding: 0; font-size: 11px; }
          .page-break { page-break-after: always; }
          .header { border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
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
      const empName = profile.name || 'Contratado';
      const photoUrl = profile.avatar || (profile as any).photo_url || null;
      const companyLogoUrl = getCompanyLogoUrl(profile.company);
      const empCosts = allMonthlyCosts.filter(c => c.employee_id === profile.id);

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
                Empresa: <strong style="color: #b45309;">${profile.company || 'MarBR'}</strong> &nbsp;|&nbsp; Regime: <strong>${profile.linkType || 'CLT'}</strong>
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
              <div class="field"><span class="field-label">Representante</span><span class="field-value">${profile.name || '-'}</span></div>
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
            <div class="section-title">2. Dados Contratuais & Regime</div>
            <div class="grid-3">
              <div class="field"><span class="field-label">Empresa do Regime</span><span class="field-value">${profile.company || '-'}</span></div>
              <div class="field"><span class="field-label">Tipo de Regime</span><span class="field-value">${profile.linkType || '-'}</span></div>
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
            <div class="section-title">5. Honorários Contratuais</div>
            <div class="grid-3">
              <div class="field"><span class="field-label">Valor Contrato</span><span class="field-value">${formatCurrency(profile.remuneration_fixed || profile.remuneration || 0)}</span></div>
              <div class="field"><span class="field-label">Bônus</span><span class="field-value">${formatCurrency(profile.remuneration_bonus || 0)}</span></div>
              <div class="field"><span class="field-label">Comissões</span><span class="field-value">${formatCurrency(profile.remuneration_commission || 0)}</span></div>
            </div>
          </div>
        `;
      }

      if (includeCostsHistory && empCosts.length > 0 && costTotals) {
        const isPJ = profile.linkType === 'PJ' || profile.linkType === 'MEI';
        const sortedCosts = [...empCosts].sort((a, b) => a.competencia.localeCompare(b.competencia));

        batchHtml += `
          <div class="section">
            <div class="section-title">6. Histórico de Custos por Competência e Totalizadores</div>
            
            <div style="margin-bottom: 12px; background: #fffdf5; border: 1.5px solid #fef3c7; padding: 10px; border-radius: 8px;">
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                <div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">Total Valor Contrato</span><span class="field-value">${formatCurrency(costTotals.fixed)}</span></div>
                <div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">Total Bônus</span><span class="field-value">${formatCurrency(costTotals.bonus)}</span></div>
                <div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">Total Comissões</span><span class="field-value">${formatCurrency(costTotals.comissao)}</span></div>
                ${!isPJ ? `<div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">Total FGTS</span><span class="field-value">${formatCurrency(costTotals.fgts)}</span></div>` : ''}
                <div class="field" style="border-left: 3px solid #10b981;"><span class="field-label" style="color: #047857;">Média por Competência</span><span class="field-value" style="color: #047857;">${formatCurrency(avgMonthlyCost)}</span></div>
                <div class="field" style="border-left: 4px solid #b45309; background: #fef3c7;"><span class="field-label" style="color: #92400e; font-weight:800;">TOTAL ACUMULADO</span><span class="field-value" style="color: #b45309;">${formatCurrency(costTotals.realCost)}</span></div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Competência</th>
                  <th>Regime</th>
                  <th>Fonte / Origem</th>
                  <th>Valor Contrato</th>
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
                  const badgeOrigem = getCostOrigemBadgeStyle(c.origem);
                  return `
                  <tr>
                    <td><strong>${c.competencia.slice(0, 7)}</strong></td>
                    <td>${c.vinculo_tipo}</td>
                    <td>
                      <span class="badge-source" style="background: ${badgeOrigem.bg}; color: ${badgeOrigem.color}; border: 1px solid ${badgeOrigem.border};">
                        ${formatCostOrigem(c.origem)}
                      </span>
                    </td>
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
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shrink-0 shadow-md font-black">
              {reportMode === 'audit' ? <Calculator size={20} /> : <Printer size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-wide">
                  {reportMode === 'audit' ? 'Auditoria de Faturamento & Custos em Lote' : 'Exportação de Fichas em Lote'}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                  {targetEmployees.length} Selecionados
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {reportMode === 'audit'
                  ? 'Geração consolidada de auditoria de múltiplos contratados com batimento de fontes e valores previstos'
                  : 'Gere relatórios executivos cadastrais consolidados para múltiplos contratados'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Barra de Seleção de Modo (Auditoria vs Ficha Completa) */}
        <div className="px-6 pt-3.5 pb-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReportMode('audit')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              reportMode === 'audit'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck size={16} />
            <span>Relatório de Auditoria de Faturamento &amp; Custos (Lote)</span>
          </button>
          <button
            type="button"
            onClick={() => setReportMode('full')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              reportMode === 'full'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText size={16} />
            <span>Fichas Cadastrais Completas (Dossiê)</span>
          </button>
        </div>

        {/* Barra de Formato (PDF vs CSV) */}
        <div className="px-6 py-2.5 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span>Formato de Saída:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  exportFormat === 'pdf' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Printer size={13} />
                Documento PDF
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  exportFormat === 'csv' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet size={13} />
                Planilha Excel / CSV
              </button>
            </div>
          </div>

          {/* Filtro de Ano / Competência no modo auditoria */}
          {reportMode === 'audit' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-600">Ano da Competência:</span>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="all">Todas as Competências</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>Ano {yr}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Banner Explicativo do Modo Auditoria */}
          {reportMode === 'audit' && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 shadow-xs">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div className="text-xs text-slate-700">
                <span className="font-black text-slate-900 uppercase tracking-wide block mb-0.5">
                  Auditoria Consolidada de Múltiplos Contratados
                </span>
                Gera uma conciliação completa abrangendo os {targetEmployees.length} colaboradores selecionados e suas {filteredCostsScope.length} competências lançadas. Permite auditar instantaneamente cada valor lançado contra a fonte correspondente (Planilha Dianna, Lançamento Manual, Folha CLT, OCR) e contrastar com o valor contratual previsto.
              </div>
            </div>
          )}

          {/* Seleção de Filtros com botões "Todos" e "Limpar" */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Filter size={14} className="text-amber-600" />
                Filtros e Escopo da Equipe ({targetEmployees.length} de {employees.length} selecionados)
              </span>
              <span className="text-[11px] font-bold text-slate-500 lowercase">
                {filteredCostsScope.length} competência(s) no escopo
              </span>
            </h3>

            {/* Filtro Empresa */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase text-slate-500">Filtrar por Empresa</label>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <button onClick={() => setSelectedCompanies([...companies])} className="text-amber-600 hover:underline cursor-pointer">Todos</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setSelectedCompanies([])} className="text-slate-400 hover:underline cursor-pointer">Limpar</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {companies.map(c => {
                  const sel = selectedCompanies.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedCompanies(sel ? selectedCompanies.filter(x => x !== c) : [...selectedCompanies, c])}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${sel ? 'bg-amber-500 text-slate-950 font-black border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
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
                  <button onClick={() => setSelectedDepartments([...departments])} className="text-amber-600 hover:underline cursor-pointer">Todos</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setSelectedDepartments([])} className="text-slate-400 hover:underline cursor-pointer">Limpar</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {departments.map(d => {
                  const sel = selectedDepartments.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => setSelectedDepartments(sel ? selectedDepartments.filter(x => x !== d) : [...selectedDepartments, d])}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${sel ? 'bg-amber-500 text-slate-950 font-black border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
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
                <label className="text-[10px] font-bold uppercase text-slate-500">Filtrar por Regime (CLT / PJ)</label>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <button onClick={() => setSelectedLinkTypes([...linkTypes])} className="text-amber-600 hover:underline cursor-pointer">Todos</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setSelectedLinkTypes([])} className="text-slate-400 hover:underline cursor-pointer">Limpar</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {linkTypes.map(l => {
                  const sel = selectedLinkTypes.includes(l);
                  return (
                    <button
                      key={l}
                      onClick={() => setSelectedLinkTypes(sel ? selectedLinkTypes.filter(x => x !== l) : [...selectedLinkTypes, l])}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${sel ? 'bg-amber-500 text-slate-950 font-black border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Busca & Seleção Fina de Contratados */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  Seleção Individual de Contratados ({selectedEmployeeIds.length > 0 ? `${selectedEmployeeIds.length} selecionados manualmente` : 'todos do filtro ativo'})
                </label>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <button 
                    onClick={() => setSelectedEmployeeIds(targetEmployees.map(e => e.id))} 
                    className="text-amber-600 hover:underline cursor-pointer"
                  >
                    Marcar Todos Filtrados
                  </button>
                  <span className="text-slate-300">|</span>
                  <button 
                    onClick={() => setSelectedEmployeeIds([])} 
                    className="text-slate-400 hover:underline cursor-pointer"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar colaborador por nome, cargo ou CPF..."
                  value={searchEmployeeQuery}
                  onChange={e => setSearchEmployeeQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Lista com scroll dos colaboradores */}
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white p-1">
                {targetEmployees.slice(0, 50).map(emp => {
                  const isChecked = selectedEmployeeIds.length === 0 || selectedEmployeeIds.includes(emp.id);
                  const empCostsCount = allMonthlyCosts.filter(c => c.employee_id === emp.id).length;

                  return (
                    <div
                      key={emp.id}
                      onClick={() => {
                        if (selectedEmployeeIds.length === 0) {
                          // Se estava em "todos", selecionar apenas este
                          setSelectedEmployeeIds([emp.id]);
                        } else if (selectedEmployeeIds.includes(emp.id)) {
                          setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== emp.id));
                        } else {
                          setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                        }
                      }}
                      className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={isChecked ? 'text-amber-600' : 'text-slate-300'}>
                          {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-bold text-slate-800 block truncate">{emp.name}</span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {emp.job_role || 'Sem cargo'} • {emp.company || 'MarBR'} • {emp.linkType || 'CLT'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                        {empCostsCount} comp.
                      </span>
                    </div>
                  );
                })}
                {targetEmployees.length > 50 && (
                  <p className="p-2 text-center text-[10px] text-slate-400 italic">
                    Mostrando os primeiros 50 colaboradores. Use a busca acima para filtrar.
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* Módulos do Relatório (Apenas se em modo Ficha Completa) */}
          {reportMode === 'full' && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Campos &amp; Seções a Incluir nas Fichas</h3>
              <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input type="checkbox" checked={includePersonal} onChange={e => setIncludePersonal(e.target.checked)} className="rounded text-amber-600" />
                  <span>1. Dados Pessoais &amp; Documentos</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input type="checkbox" checked={includeContractual} onChange={e => setIncludeContractual(e.target.checked)} className="rounded text-amber-600" />
                  <span>2. Dados Contratuais &amp; Regime</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input type="checkbox" checked={includeAddressContact} onChange={e => setIncludeAddressContact(e.target.checked)} className="rounded text-amber-600" />
                  <span>3. Endereço &amp; Contatos</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input type="checkbox" checked={includeBanking} onChange={e => setIncludeBanking(e.target.checked)} className="rounded text-amber-600" />
                  <span>4. Dados Bancários &amp; PIX</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input type="checkbox" checked={includeRemuneration} onChange={e => setIncludeRemuneration(e.target.checked)} className="rounded text-amber-600" />
                  <span>5. Honorários Contratuais</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input type="checkbox" checked={includeCostsHistory} onChange={e => setIncludeCostsHistory(e.target.checked)} className="rounded text-amber-600" />
                  <span>6. Histórico de Custos por Competência</span>
                </label>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer">
            Cancelar
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={exportFormat === 'pdf' ? handleExportBatchPDF : handleExportBatchCSV}
              disabled={targetEmployees.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-xl text-xs uppercase shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {exportFormat === 'pdf' ? <Printer size={15} /> : <FileSpreadsheet size={15} />}
              <span>
                {exportFormat === 'pdf' 
                  ? (reportMode === 'audit' ? `Gerar PDF de Auditoria (${targetEmployees.length} Contratados)` : `Gerar Fichas em PDF (${targetEmployees.length})`)
                  : `Exportar Planilha CSV Consolidada (${targetEmployees.length})`
                }
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
