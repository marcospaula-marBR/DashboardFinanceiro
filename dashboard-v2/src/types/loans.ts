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
  remainingInstallments?: number;
  lastInstallmentDate?: string | null;
  nextInstallmentValue?: number;
  nextInstallmentDate?: string | null;
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
  grau?: string; // I | II | III
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
  last_grade_date?: string; // INSIGHTS: data do último ajuste de Grau
  
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
  remuneration_connectivity?: number; // Auxílio Conectividade
  remuneration_incentives?: number;   // Incentivos

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

  // --- PeopleBoard Cockpit Properties ---
  pbId?: string;
  entityType?: EntityType;
  relationshipNature?: RelationshipNature;
  relationships?: PeopleRelationship[];
  aiAgents?: PeopleAIAgent[];
  permissions?: string[];
  temporaryDelegations?: PeopleTemporaryDelegation[];
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
  firstPaymentDate?: string; // NOVO: Data do primeiro vencimento
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
  proximoEncerrarValor?: number;
  ultimaParcelaMes?: string;
  ultimaParcelaValor?: number;
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
  valor_incentivos?: number;
  valor_glosa_base?: number;
  valor_glosa_bonus?: number;
  valor_deducoes?: number;
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

// --- PeopleBoard / People Cockpit Metadata & Governance Types ---

export type EntityType =
  | "internal_person"
  | "legal_entity"
  | "partner"
  | "supplier"
  | "external_consultancy"
  | "accredited_provider";

export type RelationshipNature =
  | "clt_internal"
  | "pj_specialized"
  | "accredited_company"
  | "strategic_partner"
  | "approved_supplier"
  | "external_consultancy"
  | "council_member"
  | "shareholder"
  | "founder";

export type PBLevel = "E" | "T" | "O";
export type PBDegree = 1 | 2 | 3;

export interface PeopleAIAgent {
  name: string;
  chair?: string;
  orbit?: string;
  scope?: string;
  permissions?: string[];
  workflows?: string[];
  indicators?: string[];
  contextMemory?: string;
  status?: string;
  owner?: string;
  updatedAt?: string;
  sensitivityLevel?: string;
}

export interface PeopleTemporaryDelegation {
  id: string;
  roleOrPermission: string;
  expiresAt: string;
  assignedBy: string;
  assignedAt: string;
  status: 'active' | 'expired' | 'revoked';
  observations?: string;
}

export interface PeopleRelationship {
  employee_id: string;
  relation_type:
    | 'equivalent'              // Interface equivalente
    | 'orientadora'             // Interface orientadora (above)
    | 'apoiada'                 // Interface apoiada (below)
    | 'referencia_tecnica'      // Referência técnica
    | 'autoridade_delegada'     // Autoridade delegada
    | 'responsabilidade_compartilhada' // Responsabilidade compartilhada
    | 'dependencia_operacional' // Dependência operacional
    | 'vinculo_governanca';     // Vínculo de governança
}

export interface PeopleMetadata {
  pbId?: string;
  entityType?: EntityType;
  relationshipNature?: RelationshipNature;
  aiAgents?: PeopleAIAgent[];
  permissions?: string[];
  temporaryDelegations?: PeopleTemporaryDelegation[];
  relationships?: PeopleRelationship[];
  dataQualityScore?: number;
  version?: number;

  // Legacy metadata fields
  has_invoice_glosa?: boolean;
  last_raise_date?: string | null;
  last_grade_date?: string | null;
  grau?: string;
  remuneration_connectivity?: number;
  remuneration_incentives?: number;
}

// --- Future Payroll PDF Import Types ---

export interface PayrollCostSnapshot {
  id: string;
  employeeId: string;
  pbId?: string;
  sourceDocumentId?: string;
  competence: string; // YYYY-MM
  employeeName: string;
  documentId?: string; // CPF ou CNPJ extraído
  department?: string;
  chair?: string;
  orbit?: string;
  contractType?: string;
  grossSalary?: number;
  benefits?: number;
  taxes?: number;
  charges?: number;
  discounts?: number;
  netPay?: number;
  totalCompanyCost?: number;
  generatedFields?: string[];
  confidenceScore?: number;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface PayrollFrameAverage {
  frameName: string; // "quadro" (Ex: Administrativo, Operação)
  averageGrossSalary: number;
  averageCompanyCost: number;
  peopleCount: number;
}

export interface PayrollFrameTotal {
  frameName: string;
  totalGrossSalary: number;
  totalCompanyCost: number;
  peopleCount: number;
}

export interface PayrollImportSummary {
  id: string;
  sourceDocumentId: string;
  competence: string;
  totalEmployees: number;
  totalGrossSalary: number;
  totalBenefits: number;
  totalTaxes: number;
  totalCharges: number;
  totalDiscounts: number;
  totalNetPay: number;
  totalCompanyCost: number;
  averagesByFrame: PayrollFrameAverage[];
  totalsByFrame: PayrollFrameTotal[];
  createdAt: string;
}

export interface GeneratedField {
  fieldName: string;
  previousValue?: unknown;
  generatedValue: unknown;
  source: "payroll_pdf";
  sourceDocumentId: string;
  competence: string;
  confidenceScore?: number;
  status: "pending_review" | "approved" | "rejected";
}

// ─── PeopleBoard Cockpit Utility Helpers ─────────────────────────────────────

export const PEOPLE_METADATA_VERSION = 1;

export function normalizePeopleMetadata(raw: any): PeopleMetadata {
  if (!raw) return { version: PEOPLE_METADATA_VERSION };
  return {
    pbId: raw.pbId || raw.pb_id || undefined,
    entityType: raw.entityType || raw.entity_type || undefined,
    relationshipNature: raw.relationshipNature || raw.relationship_nature || undefined,
    aiAgents: Array.isArray(raw.aiAgents || raw.ai_agents) ? (raw.aiAgents || raw.ai_agents) : [],
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
    temporaryDelegations: Array.isArray(raw.temporaryDelegations || raw.temporary_delegations) ? (raw.temporaryDelegations || raw.temporary_delegations) : [],
    relationships: Array.isArray(raw.relationships) ? raw.relationships : [],
    dataQualityScore: typeof raw.dataQualityScore === 'number' ? raw.dataQualityScore : (typeof raw.data_quality_score === 'number' ? raw.data_quality_score : 100),
    version: typeof raw.version === 'number' ? raw.version : PEOPLE_METADATA_VERSION,
  };
}

export function mergePeopleMetadata(currentMetadata: any, patch: Partial<PeopleMetadata>): PeopleMetadata {
  const normalized = normalizePeopleMetadata(currentMetadata);
  return {
    ...normalized,
    ...patch,
    version: PEOPLE_METADATA_VERSION
  };
}

export function inferEntityType(employee: Partial<Employee>): EntityType {
  const linkType = employee.linkType || '';
  if (linkType === 'CLT' || linkType === 'Estagiário') {
    return "internal_person";
  }

  if (employee.metadata?.entityType) return employee.metadata.entityType;
  if (employee.entityType) return employee.entityType;

  const isOutsourced = employee.is_outsourced === true;
  const hasCorporateName = typeof employee.corporate_name === 'string' && employee.corporate_name.trim().length > 0;
  const hasPjType = typeof employee.pj_type === 'string' && employee.pj_type.trim().length > 0;
  const hasTaxRegime = typeof employee.tax_regime === 'string' && employee.tax_regime.trim().length > 0;

  const isPJ = linkType === 'PJ' || linkType === 'MEI' || hasCorporateName || hasPjType || hasTaxRegime || isOutsourced;

  return isPJ ? "legal_entity" : "internal_person";
}

export function isEligibleForNewLoan(employee: Employee): boolean {
  if (!employee.status) return false;
  const statusLower = employee.status.toLowerCase();
  return statusLower === 'ativo' || statusLower === 'férias' || statusLower === 'ferias' || statusLower === 'provisão' || statusLower === 'provisao';
}

export function shouldDisplayExistingLoan(employee: Employee, hasExistingLoan: boolean): boolean {
  return hasExistingLoan || isEligibleForNewLoan(employee);
}

export function getPBClassification(level?: string, degree?: string | number): string {
  let l = "O";
  if (level) {
    const cleanLevel = level.trim().toUpperCase();
    if (cleanLevel.startsWith("E")) l = "E";
    else if (cleanLevel.startsWith("T")) l = "T";
  }
  
  let d: 1 | 2 | 3 = 3;
  if (degree !== undefined && degree !== null) {
    const strDegree = String(degree).trim().toUpperCase();
    if (strDegree === "1" || strDegree === "I") d = 1;
    else if (strDegree === "2" || strDegree === "II") d = 2;
    else if (strDegree === "3" || strDegree === "III") d = 3;
  }

  return `${l}${d}`;
}


