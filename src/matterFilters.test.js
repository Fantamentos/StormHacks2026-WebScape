import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dasherCollisionMask,
  ENEMY_CATEGORY,
  filtersAllowCollision,
  PLAYER_CATEGORY,
  PLAYER_MASK,
  PLATFORM_CATEGORY,
  PLATFORM_MASK
} from './matterFilters.js';

test('Dasher dash collides with the player but ignores platforms and terrain', () => {
  const player = { category: PLAYER_CATEGORY, mask: PLAYER_MASK };
  const platform = { category: PLATFORM_CATEGORY, mask: PLATFORM_MASK };
  const telegraph = { category: ENEMY_CATEGORY, mask: dasherCollisionMask('telegraph') };
  const dash = { category: ENEMY_CATEGORY, mask: dasherCollisionMask('dash') };

  assert.equal(filtersAllowCollision(telegraph, player), false);
  assert.equal(filtersAllowCollision(dash, player), true);
  assert.equal(filtersAllowCollision(dash, platform), false);
});