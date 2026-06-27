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
  departamento_name: string; // Alias para compatibilidade com o frontend
  cliente_fornecedor: string;
  numero_documento: string | null;
  observacao: string | null;
}

// Helper para normalizar datas de entrada para formato ISO YYYY-MM-DD
function parseToISODate(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  return trimmed.substring(0, 10);
}

// Helper para converter data ISO para ISO YYYY-MM-DD com segurança
function formatToISODate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const trimmed = dateStr.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    return trimmed.substring(0, 10);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const reqData = await req.json();
    const { startDate, endDate, company } = reqData;

    if (!startDate || !endDate) {
      return NextResponse.json({ status: 'error', message: 'Faltam parâmetros de data.' }, { status: 400 });
    }

    // Normalização estrita de datas para formato ISO YYYY-MM-DD
    const isoStart = parseToISODate(startDate);
    const isoEnd = parseToISODate(endDate);

    if (!isoStart || !isoEnd) {
      return NextResponse.json({ status: 'error', message: 'Formato de data inválido. Use YYYY-MM-DD ou DD/MM/YYYY.' }, { status: 400 });
    }

    const companyName = company || 'Ambas';

    console.log(`[Fluxo Caixa API] Consultando DB com paginação: Start=${isoStart}, End=${isoEnd}, Company=${companyName}`);

    // 1. Consultar a tabela unificada no Supabase de forma paginada para não limitar em 1000 registros
    const allDbRecords: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('omie_financas_unificado')
        .select('*')
        .neq('status', 'CANCELADO')
        .neq('categoria_codigo', '0.01') // Ocultar transferências internas
        .range(from, from + limit - 1);

      if (companyName !== 'Ambas') {
        query = query.eq('empresa_nome', companyName);
      }

      // Filtrar data_vencimento ou data_pagamento no range amplo para depois filtrar estritamente em memória
      query = query.or(`and(data_vencimento.gte.${isoStart},data_vencimento.lte.${isoEnd}),and(data_pagamento.gte.${isoStart},data_pagamento.lte.${isoEnd})`);

      const { data, error } = await query;

      if (error) {
        console.error(`[Fluxo Caixa API] Erro ao consultar Supabase na faixa ${from}-${from+limit}:`, error);
        return NextResponse.json({ status: 'error', message: `Erro no banco: ${error.message}` }, { status: 500 });
      }

      if (data && data.length > 0) {
        allDbRecords.push(...data);
        from += limit;
        if (data.length < limit) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`[Fluxo Caixa API] Registros brutos carregados do DB: ${allDbRecords.length}`);

    // Data de referência de Hoje (para cálculo de Atrasados)
    const todayStr = new Date().toISOString().split('T')[0];
    const allRecords: FluxoLancamento[] = [];

    allDbRecords.forEach(r => {
      const statusRaw = String(r.status || 'ABERTO').toUpperCase();
      // Mapeamento correto do status RECEBIDO de contas a receber como pago/realizado
      const isPaid = statusRaw.includes('PAGO') || statusRaw.includes('LIQUIDADO') || statusRaw.includes('RECEBIDO');
      
      let status: 'PAGO' | 'ABERTO' | 'ATRASADO' = 'ABERTO';
      if (isPaid) {
        status = 'PAGO';
      } else if (r.data_vencimento && r.data_vencimento < todayStr) {
        status = 'ATRASADO';
      }

      // Regra de Ouro do Fluxo de Caixa:
      // Se Pago -> usa data_pagamento. Se Aberto/Atrasado -> usa data_vencimento.
      const dataAlocacao = (status === 'PAGO' && r.data_pagamento) ? r.data_pagamento : (r.data_vencimento || todayStr);

      // Filtro estrito de data de alocação no período selecionado
      if (dataAlocacao >= isoStart && dataAlocacao <= isoEnd) {
        const tipo = r.tipo_registro as 'RECEBER' | 'PAGAR' | 'MOVIMENTO';
        
        allRecords.push({
          id_global: r.id || `${tipo.toLowerCase()}_${r.omie_id}`,
          omie_id: String(r.omie_id),
          empresa: r.empresa_nome,
          tipo,
          status,
          valor_total: Number(r.valor_total || 0),
          valor_alocado: Number(r.valor_alocado || 0),
          data_emissao: r.data_emissao,
          data_registro: r.data_registro,
          data_vencimento: r.data_vencimento,
          data_pagamento: r.data_pagamento,
          data_alocacao: dataAlocacao,
          categoria_codigo: r.categoria_codigo || '',
          categoria_nome: r.categoria_nome || 'Sem Categoria',
          projeto_nome: r.projeto_nome || 'Sem Projeto',
          departamento_nome: r.departamento_nome || 'Sem Departamento',
          departamento_name: r.departamento_nome || 'Sem Departamento',
          cliente_fornecedor: r.cliente_fornecedor || 'N/D',
          numero_documento: r.numero_documento || null,
          observacao: r.raw_data?.observacao || r.raw_data?.detalhes?.cObs || null
        });
      }
    });

    console.log(`[Fluxo Caixa API] Retornando ${allRecords.length} lançamentos após filtragem de alocação.`);

    // Ordenar do mais recente para o mais antigo de acordo com a alocação
    allRecords.sort((a, b) => b.data_alocacao.localeCompare(a.data_alocacao));

    // 2. Disparar sincronização leve em segundo plano (non-blocking) para garantir frescor de dados recentes
    triggerBackgroundSync(companyName).catch(err => {
      console.error(`[Fluxo Caixa API] Erro na sincronização rápida em background:`, err);
    });

    return NextResponse.json({
      status: 'success',
      count: allRecords.length,
      data: allRecords
    });

  } catch (error: any) {
    console.error(`[Fluxo Caixa API] Erro crítico interno:`, error);
    return NextResponse.json({ status: 'error', message: `Erro interno no servidor: ${error.message}` }, { status: 500 });
  }
}

// --- FUNÇÃO DE SYNC RÁPIDO EM SEGUNDO PLANO (NON-BLOCKING) ---

async function triggerBackgroundSync(companyName: string) {
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

  // Se não houver credenciais, abortar
  if (companiesToSync.length === 0) return;

  // 1. Carregar Dimensões do Supabase para tradução rápida de códigos em descrições
  const [catData, projData, fornData] = await Promise.all([
    supabase.from('omie_dim_categorias').select('codigo_categoria, descricao_categoria, empresa_nome'),
    supabase.from('omie_dim_projetos').select('codigo_projeto, descricao_projeto, empresa_nome'),
    supabase.from('omie_dim_fornecedores').select('codigo_cliente_omie, nome_fantasia, razao_social, empresa_nome')
  ]);

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

  // Período de sincronização rápida: últimos 7 dias de alterações
  const d7 = new Date();
  d7.setDate(d7.getDate() - 7);
  const brStart = `${String(d7.getDate()).padStart(2, '0')}/${String(d7.getMonth() + 1).padStart(2, '0')}/${d7.getFullYear()}`;
  
  const today = new Date();
  const brEnd = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  console.log(`[Background Sync] Iniciando atualização rápida para ${companyName} (alterações de ${brStart} a ${brEnd})`);

  for (const comp of companiesToSync) {
    if (!comp.key || !comp.secret) continue;

    try {
      // Buscar alterações na Omie em paralelo
      const [cpRaw, crRaw, movRaw] = await Promise.all([
        fetchOmieCP(comp.key, comp.secret, brStart, brEnd),
        fetchOmieCR(comp.key, comp.secret, brStart, brEnd),
        fetchOmieMovimentos(comp.key, comp.secret, brStart, brEnd)
      ]);

      const rowsToUpsert: any[] = [];

      // Processar Contas a Pagar
      const cpProcessed = mapCPCRToDb(cpRaw, comp.name, 'PAGAR', dimCategorias, dimProjetos, dimFornecedores);
      rowsToUpsert.push(...cpProcessed);

      // Processar Contas a Receber
      const crProcessed = mapCPCRToDb(crRaw, comp.name, 'RECEBER', dimCategorias, dimProjetos, dimFornecedores);
      rowsToUpsert.push(...crProcessed);

      // Processar Movimentos
      const movProcessed = mapMovimentosToDb(movRaw, comp.name, dimCategorias, dimProjetos);
      rowsToUpsert.push(...movProcessed);

      if (rowsToUpsert.length > 0) {
        console.log(`[Background Sync] ${comp.name}: Atualizando ${rowsToUpsert.length} linhas em omie_financas_unificado...`);
        
        // Agrupar por tipo_registro e empresa_nome para fazer delete e insert seguros em lote (sem depender de unique constraint)
        const groups = new Map<string, any[]>();
        rowsToUpsert.forEach(row => {
          const key = `${row.empresa_nome}-${row.tipo_registro}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(row);
        });

        for (const [key, groupRows] of groups.entries()) {
          const [empresaNome, tipoRegistro] = key.split('-');
          
          // Fazer upload em lotes de 100
          const BATCH_SIZE = 100;
          for (let i = 0; i < groupRows.length; i += BATCH_SIZE) {
            const batch = groupRows.slice(i, i + BATCH_SIZE);
            const omieIds = batch.map(r => r.omie_id).filter(id => id !== null && id !== undefined && String(id) !== 'None' && String(id) !== '');

            if (omieIds.length > 0) {
              // 1. Deletar os antigos correspondentes
              const { error: deleteError } = await supabase
                .from('omie_financas_unificado')
                .delete()
                .eq('empresa_nome', empresaNome)
                .eq('tipo_registro', tipoRegistro)
                .in('omie_id', omieIds);

              if (deleteError) {
                console.error(`[Background Sync] Erro no delete de ${empresaNome} - ${tipoRegistro}:`, deleteError);
              }
            }

            // 2. Inserir os novos/atualizados
            const { error: insertError } = await supabase
              .from('omie_financas_unificado')
              .insert(batch);

            if (insertError) {
              console.error(`[Background Sync] Erro no insert de ${empresaNome} - ${tipoRegistro}:`, insertError);
            }
          }
        }
      } else {
        console.log(`[Background Sync] ${comp.name}: Nenhum registro novo/alterado encontrado.`);
      }

    } catch (err: any) {
      console.error(`[Background Sync] Erro na sincronização da empresa ${comp.name}:`, err);
    }
  }
}

// --- FUNÇÕES DE CHAMADA DA API DO OMIE ---

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
      return null;
    }
    throw new Error(`Erro Omie (${call}): ${fault}`);
  }

  return data;
}

async function fetchOmieCP(appKey: string, appSecret: string, brStart: string, brEnd: string): Promise<any[]> {
  const url = 'https://app.omie.com.br/api/v1/financas/contapagar/';
  let pagina = 1;
  const limit = 100;
  const results: any[] = [];

  while (pagina <= 5) {
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

async function fetchOmieCR(appKey: string, appSecret: string, brStart: string, brEnd: string): Promise<any[]> {
  const url = 'https://app.omie.com.br/api/v1/financas/contareceber/';
  let pagina = 1;
  const limit = 100;
  const results: any[] = [];

  while (pagina <= 5) {
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

async function fetchOmieMovimentos(appKey: string, appSecret: string, brStart: string, brEnd: string): Promise<any[]> {
  const url = 'https://app.omie.com.br/api/v1/financas/mf/';
  let pagina = 1;
  const limit = 100;
  const results: any[] = [];

  while (pagina <= 5) {
    // Usamos dDtAltDe para buscar movimentos alterados/incluídos recentemente
    const data = await callOmieAPI(url, 'ListarMovimentos', appKey, appSecret, {
      nPagina: pagina,
      nRegPorPagina: limit,
      dDtAltDe: brStart,
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

// --- PROCESSADORES E NORMALIZADORES PARA O DB ---

function mapCPCRToDb(
  records: any[],
  companyName: string,
  tipo: 'PAGAR' | 'RECEBER',
  dimCategorias: Map<string, string>,
  dimProjetos: Map<string, string>,
  dimFornecedores: Map<string, string>
): any[] {
  const rows: any[] = [];
  const sign = tipo === 'PAGAR' ? -1 : 1;

  for (const r of records) {
    if (r.status_titulo === 'CANCELADO') continue;

    const omieId = Number(r.codigo_lancamento_omie);
    const status = r.status_titulo;

    const dtBaixa = formatToISODate(r.data_baixa || r.data_liquidacao);
    const dtPrevisao = formatToISODate(r.data_previsao);
    let dtPagamento = dtBaixa;
    if (!dtPagamento && (status === 'PAGO' || status === 'RECEBIDO')) {
      dtPagamento = dtPrevisao;
    }

    const dtEmissao = formatToISODate(r.data_emissao);
    const dtEntrada = formatToISODate(r.data_entrada);
    const dtRegistroRaw = formatToISODate(r.data_registro);
    const dtVencimento = formatToISODate(r.data_vencimento);
    const dtInc = formatToISODate(r.info?.dInc);

    const dataRegistro = dtEntrada || dtRegistroRaw || dtEmissao || dtVencimento || dtInc;

    const cleanCompany = companyName.toUpperCase().trim();
    
    const fornCode = String(r.codigo_cliente_fornecedor || '').trim();
    const fornKey = `${cleanCompany}-${fornCode}`;
    const clienteForn = dimFornecedores.get(fornKey) || 
                        r.nm_cliente || 
                        r.cnab_integracao_bancaria?.nome_transferencia || 
                        'N/D';

    const catCode = String(r.codigo_categoria || '').trim();
    const catKey = `${cleanCompany}-${catCode}`;
    const categoriaNome = dimCategorias.get(catKey) || r.descricao_categoria || 'Sem Categoria';

    const projCode = String(r.codigo_projeto || '').trim();
    const projKey = `${cleanCompany}-${projCode}`;
    const projetoNome = dimProjetos.get(projKey) || r.nome_projeto || 'Sem Projeto';

    const dist = r.distribuicao || [];
    if (dist.length === 0) {
      dist.push({ cDesDep: 'Sem Departamento', nValDep: r.valor_documento });
    }

    for (const d of dist) {
      rows.push({
        empresa_nome: companyName,
        omie_id: omieId,
        tipo_registro: tipo,
        status: status,
        valor_total: Number(r.valor_documento || 0) * sign,
        valor_alocado: Number(d.nValDep || 0) * sign,
        data_emissao: dtEmissao,
        data_registro: dataRegistro,
        data_vencimento: dtVencimento,
        data_previsao: dtPrevisao,
        data_pagamento: dtPagamento,
        categoria_codigo: catCode,
        categoria_nome: categoriaNome,
        projeto_nome: projetoNome,
        departamento_nome: d.cDesDep || 'Sem Departamento',
        cliente_fornecedor: clienteForn,
        numero_documento: r.numero_documento || null,
        raw_data: r
      });
    }
  }
  return rows;
}

function mapMovimentosToDb(
  records: any[],
  companyName: string,
  dimCategorias: Map<string, string>,
  dimProjetos: Map<string, string>
): any[] {
  const rows: any[] = [];

  for (const m of records) {
    const det = m.detalhes || {};
    const res = m.resumo || {};

    if (det.cCodCateg === '0.01') continue;

    const nCodTitulo = Number(det.nCodTitulo || 0);
    if (nCodTitulo > 0) continue;

    const statusRaw = String(det.cStatus || 'PAGO').toUpperCase();
    if (statusRaw === 'CANCELADO') continue;

    const omieId = Number(det.nCodMovCC);
    const tipo = det.cTipo === 'E' ? 'RECEBER' : 'PAGAR';
    const sign = tipo === 'PAGAR' ? -1 : 1;

    const valor = Number(det.nValorMovCC || res.nValPago || res.nValLiquido || 0);

    const dtRegistroMov = formatToISODate(det.dDtRegistro);
    const dtPagtoMov = formatToISODate(det.dDtPagto || det.dDtPagamento || det.dDataPagamento);
    const dtVencMov = formatToISODate(det.dDtVenc);
    const dtIncMov = formatToISODate(m.info?.dInc);

    const dataRegistro = dtRegistroMov || dtPagtoMov || dtVencMov || dtIncMov;

    const cleanCompany = companyName.toUpperCase().trim();
    
    const catCode = String(det.cCodCateg || '').trim();
    const catKey = `${cleanCompany}-${catCode}`;
    const categoriaNome = dimCategorias.get(catKey) || det.cDesCateg || 'Sem Categoria';

    const projCode = String(det.nCodProjeto || '').trim();
    const projKey = `${cleanCompany}-${projCode}`;
    const projetoNome = dimProjetos.get(projKey) || det.cDesProjeto || 'Sem Projeto';

    rows.push({
      empresa_nome: companyName,
      omie_id: omieId,
      tipo_registro: 'MOVIMENTO',
      status: 'PAGO',
      valor_total: valor * sign,
      valor_alocado: valor * sign,
      data_emissao: formatToISODate(det.dDtEmissao),
      data_registro: dataRegistro,
      data_vencimento: dtVencMov,
      data_previsao: dtPagtoMov,
      data_pagamento: dtPagtoMov,
      categoria_codigo: catCode,
      categoria_nome: categoriaNome,
      projeto_nome: projetoNome,
      departamento_nome: det.cDesDep || 'Principal',
      cliente_fornecedor: det.cNomeCliente || det.cDesMov || det.cFavorecido || 'Banco / Tarifa',
      numero_documento: det.cNumDocFiscal || null,
      raw_data: m
    });
  }
  return rows;
}
