import React, { useState } from 'react';
import { X, DollarSign, Users, Wrench, ShieldCheck, Percent, Coins, Landmark, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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

  const formatValue = (value: number, isPercent = false) => {
    if (isPercent) {
      return `${value.toFixed(2).replace('.', ',')}%`;
    }
    const adjustedValue = value / divisor;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: viewMode === 'equipment' ? 2 : 0,
    }).format(adjustedValue);
  };

  const getPercentOfRevenue = (value: number) => {
    if (kpis.totalEntradas === 0) return '0,0%';
    return `${((value / kpis.totalEntradas) * 100).toFixed(1).replace('.', ',')}%`;
  };

  // Helper safely retrieving values from DRE totals
  const getDRETotal = (key: string) => totais[key] || 0;

  const executiveKPIs = [
    {
      title: 'Entradas Operacionais',
      value: kpis.totalEntradas,
      description: 'Receita Bruta + Receitas Indiretas',
      icon: <DollarSign className="text-emerald-500" size={22} />,
      bg: 'bg-emerald-50/50 border-emerald-100',
      textColor: 'text-emerald-750',
      showPercent: false,
    },
    {
      title: 'Total Saídas',
      value: kpis.totalSaidas,
      description: 'Custos + Despesas + Impostos + Investimentos',
      icon: <Coins className="text-rose-500" size={22} />,
      bg: 'bg-rose-50/50 border-rose-100',
      textColor: 'text-rose-750',
      showPercent: true,
    },
    {
      title: 'Resultado (Lucro antes do FCL)',
      value: kpis.resultado,
      description: `Margem: ${formatValue(kpis.percLucro, true)}`,
      icon: kpis.resultado >= 0 ? <ArrowUpRight className="text-emerald-600" size={24} /> : <ArrowDownRight className="text-rose-600" size={24} />,
      bg: kpis.resultado >= 0 ? 'bg-emerald-50/20 border-emerald-200/60' : 'bg-rose-50/20 border-rose-200/60',
      textColor: kpis.resultado >= 0 ? 'text-emerald-700' : 'text-rose-700',
      showPercent: true,
    },
    {
      title: 'Fluxo de Caixa Livre (FCL)',
      value: kpis.fcl,
      description: `Margem FCL: ${formatValue(kpis.percFcl, true)}`,
      icon: kpis.fcl >= 0 ? <Landmark className="text-amber-500" size={22} /> : <Landmark className="text-rose-500" size={22} />,
      bg: 'bg-slate-900 border-slate-800 text-white',
      textColor: kpis.fcl >= 0 ? 'text-emerald-400' : 'text-rose-400',
      showPercent: true,
      isDark: true,
    },
  ];

  const operationalKPIs = [
    {
      title: 'Custos Operacionais',
      value: kpis.totalCustos,
      icon: <Wrench className="text-amber-500" size={18} />,
      category: 'Custos',
    },
    {
      title: 'Despesas Rateadas',
      value: kpis.totalDespesas,
      icon: <Coins className="text-slate-500" size={18} />,
      category: 'Despesas',
    },
    {
      title: 'Total de Impostos',
      value: kpis.totalImpostos,
      icon: <Percent className="text-rose-500" size={18} />,
      category: 'Impostos',
    },
    {
      title: 'Investimentos',
      value: kpis.totalInvestimentos,
      icon: <Landmark className="text-blue-500" size={18} />,
      category: 'Investimentos',
    },
    {
      title: 'Gastos com Pessoal',
      value: getDRETotal('Pessoal'),
      icon: <Users className="text-indigo-500" size={18} />,
      category: 'Recursos Humanos',
    },
    {
      title: 'Manutenção Preventiva',
      value: getDRETotal('Preventiva'),
      icon: <ShieldCheck className="text-emerald-500" size={18} />,
      category: 'Operação',
    },
    {
      title: 'Manutenção Corretiva',
      value: getDRETotal('Corretiva'),
      icon: <Wrench className="text-rose-500" size={18} />,
      category: 'Operação',
    },
    {
      title: 'Distribuição de Dividendos',
      value: getDRETotal('Distribuição de Dividendos') || getDRETotal('Dividendos'),
      icon: <Coins className="text-teal-500" size={18} />,
      category: 'Sócios',
    },
    {
      title: 'Mútuo (Entradas)',
      value: getDRETotal('Mútuo Entradas'),
      icon: <ArrowUpRight className="text-emerald-500" size={18} />,
      category: 'Financeiro',
    },
    {
      title: 'Mútuo (Saídas)',
      value: getDRETotal('Mútuo Saídas'),
      icon: <ArrowDownRight className="text-rose-500" size={18} />,
      category: 'Financeiro',
    },
  ];

  const activeCompanies = filters.empresas.length > 0 ? filters.empresas.join(', ') : 'Todas';
  const activePeriods = filters.periodos.length > 0 ? filters.periodos.join(', ') : 'Todos';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/65">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Indicadores Estratégicos</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-850 px-2.5 py-1 rounded-full border border-amber-200/50">
                Executivo
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'total'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-850'
                }`}
              >
                Valores Totais
              </button>
              <button
                onClick={() => setViewMode('equipment')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-550 transition-all active:scale-95 shadow-sm"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-8">
          
          {/* Section 1: Executive KPIs */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-amber-500 rounded-full" />
              Resultado & Geração de Caixa
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {executiveKPIs.map((kpi, idx) => (
                <div
                  key={idx}
                  className={`border p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md ${kpi.bg}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${kpi.isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                        {kpi.title}
                      </span>
                      <p className={`text-3xl font-black tracking-tight mt-1.5 ${kpi.textColor}`}>
                        {formatValue(kpi.value)}
                      </p>
                    </div>
                    <div className={`p-2 rounded-xl border ${kpi.isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200/70 shadow-sm'}`}>
                      {kpi.icon}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-semibold">
                    <span className={kpi.isDark ? 'text-slate-400' : 'text-slate-500'}>
                      {kpi.description}
                    </span>
                    {kpi.showPercent && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        kpi.isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {getPercentOfRevenue(kpi.value)} da Rec.
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Operational and Efficiency KPIs */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-amber-500 rounded-full" />
              Custos, Despesas e Eficiência Operacional
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {operationalKPIs.map((kpi, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-150 p-4.5 rounded-xl flex flex-col justify-between shadow-sm hover:border-slate-300 hover:shadow transition-all duration-200"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {kpi.category}
                      </span>
                      <div className="p-1 bg-slate-50 border border-slate-100 rounded-md">
                        {kpi.icon}
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-slate-550 leading-tight">
                      {kpi.title}
                    </h4>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="text-lg font-black text-slate-850 tracking-tight">
                      {formatValue(kpi.value)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {getPercentOfRevenue(kpi.value)}
                    </span>
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
