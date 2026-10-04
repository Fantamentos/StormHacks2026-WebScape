import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceDasher, chooseDasherSpawn, createDasher, DASH_MS, SPAWN_GRACE_MS, TELEGRAPH_MS } from './dasher.js';

test('Dasher waits two seconds, telegraphs for one second, dashes for one, then telegraphs again', () => {
  const player = { x: 200, y: 100 };
  const dasher = createDasher({ id: 'outer-platform' }, 0, 100, 1000);
  const random = () => 0.5;

  assert.equal(advanceDasher(dasher, 1000 + SPAWN_GRACE_MS - 1, player, random), null);
  assert.deepEqual(advanceDasher(dasher, 1000 + SPAWN_GRACE_MS, player, random), { type: 'telegraph', target: { x: 200, y: 100 } });
  assert.equal(advanceDasher(dasher, 1000 + SPAWN_GRACE_MS + TELEGRAPH_MS - 1, player, random), null);
  const dash = advanceDasher(dasher, 1000 + SPAWN_GRACE_MS + TELEGRAPH_MS, player, random);
  assert.deepEqual(dash, { type: 'dash', velocity: { x: 200 / 60, y: 0 }, target: { x: 200, y: 100 } });
  assert.equal(advanceDasher(dasher, 1000 + SPAWN_GRACE_MS + TELEGRAPH_MS + DASH_MS - 1, player, random), null);
  assert.deepEqual(advanceDasher(dasher, 1000 + SPAWN_GRACE_MS + TELEGRAPH_MS + DASH_MS, player, random), { type: 'telegraph', target: { x: 200, y: 100 } });
});

test('locked Dasher target is unchanged during the dash even when the player moves', () => {
  const dasher = createDasher({ id: 'outer-platform' }, 0, 0, 0);
  const centerRandom = () => 0.5;
  advanceDasher(dasher, SPAWN_GRACE_MS, { x: 100, y: 50 }, centerRandom);
  const telegraphTarget = { ...dasher.target };
  const dash = advanceDasher(dasher, SPAWN_GRACE_MS + TELEGRAPH_MS, { x: 400, y: 300 }, centerRandom);

  assert.deepEqual(dash.target, telegraphTarget);
  assert.deepEqual(dasher.target, telegraphTarget);
});

test('a Dasher target is selected near the player at telegraph start', () => {
  const dasher = createDasher({ id: 'outer-platform' }, 0, 0, 0);
  advanceDasher(dasher, SPAWN_GRACE_MS, { x: 100, y: 50 }, () => 1);

  assert.equal(dasher.target.x, 148);
  assert.equal(dasher.target.y, 74);
  assert.equal(DASH_MS, 1000);
});

test('Dasher spawn samples the area around safe outer platforms, not only leaf tops', () => {
  const platforms = [
    { id: 'near-outer', x: 100, y: 0, w: 124, h: 14, distance: 4, routeChildIds: [] },
    { id: 'outer-a', x: 400, y: 0, w: 124, h: 14, distance: 4, routeChildIds: ['child'] },
    { id: 'outer-b', x: 700, y: 0, w: 124, h: 14, distance: 4, routeChildIds: ['child'] },
    { id: 'inner', x: 350, y: 0, w: 124, h: 14, distance: 3, routeChildIds: [] }
  ];
  const player = { x: 0, y: 0 };
  const outerARandom = (() => { const values = [0, 0, 0]; let index = 0; return () => values[index++ % values.length]; })();
  const outerBRandom = (() => { const values = [0.99, 0, 0]; let index = 0; return () => values[index++ % values.length]; })();

  const outerA = chooseDasherSpawn(platforms, player, outerARandom);
  const outerB = chooseDasherSpawn(platforms, player, outerBRandom);
  assert.equal(outerA.platform, platforms[1]);
  assert.equal(outerB.platform, platforms[2]);
  assert.ok(Math.hypot(outerA.x - (platforms[1].x + platforms[1].w / 2), outerA.y - (platforms[1].y + platforms[1].h / 2)) <= 80);
  assert.ok(Math.hypot(outerA.x - player.x, outerA.y - player.y) >= 220);
  assert.ok(!platforms.some(platform => platform.id === outerA.platform.id && platform.routeChildIds.length === 0));
  assert.equal(chooseDasherSpawn(platforms.slice(0, 1), player, () => 0), null);
});