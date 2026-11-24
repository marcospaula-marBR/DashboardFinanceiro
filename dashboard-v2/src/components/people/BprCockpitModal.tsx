"use client";

import { useState, useMemo, useEffect } from "react";
import { Employee, MonthlyCost, normalizeCompanyName } from "@/types/loans";
import { 
  BprRuleConfig, 
  BprCandidateResult, 
  BprCycle, 
  BprCamada, 
  BprAdditionalDeductionSource,
  BprDedicatedGroup,
  BprDedicatedGroupDistributionMode,
  BprDedicatedGroupEligibilityPolicy,
  BprDedicatedGroupFundingSource,
  BprDedicatedGroupImpactPreview,
  BprCalculationSummary,
  BprSavedScenario,
  BprSavedRun 
} from "@/types/bpr";
import { BprService } from "@/services/bpr.service";
import { BprPdfService, ScenarioComparisonItem, BprPdfMeta } from "@/services/bpr-pdf.service";
import { formatCurrency } from "@/services/loans.service";
import { 
  Award, X, CheckCircle2, AlertTriangle,
  DollarSign, FileText, Printer, Download, Save, FileUp, Sparkles, 
  Search, Calendar, ArrowLeft, FolderArchive, Scale, Trash2, 
  RotateCcw, Check, Eye, HelpCircle, Copy, Users, Plus
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

  // Modos de Visualização e Filtros da Tabela - SEMPRE FOCAR EM ELEGÍVEIS LOGO AO ABRIR
  const [statusFilter, setStatusFilter] = useState<'all' | 'eligible' | 'ineligible'>('eligible');
  const [camadaFilter, setCamadaFilter] = useState<'all' | BprCamada | 'dedicated'>('all');
  const [jobRoleFilter, setJobRoleFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployeeIdFilter, setSelectedEmployeeIdFilter] = useState<string>('');
  const [selectedIdsForNewGroup, setSelectedIdsForNewGroup] = useState<string[]>([]);

  // Simulador de Meta por Múltiplo Salarial por Camada (x)
  const [isTargetMultiplePanelOpen, setIsTargetMultiplePanelOpen] = useState(false);
  const [targetMultiples, setTargetMultiples] = useState<Record<BprCamada, number>>({ E: 2.0, T: 1.5, O: 1.0 });
  
  // Modais de Exceções Nominais & Grupos de Montante Específico
  const [isGlosadosModalOpen, setIsGlosadosModalOpen] = useState(false);
  const [isInativosModalOpen, setIsInativosModalOpen] = useState(false);
  const [isDedicatedGroupsModalOpen, setIsDedicatedGroupsModalOpen] = useState(false);
  const [dedicatedMemberSearchByGroup, setDedicatedMemberSearchByGroup] = useState<Record<string, string>>({});
  const [dedicatedRoleFilterByGroup, setDedicatedRoleFilterByGroup] = useState<Record<string, string>>({});
  const [dedicatedCamadaFilterByGroup, setDedicatedCamadaFilterByGroup] = useState<Record<string, string>>({});
  const [activeEditingGroupId, setActiveEditingGroupId] = useState<string | null>(null);
  const [isDocImportModalOpen, setIsDocImportModalOpen] = useState(false);
  const [docImportText, setDocImportText] = useState('');
  const [importedPatch, setImportedPatch] = useState<Partial<BprRuleConfig> | null>(null);
  const [isConfirmPatchOpen, setIsConfirmPatchOpen] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);

  // Cenários Salvos & Comparador
  const [savedScenarios, setSavedScenarios] = useState<BprSavedScenario[]>([]);
  const [isSaveScenarioModalOpen, setIsSaveScenarioModalOpen] = useState(false);
  const [isSavedScenariosModalOpen, setIsSavedScenariosModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Modal de Personalização da Exportação do Relatório (Elegíveis/Inelegíveis, Níveis, Empresas)
  const [isExportOptionsModalOpen, setIsExportOptionsModalOpen] = useState(false);
  const [exportCustomTargetSummary, setExportCustomTargetSummary] = useState<BprCalculationSummary | null>(null);
  const [exportCustomTargetConfig, setExportCustomTargetConfig] = useState<BprRuleConfig | null>(null);
  const [exportCustomTargetMeta, setExportCustomTargetMeta] = useState<BprPdfMeta | null>(null);

  // Filtros de Escopo do Relatório
  const [exportEligibility, setExportEligibility] = useState<'eligible_only' | 'ineligible_only' | 'all'>('eligible_only');
  const [exportSelectedCamadas, setExportSelectedCamadas] = useState<BprCamada[]>(['E', 'T', 'O']);
  const [exportSelectedCompanies, setExportSelectedCompanies] = useState<string[]>([]);
  const [exportSelectedDedicatedGroupIds, setExportSelectedDedicatedGroupIds] = useState<string[]>([]);
  const [exportNameQuery, setExportNameQuery] = useState('');
  const [exportIncludeSummaryCards, setExportIncludeSummaryCards] = useState(true);
  const [exportIncludeLayerSummary, setExportIncludeLayerSummary] = useState(true);
  const [exportIncludeSignatures, setExportIncludeSignatures] = useState(true);

  // Campos do Modal de Salvar Cenário
  const [scenarioNameInput, setScenarioNameInput] = useState('');
  const [studyDateInput, setStudyDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [criteriaDescriptionInput, setCriteriaDescriptionInput] = useState('');

  // Busca e Seleção na Central de Cenários
  const [scenarioSearchQuery, setScenarioSearchQuery] = useState('');
  const [selectedScenarioIdsForCompare, setSelectedScenarioIdsForCompare] = useState<string[]>([]);
  const [compareOnlyDiffs, setCompareOnlyDiffs] = useState(false);
  const [compareSearchQuery, setCompareSearchQuery] = useState('');

  // Modal de Clonagem / Variação de Cenário
  const [isCloneScenarioModalOpen, setIsCloneScenarioModalOpen] = useState(false);
  const [cloneTargetScenario, setCloneTargetScenario] = useState<BprSavedScenario | null>(null);
  const [cloneNameInput, setCloneNameInput] = useState('');
  const [cloneStudyDateInput, setCloneStudyDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [cloneCriteriaInput, setCloneCriteriaInput] = useState('');
  const [cloneSplitMode, setCloneSplitMode] = useState<'percentage' | 'amount'>('percentage');
  const [cloneTotalPool, setCloneTotalPool] = useState(0);
  const [cloneTierSplits, setCloneTierSplits] = useState<{ E: number; T: number; O: number }>({ E: 30, T: 40, O: 30 });
  const [cloneTierAmounts, setCloneTierAmounts] = useState<{ E: number; T: number; O: number }>({ E: 0, T: 0, O: 0 });

  // Carrega cenários salvos ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setSavedScenarios(BprService.loadSavedScenarios());
      setStatusFilter('eligible'); // Garante foco em elegíveis ao abrir
    }
  }, [isOpen]);

  // Seletor de Empresas e Vínculos
  const availableCompanies = useMemo(() => {
    const set = new Set<string>(['MarBR', 'DZM', 'G2']);
    employees.forEach(e => {
      if (e.name?.toUpperCase().includes('SYSTEM_GLOBAL') || e.corporate_name?.toUpperCase().includes('SYSTEM_GLOBAL')) return;
      if (e.company) set.add(normalizeCompanyName(e.company));
    });
    return Array.from(set).sort();
  }, [employees]);

  // Recálculo Reativo em Tempo Real
  const summary = useMemo(() => {
    return BprService.calculateBpr(employees, monthlyCosts, config);
  }, [employees, monthlyCosts, config]);

  // Pré-visualização Reativa do Cenário Cloned / Variação
  const clonePreviewSummary = useMemo(() => {
    if (!cloneTargetScenario) return null;
    const tempConfig: BprRuleConfig = {
      ...cloneTargetScenario.config,
      splitMode: cloneSplitMode,
      totalPoolAmount: cloneSplitMode === 'amount'
        ? Number(((cloneTierAmounts.E || 0) + (cloneTierAmounts.T || 0) + (cloneTierAmounts.O || 0)).toFixed(2))
        : cloneTotalPool,
      tierSplits: cloneTierSplits,
      tierAmounts: cloneTierAmounts
    };

    if (cloneTargetScenario.candidatesSnapshot && cloneTargetScenario.candidatesSnapshot.length > 0) {
      return BprService.recalculateSnapshotWithNewConfig(
        cloneTargetScenario.candidatesSnapshot,
        tempConfig
      );
    }
    return BprService.calculateBpr(employees, monthlyCosts, tempConfig);
  }, [
    cloneTargetScenario,
    cloneSplitMode,
    cloneTotalPool,
    cloneTierSplits,
    cloneTierAmounts,
    employees,
    monthlyCosts
  ]);

  // Validação da Soma de Splits ou Montante
  const isAmountMode = config.splitMode === 'amount';
  const totalSplitPercent = config.tierSplits.E + config.tierSplits.T + config.tierSplits.O;
  const totalAdditionalAmount = summary.totalAdditionalAmount || 0;
  const manualPercentReductionAmount = totalSplitPercent < 100
    ? ((100 - totalSplitPercent) / 100) * (config.totalPoolAmount || 0)
    : 0;
  const isSplitValid = isAmountMode
    ? (summary.totalPoolAmount > 0)
    : (
        totalSplitPercent === 100 ||
        (config.additionalDeductionSource !== 'extra_bonus' && totalSplitPercent < 100 && totalAdditionalAmount > 0 && Math.abs(manualPercentReductionAmount - totalAdditionalAmount) <= 1.0)
      );

  // Atualização de Valor Adicional por Colaborador
  const handleAdditionalAmountChange = (employeeId: string, rawVal: string) => {
    const parsed = parseFloat(rawVal);
    const sanitized = !isNaN(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 0;
    setConfig(prev => {
      const nextMap = { ...(prev.additionalAmounts || {}) };
      const nextReasons = { ...(prev.additionalReasons || {}) };
      if (sanitized > 0) {
        nextMap[employeeId] = sanitized;
      } else {
        delete nextMap[employeeId];
        delete nextReasons[employeeId];
      }
      return {
        ...prev,
        additionalAmounts: nextMap,
        additionalReasons: nextReasons
      };
    });
  };

  // Atualização de Motivo / Observação do Valor Adicional
  const handleAdditionalReasonChange = (employeeId: string, reason: string) => {
    setConfig(prev => {
      const nextReasons = { ...(prev.additionalReasons || {}) };
      if (reason.trim()) {
        nextReasons[employeeId] = reason.slice(0, 120);
      } else {
        delete nextReasons[employeeId];
      }
      return {
        ...prev,
        additionalReasons: nextReasons
      };
    });
  };

  const handleClearAllAdditionalAmounts = () => {
    setConfig(prev => ({
      ...prev,
      additionalAmounts: {},
      additionalReasons: {}
    }));
  };

  // CRUD de Grupos de Montante Específico (Rateio Exclusivo)
  const dedicatedGroups = config.dedicatedGroups || [];

  const handleCreateDedicatedGroup = () => {
    const nextIdx = (config.dedicatedGroups || []).length + 1;
    const newGroup: BprDedicatedGroup = {
      id: `bpr-grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Grupo Específico ${nextIdx}`,
      criteriaDescription: '',
      enabled: true,
      poolAmount: 5000,
      distributionMode: 'equal',
      fundingSource: 'total_pool',
      eligibilityPolicy: 'follow_bpr_rules',
      applyPerformanceFactor: true,
      reducedFactorPct: 75,
      redistributePerformanceResidual: true,
      members: [],
    };
    setConfig(prev => ({
      ...prev,
      allowDedicatedGroups: true,
      dedicatedGroups: [...(prev.dedicatedGroups || []), newGroup],
    }));
    setActiveEditingGroupId(newGroup.id);
  };

  const handleUpdateDedicatedGroup = (groupId: string, patch: Partial<BprDedicatedGroup>) => {
    setConfig(prev => ({
      ...prev,
      dedicatedGroups: (prev.dedicatedGroups || []).map(g => {
        if (g.id !== groupId) return g;
        const next: BprDedicatedGroup = { ...g, ...patch };
        if (patch.distributionMode === 'amount') {
          const sumAmt = Number(
            next.members.reduce((acc, m) => acc + Math.max(0, Number(m.amount || 0)), 0).toFixed(2)
          );
          if (sumAmt > 0) {
            next.poolAmount = sumAmt;
          }
        }
        return next;
      }),
    }));
  };

  const handleDeleteDedicatedGroup = (groupId: string) => {
    setConfig(prev => ({
      ...prev,
      dedicatedGroups: (prev.dedicatedGroups || []).filter(g => g.id !== groupId),
    }));
    if (activeEditingGroupId === groupId) {
      setActiveEditingGroupId(null);
    }
  };

  const handleToggleDedicatedGroupMember = (groupId: string, employeeId: string) => {
    setConfig(prev => ({
      ...prev,
      dedicatedGroups: (prev.dedicatedGroups || []).map(g => {
        if (g.id !== groupId) return g;
        const exists = g.members.some(m => m.employeeId === employeeId);
        const nextMembers = exists
          ? g.members.filter(m => m.employeeId !== employeeId)
          : [...g.members, { employeeId, percentage: 0, amount: 0 }];
        const nextPool = g.distributionMode === 'amount'
          ? Number(nextMembers.reduce((acc, m) => acc + Math.max(0, Number(m.amount || 0)), 0).toFixed(2))
          : g.poolAmount;
        return { ...g, members: nextMembers, poolAmount: nextPool };
      }),
    }));
  };

  const handleBatchSelectDedicatedMembers = (
    groupId: string,
    candidateIds: string[],
    mode: 'add' | 'remove'
  ) => {
    const targetSet = new Set(candidateIds);
    setConfig(prev => ({
      ...prev,
      dedicatedGroups: (prev.dedicatedGroups || []).map(g => {
        if (g.id !== groupId) return g;
        let nextMembers = g.members;
        if (mode === 'add') {
          const existingSet = new Set(g.members.map(m => m.employeeId));
          const toAppend = candidateIds
            .filter(id => !existingSet.has(id))
            .map(id => ({ employeeId: id, percentage: 0, amount: 0 }));
          nextMembers = [...g.members, ...toAppend];
        } else {
          nextMembers = g.members.filter(m => !targetSet.has(m.employeeId));
        }
        const nextPool = g.distributionMode === 'amount'
          ? Number(nextMembers.reduce((acc, m) => acc + Math.max(0, Number(m.amount || 0)), 0).toFixed(2))
          : g.poolAmount;
        return { ...g, members: nextMembers, poolAmount: nextPool };
      }),
    }));
  };

  const handleUpdateDedicatedMemberValue = (
    groupId: string,
    employeeId: string,
    field: 'percentage' | 'amount',
    rawVal: string
  ) => {
    const parsed = parseFloat(rawVal);
    const sanitized = !isNaN(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 0;
    setConfig(prev => ({
      ...prev,
      dedicatedGroups: (prev.dedicatedGroups || []).map(g => {
        if (g.id !== groupId) return g;
        const nextMembers = g.members.map(m =>
          m.employeeId === employeeId ? { ...m, [field]: sanitized } : m
        );
        const nextPool = field === 'amount' && g.distributionMode === 'amount'
          ? Number(nextMembers.reduce((acc, m) => acc + Math.max(0, Number(m.amount || 0)), 0).toFixed(2))
          : g.poolAmount;
        return { ...g, members: nextMembers, poolAmount: nextPool };
      }),
    }));
  };

  const handleUpdateDedicatedMemberFactor = (
    groupId: string,
    employeeId: string,
    rawVal: string
  ) => {
    const trimmed = rawVal.trim();
    const parsed = parseFloat(trimmed);
    const nextFactor = trimmed === '' || isNaN(parsed)
      ? undefined
      : Math.min(100, Math.max(0, Number(parsed.toFixed(1))));
    setConfig(prev => ({
      ...prev,
      dedicatedGroups: (prev.dedicatedGroups || []).map(g => {
        if (g.id !== groupId) return g;
        const nextMembers = g.members.map(m =>
          m.employeeId === employeeId ? { ...m, customFactorPct: nextFactor } : m
        );
        return { ...g, members: nextMembers };
      }),
    }));
  };

  const handleDistributeDedicatedGroupEquallyPct = (groupId: string) => {
    setConfig(prev => ({
      ...prev,
      dedicatedGroups: (prev.dedicatedGroups || []).map(g => {
        if (g.id !== groupId || g.members.length === 0) return g;
        const n = g.members.length;
        const base = Number((100 / n).toFixed(2));
        const remainder = Number((100 - base * n).toFixed(2));
        const nextMembers = g.members.map((m, idx) => ({
          ...m,
          percentage: idx === 0 ? Number((base + remainder).toFixed(2)) : base,
        }));
        return { ...g, members: nextMembers };
      }),
    }));
  };

  const formatDedicatedFundingLabel = (src: BprDedicatedGroupFundingSource) => {
    const map: Record<BprDedicatedGroupFundingSource, string> = {
      total_pool: 'Abate do Bolo Geral',
      extra_bonus: 'Acréscimo Extra (Não Abate)',
      E: 'Abate da Camada E',
      T: 'Abate da Camada T',
      O: 'Abate da Camada O',
    };
    return map[src] || src;
  };

  const formatDedicatedModeLabel = (mode: BprDedicatedGroupDistributionMode) => {
    const map: Record<BprDedicatedGroupDistributionMode, string> = {
      equal: 'Igualitário',
      percentage: '% por Pessoa',
      amount: 'Valor Fixo R$',
    };
    return map[mode] || mode;
  };

  const formatPctPtBr = (val?: number) =>
    `${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  const formatMultiplePtBr = (val?: number) =>
    `${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;

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
    const norm = normalizeCompanyName(company);
    setConfig(prev => {
      const current = (prev.companiesFilter || []).map(c => normalizeCompanyName(c));
      const exists = current.includes(norm);
      const updated = exists ? current.filter(c => c !== norm) : [...current, norm];
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

  // Normalização sem acentos para busca precisa por nome
  const normalizeSearchText = (str?: string) =>
    String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Projeção Reativa do Simulador de Meta por Múltiplo Salarial (x)
  const targetMultipleSimulation = useMemo(() => {
    return BprService.simulatePoolFromTargetMultiples(summary.candidates, targetMultiples);
  }, [summary.candidates, targetMultiples]);

  const handleLoadCurrentMultiplesToSimulator = () => {
    setTargetMultiples({
      E: summary.layers.E.bprMultipleOfMonthlyAvg || 2.0,
      T: summary.layers.T.bprMultipleOfMonthlyAvg || 1.5,
      O: summary.layers.O.bprMultipleOfMonthlyAvg || 1.0,
    });
  };

  const handleApplyTargetMultipleSimulation = () => {
    if (targetMultipleSimulation.totalRequiredPool <= 0) return;
    setConfig(prev => ({
      ...prev,
      splitMode: 'amount',
      totalPoolAmount: targetMultipleSimulation.totalRequiredPool,
      tierAmounts: {
        E: targetMultipleSimulation.layers.E.requiredLayerAmount,
        T: targetMultipleSimulation.layers.T.requiredLayerAmount,
        O: targetMultipleSimulation.layers.O.requiredLayerAmount,
      },
      tierSplits: {
        E: targetMultipleSimulation.layers.E.equivalentPercentage,
        T: targetMultipleSimulation.layers.T.equivalentPercentage,
        O: targetMultipleSimulation.layers.O.equivalentPercentage,
      }
    }));
  };

  // Listas de Cargos e Departamentos disponíveis para filtro rápido na grade
  const availableJobRoles = useMemo(() => {
    const set = new Set<string>();
    summary.candidates.forEach(c => {
      if (c.jobRole && c.jobRole.trim()) set.add(c.jobRole.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [summary.candidates]);

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    summary.candidates.forEach(c => {
      if (c.department && c.department.trim()) set.add(c.department.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [summary.candidates]);

  // Lista alfabética de nomes disponíveis para o dropdown "Filtrar por Nome"
  const availableCandidateNames = useMemo(() => {
    return summary.candidates
      .filter(c => {
        if (statusFilter === 'eligible' && !c.isEligible) return false;
        if (statusFilter === 'ineligible' && c.isEligible) return false;
        if (camadaFilter === 'dedicated' && !c.dedicatedGroupId) return false;
        if (camadaFilter !== 'all' && camadaFilter !== 'dedicated' && c.camada !== camadaFilter) return false;
        if (jobRoleFilter && c.jobRole !== jobRoleFilter) return false;
        if (departmentFilter && c.department !== departmentFilter) return false;
        return true;
      })
      .map(c => {
        const isPJ = c.linkType === 'PJ' || c.linkType === 'MEI' || Boolean(c.corporateName);
        const primary = isPJ ? (c.corporateName || c.name) : c.name;
        const resp = isPJ && c.responsibleName && c.responsibleName !== primary ? ` (${c.responsibleName})` : '';
        return { id: c.employeeId, label: `${primary}${resp}` };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [summary.candidates, statusFilter, camadaFilter, jobRoleFilter, departmentFilter]);

  // Filtragem da Lista para Exibição
  const displayedCandidates = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    return summary.candidates.filter(c => {
      if (statusFilter === 'eligible' && !c.isEligible) return false;
      if (statusFilter === 'ineligible' && c.isEligible) return false;
      if (camadaFilter === 'dedicated' && !c.dedicatedGroupId) return false;
      if (camadaFilter !== 'all' && camadaFilter !== 'dedicated' && c.camada !== camadaFilter) return false;
      if (jobRoleFilter && c.jobRole !== jobRoleFilter) return false;
      if (departmentFilter && c.department !== departmentFilter) return false;
      if (selectedEmployeeIdFilter && c.employeeId !== selectedEmployeeIdFilter) return false;

      if (q) {
        const haystack = normalizeSearchText(
          `${c.name} ${c.corporateName || ''} ${c.responsibleName || ''} ${c.jobRole || ''} ${c.department || ''} ${c.dedicatedGroupName || ''}`
        );
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [summary.candidates, statusFilter, camadaFilter, jobRoleFilter, departmentFilter, selectedEmployeeIdFilter, searchQuery]);

  // Seleção direta na Grade Principal para criar Grupo / Cenário de Montante Específico
  const selectableDisplayedIds = useMemo(() => {
    const excludedSet = new Set(config.manuallyExcludedEmployeeIds || []);
    return displayedCandidates
      .filter(c => !excludedSet.has(c.employeeId) && !c.dedicatedGroupId)
      .map(c => c.employeeId);
  }, [displayedCandidates, config.manuallyExcludedEmployeeIds]);

  const selectedCandidatesSummary = useMemo(() => {
    const selectedSet = new Set(selectedIdsForNewGroup);
    const chosen = summary.candidates.filter(c => selectedSet.has(c.employeeId) && !c.dedicatedGroupId);
    const counts: Record<BprCamada, number> = { E: 0, T: 0, O: 0 };
    let eligibleInSelection = 0;
    chosen.forEach(c => {
      counts[c.camada] = (counts[c.camada] || 0) + 1;
      if (c.isEligible) eligibleInSelection += 1;
    });
    const sorted = (['O', 'T', 'E'] as BprCamada[]).sort((a, b) => counts[b] - counts[a]);
    const predominantCamada: BprCamada = counts[sorted[0]] > 0 ? sorted[0] : 'O';
    return { chosen, count: chosen.length, eligibleInSelection, predominantCamada };
  }, [selectedIdsForNewGroup, summary.candidates]);

  const handleToggleSelectForNewGroup = (employeeId: string) => {
    setSelectedIdsForNewGroup(prev =>
      prev.includes(employeeId) ? prev.filter(id => id !== employeeId) : [...prev, employeeId]
    );
  };

  const handleToggleSelectAllVisibleForNewGroup = () => {
    const allVisibleSelected =
      selectableDisplayedIds.length > 0 &&
      selectableDisplayedIds.every(id => selectedIdsForNewGroup.includes(id));
    if (allVisibleSelected) {
      const visibleSet = new Set(selectableDisplayedIds);
      setSelectedIdsForNewGroup(prev => prev.filter(id => !visibleSet.has(id)));
    } else {
      setSelectedIdsForNewGroup(prev => Array.from(new Set([...prev, ...selectableDisplayedIds])));
    }
  };

  const handleCreateDedicatedGroupFromSelection = () => {
    const chosen = selectedCandidatesSummary.chosen;
    if (chosen.length === 0) return;

    const nextIdx = (config.dedicatedGroups || []).length + 1;
    const uniqueRoles = Array.from(new Set(chosen.map(c => (c.jobRole || '').trim()).filter(Boolean)));
    const qClean = searchQuery.trim();
    let suggestedName = `Grupo Específico ${nextIdx}`;
    if (jobRoleFilter) {
      suggestedName = `Grupo ${jobRoleFilter}`;
    } else if (departmentFilter) {
      suggestedName = `Grupo ${departmentFilter}`;
    } else if (qClean.length >= 3 && qClean.length <= 30) {
      suggestedName = `Grupo ${qClean}`;
    } else if (uniqueRoles.length === 1) {
      suggestedName = `Grupo ${uniqueRoles[0]}`;
    }

    const newGroup: BprDedicatedGroup = {
      id: `bpr-grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: suggestedName.slice(0, 80),
      criteriaDescription: '',
      enabled: true,
      poolAmount: 5000,
      distributionMode: 'equal',
      fundingSource: selectedCandidatesSummary.predominantCamada,
      eligibilityPolicy: 'follow_bpr_rules',
      applyPerformanceFactor: true,
      reducedFactorPct: 75,
      redistributePerformanceResidual: true,
      members: chosen.map(c => ({ employeeId: c.employeeId, percentage: 0, amount: 0 })),
    };

    setConfig(prev => ({
      ...prev,
      allowDedicatedGroups: true,
      dedicatedGroups: [...(prev.dedicatedGroups || []), newGroup],
    }));
    setSelectedIdsForNewGroup([]);
    setActiveEditingGroupId(newGroup.id);
    setIsDedicatedGroupsModalOpen(true);
  };

  // Prévia Antes x Depois de cada grupo no Modal de Grupos Específicos
  const groupImpactPreviewMap = useMemo(() => {
    const map = new Map<string, BprDedicatedGroupImpactPreview>();
    if (!isDedicatedGroupsModalOpen) return map;
    (config.dedicatedGroups || []).forEach(g => {
      map.set(g.id, BprService.previewDedicatedGroupImpact(employees, monthlyCosts, config, g.id));
    });
    return map;
  }, [isDedicatedGroupsModalOpen, employees, monthlyCosts, config]);

  const handleApplyGroupsAndSaveScenario = () => {
    setIsDedicatedGroupsModalOpen(false);
    const activeNames = (summary.dedicatedGroupSummaries || []).map(g => g.name).filter(Boolean);
    const cycleLabel = config.cycle === 'ciclo_1' ? '1º Sem' : config.cycle === 'ciclo_2' ? '2º Sem' : 'Estudo';
    const suffix = activeNames.length > 0 ? ` — ${activeNames.slice(0, 2).join(' + ')}` : '';
    setScenarioNameInput(`Cenário BPR ${cycleLabel} ${config.year}${suffix}`);
    setStudyDateInput(new Date().toISOString().slice(0, 10));
    setCriteriaDescriptionInput(generateCurrentCriteriaSummary());
    setIsSaveScenarioModalOpen(true);
  };

  // Resumo Dinâmico dos Critérios Ativos
  const generateCurrentCriteriaSummary = () => {
    const cycleLabel = config.cycle === 'ciclo_1' ? '1º Semestre' : config.cycle === 'ciclo_2' ? '2º Semestre' : 'Custom';
    const splitDesc = config.splitMode === 'amount' && config.tierAmounts
      ? `Rateio por Valor R$: Estratégico R$ ${config.tierAmounts.E.toLocaleString('pt-BR')}, Tático R$ ${config.tierAmounts.T.toLocaleString('pt-BR')}, Operacional R$ ${config.tierAmounts.O.toLocaleString('pt-BR')}`
      : `Rateio Percentual: Estratégico ${config.tierSplits.E}%, Tático ${config.tierSplits.T}%, Operacional ${config.tierSplits.O}%`;
    const glosaDesc = config.allowGlosados
      ? `Glosados incluídos (${config.selectedGlosadosExceptions.length} exceções)`
      : 'Glosados desclassificados';
    const inativoDesc = config.allowInativos
      ? `Inativos na data de pagamento incluídos (${config.selectedInativosExceptions.length} exceções)`
      : 'Inativos desclassificados';
    const empresasDesc = config.companiesFilter.length > 0 ? `Empresas: ${config.companiesFilter.join(', ')}` : 'Todas as empresas';
    const vinculosDesc = config.linkTypesFilter.length > 0 ? `Vínculos: ${config.linkTypesFilter.join(', ')}` : 'Todos os regimes (CLT, PJ, etc.)';
    const sourceLabelMap: Record<string, string> = {
      total_pool: 'Abatido do Total Rateado',
      own_layer: 'Abatido da Própria Camada',
      E: 'Abatido da Camada Estratégico (E)',
      T: 'Abatido da Camada Tático (T)',
      O: 'Abatido da Camada Operacional (O)',
      extra_bonus: 'Acréscimo de Bônus ao Total (Sem Abatimento)',
    };
    const addDesc = (summary.totalAdditionalAmount || 0) > 0
      ? ` | Adicionais Individuais: R$ ${(summary.totalAdditionalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${sourceLabelMap[config.additionalDeductionSource || 'total_pool']})`
      : '';
    const dedicatedDesc = (summary.dedicatedGroupsCount || 0) > 0
      ? ` | Grupos de Montante Específico: ${summary.dedicatedGroupsCount} grupo(s) · ${summary.dedicatedMembersCount || 0} pessoa(s) · R$ ${(summary.dedicatedGroupsAllocatedTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : '';

    return `Ciclo ${cycleLabel} ${config.year} | Montante R$ ${summary.totalPoolAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${splitDesc}${dedicatedDesc}${addDesc} | ${glosaDesc} | ${inativoDesc} | ${empresasDesc} | ${vinculosDesc}`;
  };

  // Abrir Modal de Salvar Cenário
  const handleOpenSaveScenarioModal = () => {
    const defaultName = `Cenário BPR ${config.cycle === 'ciclo_1' ? '1º Sem' : config.cycle === 'ciclo_2' ? '2º Sem' : 'Estudo'} ${config.year} - ${new Date().toLocaleDateString('pt-BR')}`;
    setScenarioNameInput(defaultName);
    setStudyDateInput(new Date().toISOString().slice(0, 10));
    setCriteriaDescriptionInput(generateCurrentCriteriaSummary());
    setIsSaveScenarioModalOpen(true);
  };

  // Confirmar e Salvar Cenário
  const handleConfirmSaveScenario = async () => {
    if (!scenarioNameInput.trim()) return;

    // Salva configuração ativa
    BprService.saveConfig(config);

    const newScenario: BprSavedScenario = {
      id: `bpr-scen-${Date.now()}`,
      name: scenarioNameInput.trim(),
      studyDate: studyDateInput || new Date().toISOString().slice(0, 10),
      criteriaDescription: criteriaDescriptionInput.trim() || generateCurrentCriteriaSummary(),
      createdAt: new Date().toISOString(),
      config: JSON.parse(JSON.stringify(config)),
      summary: {
        totalPoolAmount: summary.totalPoolAmount,
        basePoolAmount: summary.basePoolAmount,
        extraBonusAmount: summary.extraBonusAmount,
        totalAdditionalAmount: summary.totalAdditionalAmount,
        netPoolForLayers: summary.netPoolForLayers,
        totalPeriodReceivedAmount: summary.totalPeriodReceivedAmount,
        overallRelativeWeight: summary.overallRelativeWeight,
        dedicatedGroupsTotalPool: summary.dedicatedGroupsTotalPool,
        dedicatedGroupsAllocatedTotal: summary.dedicatedGroupsAllocatedTotal,
        dedicatedGroupsExtraBonusTotal: summary.dedicatedGroupsExtraBonusTotal,
        dedicatedGroupsCount: summary.dedicatedGroupsCount,
        dedicatedMembersCount: summary.dedicatedMembersCount,
        dedicatedGroupSummaries: summary.dedicatedGroupSummaries,
        totalDistributedAmount: summary.totalDistributedAmount,
        residualAmount: summary.residualAmount,
        totalCandidates: summary.totalCandidates,
        totalEligible: summary.totalEligible,
        totalIneligible: summary.totalIneligible,
        amountPerE: summary.layers.E.amountPerEligible,
        amountPerT: summary.layers.T.amountPerEligible,
        amountPerO: summary.layers.O.amountPerEligible,
        layers: summary.layers
      },
      candidatesSnapshot: summary.candidates
    };

    await BprService.saveScenarioAsync(newScenario);
    setSavedScenarios(BprService.loadSavedScenarios());
    setIsSaveScenarioModalOpen(false);
    setSaveSuccessToast(`Cenário "${newScenario.name}" salvo com sucesso!`);
    setTimeout(() => setSaveSuccessToast(null), 3500);
  };

  // Excluir Cenário Salvo
  const handleDeleteScenario = async (id: string) => {
    if (!confirm('Deseja realmente excluir este cenário salvo?')) return;
    await BprService.deleteScenarioAsync(id);
    const updated = BprService.loadSavedScenarios();
    setSavedScenarios(updated);
    setSelectedScenarioIdsForCompare(prev => prev.filter(scId => scId !== id));
    setSaveSuccessToast('Cenário excluído com sucesso.');
    setTimeout(() => setSaveSuccessToast(null), 3000);
  };

  // Restaurar / Carregar Cenário no Cockpit Ativo
  const handleRestoreScenario = (scenario: BprSavedScenario) => {
    setConfig(scenario.config);
    setIsSavedScenariosModalOpen(false);
    setSaveSuccessToast(`Cenário "${scenario.name}" restaurado no simulador!`);
    setTimeout(() => setSaveSuccessToast(null), 3500);
  };

  // Abrir Modal de Clonagem de Cenário
  const handleOpenCloneModal = (scenario: BprSavedScenario) => {
    setCloneTargetScenario(scenario);
    setCloneNameInput(`${scenario.name} (Variação)`);
    setCloneStudyDateInput(new Date().toISOString().slice(0, 10));
    setCloneCriteriaInput(`Variação baseada em "${scenario.name}": `);
    const mode = scenario.config.splitMode || 'percentage';
    setCloneSplitMode(mode);
    setCloneTotalPool(scenario.config.totalPoolAmount || scenario.summary.totalPoolAmount || 0);
    setCloneTierSplits(scenario.config.tierSplits ? { ...scenario.config.tierSplits } : { E: 30, T: 40, O: 30 });
    setCloneTierAmounts(scenario.config.tierAmounts ? { ...scenario.config.tierAmounts } : { E: 0, T: 0, O: 0 });
    setIsCloneScenarioModalOpen(true);
  };

  // Confirmar e Salvar Cenário Cloned / Variação
  const handleConfirmSaveClone = async () => {
    if (!cloneTargetScenario || !cloneNameInput.trim()) return;

    if (cloneSplitMode === 'percentage') {
      const sumSplits = (cloneTierSplits.E || 0) + (cloneTierSplits.T || 0) + (cloneTierSplits.O || 0);
      if (sumSplits !== 100) {
        alert(`A soma dos percentuais deve ser exatamente 100% (atual: ${sumSplits}%). Ajuste os valores antes de salvar.`);
        return;
      }
    }

    const newConfig: BprRuleConfig = {
      ...cloneTargetScenario.config,
      splitMode: cloneSplitMode,
      totalPoolAmount: cloneSplitMode === 'amount'
        ? Number(((cloneTierAmounts.E || 0) + (cloneTierAmounts.T || 0) + (cloneTierAmounts.O || 0)).toFixed(2))
        : cloneTotalPool,
      tierSplits: cloneTierSplits,
      tierAmounts: cloneTierAmounts
    };

    const clonedScenario = BprService.createClonedScenario(
      cloneTargetScenario,
      {
        name: cloneNameInput.trim(),
        studyDate: cloneStudyDateInput || new Date().toISOString().slice(0, 10),
        criteriaDescription: cloneCriteriaInput.trim() || `Variação a partir de "${cloneTargetScenario.name}"`,
        newConfig
      },
      employees,
      monthlyCosts
    );

    await BprService.saveScenarioAsync(clonedScenario);
    const updatedScenarios = BprService.loadSavedScenarios();
    setSavedScenarios(updatedScenarios);
    setIsCloneScenarioModalOpen(false);
    setSaveSuccessToast(`Variação "${clonedScenario.name}" salva com sucesso na Central de Cenários!`);
    setTimeout(() => setSaveSuccessToast(null), 3500);
  };

  // Carregar Configuração da Variação no Cockpit Ativo
  const handleApplyCloneToSimulator = () => {
    if (!cloneTargetScenario) return;

    const newConfig: BprRuleConfig = {
      ...cloneTargetScenario.config,
      splitMode: cloneSplitMode,
      totalPoolAmount: cloneSplitMode === 'amount'
        ? Number(((cloneTierAmounts.E || 0) + (cloneTierAmounts.T || 0) + (cloneTierAmounts.O || 0)).toFixed(2))
        : cloneTotalPool,
      tierSplits: cloneTierSplits,
      tierAmounts: cloneTierAmounts
    };

    setConfig(newConfig);
    setIsCloneScenarioModalOpen(false);
    setIsSavedScenariosModalOpen(false);
    setSaveSuccessToast(`Parâmetros da variação de "${cloneTargetScenario.name}" carregados no Cockpit!`);
    setTimeout(() => setSaveSuccessToast(null), 3500);
  };

  // Abrir Modal de Opções de Personalização do Relatório (Elegíveis/Inelegíveis, Níveis, Empresas)
  const handleOpenExportOptionsModal = (
    customSummary?: BprCalculationSummary,
    customConfig?: BprRuleConfig,
    meta?: BprPdfMeta
  ) => {
    setExportCustomTargetSummary(customSummary || summary);
    setExportCustomTargetConfig(customConfig || config);
    setExportCustomTargetMeta(meta || {
      scenarioName: `Apuração BPR ${config.cycle === 'ciclo_1' ? '1º Sem' : config.cycle === 'ciclo_2' ? '2º Sem' : 'Custom'} ${config.year}`,
      studyDate: new Date().toISOString().slice(0, 10),
      criteria: generateCurrentCriteriaSummary()
    });
    // Padrão executivo: foco estrito em elegíveis
    setExportEligibility('eligible_only');
    setExportSelectedCamadas(['E', 'T', 'O']);
    setExportSelectedCompanies([]);
    setExportSelectedDedicatedGroupIds([]);
    setExportNameQuery('');
    setExportIncludeSummaryCards(true);
    setExportIncludeLayerSummary(true);
    setExportIncludeSignatures(true);
    setIsExportOptionsModalOpen(true);
  };

  // Grupos de Montante Específico disponíveis no escopo alvo da exportação
  const availableExportDedicatedGroups = useMemo(() => {
    const activeSumm = exportCustomTargetSummary || summary;
    if (activeSumm.dedicatedGroupSummaries && activeSumm.dedicatedGroupSummaries.length > 0) {
      return activeSumm.dedicatedGroupSummaries.map(gs => ({
        id: gs.groupId,
        name: gs.name,
        memberCount: gs.memberCount,
        allocatedTotal: gs.allocatedTotal,
      }));
    }
    const byId = new Map<string, { id: string; name: string; memberCount: number; allocatedTotal: number }>();
    (activeSumm.candidates || []).forEach(c => {
      if (!c.dedicatedGroupId) return;
      const prev = byId.get(c.dedicatedGroupId) || {
        id: c.dedicatedGroupId,
        name: c.dedicatedGroupName || 'Grupo Específico',
        memberCount: 0,
        allocatedTotal: 0,
      };
      prev.memberCount += 1;
      prev.allocatedTotal = Number((prev.allocatedTotal + (c.isEligible ? c.allocatedAmount : 0)).toFixed(2));
      byId.set(c.dedicatedGroupId, prev);
    });
    return Array.from(byId.values());
  }, [exportCustomTargetSummary, summary]);

  const handleToggleExportDedicatedGroup = (id: string) => {
    if (!id) {
      setExportSelectedDedicatedGroupIds([]);
      return;
    }
    if (id === '__ALL_DEDICATED__' || id === '__STANDARD_LAYERS__') {
      setExportSelectedDedicatedGroupIds(prev => (prev.length === 1 && prev[0] === id ? [] : [id]));
      return;
    }
    setExportSelectedDedicatedGroupIds(prev => {
      const cleaned = prev.filter(item => item !== '__ALL_DEDICATED__' && item !== '__STANDARD_LAYERS__');
      return cleaned.includes(id) ? cleaned.filter(item => item !== id) : [...cleaned, id];
    });
  };

  // Confirmar Exportação com Filtros Selecionados
  const handleConfirmExportPdf = (mode: 'download' | 'print') => {
    const activeSumm = exportCustomTargetSummary || summary;
    const activeConf = exportCustomTargetConfig || config;
    const selectedGroupLabels = exportSelectedDedicatedGroupIds.map(id => {
      if (id === '__ALL_DEDICATED__') return 'Somente Grupos Específicos';
      if (id === '__STANDARD_LAYERS__') return 'Somente Camadas E/T/O';
      return availableExportDedicatedGroups.find(g => g.id === id)?.name || id;
    });
    const fullMeta: BprPdfMeta = {
      ...(exportCustomTargetMeta || {}),
      eligibilityFilter: exportEligibility,
      selectedCamadas: exportSelectedCamadas,
      selectedCompanies: exportSelectedCompanies,
      selectedDedicatedGroupIds: exportSelectedDedicatedGroupIds,
      selectedDedicatedGroupLabels: selectedGroupLabels,
      nameQuery: exportNameQuery.trim() || undefined,
      includeSummaryCards: exportIncludeSummaryCards,
      includeLayerSummary: exportIncludeLayerSummary,
      includeSignatures: exportIncludeSignatures
    };

    if (mode === 'download') {
      BprPdfService.exportBprPdf(activeSumm, activeConf, fullMeta);
    } else {
      BprPdfService.openPrintableReport(activeSumm, activeConf, fullMeta);
    }

    setIsExportOptionsModalOpen(false);
  };

  // Pré-visualização dos candidatos do relatório personalizado
  const exportPreviewCandidates = useMemo(() => {
    const targetCandidates = (exportCustomTargetSummary || summary).candidates || [];
    return BprPdfService.filterCandidates(targetCandidates, {
      eligibilityFilter: exportEligibility,
      selectedCamadas: exportSelectedCamadas,
      selectedCompanies: exportSelectedCompanies,
      selectedDedicatedGroupIds: exportSelectedDedicatedGroupIds,
      nameQuery: exportNameQuery.trim() || undefined
    });
  }, [exportCustomTargetSummary, summary, exportEligibility, exportSelectedCamadas, exportSelectedCompanies, exportSelectedDedicatedGroupIds, exportNameQuery]);

  const exportPreviewTotalDistributed = useMemo(() => {
    return exportPreviewCandidates.reduce((s, c) => s + (c.isEligible ? c.allocatedAmount : 0), 0);
  }, [exportPreviewCandidates]);

  // Alternar Seleção de Empresa no Modal de Exportação
  const handleToggleExportCompany = (comp: string) => {
    setExportSelectedCompanies(prev => 
      prev.includes(comp) ? prev.filter(c => c !== comp) : [...prev, comp]
    );
  };

  // Alternar Seleção de Camada no Modal de Exportação
  const handleToggleExportCamada = (camada: BprCamada) => {
    setExportSelectedCamadas(prev => 
      prev.includes(camada) ? prev.filter(c => c !== camada) : [...prev, camada]
    );
  };

  // Alternar Seleção de Cenário para Comparação
  const handleToggleSelectScenarioForCompare = (id: string) => {
    setSelectedScenarioIdsForCompare(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Lista de Cenários Filtrados para a Central de Cenários
  const filteredSavedScenarios = useMemo(() => {
    if (!scenarioSearchQuery.trim()) return savedScenarios;
    const q = scenarioSearchQuery.toLowerCase();
    return savedScenarios.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.studyDate.includes(q) ||
      s.criteriaDescription.toLowerCase().includes(q) ||
      s.config.cycle.toLowerCase().includes(q) ||
      String(s.config.year).includes(q)
    );
  }, [savedScenarios, scenarioSearchQuery]);

  // Lista de Cenários Selecionados para o Comparador
  const scenariosToCompare = useMemo(() => {
    return savedScenarios.filter(s => selectedScenarioIdsForCompare.includes(s.id));
  }, [savedScenarios, selectedScenarioIdsForCompare]);

  // Peso Relativo por Camada (E, T, O e Geral) para cada Cenário Comparado (com hidratação para cenários antigos)
  const scenarioWeightsMap = useMemo(() => {
    const out = new Map<string, ReturnType<typeof BprService.computeLayerRelativeWeights>>();
    scenariosToCompare.forEach(sc => {
      const snap = sc.candidatesSnapshot || [];
      const hasEmbeddedHistory = snap.some(c => (c.periodReceivedAverage || 0) > 0);
      if (hasEmbeddedHistory || monthlyCosts.length === 0) {
        out.set(sc.id, BprService.computeLayerRelativeWeights(snap));
        return;
      }
      // Cenário salvo antes da v.02.60.25: hidrata histórico do período sem alterar os valores congelados do cenário
      const histRef = BprService.calculateBpr(employees, monthlyCosts, sc.config);
      const histById = new Map(histRef.candidates.map(c => [c.employeeId, c]));
      const hydrated = snap.map(c => {
        const ref = histById.get(c.employeeId);
        return ref
          ? {
              ...c,
              periodReceivedTotal: ref.periodReceivedTotal,
              periodReceivedAverage: ref.periodReceivedAverage,
              periodMonthsCount: ref.periodMonthsCount
            }
          : c;
      });
      out.set(sc.id, BprService.computeLayerRelativeWeights(hydrated));
    });
    return out;
  }, [scenariosToCompare, employees, monthlyCosts]);

  // Linhas Comparativas Dedicadas para Grupos de Montante Específico entre Cenários
  const dedicatedGroupComparisonRows = useMemo(() => {
    if (scenariosToCompare.length === 0) return [];
    return BprPdfService.buildDedicatedGroupsComparisonRows(scenariosToCompare);
  }, [scenariosToCompare]);

  // Linhas Analíticas do Comparador
  const comparisonRows = useMemo(() => {
    if (scenariosToCompare.length === 0) return [];
    const rows = BprPdfService.buildComparisonRows(scenariosToCompare);
    
    return rows.filter(r => {
      if (compareOnlyDiffs && scenariosToCompare.length >= 2) {
        if (Math.abs(r.delta || 0) < 0.01) return false;
      }
      if (compareSearchQuery.trim()) {
        const q = compareSearchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q) || (r.corporateName || '').toLowerCase().includes(q);
        const matchesRole = (r.jobRole || '').toLowerCase().includes(q) || (r.department || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRole) return false;
      }
      return true;
    });
  }, [scenariosToCompare, compareOnlyDiffs, compareSearchQuery]);

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
    <div className="fixed inset-0 z-50 flex items-stretch bg-white overflow-hidden animate-in fade-in duration-200">
      
      {/* Contêiner do Modal — tela cheia, tema claro */}
      <div className="bg-white w-full h-full flex flex-col overflow-hidden text-slate-900 font-sans">
        
        {/* ── HEADER EXECUTIVO ── */}
        <header className="px-6 sm:px-10 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0 shadow-sm">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold transition-all active:scale-95 cursor-pointer mr-1"
              title="Voltar para a página People"
            >
              <ArrowLeft size={16} className="text-slate-600" />
              <span className="hidden sm:inline">Voltar ao People</span>
            </button>

            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Award size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                  BPR — Bônus por Participação nos Resultados
                </h2>
                <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Semestral &amp; Rateio por Camada
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Apuração determinística per capita com distribuição entre Estratégico, Tático e Operacional/CLTs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDocImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer"
              title="Importar regulamento ou ata para auto-configurar regras"
            >
              <FileUp size={15} className="text-amber-500" />
              <span className="hidden sm:inline">Importar Regras</span>
            </button>

            {/* Ações de Exportação PDF: Personalizar / Baixar / Imprimir */}
            <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleOpenExportOptionsModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm cursor-pointer"
                title="Personalizar quais colaboradores, níveis e empresas constarão no PDF"
              >
                <Download size={14} />
                <span>Exportar PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenExportOptionsModal()}
                className="p-1.5 text-emerald-800 hover:bg-emerald-200/60 rounded-lg transition-all cursor-pointer"
                title="Personalizar e abrir relatório formatado para impressão física ou salvar como PDF"
              >
                <Printer size={15} />
              </button>
            </div>

            {/* Central de Cenários Salvos com Badge de Contagem */}
            <button
              type="button"
              onClick={() => setIsSavedScenariosModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer relative"
              title="Consultar cenários anteriores, comparar estudos e imprimir a qualquer momento"
            >
              <FolderArchive size={15} className="text-amber-600" />
              <span>Cenários Salvos</span>
              {savedScenarios.length > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-[18px] text-center">
                  {savedScenarios.length}
                </span>
              )}
            </button>

            {/* Salvar Novo Cenário / Estudo */}
            <button
              type="button"
              onClick={handleOpenSaveScenarioModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-indigo-700/20 cursor-pointer"
              title="Salvar cenário e congelar critérios com data do estudo para impressão posterior"
            >
              <Save size={15} />
              <span>Salvar Cenário</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-all cursor-pointer ml-1 font-bold text-xs sm:text-sm"
              title="Fechar cockpit e voltar à página People"
            >
              <X size={18} />
              <span className="hidden md:inline">Fechar</span>
            </button>
          </div>
        </header>

        {/* ── CONTEÚDO SCROLLÁVEL PRINCIPAL ── */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 bg-slate-50">
          
          {/* 1. SELEÇÃO DE CICLO & CONTROLES DO PERÍODO */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Calendar size={17} className="text-amber-500" />
                <span className="text-sm font-black uppercase tracking-wider text-slate-700">
                  Ciclo &amp; Período Eletivo
                </span>
              </div>

              {/* Seletor de Ciclo Semestral */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleCycleChange('ciclo_1')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-black transition-all cursor-pointer ${
                    config.cycle === 'ciclo_1'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  📅 Ciclo 1 (Pago até Março · Ref: 01/07 a 31/12)
                </button>
                <button
                  type="button"
                  onClick={() => handleCycleChange('ciclo_2')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-black transition-all cursor-pointer ${
                    config.cycle === 'ciclo_2'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  📅 Ciclo 2 (Pago até Setembro · Ref: 01/01 a 30/06)
                </button>
                <button
                  type="button"
                  onClick={() => handleCycleChange('custom')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-black transition-all cursor-pointer ${
                    config.cycle === 'custom'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ⚙️ Customizado
                </button>
              </div>
            </div>

            {/* Inputs de Datas & Filtros de Escopo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Ano de Referência
                </label>
                <input
                  type="number"
                  value={config.year}
                  onChange={e => {
                    const yr = parseInt(e.target.value) || new Date().getFullYear();
                    setConfig(prev => ({ ...prev, year: yr }));
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-mono font-bold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Início do Período Eletivo
                </label>
                <input
                  type="date"
                  value={config.periodStartDate}
                  onChange={e => setConfig(prev => ({ ...prev, periodStartDate: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-mono outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Fim do Período Eletivo
                </label>
                <input
                  type="date"
                  value={config.periodEndDate}
                  onChange={e => setConfig(prev => ({ ...prev, periodEndDate: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-mono outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-amber-600 uppercase tracking-wider block mb-1.5">
                  Data de Pagamento (Ativo)
                </label>
                <input
                  type="date"
                  value={config.paymentDate}
                  onChange={e => setConfig(prev => ({ ...prev, paymentDate: e.target.value }))}
                  className="w-full bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5 text-sm text-amber-800 font-mono font-bold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                />
              </div>
            </div>

            {/* SELEÇÃO MÚLTIPLA DE EMPRESAS E TIPO DE VÍNCULO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              {/* Seleção Múltipla de Empresas */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>🏢 Seleção de Empresas ({config.companiesFilter.length === 0 ? 'Todas' : `${config.companiesFilter.length} marcadas`})</span>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, companiesFilter: [] }))}
                    className="text-[11px] text-amber-600 hover:underline font-normal"
                  >
                    Marcar Todas
                  </button>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, companiesFilter: [] }))}
                    className={`px-3.5 py-1.5 rounded-xl text-sm font-black transition-all ${
                      config.companiesFilter.length === 0 
                        ? 'bg-amber-500 text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-500 border border-slate-200 hover:text-slate-800'
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
                        className={`px-3.5 py-1.5 rounded-xl text-sm font-black transition-all flex items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-amber-50 text-amber-700 border border-amber-300' 
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:text-slate-800'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                        <span>{comp}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seleção de Vínculo */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>💼 Tipo de Vínculo ({config.linkTypesFilter.length === 0 ? 'Ambos / Todos' : config.linkTypesFilter.join(' + ')})</span>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, linkTypesFilter: [] }))}
                    className="text-[11px] text-amber-600 hover:underline font-normal"
                  >
                    Ambos / Todos
                  </button>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, linkTypesFilter: [] }))}
                    className={`px-3.5 py-1.5 rounded-xl text-sm font-black transition-all ${
                      config.linkTypesFilter.length === 0 
                        ? 'bg-amber-500 text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-500 border border-slate-200 hover:text-slate-800'
                    }`}
                  >
                    Ambos (Todos)
                  </button>
                  {['CLT', 'PJ', 'Estagiário', 'Terceirizado'].map(lk => {
                    const isSelected = config.linkTypesFilter.includes(lk);
                    return (
                      <button
                        key={lk}
                        type="button"
                        onClick={() => handleToggleLinkType(lk)}
                        className={`px-3.5 py-1.5 rounded-xl text-sm font-black transition-all flex items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-300' 
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:text-slate-800'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-500' : 'bg-slate-400'}`}></span>
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
            
            {/* Lado Esquerdo: Input de Montante Total & Rateio por Camada (% ou R$) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign size={17} className="text-emerald-600" />
                  <span className="text-sm font-black uppercase tracking-wider text-slate-700">
                    Montante &amp; Rateio por Perfil
                  </span>
                </div>
                
                {/* Seletor de Modo: % vs R$ Fixo */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, splitMode: 'percentage' }))}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      config.splitMode !== 'amount' 
                        ? 'bg-white text-slate-900 shadow-sm font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Por %
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => {
                      const eAmt = prev.tierAmounts?.E ?? Math.round((prev.totalPoolAmount * prev.tierSplits.E) / 100);
                      const tAmt = prev.tierAmounts?.T ?? Math.round((prev.totalPoolAmount * prev.tierSplits.T) / 100);
                      const oAmt = prev.tierAmounts?.O ?? Math.round((prev.totalPoolAmount * prev.tierSplits.O) / 100);
                      return {
                        ...prev,
                        splitMode: 'amount',
                        tierAmounts: { E: eAmt, T: tAmt, O: oAmt },
                        totalPoolAmount: eAmt + tAmt + oAmt
                      };
                    })}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      config.splitMode === 'amount' 
                        ? 'bg-white text-emerald-700 shadow-sm font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Por Valor (R$)
                  </button>
                </div>
              </div>

              {/* Status do Rateio */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">
                  {config.splitMode === 'amount' ? 'Modo: Valores Fixos por Perfil (R$)' : 'Modo: Percentuais do Montante Global (%)'}
                </span>
                <span className={`font-black px-2.5 py-0.5 rounded-full ${
                  isSplitValid 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse'
                }`}>
                  {config.splitMode === 'amount' 
                    ? `Total: ${formatCurrency(summary.totalPoolAmount)}`
                    : `Soma: ${totalSplitPercent}% ${
                        isSplitValid
                          ? (totalSplitPercent < 100 ? '(Abate Adic.) ✓' : '✓')
                          : `(Ajuste ${100 - totalSplitPercent > 0 ? `+${100 - totalSplitPercent}%` : `${100 - totalSplitPercent}%`})`
                      }`
                  }
                </span>
              </div>

              {/* Input de Montante Total R$ */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>Valor Total a ser Rateado no BPR (R$)</span>
                  {config.splitMode === 'amount' && (
                    <span className="text-[10px] text-emerald-600 font-bold">(Soma dos 3 perfis)</span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                  <input
                    type="number"
                    step="1000"
                    disabled={config.splitMode === 'amount'}
                    value={config.totalPoolAmount}
                    onChange={e => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setConfig(prev => ({
                        ...prev,
                        totalPoolAmount: val,
                        tierAmounts: {
                          E: Math.round((val * prev.tierSplits.E) / 100),
                          T: Math.round((val * prev.tierSplits.T) / 100),
                          O: Math.round((val * prev.tierSplits.O) / 100)
                        }
                      }));
                    }}
                    className={`w-full border rounded-xl pl-10 pr-4 py-3 text-lg font-black font-mono outline-none ${
                      config.splitMode === 'amount' 
                        ? 'bg-slate-50 border-slate-200 text-slate-700' 
                        : 'bg-white border-slate-300 text-emerald-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                    }`}
                  />
                </div>
              </div>

              {/* Controles das Camadas (Percentual ou Valor R$) */}
              <div className="space-y-3.5 pt-1">
                {/* Estratégico (E) */}
                <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-blue-700 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                      Estratégico (E)
                    </span>

                    {config.splitMode === 'amount' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-blue-600">R$</span>
                        <input
                          type="number"
                          step="1000"
                          min="0"
                          value={config.tierAmounts?.E ?? Math.round((config.totalPoolAmount * config.tierSplits.E) / 100)}
                          onChange={e => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setConfig(prev => {
                              const cur = prev.tierAmounts || { E: 0, T: 0, O: 0 };
                              const updated = { ...cur, E: val };
                              const newTotal = updated.E + updated.T + updated.O;
                              const newSplits = newTotal > 0 ? {
                                E: Math.round((updated.E / newTotal) * 100),
                                T: Math.round((updated.T / newTotal) * 100),
                                O: Math.round((updated.O / newTotal) * 100)
                              } : prev.tierSplits;
                              return { ...prev, tierAmounts: updated, totalPoolAmount: newTotal, tierSplits: newSplits };
                            });
                          }}
                          className="w-28 bg-white border border-blue-300 rounded-lg px-2.5 py-1 text-right font-black text-sm text-blue-800 font-mono shadow-sm"
                        />
                      </div>
                    ) : (
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
                          className="w-16 bg-white border border-blue-200 rounded-lg px-2 py-1 text-right font-black text-sm text-blue-700 font-mono"
                        />
                        <span className="text-sm font-bold text-slate-500">%</span>
                      </div>
                    )}
                  </div>

                  {config.splitMode === 'amount' ? (
                    <div className="flex justify-between items-center text-xs font-bold text-blue-600/80">
                      <span>Equivalência percentual:</span>
                      <span>{summary.layers.E.allocatedPercentage}% do montante</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.tierSplits.E}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          tierSplits: { ...prev.tierSplits, E: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="flex justify-between items-center text-[11px] font-bold text-blue-600">
                        <span>Equivalente em R$:</span>
                        <span className="font-mono">{formatCurrency(summary.layers.E.totalLayerAmount)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Tático (T) */}
                <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-indigo-700 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                      Tático (T)
                    </span>

                    {config.splitMode === 'amount' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-indigo-600">R$</span>
                        <input
                          type="number"
                          step="1000"
                          min="0"
                          value={config.tierAmounts?.T ?? Math.round((config.totalPoolAmount * config.tierSplits.T) / 100)}
                          onChange={e => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setConfig(prev => {
                              const cur = prev.tierAmounts || { E: 0, T: 0, O: 0 };
                              const updated = { ...cur, T: val };
                              const newTotal = updated.E + updated.T + updated.O;
                              const newSplits = newTotal > 0 ? {
                                E: Math.round((updated.E / newTotal) * 100),
                                T: Math.round((updated.T / newTotal) * 100),
                                O: Math.round((updated.O / newTotal) * 100)
                              } : prev.tierSplits;
                              return { ...prev, tierAmounts: updated, totalPoolAmount: newTotal, tierSplits: newSplits };
                            });
                          }}
                          className="w-28 bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-right font-black text-sm text-indigo-800 font-mono shadow-sm"
                        />
                      </div>
                    ) : (
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
                          className="w-16 bg-white border border-indigo-200 rounded-lg px-2 py-1 text-right font-black text-sm text-indigo-700 font-mono"
                        />
                        <span className="text-sm font-bold text-slate-500">%</span>
                      </div>
                    )}
                  </div>

                  {config.splitMode === 'amount' ? (
                    <div className="flex justify-between items-center text-xs font-bold text-indigo-600/80">
                      <span>Equivalência percentual:</span>
                      <span>{summary.layers.T.allocatedPercentage}% do montante</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.tierSplits.T}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          tierSplits: { ...prev.tierSplits, T: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-between items-center text-[11px] font-bold text-indigo-600">
                        <span>Equivalente em R$:</span>
                        <span className="font-mono">{formatCurrency(summary.layers.T.totalLayerAmount)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Operacional/CLTs (O) */}
                <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-emerald-700 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      Operacional / CLTs (O)
                    </span>

                    {config.splitMode === 'amount' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-emerald-600">R$</span>
                        <input
                          type="number"
                          step="1000"
                          min="0"
                          value={config.tierAmounts?.O ?? Math.round((config.totalPoolAmount * config.tierSplits.O) / 100)}
                          onChange={e => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setConfig(prev => {
                              const cur = prev.tierAmounts || { E: 0, T: 0, O: 0 };
                              const updated = { ...cur, O: val };
                              const newTotal = updated.E + updated.T + updated.O;
                              const newSplits = newTotal > 0 ? {
                                E: Math.round((updated.E / newTotal) * 100),
                                T: Math.round((updated.T / newTotal) * 100),
                                O: Math.round((updated.O / newTotal) * 100)
                              } : prev.tierSplits;
                              return { ...prev, tierAmounts: updated, totalPoolAmount: newTotal, tierSplits: newSplits };
                            });
                          }}
                          className="w-28 bg-white border border-emerald-300 rounded-lg px-2.5 py-1 text-right font-black text-sm text-emerald-800 font-mono shadow-sm"
                        />
                      </div>
                    ) : (
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
                          className="w-16 bg-white border border-emerald-200 rounded-lg px-2 py-1 text-right font-black text-sm text-emerald-700 font-mono"
                        />
                        <span className="text-sm font-bold text-slate-500">%</span>
                      </div>
                    )}
                  </div>

                  {config.splitMode === 'amount' ? (
                    <div className="flex justify-between items-center text-xs font-bold text-emerald-600/80">
                      <span>Equivalência percentual:</span>
                      <span>{summary.layers.O.allocatedPercentage}% do montante</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.tierSplits.O}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          tierSplits: { ...prev.tierSplits, O: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="flex justify-between items-center text-[11px] font-bold text-emerald-600">
                        <span>Equivalente em R$:</span>
                        <span className="font-mono">{formatCurrency(summary.layers.O.totalLayerAmount)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Bloco: Abatimento de Valores Adicionais Individuais */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-800">
                    Abatimento de Valores Adicionais
                  </span>
                  {totalAdditionalAmount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllAdditionalAmounts}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      Limpar Adicionais
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Tratamento / Abatimento dos Adicionais:
                  </label>
                  <select
                    value={config.additionalDeductionSource || 'total_pool'}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      additionalDeductionSource: e.target.value as BprAdditionalDeductionSource
                    }))}
                    className="w-full min-h-[40px] bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                  >
                    <option value="total_pool">Total Rateado (Padrão — Desconta do Bolo Geral)</option>
                    <option value="extra_bonus">Não descontar — Acréscimo de Bônus ao Total</option>
                    <option value="own_layer">Própria Camada do Colaborador</option>
                    <option value="E">Nível Estratégico (E)</option>
                    <option value="T">Nível Tático (T)</option>
                    <option value="O">Nível Operacional / CLTs (O)</option>
                  </select>
                </div>

                {totalAdditionalAmount > 0 ? (
                  config.additionalDeductionSource === 'extra_bonus' ? (
                    <div className="bg-white border border-emerald-200 rounded-lg p-2.5 space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-slate-600">
                        <span className="font-sans font-semibold">Montante Base dos Níveis:</span>
                        <span className="font-bold">{formatCurrency(summary.basePoolAmount ?? summary.netPoolForLayers ?? 0)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span className="font-sans font-semibold">(+) Acréscimo de Bônus (Sem Abatimento):</span>
                        <span className="font-bold">+ {formatCurrency(summary.extraBonusAmount ?? totalAdditionalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-900 pt-1 border-t border-slate-100 font-black">
                        <span className="font-sans">(=) Montante Total Final BPR:</span>
                        <span>{formatCurrency(summary.totalPoolAmount)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-amber-200/80 rounded-lg p-2.5 space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-slate-600">
                        <span className="font-sans font-semibold">Montante Total:</span>
                        <span className="font-bold">{formatCurrency(summary.totalPoolAmount)}</span>
                      </div>
                      <div className="flex justify-between text-amber-700">
                        <span className="font-sans font-semibold">(-) Adicionais Individuais:</span>
                        <span className="font-bold">- {formatCurrency(totalAdditionalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 pt-1 border-t border-slate-100 font-black">
                        <span className="font-sans">(=) Líquido Rateado nos Níveis:</span>
                        <span>{formatCurrency(summary.netPoolForLayers ?? summary.totalPoolAmount)}</span>
                      </div>
                    </div>
                  )
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Insira valores na coluna <strong>+ Adicional (R$)</strong> da grade abaixo. Escolha entre descontar do total/camada ou somar como <strong>Acréscimo de Bônus</strong>.
                  </p>
                )}
              </div>
            </div>

            {/* Lado Direito: Cards de Rateio por Camada & Toggles de Exceção */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Cards de Resumo por Camada */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Estratégico */}
                <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-2xl p-5 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-blue-600 tracking-wider">Estratégico ({config.tierSplits.E}%)</span>
                    <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-black">E</span>
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-900 font-mono">{formatCurrency(summary.layers.E.totalLayerAmount)}</div>
                    {((summary.layers.E.additionalDeductedFromLayer || 0) > 0 || (summary.layers.E.dedicatedGroupsDeductedFromLayer || 0) > 0) && (
                      <div className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 rounded-md px-1.5 py-0.5 mt-1 font-mono">
                        Bruto: {formatCurrency(summary.layers.E.grossLayerAmount || 0)}
                        {(summary.layers.E.dedicatedGroupsDeductedFromLayer || 0) > 0 && ` · (-) Grupos: -${formatCurrency(summary.layers.E.dedicatedGroupsDeductedFromLayer || 0)}`}
                        {(summary.layers.E.additionalDeductedFromLayer || 0) > 0 && ` · (-) Adic.: -${formatCurrency(summary.layers.E.additionalDeductedFromLayer || 0)}`}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 font-bold mt-0.5">
                      {summary.layers.E.eligibleCount} elegíveis ({summary.layers.E.ineligibleCount} fora)
                    </div>
                  </div>
                  <div className="pt-2 border-t border-blue-100 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Valor por Pessoa:</span>
                    <span className="text-lg font-black text-blue-600 font-mono block">
                      {summary.layers.E.eligibleCount > 0 ? formatCurrency(summary.layers.E.amountPerEligible) : '—'}
                    </span>
                    {(summary.layers.E.eligibleWithHistoryCount || 0) > 0 && (
                      <div
                        className="text-[10px] font-black text-sky-800 bg-sky-50 border border-sky-200 rounded-md px-1.5 py-0.5 font-mono inline-block"
                        title={`Base: ${summary.layers.E.eligibleWithHistoryCount} de ${summary.layers.E.eligibleCount} elegíveis com histórico no período (Média mensal acumulada: ${formatCurrency(summary.layers.E.monthlyAverageBase || 0)} · ${formatPctPtBr(summary.layers.E.bprVsPeriodTotalPct)} do montante do período)`}
                      >
                        {formatPctPtBr(summary.layers.E.bprVsMonthlyAvgPct)} méd. ({formatMultiplePtBr(summary.layers.E.bprMultipleOfMonthlyAvg)})
                      </div>
                    )}
                  </div>
                </div>

                {/* Tático */}
                <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-2xl p-5 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-indigo-600 tracking-wider">Tático ({config.tierSplits.T}%)</span>
                    <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-black">T</span>
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-900 font-mono">{formatCurrency(summary.layers.T.totalLayerAmount)}</div>
                    {((summary.layers.T.additionalDeductedFromLayer || 0) > 0 || (summary.layers.T.dedicatedGroupsDeductedFromLayer || 0) > 0) && (
                      <div className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 rounded-md px-1.5 py-0.5 mt-1 font-mono">
                        Bruto: {formatCurrency(summary.layers.T.grossLayerAmount || 0)}
                        {(summary.layers.T.dedicatedGroupsDeductedFromLayer || 0) > 0 && ` · (-) Grupos: -${formatCurrency(summary.layers.T.dedicatedGroupsDeductedFromLayer || 0)}`}
                        {(summary.layers.T.additionalDeductedFromLayer || 0) > 0 && ` · (-) Adic.: -${formatCurrency(summary.layers.T.additionalDeductedFromLayer || 0)}`}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 font-bold mt-0.5">
                      {summary.layers.T.eligibleCount} elegíveis ({summary.layers.T.ineligibleCount} fora)
                    </div>
                  </div>
                  <div className="pt-2 border-t border-indigo-100 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Valor por Pessoa:</span>
                    <span className="text-lg font-black text-indigo-600 font-mono block">
                      {summary.layers.T.eligibleCount > 0 ? formatCurrency(summary.layers.T.amountPerEligible) : '—'}
                    </span>
                    {(summary.layers.T.eligibleWithHistoryCount || 0) > 0 && (
                      <div
                        className="text-[10px] font-black text-sky-800 bg-sky-50 border border-sky-200 rounded-md px-1.5 py-0.5 font-mono inline-block"
                        title={`Base: ${summary.layers.T.eligibleWithHistoryCount} de ${summary.layers.T.eligibleCount} elegíveis com histórico no período (Média mensal acumulada: ${formatCurrency(summary.layers.T.monthlyAverageBase || 0)} · ${formatPctPtBr(summary.layers.T.bprVsPeriodTotalPct)} do montante do período)`}
                      >
                        {formatPctPtBr(summary.layers.T.bprVsMonthlyAvgPct)} méd. ({formatMultiplePtBr(summary.layers.T.bprMultipleOfMonthlyAvg)})
                      </div>
                    )}
                  </div>
                </div>

                {/* Operacional/CLTs */}
                <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl p-5 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-emerald-600 tracking-wider">Operacional/CLTs ({config.tierSplits.O}%)</span>
                    <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-black">O</span>
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-900 font-mono">{formatCurrency(summary.layers.O.totalLayerAmount)}</div>
                    {((summary.layers.O.additionalDeductedFromLayer || 0) > 0 || (summary.layers.O.dedicatedGroupsDeductedFromLayer || 0) > 0) && (
                      <div className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 rounded-md px-1.5 py-0.5 mt-1 font-mono">
                        Bruto: {formatCurrency(summary.layers.O.grossLayerAmount || 0)}
                        {(summary.layers.O.dedicatedGroupsDeductedFromLayer || 0) > 0 && ` · (-) Grupos: -${formatCurrency(summary.layers.O.dedicatedGroupsDeductedFromLayer || 0)}`}
                        {(summary.layers.O.additionalDeductedFromLayer || 0) > 0 && ` · (-) Adic.: -${formatCurrency(summary.layers.O.additionalDeductedFromLayer || 0)}`}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 font-bold mt-0.5">
                      {summary.layers.O.eligibleCount} elegíveis ({summary.layers.O.ineligibleCount} fora)
                    </div>
                  </div>
                  <div className="pt-2 border-t border-emerald-100 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Valor por Pessoa:</span>
                    <span className="text-lg font-black text-emerald-600 font-mono block">
                      {summary.layers.O.eligibleCount > 0 ? formatCurrency(summary.layers.O.amountPerEligible) : '—'}
                    </span>
                    {(summary.layers.O.eligibleWithHistoryCount || 0) > 0 && (
                      <div
                        className="text-[10px] font-black text-sky-800 bg-sky-50 border border-sky-200 rounded-md px-1.5 py-0.5 font-mono inline-block"
                        title={`Base: ${summary.layers.O.eligibleWithHistoryCount} de ${summary.layers.O.eligibleCount} elegíveis com histórico no período (Média mensal acumulada: ${formatCurrency(summary.layers.O.monthlyAverageBase || 0)} · ${formatPctPtBr(summary.layers.O.bprVsPeriodTotalPct)} do montante do período)`}
                      >
                        {formatPctPtBr(summary.layers.O.bprVsMonthlyAvgPct)} méd. ({formatMultiplePtBr(summary.layers.O.bprMultipleOfMonthlyAvg)})
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Simulador de Meta por Múltiplo Salarial por Camada (x) */}
              <div className="bg-white border border-sky-200 rounded-2xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsTargetMultiplePanelOpen(prev => !prev)}
                  className="w-full min-h-[48px] px-5 py-3 bg-sky-50/70 hover:bg-sky-50 flex flex-wrap items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-sky-600 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-sky-900">
                      Simulador de Meta por Múltiplo Salarial (x)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {targetMultipleSimulation.totalRequiredPool > 0 && (
                      <span className="text-xs font-black font-mono text-sky-800 bg-white border border-sky-200 px-2.5 py-0.5 rounded-full">
                        Meta: {formatCurrency(targetMultipleSimulation.totalRequiredPool)}
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-sky-700">
                      {isTargetMultiplePanelOpen ? 'Ocultar ▲' : 'Simular ▼'}
                    </span>
                  </div>
                </button>

                {isTargetMultiplePanelOpen && (
                  <div className="p-4 sm:p-5 space-y-3.5 border-t border-sky-100">
                    <p className="text-xs text-slate-600">
                      Informe o múltiplo alvo sobre a <strong>média mensal recebida</strong> em cada camada (ex.: <span className="font-mono font-bold">2,0x</span> Estratégico, <span className="font-mono font-bold">1,5x</span> Tático, <span className="font-mono font-bold">1,0x</span> Operacional) para calcular o montante necessário.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {([
                        { key: 'E' as BprCamada, title: 'Estratégico (E)', boxClass: 'bg-blue-50/60 border-blue-200', accentText: 'text-blue-700' },
                        { key: 'T' as BprCamada, title: 'Tático (T)', boxClass: 'bg-slate-50 border-slate-200', accentText: 'text-slate-800' },
                        { key: 'O' as BprCamada, title: 'Operacional (O)', boxClass: 'bg-emerald-50/60 border-emerald-200', accentText: 'text-emerald-700' },
                      ]).map(item => {
                        const proj = targetMultipleSimulation.layers[item.key];
                        return (
                          <div key={item.key} className={`rounded-xl border p-3 space-y-2 ${item.boxClass}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-xs font-black ${item.accentText}`}>{item.title}</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  aria-label={`Múltiplo alvo para ${item.title}`}
                                  value={targetMultiples[item.key]}
                                  onChange={e => {
                                    const v = Math.max(0, parseFloat(e.target.value) || 0);
                                    setTargetMultiples(prev => ({ ...prev, [item.key]: v }));
                                  }}
                                  className="w-16 min-h-[34px] bg-white border border-slate-300 rounded-lg px-2 py-1 text-right font-mono font-black text-xs text-slate-900 outline-none focus:border-sky-500"
                                />
                                <span className="text-xs font-black text-slate-500">x</span>
                              </div>
                            </div>

                            {proj.eligibleWithHistoryCount > 0 ? (
                              <div className="text-[11px] font-mono space-y-0.5 pt-1 border-t border-slate-200/70">
                                <div className="flex justify-between">
                                  <span className="font-sans text-slate-500">Montante ({proj.equivalentPercentage}%):</span>
                                  <strong className="text-slate-900">{formatCurrency(proj.requiredLayerAmount)}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span className="font-sans text-slate-500">Por pessoa:</span>
                                  <span className={`font-bold ${item.accentText}`}>{formatCurrency(proj.requiredAmountPerEligible)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-700 font-medium pt-1 border-t border-slate-200/70">
                                Sem histórico na camada
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {!targetMultipleSimulation.hasAnyHistory && (
                      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 font-medium">
                        Nenhum lançamento no custo histórico do People foi encontrado para os elegíveis no período atual ({config.periodStartDate} a {config.periodEndDate}).
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Montante Total Necessário</span>
                        <strong className="text-base font-black font-mono text-sky-800">
                          {formatCurrency(targetMultipleSimulation.totalRequiredPool)}
                        </strong>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleLoadCurrentMultiplesToSimulator}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer"
                        >
                          Puxar Múltiplos Atuais
                        </button>
                        <button
                          type="button"
                          disabled={targetMultipleSimulation.totalRequiredPool <= 0}
                          onClick={handleApplyTargetMultipleSimulation}
                          className="min-h-[40px] px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95"
                        >
                          Aplicar Meta no Simulador
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Toggles de Políticas Especiais & Exceções */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
                <span className="text-xs font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Políticas Especiais de Exceção
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Toggle Glosados */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <strong className="text-sm font-black text-slate-800 block">Glosados no Período</strong>
                      <span className="text-xs text-slate-500 block mt-0.5">
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
                          config.allowGlosados ? 'bg-amber-500' : 'bg-slate-300'
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
                          className="text-xs font-black text-amber-600 underline hover:text-amber-700 cursor-pointer"
                        >
                          Lista ({summary.glosadosCandidates.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Toggle Inativos */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <strong className="text-sm font-black text-slate-800 block">Inativos na Data de Pgto</strong>
                      <span className="text-xs text-slate-500 block mt-0.5">
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
                          config.allowInativos ? 'bg-amber-500' : 'bg-slate-300'
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
                          className="text-xs font-black text-amber-600 underline hover:text-amber-700 cursor-pointer"
                        >
                          Lista ({summary.inativosCandidates.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Toggle Grupos de Montante Específico (Permissão) */}
                  <div className={`rounded-xl p-3.5 flex items-center justify-between gap-3 border transition-colors ${
                    config.allowDedicatedGroups
                      ? 'bg-teal-50/70 border-teal-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="min-w-0">
                      <strong className="text-sm font-black text-slate-800 block">Montante Específico</strong>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        {config.allowDedicatedGroups
                          ? `${summary.dedicatedGroupsCount || 0} grupo(s) · ${summary.dedicatedMembersCount || 0} pessoa(s)`
                          : 'Desabilitado por padrão'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        aria-label="Habilitar permissão de grupos de montante específico"
                        onClick={() => {
                          const newVal = !config.allowDedicatedGroups;
                          setConfig(prev => ({
                            ...prev,
                            allowDedicatedGroups: newVal
                          }));
                          if (!newVal) {
                            setSelectedIdsForNewGroup([]);
                          }
                        }}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          config.allowDedicatedGroups ? 'bg-teal-600' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          config.allowDedicatedGroups ? 'left-6' : 'left-1'
                        }`} />
                      </button>

                      {config.allowDedicatedGroups && (
                        <button
                          type="button"
                          onClick={() => setIsDedicatedGroupsModalOpen(true)}
                          className="text-xs font-black text-teal-700 underline hover:text-teal-800 cursor-pointer"
                        >
                          Grupos ({dedicatedGroups.length})
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Faixa Resumo de Grupos de Montante Específico Ativos */}
                {config.allowDedicatedGroups && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                        <Users size={13} className="text-teal-600" />
                        Grupos de Montante Específico (Rateio Exclusivo fora das Camadas E/T/O)
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsDedicatedGroupsModalOpen(true)}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <Plus size={13} />
                        <span>Gerenciar Grupos ({dedicatedGroups.length})</span>
                      </button>
                    </div>

                    {(summary.dedicatedGroupSummaries || []).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(summary.dedicatedGroupSummaries || []).map(gs => (
                          <div
                            key={gs.groupId}
                            className="bg-teal-50/70 border border-teal-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <strong className="text-xs font-black text-teal-900 block truncate">
                                {gs.name}
                              </strong>
                              <span className="text-[11px] text-teal-700 font-semibold block truncate">
                                {gs.memberCount} eleg.{gs.ineligibleMemberCount ? ` (+${gs.ineligibleMemberCount} inel.)` : ''} · {formatDedicatedModeLabel(gs.distributionMode)} · {formatDedicatedFundingLabel(gs.fundingSource)}
                              </span>
                            </div>
                            <div className="text-right shrink-0 font-mono">
                              <strong className="text-xs font-black text-teal-900 block">
                                {formatCurrency(gs.allocatedTotal)}
                              </strong>
                              {gs.residualAmount > 0 && (
                                <span className="text-[10px] font-bold text-amber-700 block">
                                  Res.: {formatCurrency(gs.residualAmount)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">
                        Modo seleção ativo: marque os colaboradores diretamente na grade abaixo (ex.: filtre por Cargo &quot;Técnico&quot;) ou clique em <strong>Gerenciar Grupos</strong> para montar um grupo e destinar um montante específico.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. BARRA DE FILTROS & BUSCA DA GRADE */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todos ({summary.totalCandidates})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('eligible')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'eligible' ? 'bg-emerald-600 text-white' : 'text-emerald-600 hover:text-emerald-700'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  <span>Elegíveis ({summary.totalEligible})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ineligible')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'ineligible' ? 'bg-rose-600 text-white' : 'text-rose-500 hover:text-rose-700'
                  }`}
                >
                  <AlertTriangle size={14} />
                  <span>Inelegíveis / Excluídos ({summary.totalIneligible})</span>
                </button>
              </div>

              {/* Filtro por Camada */}
              <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-400 uppercase px-2">Camada:</span>
                <button
                  type="button"
                  onClick={() => setCamadaFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    camadaFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setCamadaFilter('E')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    camadaFilter === 'E' ? 'bg-blue-600 text-white' : 'text-blue-600 hover:text-blue-700'
                  }`}
                >
                  Estratégico
                </button>
                <button
                  type="button"
                  onClick={() => setCamadaFilter('T')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    camadaFilter === 'T' ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:text-indigo-700'
                  }`}
                >
                  Tático
                </button>
                <button
                  type="button"
                  onClick={() => setCamadaFilter('O')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    camadaFilter === 'O' ? 'bg-emerald-600 text-white' : 'text-emerald-600 hover:text-emerald-700'
                  }`}
                >
                  Operacional/CLTs
                </button>
                {(summary.dedicatedMembersCount || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setCamadaFilter('dedicated')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      camadaFilter === 'dedicated' ? 'bg-teal-600 text-white' : 'text-teal-700 hover:text-teal-800'
                    }`}
                  >
                    Grupos ({summary.dedicatedMembersCount})
                  </button>
                )}
              </div>

              {/* Contador / Restauração de Excluídos */}
              {(config.manuallyExcludedEmployeeIds || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, manuallyExcludedEmployeeIds: [] }))}
                  className="text-sm font-black text-amber-700 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl hover:bg-amber-100 transition-all cursor-pointer flex items-center gap-1.5"
                  title="Clique para restaurar todos os contratados excluídos manualmente"
                >
                  <span>Restaurar {config.manuallyExcludedEmployeeIds.length} excluído(s)</span>
                </button>
              )}
            </div>

            {/* Segunda Linha de Filtros: Cargo, Departamento, Nome, Busca Textual e Ação Rápida p/ Grupo */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro por Cargo */}
              <div className="min-w-[160px] flex-1 sm:flex-initial sm:w-48">
                <select
                  aria-label="Filtrar por cargo do colaborador"
                  value={jobRoleFilter}
                  onChange={e => setJobRoleFilter(e.target.value)}
                  className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 shadow-sm cursor-pointer"
                >
                  <option value="">Todos os Cargos ({availableJobRoles.length})</option>
                  {availableJobRoles.map(role => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Departamento */}
              <div className="min-w-[160px] flex-1 sm:flex-initial sm:w-44">
                <select
                  aria-label="Filtrar por departamento"
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 shadow-sm cursor-pointer"
                >
                  <option value="">Todos os Deptos ({availableDepartments.length})</option>
                  {availableDepartments.map(dep => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown Alfabético: Filtrar por Nome */}
              <div className="flex items-center gap-1 min-w-[190px] flex-1 sm:flex-initial sm:w-56">
                <select
                  aria-label="Filtrar por nome do colaborador"
                  value={selectedEmployeeIdFilter}
                  onChange={e => setSelectedEmployeeIdFilter(e.target.value)}
                  className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 shadow-sm cursor-pointer"
                >
                  <option value="">Filtrar por Nome ({availableCandidateNames.length})</option>
                  {availableCandidateNames.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {selectedEmployeeIdFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeIdFilter('')}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer shrink-0"
                    title="Limpar filtro por nome selecionado"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Busca Textual por Nome / Razão Social / Responsável / Cargo */}
              <div className="relative flex-1 min-w-[210px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, razão social, responsável ou cargo..."
                  className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 shadow-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                    title="Limpar busca"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Atalho para habilitar Seleção Direta na Grade */}
              {!config.allowDedicatedGroups ? (
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, allowDedicatedGroups: true }))}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-black shadow-sm transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                  title="Ativar caixas de seleção na grade para destinar montante específico a um grupo de colaboradores"
                >
                  <Users size={15} />
                  <span>Selecionar p/ Grupo</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleSelectAllVisibleForNewGroup}
                  disabled={selectableDisplayedIds.length === 0}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 disabled:opacity-40 text-teal-800 border border-teal-300 text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="Marcar ou desmarcar todos os colaboradores filtrados visíveis para criar um grupo"
                >
                  <Check size={14} />
                  <span>
                    {selectableDisplayedIds.length > 0 && selectableDisplayedIds.every(id => selectedIdsForNewGroup.includes(id))
                      ? `Desmarcar visíveis (${selectableDisplayedIds.length})`
                      : `Marcar visíveis (${selectableDisplayedIds.length})`}
                  </span>
                </button>
              )}
            </div>

            {/* Barra Contextual de Seleção Direta na Grade */}
            {config.allowDedicatedGroups && selectedCandidatesSummary.count > 0 && (
              <div className="bg-teal-50 border-2 border-teal-300 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <Users size={18} />
                  </div>
                  <div className="min-w-0">
                    <strong className="text-sm font-black text-teal-950 block">
                      {selectedCandidatesSummary.count} colaborador(es) selecionado(s) na grade
                    </strong>
                    <span className="text-xs font-semibold text-teal-800 block">
                      {selectedCandidatesSummary.eligibleInSelection} elegível(is) no ciclo · Origem sugerida: Camada {selectedCandidatesSummary.predominantCamada}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedIdsForNewGroup([])}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Limpar Seleção
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateDedicatedGroupFromSelection}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-black uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                  >
                    <Plus size={16} />
                    <span>Destinar Montante &amp; Criar Grupo</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. GRADE ANALÍTICA DE CONTRATADOS */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black uppercase tracking-wider text-slate-500">
                  {config.allowDedicatedGroups && (
                    <th className="py-3.5 px-3 text-center w-12">
                      <input
                        type="checkbox"
                        aria-label="Selecionar todos visíveis para grupo de montante específico"
                        disabled={selectableDisplayedIds.length === 0}
                        checked={
                          selectableDisplayedIds.length > 0 &&
                          selectableDisplayedIds.every(id => selectedIdsForNewGroup.includes(id))
                        }
                        onChange={handleToggleSelectAllVisibleForNewGroup}
                        className="w-4 h-4 rounded text-teal-600 border-slate-300 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3.5 px-5">Contratado</th>
                  <th className="py-3.5 px-4">Empresa / Regime</th>
                  <th className="py-3.5 px-4">Camada</th>
                  <th className="py-3.5 px-4">Início Contrato ➔ Desligamento</th>
                  <th className="py-3.5 px-4 text-center">Entregáveis / Desempenho</th>
                  <th className="py-3.5 px-4 text-center">Status Elegibilidade</th>
                  <th className="py-3.5 px-4 text-right">Rateio Nível (R$)</th>
                  <th className="py-3.5 px-4 text-right">+ Adicional (R$)</th>
                  <th className="py-3.5 px-5 text-right">Valor Total BPR (R$)</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Histórico Período</th>
                  <th className="py-3.5 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={config.allowDedicatedGroups ? 12 : 11} className="py-16 text-center text-slate-400 font-bold text-base">
                      Nenhum contratado encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  displayedCandidates.map(c => {
                    const isPJ = c.linkType === 'PJ' || c.linkType === 'MEI' || Boolean(c.corporateName);
                    const displayName = isPJ ? (c.corporateName || c.name) : c.name;
                    const respName = isPJ ? (c.responsibleName || c.name) : undefined;
                    const isExcluded = (config.manuallyExcludedEmployeeIds || []).includes(c.employeeId);
                    const isCheckedForGroup = selectedIdsForNewGroup.includes(c.employeeId);
                    const isSelectDisabled = isExcluded || Boolean(c.dedicatedGroupId);
                    const camadaBadgeColor = c.camada === 'E' 
                      ? 'bg-blue-50 text-blue-700 border-blue-200' 
                      : c.camada === 'T' 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                    return (
                      <tr key={c.employeeId} className={`transition-colors ${
                        isExcluded ? 'bg-rose-50/60 opacity-70' : isCheckedForGroup ? 'bg-teal-50/60' : 'hover:bg-slate-50'
                      }`}>
                        {config.allowDedicatedGroups && (
                          <td className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ${displayName} para grupo de montante específico`}
                              disabled={isSelectDisabled}
                              checked={isCheckedForGroup}
                              onChange={() => handleToggleSelectForNewGroup(c.employeeId)}
                              title={
                                c.dedicatedGroupId
                                  ? `Já alocado em: ${c.dedicatedGroupName}`
                                  : isExcluded
                                    ? 'Colaborador excluído manualmente'
                                    : 'Selecionar para criar grupo de montante específico'
                              }
                              className="w-4 h-4 rounded text-teal-600 border-slate-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </td>
                        )}
                        {/* Colaborador */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 overflow-hidden shrink-0 flex items-center justify-center text-sm font-black text-slate-600">
                              {c.photoUrl ? (
                                <img src={c.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                c.name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <strong className="text-slate-900 block truncate max-w-[220px] text-sm">{displayName}</strong>
                              {respName && respName !== displayName && (
                                <span className="text-xs text-amber-600 font-bold block">Resp: {respName}</span>
                              )}
                              <span className="text-xs text-slate-400 block">{c.jobRole} · {c.department}</span>
                            </div>
                          </div>
                        </td>

                        {/* Empresa / Vínculo */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-700 block text-sm">{c.company}</span>
                          <span className="text-xs text-slate-400">{c.linkType} {c.isOutsourced ? '(Terc.)' : ''}</span>
                        </td>

                        {/* Camada / Grupo Dedicado */}
                        <td className="py-3.5 px-4">
                          {c.dedicatedGroupId ? (
                            <div className="space-y-1">
                              <span
                                className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg border bg-teal-50 text-teal-800 border-teal-300"
                                title={`Montante Específico Exclusivo — ${c.dedicatedGroupName} (${formatPctPtBr(c.dedicatedGroupSharePct)} do grupo). Não participa do rateio padrão da camada ${c.camada}.`}
                              >
                                <Users size={12} className="text-teal-600 shrink-0" />
                                <span className="truncate max-w-[150px]">{c.dedicatedGroupName}</span>
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 block">
                                {c.isEligible
                                  ? `Origem: ${c.camada} · ${formatPctPtBr(c.dedicatedGroupSharePct)} do grupo`
                                  : `Origem: ${c.camada} · Inelegível na regra BPR`}
                              </span>
                            </div>
                          ) : (
                            <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-lg border ${camadaBadgeColor}`}>
                              {c.camada} — {c.camadaLabel}
                            </span>
                          )}
                        </td>

                        {/* Datas */}
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                          <span>{c.startDate ? c.startDate.slice(0, 10) : '—'}</span>
                          <span className="text-slate-300 mx-1">➔</span>
                          <span className={c.realResignationDate ? 'text-rose-500 font-bold' : 'text-emerald-600'}>
                            {c.realResignationDate ? c.realResignationDate.slice(0, 10) : 'Ativo'}
                          </span>
                        </td>

                        {/* Metas / Desempenho */}
                        <td className="py-3.5 px-4 text-center">
                          {c.monthlyAverageScore !== undefined ? (
                            <div className="space-y-0.5">
                              <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-full border ${
                                c.performanceFactor === 1.0 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : c.performanceFactor === 0.75
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-600 border-rose-200'
                              }`}>
                                {c.monthlyAverageScore}% ({c.performanceFactor * 100}%)
                              </span>
                              <span className="text-[11px] text-slate-400 block font-mono">
                                {c.performanceFactor === 1.0 ? '100% bônus' : c.performanceFactor === 0.75 ? '75% bônus' : 'Meta < 90%'}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-block text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                              100% (Padrão)
                            </span>
                          )}
                        </td>

                        {/* Status Elegibilidade */}
                        <td className="py-3.5 px-4 text-center">
                          {isExcluded ? (
                            <span className="inline-flex items-center gap-1 text-xs font-black text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                              🚫 Excluído Manualmente
                            </span>
                          ) : c.isEligible ? (
                            <div className="space-y-0.5">
                              <span className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full border ${
                                c.dedicatedGroupId
                                  ? 'text-teal-800 bg-teal-50 border-teal-200'
                                  : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              }`}>
                                <CheckCircle2 size={13} /> {c.dedicatedGroupId ? 'Grupo Exclusivo' : 'Elegível'} {c.isExceptionApplied ? '(Exceção)' : ''}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-xs font-black text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                                <X size={13} /> Inelegível
                              </span>
                              <span className="text-[11px] text-slate-400 block truncate max-w-[180px]" title={c.ineligibilityReasons.join(', ')}>
                                {c.ineligibilityReasons[0] || 'Critérios não atendidos'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Rateio Nível / Grupo (R$) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="space-y-0.5">
                            <span className={`text-sm font-bold font-mono block ${
                              c.isEligible ? (c.dedicatedGroupId ? 'text-teal-800' : 'text-slate-700') : 'text-slate-300'
                            }`}>
                              {c.isEligible ? formatCurrency(c.rateioAmount ?? c.allocatedAmount) : 'R$ 0,00'}
                            </span>
                            {c.isEligible && c.dedicatedGroupId ? (
                              <div className="space-y-0.5">
                                <span className="text-[11px] text-teal-700 block font-mono">
                                  Montante Específico ({formatPctPtBr(c.dedicatedGroupSharePct)})
                                </span>
                                {(c.dedicatedGroupEffectiveFactorPct ?? 100) < 100 && (
                                  <span className="text-[10px] text-amber-700 block font-mono font-bold">
                                    Fator {c.dedicatedGroupEffectiveFactorPct}% · Base {formatCurrency(c.baseAmount)}
                                  </span>
                                )}
                                {(c.dedicatedGroupRedistributedBonus || 0) > 0 && (
                                  <span className="text-[10px] text-emerald-700 block font-mono font-bold">
                                    + {formatCurrency(c.dedicatedGroupRedistributedBonus || 0)} redist. fator
                                  </span>
                                )}
                              </div>
                            ) : c.isEligible && c.performanceFactor < 1.0 ? (
                              <span className="text-[11px] text-amber-600 block font-mono">
                                Base: {formatCurrency(c.baseAmount)} (75%)
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* + Adicional (R$) + Motivo/Observação */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="inline-flex items-center justify-end gap-1">
                              <div className="relative">
                                <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold ${
                                  !c.isEligible
                                    ? 'text-slate-300'
                                    : (config.additionalAmounts?.[c.employeeId] || 0) > 0
                                      ? 'text-amber-700'
                                      : 'text-slate-400'
                                }`}>
                                  R$
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  disabled={!c.isEligible}
                                  aria-label={`Valor adicional BPR para ${displayName}`}
                                  placeholder="0,00"
                                  value={c.isEligible && (config.additionalAmounts?.[c.employeeId] || 0) > 0 ? config.additionalAmounts?.[c.employeeId] : ''}
                                  onChange={e => handleAdditionalAmountChange(c.employeeId, e.target.value)}
                                  className={`w-28 min-h-[38px] pl-7 pr-2 py-1 text-right text-xs font-black font-mono rounded-lg border outline-none transition-all ${
                                    !c.isEligible
                                      ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                      : (config.additionalAmounts?.[c.employeeId] || 0) > 0
                                        ? 'bg-amber-50 border-amber-300 text-amber-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15'
                                        : 'bg-white border-slate-200 text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15'
                                  }`}
                                />
                              </div>
                              {c.isEligible && (config.additionalAmounts?.[c.employeeId] || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleAdditionalAmountChange(c.employeeId, '0')}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Zerar adicional e observação deste colaborador"
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </div>

                            {c.isEligible && (config.additionalAmounts?.[c.employeeId] || 0) > 0 && (
                              <input
                                type="text"
                                maxLength={120}
                                aria-label={`Motivo do valor adicional para ${displayName}`}
                                placeholder="Motivo (ex: Entrega Projeto X)"
                                value={config.additionalReasons?.[c.employeeId] || ''}
                                onChange={e => handleAdditionalReasonChange(c.employeeId, e.target.value)}
                                title={config.additionalReasons?.[c.employeeId] || 'Informe uma observação ou justificativa curta para auditoria'}
                                className="w-40 min-h-[30px] px-2 py-1 text-[11px] font-medium bg-white border border-amber-200 rounded-md text-slate-700 placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15"
                              />
                            )}
                          </div>
                        </td>

                        {/* Valor Total BPR */}
                        <td className="py-3.5 px-5 text-right">
                          <div className="space-y-0.5">
                            <span className={`text-base font-black font-mono block ${
                              c.isEligible ? 'text-emerald-600' : 'text-slate-300'
                            }`}>
                              {c.isEligible ? formatCurrency(c.allocatedAmount) : 'R$ 0,00'}
                            </span>
                            {c.isEligible && (c.additionalAmount || 0) > 0 && (
                              <div className="flex flex-col items-end gap-0.5">
                                <span
                                  title={c.additionalReason ? `Justificativa: ${c.additionalReason}` : 'Valor adicional individual'}
                                  className="inline-block text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-mono cursor-help"
                                >
                                  + {formatCurrency(c.additionalAmount || 0)} Adic.
                                </span>
                                {c.additionalReason && (
                                  <span
                                    title={c.additionalReason}
                                    className="text-[10px] text-amber-700/80 font-medium truncate max-w-[145px] block"
                                  >
                                    {c.additionalReason}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Histórico Financeiro no Período de Apuração (3 linhas: Montante, Média e % BPR) */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {(c.periodMonthsCount || 0) > 0 && (c.periodReceivedTotal || 0) > 0 ? (
                            <div
                              className="space-y-0.5 font-mono"
                              title={`Histórico People (${c.periodMonthsCount} comp. no período ${config.periodStartDate} a ${config.periodEndDate}): Montante ${formatCurrency(c.periodReceivedTotal || 0)} | Média ${formatCurrency(c.periodReceivedAverage || 0)} | BPR equivale a ${formatPctPtBr(c.bprVsAveragePct)} da média e ${formatPctPtBr(c.bprVsTotalPct)} do montante`}
                            >
                              <div className="text-xs font-black text-slate-800">
                                <span className="font-sans font-bold text-[10px] text-slate-400 mr-1">Mont.:</span>
                                {formatCurrency(c.periodReceivedTotal || 0)}
                              </div>
                              <div className="text-[11px] font-bold text-slate-600">
                                <span className="font-sans font-semibold text-[10px] text-slate-400 mr-1">
                                  Média ({c.periodMonthsCount}m):
                                </span>
                                {formatCurrency(c.periodReceivedAverage || 0)}
                              </div>
                              <div className={`text-[10px] font-black px-1.5 py-0.5 rounded inline-block border ${
                                c.isEligible
                                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}>
                                BPR: {formatPctPtBr(c.bprVsAveragePct)} méd. · {formatPctPtBr(c.bprVsTotalPct)} mont.
                              </div>
                            </div>
                          ) : (
                            <span
                              className="text-[11px] font-medium text-slate-400 italic"
                              title={`Nenhum lançamento encontrado no custo histórico do People entre ${config.periodStartDate} e ${config.periodEndDate}`}
                            >
                              Sem histórico no período
                            </span>
                          )}
                        </td>

                        {/* Ação de Exclusão / Restauração Manual */}
                        <td className="py-3.5 px-4 text-center">
                          {isExcluded ? (
                            <button
                              type="button"
                              onClick={() => {
                                setConfig(prev => ({
                                  ...prev,
                                  manuallyExcludedEmployeeIds: (prev.manuallyExcludedEmployeeIds || []).filter(id => id !== c.employeeId)
                                }));
                              }}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              title="Restaurar este contratado à relação do BPR"
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
                              className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              title="Excluir este contratado da relação e rateio do BPR"
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
        <footer className="px-6 sm:px-10 py-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-[0_-1px_0_0_rgba(0,0,0,0.05)]">
          <div className="flex flex-wrap items-center gap-4 sm:gap-8">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase block tracking-wider">Total Elegíveis:</span>
              <strong className="text-base font-black text-emerald-600">
                {summary.totalEligible} contratados
              </strong>
            </div>

            {(summary.dedicatedGroupsAllocatedTotal || 0) > 0 && (
              <div>
                <span className="text-xs font-bold text-teal-600 uppercase block tracking-wider">Grupos Específicos:</span>
                <strong className="text-base font-black text-teal-700 font-mono">
                  {formatCurrency(summary.dedicatedGroupsAllocatedTotal || 0)}
                </strong>
                <span className="text-[11px] font-bold text-teal-600/80 ml-1">
                  ({summary.dedicatedMembersCount || 0}p)
                </span>
              </div>
            )}

            {totalAdditionalAmount > 0 && (
              <>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block tracking-wider">Rateio Níveis:</span>
                  <strong className="text-base font-black text-slate-700 font-mono">
                    {formatCurrency(summary.netPoolForLayers || 0)}
                  </strong>
                </div>

                <div>
                  <span className={`text-xs font-bold uppercase block tracking-wider ${
                    config.additionalDeductionSource === 'extra_bonus' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {config.additionalDeductionSource === 'extra_bonus' ? '+ Acréscimo Bônus:' : '+ Adicionais:'}
                  </span>
                  <strong className={`text-base font-black font-mono ${
                    config.additionalDeductionSource === 'extra_bonus' ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {formatCurrency(totalAdditionalAmount)}
                  </strong>
                </div>
              </>
            )}

            <div>
              <span className="text-xs font-bold text-slate-400 uppercase block tracking-wider">Total Rateado:</span>
              <strong className="text-base font-black text-slate-900 font-mono">
                {formatCurrency(summary.totalDistributedAmount)}
              </strong>
            </div>

            {summary.residualAmount > 0 && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase block tracking-wider">Resíduo (Sem Membros/Ajustes):</span>
                <strong className="text-base font-black text-amber-600 font-mono">
                  {formatCurrency(summary.residualAmount)}
                </strong>
              </div>
            )}

            {(summary.overallRelativeWeight?.eligibleWithHistoryCount || 0) > 0 && (
              <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-5">
                <span className="text-[10px] font-black text-sky-700 uppercase block tracking-wider mb-1">
                  Peso BPR (% Média Mensal por Camada):
                </span>
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                  <span
                    className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-black"
                    title={`Estratégico (E): ${summary.layers.E.eligibleWithHistoryCount || 0} de ${summary.layers.E.eligibleCount} elegíveis com histórico`}
                  >
                    E: {(summary.layers.E.eligibleWithHistoryCount || 0) > 0 ? `${formatPctPtBr(summary.layers.E.bprVsMonthlyAvgPct)} (${formatMultiplePtBr(summary.layers.E.bprMultipleOfMonthlyAvg)})` : '—'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-300 font-black"
                    title={`Tático (T): ${summary.layers.T.eligibleWithHistoryCount || 0} de ${summary.layers.T.eligibleCount} elegíveis com histórico`}
                  >
                    T: {(summary.layers.T.eligibleWithHistoryCount || 0) > 0 ? `${formatPctPtBr(summary.layers.T.bprVsMonthlyAvgPct)} (${formatMultiplePtBr(summary.layers.T.bprMultipleOfMonthlyAvg)})` : '—'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-black"
                    title={`Operacional/CLTs (O): ${summary.layers.O.eligibleWithHistoryCount || 0} de ${summary.layers.O.eligibleCount} elegíveis com histórico`}
                  >
                    O: {(summary.layers.O.eligibleWithHistoryCount || 0) > 0 ? `${formatPctPtBr(summary.layers.O.bprVsMonthlyAvgPct)} (${formatMultiplePtBr(summary.layers.O.bprMultipleOfMonthlyAvg)})` : '—'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-black"
                    title={`Geral: ${summary.overallRelativeWeight?.eligibleWithHistoryCount || 0} de ${summary.totalEligible} elegíveis com histórico (${formatPctPtBr(summary.overallRelativeWeight?.bprVsPeriodTotalPct)} do montante do período)`}
                  >
                    Geral: {formatPctPtBr(summary.overallRelativeWeight?.bprVsMonthlyAvgPct)} ({formatMultiplePtBr(summary.overallRelativeWeight?.bprMultipleOfMonthlyAvg)})
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenExportOptionsModal()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black transition-all cursor-pointer flex items-center gap-2 text-sm shadow-sm active:scale-95"
                title="Personalizar quais colaboradores, níveis e empresas constarão no PDF"
              >
                <Download size={16} />
                <span>Exportar PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenExportOptionsModal()}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 text-sm"
                title="Personalizar e abrir relatório formatado para impressão física ou salvar como PDF"
              >
                <Printer size={16} />
                <span className="hidden sm:inline">Imprimir</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-black rounded-xl uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-md shadow-amber-500/20 text-sm"
            >
              Concluir &amp; Fechar
            </button>
          </div>
        </footer>

      </div>

      {/* ── MODAL DE EXCEÇÃO DE GLOSADOS ── */}
      {isGlosadosModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">Contratados com Glosa no Período</h3>
                <p className="text-sm text-slate-500">Selecione quem fará jus excepcionalmente ao BPR</p>
              </div>
              <button onClick={() => setIsGlosadosModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-100">
              {summary.glosadosCandidates.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">Nenhum contratado com glosa registrado no período.</div>
              ) : (
                summary.glosadosCandidates.map(g => {
                  const isChecked = config.selectedGlosadosExceptions.includes(g.employeeId);
                  return (
                    <label key={g.employeeId} className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer">
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
                          className="w-4 h-4 rounded text-amber-500 border-slate-300"
                        />
                        <div>
                          <strong className="text-sm text-slate-900 block">{g.corporateName || g.name}</strong>
                          <span className="text-xs text-amber-600 block">{g.glosaDetails || 'Glosa registrada'}</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-400">{g.company} · {g.linkType}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  selectedGlosadosExceptions: summary.glosadosCandidates.map(g => g.employeeId)
                }))}
                className="text-sm text-amber-600 font-bold hover:underline"
              >
                Marcar Todos
              </button>
              <button
                type="button"
                onClick={() => setIsGlosadosModalOpen(false)}
                className="px-5 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm uppercase"
              >
                Concluir Seleção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE EXCEÇÃO DE INATIVOS NA DATA DE PGTO ── */}
      {isInativosModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">Inativos entre o Fim do Ciclo e a Data de Pagamento</h3>
                <p className="text-sm text-slate-500">
                  Exibe apenas contratados que cumpriram 100% do período ({config.periodStartDate} a {config.periodEndDate}) e saíram antes do pagamento ({config.paymentDate})
                </p>
              </div>
              <button onClick={() => setIsInativosModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-100">
              {summary.inativosCandidates.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  Nenhum contratado cumpriu o ciclo integral e teve desligamento no intervalo pós-ciclo até a data de pagamento.
                </div>
              ) : (
                summary.inativosCandidates.map(i => {
                  const isChecked = config.selectedInativosExceptions.includes(i.employeeId);
                  return (
                    <label key={i.employeeId} className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer">
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
                          className="w-4 h-4 rounded text-amber-500 border-slate-300"
                        />
                        <div>
                          <strong className="text-sm text-slate-900 block">{i.corporateName || i.name}</strong>
                          <span className="text-xs text-rose-500 block">
                            Desligado em: {i.realResignationDate ? i.realResignationDate.slice(0, 10) : 'Desligamento pós-ciclo'}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-400">{i.company} · {i.camadaLabel}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  selectedInativosExceptions: summary.inativosCandidates.map(i => i.employeeId)
                }))}
                className="text-sm text-amber-600 font-bold hover:underline"
              >
                Marcar Todos
              </button>
              <button
                type="button"
                onClick={() => setIsInativosModalOpen(false)}
                className="px-5 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm uppercase"
              >
                Concluir Seleção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE IMPORTAÇÃO DE REGRAS VIA DOCUMENTO ── */}
      {isDocImportModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileUp size={18} className="text-amber-500" />
                <h3 className="text-base font-black text-slate-900 uppercase">Importar Regras de Regulamento</h3>
              </div>
              <button onClick={() => setIsDocImportModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
            </div>

            <p className="text-sm text-slate-500">
              Cole o texto da ata, comunicado ou regulamento do BPR. O sistema extrairá automaticamente o montante total, o ciclo e os percentuais por Camada e apresentará um comparativo antes de aplicar.
            </p>

            <textarea
              rows={6}
              value={docImportText}
              onChange={e => setDocImportText(e.target.value)}
              placeholder="Exemplo: Fica aprovada a distribuição do BPR referente ao 2º semestre no montante total de R$ 150.000,00, sendo 35% para o Estratégico, 40% para o Tático e 25% para o Operacional/CLTs..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 font-sans"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsDocImportModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePreviewImportedText}
                className="px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-black uppercase flex items-center gap-1.5 cursor-pointer hover:bg-amber-400 transition-all"
              >
                <Sparkles size={15} />
                <span>Interpretar &amp; Revisar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL COMPARATIVO / DIFF DE REGRAS IMPORTADAS ── */}
      {isConfirmPatchOpen && importedPatch && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md animate-in fade-in">
          <div className="bg-white border border-amber-200 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-black">
                  <Sparkles size={17} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">Revisão de Alterações Detectadas</h3>
                  <p className="text-sm text-slate-500">Confirme os parâmetros extraídos do regulamento antes de aplicá-los ao sistema</p>
                </div>
              </div>
              <button onClick={() => setIsConfirmPatchOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
            </div>

            {/* Tabela de Diff Comparativo Lado a Lado */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden text-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black uppercase text-slate-500">
                    <th className="py-3 px-4">Parâmetro</th>
                    <th className="py-3 px-4 text-slate-500">Configuração Atual</th>
                    <th className="py-3 px-4 text-amber-600">Novo Valor Detectado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Montante Total */}
                  <tr>
                    <td className="py-3 px-4 font-bold text-slate-700">Montante Total (R$)</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{formatCurrency(config.totalPoolAmount)}</td>
                    <td className="py-3 px-4 font-mono font-black text-emerald-600">
                      {importedPatch.totalPoolAmount !== undefined ? formatCurrency(importedPatch.totalPoolAmount) : 'Sem alteração'}
                    </td>
                  </tr>

                  {/* Ciclo */}
                  <tr>
                    <td className="py-3 px-4 font-bold text-slate-700">Ciclo Semestral</td>
                    <td className="py-3 px-4 text-slate-500">{config.cycle === 'ciclo_1' ? 'Ciclo 1 (Pago até Março)' : config.cycle === 'ciclo_2' ? 'Ciclo 2 (Pago até Setembro)' : 'Customizado'}</td>
                    <td className="py-3 px-4 font-bold text-amber-700">
                      {importedPatch.cycle ? (importedPatch.cycle === 'ciclo_1' ? 'Ciclo 1 (Pago até Março)' : importedPatch.cycle === 'ciclo_2' ? 'Ciclo 2 (Pago até Setembro)' : 'Customizado') : 'Sem alteração'}
                    </td>
                  </tr>

                  {/* Período Eletivo */}
                  <tr>
                    <td className="py-3 px-4 font-bold text-slate-700">Período Eletivo</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{config.periodStartDate} a {config.periodEndDate}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {importedPatch.periodStartDate ? `${importedPatch.periodStartDate} a ${importedPatch.periodEndDate}` : 'Sem alteração'}
                    </td>
                  </tr>

                  {/* Splits das Camadas */}
                  <tr>
                    <td className="py-3 px-4 font-bold text-slate-700">Alíquotas por Camada</td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      E: {config.tierSplits.E}% | T: {config.tierSplits.T}% | O (Operacional/CLTs): {config.tierSplits.O}%
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-700">
                      {importedPatch.tierSplits ? `E: ${importedPatch.tierSplits.E}% | T: ${importedPatch.tierSplits.T}% | O (Operacional/CLTs): ${importedPatch.tierSplits.O}%` : 'Sem alteração'}
                    </td>
                  </tr>

                  {/* Glosas */}
                  <tr>
                    <td className="py-3 px-4 font-bold text-slate-700">Exceção de Glosados</td>
                    <td className="py-3 px-4 text-slate-500">{config.allowGlosados ? 'Permitir seleção' : 'Desclassificado por padrão'}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {importedPatch.allowGlosados !== undefined ? (importedPatch.allowGlosados ? 'Permitir seleção' : 'Desclassificado por padrão') : 'Sem alteração'}
                    </td>
                  </tr>

                  {/* Inativos */}
                  <tr>
                    <td className="py-3 px-4 font-bold text-slate-700">Exceção de Inativos pós-ciclo</td>
                    <td className="py-3 px-4 text-slate-500">{config.allowInativos ? 'Permitir seleção' : 'Desclassificado por padrão'}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {importedPatch.allowInativos !== undefined ? (importedPatch.allowInativos ? 'Permitir seleção' : 'Desclassificado por padrão') : 'Sem alteração'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmPatchOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                ❌ Descartar Alterações
              </button>

              <button
                type="button"
                onClick={handleConfirmApplyPatch}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-700/20 transition-all cursor-pointer active:scale-95"
              >
                <CheckCircle2 size={16} />
                <span>✅ Confirmar &amp; Aplicar Novas Regras</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SALVAR CENÁRIO DE APURAÇÃO ── */}
      {isSaveScenarioModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Save size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Salvar Cenário de BPR</h3>
                  <p className="text-xs text-slate-500">Grave os critérios, parâmetros e o snapshot desta apuração para consulta e impressão futura</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsSaveScenarioModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Nome do Cenário */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Nome do Cenário / Estudo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={scenarioNameInput}
                  onChange={e => setScenarioNameInput(e.target.value)}
                  placeholder="Ex: Cenário Base C1 2026 - Versão Diretoria"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>

              {/* Data do Estudo */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Data de Realização do Estudo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={studyDateInput}
                  onChange={e => setStudyDateInput(e.target.value)}
                  className="w-full sm:w-60 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>

              {/* Critérios e Premissas Adotadas */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Critérios &amp; Premissas Adotadas
                  </label>
                  <button
                    type="button"
                    onClick={() => setCriteriaDescriptionInput(generateCurrentCriteriaSummary())}
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Auto-preencher dos filtros ativos
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={criteriaDescriptionInput}
                  onChange={e => setCriteriaDescriptionInput(e.target.value)}
                  placeholder="Descreva as premissas, justificativas e critérios de corte aplicados neste estudo..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 resize-none"
                />
              </div>

              {/* Resumo do Snapshot que será Congelado */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider block">Valores que serão congelados neste snapshot:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Montante Total</span>
                    <strong className="text-emerald-700 font-bold text-sm">{formatCurrency(summary.totalPoolAmount)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Total Rateado</span>
                    <strong className="text-slate-800 font-bold text-sm">{formatCurrency(summary.totalDistributedAmount)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Elegíveis</span>
                    <strong className="text-slate-800 font-bold text-sm">{summary.totalEligible} de {summary.totalCandidates}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Resíduo</span>
                    <strong className="text-amber-700 font-bold text-sm">{formatCurrency(summary.residualAmount)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSaveScenarioModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveScenario}
                disabled={!scenarioNameInput.trim()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
              >
                <Save size={16} />
                <span>Salvar Estudo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CENTRAL DE CENÁRIOS SALVOS & BUSCA ── */}
      {isSavedScenariosModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-950/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Cabeçalho */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                  <FolderArchive size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                      Central de Cenários e Estudos de BPR
                    </h3>
                    <span className="bg-amber-100 text-amber-800 text-[11px] font-black px-2 py-0.5 rounded-full">
                      {savedScenarios.length} {savedScenarios.length === 1 ? 'cenário salvo' : 'cenários salvos'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Pesquise, imprima ou compare relatórios históricos de apuração a qualquer momento
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsSavedScenariosModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold p-1 leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Barra de Pesquisa e Ferramentas de Comparação */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-white space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={scenarioSearchQuery}
                    onChange={e => setScenarioSearchQuery(e.target.value)}
                    placeholder="Pesquisar estudos por nome, data, critérios, ciclo ou ano..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                  />
                  {scenarioSearchQuery && (
                    <button 
                      type="button"
                      onClick={() => setScenarioSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Botão de Ação do Comparador quando há seleção */}
                {selectedScenarioIdsForCompare.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCompareModalOpen(true)}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
                    >
                      <Scale size={16} />
                      <span>Comparar ({selectedScenarioIdsForCompare.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedScenarioIdsForCompare([])}
                      className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Desmarcar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Lista Scrollável de Cenários */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50">
              {filteredSavedScenarios.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-dashed border-slate-200 p-6">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
                    <FolderArchive size={28} />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    {savedScenarios.length === 0 ? 'Nenhum cenário salvo ainda' : 'Nenhum estudo corresponde à busca'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {savedScenarios.length === 0 
                      ? 'Configure os parâmetros do rateio no cockpit e clique em "Salvar Cenário" para gravar versões históricas com critérios e data do estudo.'
                      : 'Tente utilizar outros termos na barra de pesquisa acima.'}
                  </p>
                </div>
              ) : (
                filteredSavedScenarios.map(scenario => {
                  const isSelectedForCompare = selectedScenarioIdsForCompare.includes(scenario.id);
                  const cycleName = scenario.config.cycle === 'ciclo_1' ? '1º Semestre' : scenario.config.cycle === 'ciclo_2' ? '2º Semestre' : 'Custom';

                  return (
                    <div 
                      key={scenario.id}
                      className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-sm transition-all space-y-3 ${
                        isSelectedForCompare ? 'border-indigo-400 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Linha Superior: Checkbox + Título + Badges */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <label className="flex items-center gap-2 cursor-pointer mt-0.5">
                            <input
                              type="checkbox"
                              checked={isSelectedForCompare}
                              onChange={() => handleToggleSelectScenarioForCompare(scenario.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                            />
                            <span className="text-[11px] font-bold text-slate-500 uppercase select-none">Comparar</span>
                          </label>

                          <div>
                            <h4 className="text-base font-black text-slate-900 leading-snug">
                              {scenario.name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold px-2 py-0.5 rounded-md">
                                <Calendar size={12} />
                                Data do Estudo: {scenario.studyDate ? scenario.studyDate.split('-').reverse().join('/') : '-'}
                              </span>
                              <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-md">
                                {cycleName} / {scenario.config.year}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Gravado em: {new Date(scenario.createdAt).toLocaleDateString('pt-BR')} às {new Date(scenario.createdAt).toLocaleTimeString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botões Rápidos de Impressão, Download e Ação */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenCloneModal(scenario)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                            title="Clonar este cenário e criar variação incremental rápida (ajustar % ou R$)"
                          >
                            <Copy size={13} className="text-amber-600" />
                            <span>Clonar / Variação</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenExportOptionsModal(
                              {
                                ...scenario.summary,
                                candidates: scenario.candidatesSnapshot || [],
                                glosadosCandidates: (scenario.candidatesSnapshot || []).filter(c => c.hasGlosaInPeriod),
                                inativosCandidates: (scenario.candidatesSnapshot || []).filter(c => c.isInactiveAtPaymentDate),
                              },
                              scenario.config,
                              { scenarioName: scenario.name, studyDate: scenario.studyDate, criteria: scenario.criteriaDescription }
                            )}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                            title="Personalizar e baixar PDF deste estudo histórico"
                          >
                            <Download size={13} />
                            <span>Baixar PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenExportOptionsModal(
                              {
                                ...scenario.summary,
                                candidates: scenario.candidatesSnapshot || [],
                                glosadosCandidates: (scenario.candidatesSnapshot || []).filter(c => c.hasGlosaInPeriod),
                                inativosCandidates: (scenario.candidatesSnapshot || []).filter(c => c.isInactiveAtPaymentDate),
                              },
                              scenario.config,
                              { scenarioName: scenario.name, studyDate: scenario.studyDate, criteria: scenario.criteriaDescription }
                            )}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                            title="Personalizar e visualizar para impressão física ou salvar como PDF"
                          >
                            <Printer size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRestoreScenario(scenario)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            title="Carregar todos os critérios deste cenário no simulador ativo"
                          >
                            <RotateCcw size={13} />
                            <span>Carregar no Cockpit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteScenario(scenario.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer ml-1"
                            title="Excluir este cenário salvo"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Critérios do Cenário */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-700 space-y-1">
                        <strong className="text-[11px] font-bold text-slate-900 uppercase block tracking-wider">Critérios e Premissas:</strong>
                        <p className="line-clamp-2 leading-relaxed text-slate-600 font-medium">
                          {scenario.criteriaDescription || 'Sem observações adicionais.'}
                        </p>
                      </div>

                      {/* KPIs do Snapshot Congelado */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Montante Total</span>
                          <strong className="text-sm font-black text-emerald-700">{formatCurrency(scenario.summary.totalPoolAmount)}</strong>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Rateado</span>
                          <strong className="text-sm font-black text-slate-900">{formatCurrency(scenario.summary.totalDistributedAmount)}</strong>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Elegíveis</span>
                          <strong className="text-sm font-black text-slate-800">{scenario.summary.totalEligible} colaboradores</strong>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Valor Base E / T / O</span>
                          <span className="text-[11px] font-bold text-slate-700 block truncate">
                            E: {formatCurrency(scenario.summary.amountPerE || 0)} | T: {formatCurrency(scenario.summary.amountPerT || 0)} | O: {formatCurrency(scenario.summary.amountPerO || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé da Central de Cenários */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-bold">
                {selectedScenarioIdsForCompare.length > 0 
                  ? `${selectedScenarioIdsForCompare.length} de ${savedScenarios.length} estudos selecionados para comparação`
                  : 'Marque a caixa "Comparar" em 2 ou mais cenários para analisar as variações por colaborador'}
              </span>

              <div className="flex items-center gap-2">
                {selectedScenarioIdsForCompare.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => setIsCompareModalOpen(true)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl uppercase tracking-wider text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    <Scale size={15} />
                    <span>Abrir Tabela Comparativa</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSavedScenariosModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs uppercase cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: COMPARADOR DE CENÁRIOS BPR ── */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header do Comparador */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20">
                  <Scale size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                    Comparativo Executivo de Cenários BPR
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tabela comparativa direta de valores calculados para cada colaborador entre os estudos selecionados
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => BprPdfService.exportComparisonPdf(scenariosToCompare, comparisonRows, Object.fromEntries(scenarioWeightsMap))}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                  title="Baixar comparativo em PDF"
                >
                  <Download size={14} />
                  <span>Baixar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => BprPdfService.openPrintableComparison(scenariosToCompare, comparisonRows, Object.fromEntries(scenarioWeightsMap))}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Imprimir relatório comparativo"
                >
                  <Printer size={15} />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setIsCompareModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-700 text-2xl font-bold p-1 leading-none cursor-pointer ml-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Cards de Resumo Lado a Lado dos Cenários Comparados + Resumo Executivo por Camada */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-white shrink-0 space-y-4 overflow-x-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 min-w-[500px]">
                {scenariosToCompare.map((sc, idx) => {
                  const scWeights = scenarioWeightsMap.get(sc.id);
                  const hasHist = (scWeights?.overall.eligibleWithHistoryCount || 0) > 0;
                  return (
                    <div key={sc.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Cenário #{idx + 1}</span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {sc.studyDate ? sc.studyDate.split('-').reverse().join('/') : '-'}
                        </span>
                      </div>
                      <h5 className="font-black text-sm text-slate-900 truncate" title={sc.name}>{sc.name}</h5>
                      <div className="pt-1.5 border-t border-slate-200/70 grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase block font-sans">Montante</span>
                          <strong className="text-emerald-700">{formatCurrency(sc.summary.totalPoolAmount)}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase block font-sans">Elegíveis</span>
                          <strong className="text-slate-800">{sc.summary.totalEligible} pessoas</strong>
                        </div>
                      </div>
                      {(sc.summary.dedicatedGroupsAllocatedTotal || 0) > 0 && (
                        <div className="pt-1 border-t border-slate-200/70 flex items-center justify-between text-[10px] font-mono">
                          <span className="font-sans font-bold text-teal-700 uppercase">Grupos Específicos:</span>
                          <strong className="text-teal-800 font-black">
                            {formatCurrency(sc.summary.dedicatedGroupsAllocatedTotal || 0)} ({sc.summary.dedicatedMembersCount || 0}p)
                          </strong>
                        </div>
                      )}
                      {hasHist && scWeights && (
                        <div className="pt-1.5 border-t border-slate-200/70 space-y-1">
                          <span className="text-[9px] font-black text-sky-700 uppercase block tracking-wider">
                            Peso BPR (% Média Mensal):
                          </span>
                          <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center">
                            <div className="bg-blue-50 border border-blue-200 rounded px-1 py-0.5 text-blue-800 font-black">
                              <span className="block text-[8px] font-sans text-blue-600">E</span>
                              {scWeights.E.eligibleWithHistoryCount > 0 ? formatMultiplePtBr(scWeights.E.bprMultipleOfMonthlyAvg) : '—'}
                            </div>
                            <div className="bg-slate-100 border border-slate-300 rounded px-1 py-0.5 text-slate-800 font-black">
                              <span className="block text-[8px] font-sans text-slate-500">T</span>
                              {scWeights.T.eligibleWithHistoryCount > 0 ? formatMultiplePtBr(scWeights.T.bprMultipleOfMonthlyAvg) : '—'}
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 text-emerald-800 font-black">
                              <span className="block text-[8px] font-sans text-emerald-600">O</span>
                              {scWeights.O.eligibleWithHistoryCount > 0 ? formatMultiplePtBr(scWeights.O.bprMultipleOfMonthlyAvg) : '—'}
                            </div>
                            <div className="bg-sky-50 border border-sky-200 rounded px-1 py-0.5 text-sky-900 font-black">
                              <span className="block text-[8px] font-sans text-sky-600">Geral</span>
                              {formatMultiplePtBr(scWeights.overall.bprMultipleOfMonthlyAvg)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quadro Executivo Comparativo por Camada (E, T, O e Geral) */}
              {scenariosToCompare.some(sc => (scenarioWeightsMap.get(sc.id)?.overall.eligibleWithHistoryCount || 0) > 0) && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50/40 overflow-hidden">
                  <div className="px-3.5 py-2 bg-sky-100/70 border-b border-sky-200 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-sky-900">
                      Resumo Executivo por Camada — Peso Relativo do BPR sobre Recebimentos Médios Mensais
                    </span>
                    <span className="text-[10px] font-bold text-sky-700">
                      % da Média Mensal (Múltiplo de Salários / Honorários)
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-white border-b border-sky-100 text-[10px] font-black uppercase text-slate-500">
                          <th className="py-2 px-3">Camada / Nível</th>
                          {scenariosToCompare.map((sc, idx) => (
                            <th key={sc.id} className="py-2 px-3 text-right">
                              #{idx + 1} · {sc.name.length > 22 ? `${sc.name.slice(0, 20)}...` : sc.name}
                            </th>
                          ))}
                          {scenariosToCompare.length >= 2 && (
                            <th className="py-2 px-3 text-right">Delta (#2 vs #1)</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sky-100/80 bg-white">
                        {([
                          { key: 'E' as const, label: 'Estratégico (E)' },
                          { key: 'T' as const, label: 'Tático (T)' },
                          { key: 'O' as const, label: 'Operacional / CLTs (O)' },
                          { key: 'overall' as const, label: 'Consolidado Geral' },
                        ]).map(rowDef => {
                          const w0 = scenarioWeightsMap.get(scenariosToCompare[0]?.id)?.[rowDef.key];
                          const w1 = scenarioWeightsMap.get(scenariosToCompare[1]?.id)?.[rowDef.key];
                          const deltaPp = scenariosToCompare.length >= 2 && w0 && w1 && w0.eligibleWithHistoryCount > 0 && w1.eligibleWithHistoryCount > 0
                            ? Number((w1.bprVsMonthlyAvgPct - w0.bprVsMonthlyAvgPct).toFixed(1))
                            : null;

                          return (
                            <tr key={rowDef.key} className={rowDef.key === 'overall' ? 'bg-sky-50/50 font-black' : ''}>
                              <td className="py-2 px-3 font-bold text-slate-800">{rowDef.label}</td>
                              {scenariosToCompare.map(sc => {
                                const w = scenarioWeightsMap.get(sc.id)?.[rowDef.key];
                                const valid = (w?.eligibleWithHistoryCount || 0) > 0;
                                return (
                                  <td key={sc.id} className="py-2 px-3 text-right font-mono">
                                    {valid && w ? (
                                      <span
                                        className="font-bold text-slate-900"
                                        title={`Base: ${w.eligibleWithHistoryCount} de ${w.eligibleCount} elegíveis com histórico · ${formatPctPtBr(w.bprVsPeriodTotalPct)} do montante do período`}
                                      >
                                        {formatPctPtBr(w.bprVsMonthlyAvgPct)}{' '}
                                        <span className="text-sky-700 font-black">({formatMultiplePtBr(w.bprMultipleOfMonthlyAvg)})</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              {scenariosToCompare.length >= 2 && (
                                <td className="py-2 px-3 text-right font-mono font-black">
                                  {deltaPp === null ? (
                                    <span className="text-slate-400">—</span>
                                  ) : deltaPp > 0 ? (
                                    <span className="text-emerald-700">+{deltaPp.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.</span>
                                  ) : deltaPp < 0 ? (
                                    <span className="text-rose-600">{deltaPp.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.</span>
                                  ) : (
                                    <span className="text-slate-400">0,0 p.p.</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Quadro Comparativo Dedicado: Grupos de Montante Específico (Rateio Exclusivo) */}
              {dedicatedGroupComparisonRows.length > 0 && (
                <div className="rounded-2xl border border-teal-200 bg-teal-50/40 overflow-hidden">
                  <div className="px-3.5 py-2 bg-teal-100/70 border-b border-teal-200 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                      <Users size={13} className="text-teal-700" />
                      Grupos de Montante Específico — Comparativo por Grupo (Rateio Exclusivo)
                    </span>
                    <span className="text-[10px] font-bold text-teal-700">
                      Montante Alocado (R$) · Membros · Variação (#2 vs #1)
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-white border-b border-teal-100 text-[10px] font-black uppercase text-slate-500">
                          <th className="py-2 px-3">Grupo Específico</th>
                          {scenariosToCompare.map((sc, idx) => (
                            <th key={sc.id} className="py-2 px-3 text-right">
                              #{idx + 1} · {sc.name.length > 22 ? `${sc.name.slice(0, 20)}...` : sc.name}
                            </th>
                          ))}
                          {scenariosToCompare.length >= 2 && (
                            <th className="py-2 px-3 text-right">Delta (#2 vs #1)</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-teal-100/80 bg-white">
                        {dedicatedGroupComparisonRows.map(gr => (
                          <tr key={gr.groupKey}>
                            <td className="py-2 px-3 font-black text-teal-900">{gr.groupName}</td>
                            {scenariosToCompare.map(sc => {
                              const val = gr.scenarioValues[sc.id];
                              const hasVal = Boolean(val && (val.allocatedTotal > 0 || val.memberCount > 0));
                              return (
                                <td key={sc.id} className="py-2 px-3 text-right font-mono">
                                  {hasVal && val ? (
                                    <span className="font-bold text-slate-900">
                                      {formatCurrency(val.allocatedTotal)}{' '}
                                      <span className="text-[10px] text-teal-700 font-black">({val.memberCount}p)</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              );
                            })}
                            {scenariosToCompare.length >= 2 && (
                              <td className="py-2 px-3 text-right font-mono font-black">
                                <span className={
                                  (gr.deltaAmount || 0) > 0
                                    ? 'text-emerald-700'
                                    : (gr.deltaAmount || 0) < 0
                                      ? 'text-rose-600'
                                      : 'text-slate-400'
                                }>
                                  {(gr.deltaAmount || 0) > 0 ? '+' : ''}{formatCurrency(gr.deltaAmount || 0)}
                                </span>
                                <span className="text-[10px] text-slate-500 ml-1">
                                  ({(gr.deltaMembers || 0) > 0 ? '+' : ''}{gr.deltaMembers || 0}p)
                                </span>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-teal-50/70 border-t border-teal-200 font-black">
                          <td className="py-2 px-3 text-teal-900 uppercase text-[11px]">Total Grupos Específicos</td>
                          {scenariosToCompare.map(sc => {
                            const totAmt = dedicatedGroupComparisonRows.reduce((acc, gr) => acc + (gr.scenarioValues[sc.id]?.allocatedTotal || 0), 0);
                            const totMem = dedicatedGroupComparisonRows.reduce((acc, gr) => acc + (gr.scenarioValues[sc.id]?.memberCount || 0), 0);
                            return (
                              <td key={sc.id} className="py-2 px-3 text-right font-mono text-teal-900">
                                {formatCurrency(totAmt)}{' '}
                                <span className="text-[10px] text-teal-700">({totMem}p)</span>
                              </td>
                            );
                          })}
                          {scenariosToCompare.length >= 2 && (() => {
                            const totDeltaAmt = dedicatedGroupComparisonRows.reduce((acc, gr) => acc + (gr.deltaAmount || 0), 0);
                            const totDeltaMem = dedicatedGroupComparisonRows.reduce((acc, gr) => acc + (gr.deltaMembers || 0), 0);
                            return (
                              <td className="py-2 px-3 text-right font-mono font-black">
                                <span className={
                                  totDeltaAmt > 0 ? 'text-emerald-700' : totDeltaAmt < 0 ? 'text-rose-600' : 'text-slate-500'
                                }>
                                  {totDeltaAmt > 0 ? '+' : ''}{formatCurrency(totDeltaAmt)}
                                </span>
                                <span className="text-[10px] text-slate-600 ml-1">
                                  ({totDeltaMem > 0 ? '+' : ''}{totDeltaMem}p)
                                </span>
                              </td>
                            );
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Barra de Filtros da Tabela Comparativa */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="relative w-full sm:w-80">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={compareSearchQuery}
                  onChange={e => setCompareSearchQuery(e.target.value)}
                  placeholder="Filtrar colaborador no comparativo..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              {scenariosToCompare.length >= 2 && (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={compareOnlyDiffs}
                    onChange={e => setCompareOnlyDiffs(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <span>Exibir apenas colaboradores com variação de valor</span>
                </label>
              )}

              <span className="text-xs font-bold text-slate-500">
                {comparisonRows.length} colaboradores listados
              </span>
            </div>

            {/* Tabela Analítica de Comparação */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-white">
              <table className="w-full border-collapse text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider sticky top-0">
                    <th className="py-2.5 px-3">Colaborador / Razão Social</th>
                    <th className="py-2.5 px-3">Empresa</th>
                    <th className="py-2.5 px-3">Cargo</th>
                    <th className="py-2.5 px-3 text-center">Camada</th>
                    {scenariosToCompare.map(sc => (
                      <th key={sc.id} className="py-2.5 px-3 text-right">
                        {sc.name}
                      </th>
                    ))}
                    {scenariosToCompare.length >= 2 && (
                      <th className="py-2.5 px-3 text-right">Diferença (Delta)</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparisonRows.length === 0 ? (
                    <tr>
                      <td colSpan={5 + scenariosToCompare.length} className="py-12 text-center text-slate-400">
                        Nenhum colaborador encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    comparisonRows.map(row => (
                      <tr key={row.employeeId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {row.corporateName || row.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{row.company}</td>
                        <td className="py-2.5 px-3 text-slate-600">{row.jobRole}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                            {row.camadaLabel}
                          </span>
                        </td>
                        {scenariosToCompare.map(sc => {
                          const item = row.scenarioValues[sc.id];
                          const amt = item && item.isEligible ? item.amount : 0;
                          return (
                            <td key={sc.id} className="py-2.5 px-3 text-right font-mono font-bold">
                              {amt > 0 ? (
                                <span className="text-slate-900 block">{formatCurrency(amt)}</span>
                              ) : (
                                <span className="text-slate-300 block">R$ 0,00</span>
                              )}
                              {item?.dedicatedGroupName && (
                                <span className="inline-block mt-0.5 text-[9px] font-sans font-black px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                                  Grupo: {item.dedicatedGroupName}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        {scenariosToCompare.length >= 2 && (
                          <td className="py-2.5 px-3 text-right font-mono font-black">
                            {(row.delta || 0) > 0 ? (
                              <span className="text-emerald-600">+{formatCurrency(row.delta || 0)}</span>
                            ) : (row.delta || 0) < 0 ? (
                              <span className="text-rose-600">{formatCurrency(row.delta || 0)}</span>
                            ) : (
                              <span className="text-slate-400">R$ 0,00</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer do Comparador */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs uppercase cursor-pointer"
              >
                Fechar Comparador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CLONAR CENÁRIO & CRIAR VARIAÇÃO INCREMENTAL ── */}
      {isCloneScenarioModalOpen && cloneTargetScenario && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Cabeçalho */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                  <Copy size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <span>Clonar Cenário &amp; Criar Variação</span>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Incremental
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Estudo base: <strong className="text-slate-700">{cloneTargetScenario.name}</strong> · Base de elegíveis congelada do estudo original
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloneScenarioModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-6 overflow-y-auto space-y-5 bg-white">
              {/* Banner do Estudo Base */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Estudo Base Original</span>
                  <strong className="text-sm font-black text-slate-800">{cloneTargetScenario.name}</strong>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Data do estudo: {cloneTargetScenario.studyDate ? cloneTargetScenario.studyDate.split('-').reverse().join('/') : '-'} · {cloneTargetScenario.summary.totalEligible} elegíveis apurados
                  </p>
                </div>
                <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Pool Original</span>
                    <strong className="text-xs font-black text-slate-800">{formatCurrency(cloneTargetScenario.summary.totalPoolAmount)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Rateado Original</span>
                    <strong className="text-xs font-black text-emerald-700">{formatCurrency(cloneTargetScenario.summary.totalDistributedAmount)}</strong>
                  </div>
                </div>
              </div>

              {/* 1. Identificação da Nova Variação */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center text-[10px]">1</span>
                  <span>Identificação do Novo Cenário</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Nome do Cenário Cloned / Variação
                    </label>
                    <input
                      type="text"
                      value={cloneNameInput}
                      onChange={e => setCloneNameInput(e.target.value)}
                      placeholder="Ex: Simulação C1 2026 - Aumento 5% no Operacional"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-bold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Data do Novo Estudo
                    </label>
                    <input
                      type="date"
                      value={cloneStudyDateInput}
                      onChange={e => setCloneStudyDateInput(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Premissas e Justificativa da Variação
                  </label>
                  <textarea
                    value={cloneCriteriaInput}
                    onChange={e => setCloneCriteriaInput(e.target.value)}
                    placeholder="Descreva o objetivo desta variação (ex: Aumento de 5% no Operacional para incentivar retenção de equipe técnica)"
                    rows={2}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 resize-none"
                  />
                </div>
              </div>

              {/* 2. Ajuste dos Parâmetros de Rateio */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center text-[10px]">2</span>
                    <span>Ajuste Incremental dos Parâmetros</span>
                  </h4>

                  {/* Alternador de Modo: % vs R$ */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setCloneSplitMode('percentage')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        cloneSplitMode === 'percentage'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Porcentagem (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCloneSplitMode('amount');
                        if (!cloneTierAmounts.E && !cloneTierAmounts.T && !cloneTierAmounts.O) {
                          const pool = cloneTotalPool || 100000;
                          setCloneTierAmounts({
                            E: Number(((pool * cloneTierSplits.E) / 100).toFixed(2)),
                            T: Number(((pool * cloneTierSplits.T) / 100).toFixed(2)),
                            O: Number(((pool * cloneTierSplits.O) / 100).toFixed(2))
                          });
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        cloneSplitMode === 'amount'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Valor Fixo (R$)
                    </button>
                  </div>
                </div>

                {cloneSplitMode === 'percentage' ? (
                  <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Montante Total do Pool (R$)
                      </label>
                      <input
                        type="number"
                        step="1000"
                        value={cloneTotalPool}
                        onChange={e => setCloneTotalPool(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Estratégico (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={cloneTierSplits.E}
                            onChange={e => setCloneTierSplits(prev => ({ ...prev, E: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 pr-8"
                          />
                          <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Tático (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={cloneTierSplits.T}
                            onChange={e => setCloneTierSplits(prev => ({ ...prev, T: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 pr-8"
                          />
                          <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Operacional (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={cloneTierSplits.O}
                            onChange={e => setCloneTierSplits(prev => ({ ...prev, O: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 pr-8"
                          />
                          <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                        </div>
                      </div>
                    </div>

                    {/* Indicador de Soma de 100% */}
                    {(() => {
                      const sum = (cloneTierSplits.E || 0) + (cloneTierSplits.T || 0) + (cloneTierSplits.O || 0);
                      return (
                        <div className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-xl font-bold ${
                          sum === 100 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          <span>Soma dos percentuais: {sum}%</span>
                          <span>{sum === 100 ? '✓ Equilibrado em 100%' : `⚠️ Divergência de ${100 - sum}%`}</span>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Estratégico (R$)
                        </label>
                        <input
                          type="number"
                          step="500"
                          value={cloneTierAmounts.E}
                          onChange={e => setCloneTierAmounts(prev => ({ ...prev, E: parseFloat(e.target.value) || 0 }))}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Tático (R$)
                        </label>
                        <input
                          type="number"
                          step="500"
                          value={cloneTierAmounts.T}
                          onChange={e => setCloneTierAmounts(prev => ({ ...prev, T: parseFloat(e.target.value) || 0 }))}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Operacional (R$)
                        </label>
                        <input
                          type="number"
                          step="500"
                          value={cloneTierAmounts.O}
                          onChange={e => setCloneTierAmounts(prev => ({ ...prev, O: parseFloat(e.target.value) || 0 }))}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono font-bold">
                      <span className="text-slate-500 uppercase tracking-wider text-[10px]">Pool Total Resultante (E + T + O):</span>
                      <span className="text-sm font-black text-emerald-700">
                        {formatCurrency((cloneTierAmounts.E || 0) + (cloneTierAmounts.T || 0) + (cloneTierAmounts.O || 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Comparativo / Delta em Tempo Real */}
              {clonePreviewSummary && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center text-[10px]">3</span>
                    <span>Impacto da Variação em Relação ao Estudo Original</span>
                  </h4>

                  <div className="bg-slate-900 text-white rounded-2xl p-4 font-mono text-xs space-y-3 shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <span className="text-slate-400 font-sans text-xs">Base congelada:</span>
                      <span className="text-amber-400 font-bold">{clonePreviewSummary.totalEligible} elegíveis mantidos</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
                      {/* Total Pool */}
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">Pool Total</span>
                        <div className="text-sm font-black text-white">{formatCurrency(clonePreviewSummary.totalPoolAmount)}</div>
                        {(() => {
                          const diff = clonePreviewSummary.totalPoolAmount - cloneTargetScenario.summary.totalPoolAmount;
                          if (Math.abs(diff) < 0.01) return <span className="text-[10px] text-slate-400">Sem variação</span>;
                          return (
                            <span className={`text-[10px] font-bold ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Estratégico */}
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">Estratégico (p/ elegível)</span>
                        <div className="text-sm font-black text-white">{formatCurrency(clonePreviewSummary.layers.E.amountPerEligible)}</div>
                        {(() => {
                          const orig = cloneTargetScenario.summary.amountPerE || cloneTargetScenario.summary.layers?.E?.amountPerEligible || 0;
                          const diff = clonePreviewSummary.layers.E.amountPerEligible - orig;
                          if (Math.abs(diff) < 0.01) return <span className="text-[10px] text-slate-400">Sem variação</span>;
                          return (
                            <span className={`text-[10px] font-bold ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Tático */}
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">Tático (p/ elegível)</span>
                        <div className="text-sm font-black text-white">{formatCurrency(clonePreviewSummary.layers.T.amountPerEligible)}</div>
                        {(() => {
                          const orig = cloneTargetScenario.summary.amountPerT || cloneTargetScenario.summary.layers?.T?.amountPerEligible || 0;
                          const diff = clonePreviewSummary.layers.T.amountPerEligible - orig;
                          if (Math.abs(diff) < 0.01) return <span className="text-[10px] text-slate-400">Sem variação</span>;
                          return (
                            <span className={`text-[10px] font-bold ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Operacional */}
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">Operacional (p/ elegível)</span>
                        <div className="text-sm font-black text-white">{formatCurrency(clonePreviewSummary.layers.O.amountPerEligible)}</div>
                        {(() => {
                          const orig = cloneTargetScenario.summary.amountPerO || cloneTargetScenario.summary.layers?.O?.amountPerEligible || 0;
                          const diff = clonePreviewSummary.layers.O.amountPerEligible - orig;
                          if (Math.abs(diff) < 0.01) return <span className="text-[10px] text-slate-400">Sem variação</span>;
                          return (
                            <span className={`text-[10px] font-bold ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé com Ações */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsCloneScenarioModalOpen(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs uppercase cursor-pointer"
              >
                Cancelar
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyCloneToSimulator}
                  className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  title="Carrega esta nova variação no simulador ativo para continuar ajustando"
                >
                  <RotateCcw size={14} />
                  <span>Carregar no Cockpit</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSaveClone}
                  disabled={!cloneNameInput.trim()}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <Save size={15} />
                  <span>Salvar como Novo Cenário</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PERSONALIZAR EXPORTAÇÃO DO RELATÓRIO BPR (PDF / IMPRESSÃO) ── */}
      {isExportOptionsModalOpen && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                    Personalizar Relatório de BPR
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina o que constará no documento: elegibilidade, níveis e empresas
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsExportOptionsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold p-1 leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo com os filtros */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-white text-xs">
              
              {/* 1. SELEÇÃO DE ELEGIBILIDADE */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  1. Quem deve constar no relatório?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportEligibility('eligible_only')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                      exportEligibility === 'eligible_only'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/10'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs">Somente Elegíveis</span>
                      {exportEligibility === 'eligible_only' && <Check size={14} className="text-emerald-600" />}
                    </div>
                    <span className="text-[11px] text-emerald-700 font-medium">Recomendado: omite quem não tem direito ao bônus</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportEligibility('all')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                      exportEligibility === 'all'
                        ? 'bg-slate-100 border-slate-400 text-slate-900 ring-2 ring-slate-500/10'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs">Todos os Colaboradores</span>
                      {exportEligibility === 'all' && <Check size={14} className="text-slate-800" />}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">Elegíveis + Inelegíveis / Glosados</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportEligibility('ineligible_only')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                      exportEligibility === 'ineligible_only'
                        ? 'bg-rose-50 border-rose-400 text-rose-900 ring-2 ring-rose-500/10'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs">Somente Inelegíveis</span>
                      {exportEligibility === 'ineligible_only' && <Check size={14} className="text-rose-600" />}
                    </div>
                    <span className="text-[11px] text-rose-600 font-medium">Para auditoria de exclusões e glosas</span>
                  </button>
                </div>
              </div>

              {/* 2. SELEÇÃO DE CAMADAS / NÍVEIS */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  2. Níveis / Camadas de Rateio:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'E' as BprCamada, label: 'Estratégico (E)' },
                    { id: 'T' as BprCamada, label: 'Tático (T)' },
                    { id: 'O' as BprCamada, label: 'Operacional (O)' }
                  ].map(c => {
                    const isChecked = exportSelectedCamadas.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleToggleExportCamada(c.id)}
                        className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <span>{c.label}</span>
                        {isChecked && <Check size={13} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2B. FILTRO POR GRUPO DE MONTANTE ESPECÍFICO (QUANDO EXISTIREM GRUPOS) */}
              {availableExportDedicatedGroups.length > 0 && (
                <div className="space-y-2 bg-teal-50/50 border border-teal-200 rounded-2xl p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-black text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={13} className="text-teal-700" />
                      <span>Grupos de Montante Específico (Opcional):</span>
                    </label>
                    {exportSelectedDedicatedGroupIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleToggleExportDedicatedGroup('')}
                        className="text-[11px] text-teal-700 hover:underline font-bold cursor-pointer"
                      >
                        Mostrar Todos
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleExportDedicatedGroup('')}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        exportSelectedDedicatedGroupIds.length === 0
                          ? 'bg-teal-600 text-white shadow-sm font-black'
                          : 'bg-white text-slate-600 hover:bg-teal-50 border border-slate-200'
                      }`}
                    >
                      Todos (Camadas + Grupos)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleExportDedicatedGroup('__ALL_DEDICATED__')}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        exportSelectedDedicatedGroupIds.includes('__ALL_DEDICATED__')
                          ? 'bg-teal-800 text-white shadow-sm font-black'
                          : 'bg-white text-teal-800 hover:bg-teal-50 border border-teal-200'
                      }`}
                    >
                      <span>Somente Grupos Específicos</span>
                      {exportSelectedDedicatedGroupIds.includes('__ALL_DEDICATED__') && <Check size={12} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleExportDedicatedGroup('__STANDARD_LAYERS__')}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        exportSelectedDedicatedGroupIds.includes('__STANDARD_LAYERS__')
                          ? 'bg-slate-800 text-white shadow-sm font-black'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span>Somente Camadas E/T/O</span>
                      {exportSelectedDedicatedGroupIds.includes('__STANDARD_LAYERS__') && <Check size={12} />}
                    </button>

                    {availableExportDedicatedGroups.map(grp => {
                      const isChecked = exportSelectedDedicatedGroupIds.includes(grp.id);
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => handleToggleExportDedicatedGroup(grp.id)}
                          className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isChecked
                              ? 'bg-teal-700 text-white shadow-sm font-black'
                              : 'bg-white text-teal-900 hover:bg-teal-50 border border-teal-300'
                          }`}
                        >
                          <span>{grp.name} ({grp.memberCount}p)</span>
                          {isChecked && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. SELEÇÃO DE EMPRESAS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    3. Empresas Contratantes:
                  </label>
                  <button
                    type="button"
                    onClick={() => setExportSelectedCompanies([])}
                    className="text-[11px] text-amber-600 hover:underline font-bold"
                  >
                    Marcar Todas
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setExportSelectedCompanies([])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      exportSelectedCompanies.length === 0
                        ? 'bg-amber-500 text-white shadow-sm font-black'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    Todas as Empresas
                  </button>
                  {availableCompanies.map(comp => {
                    const isChecked = exportSelectedCompanies.includes(comp);
                    return (
                      <button
                        key={comp}
                        type="button"
                        onClick={() => handleToggleExportCompany(comp)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          isChecked
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <span>{comp}</span>
                        {isChecked && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. FILTRO POR NOME (OPCIONAL) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  4. Filtrar por Nome(s) (Opcional):
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={exportNameQuery}
                    onChange={e => setExportNameQuery(e.target.value)}
                    placeholder="Ex: João Silva ou Maria, Carlos (separe múltiplos nomes por vírgula)"
                    className="w-full min-h-[40px] pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-amber-500"
                  />
                  {exportNameQuery && (
                    <button
                      type="button"
                      onClick={() => setExportNameQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                      title="Limpar filtro por nome"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* 5. SEÇÕES ADICIONAIS DO DOCUMENTO */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  5. Estrutura e Seções do Documento:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={exportIncludeSummaryCards}
                      onChange={e => setExportIncludeSummaryCards(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700">Cards de Indicadores</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={exportIncludeLayerSummary}
                      onChange={e => setExportIncludeLayerSummary(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700">Tabela de Camadas</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={exportIncludeSignatures}
                      onChange={e => setExportIncludeSignatures(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700">Bloco de Assinaturas</span>
                  </label>
                </div>
              </div>

              {/* 5. PRÉ-VISUALIZAÇÃO DO ESCOPO FINAL */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 font-sans font-bold uppercase block">Recorte Selecionado</span>
                  <strong className="text-sm text-slate-900 font-black font-sans">
                    {exportPreviewCandidates.length} colaborador(es) no relatório
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-sans font-bold uppercase block sm:text-right">Total Rateado no Recorte</span>
                  <strong className="text-sm text-emerald-700 font-black sm:text-right block">
                    {formatCurrency(exportPreviewTotalDistributed)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Footer do Modal de Exportação */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsExportOptionsModalOpen(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirmExportPdf('print')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Printer size={15} />
                  <span>Visualizar Impressão</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmExportPdf('download')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-emerald-700/20 transition-all cursor-pointer active:scale-95"
                >
                  <Download size={15} />
                  <span>Baixar Arquivo PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE GESTÃO DE GRUPOS DE MONTANTE ESPECÍFICO (RATEIO EXCLUSIVO) ── */}
      {isDedicatedGroupsModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Users size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                    Grupos de Montante Específico (Rateio Exclusivo)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Destine um montante específico para os colaboradores selecionados, escolhendo a camada de origem e seguindo as regras do ciclo (elegibilidade e fator % com redistribuição) ou exceções.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCreateDedicatedGroup}
                  className="min-h-[42px] px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Plus size={15} />
                  <span>Novo Grupo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDedicatedGroupsModalOpen(false)}
                  aria-label="Fechar gestão de grupos"
                  className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-5 bg-slate-50">
              {dedicatedGroups.length === 0 ? (
                <div className="bg-white border border-dashed border-teal-300 rounded-2xl p-6 sm:p-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center mx-auto">
                    <Users size={24} />
                  </div>
                  <div className="space-y-1 max-w-lg mx-auto">
                    <h4 className="text-sm sm:text-base font-black text-slate-900">
                      Nenhum grupo de montante específico criado ainda
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Você pode selecionar colaboradores diretamente na grade principal (ou criar um grupo aqui), destinar um montante específico (ex.: R$ 5.000,00 retirados do Operacional para os Técnicos) e aplicar as regras do BPR com prévia Antes × Depois.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateDedicatedGroup}
                    className="min-h-[44px] px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
                  >
                    <Plus size={16} />
                    <span>Criar Primeiro Grupo Específico</span>
                  </button>
                </div>
              ) : (
                dedicatedGroups.map(group => {
                  const memberIdsSet = new Set(group.members.map(m => m.employeeId));
                  const claimedByOtherGroup = new Map<string, string>();
                  dedicatedGroups.forEach(other => {
                    if (other.id === group.id || !other.enabled) return;
                    other.members.forEach(m => {
                      if (!claimedByOtherGroup.has(m.employeeId)) {
                        claimedByOtherGroup.set(m.employeeId, other.name || 'Outro Grupo');
                      }
                    });
                  });

                  const candidateMap = new Map<string, BprCandidateResult>();
                  summary.candidates.forEach(c => candidateMap.set(c.employeeId, c));

                  const effectiveEligibilityPolicy: BprDedicatedGroupEligibilityPolicy =
                    group.eligibilityPolicy ?? 'include_all_as_exception';
                  const effectiveApplyPerf = group.applyPerformanceFactor ?? false;
                  const effectiveReducedFactor = group.reducedFactorPct ?? 75;
                  const effectiveRedistribute = group.redistributePerformanceResidual ?? true;

                  const totalPct = Number(
                    group.members.reduce((acc, m) => acc + Math.max(0, Number(m.percentage || 0)), 0).toFixed(2)
                  );
                  const totalMemberAmt = Number(
                    group.members.reduce((acc, m) => acc + Math.max(0, Number(m.amount || 0)), 0).toFixed(2)
                  );
                  const groupSummary = (summary.dedicatedGroupSummaries || []).find(s => s.groupId === group.id);
                  const impactPreview = groupImpactPreviewMap.get(group.id);
                  const searchTerm = dedicatedMemberSearchByGroup[group.id] || '';
                  const roleFilter = dedicatedRoleFilterByGroup[group.id] || '';
                  const camadaPickFilter = dedicatedCamadaFilterByGroup[group.id] || '';
                  const normSearch = normalizeSearchText(searchTerm);

                  const filteredCandidatesForGroup = summary.candidates
                    .filter(c => {
                      if (roleFilter && c.jobRole !== roleFilter) return false;
                      if (camadaPickFilter && c.camada !== camadaPickFilter) return false;
                      if (!normSearch) return true;
                      const hay = normalizeSearchText(
                        `${c.name} ${c.corporateName || ''} ${c.responsibleName || ''} ${c.jobRole || ''} ${c.department || ''} ${c.company || ''}`
                      );
                      return hay.includes(normSearch);
                    })
                    .sort((a, b) => {
                      const aSel = memberIdsSet.has(a.employeeId) ? 0 : 1;
                      const bSel = memberIdsSet.has(b.employeeId) ? 0 : 1;
                      if (aSel !== bSel) return aSel - bSel;
                      return (a.corporateName || a.name).localeCompare(b.corporateName || b.name, 'pt-BR');
                    });

                  const batchAddableIds = filteredCandidatesForGroup
                    .filter(c => {
                      const otherGroupName = claimedByOtherGroup.get(c.employeeId);
                      const isManExcl = (config.manuallyExcludedEmployeeIds || []).includes(c.employeeId);
                      return !otherGroupName && !isManExcl && !memberIdsSet.has(c.employeeId);
                    })
                    .map(c => c.employeeId);

                  const batchRemovableIds = filteredCandidatesForGroup
                    .filter(c => memberIdsSet.has(c.employeeId))
                    .map(c => c.employeeId);

                  const previewLayerKey: BprCamada | null =
                    group.fundingSource === 'E' || group.fundingSource === 'T' || group.fundingSource === 'O'
                      ? group.fundingSource
                      : null;

                  return (
                    <div
                      key={group.id}
                      className={`bg-white rounded-2xl border p-4 sm:p-5 space-y-4 shadow-sm transition-all ${
                        group.enabled
                          ? activeEditingGroupId === group.id
                            ? 'border-teal-400 ring-2 ring-teal-500/20'
                            : 'border-teal-200'
                          : 'border-slate-200 opacity-80'
                      }`}
                    >
                      {/* Cabeçalho do Card de Grupo */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex-1 min-w-[200px] space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Nome do Grupo / Cenário Específico
                          </label>
                          <input
                            type="text"
                            value={group.name}
                            maxLength={80}
                            onChange={e => handleUpdateDedicatedGroup(group.id, { name: e.target.value })}
                            placeholder="Ex: Técnicos Operacional, Equipe Projeto X..."
                            className="w-full min-h-[40px] bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl px-3 py-1.5 text-sm font-black text-slate-900 outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-4">
                          <button
                            type="button"
                            onClick={() => handleUpdateDedicatedGroup(group.id, { enabled: !group.enabled })}
                            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                              group.enabled
                                ? 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {group.enabled ? '✓ Ativo' : 'Pausado'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDedicatedGroup(group.id)}
                            aria-label={`Excluir grupo ${group.name}`}
                            title="Excluir grupo"
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Critério / Justificativa */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Critério / Justificativa Executiva (exibida nos relatórios PDF)
                        </label>
                        <input
                          type="text"
                          value={group.criteriaDescription || ''}
                          maxLength={160}
                          onChange={e => handleUpdateDedicatedGroup(group.id, { criteriaDescription: e.target.value })}
                          placeholder="Ex: Destinação de R$ 5.000,00 da camada Operacional exclusivamente aos Técnicos conforme regras do BPR"
                          className="w-full min-h-[38px] bg-white border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 outline-none"
                        />
                      </div>

                      {/* Parâmetros Financeiros do Grupo */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            Montante do Grupo (R$)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                            <input
                              type="number"
                              min="0"
                              step="500"
                              disabled={group.distributionMode === 'amount'}
                              value={group.distributionMode === 'amount' ? totalMemberAmt : group.poolAmount}
                              onChange={e => {
                                const v = Math.max(0, parseFloat(e.target.value) || 0);
                                handleUpdateDedicatedGroup(group.id, { poolAmount: Number(v.toFixed(2)) });
                              }}
                              className={`w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border font-mono font-black text-sm outline-none ${
                                group.distributionMode === 'amount'
                                  ? 'bg-slate-50 border-slate-200 text-teal-800'
                                  : 'bg-white border-teal-300 text-teal-800 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15'
                              }`}
                            />
                          </div>
                          {group.distributionMode === 'amount' && (
                            <span className="text-[10px] text-teal-700 font-semibold block mt-0.5">
                              Soma automática dos valores por colaborador
                            </span>
                          )}
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            Critério de Rateio entre Membros
                          </label>
                          <select
                            value={group.distributionMode}
                            onChange={e =>
                              handleUpdateDedicatedGroup(group.id, {
                                distributionMode: e.target.value as BprDedicatedGroupDistributionMode,
                              })
                            }
                            className="w-full min-h-[42px] bg-white border border-slate-300 focus:border-teal-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                          >
                            <option value="equal">Igualitário entre selecionados</option>
                            <option value="percentage">Percentual (%) por colaborador</option>
                            <option value="amount">Valor Absoluto (R$) por colaborador</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            Origem do Recurso
                          </label>
                          <select
                            value={group.fundingSource}
                            onChange={e =>
                              handleUpdateDedicatedGroup(group.id, {
                                fundingSource: e.target.value as BprDedicatedGroupFundingSource,
                              })
                            }
                            className="w-full min-h-[42px] bg-white border border-slate-300 focus:border-teal-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                          >
                            <option value="total_pool">Abater do Bolo Geral (Proporcional E/T/O)</option>
                            <option value="extra_bonus">Acréscimo Extra ao Total (Não Abate)</option>
                            <option value="E">Abater da Camada Estratégico (E)</option>
                            <option value="T">Abater da Camada Tático (T)</option>
                            <option value="O">Abater da Camada Operacional/CLTs (O)</option>
                          </select>
                        </div>
                      </div>

                      {/* Bloco: Regras do Grupo (Elegibilidade & Fator de Desempenho + Redistribuição) */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 block">
                          Regras do Grupo (Elegibilidade &amp; Fator de Desempenho)
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Elegibilidade dentro do Grupo:
                            </label>
                            <select
                              value={effectiveEligibilityPolicy}
                              onChange={e =>
                                handleUpdateDedicatedGroup(group.id, {
                                  eligibilityPolicy: e.target.value as BprDedicatedGroupEligibilityPolicy,
                                })
                              }
                              className="w-full min-h-[40px] bg-white border border-slate-300 focus:border-teal-500 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
                            >
                              <option value="follow_bpr_rules">Seguir regras do BPR (apenas elegíveis dividem)</option>
                              <option value="include_all_as_exception">Incluir todos selecionados como exceção</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              Fator Meta 90%–99% (%), salvo ajuste individual:
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                disabled={!effectiveApplyPerf}
                                aria-label={`Percentual de fator reduzido do grupo ${group.name}`}
                                value={effectiveReducedFactor}
                                onChange={e => {
                                  const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                                  handleUpdateDedicatedGroup(group.id, { reducedFactorPct: Number(v.toFixed(1)) });
                                }}
                                className={`w-24 min-h-[40px] rounded-xl border px-3 py-1.5 text-right font-mono font-black text-xs outline-none ${
                                  effectiveApplyPerf
                                    ? 'bg-white border-teal-300 text-teal-900 focus:border-teal-500'
                                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                              />
                              <span className="text-xs font-black text-slate-500">%</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={effectiveApplyPerf}
                              onChange={e =>
                                handleUpdateDedicatedGroup(group.id, {
                                  applyPerformanceFactor: e.target.checked,
                                  reducedFactorPct: group.reducedFactorPct ?? 75,
                                  redistributePerformanceResidual: group.redistributePerformanceResidual ?? true,
                                })
                              }
                              className="w-4 h-4 rounded text-teal-600 border-slate-300 cursor-pointer"
                            />
                            <span>Aplicar fator de metas/desempenho do BPR</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={effectiveRedistribute}
                              onChange={e =>
                                handleUpdateDedicatedGroup(group.id, {
                                  redistributePerformanceResidual: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded text-teal-600 border-slate-300 cursor-pointer"
                            />
                            <span>Redistribuir saldo retido pelo fator entre os demais membros elegíveis</span>
                          </label>
                        </div>
                      </div>

                      {/* Quadro Executivo: Impacto Antes x Depois */}
                      {impactPreview && (
                        <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 sm:p-4 space-y-2.5">
                          <span className="text-[11px] font-black uppercase tracking-wider text-sky-900 block">
                            Prévia de Impacto Executivo (Antes × Depois deste Grupo)
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="bg-white border border-sky-200 rounded-xl p-3 space-y-1">
                              <span className="text-[10px] font-black uppercase text-slate-400 block">
                                {previewLayerKey
                                  ? `Camada de Origem: ${previewLayerKey === 'E' ? 'Estratégico (E)' : previewLayerKey === 'T' ? 'Tático (T)' : 'Operacional (O)'}`
                                  : group.fundingSource === 'extra_bonus'
                                    ? 'Impacto no Montante Total (Acréscimo Extra)'
                                    : 'Impacto no Bolo Geral (E + T + O)'}
                              </span>
                              {previewLayerKey ? (
                                <div className="font-mono space-y-0.5">
                                  <div className="text-slate-600">
                                    <span className="font-sans font-semibold">Antes:</span>{' '}
                                    <strong>{formatCurrency(impactPreview.beforeLayers[previewLayerKey].totalLayerAmount)}</strong> ÷{' '}
                                    {impactPreview.beforeLayers[previewLayerKey].eligibleCount}p ={' '}
                                    <strong>{formatCurrency(impactPreview.beforeLayers[previewLayerKey].amountPerEligible)}</strong>/p
                                  </div>
                                  <div className="text-sky-900">
                                    <span className="font-sans font-semibold">Depois:</span>{' '}
                                    <strong>{formatCurrency(impactPreview.afterLayers[previewLayerKey].totalLayerAmount)}</strong> ÷{' '}
                                    {impactPreview.afterLayers[previewLayerKey].eligibleCount}p ={' '}
                                    <strong className="text-emerald-700">{formatCurrency(impactPreview.afterLayers[previewLayerKey].amountPerEligible)}</strong>/p
                                  </div>
                                </div>
                              ) : (
                                <div className="font-mono space-y-0.5">
                                  <div className="text-slate-600">
                                    <span className="font-sans font-semibold">Antes:</span>{' '}
                                    <strong>{formatCurrency(impactPreview.baseTotalPool)}</strong>
                                  </div>
                                  <div className="text-sky-900">
                                    <span className="font-sans font-semibold">Depois:</span>{' '}
                                    <strong>{formatCurrency(impactPreview.afterTotalPool)}</strong>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="bg-white border border-teal-200 rounded-xl p-3 space-y-1">
                              <span className="text-[10px] font-black uppercase text-teal-700 block">
                                Resultado deste Grupo ({group.name || 'Grupo'})
                              </span>
                              {impactPreview.groupSummary ? (
                                <div className="font-mono space-y-0.5">
                                  <div className="text-slate-700">
                                    <span className="font-sans font-semibold">Montante:</span>{' '}
                                    <strong className="text-teal-900">{formatCurrency(impactPreview.groupSummary.poolAmount)}</strong> ·{' '}
                                    <span className="font-sans">
                                      {impactPreview.groupSummary.eligibleMemberCount ?? impactPreview.groupSummary.memberCount} eleg.
                                      {(impactPreview.groupSummary.ineligibleMemberCount || 0) > 0
                                        ? ` (+${impactPreview.groupSummary.ineligibleMemberCount} inel.)`
                                        : ''}
                                    </span>
                                  </div>
                                  <div className="text-emerald-700 font-bold">
                                    <span className="font-sans font-semibold text-slate-600">Alocado:</span>{' '}
                                    {formatCurrency(impactPreview.groupSummary.allocatedTotal)}
                                    {(impactPreview.groupSummary.eligibleMemberCount ?? impactPreview.groupSummary.memberCount) > 0 && (
                                      <span className="text-slate-500 font-normal">
                                        {' '}(méd. {formatCurrency(impactPreview.groupSummary.amountPerEligible || 0)}/p)
                                      </span>
                                    )}
                                  </div>
                                  {(impactPreview.groupSummary.redistributedAmount || 0) > 0 && (
                                    <div className="text-[11px] text-teal-800 font-sans font-semibold">
                                      Redistribuído por fator: {formatCurrency(impactPreview.groupSummary.redistributedAmount || 0)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic block">
                                  Selecione ao menos 1 colaborador para calcular o impacto.
                                </span>
                              )}
                            </div>
                          </div>

                          {impactPreview.hasFundingOverflow && (
                            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2">
                              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                              <span>
                                Atenção: o montante do grupo excede o saldo disponível da camada em {formatCurrency(impactPreview.overflowAmount)}; o excedente será abatido proporcionalmente das demais camadas.
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Membros Selecionados & Critérios Individuais */}
                      <div className="bg-teal-50/50 border border-teal-200/80 rounded-xl p-3 sm:p-4 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-black text-teal-900 uppercase tracking-wider">
                            Membros Selecionados ({group.members.length})
                          </span>

                          <div className="flex flex-wrap items-center gap-2">
                            {group.distributionMode === 'percentage' && group.members.length > 0 && (
                              <>
                                <span
                                  className={`text-[11px] font-black font-mono px-2 py-0.5 rounded-full border ${
                                    Math.abs(totalPct - 100) <= 0.05
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-300'
                                  }`}
                                >
                                  Soma: {formatPctPtBr(totalPct)} {Math.abs(totalPct - 100) <= 0.05 ? '✓' : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDistributeDedicatedGroupEquallyPct(group.id)}
                                  className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white hover:bg-teal-50 text-teal-800 border border-teal-300 text-[11px] font-black cursor-pointer"
                                >
                                  Dividir Igual (%)
                                </button>
                              </>
                            )}
                            {groupSummary && (
                              <span className="text-xs font-black font-mono text-teal-900 bg-white border border-teal-200 px-2.5 py-0.5 rounded-full">
                                Alocado: {formatCurrency(groupSummary.allocatedTotal)}
                              </span>
                            )}
                          </div>
                        </div>

                        {group.members.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">
                            Selecione colaboradores na lista abaixo (ou diretamente na grade principal) para incluí-los neste grupo.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {group.members.map(m => {
                              const cand = candidateMap.get(m.employeeId);
                              const labelName = cand
                                ? (cand.corporateName || cand.name)
                                : m.employeeId;
                              const isActiveCalculated = Boolean(config.allowDedicatedGroups && group.enabled && cand && cand.dedicatedGroupId === group.id);
                              const isIneligibleInGroup = isActiveCalculated
                                ? !cand?.isEligible
                                : Boolean(cand && effectiveEligibilityPolicy === 'follow_bpr_rules' && !cand.isEligible);
                              const isExceptionApplied = Boolean(cand && cand.ineligibilityReasons.length > 0 && !isIneligibleInGroup);

                              const fallbackRawShare =
                                group.distributionMode === 'equal'
                                  ? (group.members.length > 0 ? Number((group.poolAmount / group.members.length).toFixed(2)) : 0)
                                  : group.distributionMode === 'percentage'
                                    ? Number(((group.poolAmount * Math.max(0, Number(m.percentage || 0))) / 100).toFixed(2))
                                    : Math.max(0, Number(m.amount || 0));
                              const fallbackPct =
                                group.distributionMode === 'equal'
                                  ? (group.members.length > 0 ? Number((100 / group.members.length).toFixed(1)) : 0)
                                  : group.distributionMode === 'percentage'
                                    ? Number(m.percentage || 0)
                                    : (totalMemberAmt > 0 ? Number(((fallbackRawShare / totalMemberAmt) * 100).toFixed(1)) : 0);

                              const liveShare = isActiveCalculated
                                ? (cand?.isEligible ? (cand.rateioAmount ?? cand.allocatedAmount ?? 0) : 0)
                                : (isIneligibleInGroup ? 0 : fallbackRawShare);
                              const livePct = isActiveCalculated
                                ? (cand?.dedicatedGroupSharePct || 0)
                                : (isIneligibleInGroup ? 0 : fallbackPct);

                              const defaultCycleFactorPlaceholder = !effectiveApplyPerf
                                ? '100'
                                : (cand?.performanceFactor ?? 1.0) >= 1.0
                                  ? '100'
                                  : (cand?.performanceFactor ?? 1.0) > 0
                                    ? String(effectiveReducedFactor)
                                    : '0';

                              return (
                                <div
                                  key={m.employeeId}
                                  className={`bg-white border rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 ${
                                    isIneligibleInGroup ? 'border-rose-200 bg-rose-50/40' : 'border-teal-200/80'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <strong className="text-xs sm:text-sm font-black text-slate-900 truncate">
                                        {labelName}
                                      </strong>
                                      {cand && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                          {cand.camada} · {cand.company}
                                        </span>
                                      )}
                                      {isIneligibleInGroup ? (
                                        <span
                                          className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
                                          title={cand?.ineligibilityReasons.join(', ')}
                                        >
                                          Inelegível pela regra BPR (R$ 0,00)
                                        </span>
                                      ) : isExceptionApplied && (
                                        <span
                                          className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                                          title={cand?.ineligibilityReasons.join(', ')}
                                        >
                                          Exceção incluída
                                        </span>
                                      )}
                                    </div>
                                    {cand && (
                                      <span className="text-[11px] text-slate-400 block truncate">
                                        {cand.jobRole} · {cand.department}
                                        {isActiveCalculated && (cand.dedicatedGroupRedistributedBonus || 0) > 0 && (
                                          <span className="text-emerald-700 font-bold ml-1.5">
                                            · +{formatCurrency(cand.dedicatedGroupRedistributedBonus || 0)} redistribuído
                                          </span>
                                        )}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    {group.distributionMode === 'percentage' && (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="1"
                                          aria-label={`Percentual para ${labelName}`}
                                          value={m.percentage || ''}
                                          placeholder="0"
                                          onChange={e =>
                                            handleUpdateDedicatedMemberValue(group.id, m.employeeId, 'percentage', e.target.value)
                                          }
                                          className="w-20 min-h-[38px] bg-slate-50 border border-teal-300 rounded-lg px-2 py-1 text-right font-mono font-black text-xs text-teal-900 outline-none focus:bg-white focus:border-teal-500"
                                        />
                                        <span className="text-xs font-black text-slate-500">%</span>
                                      </div>
                                    )}

                                    {group.distributionMode === 'amount' && (
                                      <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">R$</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="100"
                                          aria-label={`Valor em reais para ${labelName}`}
                                          value={m.amount || ''}
                                          placeholder="0,00"
                                          onChange={e =>
                                            handleUpdateDedicatedMemberValue(group.id, m.employeeId, 'amount', e.target.value)
                                          }
                                          className="w-28 min-h-[38px] pl-7 pr-2 py-1 bg-slate-50 border border-teal-300 rounded-lg text-right font-mono font-black text-xs text-teal-900 outline-none focus:bg-white focus:border-teal-500"
                                        />
                                      </div>
                                    )}

                                    {/* Campo editável de Fator % do colaborador dentro do grupo */}
                                    <div className="flex items-center gap-1" title="Fator de desempenho (%) aplicado à cota deste colaborador (deixe vazio para usar o padrão do ciclo)">
                                      <span className="text-[10px] font-bold text-slate-500 uppercase">Fator:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="5"
                                        disabled={isIneligibleInGroup}
                                        aria-label={`Fator percentual para ${labelName}`}
                                        value={m.customFactorPct !== undefined ? m.customFactorPct : ''}
                                        placeholder={isIneligibleInGroup ? '0' : defaultCycleFactorPlaceholder}
                                        onChange={e =>
                                          handleUpdateDedicatedMemberFactor(group.id, m.employeeId, e.target.value)
                                        }
                                        className={`w-16 min-h-[38px] rounded-lg border px-1.5 py-1 text-right font-mono font-black text-xs outline-none ${
                                          isIneligibleInGroup
                                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                            : m.customFactorPct !== undefined
                                              ? 'bg-amber-50 border-amber-300 text-amber-900 focus:border-amber-500'
                                              : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-teal-500'
                                        }`}
                                      />
                                      <span className="text-[11px] font-black text-slate-500">%</span>
                                    </div>

                                    <div className="text-right font-mono min-w-[92px]">
                                      <strong className={`text-xs font-black block ${
                                        isIneligibleInGroup ? 'text-rose-500' : 'text-emerald-700'
                                      }`}>
                                        {formatCurrency(liveShare)}
                                      </strong>
                                      <span className="text-[10px] font-bold text-slate-400 block">
                                        {formatPctPtBr(livePct)}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleDedicatedGroupMember(group.id, m.employeeId)}
                                      aria-label={`Remover ${labelName} do grupo`}
                                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    >
                                      <X size={15} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Seletor de Colaboradores para o Grupo com Seleção em Lote */}
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="relative sm:col-span-6">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={e =>
                                setDedicatedMemberSearchByGroup(prev => ({ ...prev, [group.id]: e.target.value }))
                              }
                              placeholder="Buscar por nome, razão social, cargo ou empresa..."
                              className="w-full min-h-[40px] bg-white border border-slate-200 focus:border-teal-500 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-800 outline-none"
                            />
                            {searchTerm && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDedicatedMemberSearchByGroup(prev => ({ ...prev, [group.id]: '' }))
                                }
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          <div className="sm:col-span-3">
                            <select
                              aria-label={`Filtrar cargo para adicionar ao grupo ${group.name}`}
                              value={roleFilter}
                              onChange={e =>
                                setDedicatedRoleFilterByGroup(prev => ({ ...prev, [group.id]: e.target.value }))
                              }
                              className="w-full min-h-[40px] bg-white border border-slate-200 focus:border-teal-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                            >
                              <option value="">Todos os Cargos</option>
                              {availableJobRoles.map(r => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-3">
                            <select
                              aria-label={`Filtrar camada para adicionar ao grupo ${group.name}`}
                              value={camadaPickFilter}
                              onChange={e =>
                                setDedicatedCamadaFilterByGroup(prev => ({ ...prev, [group.id]: e.target.value }))
                              }
                              className="w-full min-h-[40px] bg-white border border-slate-200 focus:border-teal-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                            >
                              <option value="">Todas as Camadas</option>
                              <option value="O">Operacional/CLTs (O)</option>
                              <option value="T">Tático (T)</option>
                              <option value="E">Estratégico (E)</option>
                            </select>
                          </div>
                        </div>

                        {/* Atalhos de Seleção em Lote */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-[11px] font-bold text-slate-500">
                            {filteredCandidatesForGroup.length} colaborador(es) exibido(s) no filtro
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={batchAddableIds.length === 0}
                              onClick={() => handleBatchSelectDedicatedMembers(group.id, batchAddableIds, 'add')}
                              className="min-h-[34px] px-3 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 disabled:opacity-40 text-teal-800 border border-teal-300 text-[11px] font-black cursor-pointer"
                            >
                              Marcar filtrados ({batchAddableIds.length})
                            </button>
                            {batchRemovableIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleBatchSelectDedicatedMembers(group.id, batchRemovableIds, 'remove')}
                                className="min-h-[34px] px-3 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-[11px] font-bold cursor-pointer"
                              >
                                Desmarcar filtrados ({batchRemovableIds.length})
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
                          {filteredCandidatesForGroup.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                              Nenhum colaborador encontrado para essa busca.
                            </div>
                          ) : (
                            filteredCandidatesForGroup.map(c => {
                              const isSelected = memberIdsSet.has(c.employeeId);
                              const otherGroupName = claimedByOtherGroup.get(c.employeeId);
                              const isManExcl = (config.manuallyExcludedEmployeeIds || []).includes(c.employeeId);
                              const isDisabled = Boolean(otherGroupName || isManExcl);
                              const isExceptionCandidate = c.ineligibilityReasons.length > 0 && !isManExcl;
                              const label = c.corporateName || c.name;

                              return (
                                <label
                                  key={c.employeeId}
                                  className={`flex items-center justify-between gap-2 px-3 py-2.5 text-xs transition-colors ${
                                    isDisabled
                                      ? 'opacity-50 cursor-not-allowed bg-slate-50'
                                      : isSelected
                                        ? 'bg-teal-50/70 cursor-pointer'
                                        : 'hover:bg-slate-50 cursor-pointer'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      disabled={isDisabled}
                                      checked={isSelected}
                                      onChange={() => handleToggleDedicatedGroupMember(group.id, c.employeeId)}
                                      className="w-4 h-4 rounded text-teal-600 border-slate-300 shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <strong className="text-slate-900 font-bold block truncate">{label}</strong>
                                      <span className="text-[11px] text-slate-400 block truncate">
                                        {c.jobRole} · {c.company} · Camada {c.camada}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {otherGroupName ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                        Em: {otherGroupName}
                                      </span>
                                    ) : isManExcl ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                                        Excluído
                                      </span>
                                    ) : isExceptionCandidate ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                        {effectiveEligibilityPolicy === 'follow_bpr_rules' ? 'Inelegível BPR' : 'Exceção permitida'}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Elegível
                                      </span>
                                    )}
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs font-mono space-y-0.5">
                <span className="font-sans text-[11px] font-bold text-slate-500 block">
                  {summary.dedicatedGroupsCount || 0} grupo(s) ativo(s) · {summary.dedicatedMembersCount || 0} colaborador(es) elegível(is)
                </span>
                <strong className="text-sm font-black text-teal-800 block">
                  Total Alocado nos Grupos: {formatCurrency(summary.dedicatedGroupsAllocatedTotal || 0)}
                </strong>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDedicatedGroupsModalOpen(false)}
                  className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                >
                  Aplicar no Simulador
                </button>
                <button
                  type="button"
                  onClick={handleApplyGroupsAndSaveScenario}
                  className="min-h-[44px] px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <Save size={15} />
                  <span>Aplicar e Salvar Novo Cenário</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
