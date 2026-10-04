import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlatformDots, nearestUncollectedDot, rewardDot } from './dots.js';

test('each platform receives three uniquely identified dots of the requested type', () => {
  const platforms = [
    { id: 'left', x: 0, y: 100, w: 124 },
    { id: 'right', x: 200, y: 180, w: 124 }
  ];
  const dots = createPlatformDots(platforms, 'normal');
  const currencyDots = createPlatformDots(platforms, 'currency');

  assert.equal(dots.length, platforms.length * 3);
  assert.equal(currencyDots.length, platforms.length * 3);
  assert.equal(new Set(dots.map(dot => dot.id)).size, dots.length);
  assert.equal(new Set(currencyDots.map(dot => dot.id)).size, currencyDots.length);
  assert.ok(dots.every(dot => dot.type === 'normal' && platforms.includes(dot.platform)));
  assert.ok(currencyDots.every(dot => dot.type === 'currency' && platforms.includes(dot.platform)));
  assert.deepEqual(dots.slice(0, 3).map(dot => dot.x), [31, 62, 93]);
});

test('a Matter dot contact grants its reward only once', () => {
  const platform = { id: 'platform', x: 0, y: 120, w: 124 };
  const dot = createPlatformDots([platform], 'currency')[1];
  const state = { credits: 0, currencyCollected: 0, normalCollected: 0 };

  assert.equal(rewardDot(state, dot), true);
  assert.equal(rewardDot(state, dot), false);
  assert.equal(dot.taken, true);
  assert.equal(state.credits, 1);
  assert.equal(state.currencyCollected, 1);
});

test('compass target is the nearest uncollected dot', () => {
  const player = { x: 0, y: 0, w: 25, h: 34 };
  const nearest = { id: 'near', x: 20, y: 17, taken: false };
  const farther = { id: 'far', x: 100, y: 17, taken: false };
  const collected = { id: 'taken', x: 1, y: 17, taken: true };

  assert.equal(nearestUncollectedDot(player, [farther, collected, nearest]), nearest);
  assert.equal(nearestUncollectedDot(player, [collected]), null);
});