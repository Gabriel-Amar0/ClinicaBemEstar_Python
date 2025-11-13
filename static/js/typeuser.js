document.addEventListener('DOMContentLoaded', function() {
  // ============================
  // CONFIGURAÇÃO DO TOAST
  // ============================
  const toastEl = document.getElementById('toastSuccess');
  const toastBody = document.getElementById('toastMessage');
  const toast = toastEl ? new bootstrap.Toast(toastEl) : null;

  function mostrarToast(mensagem, tipo = 'success') {
    if (!toastEl || !toastBody) return alert(mensagem); // fallback se algo estiver errado
    toastEl.className = `toast align-items-center text-bg-${tipo} border-0`;
    toastBody.textContent = mensagem;
    toast.show();
  }

  // ============================
  // LOGIN
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
  // NAVEGAÇÃO ENTRE SEÇÕES
  // ============================
  const navLinks = document.querySelectorAll('nav .nav-link');
  const sections = document.querySelectorAll('.conteudo-secao');

  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
      sections.forEach(sec => sec.classList.add('escondido'));

      if (this.textContent.includes('Agendar')) {
        document.getElementById('agendar').classList.remove('escondido');
      } else if (this.textContent.includes('Cadastrar')) {
        document.getElementById('cadastro').classList.remove('escondido');
      } else if (this.textContent.includes('Listar')) {
        document.getElementById('consultas').classList.remove('escondido');
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
    const tabelaConsultasBody = document.querySelector('#tabelaConsultas tbody');
    const formEditar = document.getElementById('formEditar');
    let consultaEditando = null;

    async function loadPacientes() {
      const res = await fetch('/api/pacientes');
      const pacs = await res.json();
      selectPaciente.innerHTML = '';
      pacs.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.cpf;
        opt.textContent = `${p.nome} (CPF: ${p.cpf})`;
        selectPaciente.appendChild(opt);
      });
    }

    async function loadConsultas() {
      const res = await fetch('/api/consultas');
      const consultas = await res.json();
      tabelaConsultasBody.innerHTML = '';
      consultas.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${c.id}</td>
          <td>${c.medico_id}</td>
          <td>${c.paciente_nome || ''}</td>
          <td>${c.paciente_contato || ''}</td>
          <td>${c.cpf}</td>
          <td>${c.datahora}</td>
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
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(paciente)
      });
      if (res.ok) {
        await loadPacientes();
        mostrarToast('Paciente cadastrado com sucesso!', 'success');
        formCadastro.reset();
      } else {
        mostrarToast('Erro ao cadastrar paciente', 'danger');
      }
    });

    // Agendar consulta
    formAgendar.addEventListener('submit', async (e) => {
      e.preventDefault();
      const consulta = {
        cpf: document.getElementById('form-paciente').value,
        datahora: document.getElementById('form-datahora').value,
        observacoes: document.getElementById('form-obs').value,
        medico_id: document.getElementById('form-medico').value
      };
      const res = await fetch('/api/consultas', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(consulta)
      });
      if (res.ok) {
        await loadConsultas();
        mostrarToast('Consulta agendada com sucesso!', 'success');
        formAgendar.reset();
      } else {
        mostrarToast('Erro ao agendar consulta', 'danger');
      }
    });

    // Editar e excluir consulta
    tabelaConsultasBody.addEventListener('click', async (e) => {
      if (e.target.classList.contains('btn-delete')) {
        const id = e.target.dataset.id;
        if (!confirm('Confirma exclusão?')) return;
        const res = await fetch(`/api/consultas/${id}`, { method: 'DELETE' });
        if (res.ok) {
          await loadConsultas();
          mostrarToast('Consulta excluída com sucesso!', 'success');
        } else {
          mostrarToast('Erro ao excluir consulta', 'danger');
        }
      }

      if (e.target.classList.contains('btn-edit')) {
        const id = e.target.dataset.id;
        consultaEditando = id;
        const res = await fetch('/api/consultas');
        const consultas = await res.json();
        const c = consultas.find(x => x.id == id);
        if (!c) return;

        document.getElementById('edit-nome').value = c.paciente_nome || '';
        document.getElementById('edit-contato').value = c.paciente_contato || '';
        document.getElementById('edit-cpf').value = c.cpf;
        document.getElementById('edit-datahora').value = c.datahora;
        document.getElementById('edit-obs').value = c.observacoes;
        document.getElementById('edit-status').value = c.status;

        const modal = new bootstrap.Modal(document.getElementById('modalEditar'), {
          backdrop: 'static',
          keyboard: false
        });
        modal.show();
      }
    });

    // Salvar edição
    formEditar.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!consultaEditando) return;
      const dados = {
        datahora: document.getElementById('edit-datahora').value,
        observacoes: document.getElementById('edit-obs').value,
        status: document.getElementById('edit-status').value
      };
      const res = await fetch(`/api/consultas/${consultaEditando}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(dados)
      });
      if (res.ok) {
        await loadConsultas();
        consultaEditando = null;
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditar'));
        modal.hide();
        mostrarToast('Consulta atualizada com sucesso!', 'info');
      } else {
        mostrarToast('Erro ao atualizar consulta', 'danger');
      }
    });

    // Carregar dados iniciais
    loadPacientes();
    loadConsultas();
  }
});
