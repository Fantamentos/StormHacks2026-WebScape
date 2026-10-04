export const SPEED_RING_MAX_PURCHASES = 3;
export const SPEED_RING_BASE_COST = 5;
export const SPEED_RING_COST_INCREMENT = 5;
export const SPEED_RING_MOVEMENT_BONUS = 0.1;

export const upgrades = [
  { key: 'doubleJump', title: 'DOUBLE AIR JUMP', detail: 'Two air jumps per airtime', cost: 8 },
  { key: 'speedRings', title: 'SPEED RING', detail: 'Each ring adds 10% movement speed; stacks up to three', cost: SPEED_RING_BASE_COST, maxPurchases: SPEED_RING_MAX_PURCHASES },
  { key: 'voidShield', title: 'VOID SHIELD', detail: 'Rescue one fall and return above the highest platform', cost: 12 },
  { key: 'dash', title: 'DASH', detail: 'Shift for a burst of speed', cost: 6 },
  { key: 'slowZone', title: 'SLOW THE RISE', detail: 'Death zone climbs 25% slower', cost: 10 },
  { key: 'compass', title: 'DOT COMPASS', detail: 'Arrow points to nearest dot', cost: 5 }
];

export function createOwnedUpgrades() {
  return { doubleJump: false, speedRings: 0, voidShield: false, dash: false, slowZone: false, compass: false };
}

export function getUpgradeCost(state, upgrade) {
  if (upgrade.key !== 'speedRings') return upgrade.cost;
  return SPEED_RING_BASE_COST + state.owned.speedRings * SPEED_RING_COST_INCREMENT;
}

export function getRunSpeedMultiplier(state) {
  return 1 + state.owned.speedRings * SPEED_RING_MOVEMENT_BONUS;
}

export function getUpgradePurchaseInfo(state, upgrade) {
  const count = typeof state.owned[upgrade.key] === 'number'
    ? state.owned[upgrade.key]
    : Number(Boolean(state.owned[upgrade.key]));
  const soldOut = upgrade.maxPurchases ? count >= upgrade.maxPurchases : count > 0;
  const spent = upgrade.key === 'voidShield' && state.voidShieldUsed;
  return {
    count,
    cost: getUpgradeCost(state, upgrade),
    soldOut,
    spent
  };
}

export function purchaseUpgrade(state, index) {
  const upgrade = upgrades[index];
  if (!upgrade || state.mode !== 'shop') return false;
  const info = getUpgradePurchaseInfo(state, upgrade);
  if (info.soldOut || info.spent || state.credits < info.cost) return false;

  state.credits -= info.cost;
  state.owned[upgrade.key] = upgrade.maxPurchases ? info.count + 1 : true;
  state.syncHud();
  return true;
}