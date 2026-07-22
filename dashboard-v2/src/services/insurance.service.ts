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

function getParcelasPagas(inicio?: string, total?: number, diaPgto?: string): number {
  if (!inicio || !total) return 0;
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const start = new Date(inicio + 'T00:00:00');
  start.setHours(0, 0, 0, 0);
  
  if (hoje < start) return 0;

  let meses = (hoje.getFullYear() - start.getFullYear()) * 12 + (hoje.getMonth() - start.getMonth());
  
  const diaVencimento = diaPgto ? parseInt(diaPgto, 10) : start.getDate();
  if (hoje.getDate() >= (isNaN(diaVencimento) ? start.getDate() : diaVencimento)) {
    meses += 1;
  }
  
  return Math.min(total, Math.max(0, meses));
}

/** Adiciona campos calculados a cada apólice */
export function enrichPolicy(policy: InsurancePolicy): InsurancePolicy {
  const dias = getDiasParaVencer(policy.vencimento);
  const parcelasPagas = getParcelasPagas(policy.inicio, policy.parcelas_total, policy.dia_pgto);
  const parcelasRestantes = Math.max(0, (policy.parcelas_total || 0) - parcelasPagas);

  // Se observacoes estiver vazio mas coberturas_adicionais contiver "Obs:", extrai para observacoes para exibição
  let obs = policy.observacoes || '';
  if (!obs && policy.coberturas_adicionais && policy.coberturas_adicionais.includes('Obs:')) {
    const parts = policy.coberturas_adicionais.split('| Obs:');
    if (parts.length > 1) {
      obs = parts[parts.length - 1].trim();
    } else if (policy.coberturas_adicionais.startsWith('Obs:')) {
      obs = policy.coberturas_adicionais.replace('Obs:', '').trim();
    }
  }

  return {
    ...policy,
    observacoes: obs,
    diasParaVencer: dias,
    statusVencimento: getStatusVencimento(dias),
    parcelasPagas,
    parcelasRestantes,
  };
}

/**
 * Trata o payload antes de salvar no Supabase:
 * 1. Converte strings vazias ('') em campos de data (inicio, vencimento) para null (evita o erro Postgres 'invalid input syntax for type date: ""').
 * 2. Assegura tipos numéricos válidos.
 * 3. Remove propriedades calculadas client-side.
 */
function prepareInsurancePayload(input: Partial<InsurancePolicyInput>): Record<string, any> {
  const payload: Record<string, any> = { ...input };

  // 1. Datas (DATE no Postgres só aceita YYYY-MM-DD válido ou null)
  if (typeof payload.inicio === 'string') {
    const trimmed = payload.inicio.trim();
    payload.inicio = (trimmed === '' || trimmed === '—') ? null : trimmed;
  }
  if (typeof payload.vencimento === 'string') {
    const trimmed = payload.vencimento.trim();
    payload.vencimento = (trimmed === '' || trimmed === '—') ? null : trimmed;
  }

  // 2. Números (NUMERIC / INTEGER no Postgres)
  if (payload.premio !== undefined && payload.premio !== null) {
    payload.premio = isNaN(Number(payload.premio)) ? 0 : Number(payload.premio);
  }
  if (payload.valor_parcela !== undefined && payload.valor_parcela !== null) {
    payload.valor_parcela = isNaN(Number(payload.valor_parcela)) ? 0 : Number(payload.valor_parcela);
  }
  if (payload.franquia !== undefined && payload.franquia !== null) {
    payload.franquia = isNaN(Number(payload.franquia)) ? 0 : Number(payload.franquia);
  }
  if (payload.franquia_reduzida_percentual !== undefined && payload.franquia_reduzida_percentual !== null) {
    payload.franquia_reduzida_percentual = isNaN(Number(payload.franquia_reduzida_percentual)) ? 0 : Number(payload.franquia_reduzida_percentual);
  }
  if (payload.parcelas_total !== undefined && payload.parcelas_total !== null) {
    const p = Number(payload.parcelas_total);
    payload.parcelas_total = isNaN(p) || p < 1 ? 1 : Math.floor(p);
  }

  // 3. Remove campos calculados
  delete payload.diasParaVencer;
  delete payload.parcelasPagas;
  delete payload.parcelasRestantes;
  delete payload.statusVencimento;

  return payload;
}

/**
 * Sanitiza o payload para evitar falha no PostgREST se colunas opcionais ('observacoes' ou 'pdf_url')
 * ainda não existirem fisicamente no schema da tabela do Supabase.
 */
function sanitizeInsurancePayload(input: Partial<InsurancePolicyInput>): Record<string, any> {
  const payload = prepareInsurancePayload(input);

  if (payload.observacoes && typeof payload.observacoes === 'string' && payload.observacoes.trim() !== '') {
    const obsText = payload.observacoes.trim();
    if (!payload.coberturas_adicionais || payload.coberturas_adicionais.trim() === '') {
      payload.coberturas_adicionais = `Obs: ${obsText}`;
    } else if (!payload.coberturas_adicionais.includes(obsText)) {
      payload.coberturas_adicionais = `${payload.coberturas_adicionais} | Obs: ${obsText}`;
    }
  }

  delete payload.observacoes;
  delete payload.pdf_url;

  return payload;
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
  const rawPayload = prepareInsurancePayload({ ...input, ativo: input.ativo ?? true });

  let res = await supabase.from(TABLE).insert([rawPayload]).select().single();

  if (res.error && res.error.code === 'PGRST204') {
    console.warn('[InsuranceService] Coluna ausente no schema cache, aplicando payload sanitizado...');
    const sanitized = sanitizeInsurancePayload(rawPayload);
    res = await supabase.from(TABLE).insert([sanitized]).select().single();
  }

  if (res.error) {
    console.error('[InsuranceService] Erro ao criar apólice:', res.error.message);
    throw res.error;
  }

  return enrichPolicy(res.data);
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────

export async function updateInsurancePolicy(
  id: string,
  input: Partial<InsurancePolicyInput>
): Promise<InsurancePolicy> {
  const rawPayload = prepareInsurancePayload({ ...input, updated_at: new Date().toISOString() });

  let res = await supabase.from(TABLE).update(rawPayload).eq('id', id).select().single();

  if (res.error && res.error.code === 'PGRST204') {
    console.warn('[InsuranceService] Coluna ausente no schema cache, aplicando payload sanitizado...');
    const sanitized = sanitizeInsurancePayload(rawPayload);
    res = await supabase.from(TABLE).update(sanitized).eq('id', id).select().single();
  }

  if (res.error) {
    console.error('[InsuranceService] Erro ao atualizar apólice:', res.error.message);
    throw res.error;
  }

  return enrichPolicy(res.data);
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

/**
 * Faz o upload do PDF/imagem da apólice de seguro para o Supabase Storage
 * no bucket 'contracts' (mesmo bucket usado para contratos de RH e Empréstimos)
 */
export async function uploadInsurancePolicyFile(
  policyId: string,
  file: File,
  isTestMode?: boolean
): Promise<string> {
  const folder = isTestMode ? 'test' : 'production';
  const ext = file.name.split('.').pop() || 'pdf';
  const storagePath = `insurances/${folder}/${policyId}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('contracts')
    .upload(storagePath, file, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(`Falha no upload do arquivo de seguro: ${uploadError.message}`);

  const { data } = await supabase.storage.from('contracts').createSignedUrl(storagePath, 31536000); // 1 ano
  return data?.signedUrl || storagePath;
}
