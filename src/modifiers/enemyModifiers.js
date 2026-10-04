export const ENEMY_MODIFIER_IDS = Object.freeze({
  DASHER_FOLLOWUP: 'dasher-followup',
  DOPPELGANGER_CAP_FIVE: 'doppelganger-cap-five'
});

export const DOPPELGANGER_BUFFED_MAX_COUNT = 5;

export function getDasherModifierOptions(modifiers) {
  return { buffedFollowup: modifiers.includes(ENEMY_MODIFIER_IDS.DASHER_FOLLOWUP) };
}

export function getDoppelgangerModifierOptions(modifiers) {
  return modifiers.includes(ENEMY_MODIFIER_IDS.DOPPELGANGER_CAP_FIVE)
    ? { maxCount: DOPPELGANGER_BUFFED_MAX_COUNT }
    : {};
}
