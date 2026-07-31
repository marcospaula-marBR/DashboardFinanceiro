import React from 'react';
import styles from './faturamento.module.css';
import { BillingFilterState, DateReferenceType, SegmentType } from '@/types/billing.types';
import { Search, Filter, RotateCcw } from 'lucide-react';

interface Props {
  filter: BillingFilterState;
  onChange: (newFilter: BillingFilterState) => void;
  clientsList: string[];
}

export const BillingFilterBar: React.FC<Props> = ({ filter, onChange, clientsList }) => {
  const handleSelectChange = (key: keyof BillingFilterState, value: string) => {
    onChange({ ...filter, [key]: value });
  };

  const handleReset = () => {
    onChange({
      company: 'ALL',
      date_type: 'date_registration',
      start_date: '',
      end_date: '',
      segment: 'ALL',
      is_outsourced: 'ALL',
      client: '',
      has_commission: 'ALL',
      search: ''
    });
  };

  return (
    <div className={styles.filterCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b' }}>
          <Filter size={16} />
          <span>Filtros Estratégicos & Multidatas</span>
        </div>
        <button className={styles.btnSecondary} onClick={handleReset} style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
          <RotateCcw size={12} />
          <span>Limpar</span>
        </button>
      </div>

      <div className={styles.filterGrid}>
        {/* Empresa */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Empresa</label>
          <select
            className={styles.selectInput}
            value={filter.company}
            onChange={e => handleSelectChange('company', e.target.value)}
          >
            <option value="ALL">Todas as Empresas</option>
            <option value="Mar Brasil">Mar Brasil Serviços</option>
            <option value="DZM">DZM Empreendimentos</option>
          </select>
        </div>

        {/* Tipo de Data Referência */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Referência de Data</label>
          <select
            className={styles.selectInput}
            value={filter.date_type}
            onChange={e => handleSelectChange('date_type', e.target.value as DateReferenceType)}
          >
            <option value="date_registration">📌 Data de Registro</option>
            <option value="date_issue">📄 Data de Lançamento / Emissão</option>
            <option value="date_due">📅 Data de Vencimento</option>
            <option value="date_payment">💳 Data de Recebimento</option>
          </select>
        </div>

        {/* Período De / Até */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Data Início</label>
          <input
            type="date"
            className={styles.textInput}
            value={filter.start_date}
            onChange={e => handleSelectChange('start_date', e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Data Fim</label>
          <input
            type="date"
            className={styles.textInput}
            value={filter.end_date}
            onChange={e => handleSelectChange('end_date', e.target.value)}
          />
        </div>

        {/* Segmento (B2G / B2B / B2C) */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Segmento</label>
          <select
            className={styles.selectInput}
            value={filter.segment}
            onChange={e => handleSelectChange('segment', e.target.value as SegmentType | 'ALL')}
          >
            <option value="ALL">Todos os Segmentos</option>
            <option value="B2G">B2G (Governo / Público)</option>
            <option value="B2B">B2B (Empresas / Privado)</option>
            <option value="B2C">B2C (Consumidor Final)</option>
          </select>
        </div>

        {/* Terceirização */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Terceirização</label>
          <select
            className={styles.selectInput}
            value={filter.is_outsourced}
            onChange={e => handleSelectChange('is_outsourced', e.target.value)}
          >
            <option value="ALL">Todos (Sim & Não)</option>
            <option value="YES">Sim (Terceirizado)</option>
            <option value="NO">Não (Próprio)</option>
          </select>
        </div>

        {/* Comissões */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Comissões</label>
          <select
            className={styles.selectInput}
            value={filter.has_commission}
            onChange={e => handleSelectChange('has_commission', e.target.value)}
          >
            <option value="ALL">Todas as Notas</option>
            <option value="YES">Com Comissão</option>
            <option value="NO">Sem Comissão</option>
          </select>
        </div>

        {/* Cliente / Tomador */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Cliente (Omie)</label>
          <select
            className={styles.selectInput}
            value={filter.client}
            onChange={e => handleSelectChange('client', e.target.value)}
          >
            <option value="">Todos os Clientes</option>
            {clientsList.map((client, idx) => (
              <option key={idx} value={client}>{client}</option>
            ))}
          </select>
        </div>

        {/* Busca Global */}
        <div className={styles.filterGroup} style={{ gridColumn: 'span 2' }}>
          <label className={styles.filterLabel}>Busca por Texto / NF / Contrato</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Digite NF, OS, Contrato, Cliente ou Cidade..."
              className={styles.textInput}
              value={filter.search}
              onChange={e => handleSelectChange('search', e.target.value)}
              style={{ paddingLeft: '2rem' }}
            />
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
