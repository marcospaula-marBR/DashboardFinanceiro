import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BprCalculationSummary, 
  BprRuleConfig, 
  BprSavedScenario,
  BprCandidateResult,
  BprCamada,
  BprLayerRelativeWeight,
  BprDedicatedGroupSummary
} from '@/types/bpr';

const formatDedicatedGroupFunding = (src: string): string => {
  const map: Record<string, string> = {
    total_pool: 'Abate do Bolo Geral',
    extra_bonus: 'Acréscimo Extra (Não Abate)',
    E: 'Abate da Camada E',
    T: 'Abate da Camada T',
    O: 'Abate da Camada O',
  };
  return map[src] || src;
};

const formatDedicatedGroupModeAndRules = (gs: BprDedicatedGroupSummary): string => {
  const modeMap: Record<string, string> = {
    equal: 'Igualitário',
    percentage: '% por Pessoa',
    amount: 'Valor Fixo R$',
  };
  const modeLabel = modeMap[gs.distributionMode] || gs.distributionMode;
  const eligLabel = gs.eligibilityPolicy === 'follow_bpr_rules' ? 'Regras BPR' : 'Exceção Integral';
  const factorPart = gs.applyPerformanceFactor
    ? ` (Fator ${gs.reducedFactorPct ?? 75}%${gs.redistributePerformanceResidual ? ' · Redist.' : ''})`
    : ' (Sem corte)';
  return `${modeLabel} · ${eligLabel}${factorPart}`;
};

const formatDedicatedGroupMembersCount = (gs: BprDedicatedGroupSummary): string => {
  const elig = gs.eligibleMemberCount ?? gs.memberCount;
  const inel = gs.ineligibleMemberCount || 0;
  return inel > 0 ? `${elig} eleg. (+${inel} inel.)` : `${elig} eleg.`;
};

const formatCandidateFactorCell = (c: BprCandidateResult): string => {
  if (!c.dedicatedGroupId) return c.performanceFactorLabel || '100%';
  if (!c.isEligible) return 'Inelegível (BPR)';
  const pct = c.dedicatedGroupEffectiveFactorPct ?? 100;
  return (c.dedicatedGroupRedistributedBonus || 0) > 0
    ? `Grupo (${pct}% + redist.)`
    : `Grupo (${pct}%)`;
};

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatPctPtBr = (val?: number) =>
  `${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const formatMultiplePtBr = (val?: number) =>
  `${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;

type ScenarioRelativeWeightsBundle = {
  E: BprLayerRelativeWeight;
  T: BprLayerRelativeWeight;
  O: BprLayerRelativeWeight;
  overall: BprLayerRelativeWeight;
};

const formatScenarioWeightLine = (
  sc: BprSavedScenario,
  bundle?: ScenarioRelativeWeightsBundle
): string => {
  const ePct = bundle ? (bundle.E.eligibleWithHistoryCount > 0 ? bundle.E.bprMultipleOfMonthlyAvg : 0) : ((sc.summary.layers?.E?.eligibleWithHistoryCount || 0) > 0 ? (sc.summary.layers?.E?.bprMultipleOfMonthlyAvg || 0) : 0);
  const tPct = bundle ? (bundle.T.eligibleWithHistoryCount > 0 ? bundle.T.bprMultipleOfMonthlyAvg : 0) : ((sc.summary.layers?.T?.eligibleWithHistoryCount || 0) > 0 ? (sc.summary.layers?.T?.bprMultipleOfMonthlyAvg || 0) : 0);
  const oPct = bundle ? (bundle.O.eligibleWithHistoryCount > 0 ? bundle.O.bprMultipleOfMonthlyAvg : 0) : ((sc.summary.layers?.O?.eligibleWithHistoryCount || 0) > 0 ? (sc.summary.layers?.O?.bprMultipleOfMonthlyAvg || 0) : 0);
  const gPct = bundle ? (bundle.overall.eligibleWithHistoryCount > 0 ? bundle.overall.bprMultipleOfMonthlyAvg : 0) : ((sc.summary.overallRelativeWeight?.eligibleWithHistoryCount || 0) > 0 ? (sc.summary.overallRelativeWeight?.bprMultipleOfMonthlyAvg || 0) : 0);
  if (ePct === 0 && tPct === 0 && oPct === 0 && gPct === 0) return '—';
  return `E: ${ePct > 0 ? formatMultiplePtBr(ePct) : '—'} | T: ${tPct > 0 ? formatMultiplePtBr(tPct) : '—'} | O: ${oPct > 0 ? formatMultiplePtBr(oPct) : '—'} | Geral: ${gPct > 0 ? formatMultiplePtBr(gPct) : '—'}`;
};

const escapeHtml = (str?: string) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDatePtBr = (dateStr?: string) => {
  if (!dateStr) return '-';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
};

const normalizeSearchText = (str?: string) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export interface BprPdfMeta {
  scenarioName?: string;
  studyDate?: string;
  criteria?: string;
  // Filtros de seleção para o relatório
  eligibilityFilter?: 'all' | 'eligible_only' | 'ineligible_only';
  selectedCamadas?: BprCamada[];
  selectedCompanies?: string[];
  selectedDedicatedGroupIds?: string[]; // vazio = todos; '__ALL_DEDICATED__' | '__STANDARD_LAYERS__' | IDs de grupos
  selectedDedicatedGroupLabels?: string[];
  nameQuery?: string;
  includeSummaryCards?: boolean;
  includeLayerSummary?: boolean;
  includeSignatures?: boolean;
}

export interface ScenarioComparisonItem {
  employeeId: string;
  name: string;
  corporateName?: string;
  company: string;
  department: string;
  jobRole: string;
  camadaLabel: string;
  scenarioValues: Record<string, { amount: number; isEligible: boolean; dedicatedGroupName?: string }>;
  delta?: number;
}

export interface DedicatedGroupComparisonRow {
  groupKey: string;
  groupName: string;
  scenarioValues: Record<string, {
    allocatedTotal: number;
    poolAmount: number;
    memberCount: number;
    distributionMode?: string;
    fundingSource?: string;
  }>;
  deltaAmount?: number;
  deltaMembers?: number;
}

export class BprPdfService {

  /**
   * Filtra a relação de colaboradores conforme os parâmetros de recorte do relatório
   */
  static filterCandidates(candidates: BprCandidateResult[], meta?: BprPdfMeta): BprCandidateResult[] {
    // PADRÃO EXECUTIVO: Somente Elegíveis
    const eligibilityFilter = meta?.eligibilityFilter || 'eligible_only';
    const selectedCamadas = meta?.selectedCamadas || ['E', 'T', 'O'];
    const selectedCompanies = (meta?.selectedCompanies || []).map(c => c.trim().toLowerCase());
    const selectedDedicatedGroupIds = meta?.selectedDedicatedGroupIds || [];
    const nameTokens = String(meta?.nameQuery || '')
      .split(',')
      .map(t => normalizeSearchText(t))
      .filter(Boolean);

    return candidates.filter(c => {
      // 1. Filtro de Elegibilidade
      if (eligibilityFilter === 'eligible_only' && !c.isEligible) return false;
      if (eligibilityFilter === 'ineligible_only' && c.isEligible) return false;

      // 2. Filtro de Camadas / Perfis
      if (selectedCamadas.length > 0 && !selectedCamadas.includes(c.camada)) return false;

      // 3. Filtro de Grupos de Montante Específico (opcional)
      if (selectedDedicatedGroupIds.length > 0) {
        const allowAllDedicated = selectedDedicatedGroupIds.includes('__ALL_DEDICATED__');
        const allowStandardLayers = selectedDedicatedGroupIds.includes('__STANDARD_LAYERS__');
        const matchesSpecificGroup = Boolean(
          c.dedicatedGroupId && selectedDedicatedGroupIds.includes(c.dedicatedGroupId)
        );
        const matchesGroupFilter =
          (allowAllDedicated && Boolean(c.dedicatedGroupId)) ||
          (allowStandardLayers && !c.dedicatedGroupId) ||
          matchesSpecificGroup;
        if (!matchesGroupFilter) return false;
      }

      // 4. Filtro de Empresas
      if (selectedCompanies.length > 0) {
        const comp = (c.company || '').trim().toLowerCase();
        if (!selectedCompanies.includes(comp)) return false;
      }

      // 5. Filtro por Nome (sem acentos; suporta múltiplos nomes separados por vírgula)
      if (nameTokens.length > 0) {
        const haystack = normalizeSearchText(`${c.name} ${c.corporateName || ''} ${c.responsibleName || ''} ${c.dedicatedGroupName || ''}`);
        const matchesAny = nameTokens.some(token => haystack.includes(token));
        if (!matchesAny) return false;
      }

      return true;
    });
  }

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

    // Filtragem dos Colaboradores para o Relatório
    const filteredCandidates = this.filterCandidates(summary.candidates || [], meta);
    const totalFilteredRateio = filteredCandidates.reduce((s, c) => s + (c.isEligible ? (c.rateioAmount ?? c.allocatedAmount) : 0), 0);
    const totalFilteredAdditional = filteredCandidates.reduce((s, c) => s + (c.isEligible ? (c.additionalAmount || 0) : 0), 0);
    const totalFilteredDistributed = filteredCandidates.reduce((s, c) => s + (c.isEligible ? c.allocatedAmount : 0), 0);
    const totalFilteredPeriodReceived = filteredCandidates.reduce((s, c) => s + (c.isEligible ? (c.periodReceivedTotal || 0) : 0), 0);
    const totalFilteredEligible = filteredCandidates.filter(c => c.isEligible).length;
    const totalFilteredIneligible = filteredCandidates.filter(c => !c.isEligible).length;

    // Cabeçalho Principal Executivo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('RELATÓRIO EXECUTIVO DE APURAÇÃO BPR', 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text('BÔNUS POR PARTICIPAÇÃO NOS RESULTADOS • APURAÇÃO DETERMINÍSTICA PER CAPITA', 14, 21);

    // Box de Metadados do Estudo & Filtros Aplicados
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, 24, 269, 23, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`CENÁRIO / ESTUDO:`, 18, 29);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(scenarioTitle, 55, 29);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`DATA DO ESTUDO:`, 18, 34);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${studyDateFormatted}  (Vigência: ${formatDatePtBr(config.periodStartDate)} a ${formatDatePtBr(config.periodEndDate)} · Pgto: ${formatDatePtBr(config.paymentDate)})`, 55, 34);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`CRITÉRIOS / PREMISSAS:`, 18, 39);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const criteriaText = meta?.criteria 
      ? meta.criteria 
      : `Modo: ${config.splitMode === 'amount' ? 'Valor Fixo R$' : 'Percentual'} | Splits: E (${config.tierSplits.E}%), T (${config.tierSplits.T}%), O (${config.tierSplits.O}%)`;
    const truncatedCriteria = criteriaText.length > 130 ? criteriaText.slice(0, 127) + '...' : criteriaText;
    doc.text(truncatedCriteria, 58, 39);

    // Descrição do Recorte Filtrado no PDF
    const eligLabel = meta?.eligibilityFilter === 'all' 
      ? 'Todos (Elegíveis + Inelegíveis)' 
      : meta?.eligibilityFilter === 'ineligible_only' 
        ? 'Apenas Inelegíveis / Excluídos' 
        : 'Apenas Colaboradores Elegíveis';
    const camadasLabel = (meta?.selectedCamadas || ['E', 'T', 'O']).map(c => c === 'E' ? 'Estratégico' : c === 'T' ? 'Tático' : 'Operacional').join(', ');
    const compsLabel = (meta?.selectedCompanies && meta.selectedCompanies.length > 0) ? meta.selectedCompanies.join(', ') : 'Todas';
    const groupsFilterLabel = (meta?.selectedDedicatedGroupLabels && meta.selectedDedicatedGroupLabels.length > 0)
      ? `  •  Grupos: ${meta.selectedDedicatedGroupLabels.join(', ')}`
      : (meta?.selectedDedicatedGroupIds && meta.selectedDedicatedGroupIds.length > 0)
        ? `  •  Grupos: ${meta.selectedDedicatedGroupIds.map(id => id === '__ALL_DEDICATED__' ? 'Somente Grupos Específicos' : id === '__STANDARD_LAYERS__' ? 'Somente Camadas E/T/O' : id).join(', ')}`
        : '';
    const nameLabel = meta?.nameQuery?.trim() ? `  •  Nome: "${meta.nameQuery.trim()}"` : '';

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text(`RECORTE DESTE RELATÓRIO:`, 18, 44);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const recorteLine = `${eligLabel}  •  Camadas: ${camadasLabel}  •  Empresas: ${compsLabel}${groupsFilterLabel}${nameLabel}  •  Total no Recorte: ${filteredCandidates.length}`;
    doc.text(recorteLine.length > 135 ? `${recorteLine.slice(0, 132)}...` : recorteLine, 65, 44);

    let nextY = 50;

    // Cards de Resumo Financeiro (Opcional)
    if (meta?.includeSummaryCards !== false) {
      const boxW = 63;
      const boxH = 14;
      const gap = 5.5;

      // Card 1: Montante Total
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(14, nextY, boxW, boxH, 2, 2, 'FD');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text('MONTANTE TOTAL PREVISTO', 18, nextY + 4.5);
      doc.setFontSize(10.5);
      doc.setTextColor(6, 95, 70);
      doc.text(formatCurrency(summary.totalPoolAmount), 18, nextY + 10.5);

      // Card 2: Total Rateado no Recorte
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14 + boxW + gap, nextY, boxW, boxH, 2, 2, 'FD');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('TOTAL RATEADO NO RECORTE', 18 + boxW + gap, nextY + 4.5);
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(formatCurrency(totalFilteredDistributed), 18 + boxW + gap, nextY + 10.5);

      // Card 3: Elegíveis no Recorte
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14 + (boxW + gap) * 2, nextY, boxW, boxH, 2, 2, 'FD');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('ELEGÍVEIS NO RECORTE', 18 + (boxW + gap) * 2, nextY + 4.5);
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${totalFilteredEligible} elegíveis  (${totalFilteredIneligible} fora)`, 18 + (boxW + gap) * 2, nextY + 10.5);

      // Card 4: Resíduo Global
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(253, 230, 138);
      doc.roundedRect(14 + (boxW + gap) * 3, nextY, boxW, boxH, 2, 2, 'FD');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text('RESÍDUO GLOBAL NÃO RATEADO', 18 + (boxW + gap) * 3, nextY + 4.5);
      doc.setFontSize(10.5);
      doc.setTextColor(146, 64, 14);
      doc.text(formatCurrency(summary.residualAmount), 18 + (boxW + gap) * 3, nextY + 10.5);

      nextY += boxH + 4;
    }

    // Tabela 1: Resumo das Camadas (Opcional)
    if (meta?.includeLayerSummary !== false) {
      const fmtLayerWeight = (layer: typeof summary.layers.E) =>
        (layer.eligibleWithHistoryCount || 0) > 0
          ? `${formatPctPtBr(layer.bprVsMonthlyAvgPct)} (${formatMultiplePtBr(layer.bprMultipleOfMonthlyAvg)})`
          : '—';

      const layerRows = [
        [
          'Estratégico (E)',
          `${summary.layers.E.allocatedPercentage}%`,
          formatCurrency(summary.layers.E.grossLayerAmount ?? summary.layers.E.totalLayerAmount),
          formatCurrency((summary.layers.E.dedicatedGroupsDeductedFromLayer || 0) + (summary.layers.E.additionalDeductedFromLayer || 0)),
          formatCurrency(summary.layers.E.totalLayerAmount),
          `${summary.layers.E.eligibleCount} colaborador(es)`,
          formatCurrency(summary.layers.E.amountPerEligible),
          fmtLayerWeight(summary.layers.E)
        ],
        [
          'Tático (T)',
          `${summary.layers.T.allocatedPercentage}%`,
          formatCurrency(summary.layers.T.grossLayerAmount ?? summary.layers.T.totalLayerAmount),
          formatCurrency((summary.layers.T.dedicatedGroupsDeductedFromLayer || 0) + (summary.layers.T.additionalDeductedFromLayer || 0)),
          formatCurrency(summary.layers.T.totalLayerAmount),
          `${summary.layers.T.eligibleCount} colaborador(es)`,
          formatCurrency(summary.layers.T.amountPerEligible),
          fmtLayerWeight(summary.layers.T)
        ],
        [
          'Operacional / CLTs (O)',
          `${summary.layers.O.allocatedPercentage}%`,
          formatCurrency(summary.layers.O.grossLayerAmount ?? summary.layers.O.totalLayerAmount),
          formatCurrency((summary.layers.O.dedicatedGroupsDeductedFromLayer || 0) + (summary.layers.O.additionalDeductedFromLayer || 0)),
          formatCurrency(summary.layers.O.totalLayerAmount),
          `${summary.layers.O.eligibleCount} colaborador(es)`,
          formatCurrency(summary.layers.O.amountPerEligible),
          fmtLayerWeight(summary.layers.O)
        ]
      ];

      autoTable(doc, {
        startY: nextY,
        head: [['Camada / Perfil', 'Rateio (%)', 'Montante Bruto', '(-) Abatimentos', 'Montante Líquido', 'Elegíveis Globais', 'Valor Base / Pessoa', 'Peso BPR / Média Mensal']],
        body: layerRows,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59]
        },
        margin: { left: 14, right: 14 }
      });

      const docWithLast = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
      nextY = docWithLast.lastAutoTable?.finalY ? docWithLast.lastAutoTable.finalY + 4 : nextY + 25;

      // Tabela 1B: Grupos de Montante Específico (Rateio Exclusivo — filtrada pelo recorte se aplicável)
      const visibleDedicatedSummaries = (summary.dedicatedGroupSummaries || []).filter(gs => {
        const ids = meta?.selectedDedicatedGroupIds || [];
        if (ids.length === 0 || ids.includes('__ALL_DEDICATED__')) return true;
        return ids.includes(gs.groupId);
      });
      if (visibleDedicatedSummaries.length > 0) {
        autoTable(doc, {
          startY: nextY,
          head: [['Grupo de Montante Específico (Exclusivo)', 'Critério / Observação', 'Origem do Recurso', 'Rateio / Regra', 'Membros', 'Montante Grupo', 'Total Alocado']],
          body: visibleDedicatedSummaries.map(gs => [
            gs.name,
            gs.criteriaDescription || '—',
            formatDedicatedGroupFunding(gs.fundingSource),
            formatDedicatedGroupModeAndRules(gs),
            formatDedicatedGroupMembersCount(gs),
            formatCurrency(gs.poolAmount),
            formatCurrency(gs.allocatedTotal)
          ]),
          theme: 'grid',
          headStyles: {
            fillColor: [15, 118, 110],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.2,
            halign: 'left'
          },
          bodyStyles: {
            fontSize: 7.2,
            textColor: [30, 41, 59]
          },
          margin: { left: 14, right: 14 }
        });

        nextY = docWithLast.lastAutoTable?.finalY ? docWithLast.lastAutoTable.finalY + 4 : nextY + 22;
      }
    }

    // Tabela 2: Relação dos Colaboradores Selecionados
    const candidateRows = filteredCandidates.map(c => {
      const hasHist = (c.periodMonthsCount || 0) > 0 && (c.periodReceivedTotal || 0) > 0;
      const histCell = hasHist
        ? `Mont.: ${formatCurrency(c.periodReceivedTotal || 0)}\nMédia (${c.periodMonthsCount}m): ${formatCurrency(c.periodReceivedAverage || 0)}\nBPR: ${formatPctPtBr(c.bprVsAveragePct)} méd. · ${formatPctPtBr(c.bprVsTotalPct)} mont.`
        : 'Sem histórico';
      const camadaCell = c.dedicatedGroupId
        ? `Grupo: ${c.dedicatedGroupName} (${c.isEligible ? formatPctPtBr(c.dedicatedGroupSharePct) : 'Ineleg.'})`
        : c.camadaLabel;
      const fatorCell = formatCandidateFactorCell(c);

      return [
        c.corporateName || c.name,
        c.company,
        c.department,
        c.jobRole,
        camadaCell,
        c.linkType,
        c.monthlyAverageScore !== undefined ? `${c.monthlyAverageScore}%` : '100%',
        fatorCell,
        c.isEligible ? (c.dedicatedGroupId ? 'Grupo Excl.' : 'Elegível') : 'Inelegível',
        c.isEligible ? formatCurrency(c.rateioAmount ?? c.allocatedAmount) : 'R$ 0,00',
        c.isEligible ? formatCurrency(c.additionalAmount || 0) : 'R$ 0,00',
        c.isEligible ? formatCurrency(c.allocatedAmount) : 'R$ 0,00',
        histCell
      ];
    });

    autoTable(doc, {
      startY: nextY,
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
        'Rateio Nível (R$)',
        '+ Adicional (R$)',
        'Valor Final (R$)',
        'Histórico Período (Mont. / Média / % BPR)'
      ]],
      body: candidateRows,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.5,
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 6.5,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 14 },
        2: { cellWidth: 21 },
        3: { cellWidth: 24 },
        4: { cellWidth: 18 },
        5: { cellWidth: 12 },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 15, halign: 'center' },
        8: { cellWidth: 15, halign: 'center' },
        9: { cellWidth: 20, halign: 'right' },
        10: { cellWidth: 19, halign: 'right' },
        11: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        12: { cellWidth: 41, halign: 'right' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      foot: [[
        'TOTAL GERAL RATEADO (RECORTE)',
        '', '', '', '', '', '', '',
        `${totalFilteredEligible} elegíveis`,
        formatCurrency(totalFilteredRateio),
        formatCurrency(totalFilteredAdditional),
        formatCurrency(totalFilteredDistributed),
        totalFilteredPeriodReceived > 0 ? `Mont.: ${formatCurrency(totalFilteredPeriodReceived)}` : '—'
      ]],
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 7,
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

    // Notas de Auditoria — Justificativas de Valores Adicionais Individuais
    const auditAdditionalNotes = filteredCandidates.filter(
      c => c.isEligible && (c.additionalAmount || 0) > 0 && Boolean((c.additionalReason || '').trim())
    );
    if (auditAdditionalNotes.length > 0) {
      const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
      const notesStartY = (docWithTable.lastAutoTable?.finalY ?? nextY) + 6;
      autoTable(doc, {
        startY: notesStartY,
        head: [['Notas de Auditoria — Justificativas de Valores Adicionais', 'Empresa', 'Camada', 'Adicional (R$)', 'Motivo / Observação']],
        body: auditAdditionalNotes.map(c => [
          c.corporateName || c.name,
          c.company,
          c.camadaLabel,
          formatCurrency(c.additionalAmount || 0),
          c.additionalReason || ''
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: [180, 83, 9],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: 'bold' },
          1: { cellWidth: 20 },
          2: { cellWidth: 28 },
          3: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
          4: { cellWidth: 140 }
        },
        margin: { left: 14, right: 14, bottom: 15 }
      });
    }

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

    // Filtragem dos Colaboradores
    const filteredCandidates = this.filterCandidates(summary.candidates || [], meta);
    const totalFilteredRateio = filteredCandidates.reduce((s, c) => s + (c.isEligible ? (c.rateioAmount ?? c.allocatedAmount) : 0), 0);
    const totalFilteredAdditional = filteredCandidates.reduce((s, c) => s + (c.isEligible ? (c.additionalAmount || 0) : 0), 0);
    const totalFilteredDistributed = filteredCandidates.reduce((s, c) => s + (c.isEligible ? c.allocatedAmount : 0), 0);
    const totalFilteredPeriodReceived = filteredCandidates.reduce((s, c) => s + (c.isEligible ? (c.periodReceivedTotal || 0) : 0), 0);
    const totalFilteredEligible = filteredCandidates.filter(c => c.isEligible).length;
    const auditAdditionalNotes = filteredCandidates.filter(
      c => c.isEligible && (c.additionalAmount || 0) > 0 && Boolean((c.additionalReason || '').trim())
    );

    const eligLabel = meta?.eligibilityFilter === 'all' 
      ? 'Todos (Elegíveis + Inelegíveis)' 
      : meta?.eligibilityFilter === 'ineligible_only' 
        ? 'Apenas Inelegíveis / Excluídos' 
        : 'Apenas Colaboradores Elegíveis';
    const camadasLabel = (meta?.selectedCamadas || ['E', 'T', 'O']).map(c => c === 'E' ? 'Estratégico' : c === 'T' ? 'Tático' : 'Operacional').join(', ');
    const compsLabel = (meta?.selectedCompanies && meta.selectedCompanies.length > 0) ? meta.selectedCompanies.join(', ') : 'Todas as Empresas';
    const groupsFilterHtml = (meta?.selectedDedicatedGroupLabels && meta.selectedDedicatedGroupLabels.length > 0)
      ? ` • Grupos: ${escapeHtml(meta.selectedDedicatedGroupLabels.join(', '))}`
      : (meta?.selectedDedicatedGroupIds && meta.selectedDedicatedGroupIds.length > 0)
        ? ` • Grupos: ${escapeHtml(meta.selectedDedicatedGroupIds.map(id => id === '__ALL_DEDICATED__' ? 'Somente Grupos Específicos' : id === '__STANDARD_LAYERS__' ? 'Somente Camadas E/T/O' : id).join(', '))}`
        : '';
    const visibleHtmlDedicatedSummaries = (summary.dedicatedGroupSummaries || []).filter(gs => {
      const ids = meta?.selectedDedicatedGroupIds || [];
      if (ids.length === 0 || ids.includes('__ALL_DEDICATED__')) return true;
      return ids.includes(gs.groupId);
    });

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
          .scope-banner {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            border-radius: 8px;
            padding: 6px 12px;
            margin-bottom: 12px;
            font-size: 10px;
            color: #065f46;
            display: flex;
            justify-content: space-between;
            align-items: center;
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
            <div class="meta-item"><strong>Premissas &amp; Critérios:</strong></div>
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

        <!-- Escopo do Recorte Selecionado -->
        <div class="scope-banner">
          <div>
            <strong>RECORTE DO RELATÓRIO:</strong> ${eligLabel} • Camadas: ${camadasLabel} • Empresas: ${compsLabel}${groupsFilterHtml}${meta?.nameQuery?.trim() ? ` • Nome: "${escapeHtml(meta.nameQuery.trim())}"` : ''}
          </div>
          <div style="font-weight: 800;">
            ${filteredCandidates.length} colaborador(es) listado(s)
          </div>
        </div>

        ${meta?.includeSummaryCards !== false ? `
          <div class="kpi-grid">
            <div class="kpi-card" style="border-left: 3px solid #059669;">
              <div class="kpi-label">Montante Total Previsto</div>
              <div class="kpi-value" style="color: #047857;">${formatCurrency(summary.totalPoolAmount)}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #0284c7;">
              <div class="kpi-label">Total Rateado no Recorte</div>
              <div class="kpi-value">${formatCurrency(totalFilteredDistributed)}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #6366f1;">
              <div class="kpi-label">Elegíveis no Recorte</div>
              <div class="kpi-value">${totalFilteredEligible} <span style="font-size: 10px; color: #64748b; font-weight: normal;">de ${filteredCandidates.length}</span></div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #d97706;">
              <div class="kpi-label">Resíduo Global</div>
              <div class="kpi-value" style="color: #b45309;">${formatCurrency(summary.residualAmount)}</div>
            </div>
          </div>
        ` : ''}

        ${meta?.includeLayerSummary !== false ? `
          <div class="table-title">Distribuição por Camada (Rateio Per Capita)</div>
          <table>
            <thead>
              <tr>
                <th>Camada / Perfil</th>
                <th style="text-align: center;">% Rateio</th>
                <th style="text-align: right;">Montante Bruto</th>
                <th style="text-align: right;">(-) Abatimentos</th>
                <th style="text-align: right;">Montante Líquido</th>
                <th style="text-align: center;">Elegíveis Globais</th>
                <th style="text-align: right;">Valor Base por Pessoa</th>
                <th style="text-align: right;">Peso BPR / Média Mensal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Estratégico (E)</strong></td>
                <td style="text-align: center;">${summary.layers.E.allocatedPercentage}%</td>
                <td class="amount-cell">${formatCurrency(summary.layers.E.grossLayerAmount ?? summary.layers.E.totalLayerAmount)}</td>
                <td class="amount-cell" style="color: #b45309;">${formatCurrency((summary.layers.E.dedicatedGroupsDeductedFromLayer || 0) + (summary.layers.E.additionalDeductedFromLayer || 0))}</td>
                <td class="amount-cell">${formatCurrency(summary.layers.E.totalLayerAmount)}</td>
                <td style="text-align: center;">${summary.layers.E.eligibleCount} colaborador(es)</td>
                <td class="amount-cell" style="color: #1d4ed8;">${formatCurrency(summary.layers.E.amountPerEligible)}</td>
                <td class="amount-cell" style="color: #0369a1;">${(summary.layers.E.eligibleWithHistoryCount || 0) > 0 ? `${formatPctPtBr(summary.layers.E.bprVsMonthlyAvgPct)} (${formatMultiplePtBr(summary.layers.E.bprMultipleOfMonthlyAvg)})` : '—'}</td>
              </tr>
              <tr>
                <td><strong>Tático (T)</strong></td>
                <td style="text-align: center;">${summary.layers.T.allocatedPercentage}%</td>
                <td class="amount-cell">${formatCurrency(summary.layers.T.grossLayerAmount ?? summary.layers.T.totalLayerAmount)}</td>
                <td class="amount-cell" style="color: #b45309;">${formatCurrency((summary.layers.T.dedicatedGroupsDeductedFromLayer || 0) + (summary.layers.T.additionalDeductedFromLayer || 0))}</td>
                <td class="amount-cell">${formatCurrency(summary.layers.T.totalLayerAmount)}</td>
                <td style="text-align: center;">${summary.layers.T.eligibleCount} colaborador(es)</td>
                <td class="amount-cell" style="color: #4338ca;">${formatCurrency(summary.layers.T.amountPerEligible)}</td>
                <td class="amount-cell" style="color: #0369a1;">${(summary.layers.T.eligibleWithHistoryCount || 0) > 0 ? `${formatPctPtBr(summary.layers.T.bprVsMonthlyAvgPct)} (${formatMultiplePtBr(summary.layers.T.bprMultipleOfMonthlyAvg)})` : '—'}</td>
              </tr>
              <tr>
                <td><strong>Operacional / CLTs (O)</strong></td>
                <td style="text-align: center;">${summary.layers.O.allocatedPercentage}%</td>
                <td class="amount-cell">${formatCurrency(summary.layers.O.grossLayerAmount ?? summary.layers.O.totalLayerAmount)}</td>
                <td class="amount-cell" style="color: #b45309;">${formatCurrency((summary.layers.O.dedicatedGroupsDeductedFromLayer || 0) + (summary.layers.O.additionalDeductedFromLayer || 0))}</td>
                <td class="amount-cell">${formatCurrency(summary.layers.O.totalLayerAmount)}</td>
                <td style="text-align: center;">${summary.layers.O.eligibleCount} colaborador(es)</td>
                <td class="amount-cell" style="color: #047857;">${formatCurrency(summary.layers.O.amountPerEligible)}</td>
                <td class="amount-cell" style="color: #0369a1;">${(summary.layers.O.eligibleWithHistoryCount || 0) > 0 ? `${formatPctPtBr(summary.layers.O.bprVsMonthlyAvgPct)} (${formatMultiplePtBr(summary.layers.O.bprMultipleOfMonthlyAvg)})` : '—'}</td>
              </tr>
            </tbody>
          </table>
          ${visibleHtmlDedicatedSummaries.length > 0 ? `
            <div class="table-title" style="color: #0f766e;">Grupos de Montante Específico (Rateio Exclusivo fora das Camadas E/T/O)</div>
            <table>
              <thead>
                <tr style="background: #0f766e; color: #ffffff;">
                  <th>Grupo</th>
                  <th>Critério / Observação</th>
                  <th>Origem do Recurso</th>
                  <th>Rateio / Regra</th>
                  <th style="text-align: center;">Membros</th>
                  <th style="text-align: right;">Montante Grupo</th>
                  <th style="text-align: right;">Total Alocado</th>
                </tr>
              </thead>
              <tbody>
                ${visibleHtmlDedicatedSummaries.map(gs => `
                    <tr>
                      <td><strong>${escapeHtml(gs.name)}</strong></td>
                      <td>${escapeHtml(gs.criteriaDescription || '—')}</td>
                      <td>${escapeHtml(formatDedicatedGroupFunding(gs.fundingSource))}</td>
                      <td>${escapeHtml(formatDedicatedGroupModeAndRules(gs))}</td>
                      <td style="text-align: center;">${escapeHtml(formatDedicatedGroupMembersCount(gs))}</td>
                      <td class="amount-cell">${formatCurrency(gs.poolAmount)}</td>
                      <td class="amount-cell" style="color: #0f766e;">${formatCurrency(gs.allocatedTotal)}</td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          ` : ''}
        ` : ''}

        <div class="table-title">Relação Analítica de Colaboradores e Valores Individuais</div>
        <table>
          <thead>
            <tr>
              <th>Colaborador / Razão Social</th>
              <th>Empresa</th>
              <th>Departamento</th>
              <th>Cargo / Escopo</th>
              <th>Camada / Grupo</th>
              <th>Regime</th>
              <th style="text-align: center;">Metas</th>
              <th style="text-align: center;">Fator</th>
              <th style="text-align: center;">Status</th>
              <th style="text-align: right;">Rateio Nível (R$)</th>
              <th style="text-align: right;">+ Adicional (R$)</th>
              <th style="text-align: right;">Valor Final BPR</th>
              <th style="text-align: right;">Histórico Período (3 linhas)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredCandidates.length === 0 ? `
              <tr>
                <td colspan="13" style="text-align: center; padding: 20px; color: #94a3b8;">
                  Nenhum colaborador encontrado para os filtros selecionados neste recorte.
                </td>
              </tr>
            ` : filteredCandidates.map(c => {
              const hasHist = (c.periodMonthsCount || 0) > 0 && (c.periodReceivedTotal || 0) > 0;
              return `
              <tr>
                <td><strong>${escapeHtml(c.corporateName || c.name)}</strong></td>
                <td>${escapeHtml(c.company)}</td>
                <td>${escapeHtml(c.department)}</td>
                <td>${escapeHtml(c.jobRole)}</td>
                <td>${c.dedicatedGroupId ? `<strong style="color: #0f766e;">Grupo: ${escapeHtml(c.dedicatedGroupName || '')}</strong><div style="font-size: 8px; color: #64748b;">${c.isEligible ? formatPctPtBr(c.dedicatedGroupSharePct) : 'Inelegível'} · Origem ${escapeHtml(c.camada)}</div>` : escapeHtml(c.camadaLabel)}</td>
                <td>${escapeHtml(c.linkType)}</td>
                <td style="text-align: center;">${c.monthlyAverageScore !== undefined ? `${c.monthlyAverageScore}%` : '100%'}</td>
                <td style="text-align: center;">${escapeHtml(formatCandidateFactorCell(c))}</td>
                <td style="text-align: center;">
                  <span class="${c.isEligible ? 'badge-eligible' : 'badge-ineligible'}">
                    ${c.isEligible ? (c.dedicatedGroupId ? 'Grupo Excl.' : 'Elegível') : 'Inelegível'}
                  </span>
                </td>
                <td class="amount-cell" style="color: ${c.isEligible ? '#334155' : '#94a3b8'};">
                  ${c.isEligible ? formatCurrency(c.rateioAmount ?? c.allocatedAmount) : 'R$ 0,00'}
                </td>
                <td class="amount-cell" style="color: ${c.isEligible && (c.additionalAmount || 0) > 0 ? '#b45309' : '#94a3b8'};">
                  ${c.isEligible ? formatCurrency(c.additionalAmount || 0) : 'R$ 0,00'}
                </td>
                <td class="amount-cell" style="color: ${c.isEligible ? '#047857' : '#94a3b8'};">
                  ${c.isEligible ? formatCurrency(c.allocatedAmount) : 'R$ 0,00'}
                </td>
                <td class="amount-cell" style="font-weight: normal; font-size: 8.5px; line-height: 1.3; white-space: nowrap;">
                  ${hasHist ? `
                    <div style="font-weight: 800; color: #0f172a;">Mont.: ${formatCurrency(c.periodReceivedTotal || 0)}</div>
                    <div style="color: #475569;">Média (${c.periodMonthsCount}m): ${formatCurrency(c.periodReceivedAverage || 0)}</div>
                    <div style="font-weight: 800; color: ${c.isEligible ? '#0369a1' : '#94a3b8'};">BPR: ${formatPctPtBr(c.bprVsAveragePct)} méd. · ${formatPctPtBr(c.bprVsTotalPct)} mont.</div>
                  ` : '<span style="color: #94a3b8; font-style: italic;">Sem histórico</span>'}
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: 900;">
              <td colspan="9">TOTAL NO RECORTE (${totalFilteredEligible} COLABORADORES ELEGÍVEIS)</td>
              <td class="amount-cell" style="color: #334155; font-size: 10px;">
                ${formatCurrency(totalFilteredRateio)}
              </td>
              <td class="amount-cell" style="color: #b45309; font-size: 10px;">
                ${formatCurrency(totalFilteredAdditional)}
              </td>
              <td class="amount-cell" style="color: #047857; font-size: 10.5px;">
                ${formatCurrency(totalFilteredDistributed)}
              </td>
              <td class="amount-cell" style="color: #0f172a; font-size: 9.5px;">
                ${totalFilteredPeriodReceived > 0 ? `Mont.: ${formatCurrency(totalFilteredPeriodReceived)}` : '—'}
              </td>
            </tr>
          </tfoot>
        </table>

        ${auditAdditionalNotes.length > 0 ? `
          <div class="table-title" style="color: #b45309;">Notas de Auditoria — Justificativas de Valores Adicionais Individuais</div>
          <table>
            <thead>
              <tr>
                <th style="background: #b45309; border-color: #b45309;">Beneficiário</th>
                <th style="background: #b45309; border-color: #b45309;">Empresa</th>
                <th style="background: #b45309; border-color: #b45309;">Camada</th>
                <th style="background: #b45309; border-color: #b45309; text-align: right;">Adicional (R$)</th>
                <th style="background: #b45309; border-color: #b45309;">Motivo / Observação Registrada</th>
              </tr>
            </thead>
            <tbody>
              ${auditAdditionalNotes.map(c => `
                <tr>
                  <td><strong>${escapeHtml(c.corporateName || c.name)}</strong></td>
                  <td>${escapeHtml(c.company)}</td>
                  <td>${escapeHtml(c.camadaLabel)}</td>
                  <td class="amount-cell" style="color: #b45309;">${formatCurrency(c.additionalAmount || 0)}</td>
                  <td>${escapeHtml(c.additionalReason)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${meta?.includeSignatures !== false ? `
          <div class="signatures">
            <div>
              <div class="sig-line">Diretoria Executiva</div>
              <div class="sig-role">Aprovação &amp; Governança</div>
            </div>
            <div>
              <div class="sig-line">Recursos Humanos / Gente &amp; Gestão</div>
              <div class="sig-role">Apuração &amp; Elegibilidade</div>
            </div>
            <div>
              <div class="sig-line">Controladoria &amp; Finanças</div>
              <div class="sig-role">Liquidação &amp; Fechamento</div>
            </div>
          </div>
        ` : ''}

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
          isEligible: c.isEligible,
          dedicatedGroupName: c.dedicatedGroupName
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
        r.delta = Number((val2 - val1).toFixed(2));
      });
    }

    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Constrói linhas comparativas dedicadas para os Grupos de Montante Específico entre cenários
   * (com fallback de reconstrução via candidatesSnapshot para máxima resiliência).
   */
  static buildDedicatedGroupsComparisonRows(scenarios: BprSavedScenario[]): DedicatedGroupComparisonRow[] {
    const map = new Map<string, DedicatedGroupComparisonRow>();

    scenarios.forEach(sc => {
      const summaries = sc.summary?.dedicatedGroupSummaries;
      if (Array.isArray(summaries) && summaries.length > 0) {
        summaries.forEach(gs => {
          const cleanName = (gs.name || 'Grupo Específico').trim();
          const key = normalizeSearchText(cleanName) || gs.groupId;
          if (!map.has(key)) {
            map.set(key, {
              groupKey: key,
              groupName: cleanName,
              scenarioValues: {},
            });
          }
          const entry = map.get(key)!;
          const prev = entry.scenarioValues[sc.id];
          entry.scenarioValues[sc.id] = {
            allocatedTotal: Number(((prev?.allocatedTotal || 0) + (gs.allocatedTotal || 0)).toFixed(2)),
            poolAmount: Number(((prev?.poolAmount || 0) + (gs.poolAmount || 0)).toFixed(2)),
            memberCount: (prev?.memberCount || 0) + (gs.memberCount || 0),
            distributionMode: gs.distributionMode,
            fundingSource: gs.fundingSource,
          };
        });
      } else if (Array.isArray(sc.candidatesSnapshot) && sc.candidatesSnapshot.length > 0) {
        // Fallback: reconstruir a partir de candidatesSnapshot quando summary.dedicatedGroupSummaries não estiver salvo
        const fallbackGroups = new Map<string, { name: string; allocated: number; members: number }>();
        sc.candidatesSnapshot.forEach(c => {
          if (!c.dedicatedGroupId && !c.dedicatedGroupName) return;
          const cleanName = (c.dedicatedGroupName || 'Grupo Específico').trim();
          const key = normalizeSearchText(cleanName) || (c.dedicatedGroupId || 'grupo');
          const cur = fallbackGroups.get(key) || { name: cleanName, allocated: 0, members: 0 };
          cur.allocated = Number((cur.allocated + (c.isEligible ? (c.rateioAmount ?? c.allocatedAmount ?? 0) : 0)).toFixed(2));
          if (c.isEligible) cur.members += 1;
          fallbackGroups.set(key, cur);
        });
        fallbackGroups.forEach((fg, key) => {
          if (!map.has(key)) {
            map.set(key, { groupKey: key, groupName: fg.name, scenarioValues: {} });
          }
          map.get(key)!.scenarioValues[sc.id] = {
            allocatedTotal: fg.allocated,
            poolAmount: fg.allocated,
            memberCount: fg.members,
          };
        });
      }
    });

    const rows = Array.from(map.values());
    if (scenarios.length >= 2) {
      const id1 = scenarios[0].id;
      const id2 = scenarios[1].id;
      rows.forEach(r => {
        const v1 = r.scenarioValues[id1];
        const v2 = r.scenarioValues[id2];
        r.deltaAmount = Number(((v2?.allocatedTotal || 0) - (v1?.allocatedTotal || 0)).toFixed(2));
        r.deltaMembers = (v2?.memberCount || 0) - (v1?.memberCount || 0);
      });
    }

    return rows.sort((a, b) => a.groupName.localeCompare(b.groupName, 'pt-BR'));
  }

  /**
   * Exporta PDF da comparação de múltiplos cenários
   */
  static exportComparisonPdf(
    scenarios: BprSavedScenario[],
    rows: ScenarioComparisonItem[],
    weightsByScenarioId?: Record<string, ScenarioRelativeWeightsBundle>
  ): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    const docWithLast = doc as jsPDF & { lastAutoTable?: { finalY?: number } };

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
      `E: ${formatCurrency(s.summary.amountPerE)} | T: ${formatCurrency(s.summary.amountPerT)} | O: ${formatCurrency(s.summary.amountPerO)}`,
      formatScenarioWeightLine(s, weightsByScenarioId?.[s.id])
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Cenário / Estudo', 'Data Estudo', 'Ciclo', 'Montante Previsto', 'Total Rateado', 'Elegíveis', 'Valor Base Médio (E / T / O)', 'Peso BPR / Média Mensal (E / T / O / Geral)']],
      body: scSummaryRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5
      },
      bodyStyles: { fontSize: 7 }
    });

    let nextY = docWithLast.lastAutoTable?.finalY ? docWithLast.lastAutoTable.finalY + 5 : 60;

    // Tabela 1B: Comparativo Dedicado de Grupos de Montante Específico (quando presentes)
    const groupCompRows = this.buildDedicatedGroupsComparisonRows(scenarios);
    if (groupCompRows.length > 0) {
      const grpHeaders = [
        'Grupo de Montante Específico (Exclusivo)',
        ...scenarios.map((s, idx) => `#${idx + 1} · ${s.name.length > 18 ? `${s.name.slice(0, 16)}...` : s.name}`),
        ...(scenarios.length >= 2 ? ['Delta (#2 vs #1)'] : [])
      ];
      const grpBody = groupCompRows.map(gr => {
        const scCols = scenarios.map(s => {
          const val = gr.scenarioValues[s.id];
          if (!val || (val.allocatedTotal === 0 && val.memberCount === 0)) return '—';
          return `${formatCurrency(val.allocatedTotal)} (${val.memberCount}p)`;
        });
        const deltaCol = scenarios.length >= 2
          ? `${(gr.deltaAmount || 0) > 0 ? '+' : ''}${formatCurrency(gr.deltaAmount || 0)} (${(gr.deltaMembers || 0) > 0 ? '+' : ''}${gr.deltaMembers || 0}p)`
          : null;
        return [gr.groupName, ...scCols, ...(deltaCol ? [deltaCol] : [])];
      });

      const grpFootTotals = scenarios.map(s => {
        const totAmt = groupCompRows.reduce((acc, gr) => acc + (gr.scenarioValues[s.id]?.allocatedTotal || 0), 0);
        const totMem = groupCompRows.reduce((acc, gr) => acc + (gr.scenarioValues[s.id]?.memberCount || 0), 0);
        return `${formatCurrency(totAmt)} (${totMem}p)`;
      });
      const totDeltaAmt = scenarios.length >= 2
        ? groupCompRows.reduce((acc, gr) => acc + (gr.deltaAmount || 0), 0)
        : 0;
      const totDeltaMem = scenarios.length >= 2
        ? groupCompRows.reduce((acc, gr) => acc + (gr.deltaMembers || 0), 0)
        : 0;

      autoTable(doc, {
        startY: nextY,
        head: [grpHeaders],
        body: grpBody,
        foot: [[
          'TOTAL GRUPOS ESPECÍFICOS',
          ...grpFootTotals,
          ...(scenarios.length >= 2 ? [`${totDeltaAmt > 0 ? '+' : ''}${formatCurrency(totDeltaAmt)} (${totDeltaMem > 0 ? '+' : ''}${totDeltaMem}p)`] : [])
        ]],
        theme: 'grid',
        headStyles: {
          fillColor: [15, 118, 110],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5
        },
        bodyStyles: { fontSize: 7 },
        footStyles: {
          fillColor: [240, 253, 250],
          textColor: [15, 118, 110],
          fontStyle: 'bold',
          fontSize: 7
        }
      });

      nextY = docWithLast.lastAutoTable?.finalY ? docWithLast.lastAutoTable.finalY + 6 : nextY + 25;
    }

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
        return item.dedicatedGroupName
          ? `${formatCurrency(item.amount)}\n[Grupo: ${item.dedicatedGroupName}]`
          : formatCurrency(item.amount);
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
      startY: nextY,
      head: [tableHeaders],
      body: bodyRows,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5
      },
      bodyStyles: { fontSize: 7 },
      didParseCell: (data) => {
        if (data.section === 'body' && scenarios.length >= 2 && data.column.index === tableHeaders.length - 1) {
          const rawVal = data.cell.raw as string;
          if (rawVal && rawVal.startsWith('+')) {
            data.cell.styles.textColor = [4, 120, 87]; // emerald-700
            data.cell.styles.fillColor = [236, 253, 245]; // emerald-50
            data.cell.styles.fontStyle = 'bold';
          } else if (rawVal && rawVal.startsWith('-')) {
            data.cell.styles.textColor = [190, 18, 60]; // rose-700
            data.cell.styles.fillColor = [254, 242, 242]; // rose-50
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [100, 116, 139]; // slate-500
          }
        }
      }
    });

    // Bloco de Assinaturas Executivas
    const finalTableY = docWithLast.lastAutoTable?.finalY ?? 170;
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

    // Assinatura 1: Diretoria
    doc.line(20, sigY, 20 + sigWidth, sigY);
    doc.text('DIRETORIA EXECUTIVA', 20 + sigWidth / 2, sigY + 4, { align: 'center' });
    doc.text('Aprovação Final da Diretoria', 20 + sigWidth / 2, sigY + 8, { align: 'center' });

    // Assinatura 2: Recursos Humanos
    doc.line(110, sigY, 110 + sigWidth, sigY);
    doc.text('GESTÃO DE PESSOAS / RH', 110 + sigWidth / 2, sigY + 4, { align: 'center' });
    doc.text('Validação de Elegibilidade', 110 + sigWidth / 2, sigY + 8, { align: 'center' });

    // Assinatura 3: Controladoria
    doc.line(200, sigY, 200 + sigWidth, sigY);
    doc.text('CONTROLADORIA FINANCEIRA', 200 + sigWidth / 2, sigY + 4, { align: 'center' });
    doc.text('Auditoria Orçamentária', 200 + sigWidth / 2, sigY + 8, { align: 'center' });

    doc.save(`Comparativo_BPR_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  /**
   * Abre janela de impressão formatada para comparação de cenários
   */
  static openPrintableComparison(
    scenarios: BprSavedScenario[],
    rows: ScenarioComparisonItem[],
    weightsByScenarioId?: Record<string, ScenarioRelativeWeightsBundle>
  ): void {
    if (typeof window === 'undefined') return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita popups neste site para visualizar o comparativo.');
      return;
    }

    const groupCompRows = this.buildDedicatedGroupsComparisonRows(scenarios);
    const totalGrpDeltaAmt = scenarios.length >= 2
      ? groupCompRows.reduce((acc, gr) => acc + (gr.deltaAmount || 0), 0)
      : 0;
    const totalGrpDeltaMem = scenarios.length >= 2
      ? groupCompRows.reduce((acc, gr) => acc + (gr.deltaMembers || 0), 0)
      : 0;

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
              <th style="text-align: right;">Peso BPR / Média Mensal (E / T / O / Geral)</th>
            </tr>
          </thead>
          <tbody>
            ${scenarios.map(s => `
              <tr>
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${formatDatePtBr(s.studyDate)}</td>
                <td>${escapeHtml(s.config.cycle)} / ${s.config.year}</td>
                <td class="amount">${formatCurrency(s.summary.totalPoolAmount)}</td>
                <td class="amount" style="color: #047857;">${formatCurrency(s.summary.totalDistributedAmount)}</td>
                <td style="text-align: center;">${s.summary.totalEligible}</td>
                <td class="amount" style="color: #0369a1; font-size: 9px;">${escapeHtml(formatScenarioWeightLine(s, weightsByScenarioId?.[s.id]))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${groupCompRows.length > 0 ? `
          <div style="font-size: 10px; font-weight: 900; color: #0f766e; text-transform: uppercase; margin: 12px 0 6px;">
            Grupos de Montante Específico — Comparativo Lado a Lado (Rateio Exclusivo)
          </div>
          <table style="margin-bottom: 20px;">
            <thead>
              <tr>
                <th style="background: #0f766e; border-color: #0f766e;">Grupo Específico</th>
                ${scenarios.map((s, idx) => `<th style="background: #0f766e; border-color: #0f766e; text-align: right;">#${idx + 1} · ${escapeHtml(s.name)}</th>`).join('')}
                ${scenarios.length >= 2 ? '<th style="background: #0f766e; border-color: #0f766e; text-align: right;">Delta (#2 vs #1)</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${groupCompRows.map(gr => `
                <tr>
                  <td><strong style="color: #0f766e;">${escapeHtml(gr.groupName)}</strong></td>
                  ${scenarios.map(s => {
                    const v = gr.scenarioValues[s.id];
                    if (!v || (v.allocatedTotal === 0 && v.memberCount === 0)) {
                      return '<td class="amount" style="color: #94a3b8;">—</td>';
                    }
                    return `<td class="amount">${formatCurrency(v.allocatedTotal)} <span style="font-size: 8.5px; color: #64748b; font-weight: 600;">(${v.memberCount}p)</span></td>`;
                  }).join('')}
                  ${scenarios.length >= 2 ? `
                    <td class="amount" style="background-color: ${(gr.deltaAmount || 0) > 0 ? '#ecfdf5' : (gr.deltaAmount || 0) < 0 ? '#fef2f2' : 'transparent'}; color: ${(gr.deltaAmount || 0) > 0 ? '#047857' : (gr.deltaAmount || 0) < 0 ? '#be123c' : '#64748b'};">
                      ${(gr.deltaAmount || 0) > 0 ? '+' : ''}${formatCurrency(gr.deltaAmount || 0)}
                      <span style="font-size: 8.5px; font-weight: 700;">(${(gr.deltaMembers || 0) > 0 ? '+' : ''}${gr.deltaMembers || 0}p)</span>
                    </td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background: #f0fdfa; font-weight: 900;">
                <td style="color: #0f766e;">TOTAL GRUPOS ESPECÍFICOS</td>
                ${scenarios.map(s => {
                  const totAmt = groupCompRows.reduce((acc, gr) => acc + (gr.scenarioValues[s.id]?.allocatedTotal || 0), 0);
                  const totMem = groupCompRows.reduce((acc, gr) => acc + (gr.scenarioValues[s.id]?.memberCount || 0), 0);
                  return `<td class="amount" style="color: #0f766e;">${formatCurrency(totAmt)} (${totMem}p)</td>`;
                }).join('')}
                ${scenarios.length >= 2 ? `
                  <td class="amount" style="color: ${totalGrpDeltaAmt > 0 ? '#047857' : totalGrpDeltaAmt < 0 ? '#be123c' : '#64748b'};">
                    ${totalGrpDeltaAmt > 0 ? '+' : ''}${formatCurrency(totalGrpDeltaAmt)} (${totalGrpDeltaMem > 0 ? '+' : ''}${totalGrpDeltaMem}p)
                  </td>
                ` : ''}
              </tr>
            </tfoot>
          </table>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Empresa</th>
              <th>Cargo</th>
              <th>Camada</th>
              ${scenarios.map(s => `<th style="text-align: right;">${escapeHtml(s.name)}</th>`).join('')}
              ${scenarios.length >= 2 ? '<th style="text-align: right;">Diferença (Delta)</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${escapeHtml(r.corporateName || r.name)}</strong></td>
                <td>${escapeHtml(r.company)}</td>
                <td>${escapeHtml(r.jobRole)}</td>
                <td>${escapeHtml(r.camadaLabel)}</td>
                ${scenarios.map(s => {
                  const item = r.scenarioValues[s.id];
                  const amt = item && item.isEligible ? item.amount : 0;
                  const grpBadge = item?.dedicatedGroupName
                    ? `<div style="font-size: 8px; color: #0f766e; font-weight: 700;">Grupo: ${escapeHtml(item.dedicatedGroupName)}</div>`
                    : '';
                  return `<td class="amount" style="color: ${amt > 0 ? '#0f172a' : '#94a3b8'};">${formatCurrency(amt)}${grpBadge}</td>`;
                }).join('')}
                ${scenarios.length >= 2 ? `
                  <td class="amount" style="background-color: ${(r.delta || 0) > 0 ? '#ecfdf5' : (r.delta || 0) < 0 ? '#fef2f2' : 'transparent'}; color: ${(r.delta || 0) > 0 ? '#047857' : (r.delta || 0) < 0 ? '#be123c' : '#64748b'}; font-weight: bold; padding: 4px 8px; border-radius: 4px;">
                    ${(r.delta || 0) > 0 ? '+' : ''}${formatCurrency(r.delta || 0)}
                  </td>
                ` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 40px; page-break-inside: avoid; display: flex; justify-content: space-around; text-align: center; font-size: 9px; color: #475569;">
          <div style="border-top: 1px solid #cbd5e1; width: 220px; padding-top: 6px;">
            <strong style="display: block; color: #0f172a;">DIRETORIA EXECUTIVA</strong>
            <span>Aprovação Final da Diretoria</span>
          </div>
          <div style="border-top: 1px solid #cbd5e1; width: 220px; padding-top: 6px;">
            <strong style="display: block; color: #0f172a;">GESTÃO DE PESSOAS / RH</strong>
            <span>Validação de Elegibilidade</span>
          </div>
          <div style="border-top: 1px solid #cbd5e1; width: 220px; padding-top: 6px;">
            <strong style="display: block; color: #0f172a;">CONTROLADORIA FINANCEIRA</strong>
            <span>Auditoria Orçamentária</span>
          </div>
        </div>

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
