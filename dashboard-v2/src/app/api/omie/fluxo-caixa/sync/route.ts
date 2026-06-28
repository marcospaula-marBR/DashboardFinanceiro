import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper para converter data ISO para ISO YYYY-MM-DD
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

// Helper para formatar data ISO para padrão brasileiro DD/MM/YYYY
function formatDateToBR(isoStr: string): string {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}/${m}/${y}`;
}

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

export async function POST(req: Request) {
  const startTime = Date.now();
  let user = 'sistema';
  let isoStart = '';
  let isoEnd = '';
  let companyName = 'Ambas';

  try {
    const reqData = await req.json();
    const { startDate, endDate, company } = reqData;

    if (!startDate || !endDate) {
      return NextResponse.json({ status: 'error', message: 'Faltam parâmetros de data (startDate/endDate).' }, { status: 400 });
    }

    isoStart = formatToISODate(startDate) || '';
    isoEnd = formatToISODate(endDate) || '';
    companyName = company || 'Ambas';

    if (!isoStart || !isoEnd) {
      return NextResponse.json({ status: 'error', message: 'Formato de data inválido.' }, { status: 400 });
    }

    const brStart = formatDateToBR(isoStart);
    const brEnd = formatDateToBR(isoEnd);

    // 1. Identificar quais empresas serão sincronizadas
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

    if (companiesToSync.length === 0) {
      return NextResponse.json({ status: 'error', message: 'Nenhuma empresa válida identificada para sincronização.' }, { status: 400 });
    }

    // 2. Carregar dimensões do Supabase para tradução (Categorias, Projetos e DRE)
    const [catData, dreData] = await Promise.all([
      supabase.from('omie_dim_categorias').select('codigo_categoria, descricao_categoria, codigo_conta_dre, empresa_nome'),
      supabase.from('omie_dim_dre').select('codigo_conta_dre, descricao_conta_dre')
    ]);

    // Mapeamentos de dimensões
    const dimCategorias = new Map<string, { descricao: string; codigo_dre: string }>();
    (catData.data || []).forEach(c => {
      const key = `${String(c.empresa_nome || '').trim().toUpperCase()}-${String(c.codigo_categoria).trim()}`;
      dimCategorias.set(key, {
        descricao: c.descricao_categoria,
        codigo_dre: String(c.codigo_conta_dre || '')
      });
    });

    const dimDRE = new Map<string, string>();
    (dreData.data || []).forEach(d => {
      dimDRE.set(String(d.codigo_conta_dre).trim(), d.descricao_conta_dre);
    });

    let totalReturned = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalExcluidos = 0;
    const allSyncedOmieIds = new Set<string>();

    for (const comp of companiesToSync) {
      if (!comp.key || !comp.secret) {
        console.warn(`[Sync Fluxo] Credenciais não configuradas para ${comp.name}`);
        continue;
      }

      // Buscar Contas a Pagar (CP) da Omie no período
      let cpPage = 1;
      const cpRecords: any[] = [];
      while (true) {
        const data = await callOmieAPI(
          'https://app.omie.com.br/api/v1/financas/contapagar/',
          'ListarContasPagar',
          comp.key,
          comp.secret,
          {
            pagina: cpPage,
            registros_por_pagina: 100,
            filtrar_por_data_de: brStart,
            filtrar_por_data_ate: brEnd,
            exibir_obs: 'S'
          }
        );
        if (!data) break;
        const list = data.conta_pagar_cadastro || [];
        cpRecords.push(...list);
        if (cpPage >= (data.total_de_paginas || 1)) break;
        cpPage++;
      }

      // Buscar Contas a Receber (CR) da Omie no período
      let crPage = 1;
      const crRecords: any[] = [];
      while (true) {
        const data = await callOmieAPI(
          'https://app.omie.com.br/api/v1/financas/contareceber/',
          'ListarContasReceber',
          comp.key,
          comp.secret,
          {
            pagina: crPage,
            registros_por_pagina: 100,
            filtrar_por_data_de: brStart,
            filtrar_por_data_ate: brEnd,
            exibir_obs: 'S'
          }
        );
        if (!data) break;
        const list = data.conta_receber_cadastro || [];
        crRecords.push(...list);
        if (crPage >= (data.total_de_paginas || 1)) break;
        crPage++;
      }

      totalReturned += cpRecords.length + crRecords.length;

      // Filtrar em memória apenas títulos abertos/projetados
      const isOpen = (status: string) => {
        const s = String(status || 'ABERTO').toUpperCase();
        return s !== 'PAGO' && s !== 'LIQUIDADO' && s !== 'RECEBIDO' && s !== 'EXCLUIDO' && s !== 'CANCELADO';
      };

      const activeCP = cpRecords.filter(r => isOpen(r.status_titulo));
      const activeCR = crRecords.filter(r => isOpen(r.status_titulo));

      const rowsToUpsert: any[] = [];

      // Mapear CP
      activeCP.forEach(r => {
        const omieId = String(r.codigo_lancamento_omie);
        allSyncedOmieIds.add(`${comp.name}-${omieId}-PAGAR`);

        const catCode = String(r.codigo_categoria || '').trim();
        const catKey = `${comp.name.toUpperCase()}-${catCode}`;
        const catInfo = dimCategorias.get(catKey);
        const categoriaNome = catInfo?.descricao || r.descricao_categoria || 'Sem Categoria';
        const codigoDre = catInfo?.codigo_dre || '';
        const contaDreNome = codigoDre ? (dimDRE.get(codigoDre) || `Conta ${codigoDre}`) : 'Outras Despesas';

        rowsToUpsert.push({
          origem: 'omie',
          omie_id: omieId,
          tipo_registro: 'PAGAR',
          status_fluxo: 'projetado',
          data_vencimento: formatToISODate(r.data_vencimento),
          data_previsao: formatToISODate(r.data_previsao) || formatToISODate(r.data_vencimento),
          valor: Number(r.valor_documento || 0) * -1, // Negativo para pagar
          conta_dre: contaDreNome,
          categoria: categoriaNome,
          projeto: r.nome_projeto || 'Sem Projeto',
          empresa: comp.name,
          fornecedor: r.nm_cliente || 'Fornecedor',
          observacao: r.observacao || null,
          janela_data_inicio: isoStart,
          janela_data_fim: isoEnd,
          ativo: true,
          excluido_no_omie: false,
          last_sync_at: new Date().toISOString(),
          sync_status: 'success'
        });
      });

      // Mapear CR
      activeCR.forEach(r => {
        const omieId = String(r.codigo_lancamento_omie);
        allSyncedOmieIds.add(`${comp.name}-${omieId}-RECEBER`);

        const catCode = String(r.codigo_categoria || '').trim();
        const catKey = `${comp.name.toUpperCase()}-${catCode}`;
        const catInfo = dimCategorias.get(catKey);
        const categoriaNome = catInfo?.descricao || r.descricao_categoria || 'Sem Categoria';
        const codigoDre = catInfo?.codigo_dre || '';
        const contaDreNome = codigoDre ? (dimDRE.get(codigoDre) || `Conta ${codigoDre}`) : 'Receita Operacional';

        rowsToUpsert.push({
          origem: 'omie',
          omie_id: omieId,
          tipo_registro: 'RECEBER',
          status_fluxo: 'projetado',
          data_vencimento: formatToISODate(r.data_vencimento),
          data_previsao: formatToISODate(r.data_previsao) || formatToISODate(r.data_vencimento),
          valor: Number(r.valor_documento || 0), // Positivo para receber
          conta_dre: contaDreNome,
          categoria: categoriaNome,
          projeto: r.nome_projeto || 'Sem Projeto',
          empresa: comp.name,
          fornecedor: r.nm_cliente || 'Cliente',
          observacao: r.observacao || null,
          janela_data_inicio: isoStart,
          janela_data_fim: isoEnd,
          ativo: true,
          excluido_no_omie: false,
          last_sync_at: new Date().toISOString(),
          sync_status: 'success'
        });
      });

      // Executar Upsert no Supabase
      if (rowsToUpsert.length > 0) {
        // Deletar os registros com a mesma chave composta antes do insert para simular um upsert limpo
        for (const row of rowsToUpsert) {
          const { data: existing } = await supabase
            .from('fluxo_caixa_projetado')
            .select('id')
            .eq('empresa', row.empresa)
            .eq('omie_id', row.omie_id)
            .eq('tipo_registro', row.tipo_registro);

          if (existing && existing.length > 0) {
            totalUpdated++;
            await supabase
              .from('fluxo_caixa_projetado')
              .delete()
              .eq('id', existing[0].id);
          } else {
            totalInserted++;
          }
        }

        const { error: insertError } = await supabase
          .from('fluxo_caixa_projetado')
          .insert(rowsToUpsert);

        if (insertError) {
          throw new Error(`Erro ao inserir no Supabase para ${comp.name}: ${insertError.message}`);
        }
      }
    }

    // 3. Exclusão lógica: Identificar registros no Supabase para este período que não vieram na resposta ativa da Omie
    // E marcá-los como ativo = false e excluido_no_omie = true
    let querySupabase = supabase
      .from('fluxo_caixa_projetado')
      .select('id, omie_id, empresa, tipo_registro')
      .eq('ativo', true)
      .gte('data_previsao', isoStart)
      .lte('data_previsao', isoEnd);

    if (companyName !== 'Ambas') {
      querySupabase = querySupabase.eq('empresa', companyName);
    }

    const { data: dbRecords, error: dbError } = await querySupabase;

    if (dbError) {
      throw new Error(`Erro ao consultar Supabase para exclusão lógica: ${dbError.message}`);
    }

    const idsToDeactivate: string[] = [];
    (dbRecords || []).forEach(r => {
      const key = `${r.empresa}-${r.omie_id}-${r.tipo_registro}`;
      if (!allSyncedOmieIds.has(key)) {
        idsToDeactivate.push(r.id);
      }
    });

    if (idsToDeactivate.length > 0) {
      totalExcluidos = idsToDeactivate.length;
      const { error: updateError } = await supabase
        .from('fluxo_caixa_projetado')
        .update({ ativo: false, excluido_no_omie: true, updated_at: new Date().toISOString() })
        .in('id', idsToDeactivate);

      if (updateError) {
        console.error('[Sync Fluxo] Erro ao desativar registros excluídos:', updateError);
      }
    }

    const elapsedTime = Date.now() - startTime;

    // 4. Salvar log de sincronização
    await supabase
      .from('logs_sincronizacao_fluxo')
      .insert([{
        data_hora: new Date().toISOString(),
        usuario: user,
        data_inicio_consultada: isoStart,
        data_fim_consultada: isoEnd,
        empresa_consultada: companyName,
        registros_retornados: totalReturned,
        registros_incluidos: totalInserted,
        registros_mantidos: totalUpdated,
        registros_excluidos: totalExcluidos,
        status_execucao: 'sucesso',
        tempo_processamento_ms: elapsedTime
      }]);

    return NextResponse.json({
      status: 'success',
      summary: {
        returned: totalReturned,
        inserted: totalInserted,
        updated: totalUpdated,
        deactivated: totalExcluidos,
        timeMs: elapsedTime
      }
    });

  } catch (error: any) {
    console.error('[Sync Fluxo] Erro crítico na sincronização:', error);
    
    // Salvar log de erro
    const elapsedTime = Date.now() - startTime;
    await supabase
      .from('logs_sincronizacao_fluxo')
      .insert([{
        data_hora: new Date().toISOString(),
        usuario: user,
        data_inicio_consultada: isoStart || '2000-01-01',
        data_fim_consultada: isoEnd || '2000-01-01',
        empresa_consultada: companyName,
        registros_retornados: 0,
        registros_incluidos: 0,
        registros_mantidos: 0,
        registros_excluidos: 0,
        status_execucao: 'erro',
        erros_api: error.message,
        tempo_processamento_ms: elapsedTime
      }]);

    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
