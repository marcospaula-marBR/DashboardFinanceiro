/**
 * InsuranceExpiryAlert — Banner de alerta de vencimento breve
 * Exibe aviso visual quando há apólices vencendo em ≤ 30 dias
 */
"use client";

import { AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { InsurancePolicy } from '@/types/insurance';
import { formatInsuranceDate } from '@/services/insurance.service';
import { useState } from 'react';
import styles from './seguros.module.css';

interface InsuranceExpiryAlertProps {
  urgentes: InsurancePolicy[];    // ≤ 7 dias
  atencao: InsurancePolicy[];     // 8–30 dias
}

export function InsuranceExpiryAlert({ urgentes, atencao }: InsuranceExpiryAlertProps) {
  const [dismissed, setDismissed] = useState(false);
  
  const total = urgentes.length + atencao.length;
  if (total === 0 || dismissed) return null;

  return (
    <div className={`${styles.expiryAlert} ${urgentes.length > 0 ? styles.expiryAlertUrgent : styles.expiryAlertWarning}`}>
      <div className={styles.expiryAlertContent}>
        <div className={styles.expiryAlertIcon}>
          {urgentes.length > 0 ? (
            <ShieldAlert size={20} className={styles.pulseIcon} />
          ) : (
            <AlertTriangle size={20} />
          )}
        </div>

        <div className={styles.expiryAlertBody}>
          {urgentes.length > 0 && (
            <div className={styles.expiryGroup}>
              <span className={styles.expiryLabel}>🔴 URGENTE — Vencendo em até 7 dias:</span>
              <div className={styles.expiryList}>
                {urgentes.map((p) => (
                  <span key={p.id} className={styles.expiryBadgeRed}>
                    {p.tipo} · {p.segurado || p.contratante} · {formatInsuranceDate(p.vencimento)}
                    {p.diasParaVencer === 0 ? ' (vence HOJE)' : ` (${p.diasParaVencer}d)`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {atencao.length > 0 && (
            <div className={styles.expiryGroup}>
              <span className={styles.expiryLabel}>🟡 ATENÇÃO — Vencendo em até 30 dias:</span>
              <div className={styles.expiryList}>
                {atencao.map((p) => (
                  <span key={p.id} className={styles.expiryBadgeAmber}>
                    {p.tipo} · {p.segurado || p.contratante} · {formatInsuranceDate(p.vencimento)}
                    {` (${p.diasParaVencer}d)`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          className={styles.expiryDismiss}
          onClick={() => setDismissed(true)}
          title="Fechar alerta"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
