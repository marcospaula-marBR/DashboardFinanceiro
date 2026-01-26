// PeopleBoard JS - CSI MAR BRASIL
const SUPABASE_URL = "https://ngtjhwswbbivqajtpjvg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allEmployees = [];

// Modals
let empModal, aiModal;

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupFilters();
    empModal = new bootstrap.Modal(document.getElementById('employeeModal'));
    aiModal = new bootstrap.Modal(document.getElementById('aiModal'));

    document.getElementById('btnAddEmployee').onclick = () => {
        resetForm();
        document.getElementById('modalTitle').textContent = 'REGISTRAR NOVO OPERAÇÃO';
        empModal.show();
    };

    document.getElementById('btnAnalyzePerson').onclick = analyzeCurrentPerson;
});

async function init() {
    await fetchEmployees();
    renderList();
    updateBrisinhMini();
}

async function fetchEmployees() {
    const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('full_name', { ascending: true });

    if (error) {
        console.error('Error fetching employees:', error);
        return;
    }
    allEmployees = data;
}

function renderList() {
    const list = document.getElementById('employeesList');
    list.innerHTML = '';

    const filtered = applyFilters();

    filtered.forEach(emp => {
        const tr = document.createElement('tr');
        tr.className = 'people-item';
        tr.onclick = () => openProfile(emp.id);

        tr.innerHTML = `
            <td class="fw-bold">${emp.full_name}</td>
            <td><span class="badge ${emp.company === 'MarBR' ? 'bg-warning text-dark' : 'bg-info'}">${emp.company}</span></td>
            <td>${emp.employment_type}</td>
            <td>
                <div class="small fw-bold text-white">${emp.department || '---'}</div>
                <div class="small text-muted">${emp.job_role || '---'}</div>
            </td>
            <td class="fw-bold" style="color: #2ecc71;">${formatCurrency(emp.remuneration)}</td>
            <td>
                <span class="badge ${emp.active ? 'bg-success' : 'bg-danger'}">${emp.active ? 'ATIVO' : 'DESLIGADO'}</span>
            </td>
        `;
        list.appendChild(tr);
    });
}

function applyFilters() {
    const name = document.getElementById('filterName').value.toLowerCase();
    const company = document.getElementById('filterCompany').value;
    const type = document.getElementById('filterType').value;
    const dept = document.getElementById('filterDept').value;

    return allEmployees.filter(emp => {
        const matchesName = emp.full_name.toLowerCase().includes(name) || (emp.document_id && emp.document_id.includes(name));
        const matchesCompany = !company || emp.company === company;
        const matchesType = !type || emp.employment_type === type;
        const matchesDept = !dept || emp.department === dept;
        return matchesName && matchesCompany && matchesType && matchesDept;
    });
}

function setupFilters() {
    ['filterName', 'filterCompany', 'filterType', 'filterDept'].forEach(id => {
        document.getElementById(id).addEventListener('input', renderList);
    });

    // Populate Department Filter
    const depts = [...new Set(allEmployees.map(e => e.department).filter(Boolean))].sort();
    const deptSelect = document.getElementById('filterDept');
    depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        deptSelect.appendChild(opt);
    });
}

async function saveEmployee() {
    const id = document.getElementById('empId').value;
    const payload = {
        full_name: document.getElementById('empName').value,
        company: document.getElementById('empCompany').value,
        employment_type: document.getElementById('empType').value,
        document_id: document.getElementById('empDoc').value,
        pix_key: document.getElementById('empPix').value,
        remuneration: parseFloat(document.getElementById('empRemuneration').value) || 0,
        department: document.getElementById('empDept').value,
        job_role: document.getElementById('empRole').value,
        start_date: document.getElementById('empStart').value || null,
        responsible_name: document.getElementById('empResp').value,
        photo_url: document.getElementById('empPhoto').value,
        active: true
    };

    let result;
    if (id) {
        result = await supabase.from('employees').update(payload).eq('id', id);
    } else {
        result = await supabase.from('employees').insert([payload]);
    }

    if (result.error) {
        alert('ERRO NA TRANSMISSÃO: ' + result.error.message);
    } else {
        empModal.hide();
        await init();
        if (id) {
            // Se estava editando, reabre o perfil atualizado
            openProfile(id);
        }
    }
}

function resetForm() {
    document.getElementById('empId').value = '';
    document.getElementById('employeeForm').reset();
}

function editEmployee() {
    const id = document.getElementById('empId').value || currentProfileId;
    const emp = allEmployees.find(e => e.id === id);
    if (!emp) return;

    document.getElementById('empId').value = emp.id;
    document.getElementById('empName').value = emp.full_name;
    document.getElementById('empCompany').value = emp.company;
    document.getElementById('empType').value = emp.employment_type;
    document.getElementById('empDoc').value = emp.document_id || '';
    document.getElementById('empPix').value = emp.pix_key || '';
    document.getElementById('empRemuneration').value = emp.remuneration;
    document.getElementById('empDept').value = emp.department || '';
    document.getElementById('empRole').value = emp.job_role || '';
    document.getElementById('empStart').value = emp.start_date || '';
    document.getElementById('empResp').value = emp.responsible_name || '';
    document.getElementById('empPhoto').value = emp.photo_url || '';

    document.getElementById('modalTitle').textContent = 'EDITAR CADASTRO :: ' + emp.full_name.toUpperCase();
    closeProfile();
    empModal.show();
}

let currentProfileId = null;

async function openProfile(id) {
    currentProfileId = id;
    const emp = allEmployees.find(e => e.id === id);
    if (!emp) return;

    const overlay = document.getElementById('profileOverlay');
    overlay.style.display = 'flex';

    // CSI Effects: Scramble text animation
    scrambleText('profileName', emp.full_name);
    scrambleText('profileID', emp.id.substring(0, 8).toUpperCase());

    document.getElementById('profilePhoto').src = emp.photo_url || 'https://via.placeholder.com/350?text=NO+IMAGE';
    document.getElementById('profileCompany').textContent = emp.company;
    document.getElementById('profileType').textContent = emp.employment_type;
    document.getElementById('profileDoc').textContent = emp.document_id || '---';
    document.getElementById('profileDept').textContent = emp.department || '---';
    document.getElementById('profileRole').textContent = emp.job_role || '---';
    document.getElementById('profileStart').textContent = formatDate(emp.start_date);
    document.getElementById('profileRemuneration').textContent = formatCurrency(emp.remuneration);
    document.getElementById('profilePix').textContent = emp.pix_key || '---';
    document.getElementById('profileResp').textContent = emp.responsible_name || '---';
    document.getElementById('profileStatus').textContent = emp.active ? 'OPERACIONAL' : 'DESATIVADO';
    document.getElementById('profileCreated').textContent = formatDate(emp.created_at);

    // Salva o ID no hidden do modal por precaução
    document.getElementById('empId').value = id;

    // Fetch history
    const { data: history } = await supabase
        .from('employee_history')
        .select('*')
        .eq('employee_id', id)
        .order('change_date', { ascending: false });

    renderHistory(history);
}

function renderHistory(history) {
    const container = document.getElementById('profileHistory');
    container.innerHTML = '';

    if (!history || history.length === 0) {
        container.innerHTML = '<p class="text-muted small">Nenhum aditivo registrado no sistema.</p>';
        return;
    }

    history.forEach(h => {
        const div = document.createElement('div');
        div.className = 'hud-panel mb-2 p-2';
        div.style.borderColor = 'rgba(255,255,255,0.1)';
        div.innerHTML = `
            <div class="d-flex justify-content-between">
                <span class="fw-bold text-info">${formatDate(h.change_date)}</span>
                <span class="badge bg-secondary">${h.event_type}</span>
            </div>
            <div class="small mt-1">
                ${h.new_role ? `Nova Função: <span class="text-white">${h.new_role}</span><br>` : ''}
                ${h.new_salary ? `Nova Remuneração: <span class="text-success">${formatCurrency(h.new_salary)}</span><br>` : ''}
                <span class="text-muted">${h.observations || ''}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

function closeProfile() {
    document.getElementById('profileOverlay').style.display = 'none';
}

async function addHistory() {
    const eventType = prompt("Tipo de Evento (Ex: Aumento Salarial, Promoção, Mudança de Setor):");
    if (!eventType) return;

    const valStr = prompt("Novo Valor Salarial (Deixe em branco se não houver mudança):");
    const role = prompt("Nova Função (Deixe em branco se não houver mudança):");
    const obs = prompt("Observações adicionais:");

    const payload = {
        employee_id: currentProfileId,
        change_date: new Date().toISOString().split('T')[0],
        event_type: eventType,
        new_salary: valStr ? parseFloat(valStr) : null,
        new_role: role || null,
        observations: obs || null
    };

    const { error } = await supabase.from('employee_history').insert([payload]);
    if (error) {
        alert('Erro ao registrar histórico: ' + error.message);
    } else {
        // Se houve mudança de salário ou cargo, atualiza o cadastro principal também
        if (payload.new_salary || payload.new_role) {
            const updateObj = {};
            if (payload.new_salary) updateObj.remuneration = payload.new_salary;
            if (payload.new_role) updateObj.job_role = payload.new_role;
            await supabase.from('employees').update(updateObj).eq('id', currentProfileId);
        }
        await init();
        openProfile(currentProfileId);
    }
}

async function analyzeCurrentPerson() {
    const emp = allEmployees.find(e => e.id === currentProfileId);
    if (!emp) return;

    aiModal.show();
    const responseEl = document.getElementById('aiResponse');
    responseEl.innerHTML = "Escaneando perfil analítico...<br>Cruzando dados com métricas da empresa...";

    // Simulação de análise BrisinhAI - Em um cenário real, chamaria a API do Gemini
    setTimeout(() => {
        const tempoCasa = Math.floor((new Date() - new Date(emp.start_date)) / (1000 * 60 * 60 * 24 * 365));
        const statusSalarial = emp.remuneration > 5000 ? "Acima da média setorial" : "Dentro da curva padrão";

        responseEl.innerHTML = `
            <div style="color: var(--secondary);">>>> PROTOCOLO DE ANÁLISE CONCLUÍDO</div>
            <br>
            <strong>ALVO:</strong> ${emp.full_name}<br>
            <strong>TEMPO DE ATIVAÇÃO:</strong> ${tempoCasa} anos de serviço.<br>
            <strong>MÉTRICA SALARIAL:</strong> ${statusSalarial}.<br>
            <br>
            <strong>INSIGHT ESTRATÉGICO:</strong><br>
            - Colaborador possui estabilidade no setor ${emp.department}.<br>
            - Recomendado verificar histórico de aditivos para avaliar curva de crescimento.<br>
            - Perfil ${emp.employment_type} com documentação ${emp.document_id ? 'VALIDADA' : 'PENDENTE'}.
            <br><br>
            <span style="opacity: 0.5;">Fim da transmissão.</span>
        `;
    }, 1500);
}

// Utils
function formatCurrency(val) {
    if (!val) return 'R$ 0,00';
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr) {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
}

// CSI Style Text Scramble
function scrambleText(id, finalValue) {
    const el = document.getElementById(id);
    const chars = "!<>-_\\/[]{}—=+*^?#________";
    let iterations = 0;

    const interval = setInterval(() => {
        el.innerText = finalValue.split("")
            .map((char, index) => {
                if (index < iterations) return finalValue[index];
                return chars[Math.floor(Math.random() * chars.length)];
            })
            .join("");

        if (iterations >= finalValue.length) clearInterval(interval);
        iterations += 1 / 3;
    }, 30);
}

function updateBrisinhMini() {
    const mini = document.getElementById('brisinhai-mini');
    if (allEmployees.length === 0) return;

    const oldest = allEmployees.reduce((prev, curr) => (new Date(prev.start_date) < new Date(curr.start_date) ? prev : curr));
    const highest = allEmployees.reduce((prev, curr) => (prev.remuneration > curr.remuneration ? prev : curr));

    mini.innerHTML = `
        <i class="bi bi-robot me-2" style="color: var(--secondary);"></i>
        <strong>RECONHECIMENTO ADM:</strong><br>
        Antiguidade: ${oldest.full_name} (${formatDate(oldest.start_date)})<br>
        Pico Salarial: ${highest.full_name} (${formatCurrency(highest.remuneration)})
    `;
}

// Exportações Globais para HTML
window.saveEmployee = saveEmployee;
window.editEmployee = editEmployee;
window.addHistory = addHistory;
window.closeProfile = closeProfile;
window.analyzeCurrentPerson = analyzeCurrentPerson;

