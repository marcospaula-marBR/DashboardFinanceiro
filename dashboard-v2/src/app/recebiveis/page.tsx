"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ComissoesService, formatCurrency, formatDate } from "@/services/comissoes.service";
import { Membro, ContratoBase, Recebimento, ComissoesFilters, DivisaoInput } from "@/types/comissoes";
import { KpiCards } from "@/components/comissoes/KpiCards";
import { ComissoesTable } from "@/components/comissoes/ComissoesTable";
import { ComissoesCharts } from "@/components/comissoes/ComissoesCharts";
import { LancamentoModal } from "@/components/comissoes/LancamentoModal";
import { EquipeModal } from "@/components/comissoes/EquipeModal";
import { ContratoModal } from "@/components/comissoes/ContratoModal";
import { UnificacaoModal } from "@/components/comissoes/UnificacaoModal";
import { OmieImportModal } from "@/components/comissoes/OmieImportModal";
import { APP_VERSION } from "@/version";
import {
  Plus,
  Users,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  X,
  Coins,
  Merge,
  Download
} from "lucide-react";

export default function RecebiveisPage() {
  // ── State ────────────────────────────────────────────────────────────────────
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [contratos, setContratos] = useState<ContratoBase[]>([]);
  const [historico, setHistorico] = useState<Recebimento[]>([]);

  const [isLoadingInit, setIsLoadingInit] = useState(true);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isLancamentoOpen, setIsLancamentoOpen] = useState(false);
  const [isEquipeOpen, setIsEquipeOpen] = useState(false);
  const [isContratoOpen, setIsContratoOpen] = useState(false);
  const [isUnificacaoOpen, setIsUnificacaoOpen] = useState(false);
  const [isOmieImportOpen, setIsOmieImportOpen] = useState(false);
  const [editData, setEditData] = useState<Recebimento | null>(null);
  const [prefilledContractId, setPrefilledContractId] = useState<string | null>(null);
  const [editContratoData, setEditContratoData] = useState<ContratoBase | null>(null);

  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ComissoesFilters>({});
  const [filterForm, setFilterForm] = useState<ComissoesFilters>({});

  // Detalhamento do Modal de KPIs (Semelhante aos empréstimos)
  const [detailsModal, setDetailsModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    headers: string[];
    items: {
      id: string;
      label1: string; // Ex: NF/Ref ou Colaborador
      label2: string; // Ex: Contrato ou Status Equipe
      value1: string;  // Ex: Valor Bruto ou Comissões Pagas
      value2: string;  // Ex: Valor Líquido ou Comissões Pendentes
      value3?: string; // Ex: Status Faturamento ou Participações
    }[];
  }>({
    isOpen: false,
    title: "",
    subtitle: "",
    headers: [],
    items: []
  });

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchInit = useCallback(async () => {
    setIsLoadingInit(true);
    try {
      const [eq, ct] = await Promise.all([
        ComissoesService.getEquipe(),
        ComissoesService.getContratos(),
      ]);
      setEquipe(eq);
      setContratos(ct);
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Erro ao carregar dados iniciais.";
      setError(msg);
    } finally {
      setIsLoadingInit(false);
    }
  }, []);

  const fetchHistorico = useCallback(async (currentFilters: ComissoesFilters = {}) => {
    setIsLoadingHistorico(true);
    try {
      const eq = await ComissoesService.getEquipe();
      const map = new Map(eq.map(m => [m.id, m.nome]));
      const data = await ComissoesService.getHistorico(map, currentFilters);
      setHistorico(data);
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Erro ao carregar histórico de recebimentos.";
      setError(msg);
    } finally {
      setIsLoadingHistorico(false);
    }
  }, []);

  useEffect(() => {
    fetchInit();
    fetchHistorico();
  }, [fetchInit, fetchHistorico]);

  // ── Compilação dos Dados para Gráficos (useMemo) ──────────────────────────────
  const { projectionsData, historyData, concentrationData } = useMemo(() => {
    const groups: Record<string, { faturado: number; recebido: number; comissoes: number }> = {};
    const now = new Date();

    // Agrupa dados reais do banco
    historico.forEach(r => {
      if (!r.data_recebimento) return;
      const [year, month] = r.data_recebimento.split("-");
      const monthKey = `${year}-${month}`; // Ex: 2026-06

      if (!groups[monthKey]) {
        groups[monthKey] = { faturado: 0, recebido: 0, comissoes: 0 };
      }

      const bruto = r.valor_bruto || 0;
      const coms = r.comissoes.reduce((sum, c) => sum + c.valor_calculado, 0);

      groups[monthKey].faturado += bruto;
      if (r.status === "Pago") {
        groups[monthKey].recebido += bruto;
      }
      groups[monthKey].comissoes += coms;
    });

    // Cria sequência cronológica de 24 meses (12 passados e 12 futuros)
    const allMonths: string[] = [];
    const tempDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    for (let i = 0; i < 24; i++) {
      const y = tempDate.getFullYear();
      const m = String(tempDate.getMonth() + 1).padStart(2, "0");
      allMonths.push(`${y}-${m}`);
      tempDate.setMonth(tempDate.getMonth() + 1);
    }

    const formatMonthLabel = (key: string) => {
      const [y, m] = key.split("-");
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return `${months[parseInt(m) - 1]}/${y.substring(2)}`;
    };

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const histList: { month: string; total: number; previsto: number }[] = [];
    const projList: { month: string; total: number; previsto: number }[] = [];

    allMonths.forEach(mKey => {
      const data = groups[mKey] || { faturado: 0, recebido: 0, comissoes: 0 };
      const label = formatMonthLabel(mKey);

      // Histórico (até o mês atual)
      if (mKey <= currentMonthKey) {
        histList.push({
          month: label,
          total: data.recebido,
          previsto: data.faturado
        });
      }

      // Projeção (mês atual e futuros)
      if (mKey >= currentMonthKey) {
        projList.push({
          month: label,
          total: data.recebido,
          previsto: Math.max(0, data.faturado - data.recebido)
        });
      }
    });

    // Concentração de Comissões por Colaborador
    const concentrationMap: Record<string, number> = {};
    historico.forEach(r => {
      r.comissoes.forEach(c => {
        const name = c.membroNome || "Desconhecido";
        concentrationMap[name] = (concentrationMap[name] || 0) + c.valor_calculado;
      });
    });

    const concentrationList = Object.entries(concentrationMap)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      projectionsData: projList,
      historyData: histList,
      concentrationData: concentrationList
    };
  }, [historico]);

  const redesExistentes = useMemo(() => {
    const set = new Set<string>(["Rede Alpha", "Capina Elétrica", "Bertioga"]);
    contratos.forEach(c => {
      if (c.rede) {
        set.add(c.rede.trim());
      }
    });
    return Array.from(set).filter(Boolean).sort();
  }, [contratos]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSaveLancamento = async (payload: {
    contrato_id: string;
    data_recebimento: string;
    nota_fiscal: string;
    ciclo: string;
    valor_bruto: number;
    valor_liquido: number;
    glosa: number;
    impostos: number;
    status: string;
    divisoes: DivisaoInput[];
    editId?: string;
  }) => {
    await ComissoesService.saveRecebimento(payload);
    await fetchHistorico(filters);
    setPrefilledContractId(null);
  };

  const handleEditRecebimento = (rec: Recebimento) => {
    setEditData(rec);
    setIsLancamentoOpen(true);
  };

  const handleDeleteRecebimento = async (id: string) => {
    if (!confirm("Deseja realmente excluir este faturamento? Essa ação não pode ser desfeita.")) return;
    try {
      await ComissoesService.deleteRecebimento(id);
      await fetchHistorico(filters);
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Erro desconhecido";
      alert(`Erro: ${msg}`);
    }
  };

  const handleLiquidateRecebimento = async (id: string, paidDate: string) => {
    try {
      await ComissoesService.liquidateRecebimento(id, paidDate);
      await fetchHistorico(filters);
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Erro ao dar baixa";
      alert(`Erro ao dar baixa: ${msg}`);
    }
  };

  const handleRevertRecebimento = async (id: string) => {
    if (!confirm("Deseja estornar a quitação deste faturamento? As comissões voltarão a ficar pendentes.")) return;
    try {
      await ComissoesService.revertRecebimento(id);
      await fetchHistorico(filters);
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Erro ao estornar";
      alert(`Erro ao estornar: ${msg}`);
    }
  };

  const handleToggleMembro = async (id: string, ativo: boolean): Promise<Membro> => {
    const updated = await ComissoesService.toggleMembro(id, ativo);
    setEquipe(prev => prev.map(m => m.id === id ? updated : m));
    return updated;
  };

  const handleEnableEmployee = async (employeeId: string, name: string, pctPadrao: number): Promise<Membro> => {
    const novo = await ComissoesService.enableEmployeeCommission(employeeId, name, pctPadrao);
    setEquipe(prev => [...prev, novo]);
    return novo;
  };

  const handleUpdateMembroPercent = async (id: string, pctPadrao: number) => {
    const target = equipe.find(m => m.id === id);
    if (!target) return;
    const updated = await ComissoesService.updateMembro(id, {
      nome: target.nome,
      pct_padrao: pctPadrao,
      employee_id: target.employee_id
    });
    setEquipe(prev => prev.map(m => m.id === id ? updated : m));
  };

  const handleSaveContrato = async (payload: {
    nome_contrato: string;
    numero_contrato?: string;
    observacoes?: string;
    rede?: string | null;
  }) => {
    try {
      if (editContratoData) {
        const updated = await ComissoesService.updateContrato(editContratoData.id, payload);
        setContratos(prev => prev.map(c => c.id === editContratoData.id ? updated : c));
        setEditContratoData(null);
      } else {
        const novo = await ComissoesService.addContrato(payload);
        setContratos(prev => [...prev, novo]);
      }
      await fetchHistorico(filters);
    } catch (err: any) {
      alert("Erro ao salvar contrato: " + (err.message || "Erro desconhecido"));
    }
  };

  const handleEditContrato = (contract: ContratoBase) => {
    setEditContratoData(contract);
    setIsContratoOpen(true);
  };

  const handleUnificarContratos = async (origemId: string, destinoId: string) => {
    await ComissoesService.unificarContratos(origemId, destinoId);
    await fetchInit();
    await fetchHistorico(filters);
  };

  const handleAddRecebimentoFromTable = (contractId: string) => {
    setPrefilledContractId(contractId);
    setEditData(null);
    setIsLancamentoOpen(true);
  };

  /**
   * Recebe os candidatos selecionados na auditoria do Omie e grava cada um
   * no banco de dados via ComissoesService.saveRecebimento (sem comissões iniciais).
   * O usuário pode editar e adicionar comissões depois, como faz no lançamento manual.
   */
  const handleImportFromOmie = async (
    selected: Array<{
      omie_id: string;
      omie_key: string;
      nota_fiscal: string;
      client_name: string;
      contract_name: string;
      contract_number: string;
      date_registration: string;
      date_issue: string;
      date_due: string;
      date_payment: string;
      valor_bruto: number;
      valor_liquido: number;
      glosa: number;
      impostos: number;
      status: string;
    }>,
    contratoMap: Record<string, string>
  ) => {
    let imported = 0;
    const errors: string[] = [];

    for (const item of selected) {
      const contrato_id = contratoMap[item.omie_key];
      // Se não houver contrato vinculado, pula (sem contrato não tem como salvar no schema atual)
      if (!contrato_id) continue;

      // Usa a data de registro como referência principal (data de recebimento no banco)
      const dataRef = item.date_registration || item.date_issue || item.date_due;
      // Extrai ciclo (YYYY-MM) da data de referência
      const ciclo = dataRef ? dataRef.substring(0, 7) : '';

      try {
        await ComissoesService.saveRecebimento({
          contrato_id,
          data_recebimento: dataRef,
          nota_fiscal:  item.nota_fiscal,
          ciclo,
          valor_bruto:  item.valor_bruto,
          valor_liquido: item.valor_liquido,
          glosa:        item.glosa,
          impostos:     item.impostos,
          status:       item.status,
          divisoes:     [],   // Sem comissões iniciais — usuário configura após importação
        });
        imported++;
      } catch (err: any) {
        errors.push(`${item.nota_fiscal}: ${err.message}`);
      }
    }

    await fetchHistorico(filters);

    if (errors.length > 0) {
      const skipped = selected.length - imported - errors.length;
      throw new Error(
        `${imported} importado(s) com sucesso. ${errors.length} erro(s): ${errors.slice(0, 3).join('; ')}`
      );
    }
  };

  const handleApplyFilters = () => {
    setFilters(filterForm);
    fetchHistorico(filterForm);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    const empty: ComissoesFilters = {};
    setFilterForm(empty);
    setFilters(empty);
    fetchHistorico(empty);
    setShowFilters(false);
  };

  const hasActiveFilters = Object.values(filters).some(v => v && v !== "");

  // ── Modais de Detalhe dos KPI Cards ──────────────────────────────────────────
  const handleOpenFaturadoDetails = () => {
    const items = historico.map(r => ({
      id: r.id,
      label1: r.nota_fiscal || `Ref: ${formatDate(r.data_recebimento)}`,
      label2: r.contratoNome,
      value1: formatCurrency(r.valor_bruto),
      value2: formatCurrency(r.valor_liquido),
      value3: r.status === "Pago" ? "RECEBIDO" : "A RECEBER"
    }));

    setDetailsModal({
      isOpen: true,
      title: "Detalhamento de Faturamento Geral",
      subtitle: "Histórico consolidado de faturas emitidas para os contratos",
      headers: ["NF / Ref", "Contrato / Cliente", "Valor Bruto", "Valor Líquido", "Status"],
      items
    });
  };

  const handleOpenRecebidoDetails = () => {
    const items = historico
      .filter(r => r.status === "Pago")
      .map(r => ({
        id: r.id,
        label1: r.nota_fiscal || `Ref: ${formatDate(r.data_recebimento)}`,
        label2: r.contratoNome,
        value1: formatCurrency(r.valor_bruto),
        value2: formatCurrency(r.valor_liquido),
        value3: formatDate(r.data_recebimento)
      }));

    setDetailsModal({
      isOpen: true,
      title: "Detalhamento de Recebidos (Liquidados)",
      subtitle: "Faturas que foram compensadas e comissões correspondentes liberadas",
      headers: ["NF / Ref", "Contrato / Cliente", "Valor Bruto", "Valor Líquido", "Data Recebimento"],
      items
    });
  };

  const handleOpenAReceberDetails = () => {
    const items = historico
      .filter(r => r.status === "Pendente")
      .map(r => ({
        id: r.id,
        label1: r.nota_fiscal || `Ref: ${formatDate(r.data_recebimento)}`,
        label2: r.contratoNome,
        value1: formatCurrency(r.valor_bruto),
        value2: formatCurrency(r.valor_liquido),
        value3: "A vencer"
      }));

    setDetailsModal({
      isOpen: true,
      title: "Detalhamento de Saldos A Receber",
      subtitle: "Faturamentos em aberto aguardando baixa comercial",
      headers: ["NF / Ref", "Contrato / Cliente", "Valor Bruto", "Valor Líquido", "Status"],
      items
    });
  };

  const handleOpenComissoesDetails = () => {
    const items = equipe.map(m => {
      let paid = 0;
      let pending = 0;
      let count = 0;

      historico.forEach(r => {
        const com = r.comissoes.find(c => c.membro_id === m.id);
        if (com) {
          count++;
          if (r.status === "Pago") {
            paid += com.valor_calculado;
          } else {
            pending += com.valor_calculado;
          }
        }
      });

      return {
        id: m.id,
        label1: m.nome,
        label2: m.ativo ? "Habilitado" : "Desativado",
        value1: formatCurrency(paid),
        value2: formatCurrency(pending),
        value3: `${count} rateios`
      };
    });

    setDetailsModal({
      isOpen: true,
      title: "Rateio e Saldo de Comissões por Colaborador",
      subtitle: "Visão consolidada de valores pagos e pendentes distribuídos para o time",
      headers: ["Colaborador", "Status Equipe", "Comissões Recebidas", "A Receber", "Participações"],
      items
    });
  };

  const modalEditData = useMemo(() => {
    if (prefilledContractId) {
      return {
        contrato_id: prefilledContractId,
        comissoes: [],
        status: "Pendente",
        valor_bruto: 0,
        valor_liquido: 0,
        data_recebimento: new Date().toISOString().slice(0, 10)
      } as unknown as Recebimento;
    }
    return editData;
  }, [prefilledContractId, editData]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Header Premium */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-200/60">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 p-2 px-3 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-all shadow-sm text-xs font-bold"
            >
              <ChevronLeft size={16} />
              <span>Voltar ao Início</span>
            </Link>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center border border-amber-200/30">
                  <Coins size={22} />
                </div>
                <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  Gestão de Recebíveis
                  <span className="hidden sm:inline bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded border border-amber-200/40">
                    Contratos & Comissões
                  </span>
                </h1>
              </div>
              <p className="text-xs font-semibold text-slate-400">
                Gerencie quitações de faturas comerciais, acompanhe projeções e configure os comissionados da equipe.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Filtros Trigger */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                hasActiveFilters
                  ? "border-amber-500 bg-amber-550/10 text-amber-700 font-bold"
                  : "border-slate-200 bg-white text-slate-500 hover:border-amber-300"
              }`}
            >
              <SlidersHorizontal size={14} />
              Filtros
              {hasActiveFilters && (
                <span className="w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {Object.values(filters).filter(v => v && v !== "").length}
                </span>
              )}
            </button>

            {/* Importar do Omie */}
            <button
              onClick={() => setIsOmieImportOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-400 bg-amber-50 text-xs font-black uppercase tracking-wider text-amber-700 hover:bg-amber-100 transition-all shadow-sm"
            >
              <Download size={14} />
              Importar Omie
            </button>

            {/* Unificar Contratos Trigger */}
            <button
              onClick={() => setIsUnificacaoOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-wider text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-all shadow-sm"
            >
              <Merge size={14} />
              Unificar Contratos
            </button>

            {/* Gerenciar Equipe Trigger */}
            <button
              onClick={() => setIsEquipeOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-wider text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-all shadow-sm"
            >
              <Users size={14} />
              Comissionados
            </button>

            {/* Novo Recebimento Trigger */}
            <button
              onClick={() => { setPrefilledContractId(null); setEditData(null); setIsLancamentoOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md"
            >
              <Plus size={14} />
              Lançar Faturamento
            </button>
          </div>
        </header>

        {/* Painel de Filtros Reativo */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-5 mb-6 animate-in slide-in-from-top-3 duration-300">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Data Início</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 bg-white"
                  value={filterForm.dataInicio || ""}
                  onChange={e => setFilterForm(p => ({ ...p, dataInicio: e.target.value }))}
                />
              </div>
              
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Data Fim</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 bg-white"
                  value={filterForm.dataFim || ""}
                  onChange={e => setFilterForm(p => ({ ...p, dataFim: e.target.value }))}
                />
              </div>
              
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Ciclo / Mês Ref</label>
                <input
                  type="month"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 bg-white"
                  value={filterForm.ciclo || ""}
                  onChange={e => setFilterForm(p => ({ ...p, ciclo: e.target.value }))}
                />
              </div>
              
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Contrato</label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 bg-white"
                  value={filterForm.contratoId || ""}
                  onChange={e => setFilterForm(p => ({ ...p, contratoId: e.target.value }))}
                >
                  <option value="">Todos os contratos</option>
                  {contratos.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_contrato}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Comissionado</label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 bg-white"
                  value={filterForm.membroId || ""}
                  onChange={e => setFilterForm(p => ({ ...p, membroId: e.target.value }))}
                >
                  <option value="">Qualquer colaborador</option>
                  {equipe.map(m => (
                    <option key={m.id} value={m.id}>{m.nome} {!m.ativo ? '(Inativo)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4 justify-end border-t border-slate-100 pt-4">
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl transition-all"
              >
                <X size={13} /> Limpar Filtros
              </button>
              <button
                onClick={handleApplyFilters}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm"
              >
                Filtrar Resultados
              </button>
            </div>
          </div>
        )}

        {/* Tratamento de Erro */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 animate-in fade-in duration-300">
            <AlertCircle size={18} className="shrink-0" />
            <span className="text-xs font-bold flex-1">{error}</span>
            <button
              onClick={() => { setError(null); fetchInit(); fetchHistorico(filters); }}
              className="flex items-center gap-1.5 text-xs font-black uppercase text-red-600 hover:text-red-800 underline transition-all"
            >
              <RefreshCw size={12} /> Recarregar
            </button>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="space-y-6">
          
          {/* KPI Summary Cards */}
          <KpiCards
            historico={historico}
            onOpenFaturado={handleOpenFaturadoDetails}
            onOpenRecebido={handleOpenRecebidoDetails}
            onOpenAReceber={handleOpenAReceberDetails}
            onOpenComissoes={handleOpenComissoesDetails}
          />

          {/* Gráficos em Abas */}
          <ComissoesCharts
            projectionsData={projectionsData}
            historyData={historyData}
            concentrationData={concentrationData}
            concentrationTitle="Comissões"
          />

          {/* Tabela de Contratos & Faturamentos Lançados */}
          <ComissoesTable
            contratos={contratos}
            recebimentos={historico}
            onAddRecebimento={handleAddRecebimentoFromTable}
            onEditRecebimento={handleEditRecebimento}
            onDeleteRecebimento={handleDeleteRecebimento}
            onLiquidateRecebimento={handleLiquidateRecebimento}
            onRevertRecebimento={handleRevertRecebimento}
            isLoading={isLoadingInit || isLoadingHistorico}
            onEditContrato={handleEditContrato}
          />

        </div>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-slate-200/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold text-slate-400">
          <p>© 2026 Mar Brasil — Sistema de Recebíveis & Comissões Comerciais</p>
          <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded-full text-slate-400">
            Dianna {APP_VERSION}
          </span>
        </footer>

      </div>

      {/* ── Modais Auxiliares ─────────────────────────────────────────────────── */}
      
      {/* Detalhamento dos KPI Cards */}
      {detailsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDetailsModal(p => ({ ...p, isOpen: false }))} />
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                  {detailsModal.title}
                </h3>
                <p className="text-xs font-semibold text-slate-400 mt-1">
                  {detailsModal.subtitle}
                </p>
              </div>
              <button
                onClick={() => setDetailsModal(p => ({ ...p, isOpen: false }))}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Table Area */}
            <div className="p-6 overflow-y-auto flex-1">
              {detailsModal.items.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8">Nenhum registro encontrado.</p>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b border-slate-100">
                      <tr>
                        {detailsModal.headers.map((h, idx) => (
                          <th key={idx} className="px-4 py-3 first:pl-6 last:pr-6">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailsModal.items.map((item, idx) => (
                        <tr key={item.id + "-" + idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3.5 first:pl-6 text-slate-700 font-bold max-w-[150px] truncate">
                            {item.label1}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 font-semibold max-w-[200px] truncate">
                            {item.label2}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700 font-bold tabular-nums">
                            {item.value1}
                          </td>
                          {detailsModal.headers.length >= 4 && (
                            <td className="px-4 py-3.5 text-slate-600 font-semibold tabular-nums">
                              {item.value2}
                            </td>
                          )}
                          {detailsModal.headers.length >= 5 && (
                            <td className="px-4 py-3.5 last:pr-6">
                              {item.value3 === "RECEBIDO" || item.value3 === "Habilitado" ? (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                  {item.value3}
                                </span>
                              ) : item.value3 === "A RECEBER" || item.value3 === "A vencer" ? (
                                <span className="bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                  {item.value3}
                                </span>
                              ) : item.value3 === "Desativado" ? (
                                <span className="bg-slate-100 text-slate-500 border border-slate-200/50 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                  {item.value3}
                                </span>
                              ) : (
                                <span className="text-slate-500 font-semibold text-xs">
                                  {item.value3}
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setDetailsModal(p => ({ ...p, isOpen: false }))}
                className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-900 transition-all shadow-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Importar do Omie ERP */}
      <OmieImportModal
        isOpen={isOmieImportOpen}
        onClose={() => setIsOmieImportOpen(false)}
        contratos={contratos}
        onImport={handleImportFromOmie}
      />

      {/* Lançar/Editar Faturamento */}
      <LancamentoModal
        isOpen={isLancamentoOpen}
        onClose={() => { setIsLancamentoOpen(false); setEditData(null); setPrefilledContractId(null); }}
        onSave={handleSaveLancamento}
        onNovoContrato={() => { setIsLancamentoOpen(false); setIsContratoOpen(true); }}
        equipe={equipe}
        contratos={contratos}
        editData={modalEditData}
        onEnableEmployee={handleEnableEmployee}
        onToggle={handleToggleMembro}
      />

      {/* Gerenciar Equipe (Comissionados) */}
      <EquipeModal
        isOpen={isEquipeOpen}
        onClose={() => setIsEquipeOpen(false)}
        equipe={equipe}
        onToggle={handleToggleMembro}
        onEnableEmployee={handleEnableEmployee}
        onUpdateMembroPercent={handleUpdateMembroPercent}
      />

      {/* Criar/Editar Contrato */}
      <ContratoModal
        isOpen={isContratoOpen}
        onClose={() => { setIsContratoOpen(false); setEditContratoData(null); }}
        onSave={handleSaveContrato}
        editData={editContratoData}
        redesExistentes={redesExistentes}
      />

      {/* Unificar Contratos */}
      <UnificacaoModal
        isOpen={isUnificacaoOpen}
        onClose={() => setIsUnificacaoOpen(false)}
        onConfirm={handleUnificarContratos}
        contratos={contratos}
      />

    </main>
  );
}
