"use strict";

// ======================================================
// DESVIE DOS TIROS — SCRIPT COMPLETO
// ======================================================

// 1. CONFIGURAÇÃO DO FIREBASE
// Preencha com os dados reais do seu projeto.

const firebaseConfig = {
  apiKey: "SUA_API_KEY_REAL",
  authDomain: "desvie-dos-tiros.firebaseapp.com",
  databaseURL: "https://desvie-dos-tiros-default-rtdb.firebaseio.com",
  projectId: "desvie-dos-tiros",
  appId: "SEU_APP_ID_REAL"
};

let db = null;
let jogadorOnlineId = null;
let salaRef = null;
let salaCodigo = null;
let modoOnline = false;
let souAnfitriao = false;
let ouvintesSala = [];

try {
  if (
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "SUA_API_KEY_REAL" &&
    firebaseConfig.projectId === "desvie-dos-tiros"
  ) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();

    firebase.auth().signInAnonymously()
      .then(cred => {
        jogadorOnlineId = cred.user.uid;
        console.log("Firebase conectado!", jogadorOnlineId);
      })
      .catch(error => {
        console.error("Erro de autenticação Firebase:", error);
      });
  }
} catch (error) {
  console.warn("Firebase ainda não configurado.", error);
}

// ======================================================
// 2. ELEMENTOS HTML
// ======================================================

const $ = id => document.getElementById(id);

const menu = $("menu");
const game = $("game");
const shop = $("shop");
const arena = $("arena");
const ctx = arena.getContext("2d");

const modeSelect = $("mode");
const difficultySelect = $("difficulty");
const playerNameInput = $("playerName");
const roomCodeInput = $("roomCode");

const startBtn = $("startBtn");
const shopBtn = $("shopBtn");
const backBtn = $("backBtn");
const pauseBtn = $("pauseBtn");
const soundBtn = $("soundBtn");
const fullBtn = $("fullBtn");
const menuBtn = $("menuBtn");

const coinsEl = $("coins");
const shopCoinsEl = $("shopCoins");
const timeEl = $("time");
const scoreEl = $("score");
const levelEl = $("level");
const earnedEl = $("earned");
const playersCountEl = $("playersCount");

const rankingEl = $("ranking");
const onlineStatusEl = $("onlineStatus");
const roomInfoEl = $("roomInfo");
const gameMessageEl = $("gameMessage");

const nameBox = $("nameBox");
const joinBox = $("joinBox");

// ======================================================
// 3. SALVAMENTO LOCAL
// ======================================================

const STORAGE_KEY = "desvieDados";

function carregarDados() {
  try {
    const dadosSalvos = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    if (dadosSalvos && typeof dadosSalvos === "object") {
      return {
        coins: Number(dadosSalvos.coins) || 0,
        skins: Array.isArray(dadosSalvos.skins)
          ? dadosSalvos.skins
          : ["blue"],
        skin: dadosSalvos.skin || "blue",
        ranking: Array.isArray(dadosSalvos.ranking)
          ? dadosSalvos.ranking
          : []
      };
    }
  } catch (error) {
    console.warn("Não foi possível ler os dados salvos.");
  }

  return {
    coins: 0,
    skins: ["blue"],
    skin: "blue",
    ranking: []
  };
}

let dados = carregarDados();

function salvarDados() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(dados)
    );
  } catch (error) {
    console.warn("Não foi possível salvar os dados.");
  }

  atualizarMoedas();
}

function atualizarMoedas() {
  coinsEl.textContent = dados.coins;
  shopCoinsEl.textContent = dados.coins;
}

function atualizarRanking() {
  rankingEl.innerHTML = "";

  if (!dados.ranking.length) {
    const li = document.createElement("li");
    li.textContent = "Nenhuma partida registrada ainda.";
    rankingEl.appendChild(li);
    return;
  }

  dados.ranking
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .forEach((registro, index) => {
      const li = document.createElement("li");

      li.textContent =
        `${index + 1}. ${registro.name} — ${registro.score} pontos`;

      rankingEl.appendChild(li);
    });
}

atualizarMoedas();
atualizarRanking();

// ======================================================
// 4. LOJA DE SKINS
// ======================================================

const skins = [
  {
    id: "blue",
    name: "Azul clássico",
    color: "#48a8ff",
    price: 0
  },
  {
    id: "green",
    name: "Verde neon",
    color: "#44f0a5",
    price: 30
  },
  {
    id: "purple",
    name: "Roxo cósmico",
    color: "#bd70ff",
    price: 60
  },
  {
    id: "gold",
    name: "Ouro",
    color: "#ffd166",
    price: 100
  },
  {
    id: "red",
    name: "Vermelho",
    color: "#ff5470",
    price: 150
  },
  {
    id: "white",
    name: "Branco estelar",
    color: "#f4f7ff",
    price: 220
  }
];

function abrirLoja() {
  menu.classList.add("hidden");
  game.classList.add("hidden");
  shop.classList.remove("hidden");

  renderizarLoja();
}

function renderizarLoja() {
  const container = $("shopItems");
  container.innerHTML = "";

  skins.forEach(skin => {
    const desbloqueada = dados.skins.includes(skin.id);
    const selecionada = dados.skin === skin.id;

    const card = document.createElement("div");
    card.className = "shop-item";

    const preview = document.createElement("div");
    preview.className = "skin-preview";
    preview.style.background = skin.color;
    preview.style.color = skin.color;

    const titulo = document.createElement("h3");
    titulo.textContent = skin.name;

    const preco = document.createElement("p");

    preco.textContent = skin.price === 0
      ? "Grátis"
      : `Preço: ${skin.price} moedas`;

    const botao = document.createElement("button");
    botao.className = "btn";

    if (selecionada) {
      botao.textContent = "Selecionada";
      botao.disabled = true;
    } else if (desbloqueada) {
      botao.textContent = "Selecionar";

      botao.addEventListener("click", () => {
        dados.skin = skin.id;
        salvarDados();
        renderizarLoja();
      });
    } else {
      botao.textContent = `Comprar (${skin.price} moedas)`;

      botao.addEventListener("click", () => {
        if (dados.coins < skin.price) {
          alert("Você não tem moedas suficientes!");
          return;
        }

        dados.coins -= skin.price;
        dados.skins.push(skin.id);
        dados.skin = skin.id;

        salvarDados();
        renderizarLoja();
      });
    }

    card.append(preview, titulo, preco, botao);
    container.appendChild(card);
  });

  atualizarMoedas();
}

// ======================================================
// 5. ESTADO DO JOGO
// ======================================================

const W = arena.width;
const H = arena.height;

let jogadores = [];
let tiros = [];
let itens = [];
let particulas = [];

let rodando = false;
let pausado = false;
let somLigado = true;
let gameOverFlag = false;

let inicioPartida = 0;
let ultimoFrame = 0;
let tempoJogo = 0;
let pontos = 0;
let moedasPartida = 0;
let nivel = 1;

let intervaloTiro = 0;
let intervaloItem = 0;
let ultimoTiro = 0;
let ultimoItem = 0;
let ultimoChefe = 0;

let dificuldadeInicial = "normal";
let velocidadeJogo = 1;
let chefe = null;
let audioContext = null;

const teclas = Object.create(null);

const coresTiro = [
  "#ff5470",
  "#ff9e64",
  "#ffdc69"
];

function obterCorSkin(id) {
  return skins.find(skin => skin.id === id)?.color
    || "#48a8ff";
}

function criarJogador(id, nome, x, y, cor) {
  return {
    id,
    nome,
    x,
    y,
    raio: 13,
    velocidade: 235,
    cor,
    vivo: true,
    escudoAte: 0,
    invencivelAte: 0,
    velocidadeAte: 0,
    tempoSobrevivido: 0
  };
}

// ======================================================
// 6. SOM
// ======================================================

function tocarSom(
  frequencia = 440,
  duracao = 0.08,
  tipo = "sine"
) {
  if (!somLigado) return;

  try {
    audioContext ||= new (
      window.AudioContext || window.webkitAudioContext
    )();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscilador = audioContext.createOscillator();
    const volume = audioContext.createGain();

    oscilador.type = tipo;
    oscilador.frequency.value = frequencia;
    volume.gain.value = 0.045;

    oscilador.connect(volume);
    volume.connect(audioContext.destination);

    oscilador.start();

    volume.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duracao
    );

    oscilador.stop(audioContext.currentTime + duracao);
  } catch (error) {
    // O jogo continua mesmo se o áudio não estiver disponível.
  }
}

// ======================================================
// 7. DIFICULDADE INFINITA
// ======================================================

function calcularNivel(tempo) {
  return Math.floor(tempo / 15) + 1;
}

function atualizarDificuldade() {
  nivel = calcularNivel(tempoJogo);

  const multiplicadorInicial = {
    easy: 0.75,
    normal: 1,
    hard: 1.3
  }[dificuldadeInicial] || 1;

  velocidadeJogo = multiplicadorInicial *
    (
      1 +
      Math.log1p(nivel - 1) * 0.48 +
      (nivel - 1) * 0.035
    );

  intervaloTiro = Math.max(
    0.12,
    0.9 / (1 + (nivel - 1) * 0.085)
  );

  const quantidadeBase = 2 + Math.floor((nivel - 1) / 2);

  return {
    multiplicadorInicial,
    quantidadeBase,
    velocidade: velocidadeJogo
  };
}

function atualizarHUD() {
  timeEl.textContent = tempoJogo.toFixed(1);
  scoreEl.textContent = pontos;
  levelEl.textContent = nivel;
  earnedEl.textContent = moedasPartida;
}

// ======================================================
// 8. INICIAR PARTIDA
// ======================================================

function iniciarPartida() {
  limparTeclas();

  modoOnline = modeSelect.value === "create" ||
    modeSelect.value === "join";

  if (modoOnline && !db) {
    onlineStatusEl.textContent =
      "Configure o Firebase no script.js antes de jogar online.";
    return;
  }

  dificuldadeInicial = difficultySelect.value;

  tempoJogo = 0;
  pontos = 0;
  moedasPartida = 0;
  nivel = 1;

  tiros = [];
  itens = [];
  particulas = [];
  chefe = null;

  inicioPartida = performance.now();
  ultimoFrame = inicioPartida;
  ultimoTiro = 0;
  ultimoItem = 0;
  ultimoChefe = 0;

  const nome = playerNameInput.value.trim().slice(0, 16)
    || "Jogador";

  jogadores = [
    criarJogador(
      1,
      nome,
      W / 2,
      H / 2,
      obterCorSkin(dados.skin)
    )
  ];

  gameOverFlag = false;
  pausado = false;
  rodando = true;

  menu.classList.add("hidden");
  shop.classList.add("hidden");
  game.classList.remove("hidden");
  gameMessageEl.classList.add("hidden");

  pauseBtn.textContent = "⏸ Pausar";

  roomInfoEl.textContent = modoOnline
    ? "Conectando à sala online..."
    : "Modo solo — sobreviva o máximo possível!";

  atualizarDificuldade();
  atualizarHUD();

  if (modoOnline) {
    prepararSalaOnline().catch(error => {
      console.error(error);

      onlineStatusEl.textContent =
        "Não foi possível conectar à sala. Verifique o Firebase.";
    });
  }

  requestAnimationFrame(loop);
}

// ======================================================
// 9. SALAS ONLINE FIREBASE
// ======================================================

function removerOuvintesSala() {
  ouvintesSala.forEach(({ ref, evento, callback }) => {
    ref.off(evento, callback);
  });

  ouvintesSala = [];
}

async function prepararSalaOnline() {
  if (!db) {
    throw new Error("Firebase não configurado.");
  }

  if (!jogadorOnlineId) {
    const cred = await firebase.auth().signInAnonymously();
    jogadorOnlineId = cred.user.uid;
  }

  const modo = modeSelect.value;

  if (modo === "create") {
    salaCodigo = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    salaRef = db.ref("salas/" + salaCodigo);

    await salaRef.set({
      anfitriao: jogadorOnlineId,
      estado: "aguardando",
      criadoEm: firebase.database.ServerValue.TIMESTAMP
    });

    souAnfitriao = true;
  } else {
    salaCodigo = roomCodeInput.value.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(salaCodigo)) {
      throw new Error(
        "Digite um código de sala válido com 6 caracteres."
      );
    }

    salaRef = db.ref("salas/" + salaCodigo);

    const snapshot = await salaRef.once("value");

    if (!snapshot.exists()) {
      throw new Error("Sala não encontrada.");
    }

    souAnfitriao = false;
  }

  const nome = playerNameInput.value.trim().slice(0, 16)
    || "Jogador";

  const meusDados = {
    nome,
    x: W / 2,
    y: H / 2,
    cor: obterCorSkin(dados.skin),
    conectado: true,
    atualizadoEm: firebase.database.ServerValue.TIMESTAMP
  };

  await salaRef.child(
    "jogadores/" + jogadorOnlineId
  ).set(meusDados);

  await salaRef.child(
    "jogadores/" + jogadorOnlineId
  ).onDisconnect().remove();

  roomInfoEl.textContent =
    `Sala: ${salaCodigo} — compartilhe este código!`;

  onlineStatusEl.textContent =
    `Conectado à sala ${salaCodigo}.`;

  const jogadoresRef = salaRef.child("jogadores");

  const callback = snapshot => {
    if (!snapshot.exists()) return;

    const lista = snapshot.val();
    playersCountEl.textContent = Object.keys(lista).length;

    Object.entries(lista).forEach(([id, info]) => {
      if (id === jogadorOnlineId) return;

      let outro = jogadores.find(j => j.id === id);

      if (!outro) {
        outro = criarJogador(
          id,
          info.nome || "Jogador",
          Number(info.x) || W / 2,
          Number(info.y) || H / 2,
          info.cor || "#44f0a5"
        );

        outro.remoto = true;
        jogadores.push(outro);
      }

      outro.nome = info.nome || "Jogador";
      outro.x = Number(info.x) || outro.x;
      outro.y = Number(info.y) || outro.y;
      outro.cor = info.cor || outro.cor;
    });
  };

  jogadoresRef.on("value", callback);

  ouvintesSala.push({
    ref: jogadoresRef,
    evento: "value",
    callback
  });
}

let ultimoEnvioOnline = 0;

function enviarPosicaoOnline(agora) {
  if (!modoOnline || !salaRef || !jogadorOnlineId) return;
  if (agora - ultimoEnvioOnline < 80) return;

  ultimoEnvioOnline = agora;

  const eu = jogadores.find(j => j.id === 1 && !j.remoto);
  if (!eu) return;

  salaRef.child(
    "jogadores/" + jogadorOnlineId
  ).update({
    x: eu.x,
    y: eu.y,
    cor: eu.cor,
    atualizadoEm: firebase.database.ServerValue.TIMESTAMP
  }).catch(error => {
    console.warn("Falha ao atualizar jogador online:", error);
  });
}

async function sairDaSala() {
  removerOuvintesSala();

  if (salaRef && jogadorOnlineId) {
    try {
      await salaRef.child(
        "jogadores/" + jogadorOnlineId
      ).remove();
    } catch (error) {
      console.warn("Não foi possível sair da sala.", error);
    }
  }

  salaRef = null;
  salaCodigo = null;
  modoOnline = false;
  souAnfitriao = false;
}

// ======================================================
// 10. PROJÉTEIS E ATAQUES
// ======================================================

function criarTiro(x, y, vx, vy, raio = 7, cor) {
  tiros.push({
    x,
    y,
    vx,
    vy,
    raio,
    cor: cor || coresTiro[
      Math.floor(Math.random() * coresTiro.length)
    ]
  });
}

function criarTiroDaBorda(alvo) {
  const lado = Math.floor(Math.random() * 4);

  let x;
  let y;

  if (lado === 0) {
    x = Math.random() * W;
    y = -10;
  } else if (lado === 1) {
    x = W + 10;
    y = Math.random() * H;
  } else if (lado === 2) {
    x = Math.random() * W;
    y = H + 10;
  } else {
    x = -10;
    y = Math.random() * H;
  }

  const dx = alvo.x - x;
  const dy = alvo.y - y;
  const distancia = Math.hypot(dx, dy) || 1;

  const velocidadeBase = 115 + Math.min(nivel * 3, 450);

  criarTiro(
    x,
    y,
    (dx / distancia) * velocidadeBase * velocidadeJogo,
    (dy / distancia) * velocidadeBase * velocidadeJogo
  );
}

function criarRajadaCircular() {
  const alvo = jogadores.find(j => j.vivo && !j.remoto);
  if (!alvo) return;

  const quantidade = Math.min(8 + nivel, 50);
  const velocidade = (100 + nivel * 4) * velocidadeJogo;

  for (let i = 0; i < quantidade; i++) {
    const angulo = Math.PI * 2 * i / quantidade;

    criarTiro(
      chefe ? chefe.x : W / 2,
      chefe ? chefe.y : H / 2,
      Math.cos(angulo) * velocidade,
      Math.sin(angulo) * velocidade,
      6
    );
  }
}

// ======================================================
// 11. CHEFÕES
// ======================================================

function criarChefe() {
  chefe = {
    x: W / 2,
    y: 90,
    raio: 27,
    vida: 20 + nivel * 5,
    vidaMaxima: 20 + nivel * 5,
    velocidade: 65 + nivel * 2,
    direcao: 1,
    ultimoAtaque: 0
  };

  gameMessageEl.textContent = `CHEFÃO DO NÍVEL ${nivel}!`;
  gameMessageEl.classList.remove("hidden");

  tocarSom(130, 0.35, "sawtooth");
}

function atualizarChefe(dt, agora) {
  if (!chefe) return;

  chefe.x += chefe.direcao * chefe.velocidade * velocidadeJogo * dt;

  if (chefe.x < chefe.raio || chefe.x > W - chefe.raio) {
    chefe.direcao *= -1;
  }

  if (agora - chefe.ultimoAtaque > Math.max(300, 1300 - nivel * 20)) {
    chefe.ultimoAtaque = agora;
    criarRajadaCircular();
  }
}

function desenharChefe() {
  if (!chefe) return;

  ctx.save();

  ctx.shadowColor = "#ff5470";
  ctx.shadowBlur = 25;
  ctx.fillStyle = "#ff5470";

  ctx.beginPath();
  ctx.arc(chefe.x, chefe.y, chefe.raio, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.fillRect(chefe.x - 30, chefe.y - 42, 60, 6);

  ctx.fillStyle = "#44f0a5";
  ctx.fillRect(
    chefe.x - 30,
    chefe.y - 42,
    60 * Math.max(0, chefe.vida / chefe.vidaMaxima),
    6
  );

  ctx.restore();
}

// ======================================================
// 12. ITENS E PODERES
// ======================================================

function criarItem() {
  const tipos = ["escudo", "velocidade", "invencivel", "moeda"];
  const tipo = tipos[Math.floor(Math.random() * tipos.length)];

  itens.push({
    x: 25 + Math.random() * (W - 50),
    y: 25 + Math.random() * (H - 50),
    raio: 11,
    tipo,
    criado: performance.now()
  });
}

function ativarItem(item, jogador, agora) {
  if (item.tipo === "escudo") {
    jogador.escudoAte = agora + 6000;
    tocarSom(660);
  } else if (item.tipo === "velocidade") {
    jogador.velocidadeAte = agora + 5000;
    tocarSom(800);
  } else if (item.tipo === "invencivel") {
    jogador.invencivelAte = agora + 3000;
    tocarSom(950);
  } else if (item.tipo === "moeda") {
    moedasPartida += 5;
    tocarSom(1100);
  }

  criarParticulas(item.x, item.y, "#ffd166", 12);
}

function desenharItens() {
  itens.forEach(item => {
    const cores = {
      escudo: "#48a8ff",
      velocidade: "#44f0a5",
      invencivel: "#bd70ff",
      moeda: "#ffd166"
    };

    const simbolos = {
      escudo: "S",
      velocidade: "V",
      invencivel: "I",
      moeda: "$"
    };

    ctx.beginPath();
    ctx.fillStyle = cores[item.tipo];
    ctx.arc(item.x, item.y, item.raio, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#080b16";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(simbolos[item.tipo], item.x, item.y);
  });
}

// ======================================================
// 13. PARTÍCULAS
// ======================================================

function criarParticulas(x, y, cor, quantidade = 8) {
  for (let i = 0; i < quantidade; i++) {
    const angulo = Math.random() * Math.PI * 2;
    const velocidade = 35 + Math.random() * 140;

    particulas.push({
      x,
      y,
      vx: Math.cos(angulo) * velocidade,
      vy: Math.sin(angulo) * velocidade,
      vida: 0.35 + Math.random() * 0.5,
      cor
    });
  }
}

function atualizarParticulas(dt) {
  particulas.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vida -= dt;
  });

  particulas = particulas.filter(p => p.vida > 0);
}

function desenharParticulas() {
  particulas.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.vida * 2);
    ctx.fillStyle = p.cor;
    ctx.fillRect(p.x, p.y, 4, 4);
  });

  ctx.globalAlpha = 1;
}

// ======================================================
// 14. MOVIMENTO E COLISÕES
// ======================================================

function moverJogador(j, dt, agora) {
  if (!j.vivo || j.remoto) return;

  let dx = 0;
  let dy = 0;

  if (teclas.ArrowLeft || teclas.a) dx -= 1;
  if (teclas.ArrowRight || teclas.d) dx += 1;
  if (teclas.ArrowUp || teclas.w) dy -= 1;
  if (teclas.ArrowDown || teclas.s) dy += 1;

  const comprimento = Math.hypot(dx, dy) || 1;
  const multiplicador = agora < j.velocidadeAte ? 1.7 : 1;

  j.x += dx / comprimento * j.velocidade * multiplicador * dt;
  j.y += dy / comprimento * j.velocidade * multiplicador * dt;

  j.x = Math.max(j.raio, Math.min(W - j.raio, j.x));
  j.y = Math.max(j.raio, Math.min(H - j.raio, j.y));

  j.tempoSobrevivido = tempoJogo;
}

function verificarColisoes(agora) {
  jogadores.forEach(j => {
    if (!j.vivo || j.remoto) return;

    tiros.forEach(t => {
      const distancia = Math.hypot(j.x - t.x, j.y - t.y);

      if (distancia < j.raio + t.raio) {
        if (agora < j.invencivelAte) {
          criarParticulas(t.x, t.y, "#bd70ff", 3);
          t.fora = true;
        } else if (agora < j.escudoAte) {
          j.escudoAte = 0;
          t.fora = true;
          criarParticulas(j.x, j.y, "#48a8ff", 15);
          tocarSom(300, 0.12);
        } else {
          j.vivo = false;
          criarParticulas(j.x, j.y, "#ff5470", 25);
          tocarSom(100, 0.3, "sawtooth");
        }
      }
    });

    itens.forEach(item => {
      const distancia = Math.hypot(j.x - item.x, j.y - item.y);

      if (distancia < j.raio + item.raio) {
        ativarItem(item, j, agora);
        item.pego = true;
      }
    });
  });

  tiros = tiros.filter(t =>
    !t.fora &&
    t.x > -80 && t.x < W + 80 &&
    t.y > -80 && t.y < H + 80
  );

  itens = itens.filter(item => !item.pego);
}

// ======================================================
// 15. DESENHO DA ARENA
// ======================================================

function desenharFundo() {
  ctx.fillStyle = "#070b15";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#18233b";
  ctx.lineWidth = 1;

  const tamanho = 36;

  for (let x = 0; x < W; x += tamanho) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  for (let y = 0; y < H; y += tamanho) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function desenharJogadores(agora) {
  jogadores.forEach(j => {
    if (!j.vivo) return;

    ctx.save();
    ctx.shadowColor = j.cor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = j.cor;

    ctx.beginPath();
    ctx.arc(j.x, j.y, j.raio, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    if (agora < j.escudoAte) {
      ctx.strokeStyle = "#48a8ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(j.x, j.y, j.raio + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (agora < j.invencivelAte) {
      ctx.strokeStyle = "#bd70ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(j.x, j.y, j.raio + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#f4f7ff";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(j.nome, j.x, j.y - 22);

    ctx.restore();
  });
}

function desenharTiros() {
  tiros.forEach(t => {
    ctx.save();
    ctx.shadowColor = t.cor;
    ctx.shadowBlur = 12;
    ctx.fillStyle = t.cor;

    ctx.beginPath();
    ctx.arc(t.x, t.y, t.raio, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

function desenharOverlay() {
  if (!pausado) return;

  ctx.fillStyle = "#050813bb";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "bold 36px Arial";
  ctx.fillText("PAUSADO", W / 2, H / 2);
}

// ======================================================
// 16. LOOP PRINCIPAL
// ======================================================

function loop(agora) {
  if (!rodando) return;

  requestAnimationFrame(loop);

  const dt = Math.min((agora - ultimoFrame) / 1000, 0.04);
  ultimoFrame = agora;

  if (pausado || gameOverFlag) {
    desenharFundo();
    desenharTiros();
    desenharItens();
    desenharChefe();
    desenharJogadores(agora);
    desenharParticulas();
    desenharOverlay();
    return;
  }

  tempoJogo = (agora - inicioPartida) / 1000;

  atualizarDificuldade();

  const config = {
    quantidadeBase: 2 + Math.floor((nivel - 1) / 2)
  };

  jogadores.forEach(j => moverJogador(j, dt, agora));

  if (agora - ultimoTiro >= intervaloTiro * 1000) {
    ultimoTiro = agora;

    const alvo = jogadores.find(j => j.vivo && !j.remoto);

    if (alvo) {
      const quantidade = Math.min(config.quantidadeBase, 60);

      for (let i = 0; i < quantidade; i++) {
        criarTiroDaBorda(alvo);
      }
    }
  }

  const intervaloItens = Math.max(2.5, 7 - nivel * 0.08);

  if (agora - ultimoItem >= intervaloItens * 1000) {
    ultimoItem = agora;
    criarItem();
  }

  if (nivel % 5 === 0 && nivel !== ultimoChefe && !chefe) {
    ultimoChefe = nivel;
    criarChefe();
  }

  if (chefe) {
    atualizarChefe(dt, agora);

    if (tempoJogo - (chefe.inicio || tempoJogo) > 15) {
      chefe = null;
      pontos += 100 + nivel * 10;
      moedasPartida += 10;
      criarParticulas(W / 2, 90, "#ffd166", 30);
      gameMessageEl.textContent = "Chefão derrotado! +10 moedas";
      gameMessageEl.classList.remove("hidden");
      tocarSom(880, 0.25);
    } else if (!chefe.inicio) {
      chefe.inicio = tempoJogo;
    }
  }

  tiros.forEach(t => {
    t.x += t.vx * dt;
    t.y += t.vy * dt;
  });

  atualizarParticulas(dt);
  verificarColisoes(agora);
  enviarPosicaoOnline(agora);

  pontos = Math.floor(tempoJogo * 10) + (nivel - 1) * 25;

  desenharFundo();
  desenharItens();
  desenharTiros();
  desenharChefe();
  desenharJogadores(agora);
  desenharParticulas();

  atualizarHUD();

  const jogadorLocal = jogadores.find(j => j.id === 1 && !j.remoto);

  if (!jogadorLocal || !jogadorLocal.vivo) {
    finalizarPartida();
  }
}

// ======================================================
// 17. FIM DE PARTIDA
// ======================================================

function finalizarPartida() {
  if (gameOverFlag) return;

  gameOverFlag = true;
  rodando = false;

  const moedasGanhas = Math.max(1, Math.floor(tempoJogo / 10))
    + moedasPartida;

  dados.coins += moedasGanhas;

  const nome = playerNameInput.value.trim().slice(0, 16)
    || "Jogador";

  dados.ranking.push({
    name: nome,
    score: pontos,
    date: new Date().toISOString()
  });

  dados.ranking.sort((a, b) => b.score - a.score);
  dados.ranking = dados.ranking.slice(0, 10);

  salvarDados();
  atualizarRanking();

  gameMessageEl.innerHTML = "";

  const titulo = document.createElement("h2");
  titulo.textContent = "FIM DE JOGO";

  const resumo = document.createElement("p");
  resumo.textContent =
    `Você chegou ao nível ${nivel}, sobreviveu ${tempoJogo.toFixed(1)} segundos e fez ${pontos} pontos.`;

  const premio = document.createElement("p");
  premio.textContent = `Você ganhou ${moedasGanhas} moedas!`;

  const reiniciar = document.createElement("button");
  reiniciar.className = "btn primary full";
  reiniciar.textContent = "Jogar novamente";
  reiniciar.addEventListener("click", iniciarPartida);

  const voltar = document.createElement("button");
  voltar.className = "btn full";
  voltar.textContent = "Voltar ao menu";
  voltar.addEventListener("click", voltarMenu);

  gameMessageEl.append(titulo, resumo, premio, reiniciar, voltar);
  gameMessageEl.classList.remove("hidden");

  tocarSom(180, 0.5, "sawtooth");
}

// ======================================================
// 18. PAUSA, MENU E TELA CHEIA
// ======================================================

function alternarPausa() {
  if (!rodando || gameOverFlag) return;

  pausado = !pausado;

  if (!pausado) {
    inicioPartida = performance.now() - tempoJogo * 1000;
  }

  pauseBtn.textContent = pausado ? "▶ Continuar" : "⏸ Pausar";

  if (pausado) limparTeclas();
}

async function voltarMenu() {
  rodando = false;
  pausado = false;
  gameOverFlag = false;

  limparTeclas();
  await sairDaSala();

  game.classList.add("hidden");
  shop.classList.add("hidden");
  menu.classList.remove("hidden");

  gameMessageEl.classList.add("hidden");

  onlineStatusEl.textContent = db
    ? "Firebase configurado."
    : "Modo solo disponível. Configure o Firebase para jogar online.";
}

function limparTeclas() {
  Object.keys(teclas).forEach(k => {
    teclas[k] = false;
  });
}

async function alternarTelaCheia() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.warn("Tela cheia não disponível.", error);
  }
}

// ======================================================
// 19. CONTROLES DE TECLADO
// ======================================================

window.addEventListener("keydown", event => {
  const tecla = event.key.length === 1
    ? event.key.toLowerCase()
    : event.key;

  if ([
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "
  ].includes(event.key)) {
    event.preventDefault();
  }

  teclas[tecla] = true;

  if (event.repeat) return;

  if (
    event.key.toLowerCase() === "p" ||
    event.key === "Escape"
  ) {
    alternarPausa();
  }
});

window.addEventListener("keyup", event => {
  const tecla = event.key.length === 1
    ? event.key.toLowerCase()
    : event.key;

  teclas[tecla] = false;
});

window.addEventListener("blur", limparTeclas);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && rodando && !pausado && !gameOverFlag) {
    alternarPausa();
  }
});

// ======================================================
// 20. CONTROLES DE TOQUE
// ======================================================

document.querySelectorAll("[data-key]").forEach(botao => {
  const tecla = botao.dataset.key;

  const pressionar = event => {
    event.preventDefault();
    teclas[tecla] = true;

    try {
      botao.setPointerCapture(event.pointerId);
    } catch (error) {
      // Captura não disponível.
    }
  };

  const soltar = event => {
    event.preventDefault();
    teclas[tecla] = false;
  };

  botao.addEventListener("pointerdown", pressionar);
  botao.addEventListener("pointerup", soltar);
  botao.addEventListener("pointercancel", soltar);
  botao.addEventListener("lostpointercapture", soltar);
});

// ======================================================
// 21. MENU E BOTÕES
// ======================================================

modeSelect.addEventListener("change", () => {
  const online = modeSelect.value !== "solo";

  nameBox.classList.remove("hidden");
  joinBox.classList.toggle("hidden", modeSelect.value !== "join");

  startBtn.textContent = modeSelect.value === "create"
    ? "🌐 CRIAR SALA"
    : modeSelect.value === "join"
      ? "🔗 ENTRAR NA SALA"
      : "▶ JOGAR";

  onlineStatusEl.textContent = online
    ? "O modo online exige uma configuração válida do Firebase."
    : "Modo solo disponível.";
});

startBtn.addEventListener("click", iniciarPartida);
shopBtn.addEventListener("click", abrirLoja);

backBtn.addEventListener("click", () => {
  shop.classList.add("hidden");
  menu.classList.remove("hidden");
});

pauseBtn.addEventListener("click", alternarPausa);

soundBtn.addEventListener("click", () => {
  somLigado = !somLigado;
  soundBtn.textContent = somLigado
    ? "🔊 Som ligado"
    : "🔇 Som desligado";

  if (somLigado) tocarSom(600);
});

fullBtn.addEventListener("click", alternarTelaCheia);
menuBtn.addEventListener("click", voltarMenu);

// ======================================================
// 22. AJUSTES INICIAIS
// ======================================================

joinBox.classList.add("hidden");

onlineStatusEl.textContent = db
  ? "Firebase configurado. O modo online pode ser utilizado."
  : "Modo solo disponível. Configure o Firebase para jogar online.";

atualizarMoedas();
atualizarRanking();