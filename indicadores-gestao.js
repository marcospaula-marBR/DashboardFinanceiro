/**
 * Indicadores de Gestão - Mar Brasil
 * Logic for efficiency KPIs and per-equipment metrics.
 */

// Configuration - Sync with script_v2.js
const CONFIG = {
    VERSION: "26.8",
    MESES_ORDEM: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
};

let state = {
    rawData: [],
    filteredData: [],
    validColumns: [],
    metrics: {},
    filters: {}
};

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadDataFromCache();
    initEventListeners();
});

function loadDataFromCache() {
    const raw = localStorage.getItem('dre_raw_data');
    if (!raw) {
        alert("Dados não encontrados. Por favor, carregue o CSV na página principal do DRE.");
        window.location.href = 'index.html';
        return;
    }

    try {
        state.rawData = JSON.parse(raw);
        // Load filters applied in the main DRE
        const savedFilters = localStorage.getItem('dre_filters');
        if (savedFilters) {
            state.filters = JSON.parse(savedFilters);
        }

        processData();
        renderDashboard();
    } catch (e) {
        console.error("Erro ao carregar cache:", e);
    } finally {
        setTimeout(() => {
            document.getElementById('loadingOverlay').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loadingOverlay').style.display = 'none';
            }, 500);
        }, 800);
    }
}

function processData() {
    // 1. Identify Period Columns
    const allKeys = Object.keys(state.rawData[0] || {});
    const periodCols = allKeys.filter(k => k.includes('/'));

    // Sort periods
    periodCols.sort((a, b) => {
        const [mesA, anoA] = a.split('/');
        const [mesB, anoB] = b.split('/');
        const yA = parseInt(anoA) < 100 ? 2000 + parseInt(anoA) : parseInt(anoA);
        const yB = parseInt(anoB) < 100 ? 2000 + parseInt(anoB) : parseInt(anoB);
        if (yA !== yB) return yA - yB;
        return CONFIG.MESES_ORDEM.indexOf(normalizeMes(mesA)) - CONFIG.MESES_ORDEM.indexOf(normalizeMes(mesB));
    });

    // Handle Year Filters if any (from indicators_v2.html logic)
    // For now, focusing on standard DRE period filters (array of "Mes/Ano")
    let activeCols = periodCols;
    if (state.filters.periodos && state.filters.periodos.length > 0) {
        activeCols = periodCols.filter(c => {
            const [mes, ano] = c.split('/');
            const p = `${normalizeMes(mes)}/${ano}`;
            return state.filters.periodos.includes(p) || state.filters.periodos.includes(ano);
        });
    }

    state.validColumns = activeCols;

    // Apply Global Filters (Empresa, Projeto, Categoria)
    let df = [...state.rawData];
    if (state.filters.empresas && state.filters.empresas.length > 0) {
        df = df.filter(row => state.filters.empresas.includes(row.Empresa));
    }
    if (state.filters.projetos && state.filters.projetos.length > 0) {
        df = df.filter(row => state.filters.projetos.includes(row.Projeto));
    }
    // Note: Filtering by Categoria might be tricky if we need specific categories for our math.
    // Usually we want the BROAD dataset and only filter Empresa/Projeto.

    state.filteredData = df;

    calculateMetrics();
}

function calculateMetrics() {
    const df = state.filteredData;
    const cols = state.validColumns;

    // Helper: Sum list of categories (case-insensitive and trimmed)
    const sumCats = (cats) => {
        const targetCats = cats.map(c => c.toLowerCase().trim());
        return df
            .filter(row => row.Categoria && targetCats.includes(row.Categoria.toLowerCase().trim()))
            .reduce((acc, row) => {
                let rowSum = 0;
                cols.forEach(c => rowSum += parseFloat(row[c]?.toString().replace(',', '.') || 0));
                return acc + rowSum;
            }, 0);
    };

    // Base Aggregates
    const receitaBruta = sumCats(["Receita Bruta de Vendas"]);
    const receitasIndiretas = sumCats(["Receitas Indiretas"]);
    const totalEntradas = receitaBruta + receitasIndiretas;

    const impostos = sumCats(["Impostos", "Provisão - IRPJ e CSSL Trimestral"]);
    const receitaLiquida = totalEntradas - impostos;

    const credencialOp = sumCats(["Credenciado Operacional", "Adiantamento - Credenciado Operacional"]);
    const clts = sumCats(["Despesas com Pessoal"]);
    const preventiva = sumCats(["Preventiva - B2G", "Manutenção Preventiva"]);
    const corretiva = sumCats(["Corretiva - B2G", "Manutenção Corretiva"]);
    const terceirizacao = sumCats(["Terceirização de Mão de Obra"]);
    const custoServicos = sumCats(["Custo dos Serviços Prestados"]);
    const outrosCustos = sumCats(["Outros Custos"]);

    const totalCustos = credencialOp + clts + preventiva + corretiva + terceirizacao + custoServicos + outrosCustos;

    const credencialAdm = sumCats(["Credenciado Administrativo", "Adiantamento - Credenciado Administrativo"]);
    const credencialTI = sumCats(["Credenciado TI", "Adiantamento - Credenciado TI"]);
    const despesasAdm = sumCats(["Despesas Administrativas", "Despesas de Vendas e Marketing", "Despesas Financeiras", "Outros Tributos", "Jurídico", "Despesas Variáveis", "Intermediação de Negócios"]);
    const dividendos = sumCats(["Distribuição de Dividendos", "Dividendos"]);

    const totalDespesas = credencialAdm + credencialTI + despesasAdm + dividendos;

    const investimentos = sumCats(["Consórcios - a contemplar", "Serviços", "Ativos"]);
    const totalSaidas = impostos + totalCustos + totalDespesas + investimentos;

    const resultado = totalEntradas + sumCats(["Ativos"]) + sumCats(["Outras Receitas", "Receitas Financeiras", "Honorários", "Juros e devoluções"]) - totalSaidas;
    const fcl = resultado - sumCats(["Ativos"]);

    // EBITDA items
    const despFinanceiras = sumCats(["Despesas Financeiras"]);
    const ebitda = totalEntradas - totalCustos - (totalDespesas - despFinanceiras - dividendos);

    // MC items
    const despVariaveis = sumCats(["Despesas Variáveis", "Intermediação de Negócios"]);
    const margemContribuicao = receitaLiquida - totalCustos - despVariaveis;

    // Pessoal broad
    const pessoal = clts + credencialOp + credencialAdm + credencialTI + terceirizacao;
    const allCredenciados = credencialOp + credencialAdm + credencialTI;

    // Equipamentos - Denominator Fix
    // Instead of total / length, we sum the actual machine count for the periods
    // script.js uses state.metrics.total_equipamentos which is the sum across columns
    const totalEquipamentos = sumCats(["Equipamentos"]);

    state.metrics = {
        totalEntradas, receitaBruta, receitaLiquida, totalSaidas, resultado, fcl, ebitda,
        margemContribuicao, pessoal, impostos,
        totalCustos, totalDespesas, investimentos,
        preventiva, corretiva, clts, credencialOp, allCredenciados, terceirizacao,
        totalEquipamentos,
        // Sync denominator: Total machine count across all selected columns
        n: totalEquipamentos || 1
    };
}

function renderDashboard() {
    const m = state.metrics;
    const n = m.n; // Denominator is the sum of machines in selected period

    // 1. Efficiency (%)
    const allCards = [
        { label: "Margem Líquida", value: (m.totalEntradas ? (m.resultado / m.totalEntradas * 100) : 0), type: 'percent', icon: 'bi-gem', subtitle: 'Resultado / Rec. Bruta', class: 'kpi' },
        { label: "Margem EBITDA", value: (m.totalEntradas ? (m.ebitda / m.totalEntradas * 100) : 0), type: 'percent', icon: 'bi-activity', subtitle: 'EBITDA / Rec. Bruta', class: 'kpi' },
        { label: "Margem Fluxo Caixa Livre", value: (m.totalEntradas ? (m.fcl / m.totalEntradas * 100) : 0), type: 'percent', icon: 'bi-wallet2', subtitle: 'FCL / Rec. Bruta', class: 'kpi' },
        { label: "Margem de Contribuição", value: (m.receitaLiquida ? (m.margemContribuicao / m.receitaLiquida * 100) : 0), type: 'percent', icon: 'bi-pie-chart', subtitle: 'MC / Rec. Líquida', class: 'kpi' },
        { label: "Eficiência Pessoal", value: (m.totalEntradas ? (m.pessoal / m.totalEntradas * 100) : 0), type: 'percent', icon: 'bi-people', subtitle: 'Pessoal / Rec. Bruta', class: 'kpi' },
        { label: "Carga Tributária", value: (m.totalEntradas ? (m.impostos / m.totalEntradas * 100) : 0), type: 'percent', icon: 'bi-bank', subtitle: 'Impostos / Rec. Bruta', class: 'kpi' }
    ];

    // 2. Equipment Metrics (R$/Mák) - Denominator is SUM of machines (matching modal)
    const equipmentMetrics = [
        { label: "Total Saídas", value: m.totalSaidas / n, icon: 'bi-graph-down-arrow', color: 'danger', class: 'equip' },
        { label: "Custos Operacionais", value: m.totalCustos / n, icon: 'bi-gear', color: 'info', class: 'equip' },
        { label: "Despesas Rateadas", value: m.totalDespesas / n, icon: 'bi-calculator', color: 'info', class: 'equip' },
        { label: "Impostos", value: m.impostos / n, icon: 'bi-bank', color: 'danger', class: 'equip' },
        { label: "Pessoal", value: m.pessoal / n, icon: 'bi-people', color: 'info', class: 'equip' },
        { label: "Credenciados", value: m.allCredenciados / n, icon: 'bi-person-badge', color: 'primary', class: 'equip' },
        { label: "CLTs", value: m.clts / n, icon: 'bi-person-vcard', color: 'success', class: 'equip' },
        { label: "Terceirização", value: m.terceirizacao / n, icon: 'bi-people-fill', color: 'warning', class: 'equip' },
        { label: "Corretiva", value: m.corretiva / n, icon: 'bi-tools', color: 'danger', class: 'equip' },
        // Preventiva including Credenciados Op (Request: Cred Op + Adiantamento Op + CLT + Preventiva)
        { label: "Preventiva", value: (m.preventiva + m.credencialOp + m.clts) / n, icon: 'bi-shield-check', color: 'success', subtitle: 'Incl. Cred. e CLTs', class: 'equip' }
    ];

    allCards.push(...equipmentMetrics);

    renderGrid('mainIndicatorsGrid', allCards);

    // Update Header Info
    const periodText = state.validColumns.length > 0 ? (state.validColumns.length === 1 ? state.validColumns[0] : `${state.validColumns[0]} - ${state.validColumns[state.validColumns.length - 1]}`) : 'Todo o período';
    const companyText = (state.filters.empresas && state.filters.empresas.length > 0) ? state.filters.empresas.join(', ') : 'Todas as Empresas';

    document.getElementById('periodDisplay').textContent = periodText;
    document.getElementById('companyDisplay').textContent = companyText;

    if (window.APP_VERSION) document.getElementById('versionDisplay').textContent = `v${window.APP_VERSION}`;
}

function renderGrid(containerId, cards) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    // Create cards HTML
    const cardsHtml = cards.map(card => {
        const formattedValue = card.type === 'percent'
            ? card.value.toFixed(1) + '%'
            : formatCurrency(card.value);

        const cardClass = card.class || '';

        return `
            <div class="glass-card ${cardClass}">
                <div class="card-label">
                    <div class="card-icon"><i class="bi ${card.icon}"></i></div>
                    ${card.label}
                </div>
                <div class="card-value">${formattedValue}</div>
                ${card.subtitle ? `<div class="card-subtitle">${card.subtitle}</div>` : ''}
            </div>
        `;
    }).join('');

    // Duplicate content for infinite loop
    container.innerHTML = cardsHtml + cardsHtml;
}

function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function normalizeMes(mes) {
    if (!mes) return "";
    return mes.trim().charAt(0).toUpperCase() + mes.trim().slice(1).toLowerCase();
}

function initEventListeners() {
    const btnPrivacy = document.getElementById('btnPrivacy');
    if (btnPrivacy) {
        btnPrivacy.addEventListener('click', () => {
            document.body.classList.toggle('privacy-enabled');
            const icon = btnPrivacy.querySelector('i');
            icon.classList.toggle('bi-eye');
            icon.classList.toggle('bi-eye-slash');
        });
    }
}
