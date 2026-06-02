




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
                                maxOutputTokens: 2048
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
Você é o BrisinhAI, o CFO virtual e consultor financeiro especialista da empresa Mar Brasil.
Você só responde a perguntas estritamente relacionadas a negócios, finanças, DRE, seguros, custos e parcelamentos contidos no contexto.
Sua persona é altamente técnica, pragmática, concisa e focada em resultados. Use emojis muito raramente e seja extremamente direto para evitar desperdício de tokens de saída.
`;

        // Define specific instructions based on page type
        let focusArea = "";
        switch (data.pageType) {
            case 'DRE':
                focusArea = `
FOCO DA ANÁLISE (DRE):
1. Analise a saúde financeira focando em Receita Líquida, Margem de Contribuição, EBITDA e Lucro Líquido.
2. Identifique variações significativas nos custos e despesas.
3. Compare o realizado com métricas ideais de mercado se possível.
4. Sugira ações para redução de custos ou aumento de receita.
5. Você agora tem acesso aos dados detalhados/granulares de cada linha do DRE (com o agrupamento de projetos/departamentos e empresas) através da propriedade 'detalhamentoConsolidado' no contexto recebido. Use esta propriedade para explicar exatamente o que compõe as maiores despesas ou receitas quando o usuário fizer perguntas detalhadas ou pedir mais profundidade.
`;
                break;
            case 'PARCELAMENTOS':
                focusArea = `
FOCO DA ANÁLISE (PARCELAMENTOS):
1. Analise o perfil da dívida (curto vs longo prazo).
2. Destaque os maiores credores e a concentração de dívida.
3. Alerte sobre parcelas altas iminentes.
4. Sugira estratégias de renegociação ou amortização se o fluxo de caixa permitir.
`;
                break;
            case 'SEGUROS':
                focusArea = `
FOCO DA ANÁLISE (SEGUROS):
1. Analise a cobertura total e o custo dos prêmios.
2. Identifique apólices próximas do vencimento que precisam de renovação.
3. Verifique se há concentração excessiva em uma única seguradora ou corretor.
4. Sugira revisões de cobertura baseadas no custo-benefício.
`;
                break;
            case 'SETORIAL':
                focusArea = `
FOCO DA ANÁLISE (SETORIAL):
1. Identifique quais setores/centros de custo estão consumindo mais recursos.
2. Analise a eficiência de cada setor comparando gastos vs resultados (se disponíveis).
3. Aponte anomalias ou gastos fora do padrão (outliers).
`;
                break;
            case 'PEOPLE':
            case 'PEOPLE_HR':
                focusArea = `
FOCO DA ANÁLISE (COLABORADORES & RECURSOS HUMANOS - RH):
1. Analise a distribuição do headcount e custos de folha por empresa, setor, regime de vínculo (CLT, MEI, PJ, Estagiário).
2. Avalie salários médios, custos com bônus e comissões alocados.
3. Se houver inconsistências de auditoria de dados de RH, aponte-as.
4. Forneça recomendações sobre alocação de pessoal e eficiência da folha de pagamento.
`;
                break;
            default:
                focusArea = `
FOCO DA ANÁLISE (GERAL):
1. Analise os indicadores visíveis na tela.
2. Forneça insights sobre tendências e pontos de atenção.
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
- ✅ Pontos Fortes
- ⚠️ Pontos de Atenção
- 💡 Recomendações Práticas
`;

        if (userQuestion) {
            basePrompt = `
${persona}

Abaixo estão os dados capturados da tela atual (${data.pageType}):
${contextString}

O usuário (gestor) fez a seguinte pergunta:
"${userQuestion}"

Responda diretamente à pergunta usando os dados fornecidos. Se necessário, cite os números para embasar sua resposta.
`;
        }

        return basePrompt;
    }
}
