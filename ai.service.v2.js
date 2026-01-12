

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

class GeminiService {
    constructor() {
        this.apiKey = localStorage.getItem('gemini_api_key') || '';
    }

    isAuthenticated() {
        return !!this.apiKey;
    }

    setKey(key) {
        this.apiKey = key;
        localStorage.setItem('gemini_api_key', key);
    }

    async generateAnalysis(contextData, userQuestion = null) {
        if (!this.isAuthenticated()) {
            throw new Error("API Key do Gemini não configurada.");
        }

        // Construct the prompt
        // contextData should be an object with relevant metrics
        const prompt = this._buildPrompt(contextData, userQuestion);

        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Erro na API Gemini: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            console.error("Erro ao chamar Gemini:", error);
            throw error;
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
