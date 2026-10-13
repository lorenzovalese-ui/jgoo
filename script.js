
"use strict";

// ========================================
// DESVIE DOS TIROS - SCRIPT PRINCIPAL
// ========================================

const $ = (id) => document.getElementById(id);

const menu = $("menu");
const game = $("game");
const shop = $("shop");
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const coinsElement = $("coins");
const playerNameInput = $("playerName");
const difficultySelect = $("difficulty");
const scoreElement = $("score");
const levelElement = $("level");
const timeElement = $("time");
const earnedElement = $("earned");
const gameMessage = $("gameMessage");
const shopCoins = $("shopCoins");
const shopItems = $("shopItems");

const WIDTH = canvas.width = 960;
const HEIGHT = canvas.height = 540;

const STORAGE = {
  coins: "desvieCoins",
  ranking: "desvieRanking",
  skin: "desvieSkin",
  owned: "desvieOwnedSkins",
  sound: "desvieSound"
};

const SKINS = [
  { id: "blue", name: "Azul padrão", color: "#38bdf8", price: 0 },
  { id: "green", name: "Verde neon", color: "#4ade80", price: 50 },
  { id: "purple", name: "Roxo cósmico", color: "#c084fc", price: 100 },
  { id: "gold", name: "Dourado", color: "#facc15", price: 200 },
  { id: "red", name: "Vermelho", color: "#fb7185", price: 300 },
  { id: "white", name: "Branco gelo", color: "#f8fafc", price: 400 }
];

let coins = readNumber(STORAGE.coins, 0);
let ownedSkins = readJSON(STORAGE.owned, ["blue"]);
let currentSkin = localStorage.getItem(STORAGE.skin) || "blue";
let soundEnabled = localStorage.getItem(STORAGE.sound) !== "false";

let running = false;
let paused = false;
let animationId = null;
let lastFrame = 0;
let elapsed = 0;
let score = 0;
let earned = 0;
let level = 1;
let spawnTimer = 0;
let shotTimer = 0;
let enemyBullets = [];
let particles = [];
let keys = new Set();
let player = null;
let difficulty = "normal";
let playerName = "Jogador";
let previousTime = 0;
let gameEnded = false;

function readNumber(key, fallback) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && localStorage.getItem(key) !== null
    ? value
    : fallback;
}

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE.coins, String(coins));
  localStorage.setItem(STORAGE.owned, JSON.stringify(ownedSkins));
  localStorage.setItem(STORAGE.skin, currentSkin);
  localStorage.setItem(STORAGE.sound, String(soundEnabled));
}

function updateCoins() {
  coinsElement.textContent = coins;
  shopCoins.textContent = coins;
}

function showScreen(screen) {
  menu.classList.add("hidden");
  game.classList.add("hidden");
  shop.classList.add("hidden");
  screen.classList.remove("hidden");
}

function getSkin() {
  return SKINS.find((skin) => skin.id === currentSkin) || SKINS[0];
}

function createPlayer() {
  return {
    x: WIDTH / 2,
    y: HEIGHT - 75,
    radius: 17,
    speed: 330,
    color: getSkin().color,
    invulnerable: 0
  };
}

function startGame() {
  if (running) {
    stopGame();
  }

  playerName = playerNameInput.value.trim().slice(0, 20) || "Jogador";
  difficulty = difficultySelect.value || "normal";

  score = 0;
  earned = 0;
  level = 1;
  elapsed = 0;
  spawnTimer = 0;
  shotTimer = 0;
  enemyBullets = [];
  particles = [];
  keys.clear();
  player = createPlayer();

  paused = false;
  running = true;
  gameEnded = false;
  lastFrame = 0;

  $("pauseBtn").textContent = "Pausar";
  $("soundBtn").textContent = soundEnabled ? "Som: ligado" : "Som: desligado";
  gameMessage.classList.add("hidden");

  updateHUD();
  showScreen(game);

  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

function stopGame() {
  running = false;
  paused = false;
  cancelAnimationFrame(animationId);
  keys.clear();
}

function updateHUD() {
  scoreElement.textContent = Math.floor(score);
  levelElement.textContent = level;
  timeElement.textContent = `${elapsed.toFixed(1)}s`;
  earnedElement.textContent = earned;
  updateCoins();
}

function loop(timestamp) {
  if (!running) return;

  if (!lastFrame) lastFrame = timestamp;
  const delta = Math.min((timestamp - lastFrame) / 1000, 0.035);
  lastFrame = timestamp;

  if (!paused) {
    update(delta);
  }

  draw();

  if (running) {
    animationId = requestAnimationFrame(loop);
  }
}

function update(delta) {
  elapsed += delta;
  level = 1 + Math.floor(elapsed / 15);

  const playerSpeed = player.speed * delta;
  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;

  if (dx && dy) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }

  player.x += dx * playerSpeed;
  player.y += dy * playerSpeed;

  player.x = clamp(player.x, player.radius, WIDTH - player.radius);
  player.y = clamp(player.y, player.radius, HEIGHT - player.radius);

  player.invulnerable = Math.max(0, player.invulnerable - delta);

  const spawnRates = {
    easy: 0.85,
    normal: 0.58,
    hard: 0.36
  };

  spawnTimer += delta;
  const spawnRate = Math.max(
    0.18,
    spawnRates[difficulty] / (1 + (level - 1) * 0.12)
  );

  if (spawnTimer >= spawnRate) {
    spawnTimer = 0;
    spawnEnemy();
  }

  for (const bullet of enemyBullets) {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
    bullet.rotation += delta * 3;
  }

  enemyBullets = enemyBullets.filter(
    (bullet) =>
      bullet.x > -40 &&
      bullet.x < WIDTH + 40 &&
      bullet.y > -40 &&
      bullet.y < HEIGHT + 40
  );

  shotTimer += delta;

  // Pequena recompensa por sobreviver.
  if (Math.floor(elapsed) > Math.floor(previousTime)) {
    score += 10;
    previousTime = elapsed;
  }

  // Pontuação por tempo sobrevivido.
  if (Math.floor(elapsed) > 0 && Math.floor(elapsed) % 10 === 0) {
    // A pontuação principal é atualizada por segundo acima.
  }

  updateParticles(delta);
  checkCollisions();
  updateHUD();
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 3);
  let x;
  let y;

  if (edge === 0) {
    x = Math.random() * WIDTH;
    y = -20;
  } else if (edge === 1) {
    x = Math.random() * WIDTH;
    y = HEIGHT + 20;
  } else {
    x = Math.random() < 0.5 ? -20 : WIDTH + 20;
    y = Math.random() * HEIGHT;
  }

  const angle = Math.atan2(player.y - y, player.x - x);
  const baseSpeed = {
    easy: 100,
    normal: 145,
    hard: 190
  }[difficulty];

  const speed = baseSpeed + level * 5;

  const aim = Math.random() < 0.72;
  const direction = aim ? angle : Math.random() * Math.PI * 2;

  const bullet = {
    x,
    y,
    radius: 8,
    vx: Math.cos(direction) * speed,
    vy: Math.sin(direction) * speed,
    rotation: 0,
    color: Math.random() < 0.5 ? "#fb4141" : "#fb923c"
  };

  enemyBullets.push(bullet);
}

function checkCollisions() {
  if (!player || player.invulnerable > 0) return;

  for (const bullet of enemyBullets) {
    const distance = Math.hypot(
      bullet.x - player.x,
      bullet.y - player.y
    );

    if (distance < bullet.radius + player.radius * 0.75) {
      endGame();
      return;
    }
  }
}

function endGame() {
  if (gameEnded) return;

  gameEnded = true;
  running = false;
  paused = false;
  cancelAnimationFrame(animationId);

  const bonus = Math.max(0, Math.floor(score / 20));
  earned += bonus;
  coins += earned;

  saveProgress();
  updateCoins();
  updateHUD();
  saveRanking();

  $("gameMessage").innerHTML = `
    <h2>Fim de jogo!</h2>
    <p>Jogador: ${escapeHTML(playerName)}</p>
    <p>Pontuação: <strong>${Math.floor(score)}</strong></p>
    <p>Tempo sobrevivido: <strong>${elapsed.toFixed(1)}s</strong></p>
    <p>Moedas ganhas nesta partida: <strong>${earned}</strong></p>
    <button id="restartBtn" class="primary-button">Jogar novamente</button>
    <button id="endMenuBtn" class="secondary-button">Voltar ao menu</button>
  `;

  gameMessage.classList.remove("hidden");

  $("restartBtn").addEventListener("click", startGame);
  $("endMenuBtn").addEventListener("click", returnToMenu);
}

function saveRanking() {
  const ranking = readJSON(STORAGE.ranking, []);

  ranking.push({
    name: playerName,
    score: Math.floor(score),
    time: Number(elapsed.toFixed(1))
  });

  ranking.sort((a, b) => b.score - a.score);
  localStorage.setItem(STORAGE.ranking, JSON.stringify(ranking.slice(0, 10)));
  renderRanking();
}

function renderRanking() {
  const container = $("ranking");
  const ranking = readJSON(STORAGE.ranking, []);

  container.innerHTML = `
    <h2>Ranking local</h2>
    <ol class="ranking-list">
      ${
        ranking.length
          ? ranking.map((item) => `
            <li>
              <span>${escapeHTML(item.name)}</span>
              <strong>${item.score} pts</strong>
            </li>
          `).join("")
          : "<li>Ainda não há partidas registradas.</li>"
      }
    </ol>
  `;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function returnToMenu() {
  stopGame();
  gameMessage.classList.add("hidden");
  showScreen(menu);
  renderRanking();
  updateCoins();
}

function togglePause() {
  if (!running || gameEnded) return;

  paused = !paused;
  $("pauseBtn").textContent = paused ? "Continuar" : "Pausar";
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem(STORAGE.sound, String(soundEnabled));
  $("soundBtn").textContent = soundEnabled ? "Som: ligado" : "Som: desligado";
}

function openShop() {
  renderShop();
  showScreen(shop);
}

function renderShop() {
  shopCoins.textContent = coins;

  shopItems.innerHTML = SKINS.map((skin) => {
    const owned = ownedSkins.includes(skin.id);
    const selected = currentSkin === skin.id;

    let buttonText;
    if (selected) {
      buttonText = "Equipado";
    } else if (owned) {
      buttonText = "Equipar";
    } else {
      buttonText = `Comprar — ${skin.price} moedas`;
    }

    return `
      <article class="shop-item ${selected ? "selected" : ""}">
        <div style="
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: ${skin.color};
          box-shadow: 0 0 20px ${skin.color}66;
        "></div>
        <h3>${escapeHTML(skin.name)}</h3>
        <p>${owned ? "Skin desbloqueada" : "Personalize seu jogador."}</p>
        <button
          class="${selected ? "secondary-button" : "primary-button"}"
          data-skin="${skin.id}"
          ${selected ? "disabled" : ""}
        >${buttonText}</button>
      </article>
    `;
  }).join("");

  shopItems.querySelectorAll("[data-skin]").forEach((button) => {
    button.addEventListener("click", () => {
      buyOrEquipSkin(button.dataset.skin);
    });
  });
}

function buyOrEquipSkin(id) {
  const skin = SKINS.find((item) => item.id === id);
  if (!skin) return;

  if (ownedSkins.includes(id)) {
    currentSkin = id;
    saveProgress();
    renderShop();
    return;
  }

  if (coins < skin.price) {
    alert("Você não tem moedas suficientes para comprar esta skin.");
    return;
  }

  coins -= skin.price;
  ownedSkins.push(id);
  currentSkin = id;

  saveProgress();
  updateCoins();
  renderShop();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateParticles(delta) {
  for (const particle of particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
  }

  particles = particles.filter((particle) => particle.life > 0);
}

function drawBackground() {
  ctx.fillStyle = "#050914";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "#172033";
  ctx.lineWidth = 1;

  for (let x = 0; x <= WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }

  for (let y = 0; y <= HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Pontos decorativos.
  ctx.fillStyle = "#64748b";

  for (let i = 0; i < 35; i++) {
    const x = (i * 173) % WIDTH;
    const y = (i * 97) % HEIGHT;

    ctx.globalAlpha = 0.2 + ((i % 3) * 0.15);
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.globalAlpha = 1;
}

function drawPlayer() {
  if (!player) return;

  if (player.invulnerable > 0 && Math.floor(performance.now() / 100) % 2 === 0) {
    return;
  }

  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.shadowColor = player.color;
  ctx.shadowBlur = 22;
  ctx.fillStyle = player.color;

  ctx.beginPath();
  ctx.moveTo(0, -player.radius - 5);
  ctx.lineTo(player.radius, player.radius);
  ctx.lineTo(0, player.radius * 0.55);
  ctx.lineTo(-player.radius, player.radius);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";

  ctx.beginPath();
  ctx.arc(0, 2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBullets() {
  for (const bullet of enemyBullets) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(bullet.rotation);

    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = bullet.color;

    ctx.beginPath();
    ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";

    ctx.beginPath();
    ctx.arc(-2, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 3, 3);
  }

  ctx.globalAlpha = 1;
}

function draw() {
  drawBackground();
  drawBullets();
  drawParticles();
  drawPlayer();

  if (paused && running) {
    ctx.fillStyle = "#020617bb";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PAUSADO", WIDTH / 2, HEIGHT / 2);
  }
}

// ========================================
// CONTROLES
// ========================================

document.addEventListener("keydown", (event) => {
  const key = event.key.length === 1
    ? event.key.toLowerCase()
    : event.key;

  if ([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    " "
  ].includes(event.key)) {
    event.preventDefault();
  }

  if (key === "Escape" && running) {
    togglePause();
    return;
  }

  keys.add(key);
});

document.addEventListener("keyup", (event) => {
  const key = event.key.length === 1
    ? event.key.toLowerCase()
    : event.key;

  keys.delete(key);
});

window.addEventListener("blur", () => {
  keys.clear();
});

document.querySelectorAll("[data-key]").forEach((button) => {
  const key = button.dataset.key;

  const press = (event) => {
    event.preventDefault();
    keys.add(key);
  };

  const release = (event) => {
    event.preventDefault();
    keys.delete(key);
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
});

// ========================================
// BOTÕES DA INTERFACE
// ========================================

$("startBtn").addEventListener("click", startGame);
$("shopBtn").addEventListener("click", openShop);
$("backBtn").addEventListener("click", () => showScreen(menu));
$("pauseBtn").addEventListener("click", togglePause);
$("soundBtn").addEventListener("click", toggleSound);
$("menuBtn").addEventListener("click", returnToMenu);

// ========================================
// INICIALIZAÇÃO
// ========================================

updateCoins();
renderRanking();
showScreen(menu);
