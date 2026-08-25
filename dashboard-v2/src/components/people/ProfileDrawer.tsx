"use client";

import { useState, useEffect } from "react";
import { X, UserRound, MapPin, GraduationCap, Loader2, Save, Upload, PenBox, CheckCircle2, Files, FileText, Trash2, ExternalLink, Briefcase, Coins, AlertCircle, Phone, Home, Building2, Search, Plus, Copy, Database, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Network, Edit3, Filter, Download, BarChart3, Link as LinkIcon, KeyRound, ShieldAlert, CheckSquare, Square, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, CartesianGrid } from 'recharts';
import { Employee, EmploymentContract, MonthlyCost, getRemunerationLabel, AuditIssue, RelationshipNature, EmployeeSystemAccess, SystemItem, inferEntityType } from "@/types/loans";
import { PeopleService } from "@/services/people.service";
import { PeopleHRService } from "@/services/people-hr.service";
import { EmploymentBondTimeline } from "./EmploymentBondTimeline";
import { LoansService, formatCurrency } from "@/services/loans.service";
import { useDataMode } from "@/contexts/DataModeContext";
import { isExternalEntity, formatCompanyTime, RELATIONSHIP_NATURE_LABELS } from "./PeopleBadges";
import { ProfileExportModal } from "./ProfileExportModal";
import { ClearCostHistoryModal } from "./ClearCostHistoryModal";
import { SystemsCatalogService } from "@/services/systems-catalog.service";
import { OffboardingChecklistModal } from "./OffboardingChecklistModal";
import { SystemAppIcon } from "./SystemAppIcon";
import { GRUPO_EMPRESAS } from "@/types/loans";

interface HistoryItem {
  id: string;
  employee_id?: string;
  event_type: string;
  change_date: string;
  previous_value?: string;
  new_value?: string;
  observations?: string;
  created_at?: string;
}

const MERGE_FIELDS = [
  { key: 'name', label: 'Nome Completo' },
  { key: 'document_id', label: 'CPF' },
  { key: 'document_rg', label: 'RG' },
  { key: 'corporate_name', label: 'Razão Social' },
  { key: 'pj_type', label: 'CNPJ' },
  { key: 'linkType', label: 'Vínculo' },
  { key: 'company', label: 'Empresa' },
  { key: 'remuneration_fixed', label: 'Salário / Valor Fixo', isCurrency: true },
  { key: 'remuneration_bonus', label: 'Bônus', isCurrency: true },
  { key: 'remuneration_connectivity', label: 'Conectividade', isCurrency: true },
  { key: 'remuneration_incentives', label: 'Incentivos', isCurrency: true },
  { key: 'email', label: 'E-mail Pessoal' },
  { key: 'phone', label: 'Telefone Pessoal' },
  { key: 'email_professional', label: 'E-mail Profissional' },
  { key: 'phone_professional', label: 'Telefone Profissional' },
  { key: 'zip_code', label: 'CEP Residencial' },
  { key: 'street', label: 'Logradouro' },
  { key: 'number', label: 'Número' },
  { key: 'neighborhood', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'UF' },
  { key: 'status', label: 'Status Cadastral' },
  { key: 'resignation_date', label: 'Data de Encerramento / Distrato', isDate: true },
  { key: 'status_end_date', label: 'Fim de Status', isDate: true },
  { key: 'start_date', label: 'Data de Admissão', isDate: true },
  { key: 'contract_expiry_date', label: 'Vencimento Contrato', isDate: true },
  { key: 'job_role', label: 'Cargo / Função' },
  { key: 'department', label: 'Setor / Departamento' },
  { key: 'department_start_date', label: 'Início no Setor/Função', isDate: true },
  { key: 'responsible_name', label: 'Nome do Responsável' },
  { key: 'responsible_cpf', label: 'CPF do Responsável' },
  { key: 'degree', label: 'Grau de Instrução' },
];

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId?: string; // Se undef, é modo Criação
  onDataChanged?: (id?: string) => void;
  isTestMode?: boolean;
  setores?: string[];
  initialTab?: 'pessoal' | 'endereco' | 'complementar' | 'fichaExecutiva' | 'trajetoria' | 'custo' | 'auditoria' | 'acessos' | 'bpr';
}

export function ProfileDrawer({ isOpen, onClose, employeeId, onDataChanged, isTestMode: propIsTestMode, setores = [], initialTab = 'pessoal' }: ProfileDrawerProps) {
  const { isTestMode: contextIsTestMode } = useDataMode();
  const isTestMode = propIsTestMode ?? contextIsTestMode;
  
  const [profile, setProfile] = useState<Partial<Employee>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Abas: 'pessoal', 'endereco', 'complementar', 'fichaExecutiva', 'trajetoria', 'custo', 'auditoria', 'acessos', 'bpr'
  const [activeTab, setActiveTab] = useState<'pessoal' | 'endereco' | 'complementar' | 'fichaExecutiva' | 'trajetoria' | 'custo' | 'auditoria' | 'acessos' | 'bpr'>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab, employeeId]);
  const [isOffboardingOpen, setIsOffboardingOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [bonds, setBonds] = useState<EmploymentContract[]>([]);
  const [costs, setCosts] = useState<MonthlyCost[]>([]);
  const [auditIssues, setAuditIssues] = useState<AuditIssue[]>([]);
  const [loanSummary, setLoanSummary] = useState<{ totalTaken: number; totalReceived: number; balance: number } | null>(null);
  const [bprYear, setBprYear] = useState<number>(new Date().getFullYear());

  // Auditoria quick cost editor state
  const [editingCost, setEditingCost] = useState<MonthlyCost | null>(null);
  const [editingCostCompetencia, setEditingCostCompetencia] = useState('');
  const [editingCostType, setEditingCostType] = useState<'CLT' | 'MEI'>('CLT');
  const [editingCostFixo, setEditingCostFixo] = useState(0);
  const [editingCostBonus, setEditingCostBonus] = useState(0);
  const [editingCostComissao, setEditingCostComissao] = useState(0);
  const [editingCostIncentivos, setEditingCostIncentivos] = useState(0);
  const [editingCostConectividade, setEditingCostConectividade] = useState(0);
  const [editingCostGlosaBase, setEditingCostGlosaBase] = useState(0);
  const [editingCostGlosaBonus, setEditingCostGlosaBonus] = useState(0);
  const [editingCostDeducoes, setEditingCostDeducoes] = useState(0);
  const [editingCostHolerite, setEditingCostHolerite] = useState(0);
  const [editingCostAdiantamento, setEditingCostAdiantamento] = useState(0);
  const [editingCostHoraExtra, setEditingCostHoraExtra] = useState(0);
  const [editingCostAdicionalNot, setEditingCostAdicionalNot] = useState(0);
  const [editingCostVR, setEditingCostVR] = useState(0);
  const [editingCostVT, setEditingCostVT] = useState(0);
  const [editingCostCesta, setEditingCostCesta] = useState(0);
  const [editingCostFerias, setEditingCostFerias] = useState(0);
  const [editingCostRescisao, setEditingCostRescisao] = useState(0);
  const [editingCostDecimoTerceiro, setEditingCostDecimoTerceiro] = useState(0);
  const [editingCostDescontos, setEditingCostDescontos] = useState(0);
  const [editingCostFaltas, setEditingCostFaltas] = useState(0);
  const [editingCostDiasFaltas, setEditingCostDiasFaltas] = useState(0);
  const [editingCostConsignado, setEditingCostConsignado] = useState(0);
  const [editingCostBancoHoras, setEditingCostBancoHoras] = useState(0);
  const [editingCostObservacao, setEditingCostObservacao] = useState('');
  const [isParsingPayroll, setIsParsingPayroll] = useState(false);
  const [saveCostError, setSaveCostError] = useState<string | null>(null);

  // Estados para verbas adicionais extra-folha customizadas
  const [verbaDetailModal, setVerbaDetailModal] = useState<{
    title: string;
    items: { label: string; total: number; average: number }[];
    total: number;
    average: number;
  } | null>(null);
  const [editingCostVerbasAdicionais, setEditingCostVerbasAdicionais] = useState<{ name: string; value: number }[]>([]);
  const [newVerbaName, setNewVerbaName] = useState('');
  const [newVerbaValue, setNewVerbaValue] = useState(0);

  // Estados dos filtros de período e data
  const [costPeriodFilter, setCostPeriodFilter] = useState<'all' | '3m' | '6m' | '12m' | 'custom'>('all');
  const [costSelectedYears, setCostSelectedYears] = useState<string[]>([]);
  const [costSelectedMonths, setCostSelectedMonths] = useState<string[]>([]);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [isSearchingCEP, setIsSearchingCEP] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [isSearchingCNPJCEP, setIsSearchingCNPJCEP] = useState(false);
  const [cnpjCepError, setCnpjCepError] = useState<string | null>(null);
  const [isParsingContract, setIsParsingContract] = useState(false);
  const [serviceLocations, setServiceLocations] = useState<string[]>([]);

  // Estados para busca de colaboradores cadastrados
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSearchExistingOpen, setIsSearchExistingOpen] = useState(false);
  const [isDiannaImportOpen, setIsDiannaImportOpen] = useState(false);
  const [diannaResults, setDiannaResults] = useState<any[]>([]);
  const [selectedDiannaRows, setSelectedDiannaRows] = useState<number[]>([]);
  const [isImportingDianna, setIsImportingDianna] = useState(false);
  const [diannaSearchFilter, setDiannaSearchFilter] = useState('');
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingExisting, setIsSearchingExisting] = useState(false);
  const [newRelEmployeeId, setNewRelEmployeeId] = useState("");
  const [newRelType, setNewRelType] = useState<"equivalent" | "orientadora" | "apoiada">("equivalent");

  // Estados para mesclagem de dados (PDF vs Banco)
  const [pendingMerge, setPendingMerge] = useState<{
    existingProfile: Partial<Employee>;
    incomingData: Partial<Employee>;
    existingHistory: HistoryItem[];
    existingBonds: EmploymentContract[];
    existingCosts: MonthlyCost[];
    fileLink?: string;
    contractDate?: string;
  } | null>(null);
  const [selectedMergeFields, setSelectedMergeFields] = useState<Record<string, 'existing' | 'incoming'>>({});
  const [pendingHistoryItems, setPendingHistoryItems] = useState<any[]>([]);

  // Vínculos & Histórico CRUD
  const [editingBond, setEditingBond] = useState<Partial<EmploymentContract> | null>(null);
  const [isSavingBond, setIsSavingBond] = useState(false);
  const [editingHistoryItem, setEditingHistoryItem] = useState<Partial<HistoryItem> | null>(null);
  const [isSavingHistoryItem, setIsSavingHistoryItem] = useState(false);

  const handleSaveBond = async (bondData: Partial<EmploymentContract>) => {
    if (!profile.id) {
      alert("Salve a ficha cadastral do colaborador antes de gerenciar vínculos.");
      return;
    }
    setIsSavingBond(true);
    try {
      if (bondData.id) {
        await PeopleHRService.updateEmploymentContract(bondData.id, bondData);
      } else {
        await PeopleHRService.insertEmploymentContract({
          ...bondData,
          employee_id: profile.id
        });
      }
      const updatedBonds = await PeopleHRService.getEmploymentContracts(profile.id);
      setBonds(updatedBonds || []);
      setEditingBond(null);
    } catch (err: any) {
      alert("Erro ao salvar vínculo: " + err.message);
    } finally {
      setIsSavingBond(false);
    }
  };

  const handleDeleteBond = async (bondId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta transição de vínculo? Isso poderá alterar a linha do tempo do colaborador.")) return;
    try {
      await PeopleHRService.deleteEmploymentContract(bondId);
      if (profile.id) {
        const updatedBonds = await PeopleHRService.getEmploymentContracts(profile.id);
        setBonds(updatedBonds || []);
      }
    } catch (err: any) {
      alert("Erro ao excluir vínculo: " + err.message);
    }
  };

  const handleSaveHistoryItem = async (histData: Partial<HistoryItem>) => {
    if (!profile.id) {
      alert("Salve a ficha cadastral do colaborador antes de gerenciar o histórico.");
      return;
    }
    setIsSavingHistoryItem(true);
    try {
      if (histData.id) {
        await PeopleService.updateHistoryItem(histData.id, histData, isTestMode);
      } else {
        await PeopleService.insertHistoryItem({
          employee_id: profile.id,
          event_type: histData.event_type || 'Outro',
          change_date: histData.change_date || new Date().toISOString().split('T')[0],
          observations: histData.observations
        }, isTestMode);
      }
      const updatedHistory = await PeopleService.getEmployeeHistory(profile.id, isTestMode);
      setHistory(updatedHistory || []);
      setEditingHistoryItem(null);
    } catch (err: any) {
      alert("Erro ao salvar item do histórico: " + err.message);
    } finally {
      setIsSavingHistoryItem(false);
    }
  };

  const handleDeleteHistoryItem = async (histId: string) => {
    if (!confirm("Tem certeza que deseja excluir este evento do histórico?")) return;
    try {
      await PeopleService.deleteHistoryItem(histId, isTestMode);
      if (profile.id) {
        const updatedHistory = await PeopleService.getEmployeeHistory(profile.id, isTestMode);
        setHistory(updatedHistory || []);
      }
    } catch (err: any) {
      alert("Erro ao excluir item do histórico: " + err.message);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (employeeId) {
        setIsEditMode(false);
        fetchProfile(employeeId);
      } else {
        // Modo criação
        setProfile({
          company: 'MarBR',
          linkType: 'CLT',
          status: 'Ativo',
          remuneration: 0
        });
        setBonds([]);
        setCosts([]);
        setIsEditMode(true);
      }

      // Abre na tab correta se especificado na URL ou prop initialTab
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
          setActiveTab(tab as any);
        } else if (initialTab) {
          setActiveTab(initialTab);
        } else {
          setActiveTab('pessoal');
        }
      } else if (initialTab) {
        setActiveTab(initialTab);
      } else {
        setActiveTab('pessoal');
      }
    } else {
      // Limpar estado qnd fecha
      setProfile({});
      setError(null);
    }
  }, [isOpen, employeeId, isTestMode, initialTab]);

  // Fetch distinct service locations for autocomplete
  useEffect(() => {
    if (isOpen) {
      PeopleService.getDistinctValues('service_location', isTestMode).then(setServiceLocations).catch(() => {});
    }
  }, [isOpen, isTestMode]);

  useEffect(() => {
    if (isOpen) {
      setIsSearchingExisting(true);
      PeopleHRService.getEmployeesForPeople({ mostrarInativos: true, isTestMode })
        .then(setAllEmployees)
        .catch(err => console.error("Erro ao buscar colaboradores", err))
        .finally(() => setIsSearchingExisting(false));
      SystemsCatalogService.fetchSystemsAsync().catch(() => {});
    }
  }, [isOpen, isTestMode]);

  const handleLoadExistingEmployee = async (id: string) => {
    setIsLoading(true);
    try {
      const [data, hist, bondsData, costsData] = await Promise.all([
        PeopleService.getEmployeeProfile(id, isTestMode),
        PeopleService.getEmployeeHistory(id, isTestMode),
        PeopleHRService.getEmploymentContracts(id),
        PeopleHRService.getMonthlyCosts(id)
      ]);
      if (!data) throw new Error("Colaborador não encontrado");

      // Se for um novo cadastro e já houver dados preenchidos (ex: PDF importado), abre a mesclagem
      if (!profile.id && (profile.name || profile.document_id || profile.corporate_name)) {
        initializeMerge(data, profile as Employee, hist || [], bondsData || [], costsData || [], undefined);
        setIsSearchExistingOpen(false);
        return;
      }

      setProfile(data);
      setHistory(hist || []);
      setBonds(bondsData || []);
      setCosts(costsData || []);

      try {
        const loansEmps = await LoansService.getEmployees({ showAll: true }, isTestMode);
        const empLoan = loansEmps.find(e => e.id === id);
        if (empLoan) {
          setLoanSummary({
            totalTaken: empLoan.totalTaken || 0,
            totalReceived: empLoan.totalReceived || 0,
            balance: empLoan.balance || 0
          });
        } else {
          setLoanSummary(null);
        }
      } catch {
        setLoanSummary(null);
      }

      setIsEditMode(true);
      setIsSearchExistingOpen(false);
    } catch (err: any) {
      alert(err.message || "Erro ao carregar colaborador");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEmployees = allEmployees.filter(emp => {
    const term = searchQuery.toLowerCase();
    const nameMatch = emp.name?.toLowerCase().includes(term);
    const roleMatch = emp.job_role?.toLowerCase().includes(term);
    const cpfMatch = emp.document_id?.replace(/\D/g, '').includes(term);
    const cnpjMatch = emp.pj_type?.replace(/\D/g, '').includes(term);
    return nameMatch || roleMatch || cpfMatch || cnpjMatch;
  });

  const [previousEmployeeProfile, setPreviousEmployeeProfile] = useState<Partial<Employee> | null>(null);

  const fetchProfile = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, hist, bondsData, costsData] = await Promise.all([
        PeopleService.getEmployeeProfile(id, isTestMode),
        PeopleService.getEmployeeHistory(id, isTestMode),
        PeopleHRService.getEmploymentContracts(id),
        PeopleHRService.getMonthlyCosts(id)
      ]);
      setProfile(data || {});
      setHistory(hist || []);
      setBonds(bondsData || []);

      let mergedCosts = costsData || [];
      setPreviousEmployeeProfile(null);

      if (data?.linked_previous_employee_id) {
        try {
          const [prevProfile, prevCosts] = await Promise.all([
            PeopleService.getEmployeeProfile(data.linked_previous_employee_id, isTestMode),
            PeopleHRService.getMonthlyCosts(data.linked_previous_employee_id)
          ]);
          if (prevProfile) setPreviousEmployeeProfile(prevProfile);
          if (prevCosts && prevCosts.length > 0 && data.is_unified_history !== false) {
            const currentComps = new Set((costsData || []).map(c => c.competencia));
            const filteredPrev = prevCosts.filter(c => !currentComps.has(c.competencia));
            mergedCosts = [...filteredPrev, ...(costsData || [])];
          }
        } catch (linkErr) {
          console.warn("Erro ao buscar dados do vinculo CLT/anterior:", linkErr);
        }
      }

      setCosts(mergedCosts);

      // Buscar posição de empréstimos corporativos
      try {
        const loansEmps = await LoansService.getEmployees({ showAll: true }, isTestMode);
        const empLoan = loansEmps.find(e => e.id === id);
        if (empLoan) {
          setLoanSummary({
            totalTaken: empLoan.totalTaken || 0,
            totalReceived: empLoan.totalReceived || 0,
            balance: empLoan.balance || 0
          });
        } else {
          setLoanSummary(null);
        }
      } catch {
        setLoanSummary(null);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Erro ao carregar Ficha RH');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      if (!profile.name || !profile.company) {
        throw new Error('Nome e Empresa são obrigatórios.');
      }

      // Validação de similaridade do local de prestação de serviços (Bug 1)
      let currentServiceLocation = profile.service_location;
      if (currentServiceLocation && currentServiceLocation.trim() !== '') {
        const cleanString = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
        const cleanLoc = cleanString(currentServiceLocation);
        
        const similar = serviceLocations.find(loc => {
          const cleanExisting = cleanString(loc);
          return cleanExisting === cleanLoc && loc !== currentServiceLocation;
        });

        if (similar) {
          const confirmMsg = `O local de prestação '${currentServiceLocation}' é muito similar a '${similar}', que já existe no sistema.\n\nDeseja utilizar '${similar}' para manter a padronização dos dados?`;
          if (confirm(confirmMsg)) {
            currentServiceLocation = similar;
            profile.service_location = similar;
          }
        }
      }

      // Validação de e-mails com regex simples
      if (profile.email && !validateEmail(profile.email)) {
        throw new Error('E-mail pessoal inválido.');
      }
      if (profile.email_professional && !validateEmail(profile.email_professional)) {
        throw new Error('E-mail profissional inválido.');
      }

      // Validação de telefones (com DDD)
      if (profile.phone) {
        const cleanPhone = profile.phone.replace(/\D/g, '');
        if (cleanPhone.length < 10 || cleanPhone.length > 11) {
          throw new Error('Telefone pessoal deve conter exatamente 10 ou 11 dígitos (com DDD).');
        }
      }
      if (profile.phone_professional) {
        const cleanPhone = profile.phone_professional.replace(/\D/g, '');
        if (cleanPhone.length < 10 || cleanPhone.length > 11) {
          throw new Error('Telefone profissional deve conter exatamente 10 ou 11 dígitos (com DDD).');
        }
      }

      // Validação de CPF
      if (profile.document_id) {
        const cleanCpf = profile.document_id.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
          throw new Error('CPF deve conter exatamente 11 dígitos.');
        }
        if (!isValidCPF(profile.document_id)) {
          throw new Error('CPF inválido (dígitos verificadores incorretos).');
        }
      }

      // Validação de CPF do responsável legal
      if (profile.responsible_cpf) {
        const cleanRespCpf = profile.responsible_cpf.replace(/\D/g, '');
        if (cleanRespCpf.length > 0) {
          if (cleanRespCpf.length !== 11) {
            throw new Error('CPF do responsável deve conter exatamente 11 dígitos.');
          }
          if (!isValidCPF(profile.responsible_cpf)) {
            throw new Error('CPF do responsável inválido (dígitos verificadores incorretos).');
          }
        }
      }

      // Validação de CNPJ (se for PJ)
      if (profile.linkType === 'PJ') {
        if (!profile.pj_type) {
          throw new Error('CNPJ é obrigatório para colaboradores com vínculo PJ.');
        }
        const cleanCnpj = profile.pj_type.replace(/\D/g, '');
        if (cleanCnpj.length !== 14) {
          throw new Error('CNPJ da empresa deve conter exatamente 14 dígitos.');
        }
        if (!isValidCNPJ(profile.pj_type)) {
          throw new Error('CNPJ da empresa inválido (dígitos verificadores incorretos).');
        }
      }
      
      // Guarda os vínculos antigos antes de salvar, pois salvar sobrescreve a base de dados
      const oldProfile = employeeId ? await PeopleService.getEmployeeProfile(employeeId, isTestMode) : null;
      const oldRels = oldProfile?.relationships || [];

      const saved = await PeopleService.saveEmployeeProfile(profile, isTestMode, !employeeId);
      
      // Sincronização bidirecional de relacionamentos (Organograma)
      if (profile.relationships !== undefined) {
        // Envolvemos num try/catch para não quebrar o salvamento principal em caso de erro na sync
        try {
          await PeopleService.syncBidirectionalRelationships(saved.id, oldRels, profile.relationships, isTestMode);
        } catch (syncErr) {
          console.error("Erro ao sincronizar vínculos bidirecionais:", syncErr);
        }
      }
      
      // Se houver itens de histórico pendentes do merge, salvamos agora
      if (pendingHistoryItems.length > 0 && saved.id) {
        await Promise.all(
          pendingHistoryItems.map(item => 
            PeopleService.insertHistoryItem({ ...item, employee_id: saved.id }, isTestMode)
          )
        );
        // Atualiza a lista local de histórico
        const updatedHist = await PeopleService.getEmployeeHistory(saved.id, isTestMode);
        setHistory(updatedHist || []);
        setPendingHistoryItems([]);
      }

      // Se era criação (sem id), vamos definir o ID agora
      if (!profile.id && saved.id) {
        setProfile(prev => ({ ...prev, id: saved.id }));
      }
      
      setIsEditMode(false);
      if (onDataChanged) onDataChanged(saved.id);
      
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Erro ao salvar os dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = <K extends keyof Employee>(field: K, value: Employee[K]) => {
    setProfile(prev => {
      const next = { ...prev, [field]: value };
      
      // Se mudar o Vínculo (linkType), atualizar reativamente a Natureza da Relação (relationshipNature)
      if (field === 'linkType') {
        if (value === 'CLT') {
          next.relationshipNature = 'CLT';
        } else if (value === 'PJ') {
          next.relationshipNature = 'PJ-MEI';
        } else if (value === 'Estagiário') {
          next.relationshipNature = 'CLT';
        }
      }

      // Se mudar o Grau, atualizar a data de alteração do grau
      if (field === 'grau') {
        next.last_grade_date = new Date().toISOString().split('T')[0];
      }

      // Se o vínculo for ou mudar para PJ, sincronizar de forma reativa os dados do responsável legal
      if (next.linkType === 'PJ') {
        if (field === 'name' || field === 'linkType') {
          next.responsible_name = next.name || '';
        }
        if (field === 'document_id' || field === 'linkType') {
          next.responsible_cpf = next.document_id || '';
        }
      }
      
      // Auto-identificação do regime tributário baseado na Razão Social
      if (field === 'corporate_name') {
        const name = (value as string || '').toUpperCase();
        if (name) {
          const isMei = !name.includes('LTDA') && !name.includes('S.A.') && !name.includes('S/A') && !name.includes('LIMITADA') || name.includes('MEI') || name.includes('MICROEMPREENDEDOR INDIVIDUAL');
          next.tax_regime = isMei ? 'MEI' : 'Simples Nacional';
        }
      }
      return next;
    });
  };

  const handleAddRelationship = () => {
    if (!newRelEmployeeId) return;
    const currentRels = profile.relationships || [];
    if (currentRels.some(r => r.employee_id === newRelEmployeeId)) {
      alert("Este colaborador já está relacionado a este perfil.");
      return;
    }
    const updated = [
      ...currentRels,
      { employee_id: newRelEmployeeId, relation_type: newRelType }
    ];
    setProfile(prev => ({
      ...prev,
      relationships: updated
    }));
    setNewRelEmployeeId("");
    setNewRelType("equivalent");
  };

  const handleRemoveRelationship = (targetId: string) => {
    const currentRels = profile.relationships || [];
    const updated = currentRels.filter(r => r.employee_id !== targetId);
    setProfile(prev => ({
      ...prev,
      relationships: updated
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Gera ID temporário se ainda não houver (novo colaborador)
    let targetId = profile.id;
    if (!targetId) {
      targetId = crypto.randomUUID();
    }

    setIsSaving(true);
    try {
      const url = await PeopleService.uploadProfilePhoto(targetId, file, isTestMode);

      // Atualiza apenas photo_url via updater funcional (preserva todos os campos editados)
      setProfile(prev => ({ ...prev, photo_url: url, id: targetId }));

      // Persiste a foto no banco apenas se o colaborador já existia (prop employeeId presente)
      if (employeeId) {
        await PeopleService.updatePhotoUrl(employeeId, url, isTestMode);
        if (onDataChanged) onDataChanged(employeeId);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };



  const handleAdditiveUpload = async (e: React.ChangeEvent<HTMLInputElement>, historyId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Gera ID temporário se ainda não houver (novo colaborador)
    let targetId = profile.id;
    if (!targetId) {
      targetId = crypto.randomUUID();
      setProfile(prev => ({ ...prev, id: targetId }));
    }
    
    setIsSaving(true);
    try {
      const url = await PeopleService.uploadAdditiveFile(targetId, file, isTestMode);
      const dateStr = new Date().toLocaleDateString('pt-BR');
      const markdownLink = `[Anexo ${dateStr}](${url})`;

      if (historyId) {
        // Vincula a um item específico do histórico
        const item = history.find(h => h.id === historyId);
        const newObs = (item?.observations || '') + (item?.observations ? '\n' : '') + markdownLink;
        await PeopleService.updateHistoryItem(historyId, { observations: newObs }, isTestMode);
        // Atualiza localmente
        setHistory(prev => prev.map(h => h.id === historyId ? { ...h, observations: newObs } : h));
      } else {
        // Vincula ao campo geral de aditivos do perfil
        const currentText = profile.links_aditivos ? profile.links_aditivos + '\n' : '';
        const newText = currentText + markdownLink;
        handleChange('links_aditivos', newText);
        // Persiste apenas se o colaborador já existe no banco
        if (employeeId) {
          await PeopleService.saveEmployeeProfile({ ...profile, links_aditivos: newText }, isTestMode);
        }
      }
      if (employeeId && onDataChanged) onDataChanged();
    } catch (err: unknown) {
       const error = err as Error;
       setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBaseContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Gera ID temporário se ainda não houver (novo colaborador)
    let targetId = profile.id;
    if (!targetId) {
      targetId = crypto.randomUUID();
      setProfile(prev => ({ ...prev, id: targetId }));
    }
    
    setIsSaving(true);
    try {
      const url = await PeopleService.uploadAdditiveFile(targetId, file, isTestMode);
      const currentText = profile.links_contratos ? profile.links_contratos + '\n' : '';
      const newText = currentText + `[Documento Base ${new Date().toLocaleDateString('pt-BR')}](${url})`;
      
      handleChange('links_contratos', newText);
      // Persiste apenas se o colaborador já existe no banco
      if (employeeId) {
        await PeopleService.saveEmployeeProfile({ ...profile, links_contratos: newText }, isTestMode);
        if (onDataChanged) onDataChanged();
      }
    } catch (err: unknown) {
       const error = err as Error;
       setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const mapParsedDataToEmployee = (data: any, prev: Partial<Employee>, contractUrl?: string, markdownLink?: string): Partial<Employee> => {
    const next = { ...prev };
    
    if (data.name) next.name = data.name;
    if (data.document_id) next.document_id = formatCPF(data.document_id);
    if (data.document_rg) next.document_rg = data.document_rg;
    if (data.corporate_name) next.corporate_name = data.corporate_name;
    if (data.linkType) next.linkType = data.linkType;
    if (data.job_role) next.job_role = data.job_role;
    if (data.remuneration_bonus !== undefined && data.remuneration_bonus !== null) {
      const currentBonus = prev.remuneration_bonus || 0;
      const newBonus = parseFloat(String(data.remuneration_bonus)) || 0;
      next.remuneration_bonus = Math.max(currentBonus, newBonus);
    }
    if (data.remuneration_incentives !== undefined && data.remuneration_incentives !== null) {
      const newIncentives = parseFloat(String(data.remuneration_incentives)) || 0;
      if (newIncentives > 0) next.remuneration_incentives = newIncentives;
    }
    if (data.remuneration_connectivity !== undefined && data.remuneration_connectivity !== null) {
      const newConn = parseFloat(String(data.remuneration_connectivity)) || 0;
      if (newConn > 0) next.remuneration_connectivity = newConn;
    }
    if (data.remuneration_fixed) {
      next.remuneration_fixed = data.remuneration_fixed;
    }
    next.remuneration = (next.remuneration_fixed || 0) + (next.remuneration_bonus || 0) + (next.remuneration_commission || 0) + (next.remuneration_connectivity || 0) + (next.remuneration_incentives || 0);
    if (data.executive_summary && !prev.executive_summary) {
      next.executive_summary = data.executive_summary;
    }
    if (data.email) next.email = data.email;
    if (data.phone) next.phone = formatPhone(data.phone);
    if (data.zip_code) next.zip_code = formatCEP(data.zip_code);
    if (data.street) next.street = data.street;
    if (data.number) next.number = data.number;
    if (data.neighborhood) next.neighborhood = data.neighborhood;
    if (data.city) next.city = data.city;
    if (data.state) next.state = data.state;
    if (data.cnpj_zip_code) next.cnpj_zip_code = formatCEP(data.cnpj_zip_code);
    if (data.cnpj_street) next.cnpj_street = data.cnpj_street;
    if (data.cnpj_number) next.cnpj_number = data.cnpj_number;
    if (data.cnpj_complement) next.cnpj_complement = data.cnpj_complement;
    if (data.cnpj_neighborhood) next.cnpj_neighborhood = data.cnpj_neighborhood;
    if (data.cnpj_city) next.cnpj_city = data.cnpj_city;
    if (data.cnpj_state) next.cnpj_state = data.cnpj_state;
    if (data.responsible_name) next.responsible_name = data.responsible_name;
    if (data.responsible_cpf) next.responsible_cpf = formatCPF(data.responsible_cpf);
    
    if (data.phone_professional) next.phone_professional = formatPhone(data.phone_professional);
    if (data.email_professional) next.email_professional = data.email_professional;

    if (data.contracting_company) {
      const resolved = resolveCompany(data.contracting_company);
      if (resolved) next.company = resolved;
    }

    // Tratamento Robusto de Distratos / Rescisões
    const isDistrato = data.document_type === 'Distrato' || 
      (data.document_title && (
        data.document_title.toLowerCase().includes('distrato') || 
        data.document_title.toLowerCase().includes('rescis') || 
        data.document_title.toLowerCase().includes('encerra') ||
        data.document_title.toLowerCase().includes('quita') ||
        data.document_title.toLowerCase().includes('resili')
      )) ||
      data.status === 'Inativo' ||
      !!data.termination_date;

    if (isDistrato) {
      next.status = 'Inativo';
      const termDate = data.termination_date || data.resignation_date || data.contract_expiry_date || data.signature_date || new Date().toISOString().split('T')[0];
      next.resignation_date = termDate;
      next.status_end_date = termDate;
      next.contract_expiry_date = termDate;
    } else {
      if (data.status) next.status = data.status;
      if (data.contract_expiry_date) {
        next.contract_expiry_date = getLatestDate(prev.contract_expiry_date, data.contract_expiry_date);
      }
    }

    if (data.start_date) {
      next.start_date = getOldestDate(prev.start_date, data.start_date);
    }
    if (data.job_role || data.department) {
      next.department_start_date = data.signature_date || data.start_date || new Date().toISOString().split('T')[0];
    }

    if (next.linkType === 'PJ') {
      if (!next.responsible_name) next.responsible_name = next.name || '';
      if (!next.responsible_cpf) next.responsible_cpf = next.document_id || '';
      if (data.cnpj || data.pj_type) next.pj_type = formatCNPJ(data.cnpj || data.pj_type);
    }

    if (next.corporate_name) {
      const name = (next.corporate_name || '').toUpperCase();
      const isMei = !name.includes('LTDA') && !name.includes('S.A.') && !name.includes('S/A') && !name.includes('LIMITADA') || name.includes('MEI') || name.includes('MICROEMPREENDEDOR INDIVIDUAL');
      next.tax_regime = isMei ? 'MEI' : 'Simples Nacional';
    }

    if (contractUrl && markdownLink) {
      const currentText = next.links_contratos ? next.links_contratos + '\n' : '';
      next.links_contratos = currentText + markdownLink;
    }

    return next;
  };

  const initializeMerge = (
    existing: Partial<Employee>,
    incoming: Partial<Employee>,
    hist: HistoryItem[],
    bondsData: EmploymentContract[],
    costsData: MonthlyCost[],
    fileLink?: string,
    contractDate?: string
  ) => {
    const cleanVal = (val: any) => {
      if (val === undefined || val === null) return '';
      return String(val).replace(/\D/g, '').trim();
    };
    
    const cleanStr = (val: any) => {
      if (val === undefined || val === null) return '';
      return String(val).trim().toLowerCase();
    };

    const isDifferent = (key: string, existingVal: any, incomingVal: any) => {
      if (incomingVal === undefined || incomingVal === null || incomingVal === '') return false;
      if (existingVal === undefined || existingVal === null || existingVal === '') return true;
      
      if (['document_id', 'pj_type', 'zip_code', 'phone', 'phone_professional', 'cnpj_zip_code', 'responsible_cpf'].includes(key)) {
        return cleanVal(existingVal) !== cleanVal(incomingVal);
      }
      if (['remuneration_fixed', 'remuneration_bonus', 'remuneration_connectivity', 'remuneration_incentives'].includes(key)) {
        return Number(existingVal || 0) !== Number(incomingVal || 0);
      }
      return cleanStr(existingVal) !== cleanStr(incomingVal);
    };

    const isFieldOlderThanCurrentActive = (fieldKey: string, contractDateStr?: string) => {
      if (!contractDateStr) return false;
      if (fieldKey === 'job_role' || fieldKey === 'department' || fieldKey === 'department_start_date') {
        const activeDate = existing.department_start_date || existing.start_date;
        return !!(activeDate && contractDateStr < activeDate);
      }
      if (fieldKey.startsWith('remuneration_') || fieldKey === 'remuneration') {
        const activeDate = existing.last_raise_date || existing.start_date;
        return !!(activeDate && contractDateStr < activeDate);
      }
      if (fieldKey === 'start_date') {
        const activeDate = existing.start_date;
        return !!(activeDate && contractDateStr > activeDate);
      }
      return false;
    };

    const defaults: Record<string, 'existing' | 'incoming'> = {};
    
    MERGE_FIELDS.forEach(field => {
      const existingVal = existing[field.key as keyof Employee];
      const incomingVal = incoming[field.key as keyof Employee];
      
      if (isDifferent(field.key, existingVal, incomingVal)) {
        if (!existingVal && incomingVal) {
          defaults[field.key] = 'incoming';
        } else if (isFieldOlderThanCurrentActive(field.key, contractDate)) {
          defaults[field.key] = 'existing';
        } else if (field.key === 'start_date') {
          const d1 = existing.start_date;
          const d2 = incoming.start_date;
          if (d1 && d2) {
            defaults[field.key] = d1 <= d2 ? 'existing' : 'incoming';
          } else {
            defaults[field.key] = d1 ? 'existing' : 'incoming';
          }
        } else if ([
          'status', 'resignation_date', 'status_end_date',
          'job_role', 'department', 'department_start_date',
          'remuneration_fixed', 'remuneration_bonus', 'remuneration_incentives', 'remuneration_connectivity',
          'contract_expiry_date', 'corporate_name', 'pj_type', 'links_contratos', 'links_aditivos'
        ].includes(field.key)) {
          defaults[field.key] = 'incoming';
        } else {
          defaults[field.key] = 'existing';
        }
      }
    });

    setPendingMerge({
      existingProfile: existing,
      incomingData: incoming,
      existingHistory: hist,
      existingBonds: bondsData,
      existingCosts: costsData,
      fileLink,
      contractDate
    });
    setSelectedMergeFields(defaults);
  };

  const handleConfirmMerge = async () => {
    if (!pendingMerge) return;

    const { existingProfile, incomingData, existingHistory, existingBonds, existingCosts, fileLink, contractDate } = pendingMerge;
    const mergedProfile = { ...existingProfile };
    const historyChanges: string[] = [];
    const changeDate = new Date().toISOString().split('T')[0];

    MERGE_FIELDS.forEach(field => {
      const selection = selectedMergeFields[field.key];
      const incomingVal = incomingData[field.key as keyof Employee];
      const existingVal = existingProfile[field.key as keyof Employee];

      if (selection === 'incoming') {
        (mergedProfile as any)[field.key] = incomingVal;
        
        if (field.key === 'job_role' && existingVal !== incomingVal) {
          historyChanges.push(`Cargo alterado de '${existingVal || '-'}' para '${incomingVal}'`);
        } else if (field.key === 'department' && existingVal !== incomingVal) {
          historyChanges.push(`Setor/Departamento alterado de '${existingVal || '-'}' para '${incomingVal}'`);
        } else if (field.key === 'remuneration_fixed' && Number(existingVal || 0) !== Number(incomingVal || 0)) {
          historyChanges.push(`Remuneração alterada de ${formatCurrency(Number(existingVal || 0))} para ${formatCurrency(Number(incomingVal || 0))}`);
        } else if (field.key === 'remuneration_incentives' && Number(existingVal || 0) !== Number(incomingVal || 0)) {
          historyChanges.push(`Incentivos alterados de ${formatCurrency(Number(existingVal || 0))} para ${formatCurrency(Number(incomingVal || 0))}`);
        } else if (field.key === 'remuneration_connectivity' && Number(existingVal || 0) !== Number(incomingVal || 0)) {
          historyChanges.push(`Conectividade alterada de ${formatCurrency(Number(existingVal || 0))} para ${formatCurrency(Number(incomingVal || 0))}`);
        }
      } else {
        (mergedProfile as any)[field.key] = existingVal !== undefined ? existingVal : incomingVal;
        
        // Se a seleção foi manter o existente (porque o contrato é antigo), ainda assim registramos a trajetória do valor antigo se ele for diferente!
        if (existingVal !== incomingVal && incomingVal !== undefined && incomingVal !== null && incomingVal !== '') {
          if (field.key === 'job_role') {
            historyChanges.push(`Cargo registrado como '${incomingVal}'`);
          } else if (field.key === 'department') {
            historyChanges.push(`Setor/Departamento registrado como '${incomingVal}'`);
          } else if (field.key === 'remuneration_fixed') {
            historyChanges.push(`Remuneração registrada como ${formatCurrency(Number(incomingVal))}`);
          } else if (field.key === 'remuneration_incentives') {
            historyChanges.push(`Incentivos registrados como ${formatCurrency(Number(incomingVal))}`);
          } else if (field.key === 'remuneration_connectivity') {
            historyChanges.push(`Conectividade registrada como ${formatCurrency(Number(incomingVal))}`);
          }
        }
      }
    });

    if (fileLink) {
      const currentText = mergedProfile.links_contratos ? mergedProfile.links_contratos + '\n' : '';
      if (!currentText.includes(fileLink)) {
        mergedProfile.links_contratos = currentText + fileLink;
      }
    }

    const newHistoryItems: any[] = [];
    const eventDate = contractDate || incomingData.department_start_date || changeDate;
    
    historyChanges.forEach(changeText => {
      let event_type = 'Outro';
      if (changeText.startsWith("Cargo")) event_type = "Cargo";
      else if (changeText.startsWith("Setor/Departamento") || changeText.startsWith("Setor")) event_type = "Setor";
      else if (changeText.startsWith("Remuneração") || changeText.startsWith("Incentivos") || changeText.startsWith("Conectividade")) event_type = "Remuneração";

      newHistoryItems.push({
        employee_id: mergedProfile.id || '',
        event_type,
        change_date: eventDate,
        observations: `${changeText} (via importação de contrato PDF)`
      });
    });
    
    setPendingHistoryItems(prev => [...prev, ...newHistoryItems]);

    // Recalcular a remuneração total do perfil mesclado com base em seus componentes individuais
    mergedProfile.remuneration = (mergedProfile.remuneration_fixed || 0) + (mergedProfile.remuneration_bonus || 0) + (mergedProfile.remuneration_commission || 0) + (mergedProfile.remuneration_connectivity || 0) + (mergedProfile.remuneration_incentives || 0);

    setProfile(mergedProfile);
    setHistory(existingHistory);
    setBonds(existingBonds);
    setCosts(existingCosts);
    setIsEditMode(true);
    setPendingMerge(null);
    setSelectedMergeFields({});

    alert('Mesclagem aplicada temporariamente! Revise os dados na ficha e clique em "Salvar" para gravar definitivamente no banco.');
  };

  const handleParseContractPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingContract(true);
    setError(null);
    try {
      // 1. Upload do PDF do contrato para o Supabase Storage primeiro.
      // Se não houver ID (novo colaborador), geramos um ID temporário seguro para a pasta de upload.
      const uploadId = profile.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11));
      
      const contractUrl = await PeopleService.uploadAdditiveFile(uploadId, file, isTestMode);
      const dateStr = new Date().toLocaleDateString('pt-BR');
      let markdownLink = `[Documento ${dateStr}](${contractUrl})`;

      // 2. Chamar a API de parsing enviando a URL do arquivo no corpo JSON.
      // Isso consome poucos bytes do cliente para o Vercel, contornando a restrição de tamanho.
      const res = await fetch('/api/people/parse-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileUrl: contractUrl }),
      });

      const responseText = await res.text();
      
      if (!res.ok) {
        let errMsg = 'Falha ao processar PDF do contrato.';
        try {
          const parsed = JSON.parse(responseText);
          errMsg = parsed.error || errMsg;
        } catch {
          if (responseText.trim().startsWith('<')) {
            errMsg = `Erro no servidor (${res.status}). A API do Gemini falhou ou o tempo limite foi excedido.`;
          } else {
            errMsg = responseText.slice(0, 200) || errMsg;
          }
        }
        throw new Error(errMsg);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(responseText.slice(0, 200) || 'A resposta do servidor não é um JSON válido.');
      }
      
      // Buscar se o colaborador já existe na base (Ordem: CNPJ -> CPF -> Nome)
      const existing = await PeopleService.findEmployeeByUniqueKeys({
        cnpj: data.cnpj || data.pj_type,
        cpf: data.document_id,
        name: data.name
      }, isTestMode);

      if (existing) {
        setIsLoading(true);
        try {
          const [existingProfile, hist, bondsData, costsData] = await Promise.all([
            PeopleService.getEmployeeProfile(existing.id, isTestMode),
            PeopleService.getEmployeeHistory(existing.id, isTestMode),
            PeopleHRService.getEmploymentContracts(existing.id),
            PeopleHRService.getMonthlyCosts(existing.id)
          ]);
          
          if (!existingProfile) {
            throw new Error('Não foi possível carregar a ficha cadastral do colaborador existente.');
          }

          const incomingMapped = mapParsedDataToEmployee(data, profile);
          
          let docTitle = data.document_title || data.document_type || 'Documento';
          if (data.document_type === 'Aditivo' && data.additive_changes) {
            docTitle = `Aditivo (${data.additive_changes})`;
          }
          const signDateStr = data.signature_date 
            ? new Date(data.signature_date + "T12:00:00").toLocaleDateString('pt-BR') 
            : dateStr;
          
          let updatedMarkdownLink = `[${docTitle} ${signDateStr}](${contractUrl})`;

          initializeMerge(existingProfile, incomingMapped, hist || [], bondsData || [], costsData || [], updatedMarkdownLink, data.signature_date || data.start_date);
        } catch (loadErr: unknown) {
          const error = loadErr as Error;
          console.error('Erro ao carregar dados do colaborador existente:', error);
          setError('Falha ao carregar colaborador existente.');
        } finally {
          setIsLoading(false);
          setIsParsingContract(false);
        }
        return;
      }
      
      // Histórico de Mudança Automático para Aditivos
      const docDate = data.signature_date || data.start_date || new Date().toISOString().split('T')[0];
      if (profile.id) {
        if (data.job_role && data.job_role !== profile.job_role) {
          setPendingHistoryItems(h => [...h, {
            employee_id: profile.id || '',
            event_type: 'Cargo',
            change_date: docDate,
            observations: `Cargo alterado de '${profile.job_role || '-'}' para '${data.job_role}' (via importação de contrato PDF)`
          }]);
        }
        if (data.department && data.department !== profile.department) {
          setPendingHistoryItems(h => [...h, {
            employee_id: profile.id || '',
            event_type: 'Setor',
            change_date: docDate,
            observations: `Setor/Departamento alterado de '${profile.department || '-'}' para '${data.department}' (via importação de contrato PDF)`
          }]);
        }
        if (data.remuneration_fixed !== undefined && data.remuneration_fixed !== null && Number(data.remuneration_fixed || 0) !== Number(profile.remuneration_fixed || 0)) {
          setPendingHistoryItems(h => [...h, {
            employee_id: profile.id || '',
            event_type: 'Remuneração',
            change_date: docDate,
            observations: `Remuneração alterada de ${formatCurrency(Number(profile.remuneration_fixed || 0))} para ${formatCurrency(Number(data.remuneration_fixed || 0))} (via importação de contrato PDF)`
          }]);
        }
        if (data.remuneration_incentives !== undefined && data.remuneration_incentives !== null && Number(data.remuneration_incentives || 0) !== Number(profile.remuneration_incentives || 0)) {
          setPendingHistoryItems(h => [...h, {
            employee_id: profile.id || '',
            event_type: 'Remuneração',
            change_date: docDate,
            observations: `Incentivos alterados de ${formatCurrency(Number(profile.remuneration_incentives || 0))} para ${formatCurrency(Number(data.remuneration_incentives || 0))} (via importação de contrato PDF)`
          }]);
        }
        if (data.remuneration_connectivity !== undefined && data.remuneration_connectivity !== null && Number(data.remuneration_connectivity || 0) !== Number(profile.remuneration_connectivity || 0)) {
          setPendingHistoryItems(h => [...h, {
            employee_id: profile.id || '',
            event_type: 'Remuneração',
            change_date: docDate,
            observations: `Conectividade alterada de ${formatCurrency(Number(profile.remuneration_connectivity || 0))} para ${formatCurrency(Number(data.remuneration_connectivity || 0))} (via importação de contrato PDF)`
          }]);
        }
      }

      // Mesclar os dados extraídos no profile
      setProfile(prev => {
        const next = { ...prev };
        
        if (data.job_role) next.job_role = data.job_role;
        if (data.name) next.name = data.name;
        if (data.document_id) next.document_id = formatCPF(data.document_id);
        if (data.document_rg) next.document_rg = data.document_rg;
        if (data.corporate_name) next.corporate_name = data.corporate_name;
        if (data.linkType) next.linkType = data.linkType;
        if (data.remuneration_bonus !== undefined && data.remuneration_bonus !== null) {
          const currentBonus = prev.remuneration_bonus || 0;
          const newBonus = parseFloat(String(data.remuneration_bonus)) || 0;
          next.remuneration_bonus = Math.max(currentBonus, newBonus);
        }
        if (data.remuneration_incentives !== undefined && data.remuneration_incentives !== null) {
          const newIncentives = parseFloat(String(data.remuneration_incentives)) || 0;
          if (newIncentives > 0) next.remuneration_incentives = newIncentives;
        }
        if (data.remuneration_connectivity !== undefined && data.remuneration_connectivity !== null) {
          const newConn = parseFloat(String(data.remuneration_connectivity)) || 0;
          if (newConn > 0) next.remuneration_connectivity = newConn;
        }
        if (data.remuneration_fixed) {
          next.remuneration_fixed = data.remuneration_fixed;
        }
        next.remuneration = (next.remuneration_fixed || 0) + (next.remuneration_bonus || 0) + (next.remuneration_commission || 0) + (next.remuneration_connectivity || 0) + (next.remuneration_incentives || 0);
        
        // Ficha Executiva: preencher automaticamente se a IA extraiu o resumo
        if (data.executive_summary && !prev.executive_summary) {
          next.executive_summary = data.executive_summary;
        }
        if (data.email) next.email = data.email;
        if (data.phone) next.phone = formatPhone(data.phone);
        if (data.zip_code) next.zip_code = formatCEP(data.zip_code);
        if (data.street) next.street = data.street;
        if (data.number) next.number = data.number;
        if (data.neighborhood) next.neighborhood = data.neighborhood;
        if (data.city) next.city = data.city;
        if (data.state) next.state = data.state;
        if (data.cnpj_zip_code) next.cnpj_zip_code = formatCEP(data.cnpj_zip_code);
        if (data.cnpj_street) next.cnpj_street = data.cnpj_street;
        if (data.cnpj_number) next.cnpj_number = data.cnpj_number;
        if (data.cnpj_neighborhood) next.cnpj_neighborhood = data.cnpj_neighborhood;
        if (data.cnpj_city) next.cnpj_city = data.cnpj_city;
        if (data.cnpj_state) next.cnpj_state = data.cnpj_state;
        if (data.responsible_name) next.responsible_name = data.responsible_name;
        if (data.responsible_cpf) next.responsible_cpf = formatCPF(data.responsible_cpf);
        
        // Novos campos profissional
        if (data.phone_professional) next.phone_professional = formatPhone(data.phone_professional);
        if (data.email_professional) next.email_professional = data.email_professional;

        // Empresa Contratante
        if (data.contracting_company) {
          const resolved = resolveCompany(data.contracting_company);
          if (resolved) next.company = resolved;
        }

        // Tratamento de Distrato / Rescisão / Encerramento
        const isDistrato = data.document_type === 'Distrato' || 
          (data.document_title && (
            data.document_title.toLowerCase().includes('distrato') || 
            data.document_title.toLowerCase().includes('rescis') || 
            data.document_title.toLowerCase().includes('encerra') ||
            data.document_title.toLowerCase().includes('quita') ||
            data.document_title.toLowerCase().includes('resili')
          )) ||
          data.status === 'Inativo' ||
          !!data.termination_date;

        // Datas: Admissão (Mais antiga) e Vencimento (Maior/Mais recente)
        if (data.start_date && !isDistrato) {
          next.start_date = getOldestDate(prev.start_date, data.start_date);
        }
        if (data.job_role || data.department) {
          next.department_start_date = data.signature_date || data.start_date || new Date().toISOString().split('T')[0];
        }
        if (data.contract_expiry_date && !isDistrato) {
          next.contract_expiry_date = getLatestDate(prev.contract_expiry_date, data.contract_expiry_date);
        }

        // Se for distrato ou houver data de encerramento/rescisao
        if (isDistrato) {
          const endDate = data.termination_date || data.resignation_date || data.contract_expiry_date || data.signature_date || new Date().toISOString().split('T')[0];
          next.contract_expiry_date = endDate;
          next.resignation_date = endDate;
          next.status_end_date = endDate;
          next.status = 'Inativo';
        }

        // Se for PJ e não houver responsável_name ou responsável_cpf, sincronizar reativamente
        if (next.linkType === 'PJ') {
          if (!next.responsible_name) next.responsible_name = next.name || '';
          if (!next.responsible_cpf) next.responsible_cpf = next.document_id || '';
          if (data.cnpj || data.pj_type) next.pj_type = formatCNPJ(data.cnpj || data.pj_type);
        }

        // Se o corporate_name estiver presente, auto-identificar regime tributário
        if (next.corporate_name) {
          const name = (next.corporate_name || '').toUpperCase();
          const isMei = !name.includes('LTDA') && !name.includes('S.A.') && !name.includes('S/A') && !name.includes('LIMITADA') || name.includes('MEI') || name.includes('MICROEMPREENDEDOR INDIVIDUAL');
          next.tax_regime = isMei ? 'MEI' : 'Simples Nacional';
        }

        if (contractUrl) {
          let docTitle = data.document_title || data.document_type || 'Documento';
          if (data.document_type === 'Aditivo' && data.additive_changes) {
            docTitle = `Aditivo (${data.additive_changes})`;
          }
          const signDateStr = data.signature_date 
            ? new Date(data.signature_date + "T12:00:00").toLocaleDateString('pt-BR') 
            : dateStr;
            
          const linkStr = `[${docTitle} ${signDateStr}](${contractUrl})`;
          
          if (data.document_type === 'Aditivo') {
             const currentAditivos = next.links_aditivos ? next.links_aditivos + '\n' : '';
             next.links_aditivos = currentAditivos + linkStr;
          } else {
             const currentText = next.links_contratos ? next.links_contratos + '\n' : '';
             next.links_contratos = currentText + linkStr;
          }
        }

        return next;
      });

      alert(profile.id 
        ? 'Contrato importado, salvo no storage e analisado por IA com sucesso! Os campos foram auto-preenchidos.'
        : 'Contrato importado e analisado por IA com sucesso! Os campos foram auto-preenchidos.'
      );
    } catch (err: unknown) {
      const error = err as Error;
      console.error(error);
      setError(error.message || 'Erro ao analisar o contrato.');
    } finally {
      setIsParsingContract(false);
    }
  };

  const handleDeleteLink = async (field: 'links_aditivos' | 'links_contratos', linkToRemove: string) => {
    if (!confirm('Deseja realmente remover este anexo?')) return;
    
    const currentText = profile[field] || '';
    const newText = currentText.split('\n').filter(line => !line.includes(linkToRemove)).join('\n');
    
    setIsSaving(true);
    try {
      handleChange(field, newText);
      if (employeeId) {
        await PeopleService.saveEmployeeProfile({ ...profile, [field]: newText }, isTestMode);
        if (onDataChanged) onDataChanged();
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper ui classes
  const inputClass = `w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-base text-slate-700 dark:text-slate-200 outline-none transition-all ${isEditMode ? 'focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500' : 'bg-transparent border-transparent px-0 font-semibold text-slate-900 dark:text-white'}`;
  const labelClass = "text-xs font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1.5 block";

  const formatMonthCompetenciaBR = (dateStr: string) => {
    const parts = dateStr.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    return `${months[monthIdx]}/${parts[0]}`;
  };

  const formatDateBR = (dateStr: string) => {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  useEffect(() => {
    if (profile.id) {
      const issues = PeopleHRService.auditEmployee(profile.id, bonds, costs, profile.start_date || undefined);
      setAuditIssues(issues);
    } else {
      setAuditIssues([]);
    }
  }, [profile.id, profile.start_date, bonds, costs]);

  const resolveCompany = (companyStr: string): string => {
    const norm = (companyStr || '').toUpperCase();
    if (norm.includes('G2')) return 'G2';
    if (norm.includes('MAR BRASIL') || norm.includes('MARBR') || norm.includes('MAR BR')) return 'MarBR';
    if (norm.includes('DZM') || norm.includes('D.Z.M') || norm.includes('D Z M') || norm.includes('DIANNA')) return 'DZM';
    return '';
  };

  const getOldestDate = (d1?: string | null, d2?: string | null): string => {
    if (!d1 && !d2) return '';
    if (!d1) return d2 || '';
    if (!d2) return d1 || '';
    // Comparação de string YYYY-MM-DD
    return d1 < d2 ? d1 : d2;
  };

  const getLatestDate = (d1?: string | null, d2?: string | null): string => {
    if (!d1 && !d2) return '';
    if (!d1) return d2 || '';
    if (!d2) return d1 || '';
    // Comparação de string YYYY-MM-DD
    return d1 > d2 ? d1 : d2;
  };

  const formatCEP = (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length > 5) {
      return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
    }
    return clean;
  };

  const formatCPF = (value: string) => {
    const clean = value.replace(/\D/g, '');
    const truncated = clean.slice(0, 11);
    if (truncated.length <= 3) return truncated;
    if (truncated.length <= 6) return `${truncated.slice(0, 3)}.${truncated.slice(3)}`;
    if (truncated.length <= 9) return `${truncated.slice(0, 3)}.${truncated.slice(3, 6)}.${truncated.slice(6)}`;
    return `${truncated.slice(0, 3)}.${truncated.slice(3, 6)}.${truncated.slice(6, 9)}-${truncated.slice(9)}`;
  };

  const formatCNPJ = (value: string) => {
    const clean = value.replace(/\D/g, '');
    const truncated = clean.slice(0, 14);
    if (truncated.length <= 2) return truncated;
    if (truncated.length <= 5) return `${truncated.slice(0, 2)}.${truncated.slice(2)}`;
    if (truncated.length <= 8) return `${truncated.slice(0, 2)}.${truncated.slice(2, 5)}.${truncated.slice(5)}`;
    if (truncated.length <= 12) return `${truncated.slice(0, 2)}.${truncated.slice(2, 5)}.${truncated.slice(5, 8)}/${truncated.slice(8)}`;
    return `${truncated.slice(0, 2)}.${truncated.slice(2, 5)}.${truncated.slice(5, 8)}/${truncated.slice(8, 12)}-${truncated.slice(12)}`;
  };

  const formatPhone = (value: string) => {
    const clean = value.replace(/\D/g, '');
    const truncated = clean.slice(0, 11);
    if (truncated.length <= 2) return truncated;
    if (truncated.length <= 6) return `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
    if (truncated.length <= 10) return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 6)}-${truncated.slice(6)}`;
    return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
  };

  const handleCPFChange = (val: string) => {
    const formatted = formatCPF(val);
    handleChange('document_id', formatted);
  };

  const handleCNPJChange = (val: string) => {
    const formatted = formatCNPJ(val);
    handleChange('pj_type', formatted);
  };

  const handlePhoneChange = (val: string) => {
    const formatted = formatPhone(val);
    handleChange('phone', formatted);
  };

  const handleProfessionalPhoneChange = (val: string) => {
    const formatted = formatPhone(val);
    handleChange('phone_professional', formatted);
  };

  const isValidCPF = (cpf: string) => {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(clean)) return false;
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(clean.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(clean.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(clean.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(clean.substring(10, 11))) return false;
    
    return true;
  };

  const isValidCNPJ = (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(clean)) return false;
    
    let size = clean.length - 2;
    let numbers = clean.substring(0, size);
    const digits = clean.substring(size);
    let sum = 0;
    let pos = size - 7;
    
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;
    
    size = size + 1;
    numbers = clean.substring(0, size);
    sum = 0;
    pos = size - 7;
    
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;
    
    return true;
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,10}$/.test(email);
  };

  const handleCEPChange = (val: string) => {
    const formatted = formatCEP(val);
    handleChange('zip_code', formatted);
    
    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 8) {
      handleBuscarCEP(clean);
    }
  };

  const handleBuscarCEP = async (cepParaBuscar?: string) => {
    const rawCep = cepParaBuscar || profile.zip_code || '';
    const cepLimpo = rawCep.replace(/\D/g, '');
    if (!cepLimpo || cepLimpo.length !== 8) {
      setCepError('CEP inválido');
      return;
    }
    
    setIsSearchingCEP(true);
    setCepError(null);
    
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepError('CEP não encontrado');
      } else {
        setProfile(prev => ({
          ...prev,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || '',
          endereco_completo: `${data.logradouro || ''}, ${data.bairro || ''}, ${data.localidade || ''} - ${data.uf || ''}, CEP: ${data.cep || ''}`
        }));
      }
    } catch (e) {
      console.error('Erro ao buscar CEP', e);
      setCepError('Erro de conexão');
    } finally {
      setIsSearchingCEP(false);
    }
  };

  const handleCNPJCEPChange = (val: string) => {
    const formatted = formatCEP(val);
    handleChange('cnpj_zip_code', formatted);
    
    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 8) {
      handleBuscarCNPJCEP(clean);
    }
  };

  const handleBuscarCNPJCEP = async (cepParaBuscar?: string) => {
    const rawCep = cepParaBuscar || profile.cnpj_zip_code || '';
    const cepLimpo = rawCep.replace(/\D/g, '');
    if (!cepLimpo || cepLimpo.length !== 8) {
      setCnpjCepError('CEP inválido');
      return;
    }
    
    setIsSearchingCNPJCEP(true);
    setCnpjCepError(null);
    
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCnpjCepError('CEP não encontrado');
      } else {
        setProfile(prev => ({
          ...prev,
          cnpj_street: data.logradouro || '',
          cnpj_neighborhood: data.bairro || '',
          cnpj_city: data.localidade || '',
          cnpj_state: data.uf || ''
        }));
      }
    } catch (e) {
      console.error('Erro ao buscar CEP da empresa', e);
      setCnpjCepError('Erro de conexão');
    } finally {
      setIsSearchingCNPJCEP(false);
    }
  };

  const handleBuscarCEPPorEndereco = async (isCNPJ = false) => {
    const street = isCNPJ ? (profile.cnpj_street || '') : (profile.street || '');
    const city = isCNPJ ? (profile.cnpj_city || '') : (profile.city || '');
    const state = isCNPJ ? (profile.cnpj_state || 'SP') : (profile.state || 'SP');

    if (!street || street.length < 3 || !city) {
      if (isCNPJ) setCnpjCepError('Preencha Logradouro e Cidade');
      else setCepError('Preencha Logradouro e Cidade');
      return;
    }

    if (isCNPJ) setIsSearchingCNPJCEP(true);
    else setIsSearchingCEP(true);

    try {
      const res = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(state)}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].cep) {
        const match = data[0];
        if (isCNPJ) {
          setProfile(prev => ({
            ...prev,
            cnpj_zip_code: match.cep,
            cnpj_neighborhood: prev.cnpj_neighborhood || match.bairro || '',
            cnpj_city: prev.cnpj_city || match.localidade || '',
            cnpj_state: prev.cnpj_state || match.uf || ''
          }));
          setCnpjCepError(null);
        } else {
          setProfile(prev => ({
            ...prev,
            zip_code: match.cep,
            neighborhood: prev.neighborhood || match.bairro || '',
            city: prev.city || match.localidade || '',
            state: prev.state || match.uf || ''
          }));
          setCepError(null);
        }
      } else {
        if (isCNPJ) setCnpjCepError('CEP não localizado');
        else setCepError('CEP não localizado');
      }
    } catch {
      if (isCNPJ) setCnpjCepError('Erro na busca de CEP');
      else setCepError('Erro na busca de CEP');
    } finally {
      if (isCNPJ) setIsSearchingCNPJCEP(false);
      else setIsSearchingCEP(false);
    }
  };

  const handleCopyAddress = (checked: boolean) => {
    if (checked) {
      setProfile(prev => ({
        ...prev,
        cnpj_zip_code: prev.zip_code || '',
        cnpj_street: prev.street || '',
        cnpj_number: prev.number || '',
        cnpj_complement: prev.complement || '',
        cnpj_neighborhood: prev.neighborhood || '',
        cnpj_city: prev.city || '',
        cnpj_state: prev.state || ''
      }));
    } else {
      setProfile(prev => ({
        ...prev,
        cnpj_zip_code: '',
        cnpj_street: '',
        cnpj_number: '',
        cnpj_complement: '',
        cnpj_neighborhood: '',
        cnpj_city: '',
        cnpj_state: ''
      }));
    }
  };

  const handleParsePayrollPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingPayroll(true);
    setSaveCostError(null);
    try {
      // 1. Upload do PDF do holerite
      const uploadId = profile.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'temp_' + Date.now());
      const payrollUrl = await PeopleService.uploadAdditiveFile(uploadId, file, isTestMode);

      // 2. Chamar API de parse do holerite
      const res = await fetch('/api/people/parse-payroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileUrl: payrollUrl }),
      });

      const responseText = await res.text();
      
      if (!res.ok) {
        let errMsg = 'Falha ao processar PDF do holerite.';
        try {
          const parsed = JSON.parse(responseText);
          errMsg = parsed.error || errMsg;
        } catch {
          if (responseText.trim().startsWith('<')) {
            errMsg = `Erro no servidor (${res.status}). A API do Gemini falhou ou o tempo limite foi excedido.`;
          } else {
            errMsg = responseText.slice(0, 200) || errMsg;
          }
        }
        throw new Error(errMsg);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(responseText.slice(0, 200) || 'A resposta do servidor não é um JSON válido.');
      }

      // Validação de segurança: verificar se o nome bate com o colaborador atual
      if (data.name && profile.name) {
        const docName = data.name.toLowerCase();
        const profName = profile.name.toLowerCase();
        
        // Se não houver correspondência parcial de nome
        const hasCommonName = docName.split(' ').some((word: string) => word.length > 3 && profName.includes(word));
        if (!hasCommonName) {
          if (!confirm(`Aviso: O holerite lido pertence a "${data.name}", mas o cadastro atual é de "${profile.name}". Deseja importar mesmo assim?`)) {
            return;
          }
        }
      }

      // Seta todos os estados com os dados extraídos pelo OCR
      if (data.competencia) setEditingCostCompetencia(data.competencia);
      setEditingCostFixo(data.valor_fixo || 0);
      setEditingCostHolerite(data.valor_holerite || data.valor_fixo || 0);
      setEditingCostAdiantamento(data.valor_adiantamento || 0);
      setEditingCostHoraExtra(data.valor_hora_extra || 0);
      setEditingCostAdicionalNot(data.valor_adicional_not || 0);
      setEditingCostVR(data.valor_vr || 0);
      setEditingCostVT(data.valor_vt || 0);
      setEditingCostCesta(data.valor_cesta || 0);
      setEditingCostFerias(data.valor_ferias || 0);
      setEditingCostRescisao(data.valor_rescisao || 0);
      setEditingCostDecimoTerceiro(data.valor_decimo_terceiro || 0);
      setEditingCostDescontos(data.valor_descontos || 0);
      setEditingCostFaltas(data.valor_faltas || 0);
      setEditingCostDiasFaltas(data.dias_faltas || 0);
      setEditingCostConsignado(data.valor_consignado || 0);
      setEditingCostBancoHoras(data.banco_horas || 0);
      setEditingCostBonus(data.valor_bonus || 0);
      setEditingCostComissao(data.valor_comissao || 0);
      setEditingCostIncentivos(data.valor_incentivos || 0);
      setEditingCostConectividade(data.valor_ajuda_custo || 0);
      setEditingCostVerbasAdicionais([]);
      
      if (data.observacao) {
        setEditingCostObservacao(data.observacao);
      } else {
        setEditingCostObservacao(`Importado via OCR em ${new Date().toLocaleDateString('pt-BR')}`);
      }

    } catch (err: any) {
      setSaveCostError(err.message || 'Erro ao ler holerite.');
    } finally {
      setIsParsingPayroll(false);
    }
  };

  const handleSaveCost = async () => {
    if (!editingCost) return;
    setSaveCostError(null);
    try {
      if (!profile.start_date) {
        throw new Error('A data de admissão original do colaborador precisa estar preenchida.');
      }
      
      const startVal = new Date(profile.start_date + 'T00:00:00').getTime();
      const newCostVal = new Date(editingCostCompetencia + 'T00:00:00').getTime();
      
      if (newCostVal < startVal) {
        throw new Error(`Bloqueio de Auditoria: A competência ${formatMonthCompetenciaBR(editingCostCompetencia)} é anterior à data de admissão (${formatDateBR(profile.start_date)}).`);
      }
      
      const isCLT = editingCostType === 'CLT';
      
      // Converte a lista de verbas adicionais temporária para record
      const verbasObj: Record<string, number> = {};
      editingCostVerbasAdicionais.forEach(v => {
        if (v.name.trim() && v.value !== 0) {
          verbasObj[v.name.trim()] = v.value;
        }
      });

      const verbasAdicionaisSoma = Object.values(verbasObj).reduce((sum, val) => sum + val, 0);

      const computedLiquido = isCLT
        ? (editingCostFixo + editingCostHoraExtra + editingCostAdicionalNot + editingCostFerias + editingCostDecimoTerceiro + editingCostBonus + editingCostComissao + editingCostIncentivos + editingCostConectividade)
          - (editingCostDescontos + editingCostFaltas + editingCostConsignado + editingCostGlosaBase + editingCostGlosaBonus + editingCostDeducoes)
          + verbasAdicionaisSoma
        : (editingCostFixo + editingCostBonus + editingCostComissao + editingCostIncentivos + editingCostConectividade)
          - (editingCostGlosaBase + editingCostGlosaBonus + editingCostDeducoes)
          + verbasAdicionaisSoma;

      const payload = {
        competencia: editingCostCompetencia,
        valor_liquido: computedLiquido,
        valor_fixo: editingCostFixo,
        valor_bonus: editingCostBonus,
        valor_comissao: editingCostComissao,
        valor_incentivos: editingCostIncentivos,
        valor_ajuda_custo: editingCostConectividade,
        valor_glosa_base: editingCostGlosaBase,
        valor_glosa_bonus: editingCostGlosaBonus,
        valor_deducoes: editingCostDeducoes,
        vinculo_tipo: editingCostType,
        origem: editingCost.id ? editingCost.origem : 'manual',
        
        // Novos campos CLT
        valor_holerite: isCLT ? editingCostHolerite : undefined,
        valor_adiantamento: isCLT ? editingCostAdiantamento : undefined,
        valor_hora_extra: isCLT ? editingCostHoraExtra : undefined,
        valor_adicional_not: isCLT ? editingCostAdicionalNot : undefined,
        valor_vr: isCLT ? editingCostVR : undefined,
        valor_vt: isCLT ? editingCostVT : undefined,
        valor_cesta: isCLT ? editingCostCesta : undefined,
        valor_ferias: isCLT ? editingCostFerias : undefined,
        valor_rescisao: isCLT ? editingCostRescisao : undefined,
        valor_decimo_terceiro: isCLT ? editingCostDecimoTerceiro : undefined,
        valor_descontos: isCLT ? editingCostDescontos : undefined,
        valor_faltas: isCLT ? editingCostFaltas : undefined,
        dias_faltas: isCLT ? editingCostDiasFaltas : undefined,
        valor_consignado: isCLT ? editingCostConsignado : undefined,
        banco_horas: isCLT ? editingCostBancoHoras : undefined,
        observacao: editingCostObservacao || undefined,
        verbas_adicionais: Object.keys(verbasObj).length > 0 ? verbasObj : undefined
      };

      // Inativação reativa automática do colaborador caso haja rescisão CLT
      if (isCLT && editingCostRescisao > 0) {
        const updatedProfile = {
          ...profile,
          status: 'Inativo' as const,
          active: false,
          status_end_date: editingCostCompetencia,
          resignation_date: editingCostCompetencia
        };
        await PeopleService.saveEmployeeProfile(updatedProfile, false, false);
        setProfile(updatedProfile);
      }

      if (editingCost.id) {
        await PeopleHRService.updateMonthlyCost(editingCost.id, payload);
        setCosts(prev => prev.map(c => c.id === editingCost.id ? { ...c, ...payload } : c));
      } else {
        const newCost = await PeopleHRService.insertMonthlyCost({ ...payload, employee_id: profile.id } as any);
        setCosts(prev => [...prev, newCost]);
      }
      
      setEditingCost(null);
      if (onDataChanged) onDataChanged();
    } catch (err: unknown) {
      const error = err as Error;
      setSaveCostError(error.message);
    }
  };

  const handleDeleteCost = async (costId: string) => {
    if (!confirm('Deseja realmente excluir permanentemente este lançamento de custo para corrigir a inconsistência?')) return;
    try {
      await PeopleHRService.deleteMonthlyCost(costId);
      setCosts(prev => prev.filter(c => c.id !== costId));
      setEditingCost(null);
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir custo.');
    }
  };

  const handleSearchDianna = async () => {
    setIsSearchingExisting(true);
    setDiannaResults([]);
    setSelectedDiannaRows([]);
    setDiannaSearchFilter('');
    try {
      const res = await fetch('/dianna_source.json');
      if (!res.ok) throw new Error('Não foi possível carregar a fonte Dianna (dianna_source.json). O Data Lake precisa ser gerado primeiro.');
      const data = await res.json();
      
      const queryWords = (profile.name || '').toLowerCase().trim().split(' ').filter((w: string) => w.length > 2);
      
      let matched = data.filter((row: any) => {
        if (!row.nome_bruto) return false;
        const n = row.nome_bruto.toLowerCase();
        return queryWords.every((w: string) => n.includes(w));
      });

      if (matched.length === 0 && queryWords.length > 0) {
        matched = data.filter((row: any) => {
          if (!row.nome_bruto) return false;
          const n = row.nome_bruto.toLowerCase();
          return queryWords.some((w: string) => n.includes(w));
        });
      }
      
      setDiannaResults(matched);
      setIsDiannaImportOpen(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao buscar no Data Lake Dianna.');
    } finally {
      setIsSearchingExisting(false);
    }
  };

  const handleImportDiannaSelected = async () => {
    if (selectedDiannaRows.length === 0) return;
    setIsImportingDianna(true);
    try {
      const itemsToImport = selectedDiannaRows.map(index => diannaResults[index]);
      
      // Run sequentially to keep it simple and safe
      const newCosts: MonthlyCost[] = [];
      for (const item of itemsToImport) {
        const payload = {
          employee_id: profile.id,
          competencia: item.competencia,
          valor_liquido: item.valor_total,
          valor_fixo: item.valor_total,
          valor_bonus: 0,
          valor_comissao: 0,
          vinculo_tipo: profile.linkType === 'CLT' ? 'CLT' : 'MEI',
          origem: 'dianna_import'
        };
        const newCost = await PeopleHRService.insertMonthlyCost(payload as any);
        newCosts.push(newCost);
      }
      
      setCosts(prev => [...prev, ...newCosts]);
      setIsDiannaImportOpen(false);
      setSelectedDiannaRows([]);
      if (onDataChanged) onDataChanged();
      alert(`${newCosts.length} lançamentos importados com sucesso!`);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao importar dados. ' + err.message);
    } finally {
      setIsImportingDianna(false);
    }
  };

  const handleClose = () => {
    if (isEditMode) {
      if (confirm("Você possui alterações não salvas. Deseja realmente sair e descartar as alterações?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 overflow-hidden"
          onClick={(e) => {
            if (!isEditMode && e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
            className="bg-white dark:bg-slate-950 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Menu Fixo Topo */}
          {(() => {
            const isPJ = profile.linkType === 'PJ' || profile.linkType === 'MEI' || isExternalEntity(inferEntityType(profile));
            return (
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600">
                      {isPJ ? <Building2 size={20} /> : <UserRound size={20} />}
                   </div>
                   <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {employeeId ? (isPJ ? (profile.corporate_name || 'Ficha do Prestador de Serviços (PJ)') : 'Ficha do Colaborador') : (isPJ ? 'Novo Prestador PJ / Fornecedor' : 'Novo Colaborador')}
                      </h2>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {isPJ ? 'Gestão de Contratos & Parceiros (PJ)' : 'Perfil Recursos Humanos'}
                      </p>
                   </div>
                </div>
                
                <div className="flex gap-2">
                  {employeeId && !isEditMode && (
                    <>
                      <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="flex items-center gap-1.5 p-2 px-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 rounded-lg transition-all text-amber-950 font-bold text-xs shadow-xs active:scale-95 cursor-pointer"
                        title={isPJ ? "Exportar Ficha do Prestador (PDF/CSV)" : "Exportar Ficha do Colaborador (PDF/CSV)"}
                      >
                        <Download size={14} />
                        <span>Exportar Ficha</span>
                      </button>
                      <a 
                        href={`/emprestimos?employeeId=${employeeId}`}
                        className="flex items-center gap-1.5 p-2 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/50 rounded-lg transition-all text-amber-700 dark:text-amber-500 font-semibold text-xs border border-amber-200 dark:border-amber-900/50"
                        title="Gerenciar Adiantamentos / Empréstimos"
                      >
                        <Coins size={14} />
                        <span>Empréstimos</span>
                      </a>
                      <button 
                        onClick={() => setIsEditMode(true)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all text-slate-600"
                        title="Editar Ficha"
                      >
                        <PenBox size={18} />
                      </button>
                    </>
                  )}
                  {isEditMode && (
                    <>
                      {!employeeId && (
                        <button
                          type="button"
                          onClick={() => setIsSearchExistingOpen(true)}
                          className="flex items-center gap-1.5 p-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700"
                        >
                          <Search size={14} />
                          <span>Já é cadastrado?</span>
                        </button>
                      )}
                      <label className={`flex items-center gap-2 p-2 px-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all text-white font-semibold text-xs cursor-pointer select-none ${isParsingContract ? 'opacity-70 pointer-events-none' : ''}`}>
                        {isParsingContract ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        <span>Importar Contrato / Distrato (PDF)</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".pdf" 
                          onChange={handleParseContractPDF} 
                          disabled={isParsingContract} 
                        />
                      </label>
                      
                      <button 
                        onClick={handleSave}
                        disabled={isSaving || isParsingContract}
                        className="flex items-center gap-2 p-2 px-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all text-white font-semibold text-xs"
                      >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Salvar
                      </button>
                    </>
                  )}
                  <button 
                    onClick={handleClose}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-red-500"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Abas */}
          {(() => {
            const isPJ = profile.linkType === 'PJ' || profile.linkType === 'MEI' || isExternalEntity(inferEntityType(profile));
            return (
              <div className="flex border-b border-slate-100 px-6 shrink-0 bg-slate-50/50 overflow-x-auto whitespace-nowrap scrollbar-none">
                <button 
                  onClick={() => setActiveTab('pessoal')}
                  className={`px-5 py-4 text-xs font-black tracking-wider uppercase border-b-2 transition-all ${activeTab === 'pessoal' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  {isPJ ? 'Empresa & Prestador' : 'Info Pessoal'}
                </button>
                <button 
                  onClick={() => setActiveTab('endereco')}
                  className={`px-5 py-4 text-xs font-black tracking-wider uppercase border-b-2 transition-all ${activeTab === 'endereco' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  {isPJ ? 'Contato & Sede PJ' : 'Contato & Endereço'}
                </button>
                <button 
                  onClick={() => setActiveTab('complementar')}
                  className={`px-5 py-4 text-xs font-black tracking-wider uppercase border-b-2 transition-all ${activeTab === 'complementar' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  Dados Auxiliares
                </button>
                <button 
                  onClick={() => setActiveTab('fichaExecutiva')}
                  className={`px-5 py-4 text-xs font-black tracking-wider uppercase border-b-2 transition-all ${activeTab === 'fichaExecutiva' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  Ficha Executiva
                </button>
                {employeeId && (
                  <>
                    <button 
                      onClick={() => setActiveTab('trajetoria')}
                      className={`px-5 py-4 text-xs font-black tracking-wider uppercase border-b-2 transition-all ${activeTab === 'trajetoria' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                      Trajetória
                    </button>
                    <button 
                      onClick={() => setActiveTab('custo')}
                      className={`px-5 py-4 text-xs font-black tracking-wider uppercase border-b-2 transition-all ${activeTab === 'custo' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                      {isPJ ? 'Faturamento & Custos' : 'Custo Histórico'}
                    </button>
                    <button 
                      onClick={() => setActiveTab('auditoria')}
                      className={`px-5 py-4 text-xs font-black tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'auditoria' 
                          ? 'border-emerald-600 text-emerald-600 font-extrabold' 
                          : auditIssues.length > 0 
                            ? 'border-transparent text-amber-500 hover:text-amber-600' 
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <span>Auditoria</span>
                      {auditIssues.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                          {auditIssues.length}
                        </span>
                      )}
                    </button>
                    <button 
                      onClick={() => setActiveTab('acessos')}
                      className={`px-5 py-4 text-xs font-black tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'acessos' 
                          ? 'border-indigo-600 text-indigo-600 font-extrabold' 
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <KeyRound size={13} className={activeTab === 'acessos' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>Acessos &amp; Sistemas</span>
                      {((profile.system_accesses || (profile.metadata as any)?.system_accesses || []).length > 0) && (
                        <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 text-[9px] font-black">
                          {(profile.system_accesses || (profile.metadata as any)?.system_accesses || []).length}
                        </span>
                      )}
                    </button>

                    <button 
                      onClick={() => setActiveTab('bpr')}
                      className={`px-5 py-4 text-xs font-black tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'bpr' 
                          ? 'border-amber-500 text-amber-500 font-extrabold' 
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Coins size={13} className={activeTab === 'bpr' ? 'text-amber-500' : 'text-slate-400'} />
                      <span>BPR &amp; Metas</span>
                    </button>
                  </>
                )}
              </div>
            );
          })()}

           {/* Corpo Escrolável */}
          <div className="p-6 overflow-y-auto flex-1">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : (
               <div className="space-y-6">
                 {error && (
                   <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
                     <X size={16} /> {error}
                   </div>
                 )}

                 {/* ------------- ABA PESSOAL ------------- */}
                 {activeTab === 'pessoal' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      
                      {/* Avatar & Header */}
                      <div className="flex items-start gap-4">
                        <div className="relative group">
                          <img 
                            src={profile.photo_url || profile.avatar || "https://ui-avatars.com/api/?name=" + (profile.name || "Colab") + "&background=random"} 
                            alt="Avatar" 
                            className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-sm"
                          />
                          {isEditMode && (
                            <label className="absolute inset-0 bg-black/50 text-white rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                              <Upload size={18} className="mb-1" />
                              <span className="text-[10px] font-bold">Trocar</span>
                              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                            </label>
                          )}
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          {isEditMode && (
                            <div className="mb-2">
                              <input 
                                type="text" 
                                value={profile.photo_url || profile.avatar || ''} 
                                onChange={e => handleChange('photo_url', e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-3 outline-none focus:border-emerald-500"
                                placeholder="Ou cole a URL da foto aqui..."
                              />
                            </div>
                          )}
                          <div>
                            <label className={labelClass}>Nome Completo</label>
                            <input 
                              type="text" 
                              value={profile.name || ''} 
                              onChange={e => handleChange('name', e.target.value)} 
                              readOnly={!isEditMode}
                              className={`text-2xl font-black w-full outline-none bg-transparent ${isEditMode ? 'border-b border-slate-300 border-dashed focus:border-emerald-500 py-1' : 'text-slate-900 dark:text-white'}`}
                              placeholder="Maria José..."
                            />
                          </div>
                          <div className="flex gap-4">
                             <div className="flex-1">
                              <label className={labelClass}>Vínculo</label>
                              {isEditMode ? (
                                <select value={profile.linkType || 'CLT'} onChange={e => handleChange('linkType', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2">
                                  <option value="CLT">CLT</option>
                                  <option value="PJ">PJ</option>
                                  <option value="Estagiário">Estagiário</option>
                                </select>
                              ) : (
                                <span className="text-sm font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">{profile.linkType || '-'}</span>
                              )}
                             </div>
                             <div className="flex-1">
                              <label className={labelClass}>Empresa</label>
                               {isEditMode ? (
                                <select value={profile.company || 'MarBR'} onChange={e => handleChange('company', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2">
                                  <option value="MarBR">MarBR</option>
                                  <option value="DZM">DZM</option>
                                  <option value="G2">G2</option>
                                </select>
                              ) : (
                                <span className="text-sm font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">{profile.company || '-'}</span>
                              )}
                             </div>
                             <div className="flex-1">
                              <label className={labelClass}>Camada</label>
                              {isEditMode ? (
                                <select value={profile.camada || ''} onChange={e => handleChange('camada', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2">
                                  <option value="">Selecione...</option>
                                  <option value="Estratégico">Estratégico</option>
                                  <option value="Tático">Tático</option>
                                  <option value="Operacional">Operacional</option>
                                </select>
                              ) : (
                                <span className="text-sm font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">{profile.camada || '-'}</span>
                              )}
                             </div>
                             <div className="flex-1">
                              <label className={labelClass}>Grau</label>
                              {isEditMode ? (
                                <select value={profile.grau || ''} onChange={e => handleChange('grau', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2">
                                  <option value="">Selecione...</option>
                                  <option value="Iniciante">Iniciante</option>
                                  <option value="Intermediário">Intermediário</option>
                                  <option value="Avançado">Avançado</option>
                                </select>
                              ) : (
                                <span className="text-sm font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">{profile.grau || '-'}</span>
                              )}
                             </div>
                             <div className="flex-1">
                              <label className={labelClass}>Nível</label>
                              {isEditMode ? (
                                <select value={profile.nivel_enquadramento || profile.nivel || ''} onChange={e => { handleChange('nivel_enquadramento', e.target.value); handleChange('nivel', e.target.value); }} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2">
                                  <option value="">Selecione...</option>
                                  <option value="I">I</option>
                                  <option value="II">II</option>
                                  <option value="III">III</option>
                                </select>
                              ) : (
                                <span className="text-sm font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">{profile.nivel_enquadramento || (['I', 'II', 'III'].includes(profile.grau || '') ? profile.grau : '-') || '-'}</span>
                              )}
                             </div>
                           </div>
                          
                          <div>
                            <label className={labelClass}>Natureza da Relação (Diana PB)</label>
                            {isEditMode ? (
                              <select 
                                value={profile.relationshipNature || ''} 
                                onChange={e => handleChange('relationshipNature', e.target.value as RelationshipNature)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2 outline-none focus:border-emerald-500"
                              >
                                <option value="">Selecione...</option>
                                <option value="CLT">CLT</option>
                                <option value="PJ-MEI">PJ-MEI</option>
                                <option value="PJ-Simples">PJ-Simples</option>
                              </select>
                            ) : (
                              <div className="text-xs font-semibold bg-slate-100 px-2 py-1 rounded text-slate-700 mt-1 self-start inline-block uppercase">
                                {profile.relationshipNature ? (RELATIONSHIP_NATURE_LABELS[profile.relationshipNature] || profile.relationshipNature) : 'Não Definido'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Loans Indicator & Redirect */}
                      {profile.id && (profile.totalTaken || 0) > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                              <Coins size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">
                                Registro de Empréstimos Consignados
                              </p>
                              <p className="text-[10px] text-slate-500 font-medium">
                                {profile.balance && profile.balance > 0 
                                  ? `Possui saldo devedor ativo de ${formatCurrency(profile.balance)}`
                                  : 'Já realizou empréstimo(s) no passado (atualmente quitado)'}
                              </p>
                            </div>
                          </div>
                          <a 
                            href="/emprestimos" 
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 shrink-0 shadow-sm transition-all active:scale-95"
                          >
                            <ExternalLink size={10} /> Detalhes
                          </a>
                        </div>
                      )}

                      {/* Fields */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                        <div>
                          <label className={labelClass}>CPF</label>
                          <input type="text" value={profile.document_id || ''} onChange={e => handleCPFChange(e.target.value)} readOnly={!isEditMode} className={inputClass} placeholder="000.000.000-00"/>
                        </div>
                        <div>
                          <label className={labelClass}>RG</label>
                          <input type="text" value={profile.document_rg || ''} onChange={e => handleChange('document_rg', e.target.value)} readOnly={!isEditMode} className={inputClass} placeholder="00.000.000-0"/>
                        </div>
                        <div>
                          <label className={labelClass}>E-mail Profissional</label>
                          <input 
                            type="email" 
                            value={profile.email_professional || ''} 
                            onChange={e => handleChange('email_professional', e.target.value)} 
                            readOnly={!isEditMode} 
                            className={inputClass} 
                            placeholder="usuario@empresa.com"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Telefone Profissional</label>
                          <input 
                            type="text" 
                            value={profile.phone_professional || ''} 
                            onChange={e => handleProfessionalPhoneChange(e.target.value)} 
                            readOnly={!isEditMode} 
                            className={inputClass} 
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Valor Fixo / Salário Base</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={profile.remuneration_fixed ?? ''} 
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              handleChange('remuneration_fixed', val);
                              const tot = val + (profile.remuneration_bonus || 0) + (profile.remuneration_commission || 0) + (profile.remuneration_connectivity || 0) + (profile.remuneration_incentives || 0);
                              handleChange('remuneration', tot);
                            }} 
                            readOnly={!isEditMode} 
                            className={inputClass} 
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Bônus</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={profile.remuneration_bonus ?? ''} 
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              handleChange('remuneration_bonus', val);
                              const tot = (profile.remuneration_fixed || 0) + val + (profile.remuneration_commission || 0) + (profile.remuneration_connectivity || 0) + (profile.remuneration_incentives || 0);
                              handleChange('remuneration', tot);
                            }} 
                            readOnly={!isEditMode} 
                            className={inputClass} 
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Conectividade</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={profile.remuneration_connectivity ?? ''} 
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              handleChange('remuneration_connectivity', val);
                              const tot = (profile.remuneration_fixed || 0) + (profile.remuneration_bonus || 0) + (profile.remuneration_commission || 0) + val + (profile.remuneration_incentives || 0);
                              handleChange('remuneration', tot);
                            }} 
                            readOnly={!isEditMode} 
                            className={inputClass} 
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Incentivos</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={profile.remuneration_incentives ?? ''} 
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              handleChange('remuneration_incentives', val);
                              const tot = (profile.remuneration_fixed || 0) + (profile.remuneration_bonus || 0) + (profile.remuneration_commission || 0) + (profile.remuneration_connectivity || 0) + val;
                              handleChange('remuneration', tot);
                            }} 
                            readOnly={!isEditMode} 
                            className={inputClass} 
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Plano de Comissão</label>
                          <select
                              value={profile.commission_plan || ''}
                              onChange={e => handleChange('commission_plan', e.target.value)}
                              disabled={!isEditMode}
                              className={inputClass}
                            >
                              <option value="">Sem Comissão</option>
                              <option value="Sim">Sim</option>
                              <option value="Não">Não</option>
                            </select>
                        </div>
                        <div>
                          <label className={labelClass}>{getRemunerationLabel(profile.linkType || 'CLT').bruto} (Total Geral)</label>
                          <div className={`py-3 text-base text-slate-900 dark:text-white font-extrabold`}>
                            {formatCurrency((profile.remuneration_fixed || 0) + (profile.remuneration_bonus || 0) + (profile.remuneration_commission || 0) + (profile.remuneration_connectivity || 0) + (profile.remuneration_incentives || 0))}
                          </div>
                        </div>
                        <div>
                           <label className={labelClass}>Chave PIX</label>
                           <input type="text" value={profile.pix_key || ''} onChange={e => handleChange('pix_key', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                         </div>
                           <div>
                             <div className="flex items-center justify-between">
                               <label className={labelClass}>Data de Admissão / Início</label>
                               {!isEditMode && profile.start_date && (
                                 <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                   {formatCompanyTime(
                                     profile.linked_previous_employee_id && previousEmployeeProfile?.start_date && profile.is_unified_history !== false
                                       ? previousEmployeeProfile.start_date
                                       : profile.start_date,
                                     profile.status === 'Inativo' ? (profile.resignation_date || profile.status_end_date) : undefined
                                   )}
                                   {profile.linked_previous_employee_id && previousEmployeeProfile?.start_date && profile.is_unified_history !== false && " (CLT + PJ)"}
                                 </span>
                               )}
                             </div>
                             <input type="date" name="start_date" value={profile.start_date || ''} onChange={e => handleChange('start_date', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           </div>
                           <div>
                             <label className={labelClass}>Vencimento Contrato/Aditivo</label>
                             <input 
                               type="date" 
                               name="contract_expiry_date" 
                               value={profile.contract_expiry_date || ''} 
                               onChange={e => handleChange('contract_expiry_date', e.target.value)} 
                               readOnly={!isEditMode} 
                               className={inputClass}
                             />
                             <span className="text-[9px] text-slate-400 mt-0.5 block">Para alertas e monitoramento de renovação</span>
                           </div>
                           <div>
                             <div className="flex items-center justify-between">
                               <label className={labelClass}>Final de Contrato</label>
                               {!isEditMode && (profile.resignation_date || profile.status_end_date) && (
                                 <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                                   Encerrado
                                 </span>
                               )}
                             </div>
                             <input 
                               type="date" 
                               name="resignation_date" 
                               value={profile.resignation_date || profile.status_end_date || ''} 
                               onChange={e => { 
                                 handleChange('resignation_date', e.target.value); 
                                 handleChange('status_end_date', e.target.value); 
                               }} 
                               readOnly={!isEditMode} 
                               className={inputClass}
                             />
                             <span className="text-[9px] text-slate-400 mt-0.5 block">Data fim em caso de distrato / não renovação</span>
                           </div>
                           <div>
                             <label className={labelClass}>Data Revisão Valor Base</label>
                             <input type="date" name="last_raise_date" value={profile.last_raise_date || ''} onChange={e => handleChange('last_raise_date', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                             <span className="text-[9px] text-slate-400 mt-0.5 block">Se vazio, usará a Data de Admissão nos alertas</span>
                           </div>
                           <div>
                              <label className={labelClass}>Data Alteração Grau</label>
                              <input type="date" name="last_grade_date" value={profile.last_grade_date || ''} onChange={e => handleChange('last_grade_date', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                              <span className="text-[9px] text-slate-400 mt-0.5 block">Se vazio, usará a Data de Admissão nos alertas</span>
                           </div>

                        {/* BLOCO DE UNIFICAÇÃO DE VÍNCULO (TRANSIÇÃO CLT -> PJ) */}
                        <div className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 mt-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <LinkIcon className="w-4 h-4 text-indigo-600" />
                              <span className="text-xs font-bold text-slate-900">Unificação de Cadastro (Transição CLT ➔ PJ)</span>
                            </div>
                            {profile.linked_previous_employee_id && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200">
                                ✦ Histórico Unificado (CLT + PJ)
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className={labelClass}>Vincular ao Cadastro CLT / Anterior</label>
                                {isEditMode && !profile.linked_previous_employee_id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const match = allEmployees.find(e => 
                                        e.id !== profile.id && 
                                        (e.name.toLowerCase().trim() === (profile.name || '').toLowerCase().trim() ||
                                         (e.document_id && profile.document_id && e.document_id.replace(/\D/g, '') === profile.document_id.replace(/\D/g, '')))
                                      );
                                      if (match) {
                                        handleChange('linked_previous_employee_id', match.id);
                                        handleChange('is_unified_history', true);
                                      } else {
                                        alert("Nenhum outro cadastro com nome ou CPF idêntico foi encontrado para vincular automaticamente.");
                                      }
                                    }}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                                  >
                                    ⚡ Auto-Detectar Cadastro CLT
                                  </button>
                                )}
                              </div>
                              {isEditMode ? (
                                <select
                                  value={profile.linked_previous_employee_id || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    handleChange('linked_previous_employee_id', val);
                                    if (val) handleChange('is_unified_history', true);
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2 outline-none focus:border-indigo-500 font-medium"
                                >
                                  <option value="">Nenhum (Cadastro Independente)</option>
                                  {allEmployees
                                    .filter(e => e.id !== profile.id)
                                    .map(e => (
                                      <option key={e.id} value={e.id}>
                                        🔗 {e.name} ({e.linkType || 'CLT'} - {e.status})
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <span className="text-xs font-semibold text-slate-700 block mt-1">
                                  {profile.linked_previous_employee_id
                                    ? `Vincular a: ${allEmployees.find(e => e.id === profile.linked_previous_employee_id)?.name || previousEmployeeProfile?.name || profile.linked_previous_employee_id}`
                                    : 'Nenhum vínculo anterior acumulado'}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-5">
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={profile.is_unified_history !== false}
                                  onChange={e => handleChange('is_unified_history', e.target.checked)}
                                  disabled={!isEditMode || !profile.linked_previous_employee_id}
                                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 disabled:opacity-50"
                                />
                                <span>Somar tempo de casa e valores acumulados nos dois regimes</span>
                              </label>
                            </div>
                          </div>
                        </div>
                        
                        <div className="col-span-2 mt-4">
                           <div className="flex justify-between items-center mb-2">
                              <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Files size={12} /> Contratos e Documentos Base
                              </h4>
                              {profile.id && (
                                <label className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded cursor-pointer hover:bg-emerald-100 transition-all flex items-center gap-1">
                                  <Upload size={12} /> Anexar Documento
                                  <input type="file" className="hidden" onChange={handleBaseContractUpload} />
                                </label>
                              )}
                           </div>
                           <div className="space-y-2">
                              {profile.links_contratos?.split('\n').filter(l => l.trim()).map((line, idx) => {
                                const urlMatch = line.match(/\((.*?)\)/);
                                const labelMatch = line.match(/\[(.*?)\]/);
                                const url = urlMatch ? urlMatch[1] : null;
                                const label = labelMatch ? labelMatch[1] : line;
                                
                                return (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg group">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      <FileText size={14} className="text-blue-500 shrink-0" />
                                      {url ? (
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-600 hover:underline truncate">
                                          {label}
                                        </a>
                                      ) : (
                                        <span className="text-xs text-slate-600 truncate">{line}</span>
                                      )}
                                    </div>
                                    <button onClick={() => handleDeleteLink('links_contratos', line)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                );
                              })}
                              {!profile.links_contratos && <p className="text-[10px] text-slate-400 italic">Nenhum documento anexado.</p>}
                           </div>
                        </div>

                        <div>
                          <label className={labelClass}>Status</label>
                           {isEditMode ? (
                                <select value={profile.status || 'Ativo'} onChange={e => handleChange('status', e.target.value as Employee['status'])} className={inputClass}>
                                  <option value="Ativo">Ativo</option>
                                  <option value="Férias">Férias</option>
                                  <option value="Inativo">Inativo</option>
                                </select>
                           ) : (
                                <div className="text-sm font-semibold flex items-center gap-2 mt-2">
                                  {profile.status === 'Ativo' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <X size={16} className="text-red-500" />} 
                                  {profile.status}
                                </div>
                           )}
                        </div>

                        <div className="col-span-2 pt-4 border-t border-dashed border-slate-200">
                          {(() => {
                            const isPJ = profile.linkType === 'PJ' || profile.linkType === 'MEI' || isExternalEntity(inferEntityType(profile));
                            return (
                              <>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-3">
                                  <Briefcase size={11}/> {isPJ ? 'Atuação — Área Atendida & Escopo do Serviço' : 'Posição Atual — Histórico de Setor & Cargo'}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <label className={labelClass}>{isPJ ? 'Área Atendida / Unidade' : 'Setor / Departamento'}</label>
                                    <input 
                                      type="text" 
                                      value={profile.department || ''} 
                                      onChange={e => {
                                        const val = e.target.value;
                                        const normalized = val ? val.charAt(0).toUpperCase() + val.slice(1) : val;
                                        handleChange('department', normalized);
                                      }} 
                                      readOnly={!isEditMode} 
                                      className={inputClass} 
                                      placeholder={isPJ ? "Ex: Operações, Jurídico..." : "Ex: Administrativo"}
                                      list="setores-list"
                                    />
                                    <datalist id="setores-list">
                                      {setores.map(s => <option key={s} value={s} />)}
                                    </datalist>
                                  </div>
                                  <div>
                                    <label className={labelClass}>{isPJ ? 'Escopo do Serviço / Especialidade' : 'Cargo / Função'}</label>
                                    <input 
                                      type="text" 
                                      value={profile.job_role || ''} 
                                      onChange={e => handleChange('job_role', e.target.value)} 
                                      readOnly={!isEditMode} 
                                      className={inputClass} 
                                      placeholder={isPJ ? "Ex: Consultoria em TI, Médico..." : "Ex: Analista Financeiro"}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>{isPJ ? 'Início nesta Atuação / Escopo' : 'Início neste Setor/Função'}</label>
                                    <input 
                                      type="date" 
                                      value={profile.department_start_date || ''} 
                                      onChange={e => handleChange('department_start_date', e.target.value)} 
                                      readOnly={!isEditMode} 
                                      className={inputClass}
                                    />
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                          <div className="mt-3 space-y-2">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Histórico de Mudanças</p>
                              {history.filter(h => h.event_type?.toLowerCase().includes('setor') || h.event_type?.toLowerCase().includes('cargo') || h.event_type?.toLowerCase().includes('função')).map((h, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{h.event_type}</span>
                                  <span className="text-[10px] text-slate-500">{h.change_date}</span>
                                  {h.observations && <span className="text-[10px] text-slate-600 truncate">{h.observations}</span>}
                                </div>
                              ))}
                            </div>
                        </div>
                      </div>
                    </motion.div>
                 )}

                 {/* ------------- ABA CONTATO & ENDEREÇO ------------- */}
                 {activeTab === 'endereco' && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                       
                       {/* Seção 1: Contatos Pessoais */}
                       <div>
                         <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2.5 mb-4 flex items-center gap-2">
                           <Phone size={16}/> Contatos Pessoais
                         </h4>
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className={labelClass}>E-mail Pessoal</label>
                             <input type="email" value={profile.email || ''} onChange={e => handleChange('email', e.target.value)} readOnly={!isEditMode} className={inputClass} placeholder="usuario@gmail.com"/>
                           </div>
                           <div>
                             <label className={labelClass}>Telefone Pessoal</label>
                             <input type="text" value={profile.phone || ''} onChange={e => handlePhoneChange(e.target.value)} readOnly={!isEditMode} className={inputClass} placeholder="(00) 00000-0000"/>
                           </div>
                         </div>
                       </div>

                       {/* Seção 2: Endereço Residencial */}
                       <div>
                         <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2.5 mb-4 flex items-center gap-2">
                           <Home size={16}/> Endereço Residencial
                         </h4>
                         <div className="grid grid-cols-12 gap-4">
                           <div className="col-span-12 md:col-span-4">
                              <div className="flex justify-between items-center">
                                <label className={labelClass}>CEP</label>
                                <div className="flex items-center gap-1.5 mb-1">
                                  {isSearchingCEP && (
                                    <span className="text-[10px] text-blue-500 animate-pulse font-medium">Buscando...</span>
                                  )}
                                  {cepError && (
                                    <span className="text-[10px] text-red-500 font-medium">{cepError}</span>
                                  )}
                                  {!isSearchingCEP && !cepError && isEditMode && (
                                    <button type="button" onClick={() => handleBuscarCEP()} className="text-[10px] text-emerald-600 font-bold hover:underline">
                                      Buscar
                                    </button>
                                  )}
                                </div>
                              </div>
                              <input 
                                type="text" 
                                value={profile.zip_code || ''} 
                                onChange={e => handleCEPChange(e.target.value)} 
                                maxLength={9}
                                readOnly={!isEditMode} 
                                className={inputClass} 
                                placeholder="00000-000"
                              />
                           </div>
                           <div className="col-span-12 md:col-span-8">
                              <label className={labelClass}>Logradouro</label>
                              <input type="text" value={profile.street || ''} onChange={e => handleChange('street', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           </div>
                           
                           <div className="col-span-4">
                              <label className={labelClass}>Número</label>
                              <input type="text" value={profile.number || ''} onChange={e => handleChange('number', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           </div>
                           <div className="col-span-8">
                              <label className={labelClass}>Complemento</label>
                              <input type="text" value={profile.complement || ''} onChange={e => handleChange('complement', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           </div>

                           <div className="col-span-12 md:col-span-6">
                              <label className={labelClass}>Bairro</label>
                              <input type="text" value={profile.neighborhood || ''} onChange={e => handleChange('neighborhood', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           </div>
                           <div className="col-span-9 md:col-span-4">
                              <label className={labelClass}>Cidade</label>
                              <input type="text" value={profile.city || ''} onChange={e => handleChange('city', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           </div>
                           <div className="col-span-3 md:col-span-2">
                              <label className={labelClass}>UF</label>
                              <input type="text" value={profile.state || ''} onChange={e => handleChange('state', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           </div>
                         </div>
                       </div>

                       {/* Seção 3: Endereço da Empresa (CNPJ) - se for PJ */}
                       {profile.linkType === 'PJ' && (
                         <div>
                           <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2.5 mb-4 flex items-center gap-2">
                             <Building2 size={16}/> Endereço da Empresa (CNPJ)
                           </h4>
                           <div className="grid grid-cols-12 gap-4">
                             {isEditMode && (
                               <div className="col-span-12 flex items-center gap-2 mb-2">
                                 <input 
                                   type="checkbox" 
                                   id="copiarEndereco" 
                                   onChange={e => handleCopyAddress(e.target.checked)}
                                   className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                 />
                                 <label htmlFor="copiarEndereco" className="text-xs font-bold text-slate-600 cursor-pointer">
                                   Endereço da empresa é o mesmo do endereço pessoal
                                 </label>
                               </div>
                             )}

                             <div className="col-span-12 md:col-span-4">
                                <div className="flex justify-between items-center">
                                  <label className={labelClass}>CEP da Empresa</label>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    {isSearchingCNPJCEP && (
                                      <span className="text-[10px] text-blue-500 animate-pulse font-medium">Buscando...</span>
                                    )}
                                    {cnpjCepError && (
                                      <span className="text-[10px] text-red-500 font-medium">{cnpjCepError}</span>
                                    )}
                                    {!isSearchingCNPJCEP && !cnpjCepError && isEditMode && (
                                      <button type="button" onClick={() => handleBuscarCNPJCEP()} className="text-[10px] text-emerald-600 font-bold hover:underline">
                                        Buscar
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <input 
                                  type="text" 
                                  value={profile.cnpj_zip_code || ''} 
                                  onChange={e => handleCNPJCEPChange(e.target.value)} 
                                  maxLength={9}
                                  readOnly={!isEditMode} 
                                  className={inputClass} 
                                  placeholder="00000-000"
                                />
                             </div>
                             <div className="col-span-12 md:col-span-8">
                                 <div className="flex justify-between items-center">
                                   <label className={labelClass}>Logradouro da Empresa</label>
                                   {isEditMode && (
                                     <button
                                       type="button"
                                       onClick={() => handleBuscarCEPPorEndereco(true)}
                                       className="text-[10px] text-indigo-600 font-bold hover:underline mb-1 flex items-center gap-1 cursor-pointer"
                                     >
                                       🔍 Buscar CEP por Endereço
                                     </button>
                                   )}
                                 </div>
                                 <input type="text" value={profile.cnpj_street || ''} onChange={e => handleChange('cnpj_street', e.target.value)} readOnly={!isEditMode} className={inputClass} placeholder="Rua / Av..."/>
                             </div>
                             
                             <div className="col-span-4">
                                <label className={labelClass}>Número</label>
                                <input type="text" value={profile.cnpj_number || ''} onChange={e => handleChange('cnpj_number', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                             </div>
                             <div className="col-span-8">
                                <label className={labelClass}>Complemento</label>
                                <input type="text" value={profile.cnpj_complement || ''} onChange={e => handleChange('cnpj_complement', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                             </div>

                             <div className="col-span-12 md:col-span-6">
                                <label className={labelClass}>Bairro</label>
                                <input type="text" value={profile.cnpj_neighborhood || ''} onChange={e => handleChange('cnpj_neighborhood', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                             </div>
                             <div className="col-span-9 md:col-span-4">
                                <label className={labelClass}>Cidade</label>
                                <input type="text" value={profile.cnpj_city || ''} onChange={e => handleChange('cnpj_city', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                             </div>
                             <div className="col-span-3 md:col-span-2">
                                <label className={labelClass}>UF</label>
                                <input type="text" value={profile.cnpj_state || ''} onChange={e => handleChange('cnpj_state', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                             </div>
                           </div>
                         </div>
                       )}

                       {/* Seção 4: Contatos de Referência & Emergência */}
                       <div>
                         <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2.5 mb-4 flex items-center gap-2">
                           <MapPin size={16}/> Contatos de Referência & Emergência
                         </h4>
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className={labelClass}>Nome (Emergência)</label>
                             <input type="text" value={profile.emergency_contact_name || ''} onChange={e => handleChange('emergency_contact_name', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           </div>
                           <div>
                             <label className={labelClass}>Telefone (Emergência)</label>
                             <input type="text" value={profile.emergency_contact_phone || ''} onChange={e => handleChange('emergency_contact_phone', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           </div>
                           <div>
                             <label className={labelClass}>Nome (Referência Pessoal)</label>
                             <input type="text" value={profile.pessoa_referencia_nome || ''} onChange={e => handleChange('pessoa_referencia_nome', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           </div>
                           <div>
                             <label className={labelClass}>Telefone (Referência Pessoal)</label>
                             <input type="text" value={profile.pessoa_referencia_telefone || ''} onChange={e => handleChange('pessoa_referencia_telefone', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           </div>
                         </div>
                       </div>

                     </motion.div>
                  )}

                 {/* ------------- ABA COMPLEMENTAR ------------- */}
                 {activeTab === 'complementar' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        
                        {/* Seção 1: Controle Trabalhista & Localidade */}
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2.5 mb-4 flex items-center gap-2">
                            <Briefcase size={16}/> Controle & Localidade
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={labelClass}>Faz parte de Terceirização?</label>
                              {isEditMode ? (
                                <select 
                                  value={profile.is_outsourced ? 'true' : 'false'} 
                                  onChange={e => handleChange('is_outsourced', e.target.value === 'true')} 
                                  className={inputClass}
                                >
                                  <option value="false">Não (Contratação Direta)</option>
                                  <option value="true">Sim (Terceirizado)</option>
                                </select>
                              ) : (
                                <span className="text-sm font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                                  {profile.is_outsourced ? 'Sim (Terceirizado)' : 'Não'}
                                </span>
                              )}
                            </div>
                            <div>
                              <label className={labelClass}>Local de Prestação do Serviço</label>
                              {isEditMode ? (
                                <>
                                  <input
                                    list="service-locations-list"
                                    value={profile.service_location || ''}
                                    onChange={e => handleChange('service_location', e.target.value)}
                                    className={inputClass}
                                    placeholder="Digite ou selecione um local..."
                                  />
                                  <datalist id="service-locations-list">
                                    {serviceLocations.map((loc, i) => (
                                      <option key={i} value={loc} />
                                    ))}
                                    <option value="Escritório" />
                                    <option value="Home Office" />
                                    <option value="Cliente" />
                                    <option value="Híbrido" />
                                  </datalist>
                                </>
                              ) : (
                                <span className="text-sm font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                                  {profile.service_location || 'Não Definido'}
                                </span>
                              )}
                            </div>
                            <div className="col-span-2">
                              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-xl hover:bg-amber-100 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={profile.has_invoice_glosa || false}
                                  onChange={e => isEditMode && handleChange('has_invoice_glosa', e.target.checked)}
                                  disabled={!isEditMode}
                                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                                />
                                <span className="flex items-center gap-1.5"><AlertCircle size={14}/> Houve Glosa na última NF deste prestador</span>
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* PJ Data (if applicable) */}
                        {profile.linkType === 'PJ' && (
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2.5 mb-4">Dados da Empresa (PJ)</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2 md:col-span-1">
                                <label className={labelClass}>CNPJ</label>
                                <input 
                                  type="text" 
                                  value={profile.pj_type || ''} 
                                  onChange={e => handleCNPJChange(e.target.value)} 
                                  readOnly={!isEditMode} 
                                  className={inputClass} 
                                  placeholder="00.000.000/0000-00"
                                />
                              </div>
                              <div className="col-span-2 md:col-span-1">
                                <label className={labelClass}>Regime Tributário</label>
                                {isEditMode ? (
                                  <select 
                                    value={profile.tax_regime || ''} 
                                    onChange={e => handleChange('tax_regime', e.target.value)} 
                                    className={inputClass}
                                  >
                                    <option value="">Selecione o regime...</option>
                                    <option value="MEI">MEI (Microempreendedor Individual)</option>
                                    <option value="Simples Nacional">Simples Nacional</option>
                                    <option value="Lucro Presumido">Lucro Presumido</option>
                                    <option value="Lucro Real">Lucro Real</option>
                                  </select>
                                ) : (
                                  <span className="text-sm font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                                    {profile.tax_regime || 'Não Identificado'}
                                  </span>
                                )}
                              </div>
                              <div className="col-span-2">
                                <label className={labelClass}>Razão Social</label>
                                <input type="text" value={profile.corporate_name || ''} onChange={e => handleChange('corporate_name', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                              </div>
                              <div>
                                <label className={labelClass}>Representante Legal (Sincronizado)</label>
                                <input type="text" value={profile.responsible_name || ''} readOnly className={`${inputClass} bg-slate-50 cursor-not-allowed`} placeholder="Auto-preenchido pelo nome pessoal"/>
                              </div>
                              <div>
                                <label className={labelClass}>CPF do Responsável (Sincronizado)</label>
                                <input type="text" value={profile.responsible_cpf || ''} readOnly className={`${inputClass} bg-slate-50 cursor-not-allowed`} placeholder="Auto-preenchido pelo CPF pessoal"/>
                              </div>
                            </div>
                          </div>
                        )}

                       <div>
                         <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2.5 mb-5 flex items-center gap-2"><GraduationCap size={16}/> Background Institucional</h4>
                         <div className="grid grid-cols-1 gap-4">
                           <div>
                             <label className={labelClass}>Histórico de Formação (Grau / Curso / Instituição)</label>
                             <textarea 
                               value={profile.education_data && Array.isArray(profile.education_data) 
                                 ? profile.education_data.map(e => `${e.level} em ${e.area}`).join('\n') 
                                 : typeof profile.education_data === 'string' 
                                   ? profile.education_data 
                                   : ''} 
                               onChange={e => {
                                 const lines = e.target.value.split('\n');
                                 const parsed = lines.map(line => {
                                   const parts = line.split(' em ');
                                   return {
                                     level: parts[0] || line,
                                     area: parts[1] || ''
                                   };
                                 });
                                 handleChange('education_data', parsed);
                               }}
                               readOnly={!isEditMode} 
                               className={`${inputClass} min-h-[60px] resize-y`}
                               placeholder="Tecnólogo em Análise de Sistemas - Fatec..."
                             />
                           </div>
                           <div>
                             <div className="flex justify-between items-center mb-2">
                               <label className="text-xs font-black text-slate-500 uppercase block">Meus Aditivos (Links ou Observações)</label>
                               {profile.id && (
                                 <label className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded cursor-pointer hover:bg-emerald-100 flex items-center gap-1 transition-all">
                                   <Upload size={14} />
                                   Anexar Arquivo
                                   <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png" onChange={handleAdditiveUpload} />
                                 </label>
                               )}
                             </div>
                             <textarea 
                               value={profile.links_aditivos || ''} 
                               onChange={e => handleChange('links_aditivos', e.target.value)} 
                               readOnly={!isEditMode} 
                               className={`${inputClass} min-h-[60px] resize-y`}
                               placeholder="Insira os links para os PDFs de aditivos ou clique em Anexar Arquivo..."
                             />
                           </div>
                         </div>
                       </div>


                     </motion.div>
                  )}

                  {/* ------------- ABA FICHA EXECUTIVA ------------- */}
                  {activeTab === 'fichaExecutiva' && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        
                        <div className="border-b pb-2">
                          <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                            <UserRound size={16} className="text-emerald-600" /> Ficha Executiva
                          </h4>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClass}>Escopo do Contrato (Sincronizado)</label>
                            <input 
                              type="text" 
                              value={profile.job_role || ''} 
                              readOnly 
                              className={`${inputClass} bg-slate-50 cursor-not-allowed`} 
                              placeholder="Preencha na aba Info Pessoal" 
                            />
                          </div>

                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClass}>Link / Anexo da Ficha Executiva Completa</label>
                            <input 
                              type="text" 
                              value={profile.executive_link || ''} 
                              onChange={e => handleChange('executive_link', e.target.value)} 
                              readOnly={!isEditMode} 
                              className={inputClass} 
                              placeholder="Ex: https://drive.google.com/..." 
                            />
                          </div>

                          <div className="col-span-2">
                            <label className={labelClass}>Resumo das Atividades</label>
                            <textarea 
                              value={profile.executive_summary || ''} 
                              onChange={e => handleChange('executive_summary', e.target.value)} 
                              readOnly={!isEditMode} 
                              className={`${inputClass} min-h-[140px] resize-y`} 
                              placeholder="Descreva detalhadamente o escopo e as principais responsabilidades desempenhadas pelo colaborador..." 
                            />
                          </div>
                        </div>

                        {/* Seção de Vínculos e Interfaces Organizacionais */}
                        <div className="border-t pt-6 mt-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <Network size={14} className="text-emerald-600" /> Interfaces e Vínculos Organizacionais
                            </h4>
                            {!isEditMode && (
                              <button 
                                type="button" 
                                onClick={() => setIsEditMode(true)} 
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] rounded uppercase font-bold transition-colors flex items-center gap-1.5"
                              >
                                <Edit3 size={12} /> Editar Vínculos
                              </button>
                            )}
                          </div>

                          {/* Listagem de Vínculos Atuais */}
                          <div className="space-y-2 mb-4">
                            {(!profile.relationships || profile.relationships.length === 0) ? (
                              <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                                Nenhum vínculo ou interface cadastrada para esta cadeira.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {profile.relationships.map((rel, idx) => {
                                  const targetEmp = allEmployees.find(e => e.id === rel.employee_id);
                                  const targetName = targetEmp ? (isExternalEntity(targetEmp.entityType) && targetEmp.corporate_name ? targetEmp.corporate_name : targetEmp.name) : "Colaborador não encontrado";
                                  const targetRole = targetEmp ? (targetEmp.job_role || "Sem Cadeira") : "";
                                  
                                  return (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-150 dark:border-slate-800 transition-all hover:bg-slate-100/55">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate uppercase">
                                          {targetName}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-semibold truncate">
                                          {targetRole}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 ml-2 shrink-0">
                                        {rel.relation_type === 'orientadora' && (
                                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-100">
                                            <ArrowUpRight size={8} className="stroke-[3]" /> Acima
                                          </span>
                                        )}
                                        {rel.relation_type === 'apoiada' && (
                                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-sky-50 text-sky-700 border border-sky-100">
                                            <ArrowDownRight size={8} className="stroke-[3]" /> Abaixo
                                          </span>
                                        )}
                                        {rel.relation_type === 'equivalent' && (
                                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-750 border border-slate-200">
                                            <ArrowLeftRight size={8} className="stroke-[3]" /> Equivalente
                                          </span>
                                        )}
                                        
                                        {isEditMode && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveRelationship(rel.employee_id)}
                                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                                            title="Remover relacionamento"
                                          >
                                            <X size={12} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Formulário para Adicionar Novo Vínculo */}
                          {isEditMode && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-3">
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                Adicionar Nova Interface / Vínculo
                              </p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                <div className="md:col-span-6">
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                    Selecionar Integrante
                                  </label>
                                  <select
                                    value={newRelEmployeeId}
                                    onChange={e => setNewRelEmployeeId(e.target.value)}
                                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200"
                                  >
                                    <option value="">Selecione...</option>
                                    {allEmployees
                                      .filter(e => e.id !== profile.id && e.status !== 'Inativo')
                                      .map(e => {
                                        const name = isExternalEntity(e.entityType) && e.corporate_name ? e.corporate_name : e.name;
                                        return (
                                          <option key={e.id} value={e.id}>
                                            {name.toUpperCase()} ({e.job_role || 'Sem Cadeira'})
                                          </option>
                                        );
                                      })}
                                  </select>
                                </div>

                                <div className="md:col-span-4">
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                    Grau do Vínculo
                                  </label>
                                  <select
                                    value={newRelType}
                                    onChange={e => setNewRelType(e.target.value as any)}
                                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200"
                                  >
                                    <option value="equivalent">Equivalente (Interface Lateral)</option>
                                    <option value="orientadora">Acima (Orientadora / Liderança)</option>
                                    <option value="apoiada">Abaixo (Apoiada / Liderados)</option>
                                  </select>
                                </div>

                                <div className="md:col-span-2">
                                  <button
                                    type="button"
                                    onClick={handleAddRelationship}
                                    className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-3 rounded-xl transition-all uppercase active:scale-95 shadow-sm"
                                  >
                                    Adicionar
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                      </motion.div>
                   )}

                 {/* ------------- ABA TRAJETÓRIA ------------- */}
                  {activeTab === 'trajetoria' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                          <Briefcase size={16} className="text-emerald-600" /> Trajetória Profissional
                        </h4>
                      </div>
                      
                      <EmploymentBondTimeline 
                        bonds={bonds} 
                        startDate={profile.start_date} 
                        additives={history}
                        links_contratos={profile.links_contratos}
                        links_aditivos={profile.links_aditivos}
                        status_end_date={profile.status_end_date}
                      />

                      {/* Gestão de Vínculos e Histórico visíveis apenas no modo de edição */}
                      {isEditMode && (
                        <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-4 duration-300">
                          {/* Vínculos Contratuais */}
                          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/80 p-4">
                            <div className="flex justify-between items-center mb-3">
                              <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-300">
                                Transições de Vínculos (Contratos)
                              </h5>
                              <button
                                type="button"
                                onClick={() => setEditingBond({ regime: 'CLT', remuneration_base: 0, remuneration_bonus: 0, remuneration_incentives: 0, status: 'Ativo', start_date: new Date().toISOString().split('T')[0] })}
                                className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg shadow-sm transition-all"
                              >
                                + Adicionar Vínculo
                              </button>
                            </div>
                            {bonds.length === 0 ? (
                              <p className="text-xs text-slate-400 italic py-2">Nenhum vínculo registrado.</p>
                            ) : (
                              <div className="space-y-2">
                                {bonds.map(b => (
                                  <div key={b.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">{b.regime}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border dark:border-slate-700 uppercase">{b.contracting_company || 'MarBR'}</span>
                                        {b.status === 'Ativo' ? (
                                          <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 px-1 rounded uppercase font-bold">Ativo</span>
                                        ) : (
                                          <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-1 rounded uppercase font-bold">{b.status}</span>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                                        Início: {b.start_date ? new Date(b.start_date + "T12:00:00").toLocaleDateString('pt-BR') : '—'} 
                                        {b.end_date ? ` | Fim: ${new Date(b.end_date + "T12:00:00").toLocaleDateString('pt-BR')}` : ''}
                                        {b.trigger_reason ? ` • Motivo: ${b.trigger_reason}` : ''}
                                      </p>
                                      {b.remuneration_base > 0 && (
                                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                                          Base: {formatCurrency(b.remuneration_base)}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => setEditingBond(b)}
                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                        title="Editar Vínculo"
                                      >
                                        <Edit3 size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteBond(b.id)}
                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                        title="Excluir Vínculo"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Histórico de Alterações */}
                          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/80 p-4">
                            <div className="flex justify-between items-center mb-3">
                              <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-300">
                                Histórico de Alterações Cadastrais
                              </h5>
                              <button
                                type="button"
                                onClick={() => setEditingHistoryItem({ event_type: 'Cargo', change_date: new Date().toISOString().split('T')[0] })}
                                className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg shadow-sm transition-all"
                              >
                                + Adicionar Evento
                              </button>
                            </div>
                            {history.length === 0 ? (
                              <p className="text-xs text-slate-400 italic py-2">Nenhum evento registrado.</p>
                            ) : (
                              <div className="space-y-2">
                                {[...history].sort((a,b) => new Date(b.change_date).getTime() - new Date(a.change_date).getTime()).map(h => (
                                  <div key={h.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 px-1.5 py-0.2 rounded uppercase font-bold">{h.event_type}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium">{new Date(h.change_date + "T12:00:00").toLocaleDateString('pt-BR')}</span>
                                      </div>
                                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1.5 break-words">
                                        {h.observations}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => setEditingHistoryItem(h)}
                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                        title="Editar Evento"
                                      >
                                        <Edit3 size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteHistoryItem(h.id)}
                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                        title="Excluir Evento"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ------------- ABA CUSTO HISTÓRICO ------------- */}
                  {activeTab === 'custo' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                          <Coins size={16} className="text-emerald-600" /> Histórico Mensal de Custos
                        </h4>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSearchDianna}
                            disabled={isSearchingExisting}
                            className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            {isSearchingExisting ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                            Buscar na Dianna
                          </button>
                          <button
                            onClick={() => setIsClearHistoryModalOpen(true)}
                            className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm border border-rose-200"
                            title="Limpar lançamentos de custos históricos por período"
                          >
                            <Trash2 size={14} />
                            Limpar Histórico
                          </button>
                          {costs && costs.length > 0 && (
                            <button
                              onClick={() => {
                                const lastCost = [...costs].sort((a,b) => b.competencia.localeCompare(a.competencia))[0];
                                const nextMonth = new Date(lastCost.competencia + 'T12:00:00');
                                nextMonth.setMonth(nextMonth.getMonth() + 1);
                                const nextComp = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
                                
                                setEditingCost({} as any);
                                setEditingCostCompetencia(nextComp);
                                setEditingCostType(lastCost.vinculo_tipo);
                                setEditingCostFixo(lastCost.valor_fixo !== undefined ? lastCost.valor_fixo : (lastCost.valor_liquido - ((lastCost.valor_bonus || 0) + (lastCost.valor_comissao || 0))));
                                setEditingCostBonus(lastCost.valor_bonus || 0);
                                setEditingCostComissao(lastCost.valor_comissao || 0);
                                setEditingCostIncentivos(lastCost.valor_incentivos || 0);
                                setEditingCostConectividade(lastCost.valor_ajuda_custo || 0);
                                setEditingCostGlosaBase(lastCost.valor_glosa_base || 0);
                                setEditingCostGlosaBonus(lastCost.valor_glosa_bonus || 0);
                                setEditingCostDeducoes(lastCost.valor_deducoes || 0);
                                
                                // Inicializa campos CLT anteriores
                                setEditingCostHolerite(lastCost.valor_holerite || 0);
                                setEditingCostAdiantamento(lastCost.valor_adiantamento || 0);
                                setEditingCostHoraExtra(lastCost.valor_hora_extra || 0);
                                setEditingCostAdicionalNot(lastCost.valor_adicional_not || 0);
                                setEditingCostVR(lastCost.valor_vr || 0);
                                setEditingCostVT(lastCost.valor_vt || 0);
                                setEditingCostCesta(lastCost.valor_cesta || 0);
                                setEditingCostFerias(lastCost.valor_ferias || 0);
                                setEditingCostRescisao(lastCost.valor_rescisao || 0);
                                setEditingCostDecimoTerceiro(lastCost.valor_decimo_terceiro || 0);
                                setEditingCostDescontos(lastCost.valor_descontos || 0);
                                setEditingCostFaltas(lastCost.valor_faltas || 0);
                                setEditingCostDiasFaltas(lastCost.dias_faltas || 0);
                                setEditingCostConsignado(lastCost.valor_consignado || 0);
                                setEditingCostBancoHoras(lastCost.banco_horas || 0);
                                setEditingCostVerbasAdicionais(lastCost.verbas_adicionais ? Object.entries(lastCost.verbas_adicionais).map(([name, value]) => ({ name, value })) : []);
                                setEditingCostObservacao(lastCost.observacao || '');
                                setSaveCostError(null);
                              }}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                              <Copy size={14} /> Repetir Anterior
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const today = new Date();
                              const comp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
                              setEditingCost({} as any);
                              setEditingCostCompetencia(comp);
                              setEditingCostType(profile?.linkType === 'CLT' ? 'CLT' : 'MEI');
                              setEditingCostFixo(profile?.remuneration_fixed || profile?.remuneration || 0);
                              setEditingCostBonus(profile?.remuneration_bonus || 0);
                              setEditingCostComissao(profile?.remuneration_commission || 0);
                              setEditingCostIncentivos(profile?.remuneration_incentives || 0);
                              setEditingCostConectividade(profile?.remuneration_connectivity || 0);
                              setEditingCostGlosaBase(0);
                              setEditingCostGlosaBonus(0);
                              setEditingCostDeducoes(0);
                              
                              // Zera campos CLT para novo custo
                              setEditingCostHolerite(0);
                              setEditingCostAdiantamento(0);
                              setEditingCostHoraExtra(0);
                              setEditingCostAdicionalNot(0);
                              setEditingCostVR(0);
                              setEditingCostVT(0);
                              setEditingCostCesta(0);
                              setEditingCostFerias(0);
                              setEditingCostRescisao(0);
                              setEditingCostDecimoTerceiro(0);
                              setEditingCostDescontos(0);
                              setEditingCostFaltas(0);
                              setEditingCostDiasFaltas(0);
                              setEditingCostConsignado(0);
                              setEditingCostBancoHoras(0);
                              setEditingCostVerbasAdicionais([]);
                              setEditingCostObservacao('');
                              setSaveCostError(null);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus size={14} /> Novo Custo
                          </button>
                        </div>
                      </div>

                      {(() => {
                        // 1. Extrair anos e meses existentes nos dados para preencher as opções dos filtros múltiplos
                        const availableYears = Array.from(new Set(costs.map(c => c.competencia.split('-')[0]))).sort().reverse();
                        const availableMonths = [
                          { val: '01', name: 'Jan' }, { val: '02', name: 'Fev' }, { val: '03', name: 'Mar' },
                          { val: '04', name: 'Abr' }, { val: '05', name: 'Mai' }, { val: '06', name: 'Jun' },
                          { val: '07', name: 'Jul' }, { val: '08', name: 'Ago' }, { val: '09', name: 'Set' },
                          { val: '10', name: 'Out' }, { val: '11', name: 'Nov' }, { val: '12', name: 'Dez' }
                        ];

                        // 2. Filtrar reativamente a lista de custos
                        let baseList = costs.filter(c => {
                          if (costSelectedYears.length > 0) {
                            const year = c.competencia.split('-')[0];
                            if (!costSelectedYears.includes(year)) return false;
                          }
                          if (costSelectedMonths.length > 0) {
                            const month = c.competencia.split('-')[1];
                            if (!costSelectedMonths.includes(month)) return false;
                          }
                          return true;
                        });

                        // Ordena cronologicamente do mais antigo para o mais recente
                        baseList.sort((a, b) => a.competencia.localeCompare(b.competencia));

                        // Aplica o filtro de período rápido trazendo os últimos N lançamentos existentes
                        let filteredCosts = baseList;
                        if (costPeriodFilter === '3m') {
                          filteredCosts = baseList.slice(-3);
                        } else if (costPeriodFilter === '6m') {
                          filteredCosts = baseList.slice(-6);
                        } else if (costPeriodFilter === '12m') {
                          filteredCosts = baseList.slice(-12);
                        }

                        const stats = PeopleHRService.computeCostStats(filteredCosts);
                        
                        if (!stats) {
                          return (
                            <div className="space-y-4">
                              {/* Painel de Filtros (mesmo sem dados para permitir remover filtros se existirem) */}
                              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3 shadow-sm text-left">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-500 uppercase tracking-wider">
                                    <Filter size={14} className="text-slate-400" />
                                    Filtros de Histórico
                                  </div>
                                  {(costPeriodFilter !== 'all' || costSelectedYears.length > 0 || costSelectedMonths.length > 0) && (
                                    <button
                                      onClick={() => {
                                        setCostPeriodFilter('all');
                                        setCostSelectedYears([]);
                                        setCostSelectedMonths([]);
                                      }}
                                      className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase tracking-wider"
                                    >
                                      Limpar Filtros
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Período Rápido</label>
                                    <select
                                      value={costPeriodFilter}
                                      onChange={e => setCostPeriodFilter(e.target.value as any)}
                                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                                    >
                                      <option value="all">Todo o Histórico</option>
                                      <option value="3m">Últimos 3 Meses</option>
                                      <option value="6m">Últimos 6 Meses</option>
                                      <option value="12m">Últimos 12 Meses</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Anos (Múltipla)</label>
                                    <div className="flex flex-wrap gap-1">
                                      {availableYears.map(year => {
                                        const selected = costSelectedYears.includes(year);
                                        return (
                                          <button
                                            key={year}
                                            onClick={() => {
                                              setCostSelectedYears(prev =>
                                                selected ? prev.filter(y => y !== year) : [...prev, year]
                                              );
                                            }}
                                            className={`px-2 py-1 text-[10px] font-bold rounded border transition-all ${
                                              selected
                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400'
                                                : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-950 dark:border-slate-850 dark:text-slate-400'
                                            }`}
                                          >
                                            {year}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Meses (Múltipla)</label>
                                    <div className="flex flex-wrap gap-0.5 max-h-[72px] overflow-y-auto pr-1">
                                      {availableMonths.map(m => {
                                        const selected = costSelectedMonths.includes(m.val);
                                        return (
                                          <button
                                            key={m.val}
                                            onClick={() => {
                                              setCostSelectedMonths(prev =>
                                                selected ? prev.filter(month => month !== m.val) : [...prev, m.val]
                                              );
                                            }}
                                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded border transition-all ${
                                              selected
                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400'
                                                : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-950 dark:border-slate-850 dark:text-slate-400'
                                            }`}
                                          >
                                            {m.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="text-center py-10 bg-slate-50 border border-dashed rounded-2xl">
                                <Coins className="mx-auto mb-2 text-slate-300" size={32} />
                                <p className="text-sm text-slate-500 font-bold">Sem dados de custos para os filtros aplicados.</p>
                                <p className="text-xs text-slate-400 mt-1">Os dados serão importados da planilha Dianna na Fase 2.</p>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            {/* Painel de Filtros Dinâmicos */}
                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3 shadow-sm text-left">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                                <div className="flex items-center gap-1.5 text-xs font-black text-slate-500 uppercase tracking-wider">
                                  <Filter size={14} className="text-slate-400" />
                                  Filtros de Histórico
                                </div>
                                {(costPeriodFilter !== 'all' || costSelectedYears.length > 0 || costSelectedMonths.length > 0) && (
                                  <button
                                    onClick={() => {
                                      setCostPeriodFilter('all');
                                      setCostSelectedYears([]);
                                      setCostSelectedMonths([]);
                                    }}
                                    className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase tracking-wider"
                                  >
                                    Limpar Filtros
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Período Rápido</label>
                                  <select
                                    value={costPeriodFilter}
                                    onChange={e => setCostPeriodFilter(e.target.value as any)}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                                  >
                                    <option value="all">Todo o Histórico</option>
                                    <option value="3m">Últimos 3 Meses</option>
                                    <option value="6m">Últimos 6 Meses</option>
                                    <option value="12m">Últimos 12 Meses</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Anos (Múltipla)</label>
                                  <div className="flex flex-wrap gap-1">
                                    {availableYears.map(year => {
                                      const selected = costSelectedYears.includes(year);
                                      return (
                                        <button
                                          key={year}
                                          onClick={() => {
                                            setCostSelectedYears(prev =>
                                              selected ? prev.filter(y => y !== year) : [...prev, year]
                                            );
                                          }}
                                          className={`px-2 py-1 text-[10px] font-bold rounded border transition-all ${
                                            selected
                                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400'
                                              : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-950 dark:border-slate-850 dark:text-slate-400'
                                          }`}
                                        >
                                          {year}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Meses (Múltipla)</label>
                                  <div className="flex flex-wrap gap-0.5 max-h-[72px] overflow-y-auto pr-1">
                                    {availableMonths.map(m => {
                                      const selected = costSelectedMonths.includes(m.val);
                                      return (
                                        <button
                                          key={m.val}
                                          onClick={() => {
                                            setCostSelectedMonths(prev =>
                                              selected ? prev.filter(month => month !== m.val) : [...prev, m.val]
                                            );
                                          }}
                                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded border transition-all ${
                                            selected
                                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400'
                                              : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-950 dark:border-slate-850 dark:text-slate-400'
                                          }`}
                                        >
                                          {m.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Card de Posição de Empréstimos Corporativos (Total Tomado, Total Pago e Saldo Devedor) */}
                            {loanSummary && (loanSummary.totalTaken > 0 || loanSummary.balance > 0) && (
                              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md border border-slate-800 space-y-3 mb-4">
                                <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <Coins className="text-amber-400" size={18} />
                                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-200">
                                      Resumo do Empréstimo Corporativo
                                    </h5>
                                  </div>
                                  <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2.5 py-0.5 rounded-full uppercase">
                                    Posição Financeira
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 shadow-inner">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Tomado</span>
                                    <span className="text-sm font-black text-amber-300 tabular-nums mt-0.5 block">
                                      {formatCurrency(loanSummary.totalTaken)}
                                    </span>
                                  </div>

                                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 shadow-inner">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Pago</span>
                                    <span className="text-sm font-black text-emerald-400 tabular-nums mt-0.5 block">
                                      {formatCurrency(loanSummary.totalReceived)}
                                    </span>
                                  </div>

                                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 shadow-inner">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Saldo Devedor</span>
                                    <span className="text-sm font-black text-rose-400 tabular-nums mt-0.5 block">
                                      {formatCurrency(loanSummary.balance)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Dashboard de Totais e Médias */}
                            <div className="space-y-4 text-left">
                              {profile?.linkType === 'CLT' ? (
                                <div>
                                  <h5 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Resumo de Ganhos CLT (Média do Período)</h5>
                                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                                      <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Salário Base</p>
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.fixedTotal || 0)}
                                        </p>
                                      </div>
                                      <p className="text-[9px] font-bold text-slate-400 mt-1.5 pt-1 border-t border-slate-200/50 uppercase">
                                        Média: {formatCurrency(stats.fixedAverage || 0)}
                                      </p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                                      <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Horas Extras</p>
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.horaExtraTotal || 0)}
                                        </p>
                                      </div>
                                      <p className="text-[9px] font-bold text-slate-400 mt-1.5 pt-1 border-t border-slate-200/50 uppercase">
                                        Média: {formatCurrency(stats.horaExtraAverage || 0)}
                                      </p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                                      <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Adic. Noturno</p>
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.adicionalNotTotal || 0)}
                                        </p>
                                      </div>
                                      <p className="text-[9px] font-bold text-slate-400 mt-1.5 pt-1 border-t border-slate-200/50 uppercase">
                                        Média: {formatCurrency(stats.adicionalNotAverage || 0)}
                                      </p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                                      <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Adiantamento</p>
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.adiantamentoTotal || 0)}
                                        </p>
                                      </div>
                                      <p className="text-[9px] font-bold text-slate-400 mt-1.5 pt-1 border-t border-slate-200/50 uppercase">
                                        Média: {formatCurrency(stats.adiantamentoAverage || 0)}
                                      </p>
                                    </div>

                                    <div 
                                      onClick={() => setVerbaDetailModal({
                                        title: 'Detalhamento de Benefícios',
                                        items: [
                                          { label: 'Vale Refeição (VR)', total: stats.vrTotal, average: stats.vrTotal / stats.count },
                                          { label: 'Vale Transporte (VT)', total: stats.vtTotal, average: stats.vtTotal / stats.count },
                                          { label: 'Cesta Básica / Aux. Alimentação', total: stats.cestaTotal, average: stats.cestaTotal / stats.count },
                                          { label: 'Ajuda de Custo / Reembolso', total: stats.ajudaCustoTotal, average: stats.ajudaCustoTotal / stats.count },
                                        ],
                                        total: stats.beneficiosTotal,
                                        average: stats.beneficiosAverage
                                      })}
                                      className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl p-3 flex flex-col justify-between shadow-sm cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 transition-all group"
                                      title="Clique para ver o detalhamento por verbas de benefícios"
                                    >
                                      <div>
                                        <div className="flex justify-between items-center">
                                          <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-500 uppercase tracking-wider">Benefícios</p>
                                          <span className="text-[8px] font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded uppercase group-hover:scale-105 transition-transform">Ver verbas</span>
                                        </div>
                                        <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.beneficiosTotal || 0)}
                                        </p>
                                      </div>
                                      <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500 mt-1.5 pt-1 border-t border-emerald-200/50 uppercase truncate">
                                        Média: {formatCurrency(stats.beneficiosAverage || 0)}
                                      </p>
                                    </div>

                                    <div 
                                      onClick={() => setVerbaDetailModal({
                                        title: 'Detalhamento de 13º Salário e Férias',
                                        items: [
                                          { label: '13º Salário (Gratificação Natalina)', total: stats.decimoTerceiroTotal, average: stats.decimoTerceiroTotal / stats.count },
                                          { label: 'Férias + 1/3 Constitucional', total: stats.feriasTotal, average: stats.feriasTotal / stats.count },
                                          { label: 'Rescisão Contratual', total: stats.rescisaoTotal, average: stats.rescisaoTotal / stats.count },
                                        ],
                                        total: stats.decimoTerceiroTotal + stats.feriasTotal + stats.rescisaoTotal,
                                        average: (stats.decimoTerceiroTotal + stats.feriasTotal + stats.rescisaoTotal) / stats.count
                                      })}
                                      className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl p-3 flex flex-col justify-between shadow-sm cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 transition-all group"
                                      title="Clique para ver o detalhamento de 13º e Férias"
                                    >
                                      <div>
                                        <div className="flex justify-between items-center">
                                          <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-500 uppercase tracking-wider">13º & Férias</p>
                                          <span className="text-[8px] font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded uppercase group-hover:scale-105 transition-transform">Ver verbas</span>
                                        </div>
                                        <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                                          {formatCurrency((stats.decimoTerceiroTotal || 0) + (stats.feriasTotal || 0))}
                                        </p>
                                      </div>
                                      <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500 mt-1.5 pt-1 border-t border-emerald-200/50 uppercase truncate">
                                        Média: {formatCurrency(((stats.decimoTerceiroTotal || 0) + (stats.feriasTotal || 0)) / stats.count || 0)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                               ) : (
                                <div>
                                  <h5 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Resumo de Ganhos Recebidos</h5>
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                                      <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Fixo</p>
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.fixedTotal || 0)}
                                        </p>
                                      </div>
                                      <p className="text-[9px] font-bold text-slate-400 mt-1.5 pt-1 border-t border-slate-200/50 uppercase">
                                        Média: {formatCurrency(stats.fixedAverage || 0)}
                                      </p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                                      <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Bônus</p>
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.bonusTotal || 0)}
                                        </p>
                                      </div>
                                      <p className="text-[9px] font-bold text-slate-400 mt-1.5 pt-1 border-t border-slate-200/50 uppercase">
                                        Média: {formatCurrency(stats.bonusAverage || 0)}
                                      </p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                                      <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Comissões</p>
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.commissionTotal || 0)}
                                        </p>
                                      </div>
                                      <p className="text-[9px] font-bold text-slate-400 mt-1.5 pt-1 border-t border-slate-200/50 uppercase">
                                        Média: {formatCurrency(stats.commissionAverage || 0)}
                                      </p>
                                    </div>

                                    <div className="bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                                      <div>
                                        <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-500 uppercase tracking-wider">Incentivos</p>
                                        <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.incentivosTotal || 0)}
                                        </p>
                                      </div>
                                      <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500 mt-1.5 pt-1 border-t border-emerald-100/50 uppercase">
                                        Média: {formatCurrency(stats.incentivosAverage || 0)}
                                      </p>
                                    </div>

                                    <div className="bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                                      <div>
                                        <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-500 uppercase tracking-wider">Conectividade</p>
                                        <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.conectividadeTotal || 0)}
                                        </p>
                                      </div>
                                      <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500 mt-1.5 pt-1 border-t border-emerald-100/50 uppercase">
                                        Média: {formatCurrency(stats.conectividadeAverage || 0)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-3">
                                  <h5 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Descontos e Ajustes</h5>
                                  {profile?.linkType === 'CLT' ? (
                                    <div className="grid grid-cols-3 gap-3">
                                      <div className="bg-red-50/30 dark:bg-red-950/10 border border-red-100/60 dark:border-red-900/30 rounded-xl p-3 shadow-sm flex flex-col justify-between">
                                        <div>
                                          <p className="text-[10px] font-black text-red-800 dark:text-red-500 uppercase tracking-wider">Faltas</p>
                                          <p className="text-sm font-black text-red-700 dark:text-red-400 mt-0.5 tabular-nums">
                                            {formatCurrency(stats.faltasTotal || 0)}
                                          </p>
                                        </div>
                                        <p className="text-[9px] font-bold text-red-400 mt-1 border-t border-red-200/20 pt-1 uppercase">
                                          Média: {formatCurrency(stats.faltasAverage || 0)} {stats.diasFaltasTotal > 0 ? `(${stats.diasFaltasTotal.toFixed(1)}d)` : ''}
                                        </p>
                                      </div>
                                      <div className="bg-red-50/30 dark:bg-red-950/10 border border-red-100/60 dark:border-red-900/30 rounded-xl p-3 shadow-sm flex flex-col justify-between">
                                        <div>
                                          <p className="text-[10px] font-black text-red-800 dark:text-red-500 uppercase tracking-wider">Consignado</p>
                                          <p className="text-sm font-black text-red-700 dark:text-red-400 mt-0.5 tabular-nums">
                                            {formatCurrency(stats.consignadoTotal || 0)}
                                          </p>
                                        </div>
                                        <p className="text-[9px] font-bold text-red-400 mt-1 border-t border-red-200/20 pt-1 uppercase">
                                          Média: {formatCurrency(stats.consignadoAverage || 0)}
                                        </p>
                                      </div>
                                      <div 
                                        onClick={() => setVerbaDetailModal({
                                          title: 'Detalhamento de Descontos e Deduções',
                                          items: [
                                            { label: 'INSS (Previdência Social)', total: stats.inssEmpregadoTotal || 0, average: stats.inssEmpregadoAverage || 0 },
                                            { label: 'IRRF (Imposto de Renda)', total: stats.irrfEmpregadoTotal || 0, average: stats.irrfEmpregadoAverage || 0 },
                                            { label: 'Pensão Alimentícia', total: stats.pensaoAlimenticiaTotal || 0, average: stats.pensaoAlimenticiaAverage || 0 },
                                            { label: 'Outros Descontos Diversos', total: Math.max(0, (stats.descontosTotal || 0) - (stats.faltasTotal || 0) - (stats.consignadoTotal || 0) - (stats.pensaoAlimenticiaTotal || 0) - (stats.inssEmpregadoTotal || 0) - (stats.irrfEmpregadoTotal || 0)), average: Math.max(0, (stats.descontosTotal || 0) - (stats.faltasTotal || 0) - (stats.consignadoTotal || 0) - (stats.pensaoAlimenticiaTotal || 0) - (stats.inssEmpregadoTotal || 0) - (stats.irrfEmpregadoTotal || 0)) / stats.count },
                                          ],
                                          total: (stats.descontosTotal || 0) - (stats.faltasTotal || 0) - (stats.consignadoTotal || 0),
                                          average: ((stats.descontosTotal || 0) - (stats.faltasTotal || 0) - (stats.consignadoTotal || 0)) / stats.count
                                        })}
                                        className="bg-red-50/40 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40 rounded-xl p-3 shadow-sm flex flex-col justify-between cursor-pointer hover:border-red-400 hover:bg-red-50/80 dark:hover:bg-red-950/40 transition-all group"
                                        title="Clique para ver o detalhamento dos descontos de INSS, IRRF, Pensão e outros"
                                      >
                                        <div>
                                          <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-black text-red-800 dark:text-red-500 uppercase tracking-wider">Outros Descontos</p>
                                            <span className="text-[8px] font-black text-red-600 bg-red-100 dark:bg-red-900/60 px-1 py-0.5 rounded uppercase group-hover:scale-105 transition-transform">Ver verbas</span>
                                          </div>
                                          <p className="text-sm font-black text-red-700 dark:text-red-400 mt-0.5 tabular-nums">
                                            {formatCurrency(stats.descontosTotal - stats.faltasTotal - stats.consignadoTotal || 0)}
                                          </p>
                                        </div>
                                        <p className="text-[9px] font-bold text-red-400 mt-1 border-t border-red-200/20 pt-1 uppercase truncate">
                                          Média: {formatCurrency(((stats.descontosTotal || 0) - (stats.faltasTotal || 0) - (stats.consignadoTotal || 0)) / stats.count || 0)}
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-3 gap-3">
                                      <div className="bg-red-50/30 dark:bg-red-950/10 border border-red-100/60 dark:border-red-900/30 rounded-xl p-3 shadow-sm">
                                        <p className="text-[10px] font-black text-red-800 dark:text-red-500 uppercase tracking-wider">Glosa Base</p>
                                        <p className="text-sm font-black text-red-700 dark:text-red-400 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.glosaBaseTotal || 0)}
                                        </p>
                                      </div>
                                      <div className="bg-red-50/30 dark:bg-red-950/10 border border-red-100/60 dark:border-red-900/30 rounded-xl p-3 shadow-sm">
                                        <p className="text-[10px] font-black text-red-800 dark:text-red-500 uppercase tracking-wider">Glosa Bônus</p>
                                        <p className="text-sm font-black text-red-700 dark:text-red-400 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.glosaBonusTotal || 0)}
                                        </p>
                                      </div>
                                      <div className="bg-red-50/30 dark:bg-red-950/10 border border-red-100/60 dark:border-red-900/30 rounded-xl p-3 shadow-sm">
                                        <p className="text-[10px] font-black text-red-800 dark:text-red-500 uppercase tracking-wider">Deduções</p>
                                        <p className="text-sm font-black text-red-700 dark:text-red-400 mt-0.5 tabular-nums">
                                          {formatCurrency(stats.deducoesTotal || 0)}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-col justify-end">
                                  <h5 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Resultado Final</h5>
                                  <div className="bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-900 rounded-xl p-3 flex flex-col justify-between shadow-sm h-[66px]">
                                    <div className="flex justify-between items-baseline">
                                      <p className="text-[10px] font-black text-emerald-950 dark:text-emerald-400 uppercase tracking-wider">Total Real</p>
                                      <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-500 uppercase">
                                        Média: {formatCurrency(stats.totalAverage || 0)}
                                      </span>
                                    </div>
                                    <p className="text-sm font-black text-emerald-900 dark:text-emerald-200 mt-0.5 tabular-nums">
                                      {formatCurrency(stats.total)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
 
                            <div className="space-y-2">
                              <h5 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Lançamentos Recentes ({stats.count})</h5>
                              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 max-h-[250px] overflow-y-auto shadow-sm">
                                {filteredCosts.map((c, i) => {
                                  const fixedVal = (c.valor_fixo !== undefined && c.valor_fixo !== null) 
                                    ? c.valor_fixo 
                                    : (c.valor_liquido - ((c.valor_bonus || 0) + (c.valor_comissao || 0)));
                                  return (
                                    <div key={i} className="p-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 flex flex-col gap-2">
                                      <div className="flex justify-between items-center">
                                        <div>
                                          <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase">
                                            {new Date(c.competencia + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                          </p>
                                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase mt-0.5">{c.origem === 'dianna_import' ? 'Planilha Dianna' : c.origem}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Total:</span>
                                            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                              {formatCurrency(c.valor_liquido + (c.vinculo_tipo === 'CLT' ? (c.valor_adiantamento || 0) : 0))}
                                            </span>
                                          </div>
                                          <button
                                            onClick={() => {
                                              setEditingCost(c);
                                              setEditingCostCompetencia(c.competencia);
                                              setEditingCostType(c.vinculo_tipo);
                                              setEditingCostFixo(fixedVal || 0);
                                              setEditingCostBonus(c.valor_bonus || 0);
                                              setEditingCostComissao(c.valor_comissao || 0);
                                              setEditingCostIncentivos(c.valor_incentivos || 0);
                                              setEditingCostConectividade(c.valor_ajuda_custo || 0);
                                              setEditingCostGlosaBase(c.valor_glosa_base || 0);
                                              setEditingCostGlosaBonus(c.valor_glosa_bonus || 0);
                                              setEditingCostDeducoes(c.valor_deducoes || 0);
                                              
                                              // Inicializa campos específicos CLT do registro existente
                                              setEditingCostHolerite(c.valor_holerite || 0);
                                              setEditingCostAdiantamento(c.valor_adiantamento || 0);
                                              setEditingCostHoraExtra(c.valor_hora_extra || 0);
                                              setEditingCostAdicionalNot(c.valor_adicional_not || 0);
                                              setEditingCostVR(c.valor_vr || 0);
                                              setEditingCostVT(c.valor_vt || 0);
                                              setEditingCostCesta(c.valor_cesta || 0);
                                              setEditingCostFerias(c.valor_ferias || 0);
                                              setEditingCostRescisao(c.valor_rescisao || 0);
                                              setEditingCostDecimoTerceiro(c.valor_decimo_terceiro || 0);
                                              setEditingCostDescontos(c.valor_descontos || 0);
                                              setEditingCostFaltas(c.valor_faltas || 0);
                                              setEditingCostDiasFaltas(c.dias_faltas || 0);
                                              setEditingCostConsignado(c.valor_consignado || 0);
                                              setEditingCostBancoHoras(c.banco_horas || 0);
                                              setEditingCostVerbasAdicionais(c.verbas_adicionais ? Object.entries(c.verbas_adicionais).map(([name, value]) => ({ name, value })) : []);
                                              setEditingCostObservacao(c.observacao || '');
                                              setSaveCostError(null);
                                            }}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                            title="Editar lançamento"
                                          >
                                            <PenBox size={13} />
                                          </button>
                                        </div>
                                      </div>
                                      
                                      {profile?.linkType === 'CLT' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-left">
                                          {/* Coluna de Ganhos */}
                                          <div className="space-y-1 bg-emerald-50/10 dark:bg-emerald-950/5 p-2 rounded-lg border border-emerald-100/20 text-left">
                                            <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block border-b border-emerald-100/20 pb-0.5 mb-1.5 font-sans">Ganhos / Proventos</span>
                                            
                                            <div className="flex justify-between items-center py-0.5">
                                              <span className="text-slate-500 font-semibold">Salário Base:</span>
                                              <span className="text-slate-800 dark:text-slate-200 font-extrabold tabular-nums">{formatCurrency(c.valor_fixo || 0)}</span>
                                            </div>
                                            {!!c.valor_adiantamento && (
                                              <div className="flex justify-between items-center py-0.5">
                                                <span className="text-slate-500 font-semibold">Adiantamento (Vale):</span>
                                                <span className="text-blue-600 dark:text-blue-400 font-extrabold tabular-nums">+{formatCurrency(c.valor_adiantamento)}</span>
                                              </div>
                                            )}
                                            {!!c.valor_hora_extra && (
                                              <div className="flex justify-between items-center py-0.5">
                                                <span className="text-slate-500 font-semibold">Horas Extras:</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold tabular-nums">+{formatCurrency(c.valor_hora_extra)}</span>
                                              </div>
                                            )}
                                            {!!c.valor_adicional_not && (
                                              <div className="flex justify-between items-center py-0.5">
                                                <span className="text-slate-500 font-semibold">Adicional Noturno:</span>
                                                <span className="text-emerald-650 dark:text-emerald-400 font-extrabold tabular-nums">+{formatCurrency(c.valor_adicional_not)}</span>
                                              </div>
                                            )}
                                            {!!c.valor_vr && (
                                              <div className="flex justify-between items-center py-0.5">
                                                <span className="text-slate-500 font-semibold">Vale Refeição:</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold tabular-nums">+{formatCurrency(c.valor_vr)}</span>
                                              </div>
                                            )}
                                            {!!c.valor_vt && (
                                              <div className="flex justify-between items-center py-0.5">
                                                <span className="text-slate-500 font-semibold">Vale Transporte:</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold tabular-nums">+{formatCurrency(c.valor_vt)}</span>
                                              </div>
                                            )}
                                            {!!c.valor_cesta && (
                                              <div className="flex justify-between items-center py-0.5">
                                                <span className="text-slate-500 font-semibold">Cesta Básica:</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold tabular-nums">+{formatCurrency(c.valor_cesta)}</span>
                                              </div>
                                            )}
                                            {!!c.valor_ajuda_custo && (
                                              <div className="flex justify-between items-center py-0.5">
                                                <span className="text-slate-500 font-semibold">Ajuda Custo / Conect.:</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold tabular-nums">+{formatCurrency(c.valor_ajuda_custo)}</span>
                                              </div>
                                            )}
                                            {!!c.valor_ferias && (
                                              <div className="flex justify-between items-center py-0.5 bg-yellow-500/5 px-1 rounded">
                                                <span className="text-amber-700 dark:text-amber-400 font-semibold">Férias + 1/3:</span>
                                                <span className="text-amber-600 dark:text-amber-400 font-extrabold tabular-nums">+{formatCurrency(c.valor_ferias)}</span>
                                              </div>
                                            )}
                                            {!!c.valor_decimo_terceiro && (
                                              <div className="flex justify-between items-center py-0.5 bg-yellow-500/5 px-1 rounded">
                                                <span className="text-amber-700 dark:text-amber-400 font-semibold">13º Salário:</span>
                                                <span className="text-amber-600 dark:text-amber-400 font-extrabold tabular-nums">+{formatCurrency(c.valor_decimo_terceiro)}</span>
                                              </div>
                                            )}
                                            {!!c.valor_rescisao && (
                                              <div className="flex justify-between items-center py-0.5 bg-rose-500/5 px-1 rounded border border-rose-200/20">
                                                <span className="text-rose-700 dark:text-rose-455 font-black uppercase text-[8px]">Verba Rescisória:</span>
                                                <span className="text-rose-650 dark:text-rose-400 font-extrabold tabular-nums">+{formatCurrency(c.valor_rescisao)}</span>
                                              </div>
                                            )}
                                            {/* Verbas adicionais customizadas (Ganhos) */}
                                            {c.verbas_adicionais && Object.entries(c.verbas_adicionais).map(([name, val]) => val >= 0 ? (
                                              <div key={name} className="flex justify-between items-center py-0.5 border-t border-dashed border-slate-200/50">
                                                <span className="text-indigo-650 dark:text-indigo-400 font-semibold">{name}:</span>
                                                <span className="text-indigo-650 dark:text-indigo-400 font-extrabold tabular-nums">+{formatCurrency(val)}</span>
                                              </div>
                                            ) : null)}
                                          </div>

                                          {/* Coluna de Descontos */}
                                          <div className="space-y-1 bg-red-50/10 dark:bg-red-950/5 p-2 rounded-lg border border-red-100/20 text-left">
                                            <span className="text-[9px] font-black text-red-700 dark:text-red-400 uppercase tracking-wider block border-b border-red-100/20 pb-0.5 mb-1.5 font-sans">Descontos / Retenções</span>
                                            
                                            {!!c.valor_faltas && (
                                              <div className="flex justify-between items-center py-0.5">
                                                <span className="text-slate-500 font-semibold">Faltas {c.dias_faltas ? `(${c.dias_faltas.toFixed(1)}d)` : ''}:</span>
                                                <span className="text-red-650 dark:text-red-405 font-extrabold tabular-nums">-{formatCurrency(c.valor_faltas)}</span>
                                              </div>
                                            )}
                                            {!!c.valor_consignado && (
                                              <div className="flex justify-between items-center py-0.5">
                                                <span className="text-slate-500 font-semibold">Consignados / Emprést.:</span>
                                                <span className="text-red-655 dark:text-red-405 font-extrabold tabular-nums">-{formatCurrency(c.valor_consignado)}</span>
                                              </div>
                                            )}
                                            {/* Impostos / Outros Descontos da folha */}
                                            {!!((c.valor_descontos || 0) - (c.valor_faltas || 0) - (c.valor_consignado || 0)) && (
                                              <div className="flex justify-between items-center py-0.5">
                                                <span className="text-slate-500 font-semibold">INSS, IRRF & Outros:</span>
                                                <span className="text-red-650 dark:text-red-405 font-extrabold tabular-nums">
                                                  -{formatCurrency((c.valor_descontos || 0) - (c.valor_faltas || 0) - (c.valor_consignado || 0))}
                                                </span>
                                              </div>
                                            )}
                                            {/* Verbas adicionais customizadas (Descontos) */}
                                            {c.verbas_adicionais && Object.entries(c.verbas_adicionais).map(([name, val]) => val < 0 ? (
                                              <div key={name} className="flex justify-between items-center py-0.5 border-t border-dashed border-slate-200/50">
                                                <span className="text-red-650 dark:text-red-450 font-semibold">{name}:</span>
                                                <span className="text-red-650 dark:text-red-450 font-extrabold tabular-nums">-{formatCurrency(Math.abs(val))}</span>
                                              </div>
                                            ) : null)}
                                            
                                            {/* Banco de horas informativo */}
                                            {!!c.banco_horas && (
                                              <div className="flex justify-between items-center py-0.5 border-t border-dashed border-slate-200/50 mt-1.5 pt-1">
                                                <span className="text-sky-600 dark:text-sky-400 font-semibold">Banco de Horas:</span>
                                                <span className="text-sky-650 dark:text-sky-400 font-extrabold tabular-nums">{c.banco_horas > 0 ? `+` : ''}{c.banco_horas}h</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1.5 border-t border-slate-100/50 dark:border-slate-800/50 text-[10px]">
                                          <div>
                                            <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase text-[8px]">Fixo</span>
                                            <span className="text-slate-700 dark:text-slate-300 font-bold tabular-nums">{formatCurrency(fixedVal || 0)}</span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase text-[8px]">Bônus</span>
                                            <span className={`font-bold tabular-nums ${c.valor_bonus ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                              {formatCurrency(c.valor_bonus || 0)}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase text-[8px]">Comissão</span>
                                            <span className={`font-bold tabular-nums ${c.valor_comissao ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                              {formatCurrency(c.valor_comissao || 0)}
                                            </span>
                                          </div>
                                          {!!c.valor_incentivos && (
                                            <div>
                                              <span className="text-emerald-500 font-bold block uppercase text-[8px]">Incentivos</span>
                                              <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(c.valor_incentivos)}</span>
                                            </div>
                                          )}
                                          {!!c.valor_ajuda_custo && (
                                            <div>
                                              <span className="text-emerald-500 font-bold block uppercase text-[8px]">Conectividade</span>
                                              <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(c.valor_ajuda_custo)}</span>
                                            </div>
                                          )}
                                          {!!c.valor_glosa_base && (
                                            <div>
                                              <span className="text-red-400 dark:text-red-500 font-bold block uppercase text-[8px]">Glosa Base</span>
                                              <span className="font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(c.valor_glosa_base)}</span>
                                            </div>
                                          )}
                                          {!!c.valor_glosa_bonus && (
                                            <div>
                                              <span className="text-red-400 dark:text-red-500 font-bold block uppercase text-[8px]">Glosa Bônus</span>
                                              <span className="font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(c.valor_glosa_bonus)}</span>
                                            </div>
                                          )}
                                          {!!c.valor_deducoes && (
                                            <div>
                                              <span className="text-red-400 dark:text-red-500 font-bold block uppercase text-[8px]">Deduções</span>
                                              <span className="font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(c.valor_deducoes)}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Gráfico de Barras de Custo Histórico Mês a Mês com Rótulos de Valor nas Barras */}
                              {filteredCosts && filteredCosts.length > 0 && (
                                <div className="mt-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                                  <div className="flex items-center justify-between border-b dark:border-slate-800 pb-2.5">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                      <BarChart3 size={16} className="text-emerald-600" />
                                      Evolução do Custo Histórico Mês a Mês (Rótulos de Valor R$)
                                    </h5>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                      {filteredCosts.length} Competência(s) Filtrada(s)
                                    </span>
                                  </div>

                                  <div className="h-[280px] w-full pt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart 
                                        data={[...filteredCosts].sort((a, b) => a.competencia.localeCompare(b.competencia)).map(c => {
                                          const isCLT = c.vinculo_tipo === 'CLT';
                                          const realCost = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
                                          const compParts = c.competencia.split('-');
                                          const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                                          const mName = monthsShort[parseInt(compParts[1] || '1', 10) - 1];
                                          const label = `${mName}/${(compParts[0] || '').slice(2)}`;
                                          const labelFormatted = realCost >= 1000 ? `R$ ${(realCost / 1000).toFixed(1)}k` : `R$ ${realCost.toFixed(0)}`;
                                          return {
                                            competencia: c.competencia,
                                            monthLabel: label,
                                            realCost: Math.round(realCost),
                                            formattedLabel: labelFormatted,
                                          };
                                        })}
                                        margin={{ top: 25, right: 15, left: 0, bottom: 5 }}
                                      >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                        <XAxis 
                                          dataKey="monthLabel" 
                                          axisLine={false} 
                                          tickLine={false} 
                                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                                        />
                                        <YAxis 
                                          axisLine={false} 
                                          tickLine={false} 
                                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                                          tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`}
                                          width={50}
                                        />
                                        <Tooltip 
                                          formatter={(val: any) => [formatCurrency(Number(val)), 'Custo Real Desembolsado']}
                                          labelFormatter={(label) => `Competência: ${label}`}
                                        />
                                        <Bar dataKey="realCost" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32}>
                                          <LabelList dataKey="formattedLabel" position="top" style={{ fontSize: '10px', fontWeight: '800', fill: '#059669' }} />
                                        </Bar>
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}

                  {/* ------------- ABA AUDITORIA ------------- */}
                  {activeTab === 'auditoria' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                          <AlertCircle size={16} className="text-amber-500" /> Relatório de Inconsistências
                        </h4>
                        <span className="text-xs font-black bg-amber-100 text-amber-800 px-2.5 py-1 rounded uppercase">Auditoria Ativa</span>
                      </div>

                      {auditIssues.length === 0 ? (
                        <div className="text-center py-10 bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6">
                          <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={32} />
                          <p className="text-sm font-bold text-emerald-800">Dados 100% Íntegros!</p>
                          <p className="text-xs text-emerald-600 mt-1">Nenhuma inconsistência de competência ou regime de vínculo detectada.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-sm text-slate-500 leading-relaxed">
                            Foram encontradas <strong className="text-slate-800">{auditIssues.length} inconsistência(s)</strong> no prontuário deste colaborador. Use os botões rápidos abaixo para efetuar as correções imediatas:
                          </p>

                          <div className="space-y-3">
                            {auditIssues.map((issue) => {
                              const isError = issue.severity === 'error';
                              return (
                                <div key={issue.id} className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                                  isError ? 'bg-red-50/50 border-red-100 text-red-900' : 'bg-amber-50/50 border-amber-100 text-amber-900'
                                }`}>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-black px-2 py-1 rounded leading-none ${
                                        isError ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        {issue.type === 'regime_mismatch' ? 'Vínculo Divergente' : 'Competência Inválida'}
                                      </span>
                                    </div>
                                    <p className="text-sm font-bold leading-relaxed">{issue.message}</p>
                                  </div>
                                  <div className="flex gap-2 shrink-0 flex-wrap">
                                    {(issue.type === 'date_before_admission' || issue.type === 'missing_start_date') && (
                                      <button 
                                        onClick={() => {
                                          setActiveTab('pessoal');
                                          setIsEditMode(true);
                                          setTimeout(() => {
                                            const el = document.getElementsByName('start_date')[0] || document.querySelector('input[type="date"]');
                                            if (el) (el as HTMLElement).focus();
                                          }, 200);
                                        }}
                                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                                      >
                                        <PenBox size={13} /> Ajustar Admissão
                                      </button>
                                    )}

                                    {issue.details?.costId && (
                                      <button 
                                        onClick={() => {
                                          const cost = costs.find(c => c.id === issue.details?.costId);
                                          if (cost) {
                                            setEditingCost(cost);
                                            setEditingCostCompetencia(cost.competencia);
                                            setEditingCostType(cost.vinculo_tipo);
                                            setEditingCostFixo(cost.valor_fixo || 0);
                                            setEditingCostBonus(cost.valor_bonus || 0);
                                            setEditingCostComissao(cost.valor_comissao || 0);
                                            setEditingCostIncentivos(cost.valor_incentivos || 0);
                                            setEditingCostConectividade(cost.valor_ajuda_custo || 0);
                                            setEditingCostGlosaBase(cost.valor_glosa_base || 0);
                                            setEditingCostGlosaBonus(cost.valor_glosa_bonus || 0);
                                            setEditingCostDeducoes(cost.valor_deducoes || 0);
                                            
                                            // Inicializa campos específicos CLT do registro existente
                                            setEditingCostHolerite(cost.valor_holerite || 0);
                                            setEditingCostAdiantamento(cost.valor_adiantamento || 0);
                                            setEditingCostHoraExtra(cost.valor_hora_extra || 0);
                                            setEditingCostAdicionalNot(cost.valor_adicional_not || 0);
                                            setEditingCostVR(cost.valor_vr || 0);
                                            setEditingCostVT(cost.valor_vt || 0);
                                            setEditingCostCesta(cost.valor_cesta || 0);
                                            setEditingCostFerias(cost.valor_ferias || 0);
                                            setEditingCostRescisao(cost.valor_rescisao || 0);
                                            setEditingCostDecimoTerceiro(cost.valor_decimo_terceiro || 0);
                                            setEditingCostDescontos(cost.valor_descontos || 0);
                                            setEditingCostFaltas(cost.valor_faltas || 0);
                                            setEditingCostDiasFaltas(cost.dias_faltas || 0);
                                            setEditingCostConsignado(cost.valor_consignado || 0);
                                            setEditingCostBancoHoras(cost.banco_horas || 0);
                                            setEditingCostVerbasAdicionais(cost.verbas_adicionais ? Object.entries(cost.verbas_adicionais).map(([name, value]) => ({ name, value })) : []);
                                            setEditingCostObservacao(cost.observacao || '');
                                            setSaveCostError(null);
                                          }
                                        }}
                                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                                      >
                                        <Coins size={13} className="text-emerald-600" /> Ajustar Custo
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ─── ABA ACESSOS & SISTEMAS (GOVERNANÇA & OFFBOARDING) ─── */}
                  {activeTab === 'acessos' && (
                    <motion.div
                      key="tab-acessos"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      {/* Banner de Segurança & Botão de Salvar */}
                      <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                            <KeyRound size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-black uppercase tracking-wider text-white">
                                Credenciais &amp; Sistemas Concedidos
                              </h4>
                              <span className="bg-indigo-500/30 text-indigo-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                                {(profile.system_accesses || (profile.metadata as any)?.system_accesses || []).length} Ativos
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-0.5">
                              Mapeie acessos aos ERPs, Bancos e plataformas corporativas por empresa do Grupo.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => setIsOffboardingOpen(true)}
                            className="px-3.5 py-2.5 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-sm transition-all flex-1 sm:flex-none justify-center"
                          >
                            <ShieldAlert size={15} />
                            <span>Termo Offboarding</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all flex-1 sm:flex-none justify-center disabled:opacity-50"
                          >
                            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            <span>{isSaving ? 'Salvando...' : 'Salvar Acessos'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Grade de Sistemas por Categoria */}
                      {(() => {
                        const allSystems = SystemsCatalogService.getSystems();
                        const currentAccesses: EmployeeSystemAccess[] = profile.system_accesses || (profile.metadata as any)?.system_accesses || [];
                        
                        // Categorias únicas
                        const categories = Array.from(new Set(allSystems.map(s => s.category)));

                        const handleToggleSystem = (sys: SystemItem) => {
                          const exists = currentAccesses.some(a => a.system_id === sys.id);
                          let updated: EmployeeSystemAccess[];

                          if (exists) {
                            // Remover acesso
                            updated = currentAccesses.filter(a => a.system_id !== sys.id);
                          } else {
                            // Adicionar novo acesso
                            const newAccess: EmployeeSystemAccess = {
                              system_id: sys.id,
                              system_name: sys.name,
                              category: sys.category,
                              access_level: sys.default_level || 'Operacional',
                              origin: sys.origin,
                              companies: profile.company ? [profile.company] : ['Mar Brasil'],
                              company: profile.company || 'Mar Brasil',
                              user_identifier: profile.email_professional || profile.email || '',
                              granted_at: new Date().toISOString().split('T')[0],
                              is_active: true
                            };
                            updated = [...currentAccesses, newAccess];
                          }

                          handleChange('system_accesses' as any, updated as any);
                        };

                        const handleUpdateAccess = (sysId: string, patch: Partial<EmployeeSystemAccess>) => {
                          const updated = currentAccesses.map(a => {
                            if (a.system_id === sysId) {
                              return { ...a, ...patch };
                            }
                            return a;
                          });
                          handleChange('system_accesses' as any, updated as any);
                        };

                        const handleToggleCompany = (sysId: string, companyName: string) => {
                          const access = currentAccesses.find(a => a.system_id === sysId);
                          if (!access) return;

                          const currentCompanies = access.companies || (access.company ? [access.company] : []);
                          let newCompanies: string[];

                          if (currentCompanies.includes(companyName)) {
                            newCompanies = currentCompanies.filter(c => c !== companyName);
                          } else {
                            newCompanies = [...currentCompanies, companyName];
                          }

                          handleUpdateAccess(sysId, {
                            companies: newCompanies,
                            company: newCompanies[0] || ''
                          });
                        };

                        return (
                          <div className="space-y-6">
                            {categories.map(cat => {
                              const systemsInCat = allSystems.filter(s => s.category === cat);
                              if (systemsInCat.length === 0) return null;

                              return (
                                <div key={cat} className="space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                                      {cat}
                                    </h4>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                      {systemsInCat.filter(s => currentAccesses.some(a => a.system_id === s.id)).length} de {systemsInCat.length} Ativos
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {systemsInCat.map(sys => {
                                      const access = currentAccesses.find(a => a.system_id === sys.id);
                                      const isGranted = !!access;
                                      const assignedCompanies = access?.companies || (access?.company ? [access.company] : []);

                                      return (
                                        <div
                                          key={sys.id}
                                          className={`p-4 rounded-3xl border transition-all ${
                                            isGranted
                                              ? 'bg-white border-indigo-400 ring-2 ring-indigo-100 shadow-sm'
                                              : 'bg-white border-slate-200 opacity-75 hover:opacity-100 hover:border-slate-300'
                                          }`}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                              <input
                                                type="checkbox"
                                                id={`sys-${sys.id}`}
                                                checked={isGranted}
                                                onChange={() => handleToggleSystem(sys)}
                                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                                              />

                                              {/* Logotipo / Ícone do App */}
                                              <SystemAppIcon systemName={sys.name} category={sys.category} size="md" />

                                              <div className="min-w-0 flex-1">
                                                <label
                                                  htmlFor={`sys-${sys.id}`}
                                                  className="text-xs font-black uppercase text-slate-900 truncate block cursor-pointer tracking-tight"
                                                >
                                                  {sys.name}
                                                </label>
                                                <p className="text-[10px] text-slate-400 font-semibold truncate">
                                                  {sys.origin === 'interno' ? 'Interno' : 'Contrato Externo'}
                                                </p>
                                              </div>
                                            </div>

                                            {isGranted && (
                                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                                ✓ Concedido
                                              </span>
                                            )}
                                          </div>

                                          {/* Campos de configuração quando concedido */}
                                          {isGranted && access && (
                                            <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-3 animate-in fade-in">
                                              {/* 1. Seleção de Empresas do Grupo */}
                                              <div>
                                                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                                  Empresas do Grupo com Acesso:
                                                </label>
                                                <div className="flex flex-wrap gap-1.5">
                                                  {GRUPO_EMPRESAS.map(empresa => {
                                                    const isChecked = assignedCompanies.includes(empresa);
                                                    return (
                                                      <button
                                                        type="button"
                                                        key={empresa}
                                                        onClick={() => handleToggleCompany(sys.id, empresa)}
                                                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                                                          isChecked
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-[1.02]'
                                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                      >
                                                        {empresa}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>

                                              {/* 2. Nível e Login */}
                                              <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">
                                                    Nível de Acesso
                                                  </label>
                                                  <select
                                                    value={access.access_level || 'Operacional'}
                                                    onChange={(e) => handleUpdateAccess(sys.id, { access_level: e.target.value as any })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white"
                                                  >
                                                    <option value="Operacional">Operacional</option>
                                                    <option value="Tático">Tático</option>
                                                    <option value="Estratégico">Estratégico</option>
                                                  </select>
                                                </div>

                                                <div>
                                                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">
                                                    Login / Usuário
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={access.user_identifier || ''}
                                                    onChange={(e) => handleUpdateAccess(sys.id, { user_identifier: e.target.value })}
                                                    placeholder="Login ou e-mail"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white"
                                                  />
                                                </div>
                                              </div>

                                              {/* 3. Observações */}
                                              <div>
                                                <input
                                                  type="text"
                                                  value={access.notes || ''}
                                                  onChange={(e) => handleUpdateAccess(sys.id, { notes: e.target.value })}
                                                  placeholder="Observações (ex: token físico nº 4, 2FA no celular institucional...)"
                                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-600 focus:bg-white"
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Botão de Salvar no Rodapé da Aba */}
                            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                              <span className="text-xs text-slate-400 font-semibold">
                                {currentAccesses.length} sistemas vinculados a este integrante
                              </span>
                              <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                              >
                                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                <span>{isSaving ? 'Salvando...' : 'Salvar Acessos e Sistemas'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}

                  {/* ─── ABA BPR & METAS (AVALIAÇÃO MENSAL E HISTÓRICO DE CICLOS) ─── */}
                  {activeTab === 'bpr' && (
                    <motion.div
                      key="tab-bpr"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      {/* Header da Aba & Seletor de Ano */}
                      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 text-white rounded-3xl p-5 border border-amber-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                            <Coins size={22} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-black uppercase tracking-wider text-white">
                                Metas Mensais &amp; Elegibilidade de BPR
                              </h4>
                              <span className="bg-amber-500/30 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-400/30">
                                Ano {bprYear}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-0.5">
                              Insira o percentual de atingimento mensal (0 a 100%). O sistema calcula a média do ciclo e aplica o fator de bônus automaticamente.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                          {/* Seletor de Ano */}
                          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                            {[2024, 2025, 2026, 2027].map(yr => (
                              <button
                                key={yr}
                                type="button"
                                onClick={() => setBprYear(yr)}
                                className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all ${
                                  bprYear === yr ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {yr}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-amber-900/20 transition-all flex-1 sm:flex-none justify-center disabled:opacity-50"
                          >
                            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            <span>{isSaving ? 'Salvando...' : 'Salvar Metas'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Regras do BPR Banner */}
                      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="flex items-center gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-emerald-900/30">
                          <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs">100%</span>
                          <div>
                            <strong className="text-emerald-400 block text-[11px]">Média = 100%</strong>
                            <span className="text-[10px] text-slate-400">Recebe 100% do bônus rateado</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-amber-900/30">
                          <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-xs">75%</span>
                          <div>
                            <strong className="text-amber-400 block text-[11px]">Média ≥ 90% e &lt; 100%</strong>
                            <span className="text-[10px] text-slate-400">Recebe 75% do bônus rateado</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-rose-900/30">
                          <span className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-xs">0%</span>
                          <div>
                            <strong className="text-rose-400 block text-[11px]">Média &lt; 90%</strong>
                            <span className="text-[10px] text-slate-400">Sem direito ao bônus no ciclo</span>
                          </div>
                        </div>
                      </div>

                      {/* Conteúdo dos Dois Ciclos Semestrais */}
                      {(() => {
                        const currentScores: Record<string, Record<string, number>> = 
                          profile.bpr_monthly_scores || (profile.metadata as any)?.bpr_monthly_scores || {};
                        const yearScores = currentScores[String(bprYear)] || {};

                        const currentProofs: Record<string, Record<string, string>> = 
                          profile.bpr_monthly_proofs || (profile.metadata as any)?.bpr_monthly_proofs || {};
                        const yearProofs = currentProofs[String(bprYear)] || {};

                        const handleMonthChange = (monthKey: string, value: number) => {
                          const val = Math.max(0, Math.min(100, isNaN(value) ? 0 : value));
                          const updatedYear = { ...yearScores, [monthKey]: val };
                          const updatedAll = { ...currentScores, [String(bprYear)]: updatedYear };
                          
                          handleChange('bpr_monthly_scores' as any, updatedAll as any);
                          
                          // Salvar também no metadata para total compatibilidade
                          const prevMeta = profile.metadata || {};
                          handleChange('metadata' as any, { ...prevMeta, bpr_monthly_scores: updatedAll } as any);
                        };

                        const handleProofLinkChange = (monthKey: string, url: string) => {
                          const updatedYearProofs = { ...yearProofs, [monthKey]: url };
                          const updatedAllProofs = { ...currentProofs, [String(bprYear)]: updatedYearProofs };
                          
                          handleChange('bpr_monthly_proofs' as any, updatedAllProofs as any);
                          const prevMeta = profile.metadata || {};
                          handleChange('metadata' as any, { ...prevMeta, bpr_monthly_proofs: updatedAllProofs } as any);
                        };

                        const handleSetCycleBatch = (months: string[], value: number) => {
                          const updatedYear = { ...yearScores };
                          months.forEach(m => { updatedYear[m] = value; });
                          const updatedAll = { ...currentScores, [String(bprYear)]: updatedYear };
                          
                          handleChange('bpr_monthly_scores' as any, updatedAll as any);
                          const prevMeta = profile.metadata || {};
                          handleChange('metadata' as any, { ...prevMeta, bpr_monthly_scores: updatedAll } as any);
                        };

                        // Ciclo 1 (C1): 1º Semestre (Jan a Jun - Pago até Setembro)
                        const c1Months = [
                          { key: '01', label: 'Janeiro' },
                          { key: '02', label: 'Fevereiro' },
                          { key: '03', label: 'Março' },
                          { key: '04', label: 'Abril' },
                          { key: '05', label: 'Maio' },
                          { key: '06', label: 'Junho' }
                        ];

                        const hasC1Recorded = c1Months.some(m => yearScores[m.key] !== undefined && yearScores[m.key] !== null);
                        const c1Values = c1Months.map(m => (yearScores[m.key] !== undefined && yearScores[m.key] !== null && !isNaN(Number(yearScores[m.key]))) ? Number(yearScores[m.key]) : 100);
                        const c1Average = hasC1Recorded
                          ? c1Values.reduce((a, b) => a + Number(b), 0) / 6
                          : null;

                        // Ciclo 2 (C2): 2º Semestre (Jul a Dez - Pago até Março)
                        const c2Months = [
                          { key: '07', label: 'Julho' },
                          { key: '08', label: 'Agosto' },
                          { key: '09', label: 'Setembro' },
                          { key: '10', label: 'Outubro' },
                          { key: '11', label: 'Novembro' },
                          { key: '12', label: 'Dezembro' }
                        ];

                        const hasC2Recorded = c2Months.some(m => yearScores[m.key] !== undefined && yearScores[m.key] !== null);
                        const c2Values = c2Months.map(m => (yearScores[m.key] !== undefined && yearScores[m.key] !== null && !isNaN(Number(yearScores[m.key]))) ? Number(yearScores[m.key]) : 100);
                        const c2Average = hasC2Recorded
                          ? c2Values.reduce((a, b) => a + Number(b), 0) / 6
                          : null;

                        const getBadge = (avg: number | null) => {
                          if (avg === null) {
                            return (
                              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-bold border border-slate-700">
                                Sem notas cadastradas (Padrão 100%)
                              </span>
                            );
                          }
                          if (avg >= 100) {
                            return (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black border border-emerald-500/40 flex items-center gap-1">
                                <CheckCircle2 size={13} /> 100% do Bônus (Meta 100%)
                              </span>
                            );
                          }
                          if (avg >= 90) {
                            return (
                              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black border border-amber-500/40 flex items-center gap-1">
                                ⚡ 75% do Bônus (Meta {avg.toFixed(1)}%)
                              </span>
                            );
                          }
                          return (
                            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-black border border-rose-500/40 flex items-center gap-1">
                              ✕ 0% — Inelegível (Meta {avg.toFixed(1)}% &lt; 90%)
                            </span>
                          );
                        };

                        return (
                          <div className="space-y-6">
                            {/* CICLO 1 (C1) — 1º SEMESTRE (JAN A JUN) */}
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="text-sm font-black text-white uppercase tracking-wider">
                                      Ciclo 1 (C1) — 1º Semestre (01/01 a 30/06)
                                    </h5>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                                      Pagamento até Setembro
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    Média do semestre: <strong className="text-white font-mono">{c1Average !== null ? `${c1Average.toFixed(1)}%` : '—'}</strong>
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {getBadge(c1Average)}
                                  <button
                                    type="button"
                                    onClick={() => handleSetCycleBatch(c1Months.map(m => m.key), 100)}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg transition-all"
                                    title="Preencher 100% em todos os meses do 1º Semestre"
                                  >
                                    Set 100%
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                {c1Months.map(m => {
                                  const val = yearScores[m.key] !== undefined ? yearScores[m.key] : 100;
                                  const proofVal = yearProofs[m.key] || '';
                                  return (
                                    <div key={m.key} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2">
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-300">{m.label}</span>
                                        <span className={`font-mono font-black ${
                                          val >= 100 ? 'text-emerald-400' : val >= 90 ? 'text-amber-400' : 'text-rose-400'
                                        }`}>
                                          {val}%
                                        </span>
                                      </div>

                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={val}
                                        onChange={e => handleMonthChange(m.key, parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-right text-xs font-black text-white font-mono outline-none focus:border-amber-500"
                                      />

                                      <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={val}
                                        onChange={e => handleMonthChange(m.key, parseInt(e.target.value) || 0)}
                                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                      />

                                      {/* Campo para Link de Comprovação / Auditoria */}
                                      <div className="pt-1.5 border-t border-slate-800/80">
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="url"
                                            placeholder="Link comprovação..."
                                            value={proofVal}
                                            onChange={e => handleProofLinkChange(m.key, e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-[10px] text-slate-300 placeholder-slate-500 outline-none focus:border-amber-400 font-mono"
                                            title="URL da comprovação da avaliação mensal para auditoria"
                                          />
                                          {proofVal && (
                                            <a
                                              href={proofVal}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="p-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-400 rounded-lg transition-colors shrink-0"
                                              title="Abrir link da comprovação em nova aba"
                                            >
                                              <ExternalLink size={11} />
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* CICLO 2 (C2) — 2º SEMESTRE (JUL A DEZ) */}
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="text-sm font-black text-white uppercase tracking-wider">
                                      Ciclo 2 (C2) — 2º Semestre (01/07 a 31/12)
                                    </h5>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                                      Pagamento até Março (ano seguinte)
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    Média do semestre: <strong className="text-white font-mono">{c2Average !== null ? `${c2Average.toFixed(1)}%` : '—'}</strong>
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {getBadge(c2Average)}
                                  <button
                                    type="button"
                                    onClick={() => handleSetCycleBatch(c2Months.map(m => m.key), 100)}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg transition-all"
                                    title="Preencher 100% em todos os meses do 2º Semestre"
                                  >
                                    Set 100%
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                {c2Months.map(m => {
                                  const val = yearScores[m.key] !== undefined ? yearScores[m.key] : 100;
                                  const proofVal = yearProofs[m.key] || '';
                                  return (
                                    <div key={m.key} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2">
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-300">{m.label}</span>
                                        <span className={`font-mono font-black ${
                                          val >= 100 ? 'text-emerald-400' : val >= 90 ? 'text-amber-400' : 'text-rose-400'
                                        }`}>
                                          {val}%
                                        </span>
                                      </div>

                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={val}
                                        onChange={e => handleMonthChange(m.key, parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-right text-xs font-black text-white font-mono outline-none focus:border-amber-500"
                                      />

                                      <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={val}
                                        onChange={e => handleMonthChange(m.key, parseInt(e.target.value) || 0)}
                                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                      />

                                      {/* Campo para Link de Comprovação / Auditoria */}
                                      <div className="pt-1.5 border-t border-slate-800/80">
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="url"
                                            placeholder="Link comprovação..."
                                            value={proofVal}
                                            onChange={e => handleProofLinkChange(m.key, e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-[10px] text-slate-300 placeholder-slate-500 outline-none focus:border-amber-400 font-mono"
                                            title="URL da comprovação da avaliação mensal para auditoria"
                                          />
                                          {proofVal && (
                                            <a
                                              href={proofVal}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="p-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-400 rounded-lg transition-colors shrink-0"
                                              title="Abrir link da comprovação em nova aba"
                                            >
                                              <ExternalLink size={11} />
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Rodapé de Ações */}
                            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                              <span className="text-xs text-slate-400 font-semibold">
                                As metas mensais e links comprobatórios recalculam e auditam o bônus no Cockpit do BPR.
                              </span>
                              <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                              >
                                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                <span>{isSaving ? 'Salvando...' : 'Salvar Metas do BPR'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
               </div>
            )}
          </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Offboarding */}
      {isOffboardingOpen && (
        <OffboardingChecklistModal
          isOpen={isOffboardingOpen}
          onClose={() => setIsOffboardingOpen(false)}
          employee={profile as Employee}
          onRevokeAccesses={(empId, revokedSysIds) => {
            const currentAccesses: EmployeeSystemAccess[] = profile.system_accesses || (profile.metadata as any)?.system_accesses || [];
            const updated = currentAccesses.map(a => {
              if (revokedSysIds.includes(a.system_id)) {
                return { ...a, is_active: false, revoked_at: new Date().toISOString().split('T')[0] };
              }
              return a;
            });
            handleChange('system_accesses' as any, updated as any);
          }}
        />
      )}

      {/* Dynamic Inline cost editor modal */}
      {editingCost && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">{editingCost?.id ? 'Ajustar Lançamento de Custo' : 'Novo Lançamento de Custo'}</h4>
                <p className="text-[10px] text-emerald-100 uppercase mt-0.5">{editingCost?.id ? 'Correção rápida de inconsistência' : 'Adicionar custo histórico ou atual'}</p>
              </div>
              <div className="flex items-center gap-3">
                {editingCostType === 'CLT' && (
                  <label className={`flex items-center gap-1 px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer select-none ${isParsingPayroll ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isParsingPayroll ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                    <span>Importar Holerite (PDF)</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf"
                      onChange={handleParsePayrollPDF}
                      disabled={isParsingPayroll}
                    />
                  </label>
                )}
                <button onClick={() => setEditingCost(null)} className="text-white/80 hover:text-white transition-opacity">
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              {saveCostError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 leading-relaxed font-semibold">
                  {saveCostError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Competência Mensal</label>
                  <input 
                    type="date" 
                    value={editingCostCompetencia} 
                    onChange={e => setEditingCostCompetencia(e.target.value)} 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className={labelClass}>Regime / Tipo de Vínculo</label>
                  <select 
                    value={editingCostType} 
                    onChange={e => setEditingCostType(e.target.value as 'CLT' | 'MEI')} 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="CLT">CLT</option>
                    <option value="MEI">MEI / PJ</option>
                  </select>
                </div>
              </div>

              {/* Condicional de Layout: CLT vs MEI/PJ */}
              {editingCostType === 'CLT' ? (
                /* Formulário Expandido para CLT */
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {/* Proventos */}
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block border-b pb-1">Proventos (Vencimentos)</span>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Salário Base (Fixo)</label>
                        <input
                          type="number"
                          value={editingCostFixo}
                          onChange={e => setEditingCostFixo(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Total Proventos (Bruto)</label>
                        <input
                          type="number"
                          value={editingCostHolerite}
                          onChange={e => setEditingCostHolerite(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Horas Extras</label>
                        <input
                          type="number"
                          value={editingCostHoraExtra}
                          onChange={e => setEditingCostHoraExtra(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Adicional Noturno</label>
                        <input
                          type="number"
                          value={editingCostAdicionalNot}
                          onChange={e => setEditingCostAdicionalNot(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Férias</label>
                        <input
                          type="number"
                          value={editingCostFerias}
                          onChange={e => setEditingCostFerias(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">13º Salário</label>
                        <input
                          type="number"
                          value={editingCostDecimoTerceiro}
                          onChange={e => setEditingCostDecimoTerceiro(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Comissão</label>
                        <input
                          type="number"
                          value={editingCostComissao}
                          onChange={e => setEditingCostComissao(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Bônus / Variável</label>
                        <input
                          type="number"
                          value={editingCostBonus}
                          onChange={e => setEditingCostBonus(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Incentivos</label>
                        <input
                          type="number"
                          value={editingCostIncentivos}
                          onChange={e => setEditingCostIncentivos(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Adiantamento</label>
                        <input
                          type="number"
                          value={editingCostAdiantamento}
                          onChange={e => setEditingCostAdiantamento(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Rescisão</label>
                        <input
                          type="number"
                          value={editingCostRescisao}
                          onChange={e => setEditingCostRescisao(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Benefícios */}
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block border-b pb-1">Benefícios</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Vale Refeição</label>
                        <input
                          type="number"
                          value={editingCostVR}
                          onChange={e => setEditingCostVR(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Vale Transporte</label>
                        <input
                          type="number"
                          value={editingCostVT}
                          onChange={e => setEditingCostVT(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Cesta Alimentação</label>
                        <input
                          type="number"
                          value={editingCostCesta}
                          onChange={e => setEditingCostCesta(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Ajuda Custo / Conect.</label>
                        <input
                          type="number"
                          value={editingCostConectividade}
                          onChange={e => setEditingCostConectividade(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Banco de horas */}
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block border-b pb-1">Banco de Horas</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Saldo Banco Horas (Decimal)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingCostBancoHoras}
                          onChange={e => setEditingCostBancoHoras(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 font-bold tabular-nums"
                          placeholder="Ex: 10.5 ou -3.2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Descontos e Deduções */}
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-red-50/10 dark:bg-red-950/10 border-red-150/40 dark:border-red-900/20 space-y-3">
                    <span className="text-[10px] font-black text-red-500 dark:text-red-400 uppercase tracking-wider block border-b pb-1">Descontos e Glosas</span>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Descontos Holerite</label>
                        <input
                          type="number"
                          value={editingCostDescontos}
                          onChange={e => setEditingCostDescontos(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 text-right outline-none focus:ring-1 focus:ring-red-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Faltas / Atrasos</label>
                        <input
                          type="number"
                          value={editingCostFaltas}
                          onChange={e => setEditingCostFaltas(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 text-right outline-none focus:ring-1 focus:ring-red-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      {editingCostType === 'CLT' && (
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Dias de Falta (Qtd)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={editingCostDiasFaltas}
                            onChange={e => setEditingCostDiasFaltas(parseFloat(e.target.value) || 0)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 text-right outline-none focus:ring-1 focus:ring-red-500 font-bold tabular-nums"
                            placeholder="0.0"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Empréstimo Consignado</label>
                        <input
                          type="number"
                          value={editingCostConsignado}
                          onChange={e => setEditingCostConsignado(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 text-right outline-none focus:ring-1 focus:ring-red-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Glosa Base</label>
                        <input
                          type="number"
                          value={editingCostGlosaBase}
                          onChange={e => setEditingCostGlosaBase(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 text-right outline-none focus:ring-1 focus:ring-red-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Glosa Bônus</label>
                        <input
                          type="number"
                          value={editingCostGlosaBonus}
                          onChange={e => setEditingCostGlosaBonus(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 text-right outline-none focus:ring-1 focus:ring-red-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Deduções</label>
                        <input
                          type="number"
                          value={editingCostDeducoes}
                          onChange={e => setEditingCostDeducoes(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 text-right outline-none focus:ring-1 focus:ring-red-500 font-bold tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Verbas Adicionais Extra Folha */}
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-indigo-50/10 dark:bg-indigo-950/10 border-indigo-150/40 dark:border-indigo-900/20 space-y-3">
                    <div className="flex justify-between items-center border-b border-indigo-100/30 pb-1">
                      <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-wider block">Verbas Adicionais Extra Folha</span>
                      <span className="text-[8px] text-slate-400 font-bold uppercase">(Positivos somam, negativos descontam)</span>
                    </div>

                    {/* Lista de Verbas Adicionadas */}
                    {editingCostVerbasAdicionais.length > 0 && (
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                        {editingCostVerbasAdicionais.map((v, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-lg p-2 shadow-sm text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{v.name}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                                v.value >= 0 
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                  : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                              }`}>
                                {v.value >= 0 ? 'Ganho' : 'Desconto'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`font-black tabular-nums ${v.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-650 dark:text-red-400'}`}>
                                {v.value >= 0 ? '+' : ''}{formatCurrency(v.value)}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCostVerbasAdicionais(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                title="Excluir verba"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Controles para Adicionar Nova Verba */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end pt-1 bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                      <div className="relative text-left">
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Nome da Verba</label>
                        <input
                          type="text"
                          value={newVerbaName}
                          onChange={e => setNewVerbaName(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                          placeholder="Ex: Prêmio Especial, Reembolso"
                          list="verbas-sugestoes"
                        />
                        <datalist id="verbas-sugestoes">
                          <option value="Prêmio Extra" />
                          <option value="Reembolso Viagem" />
                          <option value="Reembolso KM" />
                          <option value="Abono Pecuniário" />
                          <option value="Ajuda de Custo Extra" />
                          <option value="Multa FGTS Rescisório" />
                          <option value="Seguro de Vida Coletivo" />
                          <option value="Plano de Saúde Coparticipação" />
                          <option value="Desconto Coparticipação" />
                          <option value="Ajuste de Folha" />
                        </datalist>
                      </div>

                      <div className="text-left">
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Valor (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={newVerbaValue === 0 ? '' : newVerbaValue}
                          onChange={e => setNewVerbaValue(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-right font-bold tabular-nums text-slate-850 dark:text-slate-250"
                          placeholder="0.00 (Ex: -150 para desc)"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!newVerbaName.trim()) {
                            alert('Informe o nome da verba.');
                            return;
                          }
                          if (newVerbaValue === 0) {
                            alert('Informe um valor diferente de zero.');
                            return;
                          }
                          setEditingCostVerbasAdicionais(prev => [
                            ...prev,
                            { name: newVerbaName.trim(), value: newVerbaValue }
                          ]);
                          setNewVerbaName('');
                          setNewVerbaValue(0);
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded px-2.5 py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm active:scale-98"
                      >
                        <Plus size={13} /> Adicionar Verba
                      </button>
                    </div>
                  </div>

                  {/* Observações */}
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30">
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Observações</label>
                    <textarea
                      value={editingCostObservacao}
                      onChange={e => setEditingCostObservacao(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 dark:text-slate-350 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                      rows={2}
                      placeholder="Alguma nota sobre a folha ou desconto..."
                    />
                  </div>
                </div>
              ) : (
                /* Tabela de verbas clássica MEI/PJ */
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Detalhamento de Verbas</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCostFixo(profile?.remuneration_fixed || profile?.remuneration || 0);
                          setEditingCostBonus(profile?.remuneration_bonus || 0);
                          setEditingCostComissao(profile?.remuneration_commission || 0);
                          setEditingCostIncentivos(profile?.remuneration_incentives || 0);
                          setEditingCostConectividade(profile?.remuneration_connectivity || 0);
                        }}
                        className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 transform"
                      >
                        <Copy size={12} /> Copiar do Contrato (Repetir Tudo)
                      </button>
                    </div>

                    <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <th className="p-2.5">Verba</th>
                            <th className="p-2.5 text-right">Previsto</th>
                            <th className="p-2.5 text-center" style={{ width: '130px' }}>Pago (Real)</th>
                            <th className="p-2.5 text-right">Diferença</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                          {/* Fixo */}
                          <tr>
                            <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">Fixo</td>
                            <td className="p-2.5 text-right font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatCurrency(profile?.remuneration_fixed || profile?.remuneration || 0)}
                            </td>
                            <td className="p-1.5 text-center">
                              <input 
                                type="number"
                                value={editingCostFixo}
                                onChange={e => setEditingCostFixo(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-bold tabular-nums"
                                placeholder="0.00"
                              />
                            </td>
                            <td className={`p-2.5 text-right font-extrabold tabular-nums ${
                              (editingCostFixo - (profile?.remuneration_fixed || profile?.remuneration || 0)) > 0.01 ? 'text-emerald-600 dark:text-emerald-400' :
                              (editingCostFixo - (profile?.remuneration_fixed || profile?.remuneration || 0)) < -0.01 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {(() => {
                                const diff = editingCostFixo - (profile?.remuneration_fixed || profile?.remuneration || 0);
                                return `${diff > 0.01 ? '+' : ''}${formatCurrency(diff)}`;
                              })()}
                            </td>
                          </tr>

                          {/* Bônus */}
                          <tr>
                            <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">Bônus</td>
                            <td className="p-2.5 text-right font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatCurrency(profile?.remuneration_bonus || 0)}
                            </td>
                            <td className="p-1.5 text-center">
                              <input 
                                type="number"
                                value={editingCostBonus}
                                onChange={e => setEditingCostBonus(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-bold tabular-nums"
                                placeholder="0.00"
                              />
                            </td>
                            <td className={`p-2.5 text-right font-extrabold tabular-nums ${
                              (editingCostBonus - (profile?.remuneration_bonus || 0)) > 0.01 ? 'text-emerald-600 dark:text-emerald-400' :
                              (editingCostBonus - (profile?.remuneration_bonus || 0)) < -0.01 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {(() => {
                                const diff = editingCostBonus - (profile?.remuneration_bonus || 0);
                                return `${diff > 0.01 ? '+' : ''}${formatCurrency(diff)}`;
                              })()}
                            </td>
                          </tr>

                          {/* Comissão */}
                          <tr>
                            <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">Comissão</td>
                            <td className="p-2.5 text-right font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatCurrency(profile?.remuneration_commission || 0)}
                            </td>
                            <td className="p-1.5 text-center">
                              <input 
                                type="number"
                                value={editingCostComissao}
                                onChange={e => setEditingCostComissao(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-bold tabular-nums"
                                placeholder="0.00"
                              />
                            </td>
                            <td className={`p-2.5 text-right font-extrabold tabular-nums ${
                              (editingCostComissao - (profile?.remuneration_commission || 0)) > 0.01 ? 'text-emerald-600 dark:text-emerald-400' :
                              (editingCostComissao - (profile?.remuneration_commission || 0)) < -0.01 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {(() => {
                                const diff = editingCostComissao - (profile?.remuneration_commission || 0);
                                return `${diff > 0.01 ? '+' : ''}${formatCurrency(diff)}`;
                              })()}
                            </td>
                          </tr>

                          {/* Incentivos */}
                          <tr>
                            <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">Incentivos</td>
                            <td className="p-2.5 text-right font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatCurrency(profile?.remuneration_incentives || 0)}
                            </td>
                            <td className="p-1.5 text-center">
                              <input 
                                type="number"
                                value={editingCostIncentivos}
                                onChange={e => setEditingCostIncentivos(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-bold tabular-nums"
                                placeholder="0.00"
                              />
                            </td>
                            <td className={`p-2.5 text-right font-extrabold tabular-nums ${
                              (editingCostIncentivos - (profile?.remuneration_incentives || 0)) > 0.01 ? 'text-emerald-600 dark:text-emerald-400' :
                              (editingCostIncentivos - (profile?.remuneration_incentives || 0)) < -0.01 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {(() => {
                                const diff = editingCostIncentivos - (profile?.remuneration_incentives || 0);
                                return `${diff > 0.01 ? '+' : ''}${formatCurrency(diff)}`;
                              })()}
                            </td>
                          </tr>

                          {/* Conectividade */}
                          <tr>
                            <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">Conectividade</td>
                            <td className="p-2.5 text-right font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatCurrency(profile?.remuneration_connectivity || 0)}
                            </td>
                            <td className="p-1.5 text-center">
                              <input 
                                type="number"
                                value={editingCostConectividade}
                                onChange={e => setEditingCostConectividade(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded px-2 py-1 text-xs text-slate-850 dark:text-slate-200 text-right outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-bold tabular-nums"
                                placeholder="0.00"
                              />
                            </td>
                            <td className={`p-2.5 text-right font-extrabold tabular-nums ${
                              (editingCostConectividade - (profile?.remuneration_connectivity || 0)) > 0.01 ? 'text-emerald-600 dark:text-emerald-400' :
                              (editingCostConectividade - (profile?.remuneration_connectivity || 0)) < -0.01 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {(() => {
                                const diff = editingCostConectividade - (profile?.remuneration_connectivity || 0);
                                return `${diff > 0.01 ? '+' : ''}${formatCurrency(diff)}`;
                              })()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Seção de Descontos e Ajustes */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Descontos e Ajustes do Mês</span>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Glosa Base</label>
                        <input 
                          type="number" 
                          value={editingCostGlosaBase} 
                          onChange={e => setEditingCostGlosaBase(parseFloat(e.target.value) || 0)} 
                          className="w-full bg-red-50/50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 rounded-lg px-2.5 py-1.5 text-xs text-red-700 dark:text-red-400 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-semibold tabular-nums text-right"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Glosa Bônus</label>
                        <input 
                          type="number" 
                          value={editingCostGlosaBonus} 
                          onChange={e => setEditingCostGlosaBonus(parseFloat(e.target.value) || 0)} 
                          className="w-full bg-red-50/50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 rounded-lg px-2.5 py-1.5 text-xs text-red-700 dark:text-red-400 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-semibold tabular-nums text-right"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Deduções</label>
                        <input 
                          type="number" 
                          value={editingCostDeducoes} 
                          onChange={e => setEditingCostDeducoes(parseFloat(e.target.value) || 0)} 
                          className="w-full bg-red-50/50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 rounded-lg px-2.5 py-1.5 text-xs text-red-700 dark:text-red-400 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-semibold tabular-nums text-right"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              {/* Resumo do Total Líquido */}
              {(() => {
                const previstoTotal = (profile?.remuneration_fixed || profile?.remuneration || 0) + 
                                      (profile?.remuneration_bonus || 0) + 
                                      (profile?.remuneration_commission || 0) + 
                                      (profile?.remuneration_incentives || 0) + 
                                      (profile?.remuneration_connectivity || 0);
                
                const pagoTotal = editingCostType === 'CLT'
                  ? (editingCostFixo + editingCostHoraExtra + editingCostAdicionalNot + editingCostFerias + editingCostDecimoTerceiro + editingCostBonus + editingCostComissao + editingCostIncentivos + editingCostConectividade) - 
                    (editingCostDescontos + editingCostFaltas + editingCostConsignado + editingCostGlosaBase + editingCostGlosaBonus + editingCostDeducoes)
                  : (editingCostFixo + editingCostBonus + editingCostComissao + editingCostIncentivos + editingCostConectividade) - 
                    (editingCostGlosaBase + editingCostGlosaBonus + editingCostDeducoes);
                
                const diffTotal = pagoTotal - previstoTotal;
                
                return (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 shadow-inner">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Resumo do Total Líquido</span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Previsto (Contrato)</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-350 tabular-nums">{formatCurrency(previstoTotal)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Pago (Real)</span>
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(pagoTotal)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Diferença</span>
                        <span className={`text-xs font-black tabular-nums ${
                          diffTotal > 0.01 ? 'text-emerald-600 dark:text-emerald-400' :
                          diffTotal < -0.01 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {diffTotal > 0.01 ? '+' : ''}{formatCurrency(diffTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-3 pt-2">
                {editingCost?.id && (
                  <button
                    onClick={() => handleDeleteCost(editingCost.id)}
                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95"
                  >
                    <Trash2 size={13} /> Excluir Custo
                  </button>
                )}
                <button
                  onClick={() => setEditingCost(null)}
                  className="ml-auto px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveCost}
                  className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DIANNA IMPORT */}
      {isDiannaImportOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-amber-50/50 dark:bg-amber-950/20">
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-500 flex items-center gap-2">
                  <Database size={16} /> Data Lake: Planilha Dianna
                </h3>
                <p className="text-[10px] text-amber-700/70 font-bold uppercase tracking-wider mt-0.5">
                  Resultados encontrados para "{profile.name || 'Desconhecido'}"
                </p>
              </div>
              <button 
                onClick={() => setIsDiannaImportOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Campo de Consulta em Tempo Real */}
            <div className="p-3 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 focus-within:border-emerald-500 transition-colors">
                <Search size={16} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Refinar consulta por nome completo ou mês (ex: Guilherme Oliveira)..."
                  value={diannaSearchFilter}
                  onChange={e => setDiannaSearchFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none w-full font-medium"
                />
                {diannaSearchFilter && (
                  <button 
                    onClick={() => setDiannaSearchFilter('')}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase px-1"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-slate-50/30 dark:bg-slate-900">
              {(() => {
                const filteredDiannaList = diannaResults.filter((row: any) => {
                  if (!diannaSearchFilter.trim()) return true;
                  const fWords = diannaSearchFilter.toLowerCase().trim().split(' ').filter((w: string) => w.length > 0);
                  const nNorm = (row.nome_bruto || '').toLowerCase();
                  const cNorm = (row.competencia || '').toLowerCase();
                  return fWords.every((w: string) => nNorm.includes(w) || cNorm.includes(w));
                });

                if (filteredDiannaList.length === 0) {
                  return (
                    <div className="text-center py-10">
                      <p className="text-sm text-slate-500 font-bold">Nenhum registro localizado.</p>
                      <p className="text-xs text-slate-400 mt-1">Tente ajustar o termo no campo de consulta acima.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filteredDiannaList.map((item) => {
                      const originalIdx = diannaResults.indexOf(item);
                      const isSelected = selectedDiannaRows.includes(originalIdx);
                      return (
                        <div 
                          key={originalIdx}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedDiannaRows(prev => prev.filter(i => i !== originalIdx));
                            } else {
                              setSelectedDiannaRows(prev => [...prev, originalIdx]);
                            }
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
                            isSelected 
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300'
                          }`}
                        >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <CheckCircle2 size={14} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              {new Date(item.competencia + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                            </p>
                            <p className="text-sm font-extrabold text-emerald-600 tabular-nums">
                              R$ {item.valor_total?.toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">
                            Nome na Planilha: <span className="font-bold text-slate-700">{item.nome_bruto}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 uppercase mt-0.5">
                            Aba Origem: {item.sheet}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            </div>
            
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500">
                {selectedDiannaRows.length} selecionados
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDiannaImportOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportDiannaSelected}
                  disabled={selectedDiannaRows.length === 0 || isImportingDianna}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isImportingDianna ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Importar Selecionados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSearchExistingOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[70vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Buscar Colaborador Cadastrado</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Vincular ficha existente</p>
              </div>
              <button 
                onClick={() => setIsSearchExistingOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <input 
                type="text"
                placeholder="Pesquisar por nome, CPF, CNPJ ou cargo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/30 dark:bg-slate-900/10 min-h-[200px]">
              {isSearchingExisting ? (
                <div className="h-full flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-10">Nenhum colaborador encontrado.</p>
              ) : (
                filteredEmployees.map(emp => (
                  <div 
                    key={emp.id}
                    onClick={() => {
                      if (confirm(`Deseja carregar a ficha de ${emp.name}?`)) {
                        handleLoadExistingEmployee(emp.id);
                      }
                    }}
                    className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-emerald-500/30 hover:bg-slate-50/30 cursor-pointer flex items-center gap-3 transition-all group"
                  >
                    <img 
                      src={emp.photo_url || emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=e2e8f0&color=475569&bold=true`}
                      alt={emp.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-600 transition-colors">{emp.name}</p>
                      <div className="flex gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                        <span className="bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-[9px] uppercase font-bold text-slate-500">{emp.linkType}</span>
                        {emp.job_role && <span className="truncate">{emp.job_role}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──── MODAL DE MESCLAGEM SELETIVA DE DADOS ──── */}
      {pendingMerge && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-t-[28px]">
              <div>
                <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  <AlertCircle size={18} className="text-blue-200" />
                  Colaborador Já Cadastrado — Revisar Mesclagem
                </h3>
                <p className="text-[11px] text-blue-200 font-medium mt-0.5">
                  Escolha quais dados devem ser atualizados na ficha. Os empréstimos nunca serão afetados.
                </p>
              </div>
              <button
                onClick={() => { setPendingMerge(null); setSelectedMergeFields({}); }}
                className="p-2 hover:bg-white/20 rounded-xl text-white/70 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Warning Banner for older contracts */}
            {(() => {
              const existing = pendingMerge.existingProfile;
              const contractDate = pendingMerge.contractDate;
              const activeDate = existing.last_raise_date || existing.department_start_date || existing.start_date;
              const isIncomingOlder = !!(contractDate && activeDate && contractDate < activeDate);

              if (!isIncomingOlder) return null;

              return (
                <div className="mx-6 mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-start gap-2.5 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                  <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      Contrato Histórico / Antigo Detectado
                    </p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                      Este documento possui data de assinatura/início ({new Date(contractDate + "T12:00:00").toLocaleDateString('pt-BR')}) anterior à última atualização cadastral do colaborador no banco ({new Date(activeDate + "T12:00:00").toLocaleDateString('pt-BR')}).
                      Por padrão, os dados mais recentes do banco foram mantidos para evitar o retrocesso de cargos ou salários atuais. O histórico e o documento serão anexados normalmente na trajetória do colaborador.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Legenda */}
            <div className="flex items-center gap-6 px-6 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40 text-[10px] font-bold uppercase tracking-wider shrink-0">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="w-3 h-3 rounded-full bg-slate-300 inline-block"></span>
                Campo
              </span>
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span>
                Banco de Dados (Atual)
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                Contrato PDF (Novo)
              </span>
            </div>

            {/* Tabela de diferenças */}
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const diffFields = MERGE_FIELDS.filter(field => {
                  return selectedMergeFields[field.key] !== undefined;
                });

                if (diffFields.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <CheckCircle2 size={40} className="text-emerald-400 mb-3" />
                      <p className="text-sm font-bold">Nenhuma divergência encontrada!</p>
                      <p className="text-xs mt-1">Todos os campos do PDF coincidem com o banco de dados.</p>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {diffFields.map(field => {
                      const existingVal = pendingMerge.existingProfile[field.key as keyof Employee];
                      const incomingVal = pendingMerge.incomingData[field.key as keyof Employee];
                      const selection = selectedMergeFields[field.key];

                      const displayVal = (val: any) => {
                        if (val === undefined || val === null || val === '') return <span className="italic text-slate-300">—</span>;
                        if ((field as any).isCurrency) return formatCurrency(Number(val));
                        if ((field as any).isDate && typeof val === 'string' && val.includes('-')) {
                          const [y, m, d] = val.split('-');
                          return d ? `${d}/${m}/${y}` : val;
                        }
                        return String(val);
                      };

                      return (
                        <div key={field.key} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          {/* Field label */}
                          <div className="px-6 py-3.5 border-r border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{field.label}</span>
                          </div>

                          {/* Existing value */}
                          <div
                            onClick={() => setSelectedMergeFields(prev => ({ ...prev, [field.key]: 'existing' }))}
                            className={`px-5 py-3.5 border-r border-slate-100 dark:border-slate-800 cursor-pointer transition-all ${selection === 'existing' ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selection === 'existing' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                {selection === 'existing' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                              </div>
                              <span className={`text-xs font-semibold break-all ${selection === 'existing' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                {displayVal(existingVal)}
                              </span>
                            </div>
                          </div>

                          {/* Incoming value */}
                          <div
                            onClick={() => setSelectedMergeFields(prev => ({ ...prev, [field.key]: 'incoming' }))}
                            className={`px-5 py-3.5 cursor-pointer transition-all ${selection === 'incoming' ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selection === 'incoming' ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                {selection === 'incoming' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                              </div>
                              <span className={`text-xs font-semibold break-all ${selection === 'incoming' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                {displayVal(incomingVal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Rodapé */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                <Coins size={13} className="text-amber-500 shrink-0" />
                <span>Os dados de empréstimos vinculados a este colaborador não serão afetados.</span>
              </div>
              <div className="flex gap-2.5 shrink-0">
                <button
                  onClick={() => { setPendingMerge(null); setSelectedMergeFields({}); }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const allExisting = Object.fromEntries(
                      Object.keys(selectedMergeFields).map(k => [k, 'existing' as const])
                    );
                    setSelectedMergeFields(allExisting);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  ← Manter Tudo Atual
                </button>
                <button
                  onClick={() => {
                    const allIncoming = Object.fromEntries(
                      Object.keys(selectedMergeFields).map(k => [k, 'incoming' as const])
                    );
                    setSelectedMergeFields(allIncoming);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all"
                >
                  Aceitar Tudo do PDF →
                </button>
                <button
                  onClick={handleConfirmMerge}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  Aplicar Mesclagem
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Vínculo Contratual (Trajetória) */}
      {editingBond && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white mb-4 shrink-0">
              {editingBond.id ? 'Editar Vínculo Contratual' : 'Novo Vínculo Contratual'}
            </h4>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-slate-800 dark:text-slate-200">
              {/* Regime e Empresa Contratante */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Regime de Contrato</label>
                  <select
                    value={editingBond.regime || 'CLT'}
                    onChange={e => setEditingBond(prev => ({ ...prev, regime: e.target.value as any }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs py-2 px-3 outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="CLT">CLT</option>
                    <option value="PJ">PJ</option>
                    <option value="MEI">MEI</option>
                    <option value="Estagiário">Estagiário</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Empresa Contratante</label>
                  <input
                    type="text"
                    value={editingBond.contracting_company || ''}
                    onChange={e => setEditingBond(prev => ({ ...prev, contracting_company: e.target.value }))}
                    placeholder="Ex: Mar Brasil Serviços"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs py-2 px-3 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Se for PJ ou MEI, exibe campos adicionais */}
              {(editingBond.regime === 'PJ' || editingBond.regime === 'MEI') && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 rounded-2xl space-y-3">
                  <h5 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dados PJ/MEI</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">CNPJ PJ/MEI</label>
                      <input
                        type="text"
                        value={editingBond.pj_cnpj || ''}
                        onChange={e => setEditingBond(prev => ({ ...prev, pj_cnpj: e.target.value }))}
                        placeholder="00.000.000/0000-00"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-1.5 px-2.5 outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Razão Social</label>
                      <input
                        type="text"
                        value={editingBond.pj_razao_social || ''}
                        onChange={e => setEditingBond(prev => ({ ...prev, pj_razao_social: e.target.value }))}
                        placeholder="Razão Social Ltda"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-1.5 px-2.5 outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Nome Fantasia</label>
                      <input
                        type="text"
                        value={editingBond.pj_nome_fantasia || ''}
                        onChange={e => setEditingBond(prev => ({ ...prev, pj_nome_fantasia: e.target.value }))}
                        placeholder="Nome Fantasia"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-1.5 px-2.5 outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Endereço Comercial</label>
                      <input
                        type="text"
                        value={editingBond.pj_endereco_completo || ''}
                        onChange={e => setEditingBond(prev => ({ ...prev, pj_endereco_completo: e.target.value }))}
                        placeholder="Rua, Número, Bairro, CEP"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-1.5 px-2.5 outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Datas de Vigência */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Data Início</label>
                  <input
                    type="date"
                    value={editingBond.start_date || ''}
                    onChange={e => setEditingBond(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs py-2 px-2 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Vencimento (Opcional)</label>
                  <input
                    type="date"
                    value={editingBond.expiration_date || ''}
                    onChange={e => setEditingBond(prev => ({ ...prev, expiration_date: e.target.value || undefined }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs py-2 px-2 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Rescisão (Opcional)</label>
                  <input
                    type="date"
                    value={editingBond.end_date || ''}
                    onChange={e => setEditingBond(prev => ({ ...prev, end_date: e.target.value || undefined }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs py-2 px-2 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Valores Financeiros */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 rounded-2xl space-y-3">
                <h5 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Detalhamento Financeiro (Mensal)</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Remuneração Base</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingBond.remuneration_base ?? 0}
                      onChange={e => setEditingBond(prev => ({ ...prev, remuneration_base: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-1.5 px-2.5 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Bônus Variável</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingBond.remuneration_bonus ?? 0}
                      onChange={e => setEditingBond(prev => ({ ...prev, remuneration_bonus: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-1.5 px-2.5 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Incentivos Fixos</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingBond.remuneration_incentives ?? 0}
                      onChange={e => setEditingBond(prev => ({ ...prev, remuneration_incentives: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-1.5 px-1.5 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Ajudas de Custo</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingBond.remuneration_allowances ?? 0}
                      onChange={e => setEditingBond(prev => ({ ...prev, remuneration_allowances: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-1.5 px-1.5 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Comissões</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingBond.remuneration_commissions ?? 0}
                      onChange={e => setEditingBond(prev => ({ ...prev, remuneration_commissions: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-1.5 px-1.5 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Motivo e Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Motivo do Gatilho</label>
                  <input
                    type="text"
                    value={editingBond.trigger_reason || ''}
                    onChange={e => setEditingBond(prev => ({ ...prev, trigger_reason: e.target.value }))}
                    placeholder="Ex: Admissão, Promoção de Cargo"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs py-2 px-3 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Status</label>
                  <select
                    value={editingBond.status || 'Ativo'}
                    onChange={e => setEditingBond(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs py-2 px-3 outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Vencido">Vencido</option>
                    <option value="Encerrado">Encerrado</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6 shrink-0 border-t border-slate-100 dark:border-slate-800 pt-4 bg-white dark:bg-slate-900 rounded-b-[24px]">
              <button
                type="button"
                onClick={() => setEditingBond(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-600 transition-all uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingBond}
                onClick={() => handleSaveBond(editingBond)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase flex items-center gap-1.5"
              >
                {isSavingBond && <Loader2 size={12} className="animate-spin" />}
                Salvar Vínculo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Evento de Histórico (Timeline) */}
      {editingHistoryItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white mb-4 shrink-0">
              {editingHistoryItem.id ? 'Editar Evento do Histórico' : 'Novo Evento do Histórico'}
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Tipo de Evento</label>
                <select
                  value={editingHistoryItem.event_type || 'Cargo'}
                  onChange={e => setEditingHistoryItem(prev => ({ ...prev, event_type: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs py-2 px-3 outline-none focus:border-emerald-500 transition-colors text-slate-800 dark:text-slate-200"
                >
                  <option value="Cargo">Cargo (Função)</option>
                  <option value="Setor">Setor (Departamento)</option>
                  <option value="Remuneração">Remuneração (Salário/Benefícios)</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Data da Alteração</label>
                <input
                  type="date"
                  value={editingHistoryItem.change_date || ''}
                  onChange={e => setEditingHistoryItem(prev => ({ ...prev, change_date: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs py-2 px-3 outline-none focus:border-emerald-500 transition-colors text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Observações / Descrição</label>
                <textarea
                  value={editingHistoryItem.observations || ''}
                  onChange={e => setEditingHistoryItem(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Ex: Mudança de cargo de Estagiário para CLT"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs py-2 px-3.5 outline-none focus:border-emerald-500 transition-colors text-slate-800 dark:text-slate-200 h-24 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6 shrink-0 border-t border-slate-100 dark:border-slate-800 pt-4 bg-white dark:bg-slate-900 rounded-b-[24px]">
              <button
                type="button"
                onClick={() => setEditingHistoryItem(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-600 transition-all uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingHistoryItem}
                onClick={() => handleSaveHistoryItem(editingHistoryItem)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase flex items-center gap-1.5"
              >
                {isSavingHistoryItem && <Loader2 size={12} className="animate-spin" />}
                Salvar Evento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhamento por Verbas */}
      {verbaDetailModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2">
                <Coins size={18} className="text-emerald-400" />
                {verbaDetailModal.title}
              </h3>
              <button 
                onClick={() => setVerbaDetailModal(null)} 
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Composição das Verbas Mês a Mês</p>
              
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
                {verbaDetailModal.items.map((item, idx) => (
                  <div key={idx} className="p-3.5 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{item.label}</span>
                    <div className="text-right">
                      <span className="font-black text-slate-900 dark:text-white block tabular-nums">
                        {formatCurrency(item.total)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        Média: {formatCurrency(item.average)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 flex justify-between items-center mt-4 shadow-sm">
                <div>
                  <span className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-400 block">Total da Categoria</span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 block">
                    Média Mensal: {formatCurrency(verbaDetailModal.average)}
                  </span>
                </div>
                <span className="text-base font-black text-emerald-900 dark:text-emerald-200 tabular-nums">
                  {formatCurrency(verbaDetailModal.total)}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-right">
              <button 
                onClick={() => setVerbaDetailModal(null)} 
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportação Customizada da Ficha */}
      <ProfileExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        profile={profile}
        history={history}
        bonds={bonds}
        costs={costs}
        loanSummary={loanSummary}
      />

      {/* Modal de Limpeza de Custo Histórico */}
      <ClearCostHistoryModal
        isOpen={isClearHistoryModalOpen}
        onClose={() => setIsClearHistoryModalOpen(false)}
        employeeId={profile?.id}
        employeeName={profile?.name}
        availableCompetencias={costs?.map(c => c.competencia)}
        onSuccess={async () => {
          if (profile?.id) {
            const freshCosts = await PeopleHRService.getMonthlyCosts(profile.id);
            setCosts(freshCosts || []);
            onDataChanged?.(profile.id);
          }
        }}
      />

    </AnimatePresence>
  );
}
