// ============================================================================
// Tipos TypeScript para a Integração Clara Cartões → Omie
// ============================================================================

export type ClaraTransactionType = 'PURCHASE' | 'REFUND' | 'FEE' | 'CREDIT' | 'PAYMENT';

export type ClaraTransactionStatus = 'AUTHORIZED' | 'NOTIFICATION' | 'PRE_AUTHORIZED' | 'REJECTED';

export type ClaraSyncStatus = 
  | 'PENDING'            // Recebida e aguardando processamento
  | 'MAPPING_REQUIRED'   // Sem categoria ou departamento Omie definido
  | 'READY'              // Apta para envio ao Omie
  | 'SYNCING'            // Envio em andamento
  | 'SYNCED'             // Lançamento criado com sucesso no Omie
  | 'UPDATED'            // Atualizada após alteração na Clara
  | 'IGNORED'            // Não elegível (ex: REJECTED, PRE_AUTHORIZED, PAYMENT no MVP)
  | 'ERROR';             // Falha no processamento

export interface ClaraConfig {
  id?: string;
  client_id?: string;
  client_secret?: string;
  certificate_pem?: string;
  private_key_pem?: string;
  base_url: string;
  omie_n_cod_cc?: number | null;
  omie_supplier_code?: number | null; // codigo_cliente_omie do fornecedor 'Clara Cartões'
  omie_cc_descricao?: string | null;
  company_name: string;
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  safe_mode: boolean; // Modo de Teste: gera payloads sem disparar IncluirLancCC real
  default_omie_category?: string | null;
  default_omie_department?: string | null;
  default_omie_project?: string | null;
  block_if_unmapped: boolean;
  overlap_days: number;
  last_connection_test?: string | null;
  last_connection_status?: 'SUCCESS' | 'ERROR' | null;
  last_connection_message?: string | null;
  has_certificate?: boolean;
  has_private_key?: boolean;
  client_secret_masked?: string;
  updated_at?: string;
}

export interface ClaraRawTransaction {
  id?: string;
  uuid?: string;
  transactionType?: string;
  type?: string;
  status?: string;
  label?: string;
  transactionLabel?: string;
  operationDate?: string;
  accountingDate?: string;
  lastUpdateDate?: string;
  audit?: {
    operationDate?: string;
    accountingDate?: string;
    lastUpdateDate?: string;
  };
  amount?: number;
  currency?: string;
  amountValue?: {
    currency?: string;
    amount?: number;
  };
  originalAmount?: any;
  originalCurrency?: string;
  authorizationNumber?: string;
  comment?: string;
  merchant?: {
    name?: string;
    category?: string;
    mcc?: string;
  };
  card?: {
    id?: string;
    uuid?: string;
    lastFourDigits?: string;
    cardholderName?: string;
    maskedPan?: string;
  };
  user?: {
    id?: string;
    uuid?: string;
    name?: string;
    email?: string;
    holderName?: string;
  };
  billingStatement?: {
    uuid?: string | null;
    periodStartDate?: string | null;
    periodEndDate?: string | null;
  };
  billingStatementUuid?: string;
  billingStatementId?: string;
  hasAttachments?: {
    value?: boolean;
    links?: any[];
  };
  hasInvoice?: {
    value?: boolean;
    links?: any[];
  };
  labels?: Array<{ id?: string; name?: string }>;
  accountingFields?: Record<string, any>;
  documents?: ClaraDocument[];
  receipts?: ClaraDocument[];
  [key: string]: any;
}

export interface ClaraDocument {
  id?: string;
  uuid?: string;
  name?: string;
  fileName?: string;
  fileType?: string;
  mimeType?: string;
  url?: string;
  downloadUrl?: string;
  size?: number;
  createdAt?: string;
}

export interface ClaraTransactionRecord {
  id: string;
  clara_uuid: string;
  transaction_type: ClaraTransactionType;
  transaction_status: ClaraTransactionStatus;
  transaction_label?: string | null;
  operation_date: string;
  accounting_date?: string | null;
  last_update_date?: string | null;
  
  merchant_name?: string | null;
  merchant_category?: string | null;
  
  original_amount?: number | null;
  original_currency?: string | null;
  amount: number;
  currency: string;
  
  authorization_number?: string | null;
  card_uuid?: string | null;
  card_last_digits?: string | null;
  
  user_uuid?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  
  billing_statement_uuid?: string | null;
  comment?: string | null;
  labels?: any[];
  accounting_fields?: Record<string, any>;
  raw_payload?: ClaraRawTransaction;
  
  // Vínculo Omie
  omie_integration_id?: string | null;
  omie_launch_id?: number | null;
  omie_account_id?: number | null;
  omie_category_code?: string | null;
  omie_department_code?: string | null;
  omie_project_code?: string | null;
  
  // Anexos
  has_attachments: boolean;
  attachments_count: number;
  attachments_synced: boolean;
  attachments_error?: string | null;
  
  // Status
  sync_status: ClaraSyncStatus;
  sync_attempts: number;
  last_sync_attempt?: string | null;
  last_sync_error?: string | null;
  
  created_at: string;
  updated_at: string;
  synced_at?: string | null;
}

export interface ClaraCategoryMapping {
  id?: string;
  clara_category: string;
  omie_category_code: string;
  omie_category_desc?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClaraDepartmentMapping {
  id?: string;
  mapping_type: 'USER' | 'LABEL' | 'CARD' | 'FALLBACK';
  clara_key: string;
  omie_department_code: string;
  omie_department_desc?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClaraSyncRun {
  id: string;
  started_at: string;
  finished_at?: string | null;
  trigger_type: 'MANUAL' | 'SCHEDULED';
  status: 'RUNNING' | 'SUCCESS' | 'ERROR' | 'PARTIAL';
  transactions_received: number;
  transactions_created: number;
  transactions_updated: number;
  transactions_ignored: number;
  transactions_synced: number;
  transactions_failed: number;
  attachments_uploaded: number;
  error_message?: string | null;
  details?: Record<string, any>;
}

export interface ClaraSyncLog {
  id: string;
  transaction_id?: string;
  sync_run_id?: string;
  action: 'IMPORT' | 'MAP' | 'INCLUIR_LANC_CC' | 'INCLUIR_ANEXO' | 'RETRY' | 'IGNORE';
  status: 'SUCCESS' | 'ERROR' | 'SKIPPED';
  request_payload?: any;
  response_payload?: any;
  error_message?: string | null;
  created_at: string;
}

// Payload oficial para Omie IncluirLancCC
export interface OmieLancCCPayload {
  cCodIntLanc: string; // ID determinístico (CL + hash)
  cabecalho: {
    nCodCC: number;
    dDtLanc: string; // DD/MM/AAAA
    nValorLanc: number;
  };
  detalhes: {
    cCodCateg: string;
    cTipo: string; // Cartão de crédito: 'CRT'
    cNumDoc: string; // authorization_number ou identificador
    cObs: string;
    nCodProjeto?: number | null;
  };
  departamentos?: Array<{
    cCodDep: string;
    nPerDep: number;
  }>;
}

// Payload para Omie IncluirAnexo (suporta CC-lancamento e conta-pagar)
export interface OmieAnexoPayload {
  cTabela: 'conta-corrente-lancamento' | 'conta-pagar';
  nId: number; // nCodLanc ou codigo_lancamento_omie
  cNomeArquivo: string;
  cArquivo: string; // Base64 de ZIP
  cMd5: string; // MD5 do conteúdo Base64 do ZIP
}

// Payload oficial para Omie IncluirContaPagar
export interface OmieContaPagarPayload {
  codigo_lancamento_integracao: string; // ID determinístico idempotente
  codigo_cliente_fornecedor: number;    // codigo_cliente_omie do fornecedor Clara
  data_vencimento: string;              // DD/MM/AAAA
  data_emissao: string;                 // DD/MM/AAAA
  valor_documento: number;
  codigo_categoria: string;
  numero_documento?: string | null;
  observacao?: string | null;
  codigo_departamento?: string | null;
  codigo_projeto?: number | null;
  id_conta_corrente?: number;
}

// Opções de Recursos Omie
export interface OmieAccountOption {
  nCodCC: number;
  descricao: string;
  tipo: string;
  tipo_descricao?: string;
}

export interface OmieDepartmentOption {
  codigo: string;
  descricao: string;
}

export interface OmieCategoryOption {
  codigo: string;
  descricao: string;
}

export interface OmieProjectOption {
  codigo: string;
  descricao: string;
}
