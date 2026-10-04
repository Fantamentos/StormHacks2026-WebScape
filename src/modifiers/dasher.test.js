import assert from 'node:assert/strict';
import test from 'node:test';
import { DASHER_FOLLOWUP, getDasherModifierOptions } from './dasher.js';

test('Dasher follow-up options are enemy-specific and opt-in', () => {
  assert.deepEqual(getDasherModifierOptions([]), { buffedFollowup: false });
  assert.deepEqual(getDasherModifierOptions([DASHER_FOLLOWUP.id]), {
    buffedFollowup: true,
    followupTelegraphMs: 250
  });
});