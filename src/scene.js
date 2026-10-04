import Phaser from 'phaser';
import { startCollapseWaves, updateCollapse } from './collapse.js';
import { createPlatformDots, rewardDot } from './dots.js';
import { generateLevel } from './map.js';
import { getPlatformShape } from './platforms/index.js';
import { createSceneUi, drawGame } from './render.js';
import { createOwnedUpgrades, purchaseUpgrade, upgrades } from './upgrades.js';

const WIDTH = 960;
const HEIGHT = 600;
const PLAYER_WIDTH = 25;
const PLAYER_HEIGHT = 34;
const VOID_DEATH_DEPTH = 650;
const RUN_SPEED = 225 / 60;
const DASH_SPEED = 530 / 60;
const JUMP_SPEED = -470 / 60;
const DOUBLE_JUMP_SPEED = -430 / 60;

export default class UpdraftScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Updraft' });
  }

  create() {
    this.matter.set60Hz();
    this.matter.world.setGravity(0, 1, 0.001);
    this.state = this.createState();
    this.gameGraphics = this.add.graphics().setDepth(1);
    createSceneUi(this, this.state);
    this.platformBodies = new Map();
    this.groundContacts = new Map();
    this.keys = this.input.keyboard.addKeys({
      left: 'LEFT', right: 'RIGHT', a: 'A', d: 'D',
      up: 'UP', w: 'W', space: 'SPACE', shift: 'SHIFT'
    });
    this.createPlayer();
    this.bindMatterEvents();
    this.bindInput();
    this.bindShopButtons();
    this.resetRound();
    this.cameras.main.startFollow(this.playerVisual, true, 0.12, 0.12);
  }

  createState() {
    const phaseNode = document.querySelector('#phase');
    const dotsNode = document.querySelector('#dots');
    const creditsNode = document.querySelector('#credits');
    const shieldNode = document.querySelector('#shield');
    const state = {
      width: WIDTH,
      height: HEIGHT,
      voidDeathDepth: VOID_DEATH_DEPTH,
      phaseNode,
      dotsNode,
      creditsNode,
      shieldNode,
      upgrades,
      owned: createOwnedUpgrades(),
      platforms: [],
      nodes: [],
      platformBodies: this.platformBodies,
      map: null,
      startPlatform: null,
      dots: [],
      mode: 'ready',
      credits: 0,
      round: 1,
      elapsed: 0,
      messageTimer: 0,
      normalCollected: 0,
      normalDotTotal: 0,
      currencyCollected: 0,
      currencyDotTotal: 0,
      player: { x: 0, y: 0, w: PLAYER_WIDTH, h: PLAYER_HEIGHT, vx: 0, vy: 0, grounded: false, jumps: 0, facing: 1, shieldUsed: false },
      playerBody: null,
      exit: null,
      exitBody: null,
      exitTouched: false,
      dotBodies: new Map(),
      collapse: null,
      enemy: null
    };
    state.syncHud = () => this.syncHud();
    return state;
  }

  createPlayer() {
    this.playerVisual = this.add.rectangle(0, 0, PLAYER_WIDTH, PLAYER_HEIGHT, 0xb7edc8).setDepth(10).setAlpha(0);
    this.matter.add.gameObject(this.playerVisual, {
      shape: { type: 'rectangle', width: PLAYER_WIDTH, height: PLAYER_HEIGHT },
      label: 'player',
      friction: 0,
      frictionAir: 0.008,
      restitution: 0,
      inertia: Infinity
    });
    this.state.playerBody = this.playerVisual.body;
    this.pendingDotCollections = new Set();
  }

  bindMatterEvents() {
    this.matter.world.on('collisionstart', event => {
      for (const pair of event.pairs) {
        const playerIsA = pair.bodyA === this.state.playerBody;
        const playerIsB = pair.bodyB === this.state.playerBody;
        if (!playerIsA && !playerIsB) continue;
        const other = playerIsA ? pair.bodyB : pair.bodyA;
        if (other.isExit) {
          this.state.exitTouched = true;
          continue;
        }
        if (other.dot) {
          this.pendingDotCollections.add(other.dot);
          continue;
        }
        if (!other.platformNode) continue;
        const surfaceNormal = playerIsA ? pair.collision.normal.y : -pair.collision.normal.y;
        if (surfaceNormal < 0.35) continue;
        this.groundContacts.set(pair.id, other.platformNode);
        this.state.player.groundY = this.playerVisual.y + PLAYER_HEIGHT / 2;
        this.state.player.grounded = true;
        this.state.player.jumps = 0;
      }
    });

    this.matter.world.on('collisionend', event => {
      for (const pair of event.pairs) this.groundContacts.delete(pair.id);
    });
  }

  bindInput() {
    this.input.keyboard.on('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) this.jump();
      if (event.code === 'Enter') this.handleEnter();
      if (event.code.startsWith('Digit')) purchaseUpgrade(this.state, Number(event.code.slice(5)) - 1);
      if (event.code === 'ShiftLeft') this.startDash();
    });
  }

  bindShopButtons() {
    this.shopZones = this.state.upgrades.map((upgrade, index) => {
      const x = 126 + index * 178;
      const zone = this.add.zone(x + 80, 360, 140, 32).setScrollFactor(0).setDepth(105).setInteractive();
      zone.on('pointerdown', () => purchaseUpgrade(this.state, index));
      return zone;
    });
  }

  handleEnter() {
    if (this.state.mode === 'shop') {
      this.state.round += 1;
      this.resetRound();
      this.beginRound();
    } else if (this.state.mode === 'ready' || this.state.mode === 'dead') {
      this.beginRound();
    }
  }

  jump() {
    const state = this.state;
    if (state.mode !== 'collect' && state.mode !== 'collapse') return;
    if (!state.player.grounded && !(state.owned.doubleJump && state.player.jumps < 2)) return;
    const jumpSpeed = state.player.grounded ? JUMP_SPEED : DOUBLE_JUMP_SPEED;
    this.matter.setVelocityY(this.playerVisual, jumpSpeed);
    state.player.grounded = false;
    state.player.jumps += 1;
    this.groundContacts.clear();
  }

  startDash() {
    const state = this.state;
    if (!state.owned.dash || this.time.now < (this.dashCooldownUntil || 0)) return;
    if (state.mode !== 'collect' && state.mode !== 'collapse') return;
    this.dashUntil = this.time.now + 180;
    this.dashCooldownUntil = this.time.now + 1100;
    this.matter.setVelocityX(this.playerVisual, state.player.facing * DASH_SPEED);
    this.matter.setVelocityY(this.playerVisual, 0);
  }

  addPlatformBodies(platform) {
    const shape = getPlatformShape(platform.shape);
    const bodies = shape.bodySections.map(section => {
      const body = this.matter.add.rectangle(
        platform.x + section.x + section.width / 2,
        platform.y + section.y + section.height / 2,
        section.width,
        section.height,
        { isStatic: true, angle: platform.angle || 0, friction: 0.9, label: `platform:${platform.id}` }
      );
      body.platformNode = platform;
      return body;
    });
    platform.bodies = bodies;
    this.platformBodies.set(platform.id, bodies);
  }

  addDotBodies() {
    for (const dot of this.state.dots) {
      if (dot.taken || this.state.dotBodies.has(dot.id)) continue;
      const body = this.matter.add.circle(dot.x, dot.y, 12, {
        isStatic: true,
        isSensor: true,
        label: `dot:${dot.type}`
      });
      body.dot = dot;
      this.state.dotBodies.set(dot.id, body);
    }
  }

  syncDotBodies() {
    const activeIds = new Set(this.state.dots.filter(dot => !dot.taken).map(dot => dot.id));
    for (const [id, body] of this.state.dotBodies) {
      if (activeIds.has(id)) continue;
      this.matter.world.remove(body);
      this.state.dotBodies.delete(id);
    }
    this.addDotBodies();
  }

  clearDotBodies() {
    for (const body of this.state.dotBodies.values()) this.matter.world.remove(body);
    this.state.dotBodies.clear();
    this.pendingDotCollections.clear();
  }

  processDotCollections() {
    for (const dot of this.pendingDotCollections) {
      rewardDot(this.state, dot);
      const body = this.state.dotBodies.get(dot.id);
      if (body) this.matter.world.remove(body);
      this.state.dotBodies.delete(dot.id);
    }
    this.pendingDotCollections.clear();
    if (this.state.mode === 'collect' && this.state.normalCollected >= this.state.normalDotTotal) this.startCollapse();
  }

  removePlatformBodies(platformId) {
    const bodies = this.platformBodies.get(platformId);
    if (!bodies) return;
    for (const body of bodies) this.matter.world.remove(body);
    this.platformBodies.delete(platformId);
  }

  syncPlatformBodies() {
    const active = new Set(this.state.platforms.map(platform => platform.id));
    for (const id of this.platformBodies.keys()) {
      if (!active.has(id)) this.removePlatformBodies(id);
    }
  }

  createExitBody() {
    if (this.state.exitBody) this.matter.world.remove(this.state.exitBody);
    const exit = this.state.exit;
    this.state.exitBody = this.matter.add.rectangle(exit.x + exit.w / 2, exit.y + exit.h / 2, exit.w, exit.h, {
      isStatic: true,
      isSensor: true,
      label: 'exit'
    });
    this.state.exitBody.isExit = true;
  }

  resetRound() {
    for (const id of [...this.platformBodies.keys()]) this.removePlatformBodies(id);
    this.clearDotBodies();
    if (this.state.exitBody) this.matter.world.remove(this.state.exitBody);
    this.groundContacts.clear();
    this.state.map = generateLevel(this.state.round);
    this.state.nodes = this.state.map.nodes;
    this.state.platforms = this.state.map.platforms;
    this.state.dots = this.state.map.dots;
    this.state.normalCollected = 0;
    this.state.normalDotTotal = this.state.dots.length;
    this.state.currencyCollected = 0;
    this.state.currencyDotTotal = 0;
    this.state.startPlatform = this.state.map.root;
    this.state.exit = null;
    this.state.exitBody = null;
    this.state.exitTouched = false;
    this.state.collapse = null;
    this.state.elapsed = 0;
    this.state.mode = 'ready';
    for (const platform of this.state.platforms) this.addPlatformBodies(platform);
    this.addDotBodies();

    const start = this.state.startPlatform;
    const playerX = start.x + start.w / 2;
    const playerY = start.y - PLAYER_HEIGHT / 2 - 1;
    this.playerVisual.setPosition(playerX, playerY);
    this.matter.setVelocity(this.playerVisual, 0, 0);
    this.playerVisual.setAngle(0);
    Object.assign(this.state.player, { x: playerX - PLAYER_WIDTH / 2, y: playerY - PLAYER_HEIGHT / 2, vx: 0, vy: 0, grounded: false, jumps: 0, facing: 1, shieldUsed: false, groundY: start.y });
    this.syncHud();
  }

  beginRound() {
    if (this.state.mode === 'dead') this.resetRound();
    this.state.mode = 'collect';
    this.syncHud();
  }

  startCollapse() {
    const state = this.state;
    state.mode = 'collapse';
    state.exitPlatform = state.startPlatform;
    const start = state.exitPlatform;
    state.exit = { x: start.x + start.w - 42, y: start.y - 50, w: 42, h: 50 };
    state.dots = createPlatformDots(state.platforms, 'currency');
    state.currencyCollected = 0;
    state.currencyDotTotal = state.dots.length;
    this.clearDotBodies();
    this.addDotBodies();
    this.createExitBody();
    startCollapseWaves(state);
    state.messageTimer = 2;
    this.syncHud();
  }

  syncPlayerState() {
    const player = this.state.player;
    player.x = this.playerVisual.x - PLAYER_WIDTH / 2;
    player.y = this.playerVisual.y - PLAYER_HEIGHT / 2;
    player.vx = this.playerVisual.body.velocity.x * 60;
    player.vy = this.playerVisual.body.velocity.y * 60;
    player.grounded = this.groundContacts.size > 0;
  }

  update(time, delta) {
    const state = this.state;
    const dt = Math.min(delta / 1000, 0.05);
    this.syncPlayerState();
    if (state.mode === 'collect' || state.mode === 'collapse') {
      state.elapsed += dt;
      this.processDotCollections();
      if (state.mode === 'collapse') {
        updateCollapse(state, dt);
        this.syncPlatformBodies();
        this.syncDotBodies();
      }

      const left = this.keys.left.isDown || this.keys.a.isDown;
      const right = this.keys.right.isDown || this.keys.d.isDown;
      const direction = Number(right) - Number(left);
      if (direction) state.player.facing = direction;
      if (time < (this.dashUntil || 0)) this.matter.setVelocityX(this.playerVisual, state.player.facing * DASH_SPEED);
      else this.matter.setVelocityX(this.playerVisual, direction * RUN_SPEED);

      if (state.player.y + PLAYER_HEIGHT - state.player.groundY > VOID_DEATH_DEPTH) {
        state.mode = 'dead';
        this.matter.setVelocity(this.playerVisual, 0, 0);
      }

      if (state.mode === 'collapse' && state.exitTouched) {
        state.mode = 'shop';
        state.exitTouched = false;
      }
      state.messageTimer = Math.max(0, state.messageTimer - dt);
      this.syncHud();
    }
    drawGame(this, state);
  }

  syncHud() {
    const state = this.state;
    const labels = { ready: 'Ready', collect: 'Collect', collapse: 'Collapse!', shop: 'Upgrade', dead: 'Run over', escaped: 'Cleared' };
    state.phaseNode.textContent = labels[state.mode] || 'Ready';
    const collectingCurrency = state.mode === 'collapse';
    const count = collectingCurrency ? state.currencyCollected : state.normalCollected;
    const total = collectingCurrency ? state.currencyDotTotal : state.normalDotTotal;
    state.dotsNode.innerHTML = `${count} <small>/ ${total}</small>`;
    state.creditsNode.textContent = state.credits;
    state.shieldNode.textContent = state.player.shieldUsed ? 'Spent' : 'Ready';
  }
}