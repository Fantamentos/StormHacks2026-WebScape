import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOPPELGANGER_BUFFED_MAX_COUNT,
  ENEMY_MODIFIER_IDS,
  getDasherModifierOptions,
  getDoppelgangerModifierOptions
} from './enemyModifiers.js';

test('Dasher follow-up option is enabled only when its modifier is selected', () => {
  assert.deepEqual(getDasherModifierOptions([]), { buffedFollowup: false });
  assert.deepEqual(getDasherModifierOptions([ENEMY_MODIFIER_IDS.DASHER_FOLLOWUP]), { buffedFollowup: true });
});

test('Doppelganger cap modifier raises the configured copy limit to five', () => {
  assert.deepEqual(getDoppelgangerModifierOptions([]), {});
  assert.deepEqual(getDoppelgangerModifierOptions([ENEMY_MODIFIER_IDS.DOPPELGANGER_CAP_FIVE]), { maxCount: DOPPELGANGER_BUFFED_MAX_COUNT });
});
