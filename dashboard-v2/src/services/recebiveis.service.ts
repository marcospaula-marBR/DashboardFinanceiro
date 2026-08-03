import { supabase } from '@/lib/supabase';
import {
  RecebimentoItem,
  ContratoParam,
  CommissionableEmployee,
  RecebiveisAuditEntry,
  RecebiveisFilters,
  RecebiveisKpiSummary,
  CommissionParticipant
} from '@/types/recebiveis';

const STORAGE_RECEBIMENTOS = 'mar_brasil_recebiveis_items_v1';
const STORAGE_CONTRATOS = 'mar_brasil_recebiveis_contracts_v1';
const STORAGE_AUDIT = 'mar_brasil_recebiveis_audit_v1';

export class RecebiveisService {

  // =========================================================================
  // 1. BUSCA INTELIGENTE DE COLABORADORES DO PEOPLE BOARD
  // =========================================================================

  /**
   * Busca no People Board / Supabase e filtra APENAS os colaboradores que
   * possuem Plano de Comissão habilitado no cadastro (has_commission_plan).
   */
  public static async getCommissionableEmployees(): Promise<CommissionableEmployee[]> {
    try {
      // 1. Buscar do Supabase na tabela de colaboradores (employees / equipe)
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('id, full_name, department, job_role, commission_plan, remuneration_commission, metadata')
        .order('full_name');

      if (!empErr && empData && empData.length > 0) {
        return empData
          .map(e => {
            const hasPlan =
              (e.commission_plan && e.commission_plan.trim().toLowerCase() !== 'não' && e.commission_plan.trim() !== '') ||
              (e.remuneration_commission && e.remuneration_commission > 0) ||
              Boolean(e.metadata?.has_commission_plan);

            return {
              id: e.id,
              full_name: e.full_name,
              department: e.department || 'Geral',
              job_role: e.job_role || 'Colaborador',
              commission_plan: e.commission_plan || undefined,
              remuneration_commission: e.remuneration_commission || 0,
              has_commission_plan: Boolean(hasPlan),
              default_percent: e.remuneration_commission ? 1 : 1
            };
          })
          .filter(e => e.has_commission_plan); // FILTRO INTELIGENTE: Somente com Plano de Comissão = SIM
      }
    } catch (err) {
      console.warn('Fallback para busca de equipe do Supabase:', err);
    }

    // Fallback de equipe caso offline ou tabela não populada
    return [
      { id: 'emp-01', full_name: 'Gabriel Bellini', department: 'Comercial', job_role: 'Consultor de Vendas', has_commission_plan: true, default_percent: 1.0 },
      { id: 'emp-02', full_name: 'Marcos de Paula', department: 'Diretoria', job_role: 'Diretor Executivo', has_commission_plan: true, default_percent: 1.0 },
      { id: 'emp-03', full_name: 'Equipe Operacional', department: 'Operações', job_role: 'Regra de Setor', has_commission_plan: true, default_percent: 0.5 }
    ];
  }

  // =========================================================================
  // 2. CONTRATOS PARAMETRIZADOS
  // =========================================================================

  public static getContratosParams(): ContratoParam[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_CONTRATOS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Erro ao ler contratos:', e);
    }

    const defaultContracts: ContratoParam[] = [
      {
        id: 'ctr-001',
        company_name: 'Mar Brasil',
        contract_number: '01/2024',
        contract_name: 'Rossi Advogados - Manutenção Ar',
        client_name: 'Rossi Advogados Associados',
        segment_type: 'B2B',
        is_outsourced: false,
        has_commission: true,
        commission_mode: 'percent',
        value_non_commissionable: 500.00,
        commission_rate: 5,
        commission_participants: [
          { id: 'emp-01', name: 'Gabriel Bellini', sector: 'Comercial', type: 'percent', rate: 3, calculated_value: 0 },
          { id: 'emp-03', name: 'Equipe Operacional', sector: 'Operações', is_sector_rule: true, type: 'percent', rate: 2, calculated_value: 0 }
        ],
        segment_allocations: ['B2B']
      },
      {
        id: 'ctr-002',
        company_name: 'Mar Brasil',
        contract_number: '04/2025',
        contract_name: 'Prefeitura Municipal de Santos - Climatização',
        client_name: 'Prefeitura Municipal de Santos',
        segment_type: 'B2G',
        is_outsourced: true,
        has_commission: false,
        commission_mode: 'percent',
        value_non_commissionable: 0,
        commission_rate: 0,
        commission_participants: [],
        segment_allocations: ['B2G']
      },
      {
        id: 'ctr-003',
        company_name: 'DZM',
        contract_number: '08/2025',
        contract_name: 'Atendimento Particular Residencial',
        client_name: 'Cliente Residencial',
        segment_type: 'B2C',
        is_outsourced: false,
        has_commission: true,
        commission_mode: 'percent',
        value_non_commissionable: 0,
        commission_rate: 4,
        commission_participants: [
          { id: 'emp-03', name: 'Equipe Operacional', sector: 'Operações', is_sector_rule: true, type: 'percent', rate: 4, calculated_value: 0 }
        ],
        segment_allocations: ['B2C']
      }
    ];

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CONTRATOS, JSON.stringify(defaultContracts));
    }
    return defaultContracts;
  }

  public static saveContratoParam(contract: ContratoParam): void {
    if (typeof window === 'undefined') return;
    try {
      const contracts = this.getContratosParams();
      const idx = contracts.findIndex(c => c.id === contract.id || c.contract_number === contract.contract_number);
      if (idx >= 0) {
        contracts[idx] = { ...contracts[idx], ...contract };
      } else {
        contracts.push(contract);
      }
      localStorage.setItem(STORAGE_CONTRATOS, JSON.stringify(contracts));
    } catch (e) {
      console.error('Erro ao salvar contrato:', e);
    }
  }

  // =========================================================================
  // 3. MATRIZ DE RECEBIMENTOS & FATURAMENTOS (Supabase / Storage)
  // =========================================================================

  public static getRecebimentos(): RecebimentoItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_RECEBIMENTOS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Erro ao ler recebimentos:', e);
    }

    // Mock inicial se vazio para visualização imediata
    const initialItems: RecebimentoItem[] = [
      {
        id: 'rec-001',
        source: 'MANUAL',
        company_name: 'Mar Brasil',
        invoice_number: 'NF 157',
        contract_number: '01/2024',
        contract_name: 'Rossi Advogados - Manutenção Ar',
        client_name: 'Rossi Advogados Associados',
        segment_type: 'B2B',
        is_outsourced: false,
        date_registration: '2026-05-31',
        date_issue: '2026-05-31',
        date_due: '2026-06-15',
        date_payment: '2026-06-14',
        value_gross: 8500.00,
        value_discount: 0,
        value_interest_penalty: 0,
        value_fees: 0,
        tax_pis: 55.25,
        tax_cofins: 255.00,
        tax_iss: 170.00,
        tax_inss: 0,
        tax_irrf: 127.50,
        tax_retained_total: 607.75,
        value_net: 7892.25,
        status: 'Pago',
        commission: {
          has_commission: true,
          commission_mode: 'percent',
          value_non_commissionable: 500.00,
          value_commissionable_base: 7392.25,
          total_commission_percent: 5,
          total_commission_value: 369.61,
          participants: [
            { id: 'emp-01', name: 'Gabriel Bellini', sector: 'Comercial', type: 'percent', rate: 3, calculated_value: 221.77 },
            { id: 'emp-03', name: 'Equipe Operacional', sector: 'Operações', is_sector_rule: true, type: 'percent', rate: 2, calculated_value: 147.84 }
          ]
        }
      },
      {
        id: 'rec-002',
        source: 'OMIE',
        omie_id: 88102,
        company_name: 'Mar Brasil',
        invoice_number: 'NF 158',
        contract_number: '04/2025',
        contract_name: 'Prefeitura Municipal de Santos - Climatização',
        client_name: 'Prefeitura Municipal de Santos',
        segment_type: 'B2G',
        is_outsourced: true,
        date_registration: '2026-06-02',
        date_issue: '2026-06-02',
        date_due: '2026-06-20',
        date_payment: '2026-06-18',
        value_gross: 48500.00,
        value_discount: 0,
        value_interest_penalty: 0,
        value_fees: 0,
        tax_pis: 315.25,
        tax_cofins: 1455.00,
        tax_iss: 970.00,
        tax_inss: 533.50,
        tax_irrf: 727.50,
        tax_retained_total: 4001.25,
        value_net: 44498.75,
        status: 'Pago',
        commission: {
          has_commission: false,
          commission_mode: 'percent',
          value_non_commissionable: 0,
          value_commissionable_base: 44498.75,
          total_commission_percent: 0,
          total_commission_value: 0,
          participants: []
        }
      }
    ];

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_RECEBIMENTOS, JSON.stringify(initialItems));
    }
    return initialItems;
  }

  public static saveRecebimentos(items: RecebimentoItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_RECEBIMENTOS, JSON.stringify(items));
    } catch (e) {
      console.error('Erro ao salvar recebimentos:', e);
    }
  }

  public static saveSingleRecebimento(item: RecebimentoItem): void {
    const items = this.getRecebimentos();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.unshift(item);
    }
    this.saveRecebimentos(items);
  }

  public static deleteRecebimento(id: string): void {
    const items = this.getRecebimentos().filter(i => i.id !== id);
    this.saveRecebimentos(items);
  }

  // =========================================================================
  // 4. AUDITORIA E SINCRO OMIE (Diff & Aceite)
  // =========================================================================

  public static getAuditEntries(): RecebiveisAuditEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_AUDIT);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Erro ao ler auditoria:', e);
    }
    return [];
  }

  public static saveAuditEntries(entries: RecebiveisAuditEntry[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_AUDIT, JSON.stringify(entries));
    } catch (e) {
      console.error('Erro ao salvar auditoria:', e);
    }
  }

  public static processOmieSyncDiff(incomingOmieItems: RecebimentoItem[]): RecebiveisAuditEntry[] {
    const existingInvoices = this.getRecebimentos();
    const existingMap = new Map<string, RecebimentoItem>();
    existingInvoices.forEach(inv => {
      if (inv.omie_id) existingMap.set(`${inv.company_name}-${inv.omie_id}`, inv);
    });

    const contracts = this.getContratosParams();
    const newAuditEntries: RecebiveisAuditEntry[] = [];
    const timestamp = new Date().toISOString();

    incomingOmieItems.forEach(incoming => {
      const omieKey = `${incoming.company_name}-${incoming.omie_id}`;
      const existing = existingMap.get(omieKey);

      // Aplicação das regras do Contrato Parametrizado se houver vínculo
      const matchedContract = contracts.find(c =>
        c.company_name === incoming.company_name &&
        (c.contract_number === incoming.contract_number || c.contract_name === incoming.contract_name)
      );

      let preparedItem = { ...incoming };
      if (matchedContract) {
        preparedItem.segment_type = matchedContract.segment_type;
        preparedItem.is_outsourced = matchedContract.is_outsourced;

        const nonComm = matchedContract.value_non_commissionable || 0;
        const commBase = Math.max(0, preparedItem.value_net - nonComm);
        
        preparedItem.commission = {
          has_commission: matchedContract.has_commission,
          commission_mode: matchedContract.commission_mode,
          value_non_commissionable: nonComm,
          value_commissionable_base: commBase,
          total_commission_percent: matchedContract.commission_rate,
          total_commission_value: 0,
          participants: matchedContract.commission_participants
        };
      }

      if (!existing) {
        newAuditEntries.push({
          id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          sync_timestamp: timestamp,
          omie_id: incoming.omie_id || 0,
          invoice_number: incoming.invoice_number,
          company_name: incoming.company_name,
          change_type: 'NEW_INVOICE',
          change_description: `Novo faturamento identificado no Omie ERP (${incoming.company_name})`,
          new_data: preparedItem,
          audit_status: 'PENDING'
        });
      } else {
        const valueChanged = Math.abs(existing.value_gross - incoming.value_gross) > 0.01;
        const statusChanged = existing.status !== incoming.status;

        if (valueChanged || statusChanged) {
          newAuditEntries.push({
            id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            sync_timestamp: timestamp,
            omie_id: incoming.omie_id || 0,
            invoice_number: incoming.invoice_number,
            company_name: incoming.company_name,
            change_type: valueChanged ? 'VALUE_CHANGE' : 'STATUS_CHANGE',
            change_description: `Alteração no Omie ERP para ${incoming.invoice_number}`,
            old_data: existing,
            new_data: { ...existing, ...incoming },
            audit_status: 'PENDING'
          });
        }
      }
    });

    const currentAudit = this.getAuditEntries();
    const updatedAudit = [...newAuditEntries, ...currentAudit];
    this.saveAuditEntries(updatedAudit);
    return updatedAudit;
  }

  public static approveAuditEntry(auditId: string): void {
    const auditEntries = this.getAuditEntries();
    const entry = auditEntries.find(a => a.id === auditId);
    if (!entry) return;

    entry.audit_status = 'ACCEPTED';
    this.saveAuditEntries(auditEntries);

    const newData = entry.new_data as RecebimentoItem;
    this.saveSingleRecebimento(newData);
  }

  public static rejectAuditEntry(auditId: string): void {
    const auditEntries = this.getAuditEntries();
    const entry = auditEntries.find(a => a.id === auditId);
    if (!entry) return;

    entry.audit_status = 'REJECTED';
    this.saveAuditEntries(auditEntries);
  }

  public static approveAllPendingAudit(): void {
    const auditEntries = this.getAuditEntries();
    auditEntries.forEach(entry => {
      if (entry.audit_status === 'PENDING') {
        this.approveAuditEntry(entry.id);
      }
    });
  }

  // =========================================================================
  // 5. CÁLCULO DE KPIS E FILTROS
  // =========================================================================

  public static filterRecebimentos(items: RecebimentoItem[], filter: RecebiveisFilters): RecebimentoItem[] {
    return items.filter(item => {
      if (filter.company && filter.company !== 'ALL' && item.company_name !== filter.company) return false;
      if (filter.segment && filter.segment !== 'ALL' && item.segment_type !== filter.segment) return false;
      if (filter.is_outsourced === 'YES' && !item.is_outsourced) return false;
      if (filter.is_outsourced === 'NO' && item.is_outsourced) return false;

      if (filter.contratoId && item.contract_id !== filter.contratoId) return false;

      if (filter.membroId && item.commission?.participants) {
        const hasMember = item.commission.participants.some(p => p.id === filter.membroId);
        if (!hasMember) return false;
      }

      if (filter.ciclo) {
        const itemCiclo = item.date_registration ? item.date_registration.substring(0, 7) : '';
        if (itemCiclo !== filter.ciclo) return false;
      }

      const targetDate = item[filter.date_type || 'date_registration'];
      if (targetDate) {
        if (filter.startDate && targetDate < filter.startDate) return false;
        if (filter.endDate && targetDate > filter.endDate) return false;
      }

      if (filter.search) {
        const q = filter.search.toLowerCase();
        const matchInvoice = item.invoice_number.toLowerCase().includes(q);
        const matchClient = item.client_name.toLowerCase().includes(q);
        const matchContract = item.contract_name.toLowerCase().includes(q);
        if (!matchInvoice && !matchClient && !matchContract) return false;
      }

      return true;
    });
  }

  public static computeKpiSummary(items: RecebimentoItem[]): RecebiveisKpiSummary {
    const summary: RecebiveisKpiSummary = {
      total_count: items.length,
      total_gross: 0,
      total_retained_taxes: 0,
      total_net: 0,
      total_commissions: 0,
      total_pending_commissions: 0,
      total_paid_commissions: 0,
      gross_b2g: 0,
      gross_b2b: 0,
      gross_b2c: 0,
      gross_outsourced: 0
    };

    items.forEach(item => {
      summary.total_gross += item.value_gross || 0;
      summary.total_retained_taxes += item.tax_retained_total || 0;
      summary.total_net += item.value_net || 0;

      const commVal = item.commission && item.commission.has_commission ? item.commission.total_commission_value : 0;
      summary.total_commissions += commVal;

      if (item.status === 'Pago') {
        summary.total_paid_commissions += commVal;
      } else {
        summary.total_pending_commissions += commVal;
      }

      if (item.segment_type === 'B2G') summary.gross_b2g += item.value_gross;
      else if (item.segment_type === 'B2B') summary.gross_b2b += item.value_gross;
      else if (item.segment_type === 'B2C') summary.gross_b2c += item.value_gross;

      if (item.is_outsourced) summary.gross_outsourced += item.value_gross;
    });

    return summary;
  }
}
