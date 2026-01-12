
document.addEventListener('DOMContentLoaded', () => {
    // Inject HTML Structure
    const root = document.createElement('div');
    root.id = 'brisinhai-root';
    root.innerHTML = `
        <!-- Floating Button -->
        <div class="brisinhai-float" id="brisinhaiBtn" title="Falar com BrisinhAI">
            <img src="BrisinhAI.jpeg" alt="BrisinhAI">
        </div>

        <!-- Chat Window -->
        <div class="brisinhai-chat-window" id="brisinhaiChat">
            <div class="brisinhai-header">
                <h3><i class="bi bi-robot"></i> BrisinhAI</h3>
                <button class="brisinhai-close" id="brisinhaiClose"><i class="bi bi-x"></i></button>
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
                <input type="text" class="brisinhai-input" id="brisinhaiInput" placeholder="Faça uma pergunta sobre os dados..." onkeypress="handleEnter(event)">
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
    const messages = document.getElementById('brisinhaiMessages');
    const input = document.getElementById('brisinhaiInput');

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

    // Helper: Gather Context
    function getDashboardContext() {
        const context = {
            filtros: {},
            indicadores: []
        };

        // Get Filters
        context.filtros.periodo = getSelectedValues('filterPeriodo');
        context.filtros.empresa = getSelectedValues('filterEmpresa');

        // Get Cards Data (Support for both .indicator-card and .metric-card)
        const cards = [];
        document.querySelectorAll('.indicator-card, .metric-card').forEach(card => {
            let title, value, subtitle;

            if (card.classList.contains('indicator-card')) {
                // Indicadores V2 Structure
                title = card.querySelector('.card-title')?.innerText;
                value = card.querySelector('.display-5')?.innerText;
                subtitle = card.querySelector('.text-muted:not(.card-title)')?.innerText;
            } else {
                // Index & Analise Setorial Structure (.metric-card)
                title = card.querySelector('.title')?.innerText;
                value = card.querySelector('.value')?.innerText;
                subtitle = card.querySelector('.small.text-muted, .sub')?.innerText;

                // Handle Breakdown Items (if present)
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
                    indicador: title || "Sem Título",
                    valor: value || "-",
                    detalhe: subtitle || ""
                });
            }
        });

        // Get Last Update
        const update = document.getElementById('lastUpdate')?.innerText;
        if (update) context.update = update;

        // Get CSV Data from Global State (if available)
        // script.js, script_v2.js, analise-setorial.js all use 'state' variable
        if (typeof state !== 'undefined' && state) {
            // Prefer filteredData if available (respects user filters), else rawData or processedData
            const data = state.filteredData || state.processedData || state.rawData;
            if (data && data.length > 0) {
                // Limit data size to avoid token overflow? 
                // For now, let's send it. If it's huge, we might need a summary strategy later.
                // Converting to a simplified JSON string
                // Limit to first 500 rows to be safe if massive? Or send all?
                // DRE usually has < 1000 rows.
                context.csvData = data.slice(0, 1000);
                context.dataInfo = `Exibindo ${context.csvData.length} linhas de dados brutos.`;
            }
        }

        return context;
    }

    function getSelectedValues(id) {
        const select = document.getElementById(id);
        if (!select) return "Todos";
        const selected = Array.from(select.selectedOptions).map(o => o.value);
        return selected.length > 0 ? selected.join(", ") : "Todos";
    }

    // Send Message Logic
    window.sendMessage = async function () {
        const text = input.value.trim();
        if (!text) return;

        if (!aiService.isAuthenticated()) {
            addMessage('bot', "⚠️ Configure a API Key no arquivo <code>ai.service.v2.js</code>");
            return;
        }

        // User Message
        addMessage('user', text);
        input.value = '';

        // Context
        const context = getDashboardContext();

        if (context.indicadores.length === 0) {
            addMessage('bot', "Não encontrei dados na tela. Por favor, carregue um arquivo CSV primeiro.");
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

        try {
            const response = await aiService.generateAnalysis(context, text);
            document.getElementById(loadingId).remove();
            addMessage('bot', response);
        } catch (error) {
            document.getElementById(loadingId).remove();
            addMessage('bot', `❌ Erro: ${error.message}`);
        }
    }

    window.handleEnter = function (e) {
        if (e.key === 'Enter') sendMessage();
    }
});
