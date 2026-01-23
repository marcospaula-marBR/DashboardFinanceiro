/**
 * DASHBOARD DE CONTRATOS - MAR BRASIL v22.0
 * CASCADE & DYNAMIC VISION: Filtros em Cascata e Seleção Faturado/Líquido
 */

const state = {
    dados: [],
    filtered: [],
    charts: {},
    viewType: 'faturado', // 'faturado' ou 'liquido'
    filters: { contrato: [], empresa: [], status: [], ciclo: [] }
};

const CONFIG = {
    MESES_ORDEM: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    COLORS: {
        prime: '#F2911B',
        success: '#2ecc71',
        danger: '#e74c3c',
        info: '#3498db',
        warning: '#f1c40f',
        neutral: '#95a5a6',
        charts: ['#F2911B', '#3498db', '#9b59b6', '#2ecc71', '#e74c3c', '#f1c40f']
    }
};

// --- 1. CARREGAMENTO E TRATAMENTO DE ENCODING ---

window.addEventListener('DOMContentLoaded', initData);

async function initData() {
    showLoading(true);
    try {
        const response = await fetch('Consolidado Faturamento.csv');
        if (!response.ok) throw new Error("Arquivo não encontrado.");

        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('iso-8859-1');
        const text = decoder.decode(buffer);

        const results = Papa.parse(text, {
            header: true,
            skipEmptyLines: 'greedy',
            delimiter: ","
        });

        console.log("CSV Results v24:", results);

        state.dados = results.data.map(d => {
            const row = { ...d };
            Object.keys(d).forEach(key => {
                const cleanKey = key.trim().toLowerCase();
                if (cleanKey.includes('faturado')) row.valorFaturado = parseCurrency(d[key]);
                if (cleanKey.includes('lído') || cleanKey.includes('liquido')) row.valorLiquido = parseCurrency(d[key]);
                if (cleanKey.includes('imposto')) row.impostos = parseCurrency(d[key]);
                if (cleanKey.includes('previs')) row.dataPrevisao = d[key];
                if (cleanKey.includes('emiss')) row.dataEmissao = d[key];
                if (cleanKey.includes('status')) row.statusOriginal = d[key];
            });
            if (row.valorLiquido === undefined) row.valorLiquido = parseCurrency(d['Valor líquido'] || d['Valor l\u00edquido']);
            row.analiseAtraso = calcularAtraso(row.dataPrevisao, row.statusOriginal);
            return row;
        });

        window.FULL_CSV_DATA = state.dados;
        if (window.updateBrisinhAIContext) window.updateBrisinhAIContext();

        initFilters();
        updateDashboard();
    } catch (err) {
        console.error("Erro v22:", err);
        const statusEl = document.getElementById('lastUpdate');
        if (statusEl) statusEl.innerHTML = "❌ Erro ao ler Consolidado Faturamento.csv";
    } finally {
        showLoading(false);
    }
}

function calcularAtraso(dataPrev, status) {
    if (status && status.toLowerCase() === 'pago') return { texto: 'Pago', classe: 'status-pago' };
    if (!dataPrev || dataPrev === '-' || dataPrev.trim() === '') return { texto: 'Pendente', classe: 'status-neutral' };
    try {
        const partes = dataPrev.split('/');
        if (partes.length !== 3) return { texto: 'Pendente', classe: 'status-neutral' };
        const prev = new Date(partes[2], partes[1] - 1, partes[0]);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        prev.setHours(0, 0, 0, 0);
        const diffTime = hoje.getTime() - prev.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 0) return { texto: `Atraso: ${diffDays}d`, classe: 'status-pendente', dias: diffDays };
        else return { texto: 'A Vencer', classe: 'status-info' };
    } catch (e) {
        return { texto: 'Pendente', classe: 'status-neutral' };
    }
}

// --- 2. FILTROS EM CASCATA ---

function initFilters() {
    refreshFilterOptions();

    // Listeners para Cascata
    const fEmp = document.getElementById('filterEmpresa');
    const fCon = document.getElementById('filterContrato');
    const fCic = document.getElementById('filterCiclo');
    const fSta = document.getElementById('filterStatus');
    const vSel = document.getElementById('viewSelector');

    fEmp.addEventListener('change', () => { updateCascade('empresa'); updateDashboard(); });
    fCon.addEventListener('change', () => { updateCascade('contrato'); updateDashboard(); });
    fCic.addEventListener('change', () => { updateDashboard(); });
    fSta.addEventListener('change', () => { updateDashboard(); });

    if (vSel) {
        vSel.addEventListener('change', (e) => {
            state.viewType = e.target.value;
            updateDashboard();
        });
    }

    // Sticky Scroll Effect
    window.addEventListener('scroll', () => {
        const kpiRow = document.getElementById('kpiRow1');
        if (kpiRow) {
            if (window.scrollY > 100) kpiRow.classList.add('scrolled');
            else kpiRow.classList.remove('scrolled');
        }
    });

    const btnClear = document.getElementById('btnClearFilters');
    if (btnClear) {
        btnClear.onclick = () => {
            document.querySelectorAll('select').forEach(s => {
                if (s.id !== 'viewSelector') s.value = '';
            });
            refreshFilterOptions();
            updateDashboard();
        };
    }
}

function refreshFilterOptions() {
    const empresas = [...new Set(state.dados.map(d => d.Empresa))].sort().filter(Boolean);
    const contratos = [...new Set(state.dados.map(d => d.Contrato))].sort().filter(Boolean);
    const ciclos = [...new Set(state.dados.map(d => d.Ciclo))].sort((a, b) => sortCiclo(a, b)).filter(Boolean);
    const status = [...new Set(state.dados.map(d => d.Status))].sort().filter(Boolean);

    populateSelect('filterEmpresa', empresas);
    populateSelect('filterContrato', contratos);
    populateSelect('filterCiclo', ciclos);
    populateSelect('filterStatus', status);
}

function updateCascade(source) {
    const selEmp = getSelectedValues('filterEmpresa');
    const selCon = getSelectedValues('filterContrato');

    let subset = [...state.dados];

    if (source === 'empresa' && selEmp.length > 0) {
        subset = subset.filter(d => selEmp.includes(d.Empresa));
        const newContratos = [...new Set(subset.map(d => d.Contrato))].sort().filter(Boolean);
        updateSelectOptions('filterContrato', newContratos, selCon);
    }

    if (source === 'contrato' && selCon.length > 0) {
        // Se escolheu contrato, opcionalmente filtrar empresa se não houver selecionada
        if (selEmp.length === 0) {
            subset = subset.filter(d => selCon.includes(d.Contrato));
            const newEmpresas = [...new Set(subset.map(d => d.Empresa))].sort().filter(Boolean);
            updateSelectOptions('filterEmpresa', newEmpresas, selEmp);
        }
    }
}

function updateSelectOptions(id, newList, currentSelection) {
    const s = document.getElementById(id);
    if (!s) return;
    s.innerHTML = '';
    newList.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        if (currentSelection.includes(item)) opt.selected = true;
        s.appendChild(opt);
    });
}

function updateDashboard() {
    const selCon = getSelectedValues('filterContrato');
    const selEmp = getSelectedValues('filterEmpresa');
    const selSta = getSelectedValues('filterStatus');
    const selCic = getSelectedValues('filterCiclo');

    state.filtered = state.dados.filter(d => {
        if (selCon.length && !selCon.includes(d.Contrato)) return false;
        if (selEmp.length && !selEmp.includes(d.Empresa)) return false;
        if (selSta.length && !selSta.includes(d.Status)) return false;
        if (selCic.length && !selCic.includes(d.Ciclo)) return false;
        return true;
    });

    renderAll();
}

function renderAll() {
    renderKPIs();
    renderCharts();
    renderMatrix();
}

function renderKPIs() {
    const totalFat = state.filtered.reduce((acc, d) => acc + d.valorFaturado, 0);
    const totalLiq = state.filtered.reduce((acc, d) => acc + d.valorLiquido, 0);
    const totalImp = state.filtered.reduce((acc, d) => acc + d.impostos, 0);
    const atrasados = state.filtered.filter(d => d.analiseAtraso.classe === 'status-pendente').length;

    setText('valTotalFaturado', formatBRL(totalFat));
    setText('valTotalRecebido', formatBRL(totalLiq));
    setText('valTotalComissao', formatBRL(totalImp));
    setText('valComissaoPendente', atrasados);
}

// --- 3. MATRIZ DINÂMICA (Faturado vs Líquido) ---

function renderMatrix() {
    const tbody = document.getElementById('matrixBody');
    const theadRow = document.getElementById('matrixHeader');
    if (!tbody || !theadRow) return;

    const ciclos = [...new Set(state.filtered.map(d => d.Ciclo))].sort((a, b) => sortCiclo(a, b)).filter(Boolean);
    const isLiquido = state.viewType === 'liquido';

    theadRow.innerHTML = `<th class="contract-cell">Contrato / Empresa<br><small class="text-warning">${isLiquido ? '(Visão Líquida)' : '(Visão Faturada)'}</small></th>`;
    ciclos.forEach(c => {
        const th = document.createElement('th');
        th.className = 'val-cell';
        th.textContent = c;
        theadRow.appendChild(th);
    });
    theadRow.innerHTML += `<th class="val-cell fw-bold text-primary">Total</th>`;

    const matrix = {};
    state.filtered.forEach(d => {
        const key = d.Contrato || 'Sem Nome';
        if (!matrix[key]) matrix[key] = { empresa: d.Empresa, vals: {} };
        const val = isLiquido ? d.valorLiquido : d.valorFaturado;
        matrix[key].vals[d.Ciclo] = (matrix[key].vals[d.Ciclo] || 0) + val;
    });

    tbody.innerHTML = '';
    Object.keys(matrix).sort().forEach(cont => {
        const tr = document.createElement('tr');
        let totalLinha = 0;
        let html = `<td class="contract-cell">${cont}<br><small class="text-white-50">${matrix[cont].empresa}</small></td>`;

        ciclos.forEach(c => {
            const val = matrix[cont].vals[c] || 0;
            totalLinha += val;
            html += `<td class="val-cell privacy-mask ${val > 0 ? '' : 'text-muted'}">${val > 0 ? formatBRL(val) : '-'}</td>`;
        });

        html += `<td class="val-cell privacy-mask fw-bold text-warning">${formatBRL(totalLinha)}</td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

function renderCharts() {
    const ciclos = [...new Set(state.filtered.map(d => d.Ciclo))].sort((a, b) => sortCiclo(a, b)).filter(Boolean);
    const isLiquido = state.viewType === 'liquido';

    // Dados para o gráfico triplo (Evolução Cronológica)
    const dataFat = ciclos.map(c => state.filtered.filter(d => d.Ciclo === c).reduce((a, b) => a + b.valorFaturado, 0));
    const dataLiq = ciclos.map(c => state.filtered.filter(d => d.Ciclo === c).reduce((a, b) => a + b.valorLiquido, 0));
    const dataImp = ciclos.map(c => state.filtered.filter(d => d.Ciclo === c).reduce((a, b) => a + b.impostos, 0));

    renderChart('evolutionChart', 'bar', {
        labels: ciclos,
        datasets: [
            { label: 'Valor Faturado', data: dataFat, backgroundColor: CONFIG.COLORS.prime },
            { label: 'Valor Líquido', data: dataLiq, backgroundColor: CONFIG.COLORS.info },
            { label: 'Impostos', data: dataImp, backgroundColor: CONFIG.COLORS.neutral }
        ]
    });

    // Share por Empresa (Mantém dependência do viewSelector para foco)
    const emps = [...new Set(state.filtered.map(d => d.Empresa))];
    const dataEmp = emps.map(e => state.filtered.filter(d => d.Empresa === e).reduce((a, b) => a + (isLiquido ? b.valorLiquido : b.valorFaturado), 0));

    renderChart('contractCompareChart', 'doughnut', {
        labels: emps,
        datasets: [{ data: dataEmp, backgroundColor: CONFIG.COLORS.charts }]
    });
}

// --- UTILS ---

function sortCiclo(a, b) {
    if (!a || !b) return 0;
    const map = { "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6, "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12 };
    const [mesA, anoA] = a.split('-');
    const [mesB, anoB] = b.split('-');
    if (anoA !== anoB) return parseInt(anoA) - parseInt(anoB);
    return map[mesA.toLowerCase()] - map[mesB.toLowerCase()];
}

function parseCurrency(val) {
    if (!val || val === '-') return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
}

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
}

function populateSelect(id, list) {
    const s = document.getElementById(id);
    if (!s) return;
    s.innerHTML = '';
    list.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item; opt.textContent = item;
        s.appendChild(opt);
    });
}

function getSelectedValues(id) {
    const s = document.getElementById(id);
    return s ? Array.from(s.selectedOptions).map(o => o.value) : [];
}

function renderChart(id, type, data, options = {}) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (state.charts[id]) state.charts[id].destroy();
    const ctx = canvas.getContext('2d');
    state.charts[id] = new Chart(ctx, {
        type: type,
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#888', font: { family: 'Outfit' } } } },
            scales: type !== 'doughnut' ? {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
                x: { ticks: { color: '#888' } }
            } : {},
            ...options
        }
    });
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.toggle('d-none', !show);
}
