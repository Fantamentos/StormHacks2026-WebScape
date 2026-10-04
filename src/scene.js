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
import {
  chooseIntermissionModifier,
  completeLevel,
  createIntermission,
  createRunProgress,
  getAvailableEnemyChoices,
  getRosterCounts,
  selectIntermissionEnemy,
  skipIntermissionModifier
} from './phases/intermission/intermission.js';
import { getPlatformShape } from './platforms/index.js';
import { canPlayerJump, hasPlayerClearedPlatformBelow, isPlayerAboveOneWaySection, landPlayer, leavePlatform } from './playerMovement.js';
import { isGroundContact } from './matterSupport.js';
import { dasherCollisionMask, DOT_CATEGORY, DOT_MASK, ENEMY_CATEGORY, EXIT_CATEGORY, EXIT_MASK, PLAYER_CATEGORY, PLAYER_MASK, PLATFORM_CATEGORY, PLATFORM_MASK } from './matterFilters.js';
import { freezeMatterRun } from './phases/lifecycle/death.js';
import { consumeVoidShield, getVoidRescuePosition } from './phases/lifecycle/voidShield.js';
import { createSceneUi, drawGame } from './render.js';
import { createOwnedUpgrades, getRunSpeedMultiplier, purchaseUpgrade, upgrades } from './upgrades.js';

const WIDTH = 960;
const HEIGHT = 600;
const PLAYER_WIDTH = 25;
const PLAYER_HEIGHT = 28;
const VOID_DEATH_DEPTH = 650;
const RUN_SPEED = 225 / 60;
const DASH_SPEED = 530 / 60;
const JUMP_SPEED = -470 / 60;
const DOUBLE_JUMP_SPEED = -430 / 60;

export default class WebScapeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WebScape' });
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
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101).setVisible(false);
    createSceneUi(this, this.state);
    this.platformBodies = new Map();
    this.dropThroughPlatforms = new Set();
    this.groundContacts = new Map();
    this.dashers = [];
    this.doppelgangerRuns = [];
    this.sentinels = [];
    this.sentinelBullets = [];
    this.stopwatchInputThisFrame = false;
    this.keys = this.input.keyboard.addKeys({
      left: 'LEFT', right: 'RIGHT', down: 'DOWN', a: 'A', d: 'D', s: 'S',
      up: 'UP', w: 'W', space: 'SPACE', shift: 'SHIFT'
    });
    this.createPlayer();
    this.bindMatterEvents();
    this.bindInput();
    this.bindShopButtons();
    this.resetRound();
    this.startIntermission(1);
    this.cameras.main.startFollow(this.playerVisual, true, 0.12, 0.12);
  }

  createState() {
    const phaseNode = document.querySelector('#phase');
    const dotsNode = document.querySelector('#dots');
    const creditsNode = document.querySelector('#credits');
    const shieldNode = document.querySelector('#shield');
    const voidShieldNode = document.querySelector('#void-shield');
    const runProgress = createRunProgress();
    const state = {
      width: WIDTH,
      height: HEIGHT,
      voidDeathDepth: VOID_DEATH_DEPTH,
      phaseNode,
      dotsNode,
      creditsNode,
      shieldNode,
      voidShieldNode,
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
      voidShieldUsed: false,
      playerBody: null,
      exit: null,
      exitBody: null,
      exitTouched: false,
      dotBodies: new Map(),
      collapse: null,
      stopwatchRun: null,
      stopwatchPosition: null,
      enemyRoster: [],
      enemyModifiers: runProgress.enemyModifiers,
      runProgress,
      intermission: null,
      intermissionChoices: [],
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
        landPlayer(this.state.player);
      }
    });

    this.matter.world.on('collisionend', event => {
      for (const pair of event.pairs) this.groundContacts.delete(pair.id);
    });
  }

  bindInput() {
    this.input.keyboard.on('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyS', 'KeyW', 'ShiftLeft'].includes(event.code)) {
        this.stopwatchInputThisFrame = true;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) this.jump();
      if (['ArrowDown', 'KeyS'].includes(event.code)) this.dropThrough();
      if (event.code === 'Enter') this.handleEnter();
      if (event.code.startsWith('Digit')) {
        const index = Number(event.code.slice(5)) - 1;
        if (this.state.mode === 'intermission') this.chooseIntermissionOption(index);
        else if (this.state.mode === 'shop') purchaseUpgrade(this.state, index);
      }
      if (event.code === 'ShiftLeft') this.startDash();
    });
  }

  bindShopButtons() {
    this.shopZones = this.state.upgrades.map((upgrade, index) => {
      const zone = this.add.zone(0, 0, 140, 32).setScrollFactor(0).setDepth(105).setInteractive().setVisible(false);
      zone.on('pointerdown', () => purchaseUpgrade(this.state, index));
      return zone;
    });
    this.shopZones.forEach((zone, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      zone.setPosition(134 + column * 236 + 110, 192 + row * 158 + 126);
    });
  }

  removeDasher() {
    for (const dasher of this.dashers) {
      this.matter.world.remove(dasher.visual.body);
      dasher.visual.destroy();
    }
    this.dashers = [];
  }

  spawnDasher(count) {
    this.removeDasher();
    const state = this.state;
    const playerPosition = { x: this.playerVisual.x, y: this.playerVisual.y };
    for (let index = 0; index < count; index += 1) {
      let spawn = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = chooseDasherSpawn(state.nodes, playerPosition);
        if (!candidate || this.dashers.some(dasher => Math.hypot(dasher.visual.x - candidate.x, dasher.visual.y - candidate.y) < 80)) continue;
        spawn = candidate;
        break;
      }
      if (!spawn) continue;

      const model = createDasher(spawn.platform, spawn.x, spawn.y, this.time.now, getDasherModifierOptions(state.enemyModifiers));
      const visual = this.add.rectangle(spawn.x, spawn.y, 24, 24, 0xe87965).setDepth(9);
      this.matter.add.gameObject(visual, {
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
      visual.setFixedRotation();
      visual.body.isDasher = true;
      visual.body.dasher = model;
      this.dashers.push({ model, visual });
    }
  }

  updateDasher(time) {
    for (const { model, visual } of this.dashers) {
      model.x = visual.x;
      model.y = visual.y;
      const previousPhase = model.phase;
      const transition = advanceDasher(model, time, this.state.player, Math.random);
      if (!transition) continue;

      if (transition.type === 'telegraph') {
        if (previousPhase === 'dash' || previousPhase === 'followupDash') {
          visual.setPosition(model.x, model.y);
          this.matter.setVelocity(visual, 0, 0);
        }
        visual.body.collisionFilter.mask = dasherCollisionMask('telegraph');
      } else if (transition.type === 'dash-start') {
        visual.body.collisionFilter.mask = dasherCollisionMask(transition.phase);
      } else if (transition.type === 'move') {
        visual.setPosition(transition.position.x, transition.position.y);
      }
    }
  }

  clearDoppelgangers() {
    for (const entry of this.doppelgangerRuns) {
      for (const visual of entry.visuals) {
        this.matter.world.remove(visual.body);
        visual.destroy();
      }
    }
    this.doppelgangerRuns = [];
  }

  startDoppelgangers(count, time = this.time.now) {
    this.clearDoppelgangers();
    const options = getDoppelgangerModifierOptions(this.state.enemyModifiers);
    for (let index = 0; index < count; index += 1) {
      this.doppelgangerRuns.push({
        run: createDoppelgangerRun(time, { x: this.playerVisual.x, y: this.playerVisual.y }, options),
        visuals: []
      });
    }
  }

  updateDoppelgangers(time) {
    let totalCopies = 0;
    const bodyStates = [];
    for (const entry of this.doppelgangerRuns) {
      const copies = advanceDoppelgangerRun(entry.run, time, {
        x: this.playerVisual.x,
        y: this.playerVisual.y
      });

      while (entry.visuals.length < copies.length) {
        const copy = copies[entry.visuals.length];
        const visual = this.add.rectangle(copy.x, copy.y, PLAYER_WIDTH, PLAYER_HEIGHT, 0x49265d).setDepth(9).setAlpha(0);
        this.matter.add.gameObject(visual, {
          shape: { type: 'rectangle', width: PLAYER_WIDTH, height: PLAYER_HEIGHT },
          isStatic: true,
          isSensor: true,
          collisionFilter: { category: ENEMY_CATEGORY, mask: PLAYER_CATEGORY },
          label: `doppelganger:${copy.id}`
        });
        visual.body.isDoppelganger = true;
        entry.visuals.push(visual);
      }

      copies.forEach((copy, index) => entry.visuals[index].setPosition(copy.x, copy.y));
      totalCopies += copies.length;
      bodyStates.push(...entry.visuals.map(visual => `${visual.x},${visual.y},${visual.body.isStatic},${visual.body.isSensor},${visual.body.collisionFilter.category},${visual.body.collisionFilter.mask}`));
    }
    this.state.phaseNode.dataset.doppelgangerCount = String(totalCopies);
    this.state.phaseNode.dataset.doppelgangerBody = bodyStates.join(';');
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
      .setPosition(WIDTH / 2, 22)
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
    for (const sentinel of this.sentinels) {
      this.matter.world.remove(sentinel.visual.body);
      sentinel.visual.destroy();
    }
    this.sentinels = [];
  }

  spawnSentinel(count) {
    this.removeSentinel();
    const playerPosition = { x: this.playerVisual.x, y: this.playerVisual.y };
    for (let index = 0; index < count; index += 1) {
      let spawn = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = chooseDasherSpawn(this.state.nodes, playerPosition);
        if (!candidate || this.sentinels.some(sentinel => Math.hypot(sentinel.visual.x - candidate.x, sentinel.visual.y - candidate.y) < 80)) continue;
        spawn = candidate;
        break;
      }
      if (!spawn) continue;

      const model = createSentinel(
        spawn.platform,
        spawn.x,
        spawn.y,
        this.time.now,
        getSentinelModifierOptions(this.state.enemyModifiers)
      );
      const visual = this.add.rectangle(spawn.x, spawn.y, 26, 22, 0xd5a64e).setDepth(9);
      this.matter.add.gameObject(visual, {
        shape: { type: 'rectangle', width: 26, height: 22 },
        isStatic: true,
        isSensor: true,
        collisionFilter: { category: ENEMY_CATEGORY, mask: 0 },
        label: 'sentinel'
      });
      visual.body.isSentinel = true;
      this.sentinels.push({ model, visual });
    }
  }

  updateSentinel(time, delta) {
    for (const { model, visual: sentinelVisual } of this.sentinels) {
      const update = advanceSentinel(model, time, {
        x: this.playerVisual.x,
        y: this.playerVisual.y
      });
      sentinelVisual.setPosition(update.position.x, update.position.y);

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
    if (enemyBody.isDasher && !['dash', 'followupDash'].includes(enemyBody.dasher.phase)) return;
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
      this.beginRound();
    } else if (this.state.mode === 'intermission' && this.state.intermission?.stage === 'modifier') {
      this.skipIntermissionModifier();
    } else if (this.state.mode === 'dead') {
      this.beginRound();
    }
  }

  startIntermission(level) {
    this.state.intermission = createIntermission(this.state.runProgress, level);
    this.state.enemyRoster = [];
    this.refreshIntermissionStage();
    this.matter.world.pause();
  }

  refreshIntermissionStage() {
    const state = this.state;
    const intermission = state.intermission;
    if (!intermission) return;
    if (intermission.stage === 'enemies') {
      state.intermissionChoices = getAvailableEnemyChoices(state.runProgress);
      state.mode = 'intermission';
    } else if (intermission.stage === 'modifier') {
      state.intermissionChoices = intermission.modifierOptions;
      state.mode = 'intermission';
    } else {
      state.intermissionChoices = [];
      state.enemyRoster = [...intermission.roster];
      state.mode = 'shop';
    }
    this.syncHud();
    drawGame(this, state);
  }

  chooseIntermissionOption(index) {
    const state = this.state;
    const intermission = state.intermission;
    const choice = state.intermissionChoices[index];
    if (state.mode !== 'intermission' || !intermission || !choice) return;

    if (intermission.stage === 'enemies') {
      selectIntermissionEnemy(state.runProgress, intermission, choice.id);
    } else if (intermission.stage === 'modifier') {
      state.credits += chooseIntermissionModifier(state.runProgress, intermission, choice.id);
    }
    this.refreshIntermissionStage();
  }

  skipIntermissionModifier() {
    if (skipIntermissionModifier(this.state.intermission)) this.refreshIntermissionStage();
  }

  advanceAfterLevelComplete() {
    const state = this.state;
    const result = completeLevel(state.runProgress, state.round);
    if (result.type === 'victory') {
      state.mode = 'victory';
      this.matter.setVelocity(this.playerVisual, 0, 0);
      this.playerVisual.setStatic(true);
      this.matter.world.pause();
      this.syncHud();
      return;
    }

    state.round = result.level;
    this.resetRound();
    this.startIntermission(result.level);
  }

  jump() {
    const state = this.state;
    if (state.mode !== 'collect' && state.mode !== 'collapse') return;
    if (!canPlayerJump(state.player, state.owned.doubleJump ? 2 : 1)) return;
    const jumpSpeed = state.player.grounded ? JUMP_SPEED : DOUBLE_JUMP_SPEED;
    this.matter.setVelocityY(this.playerVisual, jumpSpeed);
    state.player.grounded = false;
    state.player.jumps += 1;
    this.groundContacts.clear();
    this.updatePlatformCollisionFilters();
  }

  dropThrough() {
    const state = this.state;
    if ((state.mode !== 'collect' && state.mode !== 'collapse') || !state.player.grounded) return;
    const platformIds = new Set([...this.groundContacts.values()].map(platform => platform.id));
    if (!platformIds.size) return;

    for (const platformId of platformIds) this.dropThroughPlatforms.add(platformId);
    this.groundContacts.clear();
    state.player.grounded = false;
    state.player.jumps = 1;
    this.matter.setVelocityY(this.playerVisual, Math.max(this.playerVisual.body.velocity.y, 2));
    this.updatePlatformCollisionFilters();
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
      body.platformSection = section;
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
    this.dropThroughPlatforms.delete(platformId);
  }

  updatePlatformCollisionFilters() {
    const player = this.state.player;
    const velocityY = this.playerVisual.body.velocity.y;
    for (const [platformId, bodies] of this.platformBodies) {
      const platform = bodies[0]?.platformNode;
      if (!platform) continue;
      if (this.dropThroughPlatforms.has(platformId) && hasPlayerClearedPlatformBelow(player, platform)) {
        this.dropThroughPlatforms.delete(platformId);
      }
      const droppingThrough = this.dropThroughPlatforms.has(platformId);
      for (const body of bodies) {
        const canLand = !droppingThrough && isPlayerAboveOneWaySection(
          player,
          platform,
          body.platformSection,
          velocityY
        );
        body.collisionFilter.mask = canLand ? PLATFORM_MASK : 0;
      }
    }
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
    this.dropThroughPlatforms.clear();
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
    this.matter.world.resume();
    this.state.mode = 'collect';
    const rosterCounts = getRosterCounts(this.state.enemyRoster);
    this.spawnDasher(rosterCounts.dasher);
    this.startDoppelgangers(rosterCounts.doppelganger);
    if (rosterCounts.stopwatch) this.startStopwatch();
    else this.clearStopwatch();
    this.spawnSentinel(rosterCounts.sentinel);
    this.syncHud();
  }

  freezeRun() {
    const primaryDasher = this.dashers[0]?.visual.body || null;
    if (!freezeMatterRun(this.state, this.matter, this.playerVisual, primaryDasher, this.matter.world)) return;
    for (const { visual } of this.dashers.slice(1)) {
      this.matter.setVelocity(visual, 0, 0);
      visual.setIgnoreGravity(true);
      visual.setStatic(true);
    }
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

  rescueFromVoid() {
    const state = this.state;
    const rescue = getVoidRescuePosition(state.platforms, PLAYER_HEIGHT);
    if (!rescue || !consumeVoidShield(state)) return false;

    this.matter.world.resume();
    this.playerVisual.setStatic(false);
    this.playerVisual.setIgnoreGravity(false);
    this.playerVisual.setPosition(rescue.x, rescue.y);
    this.playerVisual.setAngle(0);
    this.matter.setVelocity(this.playerVisual, 0, 2);
    this.groundContacts.clear();
    this.dropThroughPlatforms.clear();
    this.dashUntil = 0;
    Object.assign(state.player, {
      x: rescue.x - PLAYER_WIDTH / 2,
      y: rescue.y - PLAYER_HEIGHT / 2,
      vx: 0,
      vy: 120,
      grounded: false,
      jumps: 0,
      groundY: rescue.groundY
    });
    this.syncHud();
    return true;
  }

  syncPlayerState() {
    const player = this.state.player;
    const grounded = this.groundContacts.size > 0;
    if (!grounded && player.grounded) leavePlatform(player);
    player.x = this.playerVisual.x - PLAYER_WIDTH / 2;
    player.y = this.playerVisual.y - PLAYER_HEIGHT / 2;
    player.vx = this.playerVisual.body.velocity.x * 60;
    player.vy = this.playerVisual.body.velocity.y * 60;
    player.grounded = grounded;
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
      || this.keys.down.isDown
      || this.keys.s.isDown
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
      this.updatePlatformCollisionFilters();

      const direction = Number(right) - Number(left);
      if (direction) state.player.facing = direction;
      if (time < (this.dashUntil || 0)) this.matter.setVelocityX(this.playerVisual, state.player.facing * DASH_SPEED);
      else this.matter.setVelocityX(this.playerVisual, direction * RUN_SPEED * getRunSpeedMultiplier(state));

      if (state.player.y + PLAYER_HEIGHT - state.player.groundY > VOID_DEATH_DEPTH) {
        if (!this.rescueFromVoid()) this.freezeRun();
        drawGame(this, state);
        return;
      }

      if (state.mode === 'collapse' && state.exitTouched) {
        state.exitTouched = false;
        this.advanceAfterLevelComplete();
      }
      state.messageTimer = Math.max(0, state.messageTimer - dt);
      this.syncHud();
    }
    drawGame(this, state);
  }

  syncHud() {
    const state = this.state;
    const labels = { ready: 'Ready', intermission: 'Intermission', collect: 'Collect', collapse: 'Collapse!', shop: 'Upgrade', dead: 'Run over', victory: 'Victory' };
    state.phaseNode.textContent = labels[state.mode] || 'Ready';
    const collectingCurrency = state.mode === 'collapse';
    const count = collectingCurrency ? state.currencyCollected : state.normalCollected;
    const total = collectingCurrency ? state.currencyDotTotal : state.normalDotTotal;
    state.dotsNode.innerHTML = `${count} <small>/ ${total}</small>`;
    state.creditsNode.textContent = state.credits;
    state.shieldNode.textContent = state.player.shieldUsed ? 'Spent' : 'Ready';
    state.voidShieldNode.textContent = !state.owned.voidShield
      ? 'Not owned'
      : state.voidShieldUsed
        ? 'Spent'
        : 'Ready';
  }
}