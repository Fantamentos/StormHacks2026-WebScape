import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BASE_ENEMY_CAPS,
  chooseIntermissionModifier,
  completeLevel,
  createIntermission,
  createRunProgress,
  getAvailableEnemyChoices,
  getEnemyCap,
  getRosterCounts,
  getTotalEnemyCapacity,
  MODIFIER_REWARD_CREDITS,
  selectIntermissionEnemy,
  skipIntermissionModifier
} from './intermission.js';
import { DOPPELGANGER_CAP_FIVE } from '../../modifiers/doppelganger.js';
import { DASHER_FOLLOWUP } from '../../modifiers/dasher.js';
import { DOPPELGANGER_FAST_FOLLOW } from '../../modifiers/doppelganger.js';

test('enemy choices filter exhausted types and repeated picks stop at their run cap', () => {
  const run = createRunProgress();
  const intermission = createIntermission(run, 1);

  assert.deepEqual(getAvailableEnemyChoices(run).map(enemy => enemy.id), Object.keys(BASE_ENEMY_CAPS));
  assert.equal(selectIntermissionEnemy(run, intermission, 'dasher'), true);
  assert.equal(selectIntermissionEnemy(run, intermission, 'dasher'), true);
  assert.equal(run.selectedCounts.dasher, 2);
  assert.equal(getAvailableEnemyChoices(run).some(enemy => enemy.id === 'dasher'), false);
  assert.deepEqual(intermission.roster, ['dasher', 'dasher']);
  assert.deepEqual(getRosterCounts(intermission.roster), { dasher: 2, doppelganger: 0, stopwatch: 0, sentinel: 0 });
  assert.equal(intermission.stage, 'shop');
  assert.equal(selectIntermissionEnemy(run, intermission, 'dasher'), false);
});

test('selection offers fewer choices as caps are reached and automatically skips when none remain', () => {
  const run = createRunProgress();
  run.selectedCounts = { dasher: 2, doppelganger: 3, stopwatch: 1, sentinel: 1 };
  const intermission = createIntermission(run, 5, () => 0);

  assert.deepEqual(getAvailableEnemyChoices(run).map(enemy => enemy.id), ['sentinel']);
  assert.equal(selectIntermissionEnemy(run, intermission, 'sentinel'), true);
  assert.equal(intermission.stage, 'modifier');
  assert.equal(intermission.roster.length, 1);
});

test('levels three and five enter modifier selection before the shop', () => {
  const run = createRunProgress();
  const first = createIntermission(run, 1);
  selectIntermissionEnemy(run, first, 'dasher');
  selectIntermissionEnemy(run, first, 'sentinel');
  assert.equal(first.stage, 'shop');

  const afterLevelTwo = createIntermission(run, 3, () => 0.25);
  selectIntermissionEnemy(run, afterLevelTwo, 'doppelganger');
  selectIntermissionEnemy(run, afterLevelTwo, 'stopwatch');
  assert.equal(afterLevelTwo.stage, 'modifier');
  assert.equal(afterLevelTwo.modifierOptions.length, 3);
  assert.equal(new Set(afterLevelTwo.modifierOptions.map(option => option.id)).size, 3);
});

test('modifier offers exclude owned options and remain distinct', () => {
  const run = createRunProgress();
  run.enemyModifiers.push(DASHER_FOLLOWUP.id, DOPPELGANGER_FAST_FOLLOW.id);
  const intermission = createIntermission(run, 3, () => 0.25);
  selectIntermissionEnemy(run, intermission, 'sentinel');
  selectIntermissionEnemy(run, intermission, 'stopwatch');

  const offeredIds = intermission.modifierOptions.map(option => option.id);
  assert.equal(offeredIds.length, 3);
  assert.equal(new Set(offeredIds).size, 3);
  assert.ok(!offeredIds.includes(DASHER_FOLLOWUP.id));
  assert.ok(!offeredIds.includes(DOPPELGANGER_FAST_FOLLOW.id));
});

test('choosing one offered modifier grants the tunable reward; skipping grants none', () => {
  const run = createRunProgress();
  const intermission = createIntermission(run, 3, () => 0);
  intermission.stage = 'modifier';
  intermission.modifierOptions = [{ id: DOPPELGANGER_CAP_FIVE.id }];

  assert.equal(chooseIntermissionModifier(run, intermission, 'unknown'), 0);
  assert.equal(chooseIntermissionModifier(run, intermission, DOPPELGANGER_CAP_FIVE.id), MODIFIER_REWARD_CREDITS);
  assert.deepEqual(run.enemyModifiers, [DOPPELGANGER_CAP_FIVE.id]);
  assert.equal(intermission.stage, 'shop');
  assert.equal(getEnemyCap(run, 'doppelganger'), 5);

  const skipped = createIntermission(run, 5);
  skipped.stage = 'modifier';
  assert.equal(skipIntermissionModifier(skipped), true);
  assert.equal(skipped.stage, 'shop');
  assert.equal(skipIntermissionModifier(skipped), false);
});

test('enemy capacities support eight base picks and ten picks with the cap-five modifier', () => {
  const run = createRunProgress();
  assert.equal(getTotalEnemyCapacity(run), 8);
  run.enemyModifiers.push(DOPPELGANGER_CAP_FIVE.id);
  assert.equal(getTotalEnemyCapacity(run), 10);
});

test('level five completion ends the run instead of scheduling a sixth level', () => {
  const run = createRunProgress();
  assert.deepEqual(completeLevel(run, 4), { type: 'intermission', level: 5 });
  assert.deepEqual(completeLevel(run, 5), { type: 'victory' });
  assert.equal(run.completedLevels, 5);
});