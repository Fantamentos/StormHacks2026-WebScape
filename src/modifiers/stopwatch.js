export const STOPWATCH_REVERSE_TICKING = Object.freeze({
  id: 'stopwatch-reverse-ticking',
  name: 'Reverse Ticking',
  description: 'Count up to 12; stay still for the final second to avoid damage.',
  reverseTicking: true
});

export function getStopwatchModifierOptions(modifierIds) {
  return modifierIds.includes(STOPWATCH_REVERSE_TICKING.id)
    ? { reverseTicking: STOPWATCH_REVERSE_TICKING.reverseTicking }
    : {};
}