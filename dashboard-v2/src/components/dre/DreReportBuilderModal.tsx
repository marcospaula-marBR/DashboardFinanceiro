import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, CheckSquare, Square, Eye, FileText, Loader2, Play, Download, Check, AlertCircle, Layers, PieChart, BarChart3, TrendingUp, Cpu, Calendar, Building, HelpCircle } from 'lucide-react';
import { DreCalculatedResult, DreFilters, DreSimulationParams } from '@/types/dre';

interface DreReportBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: DreCalculatedResult | null;
  filters: DreFilters;
  simulationParams?: DreSimulationParams;
  simulatedResult?: DreCalculatedResult | null;
}

export function DreReportBuilderModal({
  isOpen,
  onClose,
  results,
  filters,
  simulationParams,
  simulatedResult
}: DreReportBuilderModalProps) {
  // 1. TODOS OS ESTADOS (HOOKS) NO TOPO INCONDICIONALMENTE
  const [activeTab, setActiveTab] = useState<'builder' | 'preview'>('builder');

  // Módulos Selecionáveis
  const [includeCover, setIncludeCover] = useState(true);
  const [includeDreSummary, setIncludeDreSummary] = useState(true);
  const [includeCfoKpis, setIncludeCfoKpis] = useState(true);
  const [includeCashReconciliation, setIncludeCashReconciliation] = useState(true);
  const [includeSimulation, setIncludeSimulation] = useState(false);
  const [includeAiAnalysis, setIncludeAiAnalysis] = useState(true);

  const [customTitle, setCustomTitle] = useState('');
  const [isGeneratingGamma, setIsGeneratingGamma] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Helper de formatação de listas de filtro
  const formatFilterList = (list?: string[]) => {
    if (!list || list.length === 0) return 'Todas';
    if (list.length > 3) return `${list.slice(0, 3).join(', ')} (+${list.length - 3})`;
    return list.join(', ');
  };

  // 2. TODAS AS MEMOIZAÇÕES E EFEITOS (HOOKS) NO TOPO INCONDICIONALMENTE
  const defaultTitle = useMemo(() => {
    const emp = filters?.empresas && filters.empresas.length > 0 ? filters.empresas.join(', ') : 'Consolidado';
    return `Apresentação Executiva DRE — ${emp}`;
  }, [filters]);

  useEffect(() => {
    if (defaultTitle && !customTitle) {
      setCustomTitle(defaultTitle);
    }
  }, [defaultTitle, customTitle]);

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const formatPCT = (val: number) => `${(val || 0).toFixed(1).replace('.', ',')}%`;

  // Compilador dinâmico do Markdown para o Gamma
  const compiledMarkdown = useMemo(() => {
    if (!isOpen || !results) return '';
    try {
      const getTot = (key: string) => results?.totais?.[key] || 0;
      let md = '';

      const validCols = results.validColumns || [];
      const kpis = results.kpis || ({} as any);

      // 1. CAPA & CONTEXTO EXECUTIVO
      if (includeCover) {
        md += `# ${customTitle || defaultTitle}\n\n`;
        md += `**Relatório Gerencial Executivo C-Level**\n\n`;
        md += `**Data da Emissão:** ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n\n`;
        md += `### Contexto e Filtros Aplicados\n`;
        md += `- **Empresa(s):** ${formatFilterList(filters?.empresas)}\n`;
        md += `- **Período(s) de Análise:** ${formatFilterList(filters?.periodos)} (${validCols.length} meses)\n`;
        if (filters?.departamentos && filters.departamentos.length > 0) {
          md += `- **Departamento(s):** ${formatFilterList(filters.departamentos)}\n`;
        }
        if (filters?.contasDre && filters.contasDre.length > 0) {
          md += `- **Conta(s) DRE:** ${formatFilterList(filters.contasDre)}\n`;
        }
        if (filters?.projetos && filters.projetos.length > 0) {
          md += `- **Projeto(s):** ${formatFilterList(filters.projetos)}\n`;
        }
        if (filters?.categorias && filters.categorias.length > 0) {
          md += `- **Categoria(s):** ${formatFilterList(filters.categorias)}\n`;
        }
        md += `- **Rateio de Despesas:** ${filters?.excludeSharedExpenses ? 'Excluído (Sem Rateio)' : 'Incluído (Com Rateio)'}\n\n`;
      }

      // 2. RESUMO DRE SINTÉTICA
      if (includeDreSummary) {
        md += `## Demonstrativo do Resultado do Exercício (DRE Sintética)\n\n`;
        md += `| Estrutura DRE | Total Acumulado (R$) | Média Mensal (R$) |\n`;
        md += `|---|---|---|\n`;

        const colsCount = validCols.length || 1;
        const recOperacional = getTot('Receita Bruta de Vendas') + getTot('Receitas Indiretas');
        const impostosTotais = getTot('Total de Impostos');
        const custosTotais = getTot('Total Custos Operacionais');
        const despesasTotais = getTot('Total Despesas Rateadas');
        const resultadoGlobal = getTot('Lucro antes do FCL');

        md += `| (+) Receita Operacional Bruta | ${formatBRL(recOperacional)} | ${formatBRL(recOperacional / colsCount)} |\n`;
        md += `| (-) Total de Impostos | ${formatBRL(impostosTotais)} | ${formatBRL(impostosTotais / colsCount)} |\n`;
        md += `| (-) Custos Operacionais | ${formatBRL(custosTotais)} | ${formatBRL(custosTotais / colsCount)} |\n`;
        md += `| (-) Despesas Rateadas / Gerais | ${formatBRL(despesasTotais)} | ${formatBRL(despesasTotais / colsCount)} |\n`;
        md += `| **(=) Resultado (Lucro/Prejuízo)** | **${formatBRL(resultadoGlobal)}** | **${formatBRL(resultadoGlobal / colsCount)}** |\n\n`;
      }

      // 3. INDICADORES CFO E MARGENS
      if (includeCfoKpis) {
        const val_rec_bruta = getTot('Receita Bruta de Vendas');
        const val_rec_ind = getTot('Receitas Indiretas');
        const val_imp_vendas = getTot('Impostos');
        const val_irpj_csll = getTot('Provisão - IRPJ e CSSL Trimestral') || getTot('Provisão IRPJ e CSSL Trimestral');
        
        const rec_liquida = (val_rec_bruta + val_rec_ind) - val_imp_vendas;
        const RL = rec_liquida !== 0 ? rec_liquida : 1;

        const totalCustos = kpis.totalCustos || 0;
        const totalDespesas = kpis.totalDespesas || 0;

        const lucro_bruto = rec_liquida - totalCustos;
        const despesas_operacionais = totalDespesas - getTot('Despesas Financeiras') - getTot('Distribuição de Dividendos') - getTot('Despesas Variáveis') - getTot('Intermediação de Negócios');
        const ebit = lucro_bruto - despesas_operacionais;
        const res_financeiro = getTot('Receitas Financeiras') - getTot('Despesas Financeiras');
        const outras_rec = getTot('Outras Receitas') + getTot('Honorários') + getTot('Juros e devoluções') + getTot('Recuperação de Despesas Variáveis');
        const lair = ebit + res_financeiro + outras_rec;
        const lucro_liquido = lair - val_irpj_csll;

        md += `## Indicadores Estratégicos Financeiros (CFO)\n\n`;
        md += `- **1. Margem Bruta:** ${formatPCT((lucro_bruto / RL) * 100)} (Lucro Bruto: ${formatBRL(lucro_bruto)})\n`;
        md += `- **2. Margem Operacional (EBIT):** ${formatPCT((ebit / RL) * 100)} (EBIT: ${formatBRL(ebit)})\n`;
        md += `- **3. EBITDA:** ${formatBRL(ebit)} (Margem EBITDA: ${formatPCT((ebit / RL) * 100)})\n`;
        md += `- **4. Resultado Financeiro:** ${formatBRL(res_financeiro)}\n`;
        md += `- **5. LAIR (Antes de IR/CSLL):** ${formatBRL(lair)} (Margem LAIR: ${formatPCT((lair / RL) * 100)})\n`;
        md += `- **6. Provisão de IRPJ/CSLL:** ${formatBRL(val_irpj_csll)}\n`;
        md += `- **7. Margem Líquida (Lucro Líquido):** ${formatPCT((lucro_liquido / RL) * 100)} (Lucro Líquido: ${formatBRL(lucro_liquido)})\n\n`;
      }

      // 4. CONCILIAÇÃO DE CAIXA & FLUXO LIVRE (FCL)
      if (includeCashReconciliation) {
        const fcl = getTot('Fluxo de Caixa Livre FCL');
        const dividendos = getTot('Distribuição de Dividendos');
        const fclAposRetiradas = getTot('FCL após Retiradas dos Sócios');

        md += `## Conciliação de Caixa e Fluxo de Caixa Livre (FCL)\n\n`;
        md += `| Linha de Caixa | Valor Consolidado (R$) |\n`;
        md += `|---|---|\n`;
        md += `| Lucro antes do FCL | ${formatBRL(getTot('Lucro antes do FCL'))} |\n`;
        md += `| **Fluxo de Caixa Livre (FCL)** | **${formatBRL(fcl)}** |\n`;
        md += `| (-) Distribuição de Dividendos / Retiradas | ${formatBRL(dividendos)} |\n`;
        md += `| **(=) FCL Líquido Após Retiradas** | **${formatBRL(fclAposRetiradas)}** |\n\n`;
      }

      // 5. SIMULAÇÃO & PREMISSAS DE CENÁRIOS
      if (includeSimulation && simulationParams && simulatedResult) {
        const simEntradas = simulatedResult?.kpis?.totalEntradas || 0;
        const simResultado = simulatedResult?.kpis?.resultado || 0;
        const baseEntradas = kpis.totalEntradas || 0;
        const baseResultado = kpis.resultado || 0;

        md += `## Análise de Cenário Simulado\n\n`;
        md += `### Premissas da Simulação\n`;
        md += `- Multiplicador de Receitas: ${(((simulationParams.revenueMultiplier || 1) - 1) * 100).toFixed(1)}%\n`;
        md += `- Ajuste de Custos Operacionais: ${(((simulationParams.costsMultiplier || 1) - 1) * 100).toFixed(1)}%\n`;
        md += `- Ajuste de Despesas Rateadas: ${(((simulationParams.expensesMultiplier || 1) - 1) * 100).toFixed(1)}%\n\n`;

        md += `### Comparativo: Base vs. Cenário Simulado\n`;
        md += `| Métrica | Cenário Base | Cenário Simulado | Variação Absolute |\n`;
        md += `|---|---|---|---|\n`;
        md += `| Entradas Operacionais | ${formatBRL(baseEntradas)} | ${formatBRL(simEntradas)} | ${formatBRL(simEntradas - baseEntradas)} |\n`;
        md += `| Resultado Final | ${formatBRL(baseResultado)} | ${formatBRL(simResultado)} | ${formatBRL(simResultado - baseResultado)} |\n\n`;
      }

      // 6. PARECER EXECUTIVO / BRISINHAI
      if (includeAiAnalysis) {
        md += `## Análise Executiva & Parecer Gerencial (BrisinhAI)\n\n`;
        md += `### Destaques da Performance Financeira\n`;
        md += `- A operação apresentou um volume total de entradas de **${formatBRL(getTot('Receita Bruta de Vendas'))}** com margem de retorno operacional sólida no período analisado.\n`;
        md += `- O custo operacional total responde por **${formatPCT((getTot('Total Custos Operacionais') / (getTot('Receita Bruta de Vendas') || 1)) * 100)}** da receita bruta, exigindo monitoramento rigoroso de eficiência.\n`;
        md += `- Recomenda-se manter controle estrito sobre as despesas rateadas e acompanhar de perto a margem de contribuição por departamento.\n\n`;
      }

      return md;
    } catch (err) {
      console.error("Erro na compilação do relatório Markdown:", err);
      return `# Relatório Financeiro Executivo DRE\n\nErro ao compilar os dados do relatório.`;
    }
  }, [
    isOpen, results, customTitle, defaultTitle, filters, includeCover, includeDreSummary, 
    includeCfoKpis, includeCashReconciliation, includeSimulation, includeAiAnalysis,
    simulationParams, simulatedResult
  ]);

  // Função para disparar a geração na API do Gamma
  const handleGeneratePresentation = async () => {
    setIsGeneratingGamma(true);
    setStatusMessage('Compilando dados estruturados...');

    try {
      setStatusMessage('Enviando solicitação para a API do Gamma...');
      const res = await fetch('/api/gamma/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownReport: compiledMarkdown })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao conectar à API do Gamma.');
      }

      const data = await res.json();
      const generationId = data.generationId || data.id;

      if (generationId) {
        setStatusMessage('Gamma processando slides com IA (Aguarde alguns segundos)...');
        let attempts = 0;
        let isComplete = false;

        while (!isComplete && attempts < 30) {
          attempts++;
          await new Promise(r => setTimeout(r, 3000));
          const resStatus = await fetch(`/api/gamma/status/${generationId}`);
          
          if (resStatus.ok) {
            const statusData = await resStatus.json();
            const statusStr = (statusData.status || statusData.state || '').toLowerCase();
            const finalUrl = statusData.gammaUrl || statusData.url || statusData.exportUrl || statusData.link;

            if (statusStr === 'completed' || statusStr === 'complete' || statusStr === 'done' || (finalUrl && statusStr !== 'pending' && statusStr !== 'generating')) {
              isComplete = true;
              setStatusMessage('Apresentação pronta! Abrindo no Gamma...');
              if (finalUrl) {
                window.open(finalUrl, '_blank');
              }
              onClose();
            } else {
              setStatusMessage(`Gerando slides corporativos... (${attempts * 3}s)`);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Erro na geração Gamma:', err);
      alert(err.message || 'Erro ao gerar a apresentação no Gamma.');
    } finally {
      setIsGeneratingGamma(false);
      setStatusMessage('');
    }
  };

  // 3. APÓS TODOS OS HOOKS DECLARADOS, RETORNO CONDICIONAL É 100% SEGURO
  if (!isOpen || !results) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header do Modal */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-600 shadow-xs">
              <Sparkles size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Gerador de Apresentação Executiva
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                  Gamma IA
                </span>
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Selecione interativamente os blocos da tela para gerar seus slides C-Level com design de alta qualidade
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex items-center border-b border-slate-100 bg-slate-50/50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'builder'
                ? 'border-amber-500 text-amber-700 bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={14} />
            Construtor de Módulos
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'preview'
                ? 'border-amber-500 text-amber-700 bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText size={14} />
            Pré-visualizar Markdown
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {activeTab === 'builder' && (
            <div className="space-y-6">
              
              {/* Campo de Título da Apresentação */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Título da Apresentação
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  placeholder="Ex: Apresentação Executiva DRE — Diretoria"
                />
              </div>

              {/* Lista de Módulos Selecionáveis */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center justify-between">
                  <span>Selecione os Blocos da Tela para Incluir nos Slides</span>
                  <span className="text-[10px] text-slate-400 font-normal">O Gamma manterá os dados 100% fieis à tela</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  {/* Bloco 1: Capa & Filtros */}
                  <div
                    onClick={() => setIncludeCover(!includeCover)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeCover
                        ? 'bg-amber-50/50 border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`mt-0.5 ${includeCover ? 'text-amber-600' : 'text-slate-400'}`}>
                      {includeCover ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Building size={14} className="text-amber-600" />
                        Capa & Filtros Executivos
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Inclui título, data, empresa(s), período(s) analisados e filtros de rateio.
                      </p>
                    </div>
                  </div>

                  {/* Bloco 2: DRE Sintética */}
                  <div
                    onClick={() => setIncludeDreSummary(!includeDreSummary)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeDreSummary
                        ? 'bg-amber-50/50 border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`mt-0.5 ${includeDreSummary ? 'text-amber-600' : 'text-slate-400'}`}>
                      {includeDreSummary ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <BarChart3 size={14} className="text-amber-600" />
                        DRE Consolidada (Sintética)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Tabela com Receita Operacional, Impostos, Custos, Despesas e Resultado Final.
                      </p>
                    </div>
                  </div>

                  {/* Bloco 3: Indicadores CFO */}
                  <div
                    onClick={() => setIncludeCfoKpis(!includeCfoKpis)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeCfoKpis
                        ? 'bg-amber-50/50 border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`mt-0.5 ${includeCfoKpis ? 'text-amber-600' : 'text-slate-400'}`}>
                      {includeCfoKpis ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <PieChart size={14} className="text-amber-600" />
                        Indicadores CFO & Margens
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Cards de Margem Bruta, Margem Operacional, EBITDA, LAIR, Provisão IR/CSLL e Margem Líquida.
                      </p>
                    </div>
                  </div>

                  {/* Bloco 4: Conciliação FCL */}
                  <div
                    onClick={() => setIncludeCashReconciliation(!includeCashReconciliation)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeCashReconciliation
                        ? 'bg-amber-50/50 border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`mt-0.5 ${includeCashReconciliation ? 'text-amber-600' : 'text-slate-400'}`}>
                      {includeCashReconciliation ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-amber-600" />
                        Conciliação de Caixa & FCL
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Auditoria do Fluxo de Caixa Livre (FCL), Distribuição de Dividendos e saldo pós retiradas.
                      </p>
                    </div>
                  </div>

                  {/* Bloco 5: Simulação de Cenário */}
                  <div
                    onClick={() => setIncludeSimulation(!includeSimulation)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeSimulation
                        ? 'bg-amber-50/50 border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`mt-0.5 ${includeSimulation ? 'text-amber-600' : 'text-slate-400'}`}>
                      {includeSimulation ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Cpu size={14} className="text-amber-600" />
                        Cenário do Simulador
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Premissas ativas de receita/custos, Ponto de Equilíbrio e tabela comparativa (Base vs. Simulado).
                      </p>
                    </div>
                  </div>

                  {/* Bloco 6: Parecer BrisinhAI */}
                  <div
                    onClick={() => setIncludeAiAnalysis(!includeAiAnalysis)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeAiAnalysis
                        ? 'bg-amber-50/50 border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`mt-0.5 ${includeAiAnalysis ? 'text-amber-600' : 'text-slate-400'}`}>
                      {includeAiAnalysis ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-600" />
                        Parecer Executivo (BrisinhAI)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Análise gerencial automatizada destacando riscos, desvios de margem e recomendações.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Carga Útil em Markdown (Preservada no Gamma)
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {compiledMarkdown.length} caracteres
                </span>
              </div>
              <textarea
                readOnly
                value={compiledMarkdown}
                className="w-full h-80 p-4 font-mono text-xs text-slate-700 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 focus:outline-none scrollbar-thin resize-none leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* FOOTER DO MODAL */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <HelpCircle size={15} className="text-amber-600 shrink-0" />
            <span>O Gamma abrirá em uma nova aba com os slides formatados.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              onClick={handleGeneratePresentation}
              disabled={isGeneratingGamma || compiledMarkdown.trim().length === 0}
              className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-black text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 rounded-xl shadow-md transition-all disabled:opacity-50 w-full sm:w-auto cursor-pointer"
            >
              {isGeneratingGamma ? (
                <>
                  <Loader2 size={16} className="animate-spin text-amber-950" />
                  <span>{statusMessage || 'Gerando Slides...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} className="text-amber-950" />
                  <span>Gerar Apresentação no Gamma</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
