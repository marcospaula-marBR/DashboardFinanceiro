import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';


// Helper to parse currency values from various formats
function parseCurrency(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let s = val.toString().trim().replace('R$', '').trim();
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return parseFloat(s) || 0;
}

// Helper to convert DD/MM/YYYY or YYYY-MM-DD to YYYY-MM-DD
function parseDateToISO(dateStr: any): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  let s = dateStr.toString().trim();
  if (s.includes(' ')) s = s.split(' ')[0];
  let parts;
  if (s.includes('/')) {
    parts = s.split('/');
    if (parts.length === 3) {
      let d = parts[0].padStart(2, '0');
      let m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 2) y = '20' + y;
      return `${y}-${m}-${d}`;
    }
  } else if (s.includes('-')) {
    parts = s.split('-');
    if (parts.length === 3) {
      let y = parts[0];
      let m = parts[1].padStart(2, '0');
      let d = parts[2].padStart(2, '0');
      if (y.length === 2) {
        d = parts[0].padStart(2, '0');
        y = '20' + parts[2];
      }
      return `${y}-${m}-${d}`;
    }
  }
  return new Date().toISOString().split('T')[0];
}

// Normalizer and helper to extract keys from CSV-like records
const normalize = (s: string) => s ? s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
const getValue = (row: any, candidates: string[]): string => {
  const rowKeys = Object.keys(row);
  for (const candidate of candidates) {
    const normCandidate = normalize(candidate);
    let match = rowKeys.find(k => normalize(k) === normCandidate);
    if (match) return row[match];
  }
  for (const candidate of candidates) {
    const normCandidate = normalize(candidate);
    let match = rowKeys.find(k => normalize(k).includes(normCandidate));
    if (match) return row[match];
  }
  return '';
};

// Generates installments list
function generateInstallments(
  debtId: string,
  totalParcelas: number,
  valorParcela: number,
  dataInicio: string,
  vencDia: number,
  parcelasPagas: number
) {
  const installments = [];
  const [year, month, day] = dataInicio.split('-').map(Number);
  const dayOfVenc = vencDia || day || 1;

  for (let i = 0; i < totalParcelas; i++) {
    const targetMonth = month - 1 + i;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normMonth = targetMonth % 12;
    
    const lastDay = new Date(targetYear, normMonth + 1, 0).getDate();
    const safeDay = Math.min(dayOfVenc, lastDay);
    const vencimento = new Date(targetYear, normMonth, safeDay);
    
    const vencDate = vencimento.toISOString().split('T')[0];
    const isPaid = i < parcelasPagas;

    installments.push({
      debt_id: debtId,
      numero: i + 1,
      valor: valorParcela,
      vencimento: vencDate,
      pago: isPaid,
      data_pagamento: isPaid ? vencDate : null,
      observacao: null,
    });
  }
  return installments;
}

export async function GET() {
  try {
    const { data: debts, error } = await supabase
      .from('debts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!debts || debts.length === 0) {
      return NextResponse.json([]);
    }

    const ids = debts.map((d) => d.id);
    const { data: installments, error: instErr } = await supabase
      .from('debt_installments')
      .select('*')
      .in('debt_id', ids)
      .order('numero', { ascending: true })
      .limit(10000);

    if (instErr) throw new Error(instErr.message);

    const instMap = new Map<string, any[]>();
    (installments || []).forEach((inst) => {
      if (!instMap.has(inst.debt_id)) instMap.set(inst.debt_id, []);
      instMap.get(inst.debt_id)!.push(inst);
    });

    const mappedRows = debts.map((debt) => {
      const insts = instMap.get(debt.id) || [];
      const paidInsts = insts.filter(i => i.pago);
      const pendingInsts = insts.filter(i => !i.pago && i.observacao !== 'Desistido');
      const paidCount = paidInsts.length;
      const remainingCount = pendingInsts.length;
      const paidValue = paidInsts.reduce((sum, i) => sum + i.valor, 0);

      let format = '';
      let details = '';
      let doc = '';
      let cc = '';
      let banco = '';
      let typeFromObs = '';

      if (debt.observacoes) {
        const obsStr = debt.observacoes.trim();
        if (obsStr.startsWith('{') && obsStr.endsWith('}')) {
          try {
            const parsed = JSON.parse(obsStr);
            details = parsed.details || '';
            format = parsed.format || '';
            banco = parsed.banco || '';
            doc = parsed.doc || '';
            cc = parsed.cc || '';
          } catch {}
        } else {
          // Parse pipe-separated format: Key: Value | Key2: Value2
          const parts = obsStr.split('|');
          parts.forEach((part: string) => {
            const colonIdx = part.indexOf(':');
            if (colonIdx !== -1) {
              const k = part.substring(0, colonIdx).trim().toLowerCase();
              const v = part.substring(colonIdx + 1).trim();
              if (k === 'detalhes' || k === 'obs') {
                details = v;
              } else if (k === 'tipo') {
                typeFromObs = v;
              } else if (k === 'doc' || k === 'documento') {
                doc = v;
              } else if (k === 'cc' || k === 'centro de custo') {
                cc = v;
              } else if (k === 'formato' || k === 'format') {
                format = v;
              } else if (k === 'banco' || k === 'cartao' || k === 'cartão') {
                banco = v;
              }
            }
          });
          if (!details && !typeFromObs && !doc && !cc && !format) {
            details = obsStr;
          }
        }
      }

      // Normalization check to align legacy and new structures
      // Old structure: Categoria column stores format ('Financiamento'), Observacoes stores type ('Tipo: ATIVOS')
      // New structure: Categoria column stores type ('ATIVOS'), Observacoes stores format ('Financiamento')
      const FORMAT_OPTIONS = ['financiamento', 'emprestimo', 'consorcio', 'leasing', 'cartao', 'fornecedor', 'mutuo', 'outros'];
      const catNorm = (debt.categoria || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      let finalFormat = format || '';
      let finalType = debt.categoria || '';

      // Fallback para dados legados: Se o JSON 'format' estiver vazio, tenta inferir das colunas antigas
      if (!format) {
        if (FORMAT_OPTIONS.includes(catNorm)) {
          finalFormat = debt.categoria;
          finalType = typeFromObs || 'ATIVOS';
        } else if (typeFromObs) {
          finalFormat = typeFromObs;
        }
      }

      let endDate = '';
      if (insts.length > 0) {
        const lastVenc = insts[insts.length - 1].vencimento;
        const [y, m, d] = lastVenc.split('-');
        endDate = `${d}/${m}/${y}`;
      }

      const [sY, sM, sD] = debt.data_inicio.split('-');
      const startDateFormatted = `${sD}/${sM}/${sY}`;

      return {
        id: debt.id,
        installments: insts,
        "ATIVOS E BENS": debt.descricao || '',
        "Detalhes": details,
        "FORMATO": finalFormat,
        "TIPO": finalType,
        "BANCO": banco,
        "EMPRESA": debt.empresa || '',
        "Documento": doc,
        "CENTRO DE CUSTO": cc,
        "STATUS": debt.status || '',
        "FORMA DE PAGTO": debt.credor || '',
        "Dia Débito": debt.data_vencimento_dia || '',
        "Início Contrato": startDateFormatted,
        "Término Contrato": endDate,
        "Total Contrato": debt.valor_total || 0,
        "Parcelas Contratadas": debt.total_parcelas || 0,
        "Valor Parcela": debt.valor_parcela || 0,
        "Parcelas Pagas": paidCount,
        "Parcelas Restantes": remainingCount,
        "Total Pago": paidValue,
        "Montante a Pagar": debt.valor_total - paidValue
      };
    });

    return NextResponse.json(mappedRows);
  } catch (error: any) {
    console.error('Error fetching debts:', error);
    return NextResponse.json({ error: error.message || 'Error fetching debts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // 1. Single contract creation mode
    if (!Array.isArray(payload)) {
      const {
        descricao,
        empresa,
        categoria,
        credor,
        valor_total,
        status,
        observacoes,
        startDate,
        dueDay,
        totalInstallments,
        installmentValue,
        paidCount
      } = payload;

      // Insert debt header
      const { data: inserted, error: insertError } = await supabase
        .from('debts')
        .insert({
          empresa,
          descricao,
          credor,
          categoria,
          valor_total: valor_total || (installmentValue * totalInstallments),
          total_parcelas: totalInstallments,
          valor_parcela: installmentValue,
          data_inicio: startDate,
          data_vencimento_dia: dueDay || null,
          status: status || 'Ativo',
          observacoes,
        })
        .select()
        .single();

      if (insertError || !inserted) {
        throw new Error(insertError?.message || 'Failed to insert debt');
      }

      // Generate and insert installments if totalInstallments > 0
      if (totalInstallments > 0) {
        const installments = generateInstallments(
          inserted.id,
          totalInstallments,
          installmentValue,
          startDate,
          dueDay,
          paidCount
        );

        const { error: instError } = await supabase
          .from('debt_installments')
          .insert(installments);

        if (instError) {
          throw new Error(instError.message);
        }
      }

      return NextResponse.json({ success: true, id: inserted.id });
    }

    // 2. CSV Import Mode (wipes and inserts)
    // Clean old records first
    await supabase.from('debt_installments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('debts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    for (const row of payload) {
      const descricao = getValue(row, ['Ativos e bens', 'Ativos', 'Descrição', 'Item', 'Objeto', 'Nome']);
      const empresa = getValue(row, ['empresa', 'Empresa', 'Fornecedor', 'Credor']);
      const credor = getValue(row, ['FORMA DE PAGTO', 'forma_pagto']);
      const categoria = getValue(row, ['tipo', 'Tipo', 'Categoria', 'Classificação']) || 'Outros';
      const valor_total = parseCurrency(getValue(row, ['total do contrato', 'Total Contrato', 'Valor Total', 'Total', 'Valor Global']));
      const total_parcelas = parseInt(getValue(row, ['parcelas contratadas', 'Parcelas Contratadas', 'Total Parcelas', 'Qtd Parcelas', 'Prazo']) || '0');
      const valor_parcela = parseCurrency(getValue(row, ['Valor da parcela', 'Valor Parcela', 'Parcela', 'Mensalidade']));
      const data_inicio = parseDateToISO(getValue(row, ['inicício de contrato', 'inicio de contrato', 'Início', 'Inicio', 'Data Inicio', 'Data de Inicio', 'Contratação']));
      const data_vencimento_dia = parseInt(getValue(row, ['Dia Débito', 'dia_debito', 'Dia vencimento']) || '0');
      const status = getValue(row, ['status', 'Status', 'Situação', 'Estado']) || 'Ativo';

      // Additional columns for observations JSON
      const details = getValue(row, ['Detalhes', 'detalhes']);
      const format = getValue(row, ['FORMATO', 'formato']);
      const doc = getValue(row, ['Documento', 'documento']);
      const cc = getValue(row, ['CENTRO DE CUSTO', 'centro_de_custo']);

      const observacoes = JSON.stringify({ details, format, doc, cc });

      const paidCount = parseInt(getValue(row, ['Parcelas Pagas', 'parcelas_pagas']) || '0');

      if (valor_total <= 0 && valor_parcela <= 0) continue;

      const { data: inserted, error: insertError } = await supabase
        .from('debts')
        .insert({
          empresa,
          descricao,
          credor,
          categoria,
          valor_total,
          total_parcelas,
          valor_parcela,
          data_inicio,
          data_vencimento_dia: data_vencimento_dia || null,
          status,
          observacoes,
        })
        .select()
        .single();

      if (insertError || !inserted) {
        throw new Error(insertError?.message || 'Failed to insert debt');
      }

      if (total_parcelas > 0) {
        const installments = generateInstallments(
          inserted.id,
          total_parcelas,
          valor_parcela,
          data_inicio,
          data_vencimento_dia,
          paidCount
        );

        const { error: instError } = await supabase
          .from('debt_installments')
          .insert(installments);

        if (instError) {
          throw new Error(instError.message);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving debts:', error);
    return NextResponse.json({ error: error.message || 'Error saving debts' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, empresa, descricao, credor, categoria, valor_total, total_parcelas, valor_parcela, data_inicio, data_vencimento_dia, status, observacoes, installments } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    // 1. Atualizar o cabeçalho (apenas chaves fornecidas para evitar sobrescrever com null)
    const updateObj: any = {
      empresa,
      descricao,
      credor,
      categoria,
      valor_total,
      status,
      observacoes
    };

    if (total_parcelas !== undefined) updateObj.total_parcelas = total_parcelas;
    if (valor_parcela !== undefined) updateObj.valor_parcela = valor_parcela;
    if (data_inicio !== undefined) updateObj.data_inicio = parseDateToISO(data_inicio);
    if (data_vencimento_dia !== undefined) updateObj.data_vencimento_dia = data_vencimento_dia || null;

    const { error: updateError } = await supabase
      .from('debts')
      .update(updateObj)
      .eq('id', id);

    if (updateError) throw new Error(updateError.message);

    // 2. Atualizar as parcelas
    if (Array.isArray(installments)) {
      for (const inst of installments) {
        const isTemp = !inst.id || inst.id.toString().startsWith('temp_');
        if (!isTemp) {
          // Atualizar parcela existente
          const { error: instErr } = await supabase
            .from('debt_installments')
            .update({
              valor: inst.valor,
              vencimento: inst.vencimento,
              pago: inst.pago,
              data_pagamento: inst.pago ? (inst.data_pagamento || inst.vencimento) : null,
              observacao: inst.observacao || null
            })
            .eq('id', inst.id);
          if (instErr) throw new Error(instErr.message);
        } else {
          // Inserir nova parcela
          const { error: instErr } = await supabase
            .from('debt_installments')
            .insert({
              debt_id: id,
              numero: inst.numero,
              valor: inst.valor,
              vencimento: inst.vencimento,
              pago: inst.pago,
              data_pagamento: inst.pago ? (inst.data_pagamento || inst.vencimento) : null,
              observacao: inst.observacao || null
            });
          if (instErr) throw new Error(instErr.message);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating debt:', error);
    return NextResponse.json({ error: error.message || 'Error updating debt' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    // 1. Deletar parcelas
    const { error: instErr } = await supabase
      .from('debt_installments')
      .delete()
      .eq('debt_id', id);

    if (instErr) throw new Error(instErr.message);

    // 2. Deletar cabeçalho
    const { error: debtErr } = await supabase
      .from('debts')
      .delete()
      .eq('id', id);

    if (debtErr) throw new Error(debtErr.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting debt:', error);
    return NextResponse.json({ error: error.message || 'Error deleting debt' }, { status: 500 });
  }
}

