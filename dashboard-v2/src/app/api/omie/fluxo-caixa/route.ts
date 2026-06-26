import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Formatar datas ISO YYYY-MM-DD para BR DD/MM/YYYY para a chamada da Omie
    const brStart = startDate.split('-').reverse().join('/');
    const brEnd = endDate.split('-').reverse().join('/');

    // 1. Buscar Dimensões do Supabase para tradução rápida de códigos em descrições
    const [catData, projData, fornData] = await Promise.all([
      supabase.from('omie_dim_categorias').select('codigo_categoria, descricao_categoria, empresa_nome'),
      supabase.from('omie_dim_projetos').select('codigo_projeto, descricao_projeto, empresa_nome'),
      supabase.from('omie_dim_fornecedores').select('codigo_cliente_omie, nome_fantasia, razao_social, empresa_nome')
    ]);

    // Criar mapas indexados por `${empresa}-${codigo}` para resolução instantânea
    const dimCategorias = new Map<string, string>();
    (catData.data || []).forEach(c => {
      const emp = String(c.empresa_nome || '').toUpperCase().trim();
      const cod = String(c.codigo_categoria || '').trim();
      if (emp && cod) dimCategorias.set(`${emp}-${cod}`, c.descricao_categoria);
    });

    const dimProjetos = new Map<string, string>();
    (projData.data || []).forEach(p => {
      const emp = String(p.empresa_nome || '').toUpperCase().trim();
      const cod = String(p.codigo_projeto || '').trim();
      if (emp && cod) dimProjetos.set(`${emp}-${cod}`, p.descricao_projeto);
    });

    const dimFornecedores = new Map<string, string>();
    (fornData.data || []).forEach(f => {
      const emp = String(f.empresa_nome || '').toUpperCase().trim();
      const cod = String(f.codigo_cliente_omie || '').trim();
      const nome = f.nome_fantasia || f.razao_social || '';
      if (emp && cod && nome) dimFornecedores.set(`${emp}-${cod}`, nome);
    });

    // Identificar quais empresas consultar na Omie
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
        // Buscar em paralelo no Omie: CP, CR e Movimentos
        const [cpRaw, crRaw, movRaw] = await Promise.all([
          fetchOmieCP(comp.key, comp.secret, brStart, brEnd),
          fetchOmieCR(comp.key, comp.secret, brStart, brEnd),
          fetchOmieMovimentos(comp.key, comp.secret, brStart, brEnd)
        ]);

        // 1. Processar Contas a Pagar
        const cpProcessed = processCPCR(cpRaw, comp.name, 'PAGAR', dimCategorias, dimProjetos, dimFornecedores);
        allRecords.push(...cpProcessed);

        // 2. Processar Contas a Receber
        const crProcessed = processCPCR(crRaw, comp.name, 'RECEBER', dimCategorias, dimProjetos, dimFornecedores);
        allRecords.push(...crProcessed);

        // 3. Processar Movimentos (Apenas avulsos, sem vínculo com títulos para evitar duplicidades)
        const movProcessed = processMovimentos(movRaw, comp.name, dimCategorias, dimProjetos);
        allRecords.push(...movProcessed);

      } catch (err: any) {
        errors.push(`Erro ao consultar dados da empresa ${comp.name}: ${err.message}`);
      }
    }

    // REGRA DE OURO / PROTEÇÃO DE DATA:
    // Filtrar estritamente o resultado final para manter apenas transações cuja data de alocação 
    // (pagamento para realizados, vencimento para previstos) esteja dentro do período solicitado!
    const strictlyFilteredRecords = allRecords.filter(item => {
      return item.data_alocacao >= startDate && item.data_alocacao <= endDate;
    });

    // Ordenar do mais recente para o mais antigo
    strictlyFilteredRecords.sort((a, b) => b.data_alocacao.localeCompare(a.data_alocacao));

    return NextResponse.json({
      status: errors.length > 0 && strictlyFilteredRecords.length === 0 ? 'error' : errors.length > 0 ? 'partial' : 'success',
      count: strictlyFilteredRecords.length,
      data: strictlyFilteredRecords,
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

  while (pagina <= 10) {
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

function processCPCR(
  records: any[], 
  companyName: string, 
  tipo: 'PAGAR' | 'RECEBER',
  dimCategorias: Map<string, string>,
  dimProjetos: Map<string, string>,
  dimFornecedores: Map<string, string>
): FluxoLancamento[] {
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

    // Resolução de Dimensões usando os mapas locais carregados do Supabase
    const cleanCompany = companyName.toUpperCase().trim();
    
    const catCode = String(r.codigo_categoria || '').trim();
    const catKey = `${cleanCompany}-${catCode}`;
    const categoriaNome = dimCategorias.get(catKey) || r.descricao_categoria || `Categoria: ${catCode}`;

    const projCode = String(r.codigo_projeto || '').trim();
    const projKey = `${cleanCompany}-${projCode}`;
    const projetoNome = dimProjetos.get(projKey) || r.nome_projeto || (projCode ? `Projeto: ${projCode}` : 'Sem Projeto');

    const fornCode = String(r.codigo_cliente_fornecedor || '').trim();
    const fornKey = `${cleanCompany}-${fornCode}`;
    const clienteFornecedor = dimFornecedores.get(fornKey) || 
                              r.nm_cliente || 
                              r.cnab_integracao_bancaria?.nome_transferencia || 
                              (fornCode ? `Cód. Cliente: ${fornCode}` : 'Fornecedor/Cliente');

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
          categoria_codigo: catCode,
          categoria_nome: categoriaNome,
          projeto_nome: projetoNome,
          departamento_nome: d.cDesDep || 'Sem Departamento',
          cliente_fornecedor: clienteFornecedor,
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
        categoria_codigo: catCode,
        categoria_nome: categoriaNome,
        projeto_nome: projetoNome,
        departamento_nome: 'Sem Departamento',
        cliente_fornecedor: clienteFornecedor,
        numero_documento: r.numero_documento || null,
        observacao: r.observacao || null
      });
    }
  }

  return list;
}

function processMovimentos(
  records: any[], 
  companyName: string,
  dimCategorias: Map<string, string>,
  dimProjetos: Map<string, string>
): FluxoLancamento[] {
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

    const cleanCompany = companyName.toUpperCase().trim();
    
    const catCode = String(det.cCodCateg || '').trim();
    const catKey = `${cleanCompany}-${catCode}`;
    const categoriaNome = dimCategorias.get(catKey) || det.cDesCateg || `Categoria: ${catCode}`;

    const projCode = String(det.nCodProjeto || '').trim();
    const projKey = `${cleanCompany}-${projCode}`;
    const projetoNome = dimProjetos.get(projKey) || det.cDesProjeto || (projCode ? `Projeto: ${projCode}` : 'Sem Projeto');

    list.push({
      id_global: `mov_${omieId}`,
      omie_id: omieId,
      empresa: companyName,
      tipo: 'MOVIMENTO',
      status: 'PAGO',
      valor_total: valor * sign,
      valor_alocado: valor * sign,
      data_emissao: formatOmieDateToISO(det.dDtEmissao),
      data_registro: dtReg,
      data_vencimento: dtVenc,
      data_pagamento: dtPagto || dataAlocacao,
      data_alocacao: dataAlocacao,
      categoria_codigo: catCode,
      categoria_nome: categoriaNome,
      projeto_nome: projetoNome,
      departamento_nome: det.cDesDep || 'Principal',
      cliente_fornecedor: det.cNomeCliente || det.cDesMov || det.cFavorecido || 'Banco / Tarifa',
      numero_documento: det.cNumDocFiscal || null,
      observacao: det.cObs || m.resumo?.cObs || null
    });
  }

  return list;
}
