export const upgrades = [
  { key: 'doubleJump', title: 'DOUBLE AIR JUMP', detail: 'Two air jumps per airtime', cost: 8 },
  { key: 'dash', title: 'DASH', detail: 'Shift for a burst of speed', cost: 6 },
  { key: 'slowZone', title: 'SLOW THE RISE', detail: 'Death zone climbs 25% slower', cost: 10 },
  { key: 'compass', title: 'DOT COMPASS', detail: 'Arrow points to nearest dot', cost: 5 }
];

export function createOwnedUpgrades() {
  return { doubleJump: false, dash: false, slowZone: false, compass: false };
}

export function purchaseUpgrade(state, index) {
  const upgrade = upgrades[index];
  if (!upgrade || state.mode !== 'shop' || state.owned[upgrade.key] || state.credits < upgrade.cost) return;

  state.credits -= upgrade.cost;
  state.owned[upgrade.key] = true;
  state.syncHud();
}