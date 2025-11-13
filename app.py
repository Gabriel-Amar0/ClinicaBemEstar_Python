from flask import Flask, render_template, request, redirect, url_for, jsonify, session
import os
import json
from datetime import datetime
from functools import wraps

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = 'troque-esta-chave-por-uma-segura'

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'db.json')


def init_db():
    if not os.path.exists(os.path.dirname(DB_PATH)):
        os.makedirs(os.path.dirname(DB_PATH))
    if not os.path.isfile(DB_PATH):
        initial = {
            "medicos": [
                {"id": 1, "nome": "Dr. João Silva", "email": "medico@email", "senha": "123"},
                {"id": 2, "nome": "Dra. Maria Oliveira", "email": "maria@med.com", "senha": "123"},
                {"id": 3, "nome": "Dr. Carlos Pereira", "email": "carlos@med.com", "senha": "123"}
            ],
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


@app.route('/medico')
@login_required(role='Medico')
def medico():
    return render_template('medico.html', user=session['user'])


@app.route('/atendente')
@login_required(role='Atendente')
def atendente():
    return render_template('atendente.html', user=session['user'])


@app.route('/api/medicos', methods=['GET'])
def api_medicos():
    db = read_db()
    return jsonify(db['medicos'])


@app.route('/api/pacientes', methods=['GET', 'POST'])
def api_pacientes():
    db = read_db()
    if request.method == 'GET':
        return jsonify(db['pacientes'])
    data = request.json
    paciente = {
        "id": db['next_ids']['paciente'],
        "nome": data.get('nome'),
        # remove pontos e traços do CPF antes de salvar
        "cpf": data.get('cpf', '').replace('.', '').replace('-', ''),
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


@app.route('/api/consultas', methods=['GET', 'POST'])
def api_consultas():
    db = read_db()
    if request.method == 'GET':
        consultas_exp = []
        for c in db['consultas']:
            paciente = next((p for p in db['pacientes'] if p['cpf'] == c['cpf']), {})
            medico = next((m for m in db['medicos'] if m['id'] == c['medico_id']), {})
            consultas_exp.append({
                **c,
                "paciente_nome": paciente.get('nome'),
                "paciente_contato": paciente.get('telefone'),
                "medico_nome": medico.get('nome')
            })
        return jsonify(consultas_exp)
    data = request.json
    consulta = {
        "id": db['next_ids']['consulta'],
        "medico_id": int(data.get('medico_id')),
        "cpf": data.get('cpf'),
        "datahora": data.get('datahora'),
        "observacoes": data.get('observacoes'),
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
    write_db(db)
    return jsonify(consulta)


if __name__ == '__main__':
    init_db()
    app.run(debug=True)
