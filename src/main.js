import { ensureChunks } from './chunks.js';
import { drawGame } from './draw.js';
import { createOwnedUpgrades, purchaseUpgrade, upgrades } from './upgrades.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const state = {
  canvas,
  ctx,
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
  zoneY: canvas.height + 15,
  elapsed: 0,
  messageTimer: 0,
  normalCollected: 0,
  normalSpawned: 0,
  camera: { x: 0, y: 0 },
  player: null,
  enemy: null,
  exit: null,
  lastTime: 0
};

state.syncHud = function syncHud() {
  const labels = { ready: 'Ready', collect: 'Collect', bonus: 'Escape!', shop: 'Upgrade', dead: 'Run over', escaped: 'Cleared' };
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
  state.enemy = { x: 330, y: 440, w: 31, h: 30, vx: 95 + state.round * 7, min: 250, max: 510 };
  state.exit = null;
  state.zoneY = state.player.y + state.height + 20;
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
  if (state.mode !== 'collect' && state.mode !== 'bonus') return;
  if (state.player.grounded || (state.owned.doubleJump && state.player.jumps < 2)) {
    state.player.vy = state.player.grounded ? -470 : -430;
    state.player.grounded = false;
    state.player.jumps += 1;
  }
}

function collide(a, b) {
  return a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function startBonus() {
  state.mode = 'bonus';
  state.dots = [];
  ensureChunks(state);
  for (let index = 0; index < 10; index += 1) {
    const targetX = state.player.x + 120 + index * 88;
    const target = state.platforms
      .filter(platform => Math.abs(platform.x + platform.w / 2 - targetX) < 105 && platform.y < state.player.y + 40 && platform.y > state.player.y - 170)
      .sort((a, b) => Math.abs(a.x + a.w / 2 - targetX) - Math.abs(b.x + b.w / 2 - targetX))[0];
    if (target) state.dots.push({ x: targetX, y: target.y - 27, type: 'currency', taken: false, chunk: target.chunk });
  }
  const exitX = state.player.x + 470;
  const exitPlatform = state.platforms
    .filter(platform => Math.abs(platform.x + platform.w / 2 - exitX) < 105 && platform.y < state.player.y + 40 && platform.y > state.player.y - 180)
    .sort((a, b) => Math.abs(a.x + a.w / 2 - exitX) - Math.abs(b.x + b.w / 2 - exitX))[0];
  if (exitPlatform) state.exit = { x: exitPlatform.x + exitPlatform.w - 48, y: exitPlatform.y - 54, w: 42, h: 50 };
  state.zoneY = state.player.y + state.height * 0.70;
  state.messageTimer = 2;
  state.syncHud();
}

function update(dt) {
  if (state.mode !== 'collect' && state.mode !== 'bonus') return;
  state.elapsed += dt;
  state.camera.x += (state.player.x - state.width * 0.38 - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y = Math.min(state.camera.y, state.player.y - state.height * 0.55);
  ensureChunks(state);
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
      state.player.jumps = 0;
    }
  }

  if (state.player.y > state.camera.y + state.height + 40 || (state.mode === 'bonus' && state.player.y + state.player.h >= state.zoneY)) {
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

  if (state.mode === 'collect' && state.normalCollected >= 10) startBonus();
  if (state.mode === 'bonus') {
    state.zoneY -= (27 + state.round * 2) * (state.owned.slowZone ? 0.75 : 1) * dt;
    if (collide(state.player, state.exit)) {
      state.mode = 'shop';
      state.syncHud();
    }
    if (state.player.y + state.player.h >= state.zoneY) {
      state.mode = 'dead';
      state.syncHud();
    }
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
  if (code === 'ShiftLeft' && state.owned.dash && state.player.dashCooldown <= 0 && (state.mode === 'collect' || state.mode === 'bonus')) {
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