
"use strict";

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

const WIDTH = 960;
const HEIGHT = 540;
canvas.width = WIDTH;
canvas.height = HEIGHT;

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

function readNumber(key, fallback) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readArray(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

let coins = readNumber(STORAGE.coins, 0);
let ownedSkins = readArray(STORAGE.owned, ["blue"]);
let currentSkin = localStorage.getItem(STORAGE.skin) || "blue";
let soundEnabled = localStorage.getItem(STORAGE.sound) !== "false";

if (!ownedSkins.includes("blue")) ownedSkins.push("blue");

let running = false;
let paused = false;
let gameEnded = false;
let animationId = 0;
let lastFrame = 0;
let elapsed = 0;
let score = 0;
let earned = 0;
let level = 1;
let spawnTimer = 0;
let previousSecond = 0;
let bullets = [];
let keys = new Set();
let player;
let difficulty = "normal";
let playerName = "Jogador";

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
  menu.classList.remove("active");
  game.classList.remove("active");
  shop.classList.remove("active");

  menu.classList.add("hidden");
  game.classList.add("hidden");
  shop.classList.add("hidden");

  screen.classList.remove("hidden");
  screen.classList.add("active");
}

function getSkin() {
  return SKINS.find((skin) => skin.id === currentSkin) || SKINS[0];
}

function updateHUD() {
  scoreElement.textContent = Math.floor(score);
  levelElement.textContent = level;
  timeElement.textContent = `${elapsed.toFixed(1)}s`;
  earnedElement.textContent = earned;
  updateCoins();
}

function createPlayer() {
  return {
    x: WIDTH / 2,
    y: HEIGHT - 75,
    radius: 17,
    speed: 320,
    color: getSkin().color
  };
}

function startGame() {
  cancelAnimationFrame(animationId);

  playerName = playerNameInput.value.trim().slice(0, 16) || "Jogador";
  difficulty = difficultySelect.value || "normal";

  elapsed = 0;
  score = 0;
  earned = 0;
  level = 1;
  spawnTimer = 0;
  previousSecond = 0;
  bullets = [];
  keys.clear();
  player = createPlayer();

  running = true;
  paused = false;
  gameEnded = false;
  lastFrame = 0;

  $("pauseBtn").textContent = "PAUSAR";
  $("soundBtn").textContent = soundEnabled ? "SOM: LIGADO" : "SOM: DESLIGADO";

  gameMessage.classList.add("hidden");
  gameMessage.innerHTML = "";

  showScreen(game);
  updateHUD();

  animationId = requestAnimationFrame(loop);
}

function stopGame() {
  running = false;
  paused = false;
  cancelAnimationFrame(animationId);
  keys.clear();
}

function loop(timestamp) {
  if (!running) return;

  const delta = lastFrame
    ? Math.min((timestamp - lastFrame) / 1000, 0.04)
    : 0;

  lastFrame = timestamp;

  if (!paused) update(delta);
  draw();

  if (running) animationId = requestAnimationFrame(loop);
}

function update(delta) {
  elapsed += delta;
  level = 1 + Math.floor(elapsed / 15);

  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowLeft") || keys.has("a")) dx--;
  if (keys.has("ArrowRight") || keys.has("d")) dx++;
  if (keys.has("ArrowUp") || keys.has("w")) dy--;
  if (keys.has("ArrowDown") || keys.has("s")) dy++;

  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }

  player.x += dx * player.speed * delta;
  player.y += dy * player.speed * delta;

  player.x = clamp(player.x, player.radius, WIDTH - player.radius);
  player.y = clamp(player.y, player.radius, HEIGHT - player.radius);

  const currentSecond = Math.floor(elapsed);
  if (currentSecond > previousSecond) {
    score += (currentSecond - previousSecond) * 10;
    previousSecond = currentSecond;
  }

  const rates = { easy: 0.95, normal: 0.65, hard: 0.4 };
  spawnTimer += delta;

  if (spawnTimer >= Math.max(0.22, rates[difficulty] / (1 + (level - 1) * 0.1))) {
    spawnTimer = 0;
    spawnBullet();
  }

  for (const bullet of bullets) {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
    bullet.rotation += delta * 4;
  }

  bullets = bullets.filter(
    (b) => b.x > -30 && b.x < WIDTH + 30 && b.y > -30 && b.y < HEIGHT + 30
  );

  checkCollisions();
  updateHUD();
}

function spawnBullet() {
  const side = Math.floor(Math.random() * 4);
  let x, y;

  if (side === 0) {
    x = Math.random() * WIDTH;
    y = -10;
  } else if (side === 1) {
    x = Math.random() * WIDTH;
    y = HEIGHT + 10;
  } else if (side === 2) {
    x = -10;
    y = Math.random() * HEIGHT;
  } else {
    x = WIDTH + 10;
    y = Math.random() * HEIGHT;
  }

  const angle = Math.atan2(player.y - y, player.x - x);
  const baseSpeed = { easy: 115, normal: 160, hard: 210 }[difficulty];
  const speed = baseSpeed + level * 5;
  const direction = Math.random() < 0.8
    ? angle
    : Math.random() * Math.PI * 2;

  bullets.push({
    x,
    y,
    radius: 8,
    vx: Math.cos(direction) * speed,
    vy: Math.sin(direction) * speed,
    rotation: 0
  });
}

function checkCollisions() {
  for (const bullet of bullets) {
    if (
      Math.hypot(bullet.x - player.x, bullet.y - player.y) <
      bullet.radius + player.radius * 0.75
    ) {
      endGame();
      return;
    }
  }
}

function endGame() {
  if (gameEnded) return;

  gameEnded = true;
  running = false;
  cancelAnimationFrame(animationId);

  earned = Math.floor(score / 20) + Math.floor(elapsed / 5);
  coins += earned;

  saveProgress();
  updateHUD();
  saveRanking();

  gameMessage.innerHTML = `
    <h2>FIM DE JOGO!</h2>
    <p>Jogador: ${escapeHTML(playerName)}</p>
    <p>Pontuação: <strong>${Math.floor(score)}</strong></p>
    <p>Tempo: <strong>${elapsed.toFixed(1)}s</strong></p>
    <p>Moedas ganhas: <strong>${earned}</strong></p>
    <button id="restartBtn" class="primary">JOGAR NOVAMENTE</button>
    <button id="endMenuBtn" class="secondary">VOLTAR AO MENU</button>
  `;

  gameMessage.classList.remove("hidden");

  $("restartBtn").addEventListener("click", startGame);
  $("endMenuBtn").addEventListener("click", returnToMenu);
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

function saveRanking() {
  const ranking = readArray(STORAGE.ranking, []);

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
  const ranking = readArray(STORAGE.ranking, []);

  $("ranking").innerHTML = ranking.length
    ? ranking.map((item) => `
        <li>
          <span>${escapeHTML(item.name)}</span>
          <strong>${item.score} pts</strong>
        </li>
      `).join("")
    : "<li>Jogue para registrar sua pontuação.</li>";
}

function returnToMenu() {
  stopGame();
  gameMessage.classList.add("hidden");
  showScreen(menu);
}

function togglePause() {
  if (!running || gameEnded) return;

  paused = !paused;
  $("pauseBtn").textContent = paused ? "CONTINUAR" : "PAUSAR";
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem(STORAGE.sound, String(soundEnabled));
  $("soundBtn").textContent = soundEnabled ? "SOM: LIGADO" : "SOM: DESLIGADO";
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

    const text = selected
      ? "EQUIPADA"
      : owned
        ? "EQUIPAR"
        : `COMPRAR — ${skin.price} MOEDAS`;

    return `
      <article class="shop-item ${selected ? "selected" : ""}">
        <div style="
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: ${skin.color};
          box-shadow: 0 0 18px ${skin.color}66;
        "></div>
        <h3>${escapeHTML(skin.name)}</h3>
        <p>${owned ? "Skin desbloqueada" : "Personalize seu jogador."}</p>
        <button class="${selected ? "secondary" : "primary"}"
          data-skin="${skin.id}" ${selected ? "disabled" : ""}>
          ${text}
        </button>
      </article>
    `;
  }).join("");

  shopItems.querySelectorAll("[data-skin]").forEach((button) => {
    button.addEventListener("click", () => {
      const skin = SKINS.find((item) => item.id === button.dataset.skin);
      if (!skin) return;

      if (!ownedSkins.includes(skin.id)) {
        if (coins < skin.price) {
          alert("Você não tem moedas suficientes.");
          return;
        }

        coins -= skin.price;
        ownedSkins.push(skin.id);
      }

      currentSkin = skin.id;
      saveProgress();
      updateCoins();
      renderShop();
    });
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

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

  for (const bullet of bullets) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(bullet.rotation);
    ctx.shadowColor = "#fb4141";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#fb4141";

    ctx.beginPath();
    ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  if (player) {
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

    ctx.restore();
  }

  if (paused && running) {
    ctx.fillStyle = "#020617cc";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PAUSADO", WIDTH / 2, HEIGHT / 2);
  }
}

// Controles do teclado.
document.addEventListener("keydown", (event) => {
  const key = event.key.length === 1
    ? event.key.toLowerCase()
    : event.key;

  if (key.startsWith("Arrow") || key === " ") event.preventDefault();

  if (key === "Escape") {
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

window.addEventListener("blur", () => keys.clear());

// Controles de toque.
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
});

// Botões da interface.
$("startBtn").addEventListener("click", startGame);
$("shopBtn").addEventListener("click", openShop);
$("backBtn").addEventListener("click", () => showScreen(menu));
$("pauseBtn").addEventListener("click", togglePause);
$("soundBtn").addEventListener("click", toggleSound);
$("menuBtn").addEventListener("click", returnToMenu);

// Inicialização.
updateCoins();
renderRanking();
showScreen(menu);
