import { DASHER_FOLLOWUP } from '../../modifiers/dasher.js';
import { DOPPELGANGER_CAP_FIVE, DOPPELGANGER_FAST_FOLLOW } from '../../modifiers/doppelganger.js';
import { SENTINEL_DOUBLE_SHOT } from '../../modifiers/sentinel.js';
import { STOPWATCH_REVERSE_TICKING } from '../../modifiers/stopwatch.js';

export const FINAL_LEVEL = 5;
export const ENEMY_SELECTIONS_PER_LEVEL = 2;
export const MODIFIER_REWARD_CREDITS = 5;

export const ENEMY_TYPES = Object.freeze([
  { id: 'dasher', name: 'Dasher', description: 'Telegraphs, then dashes toward a locked target.' },
  { id: 'doppelganger', name: 'Doppelganger', description: 'Delayed copies replay your movement.' },
  { id: 'stopwatch', name: 'Stopwatch', description: 'A countdown punishes movement at the wrong moment.' },
  { id: 'sentinel', name: 'Sentinel', description: 'Evades and fires aimed, fixed-speed shots.' }
]);

export const BASE_ENEMY_CAPS = Object.freeze({
  dasher: 2,
  doppelganger: 3,
  stopwatch: 1,
  sentinel: 2
});

const MODIFIER_POOL = Object.freeze([
  { ...DASHER_FOLLOWUP, enemyType: 'dasher' },
  { ...DOPPELGANGER_CAP_FIVE, enemyType: 'doppelganger' },
  { ...DOPPELGANGER_FAST_FOLLOW, enemyType: 'doppelganger' },
  { ...STOPWATCH_REVERSE_TICKING, enemyType: 'stopwatch' },
  { ...SENTINEL_DOUBLE_SHOT, enemyType: 'sentinel' }
]);

function emptyCounts() {
  return Object.fromEntries(ENEMY_TYPES.map(enemy => [enemy.id, 0]));
}

function sampleModifiers(options, random) {
  const shuffled = [...options];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(random() * (index + 1)));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, 3);
}

function modifierChoices(run, random) {
  const owned = new Set(run.enemyModifiers);
  const available = MODIFIER_POOL.filter(modifier => !owned.has(modifier.id));
  return sampleModifiers(available, random);
}

function enterNextStage(run, intermission, random) {
  if ([3, 5].includes(intermission.level)) {
    intermission.stage = 'modifier';
    intermission.modifierOptions = modifierChoices(run, random);
  } else {
    intermission.stage = 'shop';
  }
}

export function createRunProgress() {
  return {
    completedLevels: 0,
    selectedCounts: emptyCounts(),
    enemyModifiers: []
  };
}

export function getEnemyCap(run, enemyId) {
  if (enemyId === 'doppelganger' && run.enemyModifiers.includes(DOPPELGANGER_CAP_FIVE.id)) {
    return DOPPELGANGER_CAP_FIVE.maxCount;
  }
  return BASE_ENEMY_CAPS[enemyId] ?? 0;
}

export function getTotalEnemyCapacity(run) {
  return ENEMY_TYPES.reduce((total, enemy) => total + getEnemyCap(run, enemy.id), 0);
}

export function getAvailableEnemyChoices(run) {
  return ENEMY_TYPES.filter(enemy => run.selectedCounts[enemy.id] < getEnemyCap(run, enemy.id));
}

export function getRosterCounts(roster) {
  const counts = emptyCounts();
  for (const enemyId of roster) counts[enemyId] += 1;
  return counts;
}

export function createIntermission(run, level, random = Math.random) {
  const intermission = {
    level,
    stage: 'enemies',
    selectionIndex: 0,
    roster: [],
    modifierOptions: []
  };
  if (!getAvailableEnemyChoices(run).length) enterNextStage(run, intermission, random);
  return intermission;
}

export function selectIntermissionEnemy(run, intermission, enemyId, random = Math.random) {
  if (intermission.stage !== 'enemies') return false;
  if (!getAvailableEnemyChoices(run).some(enemy => enemy.id === enemyId)) return false;

  run.selectedCounts[enemyId] += 1;
  intermission.roster.push(enemyId);
  intermission.selectionIndex += 1;
  if (intermission.selectionIndex >= ENEMY_SELECTIONS_PER_LEVEL || !getAvailableEnemyChoices(run).length) {
    enterNextStage(run, intermission, random);
  }
  return true;
}

export function chooseIntermissionModifier(run, intermission, modifierId) {
  if (intermission.stage !== 'modifier') return 0;
  const modifier = intermission.modifierOptions.find(option => option.id === modifierId);
  if (!modifier) return 0;

  run.enemyModifiers.push(modifier.id);
  intermission.stage = 'shop';
  return MODIFIER_REWARD_CREDITS;
}

export function skipIntermissionModifier(intermission) {
  if (intermission.stage !== 'modifier') return false;
  intermission.stage = 'shop';
  return true;
}

export function completeLevel(run, level) {
  run.completedLevels = Math.max(run.completedLevels, level);
  if (level >= FINAL_LEVEL) return { type: 'victory' };
  return { type: 'intermission', level: level + 1 };
}