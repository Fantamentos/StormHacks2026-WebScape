import assert from 'node:assert/strict';
import test from 'node:test';
import { freezeMatterRun } from './death.js';

function createBody() {
  return {
    x: 90,
    y: 120,
    gravityIgnored: false,
    isStatic: false,
    setIgnoreGravity(value) { this.gravityIgnored = value; },
    setStatic(value) { this.isStatic = value; }
  };
}

test('death stops and freezes player and enemy, then pauses physics without moving them', () => {
  const state = { mode: 'collect' };
  const player = createBody();
  const enemy = createBody();
  const stoppedBodies = [];
  let paused = false;
  const matter = { setVelocity(body, x, y) { stoppedBodies.push([body, x, y]); } };
  const world = { pause() { paused = true; } };

  assert.equal(freezeMatterRun(state, matter, player, enemy, world), true);
  assert.equal(state.mode, 'dead');
  assert.deepEqual(stoppedBodies, [[player, 0, 0], [enemy, 0, 0]]);
  assert.equal(player.gravityIgnored, true);
  assert.equal(player.isStatic, true);
  assert.equal(enemy.gravityIgnored, true);
  assert.equal(enemy.isStatic, true);
  assert.equal(paused, true);
  assert.deepEqual([player.x, player.y, enemy.x, enemy.y], [90, 120, 90, 120]);
  assert.equal(freezeMatterRun(state, matter, player, enemy, world), false);
});