"use client";

import { useState, useMemo, useEffect } from "react";
import { Employee, MonthlyCost } from "@/types/loans";
import { 
  BprRuleConfig, 
  BprCandidateResult, 
  BprCycle, 
  BprCamada, 
  BprSavedRun 
} from "@/types/bpr";
import { BprService } from "@/services/bpr.service";
import { formatCurrency } from "@/services/loans.service";
import { 
  Award, X, CheckCircle2, AlertTriangle, Users, Building2, 
  DollarSign, FileSpreadsheet, Printer, Save, FileUp, Sparkles, 
  Search, ShieldAlert, ChevronDown, ChevronUp, Sliders, Calendar,
  Briefcase, Check, ArrowRight, UserX, RefreshCw
} from "lucide-react";

interface BprCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  monthlyCosts?: MonthlyCost[];
}

export function BprCockpitModal({
  isOpen,
  onClose,
  employees,
  monthlyCosts = []
}: BprCockpitModalProps) {
  // Configuração Base do BPR
  const [config, setConfig] = useState<BprRuleConfig>(() => {
    const saved = BprService.loadSavedConfig();
    return saved || BprService.getDefaultConfig('ciclo_1', new Date().getFullYear());
  });

  // Modos de Visualização e Filtros da Tabela
  const [statusFilter, setStatusFilter] = useState<'all' | 'eligible' | 'ineligible'>('all');
  const [camadaFilter, setCamadaFilter] = useState<'all' | BprCamada>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modais de Exceções Nominais
  const [isGlosadosModalOpen, setIsGlosadosModalOpen] = useState(false);
  const [isInativosModalOpen, setIsInativosModalOpen] = useState(false);
  const [isDocImportModalOpen, setIsDocImportModalOpen] = useState(false);
  const [docImportText, setDocImportText] = useState('');
  const [importedPatch, setImportedPatch] = useState<Partial<BprRuleConfig> | null>(null);
  const [isConfirmPatchOpen, setIsConfirmPatchOpen] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);

  // Seletor de Empresas e Vínculos
  const availableCompanies = useMemo(() => {
    const set = new Set<string>(['Mar Brasil', 'DZM', 'G2']);
    employees.forEach(e => { if (e.company) set.add(e.company); });
    return Array.from(set).sort();
  }, [employees]);

  // Recálculo Reativo em Tempo Real
  const summary = useMemo(() => {
    return BprService.calculateBpr(employees, monthlyCosts, config);
  }, [employees, monthlyCosts, config]);

  // Validação da Soma de Splits (deve ser 100%)
  const totalSplitPercent = config.tierSplits.E + config.tierSplits.T + config.tierSplits.O;
  const isSplitValid = totalSplitPercent === 100;

  // Atualização de Ciclo
  const handleCycleChange = (cycle: BprCycle) => {
    const newConf = BprService.getDefaultConfig(cycle, config.year);
    setConfig(prev => ({
      ...prev,
      cycle: newConf.cycle,
      periodStartDate: newConf.periodStartDate,
      periodEndDate: newConf.periodEndDate,
      paymentDate: newConf.paymentDate
    }));
  };

  // Toggle de Empresas na Seleção Múltipla
  const handleToggleCompany = (company: string) => {
    setConfig(prev => {
      const current = prev.companiesFilter || [];
      const exists = current.includes(company);
      const updated = exists ? current.filter(c => c !== company) : [...current, company];
      return { ...prev, companiesFilter: updated };
    });
  };

  // Toggle de Vínculos na Seleção
  const handleToggleLinkType = (link: string) => {
    setConfig(prev => {
      const current = prev.linkTypesFilter || [];
      const exists = current.includes(link);
      const updated = exists ? current.filter(l => l !== link) : [...current, link];
      return { ...prev, linkTypesFilter: updated };
    });
  };

  // Filtragem da Lista para Exibição
  const displayedCandidates = useMemo(() => {
    return summary.candidates.filter(c => {
      if (statusFilter === 'eligible' && !c.isEligible) return false;
      if (statusFilter === 'ineligible' && c.isEligible) return false;
      if (camadaFilter !== 'all' && c.camada !== camadaFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q) || (c.corporateName || '').toLowerCase().includes(q);
        const matchesRole = (c.jobRole || '').toLowerCase().includes(q) || (c.department || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRole) return false;
      }

      return true;
    });
  }, [summary.candidates, statusFilter, camadaFilter, searchQuery]);

  // Salvar Configuração
  const handleSaveConfig = async () => {
    BprService.saveConfig(config);

    const runSnapshot: BprSavedRun = {
      id: `bpr-run-${Date.now()}`,
      name: `Apuração BPR ${config.cycle === 'ciclo_1' ? '1º Sem' : config.cycle === 'ciclo_2' ? '2º Sem' : 'Custom'} ${config.year}`,
      createdAt: new Date().toISOString(),
      config,
      summary: {
        totalPoolAmount: summary.totalPoolAmount,
        totalDistributedAmount: summary.totalDistributedAmount,
        totalEligible: summary.totalEligible,
        amountPerE: summary.layers.E.amountPerEligible,
        amountPerT: summary.layers.T.amountPerEligible,
        amountPerO: summary.layers.O.amountPerEligible
      }
    };

    await BprService.saveBprRunAsync(runSnapshot);

    setSaveSuccessToast('Parâmetros e apuração do BPR salvos com sucesso!');
    setTimeout(() => setSaveSuccessToast(null), 3500);
  };

  // Exportar Planilha CSV
  const handleExportCsv = () => {
    const headers = [
      'ID Colaborador',
      'Nome / Razao Social',
      'Responsavel',
      'Empresa',
      'Departamento',
      'Cargo',
      'Vinculo',
      'Camada',
      'Meta Media Ciclo (%)',
      'Fator Bonus',
      'Status Elegibilidade',
      'Valor Base Camada (R$)',
      'Valor Final BPR (R$)',
      'Motivos Inelegibilidade / Excecoes'
    ];

    const rows = summary.candidates.map(c => [
      `"${c.employeeId}"`,
      `"${c.corporateName || c.name}"`,
      `"${c.responsibleName || ''}"`,
      `"${c.company}"`,
      `"${c.department}"`,
      `"${c.jobRole}"`,
      `"${c.linkType}"`,
      `"${c.camadaLabel}"`,
      c.monthlyAverageScore !== undefined ? `${c.monthlyAverageScore}%` : '100% (Padrao)',
      `"${c.performanceFactorLabel || '100%'}"`,
      `"${c.isEligible ? 'Elegível' : 'Inelegível'}"`,
      c.baseAmount.toFixed(2),
      c.allocatedAmount.toFixed(2),
      `"${c.ineligibilityReasons.join('; ')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Apuracao_BPR_${config.cycle}_${config.year}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Interpretar Texto de Regras e Abrir Modal de Confirmação (Diff)
  const handlePreviewImportedText = () => {
    if (!docImportText.trim()) return;
    const patch = BprService.parseRulesFromText(docImportText, config);
    setImportedPatch(patch);
    setIsDocImportModalOpen(false);
    setIsConfirmPatchOpen(true);
  };

  // Confirmar e Aplicar o Patch de Regras
  const handleConfirmApplyPatch = () => {
    if (importedPatch) {
      setConfig(prev => ({ ...prev, ...importedPatch }));
      setImportedPatch(null);
      setIsConfirmPatchOpen(false);
      setDocImportText('');
      setSaveSuccessToast('Novas regras do documento foram aplicadas com sucesso!');
      setTimeout(() => setSaveSuccessToast(null), 3500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      
      {/* Contêiner do Modal */}
      <div className="bg-slate-900 border border-slate-800 w-full max-w-7xl h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* ── HEADER EXECUTIVO ── */}
        <header className="p-5 sm:px-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Award size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight uppercase">
                  BPR — Bônus por Participação nos Resultados
                </h2>
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Semestral &amp; Rateio por Camada
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Apuração determinística per capita com distribuição entre Estratégico, Tático e Operacional
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsDocImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              title="Importar regulamento ou ata para auto-configurar regras"
            >
              <FileUp size={14} className="text-amber-400" />
              <span>Importar Regras</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-emerald-900/30 cursor-pointer"
              title="Exportar dados para folha / contabilidade em CSV"
            >
              <FileSpreadsheet size={14} />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={handleSaveConfig}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-indigo-900/30 cursor-pointer"
              title="Salvar snapshot desta apuração"
            >
              <Save size={14} />
              <span>Salvar Apuração</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ── CONTEÚDO SCROLLÁVEL PRINCIPAL ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
          
          {/* 1. SELEÇÃO DE CICLO & CONTROLES DO PERÍODO */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                  Ciclo &amp; Período Eletivo
                </span>
              </div>

              {/* Seletor de Ciclo Semestral */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleCycleChange('ciclo_1')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    config.cycle === 'ciclo_1'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📅 Ciclo 1 (Pago até Março · Ref: 01/07 a 31/12)
                </button>
                <button
                  type="button"
                  onClick={() => handleCycleChange('ciclo_2')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    config.cycle === 'ciclo_2'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📅 Ciclo 2 (Pago até Setembro · Ref: 01/01 a 30/06)
                </button>
                <button
                  type="button"
                  onClick={() => handleCycleChange('custom')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    config.cycle === 'custom'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚙️ Customizado
                </button>
              </div>
            </div>

            {/* Inputs de Datas & Filtros de Escopo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Ano de Referência
                </label>
                <input
                  type="number"
                  value={config.year}
                  onChange={e => {
                    const yr = parseInt(e.target.value) || new Date().getFullYear();
                    setConfig(prev => ({ ...prev, year: yr }));
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Início do Período Eletivo
                </label>
                <input
                  type="date"
                  value={config.periodStartDate}
                  onChange={e => setConfig(prev => ({ ...prev, periodStartDate: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Fim do Período Eletivo
                </label>
                <input
                  type="date"
                  value={config.periodEndDate}
                  onChange={e => setConfig(prev => ({ ...prev, periodEndDate: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                  Data de Pagamento (Ativo)
                </label>
                <input
                  type="date"
                  value={config.paymentDate}
                  onChange={e => setConfig(prev => ({ ...prev, paymentDate: e.target.value }))}
                  className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* SELEÇÃO MÚLTIPLA DE EMPRESAS E TIPO DE VÍNCULO (PJ / CLT / AMBOS) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-slate-800/60 text-xs">
              {/* Seleção Múltipla de Empresas */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>🏢 Seleção de Empresas ({config.companiesFilter.length === 0 ? 'Todas' : `${config.companiesFilter.length} marcadas`})</span>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, companiesFilter: [] }))}
                    className="text-[9px] text-amber-400 hover:underline font-normal"
                  >
                    Marcar Todas
                  </button>
                </label>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, companiesFilter: [] }))}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                      config.companiesFilter.length === 0 
                        ? 'bg-amber-500 text-slate-950 shadow-sm' 
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    Todas
                  </button>
                  {availableCompanies.map(comp => {
                    const isSelected = config.companiesFilter.includes(comp);
                    return (
                      <button
                        key={comp}
                        type="button"
                        onClick={() => handleToggleCompany(comp)}
                        className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-400' : 'bg-slate-600'}`}></span>
                        <span>{comp}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seleção de Vínculo (CLT, PJ, Terceirizado ou Ambos) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>💼 Tipo de Vínculo ({config.linkTypesFilter.length === 0 ? 'Ambos / Todos' : config.linkTypesFilter.join(' + ')})</span>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, linkTypesFilter: [] }))}
                    className="text-[9px] text-amber-400 hover:underline font-normal"
                  >
                    Ambos / Todos
                  </button>
                </label>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, linkTypesFilter: [] }))}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                      config.linkTypesFilter.length === 0 
                        ? 'bg-amber-500 text-slate-950 shadow-sm' 
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    Ambos (Todos)
                  </button>
                  {['CLT', 'PJ', 'Terceirizado'].map(lk => {
                    const isSelected = config.linkTypesFilter.includes(lk);
                    return (
                      <button
                        key={lk}
                        type="button"
                        onClick={() => handleToggleLinkType(lk)}
                        className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' 
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-400' : 'bg-slate-600'}`}></span>
                        <span>{lk}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 2. DISTRIBUIÇÃO DO BOLO & RATEIO POR CAMADA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Lado Esquerdo: Input de Montante Total & Sliders Percentuais */}
            <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                    Montante Total &amp; Alíquotas por Camada
                  </span>
                </div>
                
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  isSplitValid 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse'
                }`}>
                  Soma: {totalSplitPercent}% {isSplitValid ? '✓' : `(Ajuste ${100 - totalSplitPercent > 0 ? `+${100 - totalSplitPercent}%` : `${100 - totalSplitPercent}%`})`}
                </span>
              </div>

              {/* Input de Montante Total R$ */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Valor Total a ser Rateado no BPR (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                  <input
                    type="number"
                    step="1000"
                    value={config.totalPoolAmount}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      totalPoolAmount: Math.max(0, parseFloat(e.target.value) || 0)
                    }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-base font-black text-emerald-400 font-mono outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Sliders das Camadas */}
              <div className="space-y-3.5 pt-1">
                {/* Estratégico */}
                <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-black text-blue-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                      Estratégico (E)
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={config.tierSplits.E}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          tierSplits: { ...prev.tierSplits, E: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-right font-black text-xs text-white font-mono"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.tierSplits.E}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      tierSplits: { ...prev.tierSplits, E: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Tático */}
                <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-black text-indigo-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                      Tático (T)
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={config.tierSplits.T}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          tierSplits: { ...prev.tierSplits, T: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-right font-black text-xs text-white font-mono"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.tierSplits.T}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      tierSplits: { ...prev.tierSplits, T: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Operacional */}
                <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-black text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      Operacional (O)
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={config.tierSplits.O}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          tierSplits: { ...prev.tierSplits, O: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-right font-black text-xs text-white font-mono"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.tierSplits.O}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      tierSplits: { ...prev.tierSplits, O: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Lado Direito: Cards de Rateio por Camada & Toggles de Exceção */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Cards de Resumo por Camada */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Estratégico */}
                <div className="bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-800/40 rounded-3xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Estratégico ({config.tierSplits.E}%)</span>
                    <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-black">E</span>
                  </div>
                  <div>
                    <div className="text-lg font-black text-white font-mono">{formatCurrency(summary.layers.E.totalLayerAmount)}</div>
                    <div className="text-[11px] text-slate-400 font-bold mt-0.5">
                      {summary.layers.E.eligibleCount} elegíveis ({summary.layers.E.ineligibleCount} fora)
                    </div>
                  </div>
                  <div className="pt-2 border-t border-blue-800/30">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Valor por Pessoa:</span>
                    <span className="text-base font-black text-blue-400 font-mono">
                      {summary.layers.E.eligibleCount > 0 ? formatCurrency(summary.layers.E.amountPerEligible) : '—'}
                    </span>
                  </div>
                </div>

                {/* Tático */}
                <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-800/40 rounded-3xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Tático ({config.tierSplits.T}%)</span>
                    <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-black">T</span>
                  </div>
                  <div>
                    <div className="text-lg font-black text-white font-mono">{formatCurrency(summary.layers.T.totalLayerAmount)}</div>
                    <div className="text-[11px] text-slate-400 font-bold mt-0.5">
                      {summary.layers.T.eligibleCount} elegíveis ({summary.layers.T.ineligibleCount} fora)
                    </div>
                  </div>
                  <div className="pt-2 border-t border-indigo-800/30">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Valor por Pessoa:</span>
                    <span className="text-base font-black text-indigo-400 font-mono">
                      {summary.layers.T.eligibleCount > 0 ? formatCurrency(summary.layers.T.amountPerEligible) : '—'}
                    </span>
                  </div>
                </div>

                {/* Operacional */}
                <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-800/40 rounded-3xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Operacional ({config.tierSplits.O}%)</span>
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">O</span>
                  </div>
                  <div>
                    <div className="text-lg font-black text-white font-mono">{formatCurrency(summary.layers.O.totalLayerAmount)}</div>
                    <div className="text-[11px] text-slate-400 font-bold mt-0.5">
                      {summary.layers.O.eligibleCount} elegíveis ({summary.layers.O.ineligibleCount} fora)
                    </div>
                  </div>
                  <div className="pt-2 border-t border-emerald-800/30">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Valor por Pessoa:</span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      {summary.layers.O.eligibleCount > 0 ? formatCurrency(summary.layers.O.amountPerEligible) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggles de Políticas Especiais & Exceções */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-4 space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  Políticas Especiais de Exceção
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Toggle Glosados */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <strong className="text-xs font-black text-white block">Glosados no Período</strong>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {config.allowGlosados 
                          ? `${config.selectedGlosadosExceptions.length} selecionado(s)` 
                          : 'Desclassificados por padrão'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newVal = !config.allowGlosados;
                          setConfig(prev => ({
                            ...prev,
                            allowGlosados: newVal,
                            selectedGlosadosExceptions: newVal ? summary.glosadosCandidates.map(g => g.employeeId) : []
                          }));
                        }}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          config.allowGlosados ? 'bg-amber-500' : 'bg-slate-800 border border-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          config.allowGlosados ? 'left-6' : 'left-1'
                        }`} />
                      </button>

                      {config.allowGlosados && (
                        <button
                          type="button"
                          onClick={() => setIsGlosadosModalOpen(true)}
                          className="text-[10px] font-black text-amber-400 underline hover:text-amber-300 cursor-pointer"
                        >
                          Lista ({summary.glosadosCandidates.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Toggle Inativos */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <strong className="text-xs font-black text-white block">Inativos na Data de Pgto</strong>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {config.allowInativos 
                          ? `${config.selectedInativosExceptions.length} selecionado(s)` 
                          : 'Desclassificados por padrão'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newVal = !config.allowInativos;
                          setConfig(prev => ({
                            ...prev,
                            allowInativos: newVal,
                            selectedInativosExceptions: newVal ? summary.inativosCandidates.map(i => i.employeeId) : []
                          }));
                        }}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          config.allowInativos ? 'bg-amber-500' : 'bg-slate-800 border border-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          config.allowInativos ? 'left-6' : 'left-1'
                        }`} />
                      </button>

                      {config.allowInativos && (
                        <button
                          type="button"
                          onClick={() => setIsInativosModalOpen(true)}
                          className="text-[10px] font-black text-amber-400 underline hover:text-amber-300 cursor-pointer"
                        >
                          Lista ({summary.inativosCandidates.length})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. BARRA DE FILTROS & BUSCA DA GRADE */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos ({summary.totalCandidates})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('eligible')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'eligible' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                <CheckCircle2 size={13} />
                <span>Elegíveis ({summary.totalEligible})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ineligible')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'ineligible' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <AlertTriangle size={13} />
                <span>Inelegíveis / Excluídos ({summary.totalIneligible})</span>
              </button>
            </div>

            {/* Filtro por Camada */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Camada:</span>
              <button
                type="button"
                onClick={() => setCamadaFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  camadaFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setCamadaFilter('E')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  camadaFilter === 'E' ? 'bg-blue-600 text-white' : 'text-blue-400 hover:text-blue-300'
                }`}
              >
                Estratégico
              </button>
              <button
                type="button"
                onClick={() => setCamadaFilter('T')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  camadaFilter === 'T' ? 'bg-indigo-600 text-white' : 'text-indigo-400 hover:text-indigo-300'
                }`}
              >
                Tático
              </button>
              <button
                type="button"
                onClick={() => setCamadaFilter('O')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  camadaFilter === 'O' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                Operacional
              </button>
            </div>

            {/* Contador / Restauração de Excluídos */}
            {(config.manuallyExcludedEmployeeIds || []).length > 0 && (
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, manuallyExcludedEmployeeIds: [] }))}
                className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl hover:bg-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                title="Clique para restaurar todos os colaboradores excluídos manualmente"
              >
                <span>Restaurar {config.manuallyExcludedEmployeeIds.length} excluído(s)</span>
              </button>
            )}

            {/* Busca Rápida */}
            <div className="relative flex-1 min-w-[220px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar colaborador ou cargo..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* 4. GRADE ANALÍTICA DE COLABORADORES */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-3">Empresa / Vínculo</th>
                  <th className="py-3 px-3">Camada</th>
                  <th className="py-3 px-3">Admissão ➔ Desligamento</th>
                  <th className="py-3 px-3 text-center">Meta / Desempenho</th>
                  <th className="py-3 px-3 text-center">Status Elegibilidade</th>
                  <th className="py-3 px-4 text-right">Valor BPR (R$)</th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayedCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-bold">
                      Nenhum colaborador encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  displayedCandidates.map(c => {
                    const isPJ = c.linkType === 'PJ' || c.linkType === 'MEI' || Boolean(c.corporateName);
                    const displayName = isPJ ? (c.corporateName || c.name) : c.name;
                    const respName = isPJ ? (c.responsibleName || c.name) : undefined;
                    const isExcluded = (config.manuallyExcludedEmployeeIds || []).includes(c.employeeId);
                    const camadaBadgeColor = c.camada === 'E' 
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                      : c.camada === 'T' 
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

                    return (
                      <tr key={c.employeeId} className={`transition-colors ${
                        isExcluded ? 'bg-rose-950/20 opacity-70' : 'hover:bg-slate-900/60'
                      }`}>
                        {/* Colaborador */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-xs font-black text-slate-300">
                              {c.photoUrl ? (
                                <img src={c.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                c.name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <strong className="text-white block truncate max-w-[200px]">{displayName}</strong>
                              {respName && respName !== displayName && (
                                <span className="text-[10px] text-amber-400 font-bold block">Resp: {respName}</span>
                              )}
                              <span className="text-[10px] text-slate-400 block">{c.jobRole} · {c.department}</span>
                            </div>
                          </div>
                        </td>

                        {/* Empresa / Vínculo */}
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-300 block">{c.company}</span>
                          <span className="text-[10px] text-slate-400">{c.linkType} {c.isOutsourced ? '(Terc.)' : ''}</span>
                        </td>

                        {/* Camada */}
                        <td className="py-3 px-3">
                          <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-lg border ${camadaBadgeColor}`}>
                            {c.camada} — {c.camadaLabel}
                          </span>
                        </td>

                        {/* Datas */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                          <span>{c.startDate ? c.startDate.slice(0, 10) : '—'}</span>
                          <span className="text-slate-600 mx-1">➔</span>
                          <span className={c.realResignationDate ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                            {c.realResignationDate ? c.realResignationDate.slice(0, 10) : 'Ativo'}
                          </span>
                        </td>

                        {/* Metas / Desempenho */}
                        <td className="py-3 px-3 text-center">
                          {c.monthlyAverageScore !== undefined ? (
                            <div className="space-y-0.5">
                              <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                c.performanceFactor === 1.0 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : c.performanceFactor === 0.75
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}>
                                {c.monthlyAverageScore}% ({c.performanceFactor * 100}%)
                              </span>
                              <span className="text-[9px] text-slate-400 block font-mono">
                                {c.performanceFactor === 1.0 ? '100% bônus' : c.performanceFactor === 0.75 ? '75% bônus' : 'Meta < 90%'}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-block text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                              100% (Padrão)
                            </span>
                          )}
                        </td>

                        {/* Status Elegibilidade */}
                        <td className="py-3 px-3 text-center">
                          {isExcluded ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-300 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded-full">
                              🚫 Excluído Manualmente
                            </span>
                          ) : c.isEligible ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={12} /> Elegível {c.isExceptionApplied ? '(Exceção)' : ''}
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full">
                                <X size={12} /> Inelegível
                              </span>
                              <span className="text-[9px] text-slate-500 block truncate max-w-[180px]" title={c.ineligibilityReasons.join(', ')}>
                                {c.ineligibilityReasons[0] || 'Critérios não atendidos'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Valor BPR */}
                        <td className="py-3 px-4 text-right">
                          <div className="space-y-0.5">
                            <span className={`text-sm font-black font-mono block ${
                              c.isEligible ? 'text-emerald-400' : 'text-slate-600'
                            }`}>
                              {c.isEligible ? formatCurrency(c.allocatedAmount) : 'R$ 0,00'}
                            </span>
                            {c.isEligible && c.performanceFactor < 1.0 && (
                              <span className="text-[9px] text-amber-400 block font-mono">
                                Base: {formatCurrency(c.baseAmount)} (75%)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Ação de Exclusão / Restauração Manual */}
                        <td className="py-3 px-3 text-center">
                          {isExcluded ? (
                            <button
                              type="button"
                              onClick={() => {
                                setConfig(prev => ({
                                  ...prev,
                                  manuallyExcludedEmployeeIds: (prev.manuallyExcludedEmployeeIds || []).filter(id => id !== c.employeeId)
                                }));
                              }}
                              className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                              title="Restaurar este colaborador à relação do BPR"
                            >
                              Restaurar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setConfig(prev => ({
                                  ...prev,
                                  manuallyExcludedEmployeeIds: [...(prev.manuallyExcludedEmployeeIds || []), c.employeeId]
                                }));
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                              title="Excluir este colaborador da relação e rateio do BPR"
                            >
                              Excluir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* ── FOOTER COM TOTAIS CONSOLIDADOS ── */}
        <footer className="p-4 sm:px-8 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Elegíveis:</span>
              <strong className="text-sm font-black text-emerald-400">
                {summary.totalEligible} colaboradores
              </strong>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Rateado:</span>
              <strong className="text-sm font-black text-white font-mono">
                {formatCurrency(summary.totalDistributedAmount)}
              </strong>
            </div>

            {summary.residualAmount > 0 && (
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Resíduo (Sem Membros/Ajustes):</span>
                <strong className="text-sm font-black text-amber-400 font-mono">
                  {formatCurrency(summary.residualAmount)}
                </strong>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCsv}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileSpreadsheet size={15} />
              <span>Exportar Planilha</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-md shadow-amber-900/20"
            >
              Concluir &amp; Fechar
            </button>
          </div>
        </footer>

      </div>

      {/* ── MODAL DE EXCEÇÃO DE GLOSADOS ── */}
      {isGlosadosModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase">Colaboradores com Glosa no Período</h3>
                <p className="text-xs text-slate-400">Selecione quem fará jus excepcionalmente ao BPR</p>
              </div>
              <button onClick={() => setIsGlosadosModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800">
              {summary.glosadosCandidates.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">Nenhum colaborador com glosa registrado no período.</div>
              ) : (
                summary.glosadosCandidates.map(g => {
                  const isChecked = config.selectedGlosadosExceptions.includes(g.employeeId);
                  return (
                    <label key={g.employeeId} className="flex items-center justify-between p-2.5 hover:bg-slate-800/50 rounded-xl cursor-pointer">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const newIds = e.target.checked
                              ? [...config.selectedGlosadosExceptions, g.employeeId]
                              : config.selectedGlosadosExceptions.filter(id => id !== g.employeeId);
                            setConfig(prev => ({ ...prev, selectedGlosadosExceptions: newIds }));
                          }}
                          className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700"
                        />
                        <div>
                          <strong className="text-xs text-white block">{g.corporateName || g.name}</strong>
                          <span className="text-[10px] text-amber-400 block">{g.glosaDetails || 'Glosa registrada'}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{g.company} · {g.linkType}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  selectedGlosadosExceptions: summary.glosadosCandidates.map(g => g.employeeId)
                }))}
                className="text-xs text-amber-400 font-bold hover:underline"
              >
                Marcar Todos
              </button>
              <button
                type="button"
                onClick={() => setIsGlosadosModalOpen(false)}
                className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl font-bold text-xs uppercase"
              >
                Concluir Seleção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE EXCEÇÃO DE INATIVOS NA DATA DE PGTO ── */}
      {isInativosModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase">Inativos entre o Fim do Ciclo e a Data de Pagamento</h3>
                <p className="text-xs text-slate-400">
                  Exibe apenas colaboradores que cumpriram 100% do período ({config.periodStartDate} a {config.periodEndDate}) e saíram antes do pagamento ({config.paymentDate})
                </p>
              </div>
              <button onClick={() => setIsInativosModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800">
              {summary.inativosCandidates.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Nenhum colaborador cumpriu o ciclo integral e teve desligamento no intervalo pós-ciclo até a data de pagamento.
                </div>
              ) : (
                summary.inativosCandidates.map(i => {
                  const isChecked = config.selectedInativosExceptions.includes(i.employeeId);
                  return (
                    <label key={i.employeeId} className="flex items-center justify-between p-2.5 hover:bg-slate-800/50 rounded-xl cursor-pointer">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const newIds = e.target.checked
                              ? [...config.selectedInativosExceptions, i.employeeId]
                              : config.selectedInativosExceptions.filter(id => id !== i.employeeId);
                            setConfig(prev => ({ ...prev, selectedInativosExceptions: newIds }));
                          }}
                          className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700"
                        />
                        <div>
                          <strong className="text-xs text-white block">{i.corporateName || i.name}</strong>
                          <span className="text-[10px] text-rose-400 block">
                            Desligado em: {i.realResignationDate ? i.realResignationDate.slice(0, 10) : 'Desligamento pós-ciclo'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{i.company} · {i.camadaLabel}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  selectedInativosExceptions: summary.inativosCandidates.map(i => i.employeeId)
                }))}
                className="text-xs text-amber-400 font-bold hover:underline"
              >
                Marcar Todos
              </button>
              <button
                type="button"
                onClick={() => setIsInativosModalOpen(false)}
                className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl font-bold text-xs uppercase"
              >
                Concluir Seleção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE IMPORTAÇÃO DE REGRAS VIA DOCUMENTO ── */}
      {isDocImportModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileUp size={18} className="text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase">Importar Regras de Regulamento</h3>
              </div>
              <button onClick={() => setIsDocImportModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400">
              Cole o texto da ata, comunicado ou regulamento do BPR. O sistema extrairá automaticamente o montante total, o ciclo e os percentuais por Camada e apresentará um comparativo antes de aplicar.
            </p>

            <textarea
              rows={6}
              value={docImportText}
              onChange={e => setDocImportText(e.target.value)}
              placeholder="Exemplo: Fica aprovada a distribuição do BPR referente ao 2º semestre no montante total de R$ 150.000,00, sendo 35% para o Estratégico, 40% para o Tático e 25% para o Operacional..."
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-sans"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDocImportModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePreviewImportedText}
                className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer hover:bg-amber-400 transition-all"
              >
                <Sparkles size={14} />
                <span>Interpretar &amp; Revisar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL COMPARATIVO / DIFF DE REGRAS IMPORTADAS ── */}
      {isConfirmPatchOpen && importedPatch && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase">Revisão de Alterações Detectadas</h3>
                  <p className="text-xs text-slate-400">Confirme os parâmetros extraídos do regulamento antes de aplicá-los ao sistema</p>
                </div>
              </div>
              <button onClick={() => setIsConfirmPatchOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Tabela de Diff Comparativo Lado a Lado */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black uppercase text-slate-400">
                    <th className="py-2.5 px-3">Parâmetro</th>
                    <th className="py-2.5 px-3 text-slate-400">Configuração Atual</th>
                    <th className="py-2.5 px-3 text-amber-400">Novo Valor Detectado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                  {/* Montante Total */}
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-300">Montante Total (R$)</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{formatCurrency(config.totalPoolAmount)}</td>
                    <td className="py-2.5 px-3 font-mono font-black text-emerald-400">
                      {importedPatch.totalPoolAmount !== undefined ? formatCurrency(importedPatch.totalPoolAmount) : 'Sem alteração'}
                    </td>
                  </tr>

                  {/* Ciclo */}
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-300">Ciclo Semestral</td>
                    <td className="py-2.5 px-3 text-slate-400">{config.cycle === 'ciclo_1' ? 'Ciclo 1 (Pago até Março)' : config.cycle === 'ciclo_2' ? 'Ciclo 2 (Pago até Setembro)' : 'Customizado'}</td>
                    <td className="py-2.5 px-3 font-bold text-amber-300">
                      {importedPatch.cycle ? (importedPatch.cycle === 'ciclo_1' ? 'Ciclo 1 (Pago até Março)' : importedPatch.cycle === 'ciclo_2' ? 'Ciclo 2 (Pago até Setembro)' : 'Customizado') : 'Sem alteração'}
                    </td>
                  </tr>

                  {/* Período Eletivo */}
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-300">Período Eletivo</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{config.periodStartDate} a {config.periodEndDate}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      {importedPatch.periodStartDate ? `${importedPatch.periodStartDate} a ${importedPatch.periodEndDate}` : 'Sem alteração'}
                    </td>
                  </tr>

                  {/* Splits das Camadas */}
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-300">Alíquotas por Camada</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      E: {config.tierSplits.E}% | T: {config.tierSplits.T}% | O: {config.tierSplits.O}%
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                      {importedPatch.tierSplits ? `E: ${importedPatch.tierSplits.E}% | T: ${importedPatch.tierSplits.T}% | O: ${importedPatch.tierSplits.O}%` : 'Sem alteração'}
                    </td>
                  </tr>

                  {/* Glosas */}
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-300">Exceção de Glosados</td>
                    <td className="py-2.5 px-3 text-slate-400">{config.allowGlosados ? 'Permitir seleção' : 'Desclassificado por padrão'}</td>
                    <td className="py-2.5 px-3 font-bold text-white">
                      {importedPatch.allowGlosados !== undefined ? (importedPatch.allowGlosados ? 'Permitir seleção' : 'Desclassificado por padrão') : 'Sem alteração'}
                    </td>
                  </tr>

                  {/* Inativos */}
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-300">Exceção de Inativos pós-ciclo</td>
                    <td className="py-2.5 px-3 text-slate-400">{config.allowInativos ? 'Permitir seleção' : 'Desclassificado por padrão'}</td>
                    <td className="py-2.5 px-3 font-bold text-white">
                      {importedPatch.allowInativos !== undefined ? (importedPatch.allowInativos ? 'Permitir seleção' : 'Desclassificado por padrão') : 'Sem alteração'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmPatchOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ❌ Descartar Alterações
              </button>

              <button
                type="button"
                onClick={handleConfirmApplyPatch}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer active:scale-95"
              >
                <CheckCircle2 size={16} />
                <span>✅ Confirmar &amp; Aplicar Novas Regras</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de Feedback */}
      {saveSuccessToast && (
        <div className="fixed bottom-6 right-6 z-70 bg-slate-900 text-white border border-emerald-500/50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom max-w-md">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-xs font-bold text-slate-100 leading-snug">
            {saveSuccessToast}
          </p>
        </div>
      )}

    </div>
  );
}
