console.log("Parcelamentos.js carregando...");

// Configuration
const CONFIG = {
    COLORS: {
        primary: '#F2911B',
        secondary: '#262223',
        success: '#2ecc71',
        danger: '#e74c3c',
        info: '#3498db',
        warning: '#f1c40f',
        light: '#F2F2F2',
        dark: '#262223'
    }
};

let state = {
    rawData: [],
    filteredData: [],
    filters: {
        categorias: [],
        formatos: [],
        empresas: [],
        status: []
    },
    charts: {} // evolution, category, paidVsPending, top
};

// Error Handler
window.onerror = function (msg, url, line, col, error) {
    console.error("Global Error:", msg, "at", line, ":", col);
    // Don't alert for every small thing, but log it
    return false;
};

// Register Plugins
function registerPlugins() {
    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }
}

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("Initializing Dashboard...");
        registerPlugins();
        initEventListeners();
        initCharts();
        initDoubleScroll();
        console.log("Initialization complete");
        tryAutoLoad();
    } catch (e) {
        console.error("Critical Init Error:", e);
        alert("Erro ao iniciar o aplicativo: " + e.message);
    }
});

/**
 * Tenta carregar dados automaticamente do Supabase ou recorre ao arquivo local
 */
function tryAutoLoad() {
    console.log("Tentando carregar dados online do Supabase via API...");
    
    fetch('/api/parcelamentos?_t=' + Date.now())
        .then(response => {
            if (!response.ok) throw new Error("Erro na resposta da API");
            return response.json();
        })
        .then(data => {
            if (Array.isArray(data)) {
                console.log(`✅ Carregados ${data.length} parcelamentos do Supabase!`);
                processData(data);
                document.getElementById('lastUpdate').innerText = "Sincronizado com Supabase em: " + new Date().toLocaleTimeString();
            } else {
                console.log("Resposta inválida, recorrendo ao arquivo local...");
                loadLocalCSV();
            }
        })
        .catch(err => {
            console.warn("Falha ao carregar do Supabase. Recorrendo ao arquivo local...", err.message);
            loadLocalCSV();
        });
}

function loadLocalCSV() {
    const defaultFile = 'dados-parcelamentos.csv';
    console.log(`Tentando auto-load Parcelamentos estático (${defaultFile})...`);

    fetch(defaultFile)
        .then(response => {
            if (!response.ok) throw new Error("Arquivo padrão não encontrado");
            return response.blob();
        })
        .then(blob => {
            const file = new File([blob], defaultFile, { type: 'text/csv' });
            const event = { target: { files: [file] } };
            handleFileUpload(event, true);
        })
        .catch(err => {
            console.warn("Auto-load estático indisponível ou arquivo não encontrado:", err.message);
        });
}

function initEventListeners() {
    // File Upload
    const fileInput = document.getElementById('csvFileParcelas');
    if (fileInput) {
        fileInput.addEventListener('click', function (e) { e.target.value = null; });
        fileInput.addEventListener('change', handleFileUpload);
        console.log("File Upload listener attached");

        // Backup: Attach to label too
        const label = document.querySelector('label[for="csvFileParcelas"]');
        if (label) {
            label.style.cursor = 'pointer';
            label.addEventListener('click', function () {
                console.log("Label clicked, triggering input");
                fileInput.click();
            });
        }
    } else {
        console.warn("Element #csvFileParcelas not found!");
    }
    // ... (rest of the listeners)

    // Filters
    const filterIds = ['filterCategoria', 'filterFormato', 'filterEmpresa', 'filterStatus'];
    const filterKeys = ['categorias', 'formatos', 'empresas', 'status'];
    filterIds.forEach(function (id, idx) { setupFilterListener(id, filterKeys[idx]); });

    // Clear Filters
    const btnClear = document.getElementById('btnClearFilters');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            filterIds.forEach((id, idx) => clearFilter(id, filterKeys[idx]));
            applyFilters();
        });
    }

    // Sidebar Toggles
    const toggleSidebar = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('mainContent');
    const sidebarToggle = document.getElementById('sidebarToggle');

    if (toggleSidebar && sidebar) {
        toggleSidebar.addEventListener('click', () => sidebar.classList.toggle('active'));
    }

    if (sidebarToggle && sidebar && content) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            content.classList.toggle('expanded');
        });
    }
}

function setupFilterListener(elementId, stateKey) {
    const el = document.getElementById(elementId);
    if (el) {
        el.addEventListener('change', (e) => {
            state.filters[stateKey] = Array.from(e.target.selectedOptions).map(o => o.value);
            applyFilters();
        });
    }
}

function clearFilter(elementId, stateKey) {
    const el = document.getElementById(elementId);
    if (el) el.value = "";
    state.filters[stateKey] = [];
}

function initCharts() {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' },
            datalabels: { display: false }
        }
    };

    const configEvolution = {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            ...commonOptions,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                ...commonOptions.plugins,
                legend: { display: true },
                title: { display: true, text: 'Projeção Total de Pagamentos Mensais' }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: { beginAtZero: true, ticks: { callback: (v) => formatCurrencyCompact(v) } }
            },
            onClick: (event, elements) => {
                if (elements && elements.length > 0) {
                    const index = elements[0].index;
                    const chart = state.charts.evolution;
                    const monthLabel = chart.data.labels[index];
                    if (window.showMonthDetailsModal) {
                        window.showMonthDetailsModal(index, monthLabel);
                    }
                }
            }
        }
    };

    const evolutionEl = document.getElementById('evolutionChart');
    if (evolutionEl) state.charts.evolution = new Chart(evolutionEl, configEvolution);

    const categoryEl = document.getElementById('categoryChart');
    if (categoryEl) state.charts.category = new Chart(categoryEl, { type: 'doughnut', data: { labels: [], datasets: [] }, options: commonOptions });

    const pvpEl = document.getElementById('paidVsPendingChart');
    if (pvpEl) state.charts.paidVsPending = new Chart(pvpEl, { type: 'pie', data: { labels: [], datasets: [] }, options: commonOptions });

    const topEl = document.getElementById('topInstallmentsChart');
    if (topEl) {
        state.charts.top = new Chart(topEl, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                ...commonOptions,
                indexAxis: 'y',
                scales: { x: { display: false } }
            }
        });
    }
}

function debug(msg) {
    console.log(msg);
    const statusDiv = document.getElementById('fileStatus');
    if (statusDiv) {
        statusDiv.innerText += "\n" + msg;
        statusDiv.style.whiteSpace = 'pre-wrap';
    }
}

function handleFileUpload(event, isSilent = false) {
    const file = event.target.files[0];
    if (!file) return;

    debug("Iniciando carregamento de: " + file.name);

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('d-none');

    setTimeout(() => {
        if (typeof Papa === 'undefined') {
            const err = "Biblioteca PapaParse não encontrada! Verifique sua conexão.";
            debug("❌ " + err);
            if (overlay) overlay.classList.add('d-none');
            alert(err);
            return;
        }

        debug("Efetuando parsing do arquivo...");
        Papa.parse(file, {
            header: true,
            skipEmptyLines: 'greedy',
            encoding: "ISO-8859-1", // Force encoding for BR Excel CSVs
            delimitersToGuess: [',', ';', '\t', '|'],
            error: function (err) {
                console.error("Papa Parse Error:", err);
                if (overlay) overlay.classList.add('d-none');
                debug("❌ Erro Papa: " + err.message);
                alert("Erro ao ler CSV: " + err.message);
            },
            complete: function (results) {
                debug("✅ CSV Lido. Processando " + results.data.length + " linhas...");
                try {
                    if (!results.data || results.data.length === 0) {
                        throw new Error("Arquivo vazio ou sem dados legíveis.");
                    }

                    // Give JS a breath to update UI before heavy processing
                    setTimeout(function () {
                        processData(results.data);
                        if (overlay) overlay.classList.add('d-none');

                        var sample = state.rawData[0];
                        if (sample && sample.debug) {
                            var info = [
                                "Registros: " + state.rawData.length,
                                "Coluna Descrição: " + (sample.debug.matchedKeys.description || "❌"),
                                "Coluna Valor: " + (sample.debug.matchedKeys.totalValue || "❌")
                            ].join("\n");
                            debug("✅ Dashboard atualizado.\n" + info);
                        }
                        
                        if (!isSilent) {
                            saveDataToSupabase(results.data);
                        } else {
                            document.getElementById('lastUpdate').innerText = "Carregado localmente em: " + new Date().toLocaleTimeString();
                        }
                    }, 50);

                } catch (error) {
                    debug("❌ Erro Crítico: " + error.message);
                    if (overlay) overlay.classList.add('d-none');
                    alert("Erro ao processar dados: " + error.message);
                }
            }
        });
    }, 100);
}

function saveDataToSupabase(data) {
    debug("Sincronizando dados com o Supabase...");
    
    fetch('/api/parcelamentos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) throw new Error("Erro ao salvar dados no Supabase");
        return response.json();
    })
    .then(res => {
        debug("✅ Dados salvos com sucesso no Supabase!");
        document.getElementById('lastUpdate').innerText = "Sincronizado com Supabase em: " + new Date().toLocaleTimeString();
        alert("Dados salvos e sincronizados com sucesso no Supabase!");
    })
    .catch(err => {
        console.error("Erro ao sincronizar com Supabase:", err);
        debug("❌ Falha ao salvar online: " + err.message);
        alert("Erro ao salvar dados no Supabase. Os dados estão visíveis localmente, mas não foram salvos online: " + err.message);
    });
}

function processData(data) {
    // Expose data for BrisinhAI
    window.FULL_CSV_DATA = data;
    if (window.updateBrisinhAIContext) window.updateBrisinhAIContext();

    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const normalize = (s) => s ? s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

    const cleanData = data.map(row => {
        const matchedKeys = {};

        const getValue = (row, candidates, fieldLabel) => {
            const rowKeys = Object.keys(row);
            for (const candidate of candidates) {
                const normCandidate = normalize(candidate);
                let match = rowKeys.find(k => normalize(k) === normCandidate);
                if (match) {
                    if (fieldLabel) matchedKeys[fieldLabel] = match;
                    return row[match];
                }
            }
            for (const candidate of candidates) {
                const normCandidate = normalize(candidate);
                let match = rowKeys.find(k => normalize(k).includes(normCandidate));
                if (match) {
                    if (fieldLabel) matchedKeys[fieldLabel] = match;
                    return row[match];
                }
            }
            return '';
        };

        const item = {
            id: row.id || '',
            installments: row.installments || [],
            raw: row,
            description: getValue(row, ['Ativos e bens', 'Ativos', 'Descrição', 'Item', 'Objeto', 'Nome'], 'description'),
            format: getValue(row, ['formato', 'Formato'], 'format'),
            category: getValue(row, ['tipo', 'Tipo', 'Categoria', 'Classificação'], 'category'),
            company: getValue(row, ['empresa', 'Empresa', 'Fornecedor', 'Credor'], 'company'),
            statusCsv: getValue(row, ['status', 'Status', 'Situação', 'Estado'], 'status'),
            startDateStr: getValue(row, ['inicício de contrato', 'inicio de contrato', 'Início', 'Inicio', 'Data Inicio', 'Data de Inicio', 'Contratação'], 'startDate'),
            endDateStr: getValue(row, ['término de contrato', 'termino de contrato', 'Término', 'Termino', 'Data Termino', 'Data de Termino', 'Vencimento', 'Fim'], 'endDate'),
            totalValue: parseCurrency(getValue(row, ['total do contrato', 'Total Contrato', 'Valor Total', 'Total', 'Valor Global'], 'totalValue')),
            paidFromCsv: parseCurrency(getValue(row, ['Total Pago', 'Já Pago', 'Pago'], 'paidFromCsv')),
            paidCountFromCsv: parseInt(getValue(row, ['Parcelas Pagas', 'Pagas'], 'paidCountFromCsv') || '-1'),
            remainingFromCsv: parseInt(getValue(row, ['Parcelas Restantes', 'Restam', 'Qtd Restante', 'Saldo de Parcelas'], 'remainingFromCsv') || '-1'),
            installmentValue: parseCurrency(getValue(row, ['Valor da parcela', 'Valor Parcela', 'Parcela', 'Mensalidade'], 'installmentValue')),
            totalInstallments: parseInt(getValue(row, ['parcelas contratadas', 'Parcelas Contratadas', 'Total Parcelas', 'Qtd Parcelas', 'Prazo']) || '0'),
            calculated: { paidCount: 0, paidValue: 0, remainingCount: 0, outstandingValue: 0, status: 'Ativo' },
            debug: { matchedKeys }
        };

        // Use the value directly from CSV as requested
        item.calculated.paidValue = item.paidFromCsv;
        if (item.remainingFromCsv !== -1) {
            item.calculated.remainingCount = item.remainingFromCsv;
        }

        if (!item.description && item.company) item.description = item.company;
        if (!item.description) item.description = 'Sem Descrição';
        if (!item.category) item.category = 'Outros';

        const start = parseDate(item.startDateStr);
        const end = parseDate(item.endDateStr);
        item.startDateObj = start;
        item.endDateObj = end;

        if (item.totalInstallments === 0 && start && end) {
            const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
            if (diffMonths > 0) item.totalInstallments = diffMonths;
        }

        // --- STATUS & CALCULATION LOGIC ---
        const statusNorm = normalize(item.statusCsv);
        const descNorm = normalize(item.description);
        let isActive = false;

        if (descNorm.includes('caminhao') && descNorm.includes('gl') && descNorm.includes('12')) {
            item.calculated.status = 'Transferido';
        }
        else if (['pagando', 'ativo', 'em andamento', 'vigente', 'aberto'].some(s => statusNorm.includes(s))) {
            isActive = true;
            item.calculated.status = 'Pagando';
        } else if (['quitado', 'finalizado', 'concluido', 'pago', 'encerrado', 'transferido', 'desistido'].some(function (s) { return statusNorm.includes(s); })) {
            item.calculated.status = statusNorm.includes('transferido') ? 'Transferido' : (statusNorm.includes('desistido') ? 'Desistido' : 'Quitado');
        } else {
            if (start && item.totalValue > 0) {
                isActive = true;
                item.calculated.status = 'Pagando (Auto)';
            } else {
                item.calculated.status = item.statusCsv || 'Desconhecido';
            }
        }

        // If installments are present, they are the single source of truth for counts and value
        if (item.installments && Array.isArray(item.installments) && item.installments.length > 0) {
            const paidInsts = item.installments.filter(i => i.pago);
            const pendingInsts = item.installments.filter(i => !i.pago && i.observacao !== 'Desistido');
            
            item.calculated.paidCount = paidInsts.length;
            item.calculated.remainingCount = pendingInsts.length;
            item.calculated.paidValue = paidInsts.reduce((sum, i) => sum + i.valor, 0);
            item.calculated.outstandingValue = pendingInsts.reduce((sum, i) => sum + i.valor, 0);
            
            if (item.calculated.status !== 'Transferido' && item.calculated.status !== 'Desistido') {
                if (item.calculated.remainingCount === 0 && item.calculated.paidCount > 0) {
                    item.calculated.status = 'Quitado';
                } else if (item.calculated.remainingCount > 0) {
                    item.calculated.status = 'Pagando';
                    
                    const firstInst = pendingInsts.length > 0 ? pendingInsts[0] : item.installments[0];
                    if (firstInst && firstInst.vencimento) {
                        const firstDate = new Date(firstInst.vencimento + 'T00:00:00');
                        const diffTime = firstDate - today;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays > 90) {
                            item.calculated.status = 'Carência';
                        }
                    }
                }
            }
        } else {
            // Fallback for offline CSV without installments array
            if ((isActive || item.calculated.status.includes('Pagando')) && start && !isNaN(start.getTime())) {
                if (item.remainingFromCsv === -1) {
                    var monthsElapsed = (currentMonthStart.getFullYear() - start.getFullYear()) * 12 + (currentMonthStart.getMonth() - start.getMonth());
                    if (monthsElapsed < 0) monthsElapsed = 0;
                    var paidCount = Math.min(monthsElapsed, item.totalInstallments);
                    item.calculated.paidCount = paidCount;
                    item.calculated.remainingCount = Math.max(0, item.totalInstallments - paidCount);
                } else {
                    item.calculated.remainingCount = item.remainingFromCsv;
                    if (item.paidCountFromCsv !== -1) {
                        item.calculated.paidCount = item.paidCountFromCsv;
                    } else {
                        item.calculated.paidCount = Math.max(0, item.totalInstallments - item.calculated.remainingCount);
                    }
                }

                item.calculated.outstandingValue = item.calculated.remainingCount * item.installmentValue;

                if (item.calculated.remainingCount <= 0) {
                    item.calculated.status = 'Quitado';
                    item.calculated.outstandingValue = 0;
                } else {
                    const diffTime = start - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > 90) {
                        item.calculated.status = 'Carência';
                    }
                }
            } else {
                if (item.calculated.status === 'Transferido' || item.calculated.status === 'Desistido') {
                    item.calculated.outstandingValue = 0;
                    item.calculated.remainingCount = 0;
                } else if (normalize(item.calculated.status) === 'quitado') {
                    item.calculated.outstandingValue = 0;
                    item.calculated.remainingCount = 0;
                    if (item.paidCountFromCsv !== -1) {
                        item.calculated.paidCount = item.paidCountFromCsv;
                    } else if (item.totalInstallments > 0) {
                        item.calculated.paidCount = item.totalInstallments;
                    }
                }
            }
        }
        return item;
    }).filter(function (i) { return (i.totalValue > 0 || i.installmentValue > 0); });

    state.rawData = cleanData;

    populateSelect('filterCategoria', [...new Set(cleanData.map(d => d.category))].sort());
    if (document.getElementById('filterFormato')) populateSelect('filterFormato', [...new Set(cleanData.map(d => d.format))].filter(Boolean).sort());
    if (document.getElementById('filterEmpresa')) populateSelect('filterEmpresa', [...new Set(cleanData.map(d => d.company))].filter(Boolean).sort());
    populateSelect('filterStatus', [...new Set(cleanData.map(d => d.calculated.status))].sort());

    applyFilters();
}

function applyFilters() {
    let df = state.rawData;
    if (state.filters.categorias.length > 0) df = df.filter(r => state.filters.categorias.includes(r.category));
    if (state.filters.formatos.length > 0) df = df.filter(r => state.filters.formatos.includes(r.format));
    if (state.filters.empresas.length > 0) df = df.filter(r => state.filters.empresas.includes(r.company));
    if (state.filters.status.length > 0) df = df.filter(r => state.filters.status.includes(r.calculated.status));

    state.filteredData = df;
    updateDashboard();
}

function updateDashboard() {
    const df = state.filteredData || [];
    const activeDf = df.filter(r => r.calculated.status.includes('Pagando') || r.calculated.status === 'Ativo');
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    let dueThisMonth = 0;
    df.forEach(item => {
        if (item.installments && Array.isArray(item.installments)) {
            item.installments.forEach(inst => {
                if (!inst.pago && inst.observacao !== 'Desistido' && inst.vencimento) {
                    const vencDate = new Date(inst.vencimento + 'T00:00:00');
                    if (vencDate.getFullYear() === currentYear && vencDate.getMonth() === currentMonth) {
                        dueThisMonth += inst.valor;
                    }
                }
            });
        }
    });

    const sortedByValue = [...df].sort((a, b) => b.totalValue - a.totalValue);
    const largestContract = sortedByValue[0];
    const sortedByTerm = [...df].sort((a, b) => b.totalInstallments - a.totalInstallments);
    const longestTerm = sortedByTerm[0];
    const sortedByLiquidation = [...activeDf].sort((a, b) => {
        if (a.calculated.remainingCount !== b.calculated.remainingCount) return a.calculated.remainingCount - b.calculated.remainingCount;
        return (a.endDateObj || 0) - (b.endDateObj || 0);
    });
    const nextLiquidate = sortedByLiquidation[0];
    const currentTotalOutstanding = df.reduce((sum, r) => sum + r.calculated.outstandingValue, 0);

    const kpiHTML = `
        <div class="col-md-3">
            <div class="card h-100 border-0 shadow-sm" style="border-left: 4px solid ${CONFIG.COLORS.primary} !important;">
                <div class="card-body">
                    <h6 class="text-muted small text-uppercase mb-2">Maior Contrato</h6>
                    <div class="fw-bold text-truncate" title="${largestContract?.description || '-'}">${largestContract?.description || '-'}</div>
                    <div class="h4 fw-bold mb-1">${largestContract ? formatCurrency(largestContract.totalValue) : 'R$ 0,00'}</div>
                    <div class="small text-muted">Saldo Devedor: <span class="fw-semibold text-danger">${largestContract ? formatCurrency(largestContract.calculated.outstandingValue) : '-'}</span></div>
                    <div class="small text-muted">Total Pago: <span class="fw-semibold text-success">${largestContract ? formatCurrency(largestContract.calculated.paidValue) : '-'}</span></div>
                    <div class="small text-muted">Parcela: <span class="fw-semibold text-dark">${largestContract ? formatCurrency(largestContract.installmentValue) : '-'}</span></div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card h-100 border-0 shadow-sm" style="border-left: 4px solid ${CONFIG.COLORS.info} !important;">
                <div class="card-body">
                    <h6 class="text-muted small text-uppercase mb-2">Maior Prazo</h6>
                    <div class="fw-bold text-truncate" title="${longestTerm?.description || '-'}">${longestTerm?.description || '-'}</div>
                    <div class="h4 fw-bold mb-1">${longestTerm ? longestTerm.totalInstallments + ' x' : '-'}</div>
                    <div class="small text-muted">Saldo Devedor: <span class="fw-semibold text-danger">${longestTerm ? formatCurrency(longestTerm.calculated.outstandingValue) : '-'}</span></div>
                    <div class="small text-muted">Total Pago: <span class="fw-semibold text-success">${longestTerm ? formatCurrency(longestTerm.calculated.paidValue) : '-'}</span></div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
             <div class="card h-100 border-0 shadow-sm" style="border-left: 4px solid ${CONFIG.COLORS.success} !important;">
                <div class="card-body">
                    <h6 class="text-muted small text-uppercase mb-2">Próximo a Liquidar</h6>
                    <div class="fw-bold text-truncate" title="${nextLiquidate?.description || '-'}">${nextLiquidate?.description || 'Nenhum ativo'}</div>
                    <div class="h4 fw-bold mb-1 text-success">${nextLiquidate ? nextLiquidate.calculated.remainingCount + ' restantes' : '-'}</div>
                    <div class="small text-muted">Parcela: <span class="fw-semibold text-dark">${nextLiquidate ? formatCurrency(nextLiquidate.installmentValue) : '-'}</span></div>
                    <div class="small text-muted">Total Pago: <span class="fw-semibold text-success">${nextLiquidate ? formatCurrency(nextLiquidate.calculated.paidValue) : '-'}</span></div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
             <div class="card bg-danger text-white h-100 border-0 shadow-sm" style="cursor: pointer;">
                <div class="card-body">
                    <h6 class="text-white-50 small text-uppercase mb-2">Saldo Devedor Total <i class="bi bi-search ms-1"></i></h6>
                    <h3 class="fw-bold mb-0">${formatCurrency(currentTotalOutstanding)}</h3>
                    <div class="small mt-2 text-white-50">${activeDf.length} contratos ativos</div>
                    <div class="small mt-1 text-white-50">Vence este mês: <span class="fw-bold text-white">${formatCurrency(dueThisMonth)}</span></div>
                </div>
            </div>
        </div>
    `;
    const kpiRow = document.getElementById('kpiRow');
    if (kpiRow) kpiRow.innerHTML = kpiHTML;

    // Attach click handler for Audit
    const newKpiCard = document.querySelector('.card.bg-danger');
    if (newKpiCard) {
        newKpiCard.onclick = () => {
            const auditTable = document.querySelector('#auditTable tbody');
            if (!auditTable) return;
            auditTable.innerHTML = '';
            const debtItems = df.filter(r => r.calculated.outstandingValue > 0).sort((a, b) => b.calculated.outstandingValue - a.calculated.outstandingValue);
            debtItems.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><div class="fw-bold">${item.description}</div><div class="small text-muted">${item.company}</div></td><td>${item.category}</td><td class="text-end fw-bold text-danger">${formatCurrency(item.calculated.outstandingValue)}</td>`;
                auditTable.appendChild(tr);
            });
            const trTotal = document.createElement('tr');
            trTotal.className = 'table-light fw-bold sticky-bottom';
            trTotal.innerHTML = `<td colspan="2" class="text-end">TOTAL</td><td class="text-end">${formatCurrency(currentTotalOutstanding)}</td>`;
            auditTable.appendChild(trTotal);
            const modal = new bootstrap.Modal(document.getElementById('auditModal'));
            modal.show();
        }
    }

    // --- CHARTS ---
    if (state.charts.evolution) {
        const labels = [];
        const values = [];

        // Find the latest vencimento date of all pending installments
        let maxDate = new Date(currentYear, currentMonth + 11, 1); // default to 12 months ahead
        df.forEach(item => {
            if (item.installments && Array.isArray(item.installments)) {
                item.installments.forEach(inst => {
                    if (!inst.pago && inst.observacao !== 'Desistido' && inst.vencimento) {
                        const vencDate = new Date(inst.vencimento + 'T00:00:00');
                        if (vencDate > maxDate) {
                            maxDate = vencDate;
                        }
                    }
                });
            }
        });

        // Compute number of months to project
        const totalMonths = (maxDate.getFullYear() - currentYear) * 12 + (maxDate.getMonth() - currentMonth) + 1;
        const projectionMonths = Math.max(12, totalMonths);

        const monthDetailsMap = new Map();

        for (let i = 0; i < projectionMonths; i++) {
            const targetDate = new Date(currentYear, currentMonth + i, 1);
            const targetYear = targetDate.getFullYear();
            const targetMonth = targetDate.getMonth();

            let monthlyTotal = 0;
            const monthContracts = [];

            df.forEach(item => {
                if (item.installments && Array.isArray(item.installments)) {
                    item.installments.forEach(inst => {
                        if (!inst.pago && inst.observacao !== 'Desistido' && inst.vencimento) {
                            const vencDate = new Date(inst.vencimento + 'T00:00:00');
                            if (vencDate.getFullYear() === targetYear && vencDate.getMonth() === targetMonth) {
                                monthlyTotal += inst.valor;
                                monthContracts.push({
                                    description: item.description,
                                    company: item.company,
                                    numero: inst.numero,
                                    valor: inst.valor,
                                    vencimento: inst.vencimento
                                });
                            }
                        }
                    });
                }
            });

            const monthLabel = targetDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            labels.push(monthLabel);
            values.push(monthlyTotal);
            monthDetailsMap.set(i, monthContracts);
        }

        state.monthDetails = monthDetailsMap;

        // Adjust chart container width based on number of labels to allow scroll
        const chartContainer = document.querySelector('#evolutionChart').closest('.chart-container');
        if (chartContainer) {
            const minWidthPerLabel = 60; // Pixels
            const calculatedWidth = Math.max(chartContainer.parentElement.clientWidth - 40, labels.length * minWidthPerLabel);
            chartContainer.style.width = calculatedWidth + 'px';
        }

        state.charts.evolution.data = {
            labels,
            datasets: [{
                label: 'Pagamentos Mensais',
                data: values,
                borderColor: CONFIG.COLORS.primary,
                backgroundColor: 'rgba(242, 145, 27, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        };
        state.charts.evolution.update();
    }

    if (state.charts.category) {
        const catSums = {};
        df.filter(r => r.calculated.outstandingValue > 0).forEach(r => { catSums[r.category] = (catSums[r.category] || 0) + r.calculated.outstandingValue; });
        const catSorted = Object.entries(catSums).sort((a, b) => b[1] - a[1]);
        state.charts.category.data = { labels: catSorted.map(c => c[0]), datasets: [{ data: catSorted.map(c => c[1]), backgroundColor: [CONFIG.COLORS.primary, CONFIG.COLORS.secondary, CONFIG.COLORS.info, CONFIG.COLORS.success, CONFIG.COLORS.warning, '#95a5a6'] }] };
        state.charts.category.update();
    }

    if (state.charts.paidVsPending) {
        const totalPaid = df.reduce((sum, r) => sum + r.calculated.paidValue, 0);
        state.charts.paidVsPending.data = { labels: ['Já Quitado', 'Falta Pagar'], datasets: [{ data: [totalPaid, currentTotalOutstanding], backgroundColor: [CONFIG.COLORS.success, CONFIG.COLORS.danger] }] };
        state.charts.paidVsPending.options.plugins.datalabels = { display: true, color: '#fff', font: { weight: 'bold' }, formatter: (value) => formatCurrencyCompact(value) };
        state.charts.paidVsPending.update();
    }

    if (state.charts.top) {
        const topItems = [...activeDf].sort((a, b) => b.installmentValue - a.installmentValue).slice(0, 5);
        state.charts.top.data = { labels: topItems.map(i => i.description.substring(0, 15) + '...'), datasets: [{ label: 'Valor da Parcela', data: topItems.map(i => i.installmentValue), backgroundColor: [CONFIG.COLORS.primary, CONFIG.COLORS.secondary, CONFIG.COLORS.info, CONFIG.COLORS.success, CONFIG.COLORS.warning], borderRadius: 4 }] };
        state.charts.top.update();
    }

    updateTable(df);
}

function updateTable(data) {
    var tbody = document.querySelector('#parcelasTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Performance optimization: use DocumentFragment to avoid reflows
    var fragment = document.createDocumentFragment();

    data.forEach(function (item) {
        var tr = document.createElement('tr');
        var start = item.startDateObj ? item.startDateObj.toLocaleDateString('pt-BR') : '-';
        var end = item.endDateObj ? item.endDateObj.toLocaleDateString('pt-BR') : '-';

        var statusClass = 'bg-secondary';
        if (item.calculated.status.includes('Pagando') || item.calculated.status === 'Ativo') statusClass = 'bg-warning text-dark';
        if (item.calculated.status === 'Quitado') statusClass = 'bg-success';
        if (item.calculated.status === 'Desistido') statusClass = 'bg-danger';
        if (item.calculated.status === 'Carência') statusClass = 'bg-info text-dark';

        const actionBtn = item.id ?
            '<td class="text-center"><button class="btn btn-sm btn-outline-primary" onclick="openEditModal(\'' + item.id + '\')"><i class="bi bi-pencil-fill"></i></button></td>' :
            '<td class="text-center text-muted small"><i class="bi bi-cloud-slash" title="Offline"></i></td>';

        tr.innerHTML = '<td><div class="fw-bold text-wrap" style="max-width: 250px;">' + item.description + '</div>' +
            '<div class="small text-muted">' + item.company + ' | ' + item.format + '</div></td>' +
            '<td><span class="badge bg-light text-dark border">' + item.category + '</span></td>' +
            '<td><div class="small">' + start + '</div><div class="small text-muted">até ' + end + '</div></td>' +
            '<td class="text-end fw-bold">' + formatCurrency(item.totalValue) + '</td>' +
            '<td class="text-end">' + formatCurrency(item.installmentValue) + '</td>' +
            '<td class="text-center"><div class="d-flex flex-column align-items-center">' +
            '<span class="badge bg-success mb-1">' + item.calculated.paidCount + ' Pagas</span>' +
            '<span class="badge bg-secondary opacity-75">' + item.calculated.remainingCount + ' Restam</span>' +
            '</div></td>' +
            '<td class="text-end text-danger fw-bold">' + formatCurrency(item.calculated.outstandingValue) + '</td>' +
            '<td><span class="badge ' + statusClass + '">' + item.calculated.status + '</span></td>' +
            actionBtn;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

function parseCurrency(valStr) {
    if (typeof valStr === 'number') return valStr;
    if (!valStr) return 0;
    let s = valStr.toString().trim().replace('R$', '').trim();
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    return parseFloat(s) || 0;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    let s = dateStr.toString().trim();
    if (s.includes(' ')) s = s.split(' ')[0];
    let parts;
    if (s.includes('/')) {
        parts = s.split('/');
        if (parts.length === 3) {
            let d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
            if (parts[2].length === 2) y += 2000;
            const res = new Date(y, m, d);
            return isNaN(res.getTime()) ? null : res;
        }
    } else if (s.includes('-')) {
        parts = s.split('-');
        if (parts.length === 3) {
            let y = parseInt(parts[0]), m = parseInt(parts[1]) - 1, d = parseInt(parts[2]);
            if (y < 100) { d = parseInt(parts[0]); y = parseInt(parts[2]) + 2000; }
            const res = new Date(y, m, d);
            return isNaN(res.getTime()) ? null : res;
        }
    }
    if (!isNaN(s) && s > 30000) return new Date((s - 25569) * 86400 * 1000);
    return null;
}

function formatCurrency(val) { return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatCurrencyCompact(val) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: "compact", maximumFractionDigits: 1 }).format(val); }

function populateSelect(id, options) {
    const s = document.getElementById(id);
    if (!s) return;
    s.innerHTML = '';
    options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o; opt.text = o; s.appendChild(opt);
    });
}

// ========================================
// PDF EXPORT FUNCTION (Global)
// ========================================

async function exportToPDF() {
    try {
        const btn = document.getElementById('btnExportPDF');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Gerando...';
        btn.disabled = true;

        document.getElementById('loadingOverlay').classList.remove('d-none');

        // --- Configuration ---
        const PAGE_WIDTH = 800;
        const PAGE_HEIGHT = 1130;
        const PAGE_PADDING = 40;

        function parseMarkdown(text) {
            if (!text) return '';
            let md = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>');
            return md.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(line => `<p style="margin: 0 0 10px 0; line-height: 1.5; text-align: justify;">${line}</p>`)
                .join('');
        }

        let aiAnalysisText = "";
        if (window.getBrisinhAIAnalysis) {
            aiAnalysisText = await window.getBrisinhAIAnalysis();
        }

        const mainContainer = document.createElement('div');
        Object.assign(mainContainer.style, {
            position: 'absolute', top: '0', left: '-9999px', width: (PAGE_WIDTH + 40) + 'px'
        });
        document.body.appendChild(mainContainer);

        let pages = [];
        let currentPage = createPage();
        pages.push(currentPage);
        mainContainer.appendChild(currentPage);

        function createPage() {
            const div = document.createElement('div');
            Object.assign(div.style, {
                width: PAGE_WIDTH + 'px', height: PAGE_HEIGHT + 'px', backgroundColor: 'white',
                padding: PAGE_PADDING + 'px', boxSizing: 'border-box', position: 'relative',
                fontFamily: "'Outfit', sans-serif", color: '#262223', overflow: 'hidden',
                display: 'flex', flexDirection: 'column'
            });
            return div;
        }

        function addToPage(element) {
            currentPage.appendChild(element);
            const totalHeight = Array.from(currentPage.children).reduce((acc, el) => acc + el.offsetHeight + (parseInt(getComputedStyle(el).marginBottom) || 0), 0);
            if (totalHeight > (PAGE_HEIGHT - (PAGE_PADDING * 2))) {
                currentPage.removeChild(element);
                currentPage = createPage();
                pages.push(currentPage);
                mainContainer.appendChild(currentPage);
                currentPage.appendChild(element);
            }
        }

        // --- Header ---
        const headerDiv = document.createElement('div');
        headerDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #F2911B; padding-bottom: 20px; margin-bottom: 30px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div id="report-logo-ph"></div>
                    <div>
                        <h1 style="font-size: 24px; font-weight: 700; margin: 0;">Relatório de Parcelamentos</h1>
                        <p style="margin: 5px 0 0; color: #6c757d; font-size: 14px;">Mar Brasil</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 12px; color: #6c757d; margin:5px 0 0;">${new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>`;

        try {
            const logo = document.querySelector('header img');
            if (logo) {
                const c = document.createElement('canvas');
                c.width = logo.naturalWidth; c.height = logo.naturalHeight;
                c.getContext('2d').drawImage(logo, 0, 0);
                const i = document.createElement('img');
                i.src = c.toDataURL();
                i.style.maxHeight = '40px';
                headerDiv.querySelector('#report-logo-ph').appendChild(i);
            }
        } catch (e) { }
        addToPage(headerDiv);

        // --- AI ---
        const aiHeader = document.createElement('div');
        aiHeader.innerHTML = `<h3 style="font-size: 16px; margin-bottom: 15px; border-left: 5px solid #F2911B; padding-left: 10px; background:#f8f9fa; padding:10px;">🤖 Análise de Dívidas (BrisinhAI)</h3>`;
        addToPage(aiHeader);

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = parseMarkdown(aiAnalysisText || "Análise indisponível.");
        Array.from(tempDiv.children).forEach(p => {
            p.style.fontSize = "12px"; p.style.lineHeight = "1.5"; p.style.marginBottom = "8px";
            const pWrapper = document.createElement('div');
            pWrapper.appendChild(p.cloneNode(true));
            addToPage(pWrapper);
        });
        const spacer = document.createElement('div');
        spacer.innerHTML = "&nbsp;";
        addToPage(spacer);

        // --- KPIs ---
        const kpiSource = document.getElementById('kpiRow');
        if (kpiSource) {
            const kpiClone = kpiSource.cloneNode(true);
            kpiClone.style.zoom = "0.8"; // Print scale
            kpiClone.style.marginBottom = "30px";
            kpiClone.style.display = 'grid';
            kpiClone.style.gridTemplateColumns = 'repeat(4, 1fr)';
            kpiClone.style.gap = '10px';

            // Clean up card classes or rely on HTML2Canvas.
            // Replace col-md-3 with nothing or flex
            Array.from(kpiClone.querySelectorAll('.col-md-3')).forEach(col => {
                col.classList.remove('col-md-3');
                col.style.width = 'auto'; // let grid handle
            });

            const wrapper = document.createElement('div');
            wrapper.innerHTML = `<h6 style="font-size:14px; font-weight:bold; margin-bottom:10px;">Indicadores de Dívida</h6>`;
            wrapper.appendChild(kpiClone);
            addToPage(wrapper);
        }

        // --- Charts ---
        const chartIds = [
            { id: 'evolutionChart', title: 'Evolução do Saldo Devedor' },
            { id: 'categoryChart', title: 'Por Categoria' },
            { id: 'paidVsPendingChart', title: 'Pago vs Pendente' },
            { id: 'topDebtsChart', title: 'Top 5 Parcelas' }
        ];

        // Charts Grid (2 per row)
        for (let i = 0; i < chartIds.length; i += 2) {
            const chartRow = document.createElement('div');
            chartRow.style.display = 'flex';
            chartRow.style.gap = '20px';
            chartRow.style.marginBottom = '20px';
            chartRow.style.height = '250px';

            for (let j = i; j < i + 2 && j < chartIds.length; j++) {
                const item = chartIds[j];
                const canvasSource = document.getElementById(item.id);
                if (canvasSource) {
                    const card = document.createElement('div');
                    Object.assign(card.style, { flex: '1', border: '1px solid #ddd', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column' });

                    const title = document.createElement('h6');
                    title.textContent = item.title;
                    title.style.fontSize = '12px'; title.style.fontWeight = 'bold'; title.style.marginBottom = '5px';
                    card.appendChild(title);

                    const c = document.createElement('canvas');
                    c.width = canvasSource.width; c.height = canvasSource.height;
                    c.style.width = '100%'; c.style.height = '100%'; c.style.objectFit = 'contain';
                    c.getContext('2d').drawImage(canvasSource, 0, 0);
                    card.appendChild(c);

                    chartRow.appendChild(card);
                }
            }
            if (chartRow.children.length > 0) addToPage(chartRow);
        }

        // --- Render PDF ---
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const PDF_W = 210; const PDF_H = 297;

        for (let i = 0; i < pages.length; i++) {
            if (i > 0) doc.addPage();
            await new Promise(r => setTimeout(r, 100));
            const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, logging: false });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, PDF_W, PDF_H);
        }

        doc.save(`Parcelamentos_MarBrasil_${new Date().toISOString().slice(0, 10)}.pdf`);

        document.body.removeChild(mainContainer);
        document.getElementById('loadingOverlay').classList.add('d-none');
        btn.innerHTML = originalText;
        btn.disabled = false;

    } catch (e) {
        console.error(e);
        alert("Erro no PDF: " + e.message);
        document.getElementById('loadingOverlay').classList.add('d-none');
        document.getElementById('btnExportPDF').disabled = false;
        document.getElementById('btnExportPDF').innerHTML = 'Exportar PDF';
    }
}

// Expose globally
window.exportToPDF = exportToPDF;

// ========================================
// Edit Contract & Installments Modal Logic
// ========================================
let activeContract = null;

function openAddModal() {
    activeContract = {
        id: '',
        description: '',
        company: 'MAR BRASIL',
        category: 'Outros',
        credor: '',
        totalValue: 0,
        calculated: { status: 'Ativo' },
        installments: []
    };
    
    // Set modal title to "Novo Contrato"
    const titleEl = document.querySelector('#editContractModal .modal-title');
    if (titleEl) {
        titleEl.innerHTML = '<i class="bi bi-plus-square-fill me-2 text-primary"></i>Novo Contrato';
    }

    // Reset inputs
    document.getElementById('editDebtId').value = '';
    document.getElementById('editDescription').value = '';
    document.getElementById('editCompany').value = 'MAR BRASIL';
    populateEditCategoryOptions('Outros');
    document.getElementById('editCredor').value = '';
    document.getElementById('editTotalValue').value = '';
    document.getElementById('editStatus').value = 'Ativo';
    document.getElementById('amortizationDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('amortizationIsEarlyPayoff').checked = false;
    toggleEarlyPayoffView(document.getElementById('amortizationIsEarlyPayoff'));

    // Clear creation inputs
    document.getElementById('newStartDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('newDueDay').value = new Date().getDate();
    document.getElementById('newTotalInstallments').value = '';
    document.getElementById('newInstallmentValue').value = '';
    document.getElementById('newPaidCount').value = '0';

    // Hide edit-only panels and show creation panel
    document.getElementById('editInstallmentsPanel').style.display = 'none';
    document.getElementById('creationPanel').style.display = 'block';
    document.getElementById('amortizationContainer').style.display = 'none';
    document.getElementById('btnDeleteContract').style.display = 'none';

    // Show Modal
    const modal = new bootstrap.Modal(document.getElementById('editContractModal'));
    modal.show();
}

function openEditModal(debtId) {
    activeContract = state.rawData.find(d => d.id === debtId);
    if (!activeContract) {
        alert("Contrato não encontrado!");
        return;
    }
    
    // Deep clone activeContract to allow cancelation
    activeContract = JSON.parse(JSON.stringify(activeContract));

    // Set modal title to "Editar Contrato"
    const titleEl = document.querySelector('#editContractModal .modal-title');
    if (titleEl) {
        titleEl.innerHTML = '<i class="bi bi-pencil-square me-2 text-primary"></i>Editar Contrato e Cronograma';
    }

    document.getElementById('editDebtId').value = activeContract.id;
    document.getElementById('editDescription').value = activeContract.description || '';
    document.getElementById('editCompany').value = activeContract.company || 'MAR BRASIL';
    populateEditCategoryOptions(activeContract.category || 'Outros');
    document.getElementById('editCredor').value = activeContract.raw?.['FORMA DE PAGTO'] || activeContract.credor || '';
    document.getElementById('editTotalValue').value = activeContract.totalValue || 0;
    document.getElementById('editStatus').value = activeContract.calculated?.status || 'Ativo';
    
    // Clear amortization value and reset dates
    document.getElementById('amortizationValue').value = '';
    document.getElementById('amortizationDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('amortizationIsEarlyPayoff').checked = false;
    toggleEarlyPayoffView(document.getElementById('amortizationIsEarlyPayoff'));

    // Show edit-only panels and hide creation panel
    document.getElementById('editInstallmentsPanel').style.display = 'block';
    document.getElementById('creationPanel').style.display = 'none';
    document.getElementById('amortizationContainer').style.display = 'block';
    document.getElementById('btnDeleteContract').style.display = 'block';

    // Render installments
    renderEditInstallments();

    // Show Modal
    const modal = new bootstrap.Modal(document.getElementById('editContractModal'));
    modal.show();
}

function renderEditInstallments() {
    const tbody = document.querySelector('#editInstallmentsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!activeContract.installments || activeContract.installments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma parcela gerada.</td></tr>';
        return;
    }

    // Set "Check All" state based on whether all installments are paid
    const allPaid = activeContract.installments.every(i => i.pago);
    document.getElementById('checkAllInstallments').checked = allPaid;

    activeContract.installments.forEach((inst, idx) => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td class="text-center">
                <select class="form-select form-select-sm" style="width: 110px; margin: 0 auto;" onchange="changeInstallmentStatus(${idx}, this.value)">
                    <option value="Pendente" ${!inst.pago && inst.observacao !== 'Postergado' && inst.observacao !== 'Desistido' ? 'selected' : ''}>Pendente</option>
                    <option value="Pago" ${inst.pago ? 'selected' : ''}>Pago</option>
                    <option value="Postergado" ${!inst.pago && inst.observacao === 'Postergado' ? 'selected' : ''}>Postergado</option>
                    <option value="Desistido" ${!inst.pago && inst.observacao === 'Desistido' ? 'selected' : ''}>Desistido</option>
                </select>
            </td>
            <td class="text-center font-semibold" style="width: 80px;">P. ${inst.numero}</td>
            <td>
                <input type="date" class="form-control form-control-sm" style="width: 135px;" value="${inst.vencimento || ''}" onchange="changeInstallmentDate(${idx}, this.value)">
            </td>
            <td>
                <div class="input-group input-group-sm" style="width: 120px;">
                    <span class="input-group-text">R$</span>
                    <input type="number" step="0.01" class="form-control" value="${inst.valor || 0}" onchange="changeInstallmentValue(${idx}, this.value)">
                </div>
            </td>
            <td>
                <input type="text" class="form-control form-control-sm" value="${inst.observacao || ''}" placeholder="Obs" onchange="changeInstallmentObs(${idx}, this.value)">
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleInstallment(idx, checkbox) {
    // Legacy support (fallback)
    if (activeContract && activeContract.installments[idx]) {
        activeContract.installments[idx].pago = checkbox.checked;
        activeContract.installments[idx].data_pagamento = checkbox.checked ? new Date().toISOString().split('T')[0] : null;
        renderEditInstallments();
    }
}

function toggleAllInstallments(checkbox) {
    if (activeContract && activeContract.installments) {
        activeContract.installments.forEach(inst => {
            inst.pago = checkbox.checked;
            inst.data_pagamento = checkbox.checked ? new Date().toISOString().split('T')[0] : null;
            if (!checkbox.checked && (inst.observacao === 'Postergado' || inst.observacao === 'Desistido' || inst.observacao === 'Quitação Antecipada')) {
                inst.observacao = null;
            }
        });
        renderEditInstallments();
    }
}

function applyAmortizationMath() {
    const txnDate = document.getElementById('amortizationDate').value || new Date().toISOString().split('T')[0];
    const isEarlyPayoff = document.getElementById('amortizationIsEarlyPayoff').checked;

    if (isEarlyPayoff) {
        const pendingInstallments = activeContract.installments.filter(i => !i.pago);
        if (pendingInstallments.length === 0) {
            alert("Todas as parcelas deste contrato já estão pagas!");
            return;
        }
        pendingInstallments.forEach(inst => {
            inst.pago = true;
            inst.data_pagamento = txnDate;
            inst.observacao = 'Quitação Antecipada';
        });
        document.getElementById('editStatus').value = 'Quitado';
        alert(`Quitação antecipada aplicada! ${pendingInstallments.length} parcelas foram marcadas como Quitadas.`);
        renderEditInstallments();
        return;
    }

    const valInput = document.getElementById('amortizationValue');
    const value = parseFloat(valInput.value);
    if (isNaN(value) || value <= 0) {
        alert("Por favor, insira um valor válido de amortização!");
        return;
    }

    const strategy = document.getElementById('amortizationStrategy').value;
    const pendingInstallments = activeContract.installments.filter(i => !i.pago);

    if (pendingInstallments.length === 0) {
        alert("Todas as parcelas deste contrato já estão pagas!");
        return;
    }

    if (strategy === 'reduceTerm') {
        // Option 1: Reduce Term (abater parcelas do fim)
        let remainingAmortization = value;
        const sortedPending = [...pendingInstallments].sort((a, b) => b.numero - a.numero);
        
        for (const inst of sortedPending) {
            if (remainingAmortization >= inst.valor) {
                inst.pago = true;
                inst.data_pagamento = txnDate;
                inst.observacao = 'Amortizado (Prazo)';
                remainingAmortization -= inst.valor;
            } else if (remainingAmortization > 0) {
                inst.valor = Math.max(0, inst.valor - remainingAmortization);
                inst.observacao = (inst.observacao || '') + ` Amortizado R$ ${remainingAmortization.toFixed(2)} (Prazo)`;
                remainingAmortization = 0;
            }
            if (remainingAmortization <= 0) break;
        }
        
        alert(`Amortização aplicada! R$ ${value.toLocaleString('pt-BR')} foram abatidos reduzindo o prazo (parcelas finais).`);

    } else if (strategy === 'reduceInstallment') {
        // Option 2: Reduce Installment (diminuir valor das parcelas)
        const portion = value / pendingInstallments.length;
        
        pendingInstallments.forEach(inst => {
            inst.valor = Math.max(0, inst.valor - portion);
            inst.observacao = (inst.observacao || '') + ` Reduzida R$ ${portion.toFixed(2)} por Amortização em ${txnDate}`;
        });

        alert(`Amortização aplicada! R$ ${value.toLocaleString('pt-BR')} foram distribuídos, reduzindo as parcelas restantes.`);
    }

    // Refresh UI
    renderEditInstallments();
    valInput.value = '';
}

function saveContractChangesToServer() {
    if (!activeContract) return;

    const debtId = document.getElementById('editDebtId').value;
    const isNew = !debtId;

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('d-none');

    // Collect values
    const description = document.getElementById('editDescription').value;
    const company = document.getElementById('editCompany').value;
    let category = document.getElementById('editCategory').value;
    if (category === '__custom__') {
        category = document.getElementById('editCategoryCustom').value.trim();
        if (!category) {
            alert("Por favor, digite o nome da nova categoria.");
            if (overlay) overlay.classList.add('d-none');
            return;
        }
    }
    const credor = document.getElementById('editCredor').value;
    const totalValue = parseFloat(document.getElementById('editTotalValue').value) || 0;
    const status = document.getElementById('editStatus').value;

    if (!description.trim()) {
        alert("Por favor, preencha a descrição do contrato.");
        if (overlay) overlay.classList.add('d-none');
        return;
    }

    let payload = {};

    if (isNew) {
        // Collect generation parameters
        const startDate = document.getElementById('newStartDate').value;
        const dueDay = parseInt(document.getElementById('newDueDay').value) || 1;
        const totalInstallments = parseInt(document.getElementById('newTotalInstallments').value) || 0;
        const installmentValue = parseFloat(document.getElementById('newInstallmentValue').value) || 0;
        const paidCount = parseInt(document.getElementById('newPaidCount').value) || 0;

        if (!startDate) {
            alert("Por favor, preencha a data de início.");
            if (overlay) overlay.classList.add('d-none');
            return;
        }
        if (totalInstallments <= 0) {
            alert("Por favor, preencha a quantidade de parcelas.");
            if (overlay) overlay.classList.add('d-none');
            return;
        }
        if (installmentValue <= 0) {
            alert("Por favor, preencha o valor da parcela.");
            if (overlay) overlay.classList.add('d-none');
            return;
        }

        payload = {
            isNew: true,
            descricao: description,
            empresa: company,
            categoria: category,
            credor: credor,
            valor_total: totalValue || (installmentValue * totalInstallments), // auto-calc if 0
            status: status,
            observacoes: JSON.stringify({
                details: '',
                format: '',
                doc: credor,
                cc: ''
            }),
            startDate,
            dueDay,
            totalInstallments,
            installmentValue,
            paidCount
        };
    } else {
        payload = {
            id: debtId,
            descricao: description,
            empresa: company,
            categoria: category,
            credor: credor,
            valor_total: totalValue,
            status: status,
            total_parcelas: activeContract.installments.length,
            valor_parcela: activeContract.installments[0]?.valor || activeContract.installmentValue || 0,
            data_inicio: activeContract.startDateStr || (activeContract.installments[0]?.vencimento ? activeContract.installments[0].vencimento : new Date().toISOString().split('T')[0]),
            observacoes: JSON.stringify({
                details: activeContract.raw?.['Detalhes'] || '',
                format: activeContract.raw?.['FORMATO'] || '',
                doc: credor,
                cc: activeContract.raw?.['CENTRO DE CUSTO'] || ''
            }),
            installments: activeContract.installments
        };
    }

    const method = isNew ? 'POST' : 'PUT';

    fetch('/api/parcelamentos', {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) throw new Error("Falha ao salvar alterações");
        return response.json();
    })
    .then(res => {
        if (overlay) overlay.classList.add('d-none');
        
        const modalEl = document.getElementById('editContractModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        alert(isNew ? "Contrato criado com sucesso!" : "Alterações salvas com sucesso!");
        
        tryAutoLoad();
    })
    .catch(err => {
        if (overlay) overlay.classList.add('d-none');
        console.error(err);
        alert("Erro ao salvar alterações no Supabase: " + err.message);
    });
}

function deleteContractFromServer() {
    if (!activeContract) return;
    
    if (!confirm(`Tem certeza absoluta que deseja EXCLUIR o contrato "${activeContract.description}" do banco de dados? Esta ação não pode ser desfeita.`)) {
        return;
    }

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('d-none');

    fetch(`/api/parcelamentos?id=${activeContract.id}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) throw new Error("Falha ao excluir contrato");
        return response.json();
    })
    .then(res => {
        if (overlay) overlay.classList.add('d-none');
        
        const modalEl = document.getElementById('editContractModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        alert("Contrato excluído com sucesso!");
        
        tryAutoLoad();
    })
    .catch(err => {
        if (overlay) overlay.classList.add('d-none');
        console.error(err);
        alert("Erro ao excluir contrato: " + err.message);
    });
}

function changeInstallmentStatus(idx, status) {
    if (activeContract && activeContract.installments[idx]) {
        const inst = activeContract.installments[idx];
        if (status === 'Pago') {
            inst.pago = true;
            inst.data_pagamento = inst.data_pagamento || new Date().toISOString().split('T')[0];
            inst.observacao = null;
        } else if (status === 'Postergado') {
            inst.pago = false;
            inst.data_pagamento = null;
            inst.observacao = 'Postergado';
        } else if (status === 'Desistido') {
            inst.pago = false;
            inst.data_pagamento = null;
            inst.observacao = 'Desistido';
        } else { // Pendente
            inst.pago = false;
            inst.data_pagamento = null;
            inst.observacao = null;
        }
        renderEditInstallments();
    }
}

function toggleEarlyPayoffView(checkbox) {
    const valueGroup = document.getElementById('amortizationValueGroup');
    const strategyGroup = document.getElementById('amortizationStrategyGroup');
    if (!valueGroup || !strategyGroup) return;
    if (checkbox.checked) {
        valueGroup.style.display = 'none';
        strategyGroup.style.display = 'none';
    } else {
        valueGroup.style.display = 'block';
        strategyGroup.style.display = 'block';
    }
}

function showMonthDetailsModal(index, label) {
    const details = state.monthDetails ? state.monthDetails.get(index) : [];
    const tbody = document.querySelector('#monthDetailsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    document.getElementById('monthDetailsModalTitle').innerHTML = `<i class="bi bi-calendar-event me-2 text-primary"></i>Parcelas de ${label}`;

    if (!details || details.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted p-3">Nenhum pagamento previsto para este mês.</td></tr>';
    } else {
        let total = 0;
        details.forEach(item => {
            total += item.valor;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="fw-bold text-wrap" style="max-width: 250px;">${item.description}</div>
                    <div class="small text-muted">${item.company}</div>
                </td>
                <td class="text-center"><span class="badge bg-light text-dark border">Parcela ${item.numero}</span></td>
                <td class="text-end fw-semibold">${formatCurrency(item.valor)}</td>
            `;
            tbody.appendChild(tr);
        });
        
        // Add total row
        const trTotal = document.createElement('tr');
        trTotal.className = 'table-light fw-bold';
        trTotal.innerHTML = `
            <td colspan="2" class="text-end">TOTAL</td>
            <td class="text-end">${formatCurrency(total)}</td>
        `;
        tbody.appendChild(trTotal);
    }

    const modal = new bootstrap.Modal(document.getElementById('monthDetailsModal'));
    modal.show();
}

function initDoubleScroll() {
    const topScroll = document.getElementById('top-scrollbar-container');
    const topDummy = document.getElementById('top-scrollbar-dummy');
    const bottomScroll = document.getElementById('actual-table-responsive');
    const table = document.getElementById('parcelasTable');

    if (!topScroll || !bottomScroll || !table) return;

    // Sync widths using ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
        const tableWidth = table.scrollWidth;
        if (topDummy) topDummy.style.width = tableWidth + 'px';
        
        if (tableWidth > bottomScroll.clientWidth) {
            topScroll.style.display = 'block';
        } else {
            topScroll.style.display = 'none';
        }
    });
    resizeObserver.observe(table);
    resizeObserver.observe(bottomScroll);

    // Sync top scroll to bottom scroll
    topScroll.onscroll = function() {
        bottomScroll.scrollLeft = topScroll.scrollLeft;
    };

    // Sync bottom scroll to top scroll
    bottomScroll.onscroll = function() {
        topScroll.scrollLeft = bottomScroll.scrollLeft;
    };
}

// ========================================
// Manual and Batch Add Installments Controls
// ========================================

function addNewInstallmentRow() {
    if (!activeContract) return;
    
    // Find the next installment number
    const nextNum = (activeContract.installments || []).reduce((max, inst) => Math.max(max, inst.numero), 0) + 1;
    
    // Find the next installment due date (1 month after the last installment's due date, or today)
    let nextDateStr = new Date().toISOString().split('T')[0];
    if (activeContract.installments && activeContract.installments.length > 0) {
        const lastInst = activeContract.installments[activeContract.installments.length - 1];
        if (lastInst.vencimento) {
            const lastDate = new Date(lastInst.vencimento + 'T00:00:00');
            const nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, lastDate.getDate());
            nextDateStr = nextDate.toISOString().split('T')[0];
        }
    }
    
    // Default installment value
    const lastValue = activeContract.installments && activeContract.installments.length > 0 ? 
        activeContract.installments[activeContract.installments.length - 1].valor : 
        (activeContract.installmentValue || 0);

    const newInst = {
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        numero: nextNum,
        valor: lastValue,
        vencimento: nextDateStr,
        pago: false,
        data_pagamento: null,
        observacao: null
    };
    
    if (!activeContract.installments) {
        activeContract.installments = [];
    }
    activeContract.installments.push(newInst);
    
    // Update contract total value by summing all installments
    const newTotal = activeContract.installments.reduce((sum, i) => sum + i.valor, 0);
    document.getElementById('editTotalValue').value = newTotal;
    
    renderEditInstallments();
}

function showAddBatchForm() {
    const container = document.getElementById('batchAddContainer');
    if (!container) return;
    container.style.display = 'block';
    
    // Auto-fill defaults
    document.getElementById('batchQtd').value = '1';
    
    // Default installment value: last installment value or contract average
    const lastValue = activeContract.installments && activeContract.installments.length > 0 ? 
        activeContract.installments[activeContract.installments.length - 1].valor : 
        (activeContract.installmentValue || 0);
    document.getElementById('batchValue').value = lastValue;
    
    // Default date: 1 month after last installment
    let nextDateStr = new Date().toISOString().split('T')[0];
    let nextDueDay = new Date().getDate();
    if (activeContract.installments && activeContract.installments.length > 0) {
        const lastInst = activeContract.installments[activeContract.installments.length - 1];
        if (lastInst.vencimento) {
            const lastDate = new Date(lastInst.vencimento + 'T00:00:00');
            const nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, lastDate.getDate());
            nextDateStr = nextDate.toISOString().split('T')[0];
            nextDueDay = lastDate.getDate();
        }
    }
    document.getElementById('batchStartDate').value = nextDateStr;
    document.getElementById('batchDueDay').value = nextDueDay;
}

function hideAddBatchForm() {
    const container = document.getElementById('batchAddContainer');
    if (container) container.style.display = 'none';
}

function applyBatchAddInstallments() {
    if (!activeContract) return;
    
    const qtd = parseInt(document.getElementById('batchQtd').value) || 0;
    const value = parseFloat(document.getElementById('batchValue').value) || 0;
    const startDate = document.getElementById('batchStartDate').value;
    const dueDay = parseInt(document.getElementById('batchDueDay').value) || 1;
    
    if (qtd <= 0) {
        alert("Por favor, insira uma quantidade maior que zero.");
        return;
    }
    if (value <= 0) {
        alert("Por favor, insira um valor de parcela válido.");
        return;
    }
    if (!startDate) {
        alert("Por favor, selecione a data do primeiro vencimento.");
        return;
    }
    
    const [year, month, day] = startDate.split('-').map(Number);
    const dayOfVenc = dueDay || day || 1;
    
    if (!activeContract.installments) {
        activeContract.installments = [];
    }
    
    const startNum = activeContract.installments.reduce((max, inst) => Math.max(max, inst.numero), 0) + 1;
    
    for (let i = 0; i < qtd; i++) {
        const d = new Date(year, month - 1 + i, dayOfVenc);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const safeDay = Math.min(dayOfVenc, lastDay);
        const vencimento = new Date(d.getFullYear(), d.getMonth(), safeDay);
        
        activeContract.installments.push({
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            numero: startNum + i,
            valor: value,
            vencimento: vencimento.toISOString().split('T')[0],
            pago: false,
            data_pagamento: null,
            observacao: null
        });
    }
    
    // Recalculate contract total value
    const newTotal = activeContract.installments.reduce((sum, i) => sum + i.valor, 0);
    document.getElementById('editTotalValue').value = newTotal;
    
    hideAddBatchForm();
    renderEditInstallments();
    alert(`${qtd} parcelas adicionadas com sucesso!`);
}

function changeInstallmentDate(idx, value) {
    if (activeContract && activeContract.installments[idx]) {
        activeContract.installments[idx].vencimento = value;
    }
}

function changeInstallmentValue(idx, value) {
    if (activeContract && activeContract.installments[idx]) {
        activeContract.installments[idx].valor = parseFloat(value) || 0;
        // Recalculate contract total value
        const newTotal = activeContract.installments.reduce((sum, i) => sum + i.valor, 0);
        document.getElementById('editTotalValue').value = newTotal;
    }
}

function changeInstallmentObs(idx, value) {
    if (activeContract && activeContract.installments[idx]) {
        activeContract.installments[idx].observacao = value || null;
    }
}

function populateEditCategoryOptions(currentValue) {
    const select = document.getElementById('editCategory');
    if (!select) return;
    
    const defaults = ["Financiamento", "Empréstimo", "Consórcio", "Leasing", "Cartão", "Fornecedor", "Mútuo", "Outros"];
    const current = state.rawData.map(d => d.category).filter(Boolean);
    const unique = [...new Set([...defaults, ...current])].sort();
    
    select.innerHTML = '';
    unique.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
    
    // Add custom option
    const optCustom = document.createElement('option');
    optCustom.value = '__custom__';
    optCustom.textContent = '+ Cadastrar Nova Categoria...';
    select.appendChild(optCustom);
    
    // Set value
    if (unique.includes(currentValue)) {
        select.value = currentValue;
        document.getElementById('editCategoryCustomContainer').style.display = 'none';
    } else if (currentValue) {
        const opt = document.createElement('option');
        opt.value = currentValue;
        opt.textContent = currentValue;
        select.insertBefore(opt, optCustom);
        select.value = currentValue;
        document.getElementById('editCategoryCustomContainer').style.display = 'none';
    } else {
        select.value = 'Outros';
        document.getElementById('editCategoryCustomContainer').style.display = 'none';
    }
}

function toggleCustomCategoryField(value) {
    const container = document.getElementById('editCategoryCustomContainer');
    if (!container) return;
    if (value === '__custom__') {
        container.style.display = 'block';
        document.getElementById('editCategoryCustom').value = '';
        document.getElementById('editCategoryCustom').focus();
    } else {
        container.style.display = 'none';
    }
}

window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.toggleInstallment = toggleInstallment;
window.toggleAllInstallments = toggleAllInstallments;
window.applyAmortizationMath = applyAmortizationMath;
window.saveContractChangesToServer = saveContractChangesToServer;
window.deleteContractFromServer = deleteContractFromServer;
window.changeInstallmentStatus = changeInstallmentStatus;
window.toggleEarlyPayoffView = toggleEarlyPayoffView;
window.showMonthDetailsModal = showMonthDetailsModal;
window.initDoubleScroll = initDoubleScroll;
window.addNewInstallmentRow = addNewInstallmentRow;
window.showAddBatchForm = showAddBatchForm;
window.hideAddBatchForm = hideAddBatchForm;
window.applyBatchAddInstallments = applyBatchAddInstallments;
window.changeInstallmentDate = changeInstallmentDate;
window.changeInstallmentValue = changeInstallmentValue;
window.changeInstallmentObs = changeInstallmentObs;
window.populateEditCategoryOptions = populateEditCategoryOptions;
window.toggleCustomCategoryField = toggleCustomCategoryField;

