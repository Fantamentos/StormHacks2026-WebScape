import assert from 'node:assert/strict';
import test from 'node:test';
import { updateCollapse, startCollapseWaves } from './collapse.js';
import { getPlatformColors } from '../../render.js';

test('warning platforms blink for four seconds, stay white for two, then disappear', () => {
  const root = { id: 'root', routeChildIds: [] };
  const leaf = { id: 'leaf', routeChildIds: [], warning: false };
  const state = { platforms: [root, leaf], dots: [], exitPlatform: root };
  startCollapseWaves(state);
  state.collapse.timer = 0;
  updateCollapse(state, 0);

  const warningPlatform = state.collapse.wave[0];
  assert.equal(getPlatformColors(warningPlatform, state).fill, '#ffffff');
  updateCollapse(state, 0.5);
  assert.equal(getPlatformColors(warningPlatform, state).fill, '#34484a');
  updateCollapse(state, 0.5);
  assert.equal(getPlatformColors(warningPlatform, state).fill, '#ffffff');
  updateCollapse(state, 3);
  assert.equal(state.collapse.warningElapsed, 4);
  assert.equal(getPlatformColors(warningPlatform, state).fill, '#ffffff');
  updateCollapse(state, 1.99);
  assert.ok(state.platforms.includes(leaf));
  updateCollapse(state, 0.02);
  assert.ok(!state.platforms.includes(leaf));
});

test('start platform changes from red before collapse to green during collapse', () => {
  const startPlatform = { id: 'root', warning: false };
  const state = { startPlatform, mode: 'collect', collapse: { warningElapsed: 0 } };
  assert.equal(getPlatformColors(startPlatform, state).fill, '#a8443d');
  state.mode = 'collapse';
  assert.equal(getPlatformColors(startPlatform, state).fill, '#287451');
});