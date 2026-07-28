import React, { useState } from 'react';
import { 
  X, TrendingUp, ListTree, BarChart2, Plus, Minus, 
  ChevronRight, ChevronDown, Maximize2, Minimize2, Download, Sparkles, Loader2 
} from 'lucide-react';
import { DreRow, DreCalculatedResult, DreFilters } from '@/types/dre';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip 
} from 'recharts';

interface DreDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  mensalData: Record<string, number>;
  sourceRows?: Record<string, DreRow[]>;
  isPrivacyMode: boolean;
  isRevenuePrivacyMode?: boolean;
  allResults?: DreCalculatedResult | null;
  filters?: DreFilters;
}

export function DreDetailsModal({ 
  isOpen, 
  onClose, 
  title, 
  mensalData, 
  sourceRows,
  isPrivacyMode,
  isRevenuePrivacyMode,
  allResults,
  filters
}: DreDetailsModalProps) {
  
  const [activeTab, setActiveTab] = useState<'chart' | 'transactions'>('chart');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [isMaximized, setIsMaximized] = useState(false);
  const [isGeneratingGamma, setIsGeneratingGamma] = useState(false);

  const formatValueStandard = (value: number) => {
    if (isPrivacyMode) return 'R$ ****';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const toggleCat = (month: string, cat: string) => {
    const key = `${month}-${cat}`;
    setExpandedCats(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  const isLucroAntesFcl = title === 'Resultado Operacional' || title === 'Lucro antes do FCL';
  const isFcl = title === 'Fluxo de Caixa Livre FCL';

  // Modal Container Class (Normal vs Maximizada)
  const containerClasses = isMaximized
    ? "bg-white w-[98vw] h-[96vh] max-w-none max-h-none rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200"
    : "bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-all duration-200";

  // Data processing for standard view
  const safeMensalData = mensalData || {};
  const data = Object.keys(safeMensalData).map(col => ({
    name: col,
    valor: safeMensalData[col] || 0
  }));

  const dataReversed = [...data].reverse();
  const total = data.reduce((acc, curr) => acc + curr.valor, 0);
  const average = data.length > 0 ? total / data.length : 0;

  const formatFilterList = (list?: string[]) => {
    if (!list || list.length === 0) return 'Todas';
    if (list.length > 3) return `${list.slice(0, 3).join(', ')} (+${list.length - 3})`;
    return list.join(', ');
  };

  const handleGenerateGamma = async () => {
    setIsGeneratingGamma(true);
    try {
      let md = `# Relatório Financeiro Executivo - ${title}\n\n`;
      md += `**Data da Emissão:** ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n\n`;

      if (filters) {
        md += `### Parâmetros e Filtros Selecionados\n`;
        md += `- **Empresa(s):** ${formatFilterList(filters.empresas)}\n`;
        md += `- **Período(s):** ${formatFilterList(filters.periodos)}\n`;
        md += `- **Departamento(s):** ${formatFilterList(filters.departamentos)}\n`;
        md += `- **Conta(s) DRE:** ${formatFilterList(filters.contasDre)}\n`;
        md += `- **Projeto(s):** ${formatFilterList(filters.projetos)}\n`;
        md += `- **Categoria(s):** ${formatFilterList(filters.categorias)}\n`;
        md += `- **Rateio de Despesas:** ${filters.excludeSharedExpenses ? 'Excluído (Sem Rateio)' : 'Incluído (Com Rateio)'}\n\n`;
      }

      md += `### Resumo dos Indicadores\n`;
      md += `- **Total Consolidado:** ${formatValueStandard(total)}\n`;
      md += `- **Média Mensal:** ${formatValueStandard(average)}\n\n`;

      if ((isLucroAntesFcl || isFcl) && allResults) {
        const cols = [...allResults.validColumns].reverse();
        md += `### Conciliação de Valores (${title})\n\n`;
        md += `| Linha de Composição | Total | Média | ${cols.join(' | ')} |\n`;
        md += `|---|---|---|${cols.map(() => '---').join('|')}|\n`;

        const getValMensal = (key: string, col: string) => allResults.mensal[key]?.[col] || 0;
        const getValTotal = (key: string) => allResults.totais[key] || 0;

        let auditRows: any[] = isLucroAntesFcl ? [
          { label: '(+) Receita (Entradas Operacionais)', key: 'Total Entradas Operacionais' },
          { label: '(-) Impostos', key: 'Total de Impostos' },
          { label: '(-) Custos Operacionais', key: 'Total Custos Operacionais' },
          { label: '(-) Despesas Rateadas', key: 'Total Despesas Rateadas' },
          { label: '(=) Lucro antes do FCL', key: 'Lucro antes do FCL' }
        ] : [
          { label: '(+) Total Entradas Operacionais', key: 'Total Entradas Operacionais' },
          { label: '(+) Outras Entradas', key: 'Outras Entradas' },
          { label: '(+) Intermediação de Negócios - Receitas', key: 'Intermediação de Negócios - Receitas' },
          { label: '(+) Mútuo - Entradas', key: 'Mútuo - Entradas' },
          { label: '(-) Total Saídas', key: 'Total Saídas' },
          { label: '(=) Fluxo de Caixa Livre (FCL)', key: 'Fluxo de Caixa Livre FCL' },
          { label: 'Distribuição de Dividendos', key: 'Distribuição de Dividendos' },
          { label: '(=) FCL após Retiradas dos Sócios', key: 'FCL após Retiradas dos Sócios' }
        ];

        auditRows.forEach(r => {
          const tot = getValTotal(r.key);
          const avg = cols.length > 0 ? tot / cols.length : 0;
          const mens = cols.map(m => formatValueStandard(getValMensal(r.key, m)));
          md += `| ${r.label} | ${formatValueStandard(tot)} | ${formatValueStandard(avg)} | ${mens.join(' | ')} |\n`;
        });
      } else if (activeTab === 'transactions' && sourceRows) {
        const monthNames = dataReversed.map(d => d.name);
        md += `### Transações de Origem Consolidadas\n\n`;
        md += `| Categoria / Projeto | Total | Média | ${monthNames.join(' | ')} |\n`;
        md += `|---|---|---|${monthNames.map(() => '---').join('|')}|\n`;

        dataReversed.forEach(item => {
          md += `| ${item.name} | ${formatValueStandard(item.valor)} | ${formatValueStandard(average)} | ${monthNames.map(m => m === item.name ? formatValueStandard(item.valor) : '-').join(' | ')} |\n`;
        });
      } else {
        md += `### Evolução Mensal (${title})\n\n`;
        md += `| Período | Valor Consolidado (R$) |\n|---|---|\n`;
        dataReversed.forEach(item => {
          md += `| ${item.name} | ${formatValueStandard(item.valor)} |\n`;
        });
      }

      const resGenerate = await fetch('/api/gamma/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownReport: md })
      });

      if (!resGenerate.ok) {
        const errData = await resGenerate.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao conectar à API do Gamma.');
      }

      const genData = await resGenerate.json();
      const generationId = genData.generationId || genData.id;

      if (generationId) {
        let isComplete = false;
        let attempts = 0;
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
              if (finalUrl) {
                window.open(finalUrl, '_blank');
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Erro ao gerar Gamma:', err);
      alert(err.message || 'Erro ao gerar apresentação no Gamma com IA.');
    } finally {
      setIsGeneratingGamma(false);
    }
  };

  // CSV Export Logic
  const handleExportCSV = () => {
    let csvContent = '';
    const sanitize = (val: string | number) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    if ((isLucroAntesFcl || isFcl) && allResults) {
      const cols = [...allResults.validColumns].reverse();
      const headers = ['Linha de Composição', 'Total', 'Média', ...cols];
      csvContent += headers.map(sanitize).join(';') + '\n';

      const getValMensal = (key: string, col: string) => allResults.mensal[key]?.[col] || 0;
      const getValTotal = (key: string) => allResults.totais[key] || 0;

      let auditRows: any[] = [];
      if (isLucroAntesFcl) {
        auditRows = [
          { label: '(+) Receita (Entradas Operacionais)', key: 'Total Entradas Operacionais', isSubtracted: false },
          { label: '(-) Impostos', key: 'Total de Impostos', isSubtracted: true },
          { label: '(-) Custos Operacionais', key: 'Total Custos Operacionais', isSubtracted: true },
          { label: '(-) Despesas Rateadas', key: 'Total Despesas Rateadas', isSubtracted: true },
          { label: '(=) Lucro antes do FCL', key: 'Lucro antes do FCL', isResult: true }
        ];
      } else {
        auditRows = [
          { label: '(+) Total Entradas Operacionais', key: 'Total Entradas Operacionais', isSubtracted: false },
          { label: '(+) Outras Entradas', key: 'Outras Entradas', isSubtracted: false },
          { label: '(+) Intermediação de Negócios - Receitas', key: 'Intermediação de Negócios - Receitas', isSubtracted: false },
          { label: '(+) Mútuo - Entradas', key: 'Mútuo - Entradas', isSubtracted: false },
          { label: '(-) Total Saídas', key: 'Total Saídas', isSubtracted: true },
          { label: '(=) Fluxo de Caixa Livre (FCL)', key: 'Fluxo de Caixa Livre FCL', isResult: true },
          { label: 'HEADER_USO_FCL', key: 'HEADER_USO_FCL', isHeader: true, labelHeader: '--- USO DO FCL ---' },
          { label: 'Distribuição de Dividendos', key: 'Distribuição de Dividendos', isSubtracted: false },
          { label: 'Intermediação de Negócios (Saídas)', key: 'Intermediação de Negócios', isSubtracted: false },
          { label: 'Mútuo - Saídas', key: 'Mútuo - Saídas', isSubtracted: false },
          { label: '(=) Total Retiradas dos Sócios', key: 'Total Retiradas dos Sócios', isResult: true },
          { label: '(=) FCL após Retiradas dos Sócios', key: 'FCL após Retiradas dos Sócios', isResult: true }
        ];
      }

      auditRows.forEach(row => {
        if (row.isHeader) {
          csvContent += sanitize(row.labelHeader || row.label) + ';' + cols.map(() => '').join(';') + ';\n';
          return;
        }
        const totalVal = getValTotal(row.key);
        const avgVal = cols.length > 0 ? totalVal / cols.length : 0;
        const rowVals = [
          row.label,
          totalVal.toFixed(2).replace('.', ','),
          avgVal.toFixed(2).replace('.', ','),
          ...cols.map(m => (getValMensal(row.key, m)).toFixed(2).replace('.', ','))
        ];
        csvContent += rowVals.map(sanitize).join(';') + '\n';
      });
    } else if (activeTab === 'transactions' && sourceRows) {
      const monthNames = dataReversed.map(d => d.name);
      const headers = ['Categoria', 'Projeto / Empresa', 'Total', 'Média', ...monthNames];
      csvContent += headers.map(sanitize).join(';') + '\n';

      const grouped: Record<string, {
        totalGlobal: number;
        totaisMensais: Record<string, number>;
        projetos: Record<string, {
          projeto: string;
          empresa: string;
          totalProjGlobal: number;
          mensalProj: Record<string, number>;
        }>
      }> = {};

      data.forEach(item => {
        const monthName = item.name;
        const monthRows = sourceRows ? sourceRows[monthName] || [] : [];
        monthRows.forEach(r => {
          const val = parseFloat(r[monthName]?.toString().replace(',', '.') || '0');
          if (val === 0) return;
          const cat = r.Categoria || 'Sem Categoria';
          const proj = r.Projeto || '-';
          const emp = r.Empresa || '-';

          if (!grouped[cat]) {
            grouped[cat] = { totalGlobal: 0, totaisMensais: {}, projetos: {} };
          }
          grouped[cat].totalGlobal += val;
          grouped[cat].totaisMensais[monthName] = (grouped[cat].totaisMensais[monthName] || 0) + val;

          const projKey = `${proj}|${emp}`;
          if (!grouped[cat].projetos[projKey]) {
            grouped[cat].projetos[projKey] = { projeto: proj, empresa: emp, totalProjGlobal: 0, mensalProj: {} };
          }
          grouped[cat].projetos[projKey].totalProjGlobal += val;
          grouped[cat].projetos[projKey].mensalProj[monthName] = (grouped[cat].projetos[projKey].mensalProj[monthName] || 0) + val;
        });
      });

      Object.entries(grouped).forEach(([cat, catData]) => {
        const catAvg = data.length > 0 ? catData.totalGlobal / data.length : 0;
        csvContent += [
          `[CATEGORIA] ${cat}`,
          '-',
          catData.totalGlobal.toFixed(2).replace('.', ','),
          catAvg.toFixed(2).replace('.', ','),
          ...monthNames.map(m => (catData.totaisMensais[m] || 0).toFixed(2).replace('.', ','))
        ].map(sanitize).join(';') + '\n';

        Object.values(catData.projetos).forEach(p => {
          const projAvg = data.length > 0 ? p.totalProjGlobal / data.length : 0;
          csvContent += [
            `  ${cat}`,
            `${p.projeto} (${p.empresa})`,
            p.totalProjGlobal.toFixed(2).replace('.', ','),
            projAvg.toFixed(2).replace('.', ','),
            ...monthNames.map(m => (p.mensalProj[m] || 0).toFixed(2).replace('.', ','))
          ].map(sanitize).join(';') + '\n';
        });
      });
    } else {
      const headers = ['Período', 'Valor Consolidado (R$)'];
      csvContent += headers.map(sanitize).join(';') + '\n';
      dataReversed.forEach(item => {
        csvContent += [item.name, item.valor.toFixed(2).replace('.', ',')].map(sanitize).join(';') + '\n';
      });
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const sanitizedTitle = (title || 'Detalhamento').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `DRE_${sanitizedTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if ((isLucroAntesFcl || isFcl) && allResults) {
    const cols = [...allResults.validColumns].reverse();
    
    const getValMensal = (key: string, col: string) => allResults.mensal[key]?.[col] || 0;
    const getValTotal = (key: string) => allResults.totais[key] || 0;
    
    let auditRows: any[] = [];
    let modalTitle = title;
    let modalDesc = 'Demonstrativo de Composição para Auditoria';
    let infoBox = null;

    if (isLucroAntesFcl) {
      auditRows = [
      { 
        label: '(+) Receita (Entradas Operacionais)', 
        key: 'Total Entradas Operacionais', 
        isSubtracted: false,
        className: 'font-semibold text-slate-700'
      },
      { 
        label: '(-) Impostos', 
        key: 'Total de Impostos', 
        isSubtracted: true,
        className: 'text-rose-600 font-medium'
      },
      { 
        label: '(-) Custos Operacionais', 
        key: 'Total Custos Operacionais', 
        isSubtracted: true,
        className: 'text-rose-600 font-medium'
      },
      { 
        label: '(-) Despesas Rateadas', 
        key: 'Total Despesas Rateadas', 
        isSubtracted: true,
        className: 'text-rose-500'
      },
      { 
        label: '(=) Resultado Operacional', 
        key: 'Lucro antes do FCL', 
        isResult: true,
        className: 'font-bold text-slate-900'
      }
      ];
      infoBox = (
        <div className="mt-4 bg-amber-50/60 border border-amber-200/50 rounded-2xl p-4 text-slate-700 text-[12px] leading-relaxed">
          <p className="font-bold text-amber-800 mb-1">Entendendo o Resultado Operacional:</p>
          <p>
            Este card representa o resultado líquido gerado pelas operações no período antes de deduzir investimentos de capital em <strong>Ativos, Consórcios</strong> e <strong>Serviços</strong>. Retiradas dos sócios não afetam este cálculo.
          </p>
          <p className="mt-2 font-semibold">
            Fórmula de Cálculo: Receitas - Impostos - Custos Operacionais - Despesas Rateadas = Resultado Operacional
          </p>
        </div>
      );
    } else if (isFcl) {
      auditRows = [
        { 
          label: '(+) Total Entradas Operacionais', 
          key: 'Total Entradas Operacionais', 
          isSubtracted: false,
          className: 'font-semibold text-slate-700'
        },
        { 
          label: '(+) Outras Entradas', 
          key: 'Outras Entradas', 
          isSubtracted: false,
          className: 'font-semibold text-slate-700'
        },
        { 
          label: '(+) Intermediação de Negócios - Receitas', 
          key: 'Intermediação de Negócios - Receitas', 
          isSubtracted: false,
          className: 'font-semibold text-emerald-600'
        },
        { 
          label: '(+) Mútuo - Entradas', 
          key: 'Mútuo - Entradas', 
          isSubtracted: false,
          className: 'font-semibold text-emerald-600'
        },
        { 
          label: '(-) Total Saídas (Impostos + Custos + Despesas + Investimentos)', 
          key: 'Total Saídas', 
          isSubtracted: true,
          className: 'text-rose-600 font-medium'
        },
        { 
          label: '(=) Fluxo de Caixa Livre (FCL)', 
          key: 'Fluxo de Caixa Livre FCL', 
          isResult: true,
          className: 'font-bold text-slate-900 bg-amber-100/50'
        },
        {
          label: 'USO DO FCL — RETIRADAS DOS SÓCIOS',
          key: 'HEADER_USO_FCL',
          isHeader: true,
          className: 'font-black text-amber-700 bg-amber-50'
        },
        { 
          label: 'Distribuição de Dividendos', 
          key: 'Distribuição de Dividendos', 
          isSubtracted: false,
          className: 'text-slate-600'
        },
        { 
          label: 'Intermediação de Negócios (Saídas)', 
          key: 'Intermediação de Negócios', 
          isSubtracted: false,
          className: 'text-slate-600'
        },
        { 
          label: 'Mútuo - Saídas', 
          key: 'Mútuo - Saídas', 
          isSubtracted: false,
          className: 'text-slate-600'
        },
        { 
          label: '(=) Total Retiradas dos Sócios', 
          key: 'Total Retiradas dos Sócios', 
          isResult: true,
          className: 'font-bold text-amber-900 bg-amber-50'
        },
        {
          label: 'FCL LÍQUIDO APÓS RETIRADAS',
          key: 'HEADER_FCL_LIQ',
          isHeader: true,
          className: 'font-black text-emerald-700 bg-emerald-50'
        },
        { 
          label: '(=) FCL após Retiradas dos Sócios', 
          key: 'FCL após Retiradas dos Sócios', 
          isResult: true,
          className: 'font-bold text-emerald-900 bg-emerald-100/70'
        }
      ];
      infoBox = (
        <div className="mt-4 bg-emerald-50/60 border border-emerald-200/50 rounded-2xl p-4 text-slate-700 text-[12px] leading-relaxed">
          <p className="font-bold text-emerald-800 mb-1">Entendendo o Fluxo de Caixa Livre (FCL):</p>
          <p>
            O FCL representa o caixa gerado pela operação (Entradas + Outras Entradas + Intermediação de Negócios - Receitas + Mútuo - Entradas) menos todas as saídas (Impostos, Custos, Despesas Rateadas e Investimentos). 
            Na tabela de <strong>USO DO FCL</strong> é possível visualizar onde este caixa livre foi utilizado pelas retiradas dos sócios.
          </p>
        </div>
      );
    }

    const isRevenue = title.toLowerCase().includes('receita') || title.toLowerCase().includes('entrada');

    const formatValue = (value: number, isSubtracted = false) => {
      if (isPrivacyMode || (isRevenuePrivacyMode && isRevenue)) return 'R$ ****';
      const displayVal = isSubtracted ? -Math.abs(value) : value;
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayVal);
    };

    const getAverage = (row: typeof auditRows[0]) => {
      const total = getValTotal(row.key);
      return cols.length > 0 ? total / cols.length : 0;
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
        <div className={containerClasses}>
          {/* Header */}
          <div className="flex flex-col border-b border-slate-100 bg-slate-50/50 p-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{modalTitle}</h2>
                  <p className="text-sm font-medium text-slate-500">
                    {modalDesc}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 no-export">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 rounded-xl transition-all shadow-2xs"
                  title="Exportar dados para CSV / Excel"
                >
                  <Download size={14} className="text-emerald-600" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  onClick={handleGenerateGamma}
                  disabled={isGeneratingGamma}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-gradient-to-r from-amber-100 to-amber-200 border border-amber-300 hover:from-amber-200 hover:to-amber-300 rounded-xl transition-all shadow-2xs disabled:opacity-50"
                  title="Gerar apresentação executiva com IA no Gamma"
                >
                  {isGeneratingGamma ? <Loader2 size={14} className="animate-spin text-amber-700" /> : <Sparkles size={14} className="text-amber-700" />}
                  <span className="hidden sm:inline">{isGeneratingGamma ? 'Gerando Slides...' : 'Gamma IA'}</span>
                </button>
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                  title={isMaximized ? "Restaurar tamanho padrão" : "Ampliar janela (Tela Cheia)"}
                >
                  {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
                <button 
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                  title="Fechar"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Chips de Filtros Ativos */}
            {filters && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtros:</span>
                <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                  🏢 {formatFilterList(filters.empresas)}
                </span>
                <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                  📅 {formatFilterList(filters.periodos)}
                </span>
                {filters.departamentos && filters.departamentos.length > 0 && (
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                    Depto: {formatFilterList(filters.departamentos)}
                  </span>
                )}
                {filters.contasDre && filters.contasDre.length > 0 && (
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                    Conta DRE: {formatFilterList(filters.contasDre)}
                  </span>
                )}
                {filters.projetos && filters.projetos.length > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Projeto: {formatFilterList(filters.projetos)}
                  </span>
                )}
                {filters.categorias && filters.categorias.length > 0 && (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    Categoria: {formatFilterList(filters.categorias)}
                  </span>
                )}
                {filters.excludeSharedExpenses && (
                  <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                    Sem Rateio
                  </span>
                )}
              </div>
            )}
            
            {infoBox}
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <span className="font-bold text-slate-700 text-sm">Conciliação de Valores (DRE Simplificada)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left whitespace-nowrap border-separate border-spacing-0">
                  <thead className="bg-slate-105 text-slate-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-200 sticky left-0 min-w-[280px] max-w-[280px] bg-slate-50 z-20 border-r">Linha de Composição</th>
                      <th className="px-4 py-3 border-b border-slate-200 text-right bg-slate-50 border-r sticky left-[280px] min-w-[120px] max-w-[120px] z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Total</th>
                      <th className="px-4 py-3 border-b border-slate-200 text-right bg-slate-50 border-r sticky left-[400px] min-w-[100px] max-w-[100px] z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Média</th>
                      {cols.map(month => (
                        <th key={month} className="px-4 py-3 border-b border-slate-200 text-right">{month}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditRows.map((row, idx) => {
                      if (row.isHeader) {
                        return (
                          <tr key={idx} className="bg-slate-100/80">
                            <td colSpan={cols.length + 3} className={`px-4 py-3 sticky left-0 z-10 font-bold text-[11px] uppercase tracking-widest ${row.className}`}>
                              {row.label}
                            </td>
                          </tr>
                        );
                      }

                      const totalVal = getValTotal(row.key);
                      const avgVal = getAverage(row);
                      
                      return (
                        <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${row.isResult ? 'font-bold bg-slate-105' : ''}`}>
                          <td className={`px-4 py-3 font-medium sticky left-0 border-r border-slate-100 z-10 bg-white group-hover:bg-slate-50 ${row.className} ${row.isResult ? 'bg-slate-50' : ''}`}>
                            {row.label}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono font-bold border-r border-slate-100 sticky left-[280px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${row.isResult ? 'bg-slate-100 text-slate-900' : 'bg-slate-50 text-slate-700'}`}>
                            {formatValue(totalVal, row.isSubtracted)}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono border-r border-slate-100 sticky left-[400px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${row.isResult ? 'bg-slate-50 font-bold text-slate-900' : 'bg-white text-slate-600'}`}>
                            {formatValue(avgVal, row.isSubtracted)}
                          </td>
                          {cols.map(month => {
                            const val = getValMensal(row.key, month);
                            return (
                              <td key={month} className={`px-4 py-3 text-right font-mono ${row.isResult ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
                                {formatValue(val, row.isSubtracted)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const customTooltipFormatter = (value: any) => {
    if (value === undefined) return ['', title];
    return [formatValueStandard(Number(value)), title];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className={containerClasses}>
        
        {/* Header */}
        <div className="flex flex-col border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                <TrendingUp size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800">{title}</h2>
                <p className="text-sm font-medium text-slate-500">
                  Evolução Detalhada • Total: <span className="font-bold text-slate-700">{formatValueStandard(total)}</span> • Média: <span className="font-bold text-slate-700">{formatValueStandard(average)}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 no-export">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 rounded-xl transition-all shadow-2xs"
                title="Exportar dados para CSV / Excel"
              >
                <Download size={14} className="text-emerald-600" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={handleGenerateGamma}
                disabled={isGeneratingGamma}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-gradient-to-r from-amber-100 to-amber-200 border border-amber-300 hover:from-amber-200 hover:to-amber-300 rounded-xl transition-all shadow-2xs disabled:opacity-50"
                title="Gerar apresentação executiva com IA no Gamma"
              >
                {isGeneratingGamma ? <Loader2 size={14} className="animate-spin text-amber-700" /> : <Sparkles size={14} className="text-amber-700" />}
                <span className="hidden sm:inline">{isGeneratingGamma ? 'Gerando Slides...' : 'Gamma IA'}</span>
              </button>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                title={isMaximized ? "Restaurar tamanho padrão" : "Ampliar janela (Tela Cheia)"}
              >
                {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                title="Fechar"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 flex gap-6">
            <button
              onClick={() => setActiveTab('chart')}
              className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'chart' 
                  ? 'border-amber-500 text-amber-600' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <BarChart2 size={16} /> Visão Analítica
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'transactions' 
                  ? 'border-amber-500 text-amber-600' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <ListTree size={16} /> Transações de Origem
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {activeTab === 'chart' && (
            <>
          {/* Gráfico */}
          <div className="h-64 w-full mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F2911B" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F2911B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 12}}
                  tickFormatter={(value) => isPrivacyMode ? '****' : `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={customTooltipFormatter}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="valor" stroke="#F2911B" strokeWidth={3} fillOpacity={1} fill="url(#colorValor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela Resumo */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 border-b border-slate-200">Período</th>
                  <th className="px-6 py-3 border-b border-slate-200 text-right">Valor Consolidado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-700">{item.name}</td>
                    <td className="px-6 py-3 text-right font-mono text-slate-600">{formatValueStandard(item.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </>
          )}

          {activeTab === 'transactions' && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <span className="font-bold text-slate-700 text-sm">Consolidado de Origem</span>
              </div>
              <div className="overflow-auto max-h-[60vh]">
                <table className="w-full text-xs text-left whitespace-nowrap border-separate border-spacing-0">
                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider sticky top-0 z-30">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-200 sticky top-0 left-0 min-w-[280px] max-w-[280px] bg-slate-100 z-40 border-r">Categoria / Projeto</th>
                      <th className="px-4 py-3 border-b border-slate-200 text-right bg-slate-100 border-r sticky top-0 left-[280px] min-w-[120px] max-w-[120px] z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Total</th>
                      <th className="px-4 py-3 border-b border-slate-200 text-right bg-slate-100 border-r sticky top-0 left-[400px] min-w-[100px] max-w-[100px] z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Média</th>
                      {dataReversed.map(item => (
                        <th key={item.name} className="px-4 py-3 border-b border-slate-200 text-right sticky top-0 bg-slate-100 z-30 font-bold text-slate-700">{item.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(() => {
                      const grouped: Record<string, {
                        totalGlobal: number;
                        totaisMensais: Record<string, number>;
                        projetos: Record<string, {
                          projeto: string;
                          empresa: string;
                          totalProjGlobal: number;
                          mensalProj: Record<string, number>;
                        }>
                      }> = {};

                      let hasRows = false;

                      data.forEach(item => {
                        const monthName = item.name;
                        const monthRows = sourceRows ? sourceRows[monthName] || [] : [];
                        
                        monthRows.forEach(r => {
                          const val = parseFloat(r[monthName]?.toString().replace(',', '.') || '0');
                          if (val === 0) return; // Skip zero values
                          
                          hasRows = true;
                          const cat = r.Categoria || 'Sem Categoria';
                          const proj = r.Projeto || '-';
                          const emp = r.Empresa || '-';
                          
                          if (!grouped[cat]) {
                            grouped[cat] = { totalGlobal: 0, totaisMensais: {}, projetos: {} };
                          }
                          
                          grouped[cat].totalGlobal += val;
                          grouped[cat].totaisMensais[monthName] = (grouped[cat].totaisMensais[monthName] || 0) + val;
                          
                          const projKey = `${proj}|${emp}`;
                          if (!grouped[cat].projetos[projKey]) {
                            grouped[cat].projetos[projKey] = { projeto: proj, empresa: emp, totalProjGlobal: 0, mensalProj: {} };
                          }
                          grouped[cat].projetos[projKey].totalProjGlobal += val;
                          grouped[cat].projetos[projKey].mensalProj[monthName] = (grouped[cat].projetos[projKey].mensalProj[monthName] || 0) + val;
                        });
                      });

                      if (!hasRows) {
                        return (
                          <tr>
                            <td colSpan={dataReversed.length + 3} className="text-center py-10 text-slate-400">
                              <ListTree size={32} className="mx-auto mb-3 opacity-50" />
                              <p>Nenhuma transação individual vinculada a esta linha.</p>
                            </td>
                          </tr>
                        );
                      }

                      return Object.entries(grouped).map(([cat, catData]) => {
                        const isExpanded = expandedCats[`global-${cat}`];
                        const catAvg = data.length > 0 ? catData.totalGlobal / data.length : 0;
                        return (
                          <React.Fragment key={cat}>
                            {/* Linha Categoria */}
                            <tr 
                              className="hover:bg-slate-50 cursor-pointer transition-colors group"
                              onClick={() => toggleCat('global', cat)}
                            >
                              <td className="px-4 py-3 flex items-center gap-2 text-amber-700 font-bold text-[13px] sticky left-0 min-w-[280px] max-w-[280px] whitespace-normal bg-white z-10 border-r border-slate-100 group-hover:bg-slate-50">
                                <div className="min-w-5 h-5 rounded bg-amber-100 flex items-center justify-center text-amber-600 group-hover:bg-amber-200 transition-colors">
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </div>
                                <span className="flex-1 leading-tight">{cat}</span>
                                <span className="text-[10px] font-normal text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full ml-1 whitespace-nowrap shrink-0">
                                  {Object.keys(catData.projetos).length} {Object.keys(catData.projetos).length === 1 ? 'reg' : 'regs'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 bg-slate-50 border-r border-slate-200 sticky left-[280px] min-w-[120px] max-w-[120px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                {formatValueStandard(catData.totalGlobal)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 bg-slate-50 border-r border-slate-200 sticky left-[400px] min-w-[100px] max-w-[100px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                {formatValueStandard(catAvg)}
                              </td>
                              {dataReversed.map(item => (
                                <td key={item.name} className="px-4 py-3 text-right font-mono text-slate-600">
                                  {formatValueStandard(catData.totaisMensais[item.name] || 0)}
                                </td>
                              ))}
                            </tr>

                            {/* Linhas Projetos */}
                            {isExpanded && Object.values(catData.projetos).map((p, pIdx) => {
                              const projAvg = data.length > 0 ? p.totalProjGlobal / data.length : 0;
                              const pct = catData.totalGlobal > 0 ? (p.totalProjGlobal / catData.totalGlobal) * 100 : 0;
                              return (
                                <tr key={`${cat}-${pIdx}`} className="bg-amber-50/20 border-l-2 border-l-amber-300">
                                  <td className="px-4 py-2.5 pl-10 flex flex-col gap-0.5 sticky left-0 min-w-[280px] max-w-[280px] whitespace-normal bg-amber-50/95 z-10 border-r border-amber-100/50">
                                    <div className="flex items-center justify-between w-full">
                                      <span className="text-slate-700 font-semibold text-[11px] uppercase tracking-wider leading-tight">{p.projeto}</span>
                                      <span className="text-[10px] font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded ml-2 shrink-0">
                                        {pct.toFixed(1).replace('.', ',')}%
                                      </span>
                                    </div>
                                    {p.empresa !== '-' && <span className="text-slate-400 text-[10px] truncate">{p.empresa}</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono text-[12px] text-slate-600 bg-amber-50/95 border-r border-amber-200/50 font-semibold sticky left-[280px] min-w-[120px] max-w-[120px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    {formatValueStandard(p.totalProjGlobal)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono text-[12px] text-slate-600 bg-amber-50/95 border-r border-amber-200/50 font-semibold sticky left-[400px] min-w-[100px] max-w-[100px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    {formatValueStandard(projAvg)}
                                  </td>
                                  {dataReversed.map(item => (
                                    <td key={item.name} className="px-4 py-2.5 text-right font-mono text-[12px] text-slate-600">
                                      {formatValueStandard(p.mensalProj[item.name] || 0)}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
