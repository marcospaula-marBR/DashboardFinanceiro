import { supabase } from '@/lib/supabase';
import { Membro, ContratoBase, Recebimento, Comissao, ComissoesFilters } from '@/types/comissoes';

// ─── Raw types from Supabase ──────────────────────────────────────────────────

interface RawRecebimento {
  id: string;
  contrato_id: string;
  data_recebimento: string;
  nota_fiscal?: string | null;
  ciclo?: string | null;
  mes_ref?: number | null;
  ano_ref?: number | null;
  valor_bruto: number;
  valor_liquido: number;
  glosa?: number;
  impostos?: number;
  status?: string;
  // Supabase retorna FK joins como array ou objeto dependendo da relação
  contratos_base?: { nome_contrato: string } | { nome_contrato: string }[] | null;
  comissoes?: RawComissaoDb[];
}

interface RawComissaoDb {
  id: string;
  recebimento_id: string;
  membro_id: string;
  porcentagem: number;
  valor_calculado: number;
  status?: string | null;
  paid_date?: string | null;
}

// ─── ComissoesService ─────────────────────────────────────────────────────────

export class ComissoesService {

  /** Busca todos os membros da equipe */
  static async getEquipe(): Promise<Membro[]> {
    const { data, error } = await supabase
      .from('equipe')
      .select('id, nome, ativo, pct_padrao, employee_id')
      .order('nome');

    if (error) throw new Error(`Falha ao buscar equipe: ${error.message}`);
    return (data || []) as Membro[];
  }

  /** Busca contratos ativos e comissionáveis */
  static async getContratos(): Promise<ContratoBase[]> {
    const { data, error } = await supabase
      .from('contratos_base')
      .select('id, nome_contrato, numero_contrato, observacoes, ativo, empresa, rede')
      .eq('ativo', true)
      .order('nome_contrato');

    if (error) throw new Error(`Falha ao buscar contratos: ${error.message}`);
    return (data || []) as ContratoBase[];
  }

  /**
   * Busca histórico de recebimentos com comissões aninhadas.
   * Recebe um mapa de equipe (id → nome) para resolução de nomes no client.
   */
  static async getHistorico(
    equipeMap: Map<string, string>,
    filters?: ComissoesFilters
  ): Promise<Recebimento[]> {
    // 1. Consulta na tabela 'recebimentos'
    let query = supabase
      .from('recebimentos')
      .select(`
        id,
        contrato_id,
        data_recebimento,
        nota_fiscal,
        ciclo,
        mes_ref,
        ano_ref,
        valor_bruto,
        valor_liquido,
        glosa,
        impostos,
        status,
        contratos_base ( nome_contrato ),
        comissoes ( id, recebimento_id, membro_id, porcentagem, valor_calculado, status, paid_date )
      `)
      .order('data_recebimento', { ascending: false });

    if (filters?.dataInicio) query = query.gte('data_recebimento', filters.dataInicio);
    if (filters?.dataFim)    query = query.lte('data_recebimento', filters.dataFim);
    if (filters?.ciclo)      query = query.eq('ciclo', filters.ciclo);
    if (filters?.contratoId) query = query.eq('contrato_id', filters.contratoId);

    // 2. Consulta na tabela 'notas_fiscais' (para trazer faturamentos adicionais da DRE)
    let nfQuery = supabase
      .from('notas_fiscais')
      .select(`
        id,
        contrato_id,
        numero_nf,
        data_emissao,
        data_recebimento,
        competencia,
        valor_faturado,
        valor_liquido,
        valor_retido,
        total_impostos,
        status,
        contratos_base ( nome_contrato )
      `);

    if (filters?.dataInicio) nfQuery = nfQuery.gte('data_emissao', filters.dataInicio);
    if (filters?.dataFim)    nfQuery = nfQuery.lte('data_emissao', filters.dataFim);
    if (filters?.ciclo)      nfQuery = nfQuery.eq('competencia', filters.ciclo);
    if (filters?.contratoId) nfQuery = nfQuery.eq('contrato_id', filters.contratoId);

    const [recRes, nfRes] = await Promise.all([
      query,
      nfQuery
    ]);

    if (recRes.error) throw new Error(`Falha ao buscar histórico: ${recRes.error.message}`);
    if (nfRes.error) throw new Error(`Falha ao buscar faturamentos (NFs): ${nfRes.error.message}`);

    const rawRecs = (recRes.data || []) as unknown as RawRecebimento[];
    const rawNfs = nfRes.data || [];

    // Helper para diferença de dias
    const daysDiff = (d1: string | null | undefined, d2: string | null | undefined): number => {
      if (!d1 || !d2) return 9999;
      const t1 = new Date(d1.substring(0, 10)).getTime();
      const t2 = new Date(d2.substring(0, 10)).getTime();
      return Math.abs(t1 - t2) / (1000 * 60 * 60 * 24);
    };

    // Mescla faturamentos não duplicados da tabela notas_fiscais
    const mergedRaw: RawRecebimento[] = [...rawRecs];

    for (const nf of rawNfs) {
      const nfVal = Number(nf.valor_faturado) || 0;
      
      // Verifica se já existe um recebimento equivalente para evitar duplicidade
      let isDuplicate = false;
      for (const rec of rawRecs) {
        if (rec.contrato_id === nf.contrato_id) {
          const recVal = Number(rec.valor_bruto) || 0;
          if (Math.abs(recVal - nfVal) < 1.0) {
            const diff = daysDiff(rec.data_recebimento, nf.data_emissao);
            if (diff <= 60) {
              isDuplicate = true;
              break;
            }
          }
        }
      }

      if (!isDuplicate) {
        mergedRaw.push({
          id: nf.id,
          contrato_id: nf.contrato_id,
          data_recebimento: nf.data_recebimento || nf.data_emissao || '',
          nota_fiscal: nf.numero_nf,
          ciclo: nf.competencia,
          mes_ref: nf.competencia ? parseInt(nf.competencia.split('-')[1]) : null,
          ano_ref: nf.competencia ? parseInt(nf.competencia.split('-')[0]) : null,
          valor_bruto: nfVal,
          valor_liquido: Number(nf.valor_liquido) || 0,
          glosa: Number(nf.valor_retido) || 0,
          impostos: Number(nf.total_impostos) || 0,
          status: nf.status || 'Pago',
          contratos_base: nf.contratos_base,
          comissoes: []
        });
      }
    }

    // Ordena os faturamentos combinados por data de recebimento descrescente
    mergedRaw.sort((a, b) => b.data_recebimento.localeCompare(a.data_recebimento));

    // Resolve nomes de contrato e de membros no client
    let result: Recebimento[] = mergedRaw.map(rec => ({
      id: rec.id,
      contrato_id: rec.contrato_id,
      contratoNome: Array.isArray(rec.contratos_base)
        ? (rec.contratos_base[0]?.nome_contrato ?? '—')
        : (rec.contratos_base?.nome_contrato ?? '—'),
      data_recebimento: rec.data_recebimento,
      nota_fiscal: rec.nota_fiscal,
      ciclo: rec.ciclo,
      mes_ref: rec.mes_ref,
      ano_ref: rec.ano_ref,
      valor_bruto: Number(rec.valor_bruto) || 0,
      valor_liquido: Number(rec.valor_liquido) || 0,
      glosa: Number(rec.glosa) || 0,
      impostos: Number(rec.impostos) || 0,
      status: rec.status || 'Pago',
      comissoes: (rec.comissoes || []).map((c): Comissao => ({
        id: c.id,
        recebimento_id: c.recebimento_id,
        membro_id: c.membro_id,
        porcentagem: Number(c.porcentagem) || 0,
        valor_calculado: Number(c.valor_calculado) || 0,
        status: c.status,
        paid_date: c.paid_date,
        membroNome: equipeMap.get(c.membro_id) ?? 'Desconhecido',
      })),
    }));

    // Filtro por membro (pós-processamento — o Supabase não filtra em nested)
    if (filters?.membroId) {
      result = result.filter(r =>
        r.comissoes.some(c => c.membro_id === filters.membroId)
      );
    }

    return result;
  }

  /**
   * Salva ou atualiza um recebimento e suas comissões.
   * Se editId for fornecido, faz UPDATE + delete das comissões antigas.
   */
  static async saveRecebimento(payload: {
    contrato_id: string;
    data_recebimento: string;
    nota_fiscal?: string;
    ciclo?: string;
    valor_bruto: number;
    valor_liquido: number;
    glosa?: number;
    impostos?: number;
    status?: string;
    divisoes: Array<{ membro_id: string; porcentagem: number; valor_calculado: number }>;
    editId?: string;
  }): Promise<void> {
    const ciclo = payload.ciclo || null;
    const status = payload.status || 'Pago';
    const recPayload = {
      contrato_id: payload.contrato_id,
      data_recebimento: payload.data_recebimento,
      nota_fiscal: payload.nota_fiscal || null,
      ciclo,
      mes_ref: ciclo ? parseInt(ciclo.split('-')[1]) : null,
      ano_ref: ciclo ? parseInt(ciclo.split('-')[0]) : null,
      valor_bruto: payload.valor_bruto,
      valor_liquido: payload.valor_liquido,
      glosa: payload.glosa || 0,
      impostos: payload.impostos || 0,
      status
    };

    let recebimentoId = payload.editId;
    let existsInRecebimentos = false;

    if (payload.editId) {
      const { data: existingRec } = await supabase
        .from('recebimentos')
        .select('id')
        .eq('id', payload.editId)
        .maybeSingle();
      if (existingRec) {
        existsInRecebimentos = true;
      }
    }

    if (payload.editId && existsInRecebimentos) {
      const { error } = await supabase
        .from('recebimentos')
        .update(recPayload)
        .eq('id', payload.editId);
      if (error) throw new Error(`Falha ao atualizar recebimento: ${error.message}`);

      // Remove comissões antigas (serão recriadas abaixo)
      const { error: delErr } = await supabase
        .from('comissoes')
        .delete()
        .eq('recebimento_id', payload.editId);
      if (delErr) throw new Error(`Falha ao limpar comissões antigas: ${delErr.message}`);
    } else {
      // Se tiver editId mas não existe em recebimentos, inserimos com o mesmo ID
      const insertPayload = payload.editId 
        ? { ...recPayload, id: payload.editId }
        : recPayload;

      const { data, error } = await supabase
        .from('recebimentos')
        .insert([insertPayload])
        .select('id')
        .single();
      if (error) throw new Error(`Falha ao criar recebimento: ${error.message}`);
      recebimentoId = data.id;
    }

    // Filtra divisões com valor > 0 antes de inserir
    const comissoesPayload = payload.divisoes
      .filter(d => d.valor_calculado > 0 && d.porcentagem > 0)
      .map(d => ({
        recebimento_id: recebimentoId,
        membro_id: d.membro_id,
        porcentagem: d.porcentagem / 100, // Armazena como decimal (0.0035)
        valor_calculado: d.valor_calculado,
        status: status, // Mesmo status do recebimento
        paid_date: status === 'Pago' ? payload.data_recebimento : null
      }));

    if (comissoesPayload.length > 0) {
      const { error: comErr } = await supabase
        .from('comissoes')
        .insert(comissoesPayload);
      if (comErr) throw new Error(`Falha ao salvar comissões: ${comErr.message}`);
    }
  }

  /** Remove um recebimento (comissões são removidas em CASCADE) */
  static async deleteRecebimento(id: string): Promise<void> {
    const { error: recErr } = await supabase
      .from('recebimentos')
      .delete()
      .eq('id', id);

    // Tenta deletar também de notas_fiscais (caso tenha vindo de lá)
    const { error: nfErr } = await supabase
      .from('notas_fiscais')
      .delete()
      .eq('id', id);

    if (recErr && nfErr) {
      throw new Error(`Falha ao excluir faturamento: ${recErr.message || nfErr.message}`);
    }
  }

  /** Cria um novo contrato */
  static async addContrato(payload: {
    nome_contrato: string;
    numero_contrato?: string;
    observacoes?: string;
    rede?: string | null;
  }): Promise<ContratoBase> {
    const { data, error } = await supabase
      .from('contratos_base')
      .insert([{ ...payload, ativo: true, is_comissionavel: true }])
      .select('id, nome_contrato, numero_contrato, observacoes, ativo, empresa, rede')
      .single();
    if (error) throw new Error(`Falha ao criar contrato: ${error.message}`);
    return data as ContratoBase;
  }

  /** Atualiza um contrato existente */
  static async updateContrato(
    id: string,
    payload: {
      nome_contrato: string;
      numero_contrato?: string;
      observacoes?: string;
      rede?: string | null;
    }
  ): Promise<ContratoBase> {
    const { data, error } = await supabase
      .from('contratos_base')
      .update(payload)
      .eq('id', id)
      .select('id, nome_contrato, numero_contrato, observacoes, ativo, empresa, rede')
      .single();
    if (error) throw new Error(`Falha ao atualizar contrato: ${error.message}`);
    return data as ContratoBase;
  }

  /** Unifica contratos duplicados migrando recebimentos e notas fiscais */
  static async unificarContratos(origemId: string, destinoId: string): Promise<void> {
    // 1. Atualiza recebimentos da tabela 'recebimentos'
    const { error: recErr } = await supabase
      .from('recebimentos')
      .update({ contrato_id: destinoId })
      .eq('contrato_id', origemId);
    if (recErr) throw new Error(`Falha ao transferir recebimentos na unificação: ${recErr.message}`);

    // 2. Atualiza faturamentos da tabela 'notas_fiscais'
    const { error: nfErr } = await supabase
      .from('notas_fiscais')
      .update({ contrato_id: destinoId })
      .eq('contrato_id', origemId);
    if (nfErr) throw new Error(`Falha ao transferir notas fiscais na unificação: ${nfErr.message}`);

    // 3. Desativa o contrato de origem
    const { error: delErr } = await supabase
      .from('contratos_base')
      .update({ ativo: false })
      .eq('id', origemId);
    if (delErr) throw new Error(`Falha ao desativar contrato de origem: ${delErr.message}`);
  }

  /** Cria um novo membro da equipe */
  static async addMembro(payload: {
    nome: string;
    pct_padrao: number;
  }): Promise<Membro> {
    const { data, error } = await supabase
      .from('equipe')
      .insert([{ ...payload, ativo: true }])
      .select('id, nome, ativo, pct_padrao')
      .single();
    if (error) throw new Error(`Falha ao criar membro: ${error.message}`);
    return data as Membro;
  }

  /** Ativa ou desativa um membro da equipe */
  static async toggleMembro(id: string, ativo: boolean): Promise<Membro> {
    const { data, error } = await supabase
      .from('equipe')
      .update({ ativo })
      .eq('id', id)
      .select('id, nome, ativo, pct_padrao, employee_id')
      .single();
    if (error) throw new Error(`Falha ao atualizar membro: ${error.message}`);
    return data as Membro;
  }

  /** Habilita comissão para um colaborador da base People */
  static async enableEmployeeCommission(employeeId: string, name: string, pctPadrao: number): Promise<Membro> {
    const { data, error } = await supabase
      .from('equipe')
      .insert([{ employee_id: employeeId, nome: name, pct_padrao: pctPadrao, ativo: true }])
      .select('id, nome, ativo, pct_padrao, employee_id')
      .single();
    if (error) throw new Error(`Falha ao habilitar colaborador: ${error.message}`);
    return data as Membro;
  }

  /** Busca todos os colaboradores ativos da base global */
  static async getGlobalEmployees(): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name')
      .neq('status', 'Inativo')
      .order('full_name');

    if (error) throw new Error(`Falha ao buscar colaboradores globais: ${error.message}`);
    return (data || []).map(e => ({ id: e.id, name: e.full_name }));
  }

  /** Atualiza as comissões padrão e vínculos de membros da equipe */
  static async updateMembro(id: string, payload: { nome: string; pct_padrao: number; employee_id?: string | null }): Promise<Membro> {
    const { data, error } = await supabase
      .from('equipe')
      .update(payload)
      .eq('id', id)
      .select('id, nome, ativo, pct_padrao, employee_id')
      .single();
    if (error) throw new Error(`Falha ao atualizar comissionado: ${error.message}`);
    return data as Membro;
  }

  /** Liquida/Dá baixa em um recebimento e suas comissões */
  static async liquidateRecebimento(recebimentoId: string, paidDate: string): Promise<void> {
    // Verifica se existe em recebimentos
    const { data: existingRec } = await supabase
      .from('recebimentos')
      .select('id')
      .eq('id', recebimentoId)
      .maybeSingle();

    if (!existingRec) {
      // Se não existe, buscamos os dados da tabela notas_fiscais para criar em recebimentos
      const { data: nf } = await supabase
        .from('notas_fiscais')
        .select('*')
        .eq('id', recebimentoId)
        .single();

      if (nf) {
        const ciclo = nf.competencia || null;
        const recPayload = {
          id: recebimentoId,
          contrato_id: nf.contrato_id,
          data_recebimento: paidDate,
          nota_fiscal: nf.numero_nf || null,
          ciclo,
          mes_ref: ciclo ? parseInt(ciclo.split('-')[1]) : null,
          ano_ref: ciclo ? parseInt(ciclo.split('-')[0]) : null,
          valor_bruto: Number(nf.valor_faturado) || 0,
          valor_liquido: Number(nf.valor_liquido) || 0,
          glosa: Number(nf.valor_retido) || 0,
          impostos: Number(nf.total_impostos) || 0,
          status: 'Pago'
        };

        const { error: insErr } = await supabase
          .from('recebimentos')
          .insert([recPayload]);
        if (insErr) throw new Error(`Falha ao criar faturamento para liquidação: ${insErr.message}`);
      } else {
        throw new Error("Lançamento não encontrado em nenhuma tabela.");
      }
    } else {
      const { error: recErr } = await supabase
        .from('recebimentos')
        .update({ status: 'Pago', data_recebimento: paidDate })
        .eq('id', recebimentoId);
      if (recErr) throw new Error(`Falha ao liquidar faturamento: ${recErr.message}`);
    }

    const { error: comErr } = await supabase
      .from('comissoes')
      .update({ status: 'Pago', paid_date: paidDate })
      .eq('recebimento_id', recebimentoId);
    if (comErr) throw new Error(`Falha ao atualizar comissões: ${comErr.message}`);
  }

  /** Estorna/Reverte a quitação de um recebimento e suas comissões */
  static async revertRecebimento(recebimentoId: string): Promise<void> {
    const { error: recErr } = await supabase
      .from('recebimentos')
      .update({ status: 'Pendente' })
      .eq('id', recebimentoId);
    if (recErr) throw new Error(`Falha ao reverter faturamento: ${recErr.message}`);

    const { error: comErr } = await supabase
      .from('comissoes')
      .update({ status: 'Pendente', paid_date: null })
      .eq('recebimento_id', recebimentoId);
    if (comErr) throw new Error(`Falha ao reverter comissões: ${comErr.message}`);
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function formatDate(date: string): string {
  if (!date) return '—';
  try {
    const [y, m, d] = date.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return '—';
  }
}

export function formatCiclo(ciclo: string | null | undefined): string {
  if (!ciclo) return '—';
  const [ano, mes] = ciclo.split('-');
  return `${mes}/${ano}`;
}
