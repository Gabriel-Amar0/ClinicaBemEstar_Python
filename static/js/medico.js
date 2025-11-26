document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // ELEMENTOS E VARIÁVEIS GERAIS
    // ==========================================
    const abas = document.querySelectorAll('.nav-link');
    const secoes = document.querySelectorAll('.conteudo-secao');
    
    const tabelaConsultas = document.querySelector('#tabelaConsultasMedico tbody');
    const tabelaPacientes = document.querySelector('#tabelaPacientesMedico tbody');
    
    const modalEditar = new bootstrap.Modal(document.getElementById('modalEditarConsulta'));
    const formEditar = document.getElementById('formEditarConsulta');

    // TOAST
    const toastEl = document.getElementById('toastAviso');
    const toastInstance = new bootstrap.Toast(toastEl);
    const toastMsg = document.getElementById('toast-msg');

    // DADOS
    let consultasCache = [];    
    let pacientesCache = [];
    
    const itensPorPagina = 5; 

    // ESTADO
    let consultasFiltradas = []; 
    let paginaAtual = 1;
    let pacientesFiltrados = [];
    let paginaAtualPacientes = 1;

    // ==========================================
    // NOTIFICAÇÕES
    // ==========================================
    function mostrarNotificacao(mensagem, tipo = 'success') {
        toastMsg.innerText = mensagem;
        toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning');
        
        if(tipo === 'success') toastEl.classList.add('bg-success');
        if(tipo === 'error') toastEl.classList.add('bg-danger');
        
        toastInstance.show();
    }

    // ==========================================
    // 1. NAVEGAÇÃO
    // ==========================================
    abas.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            abas.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            secoes.forEach(sec => sec.classList.add('escondido'));
            const alvo = document.getElementById(tab.getAttribute('data-aba'));
            if(alvo) alvo.classList.remove('escondido');

            if (tab.getAttribute('data-aba') === 'consultas-agendadas') loadConsultas();
            if (tab.getAttribute('data-aba') === 'pacientes') loadPacientes();
        });
    });

    // ==========================================
    // 2. LOADERS
    // ==========================================
    async function preloadPacientes() {
        try {
            const res = await fetch('/api/pacientes');
            pacientesCache = await res.json();
            return pacientesCache;
        } catch (err) {
            console.error(err);
            return [];
        }
    }

    async function loadPacientes() {
        await preloadPacientes();
        pacientesFiltrados = [...pacientesCache];
        paginaAtualPacientes = 1;
        atualizarVisualizacaoPacientes();
    }

    async function loadConsultas() {
        try {
            await preloadPacientes(); 
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

            // ✅ FILTRO INICIAL: Remove Concluído e Cancelado da visualização inicial
            consultasFiltradas = data.filter(c => c.status !== 'Concluído' && c.status !== 'Cancelado');
            
            paginaAtual = 1;
            atualizarVisualizacao();
        } catch (err) { console.error(err); }
    }

    // ==========================================
    // 3. FILTROS (Agora respeitam a regra de ocultar)
    // ==========================================
    // Consultas
    const btnBuscar = document.getElementById('btn-buscar');
    const inputFiltro = document.getElementById('filtro-texto');
    const selectFiltro = document.getElementById('filtro-campo');

    function aplicarFiltro() {
        const campo = selectFiltro.value;
        const texto = inputFiltro.value.toLowerCase();
        
        consultasFiltradas = consultasCache.filter(c => {
            // ✅ REGRA 1: Deve ser diferente de Concluído e Cancelado
            if (c.status === 'Concluído' || c.status === 'Cancelado') {
                return false; 
            }

            // REGRA 2: Texto da busca
            if (!texto) return true;
            
            if (campo === 'todos') {
                return String(c.id).includes(texto) ||
                       String(c.medico_id).includes(texto) ||
                       (c.paciente_nome && c.paciente_nome.toLowerCase().includes(texto)) ||
                       (c.cpf && String(c.cpf).includes(texto)) ||
                       (c.status && c.status.toLowerCase().includes(texto));
            }
            return String(c[campo] || '').toLowerCase().includes(texto);
        });
        
        paginaAtual = 1;
        atualizarVisualizacao();
    }
    
    if(btnBuscar) btnBuscar.addEventListener('click', aplicarFiltro);
    if(inputFiltro) inputFiltro.addEventListener('keyup', (e) => { if(e.key==='Enter') aplicarFiltro(); });

    // Pacientes
    const btnBuscarPac = document.getElementById('btn-buscar-pac');
    const inputFiltroPac = document.getElementById('filtro-texto-pac');
    const selectFiltroPac = document.getElementById('filtro-campo-pac');

    function aplicarFiltroPacientes() {
        const campo = selectFiltroPac.value;
        const texto = inputFiltroPac.value.toLowerCase();
        pacientesFiltrados = pacientesCache.filter(p => {
            if (!texto) return true;
            if (campo === 'todos') {
                return String(p.id).includes(texto) ||
                       (p.nome && p.nome.toLowerCase().includes(texto)) ||
                       (p.cpf && String(p.cpf).includes(texto));
            }
            return String(p[campo] || '').toLowerCase().includes(texto);
        });
        paginaAtualPacientes = 1;
        atualizarVisualizacaoPacientes();
    }
    if(btnBuscarPac) btnBuscarPac.addEventListener('click', aplicarFiltroPacientes);
    if(inputFiltroPac) inputFiltroPac.addEventListener('keyup', (e) => { if(e.key==='Enter') aplicarFiltroPacientes(); });

    // ==========================================
    // 4. RENDERIZAÇÃO (CONSULTAS)
    // ==========================================
    const btnAnt = document.getElementById('btn-ant');
    const btnProx = document.getElementById('btn-prox');

    btnAnt.addEventListener('click', () => { if (paginaAtual > 1) { paginaAtual--; atualizarVisualizacao(); }});
    btnProx.addEventListener('click', () => { if (paginaAtual < Math.ceil(consultasFiltradas.length/itensPorPagina)) { paginaAtual++; atualizarVisualizacao(); }});

    function atualizarVisualizacao() {
        tabelaConsultas.innerHTML = '';
        const totalItens = consultasFiltradas.length;
        const totalPaginas = Math.ceil(totalItens / itensPorPagina);

        if (paginaAtual < 1) paginaAtual = 1;
        if (paginaAtual > totalPaginas && totalPaginas > 0) paginaAtual = totalPaginas;

        const inicio = (paginaAtual - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const dadosPagina = consultasFiltradas.slice(inicio, fim);

        if (totalItens === 0) {
            tabelaConsultas.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-muted">Nenhuma consulta pendente.</td></tr>';
            document.getElementById('info-paginacao').innerText = 'Mostrando 0 - 0 de 0';
            btnAnt.disabled = true;
            btnProx.disabled = true;
            return;
        }

        dadosPagina.forEach(c => {
            const tr = document.createElement('tr');
            let dataFormatada = c.datahora;
            if(c.datahora && c.datahora.includes('T')) {
                const [date, time] = c.datahora.split('T');
                dataFormatada = `${date.split('-').reverse().join('/')} ${time}`;
            }
            let statusClass = 'bg-secondary';
            if(c.status === 'Agendado') statusClass = 'bg-primary';
            
            // Embora não devam aparecer, mantemos as classes caso a regra mude
            if(c.status === 'Concluído') statusClass = 'bg-success';
            if(c.status === 'Cancelado') statusClass = 'bg-danger';

            tr.innerHTML = `
                <td>${c.id}</td>
                <td>${c.medico_id}</td>
                <td class="fw-bold text-dark">${c.paciente_nome}</td>
                <td>${c.paciente_contato}</td>
                <td>${c.cpf}</td>
                <td>${dataFormatada}</td>
                <td class="text-truncate" style="max-width: 150px;" title="${c.observacoes}">${c.observacoes||'-'}</td>
                <td><span class="badge ${statusClass}">${c.status}</span></td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-primary btn-sm btn-editar" data-id="${c.id}">Editar</button>
                        <button class="btn btn-danger btn-sm btn-excluir" data-id="${c.id}">Excluir</button>
                    </div>
                </td>
            `;
            tr.querySelector('.btn-editar').addEventListener('click', () => abrirModalEdicao(c));
            tr.querySelector('.btn-excluir').addEventListener('click', () => {
                if(confirm(`Excluir consulta ${c.id}?`)) deletarConsulta(c.id);
            });
            tabelaConsultas.appendChild(tr);
        });

        const itemFinal = Math.min(fim, totalItens);
        document.getElementById('info-paginacao').innerText = `Mostrando ${inicio + 1} - ${itemFinal} de ${totalItens}`;
        btnAnt.disabled = (paginaAtual === 1);
        btnProx.disabled = (paginaAtual === totalPaginas || totalPaginas === 0);
    }

    // ==========================================
    // 5. RENDERIZAÇÃO (PACIENTES)
    // ==========================================
    const btnAntPac = document.getElementById('btn-ant-pac');
    const btnProxPac = document.getElementById('btn-prox-pac');

    btnAntPac.addEventListener('click', () => { if (paginaAtualPacientes > 1) { paginaAtualPacientes--; atualizarVisualizacaoPacientes(); }});
    btnProxPac.addEventListener('click', () => { if (paginaAtualPacientes < Math.ceil(pacientesFiltrados.length/itensPorPagina)) { paginaAtualPacientes++; atualizarVisualizacaoPacientes(); }});

    function atualizarVisualizacaoPacientes() {
        tabelaPacientes.innerHTML = '';
        const totalItens = pacientesFiltrados.length;
        const totalPaginas = Math.ceil(totalItens / itensPorPagina);

        if (paginaAtualPacientes < 1) paginaAtualPacientes = 1;
        if (paginaAtualPacientes > totalPaginas && totalPaginas > 0) paginaAtualPacientes = totalPaginas;

        const inicio = (paginaAtualPacientes - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const dadosPagina = pacientesFiltrados.slice(inicio, fim);

        if (totalItens === 0) {
            tabelaPacientes.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-muted">Nenhum paciente.</td></tr>';
            document.getElementById('info-paginacao-pac').innerText = 'Mostrando 0 - 0 de 0';
            btnAntPac.disabled = true;
            btnProxPac.disabled = true;
            return;
        }

        dadosPagina.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.id}</td>
                <td class="fw-bold">${p.nome}</td>
                <td>${p.cpf}</td>
                <td>${p.nascimento || "-"}</td>
                <td>${p.peso || "-"}</td>
                <td>${p.altura || "-"}</td>
            `;
            tabelaPacientes.appendChild(tr);
        });

        const itemFinal = Math.min(fim, totalItens);
        document.getElementById('info-paginacao-pac').innerText = `Mostrando ${inicio + 1} - ${itemFinal} de ${totalItens}`;
        btnAntPac.disabled = (paginaAtualPacientes === 1);
        btnProxPac.disabled = (paginaAtualPacientes === totalPaginas || totalPaginas === 0);
    }

    // ==========================================
    // 6. CRUD (CONSULTAS)
    // ==========================================
    function abrirModalEdicao(c) {
        document.getElementById('edit-id').value = c.id;
        document.getElementById('edit-nome').value = c.paciente_nome;
        document.getElementById('edit-cpf').value = c.cpf;
        document.getElementById('edit-contato').value = c.paciente_contato;
        document.getElementById('edit-datahora').value = c.datahora;
        document.getElementById('edit-obs').value = c.observacoes;
        document.getElementById('edit-status').value = c.status;
        modalEditar.show();
    }

    formEditar.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const payload = {
            datahora: document.getElementById('edit-datahora').value,
            observacoes: document.getElementById('edit-obs').value,
            status: document.getElementById('edit-status').value
        };
        try {
            const res = await fetch(`/api/consultas/${id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            if(res.ok) {
                modalEditar.hide();
                mostrarNotificacao('Consulta atualizada com sucesso!');
                // Ao recarregar, o item Concluído/Cancelado vai sumir
                loadConsultas();
            } else {
                mostrarNotificacao('Erro ao salvar!', 'error');
            }
        } catch(err) { console.error(err); }
    });

    async function deletarConsulta(id) {
        try {
            const res = await fetch(`/api/consultas/${id}`, { method: 'DELETE' });
            if(res.ok) {
                mostrarNotificacao('Consulta excluída!');
                loadConsultas();
            } else {
                mostrarNotificacao('Erro ao excluir!', 'error');
            }
        } catch(err) { console.error(err); }
    }

    loadConsultas();
});