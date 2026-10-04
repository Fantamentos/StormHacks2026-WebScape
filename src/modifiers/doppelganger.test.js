import assert from 'node:assert/strict';
import test from 'node:test';
import { DOPPELGANGER_CAP_FIVE, getDoppelgangerModifierOptions } from './doppelganger.js';

test('Doppelganger cap modifier is enemy-specific and raises the limit to five', () => {
  assert.deepEqual(getDoppelgangerModifierOptions([]), {});
  assert.deepEqual(getDoppelgangerModifierOptions([DOPPELGANGER_CAP_FIVE.id]), { maxCount: 5 });
});