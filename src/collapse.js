const WARNING_SECONDS = 2;
const GAP_SECONDS = 4;
const WAVE_FRACTION = 0.2;
const MIN_WAVE_SIZE = 3;

export function startCollapseWaves(state) {
  state.collapse = { timer: GAP_SECONDS, wave: null };
}

function pickWave(state) {
  const activeIds = new Set(state.platforms.map(platform => platform.id));
  const candidates = state.platforms.filter(platform => platform !== state.exitPlatform && platform.childIds.every(childId => !activeIds.has(childId)));
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.distance - a.distance);
  return candidates.slice(0, Math.max(MIN_WAVE_SIZE, Math.ceil(candidates.length * WAVE_FRACTION)));
}

export function updateCollapse(state, dt) {
  const collapse = state.collapse;
  if (!collapse) return;
  collapse.timer -= dt;
  if (collapse.timer > 0) return;

  if (!collapse.wave) {
    collapse.wave = pickWave(state);
    if (!collapse.wave) return;
    for (const platform of collapse.wave) platform.warning = true;
    collapse.timer = WARNING_SECONDS;
    return;
  }

  const gone = new Set(collapse.wave);
  state.platforms = state.platforms.filter(platform => !gone.has(platform));
  state.dots = state.dots.filter(dot => !gone.has(dot.platform));
  collapse.wave = null;
  collapse.timer = GAP_SECONDS;
}
