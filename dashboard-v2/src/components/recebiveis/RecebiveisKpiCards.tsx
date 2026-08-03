import React from 'react';
import styles from '@/components/faturamento/faturamento.module.css';
import { RecebiveisKpiSummary } from '@/types/recebiveis';
import { DollarSign, Landmark, Users, TrendingUp, ShieldCheck } from 'lucide-react';

interface Props {
  summary: RecebiveisKpiSummary;
}

export const RecebiveisKpiCards: React.FC<Props> = ({ summary }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className={styles.kpiGrid}>
      {/* Card 1: Faturado Bruto Total */}
      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span className={styles.kpiTitle}>Faturado Bruto Total</span>
          <div className={styles.kpiIcon} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
            <DollarSign size={18} />
          </div>
        </div>
        <div className={styles.kpiValue}>{formatCurrency(summary.total_gross)}</div>
        <div className={styles.kpiSubtitle} style={{ color: '#94a3b8' }}>
          {summary.total_count} recebimentos / lançamentos
        </div>
      </div>

      {/* Card 2: Impostos Retidos na Fonte */}
      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span className={styles.kpiTitle}>Retenções Fiscais na Fonte</span>
          <div className={styles.kpiIcon} style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
            <Landmark size={18} />
          </div>
        </div>
        <div className={styles.kpiValue} style={{ color: '#f43f5e' }}>{formatCurrency(summary.total_retained_taxes)}</div>
        <div className={styles.kpiSubtitle} style={{ color: '#fb7185' }}>
          PIS, COFINS, ISS, INSS, IRRF
        </div>
      </div>

      {/* Card 3: Líquido Real Recebido */}
      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span className={styles.kpiTitle}>Líquido Real Aterrissado</span>
          <div className={styles.kpiIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <TrendingUp size={18} />
          </div>
        </div>
        <div className={styles.kpiValue} style={{ color: '#10b981' }}>{formatCurrency(summary.total_net)}</div>
        <div className={styles.kpiSubtitle} style={{ color: '#34d399' }}>
          Entrada efetiva caixa pós-tributos
        </div>
      </div>

      {/* Card 4: Comissões Totais Calculadas */}
      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span className={styles.kpiTitle}>Comissões Totais (Equipe)</span>
          <div className={styles.kpiIcon} style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
            <Users size={18} />
          </div>
        </div>
        <div className={styles.kpiValue} style={{ color: '#8b5cf6' }}>{formatCurrency(summary.total_commissions)}</div>
        <div className={styles.kpiSubtitle} style={{ color: '#c084fc' }}>
          Pagas: {formatCurrency(summary.total_paid_commissions)} • Pend: {formatCurrency(summary.total_pending_commissions)}
        </div>
      </div>
    </div>
  );
};
