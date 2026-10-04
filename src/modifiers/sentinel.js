export const SENTINEL_DOUBLE_SHOT = Object.freeze({
  id: 'sentinel-double-shot',
  name: 'Split Volley',
  description: 'Fire one additional bullet in each Sentinel volley.',
  extraBullets: 1
});

export function getSentinelModifierOptions(modifierIds) {
  return modifierIds.includes(SENTINEL_DOUBLE_SHOT.id)
    ? { extraBullets: SENTINEL_DOUBLE_SHOT.extraBullets }
    : {};
}