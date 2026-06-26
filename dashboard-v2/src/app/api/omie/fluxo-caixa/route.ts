import { NextResponse } from 'next/server';

// Interface de saída unificada para o Fluxo de Caixa
interface FluxoLancamento {
  id_global: string;
  omie_id: string;
  empresa: string;
  tipo: 'RECEBER' | 'PAGAR' | 'MOVIMENTO';
  status: 'PAGO' | 'ABERTO' | 'ATRASADO';
  valor_total: number;
  valor_alocado: number;
  data_emissao: string | null;
  data_registro: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  data_alocacao: string; // Vencimento para abertos, Pagamento para realizados
  categoria_codigo: string;
  categoria_nome: string;
  projeto_nome: string;
  departamento_nome: string;
  cliente_fornecedor: string;
  numero_documento: string | null;
  observacao: string | null;
}

export async function POST(req: Request) {
  try {
    const reqData = await req.json();
    const { startDate, endDate, company } = reqData;

    if (!startDate || !endDate) {
      return NextResponse.json({ status: 'error', message: 'Faltam parâmetros de data.' }, { status: 400 });
    }

    const companyName = company || 'Ambas';

    // Formatar datas ISO YYYY-MM-DD para BR DD/MM/YYYY
    const brStart = startDate.split('-').reverse().join('/');
    const brEnd = endDate.split('-').reverse().join('/');

    // Identificar quais empresas consultar
    const companiesToSync: { name: string; key: string | undefined; secret: string | undefined }[] = [];
    
    if (companyName === 'Ambas' || companyName.toUpperCase().includes('MAR BRASIL')) {
      companiesToSync.push({
        name: 'Mar Brasil',
        key: process.env.OMIE_APP_KEY_MARBRASIL,
        secret: process.env.OMIE_APP_SECRET_MARBRASIL
      });
    }
    
    if (companyName === 'Ambas' || companyName.toUpperCase().includes('DZM')) {
      companiesToSync.push({
        name: 'DZM',
        key: process.env.OMIE_APP_KEY_DZM,
        secret: process.env.OMIE_APP_SECRET_DZM
      });
    }

    const allRecords: FluxoLancamento[] = [];
    const errors: string[] = [];

    // Para cada empresa selecionada
    for (const comp of companiesToSync) {
      if (!comp.key || !comp.secret) {
        errors.push(`Credenciais não configuradas para a empresa ${comp.name}.`);
        continue;
      }

      try {
        // Buscar em paralelo: CP, CR e Movimentos
        const [cpRaw, crRaw, movRaw] = await Promise.all([
          fetchOmieCP(comp.key, comp.secret, brStart, brEnd),
          fetchOmieCR(comp.key, comp.secret, brStart, brEnd),
          fetchOmieMovimentos(comp.key, comp.secret, brStart, brEnd)
        ]);

        // 1. Processar Contas a Pagar (Saídas)
        const cpProcessed = processCPCR(cpRaw, comp.name, 'PAGAR');
        allRecords.push(...cpProcessed);

        // 2. Processar Contas a Receber (Entradas)
        const crProcessed = processCPCR(crRaw, comp.name, 'RECEBER');
        allRecords.push(...crProcessed);

        // 3. Processar Movimentos (Apenas avulsos, sem vínculo com títulos para evitar duplicidades)
        const movProcessed = processMovimentos(movRaw, comp.name);
        allRecords.push(...movProcessed);

      } catch (err: any) {
        errors.push(`Erro ao consultar dados da empresa ${comp.name}: ${err.message}`);
      }
    }

    // Ordenar do mais recente para o mais antigo de acordo com a data de alocação
    allRecords.sort((a, b) => b.data_alocacao.localeCompare(a.data_alocacao));

    return NextResponse.json({
      status: errors.length > 0 && allRecords.length === 0 ? 'error' : errors.length > 0 ? 'partial' : 'success',
      count: allRecords.length,
      data: allRecords,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: `Erro interno no servidor: ${error.message}` }, { status: 500 });
  }
}

// --- FUNÇÕES AUXILIARES DE BUSCA DA API DO OMIE ---

async function callOmieAPI(url: string, call: string, appKey: string, appSecret: string, param: any) {
  const payload = {
    call,
    app_key: appKey,
    app_secret: appSecret,
    param: [param]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Falha HTTP ${response.status} na chamada ${call}`);
  }

  const data = await response.json();
  if (data.faultstring) {
    const fault = data.faultstring;
    if (fault.includes('Nenhum registro encontrado') || fault.includes('Nao existem registros')) {
      return null; // Tratar como vazio
    }
    throw new Error(`Erro Omie (${call}): ${fault}`);
  }

  return data;
}

// Buscar Contas a Pagar por Vencimento no Período
async function fetchOmieCP(appKey: string, appSecret: string, brStart: string, brEnd: string): Promise<any[]> {
  const url = 'https://app.omie.com.br/api/v1/financas/contapagar/';
  let pagina = 1;
  const limit = 100;
  const results: any[] = [];

  while (pagina <= 10) { // Limite preventivo de 10 páginas para evitar loops
    const data = await callOmieAPI(url, 'ListarContasPagar', appKey, appSecret, {
      pagina,
      registros_por_pagina: limit,
      filtrar_por_data_de: brStart,
      filtrar_por_data_ate: brEnd
    });

    if (!data) break;

    const records = data.conta_pagar_cadastro || [];
    results.push(...records);

    if (pagina >= (data.total_de_paginas || 1)) break;
    pagina++;
  }

  return results;
}

// Buscar Contas a Receber por Vencimento no Período
async function fetchOmieCR(appKey: string, appSecret: string, brStart: string, brEnd: string): Promise<any[]> {
  const url = 'https://app.omie.com.br/api/v1/financas/contareceber/';
  let pagina = 1;
  const limit = 100;
  const results: any[] = [];

  while (pagina <= 10) {
    const data = await callOmieAPI(url, 'ListarContasReceber', appKey, appSecret, {
      pagina,
      registros_por_pagina: limit,
      filtrar_por_data_de: brStart,
      filtrar_por_data_ate: brEnd
    });

    if (!data) break;

    const records = data.conta_receber_cadastro || [];
    results.push(...records);

    if (pagina >= (data.total_de_paginas || 1)) break;
    pagina++;
  }

  return results;
}

// Buscar Movimentos Bancários por Pagamento no Período
async function fetchOmieMovimentos(appKey: string, appSecret: string, brStart: string, brEnd: string): Promise<any[]> {
  const url = 'https://app.omie.com.br/api/v1/financas/mf/';
  let pagina = 1;
  const limit = 100;
  const results: any[] = [];

  while (pagina <= 10) {
    const data = await callOmieAPI(url, 'ListarMovimentos', appKey, appSecret, {
      nPagina: pagina,
      nRegPorPagina: limit,
      dDtPagtoDe: brStart,
      dDtPagtoAte: brEnd,
      lDadosCad: true
    });

    if (!data) break;

    const records = data.movimentos || [];
    results.push(...records);

    if (pagina >= (data.nTotPaginas || 1)) break;
    pagina++;
  }

  return results;
}

// --- PROCESSADORES E NORMALIZADORES DE DADOS ---

function formatOmieDateToISO(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return `${y}-${m}-${d}`;
    }
    return dateStr.substring(0, 10);
  } catch {
    return null;
  }
}

function processCPCR(records: any[], companyName: string, tipo: 'PAGAR' | 'RECEBER'): FluxoLancamento[] {
  const list: FluxoLancamento[] = [];
  const sign = tipo === 'PAGAR' ? -1 : 1;

  for (const r of records) {
    if (r.status_titulo === 'CANCELADO') continue;

    const omieId = String(r.codigo_lancamento_omie);
    const statusRaw = String(r.status_titulo || 'ABERTO').toUpperCase();
    
    // Identificar status executivo
    let status: 'PAGO' | 'ABERTO' | 'ATRASADO' = 'ABERTO';
    const isPaid = statusRaw.includes('PAGO') || statusRaw.includes('LIQUIDADO');
    
    const dtVencISO = formatOmieDateToISO(r.data_vencimento);
    const todayStr = new Date().toISOString().split('T')[0];

    if (isPaid) {
      status = 'PAGO';
    } else if (dtVencISO && dtVencISO < todayStr) {
      status = 'ATRASADO';
    }

    // Data de pagamento: baixa > liquidação > previsão
    const dtPagamento = formatOmieDateToISO(r.data_baixa || r.data_liquidacao || (isPaid ? r.data_previsao : null));
    const dtVencimento = dtVencISO;
    const dtEmissao = formatOmieDateToISO(r.data_emissao);
    const dtRegistro = formatOmieDateToISO(r.data_entrada || r.data_registro);

    // Regra de Ouro: Data de Alocação no Fluxo de Caixa
    // Se Pago/Realizado -> usa data de pagamento. Senão -> usa data de vencimento.
    const dataAlocacao = (status === 'PAGO' && dtPagamento) ? dtPagamento : (dtVencimento || todayStr);

    const valorDocumento = Number(r.valor_documento || 0);

    // Mapear rateio por departamentos
    const dist = r.distribuicao || [];
    if (dist.length > 0) {
      dist.forEach((d: any, index: number) => {
        const valorAlocado = Number(d.nValDep || 0);
        list.push({
          id_global: `${tipo.toLowerCase()}_${omieId}_dept_${index}`,
          omie_id: omieId,
          empresa: companyName,
          tipo,
          status,
          valor_total: valorDocumento * sign,
          valor_alocado: valorAlocado * sign,
          data_emissao: dtEmissao,
          data_registro: dtRegistro,
          data_vencimento: dtVencimento,
          data_pagamento: dtPagamento,
          data_alocacao: dataAlocacao,
          categoria_codigo: r.codigo_categoria || '',
          categoria_nome: r.descricao_categoria || 'Sem Categoria',
          projeto_nome: r.nome_projeto || 'Sem Projeto',
          departamento_nome: d.cDesDep || 'Sem Departamento',
          cliente_fornecedor: r.nm_cliente || r.cnab_integracao_bancaria?.nome_transferencia || 'Fornecedor/Cliente',
          numero_documento: r.numero_documento || null,
          observacao: r.observacao || null
        });
      });
    } else {
      list.push({
        id_global: `${tipo.toLowerCase()}_${omieId}`,
        omie_id: omieId,
        empresa: companyName,
        tipo,
        status,
        valor_total: valorDocumento * sign,
        valor_alocado: valorDocumento * sign,
        data_emissao: dtEmissao,
        data_registro: dtRegistro,
        data_vencimento: dtVencimento,
        data_pagamento: dtPagamento,
        data_alocacao: dataAlocacao,
        categoria_codigo: r.codigo_categoria || '',
        categoria_nome: r.descricao_categoria || 'Sem Categoria',
        projeto_nome: r.nome_projeto || 'Sem Projeto',
        departamento_nome: 'Sem Departamento',
        cliente_fornecedor: r.nm_cliente || r.cnab_integracao_bancaria?.nome_transferencia || 'Fornecedor/Cliente',
        numero_documento: r.numero_documento || null,
        observacao: r.observacao || null
      });
    }
  }

  return list;
}

function processMovimentos(records: any[], companyName: string): FluxoLancamento[] {
  const list: FluxoLancamento[] = [];

  for (const m of records) {
    const det = m.detalhes || {};
    
    // Regra crucial: ignorar transferências internas
    if (det.cCodCateg === '0.01') continue;

    // Regra crucial: ignorar se tiver vínculo com título (nCodTitulo > 0) para evitar duplicidade de baixa
    const nCodTitulo = Number(det.nCodTitulo || 0);
    if (nCodTitulo > 0) continue;

    // Apenas saídas e entradas avulsas (tipo 'S' e 'E' do Omie)
    const statusRaw = String(det.cStatus || 'PAGO').toUpperCase();
    if (statusRaw === 'CANCELADO') continue;

    const omieId = String(det.nCodMovCC);
    const tipo = det.cTipo === 'E' ? 'RECEBER' : 'PAGAR'; // Mapeado para o sinal de fluxo
    const sign = tipo === 'PAGAR' ? -1 : 1;

    const valor = Number(det.nValorMovCC || m.resumo?.nValPago || m.resumo?.nValLiquido || 0);

    const dtPagto = formatOmieDateToISO(det.dDtPagto || det.dDtPagamento || det.dDataPagamento);
    const dtReg = formatOmieDateToISO(det.dDtRegistro);
    const dtVenc = formatOmieDateToISO(det.dDtVenc);

    // Como são movimentos de extrato, representam caixa realizado (PAGO)
    const dataAlocacao = dtPagto || dtReg || dtVenc || new Date().toISOString().split('T')[0];

    list.push({
      id_global: `mov_${omieId}`,
      omie_id: omieId,
      empresa: companyName,
      tipo: 'MOVIMENTO', // Mantemos tipo_registro MOVIMENTO para diferenciar visualmente na tabela
      status: 'PAGO',
      valor_total: valor * sign,
      valor_alocado: valor * sign,
      data_emissao: formatOmieDateToISO(det.dDtEmissao),
      data_registro: dtReg,
      data_vencimento: dtVenc,
      data_pagamento: dtPagto || dataAlocacao,
      data_alocacao: dataAlocacao,
      categoria_codigo: det.cCodCateg || '',
      categoria_nome: det.cDesCateg || 'Sem Categoria',
      projeto_nome: det.cDesProjeto || 'Sem Projeto',
      departamento_nome: det.cDesDep || 'Principal',
      cliente_fornecedor: det.cNomeCliente || det.cDesMov || det.cFavorecido || 'Banco / Tarifa',
      numero_documento: det.cNumDocFiscal || null,
      observacao: det.cObs || m.resumo?.cObs || null
    });
  }

  return list;
}
