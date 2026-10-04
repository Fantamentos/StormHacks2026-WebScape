const ROOT_BRANCHES = [
  { x: 1, y: 0, label: 'east', rootOffset: { x: 164, y: 0 } },
  { x: -1, y: 0, label: 'west', rootOffset: { x: -164, y: 0 } },
  { x: 0, y: -1, label: 'north', rootOffset: { x: 82, y: -82 } },
  { x: 0, y: 1, label: 'south', rootOffset: { x: -82, y: 82 } }
];
const MAX_PLACEMENT_ATTEMPTS = 8;
const PLATFORM_WIDTH = 124;

function randomFor(seed) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function createNode(id, x, y, depth, branch, parentId = null) {
  return {
    id,
    x,
    y,
    w: 124,
    h: 14,
    parentId,
    childIds: [],
    distance: 0,
    remainingDepth: depth,
    branch,
    warning: false
  };
}

function horizontalStep(level, nodeIndex, attempt) {
  if (attempt < 0) return PLATFORM_WIDTH + 40;
  return PLATFORM_WIDTH + 36 + randomFor(level * 131 + nodeIndex * 17 + attempt * 997) * 12;
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
      if (gapX === 0 && gapY === 0) return `${a.id}/${b.id}:overlap`;
      if (Math.hypot(gapX, gapY) < 36) return `${a.id}/${b.id}:clearance-${Math.hypot(gapX, gapY).toFixed(1)}`;
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
  const root = createNode(`L${level}-root`, 0, 470, depth, null);
  const nodes = [root];
  let nextId = 0;

  for (const branch of ROOT_BRANCHES) {
    const firstPosition = { x: root.x + branch.rootOffset.x, y: root.y + branch.rootOffset.y };
    const first = createNode(`L${level}-node-${nextId++}`, firstPosition.x, firstPosition.y, depth - 1, branch, root.id);
    root.childIds.push(first.id);
    nodes.push(first);

    const forkStep = horizontalStep(level, nextId, attempt);
    const forkPositions = branch.x !== 0
      ? [
          { x: first.x + branch.x * forkStep, y: first.y - 42 },
          { x: first.x + branch.x * 82, y: first.y + 50 }
        ]
      : [-1, 1].map(side => ({ x: first.x + side * 164, y: first.y + branch.y * 82 }));
    const routes = forkPositions.map((position, routeIndex) => {
      const routeDirection = branch.x !== 0 ? branch.x : (routeIndex === 0 ? -1 : 1);
      const route = createNode(`L${level}-node-${nextId++}`, position.x, position.y, depth - 2, { ...branch, routeDirection }, first.id);
      first.childIds.push(route.id);
      nodes.push(route);
      let parent = route;

      while (parent.remainingDepth > 0) {
        const step = horizontalStep(level, nextId, attempt);
        const x = branch.x !== 0 ? parent.x + branch.x * step : parent.x + routeDirection * step;
        const y = branch.x !== 0 ? parent.y : parent.y + branch.y * 82;
        const continuation = createNode(`L${level}-node-${nextId++}`, x, y, parent.remainingDepth - 1, route.branch, parent.id);
        parent.childIds.push(continuation.id);
        nodes.push(continuation);
        parent = continuation;
      }

      return route;
    });
    if (routes.length !== 2) throw new Error('Each main branch must split into two routes.');
  }

  const platforms = nodes;
  const dots = nodes
    .filter(node => node !== root)
    .slice(0, 10)
    .map(node => ({
      x: node.x + node.w / 2,
      y: node.y - 28,
      type: 'normal',
      taken: false,
      platform: node,
      nodeId: node.id
    }));

  return { root, nodes, byId: new Map(nodes.map(node => [node.id, node])), platforms, dots, depth, attempt };
}

function finalizeCandidate(candidate, adjacency) {
  const routes = assignBfsRoutes(candidate.nodes, candidate.root.id, adjacency);
  candidate.nodes = routes.order.map(id => routes.byId.get(id));
  candidate.root = routes.byId.get(candidate.root.id);
  candidate.byId = routes.byId;
  candidate.platforms = candidate.nodes;
  candidate.dots = candidate.nodes.filter(node => node !== candidate.root).slice(0, 10).map(node => ({
    x: node.x + node.w / 2,
    y: node.y - 28,
    type: 'normal',
    taken: false,
    platform: node,
    nodeId: node.id
  }));
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

