"use client";
/**
 * DreManualEntryModal.tsx
 * =======================
 * Modal para inserção manual de lançamentos DRE de empresas
 * fora do Omie (Conectius, Ybox) ou correções históricas.
 *
 * Integrado ao DreLancamentosService → tabela dre_lancamentos (fonte='manual').
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Plus, Trash2, Loader2, AlertCircle, CheckCircle2,
  Building2, CalendarDays, DollarSign, FileText, RefreshCw
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

// ── Componente ────────────────────────────────────────────────────────────────
export function DreManualEntryModal({ isOpen, onClose, onSaved }: DreManualEntryModalProps) {
  const [form, setForm] = useState<DreManualEntryForm>(EMPTY_FORM);
  const [records, setRecords] = useState<DreLancamento[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [filterEmpresa, setFilterEmpresa] = useState<string>('Todos');

  // ── Categorias disponíveis conforme Conta DRE selecionada ──
  const categoriasDisponiveis = useMemo(() => {
    if (!form.conta_dre) return [];
    return CATEGORIAS_MANUAL[form.conta_dre] || [form.conta_dre];
  }, [form.conta_dre]);

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
      setFeedback(null);
      loadRecords();
    }
  }, [isOpen]);

  // Reset categoria quando Conta DRE muda
  useEffect(() => {
    setForm(prev => ({ ...prev, categoria: '' }));
  }, [form.conta_dre]);

  if (!isOpen) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'valor' ? parseFloat(value) || 0 : value,
    }));
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

  // ── Registros filtrados para a tabela ─────────────────────────────────────
  const filteredRecords = useMemo(() => {
    if (filterEmpresa === 'Todos') return records;
    return records.filter(r => r.empresa === filterEmpresa);
  }, [records, filterEmpresa]);

  const empresasNaTabela = useMemo(() => {
    const all = Array.from(new Set(records.map(r => r.empresa))).sort();
    return ['Todos', ...all];
  }, [records]);

  // ── Formatação de valor ──────────────────────────────────────────────────
  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

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

          {/* Formulário de inserção */}
          <form onSubmit={handleSave} className="p-6 border-b border-slate-700/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Novo Lançamento
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
                  <option value="Mar Brasil">Mar Brasil (histórico)</option>
                  <option value="DZM">DZM (histórico)</option>
                </select>
              </div>

              {/* Período */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <CalendarDays size={11} /> Período *
                </label>
                <select
                  name="periodo"
                  value={form.periodo}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">— Selecione —</option>
                  {[...PERIODOS_DISPONIVEIS].reverse().map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
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

            {/* Botão salvar */}
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-lg transition-colors"
              >
                {isSaving
                  ? <><Loader2 size={14} className="animate-spin" /> Salvando...</>
                  : <><Plus size={14} /> Salvar Lançamento</>
                }
              </button>
            </div>
          </form>

          {/* ── Tabela de registros existentes ── */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Lançamentos Manuais Existentes
                {records.length > 0 && (
                  <span className="ml-2 bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {records.length}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {/* Filtro por empresa */}
                <select
                  value={filterEmpresa}
                  onChange={e => setFilterEmpresa(e.target.value)}
                  className="bg-slate-800 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {empresasNaTabela.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
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
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                Carregando...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                Nenhum lançamento manual encontrado.
                {records.length > 0 && filterEmpresa !== 'Todos' && (
                  <p className="text-xs mt-1">Tente selecionar outra empresa no filtro.</p>
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
                    {filteredRecords.map(rec => (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-800/50 transition-colors group"
                      >
                        <td className="px-3 py-2.5 text-white font-medium">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold
                            ${rec.empresa === 'Conectius'
                              ? 'bg-sky-500/15 text-sky-300'
                              : rec.empresa === 'Ybox'
                              ? 'bg-violet-500/15 text-violet-300'
                              : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {rec.empresa}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 font-mono">{rec.periodo}</td>
                        <td className="px-3 py-2.5 text-slate-300 max-w-[180px] truncate" title={rec.categoria}>
                          {rec.categoria}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 hidden sm:table-cell max-w-[140px] truncate" title={rec.departamento}>
                          {rec.departamento || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-400 font-mono">
                          {fmt(rec.valor)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
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
                        </td>
                      </tr>
                    ))}
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
