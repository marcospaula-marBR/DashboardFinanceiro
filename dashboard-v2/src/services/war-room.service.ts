/**
 * War Room Service — Lousa Digital Operacional (Modo TV)
 * Gerenciamento de Obrigações, 5 Pilares, Follow The Money e Seguros
 * @version v.02.59.22
 */

import { supabase } from '@/lib/supabase';
import { fetchInsurancePolicies } from './insurance.service';
import {
  WarRoomObligation,
  StrategicPillar,
  FollowTheMoneyFlow,
  InsuranceExpiringAlert,
  WarRoomSummaryCounters,
  ObligationStatus,
  WarRoomCompany,
} from '@/types/war-room';

const STORAGE_KEY_OBLIGATIONS = 'marbrasil_warroom_obligations_v1';
const STORAGE_KEY_PILLARS = 'marbrasil_warroom_pillars_v1';
const STORAGE_KEY_FLOW = 'marbrasil_warroom_flow_v1';

// ── SEMENTE INICIAL DE OBRIGAÇÕES DAS 4 EMPRESAS (Omie) ──
export const INITIAL_OBLIGATIONS: WarRoomObligation[] = [
  // Bloco 01 a 05
  { id: 'ob-1', titulo: 'Folha Salarial Líquida', diaVencimento: 5, empresa: 'MarBR', valor: 84500.00, categoria: 'Pessoal', status: 'pendente', recorrente: true },
  { id: 'ob-2', titulo: 'Folha Salarial & Prestadores', diaVencimento: 5, empresa: 'DZM', valor: 32400.00, categoria: 'Pessoal', status: 'pendente', recorrente: true },
  { id: 'ob-3', titulo: 'Pró-Labore & Retiradas', diaVencimento: 5, empresa: 'G2', valor: 18200.00, categoria: 'Sócios', status: 'pendente', recorrente: true },
  { id: 'ob-4', titulo: 'Serviços de Infraestrutura TI', diaVencimento: 4, empresa: 'Conectius', valor: 4890.00, categoria: 'Tecnologia', status: 'pendente', recorrente: true },

  // Bloco 06 a 10
  { id: 'ob-5', titulo: 'FGTS Digital Mensal', diaVencimento: 7, empresa: 'MarBR', valor: 12450.00, categoria: 'Encargos', status: 'pendente', recorrente: true },
  { id: 'ob-6', titulo: 'FGTS Digital Mensal', diaVencimento: 7, empresa: 'DZM', valor: 5630.00, categoria: 'Encargos', status: 'pendente', recorrente: true },
  { id: 'ob-7', titulo: 'Fatura Cartão Corporativo Clara', diaVencimento: 10, empresa: 'MarBR', valor: 38750.40, categoria: 'Cartões', status: 'pendente', recorrente: true },
  { id: 'ob-8', titulo: 'Fatura Cartão Bradesco PJ', diaVencimento: 10, empresa: 'DZM', valor: 14200.00, categoria: 'Cartões', status: 'pendente', recorrente: true },
  { id: 'ob-9', titulo: 'Contas de Consumo (Luz, Água, Telecom)', diaVencimento: 10, empresa: 'G2', valor: 3890.00, categoria: 'Utilidades', status: 'pendente', recorrente: true },

  // Bloco 11 a 15
  { id: 'ob-10', titulo: 'Mensalidade ERP Omie', diaVencimento: 15, empresa: 'MarBR', valor: 2890.00, categoria: 'Software', status: 'pendente', recorrente: true },
  { id: 'ob-11', titulo: 'Honorários Contábeis & Fiscais', diaVencimento: 15, empresa: 'MarBR', valor: 7500.00, categoria: 'Contabilidade', status: 'pendente', recorrente: true },
  { id: 'ob-12', titulo: 'Honorários Contabilidade Realcontábil', diaVencimento: 15, empresa: 'DZM', valor: 4200.00, categoria: 'Contabilidade', status: 'pendente', recorrente: true },
  { id: 'ob-13', titulo: 'Licenças Microsoft 365 & Nuvem', diaVencimento: 12, empresa: 'Conectius', valor: 1950.00, categoria: 'Tecnologia', status: 'pendente', recorrente: true },

  // Bloco 16 a 20
  { id: 'ob-14', titulo: 'DAS - Simples Nacional', diaVencimento: 20, empresa: 'MarBR', valor: 42300.00, categoria: 'Impostos', status: 'pendente', recorrente: true },
  { id: 'ob-15', titulo: 'DAS - Simples Nacional', diaVencimento: 20, empresa: 'DZM', valor: 16800.00, categoria: 'Impostos', status: 'pendente', recorrente: true },
  { id: 'ob-16', titulo: 'DCTFWeb / INSS Patronal', diaVencimento: 20, empresa: 'MarBR', valor: 21900.00, categoria: 'Impostos', status: 'pendente', recorrente: true },
  { id: 'ob-17', titulo: 'Adiantamento Quinzenal (Vales)', diaVencimento: 20, empresa: 'G2', valor: 9800.00, categoria: 'Pessoal', status: 'pendente', recorrente: true },

  // Bloco 21 a 25
  { id: 'ob-18', titulo: 'Vale Transporte (VT) & Alimentação (VA)', diaVencimento: 25, empresa: 'MarBR', valor: 18600.00, categoria: 'Benefícios', status: 'pendente', recorrente: true },
  { id: 'ob-19', titulo: 'Benefícios Flash Benefícios', diaVencimento: 25, empresa: 'DZM', valor: 8400.00, categoria: 'Benefícios', status: 'pendente', recorrente: true },
  { id: 'ob-20', titulo: 'Locação Imóvel Sede & Galpão', diaVencimento: 22, empresa: 'MarBR', valor: 15000.00, categoria: 'Instalações', status: 'pendente', recorrente: true },

  // Bloco 26 a 31
  { id: 'ob-21', titulo: 'Parcelamento Tributário PGFN', diaVencimento: 30, empresa: 'MarBR', valor: 9450.00, categoria: 'Parcelamentos', status: 'pendente', recorrente: true },
  { id: 'ob-22', titulo: 'Parcelamento Especial Receita', diaVencimento: 30, empresa: 'DZM', valor: 4300.00, categoria: 'Parcelamentos', status: 'pendente', recorrente: true },
  { id: 'ob-23', titulo: 'Provisões & Fechamento Contábil', diaVencimento: 28, empresa: 'G2', valor: 3500.00, categoria: 'Operacional', status: 'pendente', recorrente: true },
  { id: 'ob-24', titulo: 'Fechamento de Câmbio & Taxas', diaVencimento: 31, empresa: 'Conectius', valor: 6200.00, categoria: 'Câmbio', status: 'pendente', recorrente: true },
];

// ── SEMENTE INICIAL DOS 5 PILARES ESTRATÉGICOS ──
export const INITIAL_PILLARS: StrategicPillar[] = [
  {
    id: 'contabilidade',
    numero: 1,
    nome: 'Contabilidade & Governança',
    subtitulo: 'Conciliações, justificativas e ERP',
    icone: 'Landmark',
    itens: [
      { id: 'it-c1', pilarId: 'contabilidade', titulo: 'Justificativas de lançamentos Omie (competência corrente)', concluida: false, prioridade: 'critica', responsavel: 'Fiscal' },
      { id: 'it-c2', pilarId: 'contabilidade', titulo: 'Parametrização contábil de contas bancárias e cartões', concluida: true, prioridade: 'alta', responsavel: 'Controladoria' },
      { id: 'it-c3', pilarId: 'contabilidade', titulo: 'Conciliação extratos Bradesco, Itaú e Sicredi', concluida: false, prioridade: 'alta', responsavel: 'Financeiro' },
      { id: 'it-c4', pilarId: 'contabilidade', titulo: 'Envio de documentação mensal para a Realcontábil', concluida: false, prioridade: 'normal', responsavel: 'DP / Fiscal' },
    ],
  },
  {
    id: 'gateways',
    numero: 2,
    nome: 'Gateways & Meios de Pagamento',
    subtitulo: 'Credenciamento, adquirentes e antifraude',
    icone: 'CreditCard',
    itens: [
      { id: 'it-g1', pilarId: 'gateways', titulo: 'Validação cadastral de contas ativas e limites diários', concluida: true, prioridade: 'alta', responsavel: 'Operações' },
      { id: 'it-g2', pilarId: 'gateways', titulo: 'Auditoria de chargebacks e contestações pendentes', concluida: false, prioridade: 'critica', responsavel: 'Risco' },
      { id: 'it-g3', pilarId: 'gateways', titulo: 'Atualização contratual de taxas de antecipação (MDR)', concluida: false, prioridade: 'normal', responsavel: 'Diretoria' },
      { id: 'it-g4', pilarId: 'gateways', titulo: 'Homologação de novo gateway de contingência', concluida: false, prioridade: 'alta', responsavel: 'TI / Fintech' },
    ],
  },
  {
    id: 'cambio',
    numero: 3,
    nome: 'Fluxos Internacionais & Câmbio',
    subtitulo: 'Liquidação, split e compliance de remessas',
    icone: 'Globe',
    itens: [
      { id: 'it-i1', pilarId: 'cambio', titulo: 'Acompanhamento do spread e cotação USD/BRL nas liquidações', concluida: false, prioridade: 'alta', responsavel: 'Mesa Câmbio' },
      { id: 'it-i2', pilarId: 'cambio', titulo: 'Validação de invoices e comprovantes de transferência', concluida: false, prioridade: 'critica', responsavel: 'Controladoria' },
      { id: 'it-i3', pilarId: 'cambio', titulo: 'Checklist de rotas de split de pagamentos entre contas', concluida: true, prioridade: 'normal', responsavel: 'Finanças' },
      { id: 'it-i4', pilarId: 'cambio', titulo: 'Auditoria de contratos de câmbio fechados no mês', concluida: false, prioridade: 'normal', responsavel: 'Jurídico' },
    ],
  },
  {
    id: 'remessa',
    numero: 4,
    nome: 'Remessa Conforme & Regularidade',
    subtitulo: 'Demandas jurídicas, correios e Receita',
    icone: 'FileCheck',
    itens: [
      { id: 'it-r1', pilarId: 'remessa', titulo: 'Certidões Negativas de Débitos (CNDs Federal, Estadual e Municipal)', concluida: true, prioridade: 'critica', responsavel: 'Jurídico' },
      { id: 'it-r2', pilarId: 'remessa', titulo: 'Acompanhamento de processos administrativos e notificações', concluida: false, prioridade: 'alta', responsavel: 'Compliance' },
      { id: 'it-r3', pilarId: 'remessa', titulo: 'Auditoria de remessas em trânsito com órgãos alfandegários', concluida: false, prioridade: 'alta', responsavel: 'Logística' },
      { id: 'it-r4', pilarId: 'remessa', titulo: 'Renovação de procurações eletrônicas e certificados digitais', concluida: true, prioridade: 'normal', responsavel: 'TI' },
    ],
  },
  {
    id: 'lancamentos',
    numero: 5,
    nome: 'Planejamento & Recorrentes',
    subtitulo: 'Provisões do ERP e ciclos futuros',
    icone: 'CalendarClock',
    itens: [
      { id: 'it-l1', pilarId: 'lancamentos', titulo: 'Lançamento de provisões de despesas fixas para M+1 no Omie', concluida: false, prioridade: 'alta', responsavel: 'Financeiro' },
      { id: 'it-l2', pilarId: 'lancamentos', titulo: 'Revisão de contratos com fornecedores recorrentes', concluida: false, prioridade: 'normal', responsavel: 'Compras' },
      { id: 'it-l3', pilarId: 'lancamentos', titulo: 'Planejamento orçamentário dos centros de custo para o trimestre', concluida: true, prioridade: 'alta', responsavel: 'CFO' },
      { id: 'it-l4', pilarId: 'lancamentos', titulo: 'Reconciliação de previsões x realizado da última competência', concluida: false, prioridade: 'critica', responsavel: 'Controladoria' },
    ],
  },
];

// ── SEMENTE INICIAL DO FOLLOW THE MONEY ──
export const INITIAL_FLOW: FollowTheMoneyFlow = {
  origemNome: 'Operações / Clientes Globais',
  origemValor: 250000.00,
  processadoraNome: 'Gateway & Adquirentes',
  processadoraTaxa: 2.8,
  intermediariaNome: 'Conta Transição Câmbio (USD)',
  intermediariaValor: 243000.00,
  contaFinalNome: 'Liquidação Bancária Omie (BRL)',
  contaFinalValor: 1324350.00,
  taxaPercentualGlobal: 3.85,
  moedaReferencia: 'USD/BRL',
  cotacaoUSD: 5.48,
  variacaoUSD: 0.32,
  ultimaAtualizacao: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
};

export class WarRoomService {
  /**
   * Recalcula o status dinâmico de cada obrigação com base na data do sistema
   */
  static evaluateObligationStatus(ob: WarRoomObligation, hoje: Date = new Date()): ObligationStatus {
    if (ob.status === 'pago') return 'pago';

    const diaAtual = hoje.getDate();
    if (ob.diaVencimento === diaAtual) {
      return 'hoje';
    } else if (ob.diaVencimento < diaAtual) {
      return 'atrasado';
    } else {
      return 'pendente';
    }
  }

  /**
   * Carrega as obrigações salvas ou inicializa com a semente
   */
  static getObligations(): WarRoomObligation[] {
    if (typeof window === 'undefined') return INITIAL_OBLIGATIONS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_OBLIGATIONS);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_OBLIGATIONS, JSON.stringify(INITIAL_OBLIGATIONS));
        return INITIAL_OBLIGATIONS.map(ob => ({ ...ob, status: this.evaluateObligationStatus(ob) }));
      }
      const parsed: WarRoomObligation[] = JSON.parse(stored);
      return parsed.map(ob => ({
        ...ob,
        status: ob.status === 'pago' ? 'pago' : this.evaluateObligationStatus(ob),
      }));
    } catch {
      return INITIAL_OBLIGATIONS;
    }
  }

  /**
   * Salva as obrigações no localStorage
   */
  static saveObligations(obligations: WarRoomObligation[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_OBLIGATIONS, JSON.stringify(obligations));
    } catch (e) {
      console.error('Erro ao salvar obrigações:', e);
    }
  }

  /**
   * Alterna status de uma obrigação (pago vs pendente)
   */
  static toggleObligationPaid(id: string): WarRoomObligation[] {
    const list = this.getObligations();
    const updated = list.map(item => {
      if (item.id === id) {
        const novoStatus = item.status === 'pago' ? this.evaluateObligationStatus(item) : 'pago';
        return { ...item, status: novoStatus };
      }
      return item;
    });
    this.saveObligations(updated);
    return updated;
  }

  /**
   * Adiciona nova obrigação
   */
  static addObligation(ob: Omit<WarRoomObligation, 'id' | 'status'>): WarRoomObligation[] {
    const list = this.getObligations();
    const newOb: WarRoomObligation = {
      ...ob,
      id: 'ob-' + Date.now(),
      status: 'pendente',
    };
    newOb.status = this.evaluateObligationStatus(newOb);
    const updated = [newOb, ...list];
    this.saveObligations(updated);
    return updated;
  }

  /**
   * Carrega os 5 Pilares Estratégicos
   */
  static getPillars(): StrategicPillar[] {
    if (typeof window === 'undefined') return INITIAL_PILLARS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PILLARS);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_PILLARS, JSON.stringify(INITIAL_PILLARS));
        return INITIAL_PILLARS;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_PILLARS;
    }
  }

  /**
   * Salva os Pilares Estratégicos
   */
  static savePillars(pillars: StrategicPillar[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_PILLARS, JSON.stringify(pillars));
    } catch (e) {
      console.error('Erro ao salvar pilares:', e);
    }
  }

  /**
   * Alterna checklist de uma tarefa nos pilares
   */
  static toggleDemandItem(itemId: string): StrategicPillar[] {
    const pillars = this.getPillars();
    const updated = pillars.map(pilar => ({
      ...pilar,
      itens: pilar.itens.map(item => {
        if (item.id === itemId) {
          return { ...item, concluida: !item.concluida };
        }
        return item;
      }),
    }));
    this.savePillars(updated);
    return updated;
  }

  /**
   * Adiciona nova demanda a um pilar
   */
  static addDemandItem(pilarId: string, itemData: { titulo: string; prioridade: 'critica' | 'alta' | 'normal'; responsavel?: string }): StrategicPillar[] {
    const pillars = this.getPillars();
    const updated = pillars.map(pilar => {
      if (pilar.id === pilarId) {
        const newItem = {
          id: 'it-' + Date.now(),
          pilarId: pilar.id,
          titulo: itemData.titulo,
          concluida: false,
          prioridade: itemData.prioridade,
          responsavel: itemData.responsavel || 'Equipe',
        };
        return { ...pilar, itens: [newItem, ...pilar.itens] };
      }
      return pilar;
    });
    this.savePillars(updated);
    return updated;
  }

  /**
   * Carrega Follow The Money
   */
  static getFlow(): FollowTheMoneyFlow {
    if (typeof window === 'undefined') return INITIAL_FLOW;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FLOW);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY_FLOW, JSON.stringify(INITIAL_FLOW));
        return INITIAL_FLOW;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_FLOW;
    }
  }

  /**
   * Salva Follow The Money
   */
  static saveFlow(flow: FollowTheMoneyFlow): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_FLOW, JSON.stringify(flow));
    } catch (e) {
      console.error('Erro ao salvar flow:', e);
    }
  }

  /**
   * Consulta cotação oficial do dólar em tempo real (AwesomeAPI)
   */
  static async fetchLiveUSDRate(): Promise<{ bid: number; pctChange: number }> {
    try {
      const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL', { next: { revalidate: 60 } });
      if (!res.ok) throw new Error('Falha na resposta da API de Câmbio');
      const data = await res.json();
      if (data && data.USDBRL) {
        return {
          bid: parseFloat(data.USDBRL.bid),
          pctChange: parseFloat(data.USDBRL.pctChange),
        };
      }
    } catch (err) {
      console.warn('[WarRoom] Cotação externa indisponível, usando fallback:', err);
    }
    return { bid: 5.48, pctChange: 0.15 };
  }

  /**
   * Consulta apólices reais no Supabase com vencimento nos próximos 30 dias
   */
  static async fetchExpiringInsurances(): Promise<InsuranceExpiringAlert[]> {
    try {
      const policies = await fetchInsurancePolicies({ mostrarInativos: false });
      
      const alerts: InsuranceExpiringAlert[] = policies
        .filter(p => p.vencimento && p.diasParaVencer !== undefined && p.diasParaVencer <= 30)
        .map(p => {
          const dias = p.diasParaVencer ?? 0;
          let faixa: 'critico' | 'atencao' | 'planejamento' = 'planejamento';
          if (dias < 10) faixa = 'critico';
          else if (dias <= 20) faixa = 'atencao';

          return {
            id: p.id,
            segurado: p.segurado || p.contratante,
            tipo: p.tipo,
            seguradora: p.seguradora || 'Seguradora Não Inf.',
            corretor: p.corretor,
            apolice: p.apolice,
            vencimento: p.vencimento!,
            diasRestantes: dias,
            premio: p.premio || 0,
            faixaAlerta: faixa,
          };
        })
        .sort((a, b) => a.diasRestantes - b.diasRestantes);

      return alerts;
    } catch (err) {
      console.error('[WarRoom] Erro ao buscar seguros em alerta:', err);
      return [];
    }
  }

  /**
   * Calcula os contadores de cabeçalho
   */
  static computeSummary(
    obligations: WarRoomObligation[],
    insuranceAlerts: InsuranceExpiringAlert[],
    pillars: StrategicPillar[]
  ): WarRoomSummaryCounters {
    const atrasadas = obligations.filter(o => o.status === 'atrasado');
    const hoje = obligations.filter(o => o.status === 'hoje');

    let demandasCriticas = 0;
    pillars.forEach(p => {
      p.itens.forEach(it => {
        if (!it.concluida && it.prioridade === 'critica') {
          demandasCriticas++;
        }
      });
    });

    return {
      atrasadosCount: atrasadas.length,
      atrasadosTotal: atrasadas.reduce((acc, curr) => acc + curr.valor, 0),
      vencendoHojeCount: hoje.length,
      vencendoHojeTotal: hoje.reduce((acc, curr) => acc + curr.valor, 0),
      segurosAlertaCount: insuranceAlerts.length,
      demandasCriticasCount: demandasCriticas,
    };
  }
}
