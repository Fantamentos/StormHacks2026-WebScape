export const SENTINEL_SPAWN_GRACE_MS = 2000;
export const SENTINEL_TELEGRAPH_MS = 1000;
export const SENTINEL_DASH_MS = 1000;
export const SENTINEL_SHOT_INTERVAL_MS = 3000;
export const SENTINEL_BULLET_SPEED = 240;
export const SENTINEL_BULLET_RADIUS = 4;
export const SENTINEL_TARGET_RADIUS = 120;
export const SENTINEL_DASH_DISTANCE = 180;

function chooseEvasiveTarget(sentinel, player, random) {
  const awayAngle = Math.atan2(sentinel.y - player.y, sentinel.x - player.x);
  const angle = awayAngle + (random() * 2 - 1) * 0.5;
  return {
    x: sentinel.x + Math.cos(angle) * SENTINEL_DASH_DISTANCE,
    y: sentinel.y + Math.sin(angle) * SENTINEL_DASH_DISTANCE
  };
}

function chooseBulletTarget(player, random) {
  const choice = Math.floor(random() * 7);
  if (choice === 0) return { x: player.x, y: player.y };
  const angle = (choice - 1) * Math.PI / 3;
  return {
    x: player.x + Math.cos(angle) * SENTINEL_TARGET_RADIUS,
    y: player.y + Math.sin(angle) * SENTINEL_TARGET_RADIUS
  };
}

export function createSentinelBullet(origin, player, random = Math.random, options = {}) {
  const target = chooseBulletTarget(player, random);
  const deltaX = target.x - origin.x;
  const deltaY = target.y - origin.y;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const speed = options.speed ?? SENTINEL_BULLET_SPEED;
  return {
    x: origin.x,
    y: origin.y,
    target,
    speed,
    vx: deltaX / distance * speed,
    vy: deltaY / distance * speed,
    radius: SENTINEL_BULLET_RADIUS
  };
}

export function advanceSentinelBullet(bullet, deltaMs) {
  const distance = Math.hypot(bullet.target.x - bullet.x, bullet.target.y - bullet.y);
  const travel = bullet.speed * deltaMs / 1000;
  if (travel >= distance) {
    bullet.x = bullet.target.x;
    bullet.y = bullet.target.y;
    return false;
  }
  bullet.x += bullet.vx * deltaMs / 1000;
  bullet.y += bullet.vy * deltaMs / 1000;
  return true;
}

export function createSentinel(platform, x, y, startTime, options = {}) {
  return {
    platform,
    x,
    y,
    phase: 'grace',
    phaseEndsAt: startTime + SENTINEL_SPAWN_GRACE_MS,
    target: null,
    dashStart: null,
    dashStartedAt: null,
    nextShotAt: startTime + SENTINEL_SHOT_INTERVAL_MS,
    extraBullets: options.extraBullets ?? 0
  };
}

function getDashPosition(sentinel, time) {
  const progress = Math.max(0, Math.min(1, (time - sentinel.dashStartedAt) / SENTINEL_DASH_MS));
  return {
    x: sentinel.dashStart.x + (sentinel.target.x - sentinel.dashStart.x) * progress,
    y: sentinel.dashStart.y + (sentinel.target.y - sentinel.dashStart.y) * progress
  };
}

export function advanceSentinel(sentinel, time, player, random = Math.random) {
  if (sentinel.phase === 'grace' && time >= sentinel.phaseEndsAt) {
    sentinel.phase = 'telegraph';
    sentinel.target = chooseEvasiveTarget(sentinel, player, random);
    sentinel.phaseEndsAt += SENTINEL_TELEGRAPH_MS;
  } else if (sentinel.phase === 'telegraph' && time >= sentinel.phaseEndsAt) {
    sentinel.phase = 'dash';
    sentinel.dashStart = { x: sentinel.x, y: sentinel.y };
    sentinel.dashStartedAt = sentinel.phaseEndsAt;
    sentinel.phaseEndsAt += SENTINEL_DASH_MS;
  } else if (sentinel.phase === 'dash') {
    if (time >= sentinel.phaseEndsAt) {
      sentinel.x = sentinel.target.x;
      sentinel.y = sentinel.target.y;
      sentinel.phase = 'telegraph';
      sentinel.target = chooseEvasiveTarget(sentinel, player, random);
      sentinel.dashStart = null;
      sentinel.dashStartedAt = null;
      sentinel.phaseEndsAt += SENTINEL_TELEGRAPH_MS;
    } else {
      const position = getDashPosition(sentinel, time);
      sentinel.x = position.x;
      sentinel.y = position.y;
    }
  }

  const bullets = [];
  if (time >= sentinel.nextShotAt) {
    for (let index = 0; index <= sentinel.extraBullets; index += 1) {
      bullets.push(createSentinelBullet(sentinel, player, random));
    }
    sentinel.nextShotAt = time + SENTINEL_SHOT_INTERVAL_MS;
  }

  return {
    position: { x: sentinel.x, y: sentinel.y },
    phase: sentinel.phase,
    target: sentinel.target,
    bullets
  };
}