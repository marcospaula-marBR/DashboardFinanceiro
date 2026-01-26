/**
 * Módulo de Comissões v15.0 - Mar Brasil
 * Integração com Supabase via Vercel API
 */

let state = {
    equipe: [],
    contratos: [],
    historico: [],
    padroes: {
        'Carlos': 0.0035,   // 0.35%
        'Abrantes': 0.0035, // 0.35%
        'Geovanna': 0.0020, // 0.20%
        'Prado': 0.0010     // 0.10%
    }
};

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEventListeners();
});

async function init() {
    const debug = document.getElementById('debugPanel');
    const output = document.getElementById('debugOutput');

    try {
        debug.classList.remove('d-none');
        output.innerHTML = "📡 Tentando conectar com a API...";

        // 1. Initial Data
        const res = await fetch('/api/comissoes?type=init');
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.details || `Erro ${res.status}`);
        }

        const data = await res.json();
        console.log("Dados Iniciais:", data);

        output.innerHTML = `✅ Conectado! Equipe: ${data.equipe_count} | Contratos: ${data.contratos_count}`;

        state.equipe = data.equipe || [];
        state.contratos = data.contratos || [];

        if (state.equipe.length === 0) {
            output.innerHTML += `<br>⚠️ <strong>Aviso:</strong> Ninguém na tabela 'equipe'. Rode o script de reparo no Supabase.`;
        } else {
            // Ocultar debug após 5 segundos se tudo estiver OK
            setTimeout(() => { if (state.historico.length > 0) debug.classList.add('d-none') }, 5000);
        }

        populateSelectors();
        renderDivisoesSugeridas();

        // 2. Load History
        await loadHistory();

    } catch (error) {
        output.innerHTML = `❌ <strong>Erro Crítico:</strong> ${error.message}`;
        output.classList.add('text-danger');
        console.error("Erro ao inicializar:", error);
    }
}

async function loadHistory() {
    try {
        showLoading(true);
        console.log("Carregando histórico...");
        const res = await fetch('/api/comissoes?type=history');
        if (!res.ok) throw new Error(`Status API (history): ${res.status}`);

        state.historico = await res.json();
        console.log("Histórico recebido:", state.historico);

        renderHistory();
        updateKPIs();
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
    } finally {
        showLoading(false);
    }
}

function populateSelectors() {
    const select = document.getElementById('selectContrato');
    if (!select) return;

    state.contratos.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nome_contrato;
        select.appendChild(opt);
    });
}

function renderDivisoesSugeridas() {
    const container = document.getElementById('divisoesContainer');
    if (!container) return;
    container.innerHTML = '';

    state.equipe.forEach(membro => {
        const pctPadrao = state.padroes[membro.nome] || 0;

        const div = document.createElement('div');
        div.className = 'col-md-3';
        div.innerHTML = `
            <div class="p-2 border border-secondary rounded-3">
                <small class="d-block text-white-50 border-bottom border-secondary mb-2 pb-1">${membro.nome}</small>
                <div class="input-group input-group-sm mb-2">
                    <input type="number" step="0.01" class="form-control bg-transparent text-white border-0 input-pct" 
                        data-membro-id="${membro.id}" data-membro-nome="${membro.nome}" value="${(pctPadrao * 100).toFixed(2)}">
                    <span class="input-group-text bg-transparent text-white-50 border-0">%</span>
                </div>
                <div class="text-primary fw-bold valor-calculado" id="calc-${membro.id}">R$ 0,00</div>
            </div>
        `;
        container.appendChild(div);
    });

    // Add listeners to recalculate on the fly
    container.querySelectorAll('.input-pct').forEach(input => {
        input.addEventListener('input', recalculateSuggested);
    });
}

function recalculateSuggested() {
    const liquido = parseFloat(document.getElementById('inputLiquido').value) || 0;

    document.querySelectorAll('.input-pct').forEach(input => {
        const pct = parseFloat(input.value) / 100 || 0;
        const valor = liquido * pct;
        const membroId = input.dataset.membroId;
        document.getElementById(`calc-${membroId}`).textContent = formatCurrency(valor);
    });
}

function renderHistory() {
    const tbody = document.getElementById('comissoesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (state.historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5 opacity-50">Nenhum recebimento encontrado no banco de dados.<br><small>Clique em "Novo Recebimento" para cadastrar o primeiro.</small></td></tr>';
        return;
    }

    state.historico.forEach(rec => {
        const contratoNome = rec.contratos_base?.nome_contrato || 'N/A';
        const totalUmPorCento = rec.valor_liquido * 0.01;

        const row = document.createElement('tr');

        // Base Cells
        row.innerHTML = `
            <td>${contratoNome}</td>
            <td class="small">${new Date(rec.data_recebimento).toLocaleDateString()}</td>
            <td>${rec.nota_fiscal || '-'}</td>
            <td>${formatCurrency(rec.valor_liquido)}</td>
            <td class="text-primary fw-bold">${formatCurrency(totalUmPorCento)}</td>
        `;

        // Member Cells (Adaptive to team)
        const nomesEquipe = ['Carlos', 'Abrantes', 'Geovanna', 'Prado'];
        nomesEquipe.forEach(nome => {
            const comissao = rec.comissoes.find(c => c.equipe?.nome === nome);
            const valor = comissao ? comissao.valor_calculado : 0;
            const td = document.createElement('td');
            td.className = valor > 0 ? 'text-white' : 'text-white-50';
            td.textContent = formatCurrency(valor);
            row.appendChild(td);
        });

        tbody.appendChild(row);
    });
}

function updateKPIs() {
    let totais = { Carlos: 0, Abrantes: 0, Geovanna: 0, Prado: 0, Geral: 0 };

    state.historico.forEach(rec => {
        rec.comissoes.forEach(com => {
            const nome = com.equipe?.nome;
            if (totais[nome] !== undefined) {
                totais[nome] += com.valor_calculado;
                totais.Geral += com.valor_calculado;
            }
        });
    });

    document.getElementById('kpiCarlos').textContent = formatCurrency(totais.Carlos);
    document.getElementById('kpiAbrantes').textContent = formatCurrency(totais.Abrantes);
    document.getElementById('kpiGeovanna').textContent = formatCurrency(totais.Geovanna);
    document.getElementById('kpiPrado').textContent = formatCurrency(totais.Prado);
    document.getElementById('totalGeralComissoes').textContent = formatCurrency(totais.Geral);
}

function setupEventListeners() {
    const form = document.getElementById('formRecebimento');
    if (form) {
        form.addEventListener('submit', handleSave);
    }

    const inputLiquido = document.getElementById('inputLiquido');
    if (inputLiquido) {
        inputLiquido.addEventListener('input', recalculateSuggested);
    }
}

async function handleSave(e) {
    e.preventDefault();

    const divisoes = [];
    document.querySelectorAll('.input-pct').forEach(input => {
        const liquido = parseFloat(document.getElementById('inputLiquido').value) || 0;
        const pct = parseFloat(input.value) / 100 || 0;

        divisoes.push({
            membro_id: input.dataset.membroId,
            porcentagem: pct,
            valor_comissao: liquido * pct
        });
    });

    const payload = {
        contrato_id: document.getElementById('selectContrato').value,
        data_recebimento: document.getElementById('inputData').value,
        nota_fiscal: document.getElementById('inputNF').value,
        valor_bruto: parseFloat(document.getElementById('inputBruto').value),
        valor_liquido: parseFloat(document.getElementById('inputLiquido').value),
        divisoes
    };

    try {
        const res = await fetch('/api/comissoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('modalLancamento')).hide();
            formRecebimento.reset();
            await loadHistory();
        }
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
}

function formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (show) overlay.classList.remove('d-none');
        else overlay.classList.add('d-none');
    }
}

async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const content = document.getElementById('mainContent');

    showLoading(true);
    try {
        let iaAnalysis = "Análise estratégica não disponível no momento.";
        if (window.getBrisinhAIAnalysis) {
            iaAnalysis = await window.getBrisinhAIAnalysis();
        }

        const canvas = await html2canvas(content, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(242, 145, 27);
        doc.text("Análise Estratégica BrisinhAI - Comissões", 10, 20);

        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        const splitText = doc.splitTextToSize(iaAnalysis.replace(/<[^>]*>/g, ''), pdfWidth - 20);
        doc.text(splitText, 10, 30);

        doc.save(`Mar_Brasil_Comissoes_${new Date().getTime()}.pdf`);
    } catch (err) {
        console.error("PDF Export Error:", err);
    } finally {
        showLoading(false);
    }
}
