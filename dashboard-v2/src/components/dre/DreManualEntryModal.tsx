"use client";
/**
 * DreManualEntryModal.tsx
 * =======================
 * Modal para inserção manual de lançamentos DRE de empresas
 * fora do Omie (Conectius, Ybox) ou correções históricas.
 *
 * Integrado ao DreLancamentosService → tabela dre_lancamentos (fonte='manual').
 *
 * v.02.48.24 — Filtros avançados: Ano, multi-select de Empresa/Mês/Categoria,
 *              campo de busca por texto para listas extensas.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Plus, Trash2, Loader2, AlertCircle, CheckCircle2,
  Building2, CalendarDays, DollarSign, FileText, RefreshCw, Pencil,
  Search, ChevronDown, Filter, SlidersHorizontal
} from 'lucide-react';
import {
  DreLancamentosService,
  DreLancamento,
  DreManualEntryForm,
  EMPRESAS_MANUAL_ONLY,
  PERIODOS_DISPONIVEIS,
  CONTAS_DRE_MANUAL,
  CATEGORIAS_MANUAL,
} from '@/services/dre-lancamentos.service';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface DreManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Callback chamado após salvar, para notificar o dashboard */
  onSaved?: () => void;
}

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
} | null;

// ── Formulário vazio ──────────────────────────────────────────────────────────
const EMPTY_FORM: DreManualEntryForm = {
  empresa:      'Conectius',
  departamento: '',
  conta_dre:    '',
  projeto:      'N/D',
  categoria:    '',
  periodo:      '',
  valor:        0,
};

// ── Extrai anos únicos de uma lista de períodos (ex: "Jan/24" → "2024") ───────
function extractYears(periodos: string[]): string[] {
  const years = new Set<string>();
  periodos.forEach(p => {
    const match = p.match(/\/(\d{2})$/);
    if (match) years.add(`20${match[1]}`);
  });
  return Array.from(years).sort();
}

// ── Multi-select dropdown genérico ────────────────────────────────────────────
interface MultiSelectProps {
  label: string;
  icon?: React.ReactNode;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  onClear: () => void;
  searchable?: boolean;
  placeholder?: string;
  compact?: boolean;
}

function MultiSelectDropdown({
  label, icon, options, selected, onToggle, onClear,
  searchable = false, placeholder = 'Buscar...', compact = false
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = searchable
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const displayLabel = selected.length === 0
    ? 'Todos'
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selecionados`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 bg-slate-800 border border-slate-600 text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 hover:border-slate-500 transition-colors ${compact ? 'text-xs' : 'text-sm'} whitespace-nowrap`}
      >
        {icon && <span className="text-slate-400">{icon}</span>}
        <span className={selected.length > 0 ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
          {label}: {displayLabel}
        </span>
        <ChevronDown size={11} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl min-w-[200px] max-w-[280px] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            {selected.length > 0 && (
              <button type="button" onClick={onClear} className="text-[10px] text-amber-500 hover:text-amber-400 font-semibold">
                Limpar
              </button>
            )}
          </div>
          {/* Search */}
          {searchable && (
            <div className="px-2 py-1.5 border-b border-slate-700">
              <div className="flex items-center gap-1.5 bg-slate-900 rounded-lg px-2 py-1">
                <Search size={11} className="text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={placeholder}
                  className="bg-transparent text-white text-xs w-full focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>
          )}
          {/* Options */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-500 px-3 py-2">Nenhum resultado</p>
            ) : (
              filtered.map(opt => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => onToggle(opt)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center
                    ${selected.includes(opt) ? 'bg-amber-500 border-amber-500' : 'border-slate-500'}`}
                  >
                    {selected.includes(opt) && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={selected.includes(opt) ? 'text-amber-300 font-medium' : 'text-slate-300'}>
                    {opt}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function DreManualEntryModal({ isOpen, onClose, onSaved }: DreManualEntryModalProps) {
  const [form, setForm] = useState<DreManualEntryForm>(EMPTY_FORM);
  const [records, setRecords] = useState<DreLancamento[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  // ── Filtros da tabela de registros ──
  const [filterEmpresas, setFilterEmpresas] = useState<string[]>([]);
  const [filterAno, setFilterAno] = useState<string>('Todos');
  const [filterMeses, setFilterMeses] = useState<string[]>([]);
  const [filterCategorias, setFilterCategorias] = useState<string[]>([]);
  const [filterText, setFilterText] = useState<string>('');

  // ── Categorias disponíveis conforme Conta DRE selecionada ──
  const categoriasDisponiveis = useMemo(() => {
    if (!form.conta_dre) return [];
    return CATEGORIAS_MANUAL[form.conta_dre] || [form.conta_dre];
  }, [form.conta_dre]);

  // ── Anos disponíveis na lista de períodos ──
  const anosDisponiveis = useMemo(() => ['Todos', ...extractYears(PERIODOS_DISPONIVEIS)], []);

  // ── Períodos filtrados pelo ano selecionado (para o filtro de Mês) ──
  const mesesDoAno = useMemo(() => {
    if (filterAno === 'Todos') return PERIODOS_DISPONIVEIS;
    const ano2d = filterAno.slice(2); // "2024" → "24"
    return PERIODOS_DISPONIVEIS.filter(p => p.endsWith(`/${ano2d}`));
  }, [filterAno]);

  // ── Valores únicos nos registros (para os filtros dinâmicos) ──
  const empresasNaTabela = useMemo(() => Array.from(new Set(records.map(r => r.empresa))).sort(), [records]);
  const categoriasNaTabela = useMemo(() => Array.from(new Set(records.map(r => r.categoria))).sort(), [records]);

  // ── Carrega registros manuais existentes ──
  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const data = await DreLancamentosService.fetchAllManual();
      setRecords(data);
    } catch (e) {
      console.error('Erro ao carregar registros manuais:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setEditingId(null);
      setFeedback(null);
      loadRecords();
    }
  }, [isOpen]);

  // Ao mudar o ano do filtro, limpa filtro de meses para não conflitar
  useEffect(() => {
    setFilterMeses([]);
  }, [filterAno]);

  // ── Registros filtrados para a tabela ─────────────────────────────────────
  const filteredRecords = useMemo(() => {
    let r = records;

    // Filtro por empresa (multi-select)
    if (filterEmpresas.length > 0) {
      r = r.filter(rec => filterEmpresas.includes(rec.empresa));
    }

    // Filtro por ano
    if (filterAno !== 'Todos') {
      const ano2d = filterAno.slice(2);
      r = r.filter(rec => rec.periodo?.endsWith(`/${ano2d}`));
    }

    // Filtro por mês (multi-select dentro do ano)
    if (filterMeses.length > 0) {
      r = r.filter(rec => filterMeses.includes(rec.periodo));
    }

    // Filtro por categoria (multi-select)
    if (filterCategorias.length > 0) {
      r = r.filter(rec => filterCategorias.includes(rec.categoria));
    }

    // Filtro por texto livre
    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      r = r.filter(rec =>
        rec.empresa?.toLowerCase().includes(q) ||
        rec.categoria?.toLowerCase().includes(q) ||
        rec.departamento?.toLowerCase().includes(q) ||
        rec.conta_dre?.toLowerCase().includes(q) ||
        rec.periodo?.toLowerCase().includes(q)
      );
    }

    return r;
  }, [records, filterEmpresas, filterAno, filterMeses, filterCategorias, filterText]);

  const hasActiveFilters = filterEmpresas.length > 0 || filterAno !== 'Todos' || filterMeses.length > 0 || filterCategorias.length > 0 || filterText.trim() !== '';

  const clearAllFilters = () => {
    setFilterEmpresas([]);
    setFilterAno('Todos');
    setFilterMeses([]);
    setFilterCategorias([]);
    setFilterText('');
  };

  if (!isOpen) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = {
        ...prev,
        [name]: name === 'valor' ? parseFloat(value) || 0 : value,
      };
      if (name === 'conta_dre') {
        updated.categoria = '';
      }
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!form.empresa || !form.conta_dre || !form.categoria || !form.periodo) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos obrigatórios.' });
      return;
    }
    if (form.valor <= 0) {
      setFeedback({ type: 'error', message: 'Valor deve ser maior que zero.' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const { error } = await DreLancamentosService.updateManualRow(editingId, form);
        if (error) {
          setFeedback({ type: 'error', message: `Erro ao atualizar: ${error}` });
        } else {
          setFeedback({
            type: 'success',
            message: `Lançamento de ${form.empresa} em ${form.periodo} atualizado com sucesso!`,
          });
          setForm(EMPTY_FORM);
          setEditingId(null);
          await loadRecords();
          onSaved?.();
        }
      } else {
        const { error } = await DreLancamentosService.insertManualRow(form);
        if (error) {
          setFeedback({ type: 'error', message: `Erro ao salvar: ${error}` });
        } else {
          setFeedback({
            type: 'success',
            message: `Lançamento de ${form.empresa} em ${form.periodo} salvo com sucesso!`,
          });
          setForm(prev => ({ ...prev, valor: 0, periodo: '' }));
          await loadRecords();
          onSaved?.();
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este lançamento permanentemente?')) return;
    setIsDeleting(id);
    try {
      const { error } = await DreLancamentosService.deleteManualRow(id);
      if (error) {
        alert(`Erro ao excluir: ${error}`);
      } else {
        await loadRecords();
        onSaved?.();
      }
    } finally {
      setIsDeleting(null);
    }
  };

  // ── Formatação de valor ──────────────────────────────────────────────────
  const fmt = (v: any) => {
    const val = typeof v === 'string' ? parseFloat(v) : v;
    if (val === undefined || val === null || isNaN(val)) return 'R$ 0';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Cabeçalho ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center">
              <Building2 size={18} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Inserir Dados Manuais
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Conectius, Ybox e histórico fora do Omie
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Corpo ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Formulário de inserção / edição */}
          <form onSubmit={handleSave} className="p-6 border-b border-slate-700/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</span>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(EMPTY_FORM);
                  }}
                  className="text-[10px] text-amber-500 hover:underline hover:text-amber-400 font-semibold"
                >
                  Cancelar Edição
                </button>
              )}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {/* Empresa */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Building2 size={11} /> Empresa *
                </label>
                <select
                  name="empresa"
                  value={form.empresa}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {EMPRESAS_MANUAL_ONLY.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                  <option value="MarBR">MarBR (histórico)</option>
                  <option value="DZM">DZM (histórico)</option>
                </select>
              </div>

              {/* Período — com seletor de ano primeiro */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <CalendarDays size={11} /> Período *
                </label>
                <div className="flex gap-2">
                  {/* Seletor de Ano (formulário) */}
                  <select
                    value={form.periodo ? `20${form.periodo.split('/')[1]}` : ''}
                    onChange={e => {
                      const ano = e.target.value;
                      if (!ano) { setForm(prev => ({ ...prev, periodo: '' })); return; }
                      const ano2d = ano.slice(2);
                      // Pega o primeiro mês do ano se o período atual não for do mesmo ano
                      if (!form.periodo || !form.periodo.endsWith(`/${ano2d}`)) {
                        const primeiroDoAno = [...PERIODOS_DISPONIVEIS].reverse().find(p => p.endsWith(`/${ano2d}`));
                        setForm(prev => ({ ...prev, periodo: primeiroDoAno || '' }));
                      }
                    }}
                    className="w-24 flex-shrink-0 bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">Ano</option>
                    {extractYears(PERIODOS_DISPONIVEIS).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  {/* Seletor de Mês */}
                  <select
                    name="periodo"
                    value={form.periodo}
                    onChange={handleChange}
                    className="flex-1 bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">— Mês —</option>
                    {(() => {
                      const ano2d = form.periodo ? form.periodo.split('/')[1] : null;
                      const lista = ano2d
                        ? [...PERIODOS_DISPONIVEIS].reverse().filter(p => p.endsWith(`/${ano2d}`))
                        : [...PERIODOS_DISPONIVEIS].reverse();
                      return lista.map(p => <option key={p} value={p}>{p}</option>);
                    })()}
                  </select>
                </div>
              </div>

              {/* Conta DRE */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileText size={11} /> Conta DRE *
                </label>
                <select
                  name="conta_dre"
                  value={form.conta_dre}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">— Selecione —</option>
                  {CONTAS_DRE_MANUAL.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Categoria */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileText size={11} /> Categoria *
                </label>
                <select
                  name="categoria"
                  value={form.categoria}
                  onChange={handleChange}
                  disabled={!form.conta_dre}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-40"
                >
                  <option value="">— Selecione a Conta DRE primeiro —</option>
                  {categoriasDisponiveis.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Departamento */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Departamento / Projeto
                </label>
                <input
                  type="text"
                  name="departamento"
                  value={form.departamento}
                  onChange={handleChange}
                  placeholder="ex: Conectius - Rateio"
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-500"
                />
              </div>

              {/* Valor */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <DollarSign size={11} /> Valor (R$) *
                </label>
                <input
                  type="number"
                  name="valor"
                  value={form.valor || ''}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Valor absoluto positivo (o DRE aplica o sinal correto pela Conta DRE)
                </p>
              </div>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`mt-4 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm font-medium
                ${feedback.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
                }`}
              >
                {feedback.type === 'success'
                  ? <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
                  : <AlertCircle   size={15} className="mt-0.5 flex-shrink-0" />
                }
                {feedback.message}
              </div>
            )}

            {/* Botão salvar / atualizar */}
            <div className="mt-4 flex justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(EMPTY_FORM);
                  }}
                  disabled={isSaving}
                  className="border border-slate-600 hover:border-slate-500 text-slate-300 font-bold text-sm px-5 py-2.5 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-lg transition-colors"
              >
                {isSaving
                  ? <><Loader2 size={14} className="animate-spin" /> {editingId ? 'Atualizando...' : 'Salvando...'}</>
                  : editingId
                  ? <><CheckCircle2 size={14} /> Atualizar Lançamento</>
                  : <><Plus size={14} /> Salvar Lançamento</>
                }
              </button>
            </div>
          </form>

          {/* ── Tabela de registros existentes ── */}
          <div className="p-6">
            {/* Cabeçalho da tabela + filtros */}
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <SlidersHorizontal size={12} />
                  Lançamentos Manuais Existentes
                  {records.length > 0 && (
                    <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      {filteredRecords.length}
                      {filteredRecords.length !== records.length && ` / ${records.length}`}
                    </span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={loadRecords}
                  disabled={isLoading}
                  className="text-slate-400 hover:text-amber-400 transition-colors p-1.5 rounded-lg hover:bg-slate-700"
                  title="Atualizar lista"
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Linha de filtros */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Busca por texto */}
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 min-w-[140px] max-w-[200px]">
                  <Search size={11} className="text-slate-500 flex-shrink-0" />
                  <input
                    type="text"
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    placeholder="Buscar..."
                    className="bg-transparent text-white text-xs w-full focus:outline-none placeholder:text-slate-600"
                  />
                </div>

                {/* Filtro por Empresa (multi-select) */}
                <MultiSelectDropdown
                  label="Empresa"
                  icon={<Building2 size={11} />}
                  options={empresasNaTabela}
                  selected={filterEmpresas}
                  onToggle={v => setFilterEmpresas(prev =>
                    prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
                  )}
                  onClear={() => setFilterEmpresas([])}
                  compact
                />

                {/* Filtro por Ano */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={filterAno}
                    onChange={e => setFilterAno(e.target.value)}
                    className={`bg-slate-800 border border-slate-600 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors
                      ${filterAno !== 'Todos' ? 'text-amber-400 font-semibold border-amber-500/40' : 'text-slate-300'}`}
                  >
                    {anosDisponiveis.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Mês (multi-select, aparece apenas quando um ano está selecionado) */}
                {filterAno !== 'Todos' && (
                  <MultiSelectDropdown
                    label="Mês"
                    icon={<CalendarDays size={11} />}
                    options={mesesDoAno}
                    selected={filterMeses}
                    onToggle={v => setFilterMeses(prev =>
                      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
                    )}
                    onClear={() => setFilterMeses([])}
                    compact
                  />
                )}

                {/* Filtro por Categoria (multi-select com busca) */}
                <MultiSelectDropdown
                  label="Categoria"
                  icon={<Filter size={11} />}
                  options={categoriasNaTabela}
                  selected={filterCategorias}
                  onToggle={v => setFilterCategorias(prev =>
                    prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
                  )}
                  onClear={() => setFilterCategorias([])}
                  searchable
                  placeholder="Buscar categoria..."
                  compact
                />

                {/* Limpar todos os filtros */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors font-semibold underline underline-offset-2"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                Carregando...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                {records.length === 0
                  ? 'Nenhum lançamento manual encontrado.'
                  : 'Nenhum resultado para os filtros selecionados.'}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="block mx-auto mt-2 text-xs text-amber-500 hover:text-amber-400 font-semibold"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800 border-b border-slate-700">
                      <th className="text-left px-3 py-2.5 text-slate-400 font-semibold">Empresa</th>
                      <th className="text-left px-3 py-2.5 text-slate-400 font-semibold">Período</th>
                      <th className="text-left px-3 py-2.5 text-slate-400 font-semibold">Categoria</th>
                      <th className="text-left px-3 py-2.5 text-slate-400 font-semibold hidden sm:table-cell">Departamento</th>
                      <th className="text-right px-3 py-2.5 text-slate-400 font-semibold">Valor</th>
                      <th className="px-3 py-2.5 text-slate-400 font-semibold text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {filteredRecords.map(rec => {
                      if (!rec) return null;
                      const empresa = rec.empresa || 'Sem Empresa';
                      const periodo = rec.periodo || 'N/D';
                      const categoria = rec.categoria || 'Sem Categoria';
                      const departamento = rec.departamento || 'Sem Departamento';
                      const valor = rec.valor || 0;
                      return (
                        <tr
                          key={rec.id}
                          className="hover:bg-slate-800/50 transition-colors group"
                        >
                          <td className="px-3 py-2.5 text-white font-medium">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold
                              ${empresa === 'Conectius'
                                ? 'bg-sky-500/15 text-sky-300'
                                : empresa === 'Ybox'
                                ? 'bg-violet-500/15 text-violet-300'
                                : 'bg-amber-500/15 text-amber-300'
                              }`}
                            >
                              {empresa}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-300 font-mono">{periodo}</td>
                          <td className="px-3 py-2.5 text-slate-300 max-w-[180px] truncate" title={categoria}>
                            {categoria}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 hidden sm:table-cell max-w-[140px] truncate" title={departamento}>
                            {departamento || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-emerald-400 font-mono">
                            {fmt(valor)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (rec.id) {
                                    setEditingId(rec.id);
                                    setForm({
                                      empresa: rec.empresa,
                                      departamento: rec.departamento || '',
                                      conta_dre: rec.conta_dre,
                                      projeto: rec.projeto || 'N/D',
                                      categoria: rec.categoria,
                                      periodo: rec.periodo,
                                      valor: rec.valor,
                                    });
                                    const modalBody = document.querySelector('.overflow-y-auto');
                                    if (modalBody) {
                                      modalBody.scrollTo({ top: 0, behavior: 'smooth' });
                                    }
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-amber-400 p-1 rounded"
                                title="Editar lançamento"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => rec.id && handleDelete(rec.id)}
                                disabled={isDeleting === rec.id}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400 p-1 rounded"
                                title="Excluir lançamento"
                              >
                                {isDeleting === rec.id
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : <Trash2 size={12} />
                                }
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Rodapé ── */}
        <div className="px-6 py-3 border-t border-slate-700 flex-shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Lançamentos manuais são permanentes e não afetados por uploads do Omie.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
