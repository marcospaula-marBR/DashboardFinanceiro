# 🔧 CORREÇÃO URGENTE - Integração Google Sheets

## ❌ Problema Identificado

O arquivo `script.js` está corrompido e faltam componentes essenciais:
1. A função `loadFromGoogleSheets()` não existe
2. O botão no HTML não está configurado

## ✅ SOLUÇÃO RAPIDISSIMA

### Passo 1: Adicionar a Função ao script.js

Abra o arquivo `script.js` e procure pela função `initCharts()` (por volta da linha 140).

**Logo APÓS** o fechamento da função `initCharts()` (depois do `}`), adicione este código:

```javascript
// ========================================
// Google Sheets Integration
// ========================================
async function loadFromGoogleSheets() {
    const SHEET_ID = '1aBSas0JlWuXEubN6ti7tYVUPrCz_qfmXA6LWwbdPMiw';
    const SHEET_NAME = 'Dados';

    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

    document.getElementById('loadingOverlay').classList.remove('d-none');
    document.getElementById('fileStatus').textContent = 'Carregando dados do Google Sheets...';

    try {
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}. Verifique se a planilha está publicada.`);
        }

        const csvText = await response.text();

        if (!csvText || csvText.trim().length === 0) {
            throw new Error('A planilha está vazia.');
        }

        if (csvText.trim().startsWith('<')) {
            throw new Error('Planilha não está publicada corretamente.');
        }

        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: processParsedData,
            error: (error) => {
                throw new Error(`Erro ao processar CSV: ${error.message}`);
            }
        });

    } catch (error) {
        document.getElementById('loadingOverlay').classList.add('d-none');
        alert(`Erro: ${error.message}\n\nSiga as instruções em INSTRUCOES_GOOGLE_SHEETS.md`);
        console.error('Erro detalhado:', error);
    }
}
```

### Passo 2: Verificar o Botão no index.html

Procure no `index.html` por esta seção (deve estar dentro da sidebar):

```html
<button class="btn btn-outline-light btn-sm w-100 mt-2" id="btnLoadSheets"
    onclick="loadFromGoogleSheets()">
    <i class="bi bi-table me-2"></i>Carregar do Google Sheets
</button>
```

**Se não existir**, adicione logo após o input de arquivo CSV.

### Passo 3: Testar

1. Salve os arquivos
2. Faça commit e push para o GitHub
3. Atualize a página no navegador (Ctrl+F5)
4. Clique no botão "Carregar do Google Sheets"

## 🚨 Se ainda der erro

Abra o Console do navegador (F12) e me envie a mensagem de erro exata que aparece.

## 📋 Checklist

- [ ] Função `loadFromGoogleSheets()` adicionada ao script.js
- [ ] Botão existe no index.html com `onclick="loadFromGoogleSheets()"`
- [ ] Planilha está publicada (Arquivo → Publicar na Web)
- [ ] Planilha está compartilhada (Qualquer pessoa com o link)
- [ ] Aba se chama exatamente "Dados"
