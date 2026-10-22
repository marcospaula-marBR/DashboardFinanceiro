import { supabase } from '@/lib/supabase';
import {
  RegimeTipo,
  DrePainelLancamento,
  DrePainelFilters,
  DrePainelKpis,
  DrePainelTableSection,
  DrePainelRateio
} from '@/types/dre-painel';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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

export function normalizeProjectName(name: string): string {
  if (!name) return name;
  const trimmed = name.trim();
  if (/casa\s*tupi(\s*771)?/i.test(trimmed)) {
    return 'Núcleo Jurídico';
  }
  return trimmed;
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&agrave;/gi, 'à')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&acirc;/gi, 'â')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&uuml;/gi, 'ü')
    .trim();
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

export function isDespesaRecorrente(categoria: string, contaDre?: string, fornecedor?: string): boolean {
  const cat = (categoria || '').toLowerCase();
  const dre = (contaDre || '').toLowerCase();
  const forn = (fornecedor || '').toLowerCase();
  const str = `${cat} ${dre} ${forn}`;

  if (
    str.includes('salário') || str.includes('salario') ||
    str.includes('ordenado') ||
    str.includes('pró-labore') || str.includes('pro-labore') || str.includes('prolabore') ||
    str.includes('rescis') ||
    str.includes('férias') || str.includes('ferias') ||
    str.includes('13º') || str.includes('décimo terceiro') || str.includes('decimo terceiro') ||
    str.includes('fgts') ||
    str.includes('inss') ||
    str.includes('gps') ||
    str.includes('vale transporte') ||
    str.includes('vale refeição') || str.includes('vale refeicao') ||
    str.includes('vale alimentação') || str.includes('vale alimentacao') ||
    str.includes('plano de saúde') || str.includes('plano de saude') ||
    str.includes('seguro de vida') ||
    str.includes('medicina do trabalho')
  ) {
    return true;
  }

  if (
    str.includes('aluguel') || str.includes('locação de imóvel') || str.includes('locacao de imovel') ||
    str.includes('condomínio') || str.includes('condominio') ||
    str.includes('energia elétrica') || str.includes('energia eletrica') ||
    str.includes('água e esgoto') || str.includes('agua e esgoto') ||
    str.includes('iptu') ||
    str.includes('telefonia') || str.includes('internet')
  ) {
    return true;
  }

  if (
    str.includes('contabilidade') || str.includes('honorários') || str.includes('honorarios') ||
    str.includes('licença de software') || str.includes('aluguel de software')
  ) {
    return true;
  }

  return false;
}

export class DrePainelService {
  /**
   * Carrega os lançamentos unificados respeitando:
   * 1. Travas temporais:
   *    - Mar Brasil, DZM, G2: Omie >= 2025-06-01 | Histórico < 2025-06-01
   *    - Conectius: Omie >= 2026-07-01 | Histórico < 2026-07-01
   *    - Ybox: 100% Histórico congelado
   * 2. Regime selecionado:
   *    - COMPETENCIA: data_registro/emissao, PROVISÕES ATIVAS, extrato direto (nCodTitulo == 0)
   *    - CAIXA: data_pagamento efetiva
   *    - PREVISAO: data_vencimento/previsao, status a vencer/aberto
   */
  static async fetchLancamentos(regime: RegimeTipo): Promise<{
    lancamentos: DrePainelLancamento[];
    error: string | null;
  }> {
    try {
      // 1. Carregar mapa de Fornecedores / Clientes
      const fornMap = new Map<string, string>();
      const fornMapByCode = new Map<string, string>();
      let fornFrom = 0;
      const fornLimit = 1000;
      let hasMoreForn = true;

      while (hasMoreForn) {
        const { data: fornData } = await supabase
          .from('omie_dim_fornecedores')
          .select('codigo_cliente_omie,nome_fantasia,razao_social,empresa_nome')
          .range(fornFrom, fornFrom + fornLimit - 1);

        if (!fornData || fornData.length === 0) {
          hasMoreForn = false;
        } else {
          fornData.forEach(f => {
            const nome = decodeHtmlEntities(f.nome_fantasia || f.razao_social || '');
            const cod = String(f.codigo_cliente_omie || '').trim();
            const empKey = `${String(f.empresa_nome || '').trim()}-${cod}`;
            if (nome) {
              if (cod) {
                fornMap.set(empKey, nome);
                fornMapByCode.set(cod, nome);
              }
            }
          });
          fornFrom += fornLimit;
          if (fornData.length < fornLimit) hasMoreForn = false;
        }
      }

      // 2. Carregar mapa de Projetos
      const projMap = new Map<string, string>();
      try {
        const { data: projData } = await supabase
          .from('omie_dim_projetos')
          .select('codigo_projeto, descricao_projeto, empresa_nome');

        if (projData) {
          projData.forEach((p: any) => {
            const cod = String(p.codigo_projeto || '').trim();
            const desc = normalizeProjectName(decodeHtmlEntities(p.descricao_projeto || ''));
            const emp = String(p.empresa_nome || '').trim();
            if (cod && desc) {
              projMap.set(cod, desc);
              if (emp) projMap.set(`${emp}-${cod}`, desc);
            }
          });
        }
      } catch (e) {
        console.warn('[DrePainelService] Aviso ao carregar projetos dim:', e);
      }

      // 3. Carregar De-Para de Categorias para Contas DRE do Snapshot
      const catToConta = new Map<string, string>();
      let snapRows: any[] = [];
      try {
        const { data: snapData } = await supabase
          .from('dre_snapshots')
          .select('raw_data')
          .order('created_at', { ascending: false })
          .limit(1);

        if (snapData && snapData.length > 0 && Array.isArray(snapData[0].raw_data)) {
          snapRows = snapData[0].raw_data;
          snapRows.forEach((r: any) => {
            const cat = (r.Categoria || '').trim().toLowerCase();
            const conta = (r.ContaDRE || '').trim();
            if (cat && conta && !catToConta.has(cat)) {
              catToConta.set(cat, conta);
            }
          });
        }
      } catch (e) {
        console.warn('[DrePainelService] Erro ao carregar snapshot para De-Para:', e);
      }

      // 4. Carregar registros do Omie a partir da tabela omie_financas_unificado
      let allRecords: any[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      // Trava temporal mínima no banco: Omie iniciou em Junho/2025
      let query = supabase
        .from('omie_financas_unificado')
        .select('id, empresa_nome, omie_id, tipo_registro, status, valor_total, valor_alocado, data_pagamento, data_vencimento, data_emissao, data_previsao, data_registro, projeto_nome, departamento_nome, categoria_codigo, categoria_nome, cliente_fornecedor, numero_documento, raw_data')
        .neq('status', 'CANCELADO');

      if (regime === 'CAIXA') {
        query = query.not('data_pagamento', 'is', null).gte('data_pagamento', '2025-06-01');
      } else if (regime === 'COMPETENCIA') {
        query = query.or('data_registro.gte.2025-06-01,data_emissao.gte.2025-06-01');
      } else {
        // PREVISAO: vencimentos futuros ou em aberto
        query = query.or('data_vencimento.gte.2025-06-01,data_previsao.gte.2025-06-01');
      }

      while (hasMore) {
        const { data, error } = await query
          .order('data_registro', { ascending: false })
          .range(from, from + limit - 1);

        if (error) {
          console.error('[DrePainelService] Erro ao buscar dados do Omie:', error);
          break;
        }

        if (data && data.length > 0) {
          allRecords = allRecords.concat(data);
          from += limit;
          if (data.length < limit) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      const lancamentos: DrePainelLancamento[] = [];
      const todayStr = new Date().toISOString().slice(0, 10);

      // 5. Processamento dos registros Omie com travas temporais e regras contábeis
      allRecords.forEach(item => {
        const emp = normalizeEmpresa(item.empresa_nome);
        if (emp === 'Ybox') return; // Ybox é tratada 100% pelo histórico por enquanto

        const dtCompetencia = item.data_registro || item.data_emissao || item.data_vencimento || '';
        const dtCaixa = item.data_pagamento || null;
        const dtVenc = item.data_vencimento || null;
        const dtPrev = item.data_previsao || dtVenc;

        // APLICAÇÃO MANDATÓRIA DO MARCO TEMPORAL:
        // - Conectius: Omie somente >= 2026-07-01
        // - Mar Brasil, DZM, G2: Omie somente >= 2025-06-01
        if (emp === 'Conectius') {
          if (regime === 'CAIXA' && (!dtCaixa || dtCaixa < '2026-07-01')) return;
          if (regime === 'COMPETENCIA' && (!dtCompetencia || dtCompetencia < '2026-07-01')) return;
          if (regime === 'PREVISAO' && (!dtVenc || dtVenc < '2026-07-01')) return;
        } else {
          if (regime === 'CAIXA' && (!dtCaixa || dtCaixa < '2025-06-01')) return;
          if (regime === 'COMPETENCIA' && (!dtCompetencia || dtCompetencia < '2025-06-01')) return;
          if (regime === 'PREVISAO' && (!dtVenc || dtVenc < '2025-06-01')) return;
        }

        const raw = item.raw_data || {};
        const rawDet = raw.detalhes || {};
        const catCodigo = String(item.categoria_codigo || rawDet.cCodCateg || '').trim();
        const catNome = decodeHtmlEntities(String(item.categoria_nome || rawDet.cDesCateg || '')).trim();
        const catNomeLow = catNome.toLowerCase();

        // 1. REGRA: DESCONSIDERAR TRANSFERÊNCIAS INTERNAS
        if (
          catCodigo.startsWith('0.') ||
          catCodigo === '0.01' ||
          catNomeLow.includes('transferência') ||
          catNomeLow.includes('transferencia')
        ) {
          return;
        }

        // 2. REGRA: DESCONSIDERAR MÚTUO INTERCOMPANY
        if (
          catCodigo === '1.01.95' ||
          catNomeLow.includes('créditos mar brasil') ||
          catNomeLow.includes('creditos mar brasil')
        ) {
          return;
        }

        // 3. REGRA: NEUTRALIZAR RECARGA DE CARTÃO CORPORATIVO (CLARA)
        // Evita duplicar compras feitas com o cartão já lançadas nas categorias finais
        if (
          catCodigo === '2.04.99' ||
          catNomeLow.includes('recarga de cartão') ||
          catNomeLow.includes('recarga de cartao')
        ) {
          return;
        }

        // 4. REGRA: EXTRATO BANCÁRIO DIRETO (nCodTitulo == 0)
        // Se for movimento de extrato e tiver nCodTitulo !== 0, é liquidação de título e não deve duplicar
        const nCodTitulo = Number(rawDet.nCodTitulo || 0);
        const grp = String(rawDet.cGrupo || '').toUpperCase();
        if (nCodTitulo !== 0 && (grp === 'CONTA_CORRENTE_PAG' || grp === 'CONTA_CORRENTE_REC' || grp === 'CONTA_A_PAGAR' || grp === 'CONTA_A_RECEBER')) {
          if (item.tipo_registro === 'MOVIMENTO') return;
        }

        // 5. REGRA: PROVISÕES
        const isProvisao =
          catCodigo.startsWith('1.01.9') ||
          catNomeLow.includes('provisão') ||
          catNomeLow.includes('provisao');

        // No regime de CAIXA, provisões não pagas não entram
        if (regime === 'CAIXA' && isProvisao && !dtCaixa) return;

        // No regime de PREVISÃO, apenas o que estiver a vencer ou aberto
        if (regime === 'PREVISAO' && item.status === 'PAGO') return;

        // Determinar Conta DRE
        let contaDre = catToConta.get(catNomeLow) || '';
        if (!contaDre) {
          if (item.tipo_registro === 'RECEBER' || catCodigo.startsWith('1.01')) {
            contaDre = 'Receita Bruta de Vendas';
          } else if (catCodigo.startsWith('1.02') || catCodigo.startsWith('1.03')) {
            contaDre = 'Outras Receitas';
          } else if (catCodigo.startsWith('2.05')) {
            contaDre = 'Despesas Financeiras';
          } else if (catCodigo.startsWith('2.07')) {
            contaDre = 'Ativos';
          } else if (catNomeLow.includes('salário') || catNomeLow.includes('folha') || catNomeLow.includes('inss')) {
            contaDre = 'Despesas com Pessoal';
          } else {
            contaDre = 'Despesas Administrativas';
          }
        }

        // Valor e Sinal
        const valorAlocado = Number(item.valor_alocado || item.valor_total || 0);
        const valorAbs = Math.abs(valorAlocado);
        const isReceita = item.tipo_registro === 'RECEBER' || (item.tipo_registro === 'MOVIMENTO' && rawDet.cNatureza === 'R');
        const sinalValor = isReceita ? valorAbs : -valorAbs;

        // Data de apuração base do Regime
        let dateForPeriod = dtCompetencia;
        if (regime === 'CAIXA') dateForPeriod = dtCaixa || dtCompetencia;
        if (regime === 'PREVISAO') dateForPeriod = dtVenc || dtPrev || dtCompetencia;

        const { periodo, periodoNum } = parsePeriodoFromDate(dateForPeriod);

        // Parcelamento granular
        const numParcela = String(raw.numero_parcela || rawDet.cNumParc || '').trim();
        let parcelaAtual = 1;
        let totalParcelas = 1;
        if (numParcela && numParcela.includes('/')) {
          const pParts = numParcela.split('/');
          parcelaAtual = parseInt(pParts[0], 10) || 1;
          totalParcelas = parseInt(pParts[1], 10) || 1;
        }

        const isParcelado = totalParcelas > 1;
        const isParcelaAnterior = isParcelado && parcelaAtual > 1;
        const isLongoPrazo = isParcelado && totalParcelas > 12;

        // Atraso
        let isEmAtraso = false;
        let diasAtraso = 0;
        if (item.status !== 'PAGO' && dtVenc && dtVenc < todayStr) {
          isEmAtraso = true;
          const diffMs = new Date(todayStr).getTime() - new Date(dtVenc).getTime();
          diasAtraso = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }

        // Fornecedor / Cliente
        let fornNome = decodeHtmlEntities(String(item.cliente_fornecedor || '')).trim();
        const codForn = String(raw.codigo_cliente_fornecedor || rawDet.nCodPessoa || '').trim();
        if (!fornNome || fornNome === 'não informado' || fornNome === 'Sem Fornecedor') {
          if (codForn && fornMapByCode.has(codForn)) {
            fornNome = fornMapByCode.get(codForn)!;
          } else if (rawDet.cNomPessoa) {
            fornNome = decodeHtmlEntities(rawDet.cNomPessoa);
          }
        }

        // Projeto
        let projNome = normalizeProjectName(decodeHtmlEntities(String(item.projeto_nome || '')).trim());
        const codProj = String(raw.codigo_projeto || rawDet.nCodProjeto || '').trim();
        if ((!projNome || projNome === 'Sem Projeto') && codProj && projMap.has(codProj)) {
          projNome = projMap.get(codProj)!;
        }

        // Rateios por Departamento
        const rateios: DrePainelRateio[] = [];
        const rawDist = raw.distribuicao || [];
        if (Array.isArray(rawDist) && rawDist.length > 0) {
          rawDist.forEach((d: any) => {
            const dNome = decodeHtmlEntities(String(d.cDesDep || d.nome || '')).trim();
            const dVal = Math.abs(Number(d.nValDep || d.valor || 0));
            const dPer = Number(d.nPerDep || d.percentual || 0);
            if (dNome && dVal > 0) {
              rateios.push({ departamento: dNome, valor: dVal, percentual: dPer });
            }
          });
        }

        lancamentos.push({
          id: `live-${item.id}`,
          empresa: emp,
          omie_id: item.omie_id,
          tipo: item.tipo_registro === 'RECEBER' ? 'RECEBER' : (item.tipo_registro === 'PAGAR' ? 'PAGAR' : 'MOVIMENTO'),
          status: item.status || 'PAGO',
          valor: valorAbs,
          sinal_valor: sinalValor,
          data_competencia: dtCompetencia,
          data_caixa: dtCaixa,
          data_vencimento: dtVenc,
          data_previsao: dtPrev,
          periodo,
          periodoNum,
          conta_dre: contaDre,
          categoria: catNome || 'Diversos',
          projeto: projNome || 'Geral',
          departamento: decodeHtmlEntities(String(item.departamento_nome || 'Geral')).trim(),
          fornecedor_cliente: fornNome || 'Diversos',
          conta_corrente: decodeHtmlEntities(String(raw.conta_corrente || rawDet.cDesContaCC || 'Conta Corrente')).trim(),
          numero_documento: item.numero_documento,
          numero_parcela: numParcela || '1/1',
          parcela_atual: parcelaAtual,
          total_parcelas: totalParcelas,
          tipo_pagamento: isParcelado ? 'PARCELADO' : 'A_VISTA',
          is_parcela_anterior: isParcelaAnterior,
          is_longo_prazo: isLongoPrazo,
          is_recorrente: isDespesaRecorrente(catNome, contaDre, fornNome),
          is_provisao: isProvisao,
          is_em_atraso: isEmAtraso,
          dias_atraso: diasAtraso,
          rateios: rateios.length > 0 ? rateios : undefined,
          observacoes: raw.observacao || rawDet.cDesMov || null,
          origem_base: 'OMIE_LIVE'
        });
      });

      // 6. Incorporar Dados Históricos Congelados do Snapshot
      // Para meses anteriores ao marco temporal de cada empresa
      if (snapRows.length > 0) {
        snapRows.forEach((r: any, idx: number) => {
          const emp = normalizeEmpresa(r.Empresa);
          const contaDre = (r.ContaDRE || 'Sem Conta').trim();
          const categoria = (r.Categoria || 'Diversos').trim();
          const forn = (r.Fornecedor || r.Cliente || 'Diversos').trim();
          const depto = (r.Departamento || 'Geral').trim();
          const proj = normalizeProjectName((r.Projeto || 'Geral').trim());

          // Percorrer todas as colunas de mês (ex: 'Jan/25', 'Fev/25', 'Set/26')
          Object.keys(r).forEach(col => {
            if (!/^[A-Z][a-z]{2}\/\d{2}$/.test(col)) return;

            const valStr = r[col];
            if (!valStr || valStr === '-' || valStr === 'null') return;
            const valNum = typeof valStr === 'number'
              ? valStr
              : parseFloat(String(valStr).replace(/\./g, '').replace(',', '.')) || 0;

            if (Math.abs(valNum) < 0.001) return;

            const parts = col.split('/');
            const mIdx = MONTH_NAMES.indexOf(parts[0]);
            const yFull = 2000 + parseInt(parts[1], 10);
            const mFull = mIdx + 1;
            const dtRef = `${yFull}-${String(mFull).padStart(2, '0')}-01`;

            // Verificar se cai na faixa congelada da empresa:
            let isHistoricoCongelado = false;
            if (emp === 'Ybox') {
              isHistoricoCongelado = true; // Ybox 100% histórico congelado
            } else if (emp === 'Conectius') {
              if (dtRef < '2026-07-01') isHistoricoCongelado = true;
            } else {
              // Mar Brasil, DZM, G2
              if (dtRef < '2025-06-01') isHistoricoCongelado = true;
            }

            if (!isHistoricoCongelado) return;

            const isReceita = contaDre.toLowerCase().includes('receita');
            const valorAbs = Math.abs(valNum);

            lancamentos.push({
              id: `hist-${emp}-${col}-${idx}`,
              empresa: emp,
              omie_id: null,
              tipo: isReceita ? 'RECEBER' : 'PAGAR',
              status: 'PAGO',
              valor: valorAbs,
              sinal_valor: isReceita ? valorAbs : -valorAbs,
              data_competencia: dtRef,
              data_caixa: dtRef,
              data_vencimento: dtRef,
              data_previsao: dtRef,
              periodo: col,
              periodoNum: yFull * 12 + mFull,
              conta_dre: contaDre,
              categoria,
              projeto: proj,
              departamento: depto,
              fornecedor_cliente: forn,
              conta_corrente: 'Histórico Consolidado',
              numero_parcela: '1/1',
              parcela_atual: 1,
              total_parcelas: 1,
              tipo_pagamento: 'A_VISTA',
              is_parcela_anterior: false,
              is_longo_prazo: false,
              is_recorrente: isDespesaRecorrente(categoria, contaDre, forn),
              is_provisao: false,
              is_em_atraso: false,
              dias_atraso: 0,
              origem_base: 'HISTORICO_CONGELADO'
            });
          });
        });
      }

      return { lancamentos, error: null };
    } catch (err: any) {
      console.error('[DrePainelService] Erro fatal:', err);
      return { lancamentos: [], error: err.message || 'Erro ao carregar dados' };
    }
  }

  /**
   * Aplica filtros granulares selecionados pelo usuário executivo
   */
  static filterLancamentos(
    lancamentos: DrePainelLancamento[],
    filters: DrePainelFilters
  ): DrePainelLancamento[] {
    return lancamentos.filter(l => {
      // 1. Empresa
      if (filters.empresas.length > 0 && !filters.empresas.includes(l.empresa)) {
        return false;
      }

      // 2. Períodos
      if (filters.periodos.length > 0 && !filters.periodos.includes(l.periodo)) {
        return false;
      }

      // 3. Conta DRE
      if (filters.contasDre.length > 0 && !filters.contasDre.includes(l.conta_dre)) {
        return false;
      }

      // 4. Departamento
      if (filters.departamentos.length > 0) {
        const hasDepto = filters.departamentos.includes(l.departamento) ||
          (l.rateios && l.rateios.some(r => filters.departamentos.includes(r.departamento)));
        if (!hasDepto) return false;
      }

      // 5. Projeto
      if (filters.projetos.length > 0 && !filters.projetos.includes(l.projeto)) {
        return false;
      }

      // 6. Categoria
      if (filters.categorias.length > 0 && !filters.categorias.includes(l.categoria)) {
        return false;
      }

      // 7. Fornecedor / Cliente
      if (filters.fornecedores.length > 0 && !filters.fornecedores.includes(l.fornecedor_cliente)) {
        return false;
      }

      // 8. Conta Corrente
      if (filters.contasCorrentes.length > 0 && !filters.contasCorrentes.includes(l.conta_corrente)) {
        return false;
      }

      // 9. Granularidade de Parcelamento
      if (filters.filtroParcelamento === 'A_VISTA' && l.tipo_pagamento !== 'A_VISTA') return false;
      if (filters.filtroParcelamento === 'PARCELADO_GERAL' && l.tipo_pagamento !== 'PARCELADO') return false;
      if (filters.filtroParcelamento === 'PARCELA_ANTERIOR' && !l.is_parcela_anterior) return false;
      if (filters.filtroParcelamento === 'LONGO_PRAZO' && !l.is_longo_prazo) return false;

      // 10. Status de Vencimento
      if (filters.filtroStatusVencimento === 'EM_ATRASO' && !l.is_em_atraso) return false;
      if (filters.filtroStatusVencimento === 'A_VENCER' && (l.status === 'PAGO' || l.is_em_atraso)) return false;
      if (filters.filtroStatusVencimento === 'PAGO' && l.status !== 'PAGO') return false;

      // 11. Recorrência
      if (filters.filtroRecorrencia === 'SOMENTE_RECORRENTES' && !l.is_recorrente) return false;
      if (filters.filtroRecorrencia === 'SOMENTE_PONTUAIS' && l.is_recorrente) return false;

      // 12. Busca textual rápida
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const str = `${l.fornecedor_cliente} ${l.categoria} ${l.projeto} ${l.departamento} ${l.numero_documento || ''} ${l.observacoes || ''}`.toLowerCase();
        if (!str.includes(s)) return false;
      }

      return true;
    });
  }

  /**
   * Calcula os KPIs executivos
   */
  static calculateKpis(lancamentos: DrePainelLancamento[]): DrePainelKpis {
    let totalReceitas = 0;
    let totalDespesas = 0;
    let totalAtrasado = 0;
    let qtdAtrasados = 0;
    let totalParceladoComprometido = 0;
    let totalProvisoes = 0;

    lancamentos.forEach(l => {
      if (l.sinal_valor > 0) {
        totalReceitas += l.valor;
      } else {
        totalDespesas += l.valor;
      }

      if (l.is_em_atraso) {
        totalAtrasado += l.valor;
        qtdAtrasados++;
      }

      if (l.tipo_pagamento === 'PARCELADO') {
        totalParceladoComprometido += l.valor;
      }

      if (l.is_provisao) {
        totalProvisoes += l.valor;
      }
    });

    const resultadoLiquido = totalReceitas - totalDespesas;
    const margemLiquida = totalReceitas > 0 ? (resultadoLiquido / totalReceitas) * 100 : 0;

    return {
      totalReceitas,
      totalDespesas,
      resultadoLiquido,
      margemLiquida,
      totalAtrasado,
      qtdAtrasados,
      totalParceladoComprometido,
      totalProvisoes,
      totalLancamentos: lancamentos.length
    };
  }

  /**
   * Monta a árvore de seções do DRE (Conta DRE -> Categorias -> Lançamentos)
   */
  static buildTableSections(
    lancamentos: DrePainelLancamento[],
    periodos: string[]
  ): DrePainelTableSection[] {
    const contasOrdem = [
      'Receita Bruta de Vendas',
      'Deduções da Receita Bruta',
      'Outras Receitas',
      'Custo dos Serviços Prestados',
      'Despesas com Pessoal',
      'Despesas Variáveis',
      'Despesas Administrativas',
      'Despesas de Vendas e Marketing',
      'Outros Custos',
      'Despesas Financeiras',
      'Receitas Financeiras',
      'Impostos',
      'Ativos'
    ];

    const map = new Map<string, Map<string, { valores: Record<string, number>; detalhes: DrePainelLancamento[] }>>();

    contasOrdem.forEach(c => map.set(c, new Map()));

    lancamentos.forEach(l => {
      const conta = l.conta_dre || 'Despesas Administrativas';
      if (!map.has(conta)) map.set(conta, new Map());

      const catMap = map.get(conta)!;
      const cat = l.categoria || 'Diversos';
      if (!catMap.has(cat)) {
        catMap.set(cat, { valores: {}, detalhes: [] });
      }

      const item = catMap.get(cat)!;
      item.valores[l.periodo] = (item.valores[l.periodo] || 0) + l.valor;
      item.detalhes.push(l);
    });

    const sections: DrePainelTableSection[] = [];

    contasOrdem.forEach(conta => {
      const catMap = map.get(conta);
      if (!catMap || catMap.size === 0) return;

      const isReceita = conta.toLowerCase().includes('receita');
      const valoresContaPorMes: Record<string, number> = {};
      let totalContaGeral = 0;

      const categoriasList: DrePainelTableSection['categorias'] = [];

      catMap.forEach((data, catNome) => {
        let totalCat = 0;
        periodos.forEach(p => {
          const v = data.valores[p] || 0;
          totalCat += v;
          valoresContaPorMes[p] = (valoresContaPorMes[p] || 0) + v;
        });
        totalContaGeral += totalCat;

        categoriasList.push({
          categoria: catNome,
          valoresPorMes: data.valores,
          totalGeral: totalCat,
          detalhes: data.detalhes
        });
      });

      // Ordenar categorias por maior valor
      categoriasList.sort((a, b) => b.totalGeral - a.totalGeral);

      sections.push({
        contaDre: conta,
        tipo: isReceita ? 'RECEITA' : (conta.toLowerCase().includes('custo') ? 'CUSTO' : 'DESPESA'),
        valoresPorMes: valoresContaPorMes,
        totalGeral: totalContaGeral,
        categorias: categoriasList
      });
    });

    return sections;
  }
}
