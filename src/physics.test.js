import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePlatformLanding } from './physics.js';

function createPlayer(overrides = {}) {
  return { x: 50, y: 90, w: 25, h: 34, vy: 900, grounded: false, jumps: 1, ...overrides };
}

function stepFallingPlayer(player, platforms, dt = 1 / 60) {
  const previousY = player.y;
  player.vy += 1120 * dt;
  player.y += player.vy * dt;
  player.grounded = false;
  return resolvePlatformLanding(player, platforms, previousY);
}

test('landing resolves when a large update crosses a thin platform', () => {
  const player = createPlayer({ y: 110 });
  const platform = { id: 'thin', x: 0, y: 120, w: 124, h: 14 };

  const landed = resolvePlatformLanding(player, [platform], 70);

  assert.equal(landed, platform);
  assert.equal(player.y, 86);
  assert.equal(player.vy, 0);
  assert.equal(player.grounded, true);
  assert.equal(player.groundY, 120);
  assert.equal(player.jumps, 0);
});

test('landing selects the highest crossed platform independent of array order', () => {
  const player = createPlayer({ y: 130 });
  const lower = { id: 'lower', x: 0, y: 150, w: 124, h: 14 };
  const upper = { id: 'upper', x: 0, y: 120, w: 124, h: 14 };

  assert.equal(resolvePlatformLanding(player, [lower, upper], 70), upper);
  assert.equal(player.y, 86);
});

test('ascending players do not snap onto platform undersides', () => {
  const player = createPlayer({ y: 100, vy: -200 });
  const platform = { id: 'platform', x: 0, y: 120, w: 124, h: 14 };

  assert.equal(resolvePlatformLanding(player, [platform], 70), null);
  assert.equal(player.y, 100);
  assert.equal(player.grounded, false);
});

test('a player remains stably grounded across consecutive physics updates', () => {
  const platform = { id: 'floor', x: 0, y: 120, w: 124, h: 14 };
  const player = createPlayer({ x: 40, y: 86, vy: 0, jumps: 0 });

  for (let frame = 0; frame < 120; frame += 1) {
    assert.equal(stepFallingPlayer(player, [platform]), platform);
    assert.equal(player.y, platform.y - player.h);
    assert.equal(player.vy, 0);
    assert.equal(player.grounded, true);
  }
});

test('touching a platform edge without horizontal overlap is not a landing', () => {
  const platform = { id: 'platform', x: 100, y: 120, w: 124, h: 14 };
  const player = createPlayer({ x: platform.x - 25, y: 110 });

  assert.equal(resolvePlatformLanding(player, [platform], 70), null);
  assert.equal(player.y, 110);
  assert.equal(player.grounded, false);
});

test('a player already below a platform does not snap upward onto it', () => {
  const platform = { id: 'platform', x: 0, y: 120, w: 124, h: 14 };
  const player = createPlayer({ y: 130, vy: 300 });

  assert.equal(resolvePlatformLanding(player, [platform], 125), null);
  assert.equal(player.y, 130);
  assert.equal(player.vy, 300);
});

test('horizontal movement into a platform during descent can land on it', () => {
  const platform = { id: 'platform', x: 100, y: 120, w: 124, h: 14 };
  const player = createPlayer({ x: 101, y: 110, vy: 300 });

  assert.equal(resolvePlatformLanding(player, [platform], 70), platform);
  assert.equal(player.y, 86);
  assert.equal(player.grounded, true);
});