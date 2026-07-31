import React, { useState, useEffect } from 'react';
import styles from './faturamento.module.css';
import { BillingItem, CommissionParticipant } from '@/types/billing.types';
import { Users, DollarSign, Plus, Trash2, Check, X, Shield } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: BillingItem | null;
  onSave: (itemId: string, updatedCommission: BillingItem['commission']) => void;
}

export const BillingCommissionModal: React.FC<Props> = ({ isOpen, onClose, item, onSave }) => {
  const [hasCommission, setHasCommission] = useState<boolean>(true);
  const [nonCommissionable, setNonCommissionable] = useState<number>(0);
  const [participants, setParticipants] = useState<CommissionParticipant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState<string>('');
  const [newParticipantSector, setNewParticipantSector] = useState<string>('Comercial');
  const [newParticipantRate, setNewParticipantRate] = useState<number>(1);
  const [newParticipantType, setNewParticipantType] = useState<'percent' | 'fixed'>('percent');

  useEffect(() => {
    if (item) {
      setHasCommission(item.commission.has_commission);
      setNonCommissionable(item.commission.value_non_commissionable || 0);
      setParticipants(item.commission.participants || []);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Cálculo da Base Comissionável = Líquido - Valor Não Comissionável
  const netValue = item.value_net;
  const commissionableBase = Math.max(0, netValue - nonCommissionable);

  // Recalcula totais dos participantes
  const updatedParticipants = participants.map(p => {
    const val = p.type === 'percent' ? (commissionableBase * (p.rate || 0)) / 100 : (p.rate || 0);
    return { ...p, calculated_value: val };
  });

  const totalCommissionValue = updatedParticipants.reduce((acc, p) => acc + p.calculated_value, 0);
  const totalCommissionPercent = commissionableBase > 0 ? (totalCommissionValue / commissionableBase) * 100 : 0;

  const handleAddParticipant = () => {
    if (!newParticipantName) return;
    const newPart: CommissionParticipant = {
      id: `part-${Date.now()}`,
      name: newParticipantName,
      sector: newParticipantSector,
      type: newParticipantType,
      rate: newParticipantRate,
      calculated_value: 0
    };
    setParticipants([...participants, newPart]);
    setNewParticipantName('');
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const handleSave = () => {
    onSave(item.id, {
      has_commission: hasCommission,
      value_non_commissionable: nonCommissionable,
      value_commissionable_base: commissionableBase,
      total_commission_percent: totalCommissionPercent,
      total_commission_value: totalCommissionValue,
      participants: updatedParticipants
    });
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Users size={20} color="#8b5cf6" />
            <div>
              <h3 className={styles.modalTitle} style={{ color: '#8b5cf6' }}>Configurar Comissões</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Nota/OS: <strong>{item.invoice_number}</strong> — {item.client_name}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Toggle Habilitar Comissão */}
        <div style={{ background: '#0b1120', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>Calcular Comissão nesta Nota?</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Pauta-se no Valor Líquido Real após retenções</div>
          </div>
          <select
            className={styles.selectInput}
            value={hasCommission ? 'YES' : 'NO'}
            onChange={e => setHasCommission(e.target.value === 'YES')}
            style={{ width: 'auto', fontWeight: 700, color: hasCommission ? '#10b981' : '#f43f5e' }}
          >
            <option value="YES">SIM (Comissionável)</option>
            <option value="NO">NÃO (Sem Comissão)</option>
          </select>
        </div>

        {hasCommission && (
          <>
            {/* Detalhamento de Base Comissionável */}
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div className={styles.filterGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div>
                  <div className={styles.detailLabel}>Valor Líquido Real</div>
                  <div className={styles.detailValue} style={{ color: '#10b981' }}>{formatCurrency(netValue)}</div>
                </div>

                <div>
                  <label className={styles.detailLabel}>Valor NÃO Comissionável</label>
                  <input
                    type="number"
                    className={styles.textInput}
                    value={nonCommissionable}
                    onChange={e => setNonCommissionable(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    style={{ marginTop: '0.2rem' }}
                  />
                </div>

                <div>
                  <div className={styles.detailLabel}>Base Comissionável Líquida</div>
                  <div className={styles.detailValue} style={{ color: '#f59e0b' }}>{formatCurrency(commissionableBase)}</div>
                </div>
              </div>
            </div>

            {/* Inserção de Novo Comissionado / Setor (Integrado com People) */}
            <div style={{ background: '#0b1120', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Plus size={14} />
                <span>Adicionar Colaborador (People) ou Setor para Rateio</span>
              </div>

              <div className={styles.filterGrid} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto', alignItems: 'end' }}>
                <div>
                  <label className={styles.filterLabel}>Nome do Colaborador / Setor</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Ex: Gabriel Bellini / Comercial"
                    value={newParticipantName}
                    onChange={e => setNewParticipantName(e.target.value)}
                  />
                </div>

                <div>
                  <label className={styles.filterLabel}>Setor</label>
                  <select
                    className={styles.selectInput}
                    value={newParticipantSector}
                    onChange={e => setNewParticipantSector(e.target.value)}
                  >
                    <option value="Comercial">Comercial</option>
                    <option value="Operações">Operações</option>
                    <option value="Engenharia">Engenharia</option>
                    <option value="Diretoria">Diretoria</option>
                  </select>
                </div>

                <div>
                  <label className={styles.filterLabel}>Tipo Rateio</label>
                  <select
                    className={styles.selectInput}
                    value={newParticipantType}
                    onChange={e => setNewParticipantType(e.target.value as 'percent' | 'fixed')}
                  >
                    <option value="percent">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                </div>

                <div>
                  <label className={styles.filterLabel}>{newParticipantType === 'percent' ? 'Taxa (%)' : 'Valor (R$)'}</label>
                  <input
                    type="number"
                    className={styles.textInput}
                    value={newParticipantRate}
                    onChange={e => setNewParticipantRate(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <button className={styles.btnPrimary} onClick={handleAddParticipant} style={{ padding: '0.45rem 0.75rem' }}>
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Lista de Comissionados */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.5rem' }}>
                Participantes do Rateio ({updatedParticipants.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {updatedParticipants.map((p, idx) => (
                  <div key={idx} style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.6rem 0.85rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Shield size={14} color="#8b5cf6" />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>{p.name}</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{p.sector} • {p.type === 'percent' ? `${p.rate}%` : formatCurrency(p.rate)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#8b5cf6' }}>
                        {formatCurrency(p.calculated_value)}
                      </div>
                      <button className={styles.closeBtn} onClick={() => handleRemoveParticipant(p.id)}>
                        <Trash2 size={14} color="#f43f5e" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo Total de Comissão */}
            <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Total de Comissão a Ratear</div>
                <div style={{ fontSize: '0.7rem', color: '#a7f3d0' }}>Equivale a {totalCommissionPercent.toFixed(2)}% da base comissionável</div>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#8b5cf6' }}>
                {formatCurrency(totalCommissionValue)}
              </div>
            </div>
          </>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSave}>
            <Check size={14} />
            <span>Salvar Comissões</span>
          </button>
        </div>
      </div>
    </div>
  );
};
