import React from 'react';
import styles from './faturamento.module.css';
import { BillingAuditEntry } from '@/types/billing.types';
import { ShieldAlert, Check, X, CheckCheck, RefreshCw, Layers, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entries: BillingAuditEntry[];
  onApproveEntry: (id: string) => void;
  onRejectEntry: (id: string) => void;
  onApproveAll: () => void;
}

export const BillingAuditModal: React.FC<Props> = ({
  isOpen,
  onClose,
  entries,
  onApproveEntry,
  onRejectEntry,
  onApproveAll
}) => {
  if (!isOpen) return null;

  const pendingEntries = entries.filter(e => e.audit_status === 'PENDING');
  const processedEntries = entries.filter(e => e.audit_status !== 'PENDING');

  const formatCurrency = (val?: number) =>
    val !== undefined ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'N/A';

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '820px' }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldAlert size={22} color="#f59e0b" />
            <div>
              <h3 className={styles.modalTitle}>Auditoria de Sincronização & Aprovação Omie</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Revisão e controle de auditoria de alterações trazidas do Omie ERP antes do salvamento
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Resumo de Mudanças Pendentes */}
        <div style={{ background: '#0b1120', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={16} />
              <span>{pendingEntries.length} Alterações Pendentes de Aprovação</span>
            </span>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
              O banco de dados só é atualizado após a aprovação explícita de cada alteração.
            </div>
          </div>

          {pendingEntries.length > 0 && (
            <button className={styles.btnPrimary} onClick={onApproveAll} style={{ background: '#10b981', borderColor: '#059669' }}>
              <CheckCheck size={14} />
              <span>Aceitar Todas as Mudanças ({pendingEntries.length})</span>
            </button>
          )}
        </div>

        {/* Lista de Itens para Aprovação */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingRight: '4px', marginBottom: '1.25rem' }}>
          {pendingEntries.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              <Check size={32} color="#10b981" style={{ marginBottom: '0.5rem' }} />
              <div>Nenhuma alteração pendente de aprovação. O banco de dados está perfeitamente sincronizado com o Omie!</div>
            </div>
          ) : (
            pendingEntries.map(item => (
              <div key={item.id} style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, background: item.change_type === 'NEW_INVOICE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: item.change_type === 'NEW_INVOICE' ? '#34d399' : '#fbbf24', border: `1px solid ${item.change_type === 'NEW_INVOICE' ? '#10b981' : '#f59e0b'}` }}>
                      {item.change_type === 'NEW_INVOICE' ? '🟢 NOVO FATURAMENTO' : item.change_type === 'VALUE_CHANGE' ? '🟡 ALTERAÇÃO DE VALOR' : '🔵 ALTERAÇÃO DE STATUS'}
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>{item.invoice_number}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({item.company_name})</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {new Date(item.sync_timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#e2e8f0', marginBottom: '0.65rem' }}>
                  {item.change_description}
                </div>

                {/* Detalhamento do De/Para */}
                {item.old_data && (
                  <div style={{ background: '#0b1120', padding: '0.6rem 0.85rem', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <span style={{ color: '#f43f5e', fontWeight: 700 }}>Valor / Estado Anterior:</span>
                      <div style={{ color: '#cbd5e1' }}>{formatCurrency(item.old_data.value_gross)} ({item.old_data.status})</div>
                    </div>
                    <div>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>Novo Valor / Estado no Omie:</span>
                      <div style={{ color: '#ffffff', fontWeight: 700 }}>{formatCurrency(item.new_data.value_gross)} ({item.new_data.status})</div>
                    </div>
                  </div>
                )}

                {/* Ações de Aprovação */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    className={styles.btnSecondary}
                    onClick={() => onRejectEntry(item.id)}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                  >
                    <X size={12} />
                    <span>Rejeitar (Ignorar)</span>
                  </button>

                  <button
                    className={styles.btnPrimary}
                    onClick={() => onApproveEntry(item.id)}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: '#10b981', borderColor: '#059669' }}
                  >
                    <Check size={12} />
                    <span>Aceitar & Gravar no Banco</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Histórico Processado */}
        {processedEntries.length > 0 && (
          <div style={{ fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
            Histórico nesta sessão: {processedEntries.filter(e => e.audit_status === 'ACCEPTED').length} aprovados, {processedEntries.filter(e => e.audit_status === 'REJECTED').length} rejeitados.
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className={styles.btnSecondary} onClick={onClose}>Fechar Auditoria</button>
        </div>
      </div>
    </div>
  );
};
