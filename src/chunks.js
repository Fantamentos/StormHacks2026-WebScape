export const CHUNK_WIDTH = 480;
export const CHUNK_HEIGHT = 80;

function chunkRandom(cx, salt) {
  const value = Math.sin(cx * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function createChunk(state, cx, cy, spawn) {
  const key = `${cx},${cy}`;
  const generated = [];
  for (let index = 0; index < 3; index += 1) {
    const x = cx * CHUNK_WIDTH + 28 + index * 154;
    const wobble = chunkRandom(cx + cy * 31, index) * 20 - 10;
    const y = cy * CHUNK_HEIGHT + 48 + wobble;
    const platform = { x, y, w: 128 + chunkRandom(cx, index + cy) * 28, h: 14, chunk: key };
    generated.push(platform);

    if (spawn && state.normalSpawned < 10 && cx >= spawn.x && cx <= spawn.x + 2 && cy >= spawn.y - 2 && cy <= spawn.y + 2 && (index !== 1 || chunkRandom(cx + cy, 7) > 0.25)) {
      state.dots.push({ x: x + platform.w * (0.28 + chunkRandom(cx, index + cy + 4) * 0.45), y: y - 28, type: 'normal', taken: false, chunk: key });
      state.normalSpawned += 1;
    }

    if (index === 1 && chunkRandom(cx + cy, 13) > 0.35) {
      generated.push({ x: x + 12, y: y - 54, w: 92, h: 12, chunk: key });
    }
  }

  state.chunks.set(key, generated);
  state.platforms.push(...generated);
}

// Loads every chunk in the inclusive range without spawning dots or unloading anything.
export function loadChunkArea(state, minCx, maxCx, minCy, maxCy) {
  for (let cx = minCx; cx <= maxCx; cx += 1) {
    for (let cy = minCy; cy <= maxCy; cy += 1) {
      if (!state.chunks.has(`${cx},${cy}`)) createChunk(state, cx, cy, null);
    }
  }
}

export function ensureChunks(state) {
  const centerX = Math.floor(state.player.x / CHUNK_WIDTH);
  const centerY = Math.floor(state.player.y / CHUNK_HEIGHT);

  for (let cx = centerX - 3; cx <= centerX + 4; cx += 1) {
    for (let cy = centerY - 3; cy <= centerY + 3; cy += 1) {
      if (!state.chunks.has(`${cx},${cy}`)) createChunk(state, cx, cy, { x: centerX, y: centerY });
    }
  }

  for (const [key] of state.chunks) {
    const [cx, cy] = key.split(',').map(Number);
    if (Math.abs(cx - centerX) <= 5 && Math.abs(cy - centerY) <= 4) continue;

    state.chunks.delete(key);
    for (let index = state.platforms.length - 1; index >= 0; index -= 1) {
      if (state.platforms[index].chunk === key) state.platforms.splice(index, 1);
    }
    state.normalSpawned -= state.dots.filter(dot => dot.chunk === key && dot.type === 'normal' && !dot.taken).length;
    state.dots = state.dots.filter(dot => dot.chunk !== key || dot.taken);
  }
}
