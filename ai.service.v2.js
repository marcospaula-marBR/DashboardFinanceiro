




const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

class GeminiService {
    constructor() {
        // MUITO IMPORTANTE: Substitua 'SUA_CHAVE_AQUI' pela sua API Key real do Google Gemini
        this.apiKey = "AIzaSyAf94kI5iBxhiLyyKn1D5UjP_3znPcBQxY";
    }

    isAuthenticated() {
        // Verifica se a chave existe e não é vazia
        return !!this.apiKey;
    }

    setKey(key) {
        this.apiKey = key;
        // Não salvamos mais no localStorage para evitar conflitos de versão
    }

    async generateAnalysis(contextData, userQuestion = null) {
        if (!this.isAuthenticated()) {
            throw new Error("API Key do Gemini não configurada.");
        }

        const prompt = this._buildPrompt(contextData, userQuestion);
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();

                    // Se for erro 503 (Overloaded), tenta novamente
                    if (response.status === 503) {
                        console.warn(`Tentativa ${attempt + 1} falhou: Modelo sobrecarregado. Tentando novamente...`);
                        attempt++;
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2s
                        continue;
                    }

                    throw new Error(`Erro na API Gemini: ${errorData.error?.message || response.statusText}`);
                }

                const data = await response.json();
                return data.candidates[0].content.parts[0].text;

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
        const contextString = JSON.stringify(data, null, 2);

        let basePrompt = `
Você é o BrisinhAI, um consultor financeiro especialista da empresa Mar Brasil.
Sua persona é amigável, técnica mas acessível, e focada em dar insights valiosos sobre a saúde financeira da empresa.
Use emojis ocasionalmente para manter o tom leve, mas mantenha a seriedade na análise dos números.

Abaixo estão os dados financeiros atuais da tela de Indicadores:
${contextString}

Analise esses dados e forneça um resumo executivo destacando:
1. Pontos Fortes (o que está indo bem).
2. Pontos de Atenção (onde os custos estão altos ou receitas baixas).
3. Sugestões de melhoria.
`;

        if (userQuestion) {
            basePrompt = `
Você é o BrisinhAI, um consultor financeiro especialista da empresa Mar Brasil.
Sua persona é amigável, técnica mas acessível.

Abaixo estão os dados financeiros atuais da tela de Indicadores:
${contextString}

O usuário fez a seguinte pergunta técnica:
"${userQuestion}"

Responda à pergunta com base nos dados fornecidos. Se a pergunta não puder ser respondida com os dados atuais, explique o porquê.
`;
        }

        return basePrompt;
    }
}
