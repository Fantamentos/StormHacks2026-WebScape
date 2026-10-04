import { DASHER_FOLLOWUP } from '../modifiers/dasher.js';

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

export function createDasher(platform, x, y, spawnTime, options = {}) {
  return {
    platform,
    x,
    y,
    phase: 'grace',
    phaseEndsAt: spawnTime + SPAWN_GRACE_MS,
    target: null,
    buffedFollowup: options.buffedFollowup ?? false,
    followupTelegraphMs: options.followupTelegraphMs ?? DASHER_FOLLOWUP.telegraphMs,
    dashStart: null,
    dashStartedAt: 0
  };
}

function chooseTarget(player, random) {
  return {
    x: player.x + (random() * 2 - 1) * TARGET_RADIUS_X,
    y: player.y + (random() * 2 - 1) * TARGET_RADIUS_Y
  };
}

function startTelegraph(dasher, player, now, duration, phase, random) {
  dasher.phase = phase;
  dasher.target = chooseTarget(player, random);
  dasher.phaseEndsAt = now + duration;
  return { type: 'telegraph', target: dasher.target, duration, phase };
}

function startDash(dasher, now, phase) {
  dasher.dashStart = { x: dasher.x, y: dasher.y };
  dasher.dashStartedAt = now;
  dasher.phase = phase;
  dasher.phaseEndsAt = now + DASH_MS;
  return { type: 'dash-start', position: dasher.dashStart, target: dasher.target, phase };
}

export function getDasherDashPosition(dasher, now) {
  const elapsed = Math.max(0, Math.min(1, (now - dasher.dashStartedAt) / DASH_MS));
  if (elapsed >= 1) return { x: dasher.target.x, y: dasher.target.y };
  const progress = elapsed <= 0.75
    ? elapsed * (0.78 / 0.75)
    : (() => {
        const finalQuarter = (elapsed - 0.75) / 0.25;
        return 0.78 + 0.26 * finalQuarter + 0.14 * finalQuarter ** 2 - 0.18 * finalQuarter ** 3;
      })();
  return {
    x: dasher.dashStart.x + (dasher.target.x - dasher.dashStart.x) * progress,
    y: dasher.dashStart.y + (dasher.target.y - dasher.dashStart.y) * progress
  };
}

export function advanceDasher(dasher, now, player, random = Math.random) {
  if (now < dasher.phaseEndsAt) {
    if (dasher.phase === 'dash' || dasher.phase === 'followupDash') {
      const position = getDasherDashPosition(dasher, now);
      dasher.x = position.x;
      dasher.y = position.y;
      return { type: 'move', position };
    }
    return null;
  }

  if (dasher.phase === 'grace') {
    return startTelegraph(dasher, player, now, TELEGRAPH_MS, 'telegraph', random);
  }

  if (dasher.phase === 'telegraph') return startDash(dasher, now, 'dash');

  if (dasher.phase === 'dash') {
    dasher.x = dasher.target.x;
    dasher.y = dasher.target.y;
    if (dasher.buffedFollowup) {
      return startTelegraph(dasher, player, now, dasher.followupTelegraphMs, 'followupTelegraph', random);
    }
    return startTelegraph(dasher, player, now, TELEGRAPH_MS, 'telegraph', random);
  }

  if (dasher.phase === 'followupTelegraph') return startDash(dasher, now, 'followupDash');

  if (dasher.phase === 'followupDash') {
      dasher.x = dasher.target.x;
      dasher.y = dasher.target.y;
    return startTelegraph(dasher, player, now, TELEGRAPH_MS, 'telegraph', random);
  }

  return null;
}