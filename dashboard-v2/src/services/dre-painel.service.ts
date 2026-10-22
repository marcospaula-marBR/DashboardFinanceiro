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

export const BANK_NAMES_MAP: Record<string, string> = {
  '7654276902': 'Caixinha',
  '7654276943': 'Omie.CASH',
  '7662736722': 'Bradesco',
  '7662737142': 'PagBank (PagSeguro)',
  '7662738731': 'Banco do Brasil',
  '7662742215': 'Itaú Unibanco',
  '7662747917': 'Sicredi',
  '7665602672': 'Bradesco - Cartão 8583 / 2192',
  '7669310486': 'Cartão - Sicredi 0137 / 0129',
  '7670894051': 'Flash - Prestadores',
  '7687200485': 'Elo - 9693',
  '7687296428': 'PagSeguro - Pessoal',
  '7687299201': 'Flash - Funcionários',
  '7701412641': 'Consórcio Contemplado - Massey Ferguson',
  '7721355816': 'Provisão - Impostos Trimestrais',
  '7721357315': 'Provisão - 13o salário e encargos',
  '7721358027': 'Provisão - Férias e encargos',
  '7721360080': 'Provisão - Contingências',
  '7722457245': 'Investimentos - Bradesco',
  '7727306587': 'Banco do Brasil - Investimentos',
  '7769416232': 'Sicredi - Investimentos',
  '7769825595': 'Visa - 6391 BNDS',
  '7845157479': 'Pri PF - Itaú Unibanco',
  '7845159602': 'Pri PF - Bradesco',
  '7845161677': 'Pri PF - Banco do Brasil',
  '7845162357': 'Pri PF - Nubank',
  '7845165094': 'Dauren PF - Itaú Unibanco',
  '7845166213': 'Dauren PF - Bradesco',
  '7845167362': 'Dauren PF - Nubank',
  '7854722119': 'Créditos - DZM',
  '7854729147': 'Terceirização DZM',
  '7854729354': 'Intermediação DZM',
  '7918604403': 'Diretoria - 1924',
  '12211377291': 'Omie.CASH - Cartão Omie',
  '12211377371': 'Omie.CASH - Cartão Omie (Garantia)',
  '12291364271': 'Clara - Prestadores',
  '12340529395': 'Ourocard - 1405'
};

export function resolveContaCorrente(raw: any, rawDet: any): string {
  const nCod = String(raw?.id_conta_corrente || rawDet?.nCodCC || raw?.nCodCC || raw?.codigo_conta_corrente || '').trim();
  if (nCod && BANK_NAMES_MAP[nCod]) {
    return BANK_NAMES_MAP[nCod];
  }
  const desc = String(raw?.conta_corrente || rawDet?.cDesContaCC || '').trim();
  if (desc && desc !== 'Conta Corrente' && desc !== 'null' && desc !== 'undefined') {
    return decodeHtmlEntities(desc);
  }
  const obs = String(raw?.observacao || rawDet?.cDesMov || rawDet?.cNomPessoa || '').toLowerCase();
  if (obs.includes('bradesco')) return 'Bradesco';
  if (obs.includes('sicredi')) return 'Sicredi';
  if (obs.includes('omie') || obs.includes('omie.cash')) return 'Omie.CASH';
  if (obs.includes('itau') || obs.includes('itaú')) return 'Itaú Unibanco';
  if (obs.includes('banco do brasil') || obs.includes('bb')) return 'Banco do Brasil';
  if (obs.includes('flash')) return 'Flash - Prestadores';
  if (obs.includes('clara')) return 'Clara - Prestadores';
  if (obs.includes('pagbank') || obs.includes('pagseguro')) return 'PagBank';
  return 'Conta Corrente Principal';
}

export class DrePainelService {
  /**
   * Carrega os lançamentos unificados respeitando:
   * 1. Regime de Competência:
   *    - Calibragem autoritativa 100% exata com o Dashboard DRE (dre_snapshots + dre_lancamentos)
   *    - Provisões ativas de receitas e despesas
   *    - Contas correntes bancárias autênticas (Bradesco, Sicredi, Omie.CASH, Itaú, Flash, Clara, etc.)
   * 2. Regime de Caixa:
   *    - Saídas e entradas efetivamente pagas/recebidas (data_pagamento) da tabela unificada Omie
   *    - Ingestão atualizada incluindo os lançamentos de 25/09 (credenciados administrativos) e liquidações correntes
   *    - Mapeamento analítico de contas bancárias
   * 3. Fluxo & Previsão:
   *    - Obrigações a vencer e em aberto
   *    - Inclusão mandatória de Provisões de Receitas como entradas projetadas
   */
  static async fetchLancamentos(regime: RegimeTipo): Promise<{
    lancamentos: DrePainelLancamento[];
    error: string | null;
  }> {
    try {
      // 1. REGIME DE COMPETÊNCIA: CALIBRAGEM AUTORITATIVA 100% COM DASHBOARD DRE
      if (regime === 'COMPETENCIA') {
        const { data: snapData, error: snapError } = await supabase
          .from('dre_snapshots')
          .select('raw_data')
          .order('created_at', { ascending: false })
          .limit(1);

        if (snapError) throw snapError;

        const snapRows: any[] = snapData && snapData.length > 0 && Array.isArray(snapData[0].raw_data) ? snapData[0].raw_data : [];

        // Carregar linhas manuais da tabela dre_lancamentos (Ybox e ajustes autoritativos)
        let manualRows: any[] = [];
        try {
          let manStart = 0;
          const manLimit = 1000;
          let manHasMore = true;
          while (manHasMore) {
            const { data: mData } = await supabase
              .from('dre_lancamentos')
              .select('*')
              .range(manStart, manStart + manLimit - 1);
            if (!mData || mData.length === 0) {
              manHasMore = false;
            } else {
              manualRows = manualRows.concat(mData);
              manStart += manLimit;
              if (mData.length < manLimit) manHasMore = false;
            }
          }
        } catch (e) {
          console.warn('[DrePainelService] Aviso ao carregar dre_lancamentos:', e);
        }

        // Snapshot excluindo Ybox legado, pois Ybox é inserida autoritativamente via manualRows
        const filteredSnap = snapRows.filter((r: any) => normalizeEmpresa(r.Empresa) !== 'Ybox');
        
        // Pivotar dados manuais da Ybox e ajustes
        const yboxRowsMap = new Map<string, any>();
        manualRows.forEach((m: any) => {
          const emp = normalizeEmpresa(m.empresa);
          if (emp !== 'Ybox') return;
          const key = `${emp}|${m.conta_dre}|${m.categoria}|${m.departamento || 'Geral'}|${m.projeto || 'Geral'}`;
          if (!yboxRowsMap.has(key)) {
            yboxRowsMap.set(key, {
              Empresa: emp,
              ContaDRE: m.conta_dre,
              Categoria: m.categoria,
              Departamento: m.departamento || 'Geral',
              Projeto: m.projeto || 'Geral',
              Fornecedor: 'Diversos',
              ContaCorrente: 'Histórico Ybox',
              valores: {}
            });
          }
          const item = yboxRowsMap.get(key);
          item.valores[m.periodo] = (item.valores[m.periodo] || 0) + (Number(m.valor) || 0);
        });

        const yboxFinalRows: any[] = [];
        yboxRowsMap.forEach(item => {
          const rowObj: any = {
            Empresa: item.Empresa,
            ContaDRE: item.ContaDRE,
            Categoria: item.Categoria,
            Departamento: item.Departamento,
            Projeto: item.Projeto,
            Fornecedor: item.Fornecedor,
            ContaCorrente: item.ContaCorrente
          };
          Object.entries(item.valores).forEach(([p, v]) => {
            rowObj[p] = v;
          });
          yboxFinalRows.push(rowObj);
        });

        const combinedCompetenciaRows = [...filteredSnap, ...yboxFinalRows];
        const lancamentosComp: DrePainelLancamento[] = [];

        combinedCompetenciaRows.forEach((r: any, idx: number) => {
          const emp = normalizeEmpresa(r.Empresa);
          const contaDre = (r.ContaDRE || 'Despesas Administrativas').trim();
          const categoria = (r.Categoria || 'Diversos').trim();
          const catLow = categoria.toLowerCase();
          const forn = decodeHtmlEntities(String(r.Fornecedor || r.Cliente || 'Diversos')).trim();
          const depto = decodeHtmlEntities(String(r.Departamento || 'Geral')).trim();
          const proj = normalizeProjectName(decodeHtmlEntities(String(r.Projeto || 'Geral')).trim());
          const cc = decodeHtmlEntities(String(r.ContaCorrente || 'Conta Corrente Principal')).trim();
          const isReceita = contaDre.toLowerCase().includes('receita');
          const isProvisao = catLow.includes('provisão') || catLow.includes('provisao') || catLow.startsWith('1.01.9');

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
            const valAbs = Math.abs(valNum);

            lancamentosComp.push({
              id: `comp-${emp}-${col}-${idx}`,
              empresa: emp,
              omie_id: null,
              tipo: isReceita ? 'RECEBER' : 'PAGAR',
              status: 'PAGO',
              valor: valAbs,
              sinal_valor: isReceita ? valAbs : -valAbs,
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
              conta_corrente: cc,
              numero_documento: null,
              numero_parcela: '1/1',
              parcela_atual: 1,
              total_parcelas: 1,
              tipo_pagamento: 'A_VISTA',
              is_parcela_anterior: false,
              is_longo_prazo: false,
              is_recorrente: isDespesaRecorrente(categoria, contaDre, forn),
              is_provisao: isProvisao,
              is_em_atraso: false,
              dias_atraso: 0,
              origem_base: 'OMIE_LIVE'
            });
          });
        });

        return { lancamentos: lancamentosComp, error: null };
      }

      // 2. REGIME DE CAIXA E FLUXO/PREVISÃO:
      // Mapa de De-Para de Categorias para Contas DRE do Snapshot
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

      // Mapa de Projetos
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

      // Carregar registros do Omie a partir da tabela omie_financas_unificado
      let allRecords: any[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      let query = supabase
        .from('omie_financas_unificado')
        .select('id, empresa_nome, omie_id, tipo_registro, status, valor_total, valor_alocado, data_pagamento, data_vencimento, data_emissao, data_previsao, data_registro, projeto_nome, departamento_nome, categoria_codigo, categoria_nome, cliente_fornecedor, numero_documento, raw_data')
        .neq('status', 'CANCELADO');

      if (regime === 'CAIXA') {
        query = query.not('data_pagamento', 'is', null).gte('data_pagamento', '2025-06-01');
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

      // Processamento dos registros Omie com travas temporais e regras contábeis
      allRecords.forEach(item => {
        const emp = normalizeEmpresa(item.empresa_nome);
        if (emp === 'Ybox') return; // Ybox é tratada 100% pelo histórico

        const dtCompetencia = item.data_registro || item.data_emissao || item.data_vencimento || '';
        const dtCaixa = item.data_pagamento || null;
        const dtVenc = item.data_vencimento || null;
        const dtPrev = item.data_previsao || dtVenc;

        // TRAVAS TEMPORAIS MANDATÓRIAS:
        // - Conectius: Omie somente >= 2026-07-01
        // - Mar Brasil, DZM, G2: Omie somente >= 2025-06-01
        if (emp === 'Conectius') {
          if (regime === 'CAIXA' && (!dtCaixa || dtCaixa < '2026-07-01')) return;
          if (regime === 'PREVISAO' && (!dtVenc || dtVenc < '2026-07-01')) return;
        } else {
          if (regime === 'CAIXA' && (!dtCaixa || dtCaixa < '2025-06-01')) return;
          if (regime === 'PREVISAO' && (!dtVenc || dtVenc < '2025-06-01')) return;
        }

        const raw = item.raw_data || {};
        const rawDet = raw.detalhes || {};
        const catCodigo = String(item.categoria_codigo || rawDet.cCodCateg || '').trim();
        const catNome = decodeHtmlEntities(String(item.categoria_nome || rawDet.cDesCateg || '')).trim();
        const catNomeLow = catNome.toLowerCase();

        // 1. Desconsiderar Transferências Internas
        if (
          catCodigo.startsWith('0.') ||
          catCodigo === '0.01' ||
          catNomeLow.includes('transferência') ||
          catNomeLow.includes('transferencia')
        ) {
          return;
        }

        // 2. Desconsiderar Mútuo Intercompany
        if (
          catCodigo === '1.01.95' ||
          catNomeLow.includes('créditos mar brasil') ||
          catNomeLow.includes('creditos mar brasil')
        ) {
          return;
        }

        // 3. Neutralizar Recarga de Cartão Corporativo (Clara)
        if (
          catCodigo === '2.04.99' ||
          catNomeLow.includes('recarga de cartão') ||
          catNomeLow.includes('recarga de cartao')
        ) {
          return;
        }

        // 4. Extrato Bancário direto (nCodTitulo == 0)
        const nCodTitulo = Number(rawDet.nCodTitulo || 0);
        const grp = String(rawDet.cGrupo || '').toUpperCase();
        if (nCodTitulo !== 0 && (grp === 'CONTA_CORRENTE_PAG' || grp === 'CONTA_CORRENTE_REC' || grp === 'CONTA_A_PAGAR' || grp === 'CONTA_A_RECEBER')) {
          if (item.tipo_registro === 'MOVIMENTO') return;
        }

        // 5. REGRA DE PROVISÕES (Despesas e Receitas):
        const isProvisao =
          catCodigo.startsWith('1.01.9') ||
          catNomeLow.includes('provisão') ||
          catNomeLow.includes('provisao');

        const isProvisaoReceita =
          isProvisao &&
          (catCodigo.startsWith('1.01') || item.tipo_registro === 'RECEBER' || catNomeLow.includes('receita'));

        // No regime de CAIXA, provisões não pagas não entram
        if (regime === 'CAIXA' && isProvisao && !dtCaixa) return;

        // No regime de PREVISÃO (Fluxo de Caixa):
        // Se já foi pago, não é mais previsão futura
        if (regime === 'PREVISAO' && item.status === 'PAGO') return;

        // Determinar Conta DRE
        let contaDre = catToConta.get(catNomeLow) || '';
        if (!contaDre) {
          if (item.tipo_registro === 'RECEBER' || catCodigo.startsWith('1.01') || isProvisaoReceita) {
            contaDre = 'Receita Bruta de Vendas';
          } else if (catCodigo.startsWith('1.02') || catCodigo.startsWith('1.03')) {
            contaDre = 'Outras Receitas';
          } else if (catCodigo.startsWith('2.05')) {
            contaDre = 'Despesas Financeiras';
          } else if (catCodigo.startsWith('2.07')) {
            contaDre = 'Ativos';
          } else if (catNomeLow.includes('salário') || catNomeLow.includes('folha') || catNomeLow.includes('inss') || catNomeLow.includes('credenciado')) {
            contaDre = 'Despesas com Pessoal';
          } else {
            contaDre = 'Despesas Administrativas';
          }
        }

        // Valor e Sinal
        const valorAlocado = Number(item.valor_alocado || item.valor_total || 0);
        const valorAbs = Math.abs(valorAlocado);
        const isReceita = item.tipo_registro === 'RECEBER' || isProvisaoReceita || (item.tipo_registro === 'MOVIMENTO' && rawDet.cNatureza === 'R');
        const sinalValor = isReceita ? valorAbs : -valorAbs;

        // Data base do Regime
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
        if (!fornNome || fornNome === 'não informado' || fornNome === 'Sem Fornecedor') {
          if (rawDet.cNomPessoa) {
            fornNome = decodeHtmlEntities(rawDet.cNomPessoa);
          }
        }

        // Projeto
        let projNome = normalizeProjectName(decodeHtmlEntities(String(item.projeto_nome || '')).trim());
        const codProj = String(raw.codigo_projeto || rawDet.nCodProjeto || '').trim();
        if ((!projNome || projNome === 'Sem Projeto') && codProj && projMap.has(codProj)) {
          projNome = projMap.get(codProj)!;
        }

        // Conta Bancária Real Resolvida
        const contaCorrente = resolveContaCorrente(raw, rawDet);

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
          tipo: isReceita ? 'RECEBER' : 'PAGAR',
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
          conta_corrente: contaCorrente,
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

      // 3. Incorporar Dados Históricos Congelados do Snapshot
      // Para meses anteriores ao marco temporal de cada empresa
      if (snapRows.length > 0) {
        snapRows.forEach((r: any, idx: number) => {
          const emp = normalizeEmpresa(r.Empresa);
          const contaDre = (r.ContaDRE || 'Sem Conta').trim();
          const categoria = (r.Categoria || 'Diversos').trim();
          const forn = decodeHtmlEntities(String(r.Fornecedor || r.Cliente || 'Diversos')).trim();
          const depto = decodeHtmlEntities(String(r.Departamento || 'Geral')).trim();
          const proj = normalizeProjectName(decodeHtmlEntities(String(r.Projeto || 'Geral')).trim());
          const cc = decodeHtmlEntities(String(r.ContaCorrente || 'Histórico Consolidado')).trim();

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

            let isHistoricoCongelado = false;
            if (emp === 'Ybox') {
              isHistoricoCongelado = true;
            } else if (emp === 'Conectius') {
              if (dtRef < '2026-07-01') isHistoricoCongelado = true;
            } else {
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
              conta_corrente: cc,
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

      // 2. Subfiltro de Ano (TODOS | 2024 | 2025 | 2026)
      if (filters.ano && filters.ano !== 'TODOS') {
        const shortYear = filters.ano.slice(-2);
        if (!l.periodo.endsWith(`/${shortYear}`)) {
          return false;
        }
      }

      // 3. Períodos específicos
      if (filters.periodos.length > 0 && !filters.periodos.includes(l.periodo)) {
        return false;
      }

      // 4. Conta DRE
      if (filters.contasDre.length > 0 && !filters.contasDre.includes(l.conta_dre)) {
        return false;
      }

      // 5. Departamento
      if (filters.departamentos.length > 0) {
        const hasDepto = filters.departamentos.includes(l.departamento) ||
          (l.rateios && l.rateios.some(r => filters.departamentos.includes(r.departamento)));
        if (!hasDepto) return false;
      }

      // 6. Projeto
      if (filters.projetos.length > 0 && !filters.projetos.includes(l.projeto)) {
        return false;
      }

      // 7. Categoria
      if (filters.categorias.length > 0 && !filters.categorias.includes(l.categoria)) {
        return false;
      }

      // 8. Fornecedor / Cliente
      if (filters.fornecedores.length > 0 && !filters.fornecedores.includes(l.fornecedor_cliente)) {
        return false;
      }

      // 9. Conta Corrente Bancária
      if (filters.contasCorrentes.length > 0 && !filters.contasCorrentes.includes(l.conta_corrente)) {
        return false;
      }

      // 10. Granularidade de Parcelamento
      if (filters.filtroParcelamento === 'A_VISTA' && l.tipo_pagamento !== 'A_VISTA') return false;
      if (filters.filtroParcelamento === 'PARCELADO_GERAL' && l.tipo_pagamento !== 'PARCELADO') return false;
      if (filters.filtroParcelamento === 'PARCELA_ANTERIOR' && !l.is_parcela_anterior) return false;
      if (filters.filtroParcelamento === 'LONGO_PRAZO' && !l.is_longo_prazo) return false;

      // 11. Status de Vencimento
      if (filters.filtroStatusVencimento === 'EM_ATRASO' && !l.is_em_atraso) return false;
      if (filters.filtroStatusVencimento === 'A_VENCER' && (l.status === 'PAGO' || l.is_em_atraso)) return false;
      if (filters.filtroStatusVencimento === 'PAGO' && l.status !== 'PAGO') return false;

      // 12. Recorrência
      if (filters.filtroRecorrencia === 'SOMENTE_RECORRENTES' && !l.is_recorrente) return false;
      if (filters.filtroRecorrencia === 'SOMENTE_PONTUAIS' && l.is_recorrente) return false;

      // 13. Ocultar Categorias
      if (filters.ocultarCategorias && filters.ocultarCategorias.length > 0) {
        if (filters.ocultarCategorias.includes(l.categoria)) return false;
      }

      // 14. Ocultar Projetos
      if (filters.ocultarProjetos && filters.ocultarProjetos.length > 0) {
        if (filters.ocultarProjetos.includes(l.projeto)) return false;
      }

      // 15. Busca textual rápida
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const str = `${l.fornecedor_cliente} ${l.categoria} ${l.projeto} ${l.departamento} ${l.conta_corrente} ${l.numero_documento || ''} ${l.observacoes || ''}`.toLowerCase();
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
