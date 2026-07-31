import React, { useState } from 'react';
import styles from './faturamento.module.css';
import { BillingAuditEntry } from '@/types/billing.types';
import { ShieldAlert, Check, X, CheckCheck, AlertTriangle, Calendar, User, FileText, Tag, ChevronDown, ChevronUp, DollarSign, Clock } from 'lucide-react';

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
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const pendingEntries = entries.filter(e => e.audit_status === 'PENDING');
  const processedEntries = entries.filter(e => e.audit_status !== 'PENDING');

  const formatCurrency = (val?: number) =>
    val !== undefined ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : 'N/A';

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const toggleExpand = (id: string) => {
    setExpandedEntries(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldAlert size={24} color="#f59e0b" />
            <div>
              <h3 className={styles.modalTitle}>Auditoria de Sincronização & Aprovação Omie</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Conferência detalhada dos lançamentos importados do Omie antes de aceitar no banco de dados
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Resumo de Mudanças Pendentes */}
        <div style={{ background: '#0b1120', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={16} />
              <span>{pendingEntries.length} Alterações / Lançamentos Pendentes de Aceite</span>
            </span>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
              O banco de dados só é atualizado após você revisar e aceitar os lançamentos trazidos do Omie.
            </div>
          </div>

          {pendingEntries.length > 0 && (
            <button className={styles.btnPrimary} onClick={onApproveAll} style={{ background: '#10b981', borderColor: '#059669' }}>
              <CheckCheck size={14} />
              <span>Aceitar Todos os Lançamentos ({pendingEntries.length})</span>
            </button>
          )}
        </div>

        {/* Lista Detalhada de Itens para Aprovação */}
        <div style={{ maxHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '4px', marginBottom: '1.25rem' }}>
          {pendingEntries.length === 0 ? (
            <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', background: 'rgba(30, 41, 59, 0.2)', borderRadius: '10px' }}>
              <Check size={36} color="#10b981" style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.95rem' }}>Nenhum lançamento pendente de aprovação!</div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>Os faturamentos no banco de dados estão rigorosamente sincronizados com o Omie ERP.</div>
            </div>
          ) : (
            pendingEntries.map(item => {
              const d = item.new_data;
              const isExpanded = expandedEntries[item.id] ?? true; // Expandido por padrão para ver os dados

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '12px',
                    padding: '1rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
                  }}
                >
                  {/* Cabeçalho do Card de Auditoria */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, background: item.change_type === 'NEW_INVOICE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: item.change_type === 'NEW_INVOICE' ? '#34d399' : '#fbbf24', border: `1px solid ${item.change_type === 'NEW_INVOICE' ? '#10b981' : '#f59e0b'}` }}>
                        {item.change_type === 'NEW_INVOICE' ? '🟢 NOVO FATURAMENTO' : item.change_type === 'VALUE_CHANGE' ? '🟡 ALTERAÇÃO DE VALOR' : '🔵 ALTERAÇÃO DE STATUS'}
                      </span>
                      <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.95rem' }}>{item.invoice_number}</span>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                        {item.company_name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => toggleExpand(item.id)}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.72rem' }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        <span>{isExpanded ? 'Recolher' : 'Ver Detalhes'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Resumo Rápido Principal: Cliente & Valor Líquido */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr', gap: '0.75rem', alignItems: 'center', background: '#0b1120', padding: '0.75rem 0.85rem', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <User size={12} color="#60a5fa" />
                        <span>Cliente (Razão Social Omie)</span>
                      </div>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {d.client_name || 'Cliente Omie'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Calendar size={12} color="#f59e0b" />
                        <span>Vencimento Omie</span>
                      </div>
                      <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.85rem' }}>
                        {formatDate(d.date_due)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Faturado Bruto</div>
                      <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.85rem' }}>
                        {formatCurrency(d.value_gross)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Líquido Real</div>
                      <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>
                        {formatCurrency(d.value_net)}
                      </div>
                    </div>
                  </div>

                  {/* Painel Expansível de Detalhes Completo */}
                  {isExpanded && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem', fontSize: '0.78rem' }}>
                      
                      {/* Bloco 1: Contrato, Datas & Segmento */}
                      <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                          <FileText size={13} />
                          <span>Contrato & Referências de Data</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#cbd5e1' }}>
                          <div><strong>Projeto / Contrato:</strong> {d.contract_name || 'Projeto Fonte Omie'} {d.contract_number ? `(${d.contract_number})` : ''}</div>
                          <div><strong>Data de Registro:</strong> {formatDate(d.date_registration)}</div>
                          <div><strong>Data de Emissão / Lançamento:</strong> {formatDate(d.date_issue)}</div>
                          <div><strong>Data de Vencimento:</strong> {formatDate(d.date_due)}</div>
                          <div>
                            <strong>Status no Omie:</strong>{' '}
                            <span style={{ color: d.status === 'RECEBIDO' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                              {d.status === 'RECEBIDO' ? `PAGO (${formatDate(d.date_payment)})` : 'EM ABERTO'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bloco 2: Impostos Retidos, Comissões e Terceirização */}
                      <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                          <DollarSign size={13} />
                          <span>Tributação Retida & Parametrização</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#cbd5e1' }}>
                          <div><strong>Impostos Retidos (Total):</strong> <span style={{ color: '#f43f5e', fontWeight: 700 }}>{formatCurrency(d.tax_retained_total)}</span></div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            IRRF: {formatCurrency(d.tax_irrf)} • ISS: {formatCurrency(d.tax_iss)} • PIS/COFINS: {formatCurrency((d.tax_pis || 0) + (d.tax_cofins || 0))}
                          </div>
                          <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <span className={d.segment_type === 'B2G' ? styles.badgeB2G : d.segment_type === 'B2B' ? styles.badgeB2B : styles.badgeB2C}>
                              Segmento: {d.segment_type}
                            </span>
                            <span className={d.is_outsourced ? styles.badgeTerceirizada : styles.badgeB2B} style={{ background: d.is_outsourced ? undefined : 'rgba(100, 116, 139, 0.2)', color: d.is_outsourced ? undefined : '#cbd5e1' }}>
                              {d.is_outsourced ? 'SIM (Terceirizado)' : 'NÃO (Próprio)'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#8b5cf6', marginTop: '2px' }}>
                            <strong>Comissões:</strong> {d.commission && d.commission.has_commission ? `SIM (${formatCurrency(d.commission.total_commission_value)})` : 'Desativadas (Ajustável pelo usuário)'}
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Comparativo De/Para em caso de alteração de valor/status */}
                  {item.old_data && (
                    <div style={{ background: '#0b1120', padding: '0.6rem 0.85rem', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                      <div>
                        <span style={{ color: '#f43f5e', fontWeight: 700 }}>Valor / Estado Anterior no Banco:</span>
                        <div style={{ color: '#cbd5e1' }}>{formatCurrency(item.old_data.value_gross)} ({item.old_data.status})</div>
                      </div>
                      <div>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>Novo Valor / Estado no Omie:</span>
                        <div style={{ color: '#ffffff', fontWeight: 700 }}>{formatCurrency(item.new_data.value_gross)} ({item.new_data.status})</div>
                      </div>
                    </div>
                  )}

                  {/* Ações de Aprovação / Rejeição */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.65rem' }}>
                    <button
                      className={styles.btnSecondary}
                      onClick={() => onRejectEntry(item.id)}
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                    >
                      <X size={13} />
                      <span>Rejeitar (Descartar Lançamento)</span>
                    </button>

                    <button
                      className={styles.btnPrimary}
                      onClick={() => onApproveEntry(item.id)}
                      style={{ padding: '0.4rem 0.95rem', fontSize: '0.75rem', background: '#10b981', borderColor: '#059669' }}
                    >
                      <Check size={13} />
                      <span>Aceitar & Salvar no Banco</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Histórico Processado nesta Sessão */}
        {processedEntries.length > 0 && (
          <div style={{ fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Histórico desta sessão de auditoria:</span>
            <span>🟢 <strong>{processedEntries.filter(e => e.audit_status === 'ACCEPTED').length}</strong> Aprovados • 🔴 <strong>{processedEntries.filter(e => e.audit_status === 'REJECTED').length}</strong> Rejeitados</span>
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
