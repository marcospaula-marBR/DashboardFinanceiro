import { Employee, MonthlyCost, getPBClassification, normalizeCompanyName } from '@/types/loans';
import {
  BprRuleConfig,
  BprCandidateResult,
  BprCalculationSummary,
  BprCamada,
  BprLayerSummary,
  BprLayerRelativeWeight,
  BprTargetMultipleLayerProjection,
  BprTargetMultipleSimulation,
  BprCycle,
  BprSavedScenario,
  BprSavedRun,
  BprDedicatedGroup,
  BprDedicatedGroupSummary,
  BprDedicatedGroupEligibilityPolicy,
  BprDedicatedGroupImpactPreview
} from '@/types/bpr';
import { supabase } from '@/lib/supabase';
import { calculateRowFinancials } from '@/services/people-hr.service';

const BPR_STORAGE_KEY = 'marbrasil_bpr_config_v1';
const BPR_RUNS_STORAGE_KEY = 'marbrasil_bpr_runs_history_v1';
const BPR_SCENARIOS_STORAGE_KEY = 'marbrasil_bpr_scenarios_v2';

export class BprService {

  /**
   * Mapeia o fator/meta informada (0 a 100%) para a faixa oficial de direito no Grupo Dedicado:
   * - >= 100% -> 100% de direito ('full')
   * - 90% a 99,99% -> reducedFactorPct (padrão 75%) de direito ('partial')
   * - < 90% -> 0% de direito ('zero')
   */
  static resolveDedicatedFactorRightPct(
    scorePct: number,
    reducedFactorPct = 75
  ): { tier: 'full' | 'partial' | 'zero'; rightPct: number } {
    const rawScore = Number(scorePct);
    const clampedScore = Number.isFinite(rawScore)
      ? Math.round(Math.min(100, Math.max(0, rawScore)) * 100) / 100
      : 0;
    const rawReduced = Number(reducedFactorPct);
    const clampedReduced = Number.isFinite(rawReduced)
      ? Math.round(Math.min(100, Math.max(0, rawReduced)) * 100) / 100
      : 75;

    if (clampedScore >= 100) {
      return { tier: 'full', rightPct: 100 };
    }
    if (clampedScore >= 90) {
      return { tier: 'partial', rightPct: clampedReduced };
    }
    return { tier: 'zero', rightPct: 0 };
  }

  /**
   * Retorna a configuração padrão para um determinado ciclo e ano de referência
   */
  static getDefaultConfig(cycle: BprCycle = 'ciclo_1', year: number = new Date().getFullYear()): BprRuleConfig {
    if (cycle === 'ciclo_1') {
      // Ciclo 1 (C1 - 1º Semestre): Pago até Setembro (Ref: 01/01 a 30/06 do ano)
      return {
        cycle: 'ciclo_1',
        year,
        periodStartDate: `${year}-01-01`,
        periodEndDate: `${year}-06-30`,
        paymentDate: `${year}-09-30`,
        totalPoolAmount: 100000,
        splitMode: 'percentage',
        tierSplits: { E: 30, T: 40, O: 30 },
        tierAmounts: { E: 30000, T: 40000, O: 30000 },
        additionalAmounts: {},
        additionalReasons: {},
        additionalDeductionSource: 'total_pool',
        allowDedicatedGroups: false,
        dedicatedGroups: [],
        allowGlosados: false,
        selectedGlosadosExceptions: [],
        allowInativos: false,
        selectedInativosExceptions: [],
        manuallyExcludedEmployeeIds: [],
        companiesFilter: [],
        linkTypesFilter: []
      };
    } else if (cycle === 'ciclo_2') {
      // Ciclo 2 (C2 - 2º Semestre): Pago até Março (Ref: 01/07 a 31/12 do ano)
      return {
        cycle: 'ciclo_2',
        year,
        periodStartDate: `${year}-07-01`,
        periodEndDate: `${year}-12-31`,
        paymentDate: `${year + 1}-03-31`,
        totalPoolAmount: 100000,
        splitMode: 'percentage',
        tierSplits: { E: 30, T: 40, O: 30 },
        tierAmounts: { E: 30000, T: 40000, O: 30000 },
        additionalAmounts: {},
        additionalReasons: {},
        additionalDeductionSource: 'total_pool',
        allowDedicatedGroups: false,
        dedicatedGroups: [],
        allowGlosados: false,
        selectedGlosadosExceptions: [],
        allowInativos: false,
        selectedInativosExceptions: [],
        manuallyExcludedEmployeeIds: [],
        companiesFilter: [],
        linkTypesFilter: []
      };
    } else {
      return {
        cycle: 'custom',
        year,
        periodStartDate: `${year}-01-01`,
        periodEndDate: `${year}-12-31`,
        paymentDate: `${year}-12-31`,
        totalPoolAmount: 100000,
        splitMode: 'percentage',
        tierSplits: { E: 30, T: 40, O: 30 },
        tierAmounts: { E: 30000, T: 40000, O: 30000 },
        additionalAmounts: {},
        additionalReasons: {},
        additionalDeductionSource: 'total_pool',
        allowDedicatedGroups: false,
        dedicatedGroups: [],
        allowGlosados: false,
        selectedGlosadosExceptions: [],
        allowInativos: false,
        selectedInativosExceptions: [],
        manuallyExcludedEmployeeIds: [],
        companiesFilter: [],
        linkTypesFilter: []
      };
    }
  }

  /**
   * Determina a camada do colaborador (E, T ou O)
   */
  static getEmployeeCamada(e: Employee): { camada: BprCamada; label: string } {
    let camadaStr = (e.camada || '').trim().toUpperCase();

    if (!camadaStr) {
      const pbClass = getPBClassification(e.camada, e.nivel);
      if (pbClass.startsWith('E')) camadaStr = 'E';
      else if (pbClass.startsWith('T')) camadaStr = 'T';
      else camadaStr = 'O';
    }

    if (camadaStr.startsWith('E') || camadaStr === 'ESTRATÉGICO' || camadaStr === 'ESTRATEGICO') {
      return { camada: 'E', label: 'Estratégico' };
    }
    if (camadaStr.startsWith('T') || camadaStr === 'TÁTICO' || camadaStr === 'TATICO') {
      return { camada: 'T', label: 'Tático' };
    }
    return { camada: 'O', label: 'Operacional/CLTs' };
  }

  /**
   * Calcula a média de atingimento de metas e o fator de elegibilidade do ciclo
   * 100% -> 1.0 (100% do bônus)
   * 90% a 99.99% -> 0.75 (75% do bônus)
   * < 90% -> 0.0 (0% do bônus / inelegível)
   */
  static calculateCyclePerformance(
    monthlyScores: Record<string, Record<string, number>> | undefined,
    cycle: BprCycle,
    year: number
  ): {
    averageScore: number;
    performanceFactor: number;
    factorLabel: string;
    hasRecordedScores: boolean;
  } {
    if (!monthlyScores || !monthlyScores[String(year)]) {
      return {
        averageScore: 100,
        performanceFactor: 1.0,
        factorLabel: '100% do Bônus (Padrão)',
        hasRecordedScores: false
      };
    }

    const yearScores = monthlyScores[String(year)];
    let months: string[] = [];

    if (cycle === 'ciclo_1') {
      // Ciclo 1 (C1 - 1º Semestre): Janeiro a Junho (01 a 06)
      months = ['01', '02', '03', '04', '05', '06'];
    } else if (cycle === 'ciclo_2') {
      // Ciclo 2 (C2 - 2º Semestre): Julho a Dezembro (07 a 12)
      months = ['07', '08', '09', '10', '11', '12'];
    } else {
      // Custom: todos os 12 meses
      months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    }

    // Para cada mês do ciclo, considera a nota gravada ou 100% como base padrão
    let hasAnyRecorded = false;
    const scores = months.map(m => {
      if (yearScores[m] !== undefined && yearScores[m] !== null && !isNaN(Number(yearScores[m]))) {
        hasAnyRecorded = true;
        return Number(yearScores[m]);
      }
      return 100;
    });

    if (!hasAnyRecorded) {
      return {
        averageScore: 100,
        performanceFactor: 1.0,
        factorLabel: '100% do Bônus (Padrão)',
        hasRecordedScores: false
      };
    }

    const sum = scores.reduce((acc, v) => acc + v, 0);
    const avg = sum / scores.length;

    let factor = 1.0;
    let label = '100% do Bônus';

    if (avg >= 100) {
      factor = 1.0;
      label = '100% do Bônus (Meta 100%)';
    } else if (avg >= 90) {
      factor = 0.75;
      label = '75% do Bônus (Meta 90% a 99%)';
    } else {
      factor = 0.0;
      label = '0% (Meta < 90% não atingida)';
    }

    return {
      averageScore: Math.round(avg * 10) / 10,
      performanceFactor: factor,
      factorLabel: label,
      hasRecordedScores: true
    };
  }

  /**
   * Motor de Cálculo e Apuração Determinística do BPR
   */
  static calculateBpr(
    employees: Employee[],
    monthlyCosts: MonthlyCost[] = [],
    config: BprRuleConfig
  ): BprCalculationSummary {
    const cycleStart = new Date(`${config.periodStartDate}T00:00:00`);
    const cycleEnd = new Date(`${config.periodEndDate}T23:59:59`);
    const paymentDate = new Date(`${config.paymentDate}T23:59:59`);

    // Obter lista de competências do ciclo para checagem de glosas (ex: 2025-01 até 2025-06 ou 2025-07 até 2025-12)
    const cycleMonths: string[] = [];
    const curMonth = new Date(cycleStart);
    while (curMonth <= cycleEnd) {
      const comp = `${curMonth.getFullYear()}-${String(curMonth.getMonth() + 1).padStart(2, '0')}`;
      if (!cycleMonths.includes(comp)) {
        cycleMonths.push(comp);
      }
      curMonth.setDate(1);
      curMonth.setMonth(curMonth.getMonth() + 1);
    }

    // Mapa de glosas e custos históricos por colaborador nas competências do ciclo (O(M))
    const cycleMonthsSet = new Set(cycleMonths);
    const glosaByEmployeeId = new Map<string, { hasGlosa: boolean; details: string[] }>();
    const periodCostsByEmployeeId = new Map<string, MonthlyCost[]>();
    monthlyCosts.forEach(mc => {
      if (!mc.employee_id) return;
      const comp = (mc.competencia || '').slice(0, 7);
      if (cycleMonthsSet.has(comp)) {
        const list = periodCostsByEmployeeId.get(mc.employee_id);
        if (list) {
          list.push(mc);
        } else {
          periodCostsByEmployeeId.set(mc.employee_id, [mc]);
        }

        const glosaVal = Number(mc.valor_glosa_base || 0) +
          Number(mc.valor_glosa_bonus || 0) +
          Number((mc as any).glosa || (mc as any).desconto_glosa || 0);
        if (glosaVal > 0) {
          const prev = glosaByEmployeeId.get(mc.employee_id) || { hasGlosa: false, details: [] };
          prev.hasGlosa = true;
          prev.details.push(`Glosa de R$ ${glosaVal.toFixed(2)} em ${comp}`);
          glosaByEmployeeId.set(mc.employee_id, prev);
        }
      }
    });

    const candidates: BprCandidateResult[] = [];
    const glosadosCandidates: BprCandidateResult[] = [];
    const inativosCandidates: BprCandidateResult[] = [];
    const manuallyExcludedSet = new Set(config.manuallyExcludedEmployeeIds || []);

    employees.forEach(emp => {
      // 0. Bloqueio estrito de registros de configuração global do sistema
      const nameUpper = (emp.name || '').toUpperCase();
      const corpUpper = (emp.corporate_name || '').toUpperCase();
      if (!emp.name || nameUpper.includes('SYSTEM_GLOBAL') || corpUpper.includes('SYSTEM_GLOBAL') || emp.id === '__SYSTEM_GLOBAL_CONFIG__') {
        return;
      }

      // 1. Filtros de Escopo (Empresa e Vínculo)
      if (config.companiesFilter.length > 0) {
        const normFilter = config.companiesFilter.map(c => normalizeCompanyName(c));
        if (!normFilter.includes(normalizeCompanyName(emp.company))) {
          return;
        }
      }

      const link = emp.linkType || 'CLT';
      const isEstagio = link.toLowerCase().includes('estag') ||
        link.toLowerCase().includes('estág') ||
        (emp.job_role || '').toLowerCase().includes('estag') ||
        (emp.job_role || '').toLowerCase().includes('estág') ||
        ((emp as any).employment_type || '').toLowerCase().includes('estag') ||
        ((emp as any).employment_type || '').toLowerCase().includes('estág');

      if (config.linkTypesFilter.length > 0) {
        const matchesLink = config.linkTypesFilter.includes(link) ||
          (config.linkTypesFilter.includes('Estagiário') && isEstagio) ||
          (config.linkTypesFilter.includes('CLT') && (link === 'CLT' || isEstagio)) ||
          (config.linkTypesFilter.includes('Terceirizado') && emp.is_outsourced);
        if (!matchesLink) return;
      }

      // 2. Análise de Datas Real (NÃO usar contract_expiry_date como data de rescisão)
      const startDateStr = emp.start_date;
      const startDate = startDateStr ? new Date(`${startDateStr}T00:00:00`) : null;

      // Data real de desligamento (apenas se realmente foi desligado)
      const realResignationDateStr = emp.resignation_date || (emp as any).status_end_date;
      const realResignationDate = realResignationDateStr ? new Date(`${realResignationDateStr}T23:59:59`) : null;

      // Admissão antes ou no início do ciclo
      const admittedBeforeOrAtCycleStart = startDate ? startDate <= cycleStart : true;

      // Ativo durante todo o período eletivo (não demitido antes do fim do ciclo)
      const activeThroughoutCycle = realResignationDate ? realResignationDate >= cycleEnd : true;

      // Ativo na data de pagamento (inclusive)
      const isStatusActive = emp.status === 'Ativo' || emp.status === 'Férias';
      const activeAtPaymentDate = realResignationDate
        ? realResignationDate >= paymentDate
        : isStatusActive;

      // Inativo na data de pagamento
      const isInactiveAtPaymentDate = !activeAtPaymentDate;

      // REGRA ESTREITA E INVIOLÁVEL: Colaborador inativo entre o 1º dia após o ciclo e a data de pagamento
      // (deve comprovar ter trabalhado todo o ciclo e ter data real de rescisão estritamente entre cycleEnd e paymentDate)
      const isInactiveBetweenCycleAndPayment = Boolean(
        admittedBeforeOrAtCycleStart &&
        realResignationDate &&
        realResignationDate > cycleEnd &&
        realResignationDate <= paymentDate
      );

      // Glosa no período eletivo (considera estritamente os meses pertencentes ao ciclo apurado)
      const glosaInfo = glosaByEmployeeId.get(emp.id) || { hasGlosa: false, details: [] };
      const hasGlosaInPeriod = glosaInfo.hasGlosa;
      const glosaDetails = glosaInfo.details.length > 0 ? glosaInfo.details.join(', ') : undefined;

      // 3. Avaliação de Metas e Desempenho Mensal
      const rawScores = emp.bpr_monthly_scores || (emp.metadata as any)?.bpr_monthly_scores;
      const cyclePerf = this.calculateCyclePerformance(rawScores, config.cycle, config.year);

      // 4. Avaliação de Elegibilidade Padrão & Exceções
      const ineligibilityReasons: string[] = [];
      let isEligible = true;
      let isExceptionApplied = false;

      if (!admittedBeforeOrAtCycleStart) {
        isEligible = false;
        ineligibilityReasons.push(`Admissão em ${startDateStr || '—'} posterior ao início do ciclo (${config.periodStartDate})`);
      }

      if (!activeThroughoutCycle) {
        isEligible = false;
        ineligibilityReasons.push(`Desligamento em ${realResignationDateStr || '—'} antes do término do período eletivo (${config.periodEndDate})`);
      }

      // Tratamento de Inativos na data de pagamento
      if (isInactiveAtPaymentDate) {
        if (isInactiveBetweenCycleAndPayment && config.allowInativos && config.selectedInativosExceptions.includes(emp.id)) {
          isExceptionApplied = true;
        } else {
          isEligible = false;
          ineligibilityReasons.push(`Inativo na data de pagamento (${config.paymentDate})`);
        }
      }

      // Tratamento de Glosados
      if (hasGlosaInPeriod) {
        const isException = config.allowGlosados && config.selectedGlosadosExceptions.includes(emp.id);
        if (isException) {
          isExceptionApplied = true;
        } else {
          isEligible = false;
          ineligibilityReasons.push(`Glosa registrada no período eletivo (${glosaDetails || 'Desconto'})`);
        }
      }

      // Meta Mensal < 90% (Inelegível por desempenho)
      if (cyclePerf.performanceFactor === 0 && cyclePerf.hasRecordedScores) {
        isEligible = false;
        ineligibilityReasons.push(`Média de metas do ciclo (${cyclePerf.averageScore}%) abaixo de 90%`);
      }

      // Exclusão Manual pelo Gestor
      const isManuallyExcluded = manuallyExcludedSet.has(emp.id);
      if (isManuallyExcluded) {
        isEligible = false;
        isExceptionApplied = false;
        ineligibilityReasons.push('Excluído manualmente do rateio');
      }

      const { camada, label: camadaLabel } = this.getEmployeeCamada(emp);

      // Histórico financeiro recebido no período de apuração do BPR (Custo Histórico People)
      const empPeriodCosts = periodCostsByEmployeeId.get(emp.id) || [];
      const linkUpper = String(link || (emp as Employee & { employment_type?: string }).employment_type || '').toUpperCase();
      const monthTotals = new Map<string, number>();
      empPeriodCosts.forEach(mc => {
        const comp = (mc.competencia || '').slice(0, 7);
        const mcVinculoUpper = String(mc.vinculo_tipo || '').toUpperCase();
        const isCLTBranch = mcVinculoUpper
          ? (mcVinculoUpper === 'CLT' || mcVinculoUpper.includes('ESTAG') || mcVinculoUpper.includes('ESTÁG'))
          : (isEstagio || linkUpper.includes('CLT'));
        const fin = calculateRowFinancials(mc, isCLTBranch);
        const realVal = Number(fin.realTotal || 0);
        if (realVal > 0) {
          monthTotals.set(comp, Number(((monthTotals.get(comp) || 0) + realVal).toFixed(2)));
        }
      });
      const periodMonthsCount = monthTotals.size;
      const periodReceivedTotal = Number(
        Array.from(monthTotals.values()).reduce((acc, v) => acc + v, 0).toFixed(2)
      );
      const periodReceivedAverage = periodMonthsCount > 0
        ? Number((periodReceivedTotal / periodMonthsCount).toFixed(2))
        : 0;

      const candidateResult: BprCandidateResult = {
        employeeId: emp.id,
        name: emp.name,
        corporateName: emp.corporate_name,
        responsibleName: emp.responsible_name,
        company: emp.company || 'MarBR',
        department: emp.department || 'Geral',
        jobRole: emp.job_role || (isEstagio ? 'Estagiário' : 'Colaborador'),
        linkType: isEstagio ? 'Estagiário' : link,
        isOutsourced: Boolean(emp.is_outsourced),
        camada,
        camadaLabel,
        nivel: emp.nivel_enquadramento || emp.nivel,
        grau: emp.grau,
        status: emp.status || 'Ativo',
        startDate: startDateStr,
        resignationDate: realResignationDateStr,
        realResignationDate: realResignationDateStr,
        photoUrl: emp.photo_url || emp.avatar || (emp as any).avatar_url,
        monthlyAverageScore: cyclePerf.hasRecordedScores ? cyclePerf.averageScore : undefined,
        performanceFactor: cyclePerf.performanceFactor,
        performanceFactorLabel: cyclePerf.factorLabel,
        admittedBeforeOrAtCycleStart,
        activeThroughoutCycle,
        activeAtPaymentDate,
        hasGlosaInPeriod,
        glosaDetails,
        isInactiveAtPaymentDate,
        isManuallyExcluded,
        isEligible,
        isExceptionApplied,
        ineligibilityReasons,
        baseAmount: 0,
        allocatedAmount: 0, // Será calculado após a contagem de elegíveis
        periodReceivedTotal,
        periodReceivedAverage,
        periodMonthsCount,
        bprVsAveragePct: 0,
        bprVsTotalPct: 0
      };

      candidates.push(candidateResult);

      if (hasGlosaInPeriod) {
        glosadosCandidates.push(candidateResult);
      }
      // Apenas inativos que cumpriram o ciclo e saíram comprovadamente no intervalo pós-ciclo até pagamento
      if (isInactiveBetweenCycleAndPayment) {
        inativosCandidates.push(candidateResult);
      }
    });

    return this.computeLayersAndAdditionalDistribution(candidates, config, glosadosCandidates, inativosCandidates);
  }

  /**
   * Motor puro de cálculo de rateio por camada, grupos dedicados exclusivos, valores adicionais individuais e regra de abatimento
   */
  static computeLayersAndAdditionalDistribution(
    candidates: BprCandidateResult[],
    config: BprRuleConfig,
    glosadosCandidatesArg?: BprCandidateResult[],
    inativosCandidatesArg?: BprCandidateResult[]
  ): BprCalculationSummary {
    const round2 = (v: number) => Number(v.toFixed(2));
    const candidateById = new Map<string, BprCandidateResult>();
    candidates.forEach(c => candidateById.set(c.employeeId, c));
    const manuallyExcludedSet = new Set(config.manuallyExcludedEmployeeIds || []);

    // 1. Resolução dos Grupos Dedicados de Montante Específico (Exclusivos — fora do rateio E/T/O)
    const claimedMemberIds = new Set<string>();
    const memberAssignment = new Map<
      string,
      {
        groupId: string;
        groupName: string;
        isEligibleInGroup: boolean;
        baseShare: number;
        shareAmount: number;
        sharePct: number;
        scorePct: number;
        effectiveFactorPct: number;
        redistributedBonus: number;
      }
    >();
    const dedicatedGroupSummaries: BprDedicatedGroupSummary[] = [];
    let dedicatedGroupsTotalPool = 0;
    let dedicatedGroupsAllocatedTotal = 0;
    let dedicatedGroupsExtraBonusTotal = 0;
    let dedicatedMembersCount = 0;

    if (config.allowDedicatedGroups && Array.isArray(config.dedicatedGroups) && config.dedicatedGroups.length > 0) {
      config.dedicatedGroups.forEach(group => {
        if (!group || !group.enabled || !Array.isArray(group.members) || group.members.length === 0) return;

        const validMembers = group.members.filter(m => {
          if (!m || !m.employeeId) return false;
          const cand = candidateById.get(m.employeeId);
          if (!cand) return false;
          if (cand.isManuallyExcluded || manuallyExcludedSet.has(m.employeeId)) return false;
          if (claimedMemberIds.has(m.employeeId)) return false;
          return true;
        });

        if (validMembers.length === 0) return;
        validMembers.forEach(m => claimedMemberIds.add(m.employeeId));

        // Retrocompatibilidade: grupos legados (sem os novos campos) preservam inclusão como exceção sem corte de 75%
        const eligibilityPolicy: BprDedicatedGroupEligibilityPolicy =
          group.eligibilityPolicy ?? 'include_all_as_exception';
        const applyPerf = group.applyPerformanceFactor ?? false;
        const reducedFactorPct = Math.min(100, Math.max(0, Number(group.reducedFactorPct ?? 75)));
        const shouldRedistribute = group.redistributePerformanceResidual ?? true;

        const eligibleMembers = eligibilityPolicy === 'follow_bpr_rules'
          ? validMembers.filter(m => candidateById.get(m.employeeId)?.isEligible === true)
          : validMembers;
        const ineligibleMembers = validMembers.filter(
          m => !eligibleMembers.some(em => em.employeeId === m.employeeId)
        );

        const groupNameTrimmed = (group.name || 'Grupo Específico').trim();
        const mode = group.distributionMode || 'equal';
        let effectiveGroupPool = Math.max(0, round2(Number(group.poolAmount || 0)));

        // Calcular cota base bruta por membro elegível do grupo e resolver faixa oficial de fator
        const prepared = eligibleMembers.map(m => {
          const cand = candidateById.get(m.employeeId)!;
          let rawBase = 0;
          if (mode === 'equal') {
            rawBase = eligibleMembers.length > 0 ? round2(effectiveGroupPool / eligibleMembers.length) : 0;
          } else if (mode === 'percentage') {
            const pct = Math.max(0, Number(m.percentage || 0));
            rawBase = round2((effectiveGroupPool * pct) / 100);
          } else {
            rawBase = Math.max(0, round2(Number(m.amount || 0)));
          }

          // Fator/Meta (%) base: customFactorPct tem prioridade; senão usa média/fator do ciclo se habilitado
          const hasCustomFactor =
            m.customFactorPct !== undefined &&
            m.customFactorPct !== null &&
            String(m.customFactorPct).trim() !== '' &&
            !Number.isNaN(Number(m.customFactorPct));
          let scorePct = 100;
          if (hasCustomFactor) {
            scorePct = Math.min(100, Math.max(0, Number(m.customFactorPct)));
          } else if (applyPerf) {
            if (
              cand.monthlyAverageScore !== undefined &&
              cand.monthlyAverageScore !== null &&
              !Number.isNaN(Number(cand.monthlyAverageScore))
            ) {
              scorePct = Math.min(100, Math.max(0, Number(cand.monthlyAverageScore)));
            } else {
              const perf = cand.performanceFactor ?? 1.0;
              if (perf >= 1.0) scorePct = 100;
              else if (perf > 0) scorePct = 95;
              else scorePct = 0;
            }
          }

          scorePct = round2(scorePct);
          const { tier, rightPct } = BprService.resolveDedicatedFactorRightPct(scorePct, reducedFactorPct);

          return { member: m, rawBase, scorePct, tier, factorPct: rightPct };
        });

        if (mode === 'amount') {
          const sumRawAmounts = round2(prepared.reduce((acc, item) => acc + item.rawBase, 0));
          effectiveGroupPool = Math.max(effectiveGroupPool, sumRawAmounts);
        }

        // Etapa 1: membros < 90% ('zero') perdem direito; saldo é redistribuído entre elegíveis >= 90% ('partial' e 'full')
        const ge90Items = prepared.filter(it => it.tier !== 'zero' && it.rawBase > 0);
        const zeroItems = prepared.filter(it => it.tier === 'zero');
        const retainedStep1 = round2(zeroItems.reduce((acc, it) => acc + it.rawBase, 0));
        const sumGe90Base = round2(ge90Items.reduce((acc, it) => acc + it.rawBase, 0));

        const step1Items = prepared.map(item => {
          let baseAfterStep1 = item.rawBase;
          let redistStep1 = 0;

          if (shouldRedistribute) {
            if (item.tier === 'zero') {
              baseAfterStep1 = 0;
            } else if (zeroItems.length > 0 && item.rawBase > 0) {
              if (mode === 'equal' && ge90Items.length > 0) {
                baseAfterStep1 = round2(effectiveGroupPool / ge90Items.length);
                redistStep1 = Math.max(0, round2(baseAfterStep1 - item.rawBase));
              } else if (retainedStep1 > 0.005 && sumGe90Base > 0) {
                redistStep1 = round2(retainedStep1 * (item.rawBase / sumGe90Base));
                baseAfterStep1 = round2(item.rawBase + redistStep1);
              }
            }
          } else if (item.tier === 'zero') {
            baseAfterStep1 = item.rawBase;
          }

          return { ...item, baseAfterStep1, redistStep1 };
        });

        // Etapa 2: membros 90%-99% ('partial') recebem rightPct% (ex.: 75%) da cota pós-Etapa 1;
        // a diferença retida (ex.: 25%) é redistribuída EXCLUSIVAMENTE entre os membros com 100% ('full').
        let retainedStep2 = 0;
        const afterFactorItems = step1Items.map(item => {
          const afterFactor = round2(item.baseAfterStep1 * (item.factorPct / 100));
          if (item.tier === 'partial') {
            const ret = Math.max(0, round2(item.baseAfterStep1 - afterFactor));
            retainedStep2 = round2(retainedStep2 + ret);
          }
          return { ...item, afterFactor, redistStep2: 0 };
        });

        if (shouldRedistribute && retainedStep2 > 0.005) {
          const fullItems = afterFactorItems.filter(it => it.tier === 'full' && it.baseAfterStep1 > 0);
          const sumFullBase = round2(fullItems.reduce((acc, it) => acc + it.baseAfterStep1, 0));
          if (sumFullBase > 0) {
            fullItems.forEach(it => {
              it.redistStep2 = round2(retainedStep2 * (it.baseAfterStep1 / sumFullBase));
            });
          }
        }

        let redistributedAmount = 0;
        let groupAllocated = 0;
        afterFactorItems.forEach(item => {
          const finalShare = round2(item.afterFactor + item.redistStep2);
          groupAllocated = round2(groupAllocated + finalShare);

          let redistBonus = 0;
          if (shouldRedistribute) {
            if (item.tier === 'full') {
              redistBonus = round2(item.redistStep1 + item.redistStep2);
            } else if (item.tier === 'partial') {
              const directRight = round2(item.rawBase * (item.factorPct / 100));
              redistBonus = Math.max(0, round2(finalShare - directRight));
            }
          }
          redistributedAmount = round2(redistributedAmount + redistBonus);

          const nominalPct =
            mode === 'equal'
              ? (eligibleMembers.length > 0 ? round2(100 / eligibleMembers.length) : 0)
              : mode === 'percentage'
                ? round2(Math.max(0, Number(item.member.percentage || 0)))
                : (effectiveGroupPool > 0 ? round2((item.rawBase / effectiveGroupPool) * 100) : 0);

          const sharePct =
            (redistBonus > 0 || item.factorPct < 100) && effectiveGroupPool > 0
              ? round2((finalShare / effectiveGroupPool) * 100)
              : nominalPct;

          memberAssignment.set(item.member.employeeId, {
            groupId: group.id,
            groupName: groupNameTrimmed,
            isEligibleInGroup: true,
            baseShare: item.rawBase,
            shareAmount: finalShare,
            sharePct,
            scorePct: item.scorePct,
            effectiveFactorPct: item.factorPct,
            redistributedBonus: redistBonus,
          });
        });

        ineligibleMembers.forEach(m => {
          memberAssignment.set(m.employeeId, {
            groupId: group.id,
            groupName: groupNameTrimmed,
            isEligibleInGroup: false,
            baseShare: 0,
            shareAmount: 0,
            sharePct: 0,
            scorePct: 0,
            effectiveFactorPct: 0,
            redistributedBonus: 0,
          });
        });

        const groupResidual = Math.max(0, round2(effectiveGroupPool - groupAllocated));
        dedicatedGroupsTotalPool = round2(dedicatedGroupsTotalPool + effectiveGroupPool);
        dedicatedGroupsAllocatedTotal = round2(dedicatedGroupsAllocatedTotal + groupAllocated);
        dedicatedMembersCount += eligibleMembers.length;
        if (group.fundingSource === 'extra_bonus') {
          dedicatedGroupsExtraBonusTotal = round2(dedicatedGroupsExtraBonusTotal + effectiveGroupPool);
        }

        dedicatedGroupSummaries.push({
          groupId: group.id,
          name: groupNameTrimmed,
          criteriaDescription: (group.criteriaDescription || '').trim() || undefined,
          fundingSource: group.fundingSource || 'total_pool',
          distributionMode: mode,
          poolAmount: effectiveGroupPool,
          allocatedTotal: groupAllocated,
          memberCount: eligibleMembers.length,
          eligibleMemberCount: eligibleMembers.length,
          ineligibleMemberCount: ineligibleMembers.length,
          amountPerEligible: eligibleMembers.length > 0 ? round2(groupAllocated / eligibleMembers.length) : 0,
          eligibilityPolicy,
          applyPerformanceFactor: applyPerf,
          reducedFactorPct,
          redistributePerformanceResidual: shouldRedistribute,
          redistributedAmount,
          residualAmount: groupResidual,
        });
      });
    }

    // 2. Contagem de Elegíveis das Camadas Padrão (excluindo membros de Grupos Dedicados — Regra Exclusiva)
    const layerEligibleCounts: Record<BprCamada, number> = { E: 0, T: 0, O: 0 };
    const layerIneligibleCounts: Record<BprCamada, number> = { E: 0, T: 0, O: 0 };
    const additionalByOwnLayer: Record<BprCamada, number> = { E: 0, T: 0, O: 0 };
    const additionalMap = config.additionalAmounts || {};
    let totalAdditionalAmount = 0;

    candidates.forEach(c => {
      const dedicated = memberAssignment.get(c.employeeId);
      if (dedicated) {
        if (dedicated.isEligibleInGroup) {
          // Membro elegível em grupo dedicado recebe exclusivamente pelo grupo (não entra no divisor E/T/O)
          const addVal = Math.max(0, round2(Number(additionalMap[c.employeeId] || 0)));
          additionalByOwnLayer[c.camada] = round2(additionalByOwnLayer[c.camada] + addVal);
          totalAdditionalAmount = round2(totalAdditionalAmount + addVal);
        } else {
          // Membro inelegível pela regra do BPR dentro do grupo: não entra no divisor nem recebe adicionais
          layerIneligibleCounts[c.camada] = (layerIneligibleCounts[c.camada] || 0) + 1;
        }
      } else if (c.isEligible) {
        layerEligibleCounts[c.camada] = (layerEligibleCounts[c.camada] || 0) + 1;
        const addVal = Math.max(0, round2(Number(additionalMap[c.employeeId] || 0)));
        additionalByOwnLayer[c.camada] = round2(additionalByOwnLayer[c.camada] + addVal);
        totalAdditionalAmount = round2(totalAdditionalAmount + addVal);
      } else {
        layerIneligibleCounts[c.camada] = (layerIneligibleCounts[c.camada] || 0) + 1;
      }
    });

    // 3. Rateio Bruto por Camada (Porcentagem ou Valor Fixo R$)
    const isAmountMode = config.splitMode === 'amount' && !!config.tierAmounts;
    const gross: Record<BprCamada, number> = isAmountMode
      ? {
        E: Math.max(0, Number(config.tierAmounts?.E || 0)),
        T: Math.max(0, Number(config.tierAmounts?.T || 0)),
        O: Math.max(0, Number(config.tierAmounts?.O || 0)),
      }
      : {
        E: Math.max(0, (Math.max(0, Number(config.totalPoolAmount || 0)) * (config.tierSplits.E || 0)) / 100),
        T: Math.max(0, (Math.max(0, Number(config.totalPoolAmount || 0)) * (config.tierSplits.T || 0)) / 100),
        O: Math.max(0, (Math.max(0, Number(config.totalPoolAmount || 0)) * (config.tierSplits.O || 0)) / 100),
      };

    const grossLayersSum = round2(gross.E + gross.T + gross.O);
    const basePoolAmount = isAmountMode
      ? Math.max(grossLayersSum, round2(config.totalPoolAmount || 0))
      : Math.max(0, round2(config.totalPoolAmount || 0));

    // 4. Abatimento de Grupos Dedicados e Valores Adicionais sobre as Camadas E/T/O
    const source = config.additionalDeductionSource || 'total_pool';
    const isExtraBonusMode = source === 'extra_bonus';
    const extraBonusAmount = isExtraBonusMode ? totalAdditionalAmount : 0;
    const effectiveTotalPool = round2(basePoolAmount + extraBonusAmount + dedicatedGroupsExtraBonusTotal);

    // Quanto o usuário já reduziu manualmente nos níveis abaixo do montante base
    let remainingManualReduction = Math.max(0, round2(basePoolAmount - grossLayersSum));
    const cap: Record<BprCamada, number> = { E: gross.E, T: gross.T, O: gross.O };
    const deductDedicated: Record<BprCamada, number> = { E: 0, T: 0, O: 0 };
    const deductAdditional: Record<BprCamada, number> = { E: 0, T: 0, O: 0 };

    const deductFromTargetLayerWithOverflow = (
      target: BprCamada,
      amount: number,
      ledger: Record<BprCamada, number>
    ) => {
      if (amount <= 0) return;
      const direct = Math.min(cap[target], amount);
      cap[target] = Math.max(0, cap[target] - direct);
      ledger[target] += direct;
      const overflow = amount - direct;
      if (overflow > 0.005) {
        const otherKeys: BprCamada[] = (['E', 'T', 'O'] as BprCamada[]).filter(k => k !== target);
        const otherSum = otherKeys.reduce((acc, k) => acc + cap[k], 0);
        if (otherSum > 0) {
          otherKeys.forEach(k => {
            const share = Math.min(cap[k], overflow * (cap[k] / otherSum));
            cap[k] = Math.max(0, cap[k] - share);
            ledger[k] += share;
          });
        }
      }
    };

    const deductProportionallyFromCaps = (
      amount: number,
      ledger: Record<BprCamada, number>,
      useManualReductionHeadroom: boolean
    ) => {
      if (amount <= 0) return;
      let rem = amount;
      if (useManualReductionHeadroom && remainingManualReduction > 0) {
        const consumed = Math.min(remainingManualReduction, rem);
        remainingManualReduction = Math.max(0, round2(remainingManualReduction - consumed));
        rem = Math.max(0, rem - consumed);
      }
      if (rem <= 0.005) return;
      const totalCap = cap.E + cap.T + cap.O;
      if (totalCap > 0) {
        (['E', 'T', 'O'] as BprCamada[]).forEach(k => {
          const share = Math.min(cap[k], rem * (cap[k] / totalCap));
          cap[k] = Math.max(0, cap[k] - share);
          ledger[k] += share;
        });
      }
    };

    // 4a. Abatimento dos Grupos Dedicados (primeiro os vinculados a camada específica E/T/O, depois total_pool)
    dedicatedGroupSummaries.forEach(gs => {
      if (gs.fundingSource === 'E' || gs.fundingSource === 'T' || gs.fundingSource === 'O') {
        deductFromTargetLayerWithOverflow(gs.fundingSource, gs.poolAmount, deductDedicated);
      }
    });
    dedicatedGroupSummaries.forEach(gs => {
      if (gs.fundingSource === 'total_pool') {
        deductProportionallyFromCaps(gs.poolAmount, deductDedicated, true);
      }
    });

    // 4b. Abatimento dos Valores Adicionais Individuais (total_pool | own_layer | E | T | O | extra_bonus)
    if (!isExtraBonusMode && totalAdditionalAmount > 0 && (cap.E + cap.T + cap.O) > 0) {
      const consumedManual = Math.min(remainingManualReduction, totalAdditionalAmount);
      remainingManualReduction = Math.max(0, round2(remainingManualReduction - consumedManual));
      const remainingToDeduct = Math.max(0, round2(totalAdditionalAmount - consumedManual));

      if (remainingToDeduct > 0) {
        if (source === 'E' || source === 'T' || source === 'O') {
          deductFromTargetLayerWithOverflow(source, remainingToDeduct, deductAdditional);
        } else if (source === 'own_layer') {
          const scale = totalAdditionalAmount > 0 ? remainingToDeduct / totalAdditionalAmount : 0;
          let overflow = 0;
          (['E', 'T', 'O'] as BprCamada[]).forEach(k => {
            const wanted = additionalByOwnLayer[k] * scale;
            const clamped = Math.min(cap[k], wanted);
            cap[k] = Math.max(0, cap[k] - clamped);
            deductAdditional[k] += clamped;
            overflow += wanted - clamped;
          });
          if (overflow > 0.005) {
            const remainingCap = cap.E + cap.T + cap.O;
            if (remainingCap > 0) {
              (['E', 'T', 'O'] as BprCamada[]).forEach(k => {
                const share = Math.min(cap[k], overflow * (cap[k] / remainingCap));
                cap[k] = Math.max(0, cap[k] - share);
                deductAdditional[k] += share;
              });
            }
          }
        } else {
          // Padrão ('total_pool'): descontado proporcionalmente do saldo restante entre os níveis
          deductProportionallyFromCaps(remainingToDeduct, deductAdditional, false);
        }
      }
    }

    const deductDedicatedRounded: Record<BprCamada, number> = {
      E: round2(deductDedicated.E),
      T: round2(deductDedicated.T),
      O: round2(deductDedicated.O),
    };

    const net: Record<BprCamada, number> = {
      E: Math.max(0, round2(gross.E - deductDedicated.E - deductAdditional.E)),
      T: Math.max(0, round2(gross.T - deductDedicated.T - deductAdditional.T)),
      O: Math.max(0, round2(gross.O - deductDedicated.O - deductAdditional.O)),
    };

    const deductAdditionalRounded: Record<BprCamada, number> = {
      E: Math.max(0, round2(gross.E - deductDedicatedRounded.E - net.E)),
      T: Math.max(0, round2(gross.T - deductDedicatedRounded.T - net.T)),
      O: Math.max(0, round2(gross.O - deductDedicatedRounded.O - net.O)),
    };

    const layerPctE = isAmountMode ? (basePoolAmount > 0 ? Number(((gross.E / basePoolAmount) * 100).toFixed(1)) : 0) : config.tierSplits.E;
    const layerPctT = isAmountMode ? (basePoolAmount > 0 ? Number(((gross.T / basePoolAmount) * 100).toFixed(1)) : 0) : config.tierSplits.T;
    const layerPctO = isAmountMode ? (basePoolAmount > 0 ? Number(((gross.O / basePoolAmount) * 100).toFixed(1)) : 0) : config.tierSplits.O;

    const layers: Record<BprCamada, BprLayerSummary> = {
      E: {
        camada: 'E',
        label: 'Estratégico',
        allocatedPercentage: layerPctE,
        totalLayerAmount: net.E,
        grossLayerAmount: round2(gross.E),
        dedicatedGroupsDeductedFromLayer: deductDedicatedRounded.E,
        additionalDeductedFromLayer: deductAdditionalRounded.E,
        eligibleCount: layerEligibleCounts.E,
        ineligibleCount: layerIneligibleCounts.E,
        amountPerEligible: layerEligibleCounts.E > 0
          ? round2(net.E / layerEligibleCounts.E)
          : 0
      },
      T: {
        camada: 'T',
        label: 'Tático',
        allocatedPercentage: layerPctT,
        totalLayerAmount: net.T,
        grossLayerAmount: round2(gross.T),
        dedicatedGroupsDeductedFromLayer: deductDedicatedRounded.T,
        additionalDeductedFromLayer: deductAdditionalRounded.T,
        eligibleCount: layerEligibleCounts.T,
        ineligibleCount: layerIneligibleCounts.T,
        amountPerEligible: layerEligibleCounts.T > 0
          ? round2(net.T / layerEligibleCounts.T)
          : 0
      },
      O: {
        camada: 'O',
        label: 'Operacional/CLTs',
        allocatedPercentage: layerPctO,
        totalLayerAmount: net.O,
        grossLayerAmount: round2(gross.O),
        dedicatedGroupsDeductedFromLayer: deductDedicatedRounded.O,
        additionalDeductedFromLayer: deductAdditionalRounded.O,
        eligibleCount: layerEligibleCounts.O,
        ineligibleCount: layerIneligibleCounts.O,
        amountPerEligible: layerEligibleCounts.O > 0
          ? round2(net.O / layerEligibleCounts.O)
          : 0
      }
    };

    // 5. Atribuição Individual (grupo dedicado exclusivo OU rateio da camada * desempenho + valor adicional) e comparativo histórico
    let totalDistributed = 0;
    let totalPeriodReceivedAmount = 0;
    const reasonsMap = config.additionalReasons || {};
    const updatedCandidates: BprCandidateResult[] = candidates.map(c => {
      const periodTotal = round2(c.periodReceivedTotal || 0);
      const periodAvg = round2(c.periodReceivedAverage || 0);
      const periodMonths = c.periodMonthsCount || 0;
      const dedicated = memberAssignment.get(c.employeeId);

      if (dedicated) {
        if (!dedicated.isEligibleInGroup) {
          return {
            ...c,
            isEligible: false,
            dedicatedGroupId: dedicated.groupId,
            dedicatedGroupName: dedicated.groupName,
            dedicatedGroupSharePct: 0,
            dedicatedGroupScorePct: 0,
            dedicatedGroupEffectiveFactorPct: 0,
            dedicatedGroupRedistributedBonus: 0,
            baseAmount: 0,
            rateioAmount: 0,
            additionalAmount: 0,
            additionalReason: undefined,
            allocatedAmount: 0,
            periodReceivedTotal: periodTotal,
            periodReceivedAverage: periodAvg,
            periodMonthsCount: periodMonths,
            bprVsAveragePct: 0,
            bprVsTotalPct: 0
          };
        }

        const wasIneligible = !c.isEligible;
        const baseVal = dedicated.baseShare;
        const rateioVal = dedicated.shareAmount;
        const addVal = Math.max(0, round2(Number(additionalMap[c.employeeId] || 0)));
        const addReason = addVal > 0 ? ((reasonsMap[c.employeeId] || '').trim() || undefined) : undefined;
        const finalVal = round2(rateioVal + addVal);
        const bprVsAveragePct = periodAvg > 0 ? Number(((finalVal / periodAvg) * 100).toFixed(1)) : 0;
        const bprVsTotalPct = periodTotal > 0 ? Number(((finalVal / periodTotal) * 100).toFixed(1)) : 0;

        totalDistributed += finalVal;
        totalPeriodReceivedAmount += periodTotal;
        return {
          ...c,
          isEligible: true,
          isExceptionApplied: c.isExceptionApplied || wasIneligible,
          dedicatedGroupId: dedicated.groupId,
          dedicatedGroupName: dedicated.groupName,
          dedicatedGroupSharePct: dedicated.sharePct,
          dedicatedGroupScorePct: dedicated.scorePct,
          dedicatedGroupEffectiveFactorPct: dedicated.effectiveFactorPct,
          dedicatedGroupRedistributedBonus: dedicated.redistributedBonus,
          baseAmount: baseVal,
          rateioAmount: rateioVal,
          additionalAmount: addVal,
          additionalReason: addReason,
          allocatedAmount: finalVal,
          periodReceivedTotal: periodTotal,
          periodReceivedAverage: periodAvg,
          periodMonthsCount: periodMonths,
          bprVsAveragePct,
          bprVsTotalPct
        };
      }

      if (c.isEligible) {
        const baseVal = layers[c.camada]?.amountPerEligible || 0;
        const rateioVal = round2(baseVal * (c.performanceFactor ?? 1.0));
        const addVal = Math.max(0, round2(Number(additionalMap[c.employeeId] || 0)));
        const addReason = addVal > 0 ? ((reasonsMap[c.employeeId] || '').trim() || undefined) : undefined;
        const finalVal = round2(rateioVal + addVal);
        const bprVsAveragePct = periodAvg > 0 ? Number(((finalVal / periodAvg) * 100).toFixed(1)) : 0;
        const bprVsTotalPct = periodTotal > 0 ? Number(((finalVal / periodTotal) * 100).toFixed(1)) : 0;

        totalDistributed += finalVal;
        totalPeriodReceivedAmount += periodTotal;
        return {
          ...c,
          dedicatedGroupId: undefined,
          dedicatedGroupName: undefined,
          dedicatedGroupSharePct: undefined,
          dedicatedGroupScorePct: undefined,
          dedicatedGroupEffectiveFactorPct: undefined,
          dedicatedGroupRedistributedBonus: undefined,
          baseAmount: baseVal,
          rateioAmount: rateioVal,
          additionalAmount: addVal,
          additionalReason: addReason,
          allocatedAmount: finalVal,
          periodReceivedTotal: periodTotal,
          periodReceivedAverage: periodAvg,
          periodMonthsCount: periodMonths,
          bprVsAveragePct,
          bprVsTotalPct
        };
      }

      return {
        ...c,
        dedicatedGroupId: undefined,
        dedicatedGroupName: undefined,
        dedicatedGroupSharePct: undefined,
        dedicatedGroupScorePct: undefined,
        dedicatedGroupEffectiveFactorPct: undefined,
        dedicatedGroupRedistributedBonus: undefined,
        baseAmount: 0,
        rateioAmount: 0,
        additionalAmount: 0,
        additionalReason: undefined,
        allocatedAmount: 0,
        periodReceivedTotal: periodTotal,
        periodReceivedAverage: periodAvg,
        periodMonthsCount: periodMonths,
        bprVsAveragePct: 0,
        bprVsTotalPct: 0
      };
    });

    // Peso Relativo do BPR sobre a Folha/Recebimentos Médios de cada Camada (E, T, O e Geral)
    const relativeWeights = this.computeLayerRelativeWeights(updatedCandidates);
    (['E', 'T', 'O'] as BprCamada[]).forEach(k => {
      layers[k].eligibleWithHistoryCount = relativeWeights[k].eligibleWithHistoryCount;
      layers[k].monthlyAverageBase = relativeWeights[k].monthlyAverageBase;
      layers[k].bprVsMonthlyAvgPct = relativeWeights[k].bprVsMonthlyAvgPct;
      layers[k].bprMultipleOfMonthlyAvg = relativeWeights[k].bprMultipleOfMonthlyAvg;
      layers[k].bprVsPeriodTotalPct = relativeWeights[k].bprVsPeriodTotalPct;
    });

    const netPoolForLayers = round2(net.E + net.T + net.O);
    const totalDistributedRounded = round2(totalDistributed);
    const totalPeriodReceivedRounded = round2(totalPeriodReceivedAmount);
    const residualAmount = Math.max(0, round2(effectiveTotalPool - totalDistributedRounded));

    return {
      totalPoolAmount: effectiveTotalPool,
      basePoolAmount,
      extraBonusAmount,
      totalAdditionalAmount,
      netPoolForLayers,
      totalPeriodReceivedAmount: totalPeriodReceivedRounded,
      overallRelativeWeight: relativeWeights.overall,
      dedicatedGroupsTotalPool,
      dedicatedGroupsAllocatedTotal,
      dedicatedGroupsExtraBonusTotal,
      dedicatedGroupsCount: dedicatedGroupSummaries.length,
      dedicatedMembersCount,
      dedicatedGroupSummaries,
      totalDistributedAmount: totalDistributedRounded,
      residualAmount,
      totalCandidates: updatedCandidates.length,
      totalEligible: layerEligibleCounts.E + layerEligibleCounts.T + layerEligibleCounts.O + dedicatedMembersCount,
      totalIneligible: layerIneligibleCounts.E + layerIneligibleCounts.T + layerIneligibleCounts.O,
      layers,
      candidates: updatedCandidates,
      glosadosCandidates: glosadosCandidatesArg || updatedCandidates.filter(c => c.hasGlosaInPeriod),
      inativosCandidates: inativosCandidatesArg || updatedCandidates.filter(c => c.isInactiveAtPaymentDate)
    };
  }

  /**
   * Simulador de Meta por Múltiplo Salarial / Honorários Mensais por Camada (ex: E=2.0x, T=1.5x, O=1.0x).
   * Calcula o montante exato por camada e o montante total necessário para atingir os múltiplos alvo.
   */
  static simulatePoolFromTargetMultiples(
    candidates: BprCandidateResult[],
    targetMultiples: Record<BprCamada, number>
  ): BprTargetMultipleSimulation {
    const labelMap: Record<BprCamada, string> = {
      E: 'Estratégico',
      T: 'Tático',
      O: 'Operacional/CLTs',
    };

    const rawLayers: Record<BprCamada, Omit<BprTargetMultipleLayerProjection, 'equivalentPercentage'>> = {
      E: { camada: 'E', label: labelMap.E, targetMultiple: 0, eligibleCount: 0, eligibleWithHistoryCount: 0, monthlyAverageBase: 0, requiredAmountPerEligible: 0, requiredLayerAmount: 0 },
      T: { camada: 'T', label: labelMap.T, targetMultiple: 0, eligibleCount: 0, eligibleWithHistoryCount: 0, monthlyAverageBase: 0, requiredAmountPerEligible: 0, requiredLayerAmount: 0 },
      O: { camada: 'O', label: labelMap.O, targetMultiple: 0, eligibleCount: 0, eligibleWithHistoryCount: 0, monthlyAverageBase: 0, requiredAmountPerEligible: 0, requiredLayerAmount: 0 },
    };

    (['E', 'T', 'O'] as BprCamada[]).forEach(k => {
      const targetMult = Math.max(0, Number(targetMultiples[k] || 0));
      let eligibleCount = 0;
      let eligibleWithHistoryCount = 0;
      let monthlyAverageBase = 0;
      let effWeightSum = 0;

      candidates.forEach(c => {
        if (!c.isEligible || c.camada !== k || c.dedicatedGroupId) return;
        eligibleCount += 1;
        const avg = Number(c.periodReceivedAverage || 0);
        if (avg > 0) {
          eligibleWithHistoryCount += 1;
          monthlyAverageBase += avg;
          effWeightSum += (c.performanceFactor ?? 1.0);
        }
      });

      const monthlyAvgRounded = Number(monthlyAverageBase.toFixed(2));
      const requiredAmountPerEligible = (eligibleWithHistoryCount > 0 && effWeightSum > 0 && targetMult > 0)
        ? Number(((targetMult * monthlyAvgRounded) / effWeightSum).toFixed(2))
        : 0;
      const requiredLayerAmount = Number((requiredAmountPerEligible * eligibleCount).toFixed(2));

      rawLayers[k] = {
        camada: k,
        label: labelMap[k],
        targetMultiple: targetMult,
        eligibleCount,
        eligibleWithHistoryCount,
        monthlyAverageBase: monthlyAvgRounded,
        requiredAmountPerEligible,
        requiredLayerAmount,
      };
    });

    const totalRequiredPool = Number(
      (rawLayers.E.requiredLayerAmount + rawLayers.T.requiredLayerAmount + rawLayers.O.requiredLayerAmount).toFixed(2)
    );

    const pcts: Record<BprCamada, number> = { E: 0, T: 0, O: 0 };
    if (totalRequiredPool > 0) {
      pcts.E = Math.round((rawLayers.E.requiredLayerAmount / totalRequiredPool) * 100);
      pcts.T = Math.round((rawLayers.T.requiredLayerAmount / totalRequiredPool) * 100);
      pcts.O = Math.round((rawLayers.O.requiredLayerAmount / totalRequiredPool) * 100);
      const sumPct = pcts.E + pcts.T + pcts.O;
      if (sumPct !== 100) {
        const sortedKeys = (['E', 'T', 'O'] as BprCamada[]).sort(
          (a, b) => rawLayers[b].requiredLayerAmount - rawLayers[a].requiredLayerAmount
        );
        pcts[sortedKeys[0]] += (100 - sumPct);
      }
    }

    const layers: Record<BprCamada, BprTargetMultipleLayerProjection> = {
      E: { ...rawLayers.E, equivalentPercentage: pcts.E },
      T: { ...rawLayers.T, equivalentPercentage: pcts.T },
      O: { ...rawLayers.O, equivalentPercentage: pcts.O },
    };

    const hasAnyHistory =
      rawLayers.E.eligibleWithHistoryCount > 0 ||
      rawLayers.T.eligibleWithHistoryCount > 0 ||
      rawLayers.O.eligibleWithHistoryCount > 0;

    return {
      totalRequiredPool,
      layers,
      hasAnyHistory,
    };
  }

  /**
   * Calcula de forma pura e auditável o peso relativo do BPR sobre os recebimentos médios mensais
   * e montante do período para cada camada (E, T, O) e no consolidado geral.
   * Considera no numerador e denominador estritamente os elegíveis com histórico > 0 (evita distorção de múltiplos).
   */
  static computeLayerRelativeWeights(
    candidates: BprCandidateResult[]
  ): {
    E: BprLayerRelativeWeight;
    T: BprLayerRelativeWeight;
    O: BprLayerRelativeWeight;
    overall: BprLayerRelativeWeight;
  } {
    const buildWeight = (list: BprCandidateResult[]): BprLayerRelativeWeight => {
      let eligibleCount = 0;
      let eligibleWithHistoryCount = 0;
      let monthlyAverageBase = 0;
      let periodTotalBase = 0;
      let bprAllocatedBase = 0;

      list.forEach(c => {
        if (!c.isEligible) return;
        eligibleCount += 1;
        const avg = Number(c.periodReceivedAverage || 0);
        const tot = Number(c.periodReceivedTotal || 0);
        if (avg > 0) {
          eligibleWithHistoryCount += 1;
          monthlyAverageBase += avg;
          periodTotalBase += tot;
          bprAllocatedBase += Number(c.allocatedAmount || 0);
        }
      });

      const monthlyAvgRounded = Number(monthlyAverageBase.toFixed(2));
      const periodTotalRounded = Number(periodTotalBase.toFixed(2));
      const bprAllocatedRounded = Number(bprAllocatedBase.toFixed(2));

      const bprVsMonthlyAvgPct = monthlyAvgRounded > 0
        ? Number(((bprAllocatedRounded / monthlyAvgRounded) * 100).toFixed(1))
        : 0;
      const bprMultipleOfMonthlyAvg = monthlyAvgRounded > 0
        ? Number((bprAllocatedRounded / monthlyAvgRounded).toFixed(2))
        : 0;
      const bprVsPeriodTotalPct = periodTotalRounded > 0
        ? Number(((bprAllocatedRounded / periodTotalRounded) * 100).toFixed(1))
        : 0;

      return {
        eligibleWithHistoryCount,
        eligibleCount,
        monthlyAverageBase: monthlyAvgRounded,
        periodTotalBase: periodTotalRounded,
        bprAllocatedBase: bprAllocatedRounded,
        bprVsMonthlyAvgPct,
        bprMultipleOfMonthlyAvg,
        bprVsPeriodTotalPct
      };
    };

    return {
      E: buildWeight(candidates.filter(c => c.camada === 'E' && !c.dedicatedGroupId)),
      T: buildWeight(candidates.filter(c => c.camada === 'T' && !c.dedicatedGroupId)),
      O: buildWeight(candidates.filter(c => c.camada === 'O' && !c.dedicatedGroupId)),
      overall: buildWeight(candidates)
    };
  }

  /**
   * Recalcula a distribuição financeira de um snapshot congelado com base em nova configuração de rateio.
   * Preserva rigorosamente a lista de colaboradores, status de elegibilidade e fatores de desempenho originais.
   */
  static recalculateSnapshotWithNewConfig(
    candidatesSnapshot: BprCandidateResult[],
    newConfig: BprRuleConfig
  ): BprCalculationSummary {
    return this.computeLayersAndAdditionalDistribution(candidatesSnapshot, newConfig);
  }

  private static buildImpactPreviewFromSummaries(
    beforeSummary: BprCalculationSummary,
    afterSummary: BprCalculationSummary,
    targetGroup: BprDedicatedGroup | undefined,
    targetGroupId: string
  ): BprDedicatedGroupImpactPreview {
    const round2 = (v: number) => Number(v.toFixed(2));
    const groupSummary = (afterSummary.dedicatedGroupSummaries || []).find(s => s.groupId === targetGroupId) || null;
    const fundingSource = targetGroup?.fundingSource || groupSummary?.fundingSource || 'total_pool';
    const targetPoolNeeded = groupSummary?.poolAmount ?? Math.max(0, round2(Number(targetGroup?.poolAmount || 0)));

    const extractLayers = (summ: BprCalculationSummary) => ({
      E: {
        totalLayerAmount: summ.layers.E.totalLayerAmount,
        eligibleCount: summ.layers.E.eligibleCount,
        amountPerEligible: summ.layers.E.amountPerEligible,
      },
      T: {
        totalLayerAmount: summ.layers.T.totalLayerAmount,
        eligibleCount: summ.layers.T.eligibleCount,
        amountPerEligible: summ.layers.T.amountPerEligible,
      },
      O: {
        totalLayerAmount: summ.layers.O.totalLayerAmount,
        eligibleCount: summ.layers.O.eligibleCount,
        amountPerEligible: summ.layers.O.amountPerEligible,
      },
    });

    const isSpecificLayer = fundingSource === 'E' || fundingSource === 'T' || fundingSource === 'O';
    const layerBeforeAmount = isSpecificLayer
      ? beforeSummary.layers[fundingSource].totalLayerAmount
      : beforeSummary.totalPoolAmount;
    const hasFundingOverflow = isSpecificLayer && targetPoolNeeded > layerBeforeAmount + 0.005;
    const overflowAmount = hasFundingOverflow ? round2(targetPoolNeeded - layerBeforeAmount) : 0;

    return {
      groupSummary,
      fundingSource,
      beforeLayers: extractLayers(beforeSummary),
      afterLayers: extractLayers(afterSummary),
      hasFundingOverflow,
      overflowAmount,
      baseTotalPool: beforeSummary.totalPoolAmount,
      afterTotalPool: afterSummary.totalPoolAmount,
    };
  }

  /**
   * Simula de forma pura o impacto Antes x Depois de um grupo dedicado diretamente sobre uma lista de candidatos
   */
  static previewDedicatedGroupImpactFromCandidates(
    rawCandidates: BprCandidateResult[],
    config: BprRuleConfig,
    targetGroupId: string
  ): BprDedicatedGroupImpactPreview {
    const targetGroup = (config.dedicatedGroups || []).find(g => g.id === targetGroupId);
    const beforeConfig: BprRuleConfig = {
      ...config,
      dedicatedGroups: (config.dedicatedGroups || []).filter(g => g.id !== targetGroupId),
    };
    const afterConfig: BprRuleConfig = {
      ...config,
      allowDedicatedGroups: true,
      dedicatedGroups: (config.dedicatedGroups || []).map(g =>
        g.id === targetGroupId ? { ...g, enabled: true } : g
      ),
    };
    const beforeSummary = this.computeLayersAndAdditionalDistribution(rawCandidates, beforeConfig);
    const afterSummary = this.computeLayersAndAdditionalDistribution(rawCandidates, afterConfig);
    return this.buildImpactPreviewFromSummaries(beforeSummary, afterSummary, targetGroup, targetGroupId);
  }

  /**
   * Simula de forma pura o impacto Antes x Depois de um grupo de montante específico sobre as camadas e colaboradores
   */
  static previewDedicatedGroupImpact(
    employees: Employee[],
    monthlyCosts: MonthlyCost[] = [],
    config: BprRuleConfig,
    targetGroupId: string
  ): BprDedicatedGroupImpactPreview {
    const targetGroup = (config.dedicatedGroups || []).find(g => g.id === targetGroupId);
    const beforeConfig: BprRuleConfig = {
      ...config,
      dedicatedGroups: (config.dedicatedGroups || []).filter(g => g.id !== targetGroupId),
    };
    const afterConfig: BprRuleConfig = {
      ...config,
      allowDedicatedGroups: true,
      dedicatedGroups: (config.dedicatedGroups || []).map(g =>
        g.id === targetGroupId ? { ...g, enabled: true } : g
      ),
    };
    const beforeSummary = this.calculateBpr(employees, monthlyCosts, beforeConfig);
    const afterSummary = this.calculateBpr(employees, monthlyCosts, afterConfig);
    return this.buildImpactPreviewFromSummaries(beforeSummary, afterSummary, targetGroup, targetGroupId);
  }

  /**
   * Clona um cenário existente gerando uma nova variação incremental com snapshot histórico recalculado.
   */
  static createClonedScenario(
    baseScenario: BprSavedScenario,
    params: {
      name: string;
      studyDate: string;
      criteriaDescription: string;
      newConfig: BprRuleConfig;
    },
    allEmployeesFallback: Employee[] = [],
    monthlyCostsFallback: MonthlyCost[] = []
  ): BprSavedScenario {
    let recalculated: BprCalculationSummary;
    if (baseScenario.candidatesSnapshot && baseScenario.candidatesSnapshot.length > 0) {
      recalculated = this.recalculateSnapshotWithNewConfig(
        baseScenario.candidatesSnapshot,
        params.newConfig
      );
    } else {
      recalculated = this.calculateBpr(
        allEmployeesFallback,
        monthlyCostsFallback,
        params.newConfig
      );
    }

    return {
      id: `bpr-scen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: params.name.trim(),
      studyDate: params.studyDate,
      criteriaDescription: params.criteriaDescription.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: params.newConfig,
      summary: {
        totalPoolAmount: recalculated.totalPoolAmount,
        basePoolAmount: recalculated.basePoolAmount,
        extraBonusAmount: recalculated.extraBonusAmount,
        totalAdditionalAmount: recalculated.totalAdditionalAmount,
        netPoolForLayers: recalculated.netPoolForLayers,
        totalPeriodReceivedAmount: recalculated.totalPeriodReceivedAmount,
        overallRelativeWeight: recalculated.overallRelativeWeight,
        dedicatedGroupsTotalPool: recalculated.dedicatedGroupsTotalPool,
        dedicatedGroupsAllocatedTotal: recalculated.dedicatedGroupsAllocatedTotal,
        dedicatedGroupsExtraBonusTotal: recalculated.dedicatedGroupsExtraBonusTotal,
        dedicatedGroupsCount: recalculated.dedicatedGroupsCount,
        dedicatedMembersCount: recalculated.dedicatedMembersCount,
        dedicatedGroupSummaries: recalculated.dedicatedGroupSummaries,
        totalDistributedAmount: recalculated.totalDistributedAmount,
        residualAmount: recalculated.residualAmount,
        totalCandidates: recalculated.totalCandidates,
        totalEligible: recalculated.totalEligible,
        totalIneligible: recalculated.totalIneligible,
        amountPerE: recalculated.layers.E.amountPerEligible,
        amountPerT: recalculated.layers.T.amountPerEligible,
        amountPerO: recalculated.layers.O.amountPerEligible,
        layers: recalculated.layers
      },
      candidatesSnapshot: recalculated.candidates
    };
  }

  /**
   * Parser inteligente de regras a partir de texto / documento
   */
  static parseRulesFromText(text: string, currentConfig: BprRuleConfig): Partial<BprRuleConfig> {
    const patch: Partial<BprRuleConfig> = {};
    const cleanText = text.toLowerCase();

    // Detecção de Montante R$ (ex: "R$ 150.000,00" ou "150000")
    const montanteMatch = text.match(/R\$\s*([\d\.,]+)/i) || text.match(/montante\s*(?:total|de)?\s*(?:R\$)?\s*([\d\.,]+)/i);
    if (montanteMatch) {
      const rawNum = montanteMatch[1].replace(/\./g, '').replace(',', '.');
      const val = parseFloat(rawNum);
      if (!isNaN(val) && val > 0) patch.totalPoolAmount = val;
    }

    // Detecção de Ciclo / Período
    if (cleanText.includes('segundo semestre') || cleanText.includes('2º semestre') || cleanText.includes('março') || cleanText.includes('31/12')) {
      patch.cycle = 'ciclo_1';
    } else if (cleanText.includes('primeiro semestre') || cleanText.includes('1º semestre') || cleanText.includes('setembro') || cleanText.includes('30/06')) {
      patch.cycle = 'ciclo_2';
    }

    // Detecção de Percentuais das Camadas (E, T, O)
    const eMatch = text.match(/estrat[eé]gico[^\d%]*(\d+)\s*%/i) || text.match(/camada\s*e[^\d%]*(\d+)\s*%/i);
    const tMatch = text.match(/t[aá]tico[^\d%]*(\d+)\s*%/i) || text.match(/camada\s*t[^\d%]*(\d+)\s*%/i);
    const oMatch = text.match(/operacional[^\d%]*(\d+)\s*%/i) || text.match(/camada\s*o[^\d%]*(\d+)\s*%/i);

    const currentSplits = currentConfig.tierSplits;
    const newSplits = { ...currentSplits };

    if (eMatch) newSplits.E = parseInt(eMatch[1], 10);
    if (tMatch) newSplits.T = parseInt(tMatch[1], 10);
    if (oMatch) newSplits.O = parseInt(oMatch[1], 10);

    if (eMatch || tMatch || oMatch) {
      patch.tierSplits = newSplits;
    }

    // Detecção de Glosa / Inativos
    if (cleanText.includes('glosa') && (cleanText.includes('participam') || cleanText.includes('incluir') || cleanText.includes('farão jus'))) {
      patch.allowGlosados = true;
    }
    if (cleanText.includes('desligado') || cleanText.includes('inativo')) {
      if (cleanText.includes('incluir') || cleanText.includes('farão jus') || cleanText.includes('participam')) {
        patch.allowInativos = true;
      }
    }

    return patch;
  }

  /**
   * Salva a configuração atual no cache local
   */
  static saveConfig(config: BprRuleConfig): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(BPR_STORAGE_KEY, JSON.stringify(config));
    } catch { }
  }

  /**
   * Carrega a última configuração salva
   */
  static loadSavedConfig(): BprRuleConfig | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(BPR_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch { }
    return null;
  }

  /**
   * Salva um cenário de apuração no cache local
   */
  static saveScenario(scenario: BprSavedScenario): void {
    if (typeof window === 'undefined') return;
    try {
      const existing = this.loadSavedScenarios();
      const updated = [scenario, ...existing.filter(s => s.id !== scenario.id)].slice(0, 50);
      localStorage.setItem(BPR_SCENARIOS_STORAGE_KEY, JSON.stringify(updated));
    } catch { }
  }

  /**
   * Carrega a lista de cenários salvos
   */
  static loadSavedScenarios(): BprSavedScenario[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(BPR_SCENARIOS_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
      // Migração suave de histórico anterior se houver
      const legacyRuns = localStorage.getItem(BPR_RUNS_STORAGE_KEY);
      if (legacyRuns) {
        const parsed = JSON.parse(legacyRuns);
        return parsed.map((r: any) => ({
          id: r.id,
          name: r.name || 'Cenário Salvo',
          studyDate: r.createdAt ? r.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
          criteriaDescription: 'Critérios padrão do ciclo',
          createdAt: r.createdAt || new Date().toISOString(),
          config: r.config,
          summary: {
            ...r.summary,
            residualAmount: 0,
            totalCandidates: r.summary.totalEligible || 0,
            totalIneligible: 0,
            layers: {}
          },
          candidatesSnapshot: []
        }));
      }
    } catch { }
    return [];
  }

  /**
   * Remove um cenário salvo do cache local
   */
  static deleteScenario(id: string): void {
    if (typeof window === 'undefined') return;
    try {
      const existing = this.loadSavedScenarios();
      const updated = existing.filter(s => s.id !== id);
      localStorage.setItem(BPR_SCENARIOS_STORAGE_KEY, JSON.stringify(updated));
    } catch { }
  }

  /**
   * Salva um cenário de forma assíncrona (LocalStorage + Supabase __SYSTEM_GLOBAL_CONFIG__)
   */
  static async saveScenarioAsync(scenario: BprSavedScenario): Promise<void> {
    if (typeof window === 'undefined') return;

    // 1. Salvar no LocalStorage
    this.saveScenario(scenario);

    // 2. Persistir no Supabase no registro global __SYSTEM_GLOBAL_CONFIG__
    try {
      const { data } = await supabase
        .from('employees')
        .select('metadata')
        .eq('full_name', '__SYSTEM_GLOBAL_CONFIG__')
        .maybeSingle();

      const existingMetadata = data?.metadata || {};
      const currentScenarios: BprSavedScenario[] = existingMetadata.bpr_scenarios || existingMetadata.bpr_runs || [];
      const mergedScenarios = [scenario, ...currentScenarios.filter(s => s.id !== scenario.id)].slice(0, 50);

      await supabase
        .from('employees')
        .update({
          metadata: {
            ...existingMetadata,
            bpr_scenarios: mergedScenarios,
            bpr_runs: mergedScenarios, // compatibilidade
            last_bpr_scenario_update: new Date().toISOString()
          }
        })
        .eq('full_name', '__SYSTEM_GLOBAL_CONFIG__');
    } catch (e) {
      console.warn('Persistência Supabase BPR fallback para local', e);
    }
  }

  /**
   * Exclui um cenário de forma assíncrona (LocalStorage + Supabase)
   */
  static async deleteScenarioAsync(id: string): Promise<void> {
    if (typeof window === 'undefined') return;
    this.deleteScenario(id);

    try {
      const { data } = await supabase
        .from('employees')
        .select('metadata')
        .eq('full_name', '__SYSTEM_GLOBAL_CONFIG__')
        .maybeSingle();

      const existingMetadata = data?.metadata || {};
      const currentScenarios: BprSavedScenario[] = existingMetadata.bpr_scenarios || existingMetadata.bpr_runs || [];
      const filtered = currentScenarios.filter(s => s.id !== id);

      await supabase
        .from('employees')
        .update({
          metadata: {
            ...existingMetadata,
            bpr_scenarios: filtered,
            bpr_runs: filtered,
            last_bpr_scenario_update: new Date().toISOString()
          }
        })
        .eq('full_name', '__SYSTEM_GLOBAL_CONFIG__');
    } catch (e) {
      console.warn('Erro ao excluir cenário no Supabase', e);
    }
  }

  /**
   * Aliases para compatibilidade com BprSavedRun
   */
  static async saveBprRunAsync(run: any): Promise<void> {
    return this.saveScenarioAsync(run);
  }

  static loadSavedRuns(): any[] {
    return this.loadSavedScenarios();
  }
}
