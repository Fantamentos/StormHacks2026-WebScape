import { createPlatformDots } from './dots.js';
import { choosePlatformShape, getPlatformShape, STANDARD_PLATFORM } from './platforms/index.js';

const ROOT_BRANCHES = [
  { x: 1, y: 0, label: 'east' },
  { x: -1, y: 0, label: 'west' },
  { x: 0, y: -1, label: 'north' },
  { x: 0, y: 1, label: 'south' }
];
const MAX_PLACEMENT_ATTEMPTS = 8;

function randomFor(seed) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function createNode(id, x, y, depth, branch, parentId = null, shape = STANDARD_PLATFORM) {
  return {
    id,
    x,
    y,
    w: shape.width,
    h: shape.height,
    shape: shape.type,
    angle: shape.angle || 0,
    collisionSections: shape.collisionSections,
    parentId,
    childIds: [],
    distance: 0,
    remainingDepth: depth,
    branch,
    warning: false
  };
}

function platformShape(level, nodeIndex) {
  const shape = choosePlatformShape(randomFor(level * 73 + nodeIndex * 31));
  return shape.type === 'ramp' && randomFor(level * 197 + nodeIndex * 43) > 0.5
    ? { ...shape, angle: -shape.angle }
    : shape;
}

function horizontalGap(level, nodeIndex, attempt) {
  if (attempt < 0) return 40;
  return 36 + randomFor(level * 131 + nodeIndex * 17 + attempt * 997) * 12;
}

function horizontalOffset(parent, childShape, direction, level, nodeIndex, attempt) {
  const width = direction > 0 ? parent.w : childShape.width;
  return width + horizontalGap(level, nodeIndex, attempt);
}

function assignBfsRoutes(nodes, rootId, adjacency) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const queue = [rootId];
  const visited = new Set([rootId]);
  for (const node of nodes) {
    node.routeParentId = null;
    node.routeChildIds = [];
    node.distance = Infinity;
  }
  byId.get(rootId).distance = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const parent = byId.get(queue[index]);
    for (const childId of adjacency.get(parent.id)) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      const child = byId.get(childId);
      child.routeParentId = parent.id;
      child.distance = parent.distance + 1;
      parent.routeChildIds.push(child.id);
      queue.push(childId);
    }
  }

  return { byId, order: queue };
}

function hasClearance(nodes) {
  for (let first = 0; first < nodes.length; first += 1) {
    const a = nodes[first];
    for (let second = first + 1; second < nodes.length; second += 1) {
      const b = nodes[second];
      const gapX = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
      const gapY = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
      if (gapX === 0 && gapY === 0) return `${a.id}/${b.id}:overlap-${gapX},${gapY}`;
      if (Math.hypot(gapX, gapY) < 36) return `${a.id}/${b.id}:clearance-${gapX},${gapY}`;
    }
  }
  return null;
}

function addFloatingSteps(nodes, level) {
  const leaves = nodes.filter(node => node !== nodes[0] && node.childIds.length === 0 && ['narrow', 'standard', 'wide'].includes(node.shape));
  let added = 0;
  for (let index = 0; index < leaves.length; index += 1) {
    if (added >= Math.max(2, Math.floor(level / 2))) break;
    if (index !== 0 && randomFor(level * 211 + index * 97) < 0.55) continue;
    const parent = leaves[index];
    const shape = getPlatformShape('step');
    const direction = parent.branch.routeDirection || parent.branch.x || 1;
    const gap = direction > 0 ? parent.w + 42 : shape.width + 42;
    const step = createNode(
      `${parent.id}-step`,
      parent.x + direction * gap,
      parent.y,
      Math.max(0, parent.remainingDepth - 1),
      parent.branch,
      parent.id,
      shape
    );
    step.optionalStep = true;
    parent.childIds.push(step.id);
    nodes.push(step);
    added += 1;
  }
}

function visitGraph(startId, adjacency) {
  const visited = new Set([startId]);
  const queue = [startId];
  for (let index = 0; index < queue.length; index += 1) {
    for (const nextId of adjacency.get(queue[index])) {
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      queue.push(nextId);
    }
  }
  return visited;
}

function validateGraphRoutes(nodes, root) {
  const adjacency = new Map(nodes.map(node => [node.id, new Set()]));
  for (const node of nodes) {
    if (!node.parentId) continue;
    adjacency.get(node.id).add(node.parentId);
    adjacency.get(node.parentId).add(node.id);
  }
  const reverse = new Map(nodes.map(node => [node.id, new Set()]));
  for (const [sourceId, targets] of adjacency) {
    for (const targetId of targets) reverse.get(targetId).add(sourceId);
  }

  const reachable = visitGraph(root.id, adjacency);
  const canReturn = visitGraph(root.id, reverse);
  const unreachable = nodes.find(node => !reachable.has(node.id));
  if (unreachable || nodes.some(node => !canReturn.has(node.id))) return { failure: 'disconnected graph' };
  return { adjacency };
}

function buildCandidate(level, attempt) {
  const depth = Math.max(3, Math.floor(level) + 2);
  const root = createNode(`L${level}-root`, 0, 470, depth, null, null, STANDARD_PLATFORM);
  const nodes = [root];
  let nextId = 0;

  for (const branch of ROOT_BRANCHES) {
    const firstShape = platformShape(level, nextId);
    const firstX = branch.x > 0
      ? root.x + root.w + 40
      : branch.x < 0
        ? root.x - firstShape.width - 40
        : root.x + (root.w - firstShape.width) / 2;
    const firstY = root.y + branch.y * 82;
    const first = createNode(`L${level}-node-${nextId++}`, firstX, firstY, depth - 1, branch, root.id, firstShape);
    root.childIds.push(first.id);
    nodes.push(first);

    const routes = [0, 1].map(routeIndex => {
      const shape = platformShape(level, nextId);
      const side = routeIndex === 0 ? -1 : 1;
      const offset = horizontalOffset(first, shape, branch.x !== 0 ? branch.x : side, level, nextId, attempt);
      const position = branch.x !== 0
        ? { x: first.x + branch.x * offset, y: first.y + side * 60 }
        : { x: first.x + side * offset, y: first.y + branch.y * 82 };
      const routeDirection = branch.x !== 0 ? branch.x : (routeIndex === 0 ? -1 : 1);
      const route = createNode(`L${level}-node-${nextId++}`, position.x, position.y, depth - 2, { ...branch, routeDirection }, first.id, shape);
      first.childIds.push(route.id);
      nodes.push(route);
      let parent = route;

      while (parent.remainingDepth > 0) {
        const shape = platformShape(level, nextId);
        const step = horizontalOffset(parent, shape, routeDirection, level, nextId, attempt);
        const x = parent.x + routeDirection * step;
        const y = branch.x !== 0 ? parent.y : parent.y + branch.y * 82;
        const continuation = createNode(`L${level}-node-${nextId++}`, x, y, parent.remainingDepth - 1, route.branch, parent.id, shape);
        parent.childIds.push(continuation.id);
        nodes.push(continuation);
        parent = continuation;
      }

      return route;
    });
    if (routes.length !== 2) throw new Error('Each main branch must split into two routes.');
  }
  addFloatingSteps(nodes, level);

  const platforms = nodes;
  const dots = createPlatformDots(platforms, 'normal');

  return { root, nodes, byId: new Map(nodes.map(node => [node.id, node])), platforms, dots, depth, attempt };
}

function finalizeCandidate(candidate, adjacency) {
  const routes = assignBfsRoutes(candidate.nodes, candidate.root.id, adjacency);
  candidate.nodes = routes.order.map(id => routes.byId.get(id));
  candidate.root = routes.byId.get(candidate.root.id);
  candidate.byId = routes.byId;
  candidate.platforms = candidate.nodes;
  candidate.dots = createPlatformDots(candidate.platforms, 'normal');
  return candidate;
}

export function generateFallbackLevel(level) {
  const fallback = buildCandidate(level, -1);
  const clearance = hasClearance(fallback.nodes);
  if (clearance) throw new Error(`Fallback map for level ${level} failed: ${clearance}.`);
  const routeValidation = validateGraphRoutes(fallback.nodes, fallback.root);
  if (routeValidation.failure) throw new Error(`Fallback map for level ${level} failed: ${routeValidation.failure}.`);
  return { ...finalizeCandidate(fallback, routeValidation.adjacency), usedFallback: true };
}

export function generateLevel(level) {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
    const candidate = buildCandidate(level, attempt);
    if (hasClearance(candidate.nodes)) continue;
    const routeValidation = validateGraphRoutes(candidate.nodes, candidate.root);
    if (routeValidation.failure) continue;
    return finalizeCandidate(candidate, routeValidation.adjacency);
  }

  return generateFallbackLevel(level);
}

