import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Building2, Plus, Trash2, Download, Calculator, Landmark, FileText, 
  CheckCircle2, AlertCircle, Calendar, DollarSign, Percent, ChevronRight, 
  Sparkles, RefreshCw, Edit3, Layers, Copy, ShieldCheck, ArrowRight, Save, RotateCcw, Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PeopleHRService } from '@/services/people-hr.service';
import { Employee } from '@/types/loans';

interface OutsourcingCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTestMode?: boolean;
}

export interface CustomColumn {
  id: string;
  label: string;
}

export interface OutsourcingRow {
  id: string;
  employeeId?: string;
  name: string;
  location: string;
  isManual: boolean;
  valorFixo: number;
  valorBonus: number;
  valorComissao: number;
  valorAjudaCusto: number;
  valorOutros: number;
  valorEmprestimo: number; // Fora do custo histórico / folha
  customValues: Record<string, number>;
}

export interface RepassLine {
  id: string;
  date: string;
  bank: string;
  amount: number;
  notes: string;
}

const BANK_OPTIONS = [
  'Itaú',
  'Bradesco',
  'Banco do Brasil',
  'Santander',
  'Inter',
  'BTG Pactual',
  'Caixa Econômica',
  'Pix / Caixinha',
  'Outro Banco'
];

export const OutsourcingCockpitModal: React.FC<OutsourcingCockpitModalProps> = ({
  isOpen,
  onClose,
  isTestMode = false
}) => {
  // ── Competência Selector State (Default: Mês atual YYYY-MM) ──
  const [competencia, setCompetencia] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Data states ──
  const [rows, setRows] = useState<OutsourcingRow[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);

  // ── Dynamic Custom Column Modal/Input ──
  const [newColName, setNewColName] = useState('');
  const [isAddingCol, setIsAddingCol] = useState(false);

  // ── Tax & Admin Fee States ──
  const [taxInputMode, setTaxInputMode] = useState<'rate' | 'amount'>('rate');
  const [taxRate, setTaxRate] = useState<number>(5.0); // Default 5%
  const [taxFixedAmount, setTaxFixedAmount] = useState<number>(0);
  const [adminFeeRate, setAdminFeeRate] = useState<number>(10.0); // Default 10%

  // ── Repasses Efetuados States ──
  const [repassLines, setRepassLines] = useState<RepassLine[]>([
    {
      id: 'rep-1',
      date: new Date().toISOString().split('T')[0],
      bank: 'Itaú',
      amount: 0,
      notes: 'Adiantamento inicial'
    }
  ]);

  // ── Persistence & Status States ──
  const [savedTimestamp, setSavedTimestamp] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // ── Active tab view (Mobile & Executive view) ──
  const [activeTab, setActiveTab] = useState<'main' | 'summary' | 'settlement'>('main');

  // Format currency helper
  const formatMoney = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // ── Fetch & load data when modal opens or competence changes ──
  useEffect(() => {
    if (isOpen) {
      loadDataForCompetencia(competencia);
    }
  }, [isOpen, competencia, isTestMode]);

  const loadDataForCompetencia = async (comp: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch employees
      const allEmps = await PeopleHRService.getEmployeesForPeople({ mostrarInativos: true, isTestMode });
      
      // Filter strictly outsourced employees (Faz parte de Terceirização = 'Sim' / is_outsourced === true)
      const outsourcedEmps = allEmps.filter(e => {
        const isOut = e.is_outsourced === true || 
                      (e as any).is_outsourced === 'true' || 
                      e.metadata?.is_outsourced === true || 
                      e.metadata?.is_outsourced === 'true';
        return Boolean(isOut);
      });

      // 2. Fetch monthly costs for selected competence
      const costsTable = isTestMode ? 'people_monthly_costs_test' : 'people_monthly_costs';
      const { data: costsData, error: costsErr } = await supabase
        .from(costsTable)
        .select('*')
        .eq('competencia', comp);

      if (costsErr && costsErr.code !== '42P01') {
        console.warn('Aviso ao buscar custos mensais:', costsErr);
      }

      const costsMap = new Map<string, any>();
      (costsData || []).forEach(row => {
        costsMap.set(row.employee_id, row);
      });

      // 3. Fetch loan payments for selected competence (outside cost history)
      const paymentsTable = isTestMode ? 'loan_payments_test' : 'loan_payments';
      const { data: loanPayments, error: loanErr } = await supabase
        .from(paymentsTable)
        .select('*')
        .eq('month_cycle', comp);

      if (loanErr && loanErr.code !== '42P01') {
        console.warn('Aviso ao buscar parcelas de empréstimo:', loanErr);
      }

      const loansMap = new Map<string, number>();
      (loanPayments || []).forEach((lp: any) => {
        const current = loansMap.get(lp.employee_id) || 0;
        loansMap.set(lp.employee_id, current + (parseFloat(String(lp.amount)) || 0));
      });

      // Combine into table rows
      const generatedRows: OutsourcingRow[] = outsourcedEmps.map(emp => {
        const costRow = costsMap.get(emp.id);
        const loanVal = loansMap.get(emp.id) || 0;

        const valorFixo = costRow?.valor_fixo !== undefined && costRow?.valor_fixo !== null
          ? parseFloat(String(costRow.valor_fixo))
          : (costRow?.valor_liquido !== undefined 
              ? parseFloat(String(costRow.valor_liquido)) 
              : (emp.remuneration_fixed || emp.remuneration || 0));

        const valorBonus = costRow?.valor_bonus ? parseFloat(String(costRow.valor_bonus)) : (emp.remuneration_bonus || 0);
        const valorComissao = costRow?.valor_comissao ? parseFloat(String(costRow.valor_comissao)) : (emp.remuneration_commission || 0);
        const valorAjudaCusto = costRow?.valor_ajuda_custo ? parseFloat(String(costRow.valor_ajuda_custo)) : (emp.remuneration_connectivity || 0);
        const valorOutros = costRow?.valor_incentivos ? parseFloat(String(costRow.valor_incentivos)) : (emp.remuneration_incentives || 0);

        const location = emp.service_location || emp.city || emp.neighborhood || emp.department || 'Matriz Executiva';

        return {
          id: emp.id,
          employeeId: emp.id,
          name: emp.name,
          location,
          isManual: false,
          valorFixo,
          valorBonus,
          valorComissao,
          valorAjudaCusto,
          valorOutros,
          valorEmprestimo: loanVal,
          customValues: {}
        };
      });

      // 4. Check for saved settlement state for this competence in local persistence
      const storageKey = `outsourcing_settlement_${comp}${isTestMode ? '_test' : ''}`;
      const savedRaw = localStorage.getItem(storageKey);
      
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw);
          if (saved.customColumns && Array.isArray(saved.customColumns)) {
            setCustomColumns(saved.customColumns);
          }
          if (saved.taxInputMode) setTaxInputMode(saved.taxInputMode);
          if (saved.taxRate !== undefined) setTaxRate(saved.taxRate);
          if (saved.taxFixedAmount !== undefined) setTaxFixedAmount(saved.taxFixedAmount);
          if (saved.adminFeeRate !== undefined) setAdminFeeRate(saved.adminFeeRate);
          if (saved.repassLines && Array.isArray(saved.repassLines)) setRepassLines(saved.repassLines);
          
          if (saved.rows && Array.isArray(saved.rows) && saved.rows.length > 0) {
            // Filtrar linhas salvas para manter apenas as manuais ou colaboradores que continuam com is_outsourced === true
            const validEmpIds = new Set(outsourcedEmps.map(e => e.id));
            const filteredSavedRows = saved.rows.filter((r: OutsourcingRow) => r.isManual || (r.employeeId && validEmpIds.has(r.employeeId)));
            setRows(filteredSavedRows.length > 0 ? filteredSavedRows : generatedRows);
          } else {
            setRows(generatedRows);
          }
          setSavedTimestamp(saved.savedAt || null);
        } catch (e) {
          console.warn('Erro ao restaurar apuração salva:', e);
          setRows(generatedRows);
          setSavedTimestamp(null);
        }
      } else {
        setRows(generatedRows);
        setCustomColumns([]);
        setTaxInputMode('rate');
        setTaxRate(5.0);
        setTaxFixedAmount(0);
        setAdminFeeRate(10.0);
        setRepassLines([
          {
            id: 'rep-1',
            date: new Date().toISOString().split('T')[0],
            bank: 'Itaú',
            amount: 0,
            notes: 'Adiantamento inicial'
          }
        ]);
        setSavedTimestamp(null);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados de terceirização:', err);
      setError(err?.message || 'Falha ao carregar dados da competência.');
    } finally {
      setLoading(false);
    }
  };

  // ── Save & Reset Handlers ──
  const handleSaveSettlement = () => {
    const storageKey = `outsourcing_settlement_${competencia}${isTestMode ? '_test' : ''}`;
    const payload = {
      competencia,
      customColumns,
      rows,
      taxInputMode,
      taxRate,
      taxFixedAmount,
      adminFeeRate,
      repassLines,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
    setSavedTimestamp(payload.savedAt);
    setSaveSuccessMessage(`Apuração da competência ${competencia} salva com sucesso!`);
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  const handleResetSettlement = () => {
    if (confirm(`Deseja restaurar a competência ${competencia} para o estado original do banco de dados? Isso removerá ajustes manuais salvos.`)) {
      const storageKey = `outsourcing_settlement_${competencia}${isTestMode ? '_test' : ''}`;
      localStorage.removeItem(storageKey);
      loadDataForCompetencia(competencia);
    }
  };

  // ── Row Management Helpers ──
  const handleAddManualRow = () => {
    const newRow: OutsourcingRow = {
      id: `manual-${Date.now()}`,
      name: 'Novo Terceirizado (Manual)',
      location: 'Matriz',
      isManual: true,
      valorFixo: 0,
      valorBonus: 0,
      valorComissao: 0,
      valorAjudaCusto: 0,
      valorOutros: 0,
      valorEmprestimo: 0,
      customValues: {}
    };
    setRows(prev => [...prev, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleRowChange = (id: string, field: keyof OutsourcingRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const handleCustomValueChange = (rowId: string, colId: string, val: number) => {
    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          customValues: {
            ...r.customValues,
            [colId]: val
          }
        };
      }
      return r;
    }));
  };

  // ── Custom Column Helpers ──
  const handleAddCustomColumn = () => {
    if (!newColName.trim()) return;
    const colId = `custom_${Date.now()}`;
    const newCol: CustomColumn = {
      id: colId,
      label: newColName.trim()
    };
    setCustomColumns(prev => [...prev, newCol]);
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

  // ── Repasses Line Helpers ──
  const handleAddRepassLine = () => {
    const newLine: RepassLine = {
      id: `rep-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      bank: 'Itaú',
      amount: 0,
      notes: ''
    };
    setRepassLines(prev => [...prev, newLine]);
  };

  const handleRemoveRepassLine = (id: string) => {
    setRepassLines(prev => prev.filter(l => l.id !== id));
  };

  const handleRepassLineChange = (id: string, field: keyof RepassLine, value: any) => {
    setRepassLines(prev => prev.map(l => {
      if (l.id === id) {
        return { ...l, [field]: value };
      }
      return l;
    }));
  };

  // ── Calculated Financial Totals ──
  const rowTotals = useMemo(() => {
    return rows.map(r => {
      const customSum = Object.values(r.customValues || {}).reduce((acc, v) => acc + (v || 0), 0);
      const rowSum = (r.valorFixo || 0) + 
                     (r.valorBonus || 0) + 
                     (r.valorComissao || 0) + 
                     (r.valorAjudaCusto || 0) + 
                     (r.valorOutros || 0) + 
                     (r.valorEmprestimo || 0) + 
                     customSum;
      return { id: r.id, total: rowSum };
    });
  }, [rows]);

  const rowTotalMap = useMemo(() => {
    const map = new Map<string, number>();
    rowTotals.forEach(rt => map.set(rt.id, rt.total));
    return map;
  }, [rowTotals]);

  const subtotal = useMemo(() => {
    return rowTotals.reduce((acc, rt) => acc + rt.total, 0);
  }, [rowTotals]);

  // Tax calculation
  const calculatedTax = useMemo(() => {
    if (taxInputMode === 'rate') {
      return subtotal * (taxRate / 100);
    }
    return taxFixedAmount || 0;
  }, [subtotal, taxInputMode, taxRate, taxFixedAmount]);

  // Admin fee calculation
  const calculatedAdminFee = useMemo(() => {
    return subtotal * (adminFeeRate / 100);
  }, [subtotal, adminFeeRate]);

  // Gross total apurado
  const totalApuradoBruto = useMemo(() => {
    return subtotal + calculatedTax + calculatedAdminFee;
  }, [subtotal, calculatedTax, calculatedAdminFee]);

  // Total repassado
  const totalRepassado = useMemo(() => {
    return repassLines.reduce((acc, l) => acc + (l.amount || 0), 0);
  }, [repassLines]);

  // Saldo devedor / remanescente
  const saldoRemanescente = useMemo(() => {
    return totalApuradoBruto - totalRepassado;
  }, [totalApuradoBruto, totalRepassado]);

  // ── Location Summary Aggregation (Resumo por Localidade - Duplo Check) ──
  const locationSummary = useMemo(() => {
    const summaryMap = new Map<string, {
      location: string;
      count: number;
      valorFixo: number;
      valorBonus: number;
      valorComissao: number;
      valorAjudaCusto: number;
      valorOutros: number;
      valorEmprestimo: number;
      customSums: Record<string, number>;
      totalGasto: number;
    }>();

    rows.forEach(r => {
      const loc = r.location || 'Não Especificado';
      const existing = summaryMap.get(loc) || {
        location: loc,
        count: 0,
        valorFixo: 0,
        valorBonus: 0,
        valorComissao: 0,
        valorAjudaCusto: 0,
        valorOutros: 0,
        valorEmprestimo: 0,
        customSums: {},
        totalGasto: 0
      };

      existing.count += 1;
      existing.valorFixo += (r.valorFixo || 0);
      existing.valorBonus += (r.valorBonus || 0);
      existing.valorComissao += (r.valorComissao || 0);
      existing.valorAjudaCusto += (r.valorAjudaCusto || 0);
      existing.valorOutros += (r.valorOutros || 0);
      existing.valorEmprestimo += (r.valorEmprestimo || 0);

      customColumns.forEach(col => {
        const val = r.customValues?.[col.id] || 0;
        existing.customSums[col.id] = (existing.customSums[col.id] || 0) + val;
      });

      const rowTotal = rowTotalMap.get(r.id) || 0;
      existing.totalGasto += rowTotal;

      summaryMap.set(loc, existing);
    });

    return Array.from(summaryMap.values());
  }, [rows, customColumns, rowTotalMap]);

  // ── Column Totals for Main Table ──
  const mainTableColumnTotals = useMemo(() => {
    const totalFixo = rows.reduce((acc, r) => acc + (r.valorFixo || 0), 0);
    const totalBonus = rows.reduce((acc, r) => acc + (r.valorBonus || 0), 0);
    const totalComissao = rows.reduce((acc, r) => acc + (r.valorComissao || 0), 0);
    const totalAjudaCusto = rows.reduce((acc, r) => acc + (r.valorAjudaCusto || 0), 0);
    const totalOutros = rows.reduce((acc, r) => acc + (r.valorOutros || 0), 0);
    const totalEmprestimo = rows.reduce((acc, r) => acc + (r.valorEmprestimo || 0), 0);
    
    const customTotals: Record<string, number> = {};
    customColumns.forEach(col => {
      customTotals[col.id] = rows.reduce((acc, r) => acc + (r.customValues?.[col.id] || 0), 0);
    });

    return {
      totalFixo,
      totalBonus,
      totalComissao,
      totalAjudaCusto,
      totalOutros,
      totalEmprestimo,
      customTotals,
      grandTotal: subtotal
    };
  }, [rows, customColumns, subtotal]);

  // ── Copy Summary Report to Clipboard ──
  const handleCopyReport = () => {
    let reportText = `=== APURAÇÃO EXECUTIVA DE TERCEIRIZAÇÃO - COMPETÊNCIA ${competencia} ===\n\n`;
    reportText += `Colaboradores Processados: ${rows.length}\n`;
    reportText += `Subtotal de Custos & Empréstimos: ${formatMoney(subtotal)}\n`;
    reportText += `Impostos da Competência (${taxInputMode === 'rate' ? `${taxRate}%` : 'Fixo'}): ${formatMoney(calculatedTax)}\n`;
    reportText += `Taxa Administrativa (${adminFeeRate}%): ${formatMoney(calculatedAdminFee)}\n`;
    reportText += `TOTAL APURADO BRUTO: ${formatMoney(totalApuradoBruto)}\n`;
    reportText += `--------------------------------------------------\n`;
    reportText += `TOTAL REPASSADO: ${formatMoney(totalRepassado)}\n`;
    reportText += `SALDO REMANESCENTE: ${formatMoney(saldoRemanescente)}\n\n`;
    
    reportText += `=== RESUMO POR LOCALIDADE (DUPLO CHECK) ===\n`;
    locationSummary.forEach(ls => {
      reportText += `- ${ls.location}: ${ls.count} colab(s) | Total: ${formatMoney(ls.totalGasto)}\n`;
    });

    navigator.clipboard.writeText(reportText);
    alert('Resumo executivo copiado para a área de transferência!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-[1400px] h-[92vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* ── HEADER SUPERIOR ── */}
        <header className="p-4 sm:p-6 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
              <Building2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">Gestão & Apuração de Terceirização</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  PeopleCockpit
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Custos históricos, empréstimos por competência, duplo check por localidade e fluxo de repasses.
              </p>
            </div>
          </div>

          {/* Direct Controls: Competence Selector & Actions */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-sm">
              <Calendar size={15} className="text-purple-400 shrink-0" />
              <label className="text-[10px] font-black uppercase text-slate-400 shrink-0">Competência:</label>
              <input
                type="month"
                value={competencia}
                onChange={e => setCompetencia(e.target.value)}
                className="bg-transparent text-xs font-bold text-white outline-none focus:text-purple-300"
              />
            </div>

            <button
              onClick={() => loadDataForCompetencia(competencia)}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl transition-all active:scale-95 shadow-sm"
              title="Recarregar dados da competência"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-purple-400' : ''} />
            </button>

            <button
              onClick={handleSaveSettlement}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all active:scale-95 uppercase shadow-md"
              title="Salvar alterações e colunas desta competência no banco local"
            >
              <Save size={14} /> <span>Salvar Apuração</span>
            </button>

            <button
              onClick={handleResetSettlement}
              className="p-2 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700/50 rounded-xl transition-all active:scale-95"
              title="Resetar competência para os valores padrão do banco"
            >
              <RotateCcw size={15} />
            </button>

            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-purple-300 rounded-xl text-xs font-bold transition-all active:scale-95 uppercase"
              title="Copiar relatório consolidado em texto"
            >
              <Copy size={14} /> <span className="hidden sm:inline">Copiar Resumo</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ── BARRA SUPERIOR DE TAXAS & ALÍQUOTAS DE APURAÇÃO ── */}
        <div className="bg-slate-900/90 border-b border-slate-800/80 p-3 px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          
          {/* Taxa de Impostos */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5 px-3.5 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Taxa de Impostos</span>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setTaxInputMode(taxInputMode === 'rate' ? 'amount' : 'rate')}
                  className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700 hover:bg-slate-700"
                >
                  {taxInputMode === 'rate' ? '%' : 'R$'}
                </button>
                {taxInputMode === 'rate' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={taxRate}
                      onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-bold text-white outline-none focus:border-purple-500 text-right"
                    />
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={taxFixedAmount}
                      onChange={e => setTaxFixedAmount(parseFloat(e.target.value) || 0)}
                      className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-bold text-white outline-none focus:border-purple-500 text-right"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold text-slate-400 block">Total Impostos</span>
              <span className="text-xs font-black text-amber-400">{formatMoney(calculatedTax)}</span>
            </div>
          </div>

          {/* Taxa Administrativa (%) */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5 px-3.5 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">% Taxa Administrativa</span>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={adminFeeRate}
                  onChange={e => setAdminFeeRate(parseFloat(e.target.value) || 0)}
                  className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-bold text-white outline-none focus:border-purple-500 text-right"
                />
                <span className="text-xs font-bold text-slate-400">%</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold text-slate-400 block">Total Admin</span>
              <span className="text-xs font-black text-indigo-400">{formatMoney(calculatedAdminFee)}</span>
            </div>
          </div>

          {/* Subtotal Bruto */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5 px-3.5 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Total Apurado Bruto</span>
              <span className="text-sm font-black text-emerald-400 block mt-0.5">{formatMoney(totalApuradoBruto)}</span>
            </div>
            <Calculator size={20} className="text-emerald-500/50" />
          </div>

          {/* Saldo Remanescente */}
          <div className={`border rounded-2xl p-2.5 px-3.5 flex items-center justify-between transition-colors ${
            saldoRemanescente <= 0 
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
              : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
          }`}>
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider block opacity-80">Saldo Remanescente</span>
              <span className="text-sm font-black block mt-0.5">{formatMoney(saldoRemanescente)}</span>
            </div>
            {saldoRemanescente <= 0 ? (
              <ShieldCheck size={20} className="text-emerald-400" />
            ) : (
              <AlertCircle size={20} className="text-amber-400 animate-pulse" />
            )}
          </div>

        </div>

        {/* ── NAVEGAÇÃO DE ABAS EXECUTIVAS ── */}
        <div className="px-4 sm:px-6 pt-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('main')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'main'
                ? 'border-purple-500 text-purple-300 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Building2 size={14} /> 1. Colaboradores Terceirizados ({rows.length})
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'summary'
                ? 'border-purple-500 text-purple-300 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Layers size={14} /> 2. Resumo por Localidade ({locationSummary.length} Locais - Duplo Check)
          </button>

          <button
            onClick={() => setActiveTab('settlement')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'settlement'
                ? 'border-purple-500 text-purple-300 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Landmark size={14} /> 3. Apuração & Repasses ({repassLines.length} Lançamentos)
          </button>
        </div>

        {/* ── MESSAGES & NOTIFICATIONS ── */}
        {saveSuccessMessage && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/40 p-2.5 px-6 flex items-center justify-between text-emerald-200 text-xs font-bold animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>{saveSuccessMessage}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">Persistido no banco</span>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* Error Notice */}
          {error && (
            <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl flex items-center gap-3 text-rose-200 text-xs font-bold">
              <AlertCircle size={18} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="p-12 text-center space-y-3">
              <RefreshCw size={32} className="animate-spin text-purple-500 mx-auto" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carregando custos históricos e empréstimos...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* ── ABA 1: TABELA DE COLABORADORES TERCEIRIZADOS ── */}
              {activeTab === 'main' && (
                <div className="space-y-4">
                  {/* Action controls above table */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddManualRow}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm uppercase"
                      >
                        <Plus size={14} /> Adicionar Linha Manual
                      </button>

                      {/* Modal / Input para nova coluna personalizada */}
                      {!isAddingCol ? (
                        <button
                          onClick={() => setIsAddingCol(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 uppercase"
                        >
                          <Plus size={14} /> Adicionar Coluna
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                          <input
                            type="text"
                            placeholder="Nome da coluna..."
                            value={newColName}
                            onChange={e => setNewColName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCustomColumn()}
                            className="bg-slate-800 border border-purple-500/50 rounded-xl px-2.5 py-1 text-xs text-white outline-none w-40"
                            autoFocus
                          />
                          <button
                            onClick={handleAddCustomColumn}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setIsAddingCol(false)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-right text-xs text-slate-400 font-semibold">
                      Total na Tabela: <span className="text-white font-black">{formatMoney(subtotal)}</span>
                    </div>
                  </div>

                  {/* Main Table */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-3 min-w-[180px]">Colaborador</th>
                          <th className="py-3 px-3 min-w-[140px]">Localidade</th>
                          <th className="py-3 px-3 text-right min-w-[110px]">Fixo / NF</th>
                          <th className="py-3 px-3 text-right min-w-[100px]">Bônus</th>
                          <th className="py-3 px-3 text-right min-w-[100px]">Comissão</th>
                          <th className="py-3 px-3 text-right min-w-[110px]">Ajuda Custo</th>
                          <th className="py-3 px-3 text-right min-w-[100px]">Outros</th>
                          <th className="py-3 px-3 text-right min-w-[120px] bg-purple-950/30 text-purple-300 border-x border-purple-500/20">
                            Empréstimos <span className="block text-[8px] font-normal text-purple-400">(Fora da Folha)</span>
                          </th>
                          {/* Colunas customizadas */}
                          {customColumns.map(col => (
                            <th key={col.id} className="py-3 px-3 text-right min-w-[110px] bg-slate-900">
                              <div className="flex items-center justify-end gap-1">
                                <span>{col.label}</span>
                                <button
                                  onClick={() => handleRemoveCustomColumn(col.id)}
                                  className="text-slate-500 hover:text-rose-400 p-0.5"
                                  title="Remover coluna"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </th>
                          ))}
                          <th className="py-3 px-3 text-right min-w-[130px] font-black text-white bg-slate-900/80">Total Gasto</th>
                          <th className="py-3 px-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={10 + customColumns.length} className="py-12 text-center text-slate-500 font-medium">
                              Nenhum colaborador terceirizado encontrado para esta competência. Clique em "Adicionar Linha Manual" para inserir.
                            </td>
                          </tr>
                        ) : (
                          rows.map((row) => {
                            const rTotal = rowTotalMap.get(row.id) || 0;
                            return (
                              <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                                {/* Nome */}
                                <td className="py-2.5 px-3">
                                  {row.isManual ? (
                                    <input
                                      type="text"
                                      value={row.name}
                                      onChange={e => handleRowChange(row.id, 'name', e.target.value)}
                                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white outline-none focus:border-purple-500"
                                    />
                                  ) : (
                                    <div className="font-bold text-slate-100 flex items-center gap-1.5">
                                      <span>{row.name}</span>
                                    </div>
                                  )}
                                </td>

                                {/* Localidade */}
                                <td className="py-2.5 px-3">
                                  <input
                                    type="text"
                                    value={row.location}
                                    onChange={e => handleRowChange(row.id, 'location', e.target.value)}
                                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs text-slate-300 outline-none focus:border-purple-500"
                                  />
                                </td>

                                {/* Fixo / NF */}
                                <td className="py-2.5 px-3 text-right">
                                  <input
                                    type="number"
                                    step="10"
                                    value={row.valorFixo}
                                    onChange={e => handleRowChange(row.id, 'valorFixo', parseFloat(e.target.value) || 0)}
                                    className="w-24 text-right bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs font-semibold text-slate-200 outline-none focus:border-purple-500"
                                  />
                                </td>

                                {/* Bônus */}
                                <td className="py-2.5 px-3 text-right">
                                  <input
                                    type="number"
                                    step="10"
                                    value={row.valorBonus}
                                    onChange={e => handleRowChange(row.id, 'valorBonus', parseFloat(e.target.value) || 0)}
                                    className="w-20 text-right bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs font-semibold text-slate-200 outline-none focus:border-purple-500"
                                  />
                                </td>

                                {/* Comissão */}
                                <td className="py-2.5 px-3 text-right">
                                  <input
                                    type="number"
                                    step="10"
                                    value={row.valorComissao}
                                    onChange={e => handleRowChange(row.id, 'valorComissao', parseFloat(e.target.value) || 0)}
                                    className="w-20 text-right bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs font-semibold text-slate-200 outline-none focus:border-purple-500"
                                  />
                                </td>

                                {/* Ajuda Custo */}
                                <td className="py-2.5 px-3 text-right">
                                  <input
                                    type="number"
                                    step="10"
                                    value={row.valorAjudaCusto}
                                    onChange={e => handleRowChange(row.id, 'valorAjudaCusto', parseFloat(e.target.value) || 0)}
                                    className="w-24 text-right bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs font-semibold text-slate-200 outline-none focus:border-purple-500"
                                  />
                                </td>

                                {/* Outros */}
                                <td className="py-2.5 px-3 text-right">
                                  <input
                                    type="number"
                                    step="10"
                                    value={row.valorOutros}
                                    onChange={e => handleRowChange(row.id, 'valorOutros', parseFloat(e.target.value) || 0)}
                                    className="w-20 text-right bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs font-semibold text-slate-200 outline-none focus:border-purple-500"
                                  />
                                </td>

                                {/* Empréstimos (Fora da Folha) */}
                                <td className="py-2.5 px-3 text-right bg-purple-950/20 border-x border-purple-500/20">
                                  <input
                                    type="number"
                                    step="10"
                                    value={row.valorEmprestimo}
                                    onChange={e => handleRowChange(row.id, 'valorEmprestimo', parseFloat(e.target.value) || 0)}
                                    className="w-24 text-right bg-purple-900/30 border border-purple-500/40 rounded-lg px-2 py-1 text-xs font-bold text-purple-200 outline-none focus:border-purple-400"
                                  />
                                </td>

                                {/* Custom Columns */}
                                {customColumns.map(col => (
                                  <td key={col.id} className="py-2.5 px-3 text-right bg-slate-900/40">
                                    <input
                                      type="number"
                                      step="10"
                                      value={row.customValues?.[col.id] || 0}
                                      onChange={e => handleCustomValueChange(row.id, col.id, parseFloat(e.target.value) || 0)}
                                      className="w-24 text-right bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs font-semibold text-slate-200 outline-none focus:border-purple-500"
                                    />
                                  </td>
                                ))}

                                {/* Total Gasto */}
                                <td className="py-2.5 px-3 text-right font-black text-emerald-400 bg-slate-900/60">
                                  {formatMoney(rTotal)}
                                </td>

                                {/* Actions */}
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    onClick={() => handleRemoveRow(row.id)}
                                    className="text-slate-600 hover:text-rose-400 p-1 transition-colors"
                                    title="Remover linha"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {/* Footers with Column Totals */}
                      <tfoot>
                        <tr className="bg-slate-950 border-t-2 border-slate-800 text-xs font-black text-white">
                          <td className="py-3 px-3 uppercase tracking-wider text-purple-400">Total Acumulado ({rows.length})</td>
                          <td className="py-3 px-3 text-slate-400 font-normal">—</td>
                          <td className="py-3 px-3 text-right">{formatMoney(mainTableColumnTotals.totalFixo)}</td>
                          <td className="py-3 px-3 text-right">{formatMoney(mainTableColumnTotals.totalBonus)}</td>
                          <td className="py-3 px-3 text-right">{formatMoney(mainTableColumnTotals.totalComissao)}</td>
                          <td className="py-3 px-3 text-right">{formatMoney(mainTableColumnTotals.totalAjudaCusto)}</td>
                          <td className="py-3 px-3 text-right">{formatMoney(mainTableColumnTotals.totalOutros)}</td>
                          <td className="py-3 px-3 text-right text-purple-300 bg-purple-950/40 border-x border-purple-500/20">
                            {formatMoney(mainTableColumnTotals.totalEmprestimo)}
                          </td>
                          {customColumns.map(col => (
                            <td key={col.id} className="py-3 px-3 text-right">
                              {formatMoney(mainTableColumnTotals.customTotals[col.id] || 0)}
                            </td>
                          ))}
                          <td className="py-3 px-3 text-right text-emerald-400 text-sm font-black bg-slate-900">
                            {formatMoney(mainTableColumnTotals.grandTotal)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* ── ABA 2: RESUMO POR LOCALIDADE (DUPLO CHECK) ── */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={24} className="text-purple-400 shrink-0" />
                      <div>
                        <h3 className="text-xs font-black text-purple-200 uppercase tracking-wider">Duplo Check por Localidade</h3>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Consolidação executiva agrupada por local de atendimento. O total geral desta visão confirma e valida o valor da apuração principal.
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Validado</span>
                      <span className="text-base font-black text-emerald-400">{formatMoney(subtotal)}</span>
                    </div>
                  </div>

                  {/* Summary Table */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-4">Localidade</th>
                          <th className="py-3 px-3 text-center">Colaboradores</th>
                          <th className="py-3 px-3 text-right">Total Fixo / NF</th>
                          <th className="py-3 px-3 text-right">Total Bônus</th>
                          <th className="py-3 px-3 text-right">Total Comissão</th>
                          <th className="py-3 px-3 text-right">Total Ajuda Custo</th>
                          <th className="py-3 px-3 text-right">Total Outros</th>
                          <th className="py-3 px-3 text-right text-purple-300 bg-purple-950/30">Empréstimos</th>
                          {customColumns.map(col => (
                            <th key={col.id} className="py-3 px-3 text-right">{col.label}</th>
                          ))}
                          <th className="py-3 px-4 text-right font-black text-white bg-slate-900">Total Localidade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {locationSummary.length === 0 ? (
                          <tr>
                            <td colSpan={9 + customColumns.length} className="py-8 text-center text-slate-500 font-medium">
                              Sem dados de localidade disponíveis.
                            </td>
                          </tr>
                        ) : (
                          locationSummary.map((ls, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-4 font-bold text-slate-100 flex items-center gap-2">
                                <Building2 size={14} className="text-purple-400 shrink-0" />
                                <span>{ls.location}</span>
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-slate-300">
                                <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full text-[10px]">
                                  {ls.count} pss
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right text-slate-300 font-semibold">{formatMoney(ls.valorFixo)}</td>
                              <td className="py-3 px-3 text-right text-slate-300 font-semibold">{formatMoney(ls.valorBonus)}</td>
                              <td className="py-3 px-3 text-right text-slate-300 font-semibold">{formatMoney(ls.valorComissao)}</td>
                              <td className="py-3 px-3 text-right text-slate-300 font-semibold">{formatMoney(ls.valorAjudaCusto)}</td>
                              <td className="py-3 px-3 text-right text-slate-300 font-semibold">{formatMoney(ls.valorOutros)}</td>
                              <td className="py-3 px-3 text-right text-purple-300 font-bold bg-purple-950/20">{formatMoney(ls.valorEmprestimo)}</td>
                              {customColumns.map(col => (
                                <td key={col.id} className="py-3 px-3 text-right text-slate-300 font-semibold">
                                  {formatMoney(ls.customSums[col.id] || 0)}
                                </td>
                              ))}
                              <td className="py-3 px-4 text-right font-black text-emerald-400 bg-slate-900/60">
                                {formatMoney(ls.totalGasto)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-950 border-t-2 border-slate-800 text-xs font-black text-white">
                          <td className="py-3.5 px-4 uppercase tracking-wider text-purple-400">Total Consolidado Duplo Check</td>
                          <td className="py-3.5 px-3 text-center">{rows.length}</td>
                          <td className="py-3.5 px-3 text-right">{formatMoney(mainTableColumnTotals.totalFixo)}</td>
                          <td className="py-3.5 px-3 text-right">{formatMoney(mainTableColumnTotals.totalBonus)}</td>
                          <td className="py-3.5 px-3 text-right">{formatMoney(mainTableColumnTotals.totalComissao)}</td>
                          <td className="py-3.5 px-3 text-right">{formatMoney(mainTableColumnTotals.totalAjudaCusto)}</td>
                          <td className="py-3.5 px-3 text-right">{formatMoney(mainTableColumnTotals.totalOutros)}</td>
                          <td className="py-3.5 px-3 text-right text-purple-300 bg-purple-950/40">{formatMoney(mainTableColumnTotals.totalEmprestimo)}</td>
                          {customColumns.map(col => (
                            <td key={col.id} className="py-3.5 px-3 text-right">
                              {formatMoney(mainTableColumnTotals.customTotals[col.id] || 0)}
                            </td>
                          ))}
                          <td className="py-3.5 px-4 text-right text-emerald-400 text-sm font-black bg-slate-900">
                            {formatMoney(subtotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* ── ABA 3: APURAÇÃO FINAL & REGISTRO DE REPASSES ── */}
              {activeTab === 'settlement' && (
                <div className="space-y-6">
                  {/* Resumo da Apuração Bruta */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">1. Subtotal de Colaboradores</span>
                      <p className="text-xl font-black text-white">{formatMoney(subtotal)}</p>
                      <p className="text-[10px] text-slate-500">Soma de verbas, custos de contrato e empréstimos</p>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">2. Encargos & Taxa Admin</span>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 pt-1">
                        <span>Impostos:</span>
                        <span className="text-amber-400">{formatMoney(calculatedTax)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-t border-slate-800/80 pt-1">
                        <span>Taxa Admin ({adminFeeRate}%):</span>
                        <span className="text-indigo-400">{formatMoney(calculatedAdminFee)}</span>
                      </div>
                    </div>

                    <div className="bg-purple-950/40 border border-purple-500/40 rounded-2xl p-4 space-y-2">
                      <span className="text-[10px] font-black uppercase text-purple-300 tracking-wider">3. Total Apurado Bruto</span>
                      <p className="text-2xl font-black text-emerald-400">{formatMoney(totalApuradoBruto)}</p>
                      <p className="text-[10px] text-purple-300/70">Valor total a ser repassado na competência</p>
                    </div>
                  </div>

                  {/* Tabela de Repasses Efetuados */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Landmark size={18} className="text-purple-400" />
                        <h3 className="text-xs font-black text-white uppercase tracking-wider">Valores Repassados (Pagamentos Efetuados)</h3>
                      </div>
                      <button
                        onClick={handleAddRepassLine}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 uppercase"
                      >
                        <Plus size={14} /> Novo Repasse
                      </button>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <th className="py-3 px-4 min-w-[140px]">Data do Repasse</th>
                            <th className="py-3 px-4 min-w-[160px]">Banco de Origem</th>
                            <th className="py-3 px-4 min-w-[200px]">Observações / Ref.</th>
                            <th className="py-3 px-4 text-right min-w-[140px]">Valor Repassado (R$)</th>
                            <th className="py-3 px-2 w-10 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {repassLines.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-500 font-medium">
                                Nenhum repasse inserido. Clique em "Novo Repasse" para registrar pagamentos realizados.
                              </td>
                            </tr>
                          ) : (
                            repassLines.map(line => (
                              <tr key={line.id} className="hover:bg-slate-800/40 transition-colors">
                                {/* Data */}
                                <td className="py-2.5 px-4">
                                  <input
                                    type="date"
                                    value={line.date}
                                    onChange={e => handleRepassLineChange(line.id, 'date', e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-purple-500"
                                  />
                                </td>

                                {/* Banco de Origem */}
                                <td className="py-2.5 px-4">
                                  <select
                                    value={line.bank}
                                    onChange={e => handleRepassLineChange(line.id, 'bank', e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white outline-none focus:border-purple-500"
                                  >
                                    {BANK_OPTIONS.map(b => (
                                      <option key={b} value={b}>{b}</option>
                                    ))}
                                  </select>
                                </td>

                                {/* Observações */}
                                <td className="py-2.5 px-4">
                                  <input
                                    type="text"
                                    placeholder="Ex: Parcela 1/2, Pix enviado..."
                                    value={line.notes}
                                    onChange={e => handleRepassLineChange(line.id, 'notes', e.target.value)}
                                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:border-purple-500"
                                  />
                                </td>

                                {/* Valor */}
                                <td className="py-2.5 px-4 text-right">
                                  <input
                                    type="number"
                                    step="100"
                                    value={line.amount}
                                    onChange={e => handleRepassLineChange(line.id, 'amount', parseFloat(e.target.value) || 0)}
                                    className="w-32 text-right bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-emerald-400 outline-none focus:border-purple-500"
                                  />
                                </td>

                                {/* Delete */}
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    onClick={() => handleRemoveRepassLine(line.id)}
                                    className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-950 border-t-2 border-slate-800 text-xs font-black text-white">
                            <td colSpan={3} className="py-3 px-4 uppercase tracking-wider text-purple-400">Total de Repasses Efetuados</td>
                            <td className="py-3 px-4 text-right text-emerald-400 text-sm font-black">{formatMoney(totalRepassado)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Card de Apuração de Saldo Final */}
                  <div className={`p-6 rounded-3xl border shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 transition-colors ${
                    saldoRemanescente <= 0 
                      ? 'bg-emerald-950/30 border-emerald-500/40' 
                      : 'bg-amber-950/30 border-amber-500/40'
                  }`}>
                    <div className="space-y-1 text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        {saldoRemanescente <= 0 ? (
                          <CheckCircle2 className="text-emerald-400" size={20} />
                        ) : (
                          <AlertCircle className="text-amber-400" size={20} />
                        )}
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">
                          {saldoRemanescente <= 0 ? 'Apuração Quitada / Sem Pendências' : 'Apuração com Saldo Devedor Pendente'}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-300">
                        {saldoRemanescente <= 0
                          ? 'Todos os repasses cobrem integralmente o Total Apurado Bruto da competência.'
                          : `Resta repassar o valor de ${formatMoney(saldoRemanescente)} para quitar a competência ${competencia}.`}
                      </p>
                    </div>

                    <div className="text-center md:text-right shrink-0">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-widest">Saldo Devedor Remanescente</span>
                      <span className={`text-2xl sm:text-3xl font-black block mt-0.5 ${
                        saldoRemanescente <= 0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {formatMoney(saldoRemanescente)}
                      </span>
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

        </div>

        {/* ── FOOTER INFERIOR ── */}
        <footer className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 text-slate-400 font-medium">
            <span>Competência: <strong className="text-white font-bold">{competencia}</strong></span>
            <span>Colaboradores: <strong className="text-white font-bold">{rows.length}</strong></span>
            {savedTimestamp && (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check size={13} /> Salvo em {new Date(savedTimestamp).toLocaleDateString('pt-BR')} {new Date(savedTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold uppercase transition-all active:scale-95"
            >
              Fechar
            </button>
            <button
              onClick={handleSaveSettlement}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase transition-all active:scale-95 shadow-md"
            >
              <Save size={15} /> Salvar Apuração no DB
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
};
