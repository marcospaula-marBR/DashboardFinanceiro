const fs = require('fs');

// Ler o arquivo public/dados_tratado_jun25_em_diante.csv diretamente como UTF-8
const rawBuffer = fs.readFileSync('public/dados_tratado_jun25_em_diante.csv');
const strUtf8 = rawBuffer.toString('utf8');

// Procurar termos como "cart" ou "Sicredi"
const lines = strUtf8.split('\n');
const sampleLines = lines.filter(l => l.includes('Sicredi') || l.includes('cart') || l.includes('Cr') || l.includes('MAR BRASIL')).slice(0, 10);

console.log("Amostra decodificada como UTF-8 puro:");
sampleLines.forEach(l => console.log(l));
