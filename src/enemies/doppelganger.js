export const DOPPELGANGER_SPAWN_DELAY_MS = 2000;
export const DOPPELGANGER_FOLLOW_DELAY_MS = 2000;
export const DOPPELGANGER_MAX_COUNT = 3;

function appendPosition(history, time, position) {
  const sample = { time, x: position.x, y: position.y };
  const last = history.at(-1);
  if (last && last.time === time) history[history.length - 1] = sample;
  else history.push(sample);

  const cutoff = time - DOPPELGANGER_FOLLOW_DELAY_MS * (DOPPELGANGER_MAX_COUNT + 2);
  while (history.length > 2 && history[1].time < cutoff) history.shift();
}

export function samplePosition(history, time) {
  if (!history.length) return null;
  if (time <= history[0].time) return { x: history[0].x, y: history[0].y };
  for (let index = 1; index < history.length; index += 1) {
    const next = history[index];
    if (time > next.time) continue;
    const previous = history[index - 1];
    const span = next.time - previous.time;
    const fraction = span > 0 ? (time - previous.time) / span : 1;
    return {
      x: previous.x + (next.x - previous.x) * fraction,
      y: previous.y + (next.y - previous.y) * fraction
    };
  }
  const last = history.at(-1);
  return { x: last.x, y: last.y };
}

export function createDoppelgangerRun(startTime, playerPosition, options = {}) {
  const delayMs = options.delayMs ?? DOPPELGANGER_FOLLOW_DELAY_MS;
  const maxCount = options.maxCount ?? DOPPELGANGER_MAX_COUNT;
  return {
    delayMs,
    maxCount,
    nextSpawnAt: startTime + DOPPELGANGER_SPAWN_DELAY_MS,
    playerHistory: [{ time: startTime, x: playerPosition.x, y: playerPosition.y }],
    copies: []
  };
}

export function advanceDoppelgangerRun(run, time, playerPosition) {
  appendPosition(run.playerHistory, time, playerPosition);

  if (time >= run.nextSpawnAt && run.copies.length < run.maxCount) {
    const followed = run.copies.at(-1)?.history || run.playerHistory;
    const spawnPosition = samplePosition(followed, time - run.delayMs);
    run.copies.push({
      id: run.copies.length,
      x: spawnPosition.x,
      y: spawnPosition.y,
      history: [{ time, x: spawnPosition.x, y: spawnPosition.y }]
    });
    run.nextSpawnAt += run.delayMs;
  }

  for (let index = 0; index < run.copies.length; index += 1) {
    const copy = run.copies[index];
    const followed = index === 0 ? run.playerHistory : run.copies[index - 1].history;
    const position = samplePosition(followed, time - run.delayMs);
    copy.x = position.x;
    copy.y = position.y;
    appendPosition(copy.history, time, position);
  }

  return run.copies;
}