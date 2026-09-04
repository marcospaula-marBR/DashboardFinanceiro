'use client';

import React, { useState, useMemo } from 'react';
import {
  ListFilter,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Info,
  DollarSign,
  Percent,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { RubricAdjustmentItem } from '@/types/pricing-simulator.types';

interface RubricSimulationSectionProps {
  contasDisponiveis: string[];
  valoresContasBase: Record<string, number>;
  receitaBase: number;
  ebitdaBase: number;
  onAdjustmentsChange?: (adjustments: RubricAdjustmentItem[]) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${(v || 0).toFixed(1)}%`;

const CONTAS_PADRAO = [
  'Despesas com Pessoal Administrativo',
  'Credenciado Administrativo',
  'Credenciado TI',
  'Aluguel e Ocupação',
  'Despesas de Vendas e Marketing',
  'Despesas Financeiras',
  'Serviços de Terceiros - PJ',
  'Sistemas e Softwares (TI)',
  'Honorários Contábeis e Jurídicos',
  'Outras Despesas Operacionais'
];

export function RubricSimulationSection({
  contasDisponiveis,
  valoresContasBase,
  receitaBase,
  ebitdaBase
}: RubricSimulationSectionProps) {
  // Lista de rubricas combinadas
  const contas = useMemo(() => {
    const set = new Set([...contasDisponiveis, ...CONTAS_PADRAO]);
    return Array.from(set).filter(Boolean).sort();
  }, [contasDisponiveis]);

  // Lista de ajustes aplicados
  const [adjustments, setAdjustments] = useState<RubricAdjustmentItem[]>([
    {
      id: 'rub_1',
      contaDRE: 'Despesas com Pessoal Administrativo',
      tipo: 'percent',
      valor: 8, // +8% dissídio
      modo: 'mensal',
      ativo: true,
      observacao: 'Dissídio e reajuste salarial'
    },
    {
      id: 'rub_2',
      contaDRE: 'Sistemas e Softwares (TI)',
      tipo: 'absolute',
      valor: 15000, // +R$ 15k novos softwares
      modo: 'mensal',
      ativo: true,
      observacao: 'Implantação de novas licenças'
    }
  ]);

  // Novo item em edição
  const [selectedConta, setSelectedConta] = useState<string>(contas[0] || CONTAS_PADRAO[0]);
  const [novoTipo, setNovoTipo] = useState<'percent' | 'absolute'>('percent');
  const [novoValor, setNovoValor] = useState<number>(10);
  const [novaObservacao, setNovaObservacao] = useState<string>('');

  const adicionarAjuste = () => {
    if (!selectedConta) return;
    const novoItem: RubricAdjustmentItem = {
      id: `rub_${Date.now()}`,
      contaDRE: selectedConta,
      tipo: novoTipo,
      valor: novoValor,
      modo: 'mensal',
      ativo: true,
      observacao: novaObservacao.trim() || undefined
    };
    setAdjustments([...adjustments, novoItem]);
    setNovaObservacao('');
    setNovoValor(10);
  };

  const removerAjuste = (id: string) => {
    setAdjustments(adjustments.filter(a => a.id !== id));
  };

  const alternarAtivo = (id: string) => {
    setAdjustments(adjustments.map(a => a.id === id ? { ...a, ativo: !a.ativo } : a));
  };

  // Cálculo do impacto consolidado das rubricas
  const { totalDeltaDespesas, itensCalculados } = useMemo(() => {
    let delta = 0;
    const itens = adjustments.map(adj => {
      const valorBase = Math.abs(valoresContasBase[adj.contaDRE] || 45000);
      let impactoMensal = 0;
      if (adj.tipo === 'percent') {
        impactoMensal = (valorBase * adj.valor) / 100;
      } else {
        impactoMensal = adj.valor;
      }

      if (adj.ativo) {
        delta += impactoMensal;
      }

      return {
        ...adj,
        valorBase,
        valorSimulado: Math.max(0, valorBase + impactoMensal),
        impactoMensal
      };
    });

    return { totalDeltaDespesas: delta, itensCalculados: itens };
  }, [adjustments, valoresContasBase]);

  const novoEbitda = ebitdaBase - totalDeltaDespesas;

  return (
    <div className="space-y-6">
      {/* ── Formulário para Adicionar Ajuste por Rubrica ────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6">
        <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <ListFilter size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
              Simulação Livre por Rubricas de Despesa
            </h2>
            <p className="text-xs text-slate-500">
              Projete aumentos ou cortes em contas contábeis específicas e avalie o impacto direto no EBITDA
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Conta / Rubrica */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Selecione a Rubrica / Conta DRE
            </label>
            <select
              value={selectedConta}
              onChange={e => setSelectedConta(e.target.value)}
              className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-250 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              {contas.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Tipo e Valor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Variação ({novoTipo === 'percent' ? '%' : 'R$'})
              </label>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-md text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setNovoTipo('percent')}
                  className={`px-1.5 py-0.5 rounded transition-colors ${novoTipo === 'percent' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setNovoTipo('absolute')}
                  className={`px-1.5 py-0.5 rounded transition-colors ${novoTipo === 'absolute' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  R$
                </button>
              </div>
            </div>
            <input
              type="number"
              step={novoTipo === 'percent' ? '1' : '1000'}
              value={novoValor}
              onChange={e => setNovoValor(Number(e.target.value))}
              placeholder="Ex: +10 ou -15"
              className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-250 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {/* Preview dinâmico do impacto % calculado */}
            {selectedConta && (
              <div className="mt-1 text-[10px] text-slate-500 font-medium">
                {novoTipo === 'absolute' ? (
                  <span>
                    Equivale a{' '}
                    <strong className="text-indigo-600">
                      {fmtPct((novoValor / (Math.abs(valoresContasBase[selectedConta] || 45000) || 1)) * 100)}
                    </strong>{' '}
                    sobre a base de {fmt(Math.abs(valoresContasBase[selectedConta] || 45000))}
                  </span>
                ) : (
                  <span>
                    Equivale a{' '}
                    <strong className="text-indigo-600">
                      {fmt((Math.abs(valoresContasBase[selectedConta] || 45000) * novoValor) / 100)}
                    </strong>{' '}
                    sobre a base da rubrica
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Botão Adicionar */}
          <div>
            <button
              onClick={adicionarAjuste}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-2.5 px-4 rounded-xl shadow-xs transition-all active:scale-95"
            >
              <Plus size={16} />
              <span>Adicionar Rubrica</span>
            </button>
          </div>
        </div>

        <div className="mt-3">
          <input
            type="text"
            value={novaObservacao}
            onChange={e => setNovaObservacao(e.target.value)}
            placeholder="Observação da premissa (opcional, ex: Renovação de contrato de aluguel)"
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* ── Cards de Resumo do Impacto das Rubricas ────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Ajustes Ativos
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-800">
              {adjustments.filter(a => a.ativo).length} de {adjustments.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Premissas granulares aplicadas</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Variação Total em Despesas
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-black ${totalDeltaDespesas > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {totalDeltaDespesas > 0 ? '+' : ''}{fmt(totalDeltaDespesas)}
            </span>
            <span className="text-xs text-slate-500">/mês</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {totalDeltaDespesas > 0 ? 'Aumento nos custos/despesas' : 'Economia em custos/despesas'}
            {ebitdaBase !== 0 && (
              <span className="font-semibold text-slate-600">
                {' '}(impacto de {totalDeltaDespesas > 0 ? '-' : '+'}{((Math.abs(totalDeltaDespesas) / Math.abs(ebitdaBase)) * 100).toFixed(1)}% no EBITDA)
              </span>
            )}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Impacto no EBITDA
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-black ${novoEbitda >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {fmt(novoEbitda)}
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              ({totalDeltaDespesas > 0 ? '-' : '+'}{fmt(Math.abs(totalDeltaDespesas))} | {totalDeltaDespesas > 0 ? '-' : '+'}{((Math.abs(totalDeltaDespesas) / (Math.abs(ebitdaBase) || 1)) * 100).toFixed(1)}%)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            EBITDA Real: {fmt(ebitdaBase)}
            {receitaBase > 0 && (
              <span className="text-slate-400"> • Margem: {((ebitdaBase / receitaBase) * 100).toFixed(1)}% → {((novoEbitda / receitaBase) * 100).toFixed(1)}%</span>
            )}
          </p>
        </div>
      </div>

      {/* ── Tabela de Rubricas Simuladas ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight">
              Tabela de Rubricas Customizadas
            </h3>
            <p className="text-xs text-slate-500">
              Visualização detalhada com conversão automática de valores nominais e impactos percentuais
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              <Sparkles size={12} className="text-indigo-600" />
              Impactos calculados sobre a base e o EBITDA
            </span>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Status</th>
                  <th className="p-3">Rubrica / Conta DRE</th>
                  <th className="p-3 text-center">Variação Aplicada</th>
                  <th className="p-3 text-right">Valor Base</th>
                  <th className="p-3 text-right">Valor Simulado</th>
                  <th className="p-3 text-right">Impacto Mensal / EBITDA</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {itensCalculados.map(item => {
                  const pctSobreBase = item.valorBase > 0 ? (item.impactoMensal / item.valorBase) * 100 : 0;
                  const pctSobreEbitda = ebitdaBase !== 0 ? (Math.abs(item.impactoMensal) / Math.abs(ebitdaBase)) * 100 : 0;

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${!item.ativo ? 'opacity-50' : ''}`}>
                      <td className="p-3">
                        <button
                          onClick={() => alternarAtivo(item.id)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          title={item.ativo ? 'Desativar premissa' : 'Ativar premissa'}
                        >
                          {item.ativo ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">Ativa</span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-600">Inativa</span>
                          )}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{item.contaDRE}</div>
                        {item.observacao && (
                          <div className="text-[11px] text-slate-400">{item.observacao}</div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.tipo === 'percent' ? (
                          <div>
                            <div className="font-black text-indigo-900">
                              {item.valor > 0 ? '+' : ''}{item.valor}%
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              ({item.impactoMensal > 0 ? '+' : ''}{fmt(item.impactoMensal)})
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-black text-slate-800">
                              {item.valor > 0 ? '+' : ''}{fmt(item.valor)}
                            </div>
                            <span className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {pctSobreBase > 0 ? '+' : ''}{pctSobreBase.toFixed(1)}% na rubrica
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right text-slate-500 font-medium">{fmt(item.valorBase)}</td>
                      <td className="p-3 text-right font-bold text-slate-800">{fmt(item.valorSimulado)}</td>
                      <td className="p-3 text-right">
                        <div className={`font-black text-sm ${item.impactoMensal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {item.impactoMensal > 0 ? '+' : ''}{fmt(item.impactoMensal)}
                        </div>
                        <div className="flex flex-col items-end gap-0.5 mt-0.5">
                          <span className={`text-[10px] font-bold ${item.impactoMensal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {item.impactoMensal > 0 ? `-${pctSobreEbitda.toFixed(1)}% no EBITDA` : `+${pctSobreEbitda.toFixed(1)}% no EBITDA`}
                          </span>
                          {item.tipo === 'absolute' && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({pctSobreBase > 0 ? '+' : ''}{pctSobreBase.toFixed(1)}% s/ rubrica)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => removerAjuste(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remover rubrica"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {itensCalculados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      Nenhuma rubrica adicionada. Selecione uma conta acima para simular variações específicas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
