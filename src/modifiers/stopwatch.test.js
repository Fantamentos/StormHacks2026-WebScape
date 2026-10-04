import assert from 'node:assert/strict';
import test from 'node:test';
import { getStopwatchModifierOptions, STOPWATCH_REVERSE_TICKING } from './stopwatch.js';

test('Reverse Ticking is an enemy-specific opt-in Stopwatch modifier', () => {
  assert.deepEqual(getStopwatchModifierOptions([]), {});
  assert.deepEqual(getStopwatchModifierOptions([STOPWATCH_REVERSE_TICKING.id]), { reverseTicking: true });
});