export const DOPPELGANGER_CAP_FIVE = Object.freeze({
  id: 'doppelganger-cap-five',
  name: 'More Copies',
  description: 'Raise the active Doppelganger limit from three to five.',
  maxCount: 5
});

export const DOPPELGANGER_FAST_FOLLOW = Object.freeze({
  id: 'doppelganger-fast-follow',
  name: 'Rapid Echoes',
  description: 'Reduce the delay between Doppelgangers from two seconds to one.',
  delayMs: 1000
});

export function getDoppelgangerModifierOptions(modifierIds) {
  const options = {};
  if (modifierIds.includes(DOPPELGANGER_CAP_FIVE.id)) options.maxCount = DOPPELGANGER_CAP_FIVE.maxCount;
  if (modifierIds.includes(DOPPELGANGER_FAST_FOLLOW.id)) options.delayMs = DOPPELGANGER_FAST_FOLLOW.delayMs;
  return options;
}