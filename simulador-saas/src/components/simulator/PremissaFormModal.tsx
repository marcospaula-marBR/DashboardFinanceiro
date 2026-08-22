'use client';
import React, { useState } from 'react';
import { ScenarioAssumption, SimulatorScenarioType, SimulatorAmountType } from '@/types/simulator.types';
import { AccountCategoryGroup } from '@/types/financial.types';
import { X, TrendingUp, TrendingDown, Users, Target, Scissors, Zap, DollarSign, Calendar } from 'lucide-react';

interface PremissaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (assumption: ScenarioAssumption) => void;
  availablePeriods: string[];
}

export function PremissaFormModal({ isOpen, onClose, onSave, availablePeriods }: PremissaFormModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<SimulatorScenarioType>('revenue_increase');
  const [targetGroup, setTargetGroup] = useState<AccountCategoryGroup | 'all'>('receita_bruta');
  const [amountType, setAmountType] = useState<SimulatorAmountType>('percentage');
  const [value, setValue] = useState<number>(10);
  const [startDate, setStartDate] = useState(availablePeriods[0] || '2026-01');
  const [endDate, setEndDate] = useState(availablePeriods[availablePeriods.length - 1] || '2026-06');
  
  // Atributos de PME (Contratações / Empréstimos)
  const [hiringCount, setHiringCount] = useState<number>(1);
  const [salaryBase, setSalaryBase] = useState<number>(5000);
  const [taxChargesPct, setTaxChargesPct] = useState<number>(70);
  const [loanAmount, setLoanAmount] = useState<number>(100000);
  const [loanTermsMonths, setLoanTermsMonths] = useState<number>(12);
  const [loanInterestPct, setLoanInterestPct] = useState<number>(1.8);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newAsm: ScenarioAssumption = {
      id: `asm_${Date.now()}`,
      enabled: true,
      name: name || getDefaultName(type),
      type,
      targetGroup,
      amountType,
      value: Number(value),
      startDate,
      endDate,
      recurrence: 'monthly',
      hiringCount: Number(hiringCount),
      salaryBase: Number(salaryBase),
      taxChargesPct: Number(taxChargesPct),
      loanAmount: Number(loanAmount),
      loanTermsMonths: Number(loanTermsMonths),
      loanMonthlyInterestPct: Number(loanInterestPct)
    };
    onSave(newAsm);
    onClose();
  };

  function getDefaultName(t: SimulatorScenarioType): string {
    switch (t) {
      case 'revenue_increase': return 'Expansão de Vendas';
      case 'revenue_reduction': return 'Queda Prevista de Vendas';
      case 'contract_loss': return 'Perda de Cliente Principal';
      case 'hiring_personnel': return 'Nova Contratação de Equipe';
      case 'layoff_personnel': return 'Redução de Quadro de Pessoal';
      case 'expense_reduction': return 'Corte de Despesas Fixas';
      case 'new_loan': return 'Novo Empréstimo de Capital de Giro';
      case 'macro_driver': return 'Reajuste Inflacionário (IPCA)';
      default: return 'Premissa Personalizada';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="text-emerald-400" size={20} />
            <h3 className="text-base font-semibold">Nova Premissa de Simulação</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">

          {/* Nome */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">Título da Premissa</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Contratação Dev Senior ou Reajuste Preço 8%"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Tipo de Premissa */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">Tipo de Evento Financeiro</label>
            <select
              value={type}
              onChange={e => {
                const newT = e.target.value as SimulatorScenarioType;
                setType(newT);
                if (newT === 'revenue_increase' || newT === 'revenue_reduction' || newT === 'contract_loss') {
                  setTargetGroup('receita_bruta');
                } else if (newT === 'hiring_personnel' || newT === 'layoff_personnel') {
                  setTargetGroup('pessoal_encargos');
                } else if (newT === 'expense_reduction' || newT === 'expense_increase') {
                  setTargetGroup('despesas_fixas');
                } else if (newT === 'costs_cut') {
                  setTargetGroup('custos_variaveis');
                } else if (newT === 'new_loan') {
                  setTargetGroup('emprestimos_dividas');
                }
              }}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
            >
              <option value="revenue_increase">🚀 Aumento de Receita / Vendas</option>
              <option value="revenue_reduction">📉 Queda de Receita / Vendas</option>
              <option value="hiring_personnel">👥 Contratação de Colaboradores (CLT/PJ)</option>
              <option value="layoff_personnel">✂️ Redução de Quadro / Demissões</option>
              <option value="expense_reduction">💡 Corte de Despesas Fixas</option>
              <option value="costs_cut">⚙️ Otimização de Custos Variáveis</option>
              <option value="new_loan">🏦 Novo Empréstimo / Financiamento</option>
              <option value="macro_driver">📊 Reajuste por Índice (IPCA / Dissídio)</option>
            </select>
          </div>

          {/* Campos Específicos para Contratação */}
          {type === 'hiring_personnel' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Qtd. Colaboradores</label>
                  <input
                    type="number"
                    min="1"
                    value={hiringCount}
                    onChange={e => setHiringCount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Salário Base (R$/mês)</label>
                  <input
                    type="number"
                    step="500"
                    value={salaryBase}
                    onChange={e => setSalaryBase(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Encargos Trabalhistas (%)</label>
                <input
                  type="number"
                  value={taxChargesPct}
                  onChange={e => setTaxChargesPct(Number(e.target.value))}
                  placeholder="Ex: 70% para CLT"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">CLT típico no Brasil engloba FGTS, INSS, 13º, Férias (~70%).</span>
              </div>
            </div>
          )}

          {/* Campos Específicos para Empréstimo */}
          {type === 'new_loan' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Valor do Empréstimo (R$)</label>
                <input
                  type="number"
                  step="5000"
                  value={loanAmount}
                  onChange={e => setLoanAmount(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Prazo (Meses)</label>
                  <input
                    type="number"
                    value={loanTermsMonths}
                    onChange={e => setLoanTermsMonths(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Juros Mensais (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={loanInterestPct}
                    onChange={e => setLoanInterestPct(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Valor genérico se não for contratação/empréstimo */}
          {type !== 'hiring_personnel' && type !== 'new_loan' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Modo de Valor</label>
                <select
                  value={amountType}
                  onChange={e => setAmountType(e.target.value as SimulatorAmountType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none bg-white"
                >
                  <option value="percentage">Percentual (%)</option>
                  <option value="monthly_value">Valor Absoluto Mensal (R$)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Valor</label>
                <input
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={e => setValue(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                />
              </div>
            </div>
          )}

          {/* Período de Atuação */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Mês Início</label>
              <select
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none bg-white text-xs"
              >
                {availablePeriods.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Mês Fim</label>
              <select
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none bg-white text-xs"
              >
                {availablePeriods.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95"
            >
              Aplicar Premissa
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
