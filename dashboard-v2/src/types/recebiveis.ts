/**
 * TYPES DEFINITION: MÓDULO UNIFICADO DE RECEBÍVEIS & COMISSÕES v.02.56.00
 * Rota: /recebiveis
 */

export type SegmentType = 'B2G' | 'B2B' | 'B2C';

export type DateReferenceType = 'date_registration' | 'date_issue' | 'date_due' | 'date_payment';

export type AuditChangeType = 'NEW_INVOICE' | 'VALUE_CHANGE' | 'STATUS_CHANGE' | 'DATE_CHANGE';

export type AuditStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface CommissionParticipant {
  id: string; // Employee ID do People ou Código do Setor
  name: string; // Nome do Colaborador ou Setor
  sector?: string;
  is_sector_rule?: boolean;
  type: 'percent' | 'fixed';
  rate: number; // % ou R$
  calculated_value: number; // R$ apurado
}

export interface CommissionConfig {
  has_commission: boolean;
  commission_mode: 'percent' | 'fixed'; // Comissão em % do líquido ou Montante Fixo R$
  value_non_commissionable: number; // Valor R$ ou parcela do contrato que NÃO incide comissão
  value_commissionable_base: number; // Base Comissionável = (Líquido - Não Comissionável)
  total_commission_percent: number;
  total_commission_value: number;
  participants: CommissionParticipant[];
}

export interface CommissionableEmployee {
  id: string;
  full_name: string;
  department?: string;
  job_role?: string;
  commission_plan?: string;
  remuneration_commission?: number;
  has_commission_plan: boolean; // Flag inteligente de filtro People Board
  default_percent?: number;
}

export interface ContratoParam {
  id: string;
  company_name: 'Mar Brasil' | 'DZM';
  contract_number: string;
  contract_name: string;
  client_name: string;
  segment_type: SegmentType; // B2G, B2B, B2C
  is_outsourced: boolean; // Terceirização: Sim ou Não
  has_commission: boolean;
  commission_mode: 'percent' | 'fixed';
  value_non_commissionable: number;
  commission_rate: number;
  commission_participants: CommissionParticipant[];
  segment_allocations: SegmentType[];
}

export interface RecebimentoItem {
  id: string;
  omie_id?: number;
  source: 'OMIE' | 'MANUAL'; // Origem do lançamento
  company_name: 'Mar Brasil' | 'DZM';
  invoice_number: string; // NF / OS / RPS
  contract_id?: string;
  contract_number?: string;
  contract_name: string;
  client_id?: number;
  client_name: string;
  
  segment_type: SegmentType; // B2G, B2B, B2C
  is_outsourced: boolean; // Terceirização

  // Datas
  date_registration: string; // Data de Registro
  date_issue: string; // Data de Emissão / Lançamento
  date_due: string; // Data de Vencimento
  date_payment?: string; // Data de Recebimento / Baixa

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

  value_net: number; // Líquido Real
  status: 'Pendente' | 'Pago' | 'Cancelado';

  commission: CommissionConfig;
}

export interface RecebiveisAuditEntry {
  id: string;
  sync_timestamp: string;
  omie_id: number;
  invoice_number: string;
  company_name: 'Mar Brasil' | 'DZM';
  change_type: AuditChangeType;
  change_description: string;
  old_data?: Partial<RecebimentoItem>;
  new_data: Partial<RecebimentoItem>;
  audit_status: AuditStatus;
}

export interface RecebiveisFilters {
  company?: 'ALL' | 'Mar Brasil' | 'DZM';
  date_type?: DateReferenceType;
  startDate?: string;
  endDate?: string;
  ciclo?: string;
  contratoId?: string;
  membroId?: string;
  segment?: 'ALL' | SegmentType;
  is_outsourced?: 'ALL' | 'YES' | 'NO';
  search?: string;
}

export interface RecebiveisKpiSummary {
  total_count: number;
  total_gross: number;
  total_retained_taxes: number;
  total_net: number;
  total_commissions: number;
  total_pending_commissions: number;
  total_paid_commissions: number;
  gross_b2g: number;
  gross_b2b: number;
  gross_b2c: number;
  gross_outsourced: number;
}
