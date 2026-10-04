import assert from 'node:assert/strict';
import test from 'node:test';
import { generateFallbackLevel, generateLevel } from './map.js';

test('level graphs grow with four two-route branches and physical BFS routes', () => {
  let previousDepth = 0;

  for (const level of [1, 2, 3, 4]) {
    const map = generateLevel(level);
    const ids = new Set(map.nodes.map(node => node.id));

    assert.ok(map.depth > previousDepth);
    previousDepth = map.depth;
    assert.equal(ids.size, map.nodes.length);
    assert.equal(map.root.childIds.length, 4);
    assert.ok(map.root.childIds.every(id => map.byId.get(id).childIds.length === 2));
    assert.ok(map.nodes.filter(node => node !== map.root).every(node => node.childIds.length <= 2));
    assert.ok(map.nodes.every(node => Number.isFinite(node.distance)));
    assert.ok(map.nodes.every(node => node === map.root || ids.has(node.routeParentId)));
    assert.ok(map.nodes.filter(node => node !== map.root).every(node => node.remainingDepth === map.byId.get(node.parentId).remainingDepth - 1));

    for (const node of map.nodes) {
      if (!node.parentId) continue;
      const parent = map.byId.get(node.parentId);
      const gapX = Math.max(0, node.x - (parent.x + parent.w), parent.x - (node.x + node.w));
      if (gapX > 0) assert.ok(gapX >= 36 && gapX <= 48, `${parent.id}/${node.id} has ${gapX}px horizontal clearance`);
    }

    for (let first = 0; first < map.nodes.length; first += 1) {
      const a = map.nodes[first];
      for (let second = first + 1; second < map.nodes.length; second += 1) {
        const b = map.nodes[second];
        const gapX = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
        const gapY = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
        assert.ok(gapX > 0 || gapY > 0, `${a.id} overlaps ${b.id}`);
        assert.ok(Math.hypot(gapX, gapY) >= 36, `${a.id} is too close to ${b.id}`);
      }
    }
  }
});

test('the non-jittered fallback is a validated level layout', () => {
  const map = generateFallbackLevel(2);
  assert.equal(map.usedFallback, true);
  assert.equal(map.root.childIds.length, 4);
  assert.ok(map.nodes.every(node => Number.isFinite(node.distance)));
});

test('collapse removes physical BFS leaves without removing the exit route', async () => {
  const { startCollapseWaves, updateCollapse } = await import('./collapse.js');
  const map = generateLevel(3);
  const state = { platforms: [...map.platforms], dots: [], exitPlatform: map.root };
  startCollapseWaves(state);

  for (let turn = 0; turn < map.nodes.length * 2; turn += 1) {
    state.collapse.timer = 0;
    updateCollapse(state, 0);
    if (!state.collapse.wave) break;
    state.collapse.timer = 0;
    updateCollapse(state, 0);
    const activeIds = new Set(state.platforms.map(node => node.id));
    assert.ok(state.platforms.every(node => node === map.root || activeIds.has(node.routeParentId)));
  }

  assert.ok(state.platforms.includes(map.root));
});