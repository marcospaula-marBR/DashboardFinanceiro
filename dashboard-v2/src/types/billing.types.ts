/**
/**
 * TYPES DEFINITION: DASHBOARD DE FATURAMENTOS v.02.54.00
 * Suporte a múltiplos tipos de data, impostos retidos/apurados trimestrais (IRPJ/CSLL),
 * reforma LC 224/2025, comissões com vínculo ao People Board e rateios por segmento.
 */

export type DateReferenceType = 'date_registration' | 'date_issue' | 'date_due' | 'date_payment';

export type SegmentType = 'B2G' | 'B2B' | 'B2C';

export type SegmentAllocationType = SegmentType | 'Terceirização';

export interface CommissionParticipant {
  id: string; // Employee ID from People or Sector Code
  name: string; // Name or Sector Name
  sector?: string;
  is_sector_rule?: boolean;
  type: 'percent' | 'fixed';
  rate: number; // % or R$
  calculated_value: number; // Computed R$ value
}

export interface BillingCommissionConfig {
  has_commission: boolean;
  value_non_commissionable: number;
  value_commissionable_base: number; // (Value Net - Non Commissionable)
  total_commission_percent: number;
  total_commission_value: number;
  participants: CommissionParticipant[];
}

export interface BillingQuarterlyTaxes {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; // Q1 (Jan-Mar), Q2 (Abr-Jun), Q3 (Jul-Set), Q4 (Out-Dez)
  year: number;
  rule_version: 'LEGACY_2025' | 'LC_224_2026'; // Diferenciação pré-2026 e pós-2026
  due_month_label: string; // Abril, Julho, Outubro, Janeiro
  due_date: string; // YYYY-MM-DD
  gross_revenue_quarter: number;
  irpj_base: number;
  irpj_regular: number; // 15%
  irpj_excedente: number; // Adicional 10% acima de R$ 60k no trimestre
  csll_regular: number; // 9%
  total_quarterly_tax: number;
}

export interface BillingItem {
  id: string;
  omie_id?: number;
  company_name: 'Mar Brasil' | 'DZM';
  invoice_number: string; // NF / OS / RPS
  contract_number?: string; // Número do Contrato / Pedido
  contract_name: string; // Projeto / Contrato Omie
  client_id?: number;
  client_name: string; // Razão Social do Omie
  client_cnpj_cpf?: string;
  
  segment_type: SegmentType;
  is_outsourced: boolean; // Terceirização: Sim ou Não
  service_description?: string;
  city_of_service?: string;

  // Datas
  date_registration: string; // Data de Registro (referência)
  date_issue: string; // Data de Lançamento / Emissão
  date_due: string; // Data de Vencimento
  date_payment?: string; // Data de Recebimento

  // Valores Financeiros
  value_gross: number; // Valor Faturado Bruto
  value_discount: number; // Descontos concedidos
  value_interest_penalty: number; // Juros & Multas acrescidos
  value_fees: number; // Tarifas & Taxas
  
  // Impostos Retidos
  tax_pis: number;
  tax_cofins: number;
  tax_iss: number;
  tax_inss: number;
  tax_irrf: number;
  tax_retained_total: number;

  // Impostos Trimestrais Apurados (Alocados Proporcionalmente)
  tax_irpj_quarterly: number;
  tax_csll_quarterly: number;
  tax_irpj_excedente: number;

  // Resultado Líquido
  value_net: number; // Líquido Real (Bruto - Impostos Retidos - Tarifas + Juros/Multa - Desconto)

  // Comissões
  commission: BillingCommissionConfig;

  // Marcadores de Rateio de Despesas por Segmento
  segment_allocations: SegmentAllocationType[];
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
  
  // Totais por Segmento
  gross_b2g: number;
  gross_b2b: number;
  gross_b2c: number;
  gross_outsourced: number;

  // Percentual de Representatividade para Rateio de Despesas
  pct_b2g: number;
  pct_b2b: number;
  pct_b2c: number;
  pct_outsourced: number;
}
