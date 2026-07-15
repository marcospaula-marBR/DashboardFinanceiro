/**
 * InsuranceAnalyticsSection — Seção de análise visual do Dashboard de Seguros
 * Gráficos de distribuição, timeline de vencimentos e estatísticas ricas
 */
'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { AlertTriangle, BarChart3, PieChart as PieIcon, CalendarClock, TrendingUp } from 'lucide-react';
import { InsuranceKPIs, InsurancePolicy } from '@/types/insurance';
import { formatInsuranceCurrency, formatInsuranceDate, getTipoIcon } from '@/services/insurance.service';

interface InsuranceAnalyticsSectionProps {
  kpis: InsuranceKPIs;
  allPolicies: InsurancePolicy[];
}

const CHART_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#e879f9',
  '#06b6d4', '#f97316', '#a78bfa', '#34d399',
  '#fb923c', '#60a5fa',
];

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const formatBRLShort = (v: number) => {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`;
  return formatBRL(v);
};

// Custom tooltip reusable
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-slate-400 mb-1 font-semibold">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color || entry.fill }} className="font-bold">
          {entry.name}: {typeof entry.value === 'number' && entry.value > 100
            ? formatBRL(entry.value)
            : entry.value}
        </p>
      ))}
    </div>
  );
}

export function InsuranceAnalyticsSection({ kpis, allPolicies }: InsuranceAnalyticsSectionProps) {
  const ativas = useMemo(() => allPolicies.filter(p => p.ativo), [allPolicies]);

  // --- Dados para pizza: distribuição por tipo ---
  const pieDataTipo = useMemo(() =>
    Object.entries(kpis.porTipo)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value),
    [kpis.porTipo]
  );

  // --- Dados para barra: custo por empresa (contratante) ---
  const barDataEmpresa = useMemo(() => {
    const custoMap: Record<string, number> = {};
    ativas.forEach(p => {
      if (p.contratante) {
        custoMap[p.contratante] = (custoMap[p.contratante] || 0) + (p.premio || 0);
      }
    });
    return Object.entries(custoMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [ativas]);

  // --- Timeline: próximos vencimentos (90 dias) ---
  const proximosVencimentos = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return ativas
      .filter(p => p.diasParaVencer !== undefined && p.diasParaVencer >= 0 && p.diasParaVencer <= 90)
      .sort((a, b) => (a.diasParaVencer ?? 999) - (b.diasParaVencer ?? 999));
  }, [ativas]);

  // --- Custo médio por apólice ---
  const custoMedio = ativas.length > 0 ? kpis.premioAnualTotal / ativas.length : 0;

  // --- Seguradora com mais apólices ---
  const topSeguradora = useMemo(() => {
    const map: Record<string, number> = {};
    ativas.forEach(p => {
      if (p.seguradora) map[p.seguradora] = (map[p.seguradora] || 0) + 1;
    });
    const sorted = Object.entries(map).sort(([, a], [, b]) => b - a);
    return sorted[0] ? { nome: sorted[0][0], qtd: sorted[0][1] } : null;
  }, [ativas]);

  if (ativas.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>

      {/* Row 1: Stats rápidas extras */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.75rem',
      }}>
        {/* Custo médio por apólice */}
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Custo Médio por Apólice"
          value={formatBRL(custoMedio)}
          sub="Prêmio anual ÷ apólices ativas"
          color="#22c55e"
        />
        {/* Maior parcela mensal */}
        {kpis.maiorPremio && (
          <StatCard
            icon={<span style={{ fontSize: '1.1rem' }}>{getTipoIcon(kpis.maiorPremio.tipo)}</span>}
            label="Apólice de Maior Valor"
            value={formatBRL(kpis.maiorPremio.premio || 0)}
            sub={`${kpis.maiorPremio.tipo} · ${kpis.maiorPremio.seguradora || '—'} · ${kpis.maiorPremio.segurado || kpis.maiorPremio.contratante}`}
            color="#f59e0b"
          />
        )}
        {/* Principal seguradora */}
        {topSeguradora && (
          <StatCard
            icon={<BarChart3 size={16} />}
            label="Principal Seguradora"
            value={topSeguradora.nome}
            sub={`${topSeguradora.qtd} apólice${topSeguradora.qtd > 1 ? 's' : ''} ativas`}
            color="#3b82f6"
          />
        )}
        {/* Cobertura total aproximada */}
        <StatCard
          icon={<PieIcon size={16} />}
          label="Investimento Anual em Seguros"
          value={formatBRL(kpis.premioAnualTotal)}
          sub={`${ativas.length} apólices ativas · média ${formatBRL(custoMedio)}/ano`}
          color="#a78bfa"
        />
      </div>

      {/* Row 2: Gráficos lado a lado */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '0.75rem',
      }}>
        {/* Pizza: Distribuição por Tipo */}
        {pieDataTipo.length > 0 && (
          <ChartCard title="Distribuição por Tipo" icon={<PieIcon size={14} />}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieDataTipo}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={35}
                  dataKey="value"
                  paddingAngle={2}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${(name ?? '').split(' ')[0]} ${(((percent ?? 0)) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {pieDataTipo.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Barra: Custo por Empresa */}
        {barDataEmpresa.length > 0 && (
          <ChartCard title="Custo Anual por Empresa" icon={<BarChart3 size={14} />}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barDataEmpresa} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatBRLShort}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Prêmio Anual" radius={[4, 4, 0, 0]}>
                  {barDataEmpresa.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Row 3: Timeline de vencimentos */}
      {proximosVencimentos.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px',
          padding: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <CalendarClock size={14} style={{ color: '#f59e0b' }} />
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#64748b',
            }}>
              Timeline de Vencimentos — Próximos 90 Dias ({proximosVencimentos.length} apólice{proximosVencimentos.length > 1 ? 's' : ''})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {proximosVencimentos.map((p, i) => {
              const dias = p.diasParaVencer ?? 0;
              const pct = Math.max(2, Math.round(((90 - dias) / 90) * 100));
              const isUrgent = dias <= 7;
              const isWarning = dias > 7 && dias <= 30;
              const barColor = isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : '#22c55e';

              return (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.9rem' }}>{getTipoIcon(p.tipo)}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#cbd5e1' }}>
                        {p.tipo}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
                        · {p.segurado || p.contratante} · {p.seguradora || '—'}
                      </span>
                      {isUrgent && (
                        <AlertTriangle size={11} style={{ color: '#ef4444', flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{
                      height: '4px',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: '99px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: '99px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: barColor,
                    }}>
                      {dias === 0 ? 'HOJE' : `${dias}d`}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#475569' }}>
                      {formatInsuranceDate(p.vencimento)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes internos ──

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `3px solid ${color}40`,
      borderRadius: '12px',
      padding: '0.85rem',
      display: 'flex',
      gap: '0.6rem',
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: '30px',
        height: '30px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: `${color}18`,
        color,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: '#64748b' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2, marginTop: '0.1rem' }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: '0.58rem', color: '#475569', marginTop: '0.15rem', lineHeight: 1.3 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({
  title, icon, children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '12px',
      padding: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
        <span style={{ color: '#64748b' }}>{icon}</span>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#64748b',
        }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
