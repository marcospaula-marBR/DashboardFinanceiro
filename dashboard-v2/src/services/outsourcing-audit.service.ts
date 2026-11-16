import { supabase } from '@/lib/supabase';

export interface CustomColumn {
  id: string;
  label: string;
}

export type EmployeeType = 'CLT' | 'PJ' | 'Estagio' | 'Outro';

export interface OutsourcingRow {
  id: string;
  employeeId?: string;
  name: string;
  location: string;
  employeeType: EmployeeType;
  isManual: boolean;
  valorBruto: number;
  valorDesconto: number;
  valorLiquido: number;
  valorBonus: number;
  valorComissao: number;
  valorAjudaCusto: number;
  valorVR: number;
  valorVT: number;
  valorSeguro: number;
  valorFGTS: number;
  valorGPS: number;
  valorDecTerceiro: number;
  valorFerias: number;
  valorOutros: number;
  valorEmprestimo: number;
  customValues: Record<string, number>;
}

export interface RepassLine {
  id: string;
  date: string;
  bank: string;
  amount: number;
  notes: string;
}

export type OutsourcingAuditAction =
  | 'SAVE'
  | 'IMPORT_PDF'
  | 'IMPORT_XLSX'
  | 'OVERWRITE_DETECTED'
  | 'RESTORE_SNAPSHOT'
  | 'RESET';

export interface OutsourcingAuditActor {
  userId: string | null;
  userName: string;
  userEmail: string | null;
  role: string;
  organizationId: string | null;
  source?: 'supabase_auth' | 'operator_override' | 'system_fallback';
}

export interface OutsourcingAuditMetrics {
  rowsCount: number;
  valorBruto: number;
  valorDesconto: number;
  valorLiquido: number;
  valorVR: number;
  valorVT: number;
  valorFGTS: number;
  valorGPS: number;
  subtotal: number;
  taxRate: number;
  calculatedTax: number;
  calculatedAdminFee: number;
  totalApuradoBruto: number;
  repassCount: number;
  totalRepassado: number;
}

export interface OutsourcingAuditLogEntry {
  id: string;
  timestamp: string;
  competencia: string;
  action: OutsourcingAuditAction;
  summary: string;
  details?: string;
  metrics?: OutsourcingAuditMetrics;
  oldMetrics?: OutsourcingAuditMetrics | null;
  actor?: OutsourcingAuditActor;
}

export interface OutsourcingCompetenceConfig {
  taxInputMode: 'rate' | 'amount';
  taxRate: number;
  taxFixedAmount: number;
  adminFeeMode: 'rate' | 'amount';
  adminFeeRate: number;
  adminFeeFixedAmount: number;
  repassLines: RepassLine[];
  customColumns: CustomColumn[];
  rows: OutsourcingRow[];
  saved_at?: string;
  is_test?: boolean;
}

export interface OutsourcingSnapshot {
  id: string;
  competencia: string;
  created_at: string;
  label: string;
  reason: string;
  metrics: OutsourcingAuditMetrics;
  data: OutsourcingCompetenceConfig;
  actor?: OutsourcingAuditActor;
}

interface GlobalConfigRecord {
  id: string;
  metadata: Record<string, unknown> | null;
}

interface RelationalAuditRow {
  id: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  user_id: string | null;
  organization_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

const OPERATOR_STORAGE_KEY = 'outsourcing_operator_name';
const GLOBAL_CONFIG_NAME = '__SYSTEM_GLOBAL_CONFIG__';
const AUDIT_TABLE_LOG = 'outsourcing_audit_logs';
const AUDIT_TABLE_SNAPSHOT = 'outsourcing_snapshots';

/** Calcula o custo total de uma linha de terceirização (Líquido + verbas e encargos). */
export function computeOutsourcingRowTotal(r: OutsourcingRow): number {
  const customSum = Object.values(r.customValues || {}).reduce((a, v) => a + (Number(v) || 0), 0);
  const liq = (r.valorLiquido !== undefined && r.valorLiquido !== null)
    ? Number(r.valorLiquido)
    : ((Number(r.valorBruto) || 0) - (Number(r.valorDesconto) || 0));

  return liq +
    (Number(r.valorAjudaCusto) || 0) +
    (Number(r.valorBonus) || 0) +
    (Number(r.valorComissao) || 0) +
    (Number(r.valorVR) || 0) +
    (Number(r.valorVT) || 0) +
    (Number(r.valorSeguro) || 0) +
    (Number(r.valorFGTS) || 0) +
    (Number(r.valorGPS) || 0) +
    (Number(r.valorDecTerceiro) || 0) +
    (Number(r.valorFerias) || 0) +
    (Number(r.valorOutros) || 0) +
    (Number(r.valorEmprestimo) || 0) +
    customSum;
}

/** Calcula os totalizadores executivos de uma apuração de terceirização. */
export function computeOutsourcingMetrics(params: {
  rows: OutsourcingRow[];
  repassLines: RepassLine[];
  taxInputMode: 'rate' | 'amount';
  taxRate: number;
  taxFixedAmount: number;
  adminFeeMode: 'rate' | 'amount';
  adminFeeRate: number;
  adminFeeFixedAmount: number;
}): OutsourcingAuditMetrics {
  const {
    rows = [],
    repassLines = [],
    taxInputMode = 'rate',
    taxRate = 0,
    taxFixedAmount = 0,
    adminFeeMode = 'rate',
    adminFeeRate = 0,
    adminFeeFixedAmount = 0,
  } = params;

  let subtotal = 0;
  let valorBruto = 0;
  let valorDesconto = 0;
  let valorLiquido = 0;
  let valorVR = 0;
  let valorVT = 0;
  let valorFGTS = 0;
  let valorGPS = 0;

  for (const r of rows) {
    const liq = (r.valorLiquido !== undefined && r.valorLiquido !== null)
      ? Number(r.valorLiquido)
      : ((Number(r.valorBruto) || 0) - (Number(r.valorDesconto) || 0));
    subtotal += computeOutsourcingRowTotal(r);
    valorBruto += Number(r.valorBruto) || 0;
    valorDesconto += Number(r.valorDesconto) || 0;
    valorLiquido += liq;
    valorVR += Number(r.valorVR) || 0;
    valorVT += Number(r.valorVT) || 0;
    valorFGTS += Number(r.valorFGTS) || 0;
    valorGPS += Number(r.valorGPS) || 0;
  }

  const calculatedTax = taxInputMode === 'rate'
    ? subtotal * ((Number(taxRate) || 0) / 100)
    : (Number(taxFixedAmount) || 0);
  const calculatedAdminFee = adminFeeMode === 'rate'
    ? subtotal * ((Number(adminFeeRate) || 0) / 100)
    : (Number(adminFeeFixedAmount) || 0);
  const totalApuradoBruto = subtotal + calculatedTax + calculatedAdminFee;
  const totalRepassado = repassLines.reduce((a, l) => a + (Number(l.amount) || 0), 0);

  return {
    rowsCount: rows.length,
    valorBruto: Number(valorBruto.toFixed(2)),
    valorDesconto: Number(valorDesconto.toFixed(2)),
    valorLiquido: Number(valorLiquido.toFixed(2)),
    valorVR: Number(valorVR.toFixed(2)),
    valorVT: Number(valorVT.toFixed(2)),
    valorFGTS: Number(valorFGTS.toFixed(2)),
    valorGPS: Number(valorGPS.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
    taxRate: Number(taxRate) || 0,
    calculatedTax: Number(calculatedTax.toFixed(2)),
    calculatedAdminFee: Number(calculatedAdminFee.toFixed(2)),
    totalApuradoBruto: Number(totalApuradoBruto.toFixed(2)),
    repassCount: repassLines.length,
    totalRepassado: Number(totalRepassado.toFixed(2)),
  };
}

/** Calcula métricas diretamente a partir de um objeto de configuração persistido. */
export function computeOutsourcingMetricsFromConfig(
  cfg: Partial<OutsourcingCompetenceConfig>
): OutsourcingAuditMetrics {
  return computeOutsourcingMetrics({
    rows: cfg.rows || [],
    repassLines: cfg.repassLines || [],
    taxInputMode: cfg.taxInputMode || 'rate',
    taxRate: Number(cfg.taxRate) || 0,
    taxFixedAmount: Number(cfg.taxFixedAmount) || 0,
    adminFeeMode: cfg.adminFeeMode || 'rate',
    adminFeeRate: Number(cfg.adminFeeRate) || 0,
    adminFeeFixedAmount: Number(cfg.adminFeeFixedAmount) || 0,
  });
}

/** Compara dois snapshots/configurações ignorando saved_at para evitar snapshots redundantes. */
export function areOutsourcingConfigsEquivalent(
  a?: Partial<OutsourcingCompetenceConfig> | null,
  b?: Partial<OutsourcingCompetenceConfig> | null
): boolean {
  if (!a || !b) return false;
  const norm = (c: Partial<OutsourcingCompetenceConfig>) => ({
    taxInputMode: c.taxInputMode || 'rate',
    taxRate: Number(c.taxRate) || 0,
    taxFixedAmount: Number(c.taxFixedAmount) || 0,
    adminFeeMode: c.adminFeeMode || 'rate',
    adminFeeRate: Number(c.adminFeeRate) || 0,
    adminFeeFixedAmount: Number(c.adminFeeFixedAmount) || 0,
    repassLines: c.repassLines || [],
    customColumns: c.customColumns || [],
    rows: c.rows || [],
  });
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

function csvEscape(val: unknown): string {
  const s = String(val ?? '').replace(/\r?\n/g, ' ');
  return `"${s.replace(/"/g, '""')}"`;
}

function formatCsvNumber(val: number | undefined): string {
  return (Number(val) || 0).toFixed(2).replace('.', ',');
}

export class OutsourcingAuditService {
  private static cachedGlobalRecordId: string | null = null;
  private static cachedOrgId: string | null = null;

  static getOperatorOverride(): string {
    if (typeof window === 'undefined') return '';
    try {
      return (localStorage.getItem(OPERATOR_STORAGE_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  static setOperatorOverride(name: string): void {
    if (typeof window === 'undefined') return;
    try {
      const clean = name.trim();
      if (clean) {
        localStorage.setItem(OPERATOR_STORAGE_KEY, clean);
      } else {
        localStorage.removeItem(OPERATOR_STORAGE_KEY);
      }
    } catch {
      // Ignora erro de storage bloqueado
    }
  }

  private static async getGlobalConfigMeta(): Promise<GlobalConfigRecord | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('id, metadata')
      .eq('full_name', GLOBAL_CONFIG_NAME)
      .maybeSingle();

    if (error || !data) return null;
    this.cachedGlobalRecordId = data.id;
    return {
      id: data.id,
      metadata: (data.metadata as Record<string, unknown>) || {},
    };
  }

  private static async getDefaultOrganizationId(): Promise<string | null> {
    if (this.cachedOrgId) return this.cachedOrgId;
    try {
      const { data } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        this.cachedOrgId = data.id;
        return data.id;
      }
    } catch {
      // Sem organização configurada
    }
    return null;
  }

  /**
   * Resolve automaticamente o operador autenticado via Supabase Auth / tabela profiles,
   * respeitando o nome de operador definido localmente caso a sessão seja compartilhada.
   */
  static async resolveCurrentActor(): Promise<OutsourcingAuditActor> {
    const operatorOverride = this.getOperatorOverride();
    const organizationId = await this.getDefaultOrganizationId();

    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      if (authUser?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('id', authUser.id)
          .maybeSingle();

        const metaName = typeof authUser.user_metadata?.full_name === 'string'
          ? authUser.user_metadata.full_name
          : '';
        const baseName = profile?.full_name || metaName || authUser.email?.split('@')[0] || 'Usuário Autenticado';

        return {
          userId: profile?.id || null,
          userName: operatorOverride || baseName,
          userEmail: operatorOverride && operatorOverride !== baseName ? null : (profile?.email || authUser.email || null),
          role: profile?.role || 'colaborador',
          organizationId,
          source: operatorOverride ? 'operator_override' : 'supabase_auth',
        };
      }
    } catch {
      // Sessão Supabase Auth ausente (ex: acesso via senha do portal)
    }

    try {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

      if (adminProfile) {
        return {
          userId: adminProfile.id,
          userName: operatorOverride || adminProfile.full_name || 'Administrador',
          userEmail: operatorOverride && operatorOverride !== adminProfile.full_name
            ? null
            : (adminProfile.email || null),
          role: operatorOverride ? 'operador' : (adminProfile.role || 'admin'),
          organizationId,
          source: operatorOverride ? 'operator_override' : 'system_fallback',
        };
      }
    } catch {
      // Ignora se tabela profiles não estiver acessível
    }

    return {
      userId: null,
      userName: operatorOverride || 'Sessão Dashboard (Sem Auth Individual)',
      userEmail: null,
      role: 'operador',
      organizationId,
      source: operatorOverride ? 'operator_override' : 'system_fallback',
    };
  }

  /**
   * Busca os logs de auditoria combinando a tabela relacional public.audit_logs
   * com o cache legado de __SYSTEM_GLOBAL_CONFIG__.metadata.
   */
  static async fetchAuditLogs(limit = 200): Promise<OutsourcingAuditLogEntry[]> {
    const mergedMap = new Map<string, OutsourcingAuditLogEntry>();

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, table_name, record_id, user_id, organization_id, old_data, new_data, created_at')
        .eq('table_name', AUDIT_TABLE_LOG)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        for (const row of data as RelationalAuditRow[]) {
          const nd = row.new_data || {};
          const od = row.old_data || {};
          const entryId = (typeof nd.id === 'string' && nd.id) ? nd.id : row.id;
          const entry: OutsourcingAuditLogEntry = {
            id: entryId,
            timestamp: (typeof nd.timestamp === 'string' && nd.timestamp) ? nd.timestamp : row.created_at,
            competencia: typeof nd.competencia === 'string' ? nd.competencia : '',
            action: (typeof nd.action === 'string' ? nd.action : row.action) as OutsourcingAuditAction,
            summary: typeof nd.summary === 'string' ? nd.summary : `Evento ${row.action}`,
            details: typeof nd.details === 'string' ? nd.details : undefined,
            metrics: (nd.metrics as OutsourcingAuditMetrics | undefined) || undefined,
            oldMetrics: (nd.oldMetrics as OutsourcingAuditMetrics | null | undefined)
              ?? (od.metrics as OutsourcingAuditMetrics | undefined)
              ?? null,
            actor: (nd.actor as OutsourcingAuditActor | undefined) || undefined,
          };
          mergedMap.set(entry.id, entry);
        }
      }
    } catch (err) {
      console.warn('[OutsourcingAuditService] Falha ao ler public.audit_logs:', err);
    }

    try {
      const globalRec = await this.getGlobalConfigMeta();
      const cachedLogs = globalRec?.metadata?.outsourcing_audit_logs;
      if (Array.isArray(cachedLogs)) {
        for (const raw of cachedLogs) {
          const item = raw as OutsourcingAuditLogEntry;
          if (item?.id && !mergedMap.has(item.id)) {
            mergedMap.set(item.id, item);
          }
        }
      }
    } catch {
      // Ignora fallback se offline
    }

    return Array.from(mergedMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Busca os snapshots de uma competência na tabela relacional public.audit_logs
   * e mescla com o histórico em __SYSTEM_GLOBAL_CONFIG__.metadata.
   */
  static async fetchCompetenceSnapshots(competencia: string, limit = 10): Promise<OutsourcingSnapshot[]> {
    const cleanComp = competencia.slice(0, 7);
    const mergedMap = new Map<string, OutsourcingSnapshot>();

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, table_name, record_id, user_id, organization_id, old_data, new_data, created_at')
        .eq('table_name', AUDIT_TABLE_SNAPSHOT)
        .eq('new_data->>competencia', cleanComp)
        .order('created_at', { ascending: false })
        .limit(limit * 2);

      if (!error && Array.isArray(data)) {
        for (const row of data as RelationalAuditRow[]) {
          const nd = row.new_data || {};
          const snapId = (typeof nd.id === 'string' && nd.id) ? nd.id : row.id;
          if (!nd.data) continue;
          const snap: OutsourcingSnapshot = {
            id: snapId,
            competencia: typeof nd.competencia === 'string' ? nd.competencia : cleanComp,
            created_at: (typeof nd.created_at === 'string' && nd.created_at) ? nd.created_at : row.created_at,
            label: typeof nd.label === 'string' ? nd.label : 'Versão Salva',
            reason: typeof nd.reason === 'string' ? nd.reason : 'Snapshot preservado no banco',
            metrics: (nd.metrics as OutsourcingAuditMetrics) || computeOutsourcingMetricsFromConfig(nd.data as Partial<OutsourcingCompetenceConfig>),
            data: nd.data as OutsourcingCompetenceConfig,
            actor: (nd.actor as OutsourcingAuditActor | undefined) || undefined,
          };
          mergedMap.set(snap.id, snap);
        }
      }
    } catch (err) {
      console.warn('[OutsourcingAuditService] Falha ao ler snapshots em public.audit_logs:', err);
    }

    try {
      const globalRec = await this.getGlobalConfigMeta();
      const snapshotsMap = globalRec?.metadata?.outsourcing_snapshots as Record<string, OutsourcingSnapshot[]> | undefined;
      const fallbackSnaps = snapshotsMap?.[cleanComp] || snapshotsMap?.[competencia] || [];
      if (Array.isArray(fallbackSnaps)) {
        for (const snap of fallbackSnaps) {
          if (snap?.id && !mergedMap.has(snap.id)) {
            mergedMap.set(snap.id, snap);
          }
        }
      }
    } catch {
      // Ignora fallback se offline
    }

    return Array.from(mergedMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  /**
   * Registra um evento na tabela relacional public.audit_logs (com identificação automática
   * do usuário autenticado) e opcionalmente atualiza o cache compacto em __SYSTEM_GLOBAL_CONFIG__.
   */
  static async recordAuditLog(
    entry: OutsourcingAuditLogEntry,
    options?: {
      oldMetrics?: OutsourcingAuditMetrics | null;
      skipGlobalMetaWrite?: boolean;
      actorOverride?: OutsourcingAuditActor;
    }
  ): Promise<{ entry: OutsourcingAuditLogEntry; logs: OutsourcingAuditLogEntry[] }> {
    const actor = options?.actorOverride || entry.actor || (await this.resolveCurrentActor());
    const enrichedEntry: OutsourcingAuditLogEntry = {
      ...entry,
      oldMetrics: options?.oldMetrics ?? entry.oldMetrics ?? null,
      actor,
    };

    try {
      if (!this.cachedGlobalRecordId) {
        await this.getGlobalConfigMeta();
      }
      await supabase.from('audit_logs').insert([{
        organization_id: actor.organizationId,
        user_id: actor.userId,
        action: enrichedEntry.action,
        table_name: AUDIT_TABLE_LOG,
        record_id: this.cachedGlobalRecordId,
        old_data: enrichedEntry.oldMetrics ? { metrics: enrichedEntry.oldMetrics } : null,
        new_data: enrichedEntry,
        created_at: enrichedEntry.timestamp,
      }]);
    } catch (err) {
      console.warn('[OutsourcingAuditService] Erro ao inserir em public.audit_logs:', err);
    }

    if (!options?.skipGlobalMetaWrite) {
      try {
        const globalRec = await this.getGlobalConfigMeta();
        if (globalRec?.id) {
          const meta = globalRec.metadata || {};
          const existingLogs = Array.isArray(meta.outsourcing_audit_logs)
            ? (meta.outsourcing_audit_logs as OutsourcingAuditLogEntry[])
            : [];
          const updatedCache = [enrichedEntry, ...existingLogs.filter(l => l.id !== enrichedEntry.id)].slice(0, 200);
          await supabase
            .from('employees')
            .update({
              metadata: {
                ...meta,
                outsourcing_audit_logs: updatedCache,
                updated_at: new Date().toISOString(),
              }
            })
            .eq('id', globalRec.id);
        }
      } catch (err) {
        console.warn('[OutsourcingAuditService] Erro ao atualizar cache de audit logs:', err);
      }
    }

    const logs = await this.fetchAuditLogs(200);
    return { entry: enrichedEntry, logs };
  }

  /**
   * Persiste um snapshot completo da competência como registro independente na tabela public.audit_logs.
   */
  static async recordCompetenceSnapshot(
    snapshot: OutsourcingSnapshot,
    actorOverride?: OutsourcingAuditActor
  ): Promise<OutsourcingSnapshot> {
    const actor = actorOverride || snapshot.actor || (await this.resolveCurrentActor());
    const enrichedSnap: OutsourcingSnapshot = {
      ...snapshot,
      actor,
    };

    try {
      if (!this.cachedGlobalRecordId) {
        await this.getGlobalConfigMeta();
      }
      await supabase.from('audit_logs').insert([{
        organization_id: actor.organizationId,
        user_id: actor.userId,
        action: 'SNAPSHOT',
        table_name: AUDIT_TABLE_SNAPSHOT,
        record_id: this.cachedGlobalRecordId,
        old_data: null,
        new_data: enrichedSnap,
        created_at: enrichedSnap.created_at,
      }]);
    } catch (err) {
      console.warn('[OutsourcingAuditService] Erro ao registrar snapshot em public.audit_logs:', err);
    }

    return enrichedSnap;
  }

  /**
   * Exporta a trilha de auditoria filtrada para arquivo CSV compatível com Excel (UTF-8 BOM).
   */
  static exportAuditLogsToCsv(logs: OutsourcingAuditLogEntry[], filenameSuffix = 'todas'): void {
    if (typeof window === 'undefined' || logs.length === 0) return;

    const headers = [
      'Data/Hora',
      'Competência',
      'Ação',
      'Usuário Responsável',
      'E-mail',
      'Resumo',
      'Detalhes',
      'Qtd. Contratados',
      'Valor Bruto (R$)',
      'Valor Líquido (R$)',
      'VA/VR (R$)',
      'VT (R$)',
      'Total Apurado (R$)',
      'Total Repassado (R$)',
    ];

    const rows = logs.map(entry => {
      const m = entry.metrics;
      const dt = new Date(entry.timestamp).toLocaleString('pt-BR');
      return [
        csvEscape(dt),
        csvEscape(entry.competencia),
        csvEscape(entry.action),
        csvEscape(entry.actor?.userName || 'Sistema'),
        csvEscape(entry.actor?.userEmail || ''),
        csvEscape(entry.summary),
        csvEscape(entry.details || ''),
        csvEscape(m?.rowsCount ?? ''),
        csvEscape(m ? formatCsvNumber(m.valorBruto) : ''),
        csvEscape(m ? formatCsvNumber(m.valorLiquido) : ''),
        csvEscape(m ? formatCsvNumber(m.valorVR) : ''),
        csvEscape(m ? formatCsvNumber(m.valorVT) : ''),
        csvEscape(m ? formatCsvNumber(m.totalApuradoBruto) : ''),
        csvEscape(m ? formatCsvNumber(m.totalRepassado) : ''),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.map(csvEscape).join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria_terceirizacao_${filenameSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
