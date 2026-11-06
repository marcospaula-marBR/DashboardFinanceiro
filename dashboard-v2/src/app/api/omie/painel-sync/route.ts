import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface OmieCompanyConfig {
  name: string;
  key?: string;
  secret?: string;
}

function parseBrDate(dStr?: string | null): string | null {
  if (!dStr || typeof dStr !== 'string') return null;
  const parts = dStr.trim().split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function toBrDate(isoStr: string): string {
  const [y, m, d] = isoStr.split('-');
  return `${d}/${m}/${y}`;
}

async function callOmie(url: string, call: string, appKey: string, appSecret: string, param: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      call,
      app_key: appKey,
      app_secret: appSecret,
      param: [param]
    })
  });
  if (!res.ok) return null;
  return res.json();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const regime = body?.regime || 'COMPETENCIA';

    const companies: OmieCompanyConfig[] = [
      {
        name: 'Mar Brasil',
        key: process.env.OMIE_APP_KEY_MARBRASIL,
        secret: process.env.OMIE_APP_SECRET_MARBRASIL
      },
      {
        name: 'DZM',
        key: process.env.OMIE_APP_KEY_DZM,
        secret: process.env.OMIE_APP_SECRET_DZM
      },
      {
        name: 'G2',
        key: process.env.OMIE_APP_KEY_G2,
        secret: process.env.OMIE_APP_SECRET_G2
      },
      {
        name: 'Conectius',
        key: process.env.OMIE_APP_KEY_CONECTIUS,
        secret: process.env.OMIE_APP_SECRET_CONECTIUS
      }
    ].filter(c => Boolean(c.key && c.secret));

    let totalPurged = 0;
    let totalUpdatedMov = 0;

    // Data de corte de 15 dias atrás para sincronizar movimentos bancários recentes rapidamente
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 15);
    const isoSince = sinceDate.toISOString().slice(0, 10);
    const brSince = toBrDate(isoSince);

    for (const comp of companies) {
      const appKey = comp.key!;
      const appSecret = comp.secret!;

      // 1. Se estiver no regime PREVISAO (ou atualização geral), expurgar títulos EM ABERTO no Supabase
      // que foram cancelados/excluídos ou já liquidados no Omie
      if (regime === 'PREVISAO' || regime === 'CAIXA' || regime === 'COMPETENCIA') {
        const openIds = new Set<string>();

        // ListarContasPagar EMABERTO
        let page = 1;
        while (page <= 30) {
          const data = await callOmie(
            'https://app.omie.com.br/api/v1/financas/contaspagar/',
            'ListarContasPagar',
            appKey,
            appSecret,
            {
              pagina: page,
              registros_por_pagina: 100,
              apenas_importado_api: 'N',
              filtrar_por_status: 'EMABERTO'
            }
          );
          const recs = data?.conta_pagar_cadastro || [];
          for (const r of recs) {
            const st = String(r.status_titulo || '').toUpperCase().trim();
            if (st !== 'CANCELADO' && r.codigo_lancamento_omie) {
              openIds.add(String(r.codigo_lancamento_omie));
            }
          }
          const totalPages = Number(data?.total_de_paginas || 1);
          if (page >= totalPages || recs.length === 0) break;
          page++;
        }

        // ListarContasReceber EMABERTO
        page = 1;
        while (page <= 15) {
          const data = await callOmie(
            'https://app.omie.com.br/api/v1/financas/contasreceber/',
            'ListarContasReceber',
            appKey,
            appSecret,
            {
              pagina: page,
              registros_por_pagina: 100,
              apenas_importado_api: 'N',
              filtrar_por_status: 'EMABERTO'
            }
          );
          const recs = data?.conta_receber_cadastro || [];
          for (const r of recs) {
            const st = String(r.status_titulo || '').toUpperCase().trim();
            if (st !== 'CANCELADO' && r.codigo_lancamento_omie) {
              openIds.add(String(r.codigo_lancamento_omie));
            }
          }
          const totalPages = Number(data?.total_de_paginas || 1);
          if (page >= totalPages || recs.length === 0) break;
          page++;
        }

        if (openIds.size > 0) {
          const { data: supOpenRows } = await supabase
            .from('omie_financas_unificado')
            .select('omie_id')
            .eq('empresa_nome', comp.name)
            .in('status', ['A VENCER', 'ATRASADO', 'VENCE HOJE', 'ABERTO', 'PAGTO_PARCIAL']);

          if (supOpenRows && supOpenRows.length > 0) {
            const supIds = Array.from(
              new Set(supOpenRows.map(r => String(r.omie_id || '')).filter(Boolean))
            );
            const staleIds = supIds.filter(id => !openIds.has(id));

            for (let i = 0; i < staleIds.length; i += 100) {
              const chunk = staleIds.slice(i, i + 100);
              await supabase
                .from('omie_financas_unificado')
                .delete()
                .eq('empresa_nome', comp.name)
                .in('status', ['A VENCER', 'ATRASADO', 'VENCE HOJE', 'ABERTO', 'PAGTO_PARCIAL'])
                .in('omie_id', chunk);
            }
            totalPurged += staleIds.length;
          }
        }
      }

      // 2. Sincronizar movimentos bancários recentes (últimos 15 dias) para atualizar data_pagamento no Regime de Caixa
      let movPage = 1;
      while (movPage <= 10) {
        const movData = await callOmie(
          'https://app.omie.com.br/api/v1/financas/mf/',
          'ListarMovimentos',
          appKey,
          appSecret,
          {
            nPagina: movPage,
            nRegPorPagina: 500,
            dDtPagDe: brSince
          }
        );
        const movs = movData?.movimentos || [];
        for (const m of movs) {
          const det = m.detalhes || {};
          const codTitulo = det.nCodTitulo;
          const dtPagIso = parseBrDate(det.dDtPagamento);
          if (codTitulo && dtPagIso) {
            await supabase
              .from('omie_financas_unificado')
              .update({
                data_pagamento: dtPagIso,
                status: 'PAGO'
              })
              .eq('empresa_nome', comp.name)
              .eq('omie_id', String(codTitulo));
            totalUpdatedMov++;
          }
        }
        const totalMovPages = Number(movData?.nTotPaginas || 1);
        if (movPage >= totalMovPages || movs.length === 0) break;
        movPage++;
      }
    }

    return NextResponse.json({
      ok: true,
      purgedCancelledOrStale: totalPurged,
      updatedPayments: totalUpdatedMov
    });
  } catch (err: any) {
    console.error('[painel-sync] Erro:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Erro ao sincronizar com Omie' },
      { status: 500 }
    );
  }
}
