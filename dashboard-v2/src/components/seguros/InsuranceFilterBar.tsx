/**
 * InsuranceFilterBar — Barra de filtros da página de Seguros
 */
"use client";

import { Filter, X } from 'lucide-react';
import { InsuranceFilterValues } from '@/types/insurance';
import styles from './seguros.module.css';

interface InsuranceFilterBarProps {
  filters: InsuranceFilterValues;
  onChange: (filters: InsuranceFilterValues) => void;
  contratantes: string[];
  tipos: string[];
  seguradoras: string[];
  totalVisible: number;
  totalAll: number;
}

export function InsuranceFilterBar({
  filters,
  onChange,
  contratantes,
  tipos,
  seguradoras,
  totalVisible,
  totalAll,
}: InsuranceFilterBarProps) {
  const hasActiveFilter =
    filters.contratante || filters.tipo || filters.seguradora || filters.mostrarInativos;

  const handleClear = () => {
    onChange({ contratante: '', tipo: '', seguradora: '', mostrarInativos: false });
  };

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterBarLeft}>
        <div className={styles.filterBarIcon}>
          <Filter size={15} />
        </div>

        {/* Contratante */}
        <select
          className={styles.filterSelect}
          value={filters.contratante}
          onChange={(e) => onChange({ ...filters, contratante: e.target.value })}
          aria-label="Filtrar por contratante"
        >
          <option value="">Todas as empresas</option>
          {contratantes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Tipo */}
        <select
          className={styles.filterSelect}
          value={filters.tipo}
          onChange={(e) => onChange({ ...filters, tipo: e.target.value })}
          aria-label="Filtrar por tipo de seguro"
        >
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Seguradora */}
        <select
          className={styles.filterSelect}
          value={filters.seguradora}
          onChange={(e) => onChange({ ...filters, seguradora: e.target.value })}
          aria-label="Filtrar por seguradora"
        >
          <option value="">Todas as seguradoras</option>
          {seguradoras.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Mostrar inativos */}
        <label className={styles.filterToggle}>
          <input
            type="checkbox"
            checked={filters.mostrarInativos}
            onChange={(e) => onChange({ ...filters, mostrarInativos: e.target.checked })}
          />
          <span>Incluir inativas</span>
        </label>
      </div>

      <div className={styles.filterBarRight}>
        <span className={styles.filterCount}>
          {totalVisible === totalAll
            ? `${totalAll} apólice${totalAll !== 1 ? 's' : ''}`
            : `${totalVisible} de ${totalAll}`}
        </span>

        {hasActiveFilter && (
          <button className={styles.filterClearBtn} onClick={handleClear} title="Limpar filtros">
            <X size={14} />
            <span>Limpar</span>
          </button>
        )}
      </div>
    </div>
  );
}
