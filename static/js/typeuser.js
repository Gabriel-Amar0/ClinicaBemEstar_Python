document.addEventListener('DOMContentLoaded', () => {
    // =========================================================
    // 0. UTILITÁRIOS GLOBAIS (TOAST)
    // =========================================================
    const toastEl = document.getElementById('toastAviso') || document.getElementById('toastSuccess'); 
    let toastInstance = null;
    let toastBody = document.getElementById('toast-msg') || document.getElementById('toastMessage');

    if (toastEl) {
        toastInstance = new bootstrap.Toast(toastEl);
    }

    function mostrarNotificacao(mensagem, tipo = 'success') {
        if (!toastInstance) {
            if (tipo === 'error' || tipo === 'warning') alert(mensagem);
            return;
        }
        if (toastBody) toastBody.innerText = mensagem;
        toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'text-bg-success', 'text-bg-danger', 'text-bg-warning');
        if (tipo === 'success') toastEl.classList.add('bg-success', 'text-white');
        if (tipo === 'error' || tipo === 'danger') toastEl.classList.add('bg-danger', 'text-white');
        if (tipo === 'warning') toastEl.classList.add('bg-warning', 'text-dark');
        toastInstance.show();
    }

    // =========================================================
    // 0.1 MÁSCARAS DE INPUT (CPF E TELEFONE) - NOVO!
    // =========================================================
    function aplicarMascaraCPF(input) {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, ""); // Remove tudo que não é dígito
            if (v.length > 11) v = v.slice(0, 11); // Limita a 11 números

            // Coloca ponto e traço
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");

            e.target.value = v;
        });
    }

    function aplicarMascaraTelefone(input) {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 11) v = v.slice(0, 11); // Limita tamanho

            // Coloca parênteses e traço
            v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
            v = v.replace(/(\d)(\d{4})$/, "$1-$2");

            e.target.value = v;
        });
    }

    // Aplica as máscaras nos campos existentes
    const inputsCPF = document.querySelectorAll('#paciente-cpf, #edit-paciente-cpf, #form-paciente-busca'); // Adicione IDs se tiver outros
    inputsCPF.forEach(el => aplicarMascaraCPF(el));

    const inputsTel = document.querySelectorAll('#paciente-telefone, #edit-paciente-telefone');
    inputsTel.forEach(el => aplicarMascaraTelefone(el));


    // =========================================================
    // 1. TELA DE LOGIN
    // =========================================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const roleAtendente = document.getElementById('roleAtendente');
        const roleMedico = document.getElementById('roleMedico');
        let userRole = '';

        if (roleAtendente && roleMedico) {
            roleAtendente.addEventListener('click', () => {
                userRole = 'Atendente';
                roleAtendente.classList.add('active-role', 'bg-primary', 'text-white', 'border-primary');
                roleAtendente.classList.remove('bg-light', 'text-dark');
                roleMedico.classList.remove('active-role', 'bg-primary', 'text-white', 'border-primary');
                roleMedico.classList.add('bg-light', 'text-dark');
            });
            roleMedico.addEventListener('click', () => {
                userRole = 'Medico';
                roleMedico.classList.add('active-role', 'bg-primary', 'text-white', 'border-primary');
                roleMedico.classList.remove('bg-light', 'text-dark');
                roleAtendente.classList.remove('active-role', 'bg-primary', 'text-white', 'border-primary');
                roleAtendente.classList.add('bg-light', 'text-dark');
            });
        }
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const senha = document.getElementById('senha').value.trim();
            if (!userRole) { alert('Selecione se você é Médico ou Atendente!'); return; }
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({role: userRole, email, senha})
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || 'Erro ao logar');
                window.location.href = json.redirect;
            } catch (err) { console.error(err); alert(err.message); }
        });
        return; 
    }

    // =========================================================
    // 2. PAINEL DO ATENDENTE
    // =========================================================
    const abas = document.querySelectorAll('.nav-link');
    if (abas.length === 0) return; 

    const secoes = document.querySelectorAll('.conteudo-secao');
    const modalEditar = document.getElementById('modalEditar') ? new bootstrap.Modal(document.getElementById('modalEditar')) : null;
    const formEditar = document.getElementById('formEditar');
    const modalEditarPaciente = document.getElementById('modalEditarPaciente') ? new bootstrap.Modal(document.getElementById('modalEditarPaciente')) : null;
    const formEditarPaciente = document.getElementById('formEditarPaciente');

    let consultasCache = [];
    let pacientesCache = [];
    const itensPorPagina = 5;
    let consultasFiltradas = [];
    let paginaAtualConsultas = 1;
    let pacientesFiltrados = [];
    let paginaAtualPacientes = 1;

    // NAV
    abas.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            abas.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            secoes.forEach(sec => sec.classList.add('escondido'));
            const idAlvo = tab.getAttribute('data-aba');
            const alvo = document.getElementById(idAlvo);
            if(alvo) alvo.classList.remove('escondido');
            if (idAlvo === 'consultas') loadConsultas();
            if (idAlvo === 'listar-pacientes') loadPacientesLista();
            if (idAlvo === 'agendar') carregarSelectPacientes(); 
        });
    });

    // API
    async function fetchPacientes() {
        try {
            const res = await fetch('/api/pacientes');
            pacientesCache = await res.json();
            return pacientesCache;
        } catch (err) { console.error(err); return []; }
    }
    async function carregarSelectPacientes() {
        await fetchPacientes();
        const select = document.getElementById('form-paciente');
        if(!select) return;
        select.innerHTML = '<option value="" selected disabled>Selecione</option>';
        pacientesCache.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.cpf; 
            opt.textContent = `${p.nome} (CPF: ${p.cpf})`;
            select.appendChild(opt);
        });
    }

    // CADASTROS
    const formCadastro = document.getElementById('formCadastro');
    if(formCadastro) {
        formCadastro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const paciente = {
                nome: document.getElementById('paciente-nome').value,
                cpf: document.getElementById('paciente-cpf').value,
                nascimento: document.getElementById('paciente-nascimento').value,
                telefone: document.getElementById('paciente-telefone').value,
                endereco: document.getElementById('paciente-endereco').value,
                peso: document.getElementById('paciente-peso').value,
                altura: document.getElementById('paciente-altura').value
            };
            try {
                const res = await fetch('/api/pacientes', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(paciente)
                });
                if(res.ok) { mostrarNotificacao('Paciente cadastrado!'); formCadastro.reset(); fetchPacientes(); } 
                else { const erro = await res.json(); mostrarNotificacao(erro.message || 'Erro.', 'error'); }
            } catch(err) { console.error(err); }
        });
    }

    const formAgendar = document.getElementById('formAgendar');
    if(formAgendar) {
        formAgendar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const consulta = {
                cpf: document.getElementById('form-paciente').value,
                medico_id: document.getElementById('form-medico').value,
                datahora: document.getElementById('form-datahora').value,
                pagamento: document.getElementById('form-pagamento').value,
                observacoes: document.getElementById('form-obs').value,
                status: 'Agendado'
            };
            try {
                const res = await fetch('/api/consultas', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(consulta)
                });
                const data = await res.json();
                if(res.ok) { mostrarNotificacao('Consulta agendada!'); formAgendar.reset(); } 
                else { mostrarNotificacao(data.message || 'Erro ao agendar.', 'error'); }
            } catch(err) { console.error(err); mostrarNotificacao('Erro de conexão.', 'error'); }
        });
    }

    // LISTAR CONSULTAS
    async function loadConsultas() {
        await fetchPacientes();
        try {
            const res = await fetch('/api/consultas');
            let data = await res.json();
            data = data.map(c => {
                const cpfLimpo = String(c.cpf).replace(/\D/g, '');
                const paciente = pacientesCache.find(p => String(p.cpf).replace(/\D/g, '') === cpfLimpo);
                return {
                    ...c,
                    paciente_nome: paciente ? paciente.nome : "—",
                    paciente_contato: paciente ? paciente.telefone : "—"
                };
            });
            consultasCache = data;
            consultasFiltradas = [...data];
            paginaAtualConsultas = 1;
            renderConsultas();
        } catch(err) { console.error(err); }
    }

    // --- BUSCA (ATENDENTE) MELHORADA ---
    const btnBuscar = document.getElementById('btn-buscar');
    if(btnBuscar) {
        btnBuscar.addEventListener('click', (e) => {
            e.preventDefault();
            const campo = document.getElementById('busca-campo').value;
            const texto = document.getElementById('busca-valor').value.toLowerCase().trim();
            
            consultasFiltradas = consultasCache.filter(c => {
                if(!texto) return true;

                // 1. DATA (Comparação Visual - ex: "20/10/2025")
                if ((campo === 'datahora' || campo === 'todos') && c.datahora) {
                    const [datePart] = c.datahora.split('T');
                    if(datePart) {
                        const [ano, mes, dia] = datePart.split('-');
                        // Monta a data BR: 20/10/2025
                        const dataBR = `${dia}/${mes}/${ano}`; 
                        
                        // Se digitou "20", acha o dia 20.
                        // Se digitou "20/", acha especificamente dia 20.
                        if (dataBR.includes(texto)) return true;
                    }
                }

                if(campo === 'todos') {
                    return JSON.stringify(c).toLowerCase().includes(texto);
                }
                
                return String(c[campo]||'').toLowerCase().includes(texto);
            });
            
            paginaAtualConsultas = 1;
            renderConsultas();
        });
    }

    const btnAnt = document.getElementById('btn-ant');
    const btnProx = document.getElementById('btn-prox');
    if(btnAnt) btnAnt.addEventListener('click', () => { if(paginaAtualConsultas > 1) { paginaAtualConsultas--; renderConsultas(); } });
    if(btnProx) btnProx.addEventListener('click', () => { if(paginaAtualConsultas < Math.ceil(consultasFiltradas.length/itensPorPagina)) { paginaAtualConsultas++; renderConsultas(); } });

    function renderConsultas() {
        const tbody = document.querySelector('#tabelaConsultas tbody');
        if(!tbody) return;
        tbody.innerHTML = '';
        const total = consultasFiltradas.length;
        const paginas = Math.ceil(total / itensPorPagina);
        if(paginaAtualConsultas < 1) paginaAtualConsultas = 1;
        if(paginaAtualConsultas > paginas && paginas > 0) paginaAtualConsultas = paginas;
        const inicio = (paginaAtualConsultas - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const dados = consultasFiltradas.slice(inicio, fim);

        if(total === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-muted">Nenhum resultado.</td></tr>';
            document.getElementById('info-paginacao').innerText = 'Mostrando 0 - 0 de 0';
            if(btnAnt) btnAnt.disabled = true;
            if(btnProx) btnProx.disabled = true;
            return;
        }

        dados.forEach(c => {
            const tr = document.createElement('tr');
            let dataFmt = c.datahora;
            if(c.datahora && c.datahora.includes('T')) {
                const [d, t] = c.datahora.split('T');
                dataFmt = `${d.split('-').reverse().join('/')} ${t}`;
            }
            let badge = 'bg-secondary';
            if(c.status === 'Agendado') badge = 'bg-primary';
            if(c.status === 'Concluído') badge = 'bg-success';
            if(c.status === 'Cancelado') badge = 'bg-danger';

            tr.innerHTML = `
                <td>${c.id}</td>
                <td>${c.medico_id}</td>
                <td class="fw-bold">${c.paciente_nome}</td>
                <td>${c.paciente_contato}</td>
                <td>${c.cpf}</td>
                <td>${dataFmt}</td>
                <td class="text-truncate" style="max-width: 100px;" title="${c.observacoes}">${c.observacoes}</td>
                <td><span class="badge ${badge}">${c.status}</span></td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-primary btn-edit-con" data-id="${c.id}">Editar</button>
                        <button class="btn btn-sm btn-danger btn-del-con" data-id="${c.id}">Excluir</button>
                    </div>
                </td>
            `;
            tr.querySelector('.btn-edit-con').addEventListener('click', () => abrirEdicaoConsulta(c));
            tr.querySelector('.btn-del-con').addEventListener('click', () => deletarConsulta(c.id));
            tbody.appendChild(tr);
        });

        const mostrarAte = Math.min(fim, total);
        document.getElementById('info-paginacao').innerText = `Mostrando ${inicio + 1} - ${mostrarAte} de ${total}`;
        if(btnAnt) btnAnt.disabled = (paginaAtualConsultas === 1);
        if(btnProx) btnProx.disabled = (paginaAtualConsultas === paginas || paginas === 0);
    }

    // LISTAR PACIENTES
    async function loadPacientesLista() {
        await fetchPacientes();
        pacientesFiltrados = [...pacientesCache];
        paginaAtualPacientes = 1;
        renderPacientes();
    }
    const btnBuscarPac = document.getElementById('btn-buscar-paciente');
    if(btnBuscarPac) {
        btnBuscarPac.addEventListener('click', (e) => {
            e.preventDefault();
            const campo = document.getElementById('busca-paciente-campo').value;
            const texto = document.getElementById('busca-paciente-valor').value.toLowerCase();
            pacientesFiltrados = pacientesCache.filter(p => {
                if(!texto) return true;
                if(campo === 'todos') return JSON.stringify(p).toLowerCase().includes(texto);
                return String(p[campo]||'').toLowerCase().includes(texto);
            });
            paginaAtualPacientes = 1;
            renderPacientes();
        });
    }
    const btnAntPac = document.getElementById('btn-ant-pac');
    const btnProxPac = document.getElementById('btn-prox-pac');
    if(btnAntPac) btnAntPac.addEventListener('click', () => { if(paginaAtualPacientes > 1) { paginaAtualPacientes--; renderPacientes(); } });
    if(btnProxPac) btnProxPac.addEventListener('click', () => { if(paginaAtualPacientes < Math.ceil(pacientesFiltrados.length/itensPorPagina)) { paginaAtualPacientes++; renderPacientes(); } });

    function renderPacientes() {
        const tbody = document.querySelector('#tabelaPacientesMain tbody');
        if(!tbody) return;
        tbody.innerHTML = '';
        const total = pacientesFiltrados.length;
        const paginas = Math.ceil(total / itensPorPagina);
        if(paginaAtualPacientes < 1) paginaAtualPacientes = 1;
        if(paginaAtualPacientes > paginas && paginas > 0) paginaAtualPacientes = paginas;
        const inicio = (paginaAtualPacientes - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const dados = pacientesFiltrados.slice(inicio, fim);
        if(total === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-muted">Nenhum paciente encontrado.</td></tr>';
            document.getElementById('info-paginacao-pac').innerText = 'Mostrando 0 - 0 de 0';
            if(btnAntPac) btnAntPac.disabled = true;
            if(btnProxPac) btnProxPac.disabled = true;
            return;
        }
        dados.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${p.id}</td><td class="fw-bold">${p.nome}</td><td>${p.cpf}</td><td>${p.nascimento}</td><td>${p.peso}</td><td>${p.altura}</td><td><div class="d-flex gap-1"><button class="btn btn-sm btn-primary btn-edit-pac" data-cpf="${p.cpf}">Editar</button><button class="btn btn-sm btn-danger btn-del-pac" data-cpf="${p.cpf}">Excluir</button></div></td>`;
            tr.querySelector('.btn-edit-pac').addEventListener('click', () => abrirEdicaoPaciente(p));
            tr.querySelector('.btn-del-pac').addEventListener('click', () => deletarPaciente(p.cpf));
            tbody.appendChild(tr);
        });
        const mostrarAte = Math.min(fim, total);
        document.getElementById('info-paginacao-pac').innerText = `Mostrando ${inicio + 1} - ${mostrarAte} de ${total}`;
        if(btnAntPac) btnAntPac.disabled = (paginaAtualPacientes === 1);
        if(btnProxPac) btnProxPac.disabled = (paginaAtualPacientes === paginas || paginas === 0);
    }

    // CRUD Edição/Exclusão
    function abrirEdicaoConsulta(c) {
        if(!modalEditar) return;
        document.getElementById('edit-id').value = c.id; 
        document.getElementById('edit-nome').value = c.paciente_nome;
        document.getElementById('edit-contato').value = c.paciente_contato;
        document.getElementById('edit-cpf').value = c.cpf;
        let dataValue = c.datahora;
        if(c.datahora && c.datahora.includes(' ')) dataValue = c.datahora.replace(' ', 'T');
        document.getElementById('edit-datahora').value = dataValue;
        document.getElementById('edit-obs').value = c.observacoes;
        document.getElementById('edit-pagamento').value = c.pagamento || 'Dinheiro';
        document.getElementById('edit-status').value = c.status;
        modalEditar.show();
    }
    if(formEditar) {
        formEditar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-id').value; 
            const payload = {
                datahora: document.getElementById('edit-datahora').value,
                observacoes: document.getElementById('edit-obs').value,
                status: document.getElementById('edit-status').value,
                pagamento: document.getElementById('edit-pagamento').value
            };
            try {
                const res = await fetch(`/api/consultas/${id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                if(res.ok) { mostrarNotificacao('Consulta atualizada!'); modalEditar.hide(); loadConsultas(); } 
                else { mostrarNotificacao('Erro ao atualizar.', 'error'); }
            } catch(err) { console.error(err); }
        });
    }
    async function deletarConsulta(id) {
        if(!confirm('Excluir esta consulta?')) return;
        try {
            const res = await fetch(`/api/consultas/${id}`, { method: 'DELETE' });
            if(res.ok) { mostrarNotificacao('Consulta excluída!'); loadConsultas(); } 
            else { mostrarNotificacao('Erro.', 'error'); }
        } catch(err) { console.error(err); }
    }
    function abrirEdicaoPaciente(p) {
        if(!modalEditarPaciente) return;
        document.getElementById('edit-paciente-nome').value = p.nome;
        document.getElementById('edit-paciente-cpf').value = p.cpf;
        document.getElementById('edit-paciente-nasc').value = p.nascimento;
        document.getElementById('edit-paciente-telefone').value = p.telefone;
        document.getElementById('edit-paciente-endereco').value = p.endereco;
        document.getElementById('edit-paciente-peso').value = p.peso;
        document.getElementById('edit-paciente-altura').value = p.altura;
        formEditarPaciente.dataset.cpfOriginal = p.cpf;
        modalEditarPaciente.show();
    }
    if(formEditarPaciente) {
        formEditarPaciente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cpfOriginal = formEditarPaciente.dataset.cpfOriginal;
            const payload = {
                nome: document.getElementById('edit-paciente-nome').value,
                cpf: document.getElementById('edit-paciente-cpf').value,
                nascimento: document.getElementById('edit-paciente-nasc').value,
                telefone: document.getElementById('edit-paciente-telefone').value,
                endereco: document.getElementById('edit-paciente-endereco').value,
                peso: document.getElementById('edit-paciente-peso').value,
                altura: document.getElementById('edit-paciente-altura').value
            };
            try {
                const res = await fetch(`/api/pacientes/${cpfOriginal}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                if(res.ok) { mostrarNotificacao('Paciente atualizado!'); modalEditarPaciente.hide(); loadPacientesLista(); } 
                else { const err = await res.json(); mostrarNotificacao(err.message || 'Erro.', 'error'); }
            } catch(err) { console.error(err); }
        });
    }
    async function deletarPaciente(cpf) {
        if(!confirm('Excluir paciente?')) return;
        try {
            const res = await fetch(`/api/pacientes/${cpf}`, { method: 'DELETE' });
            if(res.ok) { mostrarNotificacao('Paciente excluído.'); loadPacientesLista(); } 
            else { mostrarNotificacao('Erro.', 'error'); }
        } catch(err) { console.error(err); }
    }
    if(document.getElementById('formCadastro')) { carregarSelectPacientes(); }
});