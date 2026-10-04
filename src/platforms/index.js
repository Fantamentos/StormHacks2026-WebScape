import narrow from './narrow.js';
import standard from './standard.js';
import wide from './wide.js';
import t from './t.js';
import y from './y.js';
import l from './l.js';
import step from './step.js';

export const PLATFORM_SHAPES = Object.freeze([narrow, standard, wide, t, y, l, step]);
export const STANDARD_PLATFORM = standard;

const platformByType = new Map(PLATFORM_SHAPES.map(platform => [platform.type, platform]));

export function choosePlatformShape(randomValue) {
  const index = Math.min(PLATFORM_SHAPES.length - 1, Math.floor(randomValue * PLATFORM_SHAPES.length));
  return PLATFORM_SHAPES[index];
}

export function getPlatformShape(type) {
  return platformByType.get(type) || STANDARD_PLATFORM;
}

export function getPlatformCollisionSections(platform) {
  return getPlatformShape(platform.shape).collisionSections;
}