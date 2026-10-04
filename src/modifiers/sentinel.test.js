import assert from 'node:assert/strict';
import test from 'node:test';
import { getSentinelModifierOptions, SENTINEL_DOUBLE_SHOT } from './sentinel.js';

test('Sentinel Double Shot is enemy-specific and opt-in', () => {
  assert.deepEqual(getSentinelModifierOptions([]), {});
  assert.deepEqual(getSentinelModifierOptions([SENTINEL_DOUBLE_SHOT.id]), { extraBullets: 1 });
});