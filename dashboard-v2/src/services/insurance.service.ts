/**
 * Insurance Service — Mar Brasil
 * CRUD + KPIs para Apólices de Seguro via Supabase
 * @version v.02.48.97
 */

import { supabase } from '@/lib/supabase';
import {
  InsurancePolicy,
  InsurancePolicyInput,
  InsuranceKPIs,
  InsuranceFilterValues,
  InsuranceStatusVencimento,
} from '@/types/insurance';

const TABLE = 'insurance_policies';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getDiasParaVencer(vencimento?: string): number | undefined {
  if (!vencimento) return undefined;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(vencimento + 'T00:00:00');
  const diff = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function getStatusVencimento(dias?: number): InsuranceStatusVencimento {
  if (dias === undefined) return 'sem_data';
  if (dias < 0) return 'vencido';
  if (dias <= 7) return 'urgente';
  if (dias <= 30) return 'atencao';
  return 'ok';
}

function getParcelasPagas(inicio?: string, total?: number): number {
  if (!inicio || !total) return 0;
  const hoje = new Date();
  const start = new Date(inicio + 'T00:00:00');
  const meses =
    (hoje.getFullYear() - start.getFullYear()) * 12 +
    (hoje.getMonth() - start.getMonth()) +
    1;
  return Math.min(total, Math.max(0, meses));
}

/** Adiciona campos calculados a cada apólice */
export function enrichPolicy(policy: InsurancePolicy): InsurancePolicy {
  const dias = getDiasParaVencer(policy.vencimento);
  const parcelasPagas = getParcelasPagas(policy.inicio, policy.parcelas_total);
  const parcelasRestantes = Math.max(0, (policy.parcelas_total || 0) - parcelasPagas);

  return {
    ...policy,
    diasParaVencer: dias,
    statusVencimento: getStatusVencimento(dias),
    parcelasPagas,
    parcelasRestantes,
  };
}

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

export async function fetchInsurancePolicies(
  filters?: Partial<InsuranceFilterValues>
): Promise<InsurancePolicy[]> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .order('vencimento', { ascending: true });

  // Por padrão, traz apenas ativas
  if (!filters?.mostrarInativos) {
    query = query.eq('ativo', true);
  }

  if (filters?.contratante) {
    query = query.eq('contratante', filters.contratante);
  }
  if (filters?.tipo) {
    query = query.eq('tipo', filters.tipo);
  }
  if (filters?.seguradora) {
    query = query.eq('seguradora', filters.seguradora);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[InsuranceService] Erro ao buscar apólices:', error.message);
    throw error;
  }

  return (data || []).map(enrichPolicy);
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────

export async function createInsurancePolicy(
  input: InsurancePolicyInput
): Promise<InsurancePolicy> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ ...input, ativo: input.ativo ?? true }])
    .select()
    .single();

  if (error) {
    console.error('[InsuranceService] Erro ao criar apólice:', error.message);
    throw error;
  }

  return enrichPolicy(data);
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────

export async function updateInsurancePolicy(
  id: string,
  input: Partial<InsurancePolicyInput>
): Promise<InsurancePolicy> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[InsuranceService] Erro ao atualizar apólice:', error.message);
    throw error;
  }

  return enrichPolicy(data);
}

// ─────────────────────────────────────────────
// DELETE (soft delete — marca como inativo)
// ─────────────────────────────────────────────

export async function deactivateInsurancePolicy(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[InsuranceService] Erro ao desativar apólice:', error.message);
    throw error;
  }
}

/** Hard delete — use com cuidado */
export async function deleteInsurancePolicy(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);

  if (error) {
    console.error('[InsuranceService] Erro ao excluir apólice:', error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────

export function computeInsuranceKPIs(policies: InsurancePolicy[]): InsuranceKPIs {
  const ativas = policies.filter((p) => p.ativo);

  const premioMensalTotal = ativas.reduce((sum, p) => sum + (p.valor_parcela || 0), 0);
  const premioAnualTotal = ativas.reduce((sum, p) => sum + (p.premio || 0), 0);

  const vencendoEm30Dias = ativas.filter(
    (p) => p.diasParaVencer !== undefined && p.diasParaVencer >= 0 && p.diasParaVencer <= 30
  );
  const vencendoEm7Dias = ativas.filter(
    (p) => p.diasParaVencer !== undefined && p.diasParaVencer >= 0 && p.diasParaVencer <= 7
  );

  const comVencimento = ativas.filter((p) => p.vencimento && p.diasParaVencer !== undefined && p.diasParaVencer >= 0);
  const proximoVencimento =
    comVencimento.length > 0
      ? comVencimento.reduce((min, p) =>
          (p.diasParaVencer ?? Infinity) < (min.diasParaVencer ?? Infinity) ? p : min
        )
      : null;

  const maiorPremio =
    ativas.length > 0
      ? ativas.reduce((max, p) => ((p.premio || 0) > (max.premio || 0) ? p : max))
      : null;

  const porContratante: Record<string, number> = {};
  const porTipo: Record<string, number> = {};
  ativas.forEach((p) => {
    if (p.contratante) porContratante[p.contratante] = (porContratante[p.contratante] || 0) + 1;
    if (p.tipo) porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1;
  });

  return {
    totalApólices: policies.length,
    apólicesAtivas: ativas.length,
    premioMensalTotal,
    premioAnualTotal,
    proximoVencimento,
    vencendoEm30Dias,
    vencendoEm7Dias,
    maiorPremio,
    porContratante,
    porTipo,
  };
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

export function formatInsuranceCurrency(value?: number): string {
  if (value === undefined || value === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatInsuranceDate(isoDate?: string): string {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export function getTipoIcon(tipo: string): string {
  const map: Record<string, string> = {
    'Automóvel': '🚗',
    'Carro': '🚗',
    'Saúde': '🏥',
    'Vida': '❤️',
    'Responsabilidade Civil': '⚖️',
    'RC': '⚖️',
    'Patrimonial': '🏢',
    'Residencial': '🏠',
    'Transporte': '📦',
  };
  const key = Object.keys(map).find((k) => tipo?.toLowerCase().includes(k.toLowerCase()));
  return key ? map[key] : '🛡️';
}
