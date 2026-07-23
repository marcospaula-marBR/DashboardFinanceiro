'use client';
import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Cell as RadarCell, LabelList
} from 'recharts';
import { DreCalculatedResult } from '@/types/dre';
import { 
  BarChart2, PieChart as PieIcon, GitFork, Layers,
  Activity, Sparkles, ThumbsUp, AlertTriangle, TrendingDown
} from 'lucide-react';

interface DreChartsProps {
  results: DreCalculatedResult | null;
  isPrivacyMode: boolean;
  isRevenuePrivacyMode?: boolean;
}

const PALETTE = {
  receita:  '#10b981', // emerald
  saidas:   '#f43f5e', // rose
  lucro:    '#0ea5e9', // sky blue / cyan - Lucro após Entradas e Saídas
  fcl:      '#3b82f6', // blue
  custos:   '#f59e0b', // amber
  despesas: '#8b5cf6', // violet
  impostos: '#06b6d4', // cyan
  investimentos: '#64748b', // slate
};

const COLORS_PIE = ['#f59e0b', '#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4', '#64748b'];

const fmt = (v: number, privacy: boolean) =>
  privacy ? 'R$ ****' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtK = (v: number, privacy: boolean) =>
  privacy ? '****' : `${(v / 1000).toFixed(0)}k`;

const getEbitdaStatus = (margin: number) => {
  if (margin >= 20) {
    return {
      label: 'Ótimo',
      colorClass: 'bg-emerald-50/80 text-emerald-900 border-emerald-200 hover:bg-emerald-100/60',
      badgeClass: 'bg-emerald-600 text-white',
      textColor: '#047857',
      badgeBg: '#ecfdf5',
      badgeStroke: '#a7f3d0',
      dotColor: '#10b981',
      icon: Sparkles
    };
  } else if (margin >= 10) {
    return {
      label: 'Bom',
      colorClass: 'bg-sky-50/80 text-sky-900 border-sky-200 hover:bg-sky-100/60',
      badgeClass: 'bg-sky-600 text-white',
      textColor: '#0369a1',
      badgeBg: '#f0f9ff',
      badgeStroke: '#bae6fd',
      dotColor: '#0284c7',
      icon: ThumbsUp
    };
  } else if (margin >= 0) {
    return {
      label: 'Atenção',
      colorClass: 'bg-amber-50/80 text-amber-900 border-amber-200 hover:bg-amber-100/60',
      badgeClass: 'bg-amber-500 text-slate-950',
      textColor: '#b45309',
      badgeBg: '#fffbeb',
      badgeStroke: '#fde68a',
      dotColor: '#f59e0b',
      icon: AlertTriangle
    };
  } else {
    return {
      label: 'Crítico',
      colorClass: 'bg-rose-50/80 text-rose-900 border-rose-200 hover:bg-rose-100/60',
      badgeClass: 'bg-rose-600 text-white',
      textColor: '#be123c',
      badgeBg: '#fff1f2',
      badgeStroke: '#fecdd3',
      dotColor: '#f43f5e',
      icon: TrendingDown
    };
  }
};

type ChartTab = 'evolucao' | 'waterfall' | 'composicao' | 'radar';

const TABS: { id: ChartTab; label: string; icon: React.ReactNode }[] = [
  { id: 'evolucao',    label: 'Evolução',   icon: <BarChart2 size={14} /> },
  { id: 'waterfall',  label: 'Waterfall',  icon: <GitFork size={14} /> },
  { id: 'composicao', label: 'Composição', icon: <PieIcon size={14} /> },
  { id: 'radar',      label: 'Radar',      icon: <Layers size={14} /> },
];

export function DreCharts({ results, isPrivacyMode, isRevenuePrivacyMode }: DreChartsProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('evolucao');

  if (!results) return null;

  const { mensal, validColumns, totais, kpis } = results;

  // ── 1. Evolução Mensal ────────────────────────────────────────────────────
  const evolucaoData = useMemo(() => validColumns.map(col => {
    const receitas = (mensal['Total Entradas Operacionais']?.[col] || 0);
    const saidas   = (mensal['Total Saídas']?.[col] || 0);
    const fcl      = (mensal['Fluxo de Caixa Livre FCL']?.[col] || 0);
    const lucro    = receitas - saidas;

    // Cálculo da Margem EBITDA por mês
    const impostos = (mensal['Total de Impostos']?.[col] || mensal['Impostos']?.[col] || 0);
    const rl = receitas - impostos;
    const custos = (mensal['Total Custos Operacionais']?.[col] || 0);
    const despesasRateadas = (mensal['Total Despesas Rateadas']?.[col] || 0);
    const despFin = (mensal['Despesas Financeiras']?.[col] || 0);
    const div = (mensal['Distribuição de Dividendos']?.[col] || 0) + (mensal['Dividendos']?.[col] || 0);
    const despVar = (mensal['Despesas Variáveis']?.[col] || 0);
    const interm = (mensal['Intermediação de Negócios']?.[col] || 0);
    const despOp = despesasRateadas - despFin - div - despVar - interm;
    const ebitda = (rl - custos) - despOp;
    const denominator = rl !== 0 ? Math.abs(rl) : (receitas !== 0 ? Math.abs(receitas) : 1);
    const ebitdaMargin = (ebitda / denominator) * 100;

    return { 
      name: col, 
      Receitas: receitas, 
      Saídas: saidas, 
      Lucro: lucro, 
      FCL: fcl,
      ebitda,
      ebitdaMargin
    };
  }), [mensal, validColumns]);

  // Componente de Tick Customizado do Eixo X (Mês + Pill Margem EBITDA % + Valor R$)
  const CustomXAxisTick = (props: any) => {
    const { x, y, payload, index } = props;
    const item = evolucaoData[index];
    if (!item) {
      return (
        <g transform={`translate(${x},${y})`}>
          <text x={0} y={12} textAnchor="middle" fill="#94a3b8" fontSize={10.5} fontWeight={600}>
            {payload.value}
          </text>
        </g>
      );
    }

    const status = getEbitdaStatus(item.ebitdaMargin);
    const marginStr = isPrivacyMode ? '**%' : `${item.ebitdaMargin.toFixed(1)}%`;
    const ebitdaValStr = isPrivacyMode ? 'R$ ****' : `R$ ${fmtK(item.ebitda, false)}`;

    const count = evolucaoData.length;
    const pillWidth = count > 14 ? 46 : 54;
    const fontPct = count > 14 ? 8.5 : 9.5;
    const fontVal = count > 14 ? 7.5 : 8.5;

    return (
      <g transform={`translate(${x},${y})`}>
        {/* Identificação do Mês */}
        <text x={0} y={12} textAnchor="middle" fill="#334155" fontSize={10.5} fontWeight={700}>
          {payload.value}
        </text>

        {/* Pill da Margem EBITDA % + Valor R$ diretamente abaixo do mês */}
        <g transform="translate(0, 17)">
          <rect
            x={-pillWidth / 2}
            y={0}
            width={pillWidth}
            height={28}
            rx={6}
            fill={status.badgeBg}
            stroke={status.badgeStroke}
            strokeWidth={1}
          />
          <circle cx={-pillWidth / 2 + 6} cy={8} r={2.5} fill={status.dotColor} />
          
          {/* Linha 1: Margem % */}
          <text x={2} y={10} textAnchor="middle" fill={status.textColor} fontSize={fontPct} fontWeight={800}>
            {marginStr}
          </text>

          {/* Linha 2: Valor R$ EBITDA */}
          <text x={0} y={22} textAnchor="middle" fill="#475569" fontSize={fontVal} fontWeight={700}>
            {ebitdaValStr}
          </text>
        </g>
      </g>
    );
  };

  // ── 2. Waterfall DRE ─────────────────────────────────────────────────────
  // Each bar is positioned absolutely: start from cumulative sum, extend by value
  const waterfallData = useMemo(() => {
    const e = kpis.totalEntradas;
    const oe = kpis.outrasEntradas;
    const i  = -kpis.totalImpostos;
    const c  = -kpis.totalCustos;
    const d  = -kpis.totalDespesas;
    const inv = -kpis.totalInvestimentos;

    const steps = [
      { name: 'Entradas Op.',    value: e,   cumulative: 0 },
      { name: 'Outras Ent.',     value: oe,  cumulative: e },
      { name: 'Impostos',        value: i,   cumulative: e + oe },
      { name: 'Custos',          value: c,   cumulative: e + oe + i },
      { name: 'Despesas',        value: d,   cumulative: e + oe + i + c },
      { name: 'Investimentos',   value: inv, cumulative: e + oe + i + c + d },
      { name: 'FCL',             value: kpis.fcl, cumulative: 0, isFinal: true },
    ];

    return steps.map(s => ({
      name: s.name,
      // Transparent bar (base - to float the real bar)
      base: (s as any).isFinal ? Math.min(0, s.value) : (s.value >= 0 ? s.cumulative : s.cumulative + s.value),
      // Actual visible bar
      bar: Math.abs(s.value),
      positive: s.value >= 0,
      isFinal: !!(s as any).isFinal,
      rawValue: s.value,
    }));
  }, [kpis]);

  // ── 3. Composição Custos+Despesas (Donut) ────────────────────────────────
  const composicaoData = useMemo(() => [
    { name: 'Credenciados', value: (totais['Credenciado Operacional'] || 0) + (totais['Credenciado Administrativo'] || 0) + (totais['Credenciado TI'] || 0) },
    { name: 'Pessoal (CLTs)', value: totais['CLTs'] || 0 },
    { name: 'Terceirização', value: totais['Terceirização de Mão de Obra'] || 0 },
    { name: 'Desp. Admin.', value: totais['Despesas Administrativas'] || 0 },
    { name: 'Desp. Variáveis', value: totais['Despesas Variáveis'] || 0 },
    { name: 'Preventiva', value: totais['Preventiva - B2G'] || 0 },
    { name: 'Corretiva', value: totais['Corretiva - B2G'] || 0 },
  ].filter(d => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 6), [totais]);

  // ── 4. Radar de Proporções ───────────────────────────────────────────────
  const radarData = useMemo(() => {
    const total = kpis.totalEntradas || 1;
    return [
      { subject: 'Custos',       value: Math.round((kpis.totalCustos / total) * 100) },
      { subject: 'Despesas',     value: Math.round((kpis.totalDespesas / total) * 100) },
      { subject: 'Impostos',     value: Math.round((kpis.totalImpostos / total) * 100) },
      { subject: 'Investimentos',value: Math.round((kpis.totalInvestimentos / total) * 100) },
      { subject: 'FCL',          value: Math.max(0, Math.round((kpis.fcl / total) * 100)) },
      { subject: 'Outras Ent.',  value: Math.round((kpis.outrasEntradas / total) * 100) },
    ];
  }, [kpis]);

  const tooltipStyle = { borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', fontSize: '12px' };

  // ── Custom Waterfall tooltip ──────────────────────────────────────────────
  const WaterfallTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const raw = payload[0]?.payload?.rawValue ?? 0;
    const isRevenue = label === 'Entradas Op.' || label === 'Outras Ent.';
    return (
      <div style={tooltipStyle} className="bg-white px-4 py-3">
        <p className="font-bold text-slate-700 mb-1">{label}</p>
        <p className={`font-mono font-black text-base ${raw >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {fmt(raw, isPrivacyMode || (isRevenuePrivacyMode === true && isRevenue))}
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-8">
      {/* Tab Bar */}
      <div className="flex border-b border-slate-100 bg-slate-50/70 px-2 pt-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-xl mr-1 transition-all ${
              activeTab === tab.id
                ? 'bg-white border border-b-white border-slate-200 text-slate-800 shadow-sm -mb-px'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Chart Area */}
      <div className="p-6">

        {/* ── TAB 1: EVOLUÇÃO MENSAL ── */}
        {activeTab === 'evolucao' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
              <p className="text-xs text-slate-400">
                Receitas, Saídas, Lucro e FCL com Margem EBITDA mês a mês diretamente no eixo
              </p>

              {/* Legenda de Status EBITDA */}
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 flex-wrap">
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Ótimo (≥20%)
                </span>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                  <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" /> Bom (10-19.9%)
                </span>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Atenção (0-9.9%)
                </span>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Crítico (&lt;0%)
                </span>
              </div>
            </div>

            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolucaoData} margin={{ top: 28, right: 20, left: 0, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    interval={0}
                    height={56} 
                    tick={<CustomXAxisTick />} 
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => fmtK(v, isPrivacyMode)} />
                  <Tooltip 
                    formatter={(v: any, name: any) => [
                      fmt(Number(v), isPrivacyMode || (isRevenuePrivacyMode === true && (name === 'Receitas' || name === 'Lucro'))),
                      name === 'Lucro' ? 'Lucro após Entradas e Saídas' : name
                    ]} 
                    contentStyle={tooltipStyle} 
                  />
                  <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
                  <Bar dataKey="Receitas" fill={PALETTE.receita} radius={[5, 5, 0, 0]} maxBarSize={32}>
                    <LabelList dataKey="Receitas" position="top" formatter={(v: any) => fmtK(Number(v || 0), isPrivacyMode)} style={{ fontSize: '9px', fontWeight: 700, fill: '#059669' }} />
                  </Bar>
                  <Bar dataKey="Saídas" fill={PALETTE.saidas} radius={[5, 5, 0, 0]} maxBarSize={32}>
                    <LabelList dataKey="Saídas" position="top" formatter={(v: any) => fmtK(Number(v || 0), isPrivacyMode)} style={{ fontSize: '9px', fontWeight: 700, fill: '#e11d48' }} />
                  </Bar>
                  <Bar dataKey="Lucro" name="Lucro (Entradas - Saídas)" fill={PALETTE.lucro} radius={[5, 5, 0, 0]} maxBarSize={32}>
                    <LabelList dataKey="Lucro" position="top" formatter={(v: any) => fmtK(Number(v || 0), isPrivacyMode)} style={{ fontSize: '9px', fontWeight: 700, fill: '#0284c7' }} />
                  </Bar>
                  <Line type="monotone" dataKey="FCL" stroke={PALETTE.fcl} strokeWidth={2.5} dot={{ r: 4, fill: PALETTE.fcl }} activeDot={{ r: 6 }}>
                    <LabelList dataKey="FCL" position="top" formatter={(v: any) => fmtK(Number(v || 0), isPrivacyMode)} style={{ fontSize: '9px', fontWeight: 800, fill: '#1d4ed8' }} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── TAB 2: WATERFALL ── */}
        {activeTab === 'waterfall' && (
          <div>
            <p className="text-xs text-slate-400 mb-4">Cascata de construção do FCL — de onde vem e para onde vai cada real</p>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => fmtK(v, isPrivacyMode)} />
                  <Tooltip content={<WaterfallTooltip />} />
                  {/* Base transparente para flutuar */}
                  <Bar dataKey="base" stackId="wf" fill="transparent" />
                  {/* Barra visível com cor por contexto */}
                  <Bar dataKey="bar" stackId="wf" radius={[5, 5, 0, 0]} maxBarSize={50}>
                    {waterfallData.map((entry, index) => (
                      <Cell
                        key={`wf-${index}`}
                        fill={
                          entry.isFinal
                            ? (entry.rawValue >= 0 ? PALETTE.fcl : PALETTE.saidas)
                            : (entry.positive ? PALETTE.receita : PALETTE.saidas)
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Legenda manual */}
            <div className="flex items-center gap-5 mt-4 justify-center text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{background: PALETTE.receita}} /> Entradas</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{background: PALETTE.saidas}} /> Saídas</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{background: PALETTE.fcl}} /> FCL</span>
            </div>
          </div>
        )}

        {/* ── TAB 3: COMPOSIÇÃO (DONUT) ── */}
        {activeTab === 'composicao' && (
          <div>
            <p className="text-xs text-slate-400 mb-4">Distribuição das principais categorias de custo e despesa</p>
            <div className="h-72 w-full flex items-center">
              {composicaoData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={composicaoData}
                      cx="40%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {composicaoData.map((_, index) => (
                        <Cell key={`c-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [fmt(Number(v), isPrivacyMode), '']} contentStyle={tooltipStyle} />
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      wrapperStyle={{ fontSize: '12px', paddingLeft: '20px' }}
                      formatter={(value, entry: any) => (
                        <span style={{ color: '#475569' }}>
                          {value} {!isPrivacyMode && `(${((entry.payload.value / (kpis.totalCustos + kpis.totalDespesas)) * 100).toFixed(1)}%)`}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-400 text-sm mx-auto">Sem dados suficientes</div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: RADAR ── */}
        {activeTab === 'radar' && (
          <div>
            <p className="text-xs text-slate-400 mb-4">Proporção de cada componente sobre o Total de Entradas Operacionais (%)</p>
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData} margin={{ top: 10, right: 40, left: 40, bottom: 10 }}>
                  <PolarGrid stroke="#cbd5e1" strokeWidth={0.7} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={v => `${v}%`} />
                  <Radar
                    name="% sobre Receita"
                    dataKey="value"
                    stroke={PALETTE.fcl}
                    fill={PALETTE.fcl}
                    fillOpacity={0.25}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#ffffff', stroke: PALETTE.fcl, strokeWidth: 2 }}
                  />
                  <Tooltip formatter={(v: any) => [`${v}%`, '% sobre Receita']} contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
