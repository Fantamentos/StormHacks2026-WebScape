const ROOT_BRANCHES = [
  { x: 1, y: 0, label: 'east', rootOffset: { x: 142, y: -42 } },
  { x: -1, y: 0, label: 'west', rootOffset: { x: -142, y: -42 } },
  { x: 0, y: -1, label: 'north', rootOffset: { x: -54, y: -82 } },
  { x: 0, y: 1, label: 'south', rootOffset: { x: 54, y: 82 } }
];

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

function getTrunkPosition(parent, branch) {
  if (branch.x !== 0) return { x: parent.x + branch.x * 142, y: parent.y };
  return { x: parent.x, y: parent.y + branch.y * 82 };
}

function getSidePosition(parent, branch) {
  if (branch.x !== 0) return { x: parent.x + branch.x * 76, y: parent.y + 46 };
  return { x: parent.x + 60, y: parent.y + branch.y * 44 };
}

function assignBfsRoutes(nodes, rootId) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const queue = [rootId];
  const visited = new Set([rootId]);
  byId.get(rootId).distance = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const parent = byId.get(queue[index]);
    for (const childId of parent.childIds) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      const child = byId.get(childId);
      child.parentId = parent.id;
      child.distance = parent.distance + 1;
      queue.push(childId);
    }
  }

  return { byId, order: queue };
}

export function generateLevel(level) {
  const depth = Math.max(3, Math.floor(level) + 2);
  const root = createNode(`L${level}-root`, 0, 470, depth, null);
  const nodes = [root];
  let nextId = 0;

  for (const branch of ROOT_BRANCHES) {
    const position = { x: root.x + branch.rootOffset.x, y: root.y + branch.rootOffset.y };
    const child = createNode(`L${level}-node-${nextId++}`, position.x, position.y, depth - 1, branch, root.id);
    root.childIds.push(child.id);
    nodes.push(child);
    let trunk = child;
    while (trunk.remainingDepth > 0) {
      const remainingDepth = trunk.remainingDepth - 1;
      const trunkPosition = getTrunkPosition(trunk, branch);
      const continuation = createNode(`L${level}-node-${nextId++}`, trunkPosition.x, trunkPosition.y, remainingDepth, branch, trunk.id);
      trunk.childIds.push(continuation.id);
      nodes.push(continuation);

      const seed = nextId + level * 17;
      if (remainingDepth > 0 && randomFor(seed) > 0.52) {
        const sidePosition = getSidePosition(trunk, branch);
        const side = createNode(`L${level}-node-${nextId++}`, sidePosition.x, sidePosition.y, 0, branch, trunk.id);
        trunk.childIds.push(side.id);
        nodes.push(side);
      }
      trunk = continuation;
    }
  }

  const routes = assignBfsRoutes(nodes, root.id);
  const orderedNodes = routes.order.map(id => routes.byId.get(id));
  const platforms = orderedNodes.map(node => node);
  const dots = orderedNodes
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

  return { root, nodes: orderedNodes, byId: routes.byId, platforms, dots, depth };
}

