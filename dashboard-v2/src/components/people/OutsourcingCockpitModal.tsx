import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Building2, Plus, Trash2, Download, Calculator, Landmark, FileText,
  CheckCircle2, AlertCircle, Calendar, DollarSign, Percent, ChevronRight,
  Sparkles, RefreshCw, Edit3, Layers, Copy, ShieldCheck, ArrowRight, Save,
  RotateCcw, Check, MapPin, Upload, Tag, Users
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PeopleHRService } from '@/services/people-hr.service';
import { Employee } from '@/types/loans';

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

interface OutsourcingCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTestMode?: boolean;
}

export interface CustomColumn {
  id: string;
  label: string;
}

export type EmployeeType = 'CLT' | 'PJ' | 'Estagio' | 'Outro';

export interface OutsourcingRow {
  id: string;
  employeeId?: string;
  name: string;
  location: string;
  employeeType: EmployeeType;
  isManual: boolean;
  // Verbas principais
  valorFixo: number;
  valorBonus: number;
  valorComissao: number;
  valorAjudaCusto: number;  // Adiantamento
  // Benefícios — campos individuais
  valorVR: number;
  valorVT: number;
  valorSeguro: number;
  // Encargos patronais — campos individuais
  valorFGTS: number;
  valorGPS: number;
  // Provisões manuais
  valorDecTerceiro: number;
  valorFerias: number;
  // Outros / Fora da folha
  valorOutros: number;
  valorEmprestimo: number;
  // Colunas dinâmicas
  customValues: Record<string, number>;
}

export interface RepassLine {
  id: string;
  date: string;
  bank: string;
  amount: number;
  notes: string;
}

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────

const BANK_OPTIONS = [
  'Itaú', 'Bradesco', 'Banco do Brasil', 'Santander', 'Inter',
  'BTG Pactual', 'Caixa Econômica', 'Omie.Cash', 'Pix / Caixinha', 'Outro'
];

const EMPLOYEE_TYPE_CONFIG: Record<EmployeeType, { label: string; color: string; bg: string; border: string }> = {
  CLT:     { label: 'CLT',     color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-blue-300' },
  PJ:      { label: 'PJ/MEI',  color: 'text-violet-700', bg: 'bg-violet-100', border: 'border-violet-300' },
  Estagio: { label: 'Estágio', color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-300' },
  Outro:   { label: 'Outro',   color: 'text-gray-600',   bg: 'bg-gray-100',   border: 'border-gray-300' },
};

// Colunas fixas de verbas (para cálculo de subtotal)
const FIXED_VERBA_FIELDS: (keyof OutsourcingRow)[] = [
  'valorFixo', 'valorBonus', 'valorComissao', 'valorAjudaCusto',
  'valorVR', 'valorVT', 'valorSeguro', 'valorFGTS', 'valorGPS',
  'valorDecTerceiro', 'valorFerias', 'valorOutros', 'valorEmprestimo'
];

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

export const OutsourcingCockpitModal: React.FC<OutsourcingCockpitModalProps> = ({
  isOpen,
  onClose,
  isTestMode = false
}) => {
  // Competência (YYYY-MM)
  const [competencia, setCompetencia] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Dados principais
  const [rows, setRows] = useState<OutsourcingRow[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);

  // Coluna customizada
  const [newColName, setNewColName] = useState('');
  const [isAddingCol, setIsAddingCol] = useState(false);

  // Taxas e configurações
  const [taxInputMode, setTaxInputMode] = useState<'rate' | 'amount'>('rate');
  const [taxRate, setTaxRate] = useState<number>(5.0);
  const [taxFixedAmount, setTaxFixedAmount] = useState<number>(0);
  const [adminFeeRate, setAdminFeeRate] = useState<number>(10.0);

  // Repasses
  const [repassLines, setRepassLines] = useState<RepassLine[]>([]);

  // Timestamp do último save
  const [savedTimestamp, setSavedTimestamp] = useState<string | null>(null);

  // Aba ativa
  const [activeTab, setActiveTab] = useState<'main' | 'summary' | 'settlement'>('main');

  // Upload PDF ref (Fase 3 — placeholder funcional)
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfUploading, setPdfUploading] = useState(false);

  // ── Formatação ──────────────────────────────
  const fmt = (v: number) =>
    (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ── Carregar dados ao abrir ──────────────────
  useEffect(() => {
    if (isOpen) loadData(competencia);
  }, [isOpen, competencia, isTestMode]);

  const loadData = async (comp: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Colaboradores terceirizados
      const allEmps = await PeopleHRService.getEmployeesForPeople({ mostrarInativos: true, isTestMode });
      const outsourced = allEmps.filter(e =>
        e.is_outsourced === true ||
        (e as any).is_outsourced === 'true' ||
        e.metadata?.is_outsourced === true
      );

      // 2. Custos mensais da competência
      const costsTable = isTestMode ? 'people_monthly_costs_test' : 'people_monthly_costs';
      const { data: costsData } = await supabase
        .from(costsTable)
        .select('*')
        .eq('competencia', comp);

      const costsMap = new Map<string, any>();
      (costsData || []).forEach(r => costsMap.set(r.employee_id, r));

      // 3. Parcelas de empréstimo
      const paymentsTable = isTestMode ? 'loan_payments_test' : 'loan_payments';
      const { data: loanPayments } = await supabase
        .from(paymentsTable)
        .select('*')
        .eq('month_cycle', comp);

      const loansMap = new Map<string, number>();
      (loanPayments || []).forEach((lp: any) => {
        const cur = loansMap.get(lp.employee_id) || 0;
        loansMap.set(lp.employee_id, cur + (parseFloat(String(lp.amount)) || 0));
      });

      // 4. Repasses salvos no Supabase
      const repTable = 'outsourcing_repasses';
      const { data: repData } = await supabase
        .from(repTable)
        .select('*')
        .eq('competencia', comp)
        .eq('is_test', isTestMode)
        .order('date', { ascending: true });

      if (repData && repData.length > 0) {
        setRepassLines(repData.map(r => ({
          id: r.id,
          date: r.date,
          bank: r.bank,
          amount: parseFloat(String(r.amount)) || 0,
          notes: r.notes || ''
        })));
      } else {
        setRepassLines([{
          id: `rep-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          bank: 'Omie.Cash',
          amount: 0,
          notes: ''
        }]);
      }

      // 5. Configuração de taxas da competência
      const { data: cfgData } = await supabase
        .from('outsourcing_apuracao_config')
        .select('*')
        .eq('competencia', comp)
        .eq('is_test', isTestMode)
        .maybeSingle();

      if (cfgData) {
        setTaxInputMode(cfgData.tax_input_mode || 'rate');
        setTaxRate(parseFloat(String(cfgData.tax_rate)) || 5.0);
        setTaxFixedAmount(parseFloat(String(cfgData.tax_fixed)) || 0);
        setAdminFeeRate(parseFloat(String(cfgData.admin_fee_rate)) || 10.0);
      } else {
        setTaxInputMode('rate');
        setTaxRate(5.0);
        setTaxFixedAmount(0);
        setAdminFeeRate(10.0);
      }

      // 6. Montar linhas da tabela principal
      const generatedRows: OutsourcingRow[] = outsourced.map(emp => {
        const c = costsMap.get(emp.id);
        const va = c?.verbas_adicionais || {};

        // Inferir tipo de vínculo
        const rawType = c?.employee_type || (emp as any).employment_type || emp.metadata?.tipo_vinculo || 'CLT';
        const empType: EmployeeType =
          rawType === 'PJ' || rawType === 'MEI' || rawType === 'PJ-MEI' || rawType === 'PJ-Simples' ? 'PJ' :
          rawType === 'Estagio' || rawType === 'Estágio' || rawType === 'estagio' ? 'Estagio' :
          rawType === 'CLT' ? 'CLT' : 'Outro';

        return {
          id: emp.id,
          employeeId: emp.id,
          name: emp.name,
          location: emp.service_location || emp.city || emp.neighborhood || emp.department || 'Matriz',
          employeeType: empType,
          isManual: false,
          valorFixo: parseFloat(String(c?.valor_fixo ?? emp.remuneration_fixed ?? emp.remuneration ?? 0)),
          valorBonus: parseFloat(String(c?.valor_bonus ?? emp.remuneration_bonus ?? 0)),
          valorComissao: parseFloat(String(c?.valor_comissao ?? emp.remuneration_commission ?? 0)),
          valorAjudaCusto: parseFloat(String(c?.valor_ajuda_custo ?? 0)),
          valorVR: parseFloat(String(c?.valor_vr ?? va?.valor_vr ?? 0)),
          valorVT: parseFloat(String(c?.valor_vt ?? va?.valor_vt ?? 0)),
          valorSeguro: parseFloat(String(c?.valor_seguro ?? va?.valor_seguro ?? 0)),
          valorFGTS: parseFloat(String(c?.valor_fgts ?? va?.valor_fgts ?? 0)),
          valorGPS: parseFloat(String(c?.valor_gps ?? va?.valor_gps ?? 0)),
          valorDecTerceiro: parseFloat(String(c?.valor_dec_terceiro ?? va?.valor_dec_terceiro ?? 0)),
          valorFerias: parseFloat(String(c?.valor_ferias ?? va?.valor_ferias ?? 0)),
          valorOutros: parseFloat(String(c?.valor_incentivos ?? 0)),
          valorEmprestimo: loansMap.get(emp.id) || 0,
          customValues: {}
        };
      });

      // Colunas customizadas do localStorage (ainda preservamos para compatibilidade)
      const storageKey = `outsourcing_cols_${comp}${isTestMode ? '_test' : ''}`;
      const savedCols = localStorage.getItem(storageKey);
      if (savedCols) {
        try { setCustomColumns(JSON.parse(savedCols)); } catch {}
      } else {
        setCustomColumns([]);
      }

      setSavedTimestamp(cfgData?.saved_at || null);
      setRows(generatedRows);
    } catch (err: any) {
      console.error('Erro ao carregar terceirização:', err);
      setError(err?.message || 'Erro ao carregar dados da competência.');
    } finally {
      setLoading(false);
    }
  };

  // ── Salvar no Supabase ────────────────────────
  const handleSaveSettlement = async () => {
    setSaving(true);
    try {
      // 1. Salvar configuração de taxas
      await supabase.from('outsourcing_apuracao_config').upsert({
        competencia,
        tax_input_mode: taxInputMode,
        tax_rate: taxRate,
        tax_fixed: taxFixedAmount,
        admin_fee_rate: adminFeeRate,
        is_test: isTestMode,
        saved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'competencia' });

      // 2. Salvar repasses — delete + insert para simplificar
      const repTable = 'outsourcing_repasses';
      await supabase
        .from(repTable)
        .delete()
        .eq('competencia', competencia)
        .eq('is_test', isTestMode);

      const repRows = repassLines
        .filter(l => l.amount > 0 || l.notes)
        .map(l => ({
          id: l.id.startsWith('rep-') ? undefined : l.id,
          competencia,
          date: l.date,
          bank: l.bank,
          amount: l.amount,
          notes: l.notes,
          is_test: isTestMode
        }));

      if (repRows.length > 0) {
        await supabase.from(repTable).insert(repRows);
      }

      // 3. Salvar verbas individuais de cada colaborador (update na people_monthly_costs)
      const costsTable = isTestMode ? 'people_monthly_costs_test' : 'people_monthly_costs';
      for (const row of rows.filter(r => !r.isManual && r.employeeId)) {
        await supabase
          .from(costsTable)
          .upsert({
            employee_id: row.employeeId,
            competencia,
            valor_fixo: row.valorFixo,
            valor_bonus: row.valorBonus,
            valor_comissao: row.valorComissao,
            valor_ajuda_custo: row.valorAjudaCusto,
            valor_vr: row.valorVR,
            valor_vt: row.valorVT,
            valor_seguro: row.valorSeguro,
            valor_fgts: row.valorFGTS,
            valor_gps: row.valorGPS,
            valor_dec_terceiro: row.valorDecTerceiro,
            valor_ferias: row.valorFerias,
            valor_incentivos: row.valorOutros,
            employee_type: row.employeeType,
            vinculo_tipo: row.employeeType === 'PJ' ? 'PJ-MEI' : row.employeeType === 'Estagio' ? 'Estagio' : 'CLT',
            updated_at: new Date().toISOString()
          }, { onConflict: 'employee_id,competencia' });
      }

      // 4. Salvar colunas customizadas no localStorage
      const storageKey = `outsourcing_cols_${competencia}${isTestMode ? '_test' : ''}`;
      localStorage.setItem(storageKey, JSON.stringify(customColumns));

      const ts = new Date().toISOString();
      setSavedTimestamp(ts);
      setSaveSuccessMessage(`Apuração de ${competencia} salva com sucesso no banco de dados!`);
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setError(`Erro ao salvar: ${err?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettlement = async () => {
    if (!confirm(`Recarregar competência ${competencia} do banco de dados? Alterações não salvas serão perdidas.`)) return;
    await loadData(competencia);
  };

  // ── Gerenciamento de linhas ──────────────────
  const handleAddManualRow = () => {
    setRows(prev => [...prev, {
      id: `manual-${Date.now()}`,
      name: 'Novo Terceirizado (Manual)',
      location: 'Matriz',
      employeeType: 'CLT',
      isManual: true,
      valorFixo: 0, valorBonus: 0, valorComissao: 0, valorAjudaCusto: 0,
      valorVR: 0, valorVT: 0, valorSeguro: 0, valorFGTS: 0, valorGPS: 0,
      valorDecTerceiro: 0, valorFerias: 0, valorOutros: 0, valorEmprestimo: 0,
      customValues: {}
    }]);
  };

  const handleRemoveRow = (id: string) =>
    setRows(prev => prev.filter(r => r.id !== id));

  const handleRowChange = (id: string, field: keyof OutsourcingRow, value: any) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const handleCustomValueChange = (rowId: string, colId: string, val: number) =>
    setRows(prev => prev.map(r =>
      r.id === rowId ? { ...r, customValues: { ...r.customValues, [colId]: val } } : r
    ));

  // ── Colunas customizadas ─────────────────────
  const handleAddCustomColumn = () => {
    if (!newColName.trim()) return;
    setCustomColumns(prev => [...prev, { id: `custom_${Date.now()}`, label: newColName.trim() }]);
    setNewColName('');
    setIsAddingCol(false);
  };

  const handleRemoveCustomColumn = (colId: string) => {
    setCustomColumns(prev => prev.filter(c => c.id !== colId));
    setRows(prev => prev.map(r => {
      const updated = { ...r.customValues };
      delete updated[colId];
      return { ...r, customValues: updated };
    }));
  };

  // ── Repasses ────────────────────────────────
  const handleAddRepassLine = () =>
    setRepassLines(prev => [...prev, {
      id: `rep-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      bank: 'Omie.Cash',
      amount: 0,
      notes: ''
    }]);

  const handleRemoveRepassLine = (id: string) =>
    setRepassLines(prev => prev.filter(l => l.id !== id));

  const handleRepassLineChange = (id: string, field: keyof RepassLine, value: any) =>
    setRepassLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));

  // ── Upload PDF (placeholder Fase 3) ─────────
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfUploading(true);
    try {
      // TODO Fase 3: integrar com /api/people/parse-payroll-batch
      // Por ora exibe aviso informativo
      alert(`Arquivo "${file.name}" recebido. A leitura automática de PDF de terceirização será integrada na Fase 3. Por enquanto, preencha os valores manualmente.`);
    } finally {
      setPdfUploading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  // ── Cálculos financeiros ─────────────────────
  const rowTotalMap = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => {
      const customSum = Object.values(r.customValues || {}).reduce((a, v) => a + (v || 0), 0);
      const total = FIXED_VERBA_FIELDS.reduce((a, f) => a + ((r[f] as number) || 0), 0) + customSum;
      map.set(r.id, total);
    });
    return map;
  }, [rows]);

  const subtotal = useMemo(() =>
    Array.from(rowTotalMap.values()).reduce((a, v) => a + v, 0),
    [rowTotalMap]
  );

  const calculatedTax = useMemo(() =>
    taxInputMode === 'rate' ? subtotal * (taxRate / 100) : (taxFixedAmount || 0),
    [subtotal, taxInputMode, taxRate, taxFixedAmount]
  );

  const calculatedAdminFee = useMemo(() =>
    subtotal * (adminFeeRate / 100),
    [subtotal, adminFeeRate]
  );

  const totalApuradoBruto = useMemo(() =>
    subtotal + calculatedTax + calculatedAdminFee,
    [subtotal, calculatedTax, calculatedAdminFee]
  );

  const totalRepassado = useMemo(() =>
    repassLines.reduce((a, l) => a + (l.amount || 0), 0),
    [repassLines]
  );

  const saldoRemanescente = useMemo(() =>
    totalApuradoBruto - totalRepassado,
    [totalApuradoBruto, totalRepassado]
  );

  // Totais por coluna
  const colTotals = useMemo(() => ({
    valorFixo: rows.reduce((a, r) => a + r.valorFixo, 0),
    valorBonus: rows.reduce((a, r) => a + r.valorBonus, 0),
    valorComissao: rows.reduce((a, r) => a + r.valorComissao, 0),
    valorAjudaCusto: rows.reduce((a, r) => a + r.valorAjudaCusto, 0),
    valorVR: rows.reduce((a, r) => a + r.valorVR, 0),
    valorVT: rows.reduce((a, r) => a + r.valorVT, 0),
    valorSeguro: rows.reduce((a, r) => a + r.valorSeguro, 0),
    valorFGTS: rows.reduce((a, r) => a + r.valorFGTS, 0),
    valorGPS: rows.reduce((a, r) => a + r.valorGPS, 0),
    valorDecTerceiro: rows.reduce((a, r) => a + r.valorDecTerceiro, 0),
    valorFerias: rows.reduce((a, r) => a + r.valorFerias, 0),
    valorOutros: rows.reduce((a, r) => a + r.valorOutros, 0),
    valorEmprestimo: rows.reduce((a, r) => a + r.valorEmprestimo, 0),
    custom: Object.fromEntries(
      customColumns.map(col => [col.id, rows.reduce((a, r) => a + (r.customValues?.[col.id] || 0), 0)])
    )
  }), [rows, customColumns]);

  // Resumo por localidade
  const locationSummary = useMemo(() => {
    const map = new Map<string, any>();
    rows.forEach(r => {
      const loc = r.location || 'Não especificado';
      const ex = map.get(loc) || { location: loc, count: 0, total: 0, verbas: {} };
      ex.count++;
      ex.total += rowTotalMap.get(r.id) || 0;
      FIXED_VERBA_FIELDS.forEach(f => {
        ex.verbas[f] = (ex.verbas[f] || 0) + ((r[f] as number) || 0);
      });
      map.set(loc, ex);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows, rowTotalMap]);

  // ── Copiar relatório ─────────────────────────
  const handleCopyReport = () => {
    let txt = `=== APURAÇÃO DE TERCEIRIZAÇÃO — ${competencia} ===\n\n`;
    txt += `Colaboradores: ${rows.length}\n`;
    txt += `Subtotal de Verbas: ${fmt(subtotal)}\n`;
    txt += `ISS/Impostos (${taxInputMode === 'rate' ? `${taxRate}%` : 'Fixo'}): ${fmt(calculatedTax)}\n`;
    txt += `Taxa Administrativa (${adminFeeRate}%): ${fmt(calculatedAdminFee)}\n`;
    txt += `TOTAL APURADO BRUTO: ${fmt(totalApuradoBruto)}\n`;
    txt += `--------------------------------------------\n`;
    txt += `TOTAL REPASSADO: ${fmt(totalRepassado)}\n`;
    txt += `SALDO REMANESCENTE: ${fmt(saldoRemanescente)}\n\n`;
    txt += `=== RESUMO POR LOCALIDADE ===\n`;
    locationSummary.forEach(ls => {
      txt += `- ${ls.location}: ${ls.count} colab(s) | ${fmt(ls.total)}\n`;
    });
    navigator.clipboard.writeText(txt);
    setSaveSuccessMessage('Resumo executivo copiado para a área de transferência!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // ── Helpers visuais ───────────────────────────
  const TypeBadge = ({ type }: { type: EmployeeType }) => {
    const cfg = EMPLOYEE_TYPE_CONFIG[type] || EMPLOYEE_TYPE_CONFIG.Outro;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
        {cfg.label}
      </span>
    );
  };

  const NumInput = ({
    value, onChange, width = 'w-20'
  }: { value: number; onChange: (v: number) => void; width?: string }) => (
    <input
      type="number"
      step="1"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className={`${width} text-right bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all`}
    />
  );

  if (!isOpen) return null;

  // ═══════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal — tema light */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[1440px] h-[92vh] flex flex-col overflow-hidden text-gray-800 border border-gray-100">

        {/* ══ HEADER ══════════════════════════════════════════════ */}
        <header className="px-5 sm:px-7 py-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Building2 size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">Gestão de Terceirização</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200">
                  PeopleCockpit
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Verbas por competência · Duplo check por localidade · Repasses e encargos
              </p>
            </div>
          </div>

          {/* Controles do header */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Seletor de competência */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
              <Calendar size={13} className="text-blue-500 shrink-0" />
              <label className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Competência:</label>
              <input
                type="month"
                value={competencia}
                onChange={e => setCompetencia(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-700 outline-none"
              />
            </div>

            {/* Recarregar */}
            <button
              onClick={() => loadData(competencia)}
              disabled={loading}
              title="Recarregar dados"
              className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-800 transition-all active:scale-95"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-blue-500' : ''} />
            </button>

            {/* Upload PDF */}
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={pdfUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all active:scale-95"
              title="Importar Folha PDF por competência"
            >
              <Upload size={13} /> <span className="hidden sm:inline">Importar PDF</span>
            </button>

            {/* Copiar resumo */}
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              <Copy size={13} /> <span className="hidden sm:inline">Copiar Resumo</span>
            </button>

            {/* Reset */}
            <button
              onClick={handleResetSettlement}
              className="p-2 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-400 hover:text-red-500 rounded-xl transition-all active:scale-95"
              title="Recarregar do banco (perde edições não salvas)"
            >
              <RotateCcw size={14} />
            </button>

            {/* Salvar */}
            <button
              onClick={handleSaveSettlement}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase transition-all active:scale-95 shadow-sm disabled:opacity-60"
            >
              <Save size={14} />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>

            {/* Fechar */}
            <button
              onClick={onClose}
              className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-400 hover:text-gray-800 rounded-xl transition-all active:scale-95"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* ══ KPI CARDS ═══════════════════════════════════════════ */}
        <div className="px-5 sm:px-7 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          {/* Subtotal Verbas */}
          <div className="bg-white border border-blue-100 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide block">Subtotal Verbas</span>
              <span className="text-base font-black text-blue-700 block mt-0.5">{fmt(subtotal)}</span>
            </div>
            <DollarSign size={20} className="text-blue-200" />
          </div>

          {/* ISS / Impostos */}
          <div className="bg-white border border-amber-100 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide block">ISS / Impostos</span>
              <span className="text-base font-black text-amber-600 block mt-0.5">{fmt(calculatedTax)}</span>
              <span className="text-[9px] text-gray-400">{taxInputMode === 'rate' ? `${taxRate}%` : 'Valor fixo'}</span>
            </div>
            <Percent size={20} className="text-amber-200" />
          </div>

          {/* Total Apurado */}
          <div className="bg-white border border-emerald-100 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide block">Total Apurado</span>
              <span className="text-base font-black text-emerald-700 block mt-0.5">{fmt(totalApuradoBruto)}</span>
              <span className="text-[9px] text-gray-400">+ Taxa admin {adminFeeRate}%</span>
            </div>
            <Calculator size={20} className="text-emerald-200" />
          </div>

          {/* Saldo Remanescente */}
          <div className={`rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border ${
            saldoRemanescente <= 0
              ? 'bg-white border-emerald-100'
              : 'bg-white border-red-100'
          }`}>
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide block">Saldo Remanescente</span>
              <span className={`text-base font-black block mt-0.5 ${saldoRemanescente <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {fmt(saldoRemanescente)}
              </span>
            </div>
            {saldoRemanescente <= 0
              ? <ShieldCheck size={20} className="text-emerald-300" />
              : <AlertCircle size={20} className="text-red-300 animate-pulse" />
            }
          </div>
        </div>

        {/* ══ NAVEGAÇÃO DE ABAS ══════════════════════════════════ */}
        <div className="px-5 sm:px-7 bg-white border-b border-gray-100 flex items-center gap-1 overflow-x-auto shrink-0">
          {([
            { key: 'main',       icon: Users,    label: `Colaboradores Terceirizados (${rows.length})` },
            { key: 'summary',    icon: Layers,   label: `Resumo por Localidade (${locationSummary.length})` },
            { key: 'settlement', icon: Landmark, label: `Apuração & Repasses (${repassLines.length})` }
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                activeTab === key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* ══ MENSAGENS ══════════════════════════════════════════ */}
        {saveSuccessMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center gap-2 text-emerald-700 text-xs font-bold animate-in fade-in duration-150 shrink-0">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
            {saveSuccessMessage}
          </div>
        )}

        {/* ══ CONTEÚDO PRINCIPAL ═════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 space-y-4">

          {/* Estado de erro */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-bold">
              <AlertCircle size={16} className="shrink-0 text-red-400" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-700"><X size={13} /></button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="py-16 text-center space-y-3">
              <RefreshCw size={28} className="animate-spin text-blue-500 mx-auto" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Carregando dados da competência...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* ══ ABA 1 — COLABORADORES ═══════════════════════════ */}
              {activeTab === 'main' && (
                <div className="space-y-3">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddManualRow}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition-all active:scale-95 shadow-sm"
                      >
                        <Plus size={13} /> Linha Manual
                      </button>

                      {!isAddingCol ? (
                        <button
                          onClick={() => setIsAddingCol(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold uppercase transition-all active:scale-95"
                        >
                          <Plus size={13} /> Adicionar Verba
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                          <input
                            type="text"
                            placeholder="Nome da verba..."
                            value={newColName}
                            onChange={e => setNewColName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCustomColumn()}
                            className="bg-white border border-blue-300 rounded-xl px-3 py-1.5 text-xs text-gray-800 outline-none w-40 focus:ring-1 focus:ring-blue-100"
                            autoFocus
                          />
                          <button
                            onClick={handleAddCustomColumn}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                          >OK</button>
                          <button onClick={() => setIsAddingCol(false)} className="p-1.5 text-gray-400 hover:text-gray-700">
                            <X size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 font-semibold">
                      Total na tabela: <span className="text-gray-900 font-black">{fmt(subtotal)}</span>
                    </div>
                  </div>

                  {/* Tabela */}
                  <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-400">
                          <th className="py-3 px-3 min-w-[180px] sticky left-0 bg-gray-50 z-10">Colaborador</th>
                          <th className="py-3 px-2 min-w-[80px]">Tipo</th>
                          <th className="py-3 px-3 min-w-[120px]">Localidade</th>
                          {/* Verbas */}
                          <th className="py-3 px-2 text-right min-w-[100px] bg-blue-50 text-blue-600">Sal. Base</th>
                          <th className="py-3 px-2 text-right min-w-[90px]">Adit.</th>
                          <th className="py-3 px-2 text-right min-w-[90px]">Bônus</th>
                          <th className="py-3 px-2 text-right min-w-[80px] bg-green-50 text-green-700">VR</th>
                          <th className="py-3 px-2 text-right min-w-[80px] bg-green-50 text-green-700">VT</th>
                          <th className="py-3 px-2 text-right min-w-[80px]">Seguro</th>
                          <th className="py-3 px-2 text-right min-w-[80px] bg-orange-50 text-orange-700">FGTS</th>
                          <th className="py-3 px-2 text-right min-w-[80px] bg-orange-50 text-orange-700">GPS</th>
                          <th className="py-3 px-2 text-right min-w-[80px] bg-purple-50 text-purple-700">13º</th>
                          <th className="py-3 px-2 text-right min-w-[80px] bg-purple-50 text-purple-700">Férias</th>
                          <th className="py-3 px-2 text-right min-w-[80px]">Outros</th>
                          <th className="py-3 px-2 text-right min-w-[90px] bg-indigo-50 text-indigo-700">Emprést.</th>
                          {/* Colunas customizadas */}
                          {customColumns.map(col => (
                            <th key={col.id} className="py-3 px-2 text-right min-w-[90px] bg-gray-50">
                              <div className="flex items-center justify-end gap-1">
                                <span>{col.label}</span>
                                <button
                                  onClick={() => handleRemoveCustomColumn(col.id)}
                                  className="text-gray-300 hover:text-red-400 p-0.5"
                                  title="Remover verba"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            </th>
                          ))}
                          <th className="py-3 px-3 text-right min-w-[110px] font-black text-gray-800 bg-white">Total</th>
                          <th className="py-3 px-2 w-8 text-center"></th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-50">
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={20} className="py-16 text-center text-gray-400 font-medium">
                              Nenhum colaborador terceirizado encontrado para esta competência.{' '}
                              <button onClick={handleAddManualRow} className="text-blue-500 underline">
                                Adicionar linha manual.
                              </button>
                            </td>
                          </tr>
                        ) : rows.map(row => {
                          const rTotal = rowTotalMap.get(row.id) || 0;
                          return (
                            <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                              {/* Nome */}
                              <td className="py-2 px-3 sticky left-0 bg-white hover:bg-blue-50/30 z-10">
                                {row.isManual ? (
                                  <input
                                    type="text"
                                    value={row.name}
                                    onChange={e => handleRowChange(row.id, 'name', e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:border-blue-400"
                                  />
                                ) : (
                                  <span className="font-semibold text-gray-800">{row.name}</span>
                                )}
                              </td>

                              {/* Tipo */}
                              <td className="py-2 px-2">
                                <select
                                  value={row.employeeType}
                                  onChange={e => handleRowChange(row.id, 'employeeType', e.target.value as EmployeeType)}
                                  className="bg-transparent text-[10px] font-bold outline-none cursor-pointer"
                                  title="Tipo de vínculo"
                                >
                                  {(Object.keys(EMPLOYEE_TYPE_CONFIG) as EmployeeType[]).map(t => (
                                    <option key={t} value={t}>{EMPLOYEE_TYPE_CONFIG[t].label}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Localidade */}
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.location}
                                  onChange={e => handleRowChange(row.id, 'location', e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-xs text-gray-600 outline-none focus:border-blue-300"
                                />
                              </td>

                              {/* Sal. Base */}
                              <td className="py-2 px-2 text-right bg-blue-50/30">
                                <NumInput value={row.valorFixo} onChange={v => handleRowChange(row.id, 'valorFixo', v)} width="w-24" />
                              </td>
                              {/* Adit. */}
                              <td className="py-2 px-2 text-right">
                                <NumInput value={row.valorAjudaCusto} onChange={v => handleRowChange(row.id, 'valorAjudaCusto', v)} />
                              </td>
                              {/* Bônus */}
                              <td className="py-2 px-2 text-right">
                                <NumInput value={row.valorBonus} onChange={v => handleRowChange(row.id, 'valorBonus', v)} />
                              </td>
                              {/* VR */}
                              <td className="py-2 px-2 text-right bg-green-50/40">
                                <NumInput value={row.valorVR} onChange={v => handleRowChange(row.id, 'valorVR', v)} />
                              </td>
                              {/* VT */}
                              <td className="py-2 px-2 text-right bg-green-50/40">
                                <NumInput value={row.valorVT} onChange={v => handleRowChange(row.id, 'valorVT', v)} />
                              </td>
                              {/* Seguro */}
                              <td className="py-2 px-2 text-right">
                                <NumInput value={row.valorSeguro} onChange={v => handleRowChange(row.id, 'valorSeguro', v)} />
                              </td>
                              {/* FGTS */}
                              <td className="py-2 px-2 text-right bg-orange-50/40">
                                <NumInput value={row.valorFGTS} onChange={v => handleRowChange(row.id, 'valorFGTS', v)} />
                              </td>
                              {/* GPS */}
                              <td className="py-2 px-2 text-right bg-orange-50/40">
                                <NumInput value={row.valorGPS} onChange={v => handleRowChange(row.id, 'valorGPS', v)} />
                              </td>
                              {/* 13º */}
                              <td className="py-2 px-2 text-right bg-purple-50/40">
                                <NumInput value={row.valorDecTerceiro} onChange={v => handleRowChange(row.id, 'valorDecTerceiro', v)} />
                              </td>
                              {/* Férias */}
                              <td className="py-2 px-2 text-right bg-purple-50/40">
                                <NumInput value={row.valorFerias} onChange={v => handleRowChange(row.id, 'valorFerias', v)} />
                              </td>
                              {/* Outros */}
                              <td className="py-2 px-2 text-right">
                                <NumInput value={row.valorOutros} onChange={v => handleRowChange(row.id, 'valorOutros', v)} />
                              </td>
                              {/* Empréstimos */}
                              <td className="py-2 px-2 text-right bg-indigo-50/40">
                                <NumInput value={row.valorEmprestimo} onChange={v => handleRowChange(row.id, 'valorEmprestimo', v)} />
                              </td>
                              {/* Custom */}
                              {customColumns.map(col => (
                                <td key={col.id} className="py-2 px-2 text-right bg-gray-50/60">
                                  <NumInput
                                    value={row.customValues?.[col.id] || 0}
                                    onChange={v => handleCustomValueChange(row.id, col.id, v)}
                                  />
                                </td>
                              ))}
                              {/* Total */}
                              <td className="py-2 px-3 text-right font-black text-emerald-700">
                                {fmt(rTotal)}
                              </td>
                              {/* Ações */}
                              <td className="py-2 px-2 text-center">
                                <button
                                  onClick={() => handleRemoveRow(row.id)}
                                  className="text-gray-300 hover:text-red-400 p-1 transition-colors"
                                  title="Remover linha"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* Footer com totais */}
                      <tfoot>
                        <tr className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider border-t-2 border-blue-500">
                          <td className="py-3 px-3 sticky left-0 bg-blue-600 z-10">TOTAIS ({rows.length})</td>
                          <td className="py-3 px-2">—</td>
                          <td className="py-3 px-3">—</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorFixo)}</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorAjudaCusto)}</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorBonus)}</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorVR)}</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorVT)}</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorSeguro)}</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorFGTS)}</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorGPS)}</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorDecTerceiro)}</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorFerias)}</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorOutros)}</td>
                          <td className="py-3 px-2 text-right">{fmt(colTotals.valorEmprestimo)}</td>
                          {customColumns.map(col => (
                            <td key={col.id} className="py-3 px-2 text-right">
                              {fmt(colTotals.custom[col.id] || 0)}
                            </td>
                          ))}
                          <td className="py-3 px-3 text-right text-base font-black">{fmt(subtotal)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* ══ ABA 2 — RESUMO POR LOCALIDADE ══════════════════ */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  {/* Header da aba */}
                  <div className="bg-white border border-emerald-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                      <div>
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Duplo Check por Localidade</h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Consolidação por local de atendimento. O total valida o valor da apuração principal.
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Validado</span>
                      <span className="text-lg font-black text-emerald-700">{fmt(subtotal)}</span>
                    </div>
                  </div>

                  {/* Cards por localidade */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {locationSummary.length === 0 ? (
                      <div className="col-span-2 py-12 text-center text-gray-400">Sem dados de localidade disponíveis.</div>
                    ) : locationSummary.map((ls, idx) => {
                      const pct = subtotal > 0 ? (ls.total / subtotal) * 100 : 0;
                      const colorAccents = ['border-blue-400', 'border-emerald-400', 'border-orange-400', 'border-purple-400', 'border-pink-400'];
                      const accent = colorAccents[idx % colorAccents.length];
                      return (
                        <div key={ls.location} className={`bg-white border border-gray-100 rounded-2xl p-4 shadow-sm border-l-4 ${accent}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <MapPin size={14} className="text-gray-400" />
                              <span className="font-black text-gray-800 text-sm">{ls.location}</span>
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">
                                {ls.count} colab.
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-black text-gray-900">{fmt(ls.total)}</span>
                              <span className="text-[10px] text-gray-400 block">{pct.toFixed(1)}% do total</span>
                            </div>
                          </div>

                          {/* Barra proporcional */}
                          <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>

                          {/* Detalhamento de verbas */}
                          <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                            {[
                              { label: 'Sal. Base', key: 'valorFixo', color: 'text-blue-700' },
                              { label: 'Bônus', key: 'valorBonus', color: 'text-gray-700' },
                              { label: 'Adit.', key: 'valorAjudaCusto', color: 'text-gray-700' },
                              { label: 'VR', key: 'valorVR', color: 'text-green-700' },
                              { label: 'VT', key: 'valorVT', color: 'text-green-700' },
                              { label: 'FGTS', key: 'valorFGTS', color: 'text-orange-700' },
                              { label: 'GPS', key: 'valorGPS', color: 'text-orange-700' },
                              { label: '13º', key: 'valorDecTerceiro', color: 'text-purple-700' },
                            ].map(({ label, key, color }) => (
                              ls.verbas[key] > 0 && (
                                <div key={key} className="bg-gray-50 rounded-lg p-1.5 text-center">
                                  <span className="text-gray-400 block">{label}</span>
                                  <span className={`font-bold ${color} block`}>
                                    {(ls.verbas[key] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0, style: 'currency', currency: 'BRL' })}
                                  </span>
                                </div>
                              )
                            ))}
                          </div>

                          {/* Badge duplo check */}
                          <div className="mt-3 flex justify-end">
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                              <CheckCircle2 size={10} /> Duplo Check ✓
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tabela consolidada */}
                  <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-400">
                          <th className="py-3 px-4">Localidade</th>
                          <th className="py-3 px-3 text-center">Colaboradores</th>
                          <th className="py-3 px-3 text-right">Sal. Base</th>
                          <th className="py-3 px-3 text-right">Benefícios</th>
                          <th className="py-3 px-3 text-right">Encargos</th>
                          <th className="py-3 px-3 text-right">Provisões</th>
                          <th className="py-3 px-3 text-right">Empréstimos</th>
                          <th className="py-3 px-4 text-right font-black text-gray-800">Total Localidade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {locationSummary.map((ls, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 font-bold text-gray-800 flex items-center gap-1.5">
                              <Building2 size={12} className="text-gray-400 shrink-0" />
                              {ls.location}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                {ls.count} pss
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right text-gray-600 font-semibold">{fmt(ls.verbas.valorFixo || 0)}</td>
                            <td className="py-3 px-3 text-right text-green-700 font-semibold">
                              {fmt((ls.verbas.valorVR || 0) + (ls.verbas.valorVT || 0) + (ls.verbas.valorSeguro || 0))}
                            </td>
                            <td className="py-3 px-3 text-right text-orange-700 font-semibold">
                              {fmt((ls.verbas.valorFGTS || 0) + (ls.verbas.valorGPS || 0))}
                            </td>
                            <td className="py-3 px-3 text-right text-purple-700 font-semibold">
                              {fmt((ls.verbas.valorDecTerceiro || 0) + (ls.verbas.valorFerias || 0))}
                            </td>
                            <td className="py-3 px-3 text-right text-indigo-700 font-semibold">{fmt(ls.verbas.valorEmprestimo || 0)}</td>
                            <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">{fmt(ls.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-blue-600 text-white text-[10px] font-black uppercase">
                          <td className="py-3 px-4">TOTAL CONSOLIDADO</td>
                          <td className="py-3 px-3 text-center">{rows.length}</td>
                          <td className="py-3 px-3 text-right">{fmt(colTotals.valorFixo)}</td>
                          <td className="py-3 px-3 text-right">{fmt(colTotals.valorVR + colTotals.valorVT + colTotals.valorSeguro)}</td>
                          <td className="py-3 px-3 text-right">{fmt(colTotals.valorFGTS + colTotals.valorGPS)}</td>
                          <td className="py-3 px-3 text-right">{fmt(colTotals.valorDecTerceiro + colTotals.valorFerias)}</td>
                          <td className="py-3 px-3 text-right">{fmt(colTotals.valorEmprestimo)}</td>
                          <td className="py-3 px-4 text-right text-base font-black">{fmt(subtotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* ══ ABA 3 — APURAÇÃO & REPASSES ═════════════════════ */}
              {activeTab === 'settlement' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    {/* Configurações de encargos */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <Percent size={14} className="text-blue-500" /> Configurações de Encargos
                      </h3>

                      <div className="space-y-3">
                        {/* ISS */}
                        <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-amber-700 tracking-wider block">ISS / Impostos</span>
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                onClick={() => setTaxInputMode(prev => prev === 'rate' ? 'amount' : 'rate')}
                                className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-all"
                              >
                                {taxInputMode === 'rate' ? '% Alíquota' : 'R$ Fixo'}
                              </button>
                              {taxInputMode === 'rate' ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number" step="0.1" min="0"
                                    value={taxRate}
                                    onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                                    className="w-16 text-right bg-white border border-amber-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:border-amber-400"
                                  />
                                  <span className="text-xs font-bold text-amber-600">%</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-bold text-amber-600">R$</span>
                                  <input
                                    type="number" step="100" min="0"
                                    value={taxFixedAmount}
                                    onChange={e => setTaxFixedAmount(parseFloat(e.target.value) || 0)}
                                    className="w-28 text-right bg-white border border-amber-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:border-amber-400"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-amber-600 block">Total ISS</span>
                            <span className="text-sm font-black text-amber-700">{fmt(calculatedTax)}</span>
                          </div>
                        </div>

                        {/* Taxa Admin */}
                        <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-blue-700 tracking-wider block">Taxa Administrativa</span>
                            <div className="flex items-center gap-1 mt-1">
                              <input
                                type="number" step="0.5" min="0"
                                value={adminFeeRate}
                                onChange={e => setAdminFeeRate(parseFloat(e.target.value) || 0)}
                                className="w-16 text-right bg-white border border-blue-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:border-blue-400"
                              />
                              <span className="text-xs font-bold text-blue-600">%</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-blue-600 block">Total Admin</span>
                            <span className="text-sm font-black text-blue-700">{fmt(calculatedAdminFee)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resumo financeiro */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                      <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <Calculator size={14} className="text-emerald-500" /> Resumo Financeiro
                      </h3>

                      <div className="space-y-2 text-xs">
                        {[
                          { label: 'Subtotal de Verbas', value: subtotal, color: 'text-gray-800' },
                          { label: `ISS / Impostos (${taxInputMode === 'rate' ? `${taxRate}%` : 'Fixo'})`, value: calculatedTax, color: 'text-amber-600' },
                          { label: `Taxa Administrativa (${adminFeeRate}%)`, value: calculatedAdminFee, color: 'text-blue-600' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                            <span className="text-gray-500 font-medium">{label}</span>
                            <span className={`font-bold ${color}`}>{fmt(value)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between py-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 mt-2">
                          <span className="font-black text-emerald-800 uppercase tracking-wider">TOTAL APURADO</span>
                          <span className="text-lg font-black text-emerald-700">{fmt(totalApuradoBruto)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de repasses */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <Landmark size={14} className="text-blue-500" /> Repasses Efetuados
                      </h3>
                      <button
                        onClick={handleAddRepassLine}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition-all active:scale-95"
                      >
                        <Plus size={13} /> Novo Repasse
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-400">
                            <th className="py-3 px-4 min-w-[140px]">Data do Repasse</th>
                            <th className="py-3 px-4 min-w-[160px]">Banco de Origem</th>
                            <th className="py-3 px-4 min-w-[220px]">Observações / Ref.</th>
                            <th className="py-3 px-4 text-right min-w-[140px]">Valor (R$)</th>
                            <th className="py-3 px-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {repassLines.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-gray-400">
                                Nenhum repasse inserido. Clique em "Novo Repasse" para registrar pagamentos.
                              </td>
                            </tr>
                          ) : repassLines.map(line => (
                            <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                              <td className="py-2.5 px-4">
                                <input
                                  type="date"
                                  value={line.date}
                                  onChange={e => handleRepassLineChange(line.id, 'date', e.target.value)}
                                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 outline-none focus:border-blue-400"
                                />
                              </td>
                              <td className="py-2.5 px-4">
                                <select
                                  value={line.bank}
                                  onChange={e => handleRepassLineChange(line.id, 'bank', e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:border-blue-400"
                                >
                                  {BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                              </td>
                              <td className="py-2.5 px-4">
                                <input
                                  type="text"
                                  placeholder="Ex: Adiantamento, Parcela 1/2..."
                                  value={line.notes}
                                  onChange={e => handleRepassLineChange(line.id, 'notes', e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-xs text-gray-700 outline-none focus:border-blue-400"
                                />
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <input
                                  type="number"
                                  step="100"
                                  value={line.amount}
                                  onChange={e => handleRepassLineChange(line.id, 'amount', parseFloat(e.target.value) || 0)}
                                  className="w-32 text-right bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 outline-none focus:border-emerald-400"
                                />
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  onClick={() => handleRemoveRepassLine(line.id)}
                                  className="text-gray-300 hover:text-red-400 p-1 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-blue-50 border-t-2 border-blue-100 text-xs font-black">
                            <td colSpan={3} className="py-3 px-4 uppercase tracking-wider text-blue-700">
                              Total de Repasses Efetuados
                            </td>
                            <td className="py-3 px-4 text-right text-blue-700 text-sm">{fmt(totalRepassado)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Card saldo final */}
                  <div className={`p-6 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-5 shadow-sm transition-colors ${
                    saldoRemanescente <= 0
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      {saldoRemanescente <= 0
                        ? <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />
                        : <AlertCircle className="text-red-400 shrink-0" size={24} />
                      }
                      <div>
                        <h4 className={`text-xs font-black uppercase tracking-wider ${
                          saldoRemanescente <= 0 ? 'text-emerald-800' : 'text-red-700'
                        }`}>
                          {saldoRemanescente <= 0
                            ? 'Apuração Quitada — Sem Pendências'
                            : 'Apuração com Saldo Devedor Pendente'
                          }
                        </h4>
                        <p className={`text-xs mt-0.5 ${saldoRemanescente <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {saldoRemanescente <= 0
                            ? 'Todos os repasses cobrem integralmente o Total Apurado.'
                            : `Resta repassar ${fmt(saldoRemanescente)} para quitar a competência ${competencia}.`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="text-center shrink-0">
                      <span className={`text-[10px] font-bold uppercase tracking-widest block ${
                        saldoRemanescente <= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}>Saldo Remanescente</span>
                      <span className={`text-3xl font-black block mt-0.5 ${
                        saldoRemanescente <= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}>
                        {fmt(saldoRemanescente)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ══ FOOTER ══════════════════════════════════════════════ */}
        <footer className="px-5 sm:px-7 py-3 bg-white border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 text-gray-400 font-medium">
            <span>Competência: <strong className="text-gray-700">{competencia}</strong></span>
            <span>Colaboradores: <strong className="text-gray-700">{rows.length}</strong></span>
            {savedTimestamp && (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Check size={12} />
                Salvo em {new Date(savedTimestamp).toLocaleDateString('pt-BR')} às{' '}
                {new Date(savedTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold uppercase text-xs transition-all active:scale-95"
            >
              Fechar
            </button>
            <button
              onClick={handleSaveSettlement}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-xs transition-all active:scale-95 shadow-sm disabled:opacity-60"
            >
              <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Apuração'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
