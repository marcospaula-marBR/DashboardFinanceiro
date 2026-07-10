/**
 * InsuranceKPICards — Cards de métricas superiores da página de Seguros
 */
"use client";

import { ShieldCheck, TrendingUp, Calendar, AlertTriangle, Trophy, Clock } from 'lucide-react';
import { InsuranceKPIs } from '@/types/insurance';
import { formatInsuranceCurrency, formatInsuranceDate, getTipoIcon } from '@/services/insurance.service';
import styles from './seguros.module.css';

interface InsuranceKPICardsProps {
  kpis: InsuranceKPIs;
  isLoading?: boolean;
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  isLoading,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'gold';
  isLoading?: boolean;
}) {
  const variantClass = {
    default: styles.kpiCardDefault,
    danger: styles.kpiCardDanger,
    warning: styles.kpiCardWarning,
    success: styles.kpiCardSuccess,
    gold: styles.kpiCardGold,
  }[variant];

  return (
    <div className={`${styles.kpiCard} ${variantClass}`}>
      <div className={styles.kpiCardIconWrap}>
        <Icon size={18} />
      </div>
      <div className={styles.kpiCardBody}>
        <span className={styles.kpiCardTitle}>{title}</span>
        {isLoading ? (
          <div className={styles.kpiSkeleton} />
        ) : (
          <span className={styles.kpiCardValue}>{value}</span>
        )}
        {subtitle && !isLoading && (
          <span className={styles.kpiCardSubtitle}>{subtitle}</span>
        )}
      </div>
    </div>
  );
}

export function InsuranceKPICards({ kpis, isLoading }: InsuranceKPICardsProps) {
  const proximoVenc = kpis.proximoVencimento;
  const urgenciaCount = kpis.vencendoEm7Dias.length;
  const atencaoCount = kpis.vencendoEm30Dias.length;

  return (
    <div className={styles.kpiGrid}>
      <KPICard
        title="Apólices Ativas"
        value={String(kpis.apólicesAtivas)}
        subtitle={`${kpis.totalApólices} total (incluindo inativas)`}
        icon={ShieldCheck}
        variant="success"
        isLoading={isLoading}
      />

      <KPICard
        title="Prêmio Mensal Total"
        value={formatInsuranceCurrency(kpis.premioMensalTotal)}
        subtitle="Soma das parcelas mensais ativas"
        icon={TrendingUp}
        isLoading={isLoading}
      />

      <KPICard
        title="Custo Anual Total"
        value={formatInsuranceCurrency(kpis.premioAnualTotal)}
        subtitle="Soma dos prêmios das apólices ativas"
        icon={Clock}
        isLoading={isLoading}
      />

      <KPICard
        title="Maior Prêmio"
        value={formatInsuranceCurrency(kpis.maiorPremio?.premio)}
        subtitle={
          kpis.maiorPremio
            ? `${getTipoIcon(kpis.maiorPremio.tipo)} ${kpis.maiorPremio.tipo} · ${kpis.maiorPremio.seguradora || '—'}`
            : undefined
        }
        icon={Trophy}
        variant="gold"
        isLoading={isLoading}
      />

      <KPICard
        title="Próximo Vencimento"
        value={
          proximoVenc
            ? `${proximoVenc.diasParaVencer === 0 ? 'HOJE' : `${proximoVenc.diasParaVencer}d`}`
            : '—'
        }
        subtitle={
          proximoVenc
            ? `${getTipoIcon(proximoVenc.tipo)} ${proximoVenc.tipo} · ${formatInsuranceDate(proximoVenc.vencimento)}`
            : 'Sem vencimentos próximos'
        }
        icon={Calendar}
        variant={
          (proximoVenc?.diasParaVencer ?? 999) <= 7
            ? 'danger'
            : (proximoVenc?.diasParaVencer ?? 999) <= 30
            ? 'warning'
            : 'default'
        }
        isLoading={isLoading}
      />

      <KPICard
        title="Alertas de Vencimento"
        value={atencaoCount > 0 ? `${atencaoCount} ap${atencaoCount === 1 ? 'ólice' : 'ólices'}` : 'Nenhum alerta'}
        subtitle={
          urgenciaCount > 0
            ? `🔴 ${urgenciaCount} urgente${urgenciaCount > 1 ? 's' : ''} (≤7 dias)`
            : atencaoCount > 0
            ? `🟡 ${atencaoCount} com atenção (≤30 dias)`
            : 'Todas dentro do prazo'
        }
        icon={AlertTriangle}
        variant={urgenciaCount > 0 ? 'danger' : atencaoCount > 0 ? 'warning' : 'default'}
        isLoading={isLoading}
      />
    </div>
  );
}
