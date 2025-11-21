// static/js/main.js
document.addEventListener('DOMContentLoaded', function () {
  const navLinks = document.querySelectorAll('nav .nav-link');
  const sections = document.querySelectorAll('.conteudo-secao');

  navLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      // remove active de todos
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');

      // esconder todas as seções
      sections.forEach(sec => sec.classList.add('escondido'));

      // mostrar seção correspondente
      if (this.textContent.includes('Agendar')) {
        document.getElementById('agendar').classList.remove('escondido');
      } else if (this.textContent.includes('Cadastrar')) {
        document.getElementById('cadastro').classList.remove('escondido');
      } else if (this.textContent.includes('Listar')) {
        document.getElementById('consultas').classList.remove('escondido'); 
      }
    });
  });
});
