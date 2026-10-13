
const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

const $ = id => document.getElementById(id);

const cores = [
  { nome: "Verde", cor: "#42ff9e", preco: 0 },
  { nome: "Azul", cor: "#43b9ff", preco: 0 },
  { nome: "Roxo", cor: "#a783ff", preco: 30 },
  { nome: "Rosa", cor: "#ff64bc", preco: 50 },
  { nome: "Dourado", cor: "#ffd45b", preco: 80 },
  { nome: "Vermelho", cor: "#ff5964", preco: 100 }
];

let dados = carregarDados();
let jogadores = [];
let tiros = [];
let poderes = [];
let particulas = [];
let boss = null;
let teclas = {};
let modo = 1;
let dificuldade = "normal";
let rodando = false;
let pausado = false;
let encerrado = false;
let somLigado = true;
let inicio = 0;
let tempoPausa = 0;
let tempoDecorrido = 0;
let ultimoFrame = 0;
let ultimoTiro = 0;
let ultimoPoder = 0;
let ultimoBoss = 0;
let moedasPartida = 0;
let pontos = 0;
let proximoTiro = 0;
let animacao = null;
let audio = null;

function carregarDados() {
  try {
    return JSON.parse(localStorage.getItem("desvieDados")) || {
      moedas: 0,
      desbloqueadas: [0, 1],
      skin1: 0,
      skin2: 1,
      ranking: []
    };
  } catch {
    return {
      moedas: 0,
      desbloqueadas: [0, 1],
      skin1: 0,
      skin2: 1,
      ranking: []
    };
  }
}

function salvarDados() {
  localStorage.setItem("desvieDados", JSON.stringify(dados));
  atualizarMoedas();
}

function atualizarMoedas() {
  $("moedas").textContent = dados.moedas;
}

function som(frequencia = 440, duracao = 0.07, tipo = "sine") {
  if (!somLigado) return;

  try {
    audio ||= new AudioContext();
    if (audio.state === "suspended") audio.resume();

    const oscilador = audio.createOscillator();
    const volume = audio.createGain();

    oscilador.type = tipo;
    oscilador.frequency.value = frequencia;
    volume.gain.setValueAtTime(0.05, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(
      0.001,
      audio.currentTime + duracao
    );

    oscilador.connect(volume);
    volume.connect(audio.destination);
    oscilador.start();
    oscilador.stop(audio.currentTime + duracao);
  } catch {}
}

function mostrar(tela) {
  ["menu", "jogo", "loja"].forEach(id => {
    $(id).classList.toggle("escondido", id !== tela);
  });
}

function desenharRanking(id) {
  const lista = $(id);
  lista.innerHTML = "";

  if (!dados.ranking.length) {
    const item = document.createElement("li");
    item.textContent = "Nenhuma partida registrada ainda.";
    lista.appendChild(item);
    return;
  }

  dados.ranking.slice(0, 5).forEach(registro => {
    const item = document.createElement("li");
    item.textContent =
      `${registro.nome} — ${registro.tempo.toFixed(1)}s`;
    lista.appendChild(item);
  });
}

function iniciarJogo() {
  modo = Number($("jogadores").value);
  dificuldade = $("dificuldade").value;

  jogadores = [
    criarJogador(
      1,
      canvas.width * 0.35,
      canvas.height / 2,
      dados.skin1
    )
  ];

  if (modo === 2) {
    jogadores.push(
      criarJogador(
        2,
        canvas.width * 0.65,
        canvas.height / 2,
        dados.skin2
      )
    );
  }

  tiros = [];
  poderes = [];
  particulas = [];
  boss = null;
  pontos = 0;
  moedasPartida = 0;
  tempoDecorrido = 0;
  ultimoTiro = 0;
  ultimoPoder = 0;
  ultimoBoss = 0;
  ultimoFrame = 0;
  teclas = {};
  encerrado = false;
  pausado = false;
  rodando = true;

  $("mensagem").classList.add("escondido");
  $("status2").classList.toggle("escondido", modo !== 2);
  $("btnPausa").textContent = "⏸ Pausar (P)";
  $("moedasPartida").textContent = "0";
  $("pontos").textContent = "0";

  mostrar("jogo");

  inicio = performance.now();
  animacao = requestAnimationFrame(loop);
}

function criarJogador(id, x, y, skin) {
  return {
    id,
    x,
    y,
    raio: 13,
    cor: cores[skin]?.cor || cores[id - 1].cor,
    skin,
    vivo: true,
    escudo: 0,
    velocidadeExtra: 0,
    invencivel: 0,
    moedas: 0,
    sobreviveu: 0
  };
}

function limparTeclas() {
  teclas = {};
}

function loop(agora) {
  if (!rodando || encerrado) return;

  if (pausado) {
    animacao = requestAnimationFrame(loop);
    return;
  }

  const dt = ultimoFrame
    ? Math.min((agora - ultimoFrame) / 1000, 0.035)
    : 0;

  ultimoFrame = agora;
  tempoDecorrido = (agora - inicio - tempoPausa) / 1000;

  atualizar(dt, agora);
  desenhar();
  atualizarHUD();

  animacao = requestAnimationFrame(loop);
}

function atualizar(dt, agora) {
  const nivel = Math.floor(tempoDecorrido / 15) + 1;
  const multiplicador = dificuldade === "facil" ? 0.75 :
    dificuldade === "dificil" ? 1.45 : 1;

  const intervaloTiro = Math.max(
    180,
    (850 - (nivel - 1) * 65) / multiplicador
  );

  if (agora - ultimoTiro >= intervaloTiro) {
    criarTiro();
    ultimoTiro = agora;
  }

  if (agora - ultimoPoder >= 8500) {
    criarPoder();
    ultimoPoder = agora;
  }

  if (tempoDecorrido >= 60 && tempoDecorrido - ultimoBoss >= 60) {
    criarBoss();
    ultimoBoss = tempoDecorrido;
  }

  jogadores.forEach(j => {
    if (!j.vivo) return;

    j.sobreviveu = tempoDecorrido;
    j.escudo = Math.max(0, j.escudo - dt);
    j.velocidadeExtra = Math.max(0, j.velocidadeExtra - dt);
    j.invencivel = Math.max(0, j.invencivel - dt);

    const velocidade = (230 + (j.velocidadeExtra > 0 ? 125 : 0)) * dt;
    let dx = 0;
    let dy = 0;

    if (j.id === 1) {
      if (teclas["w"]) dy--;
      if (teclas["s"]) dy++;
      if (teclas["a"]) dx--;
      if (teclas["d"]) dx++;
    } else {
      if (teclas["ArrowUp"]) dy--;
      if (teclas["ArrowDown"]) dy++;
      if (teclas["ArrowLeft"]) dx--;
      if (teclas["ArrowRight"]) dx++;
    }

    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }

    j.x += dx * velocidade;
    j.y += dy * velocidade;

    j.x = Math.max(j.raio, Math.min(canvas.width - j.raio, j.x));
    j.y = Math.max(j.raio, Math.min(canvas.height - j.raio, j.y));
  });

  tiros.forEach(t => {
    t.x += t.dx * dt;
    t.y += t.dy * dt;
  });

  tiros = tiros.filter(t =>
    t.x > -40 && t.x < canvas.width + 40 &&
    t.y > -40 && t.y < canvas.height + 40
  );

  poderes.forEach(p => {
    p.tempo += dt;
  });

  poderes = poderes.filter(p => p.tempo < 12 && !p.coletado);

  if (boss) {
    boss.x += boss.dx * dt;

    if (boss.x < 80 || boss.x > canvas.width - 80) {
      boss.dx *= -1;
    }

    boss.tempo += dt;

    if (boss.tempo > 0.8) {
      criarTiroBoss();
      boss.tempo = 0;
    }

    if (boss.vida <= 0) {
      criarParticulas(boss.x, boss.y, "#ff5964", 35);
      moedasPartida += 15;
      dados.moedas += 15;
      boss = null;
      salvarDados();
      som(700, 0.3, "triangle");
    }
  }

  verificarColisoes();
  atualizarParticulas(dt);

  pontos = Math.floor(tempoDecorrido * 10) + moedasPartida * 5;
}

function criarTiro() {
  const lado = Math.floor(Math.random() * 4);
  let x, y;

  if (lado === 0) {
    x = Math.random() * canvas.width;
    y = -10;
  } else if (lado === 1) {
    x = canvas.width + 10;
    y = Math.random() * canvas.height;
  } else if (lado === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + 10;
  } else {
    x = -10;
    y = Math.random() * canvas.height;
  }

  const alvo = jogadores.filter(j => j.vivo);
  if (!alvo.length) return;

  const j = alvo[Math.floor(Math.random() * alvo.length)];
  const angulo = Math.atan2(j.y - y, j.x - x);
  const nivel = Math.floor(tempoDecorrido / 15) + 1;
  const base = dificuldade === "facil" ? 115 :
    dificuldade === "dificil" ? 205 : 155;
  const velocidade = base + nivel * 13;

  tiros.push({
    x, y,
    dx: Math.cos(angulo) * velocidade,
    dy: Math.sin(angulo) * velocidade,
    raio: 6,
    cor: "#ff5964",
    danoBoss: false
  });
}

function criarTiroBoss() {
  if (!boss) return;

  const alvos = jogadores.filter(j => j.vivo);
  if (!alvos.length) return;

  const alvo = alvos[Math.floor(Math.random() * alvos.length)];
  const anguloBase = Math.atan2(alvo.y - boss.y, alvo.x - boss.x);

  for (let i = -2; i <= 2; i++) {
    const angulo = anguloBase + i * 0.18;
    tiros.push({
      x: boss.x,
      y: boss.y + 25,
      dx: Math.cos(angulo) * 190,
      dy: Math.sin(angulo) * 190,
      raio: 7,
      cor: "#ff9d42",
      danoBoss: false
    });
  }
}

function criarBoss() {
  boss = {
    x: canvas.width / 2,
    y: 75,
    raio: 32,
    vida: 12,
    vidaMaxima: 12,
    dx: 125,
    tempo: 0
  };

  som(120, 0.5, "sawtooth");
  $("mensagem").classList.remove("escondido");
  $("mensagem").textContent = "⚠️ CHEFÃO APARECEU! Encoste nele para causar dano, mas cuidado com os tiros!";
  setTimeout(() => {
    if (rodando && !encerrado) {
      $("mensagem").classList.add("escondido");
    }
  }, 3500);
}

function criarPoder() {
  const tipos = ["escudo", "velocidade", "estrela", "moeda"];
  const tipo = tipos[Math.floor(Math.random() * tipos.length)];

  poderes.push({
    x: 30 + Math.random() * (canvas.width - 60),
    y: 30 + Math.random() * (canvas.height - 60),
    tipo,
    tempo: 0,
    raio: 12,
    simbolo: {
      escudo: "🛡️",
      velocidade: "⚡",
      estrela: "⭐",
      moeda: "🪙"
    }[tipo]
  });
}

function distancia(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function verificarColisoes() {
  jogadores.forEach(j => {
    if (!j.vivo) return;

    poderes.forEach(p => {
      if (distancia(j, p) < j.raio + p.raio + 3) {
        p.coletado = true;
        coletarPoder(j, p);
      }
    });

    tiros.forEach(t => {
      if (distancia(j, t) < j.raio + t.raio) {
        if (j.invencivel > 0) {
          criarParticulas(t.x, t.y, "#ffd45b", 4);
          t.x = -100;
        } else if (j.escudo > 0) {
          j.escudo = 0;
          criarParticulas(j.x, j.y, "#43b9ff", 12);
          t.x = -100;
          som(250, 0.15);
        } else {
          j.vivo = false;
          criarParticulas(j.x, j.y, j.cor, 25);
          som(100, 0.25, "sawtooth");
        }
      }
    });

    if (boss && distancia(j, boss) < j.raio + boss.raio) {
      if (j.invencivel > 0) {
        boss.vida -= 0.15;
      } else if (j.escudo > 0) {
        j.escudo = 0;
        boss.vida -= 1;
      } else {
        j.vivo = false;
        criarParticulas(j.x, j.y, j.cor, 25);
      }
    }
  });

  if (jogadores.every(j => !j.vivo)) {
    gameOver();
  }
}

function coletarPoder(j, p) {
  som(650, 0.12, "triangle");

  if (p.tipo === "escudo") {
    j.escudo = 7;
  } else if (p.tipo === "velocidade") {
    j.velocidadeExtra = 7;
  } else if (p.tipo === "estrela") {
    j.invencivel = 4;
  } else if (p.tipo === "moeda") {
    moedasPartida += 5;
    dados.moedas += 5;
    j.moedas += 5;
    salvarDados();
  }

  criarParticulas(p.x, p.y, "#ffd45b", 12);
}

function criarParticulas(x, y, cor, quantidade) {
  for (let i = 0; i < quantidade; i++) {
    const angulo = Math.random() * Math.PI * 2;
    const velocidade = 40 + Math.random() * 180;

    particulas.push({
      x, y,
      dx: Math.cos(angulo) * velocidade,
      dy: Math.sin(angulo) * velocidade,
      vida: 0.5 + Math.random() * 0.5,
      cor
    });
  }
}

function atualizarParticulas(dt) {
  particulas.forEach(p => {
    p.x += p.dx * dt;
    p.y += p.dy * dt;
    p.vida -= dt;
  });

  particulas = particulas.filter(p => p.vida > 0);
}

function desenhar() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#080d19";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#18233a";
  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  poderes.forEach(p => {
    ctx.save();
    ctx.shadowColor = "#ffd45b";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffd45b";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.raio + Math.sin(p.tempo * 6) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.font = "15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#080d19";
    ctx.fillText(p.simbolo, p.x, p.y);
  });

  tiros.forEach(t => {
    ctx.save();
    ctx.shadowColor = t.cor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = t.cor;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.raio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  if (boss) {
    ctx.save();
    ctx.shadowColor = "#ff5964";
    ctx.shadowBlur = 25;
    ctx.fillStyle = "#b51e46";
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, boss.raio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BOSS", boss.x, boss.y + 6);

    ctx.fillStyle = "#391421";
    ctx.fillRect(boss.x - 45, boss.y - 48, 90, 7);
    ctx.fillStyle = "#ff5964";
    ctx.fillRect(
      boss.x - 45,
      boss.y - 48,
      90 * Math.max(0, boss.vida / boss.vidaMaxima),
      7
    );
  }

  jogadores.forEach(j => {
    if (!j.vivo) return;

    ctx.save();

    if (j.invencivel > 0) {
      ctx.shadowColor = "#ffd45b";
      ctx.shadowBlur = 28;
    } else {
      ctx.shadowColor = j.cor;
      ctx.shadowBlur = 18;
    }

    ctx.fillStyle = j.invencivel > 0 ? "#ffd45b" : j.cor;
    ctx.beginPath();
    ctx.arc(j.x, j.y, j.raio, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    if (j.escudo > 0) {
      ctx.strokeStyle = "#43b9ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(j.x, j.y, j.raio + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#fff";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("P" + j.id, j.x, j.y - 21);
  });

  particulas.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.vida * 2);
    ctx.fillStyle = p.cor;
    ctx.fillRect(p.x, p.y, 4, 4);
  });

  ctx.globalAlpha = 1;

  if (pausado) {
    ctx.fillStyle = "#0009";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 38px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PAUSADO", canvas.width / 2, canvas.height / 2);
    ctx.font = "16px Arial";
    ctx.fillText("Pressione P para continuar", canvas.width / 2, canvas.height / 2 + 35);
  }
}

function atualizarHUD() {
  $("tempo").textContent = tempoDecorrido.toFixed(1);
  $("pontos").textContent = pontos;
  $("moedasPartida").textContent = moedasPartida;
  $("nivel").textContent = Math.floor(tempoDecorrido / 15) + 1;

  jogadores.forEach(j => {
    const status = $("status" + j.id);
    if (!status) return;

    const poderesAtivos = [];
    if (j.escudo > 0) poderesAtivos.push("🛡️ " + j.escudo.toFixed(0) + "s");
    if (j.velocidadeExtra > 0) poderesAtivos.push("⚡ " + j.velocidadeExtra.toFixed(0) + "s");
    if (j.invencivel > 0) poderesAtivos.push("⭐ " + j.invencivel.toFixed(0) + "s");

    status.textContent =
      (j.vivo ? "🟢" : "❌") + " Jogador " + j.id +
      (poderesAtivos.length ? " | " + poderesAtivos.join(" ") : "");
  });
}

function gameOver() {
  rodando = false;
  encerrado = true;
  cancelAnimationFrame(animacao);

  const sobreviventes = jogadores
    .filter(j => j.sobreviveu > 0)
    .sort((a, b) => b.sobreviveu - a.sobreviveu);

  let nome = "Jogador";
  if (modo === 2) {
    nome = sobreviventes.length
      ? "Jogador " + sobreviventes[0].id
      : "Empate";
  } else {
    nome = "Jogador 1";
  }

  dados.ranking.push({
    nome,
    tempo: tempoDecorrido,
    data: new Date().toLocaleDateString("pt-BR")
  });

  dados.ranking.sort((a, b) => b.tempo - a.tempo);
  dados.ranking = dados.ranking.slice(0, 10);

  salvarDados();
  desenharRanking("rankingMenu");

  $("mensagem").classList.remove("escondido");
  $("mensagem").innerHTML =
    `<h2>💥 Fim de jogo!</h2>
     <p>Tempo sobrevivido: <b>${tempoDecorrido.toFixed(1)} segundos</b></p>
     <p>Pontuação: <b>${pontos}</b></p>
     <p>Moedas ganhas nesta partida: <b>${moedasPartida}</b></p>
     <p>${modo === 2 ? "Resultado: " + nome : "Continue tentando bater seu recorde!"}</p>
     <button class="botao principal" onclick="iniciarJogo()">Jogar novamente</button>`;

  $("btnPausa").textContent = "⏸ Pausar (P)";
}

function alternarPausa() {
  if (!rodando || encerrado) return;

  pausado = !pausado;

  if (!pausado) {
    inicio = performance.now() - tempoDecorrido * 1000 - tempoPausa;
    ultimoFrame = 0;
    $("btnPausa").textContent = "⏸ Pausar (P)";
  } else {
    $("btnPausa").textContent = "▶ Continuar (P)";
  }
}

function voltarMenu() {
  rodando = false;
  pausado = false;
  encerrado = true;
  cancelAnimationFrame(animacao);
  limparTeclas();
  desenharRanking("rankingMenu");
  mostrar("menu");
}

function abrirLoja() {
  renderizarLoja();
  mostrar("loja");
}

function renderizarLoja() {
  const container = $("itensLoja");
  container.innerHTML = "";

  cores.forEach((skin, index) => {
    const desbloqueada = dados.desbloqueadas.includes(index);
    const selecionada = dados.skin1 === index;
    const card = document.createElement("div");
    card.className = "skin";

    const amostra = document.createElement("div");
    amostra.className = "amostra";
    amostra.style.background = skin.cor;
    amostra.style.color = skin.cor;
    card.appendChild(amostra);

    const nome = document.createElement("h3");
    nome.textContent = skin.nome;
    card.appendChild(nome);

    const preco = document.createElement("p");
    preco.textContent = skin.preco === 0 ? "Grátis" : `🪙 ${skin.preco}`;
    card.appendChild(preco);

    const botao = document.createElement("button");

    if (desbloqueada) {
      botao.textContent = selecionada ? "Selecionada" : "Usar skin";
      botao.disabled = selecionada;
      botao.onclick = () => {
        dados.skin1 = index;
        salvarDados();
        renderizarLoja();
      };
    } else {
      botao.textContent = "Comprar";
      botao.disabled = dados.moedas < skin.preco;

      botao.onclick = () => {
        if (dados.moedas < skin.preco) return;

        dados.moedas -= skin.preco;
        dados.desbloqueadas.push(index);
        dados.skin1 = index;
        salvarDados();
        renderizarLoja();
        som(750, 0.15, "triangle");
      };
    }

    card.appendChild(botao);
    container.appendChild(card);
  });

  if (modo === 2) {
    const aviso = document.createElement("p");
    aviso.textContent = "A skin selecionada será usada pelo Jogador 1. O Jogador 2 usa a cor azul.";
    container.appendChild(aviso);
  }
}

$("btnJogar").addEventListener("click", iniciarJogo);
$("btnLoja").addEventListener("click", abrirLoja);
$("btnVoltar").addEventListener("click", () => mostrar("menu"));
$("btnPausa").addEventListener("click", alternarPausa);
$("btnMenu").addEventListener("click", voltarMenu);

$("btnSom").addEventListener("click", () => {
  somLigado = !somLigado;
  $("btnSom").textContent = somLigado ? "🔊 Som ligado" : "🔇 Som desligado";
  if (somLigado) som(500, 0.08);
});

window.addEventListener("keydown", e => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }

  teclas[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true;

  if (e.key.toLowerCase() === "p" && !e.repeat) {
    alternarPausa();
  }
});

window.addEventListener("keyup", e => {
  teclas[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false;
});

window.addEventListener("blur", limparTeclas);

atualizarMoedas();
desenharRanking("rankingMenu");
mostrar("menu");
