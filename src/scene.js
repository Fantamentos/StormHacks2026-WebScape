import Phaser from 'phaser';
import { startCollapseWaves, updateCollapse } from './phases/collapse/collapse.js';
import { createPlatformDots, rewardDot } from './dots.js';
import { advanceDasher, chooseDasherSpawn, createDasher } from './enemies/dasher.js';
import { advanceDoppelgangerRun, createDoppelgangerRun } from './enemies/doppelganger.js';
import { advanceSentinel, advanceSentinelBullet, createSentinel } from './enemies/sentinel.js';
import { advanceStopwatch, createStopwatch, getStopwatchDisplay } from './enemies/stopwatch.js';
import { generateLevel } from './map.js';
import { DASHER_FOLLOWUP, getDasherModifierOptions } from './modifiers/dasher.js';
import { getDoppelgangerModifierOptions } from './modifiers/doppelganger.js';
import { getSentinelModifierOptions } from './modifiers/sentinel.js';
import { getStopwatchModifierOptions } from './modifiers/stopwatch.js';
import { getPlatformShape } from './platforms/index.js';
import { isGroundContact } from './matterSupport.js';
import { dasherCollisionMask, DOT_CATEGORY, DOT_MASK, ENEMY_CATEGORY, EXIT_CATEGORY, EXIT_MASK, PLAYER_CATEGORY, PLAYER_MASK, PLATFORM_CATEGORY, PLATFORM_MASK } from './matterFilters.js';
import { freezeMatterRun } from './phases/lifecycle/death.js';
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
    this.stopwatchTimer = this.add.text(0, 0, '', {
      fontFamily: 'DM Mono, monospace',
      fontSize: '16px',
      color: '#eef2e7',
      stroke: '#162326',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(12).setVisible(false);
    createSceneUi(this, this.state);
    this.platformBodies = new Map();
    this.groundContacts = new Map();
    this.doppelgangerVisuals = [];
    this.sentinelBullets = [];
    this.stopwatchInputThisFrame = false;
    this.keys = this.input.keyboard.addKeys({
      left: 'LEFT', right: 'RIGHT', a: 'A', d: 'D',
      up: 'UP', w: 'W', space: 'SPACE', shift: 'SHIFT'
    });
    this.createPlayer();
    this.bindMatterEvents();
    this.bindInput();
    this.bindShopButtons();
    this.resetRound();
    this.beginRound();
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
      enemy: null,
      doppelgangerRun: null,
      stopwatchRun: null,
      stopwatchPosition: null,
      sentinel: null,
      enemyModifiers: [DASHER_FOLLOWUP.id],
      playerInvulnerableUntil: 0
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
      inertia: Infinity,
      collisionFilter: { category: PLAYER_CATEGORY, mask: PLAYER_MASK }
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
        if (other.isSentinelBullet) {
          this.removeSentinelBullet(other);
          this.handleEnemyHit(other);
          continue;
        }
        if (other.isDasher) {
          this.handleEnemyHit(other);
          continue;
        }
        if (other.isDoppelganger) {
          this.handleEnemyHit(other);
          continue;
        }
        if (!other.platformNode) continue;
        if (!isGroundContact(pair, this.state.playerBody)) continue;
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
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW', 'ShiftLeft'].includes(event.code)) {
        this.stopwatchInputThisFrame = true;
      }
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

  removeDasher() {
    if (this.dasherVisual) {
      this.matter.world.remove(this.dasherVisual.body);
      this.dasherVisual.destroy();
      this.dasherVisual = null;
    }
    this.state.enemy = null;
  }

  spawnDasher() {
    this.removeDasher();
    const state = this.state;
    const playerPosition = { x: this.playerVisual.x, y: this.playerVisual.y };
    const spawn = chooseDasherSpawn(state.nodes, playerPosition);
    if (!spawn) return;

    state.enemy = createDasher(spawn.platform, spawn.x, spawn.y, this.time.now, getDasherModifierOptions(state.enemyModifiers));
    const x = spawn.x;
    const y = spawn.y;
    this.dasherVisual = this.add.rectangle(x, y, 24, 24, 0xe87965).setDepth(9);
    this.matter.add.gameObject(this.dasherVisual, {
      shape: { type: 'rectangle', width: 24, height: 24 },
      isSensor: true,
      ignoreGravity: true,
      collisionFilter: { category: ENEMY_CATEGORY, mask: dasherCollisionMask('grace') },
      friction: 0,
      frictionAir: 0,
      restitution: 0,
      inertia: Infinity,
      label: 'dasher'
    });
    this.dasherVisual.setFixedRotation();
    this.dasherVisual.body.isDasher = true;
  }

  updateDasher(time) {
    const dasher = this.state.enemy;
    if (!dasher || !this.dasherVisual) return;
    dasher.x = this.dasherVisual.x;
    dasher.y = this.dasherVisual.y;
    const previousPhase = dasher.phase;
    const transition = advanceDasher(dasher, time, this.state.player, Math.random);
    if (!transition) return;

    if (transition.type === 'telegraph') {
      if (previousPhase === 'dash' || previousPhase === 'followupDash') {
        this.dasherVisual.setPosition(dasher.x, dasher.y);
        this.matter.setVelocity(this.dasherVisual, 0, 0);
      }
      this.dasherVisual.body.collisionFilter.mask = dasherCollisionMask('telegraph');
    } else if (transition.type === 'dash-start') {
      this.dasherVisual.body.collisionFilter.mask = dasherCollisionMask(transition.phase);
    } else if (transition.type === 'move') {
      this.dasherVisual.setPosition(transition.position.x, transition.position.y);
    }
  }

  clearDoppelgangers() {
    for (const visual of this.doppelgangerVisuals) {
      this.matter.world.remove(visual.body);
      visual.destroy();
    }
    this.doppelgangerVisuals = [];
    this.state.doppelgangerRun = null;
  }

  startDoppelgangers(time = this.time.now) {
    this.clearDoppelgangers();
    const options = getDoppelgangerModifierOptions(this.state.enemyModifiers);
    this.state.doppelgangerRun = createDoppelgangerRun(time, {
      x: this.playerVisual.x,
      y: this.playerVisual.y
    }, options);
  }

  updateDoppelgangers(time) {
    const run = this.state.doppelgangerRun;
    if (!run) return;
    const copies = advanceDoppelgangerRun(run, time, {
      x: this.playerVisual.x,
      y: this.playerVisual.y
    });

    while (this.doppelgangerVisuals.length < copies.length) {
      const copy = copies[this.doppelgangerVisuals.length];
      const visual = this.add.rectangle(copy.x, copy.y, PLAYER_WIDTH, PLAYER_HEIGHT, 0x49265d).setDepth(9).setAlpha(0);
      this.matter.add.gameObject(visual, {
        shape: { type: 'rectangle', width: PLAYER_WIDTH, height: PLAYER_HEIGHT },
        isStatic: true,
        isSensor: true,
        collisionFilter: { category: ENEMY_CATEGORY, mask: PLAYER_CATEGORY },
        label: `doppelganger:${copy.id}`
      });
      visual.body.isDoppelganger = true;
      this.doppelgangerVisuals.push(visual);
    }

    copies.forEach((copy, index) => this.doppelgangerVisuals[index].setPosition(copy.x, copy.y));
    this.state.phaseNode.dataset.doppelgangerCount = String(copies.length);
    this.state.phaseNode.dataset.doppelgangerBody = this.doppelgangerVisuals.map(visual => `${visual.x},${visual.y},${visual.body.isStatic},${visual.body.isSensor},${visual.body.collisionFilter.category},${visual.body.collisionFilter.mask}`).join(';');
  }

  clearStopwatch() {
    this.state.stopwatchRun = null;
    this.state.stopwatchPosition = null;
    this.stopwatchTimer.setVisible(false).setText('');
  }

  startStopwatch(time = this.time.now) {
    this.clearStopwatch();
    this.state.stopwatchRun = createStopwatch(time, getStopwatchModifierOptions(this.state.enemyModifiers));
  }

  updateStopwatch(time, hasInput) {
    const run = this.state.stopwatchRun;
    if (!run) return;
    const transition = advanceStopwatch(run, time, hasInput);
    if (transition?.type === 'spawn') {
      const playerPosition = { x: this.playerVisual.x, y: this.playerVisual.y };
      const spawn = chooseDasherSpawn(this.state.nodes, playerPosition);
      this.state.stopwatchPosition = spawn
        ? { x: spawn.x, y: spawn.y }
        : { x: playerPosition.x + 100, y: playerPosition.y - 80 };
    } else if (transition?.type === 'evaded') {
      this.state.stopwatchPosition = null;
    } else if (transition?.type === 'damage') {
      const position = this.state.stopwatchPosition || { x: this.playerVisual.x, y: this.playerVisual.y };
      this.state.stopwatchPosition = null;
      this.handleEnemyHit({ position });
    }

    const position = this.state.stopwatchPosition;
    const display = getStopwatchDisplay(run, time);
    if (!position || !display) {
      this.stopwatchTimer.setVisible(false);
      return;
    }
    this.stopwatchTimer
      .setText(String(display.seconds))
      .setColor(display.finalSecond ? '#ffd16d' : '#eef2e7')
      .setPosition(position.x, position.y - 32)
      .setVisible(true);
  }

  clearSentinelBullets() {
    for (const entry of this.sentinelBullets) {
      this.matter.world.remove(entry.visual.body);
      entry.visual.destroy();
    }
    this.sentinelBullets = [];
  }

  removeSentinelBullet(body) {
    const index = this.sentinelBullets.findIndex(entry => entry.visual.body === body);
    if (index < 0) return;
    const [entry] = this.sentinelBullets.splice(index, 1);
    this.matter.world.remove(body);
    entry.visual.destroy();
  }

  removeSentinel() {
    this.clearSentinelBullets();
    if (this.sentinelVisual) {
      this.matter.world.remove(this.sentinelVisual.body);
      this.sentinelVisual.destroy();
      this.sentinelVisual = null;
    }
    this.state.sentinel = null;
  }

  spawnSentinel() {
    this.removeSentinel();
    const spawn = chooseDasherSpawn(this.state.nodes, {
      x: this.playerVisual.x,
      y: this.playerVisual.y
    });
    if (!spawn) return;

    this.state.sentinel = createSentinel(
      spawn.platform,
      spawn.x,
      spawn.y,
      this.time.now,
      getSentinelModifierOptions(this.state.enemyModifiers)
    );
    this.sentinelVisual = this.add.rectangle(spawn.x, spawn.y, 26, 22, 0xd5a64e).setDepth(9);
    this.matter.add.gameObject(this.sentinelVisual, {
      shape: { type: 'rectangle', width: 26, height: 22 },
      isStatic: true,
      isSensor: true,
      collisionFilter: { category: ENEMY_CATEGORY, mask: 0 },
      label: 'sentinel'
    });
    this.sentinelVisual.body.isSentinel = true;
  }

  updateSentinel(time, delta) {
    const sentinel = this.state.sentinel;
    if (!sentinel || !this.sentinelVisual) return;
    const update = advanceSentinel(sentinel, time, {
      x: this.playerVisual.x,
      y: this.playerVisual.y
    });
    this.sentinelVisual.setPosition(update.position.x, update.position.y);

    for (const bullet of update.bullets) {
      const visual = this.add.circle(bullet.x, bullet.y, bullet.radius, 0xf16e5d).setDepth(9);
      this.matter.add.gameObject(visual, {
        shape: { type: 'circle', radius: bullet.radius },
        isStatic: true,
        isSensor: true,
        collisionFilter: { category: ENEMY_CATEGORY, mask: PLAYER_CATEGORY },
        label: 'sentinel-bullet'
      });
      const entry = { model: bullet, visual };
      visual.body.isSentinelBullet = true;
      visual.body.sentinelBullet = entry;
      this.sentinelBullets.push(entry);
    }

    for (let index = this.sentinelBullets.length - 1; index >= 0; index -= 1) {
      const entry = this.sentinelBullets[index];
      if (!advanceSentinelBullet(entry.model, delta)) {
        this.removeSentinelBullet(entry.visual.body);
        continue;
      }
      entry.visual.setPosition(entry.model.x, entry.model.y);
    }
  }

  handleEnemyHit(enemyBody) {
    const state = this.state;
    if (enemyBody.isDasher && (!state.enemy || !['dash', 'followupDash'].includes(state.enemy.phase))) return;
    if (this.time.now < state.playerInvulnerableUntil) return;
    if (!state.player.shieldUsed) {
      state.player.shieldUsed = true;
      state.playerInvulnerableUntil = this.time.now + 800;
      const direction = Math.sign(this.playerVisual.x - enemyBody.position.x) || 1;
      this.matter.setVelocity(this.playerVisual, direction * 4, -3);
      this.syncHud();
      return;
    }

    this.freezeRun();
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
        {
          isStatic: true,
          angle: platform.angle || 0,
          friction: 0.9,
          collisionFilter: { category: PLATFORM_CATEGORY, mask: PLATFORM_MASK },
          label: `platform:${platform.id}`
        }
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
        collisionFilter: { category: DOT_CATEGORY, mask: DOT_MASK },
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
      collisionFilter: { category: EXIT_CATEGORY, mask: EXIT_MASK },
      label: 'exit'
    });
    this.state.exitBody.isExit = true;
  }

  resetRound() {
    this.matter.world.resume();
    this.playerVisual.setStatic(false);
    this.playerVisual.setIgnoreGravity(false);
    this.removeDasher();
    this.clearDoppelgangers();
    this.clearStopwatch();
    this.removeSentinel();
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
    this.spawnDasher();
    this.startDoppelgangers();
    this.startStopwatch();
    this.spawnSentinel();
    this.syncHud();
  }

  freezeRun() {
    if (freezeMatterRun(this.state, this.matter, this.playerVisual, this.dasherVisual, this.matter.world)) this.syncHud();
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
    const left = this.keys.left.isDown || this.keys.a.isDown;
    const right = this.keys.right.isDown || this.keys.d.isDown;
    const hasControlInput = this.stopwatchInputThisFrame
      || left
      || right
      || this.keys.up.isDown
      || this.keys.w.isDown
      || this.keys.space.isDown
      || this.keys.shift.isDown;
    this.stopwatchInputThisFrame = false;
    this.syncPlayerState();
    if (state.mode === 'collect' || state.mode === 'collapse') {
      state.elapsed += dt;
      this.updateDasher(time);
      this.updateDoppelgangers(time);
      this.updateStopwatch(time, hasControlInput);
      if (state.mode === 'dead') {
        drawGame(this, state);
        return;
      }
      this.updateSentinel(time, delta);
      this.processDotCollections();
      if (state.mode === 'collapse') {
        updateCollapse(state, dt);
        this.syncPlatformBodies();
        this.syncDotBodies();
      }

      const direction = Number(right) - Number(left);
      if (direction) state.player.facing = direction;
      if (time < (this.dashUntil || 0)) this.matter.setVelocityX(this.playerVisual, state.player.facing * DASH_SPEED);
      else this.matter.setVelocityX(this.playerVisual, direction * RUN_SPEED);

      if (state.player.y + PLAYER_HEIGHT - state.player.groundY > VOID_DEATH_DEPTH) {
        this.freezeRun();
        drawGame(this, state);
        return;
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