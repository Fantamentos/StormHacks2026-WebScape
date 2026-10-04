const DOTS_PER_PLATFORM = 3;
const PICKUP_RADIUS = 24;

export function createPlatformDots(platforms, type) {
  return platforms.flatMap(platform => Array.from({ length: DOTS_PER_PLATFORM }, (_, index) => ({
    id: `${platform.id}:${type}:${index}`,
    x: platform.x + platform.w * (index + 1) / (DOTS_PER_PLATFORM + 1),
    y: platform.y - 28,
    type,
    taken: false,
    platform,
    platformId: platform.id
  })));
}

export function collectNearbyDots(player, dots) {
  const collected = [];
  const playerX = player.x + player.w / 2;
  const playerY = player.y + player.h / 2;

  for (const dot of dots) {
    if (dot.taken) continue;
    const dx = playerX - dot.x;
    const dy = playerY - dot.y;
    if (dx * dx + dy * dy >= PICKUP_RADIUS * PICKUP_RADIUS) continue;
    dot.taken = true;
    collected.push(dot);
  }

  return collected;
}

export function nearestUncollectedDot(player, dots) {
  let nearest = null;
  let nearestDistance = Infinity;
  const playerX = player.x + player.w / 2;
  const playerY = player.y + player.h / 2;

  for (const dot of dots) {
    if (dot.taken) continue;
    const dx = playerX - dot.x;
    const dy = playerY - dot.y;
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearest = dot;
      nearestDistance = distance;
    }
  }

  return nearest;
}