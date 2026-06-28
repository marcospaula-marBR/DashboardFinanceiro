import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

export async function POST(req: Request) {
  try {
    const reqData = await req.json();
    const { startDate, endDate, company } = reqData;

    if (!startDate || !endDate) {
      return NextResponse.json({ status: 'error', message: 'Faltam parâmetros de data.' }, { status: 400 });
    }

    const isoStart = parseToISODate(startDate);
    const isoEnd = parseToISODate(endDate);

    if (!isoStart || !isoEnd) {
      return NextResponse.json({ status: 'error', message: 'Formato de data inválido.' }, { status: 400 });
    }

    const companyName = company || 'Ambas';

    console.log(`[Fluxo Caixa API] Consultando Supabase: Start=${isoStart}, End=${isoEnd}, Company=${companyName}`);

    // 1. Consultar a tabela fluxo_caixa_projetado de forma paginada no Supabase
    const allRecords: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('fluxo_caixa_projetado')
        .select('*')
        .eq('ativo', true)
        .gte('data_previsao', isoStart)
        .lte('data_previsao', isoEnd)
        .range(from, from + limit - 1);

      if (companyName !== 'Ambas') {
        query = query.eq('empresa', companyName);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`[Fluxo Caixa API] Erro ao consultar Supabase:`, error);
        return NextResponse.json({ status: 'error', message: `Erro no banco: ${error.message}` }, { status: 500 });
      }

      if (data && data.length > 0) {
        allRecords.push(...data);
        from += limit;
        if (data.length < limit) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    // Mapear para o formato esperado pelo frontend
    const mappedRecords = allRecords.map(r => ({
      id_global: r.id,
      omie_id: r.omie_id,
      empresa: r.empresa,
      tipo: r.tipo_registro,
      status: r.status_fluxo,
      valor_total: r.valor,
      valor_alocado: r.valor,
      data_emissao: r.data_vencimento, // Fallback para emissao
      data_registro: r.data_vencimento, // Fallback para registro
      data_vencimento: r.data_vencimento,
      data_pagamento: null,
      data_alocacao: r.data_previsao, // Usamos data_previsao como data de alocação
      categoria_codigo: '',
      categoria_nome: r.categoria,
      projeto_nome: r.projeto,
      departamento_nome: 'Sem Departamento',
      cliente_fornecedor: r.fornecedor,
      numero_documento: null,
      observacao: r.observacao
    }));

    // Ordenar por data de alocação (mais recente primeiro)
    mappedRecords.sort((a, b) => b.data_alocacao.localeCompare(a.data_alocacao));

    // 2. Buscar a data da última sincronização bem-sucedida para o período/empresa
    let logQuery = supabase
      .from('logs_sincronizacao_fluxo')
      .select('data_hora')
      .eq('status_execucao', 'sucesso')
      .order('data_hora', { ascending: false })
      .limit(1);

    if (companyName !== 'Ambas') {
      logQuery = logQuery.eq('empresa_consultada', companyName);
    }

    const { data: logData, error: logError } = await logQuery;

    let lastSyncAt = null;
    if (!logError && logData && logData.length > 0) {
      lastSyncAt = logData[0].data_hora;
    }

    return NextResponse.json({
      status: 'success',
      count: mappedRecords.length,
      lastSyncAt,
      data: mappedRecords
    });

  } catch (error: any) {
    console.error(`[Fluxo Caixa API] Erro crítico interno:`, error);
    return NextResponse.json({ status: 'error', message: `Erro interno no servidor: ${error.message}` }, { status: 500 });
  }
}
