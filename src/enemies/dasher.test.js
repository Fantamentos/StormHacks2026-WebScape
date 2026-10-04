import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceDasher, chooseDasherSpawn, createDasher, DASH_MS, getDasherDashPosition, SPAWN_GRACE_MS, TELEGRAPH_MS } from './dasher.js';
import { DASHER_FOLLOWUP, getDasherModifierOptions } from '../modifiers/dasher.js';

test('Dasher waits two seconds, telegraphs for one second, dashes for one, then telegraphs again', () => {
  const player = { x: 200, y: 100 };
  const dasher = createDasher({ id: 'outer-platform' }, 0, 100, 1000);
  const random = () => 0.5;

  assert.equal(advanceDasher(dasher, 1000 + SPAWN_GRACE_MS - 1, player, random), null);
  assert.deepEqual(advanceDasher(dasher, 1000 + SPAWN_GRACE_MS, player, random), { type: 'telegraph', target: { x: 200, y: 100 }, duration: TELEGRAPH_MS, phase: 'telegraph' });
  assert.equal(advanceDasher(dasher, 1000 + SPAWN_GRACE_MS + TELEGRAPH_MS - 1, player, random), null);
  const dash = advanceDasher(dasher, 1000 + SPAWN_GRACE_MS + TELEGRAPH_MS, player, random);
  assert.deepEqual(dash, { type: 'dash-start', position: { x: 0, y: 100 }, target: { x: 200, y: 100 }, phase: 'dash' });
  const finalDashFrame = advanceDasher(dasher, 1000 + SPAWN_GRACE_MS + TELEGRAPH_MS + DASH_MS - 1, player, random);
  assert.equal(finalDashFrame.type, 'move');
  assert.ok(finalDashFrame.position.x < player.x);
  assert.deepEqual(advanceDasher(dasher, 1000 + SPAWN_GRACE_MS + TELEGRAPH_MS + DASH_MS, player, random), { type: 'telegraph', target: { x: 200, y: 100 }, duration: TELEGRAPH_MS, phase: 'telegraph' });
  assert.deepEqual({ x: dasher.x, y: dasher.y }, { x: 200, y: 100 });
});

test('locked Dasher target is unchanged during the dash even when the player moves', () => {
  const dasher = createDasher({ id: 'outer-platform' }, 0, 0, 0);
  const centerRandom = () => 0.5;
  advanceDasher(dasher, SPAWN_GRACE_MS, { x: 100, y: 50 }, centerRandom);
  const telegraphTarget = { ...dasher.target };
  const dash = advanceDasher(dasher, SPAWN_GRACE_MS + TELEGRAPH_MS, { x: 400, y: 300 }, centerRandom);

  assert.deepEqual(dash.target, telegraphTarget);
  const halfway = advanceDasher(dasher, SPAWN_GRACE_MS + TELEGRAPH_MS + 500, { x: 400, y: 300 }, centerRandom);
  assert.equal(halfway.type, 'move');
  assert.ok(halfway.position.x < telegraphTarget.x);
  assert.deepEqual(dasher.target, telegraphTarget);
});

test('Dasher starts slightly fast and visibly eases through the final quarter', () => {
  const dasher = createDasher({ id: 'outer-platform' }, 0, 100, 0);
  const random = () => 0.5;
  advanceDasher(dasher, SPAWN_GRACE_MS, { x: 200, y: 100 }, random);
  advanceDasher(dasher, SPAWN_GRACE_MS + TELEGRAPH_MS, { x: 200, y: 100 }, random);

  const early = getDasherDashPosition(dasher, 3000 + 500).x / 200;
  const lateStart = getDasherDashPosition(dasher, 3000 + 750).x / 200;
  const lateMid = getDasherDashPosition(dasher, 3000 + 875).x / 200;
  const atTarget = getDasherDashPosition(dasher, 4000).x;

  assert.ok(early > 0.5);
  assert.ok(Math.abs(lateStart - 0.78) < 0.001);
  assert.ok(lateMid - lateStart < lateStart - early);
  assert.deepEqual({ x: atTarget, y: getDasherDashPosition(dasher, 4000).y }, { x: 200, y: 100 });
});

test('Dasher modifier inserts a 250 ms follow-up telegraph and dash before normal timing resumes', () => {
  const dasher = createDasher({ id: 'outer-platform' }, 0, 100, 0, getDasherModifierOptions([DASHER_FOLLOWUP.id]));
  const player = { x: 200, y: 100 };
  const random = () => 0.5;
  advanceDasher(dasher, SPAWN_GRACE_MS, player, random);
  advanceDasher(dasher, SPAWN_GRACE_MS + TELEGRAPH_MS, player, random);
  const followup = advanceDasher(dasher, SPAWN_GRACE_MS + TELEGRAPH_MS + DASH_MS, player, random);

  assert.equal(followup.phase, 'followupTelegraph');
  assert.equal(followup.duration, DASHER_FOLLOWUP.telegraphMs);
  assert.equal(advanceDasher(dasher, 4249, player, random), null);
  assert.equal(advanceDasher(dasher, 4250, player, random).phase, 'followupDash');
  const normal = advanceDasher(dasher, 5250, player, random);
  assert.equal(normal.phase, 'telegraph');
  assert.equal(normal.duration, TELEGRAPH_MS);
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