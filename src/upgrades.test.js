import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getRunSpeedMultiplier,
  getUpgradeCost,
  purchaseUpgrade,
  SPEED_RING_BASE_COST,
  SPEED_RING_COST_INCREMENT,
  SPEED_RING_MAX_PURCHASES,
  SPEED_RING_MOVEMENT_BONUS,
  upgrades
} from './upgrades.js';
import { createOwnedUpgrades } from './upgrades.js';

function createShopState(credits = 100) {
  return {
    mode: 'shop',
    credits,
    owned: createOwnedUpgrades(),
    voidShieldUsed: false,
    syncHud() {}
  };
}

test('Speed Rings cost more with each purchase and stop at three', () => {
  const state = createShopState();
  const index = upgrades.findIndex(upgrade => upgrade.key === 'speedRings');
  const paidCosts = [];

  for (let purchase = 0; purchase < SPEED_RING_MAX_PURCHASES; purchase += 1) {
    const cost = getUpgradeCost(state, upgrades[index]);
    paidCosts.push(cost);
    assert.equal(cost, SPEED_RING_BASE_COST + purchase * SPEED_RING_COST_INCREMENT);
    assert.equal(purchaseUpgrade(state, index), true);
  }
  assert.deepEqual(paidCosts, [15, 25, 35]);
  assert.equal(state.owned.speedRings, SPEED_RING_MAX_PURCHASES);
  assert.equal(getRunSpeedMultiplier(state), 1 + SPEED_RING_MAX_PURCHASES * SPEED_RING_MOVEMENT_BONUS);
  assert.equal(purchaseUpgrade(state, index), false);
});

test('Speed Ring purchases require enough credits and shop mode', () => {
  const poor = createShopState(SPEED_RING_BASE_COST - 1);
  const index = upgrades.findIndex(upgrade => upgrade.key === 'speedRings');
  assert.equal(purchaseUpgrade(poor, index), false);
  assert.equal(poor.owned.speedRings, 0);

  const notInShop = createShopState();
  notInShop.mode = 'collect';
  assert.equal(purchaseUpgrade(notInShop, index), false);
});

test('Void Shield can only be purchased once', () => {
  const state = createShopState();
  const index = upgrades.findIndex(upgrade => upgrade.key === 'voidShield');
  assert.equal(purchaseUpgrade(state, index), true);
  assert.equal(purchaseUpgrade(state, index), false);
  assert.equal(state.owned.voidShield, true);
});