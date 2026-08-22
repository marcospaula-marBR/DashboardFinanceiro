'use client';
import React, { useState, useMemo } from 'react';
import { HeaderNav } from '@/components/layout/HeaderNav';
import { KpiCardGrid } from '@/components/simulator/KpiCardGrid';
import { PremissasTable } from '@/components/simulator/PremissasTable';
import { PremissaFormModal } from '@/components/simulator/PremissaFormModal';
import { ExecutiveAiModal } from '@/components/simulator/ExecutiveAiModal';
import { CompanyFinancialBase } from '@/types/financial.types';
import { SimulationScenario, ScenarioAssumption } from '@/types/simulator.types';
import { StandaloneSimulatorEngine } from '@/engine/simulator.engine';
import { formatCurrencyBRL } from '@/lib/date-utils';
import { TrendingUp, TrendingDown, Users, Scissors, Zap, Target, RefreshCw, Download, Sparkles, Building2 } from 'lucide-react';

// Dados Padrão de Exemplo para PME (R$ 1M/mês de Faturamento)
const INITIAL_PME_DATA: CompanyFinancialBase = {
  companyName: 'Empresa Exemplo PME Ltda',
  cnpj: '12.345.678/0001-90',
  currency: 'BRL',
  currentCashBalance: 450000,
  periods: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'],
  rows: [
    {
      accountId: 'rec_vendas',
      accountName: 'Receita Bruta de Vendas & Serviços',
      group: 'receita_bruta',
      values: { '2026-01': 1000000, '2026-02': 1000000, '2026-03': 1000000, '2026-04': 1000000, '2026-05': 1000000, '2026-06': 1000000 }
    },
    {
      accountId: 'ded_impostos',
      accountName: 'Impostos e Deduções sobre Vendas (10%)',
      group: 'deducoes_impostos',
      values: { '2026-01': 100000, '2026-02': 100000, '2026-03': 100000, '2026-04': 100000, '2026-05': 100000, '2026-06': 100000 }
    },
    {
      accountId: 'custos_var',
      accountName: 'Custos de Produção / Serviços (CPV 27%)',
      group: 'custos_variaveis',
      values: { '2026-01': 270000, '2026-02': 270000, '2026-03': 270000, '2026-04': 270000, '2026-05': 270000, '2026-06': 270000 }
    },
    {
      accountId: 'desp_fixas',
      accountName: 'Despesas Operacionais Fixas (Aluguel, Mkt, Softwares)',
      group: 'despesas_fixas',
      values: { '2026-01': 160000, '2026-02': 160000, '2026-03': 160000, '2026-04': 160000, '2026-05': 160000, '2026-06': 160000 }
    },
    {
      accountId: 'pessoal_folha',
      accountName: 'Folha de Pagamento & Encargos CLT/PJ',
      group: 'pessoal_encargos',
      values: { '2026-01': 320000, '2026-02': 320000, '2026-03': 320000, '2026-04': 320000, '2026-05': 320000, '2026-06': 320000 }
    }
  ]
};

export default function SimulatorPage() {
  const [baseData, setBaseData] = useState<CompanyFinancialBase>(INITIAL_PME_DATA);
  const [assumptions, setAssumptions] = useState<ScenarioAssumption[]>([
    {
      id: 'asm_demo_1',
      enabled: true,
      name: 'Expansão Comercial (+10% Vendas)',
      type: 'revenue_increase',
      targetGroup: 'receita_bruta',
      amountType: 'percentage',
      value: 10,
      startDate: '2026-01',
      endDate: '2026-06',
      recurrence: 'monthly'
    }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Cenário de simulação dinâmico
  const scenario: SimulationScenario = useMemo(() => ({
    id: 'sc_current',
    name: 'Cenário PME Ativo',
    mode: 'future_projection',
    basePeriod: baseData.periods,
    projectionStartDate: baseData.periods[0],
    projectionEndDate: baseData.periods[baseData.periods.length - 1],
    assumptions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }), [baseData, assumptions]);

  // Executar simulação no motor standalone
  const simulationResult = useMemo(() => {
    return StandaloneSimulatorEngine.runSimulation(baseData, scenario);
  }, [baseData, scenario]);

  const handleToggleAssumption = (id: string) => {
    setAssumptions(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const handleRemoveAssumption = (id: string) => {
    setAssumptions(prev => prev.filter(a => a.id !== id));
  };

  const handleAddAssumption = (newAsm: ScenarioAssumption) => {
    setAssumptions(prev => [...prev, newAsm]);
  };

  const handleReset = () => {
    setAssumptions([]);
  };

  return (
    <div className="min-h-screen bg-slate-900/5 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
      
      {/* Header com botão Voltar ao Início (Regra P0) */}
      <HeaderNav
        companyName={baseData.companyName}
        onOpenAiModal={() => setIsAiModalOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Banner Superior Executivo */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold tracking-wider uppercase mb-1">
              <Sparkles size={14} />
              <span>Simulador Financeiro SaaS • PMEs</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Simulação de Cenários Executivos</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Projete contratações, variações de vendas, empréstimos e cortes de custos com cálculo automático de 
              <strong> Runway de Caixa</strong> e <strong>Ponto de Equilíbrio (Break-Even)</strong>.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleReset}
              className="flex items-center text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl border border-slate-700 transition-all"
            >
              <RefreshCw size={14} className="mr-1.5" />
              Limpar Premissas
            </button>
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
            >
              <Sparkles size={15} className="mr-1.5" />
              Análise IA
            </button>
          </div>
        </div>

        {/* Atalhos de Simulação Rápida */}
        <div className="my-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Simulação Rápida de Eventos</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            
            <button
              onClick={() => handleAddAssumption({
                id: `asm_${Date.now()}`, enabled: true, name: 'Expansão de Vendas (+15%)',
                type: 'revenue_increase', targetGroup: 'receita_bruta', amountType: 'percentage', value: 15,
                startDate: baseData.periods[0], endDate: baseData.periods[baseData.periods.length - 1], recurrence: 'monthly'
              })}
              className="p-3 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-left transition-all text-xs font-medium text-emerald-950 flex items-center space-x-2"
            >
              <TrendingUp size={18} className="text-emerald-600 flex-shrink-0" />
              <div>
                <span className="font-bold block">+15% Vendas</span>
                <span className="text-[10px] text-emerald-700 block">Projetar crescimento</span>
              </div>
            </button>

            <button
              onClick={() => handleAddAssumption({
                id: `asm_${Date.now()}`, enabled: true, name: 'Contratação 1 Dev Senior',
                type: 'hiring_personnel', targetGroup: 'pessoal_encargos', amountType: 'monthly_value', value: 8000,
                hiringCount: 1, salaryBase: 8000, taxChargesPct: 70,
                startDate: baseData.periods[0], endDate: baseData.periods[baseData.periods.length - 1], recurrence: 'monthly'
              })}
              className="p-3 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 rounded-xl text-left transition-all text-xs font-medium text-blue-950 flex items-center space-x-2"
            >
              <Users size={18} className="text-blue-600 flex-shrink-0" />
              <div>
                <span className="font-bold block">+1 Colaborador</span>
                <span className="text-[10px] text-blue-700 block">R$ 8k + 70% encargos</span>
              </div>
            </button>

            <button
              onClick={() => handleAddAssumption({
                id: `asm_${Date.now()}`, enabled: true, name: 'Corte Despesas Fixas (-10%)',
                type: 'expense_reduction', targetGroup: 'despesas_fixas', amountType: 'percentage', value: 10,
                startDate: baseData.periods[0], endDate: baseData.periods[baseData.periods.length - 1], recurrence: 'monthly'
              })}
              className="p-3 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-left transition-all text-xs font-medium text-indigo-950 flex items-center space-x-2"
            >
              <Scissors size={18} className="text-indigo-600 flex-shrink-0" />
              <div>
                <span className="font-bold block">-10% Desp. Fixas</span>
                <span className="text-[10px] text-indigo-700 block">Otimizar aluguel/sw</span>
              </div>
            </button>

            <button
              onClick={() => handleAddAssumption({
                id: `asm_${Date.now()}`, enabled: true, name: 'Capital de Giro (Empréstimo R$ 150k)',
                type: 'new_loan', targetGroup: 'emprestimos_dividas', amountType: 'monthly_value', value: 150000,
                loanAmount: 150000, loanTermsMonths: 12, loanMonthlyInterestPct: 1.8,
                startDate: baseData.periods[0], endDate: baseData.periods[baseData.periods.length - 1], recurrence: 'monthly'
              })}
              className="p-3 bg-amber-50/80 hover:bg-amber-100 border border-amber-200 rounded-xl text-left transition-all text-xs font-medium text-amber-950 flex items-center space-x-2"
            >
              <Target size={18} className="text-amber-600 flex-shrink-0" />
              <div>
                <span className="font-bold block">Empréstimo R$ 150k</span>
                <span className="text-[10px] text-amber-700 block">12x parcelas com juros</span>
              </div>
            </button>

          </div>
        </div>

        {/* Grid de Cards de KPIs */}
        <KpiCardGrid
          baseline={simulationResult.baselineKPIs}
          simulated={simulationResult.simulatedKPIs}
        />

        {/* Tabela de Premissas */}
        <PremissasTable
          assumptions={assumptions}
          onToggle={handleToggleAssumption}
          onRemove={handleRemoveAssumption}
          onOpenModal={() => setIsModalOpen(true)}
        />

        {/* Comparador de Meses (Tabela Resumo) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 my-5 overflow-x-auto">
          <h3 className="text-base font-bold text-slate-900 mb-3">Evolução Mensal do Resultado Simulado</h3>
          <table className="w-full text-xs text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="p-3 font-semibold">Indicador Financeiro</th>
                {simulationResult.monthlySimulated.map(m => (
                  <th key={m.periodIso} className="p-3 font-semibold text-right">{m.periodIso}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-3 font-medium text-slate-800">Receita Bruta</td>
                {simulationResult.monthlySimulated.map(m => (
                  <td key={m.periodIso} className="p-3 text-right font-medium text-emerald-700">
                    {formatCurrencyBRL(m.kpis.receitaBruta)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-800">Margem de Contribuição</td>
                {simulationResult.monthlySimulated.map(m => (
                  <td key={m.periodIso} className="p-3 text-right text-slate-700">
                    {formatCurrencyBRL(m.kpis.margemContribuicao)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-800">Despesas Fixas & Pessoal</td>
                {simulationResult.monthlySimulated.map(m => (
                  <td key={m.periodIso} className="p-3 text-right text-slate-700">
                    {formatCurrencyBRL(m.kpis.despesasFixas + m.kpis.pessoalEncargos)}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="p-3 text-slate-900">EBITDA Operacional</td>
                {simulationResult.monthlySimulated.map(m => (
                  <td key={m.periodIso} className={`p-3 text-right ${m.kpis.ebitda >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                    {formatCurrencyBRL(m.kpis.ebitda)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

      </main>

      {/* Modais */}
      <PremissaFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddAssumption}
        availablePeriods={baseData.periods}
      />

      <ExecutiveAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        result={simulationResult}
        companyName={baseData.companyName}
      />

    </div>
  );
}
