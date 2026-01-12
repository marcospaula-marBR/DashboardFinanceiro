/**
 * Seguros.js - Mar Brasil
 * Logic for Insurance Management
 */

const CONFIG_SEGUROS = {
    COLORS: {
        primary: '#F2911B',
        secondary: '#262223',
        success: '#2ecc71',
        danger: '#e74c3c',
        info: '#3498db'
    }
};

let state = {
    rawData: [],
    filteredData: [],
    filters: {
        contratante: [],
        tipo: [],
        seguradora: [],
        corretor: []
    }
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
});

function initEventListeners() {
    const fileInput = document.getElementById('csvFileSeguros');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    // Filter Listeners
    setupFilterListener('filterContratante', 'contratante');
    setupFilterListener('filterTipo', 'tipo');
    setupFilterListener('filterSeguradora', 'seguradora');
    setupFilterListener('filterCorretor', 'corretor');

    // Clear Filters
    document.getElementById('btnClearFilters').addEventListener('click', () => {
        ['filterContratante', 'filterTipo', 'filterSeguradora', 'filterCorretor'].forEach(id => {
            document.getElementById(id).value = '';
        });
        state.filters = { contratante: [], tipo: [], seguradora: [], corretor: [] };
        applyFilters();
    });

    // KPI Chart Listeners
    document.getElementById('kpiMaiorPremio').addEventListener('click', () => showKPIChart('prêmios'));
    document.getElementById('kpiMaiorParcela').addEventListener('click', () => showKPIChart('parcelas'));
    document.getElementById('kpiProximoVencimento').addEventListener('click', () => showKPIChart('vencimentos'));

    // Smoke Overlay Click (Close expanded card)
    document.getElementById('smokeOverlay').addEventListener('click', closeExpandedCard);
}

function setupFilterListener(id, key) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', (e) => {
            state.filters[key] = Array.from(e.target.selectedOptions).map(opt => opt.value);
            applyFilters();
        });
    }
}

// ==========================================
// Data Handling
// ==========================================
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('fileStatus').textContent = 'Processando arquivo...';

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "ISO-8859-1",
        complete: (results) => {
            processParsedData(results.data);
        },
        error: (err) => {
            console.error("Erro no PapaParse:", err);
            alert("Erro ao ler CSV: " + err.message);
        }
    });
}

function processParsedData(data) {
    const normalize = (s) => s ? s.toString().trim() : '';

    // Heuristic mapping to names mentioned by user
    const processed = data.map(row => {
        // Enhanced Parcelas parsing
        const parcelasRaw = row.Parcelas || row.parcelas || row['Parcelas '] || findKey(row, ['parcela', 'qtd']);
        let parcelas = 1;
        if (parcelasRaw) {
            const parsed = parseInt(String(parcelasRaw).replace(/\D/g, ''));
            if (!isNaN(parsed) && parsed > 0) {
                parcelas = parsed;
            }
        }

        const item = {
            contratante: row.Contratante || findKey(row, ['empresa', 'cliente']),
            tipo: row.Tipo || findKey(row, ['categoria', 'ramo']),
            segurado: row.Segurado || findKey(row, ['beneficiário', 'nome']),
            seguradora: row.Seguradora || findKey(row, ['companhia']),
            assistencia: row['Assistência 24h'] || findKey(row, ['assistencia', 'telefone 24h']),
            apolice: row.Apólice || row.Apolice || findKey(row, ['proposta', 'documento']),
            senha: row.Senha || findKey(row, ['acesso', 'portal']),
            inicio: parseDate(row.Início || row.Inicio || findKey(row, ['vigência início', 'data início'])),
            vencimento: parseDate(row.Vencimento || findKey(row, ['vigência fim', 'data fim'])),
            premio: parseCurrency(row.Prêmio || row.Premio || findKey(row, ['valor prêmio', 'valor total', 'premio'])),
            parcelasTotal: parcelas,
            valorParcela: parseCurrency(row['Valor das Parcelas'] || row['VR Parcelas'] || row.VR_Parcelas || findKey(row, ['vr parcelas', 'valor parcela', 'valor mensal'])),
            diaPgto: row['Dia Pgto'] || findKey(row, ['vencimento dia', 'dia pgto']),
            formatoParcelas: row['Formato das Parcelas'] || findKey(row, ['forma pagamento', 'meio', 'formato']),
            corretor: row.Corretor || findKey(row, ['vendedor', 'angariador', 'corretor']),
            telefoneCorretor: row.Telefone || findKey(row, ['celular', 'tel corretor', 'telefone']),
            emailCorretor: row.email || row.Email || findKey(row, ['e-mail', 'email']),
            indicador: row.Indicador || findKey(row, ['indicação', 'indicado'])
        };

        // Calculations
        item.parcelasPagas = calculateParcelasPagas(item.inicio, item.parcelasTotal);
        item.parcelasRestantes = Math.max(0, item.parcelasTotal - item.parcelasPagas);

        // Is Recurring? (Heuristic: Formato includes 'Recorrente', 'Mensal' or Vencimento is much further/empty)
        const formatLower = (item.formatoParcelas || "").toLowerCase();
        item.isRecurring = formatLower.includes('recorrente') || formatLower.includes('mensal sem fim');

        return item;
    }).filter(i => i.contratante || i.segurado);

    state.rawData = processed;

    // Populate Filters
    populateSelect('filterContratante', [...new Set(processed.map(d => d.contratante))].sort());
    populateSelect('filterTipo', [...new Set(processed.map(d => d.tipo))].sort());
    populateSelect('filterSeguradora', [...new Set(processed.map(d => d.seguradora))].sort());
    populateSelect('filterCorretor', [...new Set(processed.map(d => d.corretor))].sort());

    document.getElementById('fileStatus').textContent = `✅ ${processed.length} seguros carregados.`;
    document.getElementById('lastUpdate').textContent = `Atualizado em: ${new Date().toLocaleTimeString()}`;

    applyFilters();
}

function findKey(row, candidates) {
    const keys = Object.keys(row);
    for (const cand of candidates) {
        const found = keys.find(k => k.toLowerCase().includes(cand.toLowerCase()));
        if (found) return row[found];
    }
    return '';
}

function parseCurrency(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    let s = val.toString().replace('R$', '').trim();
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    return parseFloat(s) || 0;
}

function parseDate(val) {
    if (!val) return null;
    // Handle DD/MM/YYYY or DD/MM/YY
    const parts = val.toString().split('/');
    if (parts.length === 3) {
        let d = parseInt(parts[0]);
        let m = parseInt(parts[1]) - 1;
        let y = parseInt(parts[2]);
        if (y < 100) y += 2000;
        return new Date(y, m, d);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

function calculateParcelasPagas(startDate, total) {
    if (!startDate || !total) return 0;
    const today = new Date();
    // Use the user's specific formula: (Current Month - Start Month)
    // We'll normalize to the first of the month for calculation
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();

    const monthsDiff = (currentYear - startYear) * 12 + (currentMonth - startMonth);

    // Usually, the first installment is paid at start (month 0).
    // So if monthsDiff is 0, they paid 1. If monthsDiff is 1, they paid 2.
    const paid = monthsDiff + 1;

    return Math.min(total, Math.max(0, paid));
}

// ==========================================
// UI Rendering
// ==========================================
function applyFilters() {
    let data = state.rawData;
    const f = state.filters;

    if (f.contratante.length > 0) data = data.filter(i => f.contratante.includes(String(i.contratante)));
    if (f.tipo.length > 0) data = data.filter(i => f.tipo.includes(String(i.tipo)));
    if (f.seguradora.length > 0) data = data.filter(i => f.seguradora.includes(String(i.seguradora)));
    if (f.corretor.length > 0) data = data.filter(i => f.corretor.includes(String(i.corretor)));

    state.filteredData = data;
    updateKPIs();
    renderGrid();
}

function updateKPIs() {
    const data = state.filteredData;
    if (data.length === 0) {
        document.getElementById('valMaiorPremio').textContent = 'R$ 0,00';
        document.getElementById('valMaiorParcela').textContent = 'R$ 0,00';
        document.getElementById('valProximoVencimento').textContent = '-';
        return;
    }

    // 1. Maior Prêmio
    const maiorPremio = [...data].sort((a, b) => b.premio - a.premio)[0];
    document.getElementById('valMaiorPremio').textContent = formatCurrency(maiorPremio.premio);
    document.getElementById('infoMaiorPremio').textContent = `${maiorPremio.segurado} | Plano de ${maiorPremio.parcelasTotal}x`;

    // 2. Maior Parcela (Fix: ensure sorting and filtering)
    const validParcelas = data.filter(i => i.valorParcela > 0);
    const maiorParcela = validParcelas.length > 0
        ? [...validParcelas].sort((a, b) => b.valorParcela - a.valorParcela)[0]
        : null;

    if (maiorParcela) {
        document.getElementById('valMaiorParcela').textContent = formatCurrency(maiorParcela.valorParcela);
        document.getElementById('infoMaiorParcela').textContent = `${maiorParcela.segurado} | Parcelamento: ${maiorParcela.parcelasTotal}x`;
    } else {
        document.getElementById('valMaiorParcela').textContent = 'R$ 0,00';
        document.getElementById('infoMaiorParcela').textContent = '-';
    }

    // 3. Próximo a Vencer (ignoring recurring)
    const nonRecurring = data.filter(i => !i.isRecurring && i.vencimento && i.vencimento > new Date());
    const nextVenc = [...nonRecurring].sort((a, b) => a.vencimento - b.vencimento)[0];
    const kpiVenc = document.getElementById('kpiProximoVencimento');

    if (nextVenc) {
        document.getElementById('valProximoVencimento').textContent = nextVenc.vencimento.toLocaleDateString('pt-BR');
        document.getElementById('infoProximoVencimento').textContent = nextVenc.segurado;

        // Force striking visibility as requested
        kpiVenc.classList.add('kpi-red');

        const diffDays = Math.ceil((nextVenc.vencimento - new Date()) / (1000 * 60 * 60 * 24));
        if (diffDays < 20) {
            kpiVenc.style.animation = 'pulse 2s infinite';
        } else {
            kpiVenc.style.animation = 'none';
        }
    } else {
        document.getElementById('valProximoVencimento').textContent = '-';
        document.getElementById('infoProximoVencimento').textContent = 'Nenhum vencimento próximo';
        kpiVenc.classList.remove('kpi-red');
        kpiVenc.style.animation = 'none';
    }
}

function renderGrid() {
    const grid = document.getElementById('segurosGrid');
    grid.innerHTML = '';

    if (state.filteredData.length === 0) {
        grid.innerHTML = '<div class="text-center py-5 w-100 text-muted"><h5>Nenhum seguro encontrado com estes filtros</h5></div>';
        return;
    }

    state.filteredData.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'insurance-card';
        card.dataset.index = index;

        const statusColor = getStatusColor(item);

        card.innerHTML = `
            <div class="close-expanded"><i class="bi bi-x-circle"></i></div>
            <div class="card-icon d-flex justify-content-between align-items-center mb-1">
                <i class="bi ${getIconForType(item.tipo)}" style="font-size: 1.5rem;"></i>
                <span class="fw-bold text-primary-custom" style="font-size: 0.9rem;">${formatCurrency(item.premio)}</span>
            </div>
            
            <div class="card-subtitle mb-1" style="font-size: 0.7rem; opacity: 0.8;">
                ${item.tipo || 'Geral'}
            </div>

            <div class="card-title mb-2 d-flex align-items-center gap-2" style="font-size: 1.05rem; line-height: 1.2;">
                ${item.indicador ? `<span class="badge bg-secondary text-white small" style="font-size: 0.65rem; padding: 0.15rem 0.35rem;">${item.indicador}</span>` : ''}
                <div class="fw-bold text-truncate flex-grow-1" title="${item.segurado}">${item.segurado}</div>
            </div>
            <div style="font-size: 0.7rem; margin-top: -5px; margin-bottom: 8px;" class="text-muted d-flex align-items-center gap-1">
                <span class="badge-status-dot" style="background: ${statusColor}; width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>
                ${item.seguradora}
            </div>

            ${item.assistencia ? `
            <div class="mb-2 p-2 rounded-3 bg-success-subtle text-success border border-success-subtle d-flex align-items-center justify-content-center gap-2" style="font-size: 0.85rem; font-weight: 700;">
                <i class="bi bi-telephone-fill"></i> ${item.assistencia}
            </div>` : ''}
            
            <div class="details">
                <div class="row">
                    <div class="col-md-6">
                        <div class="detail-item">
                            <div class="detail-label">Contratante</div>
                            <div class="detail-value">${item.contratante}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Segurado</div>
                            <div class="detail-value">${item.segurado}</div>
                        </div>
                         <div class="detail-item">
                            <div class="detail-label">Vigência</div>
                            <div class="detail-value">${formatDate(item.inicio)} a ${formatDate(item.vencimento)}</div>
                        </div>
                         <div class="detail-item">
                            <div class="detail-label">Prêmio Total</div>
                            <div class="detail-value fw-bold text-primary-custom">${formatCurrency(item.premio)}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Parcelamento</div>
                            <div class="detail-value text-dark fw-bold" style="font-size: 1.1rem;">
                                ${item.isRecurring ?
                `<span class="badge bg-info text-dark" style="font-size: 0.7rem;">RECORRENTE</span> ${formatCurrency(item.valorParcela)}` :
                `${item.parcelasTotal} x ${formatCurrency(item.valorParcela)}`
            }
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Pagamento</div>
                            <div class="detail-value">Dia ${item.diaPgto || '-'} | ${item.formatoParcelas || '-'}</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="detail-item">
                            <div class="detail-label">Apólice / Proposta</div>
                            <div class="detail-value">
                                ${item.apolice ? `<a href="${item.apolice}" target="_blank" class="btn btn-sm btn-outline-primary mt-1"><i class="bi bi-file-earmark-pdf"></i> Abrir PDF</a>` : 'Não informada'}
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Senha / Acesso</div>
                            <div class="detail-value">${item.senha || 'N/A'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Assistência 24h</div>
                            <div class="detail-value text-success-custom fw-bold"><i class="bi bi-telephone"></i> ${item.assistencia || 'Consulte corretor'}</div>
                        </div>
                        <div class="mt-4 pt-3 border-top">
                             <div class="detail-label">Corretor Responsável</div>
                             <div class="detail-value">${item.corretor || '-'}</div>
                             <div class="small mt-1"><i class="bi bi-whatsapp"></i> ${item.telefoneCorretor || '-'}</div>
                             <div class="small"><i class="bi bi-envelope"></i> ${item.emailCorretor || '-'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.close-expanded') || e.target.closest('a')) return;
            expandCard(card);
        });

        card.querySelector('.close-expanded').addEventListener('click', (e) => {
            e.stopPropagation();
            closeExpandedCard();
        });

        grid.appendChild(card);
    });
}

// ==========================================
// Card Expansion Logic
// ==========================================
function expandCard(card) {
    if (card.classList.contains('expanded')) return;

    closeExpandedCard(); // Close any other first

    const overlay = document.getElementById('smokeOverlay');
    overlay.classList.add('active');
    card.classList.add('expanded');
    document.body.classList.add('card-expanded');
}

function closeExpandedCard() {
    const expanded = document.querySelector('.insurance-card.expanded');
    if (expanded) {
        expanded.classList.remove('expanded');
    }

    const overlay = document.getElementById('smokeOverlay');
    overlay.classList.remove('active');
    document.body.classList.remove('card-expanded');
}

// ==========================================
// Helpers
// ==========================================
function formatCurrency(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(date) {
    if (!date) return 'Contínuo';
    return date.toLocaleDateString('pt-BR');
}

function populateSelect(id, options) {
    const s = document.getElementById(id);
    if (!s) return;
    s.innerHTML = '';
    options.forEach(o => {
        if (!o) return;
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        s.appendChild(opt);
    });
}

function getIconForType(tipo) {
    const t = (tipo || "").toLowerCase();
    if (t.includes('auto') || t.includes('carro') || t.includes('veículo')) return 'bi-car-front';
    if (t.includes('vida')) return 'bi-heart-pulse';
    if (t.includes('resid') || t.includes('casa') || t.includes('imóvel')) return 'bi-house-heart';
    if (t.includes('empresa') || t.includes('patrimon')) return 'bi-building-check';
    if (t.includes('saúde') || t.includes('plano')) return 'bi-hospital';
    if (t.includes('respons') || t.includes('rc')) return 'bi-shield-shaded';
    return 'bi-shield-check';
}

function getStatusColor(item) {
    if (item.vencimento && item.vencimento < new Date()) return '#e74c3c'; // Expired
    return '#F2911B'; // Active
}

let kpiChartInstance = null;
function showKPIChart(type) {
    const data = state.filteredData;
    if (data.length === 0) return;

    const modal = new bootstrap.Modal(document.getElementById('chartModal'));
    const ctx = document.getElementById('kpiChart').getContext('2d');
    const title = document.getElementById('chartModalTitle');

    if (kpiChartInstance) kpiChartInstance.destroy();

    let labels = [];
    let values = [];
    let label = '';
    let color = CONFIG_SEGUROS.COLORS.primary;

    if (type === 'prêmios') {
        title.textContent = 'Análise de Prêmios Totais';
        label = 'Valor do Prêmio';
        const sorted = [...data].sort((a, b) => b.premio - a.premio).slice(0, 10);
        labels = sorted.map(i => i.segurado);
        values = sorted.map(i => i.premio);
    } else if (type === 'parcelas') {
        title.textContent = 'Análise de Valor de Parcelas';
        label = 'Valor da Parcela';
        color = CONFIG_SEGUROS.COLORS.info;
        const sorted = [...data].sort((a, b) => b.valorParcela - a.valorParcela).slice(0, 10);
        labels = sorted.map(i => i.segurado);
        values = sorted.map(i => i.valorParcela);
    } else if (type === 'vencimentos') {
        title.textContent = 'Vencimentos por Mês';
        label = 'Quantidade de Vencimentos';
        color = CONFIG_SEGUROS.COLORS.danger;

        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const counts = new Array(12).fill(0);

        data.forEach(i => {
            if (i.vencimento && !i.isRecurring) {
                counts[i.vencimento.getMonth()]++;
            }
        });

        labels = months;
        values = counts;
    }

    kpiChartInstance = new Chart(ctx, {
        type: type === 'vencimentos' ? 'line' : 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: color + '88',
                borderColor: color,
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            if (type === 'vencimentos') return value;
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });

    modal.show();
}
