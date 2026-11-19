import type { Employee } from '@/types/loans';

export type HeadcountLegalNature = 'CLT' | 'ESTAGIO' | 'PJ';

export interface HeadcountReportRow {
  id: string;
  nature: HeadcountLegalNature;
  natureLabel: string;
  displayName: string;
  documentId: string;
  documentLabel: 'CPF' | 'CNPJ';
  company: string;
  linkType: string;
  roleOrScope: string;
  camada: string;
  nivelEnquadramento: string;
  camadaNivelLabel: string;
  department: string;
  startDateFormatted: string;
  resignationDateFormatted: string;
  startDateRaw: string;
  resignationDateRaw: string;
  remuneration: number;
  status: string;
  isActive: boolean;
}

export interface HeadcountNatureSummary {
  count: number;
  activeCount: number;
  inactiveCount: number;
  totalValue: number;
}

export interface PartitionedHeadcountData {
  allRows: HeadcountReportRow[];
  cltRows: HeadcountReportRow[];
  estagioRows: HeadcountReportRow[];
  pjRows: HeadcountReportRow[];
  cltSummary: HeadcountNatureSummary;
  estagioSummary: HeadcountNatureSummary;
  pjSummary: HeadcountNatureSummary;
  grandSummary: {
    totalCount: number;
    activeCount: number;
    inactiveCount: number;
    totalValue: number;
    naturesPresent: HeadcountLegalNature[];
    isMixed: boolean;
  };
}

export interface HeadcountReportMeta {
  companiesLabel: string;
  linksLabel: string;
  camadasLabel?: string;
  niveisLabel?: string;
  statusLabel: string;
  dateLabel: string;
  showResignationColumn: boolean;
  includeFinancials: boolean;
  includeSummaryCards: boolean;
  includeSignatures: boolean;
  generatedAt?: Date;
}

function roundCurrency(value: number): number {
  const safe = Number.isFinite(value) ? value : 0;
  return Math.round((safe + Number.EPSILON) * 100) / 100;
}

export function formatCurrencyBrl(value: number): string {
  const safe = roundCurrency(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(safe === 0 ? 0 : safe);
}

export function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateBr(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const clean = String(dateStr).slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

export function classifyEmployeeLegalNature(e: Partial<Employee>): HeadcountLegalNature {
  const link = (e.linkType || e.employment_type || '').trim().toUpperCase();
  if (link.includes('ESTAG') || link.includes('ESTÁG')) {
    return 'ESTAGIO';
  }
  if (link.includes('PJ') || link.includes('MEI')) {
    return 'PJ';
  }
  if (link.includes('CLT')) {
    return 'CLT';
  }
  const hasPjDoc = Boolean((e.pj_type || '').trim());
  const corp = (e.corporate_name || '').trim().toUpperCase();
  const isEmployerCorp = corp.includes('D.Z.M') || corp === 'DZM' || corp.includes('MAR BRASIL') || corp === 'G2';
  if (hasPjDoc || (corp && !isEmployerCorp) || e.is_outsourced === true) {
    return 'PJ';
  }
  return 'CLT';
}

export function resolveHeadcountDisplayName(e: Partial<Employee>, nature: HeadcountLegalNature): string {
  const corp = (e.corporate_name || '').trim();
  const corpUpper = corp.toUpperCase();
  const isEmployerCorp = corpUpper.includes('D.Z.M') || corpUpper === 'DZM' || corpUpper.includes('MAR BRASIL') || corpUpper === 'G2';
  if (nature === 'PJ' && corp && !isEmployerCorp) {
    return corp;
  }
  return (e.name || corp || 'Sem nome').trim();
}

function resolveCamada(e: Partial<Employee>): string {
  const meta = (e.metadata as Record<string, unknown> | undefined) || {};
  const c = String(e.camada || meta.camada || '').trim();
  if (c) {
    const cLower = c.toLowerCase();
    if (cLower.includes('estrat')) return 'Estratégico';
    if (cLower.includes('tát') || cLower.includes('tat')) return 'Tático';
    if (cLower.includes('oper')) return 'Operacional';
  }
  const n = String(e.nivel || meta.nivel || '').trim();
  if (n) {
    const nLower = n.toLowerCase();
    if (nLower.includes('estrat')) return 'Estratégico';
    if (nLower.includes('tát') || nLower.includes('tat')) return 'Tático';
    if (nLower.includes('oper')) return 'Operacional';
  }
  const role = (e.job_role || '').toLowerCase();
  if (role.includes('gestor') || role.includes('diretor') || role.includes('especialista')) return 'Estratégico';
  if (role.includes('analista') || role.includes('supervisor') || role.includes('consultor') || role.includes('bpo')) return 'Tático';
  return 'Operacional';
}

function resolveNivelEnquadramento(e: Partial<Employee>): string {
  const meta = (e.metadata as Record<string, unknown> | undefined) || {};
  const rawNivel = String(e.nivel || '').trim();
  const rawGrau = String(meta.grau || '').trim();
  const nVal = e.nivel_enquadramento
    || (['I', 'II', 'III'].includes(rawNivel) ? rawNivel : '')
    || String(meta.nivel_enquadramento || '').trim()
    || (['I', 'II', 'III'].includes(rawGrau) ? rawGrau : '');
  if (nVal && ['I', 'II', 'III'].includes(String(nVal).trim())) {
    return String(nVal).trim();
  }
  const grau = String(e.grau || meta.grau || '').toLowerCase();
  if (grau.includes('avan') || grau === '1') return 'I';
  if (grau.includes('inter') || grau === '2') return 'II';
  if (grau.includes('inic') || grau === '3') return 'III';
  return '-';
}

function summarizeRows(rows: HeadcountReportRow[]): HeadcountNatureSummary {
  let activeCount = 0;
  let inactiveCount = 0;
  let totalValue = 0;

  for (const r of rows) {
    if (r.isActive) activeCount += 1;
    else inactiveCount += 1;
    totalValue += r.remuneration;
  }

  return {
    count: rows.length,
    activeCount,
    inactiveCount,
    totalValue: roundCurrency(totalValue),
  };
}

export function partitionEmployeesByLegalNature(employees: Partial<Employee>[]): PartitionedHeadcountData {
  const allRows: HeadcountReportRow[] = [];
  const cltRows: HeadcountReportRow[] = [];
  const estagioRows: HeadcountReportRow[] = [];
  const pjRows: HeadcountReportRow[] = [];

  for (const e of employees || []) {
    const nature = classifyEmployeeLegalNature(e);
    const natureLabel = nature === 'CLT'
      ? 'Vínculo Empregatício (CLT)'
      : nature === 'ESTAGIO'
        ? 'Estágio (Lei nº 11.788/2008)'
        : 'Prestação de Serviços (PJ / MEI)';

    const displayName = resolveHeadcountDisplayName(e, nature);
    const documentId = nature === 'PJ'
      ? ((e.pj_type || e.document_id || '-').trim() || '-')
      : ((e.document_id || e.responsible_cpf || '-').trim() || '-');
    const documentLabel: 'CPF' | 'CNPJ' = nature === 'PJ' ? 'CNPJ' : 'CPF';

    const camada = resolveCamada(e);
    const nivelEnquadramento = resolveNivelEnquadramento(e);
    const camadaNivelLabel = nivelEnquadramento !== '-' ? `${camada} (${nivelEnquadramento})` : camada;

    const rawResignation = String(e.resignation_date || (e as Record<string, unknown>).real_resignation_date || '');
    const stLower = (e.status || '').toLowerCase();
    const isActive = !['inativo', 'desligado', 'demitido'].includes(stLower) && (e as Record<string, unknown>).active !== false;
    const remuneration = roundCurrency(Number(e.remuneration_fixed || e.remuneration || 0));

    const row: HeadcountReportRow = {
      id: String(e.id || displayName),
      nature,
      natureLabel,
      displayName,
      documentId,
      documentLabel,
      company: e.company || 'MarBR',
      linkType: nature === 'PJ' ? (e.linkType === 'MEI' ? 'MEI' : 'PJ') : (e.linkType || (nature === 'ESTAGIO' ? 'Estágio' : 'CLT')),
      roleOrScope: e.job_role || '-',
      camada,
      nivelEnquadramento,
      camadaNivelLabel,
      department: e.department || 'Geral',
      startDateRaw: e.start_date || '',
      resignationDateRaw: rawResignation,
      startDateFormatted: formatDateBr(e.start_date),
      resignationDateFormatted: formatDateBr(rawResignation),
      remuneration,
      status: e.status || (isActive ? 'Ativo' : 'Inativo'),
      isActive,
    };

    allRows.push(row);
    if (nature === 'CLT') cltRows.push(row);
    else if (nature === 'ESTAGIO') estagioRows.push(row);
    else pjRows.push(row);
  }

  const cltSummary = summarizeRows(cltRows);
  const estagioSummary = summarizeRows(estagioRows);
  const pjSummary = summarizeRows(pjRows);

  const naturesPresent: HeadcountLegalNature[] = [];
  if (cltRows.length > 0) naturesPresent.push('CLT');
  if (estagioRows.length > 0) naturesPresent.push('ESTAGIO');
  if (pjRows.length > 0) naturesPresent.push('PJ');

  return {
    allRows,
    cltRows,
    estagioRows,
    pjRows,
    cltSummary,
    estagioSummary,
    pjSummary,
    grandSummary: {
      totalCount: allRows.length,
      activeCount: cltSummary.activeCount + estagioSummary.activeCount + pjSummary.activeCount,
      inactiveCount: cltSummary.inactiveCount + estagioSummary.inactiveCount + pjSummary.inactiveCount,
      totalValue: roundCurrency(cltSummary.totalValue + estagioSummary.totalValue + pjSummary.totalValue),
      naturesPresent,
      isMixed: naturesPresent.length > 1,
    },
  };
}

function getSectionHeaders(nature: HeadcountLegalNature, showResignation: boolean, includeFinancials: boolean): string[] {
  if (nature === 'PJ') {
    return [
      '#',
      'Contratada (Razão Social)',
      'CNPJ',
      'Contratante',
      'Mod.',
      'Escopo de Serviços',
      'Camada / Nível',
      'Área',
      'Início Contrato',
      ...(showResignation ? ['Encerramento'] : []),
      ...(includeFinancials ? ['Honorários / Contrato'] : []),
      'Status',
    ];
  }

  if (nature === 'ESTAGIO') {
    return [
      '#',
      'Estagiário',
      'CPF',
      'Empresa',
      'Mod.',
      'Área / Atuação',
      'Camada / Nível',
      'Departamento',
      'Início Estágio',
      ...(showResignation ? ['Término'] : []),
      ...(includeFinancials ? ['Bolsa-Auxílio'] : []),
      'Status',
    ];
  }

  return [
    '#',
    'Colaborador (Empregado CLT)',
    'CPF',
    'Empresa',
    'Regime',
    'Cargo',
    'Camada / Nível',
    'Departamento',
    'Admissão',
    ...(showResignation ? ['Desligamento'] : []),
    ...(includeFinancials ? ['Salário Base'] : []),
    'Status',
  ];
}

function buildSectionTableHtml(
  nature: HeadcountLegalNature,
  rows: HeadcountReportRow[],
  summary: HeadcountNatureSummary,
  meta: HeadcountReportMeta,
  sectionIndex: number | null
): string {
  const headers = getSectionHeaders(nature, meta.showResignationColumn, meta.includeFinancials);
  const financialColIdx = headers.length - 2; // penúltima coluna quando includeFinancials === true
  const preFinancialColSpan = meta.showResignationColumn ? 10 : 9;

  const bannerClass = nature === 'PJ' ? 'banner-pj' : nature === 'ESTAGIO' ? 'banner-estagio' : 'banner-clt';
  const bannerTitle = nature === 'PJ'
    ? 'PRESTAÇÃO DE SERVIÇOS — EMPRESAS CONTRATADAS (PJ / MEI)'
    : nature === 'ESTAGIO'
      ? 'ESTAGIÁRIOS — LEI Nº 11.788/2008 (SEM VÍNCULO EMPREGATÍCIO)'
      : 'QUADRO DE EMPREGADOS — REGIME CLT (VÍNCULO EMPREGATÍCIO)';

  const unitLabel = nature === 'PJ'
    ? (summary.count === 1 ? 'empresa contratada' : 'empresas contratadas')
    : nature === 'ESTAGIO'
      ? (summary.count === 1 ? 'estagiário' : 'estagiários')
      : (summary.count === 1 ? 'empregado CLT' : 'empregados CLT');

  const totalLabel = nature === 'PJ'
    ? `Total Contratos PJ / MEI (${summary.count} ${unitLabel}):`
    : nature === 'ESTAGIO'
      ? `Total Bolsas de Estágio (${summary.count} ${unitLabel}):`
      : `Total Massa Salarial CLT (${summary.count} ${unitLabel}):`;

  const bannerHtml = sectionIndex !== null
    ? `<div class="section-banner ${bannerClass}">
         <span>SEÇÃO ${sectionIndex} • ${bannerTitle}</span>
         <span class="section-meta">${summary.count} ${unitLabel} • ${summary.activeCount} ativos</span>
       </div>`
    : '';

  const tbodyHtml = rows.map((r, index) => `
    <tr>
      <td style="text-align: center; color: #64748b; font-weight: 700;">${index + 1}</td>
      <td><strong>${escapeHtml(r.displayName)}</strong></td>
      <td style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8.5px;">${escapeHtml(r.documentId)}</td>
      <td><strong>${escapeHtml(r.company)}</strong></td>
      <td style="text-align: center;"><span class="regime-badge badge-${nature.toLowerCase()}">${escapeHtml(r.linkType)}</span></td>
      <td>${escapeHtml(r.roleOrScope)}</td>
      <td><span class="nivel-pill">${escapeHtml(r.camadaNivelLabel)}</span></td>
      <td>${escapeHtml(r.department)}</td>
      <td>${escapeHtml(r.startDateFormatted)}</td>
      ${meta.showResignationColumn ? `<td>${escapeHtml(r.resignationDateFormatted)}</td>` : ''}
      ${meta.includeFinancials ? `<td class="amount">${formatCurrencyBrl(r.remuneration)}</td>` : ''}
      <td style="text-align: center;">
        <span class="status-badge ${r.isActive ? 'status-active' : 'status-inactive'}">${escapeHtml(r.status)}</span>
      </td>
    </tr>
  `).join('');

  return `
    <div class="section-block">
      ${bannerHtml}
      <table>
        <thead>
          <tr>
            ${headers.map((h, i) => {
              const isAmount = meta.includeFinancials && i === financialColIdx;
              const isCenter = i === 0 || i === 4 || i === headers.length - 1;
              return `<th style="${isAmount ? 'text-align: right;' : isCenter ? 'text-align: center;' : ''}">${escapeHtml(h)}</th>`;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${tbodyHtml}
        </tbody>
        ${meta.includeFinancials ? `
          <tfoot>
            <tr class="total-row">
              <td colspan="${preFinancialColSpan}" style="text-align: right; text-transform: uppercase;">${escapeHtml(totalLabel)}</td>
              <td class="amount" style="color: #047857;">${formatCurrencyBrl(summary.totalValue)}</td>
              <td></td>
            </tr>
          </tfoot>
        ` : ''}
      </table>
    </div>
  `;
}

function buildHeadcountSignaturesHtml(mode: 'CLT' | 'ESTAGIO' | 'PJ'): string {
  const leftTitle = mode === 'PJ'
    ? 'GESTÃO DE CONTRATOS / COMPRAS'
    : mode === 'ESTAGIO'
      ? 'GESTÃO DE ESTÁGIOS / RH'
      : 'GESTÃO DE PESSOAS / RH';
  const leftSub = mode === 'PJ'
    ? 'Validação Contratual B2B'
    : mode === 'ESTAGIO'
      ? 'Validação de Termos de Estágio'
      : 'Emissão e Validação Cadastral';

  return `
    <div class="signatures">
      <div class="sig-line">
        <strong style="display: block; color: #0f172a;">${escapeHtml(leftTitle)}</strong>
        <span>${escapeHtml(leftSub)}</span>
      </div>
      <div class="sig-line">
        <strong style="display: block; color: #0f172a;">DIRETORIA EXECUTIVA</strong>
        <span>Aprovação Institucional</span>
      </div>
    </div>
  `;
}

export function buildHeadcountPrintHtml(
  employees: Partial<Employee>[],
  meta: HeadcountReportMeta
): string {
  const data = partitionEmployeesByLegalNature(employees);
  const now = meta.generatedAt || new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR');

  const isOnlyPj = data.grandSummary.naturesPresent.length === 1 && data.grandSummary.naturesPresent[0] === 'PJ';
  const isOnlyEstagio = data.grandSummary.naturesPresent.length === 1 && data.grandSummary.naturesPresent[0] === 'ESTAGIO';
  const isOnlyClt = data.grandSummary.naturesPresent.length === 1 && data.grandSummary.naturesPresent[0] === 'CLT';

  const docTitle = isOnlyPj
    ? 'Relação de Empresas Contratadas (PJ / MEI)'
    : isOnlyEstagio
      ? 'Relação de Estagiários (Lei nº 11.788/2008)'
      : isOnlyClt
        ? 'Relação Geral de Empregados — Regime CLT'
        : 'Relatório Consolidado por Natureza Jurídica (CLT • Estágio • PJ/MEI)';

  const totalCountLabel = isOnlyPj
    ? `${data.grandSummary.totalCount} Empresas Contratadas`
    : isOnlyEstagio
      ? `${data.grandSummary.totalCount} Estagiários`
      : isOnlyClt
        ? `${data.grandSummary.totalCount} Empregados CLT`
        : `${data.grandSummary.totalCount} Registros (${data.cltSummary.count} CLT • ${data.estagioSummary.count} Estágio • ${data.pjSummary.count} PJ/MEI)`;

  const scopeText = `Escopo: ${meta.companiesLabel} • Naturezas: ${meta.linksLabel}${meta.camadasLabel || ''}${meta.niveisLabel || ''} • Status: ${meta.statusLabel} • ${meta.dateLabel}`;

  let summaryCardsHtml = '';
  if (meta.includeSummaryCards) {
    if (isOnlyPj) {
      summaryCardsHtml = `
        <div class="kpis">
          <div class="kpi-card">
            <div class="kpi-label">Empresas Contratadas</div>
            <div class="kpi-value">${data.pjSummary.count} contratadas</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Situação Contratual</div>
            <div class="kpi-value">${data.pjSummary.activeCount} Ativas • ${data.pjSummary.inactiveCount} Encerradas</div>
          </div>
          ${meta.includeFinancials ? `
            <div class="kpi-card" style="border-left: 3px solid #0f766e;">
              <div class="kpi-label" style="color: #0f766e;">Total Mensal de Honorários (PJ)</div>
              <div class="kpi-value" style="color: #0f766e;">${formatCurrencyBrl(data.pjSummary.totalValue)}</div>
            </div>
          ` : ''}
        </div>
      `;
    } else if (isOnlyEstagio) {
      summaryCardsHtml = `
        <div class="kpis">
          <div class="kpi-card">
            <div class="kpi-label">Estagiários (Lei 11.788/08)</div>
            <div class="kpi-value">${data.estagioSummary.count} estagiários</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Situação dos Termos</div>
            <div class="kpi-value">${data.estagioSummary.activeCount} Ativos • ${data.estagioSummary.inactiveCount} Encerrados</div>
          </div>
          ${meta.includeFinancials ? `
            <div class="kpi-card" style="border-left: 3px solid #d97706;">
              <div class="kpi-label" style="color: #b45309;">Total Mensal de Bolsas</div>
              <div class="kpi-value" style="color: #b45309;">${formatCurrencyBrl(data.estagioSummary.totalValue)}</div>
            </div>
          ` : ''}
        </div>
      `;
    } else if (isOnlyClt) {
      summaryCardsHtml = `
        <div class="kpis">
          <div class="kpi-card">
            <div class="kpi-label">Headcount CLT</div>
            <div class="kpi-value">${data.cltSummary.count} empregados</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Status Ativo / Desligado</div>
            <div class="kpi-value">${data.cltSummary.activeCount} Ativos • ${data.cltSummary.inactiveCount} Desligados</div>
          </div>
          ${meta.includeFinancials ? `
            <div class="kpi-card" style="border-left: 3px solid #059669;">
              <div class="kpi-label" style="color: #047857;">Massa Salarial Base (CLT)</div>
              <div class="kpi-value" style="color: #047857;">${formatCurrencyBrl(data.cltSummary.totalValue)}</div>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      summaryCardsHtml = `
        <div class="kpis">
          ${data.cltSummary.count > 0 ? `
            <div class="kpi-card" style="border-left: 3px solid #2563eb;">
              <div class="kpi-label" style="color: #1d4ed8;">Empregados CLT</div>
              <div class="kpi-value">${data.cltSummary.count} empregados${meta.includeFinancials ? ` • ${formatCurrencyBrl(data.cltSummary.totalValue)}` : ''}</div>
            </div>
          ` : ''}
          ${data.estagioSummary.count > 0 ? `
            <div class="kpi-card" style="border-left: 3px solid #d97706;">
              <div class="kpi-label" style="color: #b45309;">Estagiários (Lei 11.788/08)</div>
              <div class="kpi-value">${data.estagioSummary.count} estagiários${meta.includeFinancials ? ` • ${formatCurrencyBrl(data.estagioSummary.totalValue)}` : ''}</div>
            </div>
          ` : ''}
          ${data.pjSummary.count > 0 ? `
            <div class="kpi-card" style="border-left: 3px solid #0f766e;">
              <div class="kpi-label" style="color: #0f766e;">Empresas Contratadas (PJ/MEI)</div>
              <div class="kpi-value">${data.pjSummary.count} contratadas${meta.includeFinancials ? ` • ${formatCurrencyBrl(data.pjSummary.totalValue)}` : ''}</div>
            </div>
          ` : ''}
          <div class="kpi-card" style="border-left: 3px solid #059669; background: #ecfdf5;">
            <div class="kpi-label" style="color: #065f46;">Consolidado Geral (Grupo)</div>
            <div class="kpi-value" style="color: #065f46;">${data.grandSummary.totalCount} registros${meta.includeFinancials ? ` • ${formatCurrencyBrl(data.grandSummary.totalValue)}` : ''}</div>
          </div>
        </div>
        <div class="compliance-note">
          <strong>Segregação Jurídica:</strong> Empregados CLT, estagiários (Lei nº 11.788/2008) e empresas prestadoras de serviços (PJ/MEI) são listados em seções independentes.${data.pjRows.length > 0 ? ' O Caderno de Empresas Contratadas (PJ/MEI) inicia em nova página destacável.' : ''}
        </div>
      `;
    }
  }

  let sectionsHtml = '';
  if (data.grandSummary.totalCount === 0) {
    sectionsHtml = '<div class="empty-box">Nenhum registro encontrado para os filtros selecionados.</div>';
  } else if (isOnlyClt) {
    sectionsHtml = buildSectionTableHtml('CLT', data.cltRows, data.cltSummary, meta, null)
      + (meta.includeSignatures ? buildHeadcountSignaturesHtml('CLT') : '');
  } else if (isOnlyEstagio) {
    sectionsHtml = buildSectionTableHtml('ESTAGIO', data.estagioRows, data.estagioSummary, meta, null)
      + (meta.includeSignatures ? buildHeadcountSignaturesHtml('ESTAGIO') : '');
  } else if (isOnlyPj) {
    sectionsHtml = buildSectionTableHtml('PJ', data.pjRows, data.pjSummary, meta, null)
      + (meta.includeSignatures ? buildHeadcountSignaturesHtml('PJ') : '');
  } else {
    const blocks: string[] = [];
    let secNum = 1;
    const hasInternal = data.cltRows.length > 0 || data.estagioRows.length > 0;

    if (data.cltRows.length > 0) {
      blocks.push(buildSectionTableHtml('CLT', data.cltRows, data.cltSummary, meta, secNum++));
    }
    if (data.estagioRows.length > 0) {
      blocks.push(buildSectionTableHtml('ESTAGIO', data.estagioRows, data.estagioSummary, meta, secNum++));
    }
    if (hasInternal && meta.includeSignatures) {
      blocks.push(buildHeadcountSignaturesHtml(data.cltRows.length > 0 ? 'CLT' : 'ESTAGIO'));
    }

    if (data.pjRows.length > 0) {
      blocks.push(`
        <div class="pj-booklet-break">
          <div class="header" style="border-bottom-color: #0f766e;">
            <div>
              <h1 class="title" style="color: #134e4a;">Caderno Independente • Empresas Contratadas (PJ / MEI)</h1>
              <div class="meta">${escapeHtml(scopeText)}</div>
              <div class="meta" style="color: #64748b;">Emissão: ${escapeHtml(dateStr)} às ${escapeHtml(timeStr)} • Total: ${data.pjSummary.count} Empresas Contratadas</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; font-weight: 900; color: #0f766e; text-transform: uppercase;">GOVERNANÇA DE CONTRATOS B2B</span>
            </div>
          </div>
          ${buildSectionTableHtml('PJ', data.pjRows, data.pjSummary, meta, secNum++)}
          ${meta.includeSignatures ? buildHeadcountSignaturesHtml('PJ') : ''}
        </div>
      `);
    }
    sectionsHtml = blocks.join('\n');
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)} (${data.grandSummary.totalCount} Registros)</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 9mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 8px; font-size: 10px; }
    .header { border-bottom: 2px solid ${isOnlyPj ? '#0f766e' : '#0f172a'}; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
    .title { font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0; }
    .meta { font-size: 8.5px; color: #475569; font-weight: 600; text-transform: uppercase; margin-top: 3px; }
    .kpis { display: flex; gap: 8px; margin-bottom: 10px; }
    .kpi-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; page-break-inside: avoid; }
    .kpi-label { font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase; }
    .kpi-value { font-size: 11px; font-weight: 900; color: #0f172a; margin-top: 2px; font-variant-numeric: tabular-nums; }
    .compliance-note { font-size: 8px; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #059669; border-radius: 5px; padding: 5px 8px; margin-bottom: 10px; }
    .section-block { margin-bottom: 12px; }
    .section-banner { display: flex; justify-content: space-between; align-items: center; padding: 5px 9px; border-radius: 6px; font-size: 8.5px; font-weight: 900; text-transform: uppercase; margin: 8px 0 6px 0; page-break-after: avoid; break-after: avoid; }
    .banner-clt { background: #eff6ff; color: #1e3a8a; border: 1px solid #bfdbfe; border-left: 4px solid #2563eb; }
    .banner-estagio { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; border-left: 4px solid #d97706; }
    .banner-pj { background: #f0fdfa; color: #134e4a; border: 1px solid #99f6e4; border-left: 4px solid #0f766e; }
    .section-meta { font-size: 7.8px; font-weight: 700; text-transform: none; }
    .pj-booklet-break { page-break-before: always; break-before: page; }
    .empty-box { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; color: #64748b; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 8.8px; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th { background: #0f172a; color: white; font-weight: 800; text-transform: uppercase; padding: 5px 6px; border: 1px solid #0f172a; text-align: left; font-size: 7.8px; white-space: nowrap; }
    td { padding: 4.5px 6px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .amount { text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .total-row td { background: #e2e8f0 !important; font-weight: 900; border-top: 2px solid #059669; }
    .nivel-pill { display: inline-block; padding: 1px 5px; border-radius: 4px; background: #f1f5f9; font-weight: 700; font-size: 8.5px; white-space: nowrap; }
    .regime-badge { display: inline-block; padding: 1.5px 5px; border-radius: 4px; font-size: 7.5px; font-weight: 800; text-transform: uppercase; }
    .badge-clt { background: #dbeafe; color: #1e40af; }
    .badge-estagio { background: #fef3c7; color: #92400e; }
    .badge-pj { background: #ccfbf1; color: #134e4a; }
    .status-badge { display: inline-block; padding: 1.5px 6px; border-radius: 4px; font-size: 7.5px; font-weight: 700; text-transform: uppercase; }
    .status-active { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .status-inactive { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .signatures { margin-top: 28px; margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid; display: flex; justify-content: space-around; text-align: center; font-size: 8.5px; color: #475569; }
    .sig-line { border-top: 1px solid #cbd5e1; width: 220px; padding-top: 6px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 10px; padding: 9px 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
    <span style="font-weight: 800; color: #92400e;">${escapeHtml(docTitle)}</span>
    <div>
      <button onclick="window.print()" style="padding: 6px 14px; background: #059669; color: white; border: none; border-radius: 6px; font-weight: 800; cursor: pointer;">Imprimir / Salvar PDF</button>
      <button onclick="window.close()" style="padding: 6px 14px; background: #e2e8f0; color: #334155; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; margin-left: 6px;">Fechar</button>
    </div>
  </div>

  <div class="header">
    <div>
      <h1 class="title">${escapeHtml(docTitle)}</h1>
      <div class="meta">${escapeHtml(scopeText)}</div>
      <div class="meta" style="color: #64748b;">Emissão: ${escapeHtml(dateStr)} às ${escapeHtml(timeStr)} • Total: ${escapeHtml(totalCountLabel)}</div>
    </div>
    <div style="text-align: right;">
      <span style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">${isOnlyPj ? 'GOVERNANÇA DE CONTRATOS B2B' : 'MAR BRASIL • DZM • G2'}</span>
    </div>
  </div>

  ${summaryCardsHtml}
  ${sectionsHtml}

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;
}

export function buildHeadcountGeneralCsv(
  employees: Partial<Employee>[],
  includeFinancials: boolean,
  generatedAt?: Date
): string {
  const data = partitionEmployeesByLegalNature(employees);
  const now = generatedAt || new Date();
  const sanitize = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  let csv = '';
  csv += `"RELATÓRIO CONSOLIDADO POR NATUREZA JURÍDICA (CLT • ESTÁGIO • PJ/MEI)"\n`;
  csv += `"Data de Emissão: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}"\n`;
  csv += `"Resumo: ${data.cltSummary.count} CLT | ${data.estagioSummary.count} Estágio | ${data.pjSummary.count} PJ/MEI | Total: ${data.grandSummary.totalCount}"\n\n`;

  csv += `Nº;Natureza Jurídica;Nome / Razão Social;Tipo Doc;CPF / CNPJ;Contratante;Modalidade;Cargo / Escopo de Serviços;Camada;Nível;Área / Departamento;Data Início (Admissão / Contrato);Data Encerramento;${includeFinancials ? 'Valor Base Mensal (Salário / Bolsa / Honorários);' : ''}Status\n`;

  const orderedRows = [...data.cltRows, ...data.estagioRows, ...data.pjRows];
  orderedRows.forEach((r, idx) => {
    csv += `${idx + 1};${sanitize(r.natureLabel)};${sanitize(r.displayName)};${sanitize(r.documentLabel)};${sanitize(r.documentId)};${sanitize(r.company)};${sanitize(r.linkType)};${sanitize(r.roleOrScope)};${sanitize(r.camada)};${sanitize(r.nivelEnquadramento)};${sanitize(r.department)};${sanitize(r.startDateRaw || '-')};${sanitize(r.resignationDateRaw || '-')};${includeFinancials ? sanitize(r.remuneration.toFixed(2)) + ';' : ''}${sanitize(r.status)}\n`;
  });

  return csv;
}

export interface JsPdfDocLike {
  setFont(font: string, style?: string): void;
  setFontSize(size: number): void;
  setTextColor(r: number, g: number, b: number): void;
  setFillColor(r: number, g: number, b: number): void;
  setDrawColor(r: number, g: number, b: number): void;
  setLineWidth(width: number): void;
  roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  text(text: string, x: number, y: number, options?: Record<string, unknown>): void;
  addPage(): void;
  internal: { pageSize: { getHeight(): number } };
  lastAutoTable?: { finalY: number };
}

export type AutoTableFn = (doc: JsPdfDocLike, options: Record<string, unknown>) => void;

export function renderHeadcountVectorPdf(
  doc: JsPdfDocLike,
  autoTable: AutoTableFn,
  employees: Partial<Employee>[],
  meta: HeadcountReportMeta
): void {
  const data = partitionEmployeesByLegalNature(employees);
  const now = meta.generatedAt || new Date();
  const isOnlyPj = data.grandSummary.naturesPresent.length === 1 && data.grandSummary.naturesPresent[0] === 'PJ';
  const isOnlyEstagio = data.grandSummary.naturesPresent.length === 1 && data.grandSummary.naturesPresent[0] === 'ESTAGIO';
  const isOnlyClt = data.grandSummary.naturesPresent.length === 1 && data.grandSummary.naturesPresent[0] === 'CLT';

  const docTitle = isOnlyPj
    ? 'RELAÇÃO DE EMPRESAS CONTRATADAS (PJ / MEI)'
    : isOnlyEstagio
      ? 'RELAÇÃO DE ESTAGIÁRIOS — LEI Nº 11.788/2008'
      : isOnlyClt
        ? 'RELAÇÃO GERAL DE EMPREGADOS — REGIME CLT'
        : 'RELATÓRIO CONSOLIDADO POR NATUREZA JURÍDICA (CLT • ESTÁGIO • PJ/MEI)';

  const scopeLine = `ESCOPO: ${meta.companiesLabel} • NATUREZAS: ${meta.linksLabel}${meta.camadasLabel || ''}${meta.niveisLabel || ''} • STATUS: ${meta.statusLabel} • ${meta.dateLabel}`;
  const countLine = isOnlyPj
    ? `${data.pjSummary.count} EMPRESAS CONTRATADAS`
    : isOnlyEstagio
      ? `${data.estagioSummary.count} ESTAGIÁRIOS`
      : isOnlyClt
        ? `${data.cltSummary.count} EMPREGADOS CLT`
        : `${data.grandSummary.totalCount} REGISTROS (${data.cltSummary.count} CLT • ${data.estagioSummary.count} ESTÁGIO • ${data.pjSummary.count} PJ/MEI)`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(docTitle, 14, 15);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(scopeLine, 14, 21);
  doc.text(`EMISSÃO: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')} • TOTAL: ${countLine}`, 14, 25.5);

  let currentY = 30;

  if (meta.includeSummaryCards) {
    const cardsData: Array<{ label: string; value: string; color: [number, number, number] }> = [];
    if (isOnlyPj) {
      cardsData.push({ label: 'EMPRESAS CONTRATADAS', value: `${data.pjSummary.count} contratadas`, color: [15, 23, 42] });
      cardsData.push({ label: 'SITUAÇÃO CONTRATUAL', value: `${data.pjSummary.activeCount} Ativas • ${data.pjSummary.inactiveCount} Encerradas`, color: [30, 41, 59] });
      if (meta.includeFinancials) {
        cardsData.push({ label: 'TOTAL MENSAL HONORÁRIOS (PJ)', value: formatCurrencyBrl(data.pjSummary.totalValue), color: [15, 118, 110] });
      }
    } else if (isOnlyEstagio) {
      cardsData.push({ label: 'ESTAGIÁRIOS (LEI 11.788/08)', value: `${data.estagioSummary.count} estagiários`, color: [15, 23, 42] });
      cardsData.push({ label: 'SITUAÇÃO DOS TERMOS', value: `${data.estagioSummary.activeCount} Ativos • ${data.estagioSummary.inactiveCount} Encerrados`, color: [30, 41, 59] });
      if (meta.includeFinancials) {
        cardsData.push({ label: 'TOTAL MENSAL DE BOLSAS', value: formatCurrencyBrl(data.estagioSummary.totalValue), color: [180, 83, 9] });
      }
    } else if (isOnlyClt) {
      cardsData.push({ label: 'HEADCOUNT CLT', value: `${data.cltSummary.count} empregados`, color: [15, 23, 42] });
      cardsData.push({ label: 'STATUS ATIVO / DESLIGADO', value: `${data.cltSummary.activeCount} Ativos • ${data.cltSummary.inactiveCount} Desligados`, color: [30, 41, 59] });
      if (meta.includeFinancials) {
        cardsData.push({ label: 'MASSA SALARIAL BASE (CLT)', value: formatCurrencyBrl(data.cltSummary.totalValue), color: [4, 120, 87] });
      }
    } else {
      if (data.cltSummary.count > 0) {
        cardsData.push({ label: 'EMPREGADOS CLT', value: `${data.cltSummary.count}${meta.includeFinancials ? ` • ${formatCurrencyBrl(data.cltSummary.totalValue)}` : ''}`, color: [29, 78, 216] });
      }
      if (data.estagioSummary.count > 0) {
        cardsData.push({ label: 'ESTAGIÁRIOS (LEI 11.788/08)', value: `${data.estagioSummary.count}${meta.includeFinancials ? ` • ${formatCurrencyBrl(data.estagioSummary.totalValue)}` : ''}`, color: [180, 83, 9] });
      }
      if (data.pjSummary.count > 0) {
        cardsData.push({ label: 'CONTRATADAS PJ / MEI', value: `${data.pjSummary.count}${meta.includeFinancials ? ` • ${formatCurrencyBrl(data.pjSummary.totalValue)}` : ''}`, color: [15, 118, 110] });
      }
      cardsData.push({ label: 'CONSOLIDADO GRUPO', value: `${data.grandSummary.totalCount}${meta.includeFinancials ? ` • ${formatCurrencyBrl(data.grandSummary.totalValue)}` : ''}`, color: [4, 120, 87] });
    }

    const totalAvailWidth = 269;
    const gap = 4;
    const cardWidth = (totalAvailWidth - gap * (cardsData.length - 1)) / Math.max(1, cardsData.length);
    const cardHeight = 14;

    cardsData.forEach((c, idx) => {
      const x = 14 + idx * (cardWidth + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(c.label, x + 3.5, currentY + 5);

      doc.setFontSize(8.2);
      doc.setTextColor(c.color[0], c.color[1], c.color[2]);
      doc.text(c.value, x + 3.5, currentY + 10.5);
    });

    currentY += cardHeight + 6;
  }

  const drawSignatures = (mode: 'CLT' | 'ESTAGIO' | 'PJ', startY: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    let sigY = startY + 16;
    if (sigY + 22 > pageHeight) {
      doc.addPage();
      sigY = 28;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const sigWidth = 70;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);

    const leftLabel = mode === 'PJ' ? 'GESTÃO DE CONTRATOS / COMPRAS' : mode === 'ESTAGIO' ? 'GESTÃO DE ESTÁGIOS / RH' : 'GESTÃO DE PESSOAS / RH';
    const leftSub = mode === 'PJ' ? 'Validação Contratual B2B' : mode === 'ESTAGIO' ? 'Validação de Termos de Estágio' : 'Emissão e Validação Cadastral';

    doc.line(40, sigY, 40 + sigWidth, sigY);
    doc.text(leftLabel, 40 + sigWidth / 2, sigY + 4, { align: 'center' });
    doc.text(leftSub, 40 + sigWidth / 2, sigY + 8, { align: 'center' });

    doc.line(170, sigY, 170 + sigWidth, sigY);
    doc.text('DIRETORIA EXECUTIVA', 170 + sigWidth / 2, sigY + 4, { align: 'center' });
    doc.text('Aprovação Institucional', 170 + sigWidth / 2, sigY + 8, { align: 'center' });
  };

  const renderSection = (
    nature: HeadcountLegalNature,
    rows: HeadcountReportRow[],
    summary: HeadcountNatureSummary,
    sectionIndex: number | null,
    startY: number
  ): number => {
    let y = startY;
    if (sectionIndex !== null) {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (y + 24 > pageHeight) {
        doc.addPage();
        y = 18;
      }
      const bannerText = nature === 'PJ'
        ? `SEÇÃO ${sectionIndex} • PRESTAÇÃO DE SERVIÇOS — EMPRESAS CONTRATADAS (PJ / MEI)`
        : nature === 'ESTAGIO'
          ? `SEÇÃO ${sectionIndex} • ESTAGIÁRIOS — LEI Nº 11.788/2008`
          : `SEÇÃO ${sectionIndex} • EMPREGADOS — REGIME CLT (VÍNCULO EMPREGATÍCIO)`;
      const fill: [number, number, number] = nature === 'PJ' ? [240, 253, 250] : nature === 'ESTAGIO' ? [255, 251, 235] : [239, 246, 255];
      const txt: [number, number, number] = nature === 'PJ' ? [19, 78, 74] : nature === 'ESTAGIO' ? [146, 64, 14] : [30, 58, 138];
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, y, 269, 7.5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(txt[0], txt[1], txt[2]);
      doc.text(bannerText, 17, y + 5);
      y += 9.5;
    }

    const headers = getSectionHeaders(nature, meta.showResignationColumn, meta.includeFinancials);
    const body = rows.map((r, idx) => [
      String(idx + 1),
      r.displayName,
      r.documentId,
      r.company,
      r.linkType,
      r.roleOrScope,
      r.camadaNivelLabel,
      r.department,
      r.startDateFormatted,
      ...(meta.showResignationColumn ? [r.resignationDateFormatted] : []),
      ...(meta.includeFinancials ? [formatCurrencyBrl(r.remuneration)] : []),
      r.status,
    ]);

    if (meta.includeFinancials) {
      const emptyCols = meta.showResignationColumn ? 9 : 8;
      const totLabel = nature === 'PJ' ? 'TOTAL CONTRATOS PJ/MEI' : nature === 'ESTAGIO' ? 'TOTAL BOLSAS ESTÁGIO' : 'TOTAL MASSA SALARIAL CLT';
      body.push([
        '',
        `${totLabel} (${summary.count})`,
        ...Array(emptyCols - 1).fill(''),
        formatCurrencyBrl(summary.totalValue),
        '',
      ]);
    }

    const finColIdx = meta.includeFinancials ? headers.length - 2 : -1;
    const headFill: [number, number, number] = nature === 'PJ' ? [15, 118, 110] : nature === 'ESTAGIO' ? [180, 83, 9] : [15, 23, 42];

    autoTable(doc, {
      startY: y,
      head: [headers],
      body,
      theme: 'striped',
      headStyles: { fillColor: headFill, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2 },
      bodyStyles: { fontSize: 6.8 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        ...(finColIdx >= 0 ? { [finColIdx]: { halign: 'right', fontStyle: 'bold' } } : {}),
      },
    });

    return (doc.lastAutoTable ? doc.lastAutoTable.finalY : y + 30) + 6;
  };

  let nextY = currentY;
  const hasInternal = data.cltRows.length > 0 || data.estagioRows.length > 0;
  let sectionNum = 1;

  if (data.cltRows.length > 0) {
    nextY = renderSection('CLT', data.cltRows, data.cltSummary, data.grandSummary.isMixed ? sectionNum++ : null, nextY);
  }
  if (data.estagioRows.length > 0) {
    nextY = renderSection('ESTAGIO', data.estagioRows, data.estagioSummary, data.grandSummary.isMixed ? sectionNum++ : null, nextY);
  }
  if (hasInternal && meta.includeSignatures) {
    drawSignatures(data.cltRows.length > 0 ? 'CLT' : 'ESTAGIO', nextY);
  }

  if (data.pjRows.length > 0) {
    if (hasInternal) {
      // Quebra de página obrigatória para o Caderno Independente B2B (PJ / MEI)
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13.5);
      doc.setTextColor(19, 78, 74);
      doc.text('CADERNO INDEPENDENTE • EMPRESAS CONTRATADAS (PJ / MEI)', 14, 15);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`${scopeLine}`, 14, 20.5);
      doc.text(`GOVERNANÇA DE CONTRATOS B2B • TOTAL: ${data.pjSummary.count} EMPRESAS CONTRATADAS`, 14, 25);
      nextY = 30;
    }

    nextY = renderSection('PJ', data.pjRows, data.pjSummary, data.grandSummary.isMixed ? sectionNum++ : null, nextY);
    if (meta.includeSignatures) {
      drawSignatures('PJ', nextY);
    }
  }
}
