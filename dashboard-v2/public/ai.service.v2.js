




// Detecção de ambiente e definição da URL da API de Chat
const GEMINI_API_URL = "/api/chat";

class GeminiService {
    constructor() {
        this.apiKey = null;
        this.isLocal = false; // Sempre usará a rota do Next.js
        console.log("☁️ BrisinhAI: Integrado via Rota de API Next.js");
    }

    isAuthenticated() {
        if (this.isLocal) {
            return this.apiKey && this.apiKey.length > 0;
        }
        return true; // Em produção, autenticação é tratada no servidor
    }

    setKey(key) {
        if (this.isLocal) {
            this.apiKey = key;
        }
    }

    async generateAnalysis(contextData, userQuestion = null, signal = null) {
        const prompt = this._buildPrompt(contextData, userQuestion);
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                if (signal && signal.aborted) {
                    throw new DOMException("The user aborted a request.", "AbortError");
                }

                let response;

                if (this.isLocal) {
                    // Modo LOCAL: Chama API diretamente
                    const DIRECT_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`;

                    response = await fetch(DIRECT_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{ text: prompt }]
                            }],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 8192,
                                thinkingConfig: {
                                    thinkingBudget: 0
                                }
                            }
                        }),
                        signal: signal
                    });
                } else {
                    // Modo PRODUÇÃO: Usa proxy Vercel
                    response = await fetch(GEMINI_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: prompt
                        }),
                        signal: signal
                    });
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    let errorData;

                    try {
                        errorData = JSON.parse(errorText);
                    } catch {
                        throw new Error(`Erro HTTP ${response.status}: ${errorText.substring(0, 200)}`);
                    }

                    if (response.status === 503) {
                        console.warn(`Tentativa ${attempt + 1} falhou: ${response.statusText}. Tentando novamente...`);
                        attempt++;
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        continue;
                    }

                    throw new Error(`Erro na IA: ${errorData.error?.message || response.statusText}`);
                }

                const data = await response.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text === undefined) {
                    const finishReason = data?.candidates?.[0]?.finishReason;
                    if (finishReason && finishReason !== "STOP") {
                        return `⚠️ A resposta foi bloqueada ou interrompida pela IA. Motivo: ${finishReason}`;
                    }
                    return "Desculpe, não consegui obter uma resposta válida da Inteligência Artificial. Por favor, tente novamente.";
                }
                return text;

            } catch (error) {
                // Se esgotou as tentativas ou é outro erro, lança
                if (attempt >= maxRetries - 1 || !error.message.includes("overloaded")) {
                    console.error("Erro ao chamar Gemini:", error);
                    if (error.message.includes("not found")) this.logAvailableModels();
                    throw error;
                }
                attempt++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        throw new Error("Não foi possível obter resposta do servidor da IA após várias tentativas.");
    }

    async logAvailableModels() {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            const data = await response.json();
            console.log("Modelos Disponíveis para sua chave:", data.models);
        } catch (e) {
            console.error("Erro ao listar modelos:", e);
        }
    }

    _buildPrompt(data, userQuestion) {
        // Truncate CSV Data if too large (Safety limit for API payload)
        const MAX_ROWS = 1500;
        let sanitizedData = { ...data };

        if (sanitizedData.csvData && Array.isArray(sanitizedData.csvData) && sanitizedData.csvData.length > MAX_ROWS) {
            console.warn(`BrisinhAI: Truncating CSV data from ${sanitizedData.csvData.length} to ${MAX_ROWS} rows.`);
            sanitizedData.csvData = sanitizedData.csvData.slice(0, MAX_ROWS);
            sanitizedData.note = "Dataset truncated for analysis limit.";
        }

        const contextString = JSON.stringify(sanitizedData, null, 2);
        let persona = `
Você é o BrisinhAI, o CFO virtual e consultor executivo corporativo do Grupo Mar Brasil.
Você é o parceiro estratégico da diretoria e dos gestores em todos os módulos e análises do Dashboard: DRE, Simulação de Cenários & Precificação, Gestão de Pessoas (RH/Folha), Conciliação Clara (Cartões Corporativos), Fluxo de Caixa, Faturamento, Empréstimos/Dívidas, Seguros, Recebíveis e Comissões.
Sua postura é altamente analítica, pragmática, concisa e orientada a resultados financeiros concretos.
`;

        // Define specific instructions based on page type
        let focusArea = "";
        switch (data.pageType) {
            case 'DRE':
                focusArea = `
FOCO DA ANÁLISE (DRE & CONTROLADORIA):
1. Analise a saúde financeira focando em Receita Líquida, Margem de Contribuição, EBITDA e Lucro Líquido/FCL.
2. Identifique variações significativas nos custos e despesas estruturais rateadas (DR_p).
3. Compare o realizado com métricas ideais e alerte sobre pressões de margem.
4. Sugira ações para redução de custos ou otimização de faturamento.
`;
                break;
            case 'SIMULADOR_DRE':
            case 'SIMULADOR_PRECIFICACAO':
                focusArea = `
FOCO DA ANÁLISE (SIMULADOR DE CENÁRIOS & PRECIFICAÇÃO DRE):
1. Avalie o cenário simulado em relação à base real do DRE (Faturamento Base, Despesas Rateadas DR_p, Custos Diretos e EBITDA).
2. Analise os impactos percentuais e nominais no EBITDA causados pelas variações em receita, custos ou rubricas de despesas.
3. Avalie a margem de contribuição dos contratos e se a estrutura de despesas fixas rateadas está coberta.
4. Aponte com precisão: Diagnóstico do Cenário, Pontos de Preocupação/Riscos e Medidas Práticas recomendadas (recomposição de margem, corte de despesas, preço mínimo).
`;
                break;
            case 'CONCILIACAO_CLARA':
            case 'CLARA':
                focusArea = `
FOCO DA ANÁLISE (CONCILIAÇÃO CLARA - CARTÕES CORPORATIVOS):
1. Analise o volume de transações a conciliar, lançadas no Omie e pendentes de classificação.
2. Avalie despesas atípicas por portador, departamento ou categoria contábil.
3. Alerte sobre faturas com vencimento próximo e necessidade de auditoria de comprovantes fiscais (OCR).
4. Recomende melhorias no processo de conciliação e redução de despesas com cartões.
`;
                break;
            case 'PEOPLE':
            case 'PEOPLE_HR':
                focusArea = `
FOCO DA ANÁLISE (COLABORADORES & RECURSOS HUMANOS - RH):
1. Analise a distribuição do headcount e custos de folha por empresa, setor e regime de vínculo (CLT, MEI, PJ, Estagiário).
2. Avalie salários médios, custos com bônus e comissões alocados.
3. Aponte inconsistências de auditoria de dados de RH, gargalos de alocação ou concentração de custos.
4. Forneça recomendações sobre eficiência da folha de pagamento e gestão de talentos.
`;
                break;
            case 'PARCELAMENTOS':
            case 'EMPRESTIMOS_PARCELAMENTOS':
            case 'EMPRESTIMOS':
            case 'LOANS':
                focusArea = `
FOCO DA ANÁLISE (EMPRÉSTIMOS, FINANCIAMENTOS & DÍVIDAS):
1. Analise o perfil da dívida (curto vs longo prazo) e o volume total de passivos.
2. Destaque os maiores credores, taxas e a concentração das parcelas.
3. Alerte sobre parcelas altas iminentes e impacto no fluxo de caixa.
4. Sugira estratégias de renegociação, amortização ou liquidação antecipada.
`;
                break;
            case 'FLUXO_CAIXA':
                focusArea = `
FOCO DA ANÁLISE (FLUXO DE CAIXA & LIQUIDEZ):
1. Analise as entradas vs saídas e o saldo financeiro diário/semanal.
2. Identifique descasamentos de prazo e períodos de pressão sobre o caixa.
3. Avalie a necessidade de capital de giro e sugira ações preventivas de liquidez.
`;
                break;
            case 'FATURAMENTO':
                focusArea = `
FOCO DA ANÁLISE (FATURAMENTO & RECEITAS):
1. Avalie a evolução do faturamento bruto e líquido por empresa e contrato.
2. Analise o atingimento de metas e o impacto das retenções tributárias.
3. Identifique sazonalidades e concentração de receita em clientes específicos.
`;
                break;
            case 'RECEBIVEIS':
                focusArea = `
FOCO DA ANÁLISE (RECEBÍVEIS & COBRANÇA):
1. Avalie a carteira de recebíveis, prazos médios e índice de inadimplência.
2. Aponte títulos vencidos ou com risco de perda e recomende ações de cobrança.
`;
                break;
            case 'SEGUROS':
                focusArea = `
FOCO DA ANÁLISE (SEGUROS & APÓLICES):
1. Analise a cobertura total, vigências e o custo dos prêmios das apólices corporativas.
2. Identifique apólices próximas do vencimento que exigem renovação imediata.
3. Avalie concentração de risco por corretor/seguradora e oportunidade de redução de prêmio.
`;
                break;
            case 'COMISSOES':
                focusArea = `
FOCO DA ANÁLISE (COMISSÕES & INCENTIVOS DE VENDAS):
1. Avalie o valor total de comissões apuradas e o alinhamento com as margens de lucro dos contratos.
2. Identifique se o plano de incentivo comercial está sustentável frente ao resultado operacional.
`;
                break;
            default:
                focusArea = `
FOCO DA ANÁLISE (PAINEL EXECUTIVO CORPORATIVO):
1. Analise com precisão todos os indicadores, números, tabelas e filtros visíveis na tela.
2. Identifique tendências de negócios, anomalias e pontos críticos de atenção.
3. Forneça recomendações práticas e soluções financeiras alinhadas aos objetivos da Mar Brasil.
`;
                break;
        }

        let basePrompt = `
${persona}
${focusArea}

Abaixo estão os dados capturados da tela atual (${data.pageType}):
${contextString}

Gere um relatório executivo conciso contendo:
- 📊 Resumo da Situação
- ✅ Pontos Fortes & Oportunidades
- ⚠️ Pontos de Atenção & Preocupações
- 💡 Recomendações Práticas & Medidas
`;

        if (userQuestion) {
            basePrompt = `
${persona}
${focusArea}

DADOS DA TELA ATUAL (${data.pageType}):
${contextString}

O GESTOR FEZ A SEGUINTE SOLICITAÇÃO:
"${userQuestion}"

DIRETRIZES OBRIGATÓRIAS PARA SUA RESPOSTA:
1. Responda diretamente e de forma completa ao que o gestor pediu.
2. Se a solicitação pedir análise, pontos de preocupação ou medidas a serem adotadas, estruture sua resposta com tópicos claros em negrito:
   - 📊 Diagnóstico Executivo da Situação / Cenário
   - ⚠️ Pontos de Preocupação e Riscos Identificados
   - 💡 Medidas Práticas e Planos de Ação Recomendados
3. Utilize os números, dados e indicadores fornecidos no contexto acima como embasamento concreto.
4. Mantenha tom executivo, confiante, pragmático e direto ao ponto.
`;
        }

        return basePrompt;
    }
}
