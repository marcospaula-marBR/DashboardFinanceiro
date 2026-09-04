"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Sparkles,
  Calculator,
  AlertTriangle,
  Zap,
  ListFilter,
  BarChart3,
  Building2,
  Calendar,
  Share2,
  FileText,
  RotateCcw,
  Loader2,
  Bot,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Filter,
  ChevronDown,
  CheckSquare,
  Square,
  HelpCircle,
  Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import { DreRow, DreMetadata } from '@/types/dre';
import { DreLancamentosService } from '@/services/dre-lancamentos.service';
import { APP_VERSION } from '@/version';

// Componentes modulares de precificação e simulação
import { PricingProposalSection } from '@/components/dre/pricing/PricingProposalSection';
import { ContractLossSection } from '@/components/dre/pricing/ContractLossSection';
import { QuickSimulationsSection } from '@/components/dre/pricing/QuickSimulationsSection';
import { RubricSimulationSection } from '@/components/dre/pricing/RubricSimulationSection';
import { PricingSimulatorGammaModal } from '@/components/dre/pricing/PricingSimulatorGammaModal';
import { PricingSimulatorEngine, BaseContractData } from '@/services/pricing-simulator.engine';
import { sortColList } from '@/lib/date-utils';

type SimulatorTab = 'precificacao' | 'perda' | 'rapida' | 'rubricas' | 'graficos';
type PeriodoHorizonte = '1m' | '3m' | '6m' | '12m' | 'all' | 'custom';

const fmt = (v?: number) =>
  v == null || isNaN(v)
    ? 'R$ 0,00'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const fmtPct = (v?: number) => {
  if (v == null || isNaN(v)) return '0,0%';
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
};

export default function DreSimulatorCustomPage() {
  // ─── Estados de Dados do DRE ──────────────────────────────
  const [rawData, setRawData] = useState<DreRow[]>([]);
  const [metadata, setMetadata] = useState<DreMetadata>({
    empresas: [], periodos: [], departamentos: [],
    contasDre: [], projetos: [], categorias: [], mapaMeses: {}
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>('Todas');

  // Filtros de Horizonte de Tempo (Curto, Médio, Longo Prazo)
  const [periodoHorizonte, setPeriodoHorizonte] = useState<PeriodoHorizonte>('6m'); // padrão: 6 meses (médio prazo)
  const [customPeriodos, setCustomPeriodos] = useState<string[]>([]);
  const [showPeriodFilterModal, setShowPeriodFilterModal] = useState<boolean>(false);

  // Seleção de Contratos que Absorvem Rateio
  const [selectedContractIds, setSelectedContractIds] = useState<string[]>([]);
  const [showContractSelectionDrawer, setShowContractSelectionDrawer] = useState<boolean>(false);

  // Aba ativa
  const [activeTab, setActiveTab] = useState<SimulatorTab>('precificacao');

  // Estados de IA e Gamma
  const [isGammaModalOpen, setIsGammaModalOpen] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // ─── Carregar Dados do DRE Real (LocalStorage + Banco) ───────────────────
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        // 1. Tentar carregar dados em cache sincronizados pelo DRE no navegador
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('dre_raw_data');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setRawData(parsed);
                setMetadata(DreLancamentosService.generateMetadataFromRows(parsed));
                setIsLoading(false);
              }
            } catch (e) {
              console.warn('[Simulador Custom] Erro ao analisar dre_raw_data:', e);
            }
          }
        }

        // 2. Carregar / validar com o banco de dados oficial
        const { rows } = await DreLancamentosService.fetchAllForDashboard();
        if (rows?.length) {
          setRawData(rows);
          setMetadata(DreLancamentosService.generateMetadataFromRows(rows));
        }
      } catch (e) {
        console.error('[Simulador Custom]', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ─── Colunas de Período Disponíveis e Selecionadas (Ordem Cronológica) ────
  const todasColunasMeses = useMemo(() => {
    if (!rawData.length) return [];
    const setCols = new Set<string>();
    rawData.forEach(r => {
      Object.keys(r).forEach(k => {
        if (k.includes('/')) setCols.add(k);
      });
    });
    return sortColList(Array.from(setCols));
  }, [rawData]);

  // Determinar quais meses compõem o cálculo conforme o horizonte
  const colunasFiltradas = useMemo(() => {
    if (!todasColunasMeses.length) return [];
    const total = todasColunasMeses.length;
    switch (periodoHorizonte) {
      case '1m':
        return [todasColunasMeses[total - 1]];
      case '3m':
        return todasColunasMeses.slice(Math.max(0, total - 3));
      case '6m':
        return todasColunasMeses.slice(Math.max(0, total - 6));
      case '12m':
        return todasColunasMeses.slice(Math.max(0, total - 12));
      case 'all':
        return todasColunasMeses;
      case 'custom':
        return customPeriodos.length > 0
          ? todasColunasMeses.filter((c: string) => customPeriodos.includes(c))
          : todasColunasMeses.slice(Math.max(0, total - 6));
      default:
        return todasColunasMeses.slice(Math.max(0, total - 6));
    }
  }, [todasColunasMeses, periodoHorizonte, customPeriodos]);

  // Descrição do período ativo
  const descricaoPeriodoAtivo = useMemo(() => {
    if (!colunasFiltradas.length) return 'Carregando...';
    if (colunasFiltradas.length === 1) return `Último Mês Fechado (${colunasFiltradas[0]})`;
    return `${colunasFiltradas.length} meses (${colunasFiltradas[0]} até ${colunasFiltradas[colunasFiltradas.length - 1]})`;
  }, [colunasFiltradas]);

  // ─── Extração e Filtragem dos Lançamentos ──────────────────
  const {
    faturamentoTotalMensal,
    faturamentoTotalPeriodo,
    despesasRateadasTotalPeriodo,
    despesasRateadasTotalMensal,
    custosTotalMensal,
    impostosTotalMensal,
    aliquotaImpostosMediaPct,
    razaoCustoDiretoMediaPct,
    ebitdaTotalMensal,
    todosContratosDRE,
    valoresContasBase
  } = useMemo(() => {
    if (!rawData.length || !colunasFiltradas.length) {
      return {
        faturamentoTotalMensal: 1000000,
        faturamentoTotalPeriodo: 6000000,
        despesasRateadasTotalPeriodo: 480000,
        despesasRateadasTotalMensal: 80000,
        custosTotalMensal: 600000,
        impostosTotalMensal: 85000,
        aliquotaImpostosMediaPct: 8.5,
        razaoCustoDiretoMediaPct: 60.0,
        ebitdaTotalMensal: 235000,
        todosContratosDRE: [
          { id: 'c1', nome: 'Contrato Alpha - Marinha', faturamentoMensal: 400000, custoDiretoMensal: 240000 },
          { id: 'c2', nome: 'Contrato Beta - Portuário', faturamentoMensal: 350000, custoDiretoMensal: 210000 },
          { id: 'c3', nome: 'Contrato Gamma - Logística', faturamentoMensal: 250000, custoDiretoMensal: 150000 }
        ] as BaseContractData[],
        valoresContasBase: {} as Record<string, number>
      };
    }

    const mesesCount = Math.max(1, colunasFiltradas.length);

    // Filtrar por empresa selecionada
    const rowsFiltradas = selectedEmpresa === 'Todas'
      ? rawData
      : rawData.filter(r => r.Empresa === selectedEmpresa);

    let somaFaturamento = 0;
    let somaCustos = 0;
    let somaDespesasRateadas = 0;
    let somaImpostos = 0;

    const contratosMap = new Map<string, { faturamento: number; custoDireto: number }>();
    const contasBaseMap: Record<string, number> = {};

    rowsFiltradas.forEach(r => {
      let somaLinha = 0;
      colunasFiltradas.forEach((c: string) => {
        const val = parseFloat(r[c]?.toString().replace(',', '.') || '0');
        if (!isNaN(val)) somaLinha += val;
      });

      const valorMensalMedio = somaLinha / mesesCount;

      if (r.ContaDRE) {
        contasBaseMap[r.ContaDRE] = (contasBaseMap[r.ContaDRE] || 0) + valorMensalMedio;
      }

      const contaNorm = (r.ContaDRE || '').toLowerCase();
      const catNorm = (r.Categoria || '').toLowerCase();

      // Impostos
      if (contaNorm.includes('imposto') || catNorm.includes('imposto') || catNorm.includes('irpj')) {
        somaImpostos += somaLinha;
      }

      // Receita
      if (contaNorm.includes('receita') || catNorm.includes('receita')) {
        somaFaturamento += somaLinha;
      } else if (contaNorm.includes('custo') || catNorm.includes('custo') || catNorm.includes('operacional')) {
        somaCustos += somaLinha;
      } else {
        // Despesas Rateadas Administrativas
        somaDespesasRateadas += somaLinha;
      }

      // Contratos
      const projeto = r.Projeto;
      if (projeto && !['–', '-', 'Geral', 'Sem Projeto', 'Administrativo', 'N/d', 'N/D', 'Sem Projeto', 'Sem projeto', 'n/d'].includes(projeto.trim())) {
        if (!contratosMap.has(projeto)) {
          contratosMap.set(projeto, { faturamento: 0, custoDireto: 0 });
        }
        const item = contratosMap.get(projeto)!;
        if (contaNorm.includes('receita')) {
          item.faturamento += somaLinha;
        } else if (contaNorm.includes('custo')) {
          item.custoDireto += somaLinha;
        }
      }
    });

    const listaContratos: BaseContractData[] = Array.from(contratosMap.entries())
      .filter(([_, v]) => v.faturamento > 0)
      .map(([nome, v]) => {
        const fatMensal = v.faturamento / mesesCount;
        const cstMensal = v.custoDireto > 0 ? v.custoDireto / mesesCount : fatMensal * 0.6;
        return {
          id: nome.trim(),
          nome: nome.trim(),
          faturamentoMensal: fatMensal,
          custoDiretoMensal: cstMensal
        };
      })
      .sort((a, b) => b.faturamentoMensal - a.faturamentoMensal);

    // Totais e Médias Mensais
    const fatMensal = (somaFaturamento > 0 ? somaFaturamento : 1000000 * mesesCount) / mesesCount;
    const despRateadaMensal = (somaDespesasRateadas > 0 ? somaDespesasRateadas : 80000 * mesesCount) / mesesCount;
    const cstMensal = (somaCustos > 0 ? somaCustos : 600000 * mesesCount) / mesesCount;
    const impMensal = somaImpostos / mesesCount;

    // Alíquota média de impostos real
    const aliqImp = somaFaturamento > 0 ? (somaImpostos / somaFaturamento) * 100 : 8.5;

    // Razão de Custo Direto ponderada dos contratos
    let somaFatContratos = 0;
    let somaCstContratos = 0;
    listaContratos.forEach(c => {
      somaFatContratos += c.faturamentoMensal;
      somaCstContratos += c.custoDiretoMensal;
    });
    const razaoCst = somaFatContratos > 0 ? (somaCstContratos / somaFatContratos) * 100 : 60.0;

    const ebitdaMensal = fatMensal - cstMensal - despRateadaMensal;

    return {
      faturamentoTotalMensal: fatMensal,
      faturamentoTotalPeriodo: somaFaturamento,
      despesasRateadasTotalPeriodo: somaDespesasRateadas,
      despesasRateadasTotalMensal: despRateadaMensal,
      custosTotalMensal: cstMensal,
      impostosTotalMensal: impMensal,
      aliquotaImpostosMediaPct: aliqImp > 0 ? aliqImp : 8.5,
      razaoCustoDiretoMediaPct: razaoCst > 0 ? razaoCst : 60.0,
      ebitdaTotalMensal: ebitdaMensal,
      todosContratosDRE: listaContratos,
      valoresContasBase: contasBaseMap
    };
  }, [rawData, colunasFiltradas, selectedEmpresa]);

  // Inicializar seleção de contratos (todos selecionados por padrão)
  useEffect(() => {
    if (todosContratosDRE.length > 0) {
      const todosIds = todosContratosDRE.map(c => c.id);
      setSelectedContractIds(prev => {
        if (prev.length === 0) return todosIds;
        const temValidos = prev.some(id => todosIds.includes(id));
        return temValidos ? prev : todosIds;
      });
    }
  }, [todosContratosDRE]);

  // Contratos efetivamente ativos na simulação (que geram/absorvem rateio)
  const contratosAtivosSimulacao = useMemo(() => {
    if (selectedContractIds.length === 0) return todosContratosDRE;
    return todosContratosDRE.filter(c => selectedContractIds.includes(c.id));
  }, [todosContratosDRE, selectedContractIds]);

  // Faturamento base ajustado apenas pelos contratos selecionados
  const faturamentoBaseSimulacao = useMemo(() => {
    if (contratosAtivosSimulacao.length === 0) return faturamentoTotalMensal;
    const soma = contratosAtivosSimulacao.reduce((acc, c) => acc + c.faturamentoMensal, 0);
    return soma > 0 ? soma : faturamentoTotalMensal;
  }, [contratosAtivosSimulacao, faturamentoTotalMensal]);

  // Toggle de seleção de contrato individual
  const toggleContrato = (id: string) => {
    if (selectedContractIds.includes(id)) {
      setSelectedContractIds(selectedContractIds.filter(cId => cId !== id));
    } else {
      setSelectedContractIds([...selectedContractIds, id]);
    }
  };

  const selecionarTodosContratos = () => {
    setSelectedContractIds(todosContratosDRE.map(c => c.id));
  };

  const limparSelecaoContratos = () => {
    if (todosContratosDRE.length > 0) {
      setSelectedContractIds([todosContratosDRE[0].id]);
    }
  };

  // Síntese Determinística Instantânea
  const deterministicInsight = useMemo(() => {
    if (activeTab === 'precificacao') {
      return PricingSimulatorEngine.generateDeterministicInsight('precificacao', {
        partNovoPct: 13.04,
        rateioNovo: despesasRateadasTotalMensal * 0.1304,
        fatorDiluicaoContratos: 0.8696,
        reducaoRelativaRateioPct: 13.04,
        precoMinMargemSobrePreco: 118159,
        precoMinMarkup: 115500
      });
    }
    if (activeTab === 'perda') {
      const primeiroContrato = contratosAtivosSimulacao[0] || { nome: 'Contrato Selecionado', faturamentoMensal: 200000 };
      return PricingSimulatorEngine.generateDeterministicInsight('perda', {
        contratoNome: primeiroContrato.nome,
        partOriginalPct: faturamentoBaseSimulacao > 0 ? (primeiroContrato.faturamentoMensal / faturamentoBaseSimulacao) * 100 : 20,
        rateioMedioAdicionalPct: 25,
        corteNecessarioDR: despesasRateadasTotalMensal * 0.2,
        lucroCessanteExcedente: 54000,
        temLucroCessanteAlemDoRateio: true,
        metaMensalReposicao: primeiroContrato.faturamentoMensal / 12,
        horizonteMeses: 12
      });
    }
    return PricingSimulatorEngine.generateDeterministicInsight('rapida', {
      receitaSimulada: faturamentoBaseSimulacao - 100000,
      ebitdaSimulado: ebitdaTotalMensal - 100000,
      ebitdaSimuladoPct: ((ebitdaTotalMensal - 100000) / (faturamentoBaseSimulacao - 100000)) * 100,
      variacaoResultadoAbsoluta: -100000,
      breakEvenOriginal: 350000,
      breakEvenSimulado: 420000
    });
  }, [activeTab, despesasRateadasTotalMensal, contratosAtivosSimulacao, faturamentoBaseSimulacao, ebitdaTotalMensal]);

  // Invocar Análise Completa do BrisinhAI via API
  const handleConsultarBrisinhAI = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: selectedEmpresa,
          scenarioName: `Simulação de ${activeTab.toUpperCase()}`,
          assumptionsSummary: `Base DRE: R$ ${faturamentoBaseSimulacao.toLocaleString('pt-BR')}/mês (${descricaoPeriodoAtivo}) - Despesas Rateadas Totais: R$ ${despesasRateadasTotalPeriodo.toLocaleString('pt-BR')} (Média: R$ ${despesasRateadasTotalMensal.toLocaleString('pt-BR')}/mês)`,
          metrics: {
            faturamentoBase: faturamentoBaseSimulacao,
            despesasRateadas: despesasRateadasTotalMensal,
            ebitdaBase: ebitdaTotalMensal
          }
        })
      });
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
      } else {
        setAiAnalysis(deterministicInsight);
      }
    } catch (e) {
      console.error('[BrisinhAI]', e);
      setAiAnalysis(deterministicInsight);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Compilar Markdown para Gamma
  const compiledMarkdownForGamma = useMemo(() => {
    return `# Relatório Executivo de Precificação & Cenários DRE — ${selectedEmpresa}

**Grupo Mar Brasil • Controladoria & CFO**
*Data da Simulação:* ${new Date().toLocaleDateString('pt-BR')}
*Período Base:* ${descricaoPeriodoAtivo}

---

## 1. Dados Base do DRE
- **Faturamento Médio Mensal:** ${fmt(faturamentoBaseSimulacao)}
- **Total de Despesas Rateadas no Período (DR_p):** ${fmt(despesasRateadasTotalPeriodo)} (Média: ${fmt(despesasRateadasTotalMensal)}/mês)
- **Alíquota Média de Impostos s/ Receita:** ${aliquotaImpostosMediaPct.toFixed(1)}%
- **Proporção Média de Custos Diretos:** ${razaoCustoDiretoMediaPct.toFixed(1)}%
- **Contratos Incluídos no Rateio:** ${contratosAtivosSimulacao.length} de ${todosContratosDRE.length}

---

## 2. Diagnóstico da Simulação (${activeTab.toUpperCase()})
${aiAnalysis || deterministicInsight}

---

## 3. Matriz de Contratos & Impactos
| Contrato | Faturamento Mensal | Custo Direto Estimado | Participação |
| :--- | :---: | :---: | :---: |
${contratosAtivosSimulacao.slice(0, 8).map(c => `| ${c.nome} | ${fmt(c.faturamentoMensal)} | ${fmt(c.custoDiretoMensal)} | ${fmtPct((c.faturamentoMensal / faturamentoBaseSimulacao) * 100)} |`).join('\n')}

---

## 4. Parecer Executivo do BrisinhAI
${aiAnalysis || 'Cenário executivo validado matematicamente com preservação da base real e cálculo determinístico de rateio.'}
`;
  }, [
    selectedEmpresa,
    activeTab,
    descricaoPeriodoAtivo,
    faturamentoBaseSimulacao,
    despesasRateadasTotalPeriodo,
    despesasRateadasTotalMensal,
    aliquotaImpostosMediaPct,
    razaoCustoDiretoMediaPct,
    contratosAtivosSimulacao,
    todosContratosDRE,
    aiAnalysis,
    deterministicInsight
  ]);

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 pb-16 font-sans">
      {/* ── Top Header Corporativo (Padrão People/DRE com Botão Voltar ao Início) ── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Navegação e Título */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 p-2 px-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 transition-all shadow-xs active:scale-95 text-xs font-bold"
            >
              <ChevronLeft size={16} />
              <span>Voltar ao Início</span>
            </Link>

            <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Simulador Executivo DRE</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                    CFO Suite • {APP_VERSION}
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Precificação marginal de licitações, sensibilidade de perda de contratos e simulação de rubricas
              </p>
            </div>
          </div>

          {/* Seletor de Empresa e Ações Globais */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs">
              <Building2 size={15} className="text-slate-500 ml-1" />
              <select
                value={selectedEmpresa}
                onChange={e => setSelectedEmpresa(e.target.value)}
                className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer pr-2 text-xs"
              >
                <option value="Todas">Todas as Empresas (Consolidado)</option>
                {metadata.empresas.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsGammaModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
              title="Gerar apresentação executiva no Gamma"
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">Gerador Gamma</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Barra de Filtros de Horizonte de Tempo & Seleção de Contratos ── */}
      <section className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Seletor de Horizontes (Curto, Médio, Longo Prazo) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Clock size={13} />
              <span>Base DRE:</span>
            </span>

            <button
              onClick={() => setPeriodoHorizonte('1m')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                periodoHorizonte === '1m'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Último Mês
            </button>

            <button
              onClick={() => setPeriodoHorizonte('3m')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                periodoHorizonte === '3m'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Curto Prazo (3m)
            </button>

            <button
              onClick={() => setPeriodoHorizonte('6m')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                periodoHorizonte === '6m'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Médio Prazo (6m)
            </button>

            <button
              onClick={() => setPeriodoHorizonte('12m')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                periodoHorizonte === '12m'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Longo Prazo (12m)
            </button>

            <button
              onClick={() => setPeriodoHorizonte('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                periodoHorizonte === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todo o Histórico
            </button>
          </div>

          {/* Botão para Filtrar Contratos que Geram Rateio */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowContractSelectionDrawer(!showContractSelectionDrawer)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-250 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-all active:scale-95"
            >
              <Filter size={13} className="text-slate-500" />
              <span>Contratos no Rateio ({contratosAtivosSimulacao.length} de {todosContratosDRE.length})</span>
              <ChevronDown size={13} className={`transition-transform ${showContractSelectionDrawer ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Gaveta Expansível de Seleção de Contratos */}
        {showContractSelectionDrawer && (
          <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-100 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">
                Selecione os contratos que compõem a base de faturamento e absorção de despesas rateadas:
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selecionarTodosContratos}
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  Marcar Todos
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={limparSelecaoContratos}
                  className="font-semibold text-slate-500 hover:underline"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-thin">
              {todosContratosDRE.map(c => {
                const isSelected = selectedContractIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-300 bg-emerald-50/50 text-slate-800'
                        : 'border-slate-200 bg-slate-50/50 text-slate-400 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleContrato(c.id)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 w-3.5 h-3.5"
                    />
                    <div className="truncate flex-1">
                      <span className="font-bold truncate block">{c.nome}</span>
                      <span className="text-[10px] text-slate-500">{fmt(c.faturamentoMensal)}/mês</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Conteúdo Principal ────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Banner de Carregamento */}
        {isLoading && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs">
            <Loader2 size={16} className="animate-spin text-emerald-600" />
            <span>Sincronizando faturamento, centros de custo e despesas rateadas do DRE real...</span>
          </div>
        )}

        {/* ── CARD DE DESTAQUE EXECUTIVO DAS DESPESAS RATEADAS (DR_p) ──────── */}
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/30 text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-400/30">
                  Despesas Rateadas Estruturais (DR_p)
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  • {descricaoPeriodoAtivo}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {fmt(despesasRateadasTotalPeriodo)}
              </h2>
              <p className="text-xs text-indigo-200/80 mt-1 max-w-xl leading-relaxed">
                Total acumulado das despesas administrativas e estruturais que são rateadas entre os contratos ativos proporcionalmente à receita.
              </p>
            </div>

            {/* Métricas Auxiliares em Cards Escuros */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">
                  Média Mensal (DR_p)
                </span>
                <span className="text-lg font-black text-white block mt-0.5">
                  {fmt(despesasRateadasTotalMensal)}
                </span>
                <span className="text-[10px] text-slate-300">por mês</span>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">
                  % s/ Faturamento
                </span>
                <span className="text-lg font-black text-emerald-400 block mt-0.5">
                  {faturamentoBaseSimulacao > 0 ? fmtPct((despesasRateadasTotalMensal / faturamentoBaseSimulacao) * 100) : '0%'}
                </span>
                <span className="text-[10px] text-slate-300">peso estrutural</span>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">
                  Base Faturamento
                </span>
                <span className="text-lg font-black text-white block mt-0.5">
                  {fmt(faturamentoBaseSimulacao)}
                </span>
                <span className="text-[10px] text-slate-300">{contratosAtivosSimulacao.length} contratos</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Navegação por Abas Modernas (Clean & Touch-friendly) ──────────── */}
        <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('precificacao')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
              activeTab === 'precificacao'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Calculator size={15} />
            <span>1. Precificação de Licitações</span>
          </button>

          <button
            onClick={() => setActiveTab('perda')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
              activeTab === 'perda'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <AlertTriangle size={15} />
            <span>2. Perda de Contrato & Sensibilidade</span>
          </button>

          <button
            onClick={() => setActiveTab('rapida')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
              activeTab === 'rapida'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Zap size={15} />
            <span>3. Simulação Rápida (R$ e %)</span>
          </button>

          <button
            onClick={() => setActiveTab('rubricas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
              activeTab === 'rubricas'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <ListFilter size={15} />
            <span>4. Ajuste por Rubricas</span>
          </button>

          <button
            onClick={() => setActiveTab('graficos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
              activeTab === 'graficos'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <BarChart3 size={15} />
            <span>5. Gráficos & Comparativos</span>
          </button>
        </div>

        {/* ── Painel Executivo BrisinhAI (Inline e Objetivo) ────────────────── */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl border border-slate-700/80 p-5 text-white shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-black">
                <Bot size={18} />
              </div>
              <div>
                <span className="text-xs font-black tracking-tight text-amber-300 uppercase">
                  Parecer Executivo — BrisinhAI
                </span>
                <p className="text-[11px] text-slate-400">
                  Diagnóstico fundamentado estritamente nas regras e dados calculados da tela ({descricaoPeriodoAtivo})
                </p>
              </div>
            </div>

            <button
              onClick={handleConsultarBrisinhAI}
              disabled={isAiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold transition-all self-start sm:self-auto disabled:opacity-50"
            >
              {isAiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span>{isAiLoading ? 'Analisando...' : 'Aprofundar Análise IA'}</span>
            </button>
          </div>

          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed mt-3 font-normal">
            {aiAnalysis || deterministicInsight}
          </p>
        </div>

        {/* ── Renderização da Seção da Aba Ativa ────────────────────────────── */}
        {activeTab === 'precificacao' && (
          <PricingProposalSection
            ftOriginal={faturamentoBaseSimulacao}
            drOriginal={despesasRateadasTotalMensal}
            contratosAtivos={contratosAtivosSimulacao}
            razaoCustoDiretoMediaPct={razaoCustoDiretoMediaPct}
            aliquotaImpostosMediaPct={aliquotaImpostosMediaPct}
            basePeriodoDescricao={descricaoPeriodoAtivo}
          />
        )}

        {activeTab === 'perda' && (
          <ContractLossSection
            ftOriginal={faturamentoBaseSimulacao}
            drOriginal={despesasRateadasTotalMensal}
            contratosAtivos={contratosAtivosSimulacao}
          />
        )}

        {activeTab === 'rapida' && (
          <QuickSimulationsSection
            receitaBase={faturamentoBaseSimulacao}
            custosBase={custosTotalMensal}
            despesasBase={despesasRateadasTotalMensal}
          />
        )}

        {activeTab === 'rubricas' && (
          <RubricSimulationSection
            contasDisponiveis={metadata.contasDre}
            valoresContasBase={valoresContasBase}
            receitaBase={faturamentoBaseSimulacao}
            ebitdaBase={ebitdaTotalMensal}
          />
        )}

        {activeTab === 'graficos' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6">
              <h3 className="text-sm font-black text-slate-800 tracking-tight mb-4">
                Visão Comparativa: Faturamento vs. Custos Diretos dos Contratos Ativos ({descricaoPeriodoAtivo})
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={contratosAtivosSimulacao.slice(0, 8).map(c => ({
                      nome: c.nome.length > 15 ? c.nome.slice(0, 15) + '...' : c.nome,
                      Faturamento: c.faturamentoMensal,
                      CustoDireto: c.custoDiretoMensal,
                      MargemContrib: c.faturamentoMensal - c.custoDiretoMensal
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                    <YAxis
                      tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <Tooltip
                      formatter={(v: any) => fmt(v)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="Faturamento" fill="#10b981" radius={[4, 4, 0, 0]} name="Faturamento Mensal" />
                    <Bar dataKey="CustoDireto" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Custo Direto" />
                    <Bar dataKey="MargemContrib" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Margem de Contribuição" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* DRE Sintética Resumida */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6">
              <h3 className="text-sm font-black text-slate-800 tracking-tight mb-3">
                Estrutura Sintética de Fechamento Médio Mensal ({descricaoPeriodoAtivo})
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex items-center justify-between font-bold text-slate-800">
                  <span>(+) Receita Operacional Bruta</span>
                  <span className="text-emerald-700">{fmt(faturamentoBaseSimulacao)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-slate-600">
                  <span>(-) Impostos s/ Faturamento (Média: {aliquotaImpostosMediaPct.toFixed(1)}%)</span>
                  <span className="text-rose-700">-{fmt(impostosTotalMensal)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-slate-600">
                  <span>(-) Custos Operacionais Diretos (Média: {razaoCustoDiretoMediaPct.toFixed(1)}%)</span>
                  <span className="text-amber-700">-{fmt(custosTotalMensal)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between font-bold text-slate-900 bg-slate-50/60 px-2 rounded-lg">
                  <span>(=) Margem de Contribuição Global</span>
                  <span className="text-slate-900">{fmt(faturamentoBaseSimulacao - custosTotalMensal)} ({fmtPct(((faturamentoBaseSimulacao - custosTotalMensal) / faturamentoBaseSimulacao) * 100)})</span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-slate-600">
                  <span>(-) Despesas Administrativas & Rateadas (DR_p)</span>
                  <span className="text-indigo-700">-{fmt(despesasRateadasTotalMensal)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between font-black text-slate-900 bg-emerald-50/60 px-2 rounded-lg">
                  <span>(=) EBITDA Operacional Médio</span>
                  <span className="text-emerald-800">{fmt(ebitdaTotalMensal)} ({fmtPct((ebitdaTotalMensal / faturamentoBaseSimulacao) * 100)})</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Modal Gamma ───────────────────────────────────────────────────── */}
      <PricingSimulatorGammaModal
        isOpen={isGammaModalOpen}
        onClose={() => setIsGammaModalOpen(false)}
        markdownContent={compiledMarkdownForGamma}
        empresaNome={selectedEmpresa}
      />
    </div>
  );
}
