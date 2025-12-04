document.addEventListener('DOMContentLoaded', () => {
    // VARIÁVEIS GERAIS
    const abas = document.querySelectorAll('.nav-link');
    const secoes = document.querySelectorAll('.conteudo-secao');
    const tabelaConsultas = document.querySelector('#tabelaConsultasMedico tbody');
    const tabelaPacientes = document.querySelector('#tabelaPacientesMedico tbody');
    const modalEditar = new bootstrap.Modal(document.getElementById('modalEditarConsulta'));
    const formEditar = document.getElementById('formEditarConsulta');
    const toastEl = document.getElementById('toastAviso');
    const toastInstance = new bootstrap.Toast(toastEl);
    const toastMsg = document.getElementById('toast-msg');

    let consultasCache = [];    
    let pacientesCache = [];
    const itensPorPagina = 5; 
    let consultasFiltradas = []; 
    let paginaAtual = 1;
    let pacientesFiltrados = [];
    let paginaAtualPacientes = 1;

    // NOTIFICAÇÕES
    function mostrarNotificacao(mensagem, tipo = 'success') {
        toastMsg.innerText = mensagem;
        toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning');
        if(tipo === 'success') toastEl.classList.add('bg-success');
        if(tipo === 'error') toastEl.classList.add('bg-danger');
        toastInstance.show();
    }

    // NAVEGAÇÃO
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

    // LOADERS
    async function preloadPacientes() {
        try {
            const res = await fetch('/api/pacientes');
            pacientesCache = await res.json();
            return pacientesCache;
        } catch (err) { console.error(err); return []; }
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
            // Oculta Concluído e Cancelado inicialmente
            consultasFiltradas = data.filter(c => c.status !== 'Concluído' && c.status !== 'Cancelado');
            paginaAtual = 1;
            atualizarVisualizacao();
        } catch (err) { console.error(err); }
    }

    // --- FILTROS INTELIGENTES (MÉDICO) ---
    const btnBuscar = document.getElementById('btn-buscar');
    const inputFiltro = document.getElementById('filtro-texto');
    const selectFiltro = document.getElementById('filtro-campo');
    
    function aplicarFiltro() {
        const campo = selectFiltro.value;
        const texto = inputFiltro.value.toLowerCase().trim();
        
        consultasFiltradas = consultasCache.filter(c => {
            if (c.status === 'Concluído' || c.status === 'Cancelado') return false; 
            if (!texto) return true;

            // Lógica de Data (Ignora barras e traços)
            if ((campo === 'datahora' || campo === 'todos') && c.datahora) {
                const [datePart] = c.datahora.split('T'); // "2025-10-25"
                if(datePart) {
                    const [ano, mes, dia] = datePart.split('-');
                    const dataBR = `${dia}${mes}${ano}`; // "25102025"
                    const textoLimpo = texto.replace(/\D/g, ''); // "20"
                    
                    if (dataBR.includes(textoLimpo) && textoLimpo.length > 0) return true;
                }
            }

            // Busca Textual
            if (campo === 'todos') {
                return String(c.id).includes(texto) ||
                       String(c.medico_id).includes(texto) ||
                       (c.paciente_nome && c.paciente_nome.toLowerCase().includes(texto)) ||
                       (c.cpf && String(c.cpf).includes(texto));
            }

            if (campo !== 'datahora') {
                return String(c[campo] || '').toLowerCase().includes(texto);
            }
            return false;
        });
        
        paginaAtual = 1;
        atualizarVisualizacao();
    }
    
    if(btnBuscar) btnBuscar.addEventListener('click', aplicarFiltro);
    if(inputFiltro) inputFiltro.addEventListener('keyup', (e) => { if(e.key==='Enter') aplicarFiltro(); });

    // Filtros Pacientes
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

    // RENDERIZAÇÃO CONSULTAS
    const btnAnt = document.getElementById('btn-ant');
    const btnProx = document.getElementById('btn-prox');
    if(btnAnt) btnAnt.addEventListener('click', () => { if (paginaAtual > 1) { paginaAtual--; atualizarVisualizacao(); }});
    if(btnProx) btnProx.addEventListener('click', () => { if (paginaAtual < Math.ceil(consultasFiltradas.length/itensPorPagina)) { paginaAtual++; atualizarVisualizacao(); }});

    function atualizarVisualizacao() {
        if(!tabelaConsultas) return;
        tabelaConsultas.innerHTML = '';
        const total = consultasFiltradas.length;
        const totalPaginas = Math.ceil(total / itensPorPagina);
        if (paginaAtual < 1) paginaAtual = 1;
        if (paginaAtual > totalPaginas && totalPaginas > 0) paginaAtual = totalPaginas;
        const inicio = (paginaAtual - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const dados = consultasFiltradas.slice(inicio, fim);

        if (total === 0) {
            tabelaConsultas.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-muted">Nenhuma consulta encontrada.</td></tr>';
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
            let badge = c.status === 'Agendado' ? 'bg-primary' : 'bg-secondary';
            if(c.status === 'Concluído') badge = 'bg-success';
            if(c.status === 'Cancelado') badge = 'bg-danger';
            
            tr.innerHTML = `
                <td>${c.id}</td>
                <td>${c.medico_id}</td>
                <td class="fw-bold text-dark">${c.paciente_nome}</td>
                <td>${c.paciente_contato}</td>
                <td>${c.cpf}</td>
                <td>${dataFmt}</td>
                <td class="text-truncate" style="max-width: 150px;" title="${c.observacoes}">${c.observacoes||'-'}</td>
                <td><span class="badge ${badge}">${c.status}</span></td>
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
        const mostrarAte = Math.min(fim, total);
        document.getElementById('info-paginacao').innerText = `Mostrando ${inicio + 1} - ${mostrarAte} de ${total}`;
        if(btnAnt) btnAnt.disabled = (paginaAtual === 1);
        if(btnProx) btnProx.disabled = (paginaAtual === totalPaginas || totalPaginas === 0);
    }

    // RENDERIZAÇÃO PACIENTES
    const btnAntPac = document.getElementById('btn-ant-pac');
    const btnProxPac = document.getElementById('btn-prox-pac');
    if(btnAntPac) btnAntPac.addEventListener('click', () => { if (paginaAtualPacientes > 1) { paginaAtualPacientes--; atualizarVisualizacaoPacientes(); }});
    if(btnProxPac) btnProxPac.addEventListener('click', () => { if (paginaAtualPacientes < Math.ceil(pacientesFiltrados.length/itensPorPagina)) { paginaAtualPacientes++; atualizarVisualizacaoPacientes(); }});

    function atualizarVisualizacaoPacientes() {
        if(!tabelaPacientes) return;
        tabelaPacientes.innerHTML = '';
        const total = pacientesFiltrados.length;
        const totalPaginas = Math.ceil(total / itensPorPagina);
        if (paginaAtualPacientes < 1) paginaAtualPacientes = 1;
        if (paginaAtualPacientes > totalPaginas && totalPaginas > 0) paginaAtualPacientes = totalPaginas;
        const inicio = (paginaAtualPacientes - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const dados = pacientesFiltrados.slice(inicio, fim);

        if (total === 0) {
            tabelaPacientes.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-muted">Nenhum paciente.</td></tr>';
            document.getElementById('info-paginacao-pac').innerText = 'Mostrando 0 - 0 de 0';
            if(btnAntPac) btnAntPac.disabled = true;
            if(btnProxPac) btnProxPac.disabled = true;
            return;
        }
        dados.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${p.id}</td><td class="fw-bold">${p.nome}</td><td>${p.cpf}</td><td>${p.nascimento||"-"}</td><td>${p.peso||"-"}</td><td>${p.altura||"-"}</td>`;
            tabelaPacientes.appendChild(tr);
        });
        const itemFinal = Math.min(fim, total);
        document.getElementById('info-paginacao-pac').innerText = `Mostrando ${inicio + 1} - ${itemFinal} de ${total}`;
        if(btnAntPac) btnAntPac.disabled = (paginaAtualPacientes === 1);
        if(btnProxPac) btnProxPac.disabled = (paginaAtualPacientes === totalPaginas || totalPaginas === 0);
    }

    // CRUD
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
                if(res.ok) { modalEditar.hide(); mostrarNotificacao('Atualizado!'); loadConsultas(); } 
                else { mostrarNotificacao('Erro!', 'error'); }
            } catch(err) { console.error(err); }
        });
    }
    async function deletarConsulta(id) {
        try {
            const res = await fetch(`/api/consultas/${id}`, { method: 'DELETE' });
            if(res.ok) { mostrarNotificacao('Excluído!'); loadConsultas(); } 
            else { mostrarNotificacao('Erro!', 'error'); }
        } catch(err) { console.error(err); }
    }
    loadConsultas();
});