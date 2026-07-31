/**
 * TYPES DEFINITION: DASHBOARD DE FATURAMENTOS & PARAMETRIZAÇÃO DE CONTRATOS v.02.55.00
 * Suporte a banco de dados Supabase, auditoria com aprovação de mudanças do Omie,
 * parametrização inicial de contratos, comissões integradas com People e rateios de segmento.
 */

export type DateReferenceType = 'date_registration' | 'date_issue' | 'date_due' | 'date_payment';

export type SegmentType = 'B2G' | 'B2B' | 'B2C'; // B2C é exclusivo Consumidor Final

export type SegmentAllocationType = SegmentType | 'Terceirização';

export type AuditChangeType = 'NEW_INVOICE' | 'VALUE_CHANGE' | 'STATUS_CHANGE' | 'DATE_CHANGE';

export type AuditStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface CommissionParticipant {
  id: string; // Employee ID do People Board ou Código do Setor
  name: string; // Nome do Colaborador ou Nome do Setor
  sector?: string;
  is_sector_rule?: boolean;
  type: 'percent' | 'fixed';
  rate: number; // % ou R$
  calculated_value: number; // Valor R$ calculado sobre a Base Comissionável
}

export interface BillingCommissionConfig {
  has_commission: boolean;
  value_non_commissionable: number;
  value_commissionable_base: number; // (Líquido - Não Comissionável)
  total_commission_percent: number;
  total_commission_value: number;
  participants: CommissionParticipant[];
}

export interface BillingContractParam {
  id: string;
  company_name: 'Mar Brasil' | 'DZM';
  contract_number: string; // Número do Contrato / Pedido Omie
  contract_name: string; // Nome do Projeto fonte Omie
  client_name: string; // Razão Social do Omie
  segment_type: SegmentType; // B2G, B2B, B2C (Consumidor Final)
  is_outsourced: boolean; // Terceirização: Sim ou Não
  has_commission: boolean; // Comissões: Sim ou Não
  value_non_commissionable: number;
  commission_mode: 'percent' | 'fixed';
  commission_rate: number;
  commission_participants: CommissionParticipant[];
  segment_allocations: SegmentAllocationType[]; // Marcadores para rateio de despesas
  created_at?: string;
  updated_at?: string;
}

export interface BillingQuarterlyTaxes {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  rule_version: 'LEGACY_2025' | 'LC_224_2026';
  due_month_label: string;
  due_date: string;
  gross_revenue_quarter: number;
  irpj_base: number;
  irpj_regular: number;
  irpj_excedente: number;
  csll_regular: number;
  total_quarterly_tax: number;
}

export interface BillingItem {
  id: string;
  omie_id?: number;
  company_name: 'Mar Brasil' | 'DZM';
  invoice_number: string; // NF / OS / RPS
  contract_id?: string;
  contract_number?: string;
  contract_name: string; // Projeto fonte Omie
  client_id?: number;
  client_name: string; // Razão Social Omie
  client_cnpj_cpf?: string;
  
  segment_type: SegmentType;
  is_outsourced: boolean;
  service_description?: string;
  city_of_service?: string;

  // Datas
  date_registration: string; // Data de Registro (referência)
  date_issue: string; // Data de Lançamento / Emissão
  date_due: string; // Data de Vencimento
  date_payment?: string; // Data de Recebimento

  // Valores
  value_gross: number;
  value_discount: number;
  value_interest_penalty: number;
  value_fees: number;
  
  // Impostos Retidos
  tax_pis: number;
  tax_cofins: number;
  tax_iss: number;
  tax_inss: number;
  tax_irrf: number;
  tax_retained_total: number;

  // Impostos Trimestrais Apurados
  tax_irpj_quarterly: number;
  tax_csll_quarterly: number;
  tax_irpj_excedente: number;

  value_net: number; // Líquido Real
  status: 'EM_ABERTO' | 'RECEBIDO' | 'CANCELADO';

  commission: BillingCommissionConfig;
  segment_allocations: SegmentAllocationType[];
}

export interface BillingAuditEntry {
  id: string;
  sync_timestamp: string;
  omie_id: number;
  invoice_number: string;
  company_name: 'Mar Brasil' | 'DZM';
  change_type: AuditChangeType;
  change_description: string;
  old_data?: Partial<BillingItem>;
  new_data: Partial<BillingItem>;
  audit_status: AuditStatus;
}

export interface BillingFilterState {
  company: 'ALL' | 'Mar Brasil' | 'DZM';
  date_type: DateReferenceType;
  start_date: string;
  end_date: string;
  segment: 'ALL' | SegmentType;
  is_outsourced: 'ALL' | 'YES' | 'NO';
  client: string;
  has_commission: 'ALL' | 'YES' | 'NO';
  search: string;
}

export interface BillingKpiSummary {
  total_count: number;
  total_gross: number;
  total_retained_taxes: number;
  total_quarterly_taxes: number;
  total_net: number;
  total_commissions: number;
  total_discount: number;
  total_fees: number;
  
  gross_b2g: number;
  gross_b2b: number;
  gross_b2c: number;
  gross_outsourced: number;

  pct_b2g: number;
  pct_b2b: number;
  pct_b2c: number;
  pct_outsourced: number;
}
