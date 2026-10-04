import { getPlatformCollisionSections } from './platforms/index.js';

export function resolvePlatformLanding(player, platforms, previousY) {
  if (player.vy < 0) return null;

  const previousBottom = previousY + player.h;
  const currentBottom = player.y + player.h;
  let landing = null;

  for (const platform of platforms) {
    for (const section of getPlatformCollisionSections(platform)) {
      const surfaceY = platform.y + section.y;
      const sectionX = platform.x + section.x;
      const crossedTop = previousBottom <= surfaceY && currentBottom >= surfaceY;
      const overlaps = player.x + player.w > sectionX && player.x < sectionX + section.width;
      if (crossedTop && overlaps && (!landing || surfaceY < landing.y)) {
        landing = { platform, y: surfaceY };
      }
    }
  }

  if (!landing) return null;
  player.y = landing.y - player.h;
  player.vy = 0;
  player.grounded = true;
  player.groundY = landing.y;
  player.jumps = 0;
  return landing.platform;
}