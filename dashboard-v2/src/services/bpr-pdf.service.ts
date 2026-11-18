import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BprCalculationSummary, 
  BprRuleConfig, 
  BprSavedScenario,
  BprCandidateResult
} from '@/types/bpr';

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatDatePtBr = (dateStr?: string) => {
  if (!dateStr) return '-';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
};

export interface BprPdfMeta {
  scenarioName?: string;
  studyDate?: string;
  criteria?: string;
}

export interface ScenarioComparisonItem {
  employeeId: string;
  name: string;
  corporateName?: string;
  company: string;
  department: string;
  jobRole: string;
  camadaLabel: string;
  scenarioValues: Record<string, { amount: number; isEligible: boolean }>;
  delta?: number;
}

export class BprPdfService {

  /**
   * Exporta arquivo PDF vetorial executivo da apuração BPR via jsPDF + autoTable
   */
  static exportBprPdf(
    summary: BprCalculationSummary,
    config: BprRuleConfig,
    meta?: BprPdfMeta
  ): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const cycleLabel = config.cycle === 'ciclo_1' 
      ? '1º Semestre (C1)' 
      : config.cycle === 'ciclo_2' 
        ? '2º Semestre (C2)' 
        : 'Customizado';

    const scenarioTitle = meta?.scenarioName || `Apuração BPR ${cycleLabel} ${config.year}`;
    const studyDateFormatted = meta?.studyDate ? formatDatePtBr(meta.studyDate) : formatDatePtBr(new Date().toISOString().slice(0, 10));

    // Cabeçalho Principal Executivo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('RELATÓRIO EXECUTIVO DE APURAÇÃO BPR', 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text('BÔNUS POR PARTICIPAÇÃO NOS RESULTADOS • APURAÇÃO DETERMINÍSTICA PER CAPITA', 14, 21);

    // Box de Metadados do Estudo
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, 24, 269, 21, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`CENÁRIO / ESTUDO:`, 18, 29);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(scenarioTitle, 55, 29);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`DATA DO ESTUDO:`, 18, 35);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${studyDateFormatted}  (Vigência: ${formatDatePtBr(config.periodStartDate)} a ${formatDatePtBr(config.periodEndDate)} · Pgto: ${formatDatePtBr(config.paymentDate)})`, 55, 35);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`CRITÉRIOS / PREMISSAS:`, 18, 41);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const criteriaText = meta?.criteria 
      ? meta.criteria 
      : `Modo: ${config.splitMode === 'amount' ? 'Valor Fixo R$' : 'Percentual'} | Splits: E (${config.tierSplits.E}%), T (${config.tierSplits.T}%), O (${config.tierSplits.O}%) | Glosados: ${config.allowGlosados ? 'Incluídos' : 'Excluídos'} | Inativos: ${config.allowInativos ? 'Incluídos' : 'Excluídos'}`;
    const truncatedCriteria = criteriaText.length > 140 ? criteriaText.slice(0, 137) + '...' : criteriaText;
    doc.text(truncatedCriteria, 58, 41);

    // Cards de Resumo Financeiro
    const startY = 48;
    const boxW = 63;
    const boxH = 15;
    const gap = 5.5;

    // Card 1: Montante
    doc.setFillColor(240, 253, 244); // emerald-50
    doc.setDrawColor(187, 247, 208); // emerald-200
    doc.roundedRect(14, startY, boxW, boxH, 2, 2, 'FD');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text('MONTANTE TOTAL PREVISTO', 18, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(6, 95, 70); // emerald-800
    doc.text(formatCurrency(summary.totalPoolAmount), 18, startY + 11.5);

    // Card 2: Total Rateado
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14 + boxW + gap, startY, boxW, boxH, 2, 2, 'FD');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('TOTAL EFETIVAMENTE RATEADO', 18 + boxW + gap, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(summary.totalDistributedAmount), 18 + boxW + gap, startY + 11.5);

    // Card 3: Elegíveis
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14 + (boxW + gap) * 2, startY, boxW, boxH, 2, 2, 'FD');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('COLABORADORES ELEGÍVEIS', 18 + (boxW + gap) * 2, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${summary.totalEligible} elegíveis  (${summary.totalIneligible} fora)`, 18 + (boxW + gap) * 2, startY + 11.5);

    // Card 4: Resíduo
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(253, 230, 138); // amber-200
    doc.roundedRect(14 + (boxW + gap) * 3, startY, boxW, boxH, 2, 2, 'FD');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text('RESÍDUO NÃO RATEADO', 18 + (boxW + gap) * 3, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text(formatCurrency(summary.residualAmount), 18 + (boxW + gap) * 3, startY + 11.5);

    // Tabela 1: Resumo das Camadas (E, T, O)
    const layerRows = [
      [
        'Estratégico (E)',
        `${summary.layers.E.allocatedPercentage}%`,
        formatCurrency(summary.layers.E.totalLayerAmount),
        `${summary.layers.E.eligibleCount} colaborador(es)`,
        formatCurrency(summary.layers.E.amountPerEligible)
      ],
      [
        'Tático (T)',
        `${summary.layers.T.allocatedPercentage}%`,
        formatCurrency(summary.layers.T.totalLayerAmount),
        `${summary.layers.T.eligibleCount} colaborador(es)`,
        formatCurrency(summary.layers.T.amountPerEligible)
      ],
      [
        'Operacional / CLTs (O)',
        `${summary.layers.O.allocatedPercentage}%`,
        formatCurrency(summary.layers.O.totalLayerAmount),
        `${summary.layers.O.eligibleCount} colaborador(es)`,
        formatCurrency(summary.layers.O.amountPerEligible)
      ]
    ];

    autoTable(doc, {
      startY: startY + boxH + 4,
      head: [['Camada', 'Rateio (%)', 'Montante Alocado', 'Elegíveis', 'Valor Base / Pessoa']],
      body: layerRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42], // slate-900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59]
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 5 : 90;

    // Tabela 2: Relação dos Beneficiários Elegíveis (e Inelegíveis)
    const candidateRows = summary.candidates.map(c => [
      c.corporateName || c.name,
      c.company,
      c.department,
      c.jobRole,
      c.camadaLabel,
      c.linkType,
      c.monthlyAverageScore !== undefined ? `${c.monthlyAverageScore}%` : '100%',
      c.performanceFactorLabel || '100%',
      c.isEligible ? 'Elegível' : 'Inelegível',
      c.isEligible ? formatCurrency(c.allocatedAmount) : 'R$ 0,00'
    ]);

    autoTable(doc, {
      startY: finalY,
      head: [[
        'Colaborador / Razão Social',
        'Empresa',
        'Departamento',
        'Cargo / Escopo',
        'Camada',
        'Regime',
        'Metas',
        'Fator BPR',
        'Status',
        'Valor Final (R$)'
      ]],
      body: candidateRows,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59], // slate-800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 20 },
        2: { cellWidth: 32 },
        3: { cellWidth: 38 },
        4: { cellWidth: 24 },
        5: { cellWidth: 16 },
        6: { cellWidth: 16, halign: 'center' },
        7: { cellWidth: 20, halign: 'center' },
        8: { cellWidth: 18, halign: 'center' },
        9: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      foot: [[
        'TOTAL GERAL RATEADO',
        '', '', '', '', '', '', '',
        `${summary.totalEligible} elegíveis`,
        formatCurrency(summary.totalDistributedAmount)
      ]],
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'right'
      },
      margin: { left: 14, right: 14, bottom: 15 },
      didDrawPage: (data) => {
        // Rodapé de rastreabilidade
        const str = `Página ${data.pageNumber} • Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} • Sistema Executivo Mar Brasil`;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(str, 14, doc.internal.pageSize.getHeight() - 6);
      }
    });

    const safeFilename = `Apuracao_BPR_${config.cycle}_${config.year}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(safeFilename);
  }

  /**
   * Abre janela de visualização em alta fidelidade com acionamento nativo de impressão / salvar PDF
   */
  static openPrintableReport(
    summary: BprCalculationSummary,
    config: BprRuleConfig,
    meta?: BprPdfMeta
  ): void {
    if (typeof window === 'undefined') return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita popups neste site para visualizar a impressão.');
      return;
    }

    const cycleLabel = config.cycle === 'ciclo_1' 
      ? '1º Semestre (C1)' 
      : config.cycle === 'ciclo_2' 
        ? '2º Semestre (C2)' 
        : 'Customizado';

    const scenarioTitle = meta?.scenarioName || `Apuração BPR ${cycleLabel} ${config.year}`;
    const studyDateFormatted = meta?.studyDate ? formatDatePtBr(meta.studyDate) : formatDatePtBr(new Date().toISOString().slice(0, 10));

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${scenarioTitle}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 12mm 10mm 12mm 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 10px;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.4;
          }
          .header-box {
            border-bottom: 2px solid #d97706;
            padding-bottom: 10px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title {
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
            margin: 0 0 2px 0;
            text-transform: uppercase;
            letter-spacing: -0.3px;
          }
          .subtitle {
            font-size: 10px;
            color: #64748b;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 12px;
            margin-bottom: 12px;
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 10px;
          }
          .meta-item strong {
            color: #0f172a;
            font-size: 10px;
            text-transform: uppercase;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 12px;
          }
          .kpi-card {
            border-radius: 8px;
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
          }
          .kpi-label {
            font-size: 9px;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
          }
          .kpi-value {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            margin-top: 2px;
          }
          .table-title {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #1e293b;
            margin: 10px 0 4px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            font-size: 10px;
          }
          th {
            background: #0f172a;
            color: #ffffff;
            font-weight: 800;
            text-align: left;
            padding: 6px 8px;
            font-size: 9px;
            text-transform: uppercase;
            border: 1px solid #0f172a;
          }
          td {
            padding: 5px 8px;
            border: 1px solid #e2e8f0;
          }
          tr:nth-child(even) td {
            background: #f8fafc;
          }
          .badge-eligible {
            background: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
            padding: 1px 6px;
            border-radius: 12px;
            font-weight: 800;
            font-size: 9px;
            display: inline-block;
          }
          .badge-ineligible {
            background: #fff1f2;
            color: #be123c;
            border: 1px solid #fecdd3;
            padding: 1px 6px;
            border-radius: 12px;
            font-weight: 800;
            font-size: 9px;
            display: inline-block;
          }
          .amount-cell {
            text-align: right;
            font-weight: 800;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          }
          .signatures {
            margin-top: 25px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            text-align: center;
            page-break-inside: avoid;
          }
          .sig-line {
            border-top: 1px solid #94a3b8;
            padding-top: 5px;
            font-weight: 800;
            font-size: 10px;
            color: #334155;
          }
          .sig-role {
            font-size: 9px;
            color: #64748b;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 12px; padding: 10px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; color: #92400e;">Visualização de Impressão Executiva de BPR</span>
          <div>
            <button onclick="window.print()" style="padding: 6px 14px; background: #059669; color: white; border: none; border-radius: 6px; font-weight: 800; cursor: pointer;">Imprimir / Salvar PDF</button>
            <button onclick="window.close()" style="padding: 6px 14px; background: #e2e8f0; color: #334155; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; margin-left: 6px;">Fechar</button>
          </div>
        </div>

        <div class="header-box">
          <div>
            <h1 class="title">${scenarioTitle}</h1>
            <div class="subtitle">Bônus por Participação nos Resultados • Grupo Mar Brasil</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 900; font-size: 12px; color: #d97706;">${cycleLabel} / ${config.year}</div>
            <div style="font-size: 9px; color: #64748b;">Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
          </div>
        </div>

        <div class="meta-box">
          <div>
            <div class="meta-item"><strong>Premissas & Critérios:</strong></div>
            <div style="font-size: 10px; color: #475569; margin-top: 2px;">
              ${meta?.criteria || `Modo: ${config.splitMode === 'amount' ? 'Valor R$ Fixo' : 'Percentual'} | Splits: E (${config.tierSplits.E}%), T (${config.tierSplits.T}%), O (${config.tierSplits.O}%) | Glosas: ${config.allowGlosados ? 'Permitidas' : 'Excluídas'} | Inativos: ${config.allowInativos ? 'Permitidos' : 'Excluídos'}`}
            </div>
          </div>
          <div>
            <div><strong>Data do Estudo:</strong> ${studyDateFormatted}</div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
              Vigência: ${formatDatePtBr(config.periodStartDate)} a ${formatDatePtBr(config.periodEndDate)}<br />
              Data Pgto: ${formatDatePtBr(config.paymentDate)}
            </div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card" style="border-left: 3px solid #059669;">
            <div class="kpi-label">Montante Total Previsto</div>
            <div class="kpi-value" style="color: #047857;">${formatCurrency(summary.totalPoolAmount)}</div>
          </div>
          <div class="kpi-card" style="border-left: 3px solid #0284c7;">
            <div class="kpi-label">Total Efetivamente Rateado</div>
            <div class="kpi-value">${formatCurrency(summary.totalDistributedAmount)}</div>
          </div>
          <div class="kpi-card" style="border-left: 3px solid #6366f1;">
            <div class="kpi-label">Elegíveis no Ciclo</div>
            <div class="kpi-value">${summary.totalEligible} <span style="font-size: 10px; color: #64748b; font-weight: normal;">de ${summary.totalCandidates}</span></div>
          </div>
          <div class="kpi-card" style="border-left: 3px solid #d97706;">
            <div class="kpi-label">Resíduo Não Rateado</div>
            <div class="kpi-value" style="color: #b45309;">${formatCurrency(summary.residualAmount)}</div>
          </div>
        </div>

        <div class="table-title">Distribuição por Camada (Rateio Per Capita)</div>
        <table>
          <thead>
            <tr>
              <th>Camada</th>
              <th style="text-align: center;">% Rateio</th>
              <th style="text-align: right;">Montante da Camada</th>
              <th style="text-align: center;">Elegíveis</th>
              <th style="text-align: right;">Valor Base por Pessoa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Estratégico (E)</strong></td>
              <td style="text-align: center;">${summary.layers.E.allocatedPercentage}%</td>
              <td class="amount-cell">${formatCurrency(summary.layers.E.totalLayerAmount)}</td>
              <td style="text-align: center;">${summary.layers.E.eligibleCount} colaborador(es)</td>
              <td class="amount-cell" style="color: #1d4ed8;">${formatCurrency(summary.layers.E.amountPerEligible)}</td>
            </tr>
            <tr>
              <td><strong>Tático (T)</strong></td>
              <td style="text-align: center;">${summary.layers.T.allocatedPercentage}%</td>
              <td class="amount-cell">${formatCurrency(summary.layers.T.totalLayerAmount)}</td>
              <td style="text-align: center;">${summary.layers.T.eligibleCount} colaborador(es)</td>
              <td class="amount-cell" style="color: #4338ca;">${formatCurrency(summary.layers.T.amountPerEligible)}</td>
            </tr>
            <tr>
              <td><strong>Operacional / CLTs (O)</strong></td>
              <td style="text-align: center;">${summary.layers.O.allocatedPercentage}%</td>
              <td class="amount-cell">${formatCurrency(summary.layers.O.totalLayerAmount)}</td>
              <td style="text-align: center;">${summary.layers.O.eligibleCount} colaborador(es)</td>
              <td class="amount-cell" style="color: #047857;">${formatCurrency(summary.layers.O.amountPerEligible)}</td>
            </tr>
          </tbody>
        </table>

        <div class="table-title">Relação Analítica de Colaboradores e Valores Individuais</div>
        <table>
          <thead>
            <tr>
              <th>Colaborador / Razão Social</th>
              <th>Empresa</th>
              <th>Departamento</th>
              <th>Cargo / Escopo</th>
              <th>Camada</th>
              <th>Regime</th>
              <th style="text-align: center;">Metas</th>
              <th style="text-align: center;">Fator</th>
              <th style="text-align: center;">Status</th>
              <th style="text-align: right;">Valor Final BPR</th>
            </tr>
          </thead>
          <tbody>
            ${summary.candidates.map(c => `
              <tr>
                <td><strong>${c.corporateName || c.name}</strong></td>
                <td>${c.company}</td>
                <td>${c.department}</td>
                <td>${c.jobRole}</td>
                <td>${c.camadaLabel}</td>
                <td>${c.linkType}</td>
                <td style="text-align: center;">${c.monthlyAverageScore !== undefined ? `${c.monthlyAverageScore}%` : '100%'}</td>
                <td style="text-align: center;">${c.performanceFactorLabel || '100%'}</td>
                <td style="text-align: center;">
                  <span class="${c.isEligible ? 'badge-eligible' : 'badge-ineligible'}">
                    ${c.isEligible ? 'Elegível' : 'Inelegível'}
                  </span>
                </td>
                <td class="amount-cell" style="color: ${c.isEligible ? '#047857' : '#94a3b8'};">
                  ${c.isEligible ? formatCurrency(c.allocatedAmount) : 'R$ 0,00'}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: 900;">
              <td colspan="8">TOTAL GERAL DISTRIBUÍDO (${summary.totalEligible} COLABORADORES ELEGÍVEIS)</td>
              <td style="text-align: center;">—</td>
              <td class="amount-cell" style="color: #047857; font-size: 11px;">
                ${formatCurrency(summary.totalDistributedAmount)}
              </td>
            </tr>
          </tfoot>
        </table>

        <div class="signatures">
          <div>
            <div class="sig-line">Diretoria Executiva</div>
            <div class="sig-role">Aprovação & Governança</div>
          </div>
          <div>
            <div class="sig-line">Recursos Humanos / Gente & Gestão</div>
            <div class="sig-role">Apuração & Elegibilidade</div>
          </div>
          <div>
            <div class="sig-line">Controladoria & Finanças</div>
            <div class="sig-role">Liquidação & Fechamento</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  /**
   * Constrói lista comparativa entre cenários para tabela analítica
   */
  static buildComparisonRows(scenarios: BprSavedScenario[]): ScenarioComparisonItem[] {
    const map = new Map<string, ScenarioComparisonItem>();

    scenarios.forEach(sc => {
      const candidates = sc.candidatesSnapshot || [];
      candidates.forEach(c => {
        if (!map.has(c.employeeId)) {
          map.set(c.employeeId, {
            employeeId: c.employeeId,
            name: c.name,
            corporateName: c.corporateName,
            company: c.company,
            department: c.department,
            jobRole: c.jobRole,
            camadaLabel: c.camadaLabel,
            scenarioValues: {}
          });
        }
        const item = map.get(c.employeeId)!;
        item.scenarioValues[sc.id] = {
          amount: c.isEligible ? c.allocatedAmount : 0,
          isEligible: c.isEligible
        };
      });
    });

    const rows = Array.from(map.values());

    // Se houver pelo menos 2 cenários, calcula o delta entre o 2º e o 1º
    if (scenarios.length >= 2) {
      const id1 = scenarios[0].id;
      const id2 = scenarios[1].id;
      rows.forEach(r => {
        const val1 = r.scenarioValues[id1]?.amount || 0;
        const val2 = r.scenarioValues[id2]?.amount || 0;
        r.delta = val2 - val1;
      });
    }

    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Exporta PDF da comparação de múltiplos cenários
   */
  static exportComparisonPdf(
    scenarios: BprSavedScenario[],
    rows: ScenarioComparisonItem[]
  ): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Cabeçalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('COMPARATIVO EXECUTIVO DE CENÁRIOS — BPR', 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`ANÁLISE COMPARATIVA DE VALORES POR COLABORADOR • ${scenarios.length} CENÁRIOS SELECIONADOS`, 14, 21);

    // Tabela 1: Resumo dos Cenários
    const scSummaryRows = scenarios.map((s, idx) => [
      `#${idx + 1} - ${s.name}`,
      formatDatePtBr(s.studyDate),
      s.config.cycle === 'ciclo_1' ? '1º Semestre' : s.config.cycle === 'ciclo_2' ? '2º Semestre' : 'Custom',
      formatCurrency(s.summary.totalPoolAmount),
      formatCurrency(s.summary.totalDistributedAmount),
      `${s.summary.totalEligible} pessoas`,
      `E: ${formatCurrency(s.summary.amountPerE)} | T: ${formatCurrency(s.summary.amountPerT)} | O: ${formatCurrency(s.summary.amountPerO)}`
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Cenário / Estudo', 'Data Estudo', 'Ciclo', 'Montante Previsto', 'Total Rateado', 'Elegíveis', 'Valor Base Médio (E / T / O)']],
      body: scSummaryRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: { fontSize: 7.5 }
    });

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 6 : 60;

    // Cabeçalhos dinâmicos da tabela analítica
    const tableHeaders = [
      'Colaborador / Razão Social',
      'Empresa',
      'Cargo',
      'Camada',
      ...scenarios.map(s => s.name.length > 20 ? s.name.slice(0, 18) + '...' : s.name),
      ...(scenarios.length >= 2 ? ['Diferença (Delta)'] : [])
    ];

    const bodyRows = rows.map(r => {
      const scenarioCols = scenarios.map(s => {
        const item = r.scenarioValues[s.id];
        if (!item || !item.isEligible) return 'R$ 0,00';
        return formatCurrency(item.amount);
      });

      const deltaCol = scenarios.length >= 2
        ? (r.delta !== undefined ? (r.delta > 0 ? `+${formatCurrency(r.delta)}` : formatCurrency(r.delta)) : '-')
        : null;

      return [
        r.corporateName || r.name,
        r.company,
        r.jobRole,
        r.camadaLabel,
        ...scenarioCols,
        ...(deltaCol ? [deltaCol] : [])
      ];
    });

    autoTable(doc, {
      startY: finalY,
      head: [tableHeaders],
      body: bodyRows,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5
      },
      bodyStyles: { fontSize: 7 }
    });

    doc.save(`Comparativo_BPR_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  /**
   * Abre janela de impressão formatada para comparação de cenários
   */
  static openPrintableComparison(
    scenarios: BprSavedScenario[],
    rows: ScenarioComparisonItem[]
  ): void {
    if (typeof window === 'undefined') return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita popups neste site para visualizar o comparativo.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Comparativo de Cenários BPR</title>
        <style>
          @page { size: A4 landscape; margin: 12mm 10mm 12mm 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 10px; font-size: 11px; }
          .title { font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; }
          th { background: #0f172a; color: white; padding: 6px 8px; font-size: 9px; text-transform: uppercase; text-align: left; border: 1px solid #0f172a; }
          td { padding: 5px 8px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) td { background: #f8fafc; }
          .amount { text-align: right; font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 12px; padding: 10px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; color: #92400e;">Comparativo de Cenários BPR — Impressão</span>
          <div>
            <button onclick="window.print()" style="padding: 6px 14px; background: #059669; color: white; border: none; border-radius: 6px; font-weight: 800; cursor: pointer;">Imprimir / Salvar PDF</button>
            <button onclick="window.close()" style="padding: 6px 14px; background: #e2e8f0; color: #334155; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; margin-left: 6px;">Fechar</button>
          </div>
        </div>

        <h1 class="title">Comparativo de Cenários BPR</h1>
        <div class="subtitle">Análise Comparativa de Impacto Financeiro por Colaborador • ${scenarios.length} Cenários</div>

        <table style="margin-bottom: 20px;">
          <thead>
            <tr>
              <th>Cenário</th>
              <th>Data do Estudo</th>
              <th>Ciclo / Ano</th>
              <th style="text-align: right;">Montante Total</th>
              <th style="text-align: right;">Total Rateado</th>
              <th style="text-align: center;">Elegíveis</th>
            </tr>
          </thead>
          <tbody>
            ${scenarios.map(s => `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td>${formatDatePtBr(s.studyDate)}</td>
                <td>${s.config.cycle} / ${s.config.year}</td>
                <td class="amount">${formatCurrency(s.summary.totalPoolAmount)}</td>
                <td class="amount" style="color: #047857;">${formatCurrency(s.summary.totalDistributedAmount)}</td>
                <td style="text-align: center;">${s.summary.totalEligible}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Empresa</th>
              <th>Cargo</th>
              <th>Camada</th>
              ${scenarios.map(s => `<th style="text-align: right;">${s.name}</th>`).join('')}
              ${scenarios.length >= 2 ? '<th style="text-align: right;">Diferença (Delta)</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${r.corporateName || r.name}</strong></td>
                <td>${r.company}</td>
                <td>${r.jobRole}</td>
                <td>${r.camadaLabel}</td>
                ${scenarios.map(s => {
                  const item = r.scenarioValues[s.id];
                  const amt = item && item.isEligible ? item.amount : 0;
                  return `<td class="amount" style="color: ${amt > 0 ? '#0f172a' : '#94a3b8'};">${formatCurrency(amt)}</td>`;
                }).join('')}
                ${scenarios.length >= 2 ? `
                  <td class="amount" style="color: ${(r.delta || 0) > 0 ? '#047857' : (r.delta || 0) < 0 ? '#be123c' : '#64748b'};">
                    ${(r.delta || 0) > 0 ? '+' : ''}${formatCurrency(r.delta || 0)}
                  </td>
                ` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }
}
