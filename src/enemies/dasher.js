export const SPAWN_GRACE_MS = 2000;
export const TELEGRAPH_MS = 1000;
export const DASH_MS = 1000;
const TARGET_RADIUS_X = 48;
const TARGET_RADIUS_Y = 24;
const MIN_SPAWN_DISTANCE = 220;
const SPAWN_AREA_RADIUS = 60;

export function chooseDasherSpawn(platforms, player, random = Math.random) {
  if (!platforms.length) return null;
  const safePlatforms = platforms.filter(platform => {
    const centerX = platform.x + platform.w / 2;
    const centerY = platform.y + platform.h / 2;
    return Math.hypot(centerX - player.x, centerY - player.y) >= MIN_SPAWN_DISTANCE;
  });
  if (!safePlatforms.length) return null;

  const outerDistance = Math.max(...safePlatforms.map(platform => platform.distance));
  const outermost = safePlatforms.filter(platform => platform.distance === outerDistance);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const platformIndex = Math.min(outermost.length - 1, Math.floor(random() * outermost.length));
    const platform = outermost[platformIndex];
    const angle = random() * Math.PI * 2;
    const radius = 20 + random() * SPAWN_AREA_RADIUS;
    const x = platform.x + platform.w / 2 + Math.cos(angle) * radius;
    const y = platform.y + platform.h / 2 + Math.sin(angle) * radius;
    if (Math.hypot(x - player.x, y - player.y) >= MIN_SPAWN_DISTANCE) return { platform, x, y };
  }

  return null;
}

export function createDasher(platform, x, y, spawnTime) {
  return {
    platform,
    x,
    y,
    phase: 'grace',
    phaseEndsAt: spawnTime + SPAWN_GRACE_MS,
    target: null
  };
}

function chooseTarget(player, random) {
  return {
    x: player.x + (random() * 2 - 1) * TARGET_RADIUS_X,
    y: player.y + (random() * 2 - 1) * TARGET_RADIUS_Y
  };
}

export function advanceDasher(dasher, now, player, random = Math.random) {
  if (now < dasher.phaseEndsAt) return null;

  if (dasher.phase === 'grace' || dasher.phase === 'dash') {
    if (dasher.phase === 'dash') {
      dasher.x = dasher.target.x;
      dasher.y = dasher.target.y;
    }
    dasher.phase = 'telegraph';
    dasher.target = chooseTarget(player, random);
    dasher.phaseEndsAt = now + TELEGRAPH_MS;
    return { type: 'telegraph', target: dasher.target };
  }

  if (dasher.phase === 'telegraph') {
    const velocity = {
      x: (dasher.target.x - dasher.x) / 60,
      y: (dasher.target.y - dasher.y) / 60
    };
    dasher.phase = 'dash';
    dasher.phaseEndsAt = now + DASH_MS;
    return { type: 'dash', velocity, target: dasher.target };
  }

  return null;
}