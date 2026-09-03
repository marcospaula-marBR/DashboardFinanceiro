"use client";

import { useState, useEffect, useCallback } from "react";
import { HeaderFinanceiro } from "@/components/layout/HeaderFinanceiro";
import { StatCard } from "@/components/loans/StatCard";
import { ClaraConfigModal } from "@/components/clara/ClaraConfigModal";
import { ClaraCategoryMappingModal } from "@/components/clara/ClaraCategoryMappingModal";
import { ClaraDepartmentMappingModal } from "@/components/clara/ClaraDepartmentMappingModal";
import { ClaraTransactionDrawer } from "@/components/clara/ClaraTransactionDrawer";
import { ClaraSyncHistoryModal } from "@/components/clara/ClaraSyncHistoryModal";
import { ClaraTransactionRecord, ClaraSyncStatus, OmieCategoryOption, OmieDepartmentOption, OmieProjectOption } from "@/types/clara.types";
import { 
  CreditCard, 
  RefreshCw, 
  Settings, 
  Tag, 
  Building2, 
  History, 
  ShieldCheck, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  Paperclip, 
  ChevronRight, 
  ArrowUpDown,
  Loader2,
  Calendar,
  CheckSquare,
  Square,
  Check,
  Layers,
  FolderKanban,
  Send,
  Sparkles,
  Zap
} from "lucide-react";
import { calculateCardDueDate } from "@/utils/clara-billing-cycle";

const COMPANIES_LIST = [
  { id: 'mar-brasil', name: 'Mar Brasil', cnpj: '02.233.923/0001-19', fullName: 'Mar Brasil Serviços e Locações Ltda' },
  { id: 'dzm', name: 'DZM', cnpj: '46.394.311/0001-83', fullName: 'D.Z.M Ltda' },
  { id: 'g2', name: 'G2', cnpj: '62.763.387/0001-95', fullName: 'G2 Tecnologia e Inovação Sustentável Ltda' },
];

export default function ClaraIntegrationPage() {
  // Empresa Ativa para Sincronização e Auditoria Fiscal de CNPJ
  const [selectedCompanyId, setSelectedCompanyId] = useState('mar-brasil');
  const activeCompany = COMPANIES_LIST.find(c => c.id === selectedCompanyId) || COMPANIES_LIST[0];

  // Dados
  const [transactions, setTransactions] = useState<ClaraTransactionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState({
    totalTransactions: 0,
    syncedCount: 0,
    pendingCount: 0,
    mappingRequiredCount: 0,
    errorCount: 0,
    ignoredCount: 0,
    syncedAmountTotal: 0,
    lastSyncDate: null as string | null,
    safeMode: true,
  });

  // Filtros
  const [search, setSearch] = useState("");
  const [syncStatus, setSyncStatus] = useState("ALL");
  const [claraStatus, setClaraStatus] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Estados de Carregamento e Execução
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);

  // Modais e Drawers
  const [configOpen, setConfigOpen] = useState(false);
  const [categoryMapOpen, setCategoryMapOpen] = useState(false);
  const [departmentMapOpen, setDepartmentMapOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<ClaraTransactionRecord | null>(null);

  // Recursos Omie para edição em lote e inline
  const [categories, setCategories] = useState<OmieCategoryOption[]>([]);
  const [departments, setDepartments] = useState<OmieDepartmentOption[]>([]);
  const [projects, setProjects] = useState<OmieProjectOption[]>([]);

  // Seleção Múltipla
  const [selectedUuids, setSelectedUuids] = useState<string[]>([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchCategory, setBatchCategory] = useState("");
  const [batchDepartment, setBatchDepartment] = useState("");
  const [batchProject, setBatchProject] = useState("");
  const [batchRegistrationDate, setBatchRegistrationDate] = useState("");
  const [batchDueDate, setBatchDueDate] = useState("");
  const [batchOcrLoading, setBatchOcrLoading] = useState(false);
  const [autoOcrNotice, setAutoOcrNotice] = useState<string | null>(null);

  const loadOmieResources = useCallback(async (companyName = 'Mar Brasil') => {
    try {
      const res = await fetch(`/api/clara/omie-resources?company=${encodeURIComponent(companyName)}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setCategories(json.data.categories || []);
        setDepartments(json.data.departments || []);
        setProjects(json.data.projects || []);
      }
    } catch (e) {
      console.warn('Erro ao carregar recursos Omie na página Clara:', e);
    }
  }, []);

  useEffect(() => {
    loadOmieResources(activeCompany.name);
  }, [loadOmieResources, activeCompany.name]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.set('search', search);
      if (syncStatus !== 'ALL') params.set('syncStatus', syncStatus);
      if (claraStatus !== 'ALL') params.set('claraStatus', claraStatus);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedCompanyId) params.set('companyId', selectedCompanyId);

      const res = await fetch(`/api/clara/transactions?${params.toString()}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setTransactions(json.data.transactions || []);
        setTotal(json.data.total || 0);
        if (json.data.metrics) setMetrics(json.data.metrics);
      }
    } catch (e: any) {
      console.error('Erro ao buscar transações Clara:', e);
    } finally {
      setLoading(false);
    }
  }, [page, search, syncStatus, claraStatus, startDate, endDate, selectedCompanyId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/clara/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trigger: 'MANUAL',
          companyId: selectedCompanyId,
          companyName: activeCompany.name,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSyncResult(data.data);
        if (data.data?.autoOcr && data.data.autoOcr.processed > 0) {
          setAutoOcrNotice(`⚡ Auditoria Fiscal IA: ${data.data.autoOcr.processed} comprovante(s) analisados automaticamente (${data.data.autoOcr.matches} compatíveis, ${data.data.autoOcr.divergent} divergentes).`);
        }
        await fetchTransactions();
      } else {
        alert(`Erro na sincronização: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Falha de rede ao sincronizar: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleBatchOcr = async () => {
    if (selectedUuids.length === 0) return;
    setBatchOcrLoading(true);
    try {
      const res = await fetch('/api/clara/ocr/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuids: selectedUuids,
          companyCnpj: activeCompany.cnpj,
          companyName: activeCompany.name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert(data.message);
        await fetchTransactions();
      } else {
        alert(`Erro na auditoria em lote: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Falha de conexão ao auditar em lote: ${e.message}`);
    } finally {
      setBatchOcrLoading(false);
    }
  };

  const handleApplyCalculatedDueDate = () => {
    // Pega a primeira transação selecionada para sugerir a data no input
    const firstSelected = transactions.find(t => selectedUuids.includes(t.clara_uuid));
    if (firstSelected?.operation_date) {
      const calculated = calculateCardDueDate(firstSelected.operation_date, 23, 30);
      setBatchDueDate(calculated);
    } else {
      const calculated = calculateCardDueDate(new Date(), 23, 30);
      setBatchDueDate(calculated);
    }
  };

  const toggleSelectAll = () => {
    if (selectedUuids.length === transactions.length) {
      setSelectedUuids([]);
    } else {
      setSelectedUuids(transactions.map(t => t.clara_uuid));
    }
  };

  const toggleSelectOne = (uuid: string) => {
    setSelectedUuids(prev => 
      prev.includes(uuid) ? prev.filter(id => id !== uuid) : [...prev, uuid]
    );
  };

  // Dispara envio das transações marcadas para o Omie
  const handleBatchSync = async () => {
    if (selectedUuids.length === 0) return;
    if (!confirm(`Deseja enviar as ${selectedUuids.length} transações selecionadas para o Omie?`)) return;

    setBatchActionLoading(true);
    try {
      const res = await fetch('/api/clara/transactions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          uuids: selectedUuids,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(data.message);
        setSelectedUuids([]);
        await fetchTransactions();
      } else {
        alert(`Erro ao processar lote: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Falha ao processar lote: ${e.message}`);
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Aplica categoria, departamento e/ou projeto em lote
  const handleBatchUpdateFields = async () => {
    if (selectedUuids.length === 0) return;
    if (!batchCategory && !batchDepartment && !batchProject) {
      alert('Selecione ao menos um campo (Categoria, Departamento ou Projeto) para aplicar em lote.');
      return;
    }

    setBatchActionLoading(true);
    try {
      const res = await fetch('/api/clara/transactions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_fields',
          uuids: selectedUuids,
          omie_category_code: batchCategory || undefined,
          omie_department_code: batchDepartment || undefined,
          omie_project_code: batchProject || undefined,
          registration_date: batchRegistrationDate || undefined,
          due_date: batchDueDate || undefined,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(data.message);
        setBatchModalOpen(false);
        setBatchCategory("");
        setBatchDepartment("");
        setBatchProject("");
        setBatchRegistrationDate("");
        setBatchDueDate("");
        await fetchTransactions();
      } else {
        alert(`Erro: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Falha: ${e.message}`);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Header Corporativo Oficial */}
        <HeaderFinanceiro />

        {/* Título & Subtítulo do Módulo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                <CreditCard size={22} />
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Integração Clara Cartões → Omie
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1 ml-0.5">
              Ponte autônoma para lançamento de compras com cartão corporativo e envio de comprovantes ao Omie
            </p>
          </div>

          {/* Botões de Ação Principal */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Empresa Ativa para Auditoria Fiscal de CNPJ */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs">
              <Building2 size={16} className="text-emerald-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Empresa Alvo (OCR):</span>
                <select
                  value={selectedCompanyId}
                  onChange={e => setSelectedCompanyId(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer pr-1"
                >
                  {COMPANIES_LIST.map(comp => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name} ({comp.cnpj})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
            </button>

            <button
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Settings size={15} className="text-slate-500" />
              <span>Configurações</span>
            </button>

            <button
              onClick={() => setCategoryMapOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Tag size={15} className="text-slate-500" />
              <span className="hidden sm:inline">Mapear</span> Categorias
            </button>

            <button
              onClick={() => setDepartmentMapOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Building2 size={15} className="text-slate-500" />
              <span className="hidden sm:inline">Centros de</span> Custo
            </button>

            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title="Histórico de Execuções"
            >
              <History size={15} className="text-slate-500" />
              <span className="hidden sm:inline">Logs</span>
            </button>
          </div>
        </div>

        {/* Banner de Modo Seguro (Safe Mode) */}
        {metrics.safeMode && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-900">
                  Modo de Teste Ativo (Safe Mode)
                </h3>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  As transações da Clara são importadas, classificadas e preparadas, mas <strong>NENHUM</strong> lançamento real é criado no Omie até que a integração seja confirmada em Produção.
                </p>
              </div>
            </div>

            <button
              onClick={() => setConfigOpen(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer self-start sm:self-auto shadow-xs"
            >
              Gerenciar Modo
            </button>
          </div>
        )}

        {/* Feedback da Última Sincronização */}
        {syncResult && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <div className="text-xs text-emerald-900">
                <strong>Sincronização Concluída:</strong> {syncResult.received} transações consultadas |{' '}
                {syncResult.created} novas | {syncResult.synced} lançadas no Omie |{' '}
                {syncResult.attachmentsUploaded} anexos enviados | {syncResult.mappingRequired} pendentes de categoria.
              </div>
            </div>
            <button
              onClick={() => setSyncResult(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-1"
            >
              OK
            </button>
          </div>
        )}

        {/* Notificação Transparente de Auto-OCR */}
        {autoOcrNotice && (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-indigo-600 shrink-0" />
              <div className="text-xs text-indigo-950 font-medium">
                <strong className="block text-indigo-900 font-bold">Auditoria Fiscal IA em Segundo Plano:</strong>
                {autoOcrNotice}
              </div>
            </div>
            <button
              onClick={() => setAutoOcrNotice(null)}
              className="text-indigo-500 hover:text-indigo-800 text-xs font-bold px-2 py-1 cursor-pointer"
            >
              OK
            </button>
          </div>
        )}

        {/* Cards de KPIs do Topo */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <StatCard
            title="Transações Clara"
            value={String(metrics.totalTransactions)}
            icon={<CreditCard size={20} />}
            color="slate"
            description="Total consultadas no espelho"
          />

          <StatCard
            title="Lançadas no Omie"
            value={String(metrics.syncedCount)}
            icon={<CheckCircle2 size={20} />}
            color="emerald"
            description={metrics.syncedAmountTotal > 0 ? formatCurrency(metrics.syncedAmountTotal) : 'Lançamentos confirmados'}
          />

          <StatCard
            title="Pendentes / Aptas"
            value={String(metrics.pendingCount)}
            icon={<Clock size={20} />}
            color="blue"
            description="Aguardando disparo ou seguras"
          />

          <StatCard
            title="Sem Categoria"
            value={String(metrics.mappingRequiredCount)}
            icon={<Tag size={20} />}
            color="amber"
            description="Exigem mapeamento De-Para"
            onClick={() => setCategoryMapOpen(true)}
          />

          <StatCard
            title="Com Falha"
            value={String(metrics.errorCount)}
            icon={<AlertCircle size={20} />}
            color="red"
            description="Com erro de inclusão"
          />
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Campo de Busca Textual */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar estabelecimento, portador, autorização..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Filtro por Status Omie */}
            <div>
              <select
                value={syncStatus}
                onChange={e => { setSyncStatus(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
              >
                <option value="ALL">Status Integração (Todos)</option>
                <option value="SYNCED">Sincronizado no Omie</option>
                <option value="READY">Pronto para Envio (Ready)</option>
                <option value="MAPPING_REQUIRED">Aguardando Categoria</option>
                <option value="ERROR">Com Erro</option>
                <option value="IGNORED">Ignoradas</option>
              </select>
            </div>

            {/* Filtro por Status Clara */}
            <div>
              <select
                value={claraStatus}
                onChange={e => { setClaraStatus(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
              >
                <option value="ALL">Status Clara (Todos)</option>
                <option value="AUTHORIZED">AUTHORIZED (Autorizada)</option>
                <option value="PRE_AUTHORIZED">PRE_AUTHORIZED</option>
                <option value="REJECTED">REJECTED (Rejeitada)</option>
                <option value="NOTIFICATION">NOTIFICATION</option>
              </select>
            </div>

            {/* Botão de Limpar Filtros */}
            <div className="flex items-center gap-2">
              {(search || syncStatus !== 'ALL' || claraStatus !== 'ALL' || startDate || endDate) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSyncStatus('ALL');
                    setClaraStatus('ALL');
                    setStartDate('');
                    setEndDate('');
                    setPage(1);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer w-full text-center"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Barra de Ações em Lote (Flutuante quando selecionado) */}
        {selectedUuids.length > 0 && (
          <div className="mb-4 p-3.5 bg-emerald-950 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg border border-emerald-800 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 bg-emerald-500/20 text-emerald-300 rounded-lg flex items-center justify-center font-bold text-xs">
                {selectedUuids.length}
              </span>
              <span className="text-xs font-semibold text-emerald-100">
                {selectedUuids.length === 1 ? '1 transação selecionada' : `${selectedUuids.length} transações selecionadas`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBatchModalOpen(true)}
                disabled={batchActionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                <Layers size={14} className="text-emerald-400" />
                <span>Classificar em Lote</span>
              </button>

              <button
                type="button"
                onClick={handleBatchOcr}
                disabled={batchActionLoading || batchOcrLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 border border-indigo-400/40"
                title="Executar leitura OCR com IA em todos os comprovantes selecionados para validar CNPJ do Tomador"
              >
                {batchOcrLoading ? (
                  <Loader2 size={14} className="animate-spin text-indigo-200" />
                ) : (
                  <Sparkles size={14} className="text-indigo-200" />
                )}
                <span>{batchOcrLoading ? 'Auditando...' : 'Auditar CNPJs com IA'}</span>
              </button>

              <button
                type="button"
                onClick={handleBatchSync}
                disabled={batchActionLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {batchActionLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                <span>Enviar {selectedUuids.length} ao Omie</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedUuids([])}
                className="px-2 py-1 text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        {/* Tabela de Transações (Desktop + Mobile First) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
          
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-emerald-600" size={32} />
              <p className="text-xs text-slate-500 font-medium">Carregando transações do cartão Clara...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                <CreditCard size={28} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">Nenhuma transação encontrada no espelho</div>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  A conexão com a Clara está autenticada. Clique abaixo para buscar as transações da Clara para este painel:
                </p>
              </div>
              <button
                onClick={handleSyncNow}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'Buscando transações da Clara...' : 'Sincronizar da Clara Agora'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* VISÃO DESKTOP: Tabela Completa */}
              <div className="hidden lg:block overflow-x-auto w-full rounded-2xl scrollbar-thin scrollbar-thumb-slate-200">
                <table className="w-full text-left text-xs border-collapse min-w-[960px]">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-2 text-center w-8">
                        <input
                          type="checkbox"
                          checked={transactions.length > 0 && selectedUuids.length === transactions.length}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                          title="Selecionar todas as transações desta página"
                        />
                      </th>
                      <th className="py-2.5 px-2 w-20">Data</th>
                      <th className="py-2.5 px-2 w-36">Portador & Cartão</th>
                      <th className="py-2.5 px-2">Estabelecimento</th>
                      <th className="py-2.5 px-2 text-right w-24">Valor</th>
                      <th className="py-2.5 px-2 text-center w-24">Status Clara</th>
                      <th className="py-2.5 px-2 w-28">Categoria Omie</th>
                      <th className="py-2.5 px-2 w-24">Centro Custo</th>
                      <th className="py-2.5 px-2 w-24">Projeto</th>
                      <th className="py-2.5 px-2 text-center w-28">Status Omie</th>
                      <th className="py-2.5 px-2 text-center w-14">Anexos</th>
                      <th className="py-2.5 px-2 text-center w-14 sticky right-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-[-4px_0_6px_rgba(0,0,0,0.04)]">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {transactions.map(tx => {
                      const isSynced = tx.sync_status === 'SYNCED' || Boolean(tx.omie_launch_id);
                      const isSelected = selectedUuids.includes(tx.clara_uuid);
                      const attachCount = tx.raw_payload?.documents?.length || tx.raw_payload?.receipts?.length || (tx.has_attachments ? 1 : 0);

                      return (
                        <tr 
                          key={tx.id || tx.clara_uuid} 
                          onClick={() => setSelectedTx(tx)}
                          className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                            isSelected ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <td className="py-2.5 px-2 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(tx.clara_uuid)}
                              className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>

                          <td className="py-2.5 px-2 whitespace-nowrap font-medium text-slate-900">
                            {formatDate(tx.operation_date)}
                          </td>

                          <td className="py-2.5 px-2 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block truncate max-w-[130px]">
                              {tx.user_name || 'N/A'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 block">
                              {tx.card_last_digits ? `**** ${tx.card_last_digits}` : 'N/A'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2">
                            <span className="font-semibold text-slate-800 block truncate max-w-[160px]" title={tx.merchant_name || ''}>
                              {tx.merchant_name || 'Estabelecimento Desconhecido'}
                            </span>
                            {tx.merchant_category && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-[160px]">
                                {tx.merchant_category}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-right font-black text-slate-900 tabular-nums whitespace-nowrap">
                            <div>{formatCurrency(tx.amount)}</div>
                            {tx.installments_info && (
                              <span className="inline-block text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded mt-0.5">
                                Parc. {tx.installments_info.current}/{tx.installments_info.total}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.transaction_status === 'AUTHORIZED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {tx.transaction_status}
                            </span>
                          </td>

                          <td className="py-2.5 px-2">
                            {tx.omie_category_code ? (
                              <span className="font-medium text-slate-800 text-[11px] block truncate max-w-[130px]" title={tx.omie_category_code}>
                                {tx.omie_category_code}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                Não definida
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-2">
                            <span className="text-slate-600 text-[11px] block truncate max-w-[100px]" title={tx.omie_department_code || ''}>
                              {tx.omie_department_code || '-'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2">
                            <span className="text-slate-600 text-[11px] block truncate max-w-[100px]" title={tx.omie_project_code || ''}>
                              {tx.omie_project_code || '-'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 ${
                              isSynced
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : tx.sync_status === 'READY'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : tx.sync_status === 'MAPPING_REQUIRED'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : tx.sync_status === 'ERROR'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {isSynced && <CheckCircle2 size={11} />}
                              {tx.sync_status === 'ERROR' && <AlertCircle size={11} />}
                              {isSynced ? `Omie #${tx.omie_launch_id}` : tx.sync_status}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            {attachCount > 0 ? (
                              <div className="flex flex-col items-center gap-1">
                                <span 
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    tx.attachments_synced
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}
                                  title={tx.attachments_synced ? `${attachCount} anexo(s) enviado(s) ao Omie` : `${attachCount} anexo(s) pendente(s)`}
                                >
                                  <Paperclip size={11} />
                                  {attachCount}
                                </span>

                                {tx.cnpj_match_status === 'MATCH' ? (
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded" title={`CNPJ ${tx.invoice_cnpj_tomador} confere com ${activeCompany.name}`}>
                                    ✅ CNPJ OK
                                  </span>
                                ) : tx.cnpj_match_status === 'DIVERGENT' ? (
                                  <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-1 py-0.2 rounded" title={tx.cnpj_divergence_reason || 'CNPJ do tomador diverge da empresa ativa'}>
                                    ⚠️ Divergente
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[11px] font-mono">0</span>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-center sticky right-0 bg-white/95 backdrop-blur-xs z-10 shadow-[-4px_0_6px_rgba(0,0,0,0.04)]">
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedTx(tx); }}
                              className="text-xs text-emerald-700 hover:text-emerald-950 font-bold px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* VISÃO MOBILE FIRST (< 1024px): Cards Executivos */}
              <div className="block lg:hidden divide-y divide-slate-100">
                {transactions.map(tx => {
                  const isSynced = tx.sync_status === 'SYNCED' || Boolean(tx.omie_launch_id);
                  const isSelected = selectedUuids.includes(tx.clara_uuid);
                  const attachCount = tx.raw_payload?.documents?.length || tx.raw_payload?.receipts?.length || (tx.has_attachments ? 1 : 0);

                  return (
                    <div
                      key={tx.id || tx.clara_uuid}
                      onClick={() => setSelectedTx(tx)}
                      className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-2 ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className="pt-0.5" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(tx.clara_uuid)}
                              className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium block">
                              {formatDate(tx.operation_date)}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 truncate max-w-[190px]">
                              {tx.merchant_name || 'Estabelecimento Desconhecido'}
                            </h4>
                            <span className="text-[11px] text-slate-500">
                              {tx.user_name || 'Portador'} {tx.card_last_digits ? `(**** ${tx.card_last_digits})` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-slate-900 tabular-nums block">
                            {formatCurrency(tx.amount)}
                          </span>
                          {tx.installments_info && (
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded inline-block mt-0.5">
                              Parc. {tx.installments_info.current}/{tx.installments_info.total}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border inline-block mt-0.5 ${
                            isSynced
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : tx.sync_status === 'MAPPING_REQUIRED'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {isSynced ? 'Omie OK' : tx.sync_status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 pl-6">
                        <div className="space-y-0.5 truncate max-w-[200px]">
                          <div className="truncate">Cat: {tx.omie_category_code || <em className="text-amber-600">Sem categoria</em>}</div>
                          {tx.omie_project_code && <div className="text-[10px] text-slate-400 truncate">Proj: {tx.omie_project_code}</div>}
                        </div>

                        <div>
                          {attachCount > 0 ? (
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                tx.attachments_synced ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                <Paperclip size={11} /> {attachCount}
                              </span>
                              {tx.cnpj_match_status === 'MATCH' ? (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded">
                                  CNPJ OK
                                </span>
                              ) : tx.cnpj_match_status === 'DIVERGENT' ? (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-1 rounded" title={tx.cnpj_divergence_reason || ''}>
                                  ⚠️ Divergente
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[10px] font-mono">0 anexos</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs">
                <span className="text-slate-500 font-medium">
                  Mostrando {transactions.length} de {total} transações
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Anterior
                  </button>
                  <span className="font-bold text-slate-700 px-1">Página {page}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={transactions.length < pageSize}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </>
          )}

        </div>

      </div>

      {/* Modais & Drawer */}
      <ClaraConfigModal
        isOpen={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={fetchTransactions}
        activeCompanyId={selectedCompanyId}
        activeCompanyName={activeCompany.name}
      />

      <ClaraCategoryMappingModal
        isOpen={categoryMapOpen}
        onClose={() => setCategoryMapOpen(false)}
        activeCompanyName={activeCompany.name}
      />

      <ClaraDepartmentMappingModal
        isOpen={departmentMapOpen}
        onClose={() => setDepartmentMapOpen(false)}
        activeCompanyName={activeCompany.name}
      />

      <ClaraSyncHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      <ClaraTransactionDrawer
        transaction={selectedTx}
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        categories={categories}
        departments={departments}
        projects={projects}
        activeCompanyId={selectedCompanyId}
        activeCompanyCnpj={activeCompany.cnpj}
        activeCompanyName={activeCompany.name}
        onTransactionUpdated={updated => {
          setSelectedTx(updated);
          setTransactions(transactions.map(t => t.clara_uuid === updated.clara_uuid ? updated : t));
        }}
      />

      {/* Modal de Edição em Lote */}
      {batchModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[20000] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Classificação em Lote</h3>
                  <p className="text-[11px] text-slate-500">
                    Aplicar em {selectedUuids.length} lançamentos selecionados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Selecione os campos contábeis que deseja aplicar a todas as transações marcadas. Os campos deixados em branco não serão alterados.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoria Omie:
                </label>
                <select
                  value={batchCategory}
                  onChange={e => setBatchCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                >
                  <option value="">Não alterar categoria</option>
                  {categories.map(c => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.codigo} - {c.descricao}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Centro de Custo (Departamento):
                </label>
                <select
                  value={batchDepartment}
                  onChange={e => setBatchDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                >
                  <option value="">Não alterar centro de custo</option>
                  {departments.map(d => (
                    <option key={d.codigo} value={d.codigo}>
                      {d.descricao}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Projeto Omie:
                </label>
                <select
                  value={batchProject}
                  onChange={e => setBatchProject(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                >
                  <option value="">Não alterar projeto</option>
                  {projects.map(p => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.descricao}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data Registro (Competência):
                  </label>
                  <input
                    type="date"
                    value={batchRegistrationDate}
                    onChange={e => setBatchRegistrationDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Define a competência no Omie</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Data Vencimento (Cartão):
                    </label>
                    <button
                      type="button"
                      onClick={handleApplyCalculatedDueDate}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                      title="Calcula data de vencimento (dia 30) pela regra do ciclo da fatura"
                    >
                      ⚡ Regra da Fatura (Dia 30)
                    </button>
                  </div>
                  <input
                    type="date"
                    value={batchDueDate}
                    onChange={e => setBatchDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Vencimento da fatura</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBatchUpdateFields}
                disabled={batchActionLoading || (!batchCategory && !batchDepartment && !batchProject && !batchRegistrationDate && !batchDueDate)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-40"
              >
                {batchActionLoading ? 'Aplicando...' : 'Aplicar em Lote'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
