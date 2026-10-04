export const DASHER_FOLLOWUP = Object.freeze({
  id: 'dasher-followup',
  name: 'Afterimage',
  description: 'Add a 250 ms follow-up telegraph and dash after each normal attack.',
  telegraphMs: 250
});

export function getDasherModifierOptions(modifierIds) {
  const buffedFollowup = modifierIds.includes(DASHER_FOLLOWUP.id);
  return buffedFollowup
    ? { buffedFollowup, followupTelegraphMs: DASHER_FOLLOWUP.telegraphMs }
    : { buffedFollowup };
}