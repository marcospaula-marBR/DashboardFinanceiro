"use client";

import React, { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  UploadCloud, Filter, XCircle, LayoutDashboard, TableIcon, Settings, Plus, X, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Percent, Download, Eye, EyeOff,
  ChevronLeft
} from 'lucide-react';

// ─── LOCAL TYPES ────────────────────────────────────────────────────────────

interface DreRow {
  Projeto: string;
  Empresa: string;
  Categoria: string;
  [key: string]: string | number; // dynamic month columns like "jan/24"
}

interface DreFilters {
  empresas: string[];
  periodos: string[];
  projetos: string[];
  categorias: string[];
}

interface DreMetadata {
  empresas: string[];
  projetos: string[];
  categorias: string[];
  periodos: string[];
  mapaMeses: Record<string, string>;
}

// ─── CONSTANTS & SUGGESTED HELPERS ──────────────────────────────────────────

const MESES_ORDEM = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const normalizeMes = (mes: string) => mes.trim().charAt(0).toUpperCase() + mes.trim().slice(1).toLowerCase();
const toTitleCase = (str: string) => str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());

const DRE_GRUPOS = [
  { id: 'receitas_operacionais', label: 'Receitas Operacionais', color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500' },
  { id: 'outras_entradas', label: 'Outras Entradas', color: '#3b82f6', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-500' },
  { id: 'impostos', label: 'Impostos', color: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500' },
  { id: 'custos_operacionais', label: 'Custos Operacionais', color: '#ef4444', bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-500' },
  { id: 'despesas_rateadas', label: 'Despesas Rateadas', color: '#ec4899', bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-500' },
  { id: 'investimentos', label: 'Investimentos', color: '#8b5cf6', bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-500' },
  { id: 'dividendos', label: 'Distribuição de Dividendos', color: '#6366f1', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-500' }
];

function suggestMapping(categories: string[]): Record<string, string[]> {
  const mapping: Record<string, string[]> = {
    receitas_operacionais: [],
    outras_entradas: [],
    impostos: [],
    custos_operacionais: [],
    despesas_rateadas: [],
    investimentos: [],
    dividendos: []
  };

  categories.forEach(cat => {
    const clean = cat.toLowerCase();
    
    if (clean.includes('receita bruta') || clean.includes('vendas') || clean.includes('faturamento') || clean.includes('receitas indiretas')) {
      mapping.receitas_operacionais.push(cat);
    }
    else if (clean.includes('outras receitas') || clean.includes('receitas financeiras') || clean.includes('honorários') || clean.includes('juros e devoluções') || clean.includes('recuperação')) {
      mapping.outras_entradas.push(cat);
    }
    else if (clean.includes('imposto') || clean.includes('provisão - irpj') || clean.includes('tributo') || clean.includes('irpj') || clean.includes('cssl') || clean.includes('simples nacional')) {
      mapping.impostos.push(cat);
    }
    else if (clean.includes('credenciado operacional') || clean.includes('terceirização') || clean.includes('clts') || clean.includes('custo dos serviços') || clean.includes('preventiva') || clean.includes('corretiva') || clean.includes('manutenção') || clean.includes('despesas com pessoal')) {
      mapping.custos_operacionais.push(cat);
    }
    else if (clean.includes('dividendo') || clean.includes('distribuição de dividendos')) {
      mapping.dividendos.push(cat);
    }
    else if (clean.includes('consórcio') || clean.includes('ativos') || clean.includes('serviços')) {
      mapping.investimentos.push(cat);
    }
    else {
      mapping.despesas_rateadas.push(cat);
    }
  });

  return mapping;
}

export default function DreCustomPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'table' | 'mapping'>('dashboard');

  const [rawData, setRawData] = useState<DreRow[]>([]);
  const [metadata, setMetadata] = useState<DreMetadata | null>(null);
  
  // Custom Dynamic Mapping State
  const [mapping, setMapping] = useState<Record<string, string[]>>({
    receitas_operacionais: [],
    outras_entradas: [],
    impostos: [],
    custos_operacionais: [],
    despesas_rateadas: [],
    investimentos: [],
    dividendos: []
  });

  const [filters, setFilters] = useState<DreFilters>({
    empresas: [],
    periodos: [],
    projetos: [],
    categorias: []
  });

  // Drill-down Modal State
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsTitle, setDetailsTitle] = useState("");
  const [detailsRows, setDetailsRows] = useState<DreRow[]>([]);

  // Parser & Normalizer
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "ISO-8859-1",
      complete: (results) => {
        let parsed = results.data;
        if (parsed.length === 0 || (results.meta.fields && results.meta.fields.length < 3)) {
          // Fallback UTF-8
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            encoding: "UTF-8",
            complete: (utfResults) => processNormalizedData(utfResults.data),
            error: (err) => {
              alert("Erro ao ler arquivo: " + err.message);
              setIsUploading(false);
            }
          });
        } else {
          processNormalizedData(parsed);
        }
      },
      error: (err) => {
        alert("Erro ao ler arquivo: " + err.message);
        setIsUploading(false);
      }
    });
  };

  const processNormalizedData = (rawList: any[]) => {
    const PORTUGUESE_MONTHS_MAP: Record<string, string> = {
      janeiro: 'Jan', jan: 'Jan',
      fevereiro: 'Fev', fev: 'Fev',
      marco: 'Mar', março: 'Mar', mar: 'Mar',
      abril: 'Abr', abr: 'Abr',
      maio: 'Mai', mai: 'Mai',
      junho: 'Jun', jun: 'Jun',
      julho: 'Jul', jul: 'Jul',
      agosto: 'Ago', ago: 'Ago',
      setembro: 'Set', set: 'Set',
      outubro: 'Out', out: 'Out',
      novembro: 'Nov', nov: 'Nov',
      dezembro: 'Dez', dez: 'Dez'
    };

    const detectPeriodColumn = (header: string) => {
      const clean = header.trim().toLowerCase().replace(/["']/g, '');
      if (!clean) return null;

      const slashParts = clean.split('/');
      if (slashParts.length === 2) {
        const mesPart = slashParts[0].trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const norm = PORTUGUESE_MONTHS_MAP[mesPart];
        if (norm) {
          let anoPart = slashParts[1].trim();
          if (anoPart.length === 2) anoPart = '20' + anoPart;
          return { isPeriod: true, mesNormalizado: norm, ano: anoPart };
        }
      }

      const cleanAccentless = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const norm = PORTUGUESE_MONTHS_MAP[cleanAccentless];
      if (norm) {
        return { isPeriod: true, mesNormalizado: norm, ano: '2026' }; // Default fallback year
      }

      return null;
    };

    const parseVal = (valStr: string): number => {
      if (!valStr) return 0;
      let clean = valStr.trim().replace(/R\$\s?/i, '').replace(/\s/g, '');
      let isNegative = false;
      if (clean.startsWith('(') && clean.endsWith(')')) {
        isNegative = true;
        clean = clean.substring(1, clean.length - 1);
      }
      if (clean.startsWith('-')) {
        isNegative = true;
        clean = clean.substring(1);
      }
      if (clean.includes(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      }
      let num = parseFloat(clean);
      if (isNaN(num)) return 0;
      return isNegative ? -Math.abs(num) : num;
    };

    // 1. Check if the CSV is a Transaction Log (Format B) or monthly pivoted DRE (Format A)
    let dateKey = '';
    let valorKey = '';

    if (rawList[0]) {
      Object.keys(rawList[0]).forEach(key => {
        const lKey = key.trim().toLowerCase();
        if (lKey === 'data' || lKey === 'data (completa)' || lKey === 'data completa') {
          dateKey = key;
        } else if (!dateKey && lKey.includes('data')) {
          dateKey = key;
        }

        if (lKey === 'valor' || lKey === 'valor pago' || lKey === 'valor total') {
          valorKey = key;
        } else if (!valorKey && lKey.includes('valor')) {
          valorKey = key;
        }
      });
    }

    const isTransactionLog = dateKey && valorKey;

    if (isTransactionLog) {
      const groups: Record<string, {
        Empresa: string;
        'Conta DRE': string;
        Categoria: string;
        Projeto: string;
        Departamento: string;
        valores: Record<string, number>;
      }> = {};

      const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

      rawList.forEach(row => {
        const rawDate = (row[dateKey] || '').toString().trim();
        if (!rawDate) return;

        const dateParts = rawDate.split(/[\/\-]/);
        if (dateParts.length !== 3) return;

        let mes = '';
        let ano = '';

        if (dateParts[0].length === 4) {
          // YYYY-MM-DD
          mes = MONTHS_SHORT[parseInt(dateParts[1]) - 1];
          ano = dateParts[0];
        } else {
          // MM/DD/YYYY or DD/MM/YYYY
          const p0 = parseInt(dateParts[0]);
          const p1 = parseInt(dateParts[1]);
          const p2 = dateParts[2].length === 2 ? '20' + dateParts[2] : dateParts[2];

          // Check US style vs BR style: standard Omie OLAP has MM/DD/YYYY if p0 <= 12 and p1 > 12
          if (p0 <= 12 && p1 > 12) {
            mes = MONTHS_SHORT[p0 - 1];
          } else if (p0 > 12 && p1 <= 12) {
            mes = MONTHS_SHORT[p1 - 1];
          } else {
            // Default to first part as month
            mes = MONTHS_SHORT[p0 - 1];
          }
          ano = p2;
        }

        if (!mes) return;
        const periodKey = `${mes}/${ano.slice(-2)}`;

        const numVal = parseVal(row[valorKey]);

        let empresa = '';
        let contaDre = '';
        let categoria = '';
        let projeto = '';
        let departamento = '';

        Object.keys(row).forEach(key => {
          const lKey = key.trim().toLowerCase();
          const val = (row[key] || '').toString().trim();
          if (lKey === 'minha empresa (razao social)' || lKey === 'minha empresa (razǜo social)' || lKey === 'empresa' || lKey === 'minha empresa') {
            empresa = val;
          } else if (!empresa && lKey.includes('empresa') && !lKey.includes('cnpj')) {
            empresa = val;
          }

          if (lKey === 'conta do dre' || lKey === 'conta dre') {
            contaDre = val;
          }

          if (lKey === 'categoria') {
            categoria = val;
          }

          if (lKey === 'projeto') {
            projeto = val;
          }

          if (lKey === 'departamento') {
            departamento = val;
          }
        });

        if (!empresa || empresa === 'N/D') empresa = 'Geral';
        if (!contaDre || contaDre === 'N/D') contaDre = 'Sem Classificação';
        if (!categoria || categoria === 'N/D') categoria = 'Sem Categoria';
        if (!projeto || projeto === 'N/D') projeto = 'Sem Projeto';
        if (!departamento || departamento === 'N/D') departamento = 'Sem Departamento';

        const groupKey = `${empresa}|||${contaDre}|||${categoria}|||${projeto}|||${departamento}`;

        if (!groups[groupKey]) {
          groups[groupKey] = {
            Empresa: empresa,
            'Conta DRE': contaDre,
            Categoria: categoria,
            Projeto: projeto,
            Departamento: departamento,
            valores: {}
          };
        }

        groups[groupKey].valores[periodKey] = (groups[groupKey].valores[periodKey] || 0) + numVal;
      });

      rawList = Object.values(groups).map(g => {
        const rowObj: any = {
          Empresa: g.Empresa,
          'Conta DRE': g['Conta DRE'],
          Categoria: g.Categoria,
          Projeto: g.Projeto,
          Departamento: g.Departamento
        };
        Object.keys(g.valores).forEach(pk => {
          rowObj[pk] = g.valores[pk].toString();
        });
        return rowObj;
      });
    }

    // Forward fill trackers
    let lastEmpresa = '';
    let lastContaDre = '';
    let lastCategoria = '';
    let lastProjeto = '';
    let lastDepartamento = '';

    let normalized = rawList.map(row => {
      const newRow: any = {};
      Object.keys(row).forEach(key => {
        const cleanKey = key.trim().replace(/["']/g, '');
        if (!cleanKey) return;
        const lowerKey = cleanKey.toLowerCase();
        let finalKey = cleanKey;
        if (lowerKey === 'projeto') finalKey = 'Projeto';
        else if (lowerKey === 'categoria') finalKey = 'Categoria';
        else if (lowerKey === 'minha empresa' || lowerKey === 'empresa') finalKey = 'Empresa';
        else if (lowerKey === 'conta do dre' || lowerKey === 'conta dre') finalKey = 'Conta DRE';
        else if (lowerKey === 'departamento') finalKey = 'Departamento';
        newRow[finalKey] = row[key];
      });

      // Apply Forward Fill (Preenchimento Contínuo)
      const hasVal = (val: any) => val !== undefined && val !== null && val.toString().trim() !== '';

      if (hasVal(newRow.Empresa)) lastEmpresa = newRow.Empresa.toString().trim();
      else newRow.Empresa = lastEmpresa;

      if (hasVal(newRow['Conta DRE'])) lastContaDre = newRow['Conta DRE'].toString().trim();
      else newRow['Conta DRE'] = lastContaDre;

      if (hasVal(newRow.Categoria)) lastCategoria = newRow.Categoria.toString().trim();
      else newRow.Categoria = lastCategoria;

      if (hasVal(newRow.Projeto)) lastProjeto = newRow.Projeto.toString().trim();
      else newRow.Projeto = lastProjeto;

      if (hasVal(newRow.Departamento)) lastDepartamento = newRow.Departamento.toString().trim();
      else newRow.Departamento = lastDepartamento;

      return newRow;
    });

    // Clean empty sub-items or subtotal rows
    normalized = normalized.filter(row => {
      const proj = (row.Projeto || '').toString().toLowerCase();
      const cat = (row.Categoria || '').toString().toLowerCase();
      
      // Filter out empty rows or typical subtotal/total rows that could double count
      const isSubtotal = proj.includes('total') || proj.includes('subtotal') || cat.includes('total') || cat.includes('subtotal');
      const isHeaderRow = proj === 'projeto' && cat === 'categoria';

      return row.Projeto && row.Categoria && 
             row.Projeto.toString().trim() !== '' && row.Categoria.toString().trim() !== '' &&
             !isSubtotal && !isHeaderRow;
    });

    normalized.forEach(row => {
      row.Projeto = toTitleCase(row.Projeto.toString());
      row.Empresa = row.Empresa ? row.Empresa.toString().trim() : '';
      row.Categoria = row.Categoria ? row.Categoria.toString().trim() : '';
      row['Conta DRE'] = row['Conta DRE'] ? row['Conta DRE'].toString().trim() : '';
      row.Departamento = row.Departamento ? row.Departamento.toString().trim() : '';
    });

    if (normalized.length === 0) {
      alert("Nenhuma linha financeira válida encontrada no arquivo.");
      setIsUploading(false);
      return;
    }

    const allKeys = Object.keys(normalized[0]);
    const periodos: { col: string, mes: string, ano: string, full: string }[] = [];
    const mapaMeses: Record<string, string> = {};

    allKeys.forEach(col => {
      const detected = detectPeriodColumn(col);
      if (detected) {
        mapaMeses[col] = detected.mesNormalizado;
        periodos.push({ col, mes: detected.mesNormalizado, ano: detected.ano, full: col });
      }
    });

    periodos.sort((a, b) => {
      const yA = parseInt(a.ano);
      const yB = parseInt(b.ano);
      if (yA !== yB) return yA - yB;
      return MESES_ORDEM.indexOf(a.mes) - MESES_ORDEM.indexOf(b.mes);
    });

    const empresas = Array.from(new Set(normalized.map(d => d.Empresa).filter(Boolean))).sort() as string[];
    const projetos = Array.from(new Set(normalized.map(d => d.Projeto).filter(Boolean))).sort() as string[];
    const categorias = Array.from(new Set(normalized.map(d => d.Categoria).filter(Boolean))).sort() as string[];
    const periodosList = periodos.map(p => `${p.mes}/${p.ano.slice(-2)}`);

    setRawData(normalized);
    setMetadata({ empresas, projetos, categorias, periodos: periodosList, mapaMeses });
    
    // Auto Heuristic Mapping Selection
    const suggested = suggestMapping(categorias);
    setMapping(suggested);

    // Reset filters
    setFilters({ empresas: [], periodos: [], projetos: [], categorias: [] });
    setLastUpdate(new Date().toLocaleTimeString());
    setIsUploading(false);
  };

  // Check which categories are unmapped
  const unmappedCategories = useMemo(() => {
    if (!metadata) return [];
    const mapped = new Set(Object.values(mapping).flat());
    return metadata.categorias.filter(c => !mapped.has(c));
  }, [metadata, mapping]);

  // Handle Mappings Changes
  const handleAddCategoryToGroup = (groupId: string, cat: string) => {
    setMapping(prev => {
      const clean = { ...prev };
      // Remove from all other groups first (single group mapping)
      Object.keys(clean).forEach(k => {
        clean[k] = clean[k].filter(item => item !== cat);
      });
      clean[groupId] = [...clean[groupId], cat];
      return clean;
    });
  };

  const handleRemoveCategoryFromGroup = (groupId: string, cat: string) => {
    setMapping(prev => ({
      ...prev,
      [groupId]: prev[groupId].filter(item => item !== cat)
    }));
  };

  const handleClearFilters = () => {
    setFilters({ empresas: [], periodos: [], projetos: [], categorias: [] });
  };

  // ─── REACTIVE DRE CALCULATION ENGINE ──────────────────────────────────────────

  const calculated = useMemo(() => {
    if (rawData.length === 0 || !metadata) return null;

    let df = [...rawData];

    // Apply Dimensional Filters
    if (filters.empresas.length > 0) df = df.filter(row => filters.empresas.includes(row.Empresa));
    if (filters.projetos.length > 0) df = df.filter(row => filters.projetos.includes(row.Projeto));
    if (filters.categorias.length > 0) df = df.filter(row => filters.categorias.includes(row.Categoria));

    const allCols = Object.keys(metadata.mapaMeses);
    let validColumns = allCols;

    if (filters.periodos.length > 0) {
      validColumns = allCols.filter(col => {
        const mes = metadata.mapaMeses[col];
        const ano = col.split('/')[1]?.trim();
        return filters.periodos.includes(`${mes}/${ano}`);
      });
    }

    // Monthly summation of mapped categories
    const getGroupTotal = (groupId: string, col: string) => {
      let sum = 0;
      const cats = mapping[groupId] || [];
      df.forEach(row => {
        if (cats.includes(row.Categoria)) {
          const val = parseFloat(row[col]?.toString().replace(',', '.') || '0');
          if (!isNaN(val)) sum += val;
        }
      });
      return sum;
    };

    const getGroupTotalAllMonths = (groupId: string) => {
      let sum = 0;
      const cats = mapping[groupId] || [];
      df.forEach(row => {
        if (cats.includes(row.Categoria)) {
          validColumns.forEach(col => {
            const val = parseFloat(row[col]?.toString().replace(',', '.') || '0');
            if (!isNaN(val)) sum += val;
          });
        }
      });
      return sum;
    };

    // Calculate dynamic rows
    const monthlyData: Record<string, Record<string, number>> = {};
    const totalData: Record<string, number> = {};

    DRE_GRUPOS.forEach(g => {
      totalData[g.id] = getGroupTotalAllMonths(g.id);
      monthlyData[g.id] = {};
      validColumns.forEach(col => {
        monthlyData[g.id][col] = getGroupTotal(g.id, col);
      });
    });

    // Calculate aggregated results
    const getVal = (groupId: string) => totalData[groupId] || 0;
    const getValMensal = (groupId: string, col: string) => monthlyData[groupId]?.[col] || 0;

    // Formulas
    const totalEntradas = getVal('receitas_operacionais');
    const outrasEntradas = getVal('outras_entradas');
    const totalImpostos = getVal('impostos');
    const totalCustos = getVal('custos_operacionais');
    const totalDespesas = getVal('despesas_rateadas');
    const totalInvestimentos = getVal('investimentos');
    const dividendos = getVal('dividendos');

    const totalSaidas = totalImpostos + totalCustos + totalDespesas + totalInvestimentos;
    const resultado = totalEntradas + outrasEntradas - totalSaidas;
    const fcl = resultado;

    // Monthly aggregates
    const monthlyEntradas: Record<string, number> = {};
    const monthlySaidas: Record<string, number> = {};
    const monthlyFCL: Record<string, number> = {};

    validColumns.forEach(col => {
      const ent = getValMensal('receitas_operacionais', col);
      const out = getValMensal('outras_entradas', col);
      const imp = getValMensal('impostos', col);
      const cust = getValMensal('custos_operacionais', col);
      const desp = getValMensal('despesas_rateadas', col);
      const inv = getValMensal('investimentos', col);

      const sai = imp + cust + desp + inv;
      monthlyEntradas[col] = ent + out;
      monthlySaidas[col] = sai;
      monthlyFCL[col] = (ent + out) - sai;
    });

    return {
      totalEntradas,
      outrasEntradas,
      totalImpostos,
      totalCustos,
      totalDespesas,
      totalInvestimentos,
      totalSaidas,
      resultado,
      fcl,
      dividendos,
      validColumns,
      monthlyEntradas,
      monthlySaidas,
      monthlyFCL,
      totalData,
      monthlyData,
      filteredRows: df
    };
  }, [rawData, metadata, mapping, filters]);

  // Format Helper
  const formatCurrency = (val: number) => {
    if (isPrivacyMode) return 'R$ ••••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatPercentage = (val: number) => {
    if (isPrivacyMode) return '••%';
    return val.toFixed(1) + '%';
  };

  // Recharts Evolution data builder
  const chartData = useMemo(() => {
    if (!calculated) return [];
    return calculated.validColumns.map(col => ({
      name: col,
      'Entradas': calculated.monthlyEntradas[col] || 0,
      'Saídas': calculated.monthlySaidas[col] || 0,
      'FCL': calculated.monthlyFCL[col] || 0
    }));
  }, [calculated]);

  // Recharts Donut data builder
  const donutData = useMemo(() => {
    if (!calculated) return [];
    return [
      { name: 'Custos', value: calculated.totalCustos, color: '#ef4444' },
      { name: 'Despesas', value: calculated.totalDespesas, color: '#ec4899' },
      { name: 'Impostos', value: calculated.totalImpostos, color: '#f59e0b' },
      { name: 'Investimentos', value: calculated.totalInvestimentos, color: '#8b5cf6' }
    ].filter(item => item.value > 0);
  }, [calculated]);

  // Handle drill-down trigger
  const handleDrilldown = (title: string, groupCats: string[]) => {
    if (!calculated) return;
    const matched = calculated.filteredRows.filter(r => groupCats.includes(r.Categoria));
    setDetailsTitle(title);
    setDetailsRows(matched);
    setIsDetailsOpen(true);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased">
      {/* ─── DYNAMIC FILTERS SIDEBAR ────────────────────────────────────────── */}
      <aside className="w-full md:w-80 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
            DRE
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-lg leading-tight">DRE Inteligente</h1>
            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Multi-Seleção v3.1</span>
          </div>
        </div>

        {/* Upload File Zone */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <UploadCloud size={14} className="text-amber-500" />
            Planilha Financeira
          </span>
          <label className="flex flex-col items-center justify-center w-full h-28 border border-dashed border-slate-700 hover:border-amber-500/50 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl cursor-pointer transition-all group">
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <UploadCloud size={24} className="text-slate-500 group-hover:text-amber-500 transition-colors mb-2" />
              <p className="text-xs text-slate-400 font-semibold group-hover:text-slate-200">Clique para enviar</p>
              <p className="text-[10px] text-slate-500 mt-0.5">CSV Semicólon (;) apenas</p>
            </div>
            <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={isUploading} />
          </label>
          {fileName && (
            <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 py-1.5 px-3 rounded-lg text-center font-semibold truncate break-all">
              {isUploading ? "Processando planilha..." : `Ativa: ${fileName}`}
            </div>
          )}
        </div>

        {metadata && (
          <div className="flex flex-col gap-5 flex-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Filter size={14} className="text-amber-500" />
                Filtros Dinâmicos
              </span>
              <button onClick={handleClearFilters} className="text-[10px] text-slate-500 hover:text-amber-500 font-bold flex items-center gap-1 transition-colors uppercase">
                <XCircle size={10} /> Limpar
              </button>
            </div>

            {/* Empresas */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-300">Empresas</label>
              <select 
                multiple 
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2 text-xs text-slate-300 h-28 focus:border-amber-500 focus:outline-none scrollbar-thin"
                value={filters.empresas}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions, o => o.value);
                  setFilters(prev => ({ ...prev, empresas: opts }));
                }}
              >
                {metadata.empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
              </select>
            </div>

            {/* Projetos */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-300">Projetos ({metadata.projetos.length})</label>
              <select 
                multiple 
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2 text-xs text-slate-300 h-28 focus:border-amber-500 focus:outline-none scrollbar-thin"
                value={filters.projetos}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions, o => o.value);
                  setFilters(prev => ({ ...prev, projetos: opts }));
                }}
              >
                {metadata.projetos.map(proj => <option key={proj} value={proj}>{proj}</option>)}
              </select>
            </div>

            {/* Periodos */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-300">Meses / Períodos</label>
              <select 
                multiple 
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2 text-xs text-slate-300 h-28 focus:border-amber-500 focus:outline-none scrollbar-thin"
                value={filters.periodos}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions, o => o.value);
                  setFilters(prev => ({ ...prev, periodos: opts }));
                }}
              >
                {metadata.periodos.map(per => <option key={per} value={per}>{per}</option>)}
              </select>
            </div>
          </div>
        )}
      </aside>

      {/* ─── MAIN APP WORKSPACE ──────────────────────────────────────────────── */}
      <section className="flex-1 p-6 md:p-8 flex flex-col gap-6 overflow-y-auto max-h-screen">
        {/* Header Bar */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:border-amber-500/50 hover:bg-slate-800 text-slate-400 hover:text-amber-500 transition-all shadow-sm duration-200 active:scale-95 flex items-center justify-center"
              title="Voltar ao Início"
            >
              <ChevronLeft size={18} />
            </Link>
            <div>
              <h2 className="text-2xl font-black text-slate-100 tracking-tight">Gerenciamento Contábil Avançado</h2>
              <p className="text-xs text-slate-400 mt-1">
                Visualize resultados, configure regras dinamicamente e aplique simulações em tempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsPrivacyMode(!isPrivacyMode)} 
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-700"
            >
              {isPrivacyMode ? <Eye size={14} className="text-amber-500" /> : <EyeOff size={14} />}
              {isPrivacyMode ? 'Revelar Valores' : 'Modo Privativo'}
            </button>
          </div>
        </header>

        {/* Dynamic Navigation Tabs */}
        <nav className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 max-w-md self-start gap-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <LayoutDashboard size={14} /> Painel Gerencial
          </button>
          <button 
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'table' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <TableIcon size={14} /> Demonstrativo DRE
          </button>
          <button 
            onClick={() => setActiveTab('mapping')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all relative ${activeTab === 'mapping' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Settings size={14} /> Mapeamento Contábil
            {unmappedCategories.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black animate-pulse">
                {unmappedCategories.length}
              </span>
            )}
          </button>
        </nav>

        {!calculated && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-16 text-center flex flex-col items-center justify-center gap-4 my-auto">
            <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500">
              <UploadCloud size={28} />
            </div>
            <div>
              <p className="text-slate-300 font-bold text-lg">Nenhum demonstrativo carregado</p>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Faça o upload do arquivo de dados contábeis (CSV) na barra lateral esquerda para ativar o painel.
              </p>
            </div>
          </div>
        )}

        {/* ─── TAB 1: EXECUTIVE DASHBOARD ─────────────────────────────────────── */}
        {calculated && activeTab === 'dashboard' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Receita Operacional */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 shadow-md relative overflow-hidden group hover:border-emerald-500/20 transition-all">
                <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Faturamento Bruto</span>
                  <h3 className="text-2xl font-black text-slate-100 mt-1">{formatCurrency(calculated.totalEntradas)}</h3>
                </div>
                <div className="absolute top-4 right-4 text-[10px] text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <ArrowUpRight size={10} /> Ativo
                </div>
              </div>

              {/* FCL */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 shadow-md relative overflow-hidden group hover:border-blue-500/20 transition-all">
                <div className="w-10 h-10 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center">
                  <Wallet size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Fluxo de Caixa Livre (FCL)</span>
                  <h3 className="text-2xl font-black text-slate-100 mt-1">{formatCurrency(calculated.fcl)}</h3>
                </div>
                <div className={`absolute top-4 right-4 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${calculated.fcl >= 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                  {calculated.fcl >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {calculated.fcl >= 0 ? 'Saudável' : 'Atenção'}
                </div>
              </div>

              {/* FCL Margem */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 shadow-md relative overflow-hidden group hover:border-amber-500/20 transition-all">
                <div className="w-10 h-10 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl flex items-center justify-center">
                  <Percent size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Margem de FCL</span>
                  <h3 className="text-2xl font-black text-slate-100 mt-1">
                    {formatPercentage(calculated.totalEntradas > 0 ? (calculated.fcl / calculated.totalEntradas) * 100 : 0)}
                  </h3>
                </div>
                <div className="absolute top-4 right-4 text-[10px] text-amber-400 font-black bg-amber-500/10 px-2 py-0.5 rounded-full">
                  Rentabilidade
                </div>
              </div>
            </div>

            {/* Sub-KPI Secondary Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Custos Operacionais</span>
                <span className="text-sm font-extrabold text-slate-200 mt-1">{formatCurrency(calculated.totalCustos)}</span>
              </div>
              <div className="flex flex-col border-l border-slate-800 pl-4">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Despesas Rateadas</span>
                <span className="text-sm font-extrabold text-slate-200 mt-1">{formatCurrency(calculated.totalDespesas)}</span>
              </div>
              <div className="flex flex-col border-l border-slate-800 pl-4">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Impostos</span>
                <span className="text-sm font-extrabold text-slate-200 mt-1">{formatCurrency(calculated.totalImpostos)}</span>
              </div>
              <div className="flex flex-col border-l border-slate-800 pl-4">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Investimentos</span>
                <span className="text-sm font-extrabold text-slate-200 mt-1">{formatCurrency(calculated.totalInvestimentos)}</span>
              </div>
            </div>

            {/* Unmapped Warning Box */}
            {unmappedCategories.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-rose-500 text-white rounded-xl flex items-center justify-center text-sm font-black animate-pulse">
                    !
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-rose-300">Aviso: Categorias Não Mapeadas</h4>
                    <p className="text-xs text-rose-400 mt-0.5">
                      Existem <strong>{unmappedCategories.length}</strong> categorias na sua planilha que não foram mapeadas na DRE e estão fora dos cálculos!
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('mapping')}
                  className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all"
                >
                  Mapear Agora
                </button>
              </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Evolution Chart */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                <div>
                  <h4 className="font-bold text-slate-200 text-sm">Evolução Mensal</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Visão histórica de Entradas, Saídas e Fluxo de Caixa Livre.</p>
                </div>
                <div className="h-72 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                      <Legend />
                      <Line type="monotone" dataKey="Entradas" stroke="#10b981" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="Saídas" stroke="#ef4444" strokeWidth={2} />
                      <Line type="monotone" dataKey="FCL" stroke="#3b82f6" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Expense Distribution Donut */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                <div>
                  <h4 className="font-bold text-slate-200 text-sm">Distribuição de Saídas</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Composição percentual dos custos e despesas acumulados.</p>
                </div>
                <div className="h-56 w-full text-xs relative flex items-center justify-center">
                  {donutData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {donutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <span className="text-slate-500 text-xs">Sem saídas registradas</span>
                  )}
                  {/* Legend Overlay */}
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Saídas</span>
                    <span className="text-lg font-black text-slate-100 mt-0.5">{formatCurrency(calculated.totalSaidas)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-2">
                  {donutData.map(item => (
                    <div key={item.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}: <strong>{formatPercentage((item.value / calculated.totalSaidas) * 100)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: DETAILED DRE GRID ───────────────────────────────────────── */}
        {calculated && activeTab === 'table' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm animate-in fade-in duration-200 overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h4 className="font-bold text-slate-200 text-sm">Demonstrativo do Resultado do Exercício</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Visão consolidada mensal estruturada de acordo com o mapeamento ativo.</p>
              </div>
              <button
                onClick={() => {
                  const headers = ['Categoria Contabil (DRE)', 'Total Acumulado', ...calculated.validColumns];
                  const csvRows = [headers.join(';')];
                  const addCsvRow = (label: string, total: number, monthlyMap: Record<string, number>) => {
                    const row = [
                      label,
                      total.toFixed(2).replace('.', ','),
                      ...calculated.validColumns.map(col => (monthlyMap[col] || 0).toFixed(2).replace('.', ','))
                    ];
                    csvRows.push(row.join(';'));
                  };

                  addCsvRow('1. Faturamento Bruto (Entradas)', calculated.totalEntradas + calculated.outrasEntradas, calculated.monthlyEntradas);
                  addCsvRow('   - Receitas Operacionais', calculated.totalEntradas, calculated.monthlyData.receitas_operacionais || {});
                  addCsvRow('   - Outras Entradas', calculated.outrasEntradas, calculated.monthlyData.outras_entradas || {});
                  addCsvRow('2. Deducoes e Saidas Operacionais', calculated.totalSaidas, calculated.monthlySaidas);
                  addCsvRow('   - Custos Operacionais', calculated.totalCustos, calculated.monthlyData.custos_operacionais || {});
                  addCsvRow('   - Despesas Rateadas', calculated.totalDespesas, calculated.monthlyData.despesas_rateadas || {});
                  addCsvRow('   - Impostos Contratados', calculated.totalImpostos, calculated.monthlyData.impostos || {});
                  addCsvRow('   - Investimentos e Ativos', calculated.totalInvestimentos, calculated.monthlyData.investimentos || {});
                  addCsvRow('Fluxo de Caixa Livre (FCL)', calculated.fcl, calculated.monthlyFCL);
                  addCsvRow('   - Distribuicao de Dividendos', calculated.dividendos, calculated.monthlyData.dividendos || {});

                  const blob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.setAttribute("href", url);
                  link.setAttribute("download", `DRE_Consolidada_Limpa.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 font-extrabold text-[10px] uppercase tracking-wider py-2 px-4 rounded-full shadow-md transition-all active:scale-95"
              >
                Exportar DRE Limpa (CSV)
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4 font-bold text-slate-400">Categoria Contábil (DRE)</th>
                    <th className="py-3 px-4 font-bold text-slate-400 text-right">Total Acumulado</th>
                    {calculated.validColumns.map(col => (
                      <th key={col} className="py-3 px-4 font-bold text-slate-400 text-right min-w-[90px]">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {/* ENTRADAS */}
                  <tr className="bg-emerald-500/5 font-extrabold text-emerald-400">
                    <td className="py-3.5 px-4 flex items-center gap-1.5 cursor-pointer" onClick={() => handleDrilldown('Receitas Operacionais', mapping.receitas_operacionais)}>
                      1. Receitas Operacionais <ChevronRight size={12} className="text-emerald-500" />
                    </td>
                    <td className="py-3.5 px-4 text-right">{formatCurrency(calculated.totalEntradas)}</td>
                    {calculated.validColumns.map(col => (
                      <td key={col} className="py-3.5 px-4 text-right">{formatCurrency(calculated.monthlyData.receitas_operacionais?.[col] || 0)}</td>
                    ))}
                  </tr>

                  <tr className="text-slate-300">
                    <td className="py-3 px-6 cursor-pointer hover:text-amber-500" onClick={() => handleDrilldown('Outras Entradas', mapping.outras_entradas)}>
                      ↳ Outras Entradas
                    </td>
                    <td className="py-3 px-4 text-right">{formatCurrency(calculated.outrasEntradas)}</td>
                    {calculated.validColumns.map(col => (
                      <td key={col} className="py-3 px-4 text-right">{formatCurrency(calculated.monthlyData.outras_entradas?.[col] || 0)}</td>
                    ))}
                  </tr>

                  {/* SAÍDAS */}
                  <tr className="bg-red-500/5 font-extrabold text-rose-400">
                    <td className="py-3.5 px-4 flex items-center gap-1.5 cursor-pointer" onClick={() => handleDrilldown('Custos Operacionais', mapping.custos_operacionais)}>
                      2. Custos Operacionais <ChevronRight size={12} className="text-rose-500" />
                    </td>
                    <td className="py-3.5 px-4 text-right">{formatCurrency(calculated.totalCustos)}</td>
                    {calculated.validColumns.map(col => (
                      <td key={col} className="py-3.5 px-4 text-right">{formatCurrency(calculated.monthlyData.custos_operacionais?.[col] || 0)}</td>
                    ))}
                  </tr>

                  <tr className="text-slate-300">
                    <td className="py-3 px-6 cursor-pointer hover:text-amber-500" onClick={() => handleDrilldown('Despesas Rateadas', mapping.despesas_rateadas)}>
                      ↳ Despesas Rateadas
                    </td>
                    <td className="py-3 px-4 text-right">{formatCurrency(calculated.totalDespesas)}</td>
                    {calculated.validColumns.map(col => (
                      <td key={col} className="py-3 px-4 text-right">{formatCurrency(calculated.monthlyData.despesas_rateadas?.[col] || 0)}</td>
                    ))}
                  </tr>

                  <tr className="text-slate-300">
                    <td className="py-3 px-6 cursor-pointer hover:text-amber-500" onClick={() => handleDrilldown('Impostos', mapping.impostos)}>
                      ↳ Impostos Contratados
                    </td>
                    <td className="py-3 px-4 text-right">{formatCurrency(calculated.totalImpostos)}</td>
                    {calculated.validColumns.map(col => (
                      <td key={col} className="py-3 px-4 text-right">{formatCurrency(calculated.monthlyData.impostos?.[col] || 0)}</td>
                    ))}
                  </tr>

                  <tr className="text-slate-300">
                    <td className="py-3 px-6 cursor-pointer hover:text-amber-500" onClick={() => handleDrilldown('Investimentos', mapping.investimentos)}>
                      ↳ Investimentos & Ativos
                    </td>
                    <td className="py-3 px-4 text-right">{formatCurrency(calculated.totalInvestimentos)}</td>
                    {calculated.validColumns.map(col => (
                      <td key={col} className="py-3 px-4 text-right">{formatCurrency(calculated.monthlyData.investimentos?.[col] || 0)}</td>
                    ))}
                  </tr>

                  {/* SUMMARY LINES */}
                  <tr className="border-t-2 border-slate-700 bg-slate-800/80 font-black text-slate-100">
                    <td className="py-3.5 px-4 uppercase">Total Saídas Consolidadas</td>
                    <td className="py-3.5 px-4 text-right">{formatCurrency(calculated.totalSaidas)}</td>
                    {calculated.validColumns.map(col => (
                      <td key={col} className="py-3.5 px-4 text-right">{formatCurrency(calculated.monthlySaidas[col] || 0)}</td>
                    ))}
                  </tr>

                  <tr className="bg-blue-600/20 border-b border-blue-500/30 font-black text-blue-300 text-sm">
                    <td className="py-4 px-4 uppercase flex items-center gap-1.5">
                      Fluxo de Caixa Livre (FCL)
                    </td>
                    <td className="py-4 px-4 text-right">{formatCurrency(calculated.fcl)}</td>
                    {calculated.validColumns.map(col => (
                      <td key={col} className="py-4 px-4 text-right">{formatCurrency(calculated.monthlyFCL[col] || 0)}</td>
                    ))}
                  </tr>

                  <tr className="text-slate-400">
                    <td className="py-3 px-6 cursor-pointer hover:text-indigo-400" onClick={() => handleDrilldown('Dividendos', mapping.dividendos)}>
                      ↳ Distribuição de Dividendos
                    </td>
                    <td className="py-3 px-4 text-right">{formatCurrency(calculated.dividendos)}</td>
                    {calculated.validColumns.map(col => (
                      <td key={col} className="py-3 px-4 text-right">{formatCurrency(calculated.monthlyData.dividendos?.[col] || 0)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── TAB 3: DYNAMIC ACCOUNT MAPPING BUILDER ─────────────────────────── */}
        {calculated && activeTab === 'mapping' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Header / Intro */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
              <h4 className="font-bold text-slate-200 text-sm">Mapeamento Dinâmico de Contas Financeiras</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Configure quais Categorias da sua planilha original entram em cada linha da DRE. 
                Ao adicionar ou remover itens, toda a DRE recalcula automaticamente em tempo real.
              </p>
            </div>

            {/* Main Mapping Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              {/* DRE Categories Mapped Blocks */}
              <div className="xl:col-span-2 flex flex-col gap-5">
                {DRE_GRUPOS.map(group => {
                  const mapped = mapping[group.id] || [];
                  return (
                    <div key={group.id} className={`bg-slate-900 border ${group.border} rounded-2xl p-5 flex flex-col gap-3 shadow-md`}>
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${group.text}`} style={{ backgroundColor: group.color }} />
                          <h5 className="font-extrabold text-sm text-slate-200">{group.label}</h5>
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/50">
                          {mapped.length} item(ns)
                        </span>
                      </div>

                      {mapped.length === 0 ? (
                        <span className="text-xs text-slate-600 italic py-2">Nenhuma categoria mapeada para este bloco</span>
                      ) : (
                        <div className="flex flex-wrap gap-2 py-1">
                          {mapped.map(cat => (
                            <div 
                              key={cat} 
                              className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-full border ${group.bg} ${group.border} ${group.text}`}
                            >
                              {cat}
                              <button 
                                onClick={() => handleRemoveCategoryFromGroup(group.id, cat)}
                                className="hover:bg-slate-800 rounded-full p-0.5 transition-colors text-slate-400 hover:text-slate-100"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Source/Unmapped Categories Drawer */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-lg sticky top-6">
                <div>
                  <h5 className="font-extrabold text-sm text-slate-200 flex items-center gap-2">
                    Categorias Disponíveis
                    {unmappedCategories.length > 0 && (
                      <span className="bg-amber-500 text-slate-950 text-[10px] font-black py-0.5 px-1.5 rounded-full animate-bounce">
                        {unmappedCategories.length} não mapeada(s)
                      </span>
                    )}
                  </h5>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Selecione para qual grupo DRE deseja enviar as categorias extraídas da sua planilha.
                  </p>
                </div>

                {/* Unmapped Categories Panel */}
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                    Não Mapeadas (Atenção)
                  </span>
                  
                  {unmappedCategories.length === 0 ? (
                    <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-center font-bold">
                      ✓ Todas as categorias mapeadas perfeitamente!
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
                      {unmappedCategories.map(cat => (
                        <div key={cat} className="bg-slate-800/50 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2 hover:border-slate-700 transition-all">
                          <span className="text-xs font-semibold text-slate-200 truncate">{cat}</span>
                          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                            {DRE_GRUPOS.map(group => (
                              <button
                                key={group.id}
                                onClick={() => handleAddCategoryToGroup(group.id, cat)}
                                className={`text-[8px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-md border ${group.bg} ${group.border} ${group.text} whitespace-nowrap hover:scale-105 transition-all`}
                                title={`Mapear para ${group.label}`}
                              >
                                {group.label.split(' ')[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* All Mapped Categories Quick List (Allows changing mapping easily) */}
                <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                    Todas as Categorias ({metadata?.categorias?.length || 0})
                  </span>
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {metadata?.categorias?.map(cat => {
                      const activeGroup = DRE_GRUPOS.find(g => (mapping[g.id] || []).includes(cat));
                      return (
                        <div key={cat} className="flex items-center justify-between gap-3 text-xs bg-slate-800/30 py-1.5 px-3 rounded-xl hover:bg-slate-800/60 transition-all">
                          <span className="font-medium text-slate-300 truncate" title={cat}>{cat}</span>
                          <select
                            className="bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 rounded-lg py-0.5 px-2 focus:border-amber-500 focus:outline-none"
                            value={activeGroup?.id || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                handleAddCategoryToGroup(val, cat);
                              } else {
                                // Remove mapping
                                Object.keys(mapping).forEach(k => {
                                  if (mapping[k].includes(cat)) {
                                    handleRemoveCategoryFromGroup(k, cat);
                                  }
                                });
                              }
                            }}
                          >
                            <option value="">-- Não Mapeado --</option>
                            {DRE_GRUPOS.map(g => (
                              <option key={g.id} value={g.id}>{g.label}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── DRILL DOWN DETAIL MODAL ───────────────────────────────────────── */}
      {isDetailsOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/55">
              <div>
                <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Detalhamento Financeiro (Drill-Down)</span>
                <h3 className="text-lg font-black text-slate-100 mt-1">{detailsTitle}</h3>
              </div>
              <button 
                onClick={() => setIsDetailsOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 hover:text-slate-100 rounded-xl p-2 text-slate-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body (Details Table) */}
            <div className="p-6 overflow-y-auto flex-1 text-xs">
              {detailsRows.length === 0 ? (
                <div className="text-center text-slate-500 py-10">Nenhum lançamento encontrado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Empresa</th>
                        <th className="py-2.5 px-3">Projeto</th>
                        <th className="py-2.5 px-3">Categoria</th>
                        {metadata && Object.keys(metadata.mapaMeses).map(col => (
                          <th key={col} className="py-2.5 px-3 text-right">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-slate-300">
                      {detailsRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-3 font-semibold text-slate-200">{row.Empresa || '-'}</td>
                          <td className="py-2 px-3 text-slate-400">{row.Projeto || '-'}</td>
                          <td className="py-2 px-3 text-slate-400">{row.Categoria || '-'}</td>
                          {metadata && Object.keys(metadata.mapaMeses).map(col => {
                            const val = parseFloat(row[col]?.toString().replace(',', '.') || '0');
                            return (
                              <td key={col} className="py-2 px-3 text-right font-medium">
                                {formatCurrency(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/40">
              <button 
                onClick={() => setIsDetailsOpen(false)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold py-2.5 px-5 rounded-xl transition-all"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
