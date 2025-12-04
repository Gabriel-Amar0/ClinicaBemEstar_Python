from flask import Flask, render_template, request, redirect, url_for, jsonify, session
import os
import json
from datetime import datetime
from functools import wraps

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = 'troque-esta-chave-por-uma-segura'

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'db.json')


# ========================
# BANCO DE DADOS LOCAL (JSON)
# ========================
def init_db():
    if not os.path.exists(os.path.dirname(DB_PATH)):
        os.makedirs(os.path.dirname(DB_PATH))
    if not os.path.isfile(DB_PATH):
        initial = {
            "medicos": [],
            "pacientes": [],
            "consultas": [],
            "next_ids": {"paciente": 1, "consulta": 1}
        }
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(initial, f, ensure_ascii=False, indent=2)


def read_db():
    with open(DB_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def write_db(data):
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ========================
# AUTENTICAÇÃO
# ========================
def login_required(role=None):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user' not in session:
                return redirect(url_for('login'))
            if role and session.get('user', {}).get('role') != role:
                return redirect(url_for('login'))
            return f(*args, **kwargs)
        return decorated
    return decorator


@app.route('/')
def root():
    return redirect(url_for('login'))


@app.route('/login', methods=['GET'])
def login():
    return render_template('login.html')


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    role = data.get('role')
    email = data.get('email')
    senha = data.get('senha')

    db = read_db()

    if role == 'Medico':
        medico = next((m for m in db['medicos'] if m['email'] == email and m['senha'] == senha), None)
        if medico:
            session['user'] = {"role": "Medico", "id": medico['id'], "nome": medico['nome']}
            return jsonify({"ok": True, "redirect": url_for('medico')})

    if role == 'Atendente':
        if email == "atendente@email" and senha == "123":
            session['user'] = {"role": "Atendente", "nome": "Atendente"}
            return jsonify({"ok": True, "redirect": url_for('atendente')})

    return jsonify({"ok": False, "message": "Credenciais incorretas"}), 400


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ========================
# PÁGINAS
# ========================
@app.route('/medico')
@login_required(role='Medico')
def medico():
    return render_template('medico.html', user=session['user'])


@app.route('/atendente')
@login_required(role='Atendente')
def atendente():
    return render_template('atendente.html', user=session['user'])


# ========================
# MÉDICOS
# ========================
@app.route('/api/medicos', methods=['GET'])
def api_medicos():
    db = read_db()
    return jsonify(db['medicos'])


# ========================
# PACIENTES
# ========================
@app.route('/api/pacientes', methods=['GET', 'POST'])
def api_pacientes():
    db = read_db()

    if request.method == 'GET':
        return jsonify(db['pacientes'])

    data = request.json
    cpf_limpo = data.get('cpf', '').replace('.', '').replace('-', '')

    # Impedir duplicação de CPF
    if any(p['cpf'] == cpf_limpo for p in db['pacientes']):
        return jsonify({"message": "CPF já cadastrado"}), 400

    paciente = {
        "id": db['next_ids']['paciente'],
        "nome": data.get('nome'),
        "cpf": cpf_limpo,
        "nascimento": data.get('nascimento'),
        "telefone": data.get('telefone'),
        "endereco": data.get('endereco'),
        "peso": data.get('peso'),
        "altura": data.get('altura')
    }
    db['pacientes'].append(paciente)
    db['next_ids']['paciente'] += 1
    write_db(db)
    return jsonify(paciente), 201


@app.route('/api/pacientes/<cpf>', methods=['PUT', 'DELETE'])
def api_paciente_update(cpf):
    db = read_db()
    cpf_str = str(cpf)
    
    paciente = next((p for p in db['pacientes'] if str(p['cpf']) == cpf_str), None)

    if not paciente:
        return jsonify({"message": "Paciente não encontrado"}), 404

    if request.method == 'DELETE':
        db['pacientes'] = [p for p in db['pacientes'] if str(p['cpf']) != cpf_str]
        write_db(db)
        return jsonify({"ok": True})

    data = request.json
    novo_cpf = data.get('cpf')
    
    if novo_cpf and str(novo_cpf) != cpf_str:
        existente = next((p for p in db['pacientes'] if str(p['cpf']) == str(novo_cpf)), None)
        if existente:
            return jsonify({"message": "Novo CPF já existente no sistema"}), 400
        
        for consulta in db['consultas']:
            if str(consulta.get('cpf')) == cpf_str:
                consulta['cpf'] = str(novo_cpf)

    for campo in ['nome', 'cpf', 'nascimento', 'telefone', 'endereco', 'peso', 'altura']:
        if campo in data and data[campo] is not None:
            paciente[campo] = data[campo]

    write_db(db)
    return jsonify(paciente)


# ========================
# CONSULTAS (CORRIGIDO)
# ========================
@app.route('/api/consultas', methods=['GET', 'POST'])
def api_consultas():
    db = read_db()

    # ========================
    # GET → Listar consultas
    # ========================
    if request.method == 'GET':

        user = session.get('user')
        role = user.get('role') if user else None
        medico_id_logado = user.get('id') if role == 'Medico' else None

        consultas_expandidas = []

        for c in db['consultas']:

            # ================================
            # REGRAS CORRETAS
            # ================================

            if role == 'Atendente':
                permitido = True

            elif role == 'Medico' and medico_id_logado == 1:
                permitido = True

            elif role == 'Medico':
                permitido = (c['medico_id'] == medico_id_logado)

            else:
                permitido = False

            if permitido:
                paciente = next((p for p in db['pacientes'] if p['cpf'] == c['cpf']), {})
                medico = next((m for m in db['medicos'] if m['id'] == c['medico_id']), {})

                consultas_expandidas.append({
                    **c,
                    "paciente_nome": paciente.get('nome'),
                    "paciente_contato": paciente.get('telefone'),
                    "medico_nome": medico.get('nome')
                })

        return jsonify(consultas_expandidas)

# ========================
    # POST → Criar consulta
    # ========================
    data = request.json
    
    novo_medico_id = int(data.get('medico_id'))
    novo_horario = data.get('datahora') # Isso traz Dia + Hora (ex: "2023-10-27T09:00")

    # --- TRAVA DE SEGURANÇA ---
    for c in db['consultas']:
        # Verifica se é o mesmo médico
        mesmo_medico = (c['medico_id'] == novo_medico_id)
        
        # Verifica se é EXATAMENTE o mesmo dia E hora
        # Se for no mesmo dia mas hora diferente, isso aqui dará Falso e permite agendar.
        mesmo_horario = (c['datahora'] == novo_horario)

        if mesmo_medico and mesmo_horario:
            # Só entra aqui se for o mesmo médico NO MESMO horário exato.
            return jsonify({"message": "Horário indisponível: Médico já ocupado neste horário."}), 409
    # --------------------------

    consulta = {
        "id": db['next_ids']['consulta'],
        "medico_id": novo_medico_id,
        "cpf": data.get('cpf'),
        "datahora": novo_horario,
        "observacoes": data.get('observacoes'),
        "pagamento": data.get('pagamento'),
        "status": data.get('status', 'Agendado')
    }

    db['consultas'].append(consulta)
    db['next_ids']['consulta'] += 1
    write_db(db)
    return jsonify(consulta), 201


@app.route('/api/consultas/<int:cid>', methods=['PUT', 'DELETE'])
def api_consulta_update(cid):
    db = read_db()
    consulta = next((c for c in db['consultas'] if c['id'] == cid), None)
    if not consulta:
        return jsonify({"message": "Consulta não encontrada"}), 404

    if request.method == 'DELETE':
        db['consultas'] = [c for c in db['consultas'] if c['id'] != cid]
        write_db(db)
        return jsonify({"ok": True})

    data = request.json
   
    consulta['datahora'] = data.get('datahora', consulta['datahora'])
    consulta['observacoes'] = data.get('observacoes', consulta['observacoes'])
    consulta['status'] = data.get('status', consulta['status'])
    consulta['pagamento'] = data.get('pagamento', consulta.get('pagamento'))

    write_db(db)
    return jsonify(consulta)


# ========================
# EXECUÇÃO 
# ========================
if __name__ == '__main__':
    init_db()
    app.run(debug=True)
