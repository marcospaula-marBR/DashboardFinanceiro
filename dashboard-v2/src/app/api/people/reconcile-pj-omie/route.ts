import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Employee, MonthlyCost } from '@/types/loans';
import {
  getOmieDateWindowForCompetencia,
  OmiePayableRow,
  OmiePjDateMode,
  OmiePjStatusFilter,
  reconcileOmieTitlesForPj,
} from '@/services/people-omie-pj-reconciliation.service';

export const dynamic = 'force-dynamic';

async function fetchPaginatedOmiePayables(startDate: string, endDate: string): Promise<OmiePayableRow[]> {
  const pageSize = 1000;
  const maxPages = 10;
  const allRows: OmiePayableRow[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('omie_financas_unificado')
      .select(
        'id, omie_id, empresa_nome, tipo_registro, status, valor_total, valor_alocado, data_emissao, data_registro, data_vencimento, data_pagamento, categoria_codigo, categoria_nome, cliente_fornecedor, numero_documento, raw_data'
      )
      .eq('tipo_registro', 'PAGAR')
      .gte('data_vencimento', startDate)
      .lte('data_vencimento', endDate)
      .order('data_vencimento', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Erro ao consultar omie_financas_unificado: ${error.message}`);
    }

    const batch = (data || []) as OmiePayableRow[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return allRows;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const competencia = url.searchParams.get('competencia') || '';
    const dateModeParam = url.searchParams.get('dateMode') || 'next_month_due';
    const statusParam = url.searchParams.get('statusFilter') || 'all_valid';
    const companyFilter = url.searchParams.get('company') || 'all';

    const dateMode: OmiePjDateMode =
      dateModeParam === 'same_month_due' ? 'same_month_due' : 'next_month_due';
    const statusFilter: OmiePjStatusFilter =
      statusParam === 'paid_only' ? 'paid_only' : 'all_valid';

    const windowInfo = getOmieDateWindowForCompetencia(competencia, dateMode);
    if (!windowInfo.competenciaNormalized || !windowInfo.startDate || !windowInfo.endDate) {
      return NextResponse.json(
        { error: 'Competência inválida. Informe no formato YYYY-MM (ex.: 2026-10).' },
        { status: 400 }
      );
    }

    const [omieRows, empsRes, existingCostsRes] = await Promise.all([
      fetchPaginatedOmiePayables(windowInfo.startDate, windowInfo.endDate),
      supabase
        .from('employees')
        .select(
          'id, full_name, corporate_name, company, employment_type, pj_type, document_id, job_role, department, status, remuneration_fixed, remuneration'
        )
        .neq('full_name', '__SYSTEM_GLOBAL_CONFIG__'),
      supabase
        .from('people_monthly_costs')
        .select('id, employee_id, competencia, vinculo_tipo, valor_liquido')
        .eq('competencia', windowInfo.competenciaNormalized),
    ]);

    if (empsRes.error) {
      throw new Error(`Erro ao carregar contratadas PJ: ${empsRes.error.message}`);
    }

    const mappedEmployees: Partial<Employee>[] = (empsRes.data || []).map((row) => ({
      id: String(row.id),
      name: String(row.full_name || ''),
      corporate_name: row.corporate_name ? String(row.corporate_name) : undefined,
      company: row.company ? String(row.company) : 'MarBR',
      linkType: row.employment_type ? String(row.employment_type) : undefined,
      employment_type: row.employment_type ? String(row.employment_type) : undefined,
      pj_type: row.pj_type ? String(row.pj_type) : undefined,
      document_id: row.document_id ? String(row.document_id) : undefined,
      job_role: row.job_role ? String(row.job_role) : undefined,
      department: row.department ? String(row.department) : undefined,
      status: (row.status ? String(row.status) : 'Ativo') as Employee['status'],
      remuneration_fixed: row.remuneration_fixed !== null ? Number(row.remuneration_fixed) : undefined,
      remuneration: row.remuneration !== null ? Number(row.remuneration) : undefined,
    }));

    const existingCosts = (existingCostsRes.data || []) as Partial<MonthlyCost>[];

    const reconciliation = reconcileOmieTitlesForPj(omieRows, mappedEmployees, {
      competencia: windowInfo.competenciaNormalized,
      dateMode,
      statusFilter,
      companyFilter,
      existingCostsInCompetencia: existingCosts,
    });

    return NextResponse.json({
      success: true,
      ...reconciliation,
    });
  } catch (error: unknown) {
    console.error('Erro na conciliação PJ via Omie:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao conciliar faturamentos PJ via Omie.',
      },
      { status: 500 }
    );
  }
}
