import { createPlatformDots } from './dots.js';
import { choosePlatformShape, STANDARD_PLATFORM } from './platforms/index.js';

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
    parentId,
    childIds: [],
    distance: 0,
    remainingDepth: depth,
    branch,
    warning: false
  };
}

function platformShape(level, nodeIndex) {
  return choosePlatformShape(randomFor(level * 73 + nodeIndex * 31));
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

function simulateLandings(source, platforms) {
  const playerWidth = 25;
  const playerHeight = 34;
  const speed = 225;
  const gravity = 1120;
  const dt = 1 / 60;
  const launchOffsets = [12, (source.w - playerWidth) / 2, source.w - playerWidth - 12];
  const nearby = platforms.filter(platform => {
    const horizontalRange = speed * 1.15 + source.w;
    return platform.x + platform.w > source.x - horizontalRange
      && platform.x < source.x + source.w + horizontalRange
      && platform.y > source.y - 110
      && platform.y < source.y + 650;
  });
  const landings = new Set();

  for (const launchOffset of launchOffsets) {
    for (const jump of [true, false]) {
      for (const direction of [-1, 0, 1]) {
        for (let holdFrames = 0; holdFrames <= 60; holdFrames += 3) {
          let x = source.x + launchOffset;
          let y = source.y - playerHeight;
          let velocityY = jump ? -470 : 0;
          let grounded = !jump;

          for (let frame = 0; frame < 90; frame += 1) {
            const previousBottom = y + playerHeight;
            x += frame < holdFrames ? direction * speed * dt : 0;
            if (grounded && x + playerWidth > source.x && x < source.x + source.w) {
              y = source.y - playerHeight;
              velocityY = 0;
              continue;
            }

            grounded = false;
            velocityY += gravity * dt;
            y += velocityY * dt;
            let landed = null;
            for (const platform of nearby) {
              const crossedTop = y + playerHeight >= platform.y && previousBottom <= platform.y;
              const overlaps = x + playerWidth > platform.x && x < platform.x + platform.w;
              if (velocityY >= 0 && crossedTop && overlaps && (!landed || platform.y < landed.y)) landed = platform;
            }
            if (landed) {
              if (landed.id !== source.id) landings.add(landed.id);
              else {
                y = source.y - playerHeight;
                velocityY = 0;
                grounded = true;
              }
            }
            if (landed && landed.id !== source.id) break;
            if (y > source.y - playerHeight + 650) break;
          }
        }
      }
    }
  }
  return landings;
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

function physicalGraph(nodes) {
  return new Map(nodes.map(node => [node.id, simulateLandings(node, nodes)]));
}

function validatePhysicsRoutes(nodes, root) {
  const adjacency = physicalGraph(nodes);
  const reverse = new Map(nodes.map(node => [node.id, new Set()]));
  for (const [sourceId, targets] of adjacency) {
    for (const targetId of targets) reverse.get(targetId).add(sourceId);
  }

  const reachable = visitGraph(root.id, adjacency);
  const canReturn = visitGraph(root.id, reverse);
  const unreachable = nodes.find(node => !reachable.has(node.id));
  if (unreachable) return { failure: `${unreachable.id}:not-reachable` };
  const stranded = nodes.find(node => !canReturn.has(node.id));
  if (stranded) return { failure: `${stranded.id}:no-route-home` };
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
  const routeValidation = validatePhysicsRoutes(fallback.nodes, fallback.root);
  if (routeValidation.failure) throw new Error(`Fallback map for level ${level} failed: ${routeValidation.failure}.`);
  return { ...finalizeCandidate(fallback, routeValidation.adjacency), usedFallback: true };
}

export function generateLevel(level) {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
    const candidate = buildCandidate(level, attempt);
    if (hasClearance(candidate.nodes)) continue;
    const routeValidation = validatePhysicsRoutes(candidate.nodes, candidate.root);
    if (routeValidation.failure) continue;
    return finalizeCandidate(candidate, routeValidation.adjacency);
  }

  return generateFallbackLevel(level);
}

