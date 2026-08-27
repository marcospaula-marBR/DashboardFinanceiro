import { Employee, MonthlyCost, getPBClassification, normalizeCompanyName } from '@/types/loans';
import { 
  BprRuleConfig, 
  BprCandidateResult, 
  BprCalculationSummary, 
  BprCamada, 
  BprLayerSummary, 
  BprCycle,
  BprSavedRun
} from '@/types/bpr';
import { supabase } from '@/lib/supabase';

const BPR_STORAGE_KEY = 'marbrasil_bpr_config_v1';
const BPR_RUNS_STORAGE_KEY = 'marbrasil_bpr_runs_history_v1';

export class BprService {
  
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
        tierSplits: { E: 30, T: 40, O: 30 },
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
        tierSplits: { E: 30, T: 40, O: 30 },
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
        tierSplits: { E: 30, T: 40, O: 30 },
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

    // Mapa de glosas por colaborador nas competências do ciclo
    const glosaByEmployeeId = new Map<string, { hasGlosa: boolean; details: string[] }>();
    monthlyCosts.forEach(mc => {
      if (!mc.employee_id) return;
      const comp = (mc.competencia || '').slice(0, 7);
      if (cycleMonths.includes(comp)) {
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
        allocatedAmount: 0 // Será calculado após a contagem de elegíveis
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

    // 5. Contagem de Elegíveis por Camada
    const layerEligibleCounts: Record<BprCamada, number> = { E: 0, T: 0, O: 0 };
    const layerIneligibleCounts: Record<BprCamada, number> = { E: 0, T: 0, O: 0 };

    candidates.forEach(c => {
      if (c.isEligible) {
        layerEligibleCounts[c.camada]++;
      } else {
        layerIneligibleCounts[c.camada]++;
      }
    });

    // 6. Rateio Financeiro por Camada
    const layers: Record<BprCamada, BprLayerSummary> = {
      E: {
        camada: 'E',
        label: 'Estratégico',
        allocatedPercentage: config.tierSplits.E,
        totalLayerAmount: (config.totalPoolAmount * config.tierSplits.E) / 100,
        eligibleCount: layerEligibleCounts.E,
        ineligibleCount: layerIneligibleCounts.E,
        amountPerEligible: layerEligibleCounts.E > 0 
          ? Number(((config.totalPoolAmount * config.tierSplits.E) / 100 / layerEligibleCounts.E).toFixed(2)) 
          : 0
      },
      T: {
        camada: 'T',
        label: 'Tático',
        allocatedPercentage: config.tierSplits.T,
        totalLayerAmount: (config.totalPoolAmount * config.tierSplits.T) / 100,
        eligibleCount: layerEligibleCounts.T,
        ineligibleCount: layerIneligibleCounts.T,
        amountPerEligible: layerEligibleCounts.T > 0 
          ? Number(((config.totalPoolAmount * config.tierSplits.T) / 100 / layerEligibleCounts.T).toFixed(2)) 
          : 0
      },
      O: {
        camada: 'O',
        label: 'Operacional/CLTs',
        allocatedPercentage: config.tierSplits.O,
        totalLayerAmount: (config.totalPoolAmount * config.tierSplits.O) / 100,
        eligibleCount: layerEligibleCounts.O,
        ineligibleCount: layerIneligibleCounts.O,
        amountPerEligible: layerEligibleCounts.O > 0 
          ? Number(((config.totalPoolAmount * config.tierSplits.O) / 100 / layerEligibleCounts.O).toFixed(2)) 
          : 0
      }
    };

    // 7. Atribuição do Valor Individual a Cada Elegível (considerando o fator de metas)
    let totalDistributed = 0;
    candidates.forEach(c => {
      if (c.isEligible) {
        const baseVal = layers[c.camada].amountPerEligible;
        const finalVal = Number((baseVal * (c.performanceFactor ?? 1.0)).toFixed(2));
        c.baseAmount = baseVal;
        c.allocatedAmount = finalVal;
        totalDistributed += finalVal;
      } else {
        c.baseAmount = 0;
        c.allocatedAmount = 0;
      }
    });

    const residualAmount = Math.max(0, config.totalPoolAmount - totalDistributed);

    return {
      totalPoolAmount: config.totalPoolAmount,
      totalDistributedAmount: Number(totalDistributed.toFixed(2)),
      residualAmount: Number(residualAmount.toFixed(2)),
      totalCandidates: candidates.length,
      totalEligible: layerEligibleCounts.E + layerEligibleCounts.T + layerEligibleCounts.O,
      totalIneligible: layerIneligibleCounts.E + layerIneligibleCounts.T + layerIneligibleCounts.O,
      layers,
      candidates,
      glosadosCandidates,
      inativosCandidates
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
    } catch {}
  }

  /**
   * Carrega a última configuração salva
   */
  static loadSavedConfig(): BprRuleConfig | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(BPR_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch {}
    return null;
  }

  /**
   * Salva um snapshot histórico de apuração
   */
  static async saveBprRunAsync(run: BprSavedRun): Promise<void> {
    if (typeof window === 'undefined') return;
    
    // 1. Salvar no LocalStorage
    try {
      const existing = this.loadSavedRuns();
      const updated = [run, ...existing.filter(r => r.id !== run.id)].slice(0, 50);
      localStorage.setItem(BPR_RUNS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    // 2. Persistir no Supabase no registro global __SYSTEM_GLOBAL_CONFIG__
    try {
      const { data } = await supabase
        .from('employees')
        .select('metadata')
        .eq('full_name', '__SYSTEM_GLOBAL_CONFIG__')
        .maybeSingle();

      const existingMetadata = data?.metadata || {};
      const currentRuns: BprSavedRun[] = existingMetadata.bpr_runs || [];
      const mergedRuns = [run, ...currentRuns.filter(r => r.id !== run.id)].slice(0, 50);

      await supabase
        .from('employees')
        .update({
          metadata: {
            ...existingMetadata,
            bpr_runs: mergedRuns,
            last_bpr_update: new Date().toISOString()
          }
        })
        .eq('full_name', '__SYSTEM_GLOBAL_CONFIG__');
    } catch (e) {
      console.warn('Persistência Supabase BPR fallback para local', e);
    }
  }

  /**
   * Carrega a lista de snapshots históricos de apuração
   */
  static loadSavedRuns(): BprSavedRun[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(BPR_RUNS_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch {}
    return [];
  }
}
