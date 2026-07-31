import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { startDate, endDate, filterBy, company, avoidDuplicates } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ status: 'error', message: 'Selecione a data inicial e data final para busca no Omie.' }, { status: 400 });
    }

    const formatDateToBR = (isoStr: string) => {
      const parts = isoStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return isoStr;
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

    const syncedItems: any[] = [];
    const seenOmieIds = new Set<string>();
    let logs: string[] = [];

    for (const comp of targetCompanies) {
      if (!comp.key || !comp.secret) {
        logs.push(`Credenciais Omie não encontradas para ${comp.name}.`);
        continue;
      }

      logs.push(`Buscando faturamentos em ${comp.name} por ${filterBy === 'date_registration' ? 'Data de Registro' : filterBy === 'date_issue' ? 'Data de Lançamento' : 'Vencimento'} (${brStart} até ${brEnd})...`);

      // Parametrização de filtros do Omie para Contas a Receber (ListarContasReceber)
      const paramCR: any = { pagina: 1, registros_por_pagina: 100 };
      if (filterBy === 'date_registration') {
        paramCR.filtrar_por_registro_de = brStart;
        paramCR.filtrar_por_registro_ate = brEnd;
      } else if (filterBy === 'date_issue') {
        paramCR.filtrar_por_inclusao_de = brStart;
        paramCR.filtrar_por_inclusao_ate = brEnd;
      } else {
        paramCR.filtrar_por_data_de = brStart;
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

        if (respCR.ok) {
          const dataCR = await respCR.json();
          const items = dataCR.conta_receber_cadastro || [];
          logs.push(`[ContasReceber] Encontrados ${items.length} registros em ${comp.name}.`);

          items.forEach((r: any) => {
            const omieKey = `${comp.name}-${r.codigo_lancamento_omie}`;
            
            // Prevenção de duplicidades
            if (avoidDuplicates && seenOmieIds.has(omieKey)) {
              return;
            }
            seenOmieIds.add(omieKey);

            const formatIso = (brDate?: string) => {
              if (!brDate) return '';
              const p = brDate.split('/');
              return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : brDate;
            };

            const grossVal = r.valor_documento || 0;
            const ir = r.valor_ir || 0;
            const pis = r.valor_pis || (grossVal * 0.0065);
            const cofins = r.valor_cofins || (grossVal * 0.03);
            const iss = r.valor_iss || (grossVal * 0.02);
            const inss = r.valor_inss || 0;
            const retainedTotal = ir + pis + cofins + iss + inss;
            const netVal = grossVal - retainedTotal;

            syncedItems.push({
              id: `omie-cr-${comp.name}-${r.codigo_lancamento_omie}`,
              omie_id: r.codigo_lancamento_omie,
              company_name: comp.name,
              invoice_number: r.numero_documento_fiscal ? `NF ${r.numero_documento_fiscal}` : (r.numero_documento || `Doc ${r.codigo_lancamento_omie}`),
              contract_number: r.cNumeroContrato || r.numero_pedido || 'N/A',
              contract_name: r.observacao || 'Projeto Fonte Omie',
              client_id: r.codigo_cliente_fornecedor,
              client_name: `Cliente ID ${r.codigo_cliente_fornecedor}`,
              segment_type: 'B2B', // Padrão editável pelo usuário
              is_outsourced: false, // Padrão editável pelo usuário
              date_registration: formatIso(r.data_registro) || formatIso(r.info?.dInc) || startDate,
              date_issue: formatIso(r.data_emissao) || formatIso(r.info?.dInc) || startDate,
              date_due: formatIso(r.data_vencimento) || endDate,
              date_payment: formatIso(r.data_pagamento),
              value_gross: grossVal,
              value_discount: r.valor_desconto || 0,
              value_interest_penalty: r.valor_juros || 0,
              value_fees: 0,
              tax_pis: pis,
              tax_cofins: cofins,
              tax_iss: iss,
              tax_inss: inss,
              tax_irrf: ir,
              tax_retained_total: retainedTotal,
              value_net: netVal,
              commission: {
                has_commission: false, // Inicia desligado para o usuário preencher/configurar
                value_non_commissionable: 0,
                value_commissionable_base: netVal,
                total_commission_percent: 0,
                total_commission_value: 0,
                participants: []
              },
              segment_allocations: ['B2B']
            });
          });
        }
      } catch (err: any) {
        logs.push(`Erro na chamada Omie para ${comp.name}: ${err.message}`);
      }
    }

    return NextResponse.json({
      status: 'success',
      synced_count: syncedItems.length,
      logs,
      items: syncedItems
    });

  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
