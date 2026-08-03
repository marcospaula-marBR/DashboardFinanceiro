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

    // ── Helpers de data ───────────────────────────────────────────────────────
    const formatDateToBR = (isoStr: string) => {
      const p = isoStr.split('-');
      return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : isoStr;
    };

    const formatIso = (brDate?: string): string => {
      if (!brDate) return '';
      const p = brDate.split('/');
      return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
    };

    // ── Resolve número da NF ─────────────────────────────────────────────────
    const resolveNFNumber = (r: any): string =>
      String(r.numero_documento_fiscal || r.nNroNF || r.nro_nf || r.numero_nf || '');

    const resolveNFLabel = (r: any, nfNum: string): string => {
      if (nfNum) return `NF ${nfNum}`;
      if (r.numero_documento) return `Doc ${r.numero_documento}`;
      return `Lançamento ${r.codigo_lancamento_omie}`;
    };

    // ── Resolve data de pagamento ─────────────────────────────────────────────
    // O Omie pode usar diferentes campos dependendo da versão e do fluxo de baixa
    const resolvePaymentDate = (r: any): string =>
      formatIso(r.data_pagamento) ||
      formatIso(r.data_liquidacao) ||
      formatIso(r.data_baixa) ||
      formatIso(r.data_previsao_pagamento) ||
      '';

    // ── Busca razão social do cliente via ConsultarCliente ───────────────────
    // O endpoint ListarContasReceber NÃO inclui a razão social no retorno padrão.
    // É necessária uma chamada separada por ID de cliente único.
    const fetchClientNames = async (
      clientIds: string[],
      appKey: string,
      appSecret: string
    ): Promise<Map<string, string>> => {
      const map = new Map<string, string>();
      const unique = [...new Set(clientIds)].slice(0, 40); // Limite de 40 por performance

      await Promise.allSettled(
        unique.map(async (id) => {
          try {
            const res = await fetch('https://app.omie.com.br/api/v1/geral/clientes/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                call: 'ConsultarCliente',
                app_key: appKey,
                app_secret: appSecret,
                param: [{ codigo_cliente_omie: Number(id) }]
              })
            });
            if (!res.ok) return;
            const data = await res.json();
            const nome =
              data.razao_social ||
              data.nome_fantasia ||
              data.cRazaoSocial ||
              data.nome_cliente ||
              null;
            if (nome) map.set(id, String(nome));
          } catch {}
        })
      );

      return map;
    };

    // ── Monta lista de empresas para busca ───────────────────────────────────
    const brStart = formatDateToBR(startDate);
    const brEnd   = formatDateToBR(endDate);

    const targetCompanies: { name: string; key: string; secret: string }[] = [];
    if (!company || company === 'ALL' || company === 'Mar Brasil') {
      const key    = process.env.OMIE_APP_KEY_MARBRASIL    || '';
      const secret = process.env.OMIE_APP_SECRET_MARBRASIL || '';
      if (key && secret) targetCompanies.push({ name: 'Mar Brasil', key, secret });
    }
    if (!company || company === 'ALL' || company === 'DZM') {
      const key    = process.env.OMIE_APP_KEY_DZM    || '';
      const secret = process.env.OMIE_APP_SECRET_DZM || '';
      if (key && secret) targetCompanies.push({ name: 'DZM', key, secret });
    }

    if (targetCompanies.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Credenciais Omie não configuradas para a empresa selecionada.' },
        { status: 400 }
      );
    }

    const candidates: any[] = [];
    const logs: string[]    = [];
    const seenOmieIds       = new Set<string>();

    for (const comp of targetCompanies) {
      const filterLabel =
        filterBy === 'date_registration' ? 'Data de Registro' :
        filterBy === 'date_issue'        ? 'Data de Lançamento' :
                                           'Data de Vencimento';

      logs.push(`🔍 Buscando em ${comp.name} por ${filterLabel} (${brStart} → ${brEnd})…`);

      // Parâmetros do endpoint ListarContasReceber
      const paramCR: Record<string, any> = {
        pagina:               1,
        registros_por_pagina: 100,
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
        // ── 1. Busca contas a receber ──────────────────────────────────────
        const respCR = await fetch('https://app.omie.com.br/api/v1/financas/contareceber/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call:       'ListarContasReceber',
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
          logs.push(`❌ Omie (${comp.name}): ${dataCR.faultstring}`);
          continue;
        }

        const items: any[] = dataCR.conta_receber_cadastro || [];
        logs.push(`✅ ${items.length} lançamento(s) encontrado(s) em ${comp.name}.`);
        if (items.length === 0) continue;

        // ── 2. Busca razão social de todos os clientes únicos ─────────────
        const clientIds = items.map((r: any) => String(r.codigo_cliente_fornecedor || ''));
        logs.push(`🔎 Buscando razão social de ${[...new Set(clientIds)].length} cliente(s) único(s)…`);
        const clientNameMap = await fetchClientNames(clientIds, comp.key, comp.secret);
        logs.push(`✅ ${clientNameMap.size} nome(s) de cliente resolvido(s) com sucesso.`);

        // ── 3. Monta candidatos ───────────────────────────────────────────
        for (const r of items) {
          const omieKey = `${comp.name}-${r.codigo_lancamento_omie}`;
          if (seenOmieIds.has(omieKey)) continue;
          seenOmieIds.add(omieKey);

          // Valores financeiros
          const grossVal      = Number(r.valor_documento) || 0;
          const ir            = Number(r.valor_ir)        || 0;
          const pis           = Number(r.valor_pis)       || +(grossVal * 0.0065).toFixed(2);
          const cofins        = Number(r.valor_cofins)    || +(grossVal * 0.03).toFixed(2);
          const iss           = Number(r.valor_iss)       || 0;
          const inss          = Number(r.valor_inss)      || 0;
          const retainedTotal = ir + pis + cofins + iss + inss;
          const netVal        = grossVal - retainedTotal;
          const glosa         = Number(r.valor_desconto)  || 0;

          // Identificação do cliente
          const clientCode = String(r.codigo_cliente_fornecedor || '');
          const clientName = clientNameMap.get(clientCode) || `Cliente Omie #${clientCode}`;

          // NF
          const nfNum   = resolveNFNumber(r);
          const nfLabel = resolveNFLabel(r, nfNum);

          // Datas
          const dateReg = formatIso(r.data_registro)   || formatIso(r.info?.dInc) || startDate;
          const dateIss = formatIso(r.data_emissao)    || formatIso(r.info?.dInc) || startDate;
          const dateDue = formatIso(r.data_vencimento) || endDate;
          const datePay = resolvePaymentDate(r);

          // Categoria e Projeto (campos padrão do Omie)
          const categoriaCode = String(r.codigo_categoria || '');
          const categoriaDesc = String(r.descricao_categoria || r.nome_categoria || '');
          const projetoCode   = String(r.codigo_projeto || '');
          const projetoNome   = String(r.nome_projeto || r.descricao_projeto || '');

          candidates.push({
            omie_id:      String(r.codigo_lancamento_omie),
            omie_key:     omieKey,
            company_name: comp.name,

            // Documento
            nota_fiscal:  nfLabel,
            numero_nf:    nfNum,

            // Cliente
            client_code:  clientCode,
            client_name:  clientName,

            // Contrato / Projeto Omie
            contract_name:   r.observacao     || r.cNumeroContrato || '',
            contract_number: r.cNumeroContrato || r.numero_pedido   || '',

            // Categoria
            categoria_code: categoriaCode,
            categoria_desc: categoriaDesc,

            // Projeto
            projeto_code: projetoCode,
            projeto_nome: projetoNome,

            // Datas
            date_registration: dateReg,
            date_issue:        dateIss,
            date_due:          dateDue,
            date_payment:      datePay,

            // Valores
            valor_bruto:   grossVal,
            valor_liquido: netVal,
            glosa,
            impostos:      retainedTotal,
            status:        datePay ? 'Pago' : 'Pendente',

            // Impostos detalhados
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
