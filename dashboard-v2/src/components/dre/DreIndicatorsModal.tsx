import React, { useState } from 'react';
import { X, DollarSign, Users, Wrench, ShieldCheck, Percent, Coins, Landmark, Info, ArrowUpRight, ArrowDownRight, BarChart3, PieChart, Activity, Zap, FileText } from 'lucide-react';
import { DreCalculatedResult, DreFilters } from '@/types/dre';

interface DreIndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: DreCalculatedResult | null;
  filters: DreFilters;
}

export function DreIndicatorsModal({ isOpen, onClose, results, filters }: DreIndicatorsModalProps) {
  const [viewMode, setViewMode] = useState<'total' | 'equipment'>('total');

  if (!isOpen || !results) return null;

  const { kpis, totais, validColumns } = results;
  const totalEquipamentos = kpis.totalEquipamentos || kpis.averageMachines || 1;
  const divisor = viewMode === 'equipment' ? (totalEquipamentos > 0 ? totalEquipamentos : 1) : 1;

  const formatValue = (value: number, type: 'currency' | 'percent' | 'decimal' = 'currency') => {
    if (type === 'percent') {
      return `${value.toFixed(1).replace('.', ',')}%`;
    }
    if (type === 'decimal') {
      return `${value.toFixed(2).replace('.', ',')}x`;
    }
    
    const adjustedValue = value / divisor;
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
    },
    {
      title: '2. Margem de Contribuição',
      value: (margem_contribuicao_valor / RL) * 100,
      type: 'percent' as const,
      formula: '(Rec. Líq. - Var.) ÷ Rec. Líq.',
      desc: 'Cobertura de custos fixos e lucro',
      icon: <PieChart className="text-blue-500" size={16} />,
      color: 'border-blue-100 bg-blue-50/10 text-blue-950',
    },
    {
      title: '3. Margem Operacional',
      value: (ebit / RL) * 100,
      type: 'percent' as const,
      formula: 'EBIT ÷ Receita Líquida',
      desc: 'Resultado da operação principal',
      icon: <Activity className="text-emerald-500" size={16} />,
      color: 'border-emerald-100 bg-emerald-50/10 text-emerald-950',
    },
    {
      title: '4. EBITDA',
      value: ebitda,
      type: 'currency' as const,
      formula: 'EBIT + Deprec. + Amort.',
      desc: 'Geração de caixa operacional',
      icon: <Activity className="text-emerald-600" size={16} />,
      color: 'border-emerald-200 bg-emerald-50/20 text-emerald-950',
    },
    {
      title: '5. Margem EBITDA',
      value: (ebitda / RL) * 100,
      type: 'percent' as const,
      formula: 'EBITDA ÷ Receita Líquida',
      desc: 'Eficiência operacional (Caixa)',
      icon: <ArrowUpRight className="text-emerald-500" size={16} />,
      color: 'border-emerald-100 bg-emerald-50/10 text-emerald-950',
    },
    {
      title: '6. Resultado Financeiro',
      value: resultado_financeiro,
      type: 'currency' as const,
      formula: 'Rec. Fin. - Desp. Fin.',
      desc: 'Impacto de receitas e desp. fin.',
      icon: <Landmark className="text-slate-500" size={16} />,
      color: 'border-slate-200 bg-slate-50 text-slate-950',
    },
    {
      title: '7. Margem Antes do IR/CSLL',
      value: (lair / RL) * 100,
      type: 'percent' as const,
      formula: 'LAIR ÷ Receita Líquida',
      desc: 'Desempenho antes de impostos s/ lucro',
      icon: <FileText className="text-indigo-500" size={16} />,
      color: 'border-indigo-100 bg-indigo-50/10 text-indigo-950',
    },
    {
      title: '8. Margem Líquida',
      value: (lucro_liquido / RL) * 100,
      type: 'percent' as const,
      formula: 'Lucro Líq. ÷ Receita Líq.',
      desc: 'Quanto efetivamente sobra',
      icon: <Coins className="text-amber-650" size={16} />,
      color: 'border-amber-200/60 bg-amber-50/10 text-amber-950',
    },
    {
      title: '9. Índ. Despesas Operacionais',
      value: (despesas_operacionais / RL) * 100,
      type: 'percent' as const,
      formula: 'Desp. Op. ÷ Receita Líquida',
      desc: 'Peso das despesas sobre a receita',
      icon: <Percent className="text-rose-500" size={16} />,
      color: 'border-rose-100 bg-rose-50/10 text-rose-950',
    },
    {
      title: '10. GAO (Alavancagem Op.)',
      value: gao,
      type: 'decimal' as const,
      formula: 'Margem Contrib. ÷ EBIT',
      desc: 'Sensibilidade do lucro à receita',
      icon: <Zap className="text-yellow-650" size={16} />,
      color: 'border-slate-800 bg-slate-900 text-white',
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

  const activeCompanies = filters.empresas.length > 0 ? filters.empresas.join(', ') : 'Todas';
  const activePeriods = filters.periodos.length > 0 ? filters.periodos.join(', ') : 'Todos';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/65">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Indicadores Estratégicos Financeiros</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-850 px-2.5 py-1 rounded-full border border-amber-200/50">
                Performance
              </span>
            </div>
            <p className="text-xs text-slate-450 font-medium">
              Empresa: <span className="text-slate-700 font-bold">{activeCompanies}</span> • 
              Período: <span className="text-slate-700 font-bold">{activePeriods}</span> ({validColumns.length} meses)
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* View Mode Toggle Switch */}
            <div className="bg-slate-200/70 p-1 rounded-xl flex items-center border border-slate-300/30">
              <button
                onClick={() => setViewMode('total')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'total'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-850'
                }`}
              >
                Valores Totais
              </button>
              <button
                onClick={() => setViewMode('equipment')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'equipment'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-850'
                }`}
              >
                <span>Por Equipamento</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold ${
                  viewMode === 'equipment' ? 'bg-amber-100 text-amber-800' : 'bg-slate-300 text-slate-600'
                }`}>
                  {totalEquipamentos}
                </span>
              </button>
            </div>

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
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-amber-500 rounded-full" />
              Indicadores de Performance e Margens (DRE Gerencial)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {financialIndicators.map((kpi, idx) => (
                <div
                  key={idx}
                  className={`border p-4.5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden transition-all duration-305 hover:shadow-md ${kpi.color}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="p-1.5 bg-white/80 border border-slate-200/50 rounded-lg shadow-sm text-slate-750 flex items-center justify-center">
                        {kpi.icon}
                      </div>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider bg-white/75 px-2 py-0.5 rounded border border-slate-200/20 text-slate-500">
                        {kpi.formula}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold leading-tight opacity-90">
                      {kpi.title}
                    </h4>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/30">
                    <p className="text-2xl font-black tracking-tight">
                      {formatValue(kpi.value, kpi.type)}
                    </p>
                    <p className="text-[10px] opacity-70 mt-1 leading-snug">
                      {kpi.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: General Cash Flow and Operational KPIs */}
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
    </div>
  );
}
