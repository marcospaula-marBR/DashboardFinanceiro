import { supabase } from '@/lib/supabase';
import {
  BillingItem,
  BillingContractParam,
  BillingAuditEntry,
  BillingFilterState,
  BillingKpiSummary,
  BillingQuarterlyTaxes,
  DateReferenceType,
  SegmentType
} from '@/types/billing.types';

const STORAGE_KEY_INVOICES = 'mar_brasil_billing_invoices_v2';
const STORAGE_KEY_CONTRACTS = 'mar_brasil_billing_contracts_v2';
const STORAGE_KEY_AUDIT = 'mar_brasil_billing_audit_v2';

export class BillingService {

  // =========================================================================
  // 1. GESTÃO DE CONTRATOS PARAMETRIZADOS (Configurações Iniciais)
  // =========================================================================

  public static getInitialContracts(): BillingContractParam[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONTRACTS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Erro ao ler contratos:', e);
    }

    // Contratos Padrão Iniciais Parametrizados
    const defaultContracts: BillingContractParam[] = [
      {
        id: 'ctr-001',
        company_name: 'Mar Brasil',
        contract_number: '01/2024',
        contract_name: 'Rossi Advogados - Manutenção Ar',
        client_name: 'Rossi Advogados Associados',
        segment_type: 'B2B',
        is_outsourced: false,
        has_commission: true,
        value_non_commissionable: 500.00,
        commission_mode: 'percent',
        commission_rate: 5,
        commission_participants: [
          { id: 'emp-01', name: 'Gabriel Bellini', sector: 'Comercial', type: 'percent', rate: 3, calculated_value: 0 },
          { id: 'emp-02', name: 'Equipe Operacional', sector: 'Operações', is_sector_rule: true, type: 'percent', rate: 2, calculated_value: 0 }
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
        value_non_commissionable: 0,
        commission_mode: 'percent',
        commission_rate: 0,
        commission_participants: [],
        segment_allocations: ['B2G', 'Terceirização']
      },
      {
        id: 'ctr-003',
        company_name: 'DZM',
        contract_number: '08/2025',
        contract_name: 'Atendimento Particular Residencial',
        client_name: 'Consumidor Final Residencial',
        segment_type: 'B2C', // Exclusivo Consumidor Final
        is_outsourced: false,
        has_commission: true,
        value_non_commissionable: 0,
        commission_mode: 'percent',
        commission_rate: 4,
        commission_participants: [
          { id: 'emp-03', name: 'Atendimento Técnico', sector: 'Operações', is_sector_rule: true, type: 'percent', rate: 4, calculated_value: 0 }
        ],
        segment_allocations: ['B2C']
      }
    ];

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CONTRACTS, JSON.stringify(defaultContracts));
    }
    return defaultContracts;
  }

  public static saveContractParam(contract: BillingContractParam): void {
    if (typeof window === 'undefined') return;
    try {
      const contracts = this.getInitialContracts();
      const idx = contracts.findIndex(c => c.id === contract.id || c.contract_number === contract.contract_number);
      if (idx >= 0) {
        contracts[idx] = { ...contracts[idx], ...contract, updated_at: new Date().toISOString() };
      } else {
        contracts.push({ ...contract, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
      localStorage.setItem(STORAGE_KEY_CONTRACTS, JSON.stringify(contracts));
    } catch (e) {
      console.error('Erro ao salvar parametrização de contrato:', e);
    }
  }

  // =========================================================================
  // 2. GESTÃO DE LANÇAMENTOS DE FATURAMENTO (Invoices)
  // =========================================================================

  public static getInvoices(): BillingItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY_INVOICES);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Erro ao ler faturamentos:', e);
    }
    return [];
  }

  public static saveInvoices(invoices: BillingItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_INVOICES, JSON.stringify(invoices));
    } catch (e) {
      console.error('Erro ao salvar faturamentos:', e);
    }
  }

  /**
   * Reseta e limpa a base de faturamentos zerando os lançamentos
   */
  public static clearDatabase(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY_INVOICES);
      localStorage.removeItem(STORAGE_KEY_AUDIT);
    } catch (e) {
      console.error('Erro ao limpar base de faturamentos:', e);
    }
  }

  // =========================================================================
  // 3. AUDITORIA E APROVAÇÃO DE MUDANÇAS DO OMIE
  // =========================================================================

  public static getAuditEntries(): BillingAuditEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUDIT);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Erro ao ler auditoria:', e);
    }
    return [];
  }

  public static saveAuditEntries(entries: BillingAuditEntry[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(entries));
    } catch (e) {
      console.error('Erro ao salvar auditoria:', e);
    }
  }

  /**
   * Compara o retorno vindo do Omie com o banco existente e gera a lista de Auditoria para aprovação
   */
  public static processOmieSyncDiff(incomingOmieItems: BillingItem[]): BillingAuditEntry[] {
    const existingInvoices = this.getInvoices();
    const existingMap = new Map<string, BillingItem>();
    existingInvoices.forEach(inv => {
      if (inv.omie_id) existingMap.set(`${inv.company_name}-${inv.omie_id}`, inv);
    });

    const contracts = this.getInitialContracts();
    const newAuditEntries: BillingAuditEntry[] = [];
    const timestamp = new Date().toISOString();

    incomingOmieItems.forEach(incoming => {
      const omieKey = `${incoming.company_name}-${incoming.omie_id}`;
      const existing = existingMap.get(omieKey);

      // Vincular regra do Contrato Parametrizado se existir
      const matchedContract = contracts.find(c =>
        c.company_name === incoming.company_name &&
        (c.contract_number === incoming.contract_number || c.contract_name === incoming.contract_name)
      );

      let preparedItem = { ...incoming };
      if (matchedContract) {
        preparedItem.segment_type = matchedContract.segment_type;
        preparedItem.is_outsourced = matchedContract.is_outsourced;
        preparedItem.segment_allocations = matchedContract.segment_allocations;
        preparedItem.commission = {
          has_commission: matchedContract.has_commission,
          value_non_commissionable: matchedContract.value_non_commissionable,
          value_commissionable_base: Math.max(0, preparedItem.value_net - matchedContract.value_non_commissionable),
          total_commission_percent: matchedContract.commission_rate,
          total_commission_value: 0,
          participants: matchedContract.commission_participants
        };
      }

      if (!existing) {
        // Novo Lançamento encontrado no Omie
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
        // Checar se houve alteração de valor ou status
        const valueChanged = Math.abs(existing.value_gross - incoming.value_gross) > 0.01;
        const statusChanged = existing.status !== incoming.status;

        if (valueChanged) {
          newAuditEntries.push({
            id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            sync_timestamp: timestamp,
            omie_id: incoming.omie_id || 0,
            invoice_number: incoming.invoice_number,
            company_name: incoming.company_name,
            change_type: 'VALUE_CHANGE',
            change_description: `Alteração de valor no Omie: de R$ ${existing.value_gross.toFixed(2)} para R$ ${incoming.value_gross.toFixed(2)}`,
            old_data: existing,
            new_data: { ...existing, value_gross: incoming.value_gross, value_net: incoming.value_net },
            audit_status: 'PENDING'
          });
        }

        if (statusChanged) {
          newAuditEntries.push({
            id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            sync_timestamp: timestamp,
            omie_id: incoming.omie_id || 0,
            invoice_number: incoming.invoice_number,
            company_name: incoming.company_name,
            change_type: 'STATUS_CHANGE',
            change_description: `Alteração de status no Omie: de ${existing.status} para ${incoming.status}`,
            old_data: existing,
            new_data: { ...existing, status: incoming.status },
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

  /**
   * Aprova uma mudança da auditoria e atualiza o banco de dados
   */
  public static approveAuditEntry(auditId: string): void {
    const auditEntries = this.getAuditEntries();
    const entry = auditEntries.find(a => a.id === auditId);
    if (!entry) return;

    entry.audit_status = 'ACCEPTED';
    this.saveAuditEntries(auditEntries);

    // Atualizar banco de faturamentos
    const invoices = this.getInvoices();
    const newData = entry.new_data as BillingItem;

    const idx = invoices.findIndex(i => i.id === newData.id || (i.omie_id && i.omie_id === newData.omie_id && i.company_name === newData.company_name));
    if (idx >= 0) {
      invoices[idx] = { ...invoices[idx], ...newData };
    } else {
      invoices.push(newData);
    }
    this.saveInvoices(invoices);
  }

  /**
   * Rejeita uma mudança da auditoria
   */
  public static rejectAuditEntry(auditId: string): void {
    const auditEntries = this.getAuditEntries();
    const entry = auditEntries.find(a => a.id === auditId);
    if (!entry) return;

    entry.audit_status = 'REJECTED';
    this.saveAuditEntries(auditEntries);
  }

  /**
   * Aprova todas as mudanças pendentes na auditoria
   */
  public static approveAllPendingAudit(): void {
    const auditEntries = this.getAuditEntries();
    auditEntries.forEach(entry => {
      if (entry.audit_status === 'PENDING') {
        this.approveAuditEntry(entry.id);
      }
    });
  }

  // =========================================================================
  // 4. FILTROS E CÁLCULOS EXECUTIVOS
  // =========================================================================

  public static filterBillingItems(items: BillingItem[], filter: BillingFilterState): BillingItem[] {
    return items.filter(item => {
      if (filter.company !== 'ALL' && item.company_name !== filter.company) return false;
      if (filter.segment !== 'ALL' && item.segment_type !== filter.segment) return false;
      if (filter.is_outsourced === 'YES' && !item.is_outsourced) return false;
      if (filter.is_outsourced === 'NO' && item.is_outsourced) return false;
      if (filter.has_commission === 'YES' && (!item.commission || !item.commission.has_commission)) return false;
      if (filter.has_commission === 'NO' && item.commission && item.commission.has_commission) return false;
      if (filter.client && item.client_name.toLowerCase() !== filter.client.toLowerCase()) return false;

      const targetDate = item[filter.date_type];
      if (targetDate) {
        if (filter.start_date && targetDate < filter.start_date) return false;
        if (filter.end_date && targetDate > filter.end_date) return false;
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

  public static computeKpiSummary(items: BillingItem[]): BillingKpiSummary {
    const summary: BillingKpiSummary = {
      total_count: items.length,
      total_gross: 0,
      total_retained_taxes: 0,
      total_quarterly_taxes: 0,
      total_net: 0,
      total_commissions: 0,
      total_discount: 0,
      total_fees: 0,

      gross_b2g: 0,
      gross_b2b: 0,
      gross_b2c: 0,
      gross_outsourced: 0,

      pct_b2g: 0,
      pct_b2b: 0,
      pct_b2c: 0,
      pct_outsourced: 0
    };

    items.forEach(item => {
      summary.total_gross += item.value_gross;
      summary.total_retained_taxes += item.tax_retained_total;
      summary.total_net += item.value_net;
      summary.total_commissions += item.commission && item.commission.has_commission ? item.commission.total_commission_value : 0;
      summary.total_discount += item.value_discount;
      summary.total_fees += item.value_fees;

      if (item.segment_type === 'B2G') summary.gross_b2g += item.value_gross;
      else if (item.segment_type === 'B2B') summary.gross_b2b += item.value_gross;
      else if (item.segment_type === 'B2C') summary.gross_b2c += item.value_gross;

      if (item.is_outsourced) summary.gross_outsourced += item.value_gross;
    });

    if (summary.total_gross > 0) {
      summary.pct_b2g = (summary.gross_b2g / summary.total_gross) * 100;
      summary.pct_b2b = (summary.gross_b2b / summary.total_gross) * 100;
      summary.pct_b2c = (summary.gross_b2c / summary.total_gross) * 100;
      summary.pct_outsourced = (summary.gross_outsourced / summary.total_gross) * 100;
    }

    const quarterlyTax = this.computeQuarterlyTaxes(items);
    summary.total_quarterly_taxes = quarterlyTax.reduce((acc, q) => acc + q.total_quarterly_tax, 0);

    return summary;
  }

  public static computeQuarterlyTaxes(items: BillingItem[], defaultYear: number = 2026): BillingQuarterlyTaxes[] {
    let detectedYear = defaultYear;
    if (items.length > 0) {
      const sampleDate = items[0].date_registration || items[0].date_issue;
      if (sampleDate) {
        const y = parseInt(sampleDate.split('-')[0], 10);
        if (!isNaN(y)) detectedYear = y;
      }
    }

    const year = detectedYear;
    const isPost2026 = year >= 2026;
    const ruleVersion: 'LEGACY_2025' | 'LC_224_2026' = isPost2026 ? 'LC_224_2026' : 'LEGACY_2025';

    const quarters: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', { gross: number; due_month: string; due_date: string }> = {
      Q1: { gross: 0, due_month: 'Abril', due_date: `${year}-04-30` },
      Q2: { gross: 0, due_month: 'Julho', due_date: `${year}-07-31` },
      Q3: { gross: 0, due_month: 'Outubro', due_date: `${year}-10-31` },
      Q4: { gross: 0, due_month: 'Janeiro', due_date: `${year + 1}-01-31` }
    };

    items.forEach(item => {
      const dateStr = item.date_registration || item.date_issue;
      if (!dateStr) return;
      const month = parseInt(dateStr.split('-')[1], 10);
      if (isNaN(month)) return;

      if (month >= 1 && month <= 3) quarters.Q1.gross += item.value_gross;
      else if (month >= 4 && month <= 6) quarters.Q2.gross += item.value_gross;
      else if (month >= 7 && month <= 9) quarters.Q3.gross += item.value_gross;
      else if (month >= 10 && month <= 12) quarters.Q4.gross += item.value_gross;
    });

    return (Object.keys(quarters) as Array<'Q1' | 'Q2' | 'Q3' | 'Q4'>).map(qKey => {
      const qData = quarters[qKey];
      const gross = qData.gross;
      
      const presumedProfit = gross * 0.32;
      const irpjRegular = presumedProfit * 0.15;
      const csllRegular = presumedProfit * 0.09;

      const excessLimit = 60000;
      const irpjExcedente = Math.max(0, (presumedProfit - excessLimit) * 0.10);
      const totalTax = irpjRegular + csllRegular + irpjExcedente;

      return {
        quarter: qKey,
        year,
        rule_version: ruleVersion,
        due_month_label: qData.due_month,
        due_date: qData.due_date,
        gross_revenue_quarter: gross,
        irpj_base: presumedProfit,
        irpj_regular: irpjRegular,
        irpj_excedente: irpjExcedente,
        csll_regular: csllRegular,
        total_quarterly_tax: totalTax
      };
    });
  }
}
