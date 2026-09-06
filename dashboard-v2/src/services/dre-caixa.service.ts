import { supabase } from '@/lib/supabase';
import {
  DreCaixaLancamento,
  DreCaixaFilters,
  DreCaixaKpiSummary,
  DreCaixaChartData,
  DreCaixaTableSection,
  PurchasesAuditSummary
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

/**
 * Decodifica entidades HTML e caracteres especiais vindos do ERP (ex: &amp; -> &, &quot; -> ", etc.)
 */
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
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return _;
      }
    })
    .replace(/&amp;/g, '&')
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

      // Buscar todos os fornecedores/favorecidos paginados para resolução precisa
      const fornMap = new Map<string, string>();
      const fornMapByCode = new Map<string, string>();
      const fornMapByCpf = new Map<string, string>();
      
      let fornFrom = 0;
      const fornLimit = 1000;
      let hasMoreForn = true;

      while (hasMoreForn) {
        const { data: fornData, error: fornError } = await supabase
          .from('omie_dim_fornecedores')
          .select('codigo_cliente_omie,nome_fantasia,razao_social,empresa_nome,cnpj_cpf')
          .range(fornFrom, fornFrom + fornLimit - 1);

        if (fornError || !fornData || fornData.length === 0) {
          hasMoreForn = false;
        } else {
          fornData.forEach(f => {
            const nome = decodeHtmlEntities(f.nome_fantasia || f.razao_social || '');
            const cod = String(f.codigo_cliente_omie || '').trim();
            const cpfClean = String(f.cnpj_cpf || '').replace(/\D/g, '');
            const empKey = `${String(f.empresa_nome || '').trim()}-${cod}`;

            if (nome) {
              if (cod) {
                fornMap.set(empKey, nome);
                fornMapByCode.set(cod, nome);
              }
              if (cpfClean) {
                fornMapByCpf.set(cpfClean, nome);
              }
            }
          });
          fornFrom += fornLimit;
          if (fornData.length < fornLimit) hasMoreForn = false;
        }
      }

      // Buscar mapa de projetos do Omie para resolução precisa da coluna Projeto/Setor
      const projMap = new Map<string, string>();
      try {
        const { data: projData } = await supabase
          .from('omie_dim_projetos')
          .select('codigo_projeto, descricao_projeto, empresa_nome');

        if (projData) {
          projData.forEach((p: any) => {
            const cod = String(p.codigo_projeto || '').trim();
            const desc = decodeHtmlEntities(p.descricao_projeto || '');
            const emp = String(p.empresa_nome || '').trim();
            if (cod && desc) {
              projMap.set(cod, desc);
              if (emp) projMap.set(`${emp}-${cod}`, desc);
            }
          });
        }

        const { data: pData } = await supabase
          .from('projetos')
          .select('omie_id, nome');

        if (pData) {
          pData.forEach((p: any) => {
            const cod = String(p.omie_id || '').trim();
            const nome = decodeHtmlEntities(p.nome || '');
            if (cod && nome && !projMap.has(cod)) {
              projMap.set(cod, nome);
            }
          });
        }
      } catch (e) {
        console.warn('[DreCaixaService] Aviso ao carregar projetos dim:', e);
      }

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
      const knownCrTitles = new Set<string>();
      const knownCpTitles = new Set<string>();

      allRecords.forEach(item => {
        const emp = String(item.empresa_nome || '').trim();
        const omie_id = item.omie_id;
        const raw = item.raw_data || {};
        const det = raw.detalhes || {};
        const nCod = String(det.nCodTitulo || omie_id || '').trim();

        if (item.tipo_registro === 'RECEBER' && (omie_id || nCod)) {
          if (omie_id) knownCrTitles.add(`${emp}-${omie_id}`);
          if (nCod && nCod !== '0') knownCrTitles.add(`${emp}-${nCod}`);
        } else if (item.tipo_registro === 'PAGAR' && (omie_id || nCod)) {
          if (omie_id) knownCpTitles.add(`${emp}-${omie_id}`);
          if (nCod && nCod !== '0') knownCpTitles.add(`${emp}-${nCod}`);
        }
      });

      // Mapeamento, deduplicação de sync e normalização (com blindagem adicional >= 2025-06-01)
      const processedSignatures = new Set<string>();
      const processedMovTitles = new Set<string>();
      const processedRevenueTitles = new Set<string>();
      const processedRevenueDocs = new Set<string>();
      const processedRevenueSignatures = new Set<string>();
      const lancamentos: DreCaixaLancamento[] = [];

      allRecords.forEach(item => {
        if (!item.data_pagamento || item.data_pagamento < '2025-06-01') return;

        const raw = item.raw_data || {};
        const rawDet = raw.detalhes || {};
        const rawCab = raw.cabecalho || {};
        const catCodigo = String(item.categoria_codigo || rawDet.cCodCateg || '').trim();
        const catNome = String(item.categoria_nome || '').trim();
        const catNomeLower = catNome.toLowerCase();
        const cOrigem = String(rawDet.cOrigem || raw.id_origem || '').toUpperCase();
        const cGrupo = String(rawDet.cGrupo || '').toUpperCase();
        const obs = String(rawDet.observacao || raw.observacao || '').toLowerCase();
        const emp = String(item.empresa_nome || '').trim();

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

        // 2. REGRA MANDATÓRIA: EXCLUIR LANÇAMENTOS NÃO OPERACIONAIS / NÃO CAIXA
        // provisões, dividendos, mútuos, terceirização, intermediação, rendimentos de aplicações,
        // renda fixa, recarga de cartão, integralização de capital, estornos, devoluções,
        // créditos mar Brasil, antecipações DZM, aporte de capital e a classificar
        const isExcluidoCaixa =
          catNomeLower.includes('provis') ||
          obs.includes('provis') ||
          catNomeLower.includes('dividendo') ||
          obs.includes('dividendo') ||
          catNomeLower.includes('mutuo') ||
          catNomeLower.includes('mútuo') ||
          obs.includes('mutuo') ||
          obs.includes('mútuo') ||
          catNomeLower.includes('terceiri') ||
          obs.includes('terceiri') ||
          catNomeLower.includes('intermedia') ||
          obs.includes('intermedia') ||
          catNomeLower.includes('rendimento') ||
          obs.includes('rendimento') ||
          catNomeLower.includes('renda fixa') ||
          obs.includes('renda fixa') ||
          catNomeLower.includes('recarga') ||
          obs.includes('recarga') ||
          catNomeLower.includes('integraliza') ||
          obs.includes('integraliza') ||
          catNomeLower.includes('estorno') ||
          obs.includes('estorno') ||
          catNomeLower.includes('devolu') ||
          obs.includes('devolu') ||
          catNomeLower.includes('créditos mar brasil') ||
          catNomeLower.includes('creditos mar brasil') ||
          catNomeLower.includes('crédito mar brasil') ||
          catNomeLower.includes('credito mar brasil') ||
          obs.includes('créditos mar brasil') ||
          obs.includes('creditos mar brasil') ||
          catNomeLower.includes('antecipa') ||
          obs.includes('antecipa') ||
          catNomeLower.includes('aporte') ||
          obs.includes('aporte') ||
          catNomeLower.includes('classificar') ||
          obs.includes('classificar');

        if (isExcluidoCaixa) return;

        // 3. REGRA: DESCONSIDERAR 'VENR' EM MOVIMENTO (Venda a Prazo - faturamento por competência, não liquidação financeira de caixa)
        if (item.tipo_registro === 'MOVIMENTO' && cOrigem === 'VENR') return;

        // 4. REGRA DE CLASSIFICAÇÃO: ENTRADA (RECEITA) VS SAÍDA (PAGAMENTO)
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

        const valRound = Math.round(Math.abs(Number(item.valor_alocado || item.valor_total || 0)) * 100) / 100;
        if (valRound <= 0) return;

        // 5. REGRA MANDATÓRIA: DEDUPLICAÇÃO DE RECEITAS
        // Elimina duplicação massiva entre Título em Contas a Receber e Baixa em Conta Corrente (ambos gerados no Omie)
        if (isEntrada) {
          const nCodTit = String(rawDet.nCodTitulo || '').trim();
          const omieId = item.omie_id ? String(item.omie_id) : '';
          const titleId = (nCodTit && nCodTit !== '0') ? nCodTit : omieId;

          if (titleId) {
            const titleKey = `${emp}-${titleId}`;
            if (processedRevenueTitles.has(titleKey)) return;
            processedRevenueTitles.add(titleKey);
          }

          const docNum = String(item.numero_documento || rawDet.cNumDocFiscal || '').trim();
          if (docNum && docNum !== 'None') {
            const docKey = `${emp}-${docNum}-${item.data_pagamento}-${valRound}`;
            if (processedRevenueDocs.has(docKey)) return;
            processedRevenueDocs.add(docKey);
          }

          const revSig = `${emp}-${item.data_pagamento}-${valRound}-${catCodigo}`;
          if (processedRevenueSignatures.has(revSig)) return;
          processedRevenueSignatures.add(revSig);
        } else {
          // Para Saídas / Despesas (PAGAR):
          const omieId = item.omie_id ? String(item.omie_id) : '';
          const nCodTit = String(rawDet.nCodTitulo || '').trim();
          const deptoKey = String(item.departamento_nome || '').trim();

          const sig = `${emp}-${item.tipo_registro}-${omieId || nCodTit || item.id}-${item.data_pagamento}-${valRound}-${catCodigo}-${deptoKey}`;
          if (processedSignatures.has(sig)) return;
          processedSignatures.add(sig);

          if (item.tipo_registro === 'MOVIMENTO' && nCodTit && nCodTit !== '0') {
            const titleKey = `${emp}-${nCodTit}`;
            if (knownCpTitles.has(titleKey) || processedMovTitles.has(titleKey)) return;
            processedMovTitles.add(titleKey);
          }
        }

        // Resolução da Conta Corrente
        const idCC = String(raw.id_conta_corrente || rawDet.nCodCC || rawDet.cContaCorrente || '');
        let contaCorrente = KNOWN_ACCOUNTS[idCC] || rawDet.cContaCorrente || raw.cContaCorrente || 'Conta Principal';
        if (!idCC || idCC === 'null' || idCC === 'undefined') {
          contaCorrente = item.tipo_registro === 'MOVIMENTO' ? 'Extrato Bancário' : 'Conta Operacional';
        }
        contaCorrente = decodeHtmlEntities(contaCorrente);

        // Resolução do Fornecedor / Cliente / Favorecido (ex: Funcionários e Fornecedores)
        const codigoCF = String(raw.codigo_cliente_fornecedor || rawDet.nCodCliente || '').trim();
        const cpfRaw = String(rawDet.cCPFCNPJCliente || raw.cnpj_cpf || '').trim();
        const cleanCpf = cpfRaw.replace(/\D/g, '');
        const fornKey = `${String(item.empresa_nome || '').trim()}-${codigoCF}`;

        const fornFromDim = (codigoCF ? fornMap.get(fornKey) || fornMapByCode.get(codigoCF) : null) ||
                            (cleanCpf ? fornMapByCpf.get(cleanCpf) : null);

        const rawFornStr = (item.cliente_fornecedor && item.cliente_fornecedor !== 'N/D' && item.cliente_fornecedor !== 'Sem Fornecedor')
          ? item.cliente_fornecedor
          : fornFromDim || rawDet.cNomeCliente || raw.nm_cliente || raw.nome_cliente || 'Outros / Operacional';
        const fornFinal = decodeHtmlEntities(rawFornStr);

        const { periodo, periodoNum } = parsePeriodoFromDate(item.data_pagamento);

        const valTotal = Math.abs(Number(item.valor_alocado || item.valor_total || 0));
        const tipoFinal = isEntrada ? 'RECEBER' : 'PAGAR';
        const sinal = isEntrada ? 1 : -1;

        // Resolução Rigorosa do Setor (Coluna Projeto do Omie)
        const codProj = String(
          rawDet.cCodProjeto ||
          rawDet.nCodProjeto ||
          raw.codigo_projeto ||
          raw.nCodProjeto ||
          raw.cCodProjeto ||
          ''
        ).trim();

        const projFromDim = codProj ? (projMap.get(`${emp}-${codProj}`) || projMap.get(codProj)) : null;

        let projeto = projFromDim || '';

        if (!projeto && item.projeto_nome && item.projeto_nome.trim().toLowerCase() !== 'sem projeto' && item.projeto_nome.trim().toLowerCase() !== 'não informado') {
          projeto = item.projeto_nome.trim();
        }

        if (!projeto && item.departamento_nome && item.departamento_nome.trim() !== 'Sem Departamento' && item.departamento_nome.trim() !== 'Principal') {
          projeto = item.departamento_nome.trim();
        }

        if (!projeto) {
          projeto = 'Operacional / Geral';
        }
        projeto = decodeHtmlEntities(projeto);

        // Categoria
        const categoria = decodeHtmlEntities((item.categoria_nome || 'Despesas Gerais').trim());

        // Resolução de Parcelas e Modalidade (À Vista vs Parcelado)
        const rawParcelStr = String(
          raw.numero_parcela ||
          rawDet.cNumParcela ||
          rawCab.cNumParcela ||
          rawDet.numero_parcela ||
          rawCab.numero_parcela ||
          ''
        ).trim();

        let parcelaAtual = 1;
        let totalParcelas = 1;
        let tipoPagamento: 'A_VISTA' | 'PARCELADO' = 'A_VISTA';
        let numeroParcela: string | null = null;

        if (rawParcelStr) {
          const match = rawParcelStr.match(/(\d+)\s*[\/\-de]\s*(\d+)/i);
          if (match) {
            parcelaAtual = parseInt(match[1], 10) || 1;
            totalParcelas = parseInt(match[2], 10) || 1;
          } else {
            const single = parseInt(rawParcelStr, 10);
            if (!isNaN(single)) parcelaAtual = single;
          }

          if (totalParcelas > 1) {
            tipoPagamento = 'PARCELADO';
            numeroParcela = `${parcelaAtual}/${totalParcelas}`;
          } else {
            tipoPagamento = 'A_VISTA';
            numeroParcela = '1/1';
          }
        } else {
          // Checar se no documento ou observação há menção explícita de parcela (ex: "Parc 2/3")
          const docStr = String(item.numero_documento || rawDet.cNumDocFiscal || '').trim();
          const obsStr = String(rawDet.cObservacao || raw.observacao || '').trim();
          const docMatch = (docStr + ' ' + obsStr).match(/parc(?:ela)?\.?\s*(\d+)\s*[\/\-]\s*(\d+)/i);
          if (docMatch) {
            parcelaAtual = parseInt(docMatch[1], 10) || 1;
            totalParcelas = parseInt(docMatch[2], 10) || 1;
            if (totalParcelas > 1) {
              tipoPagamento = 'PARCELADO';
              numeroParcela = `${parcelaAtual}/${totalParcelas}`;
            }
          }
        }

        if (!numeroParcela) {
          numeroParcela = tipoPagamento === 'PARCELADO' ? `${parcelaAtual}/${totalParcelas}` : 'À vista';
        }

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
          numero_documento: item.numero_documento || null,
          numero_parcela: numeroParcela,
          parcela_atual: parcelaAtual,
          total_parcelas: totalParcelas,
          tipo_pagamento: tipoPagamento
        });
      });

      return { lancamentos, error: null };
    } catch (err: any) {
      console.error('[DreCaixaService] Exceção:', err);
      return { lancamentos: [], error: err.message || 'Erro inesperado' };
    }
  }

  /**
   * Extrai opções de filtros dinamicamente com suporte a filtro inteligente por empresa
   */
  static extractFilterOptions(
    lancamentos: DreCaixaLancamento[],
    selectedEmpresas: string[] = []
  ) {
    const empresasSet = new Set<string>();
    const allPeriodosMap = new Map<string, number>();
    const periodosMap = new Map<string, number>();
    const projetosSet = new Set<string>();
    const categoriasSet = new Set<string>();
    const fornecedoresSet = new Set<string>();
    const contasCorrentesSet = new Set<string>();

    const lowerEmpresas = (selectedEmpresas || []).map(e => e.trim().toLowerCase());
    const hasEmpresaFilter = lowerEmpresas.length > 0;

    let countAVista = 0;
    let countParcelado = 0;

    lancamentos.forEach(l => {
      // 1. Empresas e períodos globais sempre são extraídos de todos os lançamentos
      if (l.empresa) empresasSet.add(l.empresa);
      if (l.periodo && l.periodo !== 'N/A') allPeriodosMap.set(l.periodo, l.periodoNum);

      // 2. Filtro inteligente: opções de Projetos, Categorias, Favorecidos e Contas
      // pertencem estritamente à(s) empresa(s) filtrada(s)
      const itemEmp = (l.empresa || '').trim().toLowerCase();
      const matchesEmpresa = !hasEmpresaFilter || lowerEmpresas.includes(itemEmp);

      if (matchesEmpresa) {
        if (l.tipo_pagamento === 'PARCELADO') {
          countParcelado++;
        } else {
          countAVista++;
        }
        if (l.periodo && l.periodo !== 'N/A') periodosMap.set(l.periodo, l.periodoNum);
        if (l.projeto) projetosSet.add(l.projeto);
        if (l.categoria) categoriasSet.add(l.categoria);
        if (l.fornecedor_cliente) fornecedoresSet.add(l.fornecedor_cliente);
        if (l.conta_corrente) contasCorrentesSet.add(l.conta_corrente);
      }
    });

    // Se houver períodos na empresa filtrada, usa eles ordenados (mais recentes primeiro)
    const activePeriodosMap = periodosMap.size > 0 ? periodosMap : allPeriodosMap;
    const periodosSorted = Array.from(activePeriodosMap.entries())
      .sort((a, b) => b[1] - a[1]) // mais recentes primeiro
      .map(entry => entry[0]);

    return {
      empresas: Array.from(empresasSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      periodos: periodosSorted,
      allPeriodos: Array.from(allPeriodosMap.entries()).sort((a, b) => b[1] - a[1]).map(entry => entry[0]),
      projetos: Array.from(projetosSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      categorias: Array.from(categoriasSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      fornecedores: Array.from(fornecedoresSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      contasCorrentes: Array.from(contasCorrentesSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      counts: {
        aVista: countAVista,
        parcelado: countParcelado,
        total: countAVista + countParcelado
      }
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

    const ocultarCats = (filters.ocultarCategorias || []).map(c => c.trim().toLowerCase());
    const ocultarProjs = (filters.ocultarProjetos || []).map(p => p.trim().toLowerCase());
    const ocultarForns = (filters.ocultarFornecedores || []).map(f => f.trim().toLowerCase());

    return lancamentos.filter(l => {
      // 0. REGRA DE DADOS SENSÍVEIS (OCULTAÇÃO EXECUTIVA)
      if (ocultarCats.length > 0 && ocultarCats.includes((l.categoria || '').trim().toLowerCase())) return false;
      if (ocultarProjs.length > 0 && ocultarProjs.includes((l.projeto || '').trim().toLowerCase())) return false;
      if (ocultarForns.length > 0 && ocultarForns.includes((l.fornecedor_cliente || '').trim().toLowerCase())) return false;

      // 1. Filtro de Empresa com normalização insensível a maiúsculas/minúsculas
      if (lowerEmpresas.length > 0) {
        const itemEmp = (l.empresa || '').trim().toLowerCase();
        if (!lowerEmpresas.includes(itemEmp)) return false;
      }

      // 2. Filtro de Modalidade (À Vista vs Parcelado)
      if (filters.tipoPagamento && filters.tipoPagamento !== 'TODOS') {
        if (l.tipo_pagamento !== filters.tipoPagamento) return false;
      }

      // 3. Filtro de Período
      if (filterPeriodos.length > 0 && !filterPeriodos.includes(l.periodo)) return false;

      // 4. Filtro de Projeto / Setor
      if (filterProjetos.length > 0 && !filterProjetos.includes(l.projeto)) return false;

      // 5. Filtro de Categoria
      if (filterCategorias.length > 0 && !filterCategorias.includes(l.categoria)) return false;

      // 6. Filtro de Fornecedor / Cliente
      if (filterFornecedores.length > 0 && !filterFornecedores.includes(l.fornecedor_cliente)) return false;

      // 7. Filtro de Conta Corrente
      if (filterContas.length > 0 && !filterContas.includes(l.conta_corrente)) return false;

      // 8. Busca Textual Livre
      if (searchQuery) {
        const matchForn = l.fornecedor_cliente.toLowerCase().includes(searchQuery);
        const matchCat = l.categoria.toLowerCase().includes(searchQuery);
        const matchProj = l.projeto.toLowerCase().includes(searchQuery);
        const matchConta = l.conta_corrente.toLowerCase().includes(searchQuery);
        const matchDoc = l.numero_documento ? l.numero_documento.toLowerCase().includes(searchQuery) : false;
        const matchParc = l.numero_parcela ? l.numero_parcela.toLowerCase().includes(searchQuery) : false;
        if (!matchForn && !matchCat && !matchProj && !matchConta && !matchDoc && !matchParc) return false;
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
    const subEntradasMap: Record<string, Record<string, number>> = {};
    const subCustosMap: Record<string, Record<string, number>> = {};
    const subDespesasMap: Record<string, Record<string, number>> = {};

    filtered.forEach(l => {
      const mes = l.periodo;
      if (!mes || entradasValores[mes] === undefined) return;

      const catLower = l.categoria.toLowerCase();
      const isReceita = l.tipo === 'RECEBER' || catLower.includes('receita') || catLower.includes('faturamento') || catLower.includes('venda de');

      if (isReceita) {
        entradasValores[mes] += l.valor;
        const catNome = l.categoria || 'Receita de Serviços / Operacional';
        if (!subEntradasMap[catNome]) {
          subEntradasMap[catNome] = {};
          mesesColunas.forEach(m => { subEntradasMap[catNome][m] = 0; });
        }
        subEntradasMap[catNome][mes] += l.valor;
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
        totalPeriodo: sumValues(entradasValores),
        subItens: Object.entries(subEntradasMap)
          .map(([desc, vals]) => ({
            descricao: desc,
            valoresPorMes: vals,
            totalPeriodo: sumValues(vals)
          }))
          .sort((a, b) => b.totalPeriodo - a.totalPeriodo)
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

  /**
   * Auditoria Executiva de Compras & Desembolsos para Reunião de Diretoria (C-Level)
   * Segrega compras operacionais de despesas recorrentes estruturais,
   * decompõe parcelas em à vista (1/1), novas compras (1/N) e quitação de compras passadas (>1/N),
   * e detalha os gastos de cartões corporativos e Flash por Projeto, Categoria e Favorecido.
   */
  static computePurchasesAudit(
    lancamentos: DreCaixaLancamento[],
    selectedConta?: string,
    onlyCompras: boolean = false
  ): PurchasesAuditSummary {
    const pagamentos = lancamentos.filter(l => l.sinal_valor < 0 || l.tipo === 'PAGAR');

    let totalGeralPago = 0;
    let totalCompras = 0;
    let totalRecorrente = 0;
    let totalAVista = 0;
    let totalNovasParceladas = 0;
    let totalAmortizacaoAnterior = 0;
    let totalComprometimentoFuturo = 0;

    const empMap = new Map<string, { totalGeral: number; totalCompras: number; totalRecorrente: number; aVista: number; parcelado: number; amortizacaoPassada: number; count: number }>();
    const cartaoMap = new Map<string, { total: number; count: number; isCartao: boolean; isFlash: boolean }>();
    const catMap = new Map<string, { total: number; count: number }>();
    const fornMap = new Map<string, { total: number; count: number; aVista: number; parcelado: number; amortizacao: number; parcelas: Set<string> }>();

    // Flash sub-analytics
    const flashProjMap = new Map<string, { total: number; count: number }>();
    const flashCatMap = new Map<string, { total: number; count: number }>();
    const flashFornMap = new Map<string, { total: number; count: number }>();

    // Selected Conta sub-analytics
    const selProjMap = new Map<string, { total: number; count: number }>();
    const selCatMap = new Map<string, { total: number; count: number }>();
    const selFornMap = new Map<string, { total: number; count: number }>();
    let selContaTotal = 0;
    let selContaCount = 0;

    pagamentos.forEach(item => {
      const val = Math.abs(item.valor);
      const isRec = isDespesaRecorrente(item.categoria, item.conta_dre, item.fornecedor_cliente);

      // 1. Cartões e Meios de Pagamento: sempre apura todos os cartões para manter a visão comparativa e o seletor completo
      const cc = decodeHtmlEntities(item.conta_corrente || 'Conta Operacional');
      const ccLower = cc.toLowerCase();
      const isFlash = ccLower.includes('flash');
      const isCartao = isFlash || ccLower.includes('cartão') || ccLower.includes('cartao') || ccLower.includes('clara') || ccLower.includes('elo') || ccLower.includes('sicredi') || ccLower.includes('visa');

      if (!cartaoMap.has(cc)) {
        cartaoMap.set(cc, { total: 0, count: 0, isCartao, isFlash });
      }
      const ccEntry = cartaoMap.get(cc)!;
      ccEntry.total += val;
      ccEntry.count += 1;

      // 2. Se o usuário selecionou uma conta/cartão específico, isolamos toda a apuração (KPIs, parcelas, categorias e fornecedores) para essa conta
      const matchesConta = !selectedConta || (cc.trim().toLowerCase() === selectedConta.trim().toLowerCase());
      if (!matchesConta) return;

      totalGeralPago += val;
      if (isRec) {
        totalRecorrente += val;
      } else {
        totalCompras += val;
      }

      // Se o usuário optou por auditar estritamente compras, ignora recorrentes
      if (onlyCompras && isRec) return;

      const pAtual = item.parcela_atual || 1;
      const pTotal = item.total_parcelas || 1;
      const isAVista = (pAtual === 1 && pTotal === 1) || item.tipo_pagamento === 'A_VISTA';
      const isNovaParcelada = pAtual === 1 && pTotal > 1;
      const isAmortizacaoPassada = pAtual > 1;

      if (isAVista) {
        totalAVista += val;
      } else if (isNovaParcelada) {
        totalNovasParceladas += val;
        totalComprometimentoFuturo += val * (pTotal - 1);
      } else if (isAmortizacaoPassada) {
        totalAmortizacaoAnterior += val;
      }

      // 3. Distribuição por Empresa
      const emp = normalizeEmpresa(item.empresa);
      if (!empMap.has(emp)) {
        empMap.set(emp, { totalGeral: 0, totalCompras: 0, totalRecorrente: 0, aVista: 0, parcelado: 0, amortizacaoPassada: 0, count: 0 });
      }
      const empEntry = empMap.get(emp)!;
      empEntry.totalGeral += val;
      if (isRec) empEntry.totalRecorrente += val;
      else empEntry.totalCompras += val;
      empEntry.count += 1;
      if (isAVista) empEntry.aVista += val;
      else if (isNovaParcelada) empEntry.parcelado += val;
      else empEntry.amortizacaoPassada += val;

      // 4. Categoria de Compras
      const cat = decodeHtmlEntities(item.categoria || 'Geral');
      if (!catMap.has(cat)) {
        catMap.set(cat, { total: 0, count: 0 });
      }
      const catEntry = catMap.get(cat)!;
      catEntry.total += val;
      catEntry.count += 1;

      // 5. Fornecedor
      const forn = decodeHtmlEntities(item.fornecedor_cliente || 'Outros / Não Informado');
      if (!fornMap.has(forn)) {
        fornMap.set(forn, { total: 0, count: 0, aVista: 0, parcelado: 0, amortizacao: 0, parcelas: new Set() });
      }
      const fornEntry = fornMap.get(forn)!;
      fornEntry.total += val;
      fornEntry.count += 1;
      if (isAVista) fornEntry.aVista += val;
      else if (isNovaParcelada) fornEntry.parcelado += val;
      else fornEntry.amortizacao += val;
      if (item.numero_parcela) fornEntry.parcelas.add(item.numero_parcela);

      // 6. Flash Detalhamento (por Projeto, Categoria e Favorecido)
      if (isFlash) {
        const proj = decodeHtmlEntities(item.projeto || 'Operacional / Geral');
        flashProjMap.set(proj, {
          total: (flashProjMap.get(proj)?.total || 0) + val,
          count: (flashProjMap.get(proj)?.count || 0) + 1
        });
        flashCatMap.set(cat, {
          total: (flashCatMap.get(cat)?.total || 0) + val,
          count: (flashCatMap.get(cat)?.count || 0) + 1
        });
        flashFornMap.set(forn, {
          total: (flashFornMap.get(forn)?.total || 0) + val,
          count: (flashFornMap.get(forn)?.count || 0) + 1
        });
      }

      // 7. Selected Conta Detalhamento (para raio-x de qualquer conta/cartão em foco)
      if (selectedConta) {
        selContaTotal += val;
        selContaCount += 1;
        const proj = decodeHtmlEntities(item.projeto || 'Operacional / Geral');
        selProjMap.set(proj, {
          total: (selProjMap.get(proj)?.total || 0) + val,
          count: (selProjMap.get(proj)?.count || 0) + 1
        });
        selCatMap.set(cat, {
          total: (selCatMap.get(cat)?.total || 0) + val,
          count: (selCatMap.get(cat)?.count || 0) + 1
        });
        selFornMap.set(forn, {
          total: (selFornMap.get(forn)?.total || 0) + val,
          count: (selFornMap.get(forn)?.count || 0) + 1
        });
      }
    });

    const baseComprasTotal = onlyCompras ? totalCompras : totalGeralPago;
    const percentualCompras = totalGeralPago > 0 ? (totalCompras / totalGeralPago) * 100 : 0;

    const porEmpresa = Array.from(empMap.entries())
      .map(([empresa, data]) => ({ empresa, ...data }))
      .sort((a, b) => b.totalCompras - a.totalCompras);

    const porCartao = Array.from(cartaoMap.entries())
      .map(([conta, data]) => ({ conta, ...data }))
      .sort((a, b) => b.total - a.total);

    const porCategoriaCompras = Array.from(catMap.entries())
      .map(([categoria, data]) => ({
        categoria,
        total: data.total,
        count: data.count,
        percentual: baseComprasTotal > 0 ? (data.total / baseComprasTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    const topFornecedoresCompras = Array.from(fornMap.entries())
      .map(([fornecedor, data]) => {
        let modalidade = 'À vista';
        if (data.parcelado > 0 && data.aVista > 0) modalidade = 'Misto (À vista / Parc)';
        else if (data.parcelado > 0) modalidade = 'Parcelado';
        else if (data.amortizacao > 0) modalidade = 'Amortização Anterior';

        const parcelasExemplo = Array.from(data.parcelas).slice(0, 3).join(', ') || (data.aVista > 0 ? '1/1' : '-');

        return {
          fornecedor,
          total: data.total,
          count: data.count,
          modalidade,
          parcelasExemplo,
          percentual: baseComprasTotal > 0 ? (data.total / baseComprasTotal) * 100 : 0
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    const totalFlash = Array.from(flashProjMap.values()).reduce((acc, p) => acc + p.total, 0);

    const flashPorProjeto = Array.from(flashProjMap.entries())
      .map(([projeto, data]) => ({
        projeto,
        total: data.total,
        count: data.count,
        percentual: totalFlash > 0 ? (data.total / totalFlash) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    const flashPorCategoria = Array.from(flashCatMap.entries())
      .map(([categoria, data]) => ({
        categoria,
        total: data.total,
        count: data.count,
        percentual: totalFlash > 0 ? (data.total / totalFlash) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    const flashPorFavorecido = Array.from(flashFornMap.entries())
      .map(([favorecido, data]) => ({
        favorecido,
        total: data.total,
        count: data.count,
        percentual: totalFlash > 0 ? (data.total / totalFlash) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    let detalheContaSelecionada: PurchasesAuditSummary['detalheContaSelecionada'] = undefined;
    if (selectedConta) {
      detalheContaSelecionada = {
        conta: selectedConta,
        total: selContaTotal,
        count: selContaCount,
        projetos: Array.from(selProjMap.entries()).map(([projeto, data]) => ({
          projeto,
          total: data.total,
          count: data.count,
          percentual: selContaTotal > 0 ? (data.total / selContaTotal) * 100 : 0
        })).sort((a, b) => b.total - a.total),
        categorias: Array.from(selCatMap.entries()).map(([categoria, data]) => ({
          categoria,
          total: data.total,
          count: data.count,
          percentual: selContaTotal > 0 ? (data.total / selContaTotal) * 100 : 0
        })).sort((a, b) => b.total - a.total),
        fornecedores: Array.from(selFornMap.entries()).map(([fornecedor, data]) => ({
          fornecedor,
          total: data.total,
          count: data.count,
          percentual: selContaTotal > 0 ? (data.total / selContaTotal) * 100 : 0
        })).sort((a, b) => b.total - a.total),
      };
    }

    return {
      totalGeralPago,
      totalCompras,
      totalRecorrente,
      percentualCompras,
      totalAVista,
      totalNovasParceladas,
      totalAmortizacaoAnterior,
      totalComprometimentoFuturo,
      porEmpresa,
      porCartao,
      porCategoriaCompras,
      topFornecedoresCompras,
      flashPorProjeto,
      flashPorCategoria,
      flashPorFavorecido,
      detalheContaSelecionada
    };
  }
}

/**
 * Função de Classificação Econômica:
 * Segrega Despesas Operacionais Recorrentes / Estruturais (Overhead / Folha / Aluguel / Tributos)
 * de Compras & Aquisições Efetivas (Procurement / Materiais / Insumos / Serviços pontuais / Cartões / Flash).
 */
export function isDespesaRecorrente(categoria: string, contaDre?: string, fornecedor?: string): boolean {
  const cat = (categoria || '').toLowerCase();
  const dre = (contaDre || '').toLowerCase();
  const forn = (fornecedor || '').toLowerCase();
  const str = `${cat} ${dre} ${forn}`;

  // 1. Folha de Pagamento, Pró-Labore e Encargos
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
    str.includes('unimed') || str.includes('bradesco saúde') ||
    str.includes('previdência') || str.includes('previdencia')
  ) {
    return true;
  }

  // 2. Ocupação, Concessionárias e Infraestrutura Física Contínua
  if (
    str.includes('aluguel') || str.includes('locação de imóvel') || str.includes('locacao de imovel') ||
    str.includes('condomínio') || str.includes('condominio') ||
    str.includes('energia elétrica') || str.includes('energia eletrica') || str.includes('enel') || str.includes('cpfl') ||
    str.includes('água e esgoto') || str.includes('agua e esgoto') || str.includes('sabesp') || str.includes('sanepar') ||
    str.includes('iptu') ||
    str.includes('telefonia fixa') || str.includes('internet fixa')
  ) {
    return true;
  }

  // 3. Honorários Estruturais Contínuos
  if (
    str.includes('honorários contábeis') || str.includes('honorarios contabeis') || str.includes('assessoria contábil') || str.includes('contabilidade') ||
    str.includes('honorários advocatícios') || str.includes('honorarios advocaticios')
  ) {
    return true;
  }

  // 4. Tributos, Taxas e Encargos Financeiros Contínuos
  if (
    str.includes('simples nacional') || str.includes('das ') ||
    str.includes('iss ') || str.includes('issqn') ||
    str.includes('pis ') || str.includes('cofins') ||
    str.includes('irpj') || str.includes('csll') ||
    str.includes('tarifa bancária') || str.includes('tarifa bancaria') ||
    str.includes('tarifas bancárias') || str.includes('tarifas bancarias') ||
    str.includes('taxa de administração') || str.includes('taxa de administracao') ||
    str.includes('juros e encargos') || str.includes('iof')
  ) {
    return true;
  }

  return false;
}

