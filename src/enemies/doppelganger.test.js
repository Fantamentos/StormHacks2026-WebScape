import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceDoppelgangerRun,
  createDoppelgangerRun,
  DOPPELGANGER_FOLLOW_DELAY_MS,
  DOPPELGANGER_MAX_COUNT,
  DOPPELGANGER_SPAWN_DELAY_MS,
  samplePosition
} from './doppelganger.js';
import { DOPPELGANGER_CAP_FIVE, DOPPELGANGER_FAST_FOLLOW, getDoppelgangerModifierOptions } from '../modifiers/doppelganger.js';

test('history sampling interpolates between recorded player positions', () => {
  assert.deepEqual(samplePosition([{ time: 0, x: 0, y: 20 }, { time: 1000, x: 100, y: 40 }], 500), { x: 50, y: 30 });
});

test('first Doppelganger spawns at the player position from two seconds earlier', () => {
  const run = createDoppelgangerRun(0, { x: 0, y: 0 });
  advanceDoppelgangerRun(run, 1000, { x: 100, y: 50 });
  assert.equal(advanceDoppelgangerRun(run, DOPPELGANGER_SPAWN_DELAY_MS - 1, { x: 200, y: 100 }).length, 0);

  const copies = advanceDoppelgangerRun(run, DOPPELGANGER_SPAWN_DELAY_MS, { x: 200, y: 100 });
  assert.deepEqual({ x: copies[0].x, y: copies[0].y }, { x: 0, y: 0 });
});

test('copies form a two-second delayed chain and cap at three', () => {
  const run = createDoppelgangerRun(0, { x: 0, y: 0 });
  for (let time = 100; time <= 12000; time += 100) {
    advanceDoppelgangerRun(run, time, { x: time / 10, y: time / 20 });
  }

  assert.equal(run.copies.length, DOPPELGANGER_MAX_COUNT);
  assert.equal(run.delayMs, DOPPELGANGER_FOLLOW_DELAY_MS);
  assert.ok(run.copies[0].x > run.copies[1].x);
  assert.ok(run.copies[1].x > run.copies[2].x);
});

test('a fresh level run clears the old recorded trail', () => {
  const firstRun = createDoppelgangerRun(1000, { x: 900, y: 400 });
  advanceDoppelgangerRun(firstRun, 3000, { x: 500, y: 200 });
  const nextRun = createDoppelgangerRun(10000, { x: 10, y: 20 });

  assert.deepEqual(nextRun.playerHistory, [{ time: 10000, x: 10, y: 20 }]);
  assert.equal(nextRun.copies.length, 0);
});

test('the configured enemy-buff modifier raises the copy cap to five', () => {
  const run = createDoppelgangerRun(0, { x: 0, y: 0 }, getDoppelgangerModifierOptions([DOPPELGANGER_CAP_FIVE.id]));
  for (let time = 100; time <= 14000; time += 100) {
    advanceDoppelgangerRun(run, time, { x: time / 10, y: 0 });
  }

  assert.equal(run.copies.length, DOPPELGANGER_CAP_FIVE.maxCount);
});

test('the fast-follow modifier shortens chain spacing without changing initial spawn grace', () => {
  const options = getDoppelgangerModifierOptions([DOPPELGANGER_FAST_FOLLOW.id]);
  const run = createDoppelgangerRun(0, { x: 0, y: 0 }, options);

  assert.equal(run.nextSpawnAt, DOPPELGANGER_SPAWN_DELAY_MS);
  assert.equal(run.delayMs, DOPPELGANGER_FAST_FOLLOW.delayMs);
  assert.equal(advanceDoppelgangerRun(run, 1999, { x: 199, y: 0 }).length, 0);
  assert.equal(advanceDoppelgangerRun(run, 2000, { x: 200, y: 0 }).length, 1);
  assert.equal(advanceDoppelgangerRun(run, 2999, { x: 299, y: 0 }).length, 1);
  assert.equal(advanceDoppelgangerRun(run, 3000, { x: 300, y: 0 }).length, 2);
});