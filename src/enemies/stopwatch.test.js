import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceStopwatch,
  createStopwatch,
  getStopwatchDisplay,
  STOPWATCH_COUNTDOWN_MS,
  STOPWATCH_FIRST_SPAWN_MAX_MS,
  STOPWATCH_FIRST_SPAWN_MIN_MS,
  STOPWATCH_IDLE_REQUIRED_MS
} from './stopwatch.js';
import { getStopwatchModifierOptions, STOPWATCH_REVERSE_TICKING } from '../modifiers/stopwatch.js';

test('Stopwatch spawns randomly between seven and ten seconds and starts its countdown immediately', () => {
  const early = createStopwatch(1000, {}, () => 0);
  const late = createStopwatch(1000, {}, () => 0.999);

  assert.equal(early.nextSpawnAt, 1000 + STOPWATCH_FIRST_SPAWN_MIN_MS);
  assert.ok(late.nextSpawnAt <= 1000 + STOPWATCH_FIRST_SPAWN_MAX_MS);
  assert.equal(advanceStopwatch(early, early.nextSpawnAt - 1, false, () => 0), null);
  assert.deepEqual(advanceStopwatch(early, early.nextSpawnAt, false, () => 0), { type: 'spawn' });
  assert.equal(early.expiresAt - early.startedAt, STOPWATCH_COUNTDOWN_MS);
  assert.deepEqual(getStopwatchDisplay(early, early.startedAt), { seconds: 12, finalSecond: false });
  assert.deepEqual(getStopwatchDisplay(early, early.startedAt + 1001), { seconds: 11, finalSecond: false });
  assert.deepEqual(getStopwatchDisplay(early, early.expiresAt - 1000), { seconds: 1, finalSecond: true });
});

test('ordinary Stopwatch is avoided only after 200 ms without controls before expiration', () => {
  const avoided = createStopwatch(0, {}, () => 0);
  advanceStopwatch(avoided, avoided.nextSpawnAt, false, () => 0);
  const expiresAt = avoided.expiresAt;
  advanceStopwatch(avoided, expiresAt - STOPWATCH_IDLE_REQUIRED_MS - 1, true, () => 0);
  advanceStopwatch(avoided, expiresAt - STOPWATCH_IDLE_REQUIRED_MS, false, () => 0);
  assert.deepEqual(advanceStopwatch(avoided, expiresAt, false, () => 0), { type: 'evaded' });

  const hit = createStopwatch(0, {}, () => 0);
  advanceStopwatch(hit, hit.nextSpawnAt, true, () => 0);
  assert.deepEqual(advanceStopwatch(hit, hit.expiresAt, true, () => 0), { type: 'damage' });
});

test('avoiding a Stopwatch resets its randomized cooldown', () => {
  const stopwatch = createStopwatch(0, {}, () => 0);
  advanceStopwatch(stopwatch, stopwatch.nextSpawnAt, false, () => 0);
  const expiresAt = stopwatch.expiresAt;
  assert.deepEqual(advanceStopwatch(stopwatch, expiresAt, false, () => 0), { type: 'evaded' });
  assert.equal(stopwatch.nextSpawnAt, expiresAt + STOPWATCH_FIRST_SPAWN_MIN_MS);
});

test('Reverse Ticking counts up and makes input during the yellow final second fatal', () => {
  const options = getStopwatchModifierOptions([STOPWATCH_REVERSE_TICKING.id]);
  const stopwatch = createStopwatch(0, options, () => 0);
  advanceStopwatch(stopwatch, stopwatch.nextSpawnAt, false, () => 0);

  assert.deepEqual(getStopwatchDisplay(stopwatch, stopwatch.startedAt), { seconds: 1, finalSecond: false });
  assert.deepEqual(getStopwatchDisplay(stopwatch, stopwatch.expiresAt - 1000), { seconds: 12, finalSecond: true });
  assert.deepEqual(advanceStopwatch(stopwatch, stopwatch.expiresAt - 500, true, () => 0), { type: 'damage' });

  const avoided = createStopwatch(0, options, () => 0);
  advanceStopwatch(avoided, avoided.nextSpawnAt, false, () => 0);
  assert.equal(advanceStopwatch(avoided, avoided.expiresAt - 1000, false, () => 0), null);
  assert.deepEqual(advanceStopwatch(avoided, avoided.expiresAt, false, () => 0), { type: 'evaded' });
});