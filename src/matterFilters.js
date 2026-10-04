export const PLAYER_CATEGORY = 0x0001;
export const PLATFORM_CATEGORY = 0x0002;
export const ENEMY_CATEGORY = 0x0004;
export const DOT_CATEGORY = 0x0008;
export const EXIT_CATEGORY = 0x0010;

export const PLAYER_MASK = PLATFORM_CATEGORY | ENEMY_CATEGORY | DOT_CATEGORY | EXIT_CATEGORY;
export const PLATFORM_MASK = PLAYER_CATEGORY;
export const DOT_MASK = PLAYER_CATEGORY;
export const EXIT_MASK = PLAYER_CATEGORY;

export function dasherCollisionMask(phase) {
  return phase === 'dash' || phase === 'followupDash' ? PLAYER_CATEGORY : 0;
}

export function filtersAllowCollision(first, second) {
  return (first.mask & second.category) !== 0 && (second.mask & first.category) !== 0;
}