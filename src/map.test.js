import assert from 'node:assert/strict';
import test from 'node:test';
import { generateFallbackLevel, generateLevel } from './map.js';
import { choosePlatformShape, PLATFORM_SHAPES } from './platforms/index.js';

test('level graphs grow with four two-route branches and connected BFS routes', () => {
  let previousDepth = 0;

  for (const level of [1, 2, 3, 4]) {
    const map = generateLevel(level);
    const ids = new Set(map.nodes.map(node => node.id));

    assert.ok(map.depth > previousDepth);
    previousDepth = map.depth;
    assert.equal(ids.size, map.nodes.length);
    assert.ok(map.nodes.every(node => PLATFORM_SHAPES.some(shape => shape.type === node.shape)));
    assert.ok(map.nodes.every(node => node.w === PLATFORM_SHAPES.find(shape => shape.type === node.shape).width));
    assert.equal(map.root.childIds.length, 4);
    assert.equal(map.root.shape, 'standard');
    assert.ok(map.root.childIds.every(id => map.byId.get(id).shape === 'standard' && map.byId.get(id).w === 124));
    assert.ok(map.root.childIds.every(id => map.byId.get(id).childIds.length === 2));
    assert.ok(map.nodes.filter(node => node !== map.root).every(node => node.childIds.length <= 2));
    assert.ok(map.nodes.some(node => node.optionalStep));
    assert.ok(map.nodes.every(node => Number.isFinite(node.distance)));
    assert.ok(map.nodes.every(node => node === map.root || ids.has(node.routeParentId)));
    assert.ok(map.nodes.filter(node => node !== map.root && !node.optionalStep).every(node => node.remainingDepth === map.byId.get(node.parentId).remainingDepth - 1));
    assert.ok(map.nodes.filter(node => node.optionalStep).every(node => node.shape === 'step' && node.w === 48));

    for (const node of map.nodes) {
      if (!node.parentId) continue;
      const parent = map.byId.get(node.parentId);
      const gapX = Math.max(0, node.x - (parent.x + parent.w), parent.x - (node.x + node.w));
      if (gapX > 0 && parent === map.root) assert.ok(gapX >= 56 && gapX <= 72, `${parent.id}/${node.id} should remain inside the start jump envelope`);
      else if (gapX > 0) assert.ok(gapX >= 36 && gapX <= 48, `${parent.id}/${node.id} has ${gapX}px horizontal clearance`);
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

test('collapse removes BFS leaves without removing the exit route', async () => {
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

test('platform folder shapes can be selected from seeded random values', () => {
  assert.deepEqual(
    [0.01, 0.2, 0.32, 0.44, 0.56, 0.68, 0.82, 0.95].map(value => choosePlatformShape(value).type),
    PLATFORM_SHAPES.map(shape => shape.type)
  );
});

test('T, Y, and L shapes have composite support bodies and walkable top collision sections', () => {
  for (const type of ['t', 'y', 'l']) {
    const shape = PLATFORM_SHAPES.find(platform => platform.type === type);
    assert.ok(shape.bodySections.length > 1);
    assert.ok(shape.collisionSections.length > 0);
    assert.ok(shape.collisionSections.every(section => section.y === 0));
    assert.ok(shape.collisionSections.reduce((width, section) => width + section.width, 0) >= shape.width);
  }
});

test('angled ramp bodies are generated as connected map route nodes', () => {
  const rampShape = PLATFORM_SHAPES.find(platform => platform.type === 'ramp');
  const map = generateLevel(1);

  assert.notEqual(rampShape.angle, 0);
  assert.ok(rampShape.bodySections.length > 0);
  assert.ok(map.nodes.some(node => node.shape === 'ramp' && node.angle !== 0));
});

test('seeded maps vary reachable root branch positions reproducibly', () => {
  const first = generateLevel(2, 21);
  const sameSeed = generateLevel(2, 21);
  const otherSeed = generateLevel(2, 22);
  const rootPositions = map => map.root.childIds.map(id => {
    const node = map.byId.get(id);
    return [node.x, node.y];
  });

  assert.equal(first.attempt, 0);
  assert.deepEqual(rootPositions(first), rootPositions(sameSeed));
  assert.notDeepEqual(rootPositions(first), rootPositions(otherSeed));
  for (const id of first.root.childIds) {
    const child = first.byId.get(id);
    const verticalDistance = Math.abs(child.y - first.root.y);
    if (child.branch.x !== 0) assert.ok(verticalDistance >= 42 && verticalDistance <= 66);
    else assert.equal(verticalDistance, 82);
  }
});