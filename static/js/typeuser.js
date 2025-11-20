document.addEventListener('DOMContentLoaded', function() {
  // ============================
  // CONFIGURAÇÃO DO TOAST
  // ============================
  const toastEl = document.getElementById('toastSuccess');
  const toastBody = document.getElementById('toastMessage');
  const toast = toastEl ? new bootstrap.Toast(toastEl) : null;

  function mostrarToast(mensagem, tipo = 'success') {
    if (!toastEl || !toastBody) return alert(mensagem); // fallback
    // preservar classes úteis e garantir apenas mudança do tema
    toastEl.className = `toast align-items-center text-bg-${tipo} border-0`;
    toastBody.textContent = mensagem;
    toast.show();
  }

  // ============================
  // LOGIN (mantive seu código)
  // ============================
  const roleAtendente = document.getElementById('roleAtendente');
  const roleMedico = document.getElementById('roleMedico');
  const loginForm = document.getElementById('loginForm');

  if (roleAtendente && roleMedico && loginForm) {
    let userRole = '';

    roleAtendente.addEventListener('click', () => {
      userRole = 'Atendente';
      roleAtendente.classList.add('active-role');
      roleMedico.classList.remove('active-role');
    });

    roleMedico.addEventListener('click', () => {
      userRole = 'Medico';
      roleMedico.classList.add('active-role');
      roleAtendente.classList.remove('active-role');
    });

    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const senha = document.getElementById('senha').value.trim();

      if (!userRole) {
        mostrarToast('Selecione o tipo de usuário antes de entrar!', 'warning');
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
        mostrarToast(err.message, 'danger');
      }
    });
  }

  // ============================
// NAVEGAÇÃO ENTRE SEÇÕES (Atualizado)
// ============================
const navLinks = document.querySelectorAll('nav .nav-link');
const sections = document.querySelectorAll('.conteudo-secao');

navLinks.forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    navLinks.forEach(l => l.classList.remove('active'));
    this.classList.add('active');
    sections.forEach(sec => sec.classList.add('escondido'));

    const texto = this.textContent;

    if (texto.includes('Agendar')) {
      document.getElementById('agendar').classList.remove('escondido');
    } else if (texto.includes('Cadastrar')) {
      document.getElementById('cadastro').classList.remove('escondido');
    } else if (texto.includes('Listar Consultas')) { // Ajustado para ser específico
      document.getElementById('consultas').classList.remove('escondido');
    } else if (texto.includes('Listar Pacientes')) { // NOVA LÓGICA
      document.getElementById('listar-pacientes').classList.remove('escondido');
    }
  });
});

  // ============================
  // ATENDENTE: PACIENTES & CONSULTAS
  // ============================
  if (document.getElementById('formCadastro')) {
    const formCadastro = document.getElementById('formCadastro');
    const formAgendar = document.getElementById('formAgendar');
    const selectPaciente = document.getElementById('form-paciente');
    const tabelaPacientesBody = document.querySelector('#tabelaPacientesMain tbody');
    const tabelaConsultasBody = document.querySelector('#tabelaConsultas tbody');
    const formEditar = document.getElementById('formEditar');
    let consultaEditando = null;
    let pacienteEditandoCPF = null;

    // ====== Config paginação ======
    const ITEMS_PER_PAGE = 5;
    let consultasCache = []; // cache local para checagens e paginação
    let consultasFiltradas = [];
    let pacientesCache = [];
    let pacientesFiltrados = [];
    let consultasPage = 1;

    // criar modal de pacientes dinamicamente (para não alterar HTML)
    function criarModalPacientes() {
      if (document.getElementById('modalPacientes')) return;
      const modalHtml = `
      <div class="modal fade" id="modalPacientes" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">Pacientes Cadastrados</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div id="listaPacientesContainer" class="table-responsive">
                <!-- tabela injetada por JS -->
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
            </div>
          </div>
        </div>
      </div>`;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // injetar botão "Ver Pacientes" abaixo do form de cadastro (sem alterar HTML original)
    function inserirBotaoVerPacientes() {
      const existing = document.getElementById('btnVerPacientes');
      if (existing) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btnVerPacientes';
      btn.className = 'btn btn-outline-primary mt-3';
      btn.textContent = 'Ver Pacientes';
     
    }

    // carrega pacientes do servidor e popula select e cache
    async function loadPacientes() {
      try {
        const res = await fetch('/api/pacientes');
        const pacs = await res.json();
        pacientesCache = pacs || [];
        
        // INICIALIZA A LISTA FILTRADA COM TUDO QUE VEIO DO BANCO
        pacientesFiltrados = [...pacientesCache];

        // Atualiza o select do Agendamento
        if (selectPaciente) {
            selectPaciente.innerHTML = '<option value="" selected disabled>Selecione</option>';
            pacs.forEach(p => {
              const opt = document.createElement('option');
              opt.value = p.cpf;
              opt.textContent = `${p.nome} (CPF: ${p.cpf})`;
              selectPaciente.appendChild(opt);
            });
        }

        renderizarTabelaPacientesMain();
        // Se o modal antigo estiver aberto, atualiza ele também
        if (typeof montarTabelaPacientes === 'function') montarTabelaPacientes(); 

      } catch (err) {
        console.error('Erro ao carregar pacientes:', err);
      }
    }

    // Função para renderizar a tabela na seção principal
function renderizarTabelaPacientesMain() {
      if (!tabelaPacientesBody) return;
      tabelaPacientesBody.innerHTML = '';

      // AGORA USA A LISTA FILTRADA
      if (pacientesFiltrados.length === 0) {
        tabelaPacientesBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhum paciente encontrado na busca.</td></tr>';
        return;
      }

      pacientesFiltrados.forEach(p => {
        const tr = document.createElement('tr');
        
        // Formatação da data para exibição (para ficar bonito na tabela)
        let nascFormatado = p.nascimento;
        try {
           if(p.nascimento && p.nascimento.includes('-')) {
             const [ano, mes, dia] = p.nascimento.split('-');
             nascFormatado = `${dia}/${mes}/${ano}`;
           }
        } catch(e){}

        tr.innerHTML = `
          <td>${p.id || '-'}</td>
          <td>${p.nome}</td>
          <td>${p.cpf}</td>
          <td>${nascFormatado}</td>
          <td>${p.peso}</td>
          <td>${p.altura}</td>
          <td>
            <button class="btn btn-sm btn-primary btn-edit-paciente-main" data-cpf="${p.cpf}">Editar</button>
            <button class="btn btn-sm btn-danger btn-delete-paciente-main" data-cpf="${p.cpf}">Excluir</button>
          </td>
        `;
        tabelaPacientesBody.appendChild(tr);
      });
    }

    // LÓGICA DE BUSCA DE PACIENTES
    const formBuscaPac = document.getElementById('formBuscaPaciente');
    if (formBuscaPac) {
      formBuscaPac.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const campo = document.getElementById('busca-paciente-campo').value;
        const termo = document.getElementById('busca-paciente-valor').value.trim().toLowerCase();

        if (termo === '') {
          pacientesFiltrados = [...pacientesCache];
        } else {
          pacientesFiltrados = pacientesCache.filter(p => {
            let valorOriginal = p[campo];

            // TRUQUE DA DATA:
            // O banco guarda "2000-01-25", mas o usuário busca por "25/01/2000"
            // Convertemos para o formato brasileiro antes de comparar
            if (campo === 'nascimento' && valorOriginal && valorOriginal.includes('-')) {
                 const [ano, mes, dia] = valorOriginal.split('-');
                 valorOriginal = `${dia}/${mes}/${ano}`;
            }

            const valorString = String(valorOriginal || '').toLowerCase();
            return valorString.includes(termo);
          });
        }

        renderizarTabelaPacientesMain();
      });
    }

if (tabelaPacientesBody) {
    tabelaPacientesBody.addEventListener('click', async (e) => {
      
      // 1. Lógica do botão EXCLUIR
      if (e.target.classList.contains('btn-delete-paciente-main')) {
        const cpf = e.target.dataset.cpf;
        if (!confirm('Confirma exclusão do paciente?')) return;
        
        try {
          const res = await fetch(`/api/pacientes/${encodeURIComponent(cpf)}`, { method: 'DELETE' });
          if (res.ok) {
            mostrarToast('Paciente excluído com sucesso!', 'success');
            await atualizarTudoImediato(); // Recarrega a lista
          } else {
            mostrarToast('Erro ao excluir paciente', 'danger');
          }
        } catch (err) {
          console.error(err);
          mostrarToast('Erro de conexão', 'danger');
        }
      }

      // 2. Lógica do botão EDITAR
      if (e.target.classList.contains('btn-edit-paciente-main')) {
        const cpf = e.target.dataset.cpf;
        // Busca os dados completos do paciente no cache
        const paciente = pacientesCache.find(p => p.cpf === cpf);
        
        if (paciente) {
          // Reutiliza a função que já existe para abrir o modal!
          abrirModalEditarPaciente(paciente); 
        }
      }
    });
  }


    // montar tabela de pacientes dentro do modal
    function montarTabelaPacientes() {
      const container = document.getElementById('listaPacientesContainer');
      if (!container) return;
      const rows = pacientesCache.map(p => {
        return `
        <tr data-cpf="${p.cpf}">
          <td>${p.nome}</td>
          <td>${p.cpf}</td>
          <td>${p.telefone || ''}</td>
          <td>${p.nascimento || ''}</td>
          <td>
            <button class="btn btn-sm btn-primary btn-edit-paciente" data-cpf="${p.cpf}">Editar</button>
            <button class="btn btn-sm btn-danger btn-delete-paciente" data-cpf="${p.cpf}">Excluir</button>
          </td>
        </tr>`;
      }).join('');

      container.innerHTML = `
        <table class="table table-striped">
          <thead>
            <tr><th>Nome</th><th>CPF</th><th>Contato</th><th>Nascimento</th><th>Ações</th></tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" class="text-center">Nenhum paciente cadastrado</td></tr>'}
          </tbody>
        </table>
      `;

      // anexar listeners para editar/excluir
      container.querySelectorAll('.btn-delete-paciente').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          const cpf = ev.currentTarget.dataset.cpf;
          if (!confirm('Confirma exclusão do paciente? Isso também pode afetar consultas vinculadas.')) return;
          try {
            const res = await fetch(`/api/pacientes/${encodeURIComponent(cpf)}`, { method: 'DELETE' });
            if (res.ok) {
              mostrarToast('Paciente excluído com sucesso!', 'success');
              await atualizarTudoImediato();
            } else {
              mostrarToast('Erro ao excluir paciente', 'danger');
            }
          } catch (err) {
            console.error(err);
            mostrarToast('Erro ao excluir paciente', 'danger');
          }
        });
      });

      container.querySelectorAll('.btn-edit-paciente').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          const cpf = ev.currentTarget.dataset.cpf;
          const paciente = pacientesCache.find(p => p.cpf === cpf);
          if (!paciente) return;
          abrirModalEditarPaciente(paciente);
        });
      });
    }

    // cria modal de edição de paciente (reutilizável)
    function abrirModalEditarPaciente(paciente) {
      const form = document.getElementById('formEditarPaciente');
      if (!form) return;

      // Guarda o CPF original para usar na URL depois
      pacienteEditandoCPF = paciente.cpf;

      // Preencher campos
      document.getElementById('edit-paciente-nome').value = paciente.nome || '';
      document.getElementById('edit-paciente-cpf').value = paciente.cpf || '';
      document.getElementById('edit-paciente-nasc').value = paciente.nascimento || '';
      document.getElementById('edit-paciente-telefone').value = paciente.telefone || '';
      document.getElementById('edit-paciente-endereco').value = paciente.endereco || '';
      document.getElementById('edit-paciente-peso').value = paciente.peso || '';
      document.getElementById('edit-paciente-altura').value = paciente.altura || '';

      const modal = new bootstrap.Modal(document.getElementById('modalEditarPaciente'), {
        backdrop: 'static',
        keyboard: false
      });
      modal.show();
    }

    const formEditarPaciente = document.getElementById('formEditarPaciente');
    if (formEditarPaciente) {
      formEditarPaciente.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        
        if (!pacienteEditandoCPF) return; 

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
          // Usa o CPF antigo na URL para achar o registro correto
          const res = await fetch(`/api/pacientes/${encodeURIComponent(pacienteEditandoCPF)}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            mostrarToast('Paciente atualizado com sucesso!', 'success');
            
            // Fechar modal e limpar variável
            const modalEl = document.getElementById('modalEditarPaciente');
            const modalInst = bootstrap.Modal.getInstance(modalEl);
            if (modalInst) modalInst.hide();
            
            pacienteEditandoCPF = null; // Boa prática: limpar após uso
            await atualizarTudoImediato(); 
          } else {
            const err = await res.json();
            mostrarToast(err.message || 'Erro ao atualizar paciente', 'danger');
          }
        } catch (err) {
          console.error(err);
          mostrarToast('Erro de conexão', 'danger');
        }
      });
    }

    // carregar consultas do servidor e popular tabela com paginação
    async function loadConsultas(page = 1) {
      try {
        const res = await fetch('/api/consultas');
        const consultas = await res.json();
        consultasCache = consultas || [];
        
        // Se não houver busca ativa, a lista filtrada é igual à original
        consultasFiltradas = [...consultasCache]; 
        
        consultasPage = page;
        renderConsultasPage(); // Agora chama o render usando a lista filtrada
      } catch (err) {
        console.error('Erro ao carregar consultas:', err);
      }
    }

    function renderConsultasPage() {
      tabelaConsultasBody.innerHTML = '';
      
      // Usamos consultasFiltradas para saber o total
      const totalItems = consultasFiltradas.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

      if (consultasCache.length === 0) {
        tabelaConsultasBody.innerHTML = '<tr><td colspan="11" class="text-center">Nenhuma consulta cadastrada.</td></tr>';
        return;
      }

      // Ajuste de segurança se a busca reduzir as páginas e estivermos numa página alta
      if (consultasPage > totalPages) consultasPage = 1;

      const start = (consultasPage - 1) * ITEMS_PER_PAGE;
      
      // O "slice" agora é feito na lista FILTRADA
      const pageItems = consultasFiltradas.slice(start, start + ITEMS_PER_PAGE);

      if (pageItems.length === 0) {
        tabelaConsultasBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Nenhuma consulta encontrada na busca.</td></tr>';
      } else {
        pageItems.forEach(c => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${c.id}</td>
            <td>${c.medico_id}</td>
            <td>${c.paciente_nome || ''}</td>
            <td>${c.paciente_contato || ''}</td>
            <td>${c.cpf}</td>
            <td>${formataDataHoraParaExibir(c.datahora)}</td>
            <td>${c.observacoes}</td>
            <td>${c.status}</td>
            <td>
              <button class="btn btn-sm btn-primary btn-edit" data-id="${c.id}">Editar</button>
              <button class="btn btn-sm btn-danger btn-delete" data-id="${c.id}">Excluir</button>
            </td>
          `;
          tabelaConsultasBody.appendChild(tr);
        });
      }

      // Pager (Atualizado para usar consultasFiltradas)
      const tableWrapper = document.getElementById('tabelaConsultas').parentElement;
      let pager = document.getElementById('consultasPager');
      if (pager) pager.remove();
      
      pager = document.createElement('div');
      pager.id = 'consultasPager';
      pager.className = 'd-flex justify-content-between align-items-center mt-2';
      
      // Texto de exibição corrigido
      const endItem = Math.min(totalItems, start + pageItems.length);
      const startItem = totalItems === 0 ? 0 : start + 1;

      pager.innerHTML = `
        <div>Mostrando ${startItem} - ${endItem} de ${totalItems}</div>
        <div>
          <button class="btn btn-sm btn-outline-secondary me-1" id="prevPage" ${consultasPage <= 1 ? 'disabled' : ''}>Anterior</button>
          <span class="mx-2">Página ${consultasPage} / ${totalPages}</span>
          <button class="btn btn-sm btn-outline-secondary ms-1" id="nextPage" ${consultasPage >= totalPages ? 'disabled' : ''}>Próxima</button>
        </div>
      `;
      tableWrapper.parentElement.appendChild(pager);

      document.getElementById('prevPage').addEventListener('click', () => {
        if (consultasPage > 1) {
          consultasPage--;
          renderConsultasPage();
        }
      });
      document.getElementById('nextPage').addEventListener('click', () => {
        if (consultasPage < totalPages) {
          consultasPage++;
          renderConsultasPage();
        }
      });
    }

    // LOGICA DE BUSCA DE CONSULTAS
    const formBusca = document.getElementById('formBuscaConsulta');
    if (formBusca) {
      formBusca.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const campo = document.getElementById('busca-campo').value; // ex: paciente_nome
        const termo = document.getElementById('busca-valor').value.trim().toLowerCase();

        // Se o campo estiver vazio, restaura a lista completa
        if (termo === '') {
          consultasFiltradas = [...consultasCache];
        } else {
          // Filtra o consultasCache
          consultasFiltradas = consultasCache.filter(c => {
            // Pega o valor do objeto (ex: c.paciente_nome)
            let valorOriginal = c[campo];
            
            // Tratamento especial para data (se o usuário digitar parte da data)
            if (campo === 'datahora') {
               valorOriginal = formataDataHoraParaExibir(c.datahora);
            }

            // Converte para string e minúsculo para comparar
            const valorString = String(valorOriginal || '').toLowerCase();
            return valorString.includes(termo);
          });
        }

        // Volta para a página 1 e renderiza
        consultasPage = 1;
        renderConsultasPage();
      });
    }

    // formata datahora para exibição legível (tenta aceitar ISO ou já formatado)
    function formataDataHoraParaExibir(datahora) {
      // se vier no formato 'YYYY-MM-DDTHH:mm' ou 'YYYY-MM-DD HH:mm:SS' etc.
      if (!datahora) return '';
      // tentar converter ISO-like em local string sem alterar timezone (assumindo backend entrega local)
      try {
        // se já contém 'T', criar Date
        const t = datahora.includes('T') ? datahora : datahora.replace(' ', 'T');
        const dt = new Date(t);
        if (!isNaN(dt.getTime())) {
          // dd/mm/yyyy hh:mm
          const dd = String(dt.getDate()).padStart(2, '0');
          const mm = String(dt.getMonth()+1).padStart(2, '0');
          const yyyy = dt.getFullYear();
          const hh = String(dt.getHours()).padStart(2, '0');
          const min = String(dt.getMinutes()).padStart(2, '0');
          return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
        }
      } catch (err) { /* ignore */ }
      return datahora;
    }

    // Cadastrar paciente
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
        if (res.ok) {
          await atualizarTudoImediato();
          mostrarToast('Paciente cadastrado com sucesso!', 'success');
          formCadastro.reset();
        } else {
          const json = await res.json().catch(()=>({}));
          mostrarToast(json.message || 'Erro ao cadastrar paciente', 'danger');
        }
      } catch (err) {
        console.error(err);
        mostrarToast('Erro ao cadastrar paciente', 'danger');
      }
    });

    // Agendar consulta com verificação de conflito
    formAgendar.addEventListener('submit', async (e) => {
      e.preventDefault();
      const consulta = {
        cpf: document.getElementById('form-paciente').value,
        datahora: document.getElementById('form-datahora').value,
        observacoes: document.getElementById('form-obs').value,
        medico_id: document.getElementById('form-medico').value,
        pagamento: document.getElementById('form-pagamento').value
      };

      // validação básica
      if (!consulta.cpf || !consulta.datahora || !consulta.medico_id) {
        mostrarToast('Preencha todos os campos', 'warning');
        return;
      }

      // checar conflitos localmente (com cache)
      const conflito = consultasCache.some(c => {
        // comparar mesmo medico e mesma data/hora (string compare)
        return String(c.medico_id) === String(consulta.medico_id) && normalizeDateTime(c.datahora) === normalizeDateTime(consulta.datahora);
      });

      if (conflito) {
        mostrarToast('Já existe uma consulta agendada para esse médico nesse horário.', 'warning');
        return;
      }

      // enviar
      try {
        const res = await fetch('/api/consultas', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(consulta)
        });
        if (res.ok) {
          await atualizarTudoImediato();
          mostrarToast('Consulta agendada com sucesso!', 'success');
          formAgendar.reset();
        } else {
          const json = await res.json().catch(()=>({}));
          mostrarToast(json.message || 'Erro ao agendar consulta', 'danger');
        }
      } catch (err) {
        console.error(err);
        mostrarToast('Erro ao agendar consulta', 'danger');
      }
    });

    // normaliza datetime para comparação: tenta reduzir formatos diferentes
    function normalizeDateTime(d) {
      if (!d) return '';
      // se for ISO com T, usar prefix yyyy-mm-ddTHH:MM (sem segundos)
      try {
        if (typeof d !== 'string') d = String(d);
        if (d.includes('T')) {
          return d.slice(0,16);
        }
        // converter "dd/mm/yyyy hh:mm" possivelmente vindo de exibição
        if (d.includes('/')) {
          const parts = d.split(' ');
          const date = parts[0].split('/');
          const time = (parts[1]||'00:00').slice(0,5);
          return `${date[2]}-${date[1]}-${date[0]}T${time}`;
        }
        // fallback: take first 16 chars
        return d.slice(0,16);
      } catch (err) {
        return d.slice(0,16);
      }
    }

    // Editar e excluir consulta (delegado)
    tabelaConsultasBody.addEventListener('click', async (e) => {
      if (e.target.classList.contains('btn-delete')) {
        const id = e.target.dataset.id;
        if (!confirm('Confirma exclusão?')) return;
        try {
          const res = await fetch(`/api/consultas/${id}`, { method: 'DELETE' });
          if (res.ok) {
            await atualizarTudoImediato();
            mostrarToast('Consulta excluída com sucesso!', 'success');
          } else {
            mostrarToast('Erro ao excluir consulta', 'danger');
          }
        } catch (err) {
          console.error(err);
          mostrarToast('Erro ao excluir consulta', 'danger');
        }
      }

      if (e.target.classList.contains('btn-edit')) {
        const id = e.target.dataset.id;
        consultaEditando = id;
        // buscar a consulta no cache
        const c = consultasCache.find(x => String(x.id) === String(id));
        if (!c) return;

        document.getElementById('edit-nome').value = c.paciente_nome || '';
        document.getElementById('edit-contato').value = c.paciente_contato || '';
        document.getElementById('edit-cpf').value = c.cpf;
        // colocar datahora em input adequado (se possível)
        const editDataInput = document.getElementById('edit-datahora');
        // preferimos datetime-local; se input for text, tentamos manter formato legível
        try {
          // converte para yyyy-mm-ddThh:mm (valor aceito por datetime-local)
          const normalized = normalizeDateTime(c.datahora);
          if (editDataInput.type === 'text') {
            editDataInput.value = c.datahora;
          } else {
            editDataInput.value = normalized;
          }
        } catch (err) {
          editDataInput.value = c.datahora;
        }
        document.getElementById('edit-obs').value = c.observacoes;
        document.getElementById('edit-status').value = c.status;
        document.getElementById('edit-pagamento').value = c.pagamento || 'Dinheiro';

        const modal = new bootstrap.Modal(document.getElementById('modalEditar'), {
          backdrop: 'static',
          keyboard: false
        });
        modal.show();
      }
    });

    // Salvar edição de consulta com checagem de conflito (se datahora mudou)
    formEditar.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!consultaEditando) return;
      const dados = {
      nome: document.getElementById('edit-nome').value,
      cpf: document.getElementById('edit-cpf').value,
      paciente_contato: document.getElementById('edit-contato').value,
      datahora: document.getElementById('edit-datahora').value,
      observacoes: document.getElementById('edit-obs').value,
      status: document.getElementById('edit-status').value,
      pagamento: document.getElementById('edit-pagamento').value
      };

      // verificar conflito: se novo horário coincide com outro agendamento do mesmo médico (exceto a própria consulta)
      const consultaOriginal = consultasCache.find(c => String(c.id) === String(consultaEditando));
      const medicoId = consultaOriginal ? String(consultaOriginal.medico_id) : null;
      const novoNormalized = normalizeDateTime(dados.datahora);

      const conflito = consultasCache.some(c => {
        if (String(c.id) === String(consultaEditando)) return false;
        return String(c.medico_id) === medicoId && normalizeDateTime(c.datahora) === novoNormalized;
      });

      if (conflito) {
        mostrarToast('Conflito: outro agendamento já existe para esse médico neste horário.', 'warning');
        return;
      }

      try {
        const res = await fetch(`/api/consultas/${consultaEditando}`, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(dados)
        });
        if (res.ok) {
          await atualizarTudoImediato();
          consultaEditando = null;
          const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditar'));
          if (modal) modal.hide();
          mostrarToast('Consulta atualizada com sucesso!', 'info');
        } else {
          mostrarToast('Erro ao atualizar consulta', 'danger');
        }
      } catch (err) {
        console.error(err);
        mostrarToast('Erro ao atualizar consulta', 'danger');
      }
    });

    // Atualiza pacientes e consultas imediatamente (usado pós-op)
    async function atualizarTudoImediato() {
      await Promise.all([loadPacientes(), loadConsultas(consultasPage)]);
      montarTabelaPacientes();
    }

   

    // converter o input de edit-datahora pra datetime-local se possível (melhora UX)
    (function ajustarInputEditDataHora() {
      const input = document.getElementById('edit-datahora');
      if (input) {
        try {
          input.type = 'datetime-local';
        } catch (err) { /* ignore */ }
      }
    })();

    // função utilitária: iniciar tudo
    (async function init() {
      inserirBotaoVerPacientes();
      await Promise.all([loadPacientes(), loadConsultas(1)]);
      montarTabelaPacientes();
      iniciarPolling();
    })();
  }
});
