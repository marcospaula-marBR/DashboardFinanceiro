import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Building2, Plus, Trash2, Download, Calculator, Landmark, FileText,
  CheckCircle2, AlertCircle, Calendar, DollarSign, Percent, ChevronRight,
  Sparkles, RefreshCw, Edit3, Layers, Copy, ShieldCheck, ArrowRight, Save,
  RotateCcw, Check, MapPin, Upload, Tag, Users, FileSpreadsheet, ArrowLeftRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PeopleHRService } from '@/services/people-hr.service';
import { Employee } from '@/types/loans';
import { parseOutsourcingFile, exportOutsourcingTemplate } from '@/utils/outsourcingFileParser';

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
  // Verbas principais de remuneração
  valorBruto: number;       // Valor Bruto (Holerite / NF / Salário Base)
  valorDesconto: number;    // Descontos em folha
  valorLiquido: number;     // Valor Líquido = Valor Bruto (-) Desconto
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

// ─────────────────────────────────────────────
// COMPONENTE DE INPUT NUMÉRICO COM 2 CASAS DECIMAIS
// Nota: onChange só notifica o pai no onBlur para evitar
// re-renders que causam perda de foco durante a digitação.
// ─────────────────────────────────────────────

const DecimalInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  width?: string;
  className?: string;
}> = ({ value, onChange, width = 'w-24', className = '' }) => {
  const [localVal, setLocalVal] = useState<string>(() => (value || 0).toFixed(2));
  const isFocused = useRef(false);

  // Sincroniza externamente apenas quando NÃO está em edição
  useEffect(() => {
    if (!isFocused.current) {
      const num = parseFloat(localVal) || 0;
      if (Math.abs(num - (value || 0)) > 0.005) {
        setLocalVal((value || 0).toFixed(2));
      }
    }
  }, [value]);

  const handleFocus = () => { isFocused.current = true; };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Só atualiza o estado local — NÃO chama o pai aqui
    setLocalVal(e.target.value);
  };

  const handleBlur = () => {
    isFocused.current = false;
    const parsed = parseFloat(localVal.replace(',', '.')) || 0;
    const formatted = parsed.toFixed(2);
    setLocalVal(formatted);
    onChange(parsed); // Notifica o pai apenas ao sair do campo
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={localVal}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`${width} text-right bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all ${className}`}
    />
  );
};

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

  // Lista de todos os colaboradores do sistema (para mapear IDs ao salvar)
  const [allEmployeesList, setAllEmployeesList] = useState<Employee[]>([]);

  // Dados principais
  const [rows, setRows] = useState<OutsourcingRow[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);

  // Coluna customizada
  const [newColName, setNewColName] = useState('');
  const [isAddingCol, setIsAddingCol] = useState(false);

  // Taxas e configurações (ISS)
  const [taxInputMode, setTaxInputMode] = useState<'rate' | 'amount'>('rate');
  const [taxRate, setTaxRate] = useState<number>(5.0);
  const [taxFixedAmount, setTaxFixedAmount] = useState<number>(0);

  // Taxa de Administração (Opção % ou Valor Absoluto R$)
  const [adminFeeMode, setAdminFeeMode] = useState<'rate' | 'amount'>('rate');
  const [adminFeeRate, setAdminFeeRate] = useState<number>(10.0);
  const [adminFeeFixedAmount, setAdminFeeFixedAmount] = useState<number>(0);

  // Repasses
  const [repassLines, setRepassLines] = useState<RepassLine[]>([]);

  // Timestamp do último save
  const [savedTimestamp, setSavedTimestamp] = useState<string | null>(null);

  // Aba ativa
  const [activeTab, setActiveTab] = useState<'main' | 'summary' | 'settlement'>('main');

  // Refs para sincronização exata da barra de rolagem horizontal
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<'top' | 'table' | null>(null);
  const phantomRef = useRef<HTMLDivElement>(null); // div fantasma dentro da barra superior

  // Upload XLSX/CSV e PDF refs
  const spreadsheetInputRef = useRef<HTMLInputElement>(null);
  const [spreadsheetImporting, setSpreadsheetImporting] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfUploading, setPdfUploading] = useState(false);

  // ── ResizeObserver: monitora scrollWidth real da tabela em tempo real ──
  useEffect(() => {
    const tableEl = tableScrollRef.current;
    if (!tableEl) return;

    const syncPhantomWidth = () => {
      if (phantomRef.current && tableEl) {
        // scrollWidth = largura total do conteúdo scrollável (inclui overflow)
        phantomRef.current.style.width = tableEl.scrollWidth + 'px';
      }
    };

    // Dispara imediatamente
    syncPhantomWidth();

    // ResizeObserver detecta mudanças de tamanho do conteúdo da tabela
    const ro = new ResizeObserver(() => syncPhantomWidth());
    // Observa o elemento filho interno da tabela (onde o conteúdo cresce)
    const tableInner = tableEl.querySelector('table');
    if (tableInner) ro.observe(tableInner);
    ro.observe(tableEl);

    return () => ro.disconnect();
  }, [activeTab]); // reconnecta ao trocar de aba

  // Re-sincroniza quando linhas ou colunas mudam
  useEffect(() => {
    const tableEl = tableScrollRef.current;
    if (!tableEl || !phantomRef.current) return;
    // Pequeno delay para garantir que o DOM renderizou
    const t = setTimeout(() => {
      if (phantomRef.current && tableEl) {
        phantomRef.current.style.width = tableEl.scrollWidth + 'px';
      }
    }, 50);
    return () => clearTimeout(t);
  }, [rows.length, customColumns.length]);

  const handleTopScroll = () => {
    if (isScrollingRef.current === 'table') return;
    isScrollingRef.current = 'top';
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isScrollingRef.current = null; });
  };

  const handleTableScroll = () => {
    if (isScrollingRef.current === 'top') return;
    isScrollingRef.current = 'table';
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isScrollingRef.current = null; });
  };

  // ── Formatação Monetária com 2 casas decimais estritas ──
  const fmt = (v: number) =>
    (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Carregar dados ao abrir ──────────────────
  useEffect(() => {
    if (isOpen) loadData(competencia);
  }, [isOpen, competencia, isTestMode]);

  const loadData = async (comp: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Colaboradores cadastrados
      const allEmps = await PeopleHRService.getEmployeesForPeople({ mostrarInativos: true, isTestMode });
      setAllEmployeesList(allEmps);

      const outsourced = allEmps.filter(e =>
        e.is_outsourced === true ||
        (e as any).is_outsourced === 'true' ||
        e.metadata?.is_outsourced === true
      );

      // 2. Custos mensais da competência no Supabase
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

      // 4. Buscar configuração global de terceirização do Supabase (Compartilhada entre todos os usuários)
      let cloudCompetenceData: any = null;
      try {
        const { data: globalConfig } = await supabase
          .from('employees')
          .select('metadata')
          .eq('full_name', '__SYSTEM_GLOBAL_CONFIG__')
          .maybeSingle();

        if (globalConfig?.metadata?.outsourcing_configs?.[comp]) {
          cloudCompetenceData = globalConfig.metadata.outsourcing_configs[comp];
        }
      } catch (e) {
        console.warn('Aviso ao carregar configuração de terceirização do Supabase:', e);
      }

      // 5. Repasses (Nuvem Supabase + Fallback LocalStorage)
      let repLoaded: RepassLine[] = [];
      if (cloudCompetenceData?.repassLines && Array.isArray(cloudCompetenceData.repassLines) && cloudCompetenceData.repassLines.length > 0) {
        repLoaded = cloudCompetenceData.repassLines;
      } else {
        const savedRep = localStorage.getItem(`outsourcing_repasses_${comp}${isTestMode ? '_test' : ''}`);
        if (savedRep) {
          try { repLoaded = JSON.parse(savedRep); } catch {}
        }
      }

      if (repLoaded.length > 0) {
        setRepassLines(repLoaded);
      } else {
        setRepassLines([{
          id: `rep-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          bank: 'Omie.Cash',
          amount: 0,
          notes: ''
        }]);
      }

      // 6. Configuração de taxas da competência (Nuvem Supabase + Fallback LocalStorage)
      if (cloudCompetenceData) {
        setTaxInputMode(cloudCompetenceData.taxInputMode || 'rate');
        setTaxRate(parseFloat(String(cloudCompetenceData.taxRate)) || 5.0);
        setTaxFixedAmount(parseFloat(String(cloudCompetenceData.taxFixedAmount)) || 0);
        setAdminFeeMode(cloudCompetenceData.adminFeeMode || 'rate');
        setAdminFeeRate(parseFloat(String(cloudCompetenceData.adminFeeRate)) || 10.0);
        setAdminFeeFixedAmount(parseFloat(String(cloudCompetenceData.adminFeeFixedAmount)) || 0);
        setSavedTimestamp(cloudCompetenceData.saved_at || null);
      } else {
        const savedCfg = localStorage.getItem(`outsourcing_config_${comp}${isTestMode ? '_test' : ''}`);
        if (savedCfg) {
          try {
            const parsed = JSON.parse(savedCfg);
            setTaxInputMode(parsed.taxInputMode || 'rate');
            setTaxRate(parsed.taxRate || 5.0);
            setTaxFixedAmount(parsed.taxFixedAmount || 0);
            setAdminFeeMode(parsed.adminFeeMode || 'rate');
            setAdminFeeRate(parsed.adminFeeRate || 10.0);
            setAdminFeeFixedAmount(parsed.adminFeeFixedAmount || 0);
            setSavedTimestamp(parsed.saved_at || null);
          } catch {}
        } else {
          setTaxInputMode('rate');
          setTaxRate(5.0);
          setTaxFixedAmount(0);
          setAdminFeeMode('rate');
          setAdminFeeRate(10.0);
          setAdminFeeFixedAmount(0);
        }
      }

      // 7. Restaurar linhas da apuração (Prioridade: Nuvem Supabase -> LocalStorage -> Montagem automática)
      if (cloudCompetenceData?.rows && Array.isArray(cloudCompetenceData.rows) && cloudCompetenceData.rows.length > 0) {
        setRows(cloudCompetenceData.rows);
        if (cloudCompetenceData.customColumns && Array.isArray(cloudCompetenceData.customColumns)) {
          setCustomColumns(cloudCompetenceData.customColumns);
        }
        setLoading(false);
        return;
      }

      const savedRowsJson = localStorage.getItem(`outsourcing_rows_${comp}${isTestMode ? '_test' : ''}`);
      if (savedRowsJson) {
        try {
          const parsedRows: OutsourcingRow[] = JSON.parse(savedRowsJson);
          if (parsedRows && parsedRows.length > 0) {
            setRows(parsedRows);
            const savedCols = localStorage.getItem(`outsourcing_cols_${comp}${isTestMode ? '_test' : ''}`);
            if (savedCols) {
              try { setCustomColumns(JSON.parse(savedCols)); } catch {}
            }
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Erro ao restaurar linhas do localStorage:', e);
        }
      }

      // 8. Montar linhas a partir dos colaboradores do banco
      const generatedRows: OutsourcingRow[] = outsourced.map(emp => {
        const c = costsMap.get(emp.id);
        const va = c?.verbas_adicionais || {};

        const rawType = c?.employee_type || (emp as any).employment_type || emp.metadata?.tipo_vinculo || 'CLT';
        const empType: EmployeeType =
          rawType === 'PJ' || rawType === 'MEI' || rawType === 'PJ-MEI' || rawType === 'PJ-Simples' ? 'PJ' :
          rawType === 'Estagio' || rawType === 'Estágio' || rawType === 'estagio' ? 'Estagio' :
          rawType === 'CLT' ? 'CLT' : 'Outro';

        const valorBruto = parseFloat(String(c?.valor_fixo ?? emp.remuneration_fixed ?? emp.remuneration ?? 0));
        const valorDesconto = parseFloat(String(c?.valor_desconto ?? va?.valor_desconto ?? 0));
        const valorLiquido = valorBruto - valorDesconto;

        return {
          id: emp.id,
          employeeId: emp.id,
          name: emp.name,
          location: emp.service_location || emp.city || emp.neighborhood || emp.department || 'Matriz',
          employeeType: empType,
          isManual: false,
          valorBruto,
          valorDesconto,
          valorLiquido,
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

      // Colunas customizadas
      const storageKey = `outsourcing_cols_${comp}${isTestMode ? '_test' : ''}`;
      const savedCols = localStorage.getItem(storageKey);
      if (savedCols) {
        try { setCustomColumns(JSON.parse(savedCols)); } catch {}
      } else {
        setCustomColumns([]);
      }

      setRows(generatedRows);
    } catch (err: any) {
      console.error('Erro ao carregar terceirização:', err);
      setError(err?.message || 'Erro ao carregar dados da competência.');
    } finally {
      setLoading(false);
    }
  };

  // ── Importar Planilha (XLSX / CSV) ───────────
  const handleSpreadsheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSpreadsheetImporting(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseOutsourcingFile(buffer);

      if (result.rows.length === 0) {
        throw new Error('Nenhum colaborador ou verba foi identificado na planilha importada.');
      }

      // Mapear IDs de colaboradores existentes pelo nome se possível
      const mappedRows: OutsourcingRow[] = result.rows.map(r => {
        const match = allEmployeesList.find(e =>
          e.name.toLowerCase().trim() === r.name.toLowerCase().trim() ||
          e.name.toLowerCase().includes(r.name.toLowerCase()) ||
          r.name.toLowerCase().includes(e.name.toLowerCase())
        );
        return {
          ...r,
          employeeId: match?.id || r.employeeId
        };
      });

      // Se a planilha continha taxa de ISS detectada, atualiza
      if (result.detectedTaxRate !== undefined && result.detectedTaxRate > 0) {
        setTaxInputMode('rate');
        setTaxRate(result.detectedTaxRate);
      }

      setRows(mappedRows);
      setSaveSuccessMessage(`Planilha "${file.name}" importada com sucesso: ${result.totalParsed} colaboradores carregados!`);
      setTimeout(() => setSaveSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error('Erro ao importar planilha:', err);
      setError(`Erro na importação da planilha: ${err?.message || 'Arquivo inválido.'}`);
    } finally {
      setSpreadsheetImporting(false);
      if (spreadsheetInputRef.current) spreadsheetInputRef.current.value = '';
    }
  };

  // ── SALVAR APURAÇÃO (GARANTIA HÍBRIDA: LOCALSTORAGE + SUPABASE) ──
  const handleSaveSettlement = async () => {
    setSaving(true);
    setError(null);
    const nowIso = new Date().toISOString();

    try {
      // 1. SALVAR NO LOCALSTORAGE (CACHE LOCAL RÁPIDO)
      localStorage.setItem(`outsourcing_rows_${competencia}${isTestMode ? '_test' : ''}`, JSON.stringify(rows));
      localStorage.setItem(`outsourcing_cols_${competencia}${isTestMode ? '_test' : ''}`, JSON.stringify(customColumns));
      localStorage.setItem(`outsourcing_repasses_${competencia}${isTestMode ? '_test' : ''}`, JSON.stringify(repassLines));
      localStorage.setItem(`outsourcing_config_${competencia}${isTestMode ? '_test' : ''}`, JSON.stringify({
        taxInputMode, taxRate, taxFixedAmount,
        adminFeeMode, adminFeeRate, adminFeeFixedAmount,
        saved_at: nowIso
      }));

      // 2. SALVAR NO SUPABASE: REGISTRO GLOBAL DE APURAÇÃO COMPARTILHADO COM TODOS OS USUÁRIOS
      try {
        const { data: globalRec } = await supabase
          .from('employees')
          .select('id, metadata')
          .eq('full_name', '__SYSTEM_GLOBAL_CONFIG__')
          .maybeSingle();

        const meta = (globalRec?.metadata as Record<string, any>) || {};
        const outsConfigs = meta.outsourcing_configs || {};

        outsConfigs[competencia] = {
          taxInputMode,
          taxRate,
          taxFixedAmount,
          adminFeeMode,
          adminFeeRate,
          adminFeeFixedAmount,
          repassLines,
          customColumns,
          rows,
          saved_at: nowIso,
          is_test: isTestMode
        };

        const updatedMeta = { ...meta, outsourcing_configs: outsConfigs };

        if (globalRec?.id) {
          await supabase.from('employees').update({ metadata: updatedMeta }).eq('id', globalRec.id);
        } else {
          await supabase.from('employees').insert([{
            full_name: '__SYSTEM_GLOBAL_CONFIG__',
            company: 'MarBR',
            employment_type: 'CLT',
            active: false,
            status: 'Inativo',
            metadata: updatedMeta
          }]);
        }
      } catch (errGlobal) {
        console.error('Erro ao sincronizar snapshot de apuração no Supabase:', errGlobal);
      }

      // 3. SALVAR CUSTOS INDIVIDUAIS DOS COLABORADORES NO SUPABASE (TABELA people_monthly_costs)
      const costsTable = isTestMode ? 'people_monthly_costs_test' : 'people_monthly_costs';
      for (const row of rows) {
        let empId = row.employeeId;
        if (!empId) {
          const match = allEmployeesList.find(e =>
            e.name.toLowerCase().trim() === row.name.toLowerCase().trim()
          );
          empId = match?.id;
        }

        if (empId) {
          const extraVerbasJson = {
            valor_bruto: row.valorBruto || 0,
            valor_desconto: row.valorDesconto || 0,
            valor_liquido: row.valorLiquido || row.valorBruto || 0,
            valor_vr: row.valorVR || 0,
            valor_vt: row.valorVT || 0,
            valor_seguro: row.valorSeguro || 0,
            valor_fgts: row.valorFGTS || 0,
            valor_gps: row.valorGPS || 0,
            valor_dec_terceiro: row.valorDecTerceiro || 0,
            valor_ferias: row.valorFerias || 0,
            custom_values: row.customValues || {}
          };

          const cleanCostPayload = {
            employee_id: empId,
            competencia,
            valor_fixo: row.valorBruto || 0,
            valor_bonus: row.valorBonus || 0,
            valor_comissao: row.valorComissao || 0,
            valor_ajuda_custo: row.valorAjudaCusto || 0,
            valor_incentivos: row.valorOutros || 0,
            valor_liquido: row.valorLiquido || row.valorBruto || 0,
            verbas_adicionais: extraVerbasJson,
            vinculo_tipo: row.employeeType === 'PJ' ? 'PJ-MEI' : row.employeeType === 'Estagio' ? 'Estagio' : 'CLT'
          };

          try {
            const { data: existingCost } = await supabase
              .from(costsTable)
              .select('id')
              .eq('employee_id', empId)
              .eq('competencia', competencia)
              .maybeSingle();

            if (existingCost?.id) {
              await supabase.from(costsTable).update(cleanCostPayload).eq('id', existingCost.id);
            } else {
              await supabase.from(costsTable).insert([cleanCostPayload]);
            }
          } catch (errRow: any) {
            console.warn(`Aviso ao salvar custo do colaborador ${row.name} no Supabase:`, errRow);
          }
        }
      }

      setSavedTimestamp(nowIso);
      setSaveSuccessMessage(`Apuração de ${competencia} salva e sincronizada com a nuvem para todos os usuários!`);
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setError(`Erro ao salvar: ${err?.message || 'Verifique sua conexão.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettlement = async () => {
    if (!confirm(`Recarregar competência ${competencia}? Todas as edições não salvas serão revertidas.`)) return;
    localStorage.removeItem(`outsourcing_rows_${competencia}${isTestMode ? '_test' : ''}`);
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
      valorBruto: 0, valorDesconto: 0, valorLiquido: 0,
      valorBonus: 0, valorComissao: 0, valorAjudaCusto: 0,
      valorVR: 0, valorVT: 0, valorSeguro: 0, valorFGTS: 0, valorGPS: 0,
      valorDecTerceiro: 0, valorFerias: 0, valorOutros: 0, valorEmprestimo: 0,
      customValues: {}
    }]);
  };

  const handleRemoveRow = (id: string) =>
    setRows(prev => prev.filter(r => r.id !== id));

  const handleRowChange = (id: string, field: keyof OutsourcingRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        // Atualizar Valor Líquido automaticamente ao editar Bruto ou Desconto
        if (field === 'valorBruto' || field === 'valorDesconto') {
          const bruto = parseFloat(String(field === 'valorBruto' ? value : r.valorBruto)) || 0;
          const desconto = parseFloat(String(field === 'valorDesconto' ? value : r.valorDesconto)) || 0;
          updated.valorLiquido = bruto - desconto;
        }
        return updated;
      }
      return r;
    }));
  };

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

  // ── Upload PDF (placeholder) ────────────────
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfUploading(true);
    try {
      alert(`Arquivo PDF "${file.name}" recebido. Utilize o botão "Importar Planilha" (.xlsx/.csv) para carregar os valores estruturados.`);
    } finally {
      setPdfUploading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  // ── Cálculos financeiros ─────────────────────
  // O valor total é a soma do valor líquido mais todas as demais colunas
  const rowTotalMap = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => {
      const customSum = Object.values(r.customValues || {}).reduce((a, v) => a + (v || 0), 0);
      const liq = (r.valorLiquido !== undefined && r.valorLiquido !== null)
        ? r.valorLiquido
        : ((r.valorBruto || 0) - (r.valorDesconto || 0));

      const total = liq +
        (r.valorAjudaCusto || 0) +
        (r.valorBonus || 0) +
        (r.valorComissao || 0) +
        (r.valorVR || 0) +
        (r.valorVT || 0) +
        (r.valorSeguro || 0) +
        (r.valorFGTS || 0) +
        (r.valorGPS || 0) +
        (r.valorDecTerceiro || 0) +
        (r.valorFerias || 0) +
        (r.valorOutros || 0) +
        (r.valorEmprestimo || 0) +
        customSum;

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

  // Taxa de administração (% ou R$ Absoluto)
  const calculatedAdminFee = useMemo(() =>
    adminFeeMode === 'rate' ? subtotal * (adminFeeRate / 100) : (adminFeeFixedAmount || 0),
    [subtotal, adminFeeMode, adminFeeRate, adminFeeFixedAmount]
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

  // Totais por coluna com 2 casas decimais
  const colTotals = useMemo(() => ({
    valorBruto: rows.reduce((a, r) => a + (r.valorBruto || 0), 0),
    valorDesconto: rows.reduce((a, r) => a + (r.valorDesconto || 0), 0),
    valorLiquido: rows.reduce((a, r) => a + (r.valorLiquido || 0), 0),
    valorBonus: rows.reduce((a, r) => a + (r.valorBonus || 0), 0),
    valorComissao: rows.reduce((a, r) => a + (r.valorComissao || 0), 0),
    valorAjudaCusto: rows.reduce((a, r) => a + (r.valorAjudaCusto || 0), 0),
    valorVR: rows.reduce((a, r) => a + (r.valorVR || 0), 0),
    valorVT: rows.reduce((a, r) => a + (r.valorVT || 0), 0),
    valorSeguro: rows.reduce((a, r) => a + (r.valorSeguro || 0), 0),
    valorFGTS: rows.reduce((a, r) => a + (r.valorFGTS || 0), 0),
    valorGPS: rows.reduce((a, r) => a + (r.valorGPS || 0), 0),
    valorDecTerceiro: rows.reduce((a, r) => a + (r.valorDecTerceiro || 0), 0),
    valorFerias: rows.reduce((a, r) => a + (r.valorFerias || 0), 0),
    valorOutros: rows.reduce((a, r) => a + (r.valorOutros || 0), 0),
    valorEmprestimo: rows.reduce((a, r) => a + (r.valorEmprestimo || 0), 0),
    custom: Object.fromEntries(
      customColumns.map(col => [col.id, rows.reduce((a, r) => a + (r.customValues?.[col.id] || 0), 0)])
    )
  }), [rows, customColumns]);

  // Resumo por localidade
  const locationSummary = useMemo(() => {
    const map = new Map<string, any>();
    rows.forEach(r => {
      const loc = r.location || 'Não especificado';
      const ex = map.get(loc) || {
        location: loc, count: 0, total: 0,
        valorBruto: 0, valorDesconto: 0, valorLiquido: 0,
        valorAjudaCusto: 0, valorBonus: 0, valorVR: 0, valorVT: 0,
        valorSeguro: 0, valorFGTS: 0, valorGPS: 0,
        valorDecTerceiro: 0, valorFerias: 0, valorEmprestimo: 0, valorOutros: 0
      };
      ex.count++;
      ex.total += rowTotalMap.get(r.id) || 0;
      ex.valorBruto += r.valorBruto || 0;
      ex.valorDesconto += r.valorDesconto || 0;
      ex.valorLiquido += r.valorLiquido || 0;
      ex.valorAjudaCusto += r.valorAjudaCusto || 0;
      ex.valorBonus += r.valorBonus || 0;
      ex.valorVR += r.valorVR || 0;
      ex.valorVT += r.valorVT || 0;
      ex.valorSeguro += r.valorSeguro || 0;
      ex.valorFGTS += r.valorFGTS || 0;
      ex.valorGPS += r.valorGPS || 0;
      ex.valorDecTerceiro += r.valorDecTerceiro || 0;
      ex.valorFerias += r.valorFerias || 0;
      ex.valorEmprestimo += r.valorEmprestimo || 0;
      ex.valorOutros += r.valorOutros || 0;

      map.set(loc, ex);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows, rowTotalMap]);

  // ── Copiar relatório executivo ────────────────
  const handleCopyReport = () => {
    let txt = `=== APURAÇÃO DE TERCEIRIZAÇÃO — ${competencia} ===\n\n`;
    txt += `Colaboradores: ${rows.length}\n`;
    txt += `Valor Bruto Total: ${fmt(colTotals.valorBruto)}\n`;
    txt += `Descontos de Folha: ${fmt(colTotals.valorDesconto)}\n`;
    txt += `Valor Líquido de Salários: ${fmt(colTotals.valorLiquido)}\n`;
    txt += `Subtotal de Verbas & Custos: ${fmt(subtotal)}\n`;
    txt += `ISS/Impostos (${taxInputMode === 'rate' ? `${taxRate}%` : 'Fixo'}): ${fmt(calculatedTax)}\n`;
    txt += `Taxa Administrativa (${adminFeeMode === 'rate' ? `${adminFeeRate}%` : fmt(adminFeeFixedAmount)}): ${fmt(calculatedAdminFee)}\n`;
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
                Bruto · Descontos · Líquido · Duplo check por localidade · Importação XLSX/CSV · Repasses
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

            {/* Importar Planilha (XLSX / CSV) */}
            <input
              ref={spreadsheetInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleSpreadsheetUpload}
            />
            <button
              onClick={() => spreadsheetInputRef.current?.click()}
              disabled={spreadsheetImporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
              title="Importar dados de planilha Excel (.xlsx/.xls) ou CSV"
            >
              <FileSpreadsheet size={13} className={spreadsheetImporting ? 'animate-spin' : ''} />
              <span>{spreadsheetImporting ? 'Lendo...' : 'Importar Planilha'}</span>
            </button>

            {/* Baixar Modelo XLSX */}
            <button
              onClick={exportOutsourcingTemplate}
              className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-800 rounded-xl transition-all active:scale-95"
              title="Baixar planilha modelo Excel (.xlsx) pré-formatada"
            >
              <Download size={14} />
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
              {saving ? 'Salvando...' : 'Salvar Apuração'}
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
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide block">Subtotal Geral</span>
              <span className="text-base font-black text-blue-700 block mt-0.5">{fmt(subtotal)}</span>
              <span className="text-[9px] text-gray-400">Líquido ({fmt(colTotals.valorLiquido)}) + Verbas</span>
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

          {/* Total Apurado (com Taxa Admin) */}
          <div className="bg-white border border-emerald-100 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide block">Total Apurado</span>
              <span className="text-base font-black text-emerald-700 block mt-0.5">{fmt(totalApuradoBruto)}</span>
              <span className="text-[9px] text-gray-400">
                + Taxa admin ({adminFeeMode === 'rate' ? `${adminFeeRate}%` : fmt(adminFeeFixedAmount)})
              </span>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleAddManualRow}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition-all active:scale-95 shadow-sm"
                      >
                        <Plus size={13} /> Linha Manual
                      </button>

                      <button
                        onClick={() => spreadsheetInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-all active:scale-95 shadow-sm"
                      >
                        <FileSpreadsheet size={13} /> Importar XLSX / CSV
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

                    <div className="text-xs text-gray-500 font-semibold flex items-center gap-3">
                      <span>Líquido: <strong className="text-blue-700">{fmt(colTotals.valorLiquido)}</strong></span>
                      <span>Total Geral: <strong className="text-gray-900 font-black">{fmt(subtotal)}</strong></span>
                    </div>
                  </div>

                  {/* ── BARRA DE ROLAGEM HORIZONTAL SUPERIOR SINCRONIZADA EM TEMPO REAL ── */}
                  {/* O div interno (phantomRef) tem sua largura definida diretamente pelo ResizeObserver */}
                  <div
                    ref={topScrollRef}
                    onScroll={handleTopScroll}
                    className="w-full overflow-x-auto bg-gray-100/90 border border-gray-200 rounded-xl shadow-inner cursor-pointer"
                    style={{ height: '14px' }}
                    title="Barra de rolagem superior sincronizada"
                  >
                    <div ref={phantomRef} style={{ height: '1px', minWidth: '100%' }} />
                  </div>

                  {/* ── TABELA PRINCIPAL COM COLUNAS FIXAS À ESQUERDA ── */}
                  <div
                    ref={tableScrollRef}
                    onScroll={handleTableScroll}
                    className="bg-white border border-gray-100 rounded-2xl overflow-x-auto shadow-sm relative"
                  >
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-400">
                          {/* 1. Colaborador (FIXO) */}
                          <th className="py-3 px-3 min-w-[190px] w-[190px] sticky left-0 bg-gray-50 z-30">
                            Colaborador
                          </th>
                          {/* 2. Localidade (FIXO) */}
                          <th className="py-3 px-3 min-w-[140px] w-[140px] sticky left-[190px] bg-gray-50 z-30">
                            Localidade
                          </th>
                          {/* 3. Valor Bruto (FIXO com borda divisória) */}
                          <th className="py-3 px-2 text-right min-w-[115px] w-[115px] sticky left-[330px] bg-blue-50/90 text-blue-700 z-30 border-r border-gray-200 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.06)]">
                            Valor Bruto
                          </th>

                          {/* Demais colunas que rolam livremente */}
                          <th className="py-3 px-2 text-right min-w-[95px] bg-red-50 text-red-700">Desconto (-)</th>
                          <th className="py-3 px-2 text-right min-w-[115px] bg-blue-100/60 text-blue-800 font-black">Valor Líquido</th>
                          <th className="py-3 px-2 min-w-[75px] text-center">Tipo</th>
                          <th className="py-3 px-2 text-right min-w-[95px]">Adiantamento</th>
                          <th className="py-3 px-2 text-right min-w-[95px]">Bônus</th>
                          <th className="py-3 px-2 text-right min-w-[85px] bg-green-50 text-green-700">VR</th>
                          <th className="py-3 px-2 text-right min-w-[85px] bg-green-50 text-green-700">VT</th>
                          <th className="py-3 px-2 text-right min-w-[85px]">Seguro</th>
                          <th className="py-3 px-2 text-right min-w-[85px] bg-orange-50 text-orange-700">FGTS</th>
                          <th className="py-3 px-2 text-right min-w-[85px] bg-orange-50 text-orange-700">GPS</th>
                          <th className="py-3 px-2 text-right min-w-[85px] bg-purple-50 text-purple-700">13º Sal.</th>
                          <th className="py-3 px-2 text-right min-w-[85px] bg-purple-50 text-purple-700">Férias</th>
                          <th className="py-3 px-2 text-right min-w-[85px]">Outros</th>
                          <th className="py-3 px-2 text-right min-w-[95px] bg-indigo-50 text-indigo-700">Emprést.</th>
                          {/* Colunas customizadas */}
                          {customColumns.map(col => (
                            <th key={col.id} className="py-3 px-2 text-right min-w-[95px] bg-gray-50">
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
                          <th className="py-3 px-3 text-right min-w-[125px] font-black text-gray-800 bg-white">Total</th>
                          <th className="py-3 px-2 w-8 text-center"></th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-50">
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={22} className="py-16 text-center text-gray-400 font-medium">
                              Nenhum colaborador terceirizado encontrado para esta competência.{' '}
                              <button onClick={handleAddManualRow} className="text-blue-500 underline mr-2">
                                Adicionar linha manual
                              </button>
                              ou{' '}
                              <button onClick={() => spreadsheetInputRef.current?.click()} className="text-emerald-600 underline font-bold">
                                importar planilha Excel / CSV
                              </button>.
                            </td>
                          </tr>
                        ) : rows.map(row => {
                          const rTotal = rowTotalMap.get(row.id) || 0;
                          return (
                            <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                              {/* 1. Nome (FIXO) */}
                              <td className="py-2 px-3 sticky left-0 min-w-[190px] w-[190px] bg-white hover:bg-blue-50/30 z-20">
                                {row.isManual ? (
                                  <input
                                    type="text"
                                    value={row.name}
                                    onChange={e => handleRowChange(row.id, 'name', e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:border-blue-400"
                                  />
                                ) : (
                                  <span className="font-semibold text-gray-800 block truncate" title={row.name}>{row.name}</span>
                                )}
                              </td>

                              {/* 2. Localidade (FIXO) */}
                              <td className="py-2 px-3 sticky left-[190px] min-w-[140px] w-[140px] bg-white hover:bg-blue-50/30 z-20">
                                <input
                                  type="text"
                                  value={row.location}
                                  onChange={e => handleRowChange(row.id, 'location', e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-xs text-gray-600 outline-none focus:border-blue-300"
                                />
                              </td>

                              {/* 3. Valor Bruto (FIXO com borda divisória) */}
                              <td className="py-2 px-2 text-right sticky left-[330px] min-w-[115px] w-[115px] bg-blue-50/70 hover:bg-blue-50 z-20 border-r border-gray-200 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.06)]">
                                <DecimalInput
                                  value={row.valorBruto}
                                  onChange={v => handleRowChange(row.id, 'valorBruto', v)}
                                  width="w-24"
                                  className="font-bold text-blue-800"
                                />
                              </td>

                              {/* Desconto (-) */}
                              <td className="py-2 px-2 text-right bg-red-50/40">
                                <DecimalInput
                                  value={row.valorDesconto}
                                  onChange={v => handleRowChange(row.id, 'valorDesconto', v)}
                                  width="w-20"
                                  className="text-red-700"
                                />
                              </td>

                              {/* Valor Líquido (Auto Calculado: Bruto - Desconto) */}
                              <td className="py-2 px-2 text-right bg-blue-100/40">
                                <span className="text-xs font-black text-blue-900 px-2 py-1 bg-white/90 border border-blue-200 rounded-lg inline-block w-24 text-right">
                                  {fmt(row.valorLiquido)}
                                </span>
                              </td>

                              {/* Tipo */}
                              <td className="py-2 px-2 text-center">
                                <select
                                  value={row.employeeType}
                                  onChange={e => handleRowChange(row.id, 'employeeType', e.target.value as EmployeeType)}
                                  className="bg-transparent text-[10px] font-bold outline-none cursor-pointer text-center"
                                  title="Tipo de vínculo"
                                >
                                  {(Object.keys(EMPLOYEE_TYPE_CONFIG) as EmployeeType[]).map(t => (
                                    <option key={t} value={t}>{EMPLOYEE_TYPE_CONFIG[t].label}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Adiantamento */}
                              <td className="py-2 px-2 text-right">
                                <DecimalInput value={row.valorAjudaCusto} onChange={v => handleRowChange(row.id, 'valorAjudaCusto', v)} width="w-20" />
                              </td>
                              {/* Bônus */}
                              <td className="py-2 px-2 text-right">
                                <DecimalInput value={row.valorBonus} onChange={v => handleRowChange(row.id, 'valorBonus', v)} width="w-20" />
                              </td>
                              {/* VR */}
                              <td className="py-2 px-2 text-right bg-green-50/40">
                                <DecimalInput value={row.valorVR} onChange={v => handleRowChange(row.id, 'valorVR', v)} width="w-20" />
                              </td>
                              {/* VT */}
                              <td className="py-2 px-2 text-right bg-green-50/40">
                                <DecimalInput value={row.valorVT} onChange={v => handleRowChange(row.id, 'valorVT', v)} width="w-20" />
                              </td>
                              {/* Seguro */}
                              <td className="py-2 px-2 text-right">
                                <DecimalInput value={row.valorSeguro} onChange={v => handleRowChange(row.id, 'valorSeguro', v)} width="w-20" />
                              </td>
                              {/* FGTS */}
                              <td className="py-2 px-2 text-right bg-orange-50/40">
                                <DecimalInput value={row.valorFGTS} onChange={v => handleRowChange(row.id, 'valorFGTS', v)} width="w-20" />
                              </td>
                              {/* GPS */}
                              <td className="py-2 px-2 text-right bg-orange-50/40">
                                <DecimalInput value={row.valorGPS} onChange={v => handleRowChange(row.id, 'valorGPS', v)} width="w-20" />
                              </td>
                              {/* 13º */}
                              <td className="py-2 px-2 text-right bg-purple-50/40">
                                <DecimalInput value={row.valorDecTerceiro} onChange={v => handleRowChange(row.id, 'valorDecTerceiro', v)} width="w-20" />
                              </td>
                              {/* Férias */}
                              <td className="py-2 px-2 text-right bg-purple-50/40">
                                <DecimalInput value={row.valorFerias} onChange={v => handleRowChange(row.id, 'valorFerias', v)} width="w-20" />
                              </td>
                              {/* Outros */}
                              <td className="py-2 px-2 text-right">
                                <DecimalInput value={row.valorOutros} onChange={v => handleRowChange(row.id, 'valorOutros', v)} width="w-20" />
                              </td>
                              {/* Empréstimos */}
                              <td className="py-2 px-2 text-right bg-indigo-50/40">
                                <DecimalInput value={row.valorEmprestimo} onChange={v => handleRowChange(row.id, 'valorEmprestimo', v)} width="w-20" />
                              </td>
                              {/* Custom */}
                              {customColumns.map(col => (
                                <td key={col.id} className="py-2 px-2 text-right bg-gray-50/60">
                                  <DecimalInput
                                    value={row.customValues?.[col.id] || 0}
                                    onChange={v => handleCustomValueChange(row.id, col.id, v)}
                                    width="w-20"
                                  />
                                </td>
                              ))}
                              {/* Total (Líquido + Demais Colunas) */}
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
                          {/* Colunas fixas no rodapé */}
                          <td className="py-3 px-3 sticky left-0 min-w-[190px] w-[190px] bg-blue-600 z-30">
                            TOTAIS ({rows.length})
                          </td>
                          <td className="py-3 px-3 sticky left-[190px] min-w-[140px] w-[140px] bg-blue-600 z-30">
                            —
                          </td>
                          <td className="py-3 px-2 text-right sticky left-[330px] min-w-[115px] w-[115px] bg-blue-700 z-30 border-r border-blue-500 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.15)]">
                            {fmt(colTotals.valorBruto)}
                          </td>

                          {/* Demais totais */}
                          <td className="py-3 px-2 text-right bg-blue-700/80">{fmt(colTotals.valorDesconto)}</td>
                          <td className="py-3 px-2 text-right bg-blue-800 font-black">{fmt(colTotals.valorLiquido)}</td>
                          <td className="py-3 px-2 text-center">—</td>
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

                          {/* Detalhamento de verbas com 2 casas decimais */}
                          <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                            {[
                              { label: 'Bruto', value: ls.valorBruto, color: 'text-blue-700' },
                              { label: 'Líquido', value: ls.valorLiquido, color: 'text-blue-900 font-black' },
                              { label: 'Adit.', value: ls.valorAjudaCusto, color: 'text-gray-700' },
                              { label: 'VR', value: ls.valorVR, color: 'text-green-700' },
                              { label: 'VT', value: ls.valorVT, color: 'text-green-700' },
                              { label: 'FGTS', value: ls.valorFGTS, color: 'text-orange-700' },
                              { label: 'GPS', value: ls.valorGPS, color: 'text-orange-700' },
                              { label: '13º', value: ls.valorDecTerceiro, color: 'text-purple-700' },
                            ].map(({ label, value, color }) => (
                              value > 0 && (
                                <div key={label} className="bg-gray-50 rounded-lg p-1.5 text-center">
                                  <span className="text-gray-400 block">{label}</span>
                                  <span className={`font-bold ${color} block`}>
                                    {fmt(value)}
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
                          <th className="py-3 px-3 text-right">Valor Bruto</th>
                          <th className="py-3 px-3 text-right">Descontos</th>
                          <th className="py-3 px-3 text-right">Valor Líquido</th>
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
                            <td className="py-3 px-3 text-right text-blue-700 font-semibold">{fmt(ls.valorBruto || 0)}</td>
                            <td className="py-3 px-3 text-right text-red-600 font-semibold">{fmt(ls.valorDesconto || 0)}</td>
                            <td className="py-3 px-3 text-right text-blue-900 font-black">{fmt(ls.valorLiquido || 0)}</td>
                            <td className="py-3 px-3 text-right text-green-700 font-semibold">
                              {fmt((ls.valorVR || 0) + (ls.valorVT || 0) + (ls.valorSeguro || 0))}
                            </td>
                            <td className="py-3 px-3 text-right text-orange-700 font-semibold">
                              {fmt((ls.valorFGTS || 0) + (ls.valorGPS || 0))}
                            </td>
                            <td className="py-3 px-3 text-right text-purple-700 font-semibold">
                              {fmt((ls.valorDecTerceiro || 0) + (ls.valorFerias || 0))}
                            </td>
                            <td className="py-3 px-3 text-right text-indigo-700 font-semibold">{fmt(ls.valorEmprestimo || 0)}</td>
                            <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">{fmt(ls.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-blue-600 text-white text-[10px] font-black uppercase">
                          <td className="py-3 px-4">TOTAL CONSOLIDADO</td>
                          <td className="py-3 px-3 text-center">{rows.length}</td>
                          <td className="py-3 px-3 text-right">{fmt(colTotals.valorBruto)}</td>
                          <td className="py-3 px-3 text-right">{fmt(colTotals.valorDesconto)}</td>
                          <td className="py-3 px-3 text-right">{fmt(colTotals.valorLiquido)}</td>
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

                    {/* Configurações de encargos & taxas */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <Percent size={14} className="text-blue-500" /> Configurações de Encargos & Taxas
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
                                  <DecimalInput
                                    value={taxRate}
                                    onChange={v => setTaxRate(v)}
                                    width="w-20"
                                    className="border-amber-200 font-bold"
                                  />
                                  <span className="text-xs font-bold text-amber-600">%</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-bold text-amber-600">R$</span>
                                  <DecimalInput
                                    value={taxFixedAmount}
                                    onChange={v => setTaxFixedAmount(v)}
                                    width="w-28"
                                    className="border-amber-200 font-bold"
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

                        {/* Taxa Administrativa (Opção % ou Valor Fixo R$) */}
                        <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-blue-700 tracking-wider block">Taxa Administrativa</span>
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                onClick={() => setAdminFeeMode(prev => prev === 'rate' ? 'amount' : 'rate')}
                                className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-all"
                              >
                                {adminFeeMode === 'rate' ? '% Alíquota' : 'R$ Fixo'}
                              </button>
                              {adminFeeMode === 'rate' ? (
                                <div className="flex items-center gap-1">
                                  <DecimalInput
                                    value={adminFeeRate}
                                    onChange={v => setAdminFeeRate(v)}
                                    width="w-20"
                                    className="border-blue-200 font-bold"
                                  />
                                  <span className="text-xs font-bold text-blue-600">%</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-bold text-blue-600">R$</span>
                                  <DecimalInput
                                    value={adminFeeFixedAmount}
                                    onChange={v => setAdminFeeFixedAmount(v)}
                                    width="w-28"
                                    className="border-blue-200 font-bold"
                                  />
                                </div>
                              )}
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
                          { label: 'Valor Bruto Total', value: colTotals.valorBruto, color: 'text-gray-700' },
                          { label: 'Descontos de Folha (-)', value: colTotals.valorDesconto, color: 'text-red-600' },
                          { label: 'Valor Líquido de Salários', value: colTotals.valorLiquido, color: 'text-blue-800 font-bold' },
                          { label: 'Subtotal Geral (Líquido + Verbas)', value: subtotal, color: 'text-gray-900 font-bold' },
                          { label: `ISS / Impostos (${taxInputMode === 'rate' ? `${taxRate.toFixed(2)}%` : 'Fixo'})`, value: calculatedTax, color: 'text-amber-600' },
                          { label: `Taxa Administrativa (${adminFeeMode === 'rate' ? `${adminFeeRate.toFixed(2)}%` : fmt(adminFeeFixedAmount)})`, value: calculatedAdminFee, color: 'text-blue-600' },
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
                                <DecimalInput
                                  value={line.amount}
                                  onChange={v => handleRepassLineChange(line.id, 'amount', v)}
                                  width="w-32"
                                  className="font-bold text-emerald-700"
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
