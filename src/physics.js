export function resolvePlatformLanding(player, platforms, previousY) {
  if (player.vy < 0) return null;

  const previousBottom = previousY + player.h;
  const currentBottom = player.y + player.h;
  let landing = null;

  for (const platform of platforms) {
    const crossedTop = previousBottom <= platform.y && currentBottom >= platform.y;
    const overlaps = player.x + player.w > platform.x && player.x < platform.x + platform.w;
    if (crossedTop && overlaps && (!landing || platform.y < landing.y)) landing = platform;
  }

  if (!landing) return null;
  player.y = landing.y - player.h;
  player.vy = 0;
  player.grounded = true;
  player.groundY = landing.y;
  player.jumps = 0;
  return landing;
}