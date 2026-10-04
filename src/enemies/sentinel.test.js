import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceSentinel,
  advanceSentinelBullet,
  createSentinel,
  createSentinelBullet,
  SENTINEL_BULLET_SPEED,
  SENTINEL_DASH_DISTANCE,
  SENTINEL_SHOT_INTERVAL_MS,
  SENTINEL_SPAWN_GRACE_MS,
  SENTINEL_TARGET_RADIUS,
  SENTINEL_TELEGRAPH_MS
} from './sentinel.js';
import { getSentinelModifierOptions, SENTINEL_DOUBLE_SHOT } from '../modifiers/sentinel.js';

test('Sentinel waits for spawn grace, telegraphs away from the player, then dashes evasively', () => {
  const sentinel = createSentinel({}, 200, 100, 0);
  const player = { x: 100, y: 100 };

  assert.equal(advanceSentinel(sentinel, SENTINEL_SPAWN_GRACE_MS - 1, player, () => 0.5).phase, 'grace');
  assert.equal(advanceSentinel(sentinel, SENTINEL_SPAWN_GRACE_MS, player, () => 0.5).phase, 'telegraph');
  assert.ok(sentinel.target.x - sentinel.x >= SENTINEL_DASH_DISTANCE * Math.cos(0.5));
  assert.equal(advanceSentinel(sentinel, SENTINEL_SPAWN_GRACE_MS + SENTINEL_TELEGRAPH_MS, player, () => 0.5).phase, 'dash');
  assert.ok(advanceSentinel(sentinel, 3500, player, () => 0.5).position.x > 200);
});

test('Sentinel fires fixed-speed shots every three seconds at the player or hexagon vertices', () => {
  const sentinel = createSentinel({}, 0, 0, 0);
  const player = { x: 100, y: 100 };

  assert.equal(advanceSentinel(sentinel, SENTINEL_SHOT_INTERVAL_MS - 1, player, () => 0).bullets.length, 0);
  const { bullets } = advanceSentinel(sentinel, SENTINEL_SHOT_INTERVAL_MS, player, () => 0);
  assert.equal(bullets.length, 1);
  assert.deepEqual(bullets[0].target, player);
  assert.ok(Math.abs(Math.hypot(bullets[0].vx, bullets[0].vy) - SENTINEL_BULLET_SPEED) < 0.001);
  assert.equal(advanceSentinel(sentinel, 5999, player, () => 0).bullets.length, 0);
  assert.equal(advanceSentinel(sentinel, 6000, player, () => 0).bullets.length, 1);

  const vertexShot = createSentinelBullet({ x: 0, y: 0 }, player, () => 0.2);
  assert.ok(Math.abs(Math.hypot(vertexShot.target.x - player.x, vertexShot.target.y - player.y) - SENTINEL_TARGET_RADIUS) < 0.001);
});

test('Sentinel bullets travel straight at fixed speed and stop exactly at their target', () => {
  const bullet = createSentinelBullet({ x: 0, y: 0 }, { x: 100, y: 0 }, () => 0);

  assert.equal(advanceSentinelBullet(bullet, 250), true);
  assert.equal(bullet.x, SENTINEL_BULLET_SPEED / 4);
  assert.equal(advanceSentinelBullet(bullet, 1000), false);
  assert.deepEqual({ x: bullet.x, y: bullet.y }, bullet.target);
});

test('Sentinel Double Shot adds one bullet to each volley', () => {
  const options = getSentinelModifierOptions([SENTINEL_DOUBLE_SHOT.id]);
  const sentinel = createSentinel({}, 0, 0, 0, options);

  assert.equal(advanceSentinel(sentinel, SENTINEL_SHOT_INTERVAL_MS, { x: 100, y: 0 }, () => 0).bullets.length, 2);
});