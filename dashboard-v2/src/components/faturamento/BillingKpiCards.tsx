import React from 'react';
import styles from './faturamento.module.css';
import { BillingKpiSummary } from '@/types/billing.types';
import { FileText, ShieldAlert, Receipt, PieChart, Users, DollarSign } from 'lucide-react';

interface Props {
  summary: BillingKpiSummary;
}

export const BillingKpiCards: React.FC<Props> = ({ summary }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className={styles.kpiGrid}>
      {/* Total Faturado */}
      <div className={`${styles.kpiCard} ${styles.accentAmber}`}>
        <div className={styles.kpiTitle}>
          <span>Faturado Bruto</span>
          <FileText size={16} color="#f59e0b" />
        </div>
        <div className={styles.kpiValue}>{formatCurrency(summary.total_gross)}</div>
        <div className={styles.kpiSub}>{summary.total_count} notas / lançamentos</div>
      </div>

      {/* Impostos Retidos */}
      <div className={`${styles.kpiCard} ${styles.accentRose}`}>
        <div className={styles.kpiTitle}>
          <span>Impostos Retidos</span>
          <ShieldAlert size={16} color="#f43f5e" />
        </div>
        <div className={styles.kpiValue}>{formatCurrency(summary.total_retained_taxes)}</div>
        <div className={styles.kpiSub}>PIS, COFINS, ISS, INSS, IRRF</div>
      </div>

      {/* Impostos Trimestrais Apurados */}
      <div className={`${styles.kpiCard} ${styles.accentIndigo}`}>
        <div className={styles.kpiTitle}>
          <span>Impostos Trimestrais</span>
          <Receipt size={16} color="#3b82f6" />
        </div>
        <div className={styles.kpiValue}>{formatCurrency(summary.total_quarterly_taxes)}</div>
        <div className={styles.kpiSub}>IRPJ, CSLL & Adicional LC 224</div>
      </div>

      {/* Valor Líquido Real */}
      <div className={`${styles.kpiCard} ${styles.accentEmerald}`}>
        <div className={styles.kpiTitle}>
          <span>Líquido Projetado</span>
          <DollarSign size={16} color="#10b981" />
        </div>
        <div className={styles.kpiValue}>{formatCurrency(summary.total_net)}</div>
        <div className={styles.kpiSub}>Após retenções e tarifas</div>
      </div>

      {/* Comissões Totais */}
      <div className={`${styles.kpiCard} ${styles.accentViolet}`}>
        <div className={styles.kpiTitle}>
          <span>Comissões Totais</span>
          <Users size={16} color="#8b5cf6" />
        </div>
        <div className={styles.kpiValue}>{formatCurrency(summary.total_commissions)}</div>
        <div className={styles.kpiSub}>Equipe & Setores (People)</div>
      </div>

      {/* Share B2G / Terceirização */}
      <div className={`${styles.kpiCard} ${styles.accentCyan}`}>
        <div className={styles.kpiTitle}>
          <span>Rateio Terceirização</span>
          <PieChart size={16} color="#06b6d4" />
        </div>
        <div className={styles.kpiValue}>{summary.pct_outsourced.toFixed(1)}%</div>
        <div className={styles.kpiSub}>{formatCurrency(summary.gross_outsourced)} faturado</div>
      </div>
    </div>
  );
};
