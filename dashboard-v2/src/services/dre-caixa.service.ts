import { supabase } from '@/lib/supabase';
import {
  DreCaixaLancamento,
  DreCaixaFilters,
  DreCaixaKpiSummary,
  DreCaixaChartData,
  DreCaixaTableSection
} from '@/types/dre-caixa';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const KNOWN_ACCOUNTS: Record<string, string> = {
  '12291364271': 'Clara - Prestadores',
  '7665602672': 'Bradesco - Cartão 8583/2192',
  '7669310486': 'Sicredi - Cartão 0137/0129',
  '7687200485': 'Elo - 9693',
  '7769825595': 'Visa - 6391 BNDS',
  '7918604403': 'Diretoria - 1924',
  '12211377291': 'Omie.CASH - Cartão',
  '7654276902': 'Caixinha Dinheiro',
  '7654276943': 'Omie.CASH',
  '7662736722': 'Bradesco',
  '7662737142': 'PagBank (PagSeguro)',
  '7662738731': 'Banco do Brasil',
  '7662742215': 'Itaú Unibanco',
  '7662747917': 'Sicredi',
  '7670894051': 'Flash - Prestadores',
  '7687296428': 'PagSeguro - Pessoal',
  '7687299201': 'Flash - Funcionários',
  '7701412641': 'Consórcio Contemplado',
  '7721355816': 'Provisão Impostos',
  '7721357315': 'Provisão 13º Salário',
  '7721358027': 'Provisão Férias',
  '7721360080': 'Provisão Contingências',
  '7722457245': 'Investimentos Bradesco',
  '7727306587': 'Banco do Brasil - Investimentos',
  '7769416232': 'Sicredi - Investimentos',
  '7845157479': 'Pri PF - Itaú',
  '7845159602': 'Pri PF - Bradesco',
  '7845161677': 'Pri PF - BB',
  '7845162357': 'Pri PF - Nubank',
  '7845165094': 'Dauren PF - Itaú'
};

export function formatCurrencyBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val || 0);
}

export function normalizeEmpresa(emp: string): string {
  if (!emp) return 'Outras';
  const norm = emp.trim().toUpperCase();
  if (norm.includes('MAR') || norm.includes('MARBRASIL')) return 'Mar Brasil';
  if (norm.includes('DZM')) return 'DZM';
  if (norm.includes('G2') || norm.includes('GRUPO 2')) return 'G2';
  if (norm.includes('CONECTIUS')) return 'Conectius';
  if (norm.includes('YBOX')) return 'Ybox';
  return emp.trim();
}

function parsePeriodoFromDate(dateStr: string): { periodo: string; periodoNum: number } {
  if (!dateStr) return { periodo: 'N/A', periodoNum: 0 };
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      const shortYear = String(year).slice(-2);
      const mName = MONTH_NAMES[month - 1];
      return {
        periodo: `${mName}/${shortYear}`,
        periodoNum: year * 12 + month
      };
    }
  }
  return { periodo: 'N/A', periodoNum: 0 };
}

export class DreCaixaService {
  /**
   * Carrega os lançamentos efetivamente realizados (pagos/recebidos) da tabela omie_financas_unificado
   */
  static async fetchLancamentos(): Promise<{
    lancamentos: DreCaixaLancamento[];
    error: string | null;
  }> {
    try {
      let allRecords: any[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      // Buscar fornecedores para resolução adicional se necessário
      const { data: fornData } = await supabase
        .from('omie_dim_fornecedores')
        .select('codigo_cliente_omie,nome_fantasia,razao_social,empresa_nome');

      const fornMap = new Map<string, string>();
      (fornData || []).forEach(f => {
        const key = `${String(f.empresa_nome || '').trim()}-${String(f.codigo_cliente_omie)}`;
        const nome = f.nome_fantasia || f.razao_social;
        if (nome) fornMap.set(key, nome);
      });

      while (hasMore) {
        const { data, error } = await supabase
          .from('omie_financas_unificado')
          .select('id, empresa_nome, omie_id, tipo_registro, status, valor_total, valor_alocado, data_pagamento, projeto_nome, departamento_nome, categoria_codigo, categoria_nome, cliente_fornecedor, numero_documento, raw_data')
          .not('data_pagamento', 'is', null)
          .gte('data_pagamento', '2025-06-01') // Trava mandatória: Omie utilizado apenas a partir de Junho/2025
          .neq('status', 'CANCELADO')
          .order('data_pagamento', { ascending: false })
          .range(from, from + limit - 1);

        if (error) {
          console.error('[DreCaixaService] Erro ao buscar lançamentos:', error);
          return { lancamentos: [], error: error.message };
        }

        if (data && data.length > 0) {
          allRecords = allRecords.concat(data);
          from += limit;
          if (data.length < limit) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      // Filtro de Transferências e Deduplicação Inteligente
      // 1. Identificar títulos CP/CR já contemplados para não duplicar com MOVIMENTO
      const knownTitleIds = new Set<string>();
      allRecords.forEach(item => {
        if ((item.tipo_registro === 'PAGAR' || item.tipo_registro === 'RECEBER') && item.omie_id) {
          knownTitleIds.add(`${String(item.empresa_nome || '').trim()}-${item.omie_id}`);
        }
      });

      // Mapeamento e normalização (com blindagem adicional >= 2025-06-01)
      const lancamentos: DreCaixaLancamento[] = [];

      allRecords.forEach(item => {
        if (!item.data_pagamento || item.data_pagamento < '2025-06-01') return;

        const raw = item.raw_data || {};
        const rawDet = raw.detalhes || {};
        const catCodigo = String(item.categoria_codigo || rawDet.cCodCateg || '').trim();
        const catNome = String(item.categoria_nome || '').trim();
        const catNomeLower = catNome.toLowerCase();
        const cOrigem = String(rawDet.cOrigem || '').toUpperCase();
        const cGrupo = String(rawDet.cGrupo || '').toUpperCase();
        const obs = String(rawDet.observacao || '').toLowerCase();

        // 1. REGRA: DESCONSIDERAR TRANSFERÊNCIAS
        // Filtra qualquer categoria iniciada por '0.' (ex: 0.01, 0.01.01), origens de transferência ou descrições
        const isTransferencia = 
          catCodigo.startsWith('0.') ||
          catCodigo === '0.01' ||
          catNomeLower.includes('transferência') ||
          catNomeLower.includes('transferencia') ||
          cOrigem.includes('TRF') ||
          cOrigem.includes('TRANSF') ||
          cOrigem === 'TRAR' ||
          cOrigem === 'TRAP' ||
          cGrupo.includes('TRANSF') ||
          obs.includes('transferência pix') ||
          obs.includes('transferencia pix') ||
          obs.includes('transferência entre contas') ||
          obs.includes('transferencia entre contas');

        if (isTransferencia) return;

        // 2. REGRA DE DEDUPLICAÇÃO:
        // Se for MOVIMENTO bancário referente a um título (nCodTitulo) que já existe como PAGAR/RECEBER, ignorar o movimento duplicado
        const nCodTitulo = rawDet.nCodTitulo ? String(rawDet.nCodTitulo) : null;
        if (item.tipo_registro === 'MOVIMENTO' && nCodTitulo && nCodTitulo !== '0') {
          const titleKey = `${String(item.empresa_nome || '').trim()}-${nCodTitulo}`;
          if (knownTitleIds.has(titleKey)) {
            return; // Já computado via Conta a Pagar / Receber com detalhes completos
          }
        }

        // Resolução da Conta Corrente
        const idCC = String(raw.id_conta_corrente || rawDet.nCodCC || rawDet.cContaCorrente || '');
        let contaCorrente = KNOWN_ACCOUNTS[idCC] || rawDet.cContaCorrente || raw.cContaCorrente || 'Conta Principal';
        if (!idCC || idCC === 'null' || idCC === 'undefined') {
          contaCorrente = item.tipo_registro === 'MOVIMENTO' ? 'Extrato Bancário' : 'Conta Operacional';
        }

        // Resolução do Fornecedor / Cliente
        const codigoCF = String(raw.codigo_cliente_fornecedor || rawDet.nCodCliente || '');
        const fornKey = `${String(item.empresa_nome || '').trim()}-${codigoCF}`;
        const fornFromDim = fornMap.get(fornKey);
        const fornFinal = (item.cliente_fornecedor && item.cliente_fornecedor !== 'N/D' && item.cliente_fornecedor !== 'Sem Fornecedor')
          ? item.cliente_fornecedor
          : fornFromDim || raw.nm_cliente || raw.nome_cliente || rawDet.cNomeCliente || 'Outros / Operacional';

        const { periodo, periodoNum } = parsePeriodoFromDate(item.data_pagamento);

        // 3. REGRA: IDENTIFICAÇÃO CORRETA DE ENTRADA (RECEITA) VS SAÍDA (PAGAMENTO)
        // Garante que receitas NUNCA entrem como despesas
        const cNat = String(rawDet.cNatureza || '').toUpperCase();
        let isEntrada = false;

        if (item.tipo_registro === 'RECEBER') {
          isEntrada = true;
        } else if (cNat === 'R' || cGrupo.includes('REC') || cGrupo === 'CONTA_A_RECEBER' || cGrupo === 'CONTA_CORRENTE_REC') {
          isEntrada = true;
        } else if (catCodigo.startsWith('1.') || catNomeLower.includes('receita') || catNomeLower.includes('serviços prestados') || catNomeLower.includes('faturamento') || catNomeLower.includes('venda de')) {
          isEntrada = true;
        } else if (item.tipo_registro === 'MOVIMENTO' && Number(item.valor_total) > 0) {
          isEntrada = true;
        }

        const valTotal = Math.abs(Number(item.valor_alocado || item.valor_total || 0));
        const tipoFinal = isEntrada ? 'RECEBER' : 'PAGAR';
        const sinal = isEntrada ? 1 : -1;

        // Projeto como Setor (com fallback)
        let projeto = (item.projeto_nome || '').trim();
        if (!projeto || projeto.toLowerCase() === 'sem projeto' || projeto.toLowerCase() === 'não informado') {
          projeto = (item.departamento_nome && item.departamento_nome !== 'Sem Departamento')
            ? item.departamento_nome.trim()
            : 'Administrativo / Geral';
        }

        // Categoria
        const categoria = (item.categoria_nome || 'Despesas Gerais').trim();

        lancamentos.push({
          id: item.id,
          empresa: normalizeEmpresa(item.empresa_nome),
          omie_id: item.omie_id ? Number(item.omie_id) : null,
          tipo: tipoFinal,
          status: item.status || 'PAGO',
          valor: valTotal,
          sinal_valor: valTotal * sinal,
          data_pagamento: item.data_pagamento,
          periodo,
          periodoNum,
          projeto,
          categoria,
          conta_dre: item.dre_conta_nome || undefined,
          fornecedor_cliente: fornFinal,
          conta_corrente: contaCorrente,
          numero_documento: item.numero_documento || null
        });
      });

      return { lancamentos, error: null };
    } catch (err: any) {
      console.error('[DreCaixaService] Exceção:', err);
      return { lancamentos: [], error: err.message || 'Erro inesperado' };
    }
  }

  /**
   * Extrai opções de filtros dinamicamente
   */
  static extractFilterOptions(lancamentos: DreCaixaLancamento[]) {
    const empresasSet = new Set<string>();
    const periodosMap = new Map<string, number>();
    const projetosSet = new Set<string>();
    const categoriasSet = new Set<string>();
    const fornecedoresSet = new Set<string>();
    const contasCorrentesSet = new Set<string>();

    lancamentos.forEach(l => {
      if (l.empresa) empresasSet.add(l.empresa);
      if (l.periodo && l.periodo !== 'N/A') periodosMap.set(l.periodo, l.periodoNum);
      if (l.projeto) projetosSet.add(l.projeto);
      if (l.categoria) categoriasSet.add(l.categoria);
      if (l.fornecedor_cliente) fornecedoresSet.add(l.fornecedor_cliente);
      if (l.conta_corrente) contasCorrentesSet.add(l.conta_corrente);
    });

    const periodosSorted = Array.from(periodosMap.entries())
      .sort((a, b) => b[1] - a[1]) // mais recentes primeiro por padrão
      .map(entry => entry[0]);

    return {
      empresas: Array.from(empresasSet).sort(),
      periodos: periodosSorted,
      projetos: Array.from(projetosSet).sort(),
      categorias: Array.from(categoriasSet).sort(),
      fornecedores: Array.from(fornecedoresSet).sort(),
      contasCorrentes: Array.from(contasCorrentesSet).sort()
    };
  }

  /**
   * Filtra lançamentos com base nos filtros selecionados (com normalização estrita de strings)
   */
  static applyFilters(
    lancamentos: DreCaixaLancamento[],
    filters: DreCaixaFilters
  ): DreCaixaLancamento[] {
    const lowerEmpresas = (filters.empresas || []).map(e => e.trim().toLowerCase());
    const filterPeriodos = filters.periodos || [];
    const filterProjetos = filters.projetos || [];
    const filterCategorias = filters.categorias || [];
    const filterFornecedores = filters.fornecedores || [];
    const filterContas = filters.contasCorrentes || [];
    const searchQuery = (filters.search || '').trim().toLowerCase();

    return lancamentos.filter(l => {
      // 1. Filtro de Empresa com normalização insensível a maiúsculas/minúsculas
      if (lowerEmpresas.length > 0) {
        const itemEmp = (l.empresa || '').trim().toLowerCase();
        if (!lowerEmpresas.includes(itemEmp)) return false;
      }

      // 2. Filtro de Período
      if (filterPeriodos.length > 0 && !filterPeriodos.includes(l.periodo)) return false;

      // 3. Filtro de Projeto / Setor
      if (filterProjetos.length > 0 && !filterProjetos.includes(l.projeto)) return false;

      // 4. Filtro de Categoria
      if (filterCategorias.length > 0 && !filterCategorias.includes(l.categoria)) return false;

      // 5. Filtro de Fornecedor / Cliente
      if (filterFornecedores.length > 0 && !filterFornecedores.includes(l.fornecedor_cliente)) return false;

      // 6. Filtro de Conta Corrente
      if (filterContas.length > 0 && !filterContas.includes(l.conta_corrente)) return false;

      // 7. Busca Textual Livre
      if (searchQuery) {
        const matchForn = l.fornecedor_cliente.toLowerCase().includes(searchQuery);
        const matchCat = l.categoria.toLowerCase().includes(searchQuery);
        const matchProj = l.projeto.toLowerCase().includes(searchQuery);
        const matchConta = l.conta_corrente.toLowerCase().includes(searchQuery);
        const matchDoc = l.numero_documento ? l.numero_documento.toLowerCase().includes(searchQuery) : false;
        if (!matchForn && !matchCat && !matchProj && !matchConta && !matchDoc) return false;
      }

      return true;
    });
  }

  /**
   * Calcula KPIs Executivos
   */
  static calculateKpis(filtered: DreCaixaLancamento[]): DreCaixaKpiSummary {
    let totalPago = 0;
    let totalRecebido = 0;
    const setorMap: Record<string, number> = {};
    const mesesDistintos = new Set<string>();

    filtered.forEach(l => {
      if (l.periodo && l.periodo !== 'N/A') mesesDistintos.add(l.periodo);
      if (l.tipo === 'RECEBER') {
        totalRecebido += l.valor;
      } else {
        totalPago += l.valor;
        setorMap[l.projeto] = (setorMap[l.projeto] || 0) + l.valor;
      }
    });

    const resultadoLiquido = totalRecebido - totalPago;
    const qtdMeses = Math.max(1, mesesDistintos.size);
    const mediaMensalDespesas = totalPago / qtdMeses;

    let maiorSetorNome = 'Nenhum';
    let maiorSetorValor = 0;
    Object.entries(setorMap).forEach(([nome, val]) => {
      if (val > maiorSetorValor) {
        maiorSetorValor = val;
        maiorSetorNome = nome;
      }
    });

    return {
      totalPago,
      totalRecebido,
      resultadoLiquido,
      mediaMensalDespesas,
      maiorSetor: { nome: maiorSetorNome, valor: maiorSetorValor },
      totalLancamentos: filtered.length
    };
  }

  /**
   * Prepara conjuntos de dados para os gráficos
   */
  static prepareChartsData(
    filtered: DreCaixaLancamento[],
    orderedPeriods: string[]
  ): DreCaixaChartData {
    // 1. Linha temporal mensal (ordenada cronologicamente para a curva de gráfico)
    const monthSet = new Set<string>();
    filtered.forEach(l => {
      if (l.periodo && l.periodo !== 'N/A') monthSet.add(l.periodo);
    });

    // Ordenar cronologicamente crescente
    const meses = Array.from(monthSet).sort((a, b) => {
      const getNum = (str: string) => {
        const [m, y] = str.split('/');
        return (parseInt(y, 10) + 2000) * 12 + MONTH_NAMES.indexOf(m);
      };
      return getNum(a) - getNum(b);
    });

    const entradasMap: Record<string, number> = {};
    const saidasMap: Record<string, number> = {};

    meses.forEach(m => {
      entradasMap[m] = 0;
      saidasMap[m] = 0;
    });

    const setorDespesasMap: Record<string, number> = {};
    const categoriaDespesasMap: Record<string, number> = {};
    const fornecedorDespesasMap: Record<string, number> = {};
    const contaCorrenteMap: Record<string, number> = {};
    let totalDespesasGerais = 0;

    filtered.forEach(l => {
      if (l.tipo === 'RECEBER') {
        if (entradasMap[l.periodo] !== undefined) {
          entradasMap[l.periodo] += l.valor;
        }
      } else {
        if (saidasMap[l.periodo] !== undefined) {
          saidasMap[l.periodo] += l.valor;
        }
        totalDespesasGerais += l.valor;
        setorDespesasMap[l.projeto] = (setorDespesasMap[l.projeto] || 0) + l.valor;
        categoriaDespesasMap[l.categoria] = (categoriaDespesasMap[l.categoria] || 0) + l.valor;
        fornecedorDespesasMap[l.fornecedor_cliente] = (fornecedorDespesasMap[l.fornecedor_cliente] || 0) + l.valor;
        contaCorrenteMap[l.conta_corrente] = (contaCorrenteMap[l.conta_corrente] || 0) + l.valor;
      }
    });

    const entradasPorMes = meses.map(m => entradasMap[m] || 0);
    const saidasPorMes = meses.map(m => saidasMap[m] || 0);
    const saldoPorMes = meses.map((m, idx) => entradasPorMes[idx] - saidasPorMes[idx]);

    // Despesas por Setor (ordenadas)
    const despesasPorSetor = Object.entries(setorDespesasMap)
      .map(([setor, valor]) => ({
        setor,
        valor,
        percentual: totalDespesasGerais > 0 ? (valor / totalDespesasGerais) * 100 : 0
      }))
      .sort((a, b) => b.valor - a.valor);

    // Despesas por Categoria (Top 10 + Outros)
    const allCategorias = Object.entries(categoriaDespesasMap)
      .map(([categoria, valor]) => ({
        categoria,
        valor,
        percentual: totalDespesasGerais > 0 ? (valor / totalDespesasGerais) * 100 : 0
      }))
      .sort((a, b) => b.valor - a.valor);

    const top10Categorias = allCategorias.slice(0, 9);
    if (allCategorias.length > 9) {
      const outrosValor = allCategorias.slice(9).reduce((acc, curr) => acc + curr.valor, 0);
      top10Categorias.push({
        categoria: 'Demais Categorias',
        valor: outrosValor,
        percentual: totalDespesasGerais > 0 ? (outrosValor / totalDespesasGerais) * 100 : 0
      });
    }

    // Top Fornecedores
    const topFornecedores = Object.entries(fornecedorDespesasMap)
      .map(([fornecedor, valor]) => ({
        fornecedor,
        valor,
        percentual: totalDespesasGerais > 0 ? (valor / totalDespesasGerais) * 100 : 0
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    // Saídas por Conta Corrente
    const saidasPorContaCorrente = Object.entries(contaCorrenteMap)
      .map(([conta, valor]) => ({
        conta,
        valor,
        percentual: totalDespesasGerais > 0 ? (valor / totalDespesasGerais) * 100 : 0
      }))
      .sort((a, b) => b.valor - a.valor);

    return {
      meses,
      entradasPorMes,
      saidasPorMes,
      saldoPorMes,
      despesasPorSetor,
      despesasPorCategoria: top10Categorias,
      topFornecedores,
      saidasPorContaCorrente
    };
  }

  /**
   * Constrói a estrutura da Tabela DRE-Caixa
   */
  static buildDreTableSections(
    filtered: DreCaixaLancamento[],
    mesesColunas: string[]
  ): DreCaixaTableSection[] {
    const entradasValores: Record<string, number> = {};
    const custosValores: Record<string, number> = {};
    const despesasOpValores: Record<string, number> = {};
    const resultadoValores: Record<string, number> = {};

    mesesColunas.forEach(m => {
      entradasValores[m] = 0;
      custosValores[m] = 0;
      despesasOpValores[m] = 0;
      resultadoValores[m] = 0;
    });

    // Subdivisões por macro categorias ou setores
    const subCustosMap: Record<string, Record<string, number>> = {};
    const subDespesasMap: Record<string, Record<string, number>> = {};

    filtered.forEach(l => {
      const mes = l.periodo;
      if (!mes || entradasValores[mes] === undefined) return;

      const catLower = l.categoria.toLowerCase();
      const isReceita = l.tipo === 'RECEBER' || catLower.includes('receita') || catLower.includes('faturamento') || catLower.includes('venda de');

      if (isReceita) {
        entradasValores[mes] += l.valor;
      } else {
        const isCusto = catLower.includes('custo') || catLower.includes('insumo') || catLower.includes('prestador') || catLower.includes('serviço prestado') || catLower.includes('combustível') || catLower.includes('preventiva') || catLower.includes('corretiva');

        if (isCusto) {
          custosValores[mes] += l.valor;
          if (!subCustosMap[l.categoria]) {
            subCustosMap[l.categoria] = {};
            mesesColunas.forEach(m => { subCustosMap[l.categoria][m] = 0; });
          }
          subCustosMap[l.categoria][mes] += l.valor;
        } else {
          despesasOpValores[mes] += l.valor;
          if (!subDespesasMap[l.categoria]) {
            subDespesasMap[l.categoria] = {};
            mesesColunas.forEach(m => { subDespesasMap[l.categoria][m] = 0; });
          }
          subDespesasMap[l.categoria][mes] += l.valor;
        }
      }
    });

    mesesColunas.forEach(m => {
      resultadoValores[m] = (entradasValores[m] || 0) - (custosValores[m] || 0) - (despesasOpValores[m] || 0);
    });

    const sumValues = (record: Record<string, number>) => Object.values(record).reduce((a, b) => a + b, 0);

    const sections: DreCaixaTableSection[] = [
      {
        grupo: '(+) Entradas Efetivamente Recebidas',
        tipo: 'entrada',
        valoresPorMes: entradasValores,
        totalPeriodo: sumValues(entradasValores)
      },
      {
        grupo: '(-) Custos Operacionais Pagos',
        tipo: 'custo',
        valoresPorMes: custosValores,
        totalPeriodo: sumValues(custosValores),
        subItens: Object.entries(subCustosMap)
          .map(([desc, vals]) => ({
            descricao: desc,
            valoresPorMes: vals,
            totalPeriodo: sumValues(vals)
          }))
          .sort((a, b) => b.totalPeriodo - a.totalPeriodo)
      },
      {
        grupo: '(-) Despesas Administrativas & Pessoal Pagas',
        tipo: 'despesa',
        valoresPorMes: despesasOpValores,
        totalPeriodo: sumValues(despesasOpValores),
        subItens: Object.entries(subDespesasMap)
          .map(([desc, vals]) => ({
            descricao: desc,
            valoresPorMes: vals,
            totalPeriodo: sumValues(vals)
          }))
          .sort((a, b) => b.totalPeriodo - a.totalPeriodo)
      },
      {
        grupo: '(=) Resultado Líquido Corrente do Caixa',
        tipo: 'resultado',
        valoresPorMes: resultadoValores,
        totalPeriodo: sumValues(resultadoValores)
      }
    ];

    return sections;
  }
}
