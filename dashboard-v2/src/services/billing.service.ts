import { supabase } from '@/lib/supabase';
import {
  BillingItem,
  BillingFilterState,
  BillingKpiSummary,
  BillingQuarterlyTaxes,
  DateReferenceType
} from '@/types/billing.types';

const STORAGE_KEY_CUSTOM = 'mar_brasil_billing_custom_overrides_v1';

/**
 * SERVIÇO DE FATURAMENTO - DASHBOARD FINANCEIRO MAR BRASIL
 */
export class BillingService {

  /**
   * Carrega e aplica os overrides customizados salvos localmente ou no banco
   */
  private static getCustomOverrides(): Record<string, Partial<BillingItem>> {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CUSTOM);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Salva alterações customizadas em um item de faturamento (ex: segmento, terceirização, comissões)
   */
  public static saveItemOverride(id: string, updates: Partial<BillingItem>): void {
    if (typeof window === 'undefined') return;
    try {
      const overrides = this.getCustomOverrides();
      overrides[id] = { ...(overrides[id] || {}), ...updates };
      localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(overrides));
    } catch (e) {
      console.error('Erro ao salvar override de faturamento:', e);
    }
  }

  /**
   * Gera dados demonstrativos reais/mock para o módulo de Faturamento
   */
  public static getMockBillingItems(): BillingItem[] {
    const overrides = this.getCustomOverrides();

    const rawItems: Partial<BillingItem>[] = [
      {
        id: 'fat-001',
        omie_id: 7663788477,
        company_name: 'Mar Brasil',
        invoice_number: 'NFS-e 157',
        contract_number: '01/2024',
        contract_name: 'Rossi Advogados - Manutenção Ar',
        client_id: 7660973589,
        client_name: 'Rossi Advogados Associados',
        client_cnpj_cpf: '12.345.678/0001-90',
        segment_type: 'B2B',
        is_outsourced: false,
        service_description: 'Plano de Manutenção Operação e Controle (PMOC) - Ar Condicionado',
        city_of_service: 'Praia Grande (SP)',
        date_registration: '2026-05-31',
        date_issue: '2026-06-02',
        date_due: '2026-06-15',
        date_payment: '2026-06-14',
        value_gross: 8500.00,
        value_discount: 0,
        value_interest_penalty: 0,
        value_fees: 25.00,
        tax_pis: 55.25,
        tax_cofins: 255.00,
        tax_iss: 170.00,
        tax_inss: 0,
        tax_irrf: 127.50,
        segment_allocations: ['B2B']
      },
      {
        id: 'fat-002',
        omie_id: 7663788478,
        company_name: 'Mar Brasil',
        invoice_number: 'NFS-e 158',
        contract_number: '04/2025',
        contract_name: 'Prefeitura Municipal de Santos - Climatização',
        client_id: 7662669284,
        client_name: 'Prefeitura Municipal de Santos',
        client_cnpj_cpf: '46.723.120/0001-33',
        segment_type: 'B2G',
        is_outsourced: true,
        service_description: 'Instalação e Adequação HVAC em Prédio Público Central',
        city_of_service: 'Santos (SP)',
        date_registration: '2026-06-02',
        date_issue: '2026-06-02',
        date_due: '2026-06-20',
        date_payment: '2026-06-18',
        value_gross: 48500.00,
        value_discount: 500.00,
        value_interest_penalty: 0,
        value_fees: 110.00,
        tax_pis: 315.25,
        tax_cofins: 1455.00,
        tax_iss: 970.00,
        tax_inss: 533.50,
        tax_irrf: 727.50,
        segment_allocations: ['B2G', 'Terceirização']
      },
      {
        id: 'fat-003',
        omie_id: 7663788479,
        company_name: 'DZM',
        invoice_number: 'NFS-e 159',
        contract_number: '08/2025',
        contract_name: 'Condomínio Residencial Bella Vista',
        client_id: 7662669290,
        client_name: 'Condomínio Residencial Bella Vista',
        client_cnpj_cpf: '58.112.449/0001-12',
        segment_type: 'B2C',
        is_outsourced: false,
        service_description: 'Higienização e Manutenção Preventiva dos Sistemas Condominiais',
        city_of_service: 'Guarujá (SP)',
        date_registration: '2026-06-10',
        date_issue: '2026-06-10',
        date_due: '2026-06-25',
        date_payment: '2026-06-24',
        value_gross: 12400.00,
        value_discount: 0,
        value_interest_penalty: 0,
        value_fees: 45.00,
        tax_pis: 80.60,
        tax_cofins: 372.00,
        tax_iss: 248.00,
        tax_inss: 0,
        tax_irrf: 186.00,
        segment_allocations: ['B2C']
      },
      {
        id: 'fat-004',
        omie_id: 7663788480,
        company_name: 'DZM',
        invoice_number: 'NFS-e 160',
        contract_number: '12/2025',
        contract_name: 'Hospital São Lucas - Salas Cirúrgicas',
        client_id: 7662669439,
        client_name: 'Hospital e Maternidade São Lucas S/A',
        client_cnpj_cpf: '60.988.123/0001-44',
        segment_type: 'B2B',
        is_outsourced: true,
        service_description: 'Filtragem Absoluta HEPA e Certificação de Qualidade do Ar',
        city_of_service: 'São Paulo (SP)',
        date_registration: '2026-07-01',
        date_issue: '2026-07-01',
        date_due: '2026-07-15',
        date_payment: undefined, // Em aberto
        value_gross: 76000.00,
        value_discount: 0,
        value_interest_penalty: 0,
        value_fees: 150.00,
        tax_pis: 494.00,
        tax_cofins: 2280.00,
        tax_iss: 1520.00,
        tax_inss: 836.00,
        tax_irrf: 1140.00,
        segment_allocations: ['B2B', 'Terceirização']
      },
      {
        id: 'fat-005',
        omie_id: 7663788481,
        company_name: 'Mar Brasil',
        invoice_number: 'NFS-e 161',
        contract_number: '15/2025',
        contract_name: 'Secretaria da Educação SP - Rede Escolar',
        client_id: 7662669313,
        client_name: 'Governo do Estado de São Paulo - SEDUC',
        client_cnpj_cpf: '46.377.222/0001-08',
        segment_type: 'B2G',
        is_outsourced: false,
        service_description: 'Manutenção de Climatização em Escolas Estaduais da Baixada',
        city_of_service: 'Santos (SP)',
        date_registration: '2026-07-10',
        date_issue: '2026-07-10',
        date_due: '2026-07-30',
        date_payment: undefined, // Em aberto
        value_gross: 94000.00,
        value_discount: 1000.00,
        value_interest_penalty: 0,
        value_fees: 200.00,
        tax_pis: 611.00,
        tax_cofins: 2820.00,
        tax_iss: 1880.00,
        tax_inss: 1034.00,
        tax_irrf: 1410.00,
        segment_allocations: ['B2G']
      }
    ];

    return rawItems.map(item => {
      const ov = overrides[item.id!] || {};
      const merged: BillingItem = {
        id: item.id!,
        omie_id: item.omie_id,
        company_name: ov.company_name || item.company_name || 'Mar Brasil',
        invoice_number: ov.invoice_number || item.invoice_number || 'NFS-e 000',
        contract_number: ov.contract_number || item.contract_number || 'N/A',
        contract_name: ov.contract_name || item.contract_name || 'Projeto Geral',
        client_id: item.client_id,
        client_name: ov.client_name || item.client_name || 'Cliente Indefinido',
        client_cnpj_cpf: ov.client_cnpj_cpf || item.client_cnpj_cpf,
        segment_type: ov.segment_type || item.segment_type || 'B2B',
        is_outsourced: ov.is_outsourced !== undefined ? ov.is_outsourced : (item.is_outsourced || false),
        service_description: ov.service_description || item.service_description,
        city_of_service: ov.city_of_service || item.city_of_service,

        date_registration: ov.date_registration || item.date_registration || '2026-01-01',
        date_issue: ov.date_issue || item.date_issue || '2026-01-01',
        date_due: ov.date_due || item.date_due || '2026-01-15',
        date_payment: ov.date_payment || item.date_payment,

        value_gross: ov.value_gross ?? item.value_gross ?? 0,
        value_discount: ov.value_discount ?? item.value_discount ?? 0,
        value_interest_penalty: ov.value_interest_penalty ?? item.value_interest_penalty ?? 0,
        value_fees: ov.value_fees ?? item.value_fees ?? 0,

        tax_pis: ov.tax_pis ?? item.tax_pis ?? 0,
        tax_cofins: ov.tax_cofins ?? item.tax_cofins ?? 0,
        tax_iss: ov.tax_iss ?? item.tax_iss ?? 0,
        tax_inss: ov.tax_inss ?? item.tax_inss ?? 0,
        tax_irrf: ov.tax_irrf ?? item.tax_irrf ?? 0,

        tax_retained_total: 0,
        tax_irpj_quarterly: 0,
        tax_csll_quarterly: 0,
        tax_irpj_excedente: 0,
        value_net: 0,

        commission: ov.commission || item.commission || {
          has_commission: true,
          value_non_commissionable: 0,
          value_commissionable_base: 0,
          total_commission_percent: 5,
          total_commission_value: 0,
          participants: [
            {
              id: 'emp-01',
              name: 'Gabriel Bellini',
              sector: 'Comercial',
              type: 'percent',
              rate: 3,
              calculated_value: 0
            },
            {
              id: 'emp-02',
              name: 'Equipe Operacional',
              sector: 'Operações',
              is_sector_rule: true,
              type: 'percent',
              rate: 2,
              calculated_value: 0
            }
          ]
        },

        segment_allocations: ov.segment_allocations || item.segment_allocations || ['B2B']
      };

      // Cálculo de Impostos Retidos e Líquido
      merged.tax_retained_total = merged.tax_pis + merged.tax_cofins + merged.tax_iss + merged.tax_inss + merged.tax_irrf;
      merged.value_net = merged.value_gross - merged.tax_retained_total - merged.value_fees - merged.value_discount + merged.value_interest_penalty;

      // Base comissionável (Líquido - Não comissionável)
      const nonComm = merged.commission?.value_non_commissionable || 0;
      merged.commission.value_commissionable_base = Math.max(0, merged.value_net - nonComm);

      // Recalcular comissões
      const baseComm = merged.commission.value_commissionable_base;
      let totalCommValue = 0;

      if (merged.commission.has_commission && merged.commission.participants) {
        merged.commission.participants = merged.commission.participants.map(p => {
          let val = 0;
          if (p.type === 'percent') {
            val = (baseComm * (p.rate || 0)) / 100;
          } else {
            val = p.rate || 0;
          }
          totalCommValue += val;
          return { ...p, calculated_value: val };
        });
        merged.commission.total_commission_value = totalCommValue;
        merged.commission.total_commission_percent = baseComm > 0 ? (totalCommValue / baseComm) * 100 : 0;
      } else {
        merged.commission.total_commission_value = 0;
      }

      return merged;
    });
  }

  /**
   * Filtra os lançamentos com base no estado de filtros fornecido
   */
  public static filterBillingItems(items: BillingItem[], filter: BillingFilterState): BillingItem[] {
    return items.filter(item => {
      // Empresa
      if (filter.company !== 'ALL' && item.company_name !== filter.company) return false;

      // Segmento
      if (filter.segment !== 'ALL' && item.segment_type !== filter.segment) return false;

      // Terceirização
      if (filter.is_outsourced === 'YES' && !item.is_outsourced) return false;
      if (filter.is_outsourced === 'NO' && item.is_outsourced) return false;

      // Comissões
      if (filter.has_commission === 'YES' && !item.commission.has_commission) return false;
      if (filter.has_commission === 'NO' && item.commission.has_commission) return false;

      // Cliente
      if (filter.client && item.client_name.toLowerCase() !== filter.client.toLowerCase()) return false;

      // Datas
      const targetDate = item[filter.date_type];
      if (targetDate) {
        if (filter.start_date && targetDate < filter.start_date) return false;
        if (filter.end_date && targetDate > filter.end_date) return false;
      }

      // Busca de Texto Livre
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const matchInvoice = item.invoice_number.toLowerCase().includes(q);
        const matchClient = item.client_name.toLowerCase().includes(q);
        const matchContract = item.contract_name.toLowerCase().includes(q);
        const matchCity = (item.city_of_service || '').toLowerCase().includes(q);
        if (!matchInvoice && !matchClient && !matchContract && !matchCity) return false;
      }

      return true;
    });
  }

  /**
   * Computa os indicadores resumidos (KPI Cards) e o percentual de representatividade por segmento
   */
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
      summary.total_commissions += item.commission.has_commission ? item.commission.total_commission_value : 0;
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

    // Cálculo estimado de impostos trimestrais apurados (IRPJ 15% + CSLL 9% + Adicional IRPJ 10% se exceder R$ 60k no trimestre)
    const quarterlyTax = this.computeQuarterlyTaxes(items);
    summary.total_quarterly_taxes = quarterlyTax.reduce((acc, q) => acc + q.total_quarterly_tax, 0);

    return summary;
  }

  /**
   * Computa a apuração trimestral de impostos (IRPJ / CSLL / LC 224/2025 Excedente)
   * Regra de vencimentos:
   * - Q1 (Jan - Mar) -> Vencimento em 30 de Abril
   * - Q2 (Abr - Jun) -> Vencimento em 31 de Julho
   * - Q3 (Jul - Set) -> Vencimento em 31 de Outubro
   * - Q4 (Out - Dez) -> Vencimento em 31 de Janeiro (ano seguinte)
   */
  public static computeQuarterlyTaxes(items: BillingItem[], year: number = 2026): BillingQuarterlyTaxes[] {
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
      
      // Presunção de Lucro Presumido para Serviços (32% sobre a receita bruta)
      const presumedProfit = gross * 0.32;
      const irpjRegular = presumedProfit * 0.15; // 15% IRPJ
      const csllRegular = presumedProfit * 0.09; // 9% CSLL

      // Adicional IRPJ (10% sobre o lucro presumido que exceder R$ 60.000,00 no trimestre / Reforma LC 224/2025)
      const excessLimit = 60000;
      const irpjExcedente = Math.max(0, (presumedProfit - excessLimit) * 0.10);

      const totalTax = irpjRegular + csllRegular + irpjExcedente;

      return {
        quarter: qKey,
        year,
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
