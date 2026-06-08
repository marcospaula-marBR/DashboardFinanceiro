"use client";

import { useState, useEffect } from "react";
import { X, UserRound, MapPin, GraduationCap, Loader2, Save, Upload, PenBox, CheckCircle2, Files, FileText, Trash2, ExternalLink, Briefcase, Coins, AlertCircle, Phone, Home, Building2, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Employee, EmploymentContract, MonthlyCost, getRemunerationLabel, AuditIssue } from "@/types/loans";
import { PeopleService } from "@/services/people.service";
import { PeopleHRService } from "@/services/people-hr.service";
import { EmploymentBondTimeline } from "./EmploymentBondTimeline";
import { formatCurrency } from "@/services/loans.service";
import { useDataMode } from "@/contexts/DataModeContext";

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
  { key: 'start_date', label: 'Data de Admissão', isDate: true },
  { key: 'contract_expiry_date', label: 'Vencimento Contrato', isDate: true },
  { key: 'job_role', label: 'Cargo / Função' },
  { key: 'department', label: 'Setor / Departamento' },
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
}

export function ProfileDrawer({ isOpen, onClose, employeeId, onDataChanged, isTestMode: propIsTestMode, setores = [] }: ProfileDrawerProps) {
  const { isTestMode: contextIsTestMode } = useDataMode();
  const isTestMode = propIsTestMode ?? contextIsTestMode;
  
  const [profile, setProfile] = useState<Partial<Employee>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Abas: 'pessoal', 'endereco', 'complementar', 'fichaExecutiva', 'trajetoria', 'custo', 'auditoria'
  const [activeTab, setActiveTab] = useState<'pessoal' | 'endereco' | 'complementar' | 'fichaExecutiva' | 'trajetoria' | 'custo' | 'auditoria'>('pessoal');
  const [isEditMode, setIsEditMode] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [bonds, setBonds] = useState<EmploymentContract[]>([]);
  const [costs, setCosts] = useState<MonthlyCost[]>([]);
  const [auditIssues, setAuditIssues] = useState<AuditIssue[]>([]);

  // Auditoria quick cost editor state
  const [editingCost, setEditingCost] = useState<MonthlyCost | null>(null);
  const [editingCostCompetencia, setEditingCostCompetencia] = useState('');
  const [editingCostType, setEditingCostType] = useState<'CLT' | 'MEI'>('CLT');
  const [editingCostFixo, setEditingCostFixo] = useState(0);
  const [editingCostBonus, setEditingCostBonus] = useState(0);
  const [editingCostComissao, setEditingCostComissao] = useState(0);
  const [saveCostError, setSaveCostError] = useState<string | null>(null);
  const [isSearchingCEP, setIsSearchingCEP] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [isSearchingCNPJCEP, setIsSearchingCNPJCEP] = useState(false);
  const [cnpjCepError, setCnpjCepError] = useState<string | null>(null);
  const [isParsingContract, setIsParsingContract] = useState(false);
  const [serviceLocations, setServiceLocations] = useState<string[]>([]);

  // Estados para busca de colaboradores cadastrados
  const [isSearchExistingOpen, setIsSearchExistingOpen] = useState(false);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingExisting, setIsSearchingExisting] = useState(false);

  // Estados para mesclagem de dados (PDF vs Banco)
  const [pendingMerge, setPendingMerge] = useState<{
    existingProfile: Partial<Employee>;
    incomingData: Partial<Employee>;
    existingHistory: HistoryItem[];
    existingBonds: EmploymentContract[];
    existingCosts: MonthlyCost[];
    fileLink?: string;
  } | null>(null);
  const [selectedMergeFields, setSelectedMergeFields] = useState<Record<string, 'existing' | 'incoming'>>({});
  const [pendingHistoryItems, setPendingHistoryItems] = useState<any[]>([]);

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
      setActiveTab('pessoal');
    } else {
      // Limpar estado qnd fecha
      setProfile({});
      setError(null);
    }
  }, [isOpen, employeeId, isTestMode]);

  // Fetch distinct service locations for autocomplete
  useEffect(() => {
    if (isOpen) {
      PeopleService.getDistinctValues('service_location', isTestMode).then(setServiceLocations).catch(() => {});
    }
  }, [isOpen, isTestMode]);

  useEffect(() => {
    if (isSearchExistingOpen) {
      setIsSearchingExisting(true);
      PeopleHRService.getEmployeesForPeople({ mostrarInativos: true })
        .then(setAllEmployees)
        .catch(err => console.error("Erro ao buscar colaboradores para pesquisa", err))
        .finally(() => setIsSearchingExisting(false));
    }
  }, [isSearchExistingOpen]);

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
      setCosts(costsData || []);
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
      
      const saved = await PeopleService.saveEmployeeProfile(profile, isTestMode);
      
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    let targetId = profile.id;
    if (!targetId) {
      targetId = crypto.randomUUID();
      handleChange('id', targetId);
    }
    
    setIsSaving(true);
    try {
      const url = await PeopleService.uploadProfilePhoto(targetId, file, isTestMode);
      handleChange('photo_url', url);
      // Se já estava no DB, atualiza a foto lá também
      if (profile.id) {
        await PeopleService.saveEmployeeProfile({ ...profile, photo_url: url }, isTestMode);
      }
      if (onDataChanged) onDataChanged(targetId);
    } catch (err: unknown) {
       const error = err as Error;
       setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdditiveUpload = async (e: React.ChangeEvent<HTMLInputElement>, historyId?: string) => {
    const file = e.target.files?.[0];
    if (!file || !profile.id) return;
    
    setIsSaving(true);
    try {
      const url = await PeopleService.uploadAdditiveFile(profile.id, file, isTestMode);
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
        await PeopleService.saveEmployeeProfile({ ...profile, links_aditivos: newText }, isTestMode);
      }
      if (onDataChanged) onDataChanged();
    } catch (err: unknown) {
       const error = err as Error;
       setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBaseContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile.id) return;
    
    setIsSaving(true);
    try {
      const url = await PeopleService.uploadAdditiveFile(profile.id, file, isTestMode);
      const currentText = profile.links_contratos ? profile.links_contratos + '\n' : '';
      const newText = currentText + `[Documento Base ${new Date().toLocaleDateString('pt-BR')}](${url})`;
      
      handleChange('links_contratos', newText);
      await PeopleService.saveEmployeeProfile({ ...profile, links_contratos: newText }, isTestMode);
      if (onDataChanged) onDataChanged();
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
    if (data.remuneration_bonus !== undefined && data.remuneration_bonus !== null) {
      const currentBonus = prev.remuneration_bonus || 0;
      const newBonus = parseFloat(String(data.remuneration_bonus)) || 0;
      next.remuneration_bonus = Math.max(currentBonus, newBonus);
    }
    if (data.remuneration_fixed) {
      next.remuneration_fixed = data.remuneration_fixed;
    }
    next.remuneration = (next.remuneration_fixed || 0) + (next.remuneration_bonus || 0) + (next.remuneration_commission || 0);
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

    if (data.start_date) {
      next.start_date = getOldestDate(prev.start_date, data.start_date);
    }
    if (data.contract_expiry_date) {
      next.contract_expiry_date = getLatestDate(prev.contract_expiry_date, data.contract_expiry_date);
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
    fileLink?: string
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
      if (['remuneration_fixed', 'remuneration_bonus'].includes(key)) {
        return Number(existingVal || 0) !== Number(incomingVal || 0);
      }
      return cleanStr(existingVal) !== cleanStr(incomingVal);
    };

    const defaults: Record<string, 'existing' | 'incoming'> = {};
    
    MERGE_FIELDS.forEach(field => {
      const existingVal = existing[field.key as keyof Employee];
      const incomingVal = incoming[field.key as keyof Employee];
      
      if (isDifferent(field.key, existingVal, incomingVal)) {
        if (!existingVal && incomingVal) {
          defaults[field.key] = 'incoming';
        } else if (field.key === 'start_date') {
          const d1 = existing.start_date;
          const d2 = incoming.start_date;
          if (d1 && d2) {
            defaults[field.key] = d1 <= d2 ? 'existing' : 'incoming';
          } else {
            defaults[field.key] = d1 ? 'existing' : 'incoming';
          }
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
      fileLink
    });
    setSelectedMergeFields(defaults);
  };

  const handleConfirmMerge = async () => {
    if (!pendingMerge) return;

    const { existingProfile, incomingData, existingHistory, existingBonds, existingCosts, fileLink } = pendingMerge;
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
        }
      } else {
        (mergedProfile as any)[field.key] = existingVal !== undefined ? existingVal : incomingVal;
      }
    });

    if (fileLink) {
      const currentText = mergedProfile.links_contratos ? mergedProfile.links_contratos + '\n' : '';
      if (!currentText.includes(fileLink)) {
        mergedProfile.links_contratos = currentText + fileLink;
      }
    }

    const newHistoryItems = historyChanges.map(changeText => ({
      employee_id: mergedProfile.id || '',
      event_type: 'Aditivo',
      change_date: changeDate,
      observations: `${changeText} (via importação de contrato PDF)`
    }));
    
    setPendingHistoryItems(prev => [...prev, ...newHistoryItems]);

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

      if (existing && existing.id !== profile.id) {
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

          initializeMerge(existingProfile, incomingMapped, hist || [], bondsData || [], costsData || [], updatedMarkdownLink);
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
      
      // Mesclar os dados extraídos no profile
      setProfile(prev => {
        const next = { ...prev };
        
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
        if (data.remuneration_fixed) {
          next.remuneration_fixed = data.remuneration_fixed;
        }
        next.remuneration = (next.remuneration_fixed || 0) + (next.remuneration_bonus || 0) + (next.remuneration_commission || 0);
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

        // Datas: Admissão (Mais antiga) e Vencimento (Maior/Mais recente)
        if (data.start_date && data.document_type !== 'Distrato') {
          next.start_date = getOldestDate(prev.start_date, data.start_date);
        }
        if (data.contract_expiry_date && data.document_type !== 'Distrato') {
          next.contract_expiry_date = getLatestDate(prev.contract_expiry_date, data.contract_expiry_date);
        }

        // Se for distrato
        if (data.document_type === 'Distrato' && data.termination_date) {
          next.status_end_date = data.termination_date;
          // Se a data já passou ou é hoje, inativar
          const termDate = new Date(data.termination_date);
          const now = new Date();
          // zera a hora para comparar só as datas
          termDate.setHours(0,0,0,0);
          now.setHours(0,0,0,0);
          if (termDate <= now) {
            next.status = 'Inativo';
          }
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
      await PeopleService.saveEmployeeProfile({ ...profile, [field]: newText }, isTestMode);
      if (onDataChanged) onDataChanged();
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
      
      const computedLiquido = editingCostFixo + editingCostBonus + editingCostComissao;

      await PeopleHRService.updateMonthlyCost(editingCost.id, {
        competencia: editingCostCompetencia,
        valor_liquido: computedLiquido,
        valor_fixo: editingCostFixo,
        valor_bonus: editingCostBonus,
        valor_comissao: editingCostComissao,
        vinculo_tipo: editingCostType,
      });
      
      setCosts(prev => prev.map(c => c.id === editingCost.id ? { 
        ...c, 
        competencia: editingCostCompetencia, 
        valor_liquido: computedLiquido, 
        valor_fixo: editingCostFixo,
        valor_bonus: editingCostBonus,
        valor_comissao: editingCostComissao,
        vinculo_tipo: editingCostType 
      } : c));
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
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Erro ao excluir lançamento.');
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
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600">
                  <UserRound size={20} />
               </div>
               <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {employeeId ? 'Ficha do Colaborador' : 'Novo Colaborador'}
                  </h2>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Perfil Recursos Humanos</p>
               </div>
            </div>
            
            <div className="flex gap-2">
              {employeeId && !isEditMode && (
                <>
                  <a 
                    href={`/emprestimos?employeeId=${employeeId}`}
                    className="flex items-center gap-1.5 p-2 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/50 rounded-lg transition-all text-amber-700 dark:text-amber-500 font-semibold text-xs border border-amber-200 dark:border-amber-900/50"
                    title="Gerenciar Empréstimos deste Colaborador"
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
                    <span>Importar Contrato (PDF)</span>
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

          {/* Abas */}
          <div className="flex border-b border-slate-100 px-6 shrink-0 bg-slate-50/50 overflow-x-auto whitespace-nowrap scrollbar-none">
            <button 
              onClick={() => setActiveTab('pessoal')}
              className={`px-5 py-4 text-xs font-black tracking-wider uppercase border-b-2 transition-all ${activeTab === 'pessoal' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Info Pessoal
            </button>
            <button 
              onClick={() => setActiveTab('endereco')}
              className={`px-5 py-4 text-xs font-black tracking-wider uppercase border-b-2 transition-all ${activeTab === 'endereco' ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Contato & Endereço
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
                  Custo Histórico
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
              </>
            )}
          </div>

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
                              <label className={labelClass}>Nível</label>
                              {isEditMode ? (
                                <select value={profile.nivel || ''} onChange={e => handleChange('nivel', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2">
                                  <option value="">Selecione...</option>
                                  <option value="Estratégico">Estratégico</option>
                                  <option value="Tático">Tático</option>
                                  <option value="Operacional">Operacional</option>
                                </select>
                              ) : (
                                <span className="text-sm font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">{profile.nivel || '-'}</span>
                              )}
                             </div>
                             <div className="flex-1">
                              <label className={labelClass}>Grau</label>
                              {isEditMode ? (
                                <select value={profile.grau || ''} onChange={e => handleChange('grau', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2">
                                  <option value="">Selecione...</option>
                                  <option value="I">I</option>
                                  <option value="II">II</option>
                                  <option value="III">III</option>
                                </select>
                              ) : (
                                <span className="text-sm font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">{profile.grau || '-'}</span>
                              )}
                             </div>
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
                              const tot = val + (profile.remuneration_bonus || 0) + (profile.remuneration_commission || 0);
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
                              const tot = (profile.remuneration_fixed || 0) + val + (profile.remuneration_commission || 0);
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
                            {formatCurrency((profile.remuneration_fixed || 0) + (profile.remuneration_bonus || 0) + (profile.remuneration_commission || 0))}
                          </div>
                        </div>



                        <div>
                           <label className={labelClass}>Chave PIX</label>
                           <input type="text" value={profile.pix_key || ''} onChange={e => handleChange('pix_key', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                         </div>
                         <div>
                           <label className={labelClass}>Data de Admissão</label>
                           <input type="date" name="start_date" value={profile.start_date || ''} onChange={e => handleChange('start_date', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                         </div>
                         <div>
                           <label className={labelClass}>Data Revisão Valor Base</label>
                           <input type="date" name="last_raise_date" value={profile.last_raise_date || ''} onChange={e => handleChange('last_raise_date', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                           <span className="text-[9px] text-slate-400 mt-0.5 block">Se vazio, usará a Data de Admissão nos alertas</span>
                         </div>
                         <div>
                           <label className={labelClass}>Vencimento Contrato/Aditivo</label>
                           <input type="date" value={profile.contract_expiry_date || ''} onChange={e => handleChange('contract_expiry_date', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
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
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-3">
                            <Briefcase size={11}/> Posição Atual — Histórico de Setor/Função
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className={labelClass}>Setor</label>
                              <input 
                                type="text" 
                                value={profile.department || ''} 
                                onChange={e => {
                                  // Capitalize first letter logic applied dynamically to standardise on type
                                  const val = e.target.value;
                                  const normalized = val ? val.charAt(0).toUpperCase() + val.slice(1) : val;
                                  handleChange('department', normalized);
                                }} 
                                readOnly={!isEditMode} 
                                className={inputClass} 
                                placeholder="Ex: Administrativo"
                                list="setores-list"
                              />
                              <datalist id="setores-list">
                                {setores.map(s => <option key={s} value={s} />)}
                              </datalist>
                            </div>
                            <div>
                              <label className={labelClass}>Função / Cargo</label>
                              <input type="text" value={profile.job_role || ''} onChange={e => handleChange('job_role', e.target.value)} readOnly={!isEditMode} className={inputClass} placeholder="Ex: Analista Financeiro"/>
                            </div>
                            <div>
                              <label className={labelClass}>Início neste Setor/Função</label>
                              <input type="date" value={profile.department_start_date || ''} onChange={e => handleChange('department_start_date', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
                            </div>
                          </div>
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
                                <label className={labelClass}>Logradouro da Empresa</label>
                                <input type="text" value={profile.cnpj_street || ''} onChange={e => handleChange('cnpj_street', e.target.value)} readOnly={!isEditMode} className={inputClass}/>
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
                           <label className={labelClass}>Função / Cargo (Sincronizado)</label>
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
                    </motion.div>
                  )}

                  {/* ------------- ABA CUSTO HISTÓRICO ------------- */}
                  {activeTab === 'custo' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                          <Coins size={16} className="text-emerald-600" /> Histórico Mensal de Custos
                        </h4>
                        <span className="text-xs font-black text-slate-400 uppercase">Fase 2 (Dianna Import)</span>
                      </div>

                      {(() => {
                        const stats = PeopleHRService.computeCostStats(costs);
                        
                        if (!stats) {
                          return (
                            <div className="text-center py-10 bg-slate-50 border border-dashed rounded-2xl">
                              <Coins className="mx-auto mb-2 text-slate-300" size={32} />
                              <p className="text-sm text-slate-500 font-bold">Sem dados de custos para este colaborador.</p>
                              <p className="text-xs text-slate-400 mt-1">Os dados serão importados da planilha Dianna na Fase 2.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Fixo</p>
                                <p className="text-lg font-black text-slate-700 mt-1 tabular-nums">
                                  {formatCurrency(stats.fixedTotal || 0)}
                                </p>
                              </div>
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Bônus</p>
                                <p className="text-lg font-black text-slate-700 mt-1 tabular-nums">
                                  {formatCurrency(stats.bonusTotal || 0)}
                                </p>
                              </div>
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Comissões</p>
                                <p className="text-lg font-black text-slate-700 mt-1 tabular-nums">
                                  {formatCurrency(stats.commissionTotal || 0)}
                                </p>
                              </div>
                              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                                <p className="text-xs font-black text-emerald-800 uppercase tracking-wider">Total Geral</p>
                                <p className="text-lg font-black text-emerald-700 mt-1 tabular-nums">
                                  {formatCurrency(stats.total)}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider">Lançamentos Recentes ({stats.count})</h5>
                              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-white max-h-[250px] overflow-y-auto">
                                {costs.map((c, i) => {
                                  const fixedVal = (c.valor_fixo !== undefined && c.valor_fixo !== null) 
                                    ? c.valor_fixo 
                                    : (c.valor_liquido - ((c.valor_bonus || 0) + (c.valor_comissao || 0)));
                                  return (
                                    <div key={i} className="p-3 hover:bg-slate-50/50 flex flex-col gap-2">
                                      <div className="flex justify-between items-center">
                                        <div>
                                          <p className="text-sm font-black text-slate-800 uppercase">
                                            {new Date(c.competencia + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                          </p>
                                          <p className="text-[10px] text-slate-400 uppercase mt-0.5">{c.origem === 'dianna_import' ? 'Planilha Dianna' : c.origem}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Total:</span>
                                            <span className="text-sm font-extrabold text-emerald-600 tabular-nums">
                                              {formatCurrency(c.valor_liquido)}
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
                                              setSaveCostError(null);
                                            }}
                                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"
                                            title="Editar lançamento"
                                          >
                                            <PenBox size={13} />
                                          </button>
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-slate-100/50 text-[10px]">
                                        <div>
                                          <span className="text-slate-400 font-bold block uppercase text-[8px]">Fixo</span>
                                          <span className="text-slate-700 font-bold tabular-nums">{formatCurrency(fixedVal || 0)}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-400 font-bold block uppercase text-[8px]">Bônus</span>
                                          <span className={`font-bold tabular-nums ${c.valor_bonus ? 'text-blue-600' : 'text-slate-400'}`}>
                                            {formatCurrency(c.valor_bonus || 0)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-slate-400 font-bold block uppercase text-[8px]">Comissão</span>
                                          <span className={`font-bold tabular-nums ${c.valor_comissao ? 'text-amber-600' : 'text-slate-400'}`}>
                                            {formatCurrency(c.valor_comissao || 0)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
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
               </div>
            )}
          </div>
          </motion.div>
        </div>
      )}

      {/* Dynamic Inline cost editor modal */}
      {editingCost && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">Ajustar Lançamento de Custo</h4>
                <p className="text-[10px] text-emerald-100 uppercase mt-0.5">Correção rápida de inconsistência</p>
              </div>
              <button onClick={() => setEditingCost(null)} className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {saveCostError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 leading-relaxed font-semibold">
                  {saveCostError}
                </div>
              )}

              <div>
                <label className={labelClass}>Competência Mensal</label>
                <input 
                  type="date" 
                  value={editingCostCompetencia} 
                  onChange={e => setEditingCostCompetencia(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className={labelClass}>Regime / Tipo de Vínculo</label>
                <select 
                  value={editingCostType} 
                  onChange={e => setEditingCostType(e.target.value as 'CLT' | 'MEI')} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="CLT">CLT</option>
                  <option value="MEI">MEI / PJ</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Valor Fixo</label>
                  <input 
                    type="number" 
                    value={editingCostFixo} 
                    onChange={e => setEditingCostFixo(parseFloat(e.target.value) || 0)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelClass}>Bônus</label>
                  <input 
                    type="number" 
                    value={editingCostBonus} 
                    onChange={e => setEditingCostBonus(parseFloat(e.target.value) || 0)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelClass}>Comissão</label>
                  <input 
                    type="number" 
                    value={editingCostComissao} 
                    onChange={e => setEditingCostComissao(parseFloat(e.target.value) || 0)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Geral Calculado</span>
                <span className="text-sm font-extrabold text-emerald-600 tabular-nums">
                  {formatCurrency(editingCostFixo + editingCostBonus + editingCostComissao)}
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleDeleteCost(editingCost.id)}
                  className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Trash2 size={13} /> Excluir Custo
                </button>
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

    </AnimatePresence>
  );
}
