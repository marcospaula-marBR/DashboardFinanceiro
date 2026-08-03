import { NextResponse } from 'next/server';

/**
 * Rota de debug — retorna o payload RAW do Omie (primeiro item de cada empresa)
 * para inspeção dos nomes reais de campos.
 * Remover ou proteger com auth após uso.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { startDate, endDate, company = 'ALL' } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ status: 'error', message: 'startDate e endDate obrigatórios.' }, { status: 400 });
    }

    const formatDateToBR = (iso: string) => {
      const p = iso.split('-');
      return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
    };

    const brStart = formatDateToBR(startDate);
    const brEnd   = formatDateToBR(endDate);

    const comps = [];
    if (company === 'ALL' || company === 'Mar Brasil') {
      comps.push({ name: 'Mar Brasil', key: process.env.OMIE_APP_KEY_MARBRASIL!, secret: process.env.OMIE_APP_SECRET_MARBRASIL! });
    }
    if (company === 'ALL' || company === 'DZM') {
      comps.push({ name: 'DZM', key: process.env.OMIE_APP_KEY_DZM!, secret: process.env.OMIE_APP_SECRET_DZM! });
    }

    const result: Record<string, any> = {};

    for (const comp of comps) {
      if (!comp.key || !comp.secret) { result[comp.name] = 'sem credenciais'; continue; }

      // ── 1. Raw ListarContasReceber (primeiro item) ──────────────────────
      const resCR = await fetch('https://app.omie.com.br/api/v1/financas/contareceber/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call: 'ListarContasReceber',
          app_key: comp.key,
          app_secret: comp.secret,
          param: [{ pagina: 1, registros_por_pagina: 3, filtrar_por_registro_de: brStart, filtrar_por_registro_ate: brEnd }]
        })
      });
      const dataCR = await resCR.json();
      const firstItem = (dataCR.conta_receber_cadastro || [])[0] || null;

      result[comp.name] = {
        // Chaves de topo da resposta (para ver se há campos de paginação, etc.)
        top_level_keys: Object.keys(dataCR),
        total_records: dataCR.total_de_registros,
        first_item_keys: firstItem ? Object.keys(firstItem) : [],
        first_item_raw: firstItem,
      };

      // ── 2. Se há item, inspeciona ConsultarCliente do primeiro cliente ──
      if (firstItem?.codigo_cliente_fornecedor) {
        const clientId = firstItem.codigo_cliente_fornecedor;

        const resCli = await fetch('https://app.omie.com.br/api/v1/geral/clientes/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call: 'ConsultarCliente',
            app_key: comp.key,
            app_secret: comp.secret,
            param: [{ codigo_cliente_omie: clientId }]
          })
        });
        const dataCli = await resCli.json();
        result[comp.name].consultar_cliente_keys  = Object.keys(dataCli);
        result[comp.name].consultar_cliente_fault = dataCli.faultstring || null;
        result[comp.name].consultar_cliente_nome  = dataCli.razao_social || dataCli.nome_fantasia || dataCli.cRazaoSocial || null;
        result[comp.name].consultar_cliente_raw   = dataCli;

        // ── 3. Se falhou como cliente, tenta como fornecedor ────────────
        if (dataCli.faultstring) {
          const resForn = await fetch('https://app.omie.com.br/api/v1/geral/fornecedores/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              call: 'ConsultarFornecedor',
              app_key: comp.key,
              app_secret: comp.secret,
              param: [{ codigo_fornecedor_omie: clientId }]
            })
          });
          const dataForn = await resForn.json();
          result[comp.name].consultar_fornecedor_fault = dataForn.faultstring || null;
          result[comp.name].consultar_fornecedor_nome  = dataForn.razao_social || dataForn.nome_fantasia || null;
          result[comp.name].consultar_fornecedor_raw   = dataForn;
        }

        // ── 4. Tenta ObterBaixaContaReceber para ver estrutura de baixas ─
        const resBaixa = await fetch('https://app.omie.com.br/api/v1/financas/contareceber/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call: 'ObterBaixaContaReceber',
            app_key: comp.key,
            app_secret: comp.secret,
            param: [{ codigo_lancamento_omie: firstItem.codigo_lancamento_omie }]
          })
        });
        const dataBaixa = await resBaixa.json();
        result[comp.name].obter_baixa_keys = Object.keys(dataBaixa);
        result[comp.name].obter_baixa_fault = dataBaixa.faultstring || null;
        result[comp.name].obter_baixa_raw  = dataBaixa;
      }
    }

    return NextResponse.json({ status: 'debug', result });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
