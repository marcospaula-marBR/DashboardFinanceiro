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
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : isoStr;
    };

    // Converte data BR (dd/mm/yyyy) para ISO (yyyy-mm-dd)
    const formatIso = (brDate?: string) => {
      if (!brDate) return '';
      const p = brDate.split('/');
      return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : brDate;
    };

    // Resolve o melhor nome disponível para o cliente
    const resolveClientName = (r: any): string => {
      return (
        r.nome_cliente       ||  // campo direto
        r.razao_social       ||
        r.cNomeTomador       ||
        r.nome_tomador       ||
        r.nome_fornecedor    ||
        r.nomeCliente        ||
        (r.info?.cNomeTomador) ||
        (r.cabecalho?.cNomeTomador) ||
        null
      );
    };

    // Extrai o número limpo da NF (somente dígitos, sem prefixo "NF ")
    const resolveNFNumber = (r: any): string => {
      return (
        r.numero_documento_fiscal ||
        r.nNroNF                  ||
        r.nro_nf                  ||
        r.numero_nf               ||
        ''
      );
    };

    // Monta o label completo da NF para exibição
    const resolveNFLabel = (r: any, nfNum: string): string => {
      if (nfNum) return `NF ${nfNum}`;
      if (r.numero_documento) return `Doc ${r.numero_documento}`;
      return `Lançamento ${r.codigo_lancamento_omie}`;
    };

    const brStart = formatDateToBR(startDate);
    const brEnd   = formatDateToBR(endDate);

    const targetCompanies = [];
    if (!company || company === 'ALL' || company === 'Mar Brasil') {
      targetCompanies.push({
        name: 'Mar Brasil',
        key:  process.env.OMIE_APP_KEY_MARBRASIL,
        secret: process.env.OMIE_APP_SECRET_MARBRASIL
      });
    }
    if (!company || company === 'ALL' || company === 'DZM') {
      targetCompanies.push({
        name: 'DZM',
        key:  process.env.OMIE_APP_KEY_DZM,
        secret: process.env.OMIE_APP_SECRET_DZM
      });
    }

    const candidates: any[] = [];
    const logs: string[]    = [];
    const seenOmieIds       = new Set<string>();

    for (const comp of targetCompanies) {
      if (!comp.key || !comp.secret) {
        logs.push(`⚠️ Credenciais Omie não configuradas para ${comp.name}.`);
        continue;
      }

      const filterLabel =
        filterBy === 'date_registration' ? 'Data de Registro' :
        filterBy === 'date_issue'        ? 'Data de Lançamento' :
                                           'Data de Vencimento';

      logs.push(`🔍 Buscando em ${comp.name} por ${filterLabel} (${brStart} → ${brEnd})…`);

      // Monta parâmetros conforme critério de data escolhido pelo usuário
      const paramCR: Record<string, any> = {
        pagina: 1,
        registros_por_pagina: 100,
        apenas_importado_api: 'N',
      };

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
            app_key:    comp.key,
            app_secret: comp.secret,
            param: [paramCR]
          })
        });

        if (!respCR.ok) {
          logs.push(`❌ Erro HTTP ${respCR.status} ao consultar Omie (${comp.name}).`);
          continue;
        }

        const dataCR = await respCR.json();

        if (dataCR.faultstring) {
          logs.push(`❌ Omie retornou erro (${comp.name}): ${dataCR.faultstring}`);
          continue;
        }

        const items: any[] = dataCR.conta_receber_cadastro || [];
        logs.push(`✅ ${items.length} lançamento(s) encontrado(s) em ${comp.name}.`);

        for (const r of items) {
          const omieKey = `${comp.name}-${r.codigo_lancamento_omie}`;

          // Prevenção de duplicidades na mesma busca
          if (seenOmieIds.has(omieKey)) continue;
          seenOmieIds.add(omieKey);

          // ── Valores financeiros ──────────────────────────────────────────
          const grossVal      = Number(r.valor_documento)    || 0;
          const ir            = Number(r.valor_ir)           || 0;
          const pis           = Number(r.valor_pis)          || +(grossVal * 0.0065).toFixed(2);
          const cofins        = Number(r.valor_cofins)       || +(grossVal * 0.03).toFixed(2);
          const iss           = Number(r.valor_iss)          || 0;
          const inss          = Number(r.valor_inss)         || 0;
          const retainedTotal = ir + pis + cofins + iss + inss;
          const netVal        = grossVal - retainedTotal;
          const glosa         = Number(r.valor_desconto)     || 0;

          // ── Identificação ────────────────────────────────────────────────
          const clientCode   = String(r.codigo_cliente_fornecedor || '');
          const rawName      = resolveClientName(r);
          const clientName   = rawName
            ? rawName
            : `Cliente Omie #${clientCode}`;

          const nfNum   = String(resolveNFNumber(r));
          const nfLabel = resolveNFLabel(r, nfNum);

          // ── Datas ────────────────────────────────────────────────────────
          const dateReg  = formatIso(r.data_registro)   || formatIso(r.info?.dInc) || startDate;
          const dateIss  = formatIso(r.data_emissao)    || formatIso(r.info?.dInc) || startDate;
          const dateDue  = formatIso(r.data_vencimento) || endDate;
          const datePay  = formatIso(r.data_pagamento)  || '';

          candidates.push({
            omie_id:         String(r.codigo_lancamento_omie),
            omie_key:        omieKey,
            company_name:    comp.name,

            nota_fiscal:     nfLabel,        // "NF 1234" ou "Doc XXXX"
            numero_nf:       nfNum,          // número limpo para exibição

            client_code:     clientCode,
            client_name:     clientName,     // razão social quando disponível

            contract_name:   r.observacao   || r.cNumeroContrato || '',
            contract_number: r.cNumeroContrato || r.numero_pedido || '',

            date_registration: dateReg,
            date_issue:        dateIss,
            date_due:          dateDue,
            date_payment:      datePay,

            valor_bruto:   grossVal,
            valor_liquido: netVal,
            glosa,
            impostos:      retainedTotal,
            status:        datePay ? 'Pago' : 'Pendente',

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
      total:  candidates.length,
      logs,
      candidates,
    });

  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
