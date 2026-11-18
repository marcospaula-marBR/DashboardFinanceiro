"use client";

import React, { useState, useMemo } from 'react';
import { 
  X, Download, Printer, FileText, CheckSquare, Square, Users, Building2, Briefcase, 
  Filter, FileSpreadsheet, Search, ShieldCheck, Calculator, AlertCircle, CheckCircle2, ChevronRight, HelpCircle,
  Calendar, DollarSign, Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  const [reportMode, setReportMode] = useState<'general' | 'audit' | 'full'>('general');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');

  // Filtros de seleção gerais
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedLinkTypes, setSelectedLinkTypes] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');

  // Novos Filtros Especializados de Relatório (Status, Período e Exibições)
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'all' | 'inactive' | 'ferias'>('active');
  const [dateFilterType, setDateFilterType] = useState<'admission' | 'resignation'>('admission');
  const [isPeriodFilterActive, setIsPeriodFilterActive] = useState(false);
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [includeFinancials, setIncludeFinancials] = useState(true);
  const [includeSummaryCards, setIncludeSummaryCards] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);

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

  // Colaboradores filtrados com base em todos os critérios
  const targetEmployees = useMemo(() => {
    let list = [...employees];

    // Ignora registros internos de sistema se houver
    list = list.filter(e => {
      const nameUpper = (e.name || '').toUpperCase();
      const corpUpper = (e.corporate_name || '').toUpperCase();
      return !nameUpper.includes('SYSTEM_GLOBAL') && !corpUpper.includes('SYSTEM_GLOBAL') && e.id !== '__SYSTEM_GLOBAL_CONFIG__';
    });

    // 1. Filtro de Status
    if (selectedStatus === 'active') {
      list = list.filter(e => {
        const st = (e.status || '').toLowerCase();
        return st !== 'inativo' && st !== 'desligado' && st !== 'demitido' && (e as any).active !== false;
      });
    } else if (selectedStatus === 'inactive') {
      list = list.filter(e => {
        const st = (e.status || '').toLowerCase();
        return st === 'inativo' || st === 'desligado' || st === 'demitido' || (e as any).active === false;
      });
    } else if (selectedStatus === 'ferias') {
      list = list.filter(e => {
        const st = (e.status || '').toLowerCase();
        return st === 'férias' || st === 'ferias' || st === 'afastado';
      });
    }

    // 2. Filtro de Empresa
    if (selectedCompanies.length > 0) {
      list = list.filter(e => selectedCompanies.includes(e.company || ''));
    }

    // 3. Filtro de Departamento
    if (selectedDepartments.length > 0) {
      list = list.filter(e => selectedDepartments.includes(e.department || ''));
    }

    // 4. Filtro de Vínculo
    if (selectedLinkTypes.length > 0) {
      list = list.filter(e => selectedLinkTypes.includes(e.linkType || ''));
    }

    // 5. Filtro de Período de Contratação / Admissão vs Desligamento
    if (isPeriodFilterActive) {
      if (dateFilterType === 'admission') {
        if (periodStartDate) {
          list = list.filter(e => e.start_date && e.start_date >= periodStartDate);
        }
        if (periodEndDate) {
          list = list.filter(e => e.start_date && e.start_date <= periodEndDate);
        }
      } else if (dateFilterType === 'resignation') {
        if (periodStartDate) {
          list = list.filter(e => {
            const resDate = e.resignation_date || (e as any).real_resignation_date;
            return resDate && resDate >= periodStartDate;
          });
        }
        if (periodEndDate) {
          list = list.filter(e => {
            const resDate = e.resignation_date || (e as any).real_resignation_date;
            return resDate && resDate <= periodEndDate;
          });
        }
      }
    }

    // 6. Seleção nominal individual
    if (selectedEmployeeIds.length > 0) {
      list = list.filter(e => selectedEmployeeIds.includes(e.id));
    }

    // 7. Busca textual
    if (searchEmployeeQuery.trim()) {
      const q = searchEmployeeQuery.toLowerCase();
      list = list.filter(e => 
        (e.name || '').toLowerCase().includes(q) ||
        (e.corporate_name || '').toLowerCase().includes(q) ||
        (e.document_id || '').includes(q) ||
        (e.job_role || '').toLowerCase().includes(q) ||
        (e.company || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [
    employees,
    selectedStatus,
    selectedCompanies,
    selectedDepartments,
    selectedLinkTypes,
    isPeriodFilterActive,
    dateFilterType,
    periodStartDate,
    periodEndDate,
    selectedEmployeeIds,
    searchEmployeeQuery
  ]);

  // Indicadores de Headcount e Massa Salarial para o modo Geral
  const reportKpis = useMemo(() => {
    let totalRemuneration = 0;
    let cltCount = 0;
    let pjCount = 0;
    let otherCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;

    targetEmployees.forEach(e => {
      const rem = Number(e.remuneration_fixed || e.remuneration || 0);
      totalRemuneration += rem;
      
      const link = (e.linkType || '').toUpperCase();
      if (link.includes('CLT')) cltCount++;
      else if (link.includes('PJ') || link.includes('MEI')) pjCount++;
      else otherCount++;

      const st = (e.status || '').toLowerCase();
      if (st !== 'inativo' && st !== 'desligado' && st !== 'demitido' && (e as any).active !== false) {
        activeCount++;
      } else {
        inactiveCount++;
      }
    });

    return {
      totalEmployees: targetEmployees.length,
      totalRemuneration,
      cltCount,
      pjCount,
      otherCount,
      activeCount,
      inactiveCount
    };
  }, [targetEmployees]);

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

  // EXPORTAÇÃO CSV
  const handleExportBatchCSV = () => {
    if (targetEmployees.length === 0) {
      alert('Nenhum contratado selecionado para geração em lote.');
      return;
    }

    let csv = '';

    // MODO 0: RELATÓRIO GERAL DE COLABORADORES
    if (reportMode === 'general') {
      csv += `"RELATÓRIO GERAL DE COLABORADORES & QUADRO DE PESSOAL"
`;
      csv += `"Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}"
`;
      csv += `"Total Colaboradores: ${targetEmployees.length}"

`;

      csv += `Nº;Colaborador;CPF / CNPJ;Empresa;Regime;Cargo;Departamento;Data de Admissão;Data de Desligamento;${includeFinancials ? 'Remuneração / Honorários;' : ''}Status
`;

      targetEmployees.forEach((e, idx) => {
        const rem = Number(e.remuneration_fixed || e.remuneration || 0);
        csv += `${idx + 1};${sanitize(e.corporate_name || e.name)};${sanitize(e.document_id || e.pj_type)};${sanitize(e.company)};${sanitize(e.linkType)};${sanitize(e.job_role)};${sanitize(e.department)};${sanitize(e.start_date || '-')};${sanitize(e.resignation_date || (e as any).real_resignation_date || '-')};${includeFinancials ? sanitize(rem.toFixed(2)) + ';' : ''}${sanitize(e.status || ((e as any).active !== false ? 'Ativo' : 'Inativo'))}
`;
      });

      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Relatorio_Colaboradores_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (reportMode === 'audit') {
      csv += `"RELATÓRIO CONSOLIDADO DE AUDITORIA DE FATURAMENTO E CUSTOS"
`;
      csv += `"Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}"
`;
      csv += `"Escopo: ${targetEmployees.length} contratados selecionados | ${filteredCostsScope.length} competências analisadas"
`;
      csv += `"Filtro de Ano: ${selectedYear === 'all' ? 'Todas as Competências' : `Ano ${selectedYear}`}"

`;

      csv += `Colaborador;CPF / CNPJ;Empresa;Regime;Cargo / Escopo;Competência;Fonte / Origem da Informação;Valor Previsto Contratual;Valor Fixo Real;Bônus;Comissão;Horas Extras;Benefícios;FGTS;13º & Férias;Glosas / Descontos;Custo Real Desembolsado;Diferença (Real - Previsto);Status Auditoria;Observações
`;

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

        empCosts.forEach(cost => {
          const isCLT = cost.vinculo_tipo === 'CLT';
          const realCost = (cost.valor_liquido || 0) + (isCLT ? (cost.valor_adiantamento || 0) : 0);
          const diff = realCost - previsto;
          const statusAuditoria = Math.abs(diff) < 0.01 ? 'CONCILIADO' : (diff > 0 ? 'ACIMA DO PREVISTO' : 'ABAIXO DO PREVISTO');
          const totalBen = (cost.valor_vr || 0) + (cost.valor_vt || 0) + (cost.valor_cesta || 0) + (cost.valor_ajuda_custo || 0);
          const totalDecFer = (cost.valor_decimo_terceiro || 0) + (cost.valor_ferias || 0);

          totalGeralPrevisto += previsto;
          totalGeralFixo += cost.valor_fixo || 0;
          totalGeralBonus += cost.valor_bonus || 0;
          totalGeralComissao += cost.valor_comissao || 0;
          totalGeralExtras += cost.valor_hora_extra || 0;
          totalGeralBeneficios += totalBen;
          totalGeralFgts += cost.valor_fgts || 0;
          totalGeralDecFer += totalDecFer;
          totalGeralDescontos += cost.valor_descontos || 0;
          totalGeralReal += realCost;

          csv += `${sanitize(emp.corporate_name || emp.name)};${sanitize(emp.document_id || emp.pj_type)};${sanitize(emp.company)};${sanitize(emp.linkType)};${sanitize(emp.job_role)};${sanitize(cost.competencia.slice(0, 7))};${sanitize(formatCostOrigem(cost.origem))};${previsto.toFixed(2)};${(cost.valor_fixo || 0).toFixed(2)};${(cost.valor_bonus || 0).toFixed(2)};${(cost.valor_comissao || 0).toFixed(2)};${(cost.valor_hora_extra || 0).toFixed(2)};${totalBen.toFixed(2)};${(cost.valor_fgts || 0).toFixed(2)};${totalDecFer.toFixed(2)};${(cost.valor_descontos || 0).toFixed(2)};${realCost.toFixed(2)};${diff.toFixed(2)};${statusAuditoria};${sanitize(cost.observacao || '')}
`;
        });
      });

      csv += `
"TOTAL GERAL CONSOLIDADO";"";"";"";"";"";"";${totalGeralPrevisto.toFixed(2)};${totalGeralFixo.toFixed(2)};${totalGeralBonus.toFixed(2)};${totalGeralComissao.toFixed(2)};${totalGeralExtras.toFixed(2)};${totalGeralBeneficios.toFixed(2)};${totalGeralFgts.toFixed(2)};${totalGeralDecFer.toFixed(2)};${totalGeralDescontos.toFixed(2)};${totalGeralReal.toFixed(2)};${(totalGeralReal - totalGeralPrevisto).toFixed(2)};"";""
`;

      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Auditoria_Consolidada_Lote_${selectedYear !== 'all' ? selectedYear : 'Total'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // MODO 2: FICHA CADASTRAL COMPLETA EM CSV
    csv += `Nome;CPF;RG;Razao Social;CNPJ;Resp Legal;Empresa;Regime;Setor;Cargo;Cidade;UF;Email;Telefone;Chave PIX;Valor Contrato;Status
`;
    targetEmployees.forEach(e => {
      csv += `${sanitize(e.name)};${sanitize(e.document_id)};${sanitize(e.document_rg)};${sanitize(e.corporate_name)};${sanitize(e.pj_type)};${sanitize(e.responsible_name)};${sanitize(e.company)};${sanitize(e.linkType)};${sanitize(e.department)};${sanitize(e.job_role)};${sanitize(e.city)};${sanitize(e.state)};${sanitize(e.email_professional || e.email)};${sanitize(e.phone_professional || e.phone)};${sanitize(e.pix_key)};${(e.remuneration_fixed || e.remuneration || 0).toFixed(2)};${sanitize(e.status)}
`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Fichas_Cadastrais_Lote_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // EXPORTAÇÃO PDF VETORIAL (MODO GERAL)
  const handleExportGeneralPdf = () => {
    if (targetEmployees.length === 0) {
      alert('Nenhum colaborador encontrado com os filtros selecionados.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text('RELATÓRIO GERAL DE COLABORADORES & QUADRO DE PESSOAL', 14, 15);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    const statusLabel = selectedStatus === 'active' ? 'Somente Ativos' : selectedStatus === 'inactive' ? 'Somente Desligados/Inativos' : selectedStatus === 'ferias' ? 'Férias/Afastados' : 'Todos os Status';
    const companiesLabel = selectedCompanies.length > 0 ? selectedCompanies.join(', ') : 'Todas as Empresas';
    const linksLabel = selectedLinkTypes.length > 0 ? selectedLinkTypes.join(', ') : 'Todos os Regimes';
    const dateLabel = isPeriodFilterActive
      ? `${dateFilterType === 'admission' ? 'Admissão' : 'Desligamento'}: de ${periodStartDate || 'início'} até ${periodEndDate || 'hoje'}`
      : 'Histórico Geral Completo';

    doc.text(`ESCOPO: ${companiesLabel} • REGIMES: ${linksLabel} • STATUS: ${statusLabel} • ${dateLabel}`, 14, 21);
    doc.text(`EMISSÃO: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} • TOTAL: ${targetEmployees.length} COLABORADORES`, 14, 26);

    let currentY = 31;

    // Cards de Resumo no Topo se includeSummaryCards
    if (includeSummaryCards) {
      const cardWidth = includeFinancials ? 63 : 84;
      const cardHeight = 14;
      const cardsData = [
        { label: 'HEADCOUNT TOTAL', value: `${reportKpis.totalEmployees} colaboradores`, color: [15, 23, 42] },
        { label: 'DISTRIBUIÇÃO REGIME', value: `${reportKpis.cltCount} CLT • ${reportKpis.pjCount} PJ • ${reportKpis.otherCount} Outros`, color: [30, 41, 59] },
        { label: 'STATUS ATIVO/INATIVO', value: `${reportKpis.activeCount} Ativos • ${reportKpis.inactiveCount} Desligados`, color: [30, 41, 59] },
        ...(includeFinancials ? [{ label: 'MASSA SALARIAL MENSAL', value: formatCurrency(reportKpis.totalRemuneration), color: [4, 120, 87] }] : [])
      ];

      cardsData.forEach((c, idx) => {
        const x = 14 + idx * (cardWidth + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(c.label, x + 4, currentY + 5);

        doc.setFontSize(8.5);
        doc.setTextColor(c.color[0], c.color[1], c.color[2]);
        doc.text(c.value, x + 4, currentY + 10.5);
      });

      currentY += cardHeight + 6;
    }

    const tableHeaders = [
      '#',
      'Colaborador / Razão Social',
      'CPF / CNPJ',
      'Empresa',
      'Regime',
      'Cargo / Escopo',
      'Departamento',
      'Admissão',
      ...(selectedStatus !== 'active' ? ['Desligamento'] : []),
      ...(includeFinancials ? ['Remuneração'] : []),
      'Status'
    ];

    const bodyRows = targetEmployees.map((e, index) => {
      const rem = Number(e.remuneration_fixed || e.remuneration || 0);
      const row = [
        String(index + 1),
        e.corporate_name || e.name || 'Sem nome',
        e.document_id || e.pj_type || '-',
        e.company || 'MarBR',
        e.linkType || 'CLT',
        e.job_role || '-',
        e.department || 'Geral',
        e.start_date ? e.start_date.split('-').reverse().join('/') : '-',
        ...(selectedStatus !== 'active' ? [
          (e.resignation_date || (e as any).real_resignation_date)
            ? (e.resignation_date || (e as any).real_resignation_date).slice(0, 10).split('-').reverse().join('/')
            : '-'
        ] : []),
        ...(includeFinancials ? [formatCurrency(rem)] : []),
        e.status || ((e as any).active !== false ? 'Ativo' : 'Inativo')
      ];
      return row;
    });

    autoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: bodyRows,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5
      },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        ...(includeFinancials ? { [tableHeaders.indexOf('Remuneração')]: { halign: 'right', fontStyle: 'bold' } } : {})
      }
    });

    if (includeSignatures) {
      const finalTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 170;
      const pageHeight = doc.internal.pageSize.getHeight();
      let sigY = finalTableY + 18;
      if (sigY + 25 > pageHeight) {
        doc.addPage();
        sigY = 30;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);

      const sigWidth = 70;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);

      doc.line(40, sigY, 40 + sigWidth, sigY);
      doc.text('GESTÃO DE PESSOAS / RH', 40 + sigWidth / 2, sigY + 4, { align: 'center' });
      doc.text('Emissão e Validação Cadastral', 40 + sigWidth / 2, sigY + 8, { align: 'center' });

      doc.line(170, sigY, 170 + sigWidth, sigY);
      doc.text('DIRETORIA EXECUTIVA', 170 + sigWidth / 2, sigY + 4, { align: 'center' });
      doc.text('Aprovação Institucional', 170 + sigWidth / 2, sigY + 8, { align: 'center' });
    }

    doc.save(`Relatorio_Colaboradores_People_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // EXPORTAÇÃO IMPRESSÃO EM HTML (MODO GERAL, AUDITORIA OU FICHAS)
  const handleExportBatchPDF = () => {
    if (targetEmployees.length === 0) {
      alert('Nenhum contratado selecionado para geração.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups no seu navegador para imprimir o relatório em PDF.');
      return;
    }

    // MODO 0: RELATÓRIO GERAL DE COLABORADORES
    if (reportMode === 'general') {
      const statusLabel = selectedStatus === 'active' ? 'Somente Ativos' : selectedStatus === 'inactive' ? 'Somente Desligados/Inativos' : selectedStatus === 'ferias' ? 'Férias/Afastados' : 'Todos os Status';
      const companiesLabel = selectedCompanies.length > 0 ? selectedCompanies.join(', ') : 'Todas as Empresas';
      const linksLabel = selectedLinkTypes.length > 0 ? selectedLinkTypes.join(', ') : 'Todos os Regimes';
      const dateLabel = isPeriodFilterActive
        ? `${dateFilterType === 'admission' ? 'Admissão' : 'Desligamento'}: de ${periodStartDate || 'início'} até ${periodEndDate || 'hoje'}`
        : 'Histórico Geral Completo';

      const generalHtml = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatório Geral de Colaboradores & Quadro de Pessoal (${targetEmployees.length} Registros)</title>
          <style>
            @page { size: A4 landscape; margin: 12mm 10mm 12mm 10mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 10px; font-size: 11px; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 16px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0; }
            .meta { font-size: 9px; color: #475569; font-weight: 600; text-transform: uppercase; margin-top: 4px; }
            .kpis { display: flex; gap: 8px; margin-bottom: 15px; }
            .kpi-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; }
            .kpi-label { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .kpi-value { font-size: 12px; font-weight: 900; color: #0f172a; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; }
            th { background: #0f172a; color: white; font-weight: 800; text-transform: uppercase; padding: 6px 8px; border: 1px solid #0f172a; text-align: left; font-size: 8.5px; }
            td { padding: 5px 8px; border: 1px solid #e2e8f0; }
            tr:nth-child(even) td { background: #f8fafc; }
            .amount { text-align: right; font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; text-transform: uppercase; }
            .status-active { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            .status-inactive { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
            .signatures { margin-top: 35px; page-break-inside: avoid; display: flex; justify-content: space-around; text-align: center; font-size: 9px; color: #475569; }
            .sig-line { border-top: 1px solid #cbd5e1; width: 220px; padding-top: 6px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 12px; padding: 10px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; color: #92400e;">Relatório Geral de Colaboradores & Quadro de Pessoal</span>
            <div>
              <button onclick="window.print()" style="padding: 6px 14px; background: #059669; color: white; border: none; border-radius: 6px; font-weight: 800; cursor: pointer;">Imprimir / Salvar PDF</button>
              <button onclick="window.close()" style="padding: 6px 14px; background: #e2e8f0; color: #334155; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; margin-left: 6px;">Fechar</button>
            </div>
          </div>

          <div class="header">
            <div>
              <h1 class="title">Relatório Geral de Colaboradores &amp; Quadro de Pessoal</h1>
              <div class="meta">Escopo: ${companiesLabel} • Regimes: ${linksLabel} • Status: ${statusLabel} • ${dateLabel}</div>
              <div class="meta" style="color: #64748b;">Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} • Total: ${targetEmployees.length} Colaboradores</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">MAR BRASIL • DZM • G2</span>
            </div>
          </div>

          ${includeSummaryCards ? `
            <div class="kpis">
              <div class="kpi-card">
                <div class="kpi-label">Headcount Total</div>
                <div class="kpi-value">${reportKpis.totalEmployees} pessoas</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Distribuição por Regime</div>
                <div class="kpi-value">${reportKpis.cltCount} CLT &bull; ${reportKpis.pjCount} PJ &bull; ${reportKpis.otherCount} Outros</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Status Ativo / Inativo</div>
                <div class="kpi-value">${reportKpis.activeCount} Ativos &bull; ${reportKpis.inactiveCount} Desligados</div>
              </div>
              ${includeFinancials ? `
                <div class="kpi-card" style="border-left: 3px solid #059669;">
                  <div class="kpi-label" style="color: #047857;">Massa Salarial Mensal</div>
                  <div class="kpi-value" style="color: #047857;">${formatCurrency(reportKpis.totalRemuneration)}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th>Colaborador / Razão Social</th>
                <th>CPF / CNPJ</th>
                <th>Empresa</th>
                <th>Regime</th>
                <th>Cargo / Escopo</th>
                <th>Departamento</th>
                <th>Admissão</th>
                ${selectedStatus !== 'active' ? '<th>Desligamento</th>' : ''}
                ${includeFinancials ? '<th style="text-align: right;">Remuneração</th>' : ''}
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${targetEmployees.map((e, index) => {
                const rem = Number(e.remuneration_fixed || e.remuneration || 0);
                const isActive = !['inativo', 'desligado', 'demitido'].includes((e.status || '').toLowerCase()) && (e as any).active !== false;
                return `
                  <tr>
                    <td style="text-align: center; color: #64748b; font-weight: bold;">${index + 1}</td>
                    <td><strong>${e.corporate_name || e.name || 'Sem nome'}</strong></td>
                    <td style="font-family: monospace;">${e.document_id || e.pj_type || '-'}</td>
                    <td><strong>${e.company || 'MarBR'}</strong></td>
                    <td>${e.linkType || 'CLT'}</td>
                    <td>${e.job_role || '-'}</td>
                    <td>${e.department || 'Geral'}</td>
                    <td>${e.start_date ? e.start_date.split('-').reverse().join('/') : '-'}</td>
                    ${selectedStatus !== 'active' ? `<td>${(e.resignation_date || (e as any).real_resignation_date) ? (e.resignation_date || (e as any).real_resignation_date).slice(0, 10).split('-').reverse().join('/') : '-'}</td>` : ''}
                    ${includeFinancials ? `<td class="amount">${formatCurrency(rem)}</td>` : ''}
                    <td style="text-align: center;">
                      <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">
                        ${e.status || (isActive ? 'Ativo' : 'Inativo')}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            ${includeFinancials ? `
              <tfoot>
                <tr style="background: #f1f5f9; font-weight: bold;">
                  <td colspan="${selectedStatus !== 'active' ? 9 : 8}" style="text-align: right; text-transform: uppercase;">Total Geral (${targetEmployees.length} colaboradores):</td>
                  <td class="amount" style="color: #047857;">${formatCurrency(reportKpis.totalRemuneration)}</td>
                  <td></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>

          ${includeSignatures ? `
            <div class="signatures">
              <div class="sig-line">
                <strong style="display: block; color: #0f172a;">GESTÃO DE PESSOAS / RH</strong>
                <span>Emissão e Validação Cadastral</span>
              </div>
              <div class="sig-line">
                <strong style="display: block; color: #0f172a;">DIRETORIA EXECUTIVA</strong>
                <span>Aprovação Institucional</span>
              </div>
            </div>
          ` : ''}

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
      printWindow.document.write(generalHtml);
      printWindow.document.close();
      return;
    }

    // MODO 1: RELATÓRIO CONSOLIDADO DE AUDITORIA DE FATURAMENTO E CUSTOS
    if (reportMode === 'audit') {
      let totalPrevistoConsolidado = 0;
      let totalRealConsolidado = 0;
      let totalCompetenciasCount = 0;

      const collaboratorsSummary = targetEmployees.map(emp => {
        const empCosts = allMonthlyCosts.filter(c => {
          if (c.employee_id !== emp.id) return false;
          if (selectedYear !== 'all') return c.competencia.startsWith(selectedYear);
          return true;
        }).sort((a, b) => a.competencia.localeCompare(b.competencia));

        const previsto = emp.remuneration_fixed || emp.remuneration || 0;
        const totalReal = empCosts.reduce((acc, c) => {
          const isCLT = c.vinculo_tipo === 'CLT';
          return acc + (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
        }, 0);

        totalPrevistoConsolidado += (previsto * empCosts.length);
        totalRealConsolidado += totalReal;
        totalCompetenciasCount += empCosts.length;

        return {
          emp,
          costs: empCosts,
          previsto,
          totalReal,
          mediaReal: empCosts.length > 0 ? totalReal / empCosts.length : 0,
          diff: totalReal - (previsto * empCosts.length)
        };
      });

      const auditBatchHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Relatório Consolidado de Auditoria (${targetEmployees.length} Contratados)</title>
          <style>
            @page { size: A4 landscape; margin: 12mm 10mm 12mm 10mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 0; font-size: 10px; }
            .header { border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 16px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0; }
            .meta { font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 3px; }
            .kpis { display: flex; gap: 8px; margin-bottom: 12px; }
            .kpi-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; }
            .kpi-label { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .kpi-value { font-size: 12px; font-weight: 900; color: #0f172a; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9px; }
            th { background: #0f172a; color: white; font-weight: 800; text-transform: uppercase; padding: 5px 6px; border: 1px solid #0f172a; text-align: left; }
            td { padding: 4.5px 6px; border: 1px solid #e2e8f0; }
            tr:nth-child(even) td { background: #f8fafc; }
            .amount { text-align: right; font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .page-break { page-break-after: always; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">Auditoria Consolidada de Faturamento &amp; Custos</h1>
              <div class="meta">
                ${selectedYear === 'all' ? 'Todas as Competências' : `Competências de ${selectedYear}`} • ${targetEmployees.length} Contratados • ${totalCompetenciasCount} Lançamentos Auditados
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; font-weight: 900; color: #0f172a;">MAR BRASIL • DZM • G2</span>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi-card">
              <div class="kpi-label">Total Real Desembolsado</div>
              <div class="kpi-value" style="color: #047857;">${formatCurrency(totalRealConsolidado)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Total Previsto Acumulado</div>
              <div class="kpi-value">${formatCurrency(totalPrevistoConsolidado)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Variação Geral (Real - Previsto)</div>
              <div class="kpi-value" style="color: ${totalRealConsolidado - totalPrevistoConsolidado >= 0 ? '#b45309' : '#047857'};">
                ${formatCurrency(totalRealConsolidado - totalPrevistoConsolidado)}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Contratado</th>
                <th>Empresa</th>
                <th>Regime</th>
                <th>Cargo / Escopo</th>
                <th style="text-align: right;">Previsto / Mês</th>
                <th style="text-align: center;">Meses</th>
                <th style="text-align: right;">Média Real</th>
                <th style="text-align: right;">Total Real</th>
                <th style="text-align: right;">Diferença</th>
              </tr>
            </thead>
            <tbody>
              ${collaboratorsSummary.map(c => `
                <tr>
                  <td><strong>${c.emp.corporate_name || c.emp.name}</strong></td>
                  <td>${c.emp.company || 'MarBR'}</td>
                  <td>${c.emp.linkType || 'CLT'}</td>
                  <td>${c.emp.job_role || '-'}</td>
                  <td class="amount">${formatCurrency(c.previsto)}</td>
                  <td style="text-align: center;">${c.costs.length}</td>
                  <td class="amount">${formatCurrency(c.mediaReal)}</td>
                  <td class="amount" style="color: #047857;">${formatCurrency(c.totalReal)}</td>
                  <td class="amount" style="color: ${c.diff > 0 ? '#b45309' : c.diff < 0 ? '#047857' : '#64748b'};">
                    ${c.diff > 0 ? '+' : ''}${formatCurrency(c.diff)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

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
            </div>
          </div>
        `;
      }

      if (includeCostsHistory && costTotals) {
        const sortedCosts = [...empCosts].sort((a, b) => a.competencia.localeCompare(b.competencia));
        const isPJ = profile.linkType?.toUpperCase().includes('PJ') || profile.linkType?.toUpperCase().includes('MEI');

        batchHtml += `
          <div class="section">
            <div class="section-title">6. Histórico de Custos por Competência e Totalizadores</div>
            
            <div style="margin-bottom: 12px; background: #fffdf5; border: 1.5px solid #fef3c7; padding: 10px; border-radius: 8px;">
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                <div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">Total Valor Contrato</span><span class="field-value">${formatCurrency(costTotals.fixed)}</span></div>
                <div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">Total Bônus</span><span class="field-value">${formatCurrency(costTotals.bonus)}</span></div>
                <div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">Total Comissões</span><span class="field-value">${formatCurrency(costTotals.comissao)}</span></div>
                ${!isPJ ? `<div class="field" style="border-left: 3px solid #f59e0b;"><span class="field-label">Total FGTS</span><span class="field-value">${formatCurrency(costTotals.fgts)}</span></div>` : ''}
                <div class="field" style="border-left: 3px solid #10b981;"><span class="field-label" style="color: #047857;">Média por Competência</span><span class="field-value" style="color: #047857;">${formatCurrency(costTotals.realCost / (empCosts.length || 1))}</span></div>
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
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shrink-0 shadow-md font-black">
              {reportMode === 'general' ? <Users size={20} /> : reportMode === 'audit' ? <Calculator size={20} /> : <Printer size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-wide">
                  Central de Emissão de Relatórios — People
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                  {targetEmployees.length} Selecionados
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {reportMode === 'general'
                  ? 'Gere a relação nominal executiva customizada com filtros de status, regimes, datas e opções financeiras'
                  : reportMode === 'audit'
                  ? 'Geração consolidada de auditoria de múltiplos contratados com batimento de fontes e valores previstos'
                  : 'Gere relatórios executivos cadastrais consolidados para múltiplos contratados'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Barra de Seleção de Modo (3 Abas Unificadas) */}
        <div className="px-6 pt-3.5 pb-2 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReportMode('general')}
            className={`flex-1 min-w-[200px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              reportMode === 'general'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users size={16} />
            <span>Relação Geral de Colaboradores (Quadro / Headcount)</span>
          </button>
          <button
            type="button"
            onClick={() => setReportMode('audit')}
            className={`flex-1 min-w-[180px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              reportMode === 'audit'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck size={16} />
            <span>Auditoria de Custos &amp; Faturamento</span>
          </button>
          <button
            type="button"
            onClick={() => setReportMode('full')}
            className={`flex-1 min-w-[180px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              reportMode === 'full'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText size={16} />
            <span>Fichas Cadastrais (Dossiê)</span>
          </button>
        </div>

        {/* Barra de Formato (PDF vs CSV) */}
        <div className="px-6 py-2.5 bg-slate-100/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
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

          {/* Filtro de Ano na Auditoria */}
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
          
          {/* Card de Prévia Executiva em Tempo Real (Modo Geral) */}
          {reportMode === 'general' && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3 font-sans">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Prévia do Recorte Selecionado
                </span>
                <span className="text-xs font-black text-amber-400">
                  {targetEmployees.length} de {employees.length} colaboradores
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Headcount</span>
                  <strong className="text-sm font-black text-white">{reportKpis.totalEmployees} pessoas</strong>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Regimes</span>
                  <span className="text-xs font-bold text-slate-200 block truncate">{reportKpis.cltCount} CLT &bull; {reportKpis.pjCount} PJ &bull; {reportKpis.otherCount} Outros</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Status</span>
                  <span className="text-xs font-bold text-slate-200 block">{reportKpis.activeCount} Ativos &bull; {reportKpis.inactiveCount} Desligados</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Massa Salarial</span>
                  <strong className="text-sm font-black text-emerald-400">
                    {includeFinancials ? formatCurrency(reportKpis.totalRemuneration) : 'Oculto'}
                  </strong>
                </div>
              </div>
            </div>
          )}

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

          {/* 1. SELEÇÃO DE STATUS (NOVO REQUISITO) */}
          {reportMode === 'general' && (
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 block">
                1. Status de Atividade
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'active', label: 'Somente Ativos', desc: 'Colaboradores com contrato ativo' },
                  { id: 'all', label: 'Todos', desc: 'Ativos + Desligados' },
                  { id: 'inactive', label: 'Somente Inativos / Desligados', desc: 'Histórico de rescisões' },
                  { id: 'ferias', label: 'Férias / Afastados', desc: 'Ausências temporárias' }
                ].map(item => {
                  const isSel = selectedStatus === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedStatus(item.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSel
                          ? 'bg-amber-500 text-slate-950 font-black border-amber-500 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">{item.label}</div>
                      <div className={`text-[10px] mt-0.5 ${isSel ? 'text-slate-900' : 'text-slate-400'}`}>{item.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. FILTRO DE PERÍODO DE CONTRATAÇÃO / DESLIGAMENTO (NOVO REQUISITO) */}
          {reportMode === 'general' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Calendar size={14} className="text-amber-600" />
                  <span>2. Período de Contratação / Rescisão</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isPeriodFilterActive}
                    onChange={e => setIsPeriodFilterActive(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300 cursor-pointer"
                  />
                  <span>Filtrar por intervalo de datas</span>
                </label>
              </div>

              {isPeriodFilterActive && (
                <div className="space-y-3 pt-2 border-t border-slate-200/80">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-600">Critério de Data:</span>
                    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
                      <button
                        type="button"
                        onClick={() => setDateFilterType('admission')}
                        className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                          dateFilterType === 'admission' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Período de Admissão / Contratação
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateFilterType('resignation')}
                        className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                          dateFilterType === 'resignation' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Período de Desligamento / Rescisão
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Data Inicial (A partir de)</label>
                      <input
                        type="date"
                        value={periodStartDate}
                        onChange={e => setPeriodStartDate(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Data Final (Até)</label>
                      <input
                        type="date"
                        value={periodEndDate}
                        onChange={e => setPeriodEndDate(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. FILTROS DE ESCOPO DA EQUIPE (EMPRESA, SETOR, REGIME) */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Filter size={14} className="text-amber-600" />
                3. Filtros de Empresa, Setor e Regime ({targetEmployees.length} de {employees.length} selecionados)
              </span>
            </h3>

            {/* Filtro Empresa */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase text-slate-500">Filtrar por Empresa Contratante</label>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <button onClick={() => setSelectedCompanies([...companies])} className="text-amber-600 hover:underline cursor-pointer">Todas</button>
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${sel ? 'bg-amber-500 text-slate-950 font-black border-amber-500 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtro Vínculo / Regime */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase text-slate-500">Filtrar por Regime / Tipo de Vínculo</label>
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${sel ? 'bg-amber-500 text-slate-950 font-black border-amber-500 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {l}
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
          </div>

          {/* 4. OPÇÕES EXECUTIVAS DO RELATÓRIO (VALORES FINANCEIROS, CARDS, ASSINATURAS) */}
          {reportMode === 'general' && (
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 block">
                4. Opções e Seções do Relatório
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={includeFinancials}
                    onChange={e => setIncludeFinancials(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Exibir Valores Financeiros</span>
                    <span className="text-[10px] text-slate-500 block">Remuneração / honorários contratuais e somatório</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={includeSummaryCards}
                    onChange={e => setIncludeSummaryCards(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Cards de Indicadores</span>
                    <span className="text-[10px] text-slate-500 block">Headcount, CLT vs PJ, ativos/inativos e massa salarial</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={includeSignatures}
                    onChange={e => setIncludeSignatures(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Bloco de Assinaturas</span>
                    <span className="text-[10px] text-slate-500 block">Campos formais de validação de RH e Diretoria</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Opções das Fichas Cadastrais Completas */}
          {reportMode === 'full' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Módulos a Incluir em Cada Ficha Cadastral
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input type="checkbox" checked={includePersonal} onChange={e => setIncludePersonal(e.target.checked)} className="w-4 h-4 text-amber-500 rounded border-slate-300" />
                  <span>1. Dados Pessoais / PJ</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input type="checkbox" checked={includeContractual} onChange={e => setIncludeContractual(e.target.checked)} className="w-4 h-4 text-amber-500 rounded border-slate-300" />
                  <span>2. Dados Contratuais</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input type="checkbox" checked={includeAddressContact} onChange={e => setIncludeAddressContact(e.target.checked)} className="w-4 h-4 text-amber-500 rounded border-slate-300" />
                  <span>3. Endereço &amp; Contato</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input type="checkbox" checked={includeBanking} onChange={e => setIncludeBanking(e.target.checked)} className="w-4 h-4 text-amber-500 rounded border-slate-300" />
                  <span>4. Dados Bancários &amp; PIX</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input type="checkbox" checked={includeRemuneration} onChange={e => setIncludeRemuneration(e.target.checked)} className="w-4 h-4 text-amber-500 rounded border-slate-300" />
                  <span>5. Honorários / Salário</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input type="checkbox" checked={includeCostsHistory} onChange={e => setIncludeCostsHistory(e.target.checked)} className="w-4 h-4 text-amber-500 rounded border-slate-300" />
                  <span>6. Histórico de Custos</span>
                </label>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs uppercase cursor-pointer transition-colors text-center"
          >
            Cancelar
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {reportMode === 'general' && exportFormat === 'pdf' ? (
              <>
                <button
                  type="button"
                  onClick={handleExportBatchPDF}
                  disabled={targetEmployees.length === 0}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                  title="Abrir pré-visualização formatada para impressão direta ou salvar como PDF"
                >
                  <Printer size={15} />
                  <span>Visualizar Impressão</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportGeneralPdf}
                  disabled={targetEmployees.length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                  title="Baixar arquivo PDF vetorial oficial timbrado"
                >
                  <Download size={15} />
                  <span>Baixar Arquivo PDF ({targetEmployees.length})</span>
                </button>
              </>
            ) : (
              <button
                onClick={exportFormat === 'pdf' ? handleExportBatchPDF : handleExportBatchCSV}
                disabled={targetEmployees.length === 0}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-xl text-xs uppercase shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {exportFormat === 'pdf' ? <Printer size={15} /> : <FileSpreadsheet size={15} />}
                <span>
                  {exportFormat === 'pdf' 
                    ? (reportMode === 'audit' ? `Gerar PDF de Auditoria (${targetEmployees.length} Contratados)` : `Gerar Fichas em PDF (${targetEmployees.length})`)
                    : `Exportar Planilha CSV Consolidada (${targetEmployees.length})`
                  }
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
