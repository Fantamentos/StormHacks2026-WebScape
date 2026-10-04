export const STOPWATCH_FIRST_SPAWN_MIN_MS = 7000;
export const STOPWATCH_FIRST_SPAWN_MAX_MS = 10000;
export const STOPWATCH_COUNTDOWN_MS = 12000;
export const STOPWATCH_IDLE_REQUIRED_MS = 200;

function randomCooldown(random) {
  const range = STOPWATCH_FIRST_SPAWN_MAX_MS - STOPWATCH_FIRST_SPAWN_MIN_MS + 1;
  return STOPWATCH_FIRST_SPAWN_MIN_MS + Math.floor(random() * range);
}

function resetStopwatch(stopwatch, time, random) {
  stopwatch.active = false;
  stopwatch.startedAt = null;
  stopwatch.expiresAt = null;
  stopwatch.idleSince = null;
  stopwatch.nextSpawnAt = time + randomCooldown(random);
}

export function createStopwatch(startTime, options = {}, random = Math.random) {
  return {
    reverseTicking: options.reverseTicking ?? false,
    active: false,
    startedAt: null,
    expiresAt: null,
    idleSince: null,
    nextSpawnAt: startTime + randomCooldown(random)
  };
}

export function getStopwatchDisplay(stopwatch, time) {
  if (!stopwatch.active) return null;
  const elapsed = Math.max(0, time - stopwatch.startedAt);
  const remaining = Math.max(0, stopwatch.expiresAt - time);
  if (stopwatch.reverseTicking) {
    return {
      seconds: Math.min(12, Math.floor(elapsed / 1000) + 1),
      finalSecond: remaining <= 1000
    };
  }
  return {
    seconds: Math.ceil(remaining / 1000),
    finalSecond: remaining <= 1000
  };
}

export function advanceStopwatch(stopwatch, time, hasInput, random = Math.random) {
  if (!stopwatch.active) {
    if (time < stopwatch.nextSpawnAt) return null;
    stopwatch.active = true;
    stopwatch.startedAt = time;
    stopwatch.expiresAt = time + STOPWATCH_COUNTDOWN_MS;
    stopwatch.idleSince = hasInput ? null : time;
    return { type: 'spawn' };
  }

  if (stopwatch.reverseTicking) {
    if (time >= stopwatch.expiresAt - 1000 && hasInput) {
      resetStopwatch(stopwatch, time, random);
      return { type: 'damage' };
    }
    if (time >= stopwatch.expiresAt) {
      resetStopwatch(stopwatch, time, random);
      return { type: 'evaded' };
    }
    return null;
  }

  stopwatch.idleSince = hasInput ? null : (stopwatch.idleSince ?? time);
  if (time < stopwatch.expiresAt) return null;

  const evaded = stopwatch.idleSince !== null
    && stopwatch.idleSince <= stopwatch.expiresAt - STOPWATCH_IDLE_REQUIRED_MS;
  resetStopwatch(stopwatch, time, random);
  return { type: evaded ? 'evaded' : 'damage' };
}