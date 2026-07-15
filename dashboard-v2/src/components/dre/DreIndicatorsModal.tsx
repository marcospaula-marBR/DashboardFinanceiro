import React, { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, Users, Wrench, ShieldCheck, Percent, Coins, Landmark, Info, ArrowUpRight, ArrowDownRight, BarChart3, PieChart, Activity, Zap, FileText, Calculator, Calendar } from 'lucide-react';
import { DreCalculatedResult, DreFilters } from '@/types/dre';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface DreIndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: DreCalculatedResult | null;
  filters: DreFilters;
}

export function DreIndicatorsModal({ isOpen, onClose, results, filters }: DreIndicatorsModalProps) {
  const [viewMode, setViewMode] = useState<'total' | 'equipment'>('total');
  const [selectedIndicator, setSelectedIndicator] = useState<string>('1. Margem Bruta');
  const [activeComposition, setActiveComposition] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    }
    return () => setMounted(false);
  }, [isOpen]);

  if (!isOpen || !results) return null;

  const { kpis, totais, validColumns } = results;
  const totalEquipamentos = kpis.totalEquipamentos || kpis.averageMachines || 1;
  const divisor = viewMode === 'equipment' ? (totalEquipamentos > 0 ? totalEquipamentos : 1) : 1;

  const formatValue = (value: number, type: 'currency' | 'percent' | 'decimal' = 'currency', customDivisor: number = divisor) => {
    if (type === 'percent') {
      return `${value.toFixed(1).replace('.', ',')}%`;
    }
    if (type === 'decimal') {
      return `${value.toFixed(2).replace('.', ',')}x`;
    }
    
    const adjustedValue = value / customDivisor;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: viewMode === 'equipment' ? 2 : 0,
    }).format(adjustedValue);
  };

  // Helper safely retrieving values from DRE totals
  const getDRETotal = (key: string) => totais[key] || 0;

  // --- CALCULATION OF THE 10 FINANCIAL INDICATORS (FROM SCRIPT_V2.JS) ---
  const val_receita_bruta = getDRETotal('Receita Bruta de Vendas');
  const val_receitas_indiretas = getDRETotal('Receitas Indiretas');
  const val_impostos_vendas = getDRETotal('Impostos');
  const val_irpj_csll = getDRETotal('Provisão - IRPJ e CSSL Trimestral') || getDRETotal('Provisão IRPJ e CSSL Trimestral');

  // 1. Receita Líquida
  const receita_liquida = (val_receita_bruta + val_receitas_indiretas) - val_impostos_vendas;
  const RL = receita_liquida !== 0 ? receita_liquida : 1; // Avoid division by zero

  // 2. Custos e Despesas Variáveis
  const val_despesas_variaveis = getDRETotal('Despesas Variáveis');
  const val_intermediacao = getDRETotal('Intermediação de Negócios');
  const custos_despesas_variaveis = kpis.totalCustos + val_despesas_variaveis + val_intermediacao;

  // 3. Lucro Bruto
  const lucro_bruto = receita_liquida - kpis.totalCustos;

  // 4. Despesas Operacionais (Fixas/Gerais)
  const val_despesas_financeiras = getDRETotal('Despesas Financeiras');
  const val_dividendos = getDRETotal('Distribuição de Dividendos') + getDRETotal('Dividendos');
  const despesas_operacionais = kpis.totalDespesas - val_despesas_financeiras - val_dividendos - val_despesas_variaveis - val_intermediacao;

  // 5. EBIT & EBITDA
  const ebit = lucro_bruto - despesas_operacionais;
  const ebitda = ebit; // As defined in legacy script: EBITDA = EBIT (depreciation not explicitly separated)

  // 6. Resultado Financeiro
  const val_receitas_financeiras = getDRETotal('Receitas Financeiras');
  const resultado_financeiro = val_receitas_financeiras - val_despesas_financeiras;

  // 7. LAIR
  const val_outras_receitas = getDRETotal('Outras Receitas') + getDRETotal('Honorários') + getDRETotal('Juros e devoluções') + getDRETotal('Juros e Devoluções') + getDRETotal('Recuperação de Despesas Variáveis');
  const lair = ebit + resultado_financeiro + val_outras_receitas;

  // 8. Lucro Líquido
  const lucro_liquido = lair - val_irpj_csll;

  // 9. Margem de Contribuição
  const margem_contribuicao_valor = receita_liquida - custos_despesas_variaveis;

  // 10. GAO
  const gao = ebit !== 0 ? margem_contribuicao_valor / ebit : 0;

  // --- EVALUATION / STATUS BENCHMARKS ---
  const getStatus = (title: string, value: number) => {
    switch (title) {
      case '1. Margem Bruta':
        if (value >= 35) return { label: 'Bom', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (value >= 25) return { label: 'Atenção', color: 'bg-amber-100 text-amber-855 border-amber-200' };
        return { label: 'Crítico', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case '2. Margem de Contribuição':
        if (value >= 40) return { label: 'Bom', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (value >= 30) return { label: 'Atenção', color: 'bg-amber-100 text-amber-855 border-amber-200' };
        return { label: 'Crítico', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case '3. Margem Operacional':
        if (value >= 15) return { label: 'Bom', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (value >= 8) return { label: 'Atenção', color: 'bg-amber-100 text-amber-855 border-amber-200' };
        return { label: 'Crítico', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case '4. EBITDA':
        if (value > 0) return { label: 'Bom', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        return { label: 'Crítico', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case '5. Margem EBITDA':
        if (value >= 20) return { label: 'Bom', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (value >= 10) return { label: 'Atenção', color: 'bg-amber-100 text-amber-855 border-amber-200' };
        return { label: 'Crítico', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case '6. Resultado Financeiro':
        if (value >= 0) return { label: 'Bom', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        return { label: 'Atenção', color: 'bg-amber-100 text-amber-855 border-amber-200' };
      case '7. Margem Antes do IR/CSLL':
        if (value >= 12) return { label: 'Bom', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (value >= 6) return { label: 'Atenção', color: 'bg-amber-100 text-amber-855 border-amber-200' };
        return { label: 'Crítico', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case '8. Margem Líquida':
        if (value >= 10) return { label: 'Bom', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (value >= 5) return { label: 'Atenção', color: 'bg-amber-100 text-amber-855 border-amber-200' };
        return { label: 'Crítico', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case '9. Índ. Despesas Operacionais':
        if (value <= 20) return { label: 'Bom', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (value <= 25) return { label: 'Atenção', color: 'bg-amber-100 text-amber-855 border-amber-200' };
        return { label: 'Crítico', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      case '10. GAO (Alavancagem Op.)':
        if (value >= 1 && value <= 2.5) return { label: 'Equilibrado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (value > 2.5 && value <= 3.5) return { label: 'Atenção', color: 'bg-amber-100 text-amber-855 border-amber-200' };
        return { label: 'Alto Risco', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      default:
        return null;
    }
  };

  // --- THE 10 FINANCIAL INDICATORS CARDS ---
  const financialIndicators = [
    {
      title: '1. Margem Bruta',
      value: (lucro_bruto / RL) * 100,
      type: 'percent' as const,
      formula: 'Lucro Bruto ÷ Rec. Líquida',
      desc: 'Eficiência da atividade principal',
      icon: <BarChart3 className="text-amber-500" size={16} />,
      color: 'border-amber-100 bg-amber-50/10 text-amber-950',
      chartColor: '#f59e0b',
      explanation: 'Mede o lucro da atividade principal após pagar os custos diretos da prestação dos serviços.',
      assessmentHelp: 'Bom: acima de 35%. Preocupante: abaixo de 25%. Valores baixos indicam que os custos do serviço estão altos ou o preço de venda está baixo.',
    },
    {
      title: '2. Margem de Contribuição',
      value: (margem_contribuicao_valor / RL) * 100,
      type: 'percent' as const,
      formula: '(Rec. Líq. - Var.) ÷ Rec. Líq.',
      desc: 'Cobertura de custos fixos e lucro',
      icon: <PieChart className="text-blue-500" size={16} />,
      color: 'border-blue-100 bg-blue-50/10 text-blue-950',
      chartColor: '#3b82f6',
      explanation: 'Quanto sobra das vendas para pagar os custos fixos (estrutura) e gerar lucro, após tirar os impostos e gastos variáveis.',
      assessmentHelp: 'Bom: acima de 40%. Preocupante: abaixo de 30%. Se for baixa, a empresa precisa vender muito mais para não ter prejuízo.',
    },
    {
      title: '3. Margem Operacional',
      value: (ebit / RL) * 100,
      type: 'percent' as const,
      formula: 'EBIT ÷ Receita Líquida',
      desc: 'Resultado da operação principal',
      icon: <Activity className="text-emerald-500" size={16} />,
      color: 'border-emerald-100 bg-emerald-50/10 text-emerald-950',
      chartColor: '#10b981',
      explanation: 'Rentabilidade operacional pura (EBIT), ou seja, a saúde financeira da operação antes dos custos financeiros e impostos.',
      assessmentHelp: 'Bom: acima de 15%. Preocupante: abaixo de 8%. Mostra se o negócio é sustentável no seu dia a dia.',
    },
    {
      title: '4. EBITDA',
      value: ebitda,
      type: 'currency' as const,
      formula: 'EBIT + Deprec. + Amort.',
      desc: 'Geração de caixa operacional',
      icon: <Activity className="text-emerald-600" size={16} />,
      color: 'border-emerald-200 bg-emerald-50/20 text-emerald-950',
      chartColor: '#059669',
      explanation: 'Geração de caixa operacional bruta. Mostra o potencial de caixa que a operação gera, sem considerar juros, impostos e depreciações.',
      assessmentHelp: 'Bom: maior que zero. Negativo indica que a operação está consumindo caixa e acumulando prejuízo operacional.',
    },
    {
      title: '5. Margem EBITDA',
      value: (ebitda / RL) * 100,
      type: 'percent' as const,
      formula: 'EBITDA ÷ Receita Líquida',
      desc: 'Eficiência operacional (Caixa)',
      icon: <ArrowUpRight className="text-emerald-500" size={16} />,
      color: 'border-emerald-100 bg-emerald-50/10 text-emerald-950',
      chartColor: '#34d399',
      explanation: 'Mede a eficiência operacional convertida em caixa. Indica a porcentagem da receita que vira caixa operacional bruto.',
      assessmentHelp: 'Bom: acima de 20%. Preocupante: abaixo de 10%. Valores baixos sugerem problemas de eficiência na operação.',
    },
    {
      title: '6. Índice de Custos Operacionais',
      value: (kpis.totalCustos / RL) * 100,
      type: 'percent' as const,
      formula: 'Custos Operacionais ÷ Receita Líquida',
      desc: 'Custos Operacionais / Receita',
      icon: <Activity className="text-rose-500" size={16} />,
      color: 'border-slate-200 bg-white text-slate-800',
      chartColor: '#f43f5e',
      explanation: 'Mostra quanto da receita é consumido pelos custos diretos e de intermediação.',
      assessmentHelp: 'O objetivo é manter o mais baixo possível sem afetar a qualidade.',
    },
    {
      title: '7. Margem Antes do IR/CSLL',
      value: (lair / RL) * 100,
      type: 'percent' as const,
      formula: 'LAIR ÷ Receita Líquida',
      desc: 'Lucro antes dos impostos s/ renda',
      icon: <PieChart className="text-violet-650" size={16} />,
      color: 'border-slate-200 bg-white text-slate-800',
      chartColor: '#7c3aed',
      explanation: 'O lucro gerado pelas operações somado às movimentações financeiras, medido antes de se descontar impostos como IRPJ e CSLL.',
      assessmentHelp: 'Bom: acima de 12%. Ajuda a avaliar a rentabilidade livre do peso tributário direto.',
    },
    {
      title: '8. Margem Líquida',
      value: (lucro_liquido / RL) * 100,
      type: 'percent' as const,
      formula: 'Lucro Líquido ÷ Receita Líquida',
      desc: 'Lucro final sobre a receita',
      icon: <FileText className="text-fuchsia-600" size={16} />,
      color: 'border-slate-200 bg-white text-slate-800',
      chartColor: '#d946ef',
      explanation: 'Mostra o quanto "sobra no bolso" da empresa de forma líquida, para cada R$ 100 vendidos, após pagar TUDO.',
      assessmentHelp: 'Bom: acima de 10%. Excelente: acima de 15%. É o indicador final da sustentabilidade e retorno aos sócios.',
    },
    {
      title: '9. Índ. Despesas Operacionais',
      value: (despesas_operacionais / RL) * 100,
      type: 'percent' as const,
      formula: 'OpEx ÷ Receita Líquida',
      desc: 'Peso da estrutura sobre a receita',
      icon: <Activity className="text-rose-600" size={16} />,
      color: 'border-slate-200 bg-white text-slate-800',
      chartColor: '#e11d48',
      explanation: 'Mede o "peso da máquina" (despesas fixas, financeiras e corporativas) em relação à receita.',
      assessmentHelp: 'Bom: abaixo de 15%. Se o índice for muito alto, a empresa tem uma estrutura cara e pesada que corrói o lucro operacional.',
    },
    {
      title: '10. Índice de Despesas Rateadas',
      value: (kpis.totalDespesas / RL) * 100,
      type: 'percent' as const,
      formula: 'Despesas Rateadas ÷ Receita Líquida',
      desc: 'Participação das despesas na receita',
      icon: <Zap className="text-rose-500" size={16} />,
      color: 'border-slate-800 bg-slate-900 text-white',
      chartColor: '#f43f5e',
      explanation: 'Impacto percentual de todos os rateios e custos fixos estruturais sobre a receita líquida do negócio.',
      assessmentHelp: 'Reduzir essa linha sem comprometer o crescimento melhora substancialmente a Margem Líquida.',
    },
  ];

  // --- GENERAL CASH FLOW AND OPERATIONAL KPIS ---
  const generalKPIs = [
    {
      title: 'Receitas Totais',
      value: kpis.totalEntradas,
      desc: 'Receita Bruta + Indiretas',
      icon: <DollarSign size={16} className="text-emerald-500" />,
    },
    {
      title: 'Total Saídas',
      value: kpis.totalSaidas,
      desc: 'Custos + Despesas + Impostos + Invest.',
      icon: <Coins size={16} className="text-rose-500" />,
    },
    {
      title: 'Fluxo de Caixa Livre (FCL)',
      value: kpis.fcl,
      desc: `Margem FCL: ${formatValue(kpis.percFcl, 'percent')}`,
      icon: <Landmark size={16} className="text-amber-500" />,
    },
    {
      title: 'Gastos com Pessoal',
      value: getDRETotal('Pessoal'),
      desc: 'CLTs, Credenciados e Terceirizados',
      icon: <Users size={16} className="text-indigo-500" />,
    },
    {
      title: 'Manutenção Preventiva',
      value: getDRETotal('Preventiva'),
      desc: 'Manutenção Planejada B2G',
      icon: <ShieldCheck size={16} className="text-emerald-500" />,
    },
    {
      title: 'Manutenção Corretiva',
      value: getDRETotal('Corretiva'),
      desc: 'Manutenção Corretiva B2G',
      icon: <Wrench size={16} className="text-rose-500" />,
    },
  ];

  // --- MONTHLY EVOLUTION CALCULATOR ---
  const getDREValMensal = (key: string, col: string) => {
    if (results.mensal[key] && results.mensal[key][col] !== undefined) {
      return results.mensal[key][col];
    }
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    for (const mKey of Object.keys(results.mensal)) {
      const mNorm = mKey.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (mNorm === normalizedKey) {
        return results.mensal[mKey][col] || 0;
      }
    }
    return 0;
  };

  const getMonthlyDataForIndicator = (title: string) => {
    return validColumns.map(col => {
      const v_receita_bruta = getDREValMensal('Receita Bruta de Vendas', col);
      const v_receitas_indiretas = getDREValMensal('Receitas Indiretas', col);
      const v_impostos_vendas = getDREValMensal('Impostos', col);
      const v_irpj_csll = getDREValMensal('Provisão - IRPJ e CSSL Trimestral', col) || getDREValMensal('Provisão IRPJ e CSSL Trimestral', col);

      const r_liquida = (v_receita_bruta + v_receitas_indiretas) - v_impostos_vendas;
      const l_RL = r_liquida !== 0 ? r_liquida : 1;

      const tCustos = getDREValMensal('Total Custos Operacionais', col);
      const l_bruto = r_liquida - tCustos;

      const v_despesas_variaveis = getDREValMensal('Despesas Variáveis', col);
      const v_intermediacao = getDREValMensal('Intermediação de Negócios', col);
      const c_despesas_variaveis = tCustos + v_despesas_variaveis + v_intermediacao;

      const v_despesas_financeiras = getDREValMensal('Despesas Financeiras', col);
      const v_dividendos = getDREValMensal('Distribuição de Dividendos', col) || getDREValMensal('Dividendos', col);
      const tDespesas = getDREValMensal('Total Despesas Rateadas', col);
      const d_operacionais = tDespesas - v_despesas_financeiras - v_dividendos - v_despesas_variaveis - v_intermediacao;

      const o_ebit = l_bruto - d_operacionais;
      const o_ebitda = o_ebit;

      const v_receitas_financeiras = getDREValMensal('Receitas Financeiras', col);
      const r_financeiro = v_receitas_financeiras - v_despesas_financeiras;

      const v_outras_receitas = getDREValMensal('Outras Receitas', col) + getDREValMensal('Honorários', col) + getDREValMensal('Juros e devoluções', col) + getDREValMensal('Juros e Devoluções', col) + getDREValMensal('Recuperação de Despesas Variáveis', col);
      const o_lair = o_ebit + r_financeiro + v_outras_receitas;

      const o_lucro_liquido = o_lair - v_irpj_csll;
      const m_contrib_valor = r_liquida - c_despesas_variaveis;
      const o_gao = o_ebit !== 0 ? m_contrib_valor / o_ebit : 0;

      let val = 0;
      switch (title) {
        case '1. Margem Bruta':
          val = (l_bruto / l_RL) * 100;
          break;
        case '2. Margem de Contribuição':
          val = (m_contrib_valor / l_RL) * 100;
          break;
        case '3. Margem Operacional':
          val = (o_ebit / l_RL) * 100;
          break;
        case '4. EBITDA':
          val = o_ebitda;
          break;
        case '5. Margem EBITDA':
          val = (o_ebitda / l_RL) * 100;
          break;
        case '6. Índice de Custos Operacionais':
          val = (tCustos / l_RL) * 100;
          break;
        case '7. Margem Antes do IR/CSLL':
          val = (o_lair / l_RL) * 100;
          break;
        case '8. Margem Líquida':
          val = (o_lucro_liquido / l_RL) * 100;
          break;
        case '9. Índ. Despesas Operacionais':
          val = (d_operacionais / l_RL) * 100;
          break;
        case '10. Índice de Despesas Rateadas':
          val = (tDespesas / l_RL) * 100;
          break;
        default:
          val = 0;
      }

      // Handle "Per Equipment" division for currency indicators
      if (viewMode === 'equipment' && (title === '4. EBITDA')) {
        const equipmentsOfMonth = getDREValMensal('Equipamentos', col) || getDREValMensal('Total Equipamentos', col) || totalEquipamentos || 1;
        val = val / (equipmentsOfMonth > 0 ? equipmentsOfMonth : 1);
      }

      return {
        month: col,
        value: Number(val.toFixed(2)),
      };
    });
  };

  // --- CALCULATION COMPOSITION DATA ---
  const getCompositionData = (title: string) => {
    switch (title) {
      case '1. Margem Bruta':
        return {
          formula: 'Lucro Bruto ÷ Receita Líquida',
          steps: [
            { label: 'Receita Bruta de Vendas', value: val_receita_bruta, type: 'currency' as const },
            { label: '(+) Receitas Indiretas', value: val_receitas_indiretas, type: 'currency' as const },
            { label: '(-) Impostos s/ Vendas', value: val_impostos_vendas, type: 'currency' as const },
            { label: '(=) Receita Líquida', value: receita_liquida, type: 'currency' as const, highlight: true },
            { label: '(-) Custos Operacionais', value: kpis.totalCustos, type: 'currency' as const },
            { label: '(=) Lucro Bruto', value: lucro_bruto, type: 'currency' as const, highlight: true },
          ],
          result: { label: 'Margem Bruta', value: (lucro_bruto / RL) * 100, type: 'percent' as const }
        };
      case '2. Margem de Contribuição':
        return {
          formula: 'Margem de Contribuição ($) ÷ Receita Líquida',
          steps: [
            { label: 'Receita Líquida', value: receita_liquida, type: 'currency' as const, highlight: true },
            { label: '(-) Custos Operacionais', value: kpis.totalCustos, type: 'currency' as const },
            { label: '(-) Despesas Variáveis', value: val_despesas_variaveis, type: 'currency' as const },
            { label: '(-) Intermediação de Negócios', value: val_intermediacao, type: 'currency' as const },
            { label: '(=) Margem de Contribuição ($)', value: margem_contribuicao_valor, type: 'currency' as const, highlight: true },
          ],
          result: { label: 'Margem de Contribuição (%)', value: (margem_contribuicao_valor / RL) * 100, type: 'percent' as const }
        };
      case '3. Margem Operacional':
        return {
          formula: 'Resultado Operacional (EBIT) ÷ Receita Líquida',
          steps: [
            { label: 'Lucro Bruto', value: lucro_bruto, type: 'currency' as const, highlight: true },
            { label: '(-) Despesas Operacionais (OpEx)', value: despesas_operacionais, type: 'currency' as const },
            { label: '(=) Resultado Operacional (EBIT)', value: ebit, type: 'currency' as const, highlight: true },
            { label: 'Receita Líquida', value: receita_liquida, type: 'currency' as const },
          ],
          result: { label: 'Margem Operacional', value: (ebit / RL) * 100, type: 'percent' as const }
        };
      case '4. EBITDA':
        return {
          formula: 'EBIT + Depreciação + Amortização',
          steps: [
            { label: 'Resultado Operacional (EBIT)', value: ebit, type: 'currency' as const, highlight: true },
            { label: '(+) Depreciação e Amortização', value: 0, type: 'currency' as const, desc: 'Não detalhado separadamente no DRE' },
          ],
          result: { label: 'EBITDA', value: ebitda, type: 'currency' as const }
        };
      case '5. Margem EBITDA':
        return {
          formula: 'EBITDA ÷ Receita Líquida',
          steps: [
            { label: 'EBITDA', value: ebitda, type: 'currency' as const, highlight: true },
            { label: 'Receita Líquida', value: receita_liquida, type: 'currency' as const, highlight: true },
          ],
          result: { label: 'Margem EBITDA', value: (ebitda / RL) * 100, type: 'percent' as const }
        };
      case '6. Índice de Custos Operacionais':
        return {
          formula: 'Custos Diretos + Intermediação de Negócios ÷ Receita Líquida',
          steps: [
            { label: 'Total Custos (Custos de Produção/Serviços)', value: kpis.totalCustos, type: 'currency' as const, highlight: true },
            { label: 'Receita Líquida', value: receita_liquida, type: 'currency' as const, highlight: true },
          ],
          result: { label: 'Índice de Custos Operacionais', value: (kpis.totalCustos / RL) * 100, type: 'percent' as const }
        };
      case '7. Margem Antes do IR/CSLL':
        return {
          formula: 'Resultado Antes dos Impostos (LAIR) ÷ Receita Líquida',
          steps: [
            { label: 'Resultado Operacional (EBIT)', value: ebit, type: 'currency' as const },
            { label: '(+/-) Resultado Financeiro', value: resultado_financeiro, type: 'currency' as const },
            { label: '(+) Outras Receitas Operacionais', value: val_outras_receitas, type: 'currency' as const },
            { label: '(=) Resultado Antes do IR/CSLL (LAIR)', value: lair, type: 'currency' as const, highlight: true },
            { label: 'Receita Líquida', value: receita_liquida, type: 'currency' as const },
          ],
          result: { label: 'Margem Antes do IR/CSLL', value: (lair / RL) * 100, type: 'percent' as const }
        };
      case '8. Margem Líquida':
        return {
          formula: 'Lucro Líquido ÷ Receita Líquida',
          steps: [
            { label: 'Resultado Antes do IR/CSLL (LAIR)', value: lair, type: 'currency' as const, highlight: true },
            { label: '(-) Provisão de IRPJ/CSLL', value: val_irpj_csll, type: 'currency' as const },
            { label: '(=) Lucro Líquido', value: lucro_liquido, type: 'currency' as const, highlight: true },
            { label: 'Receita Líquida', value: receita_liquida, type: 'currency' as const },
          ],
          result: { label: 'Margem Líquida', value: (lucro_liquido / RL) * 100, type: 'percent' as const }
        };
      case '9. Índ. Despesas Operacionais':
        return {
          formula: 'Despesas Operacionais (OpEx) ÷ Receita Líquida',
          steps: [
            { label: 'Total Despesas Rateadas', value: kpis.totalDespesas, type: 'currency' as const },
            { label: '(-) Despesas Financeiras', value: val_despesas_financeiras, type: 'currency' as const },
            { label: '(-) Dividendos / Distribuição', value: val_dividendos, type: 'currency' as const },
            { label: '(-) Despesas Variáveis', value: val_despesas_variaveis, type: 'currency' as const },
            { label: '(-) Intermediação de Negócios', value: val_intermediacao, type: 'currency' as const },
            { label: '(=) Despesas Operacionais (OpEx)', value: despesas_operacionais, type: 'currency' as const, highlight: true },
            { label: 'Receita Líquida', value: receita_liquida, type: 'currency' as const },
          ],
          result: { label: 'Índice de Despesas Operacionais', value: (despesas_operacionais / RL) * 100, type: 'percent' as const }
        };
      case '10. Índice de Despesas Rateadas':
        return {
          formula: 'Despesas Rateadas ÷ Receita Líquida',
          steps: [
            { label: 'Total Despesas Rateadas', value: kpis.totalDespesas, type: 'currency' as const, highlight: true },
            { label: 'Receita Líquida', value: receita_liquida, type: 'currency' as const, highlight: true },
          ],
          result: { label: 'Índice de Despesas Rateadas', value: (kpis.totalDespesas / RL) * 100, type: 'percent' as const }
        };
      default:
        return null;
    }
  };

  const activeCompanies = filters.empresas.length > 0 ? filters.empresas.join(', ') : 'Todas';
  const activePeriods = filters.periodos.length > 0 ? filters.periodos.join(', ') : 'Todos';

  const selectedKpiData = financialIndicators.find(kpi => kpi.title === selectedIndicator) || financialIndicators[0];
  const chartData = getMonthlyDataForIndicator(selectedKpiData.title);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/65">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Indicadores Estratégicos Financeiros</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-855 px-2.5 py-1 rounded-full border border-amber-200/50 animate-pulse">
                CFO Dashboard
              </span>
            </div>
            <p className="text-xs text-slate-450 font-medium">
              Empresa: <span className="text-slate-700 font-bold">{activeCompanies}</span> • 
              Período: <span className="text-slate-700 font-bold">{activePeriods}</span> ({validColumns.length} meses)
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-550 transition-all active:scale-95 shadow-sm"
              title="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-8">
          
          {/* Section 1: The 10 Financial Indicators */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-amber-500 rounded-full" />
                Indicadores de Performance e Margens (DRE Gerencial)
              </h3>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold">
                <span className="bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                  <Info size={10} /> Clique no card para ver o gráfico de evolução
                </span>
                <span className="bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                  <Calculator size={10} className="text-amber-500" /> Clique no ícone de calculadora para ver a composição
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {financialIndicators.map((kpi, idx) => {
                const status = getStatus(kpi.title, kpi.value);
                const isActive = selectedIndicator === kpi.title;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedIndicator(kpi.title)}
                    className={`group relative border p-4.5 rounded-2xl flex flex-col justify-between shadow-sm transition-all duration-300 hover:shadow-md cursor-pointer ${
                      isActive 
                        ? 'border-amber-500 bg-amber-50/10 ring-2 ring-amber-500/20' 
                        : kpi.color
                    }`}
                  >
                    {/* Hover Tooltip */}
                    <div className="absolute z-40 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-250 top-full left-1/2 -translate-x-1/2 mt-2 w-72 p-4 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800 text-xs leading-relaxed">
                      <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-slate-850">
                        <span className="p-1 bg-slate-800 rounded text-amber-400">
                          {kpi.icon}
                        </span>
                        <p className="font-black text-slate-100 text-xs">{kpi.title}</p>
                      </div>
                      <p className="text-slate-300 mb-2.5">{kpi.explanation}</p>
                      <div className="border-t border-slate-800/80 pt-2">
                        <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wider mb-1">Guia de Avaliação</p>
                        <p className="text-slate-350 font-medium">{kpi.assessmentHelp}</p>
                      </div>
                      {/* Tooltip Arrow */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="p-1.5 bg-white/85 border border-slate-200/50 rounded-lg shadow-sm text-slate-750 flex items-center justify-center">
                          {kpi.icon}
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {/* Calculator button to view composition */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevents selecting the card for chart
                              setActiveComposition(kpi.title);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200/50 hover:border-amber-500 hover:bg-amber-500/10 text-slate-400 hover:text-amber-600 transition-all active:scale-90 bg-white"
                            title="Ver Composição do Cálculo"
                          >
                            <Calculator size={11} />
                          </button>

                          {status && (
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border shadow-sm ${status.color}`}>
                              {status.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <h4 className="text-xs font-bold leading-tight opacity-90">
                        {kpi.title}
                      </h4>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/30">
                      <p className="text-2xl font-black tracking-tight">
                        {formatValue(kpi.value, kpi.type)}
                      </p>
                      <p className="text-[10px] opacity-70 mt-1 leading-snug font-medium flex items-center gap-1">
                        Fórmula: <span className="font-bold font-mono text-[9px] bg-white/40 px-1 py-0.5 rounded">{kpi.formula}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Chart & Evolution (Dynamic Panel based on selected card) */}
          {mounted && (
            <div className="bg-slate-50/50 border border-slate-150 rounded-3xl p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Chart Side */}
              <div className="lg:col-span-2 flex flex-col justify-between">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-amber-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Evolução Mensal do Período
                    </h4>
                  </div>
                  <h3 className="text-base font-black text-slate-800">
                    {selectedKpiData.title} <span className="text-xs font-normal text-slate-500">({selectedKpiData.desc})</span>
                  </h3>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={selectedKpiData.chartColor} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={selectedKpiData.chartColor} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="month" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight="bold" 
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight="bold" 
                        tickLine={false}
                        tickFormatter={(v) => {
                          if (selectedKpiData.type === 'percent') return `${v}%`;
                          return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v;
                        }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: 'none',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '10px 14px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: any) => [
                          formatValue(Number(value), selectedKpiData.type, 1),
                          'Valor'
                        ]}
                        labelFormatter={(label) => `Mês: ${label}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={selectedKpiData.chartColor} 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorVal)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Table Side */}
              <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-150 lg:pl-8 pt-6 lg:pt-0">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    Detalhes dos Lançamentos
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    {selectedKpiData.explanation}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto max-h-48 scrollbar-thin">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-[10px] font-bold uppercase tracking-wider text-slate-450 pb-2">Mês/Ano</th>
                        <th className="text-[10px] font-bold uppercase tracking-wider text-slate-450 pb-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                          <td className="text-xs text-slate-600 font-semibold py-2">{row.month}</td>
                          <td className="text-xs text-slate-900 font-bold py-2 text-right">
                            {formatValue(row.value, selectedKpiData.type, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: General Cash Flow and Operational KPIs */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-amber-500 rounded-full" />
              Fluxo de Caixa e Eficiência Operacional
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {generalKPIs.map((kpi, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-150 p-4 rounded-xl flex flex-col justify-between shadow-sm hover:border-slate-300 hover:shadow transition-all duration-200"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      Operação
                    </span>
                    <div className="p-1 bg-slate-50 border border-slate-100 rounded-md">
                      {kpi.icon}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-xs font-bold text-slate-550 leading-tight">
                      {kpi.title}
                    </h4>
                    <p className="text-xl font-black text-slate-850 tracking-tight mt-1.5">
                      {formatValue(kpi.value, 'currency')}
                    </p>
                    <p className="text-[10px] text-slate-450 mt-1 font-medium">
                      {kpi.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <Info size={14} className="text-amber-500" />
            <span>Os valores são derivados em tempo real a partir dos lançamentos e filtros aplicados no DRE.</span>
          </div>
          <div>
            <span>Mar Brasil Dashboard © 2026</span>
          </div>
        </div>

      </div>

      {/* --- CALCULATION COMPOSITION MODAL OVERLAY (BALÃO DE COMPOSIÇÃO) --- */}
      {activeComposition && (() => {
        const comp = getCompositionData(activeComposition);
        if (!comp) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Calculator className="text-amber-500" size={18} />
                  <h4 className="font-black text-sm text-slate-100">Composição: {activeComposition}</h4>
                </div>
                <button
                  onClick={() => setActiveComposition(null)}
                  className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Formula Box */}
                <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                    Fórmula Matemática
                  </span>
                  <p className="text-xs font-mono font-bold text-amber-400 leading-snug">
                    {comp.formula}
                  </p>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    Componentes do Período Selecionado
                  </span>
                  
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                    {comp.steps.map((step: any, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between gap-3 text-xs p-2 rounded-lg ${
                          step.highlight 
                            ? 'bg-slate-800 border border-slate-700/50 font-bold' 
                            : 'bg-slate-950/40'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className={step.highlight ? 'text-slate-150' : 'text-slate-400'}>
                            {step.label}
                          </span>
                          {step.desc && (
                            <span className="text-[9px] text-slate-500 italic mt-0.5">{step.desc}</span>
                          )}
                        </div>
                        <span className={step.highlight ? 'text-amber-400 font-black' : 'text-slate-200 font-bold'}>
                          {formatValue(step.value, step.type, 1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Final Result */}
                <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-500 block">
                      Resultado Final Calculado
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {comp.result.label}
                    </span>
                  </div>
                  <span className="text-lg font-black text-amber-400">
                    {formatValue(comp.result.value, comp.result.type, 1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
