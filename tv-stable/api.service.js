const OMIE_API_URL = "https://app.omie.com.br/api/v1";

// Hardcoded Credentials (Server-side like behavior)
const OMIE_APP_KEY_HARDCODED = "6107191559469";
const OMIE_APP_SECRET_HARDCODED = "4bc8f241278fa35c48bb60c7366c55f9";

class OmieService {
    constructor() {
        // Priority: Hardcoded > LocalStorage > Empty
        this.appKey = OMIE_APP_KEY_HARDCODED || localStorage.getItem('omie_app_key') || '';
        this.appSecret = OMIE_APP_SECRET_HARDCODED || localStorage.getItem('omie_app_secret') || '';
        this.empresaNome = "Mar Brasil";
    }

    isAuthenticated() {
        return this.appKey && this.appSecret;
    }

    setCredentials(key, secret) {
        this.appKey = key;
        this.appSecret = secret;
        localStorage.setItem('omie_app_key', key);
        localStorage.setItem('omie_app_secret', secret);
    }

    async callApi(url, call, param) {
        if (!this.isAuthenticated()) {
            throw new Error("Credenciais da API Omie não configuradas.");
        }

        const body = {
            call: call,
            app_key: this.appKey,
            app_secret: this.appSecret,
            param: [param]
        };

        try {
            // Use local proxy (PowerShell/Python) to avoid CORS
            // Absolute URL to allow file:// usage
            // Updated to port 8081 to avoid conflicts
            const proxyUrl = `http://localhost:8081/api/proxy?url=${encodeURIComponent(url)}`;

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro na API Omie (via Proxy ${response.status}): ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Erro na requisição Omie:", error);
            // Friendly error if proxy is down
            if (error.message.includes("Failed to fetch")) {
                throw new Error("Não foi possível conectar ao Proxy em http://localhost:8081. Por favor, execute o arquivo 'run_proxy.bat'.");
            }
            throw error;
        }
    }

    // --- Mappings ---
    async listCategories() {
        let pagina = 1;
        const map = {};

        try {
            while (true) {
                const param = {
                    pagina: pagina,
                    registros_por_pagina: 500,
                    apenas_importado_api: "N"
                };

                const result = await this.callApi(`${OMIE_API_URL}/geral/categorias/`, "ListarCategorias", param);

                if (result.categoria_cadastro) {
                    result.categoria_cadastro.forEach(cat => {
                        map[cat.codigo] = cat.descricao;
                    });
                }

                if (pagina >= result.total_de_paginas) break;
                pagina++;
            }
        } catch (e) {
            console.warn("Could not fetch categories fully:", e);
        }
        return map;
    }

    async listProjects() {
        let pagina = 1;
        const map = {};

        try {
            while (true) {
                const param = {
                    pagina: pagina,
                    registros_por_pagina: 500,
                    apenas_botoes: "N",
                    apenas_importado_api: "N"
                };

                const result = await this.callApi(`${OMIE_API_URL}/geral/projetos/`, "ListarProjetos", param);

                if (result.cadastro) {
                    result.cadastro.forEach(proj => {
                        map[proj.codigo] = proj.nome_projeto;
                    });
                }

                if (pagina >= result.total_de_paginas) break;
                pagina++;
            }
        } catch (e) {
            console.warn("Could not fetch projects fully:", e);
        }
        return map;
    }

    // --- Transactions ---

    // --- Transactions (MF: Movimentos Financeiros) ---
    async listMovimentos(dRegInicial, dRegFinal) {
        // Ensure format DD/MM/YYYY
        const formatDate = (d) => {
            if (d.includes('-')) {
                const [y, m, day] = d.split('-');
                return `${day}/${m}/${y}`;
            }
            return d;
        };

        const dIni = formatDate(dRegInicial);
        const dFim = formatDate(dRegFinal);

        console.log(`Buscando Movimentos Financeiros (MF) de ${dIni} a ${dFim}...`);

        // Using ListarMovimentos as requested
        // Endpoint: /financas/mf/
        // Params: nPagina, nRegPorPagina, dDtInicial, dDtFinal
        // Note: dDtInicial/Final usually filters by Payment Date in MF? 
        // Or Competence? User wants Competence (Registro).
        // Let's pass the dates and hope it filters by relevant range, or we filter in memory.

        const movimentosRaw = await this._fetchAllPages(
            `${OMIE_API_URL}/financas/mf/`,
            "ListarMovimentos",
            "movimentos", // Result key: 'movimentos' (common) or 'movimentosFinanceiros'
            dIni,
            dFim,
            { // Extra Params specific to ListarMovimentos
                dDtInicial: dIni,
                dDtFinal: dFim
            }
        );

        console.log(`Total Movimentos encontrados: ${movimentosRaw.length}`);

        // Map to App Structure
        return movimentosRaw.map(m => {
            // Determine Type: Receita vs Despesa
            // MF usually has cNatureza ("R" = Receita, "P" = Pagar/Despesa) or cGrupo
            const tipo = (m.detalhes.cNatureza === "R" || m.resumo.cNatureza === "R") ? "RECEITA" : "DESPESA";

            // Determine Value
            // User requested support for "Valor em Aberto", "Valor Liquido".
            // DRE usually based on Accrual (Valor Titulo/Original).
            // Let's use nValTitulo (Original) if available, else nValLiquido.
            // Note: MF structure might have values in 'detalhes' or 'resumo'.
            // Fields mentioned: nValLiquido, nValPago, nValEmAberto.
            // Let's look for nValorTitulo (common in Omie).
            const valor = m.detalhes.nValorTitulo || m.detalhes.nValLiquido || 0;

            // Determine Date (Competence/Registration)
            // User wants "Data de Registro".
            // Fields: dDtInclusao (Registration?), dDtEmissao, dDtPagamento.
            // We'll prioritize dDtInclusao for Competence view.
            const dataRegistro = m.detalhes.dDtInclusao || m.detalhes.dDtEmissao || m.detalhes.dDtPagamento;

            return {
                ...m,
                tipo_movimento: tipo,
                detalhes: {
                    cCodCateg: m.detalhes.cCodCateg,
                    nCodProjeto: m.detalhes.nCodProjeto,
                    nValorTitulo: valor,
                    dDtRegistro: dataRegistro,
                    cObservacao: m.detalhes.cObs || m.detalhes.cObservacao,
                    cNumDoc: m.detalhes.cNumero || m.detalhes.cNumDoc,
                    nCodCliente: m.detalhes.nCodCliente || m.detalhes.nCodCli
                }
            };
        });
    }

    // Helper: Generic Pagination Loop
    async _fetchAllPages(url, callName, resultKey, dIni, dFim, extraParams = {}) {
        let pagina = 1;
        const allItems = [];

        while (true) {
            // Default params (Base)
            let param = {};

            if (callName === "ListarMovimentos") {
                param.nPagina = pagina;
                param.nRegPorPagina = 500;
            } else {
                // Legacy / Default (CP, CR, Categorias, etc)
                param.pagina = pagina;
                param.registros_por_pagina = 500;
            }

            // Merge Specific params
            if (Object.keys(extraParams).length > 0) {
                param = { ...param, ...extraParams };
            } else {
                // Fallback for Legacy CP/CR calls (if any remain, though we replaced listMovimentos)
                // We keep this for safety if we revert or use other methods
                param.filtrar_por_registro_de = dIni;
                param.filtrar_por_registro_ate = dFim;
                param.apenas_importado_api = "N";
            }

            // CP/CR use specific request keys. 
            // However, Omie JSON often wraps the request object. 
            // My callApi logic creates { call:..., param: [...] }.
            // The inner object inside param array usually matches the documentation request object name 
            // e.g. "lcpListarRequest". 
            // BUT, for simple JSON-RPC, passing the flat object often works or 
            // we wrap it if callApi doesn't handled it. 
            // Current callApi wraps `param` in an array: `param: [param_obj]`.
            // Documentation implies the parameter name IS `lcpListarRequest`? No, that's just the type.
            // Actually, for ListarContasPagar, usually you send the object properties directly inside the first param element.
            // Let's trust standard Omie behavior (flat object inside the array).

            try {
                const result = await this.callApi(url, callName, param);

                if (result[resultKey]) {
                    allItems.push(...result[resultKey]);
                }

                // Determine Total Pages
                // CP/CR: result.total_de_paginas
                // MF: result.nTotPaginas ? Or result.total_de_paginas?
                // Common Omie pattern: total_de_paginas OR nTotPaginas.
                const totalPaginas = result.total_de_paginas || result.nTotPaginas || 1;

                if (pagina >= totalPaginas) break;

                // Safety break
                if (pagina > 200) break;

                pagina++;

                // Update param for next loop
                if (param.nPagina) param.nPagina = pagina;
                if (param.pagina) param.pagina = pagina;

            } catch (e) {
                console.error(`Erro buscando pagina ${pagina} de ${callName}:`, e);
                // Alert user on first page error (critical)
                if (pagina === 1) {
                    alert(`Erro ao buscar dados do Omie (${callName}):\n${e.message || e}`);
                }
                break; // Stop on error to avoid infinite loops
            }
        }
        return allItems;
    }

    // --- Data Transformation ---

    async syncData(dRegInicial, dRegFinal, onProgress) {
        if (onProgress) onProgress("Buscando Categorias e Projetos...");

        // 1. Fetch Mappings
        const [catMap, projMap] = await Promise.all([
            this.listCategories(),
            this.listProjects()
        ]);

        if (onProgress) onProgress("Buscando Movimentos Financeiros...");

        // 2. Fetch Transactions
        const movimentos = await this.listMovimentos(dRegInicial, dRegFinal);

        if (onProgress) onProgress(`Processando ${movimentos.length} movimentos...`);

        // 3. Transform to App Format (Pivoted by Month)
        // Structure: { Projeto, Categoria, Empresa, "Jan/24": val, "Fev/24": val ... }

        const pivotedMap = {}; // Key: "Empresa|Projeto|Categoria"

        movimentos.forEach(mov => {
            const det = mov.detalhes;
            const res = mov.resumo;

            // Map Fields
            const catNome = catMap[det.cCodCateg] || det.cCodCateg || "Sem Categoria";
            const projNome = projMap[det.nCodProjeto] || (det.nCodProjeto ? `Proj-${det.nCodProjeto}` : "Sem Projeto");
            const empresa = this.empresaNome; // Default or derived

            // Value
            // Which value? nValLiquido (paid) or nValorTitulo (nominal)? 
            // DRE usually operates on Competency (Accrual) -> nValorTitulo is often the accrued value.
            // If Cash flow -> nValPago.
            // Let's use nValorTitulo for Accrual view (DRE standard).
            const valor = det.nValorTitulo;

            // Date mapping for columns
            // Use dDtRegistro (Competency proxy per user request) or dDtPrevisao? 
            // User asked: "ter filtros por competência (data de registro)". 
            // So we use dDtRegistro.
            const dataRef = det.dDtRegistro; // "DD/MM/YYYY"

            // Handle Departments?
            // The current app doesn't seem to split by Department in the CSV structure heavily, 
            // unless 'Projeto' in CSV is actually used for 'Centro de Custo'.
            // For now, we aggregate by Project/Category. 
            // (If Department is needed, we'd need to check mov.departamentos and split the value).

            // Department Split Logic (if existing)
            if (mov.departamentos && mov.departamentos.length > 0) {
                mov.departamentos.forEach(dept => {
                    // Calculate split value
                    const splitVal = (dept.nDistrValor > 0) ? dept.nDistrValor : (valor * (dept.nDistrPercentual / 100));

                    // Note: If using Dept, maybe map Dept to "Projeto" or "Categoria"?
                    // Current App uses "Projeto". Omie "Projeto" maps to App "Projeto".
                    // Omie "Departamento" is skipped unless mapped.
                    // Let's stick to simple Project/Category first.
                });
            }

            // Simple Aggregation (ignoring Department split for now to match current CSV logic)
            const uniqueKey = `${empresa}|${projNome}|${catNome}`;

            if (!pivotedMap[uniqueKey]) {
                pivotedMap[uniqueKey] = {
                    Empresa: empresa,
                    Projeto: projNome,
                    Categoria: catNome
                };
            }

            // Column Name: MMM/YY
            if (dataRef) {
                const [day, month, year] = dataRef.split('/');
                const shortYear = year.slice(-2);
                const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                const colName = `${monthNames[parseInt(month) - 1]}/${shortYear}`;

                if (!pivotedMap[uniqueKey][colName]) {
                    pivotedMap[uniqueKey][colName] = 0;
                }

                // Add value (always positive magnitude for DRE logic)
                pivotedMap[uniqueKey][colName] += valor;
            }
        });

        // Return both structures
        return {
            dreData: Object.values(pivotedMap),
            auditData: movimentos.map(m => ({
                Origem: m.tipo_movimento, // DESPESA/RECEITA
                Data: m.detalhes.dDtRegistro,
                Vencimento: m.data_vencimento || m.data_previsao,
                Competencia: m.detalhes.dDtRegistro,
                Valor: m.detalhes.nValorTitulo,
                Categoria: m.detalhes.cCodCateg, // ID
                CategoriaNome: catMap[m.detalhes.cCodCateg] || m.detalhes.cCodCateg,
                Projeto: m.detalhes.nCodProjeto, // ID
                ProjetoNome: projMap[m.detalhes.nCodProjeto] || m.detalhes.nCodProjeto,
                Cliente: m.detalhes.nCodCliente,
                Documento: m.detalhes.cNumDoc,
                Observacao: m.detalhes.cObservacao
            }))
        };
    }
}
