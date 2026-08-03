import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { startDate, endDate, filterBy = 'date_registration', company = 'ALL' } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { status: 'error', message: 'Selecione a data inicial e data final para busca no Omie.' },
        { status: 400 }
      );
    }

    const formatDateToBR = (isoStr: string) => {
      const parts = isoStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return isoStr;
    };

    const formatIso = (brDate?: string) => {
      if (!brDate) return '';
      const p = brDate.split('/');
      return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : brDate;
    };

    const brStart = formatDateToBR(startDate);
    const brEnd = formatDateToBR(endDate);

    const targetCompanies = [];
    if (!company || company === 'ALL' || company === 'Mar Brasil') {
      targetCompanies.push({
        name: 'Mar Brasil',
        key: process.env.OMIE_APP_KEY_MARBRASIL,
        secret: process.env.OMIE_APP_SECRET_MARBRASIL
      });
    }
    if (!company || company === 'ALL' || company === 'DZM') {
      targetCompanies.push({
        name: 'DZM',
        key: process.env.OMIE_APP_KEY_DZM,
        secret: process.env.OMIE_APP_SECRET_DZM
      });
    }

    const candidates: any[] = [];
    const logs: string[] = [];
    const seenOmieIds = new Set<string>();

    for (const comp of targetCompanies) {
      if (!comp.key || !comp.secret) {
        logs.push(`⚠️ Credenciais Omie não configuradas para ${comp.name}.`);
        continue;
      }

      const filterLabel =
        filterBy === 'date_registration' ? 'Data de Registro' :
        filterBy === 'date_issue'        ? 'Data de Lançamento' :
                                           'Data de Vencimento';

      logs.push(`🔍 Buscando em ${comp.name} por ${filterLabel} (${brStart} → ${brEnd})...`);

      // Monta os parâmetros conforme o critério de data escolhido pelo usuário
      const paramCR: Record<string, any> = { pagina: 1, registros_por_pagina: 100 };
      if (filterBy === 'date_registration') {
        paramCR.filtrar_por_registro_de  = brStart;
        paramCR.filtrar_por_registro_ate = brEnd;
      } else if (filterBy === 'date_issue') {
        paramCR.filtrar_por_inclusao_de  = brStart;
        paramCR.filtrar_por_inclusao_ate = brEnd;
      } else {
        paramCR.filtrar_por_data_de  = brStart;
        paramCR.filtrar_por_data_ate = brEnd;
      }

      try {
        const respCR = await fetch('https://app.omie.com.br/api/v1/financas/contareceber/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call: 'ListarContasReceber',
            app_key: comp.key,
            app_secret: comp.secret,
            param: [paramCR]
          })
        });

        if (!respCR.ok) {
          logs.push(`❌ Erro HTTP ${respCR.status} ao consultar Omie para ${comp.name}.`);
          continue;
        }

        const dataCR = await respCR.json();
        const items: any[] = dataCR.conta_receber_cadastro || [];
        logs.push(`✅ ${items.length} lançamento(s) encontrado(s) em ${comp.name}.`);

        for (const r of items) {
          const omieKey = `${comp.name}-${r.codigo_lancamento_omie}`;
          // Prevenção de duplicidades dentro da mesma busca
          if (seenOmieIds.has(omieKey)) continue;
          seenOmieIds.add(omieKey);

          const grossVal     = Number(r.valor_documento) || 0;
          const ir           = Number(r.valor_ir) || 0;
          const pis          = Number(r.valor_pis) || +(grossVal * 0.0065).toFixed(2);
          const cofins       = Number(r.valor_cofins) || +(grossVal * 0.03).toFixed(2);
          const iss          = Number(r.valor_iss) || 0;
          const inss         = Number(r.valor_inss) || 0;
          const retainedTotal = ir + pis + cofins + iss + inss;
          const netVal       = grossVal - retainedTotal;

          candidates.push({
            // Chave única para deduplicação contra o Supabase (enviada ao cliente)
            omie_id:      String(r.codigo_lancamento_omie),
            omie_key:     omieKey,
            company_name: comp.name,

            // Campos de identificação — exibidos na auditoria
            nota_fiscal:  r.numero_documento_fiscal
              ? `NF ${r.numero_documento_fiscal}`
              : (r.numero_documento || `Doc ${r.codigo_lancamento_omie}`),
            client_name:  `Cliente Omie #${r.codigo_cliente_fornecedor}`,
            contract_name: r.observacao || r.cNumeroContrato || 'Projeto Omie',
            contract_number: r.cNumeroContrato || r.numero_pedido || '',

            // Datas (todos os campos disponíveis)
            date_registration: formatIso(r.data_registro) || formatIso(r.info?.dInc) || startDate,
            date_issue:        formatIso(r.data_emissao)  || formatIso(r.info?.dInc) || startDate,
            date_due:          formatIso(r.data_vencimento) || endDate,
            date_payment:      formatIso(r.data_pagamento) || '',

            // Valores financeiros — base para lançamento em recebimentos
            valor_bruto:   grossVal,
            valor_liquido: netVal,
            glosa:         Number(r.valor_desconto) || 0,
            impostos:      retainedTotal,
            status:        r.data_pagamento ? 'Pago' : 'Pendente',

            // Detalhamento fiscal (informativo na auditoria)
            tax_ir:     ir,
            tax_pis:    pis,
            tax_cofins: cofins,
            tax_iss:    iss,
            tax_inss:   inss,
          });
        }
      } catch (err: any) {
        logs.push(`❌ Exceção ao consultar Omie (${comp.name}): ${err.message}`);
      }
    }

    return NextResponse.json({
      status: 'success',
      total:     candidates.length,
      logs,
      candidates,
    });

  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
