document.addEventListener('DOMContentLoaded', () => {

    // Formata datas ISO (2025-10-20) para o padrão brasileiro (20/10/2025)
    function formatarDataBR(isoString) {
        if (!isoString) return "—";
        if (isoString.includes('T')) {
            const [data, hora] = isoString.split('T');
            const [ano, mes, dia] = data.split('-');
            return `${dia}/${mes}/${ano} às ${hora}`;
        }
        const [ano, mes, dia] = isoString.split('-');
        return `${dia}/${mes}/${ano}`;
    }

    // Inicializa o componente Toast para notificações
    const toastEl = document.getElementById('toastAviso') || document.getElementById('toastSuccess');
    const toastBody = document.getElementById('toast-msg') || document.getElementById('toastMessage');
    let toastInstance = toastEl ? new bootstrap.Toast(toastEl) : null;

    // Exibe mensagens de feedback na tela (sucesso, erro ou aviso)
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

    // Aplica máscara automática no campo de CPF (000.000.000-00)
    function aplicarMascaraCPF(input) {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "").slice(0, 11);
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
            e.target.value = v;
        });
    }

    // Aplica máscara automática no campo de Telefone ((00) 00000-0000)
    function aplicarMascaraTelefone(input) {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "").slice(0, 11);
            v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
            v = v.replace(/(\d)(\d{4})$/, "$1-$2");
            e.target.value = v;
        });
    }

    // Ativa as máscaras nos campos identificados pelos IDs
    document.querySelectorAll('#paciente-cpf, #edit-paciente-cpf, #form-paciente-busca').forEach(el => aplicarMascaraCPF(el));
    document.querySelectorAll('#paciente-telefone, #edit-paciente-telefone').forEach(el => aplicarMascaraTelefone(el));

    // Lógica da tela de Login (seleção de perfil e envio do formulário)
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

            if (!userRole) { 
                mostrarNotificacao('Selecione se você é Médico ou Atendente!', 'warning'); 
                return; 
            }

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({role: userRole, email, senha})
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || 'Erro ao logar');
                window.location.href = json.redirect;
            } catch (err) { 
                console.error(err); 
                mostrarNotificacao(err.message, 'error'); 
            }
        });
        return; 
    }

    // Variáveis e elementos principais do painel (Médico e Atendente)
    const abas = document.querySelectorAll('.nav-link');
    if (abas.length === 0) return; 

    const secoes = document.querySelectorAll('.conteudo-secao');
    
    // Inicialização segura dos modais de edição
    const modalEditar = document.getElementById('modalEditar') ? new bootstrap.Modal(document.getElementById('modalEditar')) : 
                        (document.getElementById('modalEditarConsulta') ? new bootstrap.Modal(document.getElementById('modalEditarConsulta')) : null);
    const formEditar = document.getElementById('formEditar') || document.getElementById('formEditarConsulta');
    
    const modalEditarPaciente = document.getElementById('modalEditarPaciente') ? new bootstrap.Modal(document.getElementById('modalEditarPaciente')) : null;
    const formEditarPaciente = document.getElementById('formEditarPaciente');

    // Inicialização do modal unificado de exclusão
    const modalExclusaoEl = document.getElementById('modalExclusao');
    const modalExclusao = modalExclusaoEl ? new bootstrap.Modal(modalExclusaoEl) : null;
    const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');
    
    // Estado da exclusão (o que excluir e qual tipo)
    let idExclusao = null;
    let tipoExclusao = null;

    // Estado local dos dados e paginação
    let consultasCache = [];
    let pacientesCache = [];
    const itensPorPagina = 5;
    let consultasFiltradas = [];
    let paginaAtualConsultas = 1;
    let pacientesFiltrados = [];
    let paginaAtualPacientes = 1;

    // Gerencia a navegação entre as abas do painel
    abas.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            abas.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            secoes.forEach(sec => sec.classList.add('escondido'));
            
            const idAlvo = tab.getAttribute('data-aba');
            const alvo = document.getElementById(idAlvo);
            if(alvo) alvo.classList.remove('escondido');

            if (idAlvo === 'consultas' || idAlvo === 'consultas-agendadas') loadConsultas();
            if (idAlvo === 'listar-pacientes' || idAlvo === 'pacientes') loadPacientesLista();
            if (idAlvo === 'agendar') carregarSelectPacientes(); 
        });
    });

    // Busca dados de pacientes na API
    async function fetchPacientes() {
        try {
            const res = await fetch('/api/pacientes');
            pacientesCache = await res.json();
            return pacientesCache;
        } catch (err) { console.error(err); return []; }
    }

    // Carrega o select de pacientes apenas com o nome visível
    async function carregarSelectPacientes() {
        await fetchPacientes();
        const select = document.getElementById('form-paciente');
        if(!select) return;
        select.innerHTML = '<option value="" selected disabled>Selecione</option>';
        pacientesCache.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.cpf; 
            opt.textContent = p.nome;
            select.appendChild(opt);
        });
    }

    // Processa o cadastro de um novo paciente
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

    // Processa o agendamento de uma nova consulta
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

    // Carrega e processa a lista de consultas da API
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
            const ehMedico = document.getElementById('tabelaConsultasMedico'); 
            if(ehMedico) {
                 consultasFiltradas = data.filter(c => c.status !== 'Concluído' && c.status !== 'Cancelado');
            } else {
                 consultasFiltradas = [...data];
            }
            paginaAtualConsultas = 1;
            renderConsultas();
        } catch(err) { console.error(err); }
    }

    // Aplica filtros de busca na lista de consultas
    const btnBuscar = document.getElementById('btn-buscar');
    if(btnBuscar) {
        btnBuscar.addEventListener('click', (e) => {
            e.preventDefault();
            const campoEl = document.getElementById('busca-campo') || document.getElementById('filtro-campo');
            const textoEl = document.getElementById('busca-valor') || document.getElementById('filtro-texto');
            if(!campoEl || !textoEl) return;

            const campo = campoEl.value;
            const texto = textoEl.value.toLowerCase().trim();
            
            consultasFiltradas = consultasCache.filter(c => {
                if(!texto) return true;
                if ((campo === 'datahora' || campo === 'todos') && c.datahora) {
                    const [datePart] = c.datahora.split('T');
                    if(datePart) {
                        const [ano, mes, dia] = datePart.split('-');
                        const dataBR = `${dia}/${mes}/${ano}`; 
                        const textoLimpo = texto.replace(/\D/g, '');
                        if (dataBR.includes(texto) || dataBR.includes(textoLimpo)) return true;
                    }
                }
                if(campo === 'todos') return JSON.stringify(c).toLowerCase().includes(texto);
                return String(c[campo]||'').toLowerCase().includes(texto);
            });
            paginaAtualConsultas = 1;
            renderConsultas();
        });
    }

    // Controladores de paginação da tabela de consultas
    const btnAnt = document.getElementById('btn-ant');
    const btnProx = document.getElementById('btn-prox');
    if(btnAnt) btnAnt.addEventListener('click', () => { if(paginaAtualConsultas > 1) { paginaAtualConsultas--; renderConsultas(); } });
    if(btnProx) btnProx.addEventListener('click', () => { if(paginaAtualConsultas < Math.ceil(consultasFiltradas.length/itensPorPagina)) { paginaAtualConsultas++; renderConsultas(); } });

    // Renderiza a tabela de consultas com os dados atuais
    function renderConsultas() {
        const tbody = document.querySelector('#tabelaConsultas tbody') || document.querySelector('#tabelaConsultasMedico tbody');
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
            const infoPag = document.getElementById('info-paginacao');
            if(infoPag) infoPag.innerText = 'Mostrando 0 - 0 de 0';
            if(btnAnt) btnAnt.disabled = true;
            if(btnProx) btnProx.disabled = true;
            return;
        }

        dados.forEach(c => {
            const tr = document.createElement('tr');
            const dataFmt = formatarDataBR(c.datahora);
            let badge = c.status === 'Agendado' ? 'bg-primary' : (c.status === 'Concluído' ? 'bg-success' : (c.status === 'Cancelado' ? 'bg-danger' : 'bg-secondary'));
            
            tr.innerHTML = `
                <td>${c.id}</td>
                <td>${c.medico_id}</td>
                <td class="fw-bold">${c.paciente_nome}</td>
                <td>${c.paciente_contato}</td>
                <td>${c.cpf}</td>
                <td>${dataFmt}</td>
                <td class="text-truncate" style="max-width: 100px;" title="${c.observacoes}">${c.observacoes || '-'}</td>
                <td><span class="badge ${badge}">${c.status}</span></td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-primary btn-edit-con" data-id="${c.id}">Editar</button>
                        <button class="btn btn-sm btn-danger btn-del-con" data-id="${c.id}">Excluir</button>
                    </div>
                </td>
            `;
            tr.querySelector('.btn-edit-con').addEventListener('click', () => abrirEdicaoConsulta(c));
            
            // Chama a função unificada de exclusão (tipo 'consulta')
            tr.querySelector('.btn-del-con').addEventListener('click', () => confirmarExclusao(c.id, 'consulta'));
            
            tbody.appendChild(tr);
        });

        const mostrarAte = Math.min(fim, total);
        const infoPag = document.getElementById('info-paginacao');
        if(infoPag) infoPag.innerText = `Mostrando ${inicio + 1} - ${mostrarAte} de ${total}`;
        if(btnAnt) btnAnt.disabled = (paginaAtualConsultas === 1);
        if(btnProx) btnProx.disabled = (paginaAtualConsultas === paginas || paginas === 0);
    }

    // Carrega e exibe a lista de pacientes
    async function loadPacientesLista() {
        await fetchPacientes();
        pacientesFiltrados = [...pacientesCache];
        paginaAtualPacientes = 1;
        renderPacientes();
    }

    // Aplica filtros de busca na lista de pacientes
    const btnBuscarPac = document.getElementById('btn-buscar-paciente') || document.getElementById('btn-buscar-pac');
    if(btnBuscarPac) {
        btnBuscarPac.addEventListener('click', (e) => {
            e.preventDefault();
            const campoEl = document.getElementById('busca-paciente-campo') || document.getElementById('filtro-campo-pac');
            const textoEl = document.getElementById('busca-paciente-valor') || document.getElementById('filtro-texto-pac');
            if(!campoEl || !textoEl) return;
            const campo = campoEl.value;
            const texto = textoEl.value.toLowerCase();
            
            pacientesFiltrados = pacientesCache.filter(p => {
                if(!texto) return true;
                if(campo === 'todos') return JSON.stringify(p).toLowerCase().includes(texto);
                return String(p[campo]||'').toLowerCase().includes(texto);
            });
            paginaAtualPacientes = 1;
            renderPacientes();
        });
    }

    // Controladores de paginação da tabela de pacientes
    const btnAntPac = document.getElementById('btn-ant-pac');
    const btnProxPac = document.getElementById('btn-prox-pac');
    if(btnAntPac) btnAntPac.addEventListener('click', () => { if(paginaAtualPacientes > 1) { paginaAtualPacientes--; renderPacientes(); } });
    if(btnProxPac) btnProxPac.addEventListener('click', () => { if(paginaAtualPacientes < Math.ceil(pacientesFiltrados.length/itensPorPagina)) { paginaAtualPacientes++; renderPacientes(); } });

    // Renderiza a tabela de pacientes
    function renderPacientes() {
        const tbodyMain = document.querySelector('#tabelaPacientesMain tbody'); // Atendente
        const tbodyMedico = document.querySelector('#tabelaPacientesMedico tbody'); // Médico
        const tbody = tbodyMain || tbodyMedico;
        if(!tbody) return;
        const isAtendente = !!tbodyMain;

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
            const infoPagPac = document.getElementById('info-paginacao-pac');
            if(infoPagPac) infoPagPac.innerText = 'Mostrando 0 - 0 de 0';
            if(btnAntPac) btnAntPac.disabled = true;
            if(btnProxPac) btnProxPac.disabled = true;
            return;
        }

        dados.forEach(p => {
            const tr = document.createElement('tr');
            const nascFmt = formatarDataBR(p.nascimento);

            let colAcoes = '';
            if (isAtendente) {
                colAcoes = `
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-primary btn-edit-pac" data-cpf="${p.cpf}">Editar</button>
                        <button class="btn btn-sm btn-danger btn-del-pac" data-cpf="${p.cpf}">Excluir</button>
                    </div>
                </td>`;
            }

            tr.innerHTML = `<td>${p.id}</td><td class="fw-bold">${p.nome}</td><td>${p.cpf}</td><td>${nascFmt}</td><td>${p.peso||'-'}</td><td>${p.altura||'-'}</td>${colAcoes}`;
            
            if (isAtendente) {
                tr.querySelector('.btn-edit-pac').addEventListener('click', () => abrirEdicaoPaciente(p));
                // Chama a função unificada de exclusão (tipo 'paciente')
                tr.querySelector('.btn-del-pac').addEventListener('click', () => confirmarExclusao(p.cpf, 'paciente'));
            }
            tbody.appendChild(tr);
        });

        const mostrarAte = Math.min(fim, total);
        const infoPagPac = document.getElementById('info-paginacao-pac');
        if(infoPagPac) infoPagPac.innerText = `Mostrando ${inicio + 1} - ${mostrarAte} de ${total}`;
        if(btnAntPac) btnAntPac.disabled = (paginaAtualPacientes === 1);
        if(btnProxPac) btnProxPac.disabled = (paginaAtualPacientes === paginas || paginas === 0);
    }

    // Preenche o modal de edição de consulta
    function abrirEdicaoConsulta(c) {
        if(!modalEditar) return;
        const setVal = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val; };
        setVal('edit-id', c.id);
        setVal('edit-nome', c.paciente_nome);
        setVal('edit-contato', c.paciente_contato);
        setVal('edit-cpf', c.cpf);
        setVal('edit-obs', c.observacoes);
        setVal('edit-pagamento', c.pagamento || 'Dinheiro');
        setVal('edit-status', c.status);
        let dataValue = c.datahora;
        if(c.datahora && c.datahora.includes(' ')) dataValue = c.datahora.replace(' ', 'T');
        setVal('edit-datahora', dataValue);
        modalEditar.show();
    }

    // Envia a edição da consulta para a API
    if(formEditar) {
        formEditar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-id').value; 
            const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : null;
            const payload = {
                datahora: getVal('edit-datahora'),
                observacoes: getVal('edit-obs'),
                status: getVal('edit-status'),
                pagamento: getVal('edit-pagamento')
            };
            Object.keys(payload).forEach(key => payload[key] === null && delete payload[key]);
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

    // Abre o modal de confirmação e define o que será excluído
    function confirmarExclusao(idOuCpf, tipo) {
        idExclusao = idOuCpf;
        tipoExclusao = tipo;
        
        if (modalExclusao) {
            const titulo = document.querySelector('#modalExclusao .modal-title');
            const corpo = document.querySelector('#modalExclusao .modal-body p.text-secondary');
            if (titulo) titulo.innerHTML = `<i class="bi bi-trash3-fill me-2"></i>Excluir ${tipo === 'consulta' ? 'Consulta' : 'Paciente'}?`;
            if (corpo) corpo.innerText = `Tem certeza que deseja excluir ${tipo === 'consulta' ? 'esta consulta' : 'este paciente'}?`;
            modalExclusao.show();
        } else {
            if(confirm(`Deseja excluir ${tipo}?`)) executarExclusaoReal();
        }
    }

    // Configura o listener do botão de confirmação do modal
    if (btnConfirmarExclusao) {
        // CloneNode para evitar múltiplos listeners acumulados
        const novoBtn = btnConfirmarExclusao.cloneNode(true);
        btnConfirmarExclusao.parentNode.replaceChild(novoBtn, btnConfirmarExclusao);
        novoBtn.addEventListener('click', () => executarExclusaoReal());
    }

    // Executa a exclusão na API
    async function executarExclusaoReal() {
        const btnReal = document.getElementById('btnConfirmarExclusao'); 
        if(btnReal) btnReal.disabled = true;

        let url = '';
        let sucessoMsg = '';
        
        if (tipoExclusao === 'consulta') {
            url = `/api/consultas/${idExclusao}`;
            sucessoMsg = 'Consulta excluída com sucesso!';
        } else if (tipoExclusao === 'paciente') {
            url = `/api/pacientes/${idExclusao}`;
            sucessoMsg = 'Paciente excluído com sucesso!';
        }

        if(url) {
            try {
                const res = await fetch(url, { method: 'DELETE' });
                if(res.ok) { 
                    mostrarNotificacao(sucessoMsg, 'success'); 
                    if (tipoExclusao === 'consulta') loadConsultas();
                    if (tipoExclusao === 'paciente') loadPacientesLista();
                } else { 
                    mostrarNotificacao('Erro ao excluir.', 'error'); 
                }
            } catch(err) { 
                console.error(err); 
                mostrarNotificacao('Erro de conexão.', 'error'); 
            }
        }
        
        if (modalExclusao) modalExclusao.hide();
        if(btnReal) btnReal.disabled = false;
        idExclusao = null;
        tipoExclusao = null;
    }

    // Preenche o modal de edição de paciente
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

    // Envia a edição do paciente para a API
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

    // Inicialização condicional
    if(document.getElementById('formCadastro')) { carregarSelectPacientes(); }
    if(document.getElementById('tabelaConsultasMedico')) { loadConsultas(); }
});