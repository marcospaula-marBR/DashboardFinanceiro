import { NextResponse } from 'next/server';

// ── Helpers de data ───────────────────────────────────────────────────────────

const formatDateToBR = (isoStr: string) => {
  const p = isoStr.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : isoStr;
};

// Converte dd/mm/yyyy → yyyy-mm-dd (ISO)
const formatIso = (brDate?: string): string => {
  if (!brDate) return '';
  const p = brDate.split('/');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
};

// Extrai número limpo da NF
const resolveNFNumber = (r: any): string =>
  String(r.numero_documento_fiscal || r.nNroNF || '');

const resolveNFLabel = (r: any, nfNum: string): string => {
  if (nfNum) return `NF ${nfNum}`;
  if (r.numero_documento) return `Doc ${r.numero_documento}`;
  return `Lançamento ${r.codigo_lancamento_omie}`;
};

// ── Lookup de razão social ─────────────────────────────────────────────────
// Chamadas em série com pequeno delay para evitar rate-limit do Omie

async function fetchClientNamesSerial(
  clientIds: string[],
  appKey: string,
  appSecret: string,
  logs: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(clientIds)].slice(0, 50);

  for (const id of unique) {
    await new Promise(r => setTimeout(r, 50)); // 50ms entre chamadas

    // Tenta endpoint de Clientes
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
      if (res.ok) {
        const data = await res.json();
        if (!data.faultstring && data.razao_social) {
          map.set(id, String(data.razao_social));
          continue;
        }
      }
    } catch {}

    // Fallback: endpoint de Fornecedores
    try {
      const res = await fetch('https://app.omie.com.br/api/v1/geral/fornecedores/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call: 'ConsultarFornecedor',
          app_key: appKey,
          app_secret: appSecret,
          param: [{ codigo_fornecedor_omie: Number(id) }]
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.faultstring && data.razao_social) {
          map.set(id, String(data.razao_social));
        }
      }
    } catch {}
  }

  return map;
}

// ── Lookup de nome do Projeto ──────────────────────────────────────────────
// O ListarContasReceber retorna apenas o código do projeto, sem o nome.
// Buscamos em lote uma única vez os projetos únicos.

async function fetchProjectNames(
  projectCodes: string[],
  appKey: string,
  appSecret: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(projectCodes.filter(c => c && c !== '0'))].slice(0, 30);
  if (unique.length === 0) return map;

  for (const code of unique) {
    await new Promise(r => setTimeout(r, 50));
    try {
      const res = await fetch('https://app.omie.com.br/api/v1/geral/projetos/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call: 'ConsultarProjeto',
          app_key: appKey,
          app_secret: appSecret,
          param: [{ codigo_projeto: Number(code) }]
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.faultstring) {
          const nome = data.nome || data.descricao || data.cNomeProjeto || null;
          if (nome) map.set(code, String(nome));
        }
      }
    } catch {}
  }

  return map;
}

// ── Rota Principal ─────────────────────────────────────────────────────────

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

    const brStart = formatDateToBR(startDate);
    const brEnd   = formatDateToBR(endDate);

    const targetCompanies: { name: string; key: string; secret: string }[] = [];
    if (!company || company === 'ALL' || company === 'Mar Brasil') {
      const key = process.env.OMIE_APP_KEY_MARBRASIL || '';
      const secret = process.env.OMIE_APP_SECRET_MARBRASIL || '';
      if (key && secret) targetCompanies.push({ name: 'Mar Brasil', key, secret });
    }
    if (!company || company === 'ALL' || company === 'DZM') {
      const key = process.env.OMIE_APP_KEY_DZM || '';
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

      // Parâmetros da consulta de contas a receber
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
        // ── 1. Busca lançamentos ─────────────────────────────────────────
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
          logs.push(`❌ Erro HTTP ${respCR.status} ao consultar Omie (${comp.name}).`);
          continue;
        }

        const dataCR = await respCR.json();
        if (dataCR.faultstring) {
          logs.push(`❌ Omie (${comp.name}): ${dataCR.faultstring}`);
          continue;
        }

        const items: any[] = dataCR.conta_receber_cadastro || [];
        logs.push(`✅ ${items.length} lançamento(s) em ${comp.name}.`);
        if (items.length === 0) continue;

        // ── 2. Coleta IDs únicos de clientes e projetos ─────────────────
        const clientIds = items
          .map((r: any) => String(r.codigo_cliente_fornecedor || ''))
          .filter(Boolean);
        const projectCodes = items
          .map((r: any) => String(r.codigo_projeto || ''))
          .filter(c => c && c !== '0');

        const uniqueClients = [...new Set(clientIds)];
        const uniqueProjects = [...new Set(projectCodes)];

        logs.push(`🔎 Buscando razão social de ${uniqueClients.length} cliente(s) único(s)…`);
        const clientNameMap = await fetchClientNamesSerial(clientIds, comp.key, comp.secret, logs);
        logs.push(`✅ ${clientNameMap.size}/${uniqueClients.length} nome(s) resolvido(s).`);

        if (uniqueProjects.length > 0) {
          logs.push(`🔎 Buscando nome de ${uniqueProjects.length} projeto(s)…`);
          const projectNameMap = await fetchProjectNames(projectCodes, comp.key, comp.secret);
          logs.push(`✅ ${projectNameMap.size}/${uniqueProjects.length} projeto(s) resolvido(s).`);

          // ── 3. Monta candidatos ────────────────────────────────────────
          for (const r of items) {
            const omieKey = `${comp.name}-${r.codigo_lancamento_omie}`;
            if (seenOmieIds.has(omieKey)) continue;
            seenOmieIds.add(omieKey);
            buildCandidate(r, omieKey, comp.name, clientNameMap, projectNameMap, startDate, endDate, candidates);
          }
        } else {
          for (const r of items) {
            const omieKey = `${comp.name}-${r.codigo_lancamento_omie}`;
            if (seenOmieIds.has(omieKey)) continue;
            seenOmieIds.add(omieKey);
            buildCandidate(r, omieKey, comp.name, clientNameMap, new Map(), startDate, endDate, candidates);
          }
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

// ── buildCandidate — encapsula a montagem de um candidato ─────────────────

function buildCandidate(
  r: any,
  omieKey: string,
  companyName: string,
  clientNameMap: Map<string, string>,
  projectNameMap: Map<string, string>,
  startDate: string,
  endDate: string,
  candidates: any[]
) {
  // Valores financeiros — Omie usa valor_documento sem descontos de imposto detalhados
  const grossVal = Number(r.valor_documento) || 0;
  const glosa    = Number(r.valor_desconto)  || 0;

  // Impostos: prioriza campos explícitos, depois usa categorias[0] para deduzir
  const ir     = Number(r.valor_ir)     || 0;
  const pis    = Number(r.valor_pis)    || (r.retem_pis    === 'S' ? +(grossVal * 0.0065).toFixed(2) : 0);
  const cofins = Number(r.valor_cofins) || (r.retem_cofins === 'S' ? +(grossVal * 0.03).toFixed(2)   : 0);
  const iss    = Number(r.valor_iss)    || (r.retem_iss    === 'S' ? +(grossVal * 0.02).toFixed(2)   : 0);
  const inss   = Number(r.valor_inss)   || (r.retem_inss   === 'S' ? +(grossVal * 0.11).toFixed(2)   : 0);
  const csll   = Number(r.valor_csll)   || (r.retem_csll   === 'S' ? +(grossVal * 0.01).toFixed(2)   : 0);
  const retainedTotal = ir + pis + cofins + iss + inss + csll;
  const netVal = grossVal - retainedTotal - glosa;

  // Identificação do cliente
  const clientCode = String(r.codigo_cliente_fornecedor || '');
  const clientName = clientNameMap.get(clientCode) || `Cliente Omie #${clientCode}`;

  // NF
  const nfNum   = resolveNFNumber(r);
  const nfLabel = resolveNFLabel(r, nfNum);

  // Categoria: nível raiz (confirmado pelo debug)
  const categoriaCode = String(r.codigo_categoria || '');
  // Tenta extrair descrição do array categorias se vier na resposta
  const categoriaDesc = r.categorias?.[0]?.nome_categoria ||
                        r.categorias?.[0]?.descricao     ||
                        r.descricao_categoria              ||
                        '';

  // Projeto: código vem do nível raiz, nome via lookup
  const projetoCode = String(r.codigo_projeto || '');
  const projetoNome = projetoCode && projetoCode !== '0'
    ? (projectNameMap.get(projetoCode) || `Projeto #${projetoCode}`)
    : '';

  // Distribuição: nome do centro de custo/contrato (campo cDesDep confirmado pelo debug)
  const distribuicaoNome = r.distribuicao?.[0]?.cDesDep || '';

  // Datas — status_titulo confirmado pelo debug: "RECEBIDO", "ABERTO", "CANCELADO", "VENCIDO"
  const statusOmie = String(r.status_titulo || '').toUpperCase();
  const isPago     = statusOmie === 'RECEBIDO';

  const dateReg  = formatIso(r.data_registro)  || formatIso(r.info?.dInc) || startDate;
  const dateIss  = formatIso(r.data_emissao)   || dateReg;
  const dateDue  = formatIso(r.data_vencimento) || endDate;
  // data_previsao é a data de previsão de liquidação (mais próxima de "data de recebimento")
  const datePrev = formatIso(r.data_previsao) || '';

  candidates.push({
    omie_id:      String(r.codigo_lancamento_omie),
    omie_key:     omieKey,
    company_name: companyName,

    nota_fiscal:  nfLabel,
    numero_nf:    nfNum,

    client_code:  clientCode,
    client_name:  clientName,

    // Contrato/projeto — prioriza o nome da distribuição que é mais descritivo
    contract_name:   distribuicaoNome || r.observacao || r.cNumeroContrato || '',
    contract_number: r.cNumeroContrato || r.numero_pedido || '',

    // Categoria Omie (confirmada pelo debug)
    categoria_code: categoriaCode,
    categoria_desc: categoriaDesc,

    // Projeto Omie
    projeto_code: projetoCode !== '0' ? projetoCode : '',
    projeto_nome: projetoNome,

    // Datas
    date_registration: dateReg,
    date_issue:        dateIss,
    date_due:          dateDue,
    // data_previsao = data de liquidação prevista (melhor proxy para data de recebimento)
    date_payment:      isPago ? datePrev : '',

    valor_bruto:   grossVal,
    valor_liquido: netVal,
    glosa,
    impostos:      retainedTotal,
    // Status derivado do campo status_titulo (CANCELADO, RECEBIDO, ABERTO, VENCIDO)
    status:        isPago ? 'Pago' : statusOmie === 'CANCELADO' ? 'Cancelado' : 'Pendente',
    status_omie:   statusOmie,

    tax_ir:     ir,
    tax_pis:    pis,
    tax_cofins: cofins,
    tax_iss:    iss,
    tax_inss:   inss,
    tax_csll:   csll,
  });
}
