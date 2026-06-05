export interface ChildData {
  name: string;
  dob: string;
}

export interface EducationData {
  level: string;
  area: string;
}

export interface Employee {
  // --- Dashboard/Loans Calculated Fields ---
  id: string;
  name: string;
  company: string;
  linkType: string;
  remuneration: number;
  totalTaken: number;
  totalReceived: number;
  balance: number;
  monthInstallment: number;
  contractsCount: number;
  status: "Ativo" | "Provisão" | "Quitado" | "Inativo" | "Sem Empréstimo" | "Férias";
  loanStatus?: string;
  aditivoCount?: number;
  avatar?: string;
  created_at?: string;

  // --- Profile/HR Raw Fields ---
  pj_type?: string;
  corporate_name?: string;
  document_id?: string;
  document_rg?: string;
  phone?: string;
  email?: string;
  phone_professional?: string;
  email_professional?: string;
  pix_key?: string;
  
  // Address
  zip_code?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  endereco_completo?: string; // NOVO: DB V2
  
  // HR Role
  department?: string;
  job_role?: string;
  nivel?: string; // Estratégico | Tático | Operacional
  department_start_date?: string; // YYYY-MM-DD - data de início no setor/função atual
  start_date?: string;
  resignation_date?: string;
  status_start_date?: string;
  status_end_date?: string;
  
  // Contacts & Social
  linkedin_url?: string;
  instagram_url?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  pessoa_referencia_nome?: string; // NOVO: DB V2
  pessoa_referencia_telefone?: string; // NOVO: DB V2
  metadata?: any; // JSONB do DB V2
  has_invoice_glosa?: boolean; // INSIGHTS
  last_raise_date?: string; // INSIGHTS
  
  // External Responsible (PJ normally)
  responsible_name?: string;
  responsible_cpf?: string;
  responsible_rg?: string;
  
  // Personal
  gender?: string;
  marital_status?: string;
  children_data?: ChildData[];
  education_data?: EducationData[];
  
  // Attachments
  photo_url?: string;
  
  // RH & Contratos
  contract_expiry_date?: string; // YYYY-MM-DD
  links_contratos?: string;
  links_aditivos?: string; // string JSON[]
  links_emprestimos?: string; // string JSON[]
  remuneration_fixed?: number;
  remuneration_bonus?: number;
  remuneration_commission?: number;

  // Novos campos adicionados na migração v3
  is_outsourced?: boolean;
  service_location?: string;
  tax_regime?: string;
  cnpj_zip_code?: string;
  cnpj_street?: string;
  cnpj_number?: string;
  cnpj_complement?: string;
  cnpj_neighborhood?: string;
  cnpj_city?: string;
  cnpj_state?: string;
  executive_summary?: string;
  executive_link?: string;
  commission_plan?: string; // plano de comissão (selecionável por produto)
}

export interface Contract {
  id: string;
  employee_id: string;
  operationNumber: string;
  value: number;
  balance: number;
  installments: number;
  installmentValue: number;
  installmentsPaid: number;
  nextPaymentDate: string;
  endDate?: string;
  status: "ATIVO" | "LIQUIDADO" | "ATRASADO";
  startDate: string;
  requestDate?: string;
  description?: string;
  contractUrl?: string; // NOVO: URL do anexo do contrato
  created_at?: string;
}

export interface LoanStats {
  totalEmprestado: number;
  saldoDevedor: number;
  totalRecebido: number;
  recebivelMes: number;
  contratosAtivos: number;
  contratosLiquidados: number;
  maiorEmprestimo: number;
  maiorEmprestimoRef: string;
  proximoEncerrar: string;
  parcelasRestantes: number;
}

export interface ProjectionData {
  month: string;
  total: number;
  previsto: number;
}

export interface FilterParams {
  competencia?: string;
  empresa?: string;
  colaborador?: string;
  status?: string;
  vinculo?: string;
  incluirExColaboradores?: boolean;
  incluirLiquidados?: boolean;
}

export interface EmploymentContract {
  id: string;
  employee_id: string;
  regime: 'CLT' | 'MEI' | 'Estagiário' | 'PJ';
  contracting_company?: string;
  pj_cnpj?: string;
  pj_razao_social?: string;
  pj_nome_fantasia?: string;
  pj_endereco_completo?: string;
  remuneration_base: number;
  remuneration_bonus: number;
  remuneration_incentives: number;
  remuneration_allowances: number;
  remuneration_commissions: number;
  start_date: string;
  expiration_date?: string;
  end_date?: string;
  trigger_reason?: string;
  status: 'Ativo' | 'Vencido' | 'Encerrado';
  metadata?: any;
  created_at?: string;
}

export interface ContractAllocation {
  id: string;
  contract_id: string;
  department?: string;
  project?: string;
  start_date: string;
  end_date?: string;
  created_at?: string;
}

export interface EmployeeEvent {
  id: string;
  employee_id: string;
  contract_id?: string;
  event_type: string;
  event_date: string;
  amount?: number;
  description?: string;
  metadata?: any;
  created_at?: string;
}

export interface MonthlyCost {
  id: string;
  employee_id: string;
  competencia: string; // YYYY-MM-01
  vinculo_tipo: 'CLT' | 'MEI';
  valor_holerite?: number;
  valor_adiantamento?: number;
  valor_hora_extra?: number;
  valor_adicional_not?: number;
  valor_vr?: number;
  valor_vt?: number;
  valor_ajuda_custo?: number;
  valor_cesta?: number;
  valor_ferias?: number;
  valor_rescisao?: number;
  valor_decimo_terceiro?: number;
  valor_descontos?: number;
  valor_liquido: number;
  valor_fixo?: number;
  valor_bonus?: number;
  valor_comissao?: number;
  origem: 'csv' | 'manual' | 'dianna_import';
  observacao?: string;
  created_at?: string;
}

export interface PeopleFilters {
  search?: string;
  empresa?: string;
  status?: string;
  vinculo?: string;
  setor?: string;
  centroCusto?: string;
  competencia?: string;
  temEmprestimo?: string;
  temAditivo?: string;
  mostrarInativos?: boolean;
}

// Helper: returns the correct remuneration label based on employment type
export function getRemunerationLabel(linkType: string): { short: string; full: string; bruto: string } {
  const isPJ = linkType === 'MEI' || linkType === 'PJ';
  return isPJ
    ? { short: 'Valor Contratual', full: 'Valor do Contrato', bruto: 'Valor Contratual' }
    : { short: 'Salário', full: 'Remuneração', bruto: 'Salário Bruto' };
}

export interface AuditIssue {
  id: string;
  employee_id: string;
  type: 'date_before_admission' | 'missing_start_date' | 'regime_mismatch';
  severity: 'error' | 'warning';
  message: string;
  details?: {
    costId?: string;
    competencia?: string;
    admissionDate?: string;
    vinculo?: string;
    regimeAtivo?: string;
  };
}
