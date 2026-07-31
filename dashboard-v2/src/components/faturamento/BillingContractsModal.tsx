import React, { useState } from 'react';
import styles from './faturamento.module.css';
import { BillingContractParam, SegmentType, CommissionParticipant, SegmentAllocationType } from '@/types/billing.types';
import { FileText, Plus, Check, X, Users, Layers, Shield, Trash2, Edit } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contracts: BillingContractParam[];
  onSaveContract: (contract: BillingContractParam) => void;
}

export const BillingContractsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  contracts,
  onSaveContract
}) => {
  const [editingContract, setEditingContract] = useState<BillingContractParam | null>(null);

  // Form State
  const [companyName, setCompanyName] = useState<'Mar Brasil' | 'DZM'>('Mar Brasil');
  const [contractNumber, setContractNumber] = useState<string>('');
  const [contractName, setContractName] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [segmentType, setSegmentType] = useState<SegmentType>('B2B');
  const [isOutsourced, setIsOutsourced] = useState<boolean>(false);
  const [hasCommission, setHasCommission] = useState<boolean>(false);
  const [valueNonCommissionable, setValueNonCommissionable] = useState<number>(0);
  const [commissionRate, setCommissionRate] = useState<number>(5);
  const [commissionMode, setCommissionMode] = useState<'percent' | 'fixed'>('percent');
  const [participants, setParticipants] = useState<CommissionParticipant[]>([]);

  // Novo participante no formulário
  const [newPartName, setNewPartName] = useState<string>('');
  const [newPartSector, setNewPartSector] = useState<string>('Comercial');
  const [newPartRate, setNewPartRate] = useState<number>(5);
  const [newPartType, setNewPartType] = useState<'percent' | 'fixed'>('percent');

  if (!isOpen) return null;

  const handleStartNew = () => {
    setEditingContract({
      id: `ctr-${Date.now()}`,
      company_name: 'Mar Brasil',
      contract_number: '',
      contract_name: '',
      client_name: '',
      segment_type: 'B2B',
      is_outsourced: false,
      has_commission: false,
      value_non_commissionable: 0,
      commission_mode: 'percent',
      commission_rate: 0,
      commission_participants: [],
      segment_allocations: ['B2B']
    });

    setCompanyName('Mar Brasil');
    setContractNumber('');
    setContractName('');
    setClientName('');
    setSegmentType('B2B');
    setIsOutsourced(false);
    setHasCommission(false);
    setValueNonCommissionable(0);
    setCommissionRate(5);
    setCommissionMode('percent');
    setParticipants([]);
  };

  const handleSelectToEdit = (c: BillingContractParam) => {
    setEditingContract(c);
    setCompanyName(c.company_name);
    setContractNumber(c.contract_number);
    setContractName(c.contract_name);
    setClientName(c.client_name);
    setSegmentType(c.segment_type);
    setIsOutsourced(c.is_outsourced);
    setHasCommission(c.has_commission);
    setValueNonCommissionable(c.value_non_commissionable || 0);
    setCommissionRate(c.commission_rate || 0);
    setCommissionMode(c.commission_mode || 'percent');
    setParticipants(c.commission_participants || []);
  };

  const handleAddParticipant = () => {
    if (!newPartName) return;
    const newPart: CommissionParticipant = {
      id: `part-${Date.now()}`,
      name: newPartName,
      sector: newPartSector,
      type: newPartType,
      rate: newPartRate,
      calculated_value: 0
    };
    setParticipants([...participants, newPart]);
    setNewPartName('');
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const handleSaveForm = () => {
    if (!contractName || !contractNumber) {
      alert('Preencha o nome e o número do contrato fonte Omie.');
      return;
    }

    const allocations: SegmentAllocationType[] = [segmentType];
    if (isOutsourced) allocations.push('Terceirização');

    const updated: BillingContractParam = {
      id: editingContract?.id || `ctr-${Date.now()}`,
      company_name: companyName,
      contract_number: contractNumber,
      contract_name: contractName,
      client_name: clientName || 'Cliente Omie',
      segment_type: segmentType,
      is_outsourced: isOutsourced,
      has_commission: hasCommission,
      value_non_commissionable: valueNonCommissionable,
      commission_mode: commissionMode,
      commission_rate: commissionRate,
      commission_participants: hasCommission ? participants : [],
      segment_allocations: allocations
    };

    onSaveContract(updated);
    setEditingContract(null);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '850px' }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText size={22} color="#f59e0b" />
            <div>
              <h3 className={styles.modalTitle}>Central de Parametrização de Contratos Omie</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Registro inicial e regras de negócio que nunca virão automáticas do Omie (Segmento, Terceirização, Comissões e Rateios)
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Conteúdo: Lista à Esquerda + Formulário à Direita */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          
          {/* Lista de Contratos Parametrizados */}
          <div style={{ background: '#0b1120', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>Contratos Registrados ({contracts.length})</span>
              <button className={styles.btnPrimary} onClick={handleStartNew} style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>
                <Plus size={12} /> Novo Contrato
              </button>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: '380px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {contracts.map(c => (
                <div
                  key={c.id}
                  onClick={() => handleSelectToEdit(c)}
                  style={{
                    background: editingContract?.id === c.id ? 'rgba(245, 158, 11, 0.15)' : 'rgba(30, 41, 59, 0.4)',
                    border: `1px solid ${editingContract?.id === c.id ? '#f59e0b' : 'rgba(255, 255, 255, 0.08)'}`,
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: '#ffffff' }}>Contrato {c.contract_number}</strong>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>{c.company_name}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {c.contract_name}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                    <span className={styles.badgeB2B} style={{ fontSize: '0.6rem', padding: '1px 4px' }}>{c.segment_type}</span>
                    {c.is_outsourced && <span className={styles.badgeTerceirizada} style={{ fontSize: '0.6rem', padding: '1px 4px' }}>Terceirizado</span>}
                    {c.has_commission && <span style={{ fontSize: '0.6rem', padding: '1px 4px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderRadius: '4px' }}>Comissão</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formulário de Configuração do Contrato */}
          {editingContract ? (
            <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)', overflowY: 'auto', maxHeight: '420px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Edit size={16} />
                <span>Parametrizar Regras do Contrato Omie</span>
              </div>

              <div className={styles.filterGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label className={styles.filterLabel}>Empresa Alvo</label>
                  <select className={styles.selectInput} value={companyName} onChange={e => setCompanyName(e.target.value as any)}>
                    <option value="Mar Brasil">Mar Brasil Serviços</option>
                    <option value="DZM">DZM Empreendimentos</option>
                  </select>
                </div>

                <div>
                  <label className={styles.filterLabel}>Número do Contrato / Pedido Omie</label>
                  <input type="text" className={styles.textInput} placeholder="Ex: 01/2024 ou N/A" value={contractNumber} onChange={e => setContractNumber(e.target.value)} />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label className={styles.filterLabel}>Nome do Projeto Fonte Omie</label>
                  <input type="text" className={styles.textInput} placeholder="Ex: Rossi Advogados - Climatização" value={contractName} onChange={e => setContractName(e.target.value)} />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label className={styles.filterLabel}>Razão Social do Cliente (Omie)</label>
                  <input type="text" className={styles.textInput} placeholder="Ex: Rossi Advogados Associados" value={clientName} onChange={e => setClientName(e.target.value)} />
                </div>

                <div>
                  <label className={styles.filterLabel}>Classificação do Segmento</label>
                  <select className={styles.selectInput} value={segmentType} onChange={e => setSegmentType(e.target.value as SegmentType)}>
                    <option value="B2G">B2G (Governo / Órgão Público)</option>
                    <option value="B2B">B2B (Empresas / Privado)</option>
                    <option value="B2C">B2C (Consumidor Final)</option>
                  </select>
                </div>

                <div>
                  <label className={styles.filterLabel}>Terceirização (Execução por Terceiros?)</label>
                  <select className={styles.selectInput} value={isOutsourced ? 'YES' : 'NO'} onChange={e => setIsOutsourced(e.target.value === 'YES')}>
                    <option value="NO">Não (Serviço Próprio)</option>
                    <option value="YES">Sim (Serviço Terceirizado)</option>
                  </select>
                </div>
              </div>

              {/* Seção de Comissões e People Board */}
              <div style={{ background: '#0b1120', padding: '0.85rem', borderRadius: '8px', marginBottom: '0.85rem', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Users size={14} /> Regra de Comissionamento (Pautada no Líquido)
                  </span>
                  <select className={styles.selectInput} value={hasCommission ? 'YES' : 'NO'} onChange={e => setHasCommission(e.target.value === 'YES')} style={{ width: 'auto', padding: '2px 8px' }}>
                    <option value="NO">NÃO (Sem Comissão)</option>
                    <option value="YES">SIM (Com Comissão)</option>
                  </select>
                </div>

                {hasCommission && (
                  <>
                    <div className={styles.filterGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label className={styles.filterLabel}>Valor NÃO Comissionável (R$)</label>
                        <input type="number" className={styles.textInput} value={valueNonCommissionable} onChange={e => setValueNonCommissionable(parseFloat(e.target.value) || 0)} placeholder="0,00" />
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Deduz do líquido real</div>
                      </div>

                      <div>
                        <label className={styles.filterLabel}>Taxa Total de Comissão</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input type="number" className={styles.textInput} value={commissionRate} onChange={e => setCommissionRate(parseFloat(e.target.value) || 0)} />
                          <select className={styles.selectInput} value={commissionMode} onChange={e => setCommissionMode(e.target.value as any)} style={{ width: '70px' }}>
                            <option value="percent">%</option>
                            <option value="fixed">R$</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Adicionar Participante People / Setor */}
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '0.4rem' }}>Rateio com Colaboradores do People ou Setor:</div>
                    <div className={styles.filterGrid} style={{ gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.4rem', alignItems: 'end', marginBottom: '0.5rem' }}>
                      <input type="text" className={styles.textInput} placeholder="Nome do Colaborador / Setor" value={newPartName} onChange={e => setNewPartName(e.target.value)} />
                      <select className={styles.selectInput} value={newPartSector} onChange={e => setNewPartSector(e.target.value)}>
                        <option value="Comercial">Comercial</option>
                        <option value="Operações">Operações</option>
                        <option value="Engenharia">Engenharia</option>
                        <option value="Diretoria">Diretoria</option>
                      </select>
                      <input type="number" className={styles.textInput} placeholder="%" value={newPartRate} onChange={e => setNewPartRate(parseFloat(e.target.value) || 0)} />
                      <button className={styles.btnPrimary} onClick={handleAddParticipant} style={{ padding: '0.35rem 0.6rem' }}><Plus size={12} /></button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {participants.map((p, idx) => (
                        <div key={idx} style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.35rem 0.6rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                          <span><strong>{p.name}</strong> ({p.sector}) • {p.rate}%</span>
                          <button className={styles.closeBtn} onClick={() => handleRemoveParticipant(p.id)}><Trash2 size={12} color="#f43f5e" /></button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Botões do Formulário */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className={styles.btnSecondary} onClick={() => setEditingContract(null)}>Cancelar</button>
                <button className={styles.btnPrimary} onClick={handleSaveForm}>
                  <Check size={14} /> Salvar Parametrização
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', background: 'rgba(30, 41, 59, 0.2)', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={36} color="#64748b" style={{ marginBottom: '0.5rem' }} />
              <div>Selecione um contrato da lista à esquerda para editar suas configurações ou clique em <strong>"Novo Contrato"</strong>.</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className={styles.btnSecondary} onClick={onClose}>Fechar Central</button>
        </div>
      </div>
    </div>
  );
};
