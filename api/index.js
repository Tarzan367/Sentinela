const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "../backend/db.json");

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      usuarios: [],
      pacientes: [],
      triagens: [],
      consultas: []
    };
  }

  return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// USUARIOS
app.get("/usuarios", (req, res) => {
  const db = readDB();
  res.json(db.usuarios.map(({ usuario, tipo }) => ({ usuario, tipo })));
});

app.post("/usuarios", (req, res) => {
  const { usuario, senha, tipo } = req.body || {};

  if (typeof usuario !== "string" || !usuario.trim() ||
      typeof senha !== "string" || !senha || !tipo) {
    return res.status(400).json({ erro: "Informe usuário, senha e setor" });
  }

  const db = readDB();
  const nomeUsuario = usuario.trim();

  if (db.usuarios.some(u => u.usuario.toLowerCase() === nomeUsuario.toLowerCase())) {
    return res.status(409).json({ erro: "Este usuário já está cadastrado" });
  }

  const novoUsuario = { usuario: nomeUsuario, senha, tipo };
  db.usuarios.push(novoUsuario);
  writeDB(db);

  res.status(201).json({ usuario: novoUsuario.usuario, tipo: novoUsuario.tipo });
});

// LOGIN
app.post("/login", (req, res) => {
  const db = readDB();
  const body = req.body || {};
  const usuario = typeof body.usuario === "string" ? body.usuario.trim() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";

  const user = db.usuarios.find(u =>
    u.usuario === usuario &&
    u.senha === senha
  );

  if (!user) {
    return res.status(401).json({
      erro: "informações inválidas"
    });
  }

  res.json({ usuario: user.usuario, tipo: user.tipo });
});

// ATENDIMENTO
app.post("/atendimento", (req, res) => {
  const db = readDB();

  const paciente = {
    id: Date.now(),
    nome: req.body.nome,
    cpf: req.body.cpf,
    tipo: req.body.tipo,
    status: "triagem",
    createdAt: new Date()
  };

  db.pacientes.push(paciente);
  writeDB(db);

  res.json(paciente);
});

// TRIAGEM
app.post("/triagem", (req, res) => {
  const nome = typeof req.body.nome === "string" ? req.body.nome.trim() : "";

  if (!nome) {
    return res.status(400).json({ erro: "Informe o nome do paciente" });
  }

  const db = readDB();

  let risco = req.body.risco;

  if (req.body.temperatura >= 39) {
    risco = "vermelho";
  } else if (req.body.temperatura >= 38) {
    risco = "amarelo";
  } else if (!risco) {
    risco = "verde";
  }

  const triagem = {
    id: Date.now(),
    nome,
    sintoma: req.body.sintoma,
    temperatura: req.body.temperatura,
    alergia: req.body.alergia,
    observacao: req.body.observacao,
    risco,
    status: "aguardando_medico",
    createdAt: new Date()
  };

  db.triagens = db.triagens || [];

  try {
    db.triagens.push(triagem);
    writeDB(db);
  } catch (erro) {
    console.error("Erro ao salvar triagem no banco de dados:", erro);
    return res.status(500).json({ erro: "Não foi possível salvar a triagem no banco de dados" });
  }

  res.status(201).json(triagem);
});

// LISTAR TRIAGENS
app.get("/triagens", (req, res) => {
  const db = readDB();
  res.json(db.triagens);
});

// TV
app.get("/tv/chamada", (req, res) => {
  const db = readDB();
  const historico = db.tvChamadas || [];
  res.json({ chamada: historico[0] || null, historico });
});

app.post("/tv/chamada", (req, res) => {
  const paciente = typeof req.body.paciente === "string"
    ? req.body.paciente.trim()
    : "";
  const localNumero = typeof req.body.localNumero === "string"
    ? req.body.localNumero.trim()
    : "";

  if (!paciente || !/^\d+$/.test(localNumero)) {
    return res.status(400).json({ erro: "Informe o nome do paciente e um número de guichê válido" });
  }

  const db = readDB();
  db.tvChamadas = db.tvChamadas || [];
  const chamada = {
    id: Date.now(),
    paciente,
    localTipo: "GUICHÊ",
    localNumero,
    createdAt: new Date()
  };

  db.tvChamadas.unshift(chamada);
  db.tvChamadas = db.tvChamadas.slice(0, 20);
  writeDB(db);

  res.status(201).json({ chamada });
});

// MEDICAÇÕES DISPONÍVEIS NO ESTOQUE
app.get("/lista-medicacoes", (req, res) => {
  const db = readDB();
  const estoque = Array.isArray(db.estoque) ? db.estoque : [];
  res.json(estoque
    .filter(medicamento => medicamento.quantidade > 0)
    .map(({ id, nome, quantidade, unidade }) => ({ id, nome, quantidade, unidade })));
});

// ESTOQUE
app.get("/estoque", (req, res) => {
  const db = readDB();
  res.json(Array.isArray(db.estoque) ? db.estoque : []);
});

app.post("/estoque", (req, res) => {
  const nome = typeof req.body.nome === "string" ? req.body.nome.trim() : "";
  const { quantidade, unidade, categoria } = req.body;

  if (!nome || !Number.isInteger(quantidade) || quantidade <= 0 ||
      typeof unidade !== "string" || !unidade.trim() ||
      typeof categoria !== "string" || !categoria.trim()) {
    return res.status(400).json({ erro: "Informe o medicamento, uma quantidade válida, a unidade e a categoria" });
  }

  const db = readDB();
  db.estoque = Array.isArray(db.estoque) ? db.estoque : [];
  const medicamento = {
    id: Date.now(),
    nome,
    quantidade,
    unidade: unidade.trim(),
    categoria: categoria.trim(),
    createdAt: new Date()
  };

  db.estoque.push(medicamento);
  writeDB(db);

  res.status(201).json({ mensagem: "Medicamento registrado no estoque.", medicamento });
});

app.patch("/estoque/:id", (req, res) => {
  const quantidade = req.body.quantidade;
  if (!Number.isInteger(quantidade)) {
    return res.status(400).json({ erro: "Informe uma quantidade inteira válida" });
  }

  const db = readDB();
  db.estoque = Array.isArray(db.estoque) ? db.estoque : [];
  const medicamento = db.estoque.find(item => String(item.id) === req.params.id);
  if (!medicamento) {
    return res.status(404).json({ erro: "Medicamento não encontrado" });
  }

  const novaQuantidade = medicamento.quantidade + quantidade;
  if (novaQuantidade < 0) {
    return res.status(400).json({ erro: "A quantidade em estoque não pode ficar negativa" });
  }

  medicamento.quantidade = novaQuantidade;
  writeDB(db);
  res.json({ medicamento });
});

app.delete("/estoque/:id", (req, res) => {
  const db = readDB();
  db.estoque = Array.isArray(db.estoque) ? db.estoque : [];
  const indice = db.estoque.findIndex(item => String(item.id) === req.params.id);
  if (indice === -1) {
    return res.status(404).json({ erro: "Medicamento não encontrado" });
  }

  const [medicamento] = db.estoque.splice(indice, 1);
  writeDB(db);
  res.json({ medicamento });
});

// CONSULTA
app.post("/consulta", (req, res) => {
  const db = readDB();
  const body = req.body || {};
  const triagens = Array.isArray(db.triagens) ? db.triagens : [];
  if (body.triagemId === undefined || body.triagemId === null) {
    return res.status(400).json({ erro: "Selecione uma triagem para atender o paciente" });
  }

  const triagemIndex = triagens.findIndex(item =>
    String(item.id) === String(body.triagemId)
  );
  if (triagemIndex === -1) {
    return res.status(404).json({ erro: "Esta triagem não está mais na fila de atendimento" });
  }

  const estoque = Array.isArray(db.estoque) ? db.estoque : [];
  const medicamento = estoque.find(item =>
    String(item.id) === String(body.medicamentoId)
  );

  if (!medicamento || medicamento.quantidade <= 0) {
    return res.status(409).json({
      erro: "Este medicamento não está disponível no estoque. Atualize a lista e selecione outro."
    });
  }

  const consulta = {
    id: Date.now(),
    paciente: triagens[triagemIndex].nome,
    diagnostico: body.diagnostico,
    medicacao: medicamento.nome,
    obs: body.obs,
    createdAt: new Date()
  };

  medicamento.quantidade -= 1;
  db.estoque = estoque;
  db.consultas.push(consulta);
  triagens.splice(triagemIndex, 1);
  db.triagens = triagens;
  writeDB(db);

  res.json({
    consulta,
    medicamento,
    estoqueZerado: medicamento.quantidade === 0
  });
});

// MEDICAÇÕES
app.get("/medicacoes", (req, res) => {
  const db = readDB();
  res.json(db.consultas);
});

// Mantém a exportação para o Vercel e permite iniciar a API localmente.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}/`);
  });
}

module.exports = app;