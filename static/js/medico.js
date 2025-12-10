document.addEventListener('DOMContentLoaded', () => {

    // Converte datas ISO para o formato brasileiro (DD/MM/AAAA)
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

    // Gerencia a exibição de notificações do sistema (Toasts)
    const toastEl = document.getElementById('toastAviso');
    const toastInstance = new bootstrap.Toast(toastEl);
    const toastMsg = document.getElementById('toast-msg');

    function mostrarNotificacao(mensagem, tipo = 'success') {
        toastMsg.innerText = mensagem;
        toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning');
        if (tipo === 'success') toastEl.classList.add('bg-success');
        if (tipo === 'error') toastEl.classList.add('bg-danger');
        if (tipo === 'warning') toastEl.classList.add('bg-warning');
        toastInstance.show();
    }

    // Referências aos elementos do DOM e Modais
    const abas = document.querySelectorAll('.nav-link');
    const secoes = document.querySelectorAll('.conteudo-secao');
    const tabelaConsultas = document.querySelector('#tabelaConsultasMedico tbody');
    const tabelaPacientes = document.querySelector('#tabelaPacientesMedico tbody');
    const modalEditar = new bootstrap.Modal(document.getElementById('modalEditarConsulta'));
    const formEditar = document.getElementById('formEditarConsulta');
    
    // Configuração do modal de exclusão
    const modalExclusaoEl = document.getElementById('modalExclusao');
    const modalExclusao = modalExclusaoEl ? new bootstrap.Modal(modalExclusaoEl) : null;
    const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');
    let idParaExcluir = null;

    // Estado da aplicação (Cache e Paginação)
    let consultasCache = [], pacientesCache = [];
    let consultasFiltradas = [], pacientesFiltrados = [];
    let paginaAtual = 1, paginaAtualPacientes = 1;
    const itensPorPagina = 5;

    // Controle de navegação entre abas
    abas.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            abas.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            secoes.forEach(sec => sec.classList.add('escondido'));
            document.getElementById(tab.getAttribute('data-aba')).classList.remove('escondido');

            if (tab.getAttribute('data-aba') === 'consultas-agendadas') loadConsultas();
            if (tab.getAttribute('data-aba') === 'pacientes') loadPacientes();
        });
    });

    // Busca dados de pacientes para cache
    async function preloadPacientes() {
        try {
            const res = await fetch('/api/pacientes');
            pacientesCache = await res.json();
            return pacientesCache;
        } catch (err) { console.error(err); return []; }
    }

    // Carrega e renderiza a lista de pacientes
    async function loadPacientes() {
        await preloadPacientes();
        pacientesFiltrados = [...pacientesCache];
        paginaAtualPacientes = 1;
        atualizarVisualizacaoPacientes();
    }

    // Carrega consultas e cruza com dados de pacientes
    async function loadConsultas() {
        try {
            await preloadPacientes(); 
            const res = await fetch('/api/consultas');
            let data = await res.json();
            data = data.map(c => {
                const paciente = pacientesCache.find(p => String(p.cpf).replace(/\D/g, '') === String(c.cpf).replace(/\D/g, ''));
                return { ...c, paciente_nome: paciente ? paciente.nome : "—", paciente_contato: paciente ? paciente.telefone : "—" };
            });
            consultasCache = data;
            consultasFiltradas = data.filter(c => c.status !== 'Concluído' && c.status !== 'Cancelado');
            paginaAtual = 1;
            atualizarVisualizacao();
        } catch (err) { console.error(err); }
    }

    // Filtros da tabela de consultas
    const btnBuscar = document.getElementById('btn-buscar');
    const inputFiltro = document.getElementById('filtro-texto');
    const selectFiltro = document.getElementById('filtro-campo');
    
    function aplicarFiltro() {
        const campo = selectFiltro.value;
        const texto = inputFiltro.value.toLowerCase().trim();
        
        consultasFiltradas = consultasCache.filter(c => {
            if (c.status === 'Concluído' || c.status === 'Cancelado') return false; 
            if (!texto) return true;
            if ((campo === 'datahora' || campo === 'todos') && c.datahora) {
                const [datePart] = c.datahora.split('T'); 
                const dataBR = datePart ? `${datePart.split('-')[2]}${datePart.split('-')[1]}${datePart.split('-')[0]}` : '';
                if (dataBR.includes(texto.replace(/\D/g, ''))) return true;
            }
            if (campo === 'todos') {
                return String(c.id).includes(texto) || String(c.medico_id).includes(texto) || 
                       (c.paciente_nome && c.paciente_nome.toLowerCase().includes(texto)) || 
                       (c.cpf && String(c.cpf).includes(texto));
            }
            return String(c[campo] || '').toLowerCase().includes(texto);
        });
        paginaAtual = 1;
        atualizarVisualizacao();
    }
    
    if(btnBuscar) btnBuscar.addEventListener('click', aplicarFiltro);
    if(inputFiltro) inputFiltro.addEventListener('keyup', (e) => { if(e.key==='Enter') aplicarFiltro(); });

    // Filtros da tabela de pacientes
    const btnBuscarPac = document.getElementById('btn-buscar-pac');
    const inputFiltroPac = document.getElementById('filtro-texto-pac');
    const selectFiltroPac = document.getElementById('filtro-campo-pac');

    function aplicarFiltroPacientes() {
        const campo = selectFiltroPac.value;
        const texto = inputFiltroPac.value.toLowerCase();
        pacientesFiltrados = pacientesCache.filter(p => {
            if (!texto) return true;
            if (campo === 'todos') return String(p.id).includes(texto) || p.nome.toLowerCase().includes(texto) || String(p.cpf).includes(texto);
            return String(p[campo] || '').toLowerCase().includes(texto);
        });
        paginaAtualPacientes = 1;
        atualizarVisualizacaoPacientes();
    }
    if(btnBuscarPac) btnBuscarPac.addEventListener('click', aplicarFiltroPacientes);
    if(inputFiltroPac) inputFiltroPac.addEventListener('keyup', (e) => { if(e.key==='Enter') aplicarFiltroPacientes(); });

    // Paginação das tabelas
    document.getElementById('btn-ant')?.addEventListener('click', () => { if (paginaAtual > 1) { paginaAtual--; atualizarVisualizacao(); }});
    document.getElementById('btn-prox')?.addEventListener('click', () => { if (paginaAtual < Math.ceil(consultasFiltradas.length/itensPorPagina)) { paginaAtual++; atualizarVisualizacao(); }});
    
    document.getElementById('btn-ant-pac')?.addEventListener('click', () => { if (paginaAtualPacientes > 1) { paginaAtualPacientes--; atualizarVisualizacaoPacientes(); }});
    document.getElementById('btn-prox-pac')?.addEventListener('click', () => { if (paginaAtualPacientes < Math.ceil(pacientesFiltrados.length/itensPorPagina)) { paginaAtualPacientes++; atualizarVisualizacaoPacientes(); }});

    // Renderiza a tabela de consultas
    function atualizarVisualizacao() {
        if(!tabelaConsultas) return;
        tabelaConsultas.innerHTML = '';
        const total = consultasFiltradas.length;
        const totalPaginas = Math.ceil(total / itensPorPagina);
        if (paginaAtual > totalPaginas && totalPaginas > 0) paginaAtual = totalPaginas;
        
        const dados = consultasFiltradas.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

        if (total === 0) {
            tabelaConsultas.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-muted">Nenhuma consulta encontrada.</td></tr>';
            document.getElementById('info-paginacao').innerText = 'Mostrando 0 - 0 de 0';
            return;
        }

        dados.forEach(c => {
            const tr = document.createElement('tr');
            let badge = c.status === 'Agendado' ? 'bg-primary' : (c.status === 'Concluído' ? 'bg-success' : 'bg-danger');
            
            tr.innerHTML = `
                <td>${c.id}</td>
                <td>${c.medico_id}</td>
                <td class="fw-bold text-dark">${c.paciente_nome}</td>
                <td>${c.paciente_contato}</td>
                <td>${c.cpf}</td>
                <td>${formatarDataBR(c.datahora)}</td>
                <td class="text-truncate" style="max-width: 150px;" title="${c.observacoes}">${c.observacoes||'-'}</td>
                <td><span class="badge ${badge}">${c.status}</span></td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-primary btn-sm btn-editar" data-id="${c.id}">Editar</button>
                        <button class="btn btn-danger btn-sm btn-excluir" data-id="${c.id}">Excluir</button>
                    </div>
                </td>`;
            
            tr.querySelector('.btn-editar').addEventListener('click', () => abrirModalEdicao(c));
            tr.querySelector('.btn-excluir').addEventListener('click', () => confirmarExclusaoConsulta(c.id));
            tabelaConsultas.appendChild(tr);
        });
        
        document.getElementById('info-paginacao').innerText = `Mostrando ${dados.length > 0 ? (paginaAtual - 1) * itensPorPagina + 1 : 0} - ${Math.min(paginaAtual * itensPorPagina, total)} de ${total}`;
        if(document.getElementById('btn-ant')) document.getElementById('btn-ant').disabled = paginaAtual === 1;
        if(document.getElementById('btn-prox')) document.getElementById('btn-prox').disabled = paginaAtual === totalPaginas || totalPaginas === 0;
    }

    // Renderiza a tabela de pacientes
    function atualizarVisualizacaoPacientes() {
        if(!tabelaPacientes) return;
        tabelaPacientes.innerHTML = '';
        const total = pacientesFiltrados.length;
        const totalPaginas = Math.ceil(total / itensPorPagina);
        if (paginaAtualPacientes > totalPaginas && totalPaginas > 0) paginaAtualPacientes = totalPaginas;

        const dados = pacientesFiltrados.slice((paginaAtualPacientes - 1) * itensPorPagina, paginaAtualPacientes * itensPorPagina);

        if (total === 0) {
            tabelaPacientes.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-muted">Nenhum paciente.</td></tr>';
            document.getElementById('info-paginacao-pac').innerText = 'Mostrando 0 - 0 de 0';
            return;
        }
        dados.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${p.id}</td><td class="fw-bold">${p.nome}</td><td>${p.cpf}</td><td>${formatarDataBR(p.nascimento)}</td><td>${p.peso||"-"}</td><td>${p.altura||"-"}</td>`;
            tabelaPacientes.appendChild(tr);
        });
        
        document.getElementById('info-paginacao-pac').innerText = `Mostrando ${(paginaAtualPacientes - 1) * itensPorPagina + 1} - ${Math.min(paginaAtualPacientes * itensPorPagina, total)} de ${total}`;
        if(document.getElementById('btn-ant-pac')) document.getElementById('btn-ant-pac').disabled = paginaAtualPacientes === 1;
        if(document.getElementById('btn-prox-pac')) document.getElementById('btn-prox-pac').disabled = paginaAtualPacientes === totalPaginas || totalPaginas === 0;
    }

    // Preenche e abre o modal de edição
    function abrirModalEdicao(c) {
        document.getElementById('edit-id').value = c.id;
        document.getElementById('edit-nome').value = c.paciente_nome;
        document.getElementById('edit-cpf').value = c.cpf;
        document.getElementById('edit-contato').value = c.paciente_contato;
        document.getElementById('edit-datahora').value = c.datahora && c.datahora.includes(' ') ? c.datahora.replace(' ', 'T') : c.datahora;
        document.getElementById('edit-obs').value = c.observacoes;
        document.getElementById('edit-status').value = c.status;
        modalEditar.show();
    }

    // Submete a edição da consulta
    if(formEditar) {
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
                if(res.ok) { modalEditar.hide(); mostrarNotificacao('Atualizado com sucesso!'); loadConsultas(); } 
                else { mostrarNotificacao('Erro ao atualizar!', 'error'); }
            } catch(err) { console.error(err); }
        });
    }

    // Exibe o modal de confirmação de exclusão
    function confirmarExclusaoConsulta(id) {
        idParaExcluir = id;
        if (modalExclusao) modalExclusao.show();
        else if(confirm('Deseja excluir?')) executarExclusao();
    }

    // Executa a exclusão via API
    if (btnConfirmarExclusao) {
        btnConfirmarExclusao.addEventListener('click', async () => {
            if (!idParaExcluir) return;
            try {
                const res = await fetch(`/api/consultas/${idParaExcluir}`, { method: 'DELETE' });
                if(res.ok) { mostrarNotificacao('Excluído com sucesso!'); loadConsultas(); } 
                else { mostrarNotificacao('Erro ao excluir!', 'error'); }
            } catch(err) { console.error(err); mostrarNotificacao('Erro de conexão.', 'error'); }
            modalExclusao.hide();
        });
    }

    loadConsultas();
});