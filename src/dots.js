const DOTS_PER_PLATFORM = 3;
const PICKUP_RADIUS = 24;

export function createPlatformDots(platforms, type) {
  return platforms.flatMap(platform => {
    const surfaces = platform.collisionSections || [{ x: 0, y: 0, width: platform.w }];
    return Array.from({ length: DOTS_PER_PLATFORM }, (_, index) => {
      const surfaceIndex = index % surfaces.length;
      const surface = surfaces[surfaceIndex];
      const surfaceDotIndex = Math.floor(index / surfaces.length);
      const surfaceDotCount = Math.ceil((DOTS_PER_PLATFORM - surfaceIndex) / surfaces.length);
      const fraction = (surfaceDotIndex + 1) / (surfaceDotCount + 1);
      const x = platform.x + surface.x + surface.width * fraction;
      const centerX = platform.x + platform.w / 2;
      const centerY = platform.y + platform.h / 2;
      const y = platform.angle
        ? centerY + Math.sin(platform.angle) * (x - centerX) - Math.cos(platform.angle) * platform.h / 2 - 28
        : platform.y + surface.y - 28;
      return {
        id: `${platform.id}:${type}:${index}`,
        x,
        y,
        type,
        taken: false,
        platform,
        platformId: platform.id
      };
    });
  });
}

export function rewardDot(state, dot) {
  if (dot.taken) return false;
  dot.taken = true;
  if (dot.type === 'currency') {
    state.credits += 1;
    state.currencyCollected += 1;
  } else state.normalCollected += 1;
  return true;
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