import assert from 'node:assert/strict';
import test from 'node:test';
import { isGroundContact } from './matterSupport.js';

const player = { label: 'player' };
const platform = { label: 'platform' };

test('Matter ground contacts work regardless of pair body order', () => {
  assert.equal(isGroundContact({ bodyA: player, bodyB: platform, collision: { normal: { y: -1 } } }, player), true);
  assert.equal(isGroundContact({ bodyA: platform, bodyB: player, collision: { normal: { y: 1 } } }, player), true);
});

test('Matter underside and side contacts do not ground the player', () => {
  assert.equal(isGroundContact({ bodyA: player, bodyB: platform, collision: { normal: { y: 1 } } }, player), false);
  assert.equal(isGroundContact({ bodyA: platform, bodyB: player, collision: { normal: { y: -1 } } }, player), false);
  assert.equal(isGroundContact({ bodyA: player, bodyB: platform, collision: { normal: { y: 0 } } }, player), false);
});

test('unrelated Matter collisions do not ground the player', () => {
  const other = { label: 'dot' };
  assert.equal(isGroundContact({ bodyA: other, bodyB: platform, collision: { normal: { y: 1 } } }, player), false);
});