import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, type FunctionDeclaration, type Content } from '@google/genai';
import { supabase } from '@/lib/supabase';
import type { Employee, MonthlyCost } from '@/types/loans';
import {
  AnalyticsFilterParams,
  EnrichedCostRecord,
  enrichHistoricalCosts,
  queryEmployeeCostHistory,
  queryMonthlyTrend,
  queryTopMoversMoM,
  queryTotalByPeriod,
  queryVerbaBreakdown,
  TopMoversParams,
} from '@/services/people-costs-analytics.service';

export const dynamic = 'force-dynamic';

interface ServerCacheEntry {
  fetchedAt: number;
  enriched: EnrichedCostRecord[];
  totalEmployees: number;
  minCompetencia: string;
  maxCompetencia: string;
}

const SERVER_CACHE_TTL_MS = 60_000;
let serverDatasetCache: ServerCacheEntry | null = null;

async function loadFullEnrichedDataset(forceRefresh = false): Promise<ServerCacheEntry> {
  if (!forceRefresh && serverDatasetCache && Date.now() - serverDatasetCache.fetchedAt < SERVER_CACHE_TTL_MS) {
    return serverDatasetCache;
  }

  const allCosts: Partial<MonthlyCost>[] = [];
  const step = 1000;
  for (let page = 0; page < 20; page += 1) {
    const from = page * step;
    const { data, error } = await supabase
      .from('people_monthly_costs')
      .select('*')
      .order('competencia', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + step - 1);

    if (error) throw new Error(`Erro ao carregar custos históricos: ${error.message}`);
    const batch = (data || []) as Partial<MonthlyCost>[];
    allCosts.push(
      ...batch.map((row) => ({
        ...row,
        ...((row.verbas_adicionais as Record<string, unknown> | undefined) || {}),
      }))
    );
    if (batch.length < step) break;
  }

  const { data: empsRaw, error: empErr } = await supabase
    .from('employees')
    .select(
      'id, full_name, corporate_name, company, employment_type, pj_type, document_id, job_role, department, status, remuneration_fixed, remuneration'
    )
    .neq('full_name', '__SYSTEM_GLOBAL_CONFIG__');

  if (empErr) throw new Error(`Erro ao carregar base de pessoas/contratadas: ${empErr.message}`);

  const mappedEmployees: Partial<Employee>[] = (empsRaw || []).map((row) => ({
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

  const enriched = enrichHistoricalCosts(allCosts, mappedEmployees);
  const months = Array.from(new Set(enriched.map((r) => r.competenciaMonth))).sort();

  serverDatasetCache = {
    fetchedAt: Date.now(),
    enriched,
    totalEmployees: mappedEmployees.length,
    minCompetencia: months[0] || '',
    maxCompetencia: months[months.length - 1] || '',
  };

  return serverDatasetCache;
}

const COPILOT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'queryTotalByPeriod',
    description:
      'Calcula totais desembolsados, headcount/contratadas únicas, segregação por natureza jurídica (Folha CLT, Estágio Lei 11.788/08 e Contratos PJ/MEI) e quebra por empresa (MarBR, DZM, G2) em qualquer período.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        startCompetencia: { type: Type.STRING, description: 'Competência inicial YYYY-MM (ex: 2026-01)' },
        endCompetencia: { type: Type.STRING, description: 'Competência final YYYY-MM (ex: 2026-06)' },
        year: { type: Type.INTEGER, description: 'Ano inteiro (ex: 2026)' },
        company: { type: Type.STRING, description: 'Empresa contratante: MarBR, DZM, G2 ou all' },
        regime: { type: Type.STRING, description: 'Natureza jurídica: CLT, ESTAGIO, PJ ou ALL' },
        department: { type: Type.STRING, description: 'Filtro parcial de departamento/setor' },
      },
    },
  },
  {
    name: 'queryVerbaBreakdown',
    description:
      'Calcula a soma exata de cada verba contábil no período (VT, VR/Cesta, Bônus, Premiação, Adiantamento, Descontos Folha, Bolsa-Auxílio, Honorários PJ, Comissões, Incentivos, Conectividade e Glosas).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        startCompetencia: { type: Type.STRING, description: 'Competência inicial YYYY-MM' },
        endCompetencia: { type: Type.STRING, description: 'Competência final YYYY-MM' },
        year: { type: Type.INTEGER, description: 'Ano inteiro (ex: 2026)' },
        company: { type: Type.STRING, description: 'Empresa contratante: MarBR, DZM, G2 ou all' },
        regime: { type: Type.STRING, description: 'Natureza jurídica: CLT, ESTAGIO, PJ ou ALL' },
        department: { type: Type.STRING, description: 'Filtro parcial de departamento' },
      },
    },
  },
  {
    name: 'queryTopMoversMoM',
    description:
      'Identifica as maiores variações Mês contra Mês (altas ou quedas em R$ e %) por colaborador CLT, estagiário ou empresa contratada PJ/MEI.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        competencia: { type: Type.STRING, description: 'Competência alvo YYYY-MM (se omitida, usa a mais recente da base)' },
        company: { type: Type.STRING, description: 'MarBR, DZM, G2 ou all' },
        regime: { type: Type.STRING, description: 'CLT, ESTAGIO, PJ ou ALL' },
        minDeltaPercent: { type: Type.NUMBER, description: 'Percentual mínimo de variação (ex: 10 para > 10%)' },
        direction: { type: Type.STRING, description: 'up (altas), down (quedas) ou both (ambas)' },
        limit: { type: Type.INTEGER, description: 'Quantidade máxima de linhas (padrão 10)' },
      },
    },
  },
  {
    name: 'queryEmployeeCostHistory',
    description:
      'Consulta a série histórica completa de lançamentos de um colaborador CLT, estagiário ou empresa contratada PJ específica por nome, razão social ou CPF/CNPJ.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Nome, Razão Social, CPF ou CNPJ' },
        startCompetencia: { type: Type.STRING, description: 'Competência inicial YYYY-MM' },
        endCompetencia: { type: Type.STRING, description: 'Competência final YYYY-MM' },
      },
      required: ['query'],
    },
  },
  {
    name: 'queryMonthlyTrend',
    description:
      'Retorna a evolução mensal (série temporal mês a mês) com valores separados de Folha CLT, Estágio e Contratos PJ/MEI, total geral e variação MoM %.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        year: { type: Type.INTEGER, description: 'Ano de filtro (ex: 2026)' },
        startCompetencia: { type: Type.STRING, description: 'Competência inicial YYYY-MM' },
        endCompetencia: { type: Type.STRING, description: 'Competência final YYYY-MM' },
        company: { type: Type.STRING, description: 'MarBR, DZM, G2 ou all' },
        regime: { type: Type.STRING, description: 'CLT, ESTAGIO, PJ ou ALL' },
      },
    },
  },
];

function executeDeterministicTool(
  toolName: string,
  args: Record<string, unknown>,
  enriched: EnrichedCostRecord[]
): unknown {
  if (toolName === 'queryTotalByPeriod') {
    return queryTotalByPeriod(enriched, args as AnalyticsFilterParams);
  }
  if (toolName === 'queryVerbaBreakdown') {
    return queryVerbaBreakdown(enriched, args as AnalyticsFilterParams);
  }
  if (toolName === 'queryTopMoversMoM') {
    return queryTopMoversMoM(enriched, args as TopMoversParams);
  }
  if (toolName === 'queryEmployeeCostHistory') {
    return queryEmployeeCostHistory(enriched, {
      query: String(args.query || ''),
      startCompetencia: args.startCompetencia ? String(args.startCompetencia) : undefined,
      endCompetencia: args.endCompetencia ? String(args.endCompetencia) : undefined,
    });
  }
  if (toolName === 'queryMonthlyTrend') {
    return queryMonthlyTrend(enriched, args as AnalyticsFilterParams);
  }
  return { error: `Ferramenta desconhecida: ${toolName}` };
}

function formatBrl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function runDeterministicFallbackAnswer(
  question: string,
  dataset: ServerCacheEntry
): { answer: string; toolExecutions: Array<{ tool: string; args: Record<string, unknown>; result: unknown }> } {
  const q = question.toLowerCase();
  const yearMatch = q.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : parseInt(dataset.maxCompetencia.slice(0, 4) || '2026', 10);
  const company = q.includes('dzm') ? 'DZM' : q.includes('marbr') || q.includes('mar brasil') ? 'MarBR' : q.includes('g2') ? 'G2' : 'all';
  const regime: 'CLT' | 'ESTAGIO' | 'PJ' | 'ALL' =
    q.includes('pj') || q.includes('mei') ? 'PJ' : q.includes('estag') || q.includes('estág') ? 'ESTAGIO' : q.includes('clt') ? 'CLT' : 'ALL';

  if (q.includes('subir') || q.includes('varia') || q.includes('aument') || q.includes('queda')) {
    const args: TopMoversParams = { company, regime, minDeltaPercent: 10, direction: q.includes('queda') ? 'down' : 'up', limit: 10 };
    const res = queryTopMoversMoM(dataset.enriched, args);
    const lines = res.variacoes.map(
      (v) => `- **${v.entidade}** (${v.naturezaJuridica} • ${v.empresa}): ${formatBrl(v.valorMesAnterior)} → ${formatBrl(v.valorMesAtual)} (${v.variacaoAbsoluta >= 0 ? '+' : ''}${formatBrl(v.variacaoAbsoluta)} / ${v.variacaoPercentual >= 0 ? '+' : ''}${v.variacaoPercentual}%)`
    );
    return {
      toolExecutions: [{ tool: 'queryTopMoversMoM', args: args as Record<string, unknown>, result: res }],
      answer: `### Maiores Variações MoM (${res.competenciaAnterior} → ${res.competencia})\n\n${lines.length > 0 ? lines.join('\n') : 'Nenhuma variação encontrada acima do limite configurado.'}`,
    };
  }

  if (q.includes('vt') || q.includes('vr') || q.includes('cesta') || q.includes('bônus') || q.includes('bonus') || q.includes('premia') || q.includes('adiant')) {
    const args: AnalyticsFilterParams = { year, company, regime };
    const res = queryVerbaBreakdown(dataset.enriched, args);
    return {
      toolExecutions: [{ tool: 'queryVerbaBreakdown', args: args as Record<string, unknown>, result: res }],
      answer:
        `### Decomposição de Verbas (${year}${company !== 'all' ? ` • ${company}` : ''})\n\n` +
        `- **Folha CLT (${res.folhaClt.registros} lanç.):** Proventos ${formatBrl(res.folhaClt.proventosFolha)} | VT ${formatBrl(res.folhaClt.valeTransporteVt)} | VR/Cesta ${formatBrl(res.folhaClt.vrCestaBasica)} | Bônus ${formatBrl(res.folhaClt.bonus)} | Premiação ${formatBrl(res.folhaClt.premiacao)} | Adiantamento ${formatBrl(res.folhaClt.adiantamentoSalarial)} | **Líquido ${formatBrl(res.folhaClt.liquidoClt)}**\n` +
        `- **Estágio — Lei nº 11.788/2008 (${res.estagioLei11788.registros} lanç.):** Bolsa-Auxílio ${formatBrl(res.estagioLei11788.bolsaAuxilio)} | Aux. Transporte ${formatBrl(res.estagioLei11788.auxilioTransporte)} | **Líquido ${formatBrl(res.estagioLei11788.liquidoEstagio)}**\n` +
        `- **Contratos PJ/MEI (${res.contratosPjMei.registros} lanç.):** Honorários ${formatBrl(res.contratosPjMei.honorariosBase)} | Bônus ${formatBrl(res.contratosPjMei.bonusContratual)} | Comissões ${formatBrl(res.contratosPjMei.comissoes)} | Incentivos ${formatBrl(res.contratosPjMei.incentivos)} | Conectividade ${formatBrl(res.contratosPjMei.conectividadeReembolso)} | **Valor Líquido NF ${formatBrl(res.contratosPjMei.valorLiquidoNf)}**\n\n` +
        `**Total Geral Desembolsado:** ${formatBrl(res.totalGeralDesembolsado)}`,
    };
  }

  const args: AnalyticsFilterParams = { year, company, regime };
  const total = queryTotalByPeriod(dataset.enriched, args);
  return {
    toolExecutions: [{ tool: 'queryTotalByPeriod', args: args as Record<string, unknown>, result: total }],
    answer:
      `### Consolidado Executivo (${year}${company !== 'all' ? ` • ${company}` : ''})\n\n` +
      `- **Folha CLT:** ${formatBrl(total.porNaturezaJuridica.folhaClt.totalLiquido)} (${total.porNaturezaJuridica.folhaClt.entidadesUnicas} empregados únicos)\n` +
      `- **Estágio (Lei nº 11.788/2008):** ${formatBrl(total.porNaturezaJuridica.bolsasEstagioLei11788.totalLiquido)} (${total.porNaturezaJuridica.bolsasEstagioLei11788.entidadesUnicas} estagiários)\n` +
      `- **Contratos PJ / MEI (B2B):** ${formatBrl(total.porNaturezaJuridica.contratosPjMei.totalLiquido)} (${total.porNaturezaJuridica.contratosPjMei.entidadesUnicas} contratadas)\n` +
      `- **Total Geral Desembolsado:** **${formatBrl(total.totalGeralDesembolsado)}** (${total.totalRegistros} lançamentos auditados)`,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = String(body?.question || '').trim();
    const forceRefresh = Boolean(body?.forceRefresh);

    if (!question) {
      return NextResponse.json({ error: 'Informe uma pergunta executiva sobre os custos.' }, { status: 400 });
    }

    const dataset = await loadFullEnrichedDataset(forceRefresh);
    const coverage = {
      totalRowsAnalyzed: dataset.enriched.length,
      totalEmployees: dataset.totalEmployees,
      minCompetencia: dataset.minCompetencia,
      maxCompetencia: dataset.maxCompetencia,
    };

    if (!process.env.GEMINI_API_KEY) {
      const fb = runDeterministicFallbackAnswer(question, dataset);
      return NextResponse.json({
        success: true,
        mode: 'deterministic_fallback',
        coverage,
        ...fb,
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const systemInstruction = `Você é o Copiloto Executivo de Custos de Pessoal e Contratos do Grupo Mar Brasil (MarBR, DZM e G2).
REGRAS INVIOLÁVEIS:
1. NUNCA invente, estime ou arredonde arbitrariamente qualquer número. Sempre consulte as ferramentas determinísticas disponíveis antes de responder.
2. Cobertura total da base real carregada: ${dataset.enriched.length} lançamentos de ${dataset.minCompetencia} até ${dataset.maxCompetencia}.
3. BLINDAGEM JURÍDICA OBRIGATÓRIA:
   - Para CLT use termos trabalhistas: Folha CLT, Empregados, Proventos, VT, VR/Cesta, Adiantamento, Líquido.
   - Para Estágio cite Lei nº 11.788/2008: Estagiários, Bolsa-Auxílio, Auxílio-Transporte.
   - Para PJ / MEI use EXCLUSIVAMENTE termos empresariais B2B: Empresas Contratadas, Honorários Base, Variável/Comissões, Conectividade, Glosas/Deduções e Valor Líquido NF. NUNCA chame PJ de "empregado", "salário" ou "folha".
4. Responda em português executivo, direto, estruturado em Markdown com valores formatados em R$ (pt-BR), indicando claramente o período e os filtros utilizados.`;

    const contents: Content[] = [{ role: 'user', parts: [{ text: question }] }];
    const toolExecutions: Array<{ tool: string; args: Record<string, unknown>; result: unknown }> = [];

    let finalAnswer = '';
    for (let turn = 0; turn < 4; turn += 1) {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          temperature: 0,
          systemInstruction,
          tools: [{ functionDeclarations: COPILOT_TOOLS }],
        },
      });

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const modelContent = response.candidates?.[0]?.content;
        if (modelContent) {
          contents.push(modelContent);
        }

        const responseParts = functionCalls.map((call) => {
          const toolName = String(call.name || '');
          const args = (call.args as Record<string, unknown> | undefined) || {};
          const result = executeDeterministicTool(toolName, args, dataset.enriched);
          toolExecutions.push({ tool: toolName, args, result });
          return {
            functionResponse: {
              name: toolName,
              response: { result },
            },
          };
        });

        contents.push({ role: 'user', parts: responseParts });
      } else {
        finalAnswer = response.text || '';
        break;
      }
    }

    if (!finalAnswer) {
      const fb = runDeterministicFallbackAnswer(question, dataset);
      return NextResponse.json({
        success: true,
        mode: 'deterministic_fallback',
        coverage,
        answer: fb.answer,
        toolExecutions: toolExecutions.length > 0 ? toolExecutions : fb.toolExecutions,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'gemini_tool_calling',
      coverage,
      answer: finalAnswer,
      toolExecutions,
    });
  } catch (error: unknown) {
    console.error('Erro no Copiloto de Custos:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao processar consulta executiva de custos.',
      },
      { status: 500 }
    );
  }
}
