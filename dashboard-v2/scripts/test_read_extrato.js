const fs = require('fs');
const path = require('path');

// Ler a API key manualmente do .env para dispensar o dotenv
const envPath = path.join(__dirname, '../.env');
let apiKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/GEMINI_API_KEY\s*=\s*(.*)/);
  if (match && match[1]) {
    apiKey = match[1].trim().replace(/['"]/g, ''); // Limpar aspas se houver
  }
}

// Se nao encontrou no .env, usar fallback ou variable global
apiKey = apiKey || process.env.GEMINI_API_KEY || 'AIzaSyBkZ294OldnJ7SpULDLGTPhOjUGN7ChvWs';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfPath = path.join(__dirname, '../public/Extrato Mensal.pdf');

async function main() {
  console.log('Iniciando leitura do arquivo:', pdfPath);
  console.log('Chave Gemini recuperada:', apiKey ? apiKey.slice(0, 10) + '...' : 'NAO ENCONTRADA');
  
  if (!fs.existsSync(pdfPath)) {
    console.error('Arquivo nao encontrado!');
    return;
  }

  const fileBuffer = fs.readFileSync(pdfPath);
  const base64Data = fileBuffer.toString('base64');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Analise este documento PDF de Extrato Mensal de folha de pagamento.
Por favor, extraia e descreva resumidamente:
1. Qual e a competencia (mes e ano) da folha?
2. Quais sao os funcionarios / colaboradores CLT listados no documento? (Forneça nomes e CPFs se houver).
3. Quais sao os principais campos / verbas financeiras (Salarios, descontos, faltas, consignados, etc.) que constam para cada um?
Responda em texto de forma estruturada.`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf'
        }
      },
      prompt
    ]);

    console.log('\n--- RESPOSTA DO GEMINI ---');
    console.log(result.response.text());
    console.log('---------------------------');
  } catch (error) {
    console.error('Erro ao chamar o Gemini:', error);
  }
}

main();
