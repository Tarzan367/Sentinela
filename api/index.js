const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "db.json");

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

// LOGIN
app.post("/login", (req, res) => {
  const db = readDB();

  const user = db.usuarios.find(u =>
    u.usuario === req.body.usuario &&
    u.senha === req.body.senha
  );

  if (!user) {
    return res.status(401).json({
      erro: "Login inválido"
    });
  }

  res.json(user);
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

// IMPLEMENTADO: rota com lista fixa de medicações
app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona",
    "Paracetamol",
    "Ibuprofeno",
    "Amoxicilina",
    "Azitromicina",
    "Loratadina",
    "Omeprazol",
    "Buscopan",
    "Dramin",
    "Soro fisiológico"
  ]);
});

// CONSULTA
app.post("/consulta", (req, res) => {
  const db = readDB();

  const consulta = {
    id: Date.now(),
    paciente: req.body.paciente,
    diagnostico: req.body.diagnostico,
    medicacao: req.body.medicacao,
    obs: req.body.obs,
    createdAt: new Date()
  };

  db.consultas.push(consulta);
  writeDB(db);

  res.json(consulta);
});

// MEDICAÇÕES
app.get("/medicacoes", (req, res) => {
  const db = readDB();
  res.json(db.consultas);
});

// START
module.exports = app;