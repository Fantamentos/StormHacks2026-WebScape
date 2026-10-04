import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeVoidShield, getVoidRescuePosition } from './voidShield.js';

test('Void Shield consumes once and cannot rescue a second fall', () => {
  const state = { owned: { voidShield: true }, voidShieldUsed: false };
  assert.equal(consumeVoidShield(state), true);
  assert.equal(state.voidShieldUsed, true);
  assert.equal(consumeVoidShield(state), false);
});

test('Void Shield rescue position is above the highest platform for a safe drop', () => {
  const platforms = [
    { id: 'low', x: 0, y: 500, w: 124, h: 14 },
    { id: 'high', x: 300, y: 180, w: 156, h: 14 },
    { id: 'middle', x: 160, y: 320, w: 124, h: 14 }
  ];

  assert.deepEqual(getVoidRescuePosition(platforms, 28), {
    x: 378,
    y: 76,
    groundY: 180,
    platformId: 'high'
  });
  assert.equal(getVoidRescuePosition([], 28), null);
});