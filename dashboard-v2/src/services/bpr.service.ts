import { Employee, MonthlyCost, getPBClassification } from '@/types/loans';
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
      // Ciclo 1: Pago até Março (Ref: 01/07 a 31/12 do ano anterior)
      return {
        cycle: 'ciclo_1',
        year,
        periodStartDate: `${year - 1}-07-01`,
        periodEndDate: `${year - 1}-12-31`,
        paymentDate: `${year}-03-31`,
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
      // Ciclo 2: Pago até Setembro (Ref: 01/01 a 30/06 do ano vigente)
      return {
        cycle: 'ciclo_2',
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
    return { camada: 'O', label: 'Operacional' };
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

    // Obter lista de competências do ciclo para checagem de glosas (ex: 2025-07 até 2025-12)
    const cycleMonths: string[] = [];
    const curMonth = new Date(cycleStart);
    while (curMonth <= cycleEnd) {
      const comp = `${curMonth.getFullYear()}-${String(curMonth.getMonth() + 1).padStart(2, '0')}`;
      cycleMonths.push(comp);
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
      // 1. Filtros de Escopo (Empresa e Vínculo)
      if (config.companiesFilter.length > 0 && !config.companiesFilter.includes(emp.company || '')) {
        return;
      }
      
      const link = emp.linkType || 'CLT';
      if (config.linkTypesFilter.length > 0) {
        const matchesLink = config.linkTypesFilter.includes(link) || 
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

      // REQUISITO ESTREITO: Colaborador inativo entre o 1º dia após o ciclo e a data de pagamento
      // (cumpriu todo o período eletivo, mas foi desligado entre cycleEnd e paymentDate)
      const isInactiveBetweenCycleAndPayment = Boolean(
        admittedBeforeOrAtCycleStart &&
        activeThroughoutCycle &&
        isInactiveAtPaymentDate &&
        (realResignationDate ? (realResignationDate > cycleEnd && realResignationDate < paymentDate) : !isStatusActive)
      );

      // Glosa no período eletivo
      const glosaInfo = glosaByEmployeeId.get(emp.id) || { hasGlosa: false, details: [] };
      const hasGlosaInPeriod = glosaInfo.hasGlosa || Boolean(emp.has_invoice_glosa);
      const glosaDetails = glosaInfo.details.join(', ') || (emp.has_invoice_glosa ? 'Glosa sinalizada na fatura' : undefined);

      // 3. Avaliação de Elegibilidade Padrão & Exceções
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
        jobRole: emp.job_role || 'Colaborador',
        linkType: link,
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
        allocatedAmount: 0 // Será calculado após a contagem de elegíveis
      };

      candidates.push(candidateResult);

      if (hasGlosaInPeriod) {
        glosadosCandidates.push(candidateResult);
      }
      // Apenas inativos que cumpriram o ciclo e saíram antes da data de pagamento aparecem na lista de exceção
      if (isInactiveBetweenCycleAndPayment) {
        inativosCandidates.push(candidateResult);
      }
    });

    // 4. Contagem de Elegíveis por Camada
    const layerEligibleCounts: Record<BprCamada, number> = { E: 0, T: 0, O: 0 };
    const layerIneligibleCounts: Record<BprCamada, number> = { E: 0, T: 0, O: 0 };

    candidates.forEach(c => {
      if (c.isEligible) {
        layerEligibleCounts[c.camada]++;
      } else {
        layerIneligibleCounts[c.camada]++;
      }
    });

    // 5. Rateio Financeiro por Camada
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
        label: 'Operacional',
        allocatedPercentage: config.tierSplits.O,
        totalLayerAmount: (config.totalPoolAmount * config.tierSplits.O) / 100,
        eligibleCount: layerEligibleCounts.O,
        ineligibleCount: layerIneligibleCounts.O,
        amountPerEligible: layerEligibleCounts.O > 0 
          ? Number(((config.totalPoolAmount * config.tierSplits.O) / 100 / layerEligibleCounts.O).toFixed(2)) 
          : 0
      }
    };

    // 6. Atribuição do Valor Individual a Cada Elegível
    let totalDistributed = 0;
    candidates.forEach(c => {
      if (c.isEligible) {
        const val = layers[c.camada].amountPerEligible;
        c.allocatedAmount = val;
        totalDistributed += val;
      } else {
        c.allocatedAmount = 0;
      }
    });

    const totalEligible = layerEligibleCounts.E + layerEligibleCounts.T + layerEligibleCounts.O;
    const totalIneligible = candidates.length - totalEligible;
    const residual = Math.max(0, Number((config.totalPoolAmount - totalDistributed).toFixed(2)));

    return {
      totalPoolAmount: config.totalPoolAmount,
      totalDistributedAmount: Number(totalDistributed.toFixed(2)),
      residualAmount: residual,
      totalCandidates: candidates.length,
      totalEligible,
      totalIneligible,
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
