

# Clínica Bem Estar 



## Descrição do Projeto

A **Clínica Bem Estar** é uma aplicação web desenvolvida para simular o sistema interno de uma clínica médica.
O projeto permite o **login e autenticação de usuários** (médicos e atendentes), redirecionando cada um para sua respectiva interface de trabalho.

A aplicação foi construída utilizando:

* **Backend** em Python com **Flask**
* **Frontend** em HTML, CSS e JavaScript
* **Base de dados** em **JSON**, contendo os cadastros de usuários e suas credenciais.

O sistema inclui:

* Página de **login** com verificação de cargo (médico ou atendente)
* Redirecionamento automático para a página correspondente após autenticação
* Controle de acesso e validação dos dados inseridos
* Layout simples e intuitivo, com foco na funcionalidade e clareza

> **Observação:** Este projeto foi desenvolvido com fins educacionais para estudo de autenticação e rotas em Flask.

---

## Equipe de Desenvolvimento

| Nome                           | User |
| ------------------------------ | --- |
| Jose Carlos Pereira Dantas | EsojSolrack |
| David Alves Do Nascimento | Dzave |
| Antonio Gabriel Amaro De Assis | Gabriel-Amar0 |

---

## Estrutura de Pastas

```
├── static/
│   ├── css/
│   │   └── style.css                  # Arquivo de estilos da aplicação
│   ├── js/
│   │   └── script.js                  # Código JavaScript de interação e validação
│   └── imagens/                       # Imagens e ícones do sistema
│
├── templates/
│   ├── index.html                     # Página inicial (login)
│   ├── medico.html                    # Interface do médico após login
│   └── atendente.html                 # Interface do atendente após login
│
├── data/
│   └── usuarios.json                  # Base de dados de usuários e senhas
│
├── app.py                             # Backend principal com Flask
└── README.md                          # Documentação do projeto
```

---

## Funcionalidades

### Sistema de Login

* Autenticação de usuários cadastrados via **JSON**
* Verificação do **tipo de usuário** selecionado (médico ou atendente)
* Exibição de mensagens de erro em caso de credenciais incorretas

### Página do Médico (`medico.html`)

* Interface específica para o usuário médico
* Espaço para exibição de dados, consultas ou informações médicas (personalizável)

### Página do Atendente (`atendente.html`)

* Interface voltada para o atendente
* Estrutura preparada para cadastro, agendamento e controle de pacientes

### Redirecionamento Dinâmico

* O Flask redireciona automaticamente o usuário para a página correta de acordo com seu cargo após o login.

---

## Arquivos Principais

### `app.py`

* Gerencia as **rotas** da aplicação e o **processo de autenticação**
* Lê o arquivo `usuarios.json` para validar credenciais
* Redireciona usuários autenticados para `medico.html` ou `atendente.html`

### `usuarios.json`

* Base de dados dos usuários cadastrados
* Estrutura de exemplo:

  ```json
  [
    {
      "usuario": "joao@medico",
      "senha": "1234",
      "cargo": "medico"
    },
    {
      "usuario": "maria@atendente",
      "senha": "abcd",
      "cargo": "atendente"
    }
  ]
  ```

### `index.html`

* Página inicial de login
* Campos de usuário, senha e seleção de cargo (com verificação de apenas um selecionado por vez)

### `script.js`

* Garante a seleção única entre “Sou Médico” e “Sou Atendente”
* Faz a validação visual e interação com o formulário

---

## Tecnologias Utilizadas

* **HTML5** – Estrutura das páginas
* **CSS3** – Estilos e layout
* **JavaScript** – Interatividade e validação de seleção
* **Python 3** – Backend da aplicação
* **Flask** – Framework web para rotas e autenticação
* **JSON** – Armazenamento simples de usuários

---

## Como Rodar o Projeto

### 1. Instalar o Python

Verifique se o Python 3 está instalado:

```bash
python --version
```

Se necessário, baixe em: [https://www.python.org/downloads/](https://www.python.org/downloads/)

---

### 2. Instalar o Flask

No terminal, execute:

```bash
pip install flask
```

---

### 3. Executar o Servidor

Navegue até a pasta do projeto:

```bash
cd caminho/para/ClinicaBemEstar_Python
```

Execute o backend:

```bash
python app.py
```

O servidor Flask iniciará em modo debug na porta **5000**.

---

### 4. Acessar no Navegador

Abra o navegador e acesse:

```
http://127.0.0.1:5000/
```

Você verá a tela de login da **Clínica Bem Estar**.

---

## Licença

Projeto desenvolvido com fins **didáticos**.
Todo o código é livre para estudo, modificação e aprimoramento.

---
