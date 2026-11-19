import { supabase } from '@/lib/supabase';
import { PeopleHRService } from '@/services/people-hr.service';
import type { MonthlyCost } from '@/types/loans';

const AUDIT_TABLE_NAME = 'people_cost_import_snapshots';

export interface ImportSnapshotRecord {
  id: string;
  createdAt: string;
  competencia: string;
  scope: 'CLT_FOLHA' | 'CLT_BENEFICIOS' | 'PJ_OMIE' | 'PJ_NFSE' | 'EXCEL_RETROATIVO';
  engine: string;
  fileName: string;
  fileHash: string | null;
  totalRowsCommitted: number;
  previousRowsCount: number;
  newlyCreatedCount: number;
  totalAmountCommitted: number;
  rolledBack: boolean;
}

export interface DuplicateImportCheckResult {
  isDuplicate: boolean;
  previousImportDate?: string;
  competencia?: string;
  fileName?: string;
  rowsCount?: number;
}

export interface CreateImportSnapshotParams {
  competencia: string;
  scope: ImportSnapshotRecord['scope'];
  engine: string;
  fileName: string;
  fileHash?: string | null;
  previousRows: MonthlyCost[];
  committedEmployeeIds: string[];
  totalAmountCommitted: number;
}

/**
 * Calcula hash SHA-256 hexadecimal do arquivo no navegador via Web Crypto API nativa (0 dependências).
 */
export async function computeFileSha256Hex(file: File | ArrayBuffer): Promise<string> {
  try {
    const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Verifica em public.audit_logs se um arquivo com o mesmo SHA-256 já foi gravado anteriormente.
 */
export async function checkDuplicateImportHash(fileHash: string): Promise<DuplicateImportCheckResult> {
  if (!fileHash) return { isDuplicate: false };
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, created_at, new_data')
      .eq('table_name', AUDIT_TABLE_NAME)
      .eq('action', 'IMPORT_COMMIT')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) return { isDuplicate: false };

    const match = data.find((row) => {
      const nd = (row.new_data as Record<string, unknown> | null) || {};
      return nd.fileHash === fileHash && nd.rolledBack !== true;
    });

    if (!match) return { isDuplicate: false };
    const nd = (match.new_data as Record<string, unknown> | null) || {};
    return {
      isDuplicate: true,
      previousImportDate: match.created_at,
      competencia: String(nd.competencia || ''),
      fileName: String(nd.fileName || ''),
      rowsCount: Number(nd.totalRowsCommitted || 0),
    };
  } catch {
    return { isDuplicate: false };
  }
}

/**
 * Grava snapshot pré-lote em public.audit_logs antes da gravação em people_monthly_costs,
 * permitindo Rollback atômico em 1 clique restaurando linhas anteriores e removendo inserções novas.
 */
export async function createPreCommitImportSnapshot(
  params: CreateImportSnapshotParams
): Promise<string | null> {
  try {
    const previousEmpIds = new Set(params.previousRows.map((r) => r.employee_id));
    const newlyCreatedEmployeeIds = params.committedEmployeeIds.filter((id) => !previousEmpIds.has(id));

    const { data, error } = await supabase
      .from('audit_logs')
      .insert([
        {
          action: 'IMPORT_COMMIT',
          table_name: AUDIT_TABLE_NAME,
          record_id: params.competencia,
          old_data: {
            competencia: params.competencia,
            previousRows: params.previousRows,
          },
          new_data: {
            competencia: params.competencia,
            scope: params.scope,
            engine: params.engine,
            fileName: params.fileName,
            fileHash: params.fileHash || null,
            totalRowsCommitted: params.committedEmployeeIds.length,
            previousRowsCount: params.previousRows.length,
            newlyCreatedEmployeeIds,
            totalAmountCommitted: Math.round((params.totalAmountCommitted + Number.EPSILON) * 100) / 100,
            rolledBack: false,
          },
        },
      ])
      .select('id')
      .single();

    if (error) {
      console.warn('[PeopleCostImportAudit] Falha não bloqueante ao gravar snapshot:', error.message);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.warn('[PeopleCostImportAudit] Erro não bloqueante ao criar snapshot:', err);
    return null;
  }
}

/**
 * Lista os últimos lotes gravados pela Central de Ingestão para auditoria ou Rollback em 1 clique.
 */
export async function listRecentImportSnapshots(limit = 10): Promise<ImportSnapshotRecord[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, created_at, new_data')
      .eq('table_name', AUDIT_TABLE_NAME)
      .eq('action', 'IMPORT_COMMIT')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row) => {
      const nd = (row.new_data as Record<string, unknown> | null) || {};
      const newly = Array.isArray(nd.newlyCreatedEmployeeIds) ? nd.newlyCreatedEmployeeIds.length : 0;
      return {
        id: String(row.id),
        createdAt: String(row.created_at || ''),
        competencia: String(nd.competencia || ''),
        scope: (nd.scope as ImportSnapshotRecord['scope']) || 'CLT_FOLHA',
        engine: String(nd.engine || 'manual'),
        fileName: String(nd.fileName || 'Lote Manual'),
        fileHash: nd.fileHash ? String(nd.fileHash) : null,
        totalRowsCommitted: Number(nd.totalRowsCommitted || 0),
        previousRowsCount: Number(nd.previousRowsCount || 0),
        newlyCreatedCount: newly,
        totalAmountCommitted: Number(nd.totalAmountCommitted || 0),
        rolledBack: Boolean(nd.rolledBack),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Rollback em 1 clique de um lote gravado:
 * 1. Restaura todas as linhas que existiam antes do lote (via upsertMonthlyCost).
 * 2. Remove os lançamentos recém-criados exclusivamente naquele lote para a competência.
 * 3. Marca o snapshot como rolledBack = true e registra o evento IMPORT_ROLLBACK.
 */
export async function rollbackImportSnapshot(
  snapshotId: string
): Promise<{ restoredCount: number; deletedCount: number; competencia: string }> {
  const { data: snap, error } = await supabase
    .from('audit_logs')
    .select('id, old_data, new_data')
    .eq('id', snapshotId)
    .eq('table_name', AUDIT_TABLE_NAME)
    .single();

  if (error || !snap) {
    throw new Error('Snapshot de importação não encontrado para rollback.');
  }

  const oldData = (snap.old_data as Record<string, unknown> | null) || {};
  const newData = (snap.new_data as Record<string, unknown> | null) || {};

  if (newData.rolledBack === true) {
    throw new Error('Este lote já foi revertido anteriormente.');
  }

  const competencia = String(newData.competencia || oldData.competencia || '');
  const previousRows = Array.isArray(oldData.previousRows) ? (oldData.previousRows as MonthlyCost[]) : [];
  const newlyCreatedIds = Array.isArray(newData.newlyCreatedEmployeeIds)
    ? (newData.newlyCreatedEmployeeIds as string[])
    : [];

  let restoredCount = 0;
  for (const prevRow of previousRows) {
    const restorable: Partial<MonthlyCost> = { ...prevRow };
    delete restorable.id;
    delete restorable.created_at;
    await PeopleHRService.upsertMonthlyCost(restorable);
    restoredCount += 1;
  }

  let deletedCount = 0;
  if (newlyCreatedIds.length > 0 && competencia) {
    const normalizedComp = PeopleHRService.normalizeCompetenciaDate(competencia);
    const { data: deletedRows, error: delErr } = await supabase
      .from('people_monthly_costs')
      .delete()
      .eq('competencia', normalizedComp)
      .in('employee_id', newlyCreatedIds)
      .select('id');

    if (delErr) {
      throw new Error(`Falha ao remover lançamentos novos no rollback: ${delErr.message}`);
    }
    deletedCount = deletedRows?.length || 0;
  }

  await supabase
    .from('audit_logs')
    .update({
      new_data: {
        ...newData,
        rolledBack: true,
        rolledBackAt: new Date().toISOString(),
      },
    })
    .eq('id', snapshotId);

  await supabase.from('audit_logs').insert([
    {
      action: 'IMPORT_ROLLBACK',
      table_name: AUDIT_TABLE_NAME,
      record_id: snapshotId,
      new_data: {
        snapshotId,
        competencia,
        restoredCount,
        deletedCount,
      },
    },
  ]);

  return { restoredCount, deletedCount, competencia };
}
