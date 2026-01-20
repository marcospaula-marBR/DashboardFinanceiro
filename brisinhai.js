
document.addEventListener('DOMContentLoaded', () => {
    // Inject HTML Structure
    const root = document.createElement('div');
    root.id = 'brisinhai-root';
    root.innerHTML = `
        <!-- Floating Button -->
        <div class="brisinhai-float" id="brisinhaiBtn" title="Falar com BrisinhAI">
            <img src="BrisinhAI.jpeg" alt="BrisinhAI">
        </div>

            .brisinhai-chat-window {
                position: fixed;
                bottom: 100px;
                right: 30px;
                width: 450px;
                height: 650px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                display: flex;
                flex-direction: column;
                z-index: 9999;
                opacity: 0;
                pointer-events: none;
                transform: translateY(20px);
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                overflow: hidden;
                border: 1px solid rgba(0,0,0,0.1);
            }

            .brisinhai-chat-window.active {
                opacity: 1;
                pointer-events: all;
                transform: translateY(0);
            }

            .brisinhai-chat-window.minimized {
                height: 50px !important;
                min-height: 50px !important;
                overflow: hidden;
                resize: none !important;
            }

            /* Resize handle */
            .brisinhai-resize-handle {
                position: absolute;
                top: 0;
                left: 0;
                width: 15px;
                height: 15px;
                cursor: nwse-resize;
                z-index: 10001;
            }
            .brisinhai-chat-window.minimized .brisinhai-messages,
            .brisinhai-chat-window.minimized .brisinhai-input-area {
                display: none;
            }
            .brisinhai-header {
                cursor: pointer;
            }
            /* Voice Control Styles */
            .brisinhai-mic-btn {
                background: none;
                border: none;
                color: #6c757d;
                cursor: pointer;
                padding: 5px;
                transition: color 0.3s;
            }
            .brisinhai-mic-btn:hover {
                color: #0d6efd;
            }
            .brisinhai-mic-btn.listening {
                color: #dc3545;
                animation: pulse 1.5s infinite;
            }
            .brisinhai-voice-toggle {
                background: none;
                border: none;
                color: white;
                opacity: 0.8;
                cursor: pointer;
                transition: opacity 0.3s;
            }
            .brisinhai-voice-toggle:hover {
                opacity: 1;
            }
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }
        </style>

        <!-- Chat Window -->
        <div class="brisinhai-chat-window" id="brisinhaiChat">
            <div class="brisinhai-resize-handle"></div>
            <div class="brisinhai-header">
                <h3><i class="bi bi-robot"></i> BrisinhAI</h3>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <button class="brisinhai-voice-toggle me-2" id="brisinhaiVoiceToggle" title="Ativar/Desativar Voz">
                        <i class="bi bi-volume-up-fill"></i>
                    </button>
                    <button class="brisinhai-close" id="brisinhaiMinimize" title="Minimizar"><i class="bi bi-dash-lg"></i></button>
                    <button class="brisinhai-close" id="brisinhaiClose" title="Fechar"><i class="bi bi-x-lg"></i></button>
                </div>
            </div>
            
            <div class="brisinhai-messages" id="brisinhaiMessages">
                <!-- Messages go here -->
                <div class="message bot">
                    Olá! Sou o BrisinhAI 🤖<br>
                    Estou aqui para analisar os indicadores financeiros da Mar Brasil.<br>
                    <strong>Posso fazer uma análise completa ou responder suas dúvidas!</strong>
                </div>
            </div>

            <div class="brisinhai-input-area">
                <button class="brisinhai-mic-btn" id="brisinhaiMic" title="Falar">
                    <i class="bi bi-mic-fill"></i>
                </button>
                <input type="text" class="brisinhai-input" id="brisinhaiInput" placeholder="Digite ou fale..." onkeypress="handleEnter(event)">
                <button class="brisinhai-send-btn d-none" id="brisinhaiStop" title="Parar" style="background-color: #dc3545;">
                    <i class="bi bi-stop-circle-fill"></i>
                </button>
                <button class="brisinhai-send-btn" id="brisinhaiSend" onclick="sendMessage()">
                    <i class="bi bi-send-fill"></i>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    // Initialize Service
    const aiService = new GeminiService();

    // Elements
    const btn = document.getElementById('brisinhaiBtn');
    const chat = document.getElementById('brisinhaiChat');
    const close = document.getElementById('brisinhaiClose');
    const minimize = document.getElementById('brisinhaiMinimize');
    const messages = document.getElementById('brisinhaiMessages');
    const input = document.getElementById('brisinhaiInput');
    const stopBtn = document.getElementById('brisinhaiStop');
    const sendBtn = document.getElementById('brisinhaiSend');
    const micBtn = document.getElementById('brisinhaiMic');
    const voiceToggleBtn = document.getElementById('brisinhaiVoiceToggle');

    // Voice State
    let isVoiceEnabled = true; // Default to on
    let recognition = null;
    let isListening = false;

    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'pt-BR';

        recognition.onstart = function () {
            isListening = true;
            micBtn.classList.add('listening');
            input.placeholder = "Ouvindo...";
        };

        recognition.onend = function () {
            isListening = false;
            micBtn.classList.remove('listening');
            input.placeholder = "Digite ou fale...";
        };

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            input.value = transcript;
            // Optional: Auto-send after voice? 
            // For now, let user confirm by clicking send or pressing enter
            // But usually voice assistants auto-submit. Let's auto-submit for better UX.
            setTimeout(() => sendMessage(), 500);
        };

        recognition.onerror = function (event) {
            console.error("Erro no reconhecimento de voz:", event.error);
            isListening = false;
            micBtn.classList.remove('listening');
            input.placeholder = "Erro no microfone. Tente digitar.";
        };
    } else {
        micBtn.style.display = 'none'; // Hide if not supported
        console.warn("Web Speech API não suportada neste navegador.");
    }

    // Mic Button Click
    micBtn.addEventListener('click', () => {
        if (!recognition) return;
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    // Voice Toggle Click
    voiceToggleBtn.addEventListener('click', () => {
        isVoiceEnabled = !isVoiceEnabled;
        updateVoiceIcon();
        if (!isVoiceEnabled) {
            window.speechSynthesis.cancel(); // Stop talking if muted
        }
    });

    function updateVoiceIcon() {
        const icon = voiceToggleBtn.querySelector('i');
        if (isVoiceEnabled) {
            icon.classList.remove('bi-volume-mute-fill');
            icon.classList.add('bi-volume-up-fill');
            voiceToggleBtn.title = "Desativar Voz";
        } else {
            icon.classList.remove('bi-volume-up-fill');
            icon.classList.add('bi-volume-mute-fill');
            voiceToggleBtn.title = "Ativar Voz";
        }
    }

    // Text-to-Speech Helper
    function speakText(text) {
        if (!isVoiceEnabled) return;

        // Cancel previous speech
        window.speechSynthesis.cancel();

        // Strip HTML tags for clean reading
        const cleanText = text.replace(/<[^>]*>/g, '').replace(/[*_#]/g, ''); // Simple strip

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.1; // Slightly faster
        utterance.pitch = 1;

        window.speechSynthesis.speak(utterance);
    }

    // Toggle Chat
    btn.addEventListener('click', () => {
        chat.classList.add('active');
        if (!aiService.isAuthenticated()) {
            addMessage("bot", "⚠️ <strong>Configuração Necessária</strong><br>A chave da API não foi inserida no código. Por favor, edite o arquivo <code>ai.service.v2.js</code> e coloque sua chave.");
        }
    });

    close.addEventListener('click', () => {
        chat.classList.remove('active');
    });

    minimize.addEventListener('click', (e) => {
        e.stopPropagation();
        chat.classList.toggle('minimized');
        const icon = minimize.querySelector('i');
        if (chat.classList.contains('minimized')) {
            icon.classList.remove('bi-dash-lg');
            icon.classList.add('bi-square'); // Restore icon
        } else {
            icon.classList.remove('bi-square');
            icon.classList.add('bi-dash-lg');
        }
    });

    // Maximize on header click if minimized
    document.querySelector('.brisinhai-header').addEventListener('click', (e) => {
        if (chat.classList.contains('minimized') && !e.target.closest('button')) {
            chat.classList.remove('minimized');
            minimize.querySelector('i').classList.replace('bi-square', 'bi-dash-lg');
        }
    });

    // Helper: Add Message
    window.addMessage = function (type, text) {
        const div = document.createElement('div');
        div.className = `message ${type}`;

        // Simple Markdown parsing
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/- (.*?)(<br>|$)/g, '<ul><li>$1</li></ul>');

        // Merge adjacent lists
        html = html.replace(/<\/ul><br><ul>/g, '');

        div.innerHTML = html;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    // Resizing Logic
    let isResizing = false;
    const resizeHandle = document.querySelector('.brisinhai-resize-handle');

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'nwse-resize';
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const rect = chat.getBoundingClientRect();
        const newWidth = rect.right - e.clientX;
        const newHeight = rect.bottom - e.clientY;

        if (newWidth > 300) chat.style.width = newWidth + 'px';
        if (newHeight > 200) chat.style.height = newHeight + 'px';
    });

    window.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = 'default';
    });

    // Helper: Gather Context
    function getDashboardContext() {
        const context = {
            url: window.location.pathname,
            pageType: 'unknown',
            filtros: {},
            indicadores: [],
            resumo: {}
        };

        // 1. Detect Page Type
        if (document.getElementById('dreTable')) context.pageType = 'DRE';
        else if (document.getElementById('indicatorsContainer')) context.pageType = 'INDICADORES';
        else if (document.getElementById('segurosGrid')) context.pageType = 'SEGUROS';
        else if (document.getElementById('parcelasTable')) context.pageType = 'PARCELAMENTOS';
        else if (document.getElementById('dataTable') && document.querySelector('h1')?.innerText.includes('Setorial')) context.pageType = 'SETORIAL';

        // 2. Get Filters (Common to all)
        context.filtros.periodo = getSelectedValues('filterPeriodo');
        context.filtros.empresa = getSelectedValues('filterEmpresa');

        // Other filters based on page
        if (document.getElementById('filterCategoria')) context.filtros.categoria = getSelectedValues('filterCategoria');
        if (document.getElementById('filterProjeto')) context.filtros.projeto = getSelectedValues('filterProjeto');

        // 3. Gather Page-Specific Data
        gatherPageSpecificData(context);

        // 4. Get Cards Data (Generic Fallback + Specifics)
        document.querySelectorAll('.indicator-card, .metric-card, #kpiRow .card, .kpi-card').forEach(card => {
            let title, value, subtitle;

            if (card.classList.contains('indicator-card')) {
                title = card.querySelector('.card-title')?.innerText;
                value = card.querySelector('.display-5')?.innerText;
                subtitle = card.querySelector('.text-muted:not(.card-title)')?.innerText;
            } else {
                title = card.querySelector('.title')?.innerText;
                value = card.querySelector('.value')?.innerText;
                subtitle = card.querySelector('.small.text-muted, .sub')?.innerText;

                // Extra info in breakdown items
                const breakdownItems = card.querySelectorAll('.breakdown-item');
                if (breakdownItems.length > 0) {
                    const details = [];
                    breakdownItems.forEach(item => {
                        const l = item.querySelector('.breakdown-label')?.innerText;
                        const v = item.querySelector('.breakdown-value')?.innerText;
                        if (l && v) details.push(`${l}: ${v}`);
                    });
                    if (details.length > 0) subtitle = (subtitle ? subtitle + ". " : "") + details.join(", ");
                }
            }

            if (title || value) {
                context.indicadores.push({
                    indicador: title?.trim() || "Sem Título",
                    valor: value?.trim() || "-",
                    detalhe: subtitle?.trim() || ""
                });
            }
        });

        // 5. Get Last Update
        const update = document.getElementById('lastUpdate')?.innerText;
        if (update) context.update = update;

        if (update) context.update = update;

        // 6. Global CSV Data (Added for deeper analysis)
        if (typeof window.FULL_CSV_DATA !== 'undefined' && window.FULL_CSV_DATA.length > 0) {
            context.csvData = window.FULL_CSV_DATA;
            context.dataSummary = `Total de registros carregados: ${window.FULL_CSV_DATA.length}.`;
        }

        // 7. CSV Data Summary (Legacy/Fallback)
        if (typeof state !== 'undefined' && state && state.filteredData) {
            // Provide a summary of the data instead of raw rows if possible
            context.dataSummary = `Total de registros filtrados: ${state.filteredData.length}.`;
            // For DRE, maybe send the calculated DRE structure instead of raw CSV
            if (context.pageType === 'DRE' && state.dreData) {
                // dreData usually sits in UI, let's grab from table if state isn't populated with final DRE rows
            }
        }

        return context;
    }

    function gatherPageSpecificData(context) {
        switch (context.pageType) {
            case 'DRE':
                // Scrape the main DRE table for high-level structure
                const drePixel = {};
                document.querySelectorAll('#dreTable tbody tr').forEach(tr => {
                    const label = tr.querySelector('td:first-child')?.innerText?.trim();
                    const val = tr.querySelector('.fw-bold')?.innerText?.trim(); // Assuming bold is the total column
                    if (label && val) drePixel[label] = val;
                });
                context.resumo.dre = drePixel;
                break;

            case 'PARCELAMENTOS':
                // Scrape KPI cards specifically if not covered by generic scraper
                context.resumo.dividaTotal = document.querySelector('#evolutionChart')?.parentElement?.parentElement?.parentElement?.querySelector('.value')?.innerText;
                break;

            case 'SEGUROS':
                // Any specific grid data?
                // Maybe list top 5 insurances
                break;
        }
    }

    function getSelectedValues(id) {
        const select = document.getElementById(id);
        if (!select) return "Todos";
        const selected = Array.from(select.selectedOptions).map(o => o.value);
        return selected.length > 0 ? selected.join(", ") : "Todos";
    }

    let currentController = null;

    // Send Message Logic
    window.sendMessage = async function () {
        const text = input.value.trim();
        if (!text) return;

        if (!aiService.isAuthenticated()) {
            addMessage('bot', "⚠️ Configure a API Key no arquivo <code>ai.service.v2.js</code>");
            return;
        }

        // Check if there is an active request
        if (currentController) {
            currentController.abort();
            currentController = null;
        }
        currentController = new AbortController();

        // User Message
        addMessage('user', text);
        input.value = '';

        // Context
        const context = getDashboardContext();

        if (context.indicadores.length === 0 && (!context.csvData || context.csvData.length === 0)) {
            addMessage('bot', "Não encontrei dados na tela. Por favor, carregue um arquivo CSV primeiro.");
            currentController = null;
            return;
        }

        // Loading
        const loadingId = 'loading-' + Date.now();
        const loadingDiv = document.createElement('div');
        loadingDiv.id = loadingId;
        loadingDiv.className = 'message bot typing-dots';
        loadingDiv.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
        messages.appendChild(loadingDiv);
        messages.scrollTop = messages.scrollHeight;

        // UI State: Show Stop, Hide Send
        stopBtn.classList.remove('d-none');
        sendBtn.classList.add('d-none');

        try {
            const response = await aiService.generateAnalysis(context, text, currentController.signal);

            // If we are here, it wasn't aborted
            const loader = document.getElementById(loadingId);
            if (loader) loader.remove();

            addMessage('bot', response);
            speakText(response); // Speak the response
        } catch (error) {
            const loader = document.getElementById(loadingId);
            if (loader) loader.remove();

            if (error.name === 'AbortError' || (error.code === 20 && error.name === 'ABORT_ERR')) {
                // Quietly handle abort or show a small note
                // addMessage('bot', '<em>Parado pelo usuário.</em>'); 
            } else {
                addMessage('bot', `❌ Erro: ${error.message}`);
            }
        } finally {
            // Reset UI
            stopBtn.classList.add('d-none');
            sendBtn.classList.remove('d-none');
            currentController = null;
        }
    }

    // Stop Button Listener
    stopBtn.addEventListener('click', () => {
        if (currentController) {
            currentController.abort();
            currentController = null;
        }
    });

    // Exposed API for PDF Generation
    window.getBrisinhAIAnalysis = async function () {
        if (!aiService.isAuthenticated()) return "Erro: API Key não configurada.";

        const context = getDashboardContext();
        // Force a specific prompt for the report
        try {
            const analysis = await aiService.generateAnalysis(context, "Gere um relatório formal e completo para exportação em PDF, focado em insights estratégicos.");
            return analysis;
        } catch (error) {
            console.error("Erro ao gerar análise para PDF:", error);
            return "Não foi possível gerar a análise automática neste momento.";
        }
    };

    window.handleEnter = function (e) {
        if (e.key === 'Enter') sendMessage();
    }
});
