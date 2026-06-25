/**
 * dre-lancamentos.service.ts
 * ==========================
 * Serviço para a tabela dre_lancamentos.
 *
 * Regras de negócio:
 *  - fonte='omie'   → upsertOmieRows()   — sobrescreve por (empresa+dept+conta+projeto+categoria+periodo)
 *  - fonte='manual' → insertManualRow()  — permanente, nunca sobrescrito pelo Omie
 *
 * O método fetchAllForDashboard() retorna DreRow[] no mesmo formato
 * esperado pelo DreService.calculate() e pelo rawData[] do dashboard.
 */

import { supabase } from '@/lib/supabase';
import { DreRow } from '@/types/dre';

export interface DreLancamento {
  id?: string;
  empresa: string;
  departamento: string;
  conta_dre: string;
  projeto: string;
  categoria: string;
  periodo: string;   // "Jan/24", "Jun/25"
  valor: number;
  fonte: 'omie' | 'manual';
  created_at?: string;
  updated_at?: string;
}

export interface DreManualEntryForm {
  empresa: string;
  departamento: string;
  conta_dre: string;
  projeto: string;
  categoria: string;
  periodo: string;
  valor: number;
}

const TABLE = 'dre_lancamentos';

/** Empresas que só podem ter dados inseridos manualmente */
export const EMPRESAS_MANUAL_ONLY = ['Conectius', 'Ybox'];

/** Todos os períodos suportados (Jan/24 → mai/26), em ordem cronológica */
export const PERIODOS_DISPONIVEIS: string[] = (() => {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const periodos: string[] = [];
  // jan/24 a dez/26
  for (let ano = 24; ano <= 26; ano++) {
    for (let m = 0; m < 12; m++) {
      if (ano === 26 && m > 11) break;
      periodos.push(`${meses[m]}/${String(ano).padStart(2, '0')}`);
    }
  }
  return periodos;
})();

/** Contas DRE e categorias disponíveis para entrada manual */
export const CONTAS_DRE_MANUAL = [
  'Ativos',
  'Custo dos Serviços Prestados',
  'Despesas Administrativas',
  'Despesas Financeiras',
  'Despesas Variáveis',
  'Despesas com Pessoal',
  'Distribuição Lucro',
  'Honorários',
  'Impostos',
  'Juros e devoluções',
  'Outras Receitas',
  'Receita Bruta de Vendas',
  'Receitas Financeiras',
  'Recuperação de Despesas Variáveis',
  'Serviços',
];

export const CATEGORIAS_MANUAL: Record<string, string[]> = {
  'Ativos':                             ['Ativos'],
  'Custo dos Serviços Prestados':       ['Corretiva - B2B', 'Corretiva - B2G', 'Custo dos Serviços Prestados', 'Plano de Saúde', 'Preventiva - B2B', 'Preventiva - B2G'],
  'Despesas Administrativas':           ['Despesas Administrativas'],
  'Despesas Financeiras':               ['Despesas Financeiras'],
  'Despesas Variáveis':                 ['Despesas Variáveis'],
  'Despesas com Pessoal':               ['Despesas com Pessoal'],
  'Distribuição Lucro':                 ['Distribuição Lucro'],
  'Honorários':                         ['Honorários Jurídico'],
  'Impostos':                           ['Impostos', 'Provisão - IRPJ e CSSL Trimestral'],
  'Juros e devoluções':                 ['Juros e devoluções'],
  'Outras Receitas':                    ['Outras Receitas'],
  'Receita Bruta de Vendas':            ['Receita Bruta de Vendas'],
  'Receitas Financeiras':               ['Receitas Financeiras'],
  'Recuperação de Despesas Variáveis':  ['Recuperação de Despesas Variáveis'],
  'Serviços':                           ['Consórcios - a contemplar'],
};

export class DreLancamentosService {
  /**
   * Busca todos os lançamentos e os converte para DreRow[],
   * formato compatível com DreService.calculate() e rawData[] do dashboard.
   *
   * Cada registro (empresa, dept, conta, projeto, categoria, periodo, valor)
   * vira uma entrada no pivotMap e depois é exportado como DreRow com
   * uma chave dinâmica de período.
   */
  static async fetchAllForDashboard(): Promise<{
    rows: DreRow[];
    error: string | null;
  }> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('empresa')
      .order('periodo');

    if (error) {
      console.error('[DreLancamentosService] fetchAll error:', error);
      return { rows: [], error: error.message };
    }

    if (!data || data.length === 0) {
      return { rows: [], error: null };
    }

    // Pivotar: agrupar por chave dimensional, acumular valores por período
    const pivotMap = new Map<
      string,
      {
        Empresa: string;
        Departamento: string;
        ContaDRE: string;
        Projeto: string;
        Categoria: string;
        valores: Record<string, number>;
      }
    >();

    for (const rec of data as DreLancamento[]) {
      const key = `${rec.empresa}|${rec.departamento}|${rec.conta_dre}|${rec.projeto}|${rec.categoria}`;

      if (!pivotMap.has(key)) {
        pivotMap.set(key, {
          Empresa:      rec.empresa,
          Departamento: rec.departamento,
          ContaDRE:     rec.conta_dre,
          Projeto:      rec.projeto,
          Categoria:    rec.categoria,
          valores:      {},
        });
      }

      const item = pivotMap.get(key)!;
      // Normaliza período para o padrão do dashboard (primeira letra maiúscula)
      const periodo = rec.periodo.trim();
      item.valores[periodo] = (item.valores[periodo] || 0) + (rec.valor || 0);
    }

    // Converter para DreRow[]
    const rows: DreRow[] = [];
    for (const item of pivotMap.values()) {
      const row: DreRow = {
        Empresa:      item.Empresa,
        Departamento: item.Departamento,
        ContaDRE:     item.ContaDRE,
        Projeto:      item.Projeto,
        Categoria:    item.Categoria,
      };
      for (const [periodo, valor] of Object.entries(item.valores)) {
        row[periodo] = valor;
      }
      rows.push(row);
    }

    return { rows, error: null };
  }

  /**
   * Retorna todos os lançamentos manuais de uma empresa específica.
   * Usado para exibir na tabela do modal de entrada manual.
   */
  static async fetchManualByEmpresa(empresa: string): Promise<DreLancamento[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('fonte', 'manual')
      .eq('empresa', empresa)
      .order('periodo', { ascending: false });

    if (error) {
      console.error('[DreLancamentosService] fetchManual error:', error);
      return [];
    }
    return (data || []) as DreLancamento[];
  }

  /**
   * Retorna todos os lançamentos manuais (todas as empresas).
   */
  static async fetchAllManual(): Promise<DreLancamento[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('fonte', 'manual')
      .order('empresa')
      .order('periodo', { ascending: false });

    if (error) {
      console.error('[DreLancamentosService] fetchAllManual error:', error);
      return [];
    }
    return (data || []) as DreLancamento[];
  }

  /**
   * Insere um único lançamento manual.
   * Retorna { data, error }.
   */
  static async insertManualRow(
    form: DreManualEntryForm
  ): Promise<{ data: DreLancamento | null; error: string | null }> {
    const record: Omit<DreLancamento, 'id' | 'created_at' | 'updated_at'> = {
      empresa:      form.empresa.trim(),
      departamento: form.departamento.trim(),
      conta_dre:    form.conta_dre.trim(),
      projeto:      form.projeto.trim() || 'N/D',
      categoria:    form.categoria.trim(),
      periodo:      form.periodo.trim(),
      valor:        Math.abs(form.valor),
      fonte:        'manual',
    };

    const { data, error } = await supabase
      .from(TABLE)
      .upsert([record], {
        onConflict: 'empresa,departamento,conta_dre,projeto,categoria,periodo,fonte',
      })
      .select()
      .single();

    if (error) {
      console.error('[DreLancamentosService] insertManual error:', error);
      return { data: null, error: error.message };
    }
    return { data: data as DreLancamento, error: null };
  }

  /**
   * Remove um lançamento manual pelo ID.
   */
  static async deleteManualRow(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id)
      .eq('fonte', 'manual'); // Salvaguarda: nunca deleta registros Omie

    if (error) {
      console.error('[DreLancamentosService] delete error:', error);
      return { error: error.message };
    }
    return { error: null };
  }

  /**
   * Upsert de registros Omie (DreRow[] já pivotados).
   * Apenas sobrescreve registros com fonte='omie'.
   * Registros com fonte='manual' são intocados.
   *
   * Usado pelo handlePublishSnapshot() quando o usuário faz upload do CSV Omie.
   */
  static async upsertOmieRows(rows: DreRow[]): Promise<{
    total: number;
    errors: string[];
  }> {
    const records: Omit<DreLancamento, 'id' | 'created_at' | 'updated_at'>[] = [];
    const mesesPattern = /^[A-Z][a-z]{2}\/\d{2}$/;

    for (const row of rows) {
      const empresa      = (row.Empresa      as string) || '';
      const departamento = (row.Departamento as string) || '';
      const conta_dre    = (row.ContaDRE     as string) || '';
      const projeto      = (row.Projeto      as string) || 'N/D';
      const categoria    = (row.Categoria    as string) || '';

      if (!empresa || !categoria) continue;

      for (const [key, valor] of Object.entries(row)) {
        if (!mesesPattern.test(key)) continue;
        const numVal = typeof valor === 'number' ? valor : parseFloat(String(valor)) || 0;
        if (numVal === 0) continue;

        records.push({
          empresa,
          departamento,
          conta_dre,
          projeto,
          categoria,
          periodo: key,
          valor:   Math.abs(numVal),
          fonte:   'omie',
        });
      }
    }

    if (records.length === 0) {
      return { total: 0, errors: [] };
    }

    const BATCH = 500;
    let total = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const { error } = await supabase
        .from(TABLE)
        .upsert(batch, {
          onConflict: 'empresa,departamento,conta_dre,projeto,categoria,periodo,fonte',
        });

      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      } else {
        total += batch.length;
      }
    }

    return { total, errors };
  }
}
