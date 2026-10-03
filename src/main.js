import { CHUNK_HEIGHT, CHUNK_WIDTH, ensureChunks, loadChunkArea } from './chunks.js';
import { startCollapseWaves, updateCollapse } from './collapse.js';
import { drawGame } from './draw.js';
import { createOwnedUpgrades, purchaseUpgrade, upgrades } from './upgrades.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const VOID_DEATH_DEPTH = 650;
const state = {
  canvas,
  ctx,
  voidDeathDepth: VOID_DEATH_DEPTH,
  width: canvas.width,
  height: canvas.height,
  phaseNode: document.querySelector('#phase'),
  dotsNode: document.querySelector('#dots'),
  creditsNode: document.querySelector('#credits'),
  shieldNode: document.querySelector('#shield'),
  upgrades,
  owned: createOwnedUpgrades(),
  keys: new Set(),
  platforms: [],
  chunks: new Map(),
  dots: [],
  shopButtons: [],
  mode: 'ready',
  credits: 0,
  round: 1,
  elapsed: 0,
  messageTimer: 0,
  normalCollected: 0,
  normalSpawned: 0,
  camera: { x: 0, y: 0 },
  player: null,
  enemy: null,
  exit: null,
  exitPlatform: null,
  collapse: null,
  lastTime: 0
};

state.syncHud = function syncHud() {
  const labels = { ready: 'Ready', collect: 'Collect', collapse: 'Collapse!', shop: 'Upgrade', dead: 'Run over', escaped: 'Cleared' };
  state.phaseNode.textContent = labels[state.mode] || 'Ready';
  state.dotsNode.innerHTML = `${state.normalCollected} <small>/ 10</small>`;
  state.creditsNode.textContent = state.credits;
  state.shieldNode.textContent = state.player && state.player.shieldUsed ? 'Spent' : 'Ready';
};

function resetRound() {
  state.chunks.clear();
  state.platforms.length = 0;
  state.dots = [];
  state.normalCollected = 0;
  state.normalSpawned = 0;
  state.player = { x: 48, y: 416, vx: 0, vy: 0, w: 25, h: 34, grounded: false, jumps: 0, invulnerable: 0, dashTime: 0, dashCooldown: 0, facing: 1, shieldUsed: false };
  state.camera = { x: state.player.x - state.width * 0.35, y: state.player.y - state.height * 0.55 };
  ensureChunks(state);
  state.platforms.push({ x: -80, y: 470, w: 240, h: 16, chunk: 'start' });
  state.player.y = 436;
  state.player.groundY = state.player.y;
  state.camera = { x: state.player.x + state.player.w / 2 - state.width / 2, y: state.player.y + state.player.h / 2 - state.height / 2 };
  state.enemy = { x: 330, y: 440, w: 31, h: 30, vx: 95 + state.round * 7, min: 250, max: 510 };
  state.exit = null;
  state.exitPlatform = null;
  state.collapse = null;
  state.elapsed = 0;
  state.mode = 'ready';
  state.syncHud();
}

function beginRound() {
  if (state.mode === 'ready' || state.mode === 'dead') resetRound();
  state.mode = 'collect';
  state.syncHud();
}

function jump() {
  if (state.mode !== 'collect' && state.mode !== 'collapse') return;
  if (state.player.grounded || (state.owned.doubleJump && state.player.jumps < 2)) {
    state.player.vy = state.player.grounded ? -470 : -430;
    state.player.grounded = false;
    state.player.jumps += 1;
  }
}

function collide(a, b) {
  return a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function startCollapse() {
  state.mode = 'collapse';
  state.exitPlatform = state.platforms.find(platform => platform.chunk === 'start');
  const start = state.exitPlatform;
  state.exit = { x: start.x + start.w / 2 - 21, y: start.y - 50, w: 42, h: 50 };

  // Load the whole region between the player and the exit so a route back exists.
  const cx = [Math.floor(state.player.x / CHUNK_WIDTH), Math.floor(state.exit.x / CHUNK_WIDTH)];
  const cy = [Math.floor(state.player.y / CHUNK_HEIGHT), Math.floor(state.exit.y / CHUNK_HEIGHT)];
  loadChunkArea(state, Math.min(...cx) - 1, Math.max(...cx) + 1, Math.min(...cy) - 1, Math.max(...cy) + 1);

  const origin = { x: start.x + start.w / 2, y: start.y };
  const candidates = state.platforms
    .filter(platform => platform !== start)
    .sort((a, b) => ((b.x - origin.x) ** 2 + (b.y - origin.y) ** 2) - ((a.x - origin.x) ** 2 + (a.y - origin.y) ** 2));
  const count = Math.min(10, candidates.length);
  state.dots = [];
  for (let index = 0; index < count; index += 1) {
    const platform = candidates[Math.floor(index * candidates.length / count)];
    state.dots.push({ x: platform.x + platform.w / 2, y: platform.y - 27, type: 'currency', taken: false, chunk: platform.chunk, platform });
  }

  startCollapseWaves(state);
  state.messageTimer = 2;
  state.syncHud();
}

function update(dt) {
  if (state.mode !== 'collect' && state.mode !== 'collapse') return;
  state.elapsed += dt;
  const follow = Math.min(1, dt * 6);
  state.camera.x += (state.player.x + state.player.w / 2 - state.width / 2 - state.camera.x) * follow;
  state.camera.y += (state.player.y + state.player.h / 2 - state.height / 2 - state.camera.y) * follow;
  if (state.mode === 'collect') ensureChunks(state);
  else updateCollapse(state, dt);
  state.player.invulnerable = Math.max(0, state.player.invulnerable - dt);
  state.player.dashCooldown = Math.max(0, state.player.dashCooldown - dt);
  state.player.dashTime = Math.max(0, state.player.dashTime - dt);

  const left = state.keys.has('ArrowLeft') || state.keys.has('KeyA');
  const right = state.keys.has('ArrowRight') || state.keys.has('KeyD');
  const direction = (right ? 1 : 0) - (left ? 1 : 0);
  if (direction) state.player.facing = direction;
  state.player.vx = direction * (state.player.dashTime > 0 ? 530 : 225);
  if (state.player.dashTime <= 0) state.player.vy += 1120 * dt;
  state.player.x += state.player.vx * dt;
  state.player.y += state.player.vy * dt;

  state.player.grounded = false;
  for (const platform of state.platforms) {
    const crossedTop = state.player.y + state.player.h >= platform.y && state.player.y + state.player.h - state.player.vy * dt <= platform.y;
    const overlaps = state.player.x + state.player.w > platform.x && state.player.x < platform.x + platform.w;
    if (state.player.vy >= 0 && crossedTop && overlaps) {
      state.player.y = platform.y - state.player.h;
      state.player.vy = 0;
      state.player.grounded = true;
      state.player.groundY = platform.y;
      state.player.jumps = 0;
    }
  }

  if (state.player.y - state.player.groundY > VOID_DEATH_DEPTH) {
    state.mode = 'dead';
    state.syncHud();
    return;
  }

  state.enemy.x += state.enemy.vx * dt;
  if (state.enemy.x < state.enemy.min || state.enemy.x + state.enemy.w > state.enemy.max) state.enemy.vx *= -1;
  if (collide(state.player, state.enemy) && state.player.invulnerable === 0) {
    if (!state.player.shieldUsed) {
      state.player.shieldUsed = true;
      state.player.invulnerable = 1.1;
      state.player.vy = -310;
      state.player.vx = state.player.x < state.enemy.x ? -180 : 180;
      state.messageTimer = 1.1;
    } else {
      state.mode = 'dead';
      state.syncHud();
      return;
    }
  }

  for (const dot of state.dots) {
    if (dot.taken) continue;
    const dx = state.player.x + state.player.w / 2 - dot.x;
    const dy = state.player.y + state.player.h / 2 - dot.y;
    if (dx * dx + dy * dy >= 24 * 24) continue;
    dot.taken = true;
    if (dot.type === 'currency') state.credits += 1;
    else state.normalCollected += 1;
  }

  if (state.mode === 'collect' && state.normalCollected >= 10) startCollapse();
  if (state.mode === 'collapse' && collide(state.player, state.exit)) {
    state.mode = 'shop';
    state.syncHud();
  }
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.syncHud();
}

function frame(time) {
  const dt = Math.min((time - state.lastTime) / 1000 || 0, 0.033);
  state.lastTime = time;
  update(dt);
  drawGame(ctx, state, state.width, state.height);
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', event => {
  const { code } = event;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(code)) event.preventDefault();
  state.keys.add(code);
  if (['Space', 'ArrowUp', 'KeyW'].includes(code) && !event.repeat) jump();
  if (code === 'Enter' && !event.repeat) {
    if (state.mode === 'shop') {
      state.round += 1;
      resetRound();
      beginRound();
    } else if (state.mode === 'ready' || state.mode === 'dead') beginRound();
  }
  if (code.startsWith('Digit')) purchaseUpgrade(state, Number(code.slice(5)) - 1);
  if (code === 'ShiftLeft' && state.owned.dash && state.player.dashCooldown <= 0 && (state.mode === 'collect' || state.mode === 'collapse')) {
    state.player.dashTime = 0.18;
    state.player.dashCooldown = 1.1;
    state.player.vy = 0;
  }
});

window.addEventListener('keyup', event => state.keys.delete(event.code));
canvas.addEventListener('pointerdown', event => {
  if (state.mode !== 'shop') return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * state.width / rect.width;
  const y = (event.clientY - rect.top) * state.height / rect.height;
  const button = state.shopButtons.find(item => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h);
  if (button) purchaseUpgrade(state, button.index);
});

resetRound();
requestAnimationFrame(frame);