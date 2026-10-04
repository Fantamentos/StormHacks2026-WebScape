export function canPlayerJump(player, airJumpCount = 1) {
  return player.grounded || player.jumps < airJumpCount + 1;
}

export function landPlayer(player) {
  player.grounded = true;
  player.jumps = 0;
}

export function leavePlatform(player) {
  if (player.grounded && player.jumps === 0) player.jumps = 1;
  player.grounded = false;
}

export function isPlayerAboveOneWaySection(player, platform, section, velocityY, tolerance = 3) {
  if (velocityY < -0.01) return false;

  const angle = platform.angle || 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerX = platform.x + section.x + section.width / 2;
  const centerY = platform.y + section.y + section.height / 2;
  const halfWidth = section.width / 2;
  const halfHeight = section.height / 2;
  const start = {
    x: centerX - halfWidth * cos + halfHeight * sin,
    y: centerY - halfWidth * sin - halfHeight * cos
  };
  const end = {
    x: centerX + halfWidth * cos + halfHeight * sin,
    y: centerY + halfWidth * sin - halfHeight * cos
  };
  const playerLeft = player.x;
  const playerRight = player.x + player.w;
  const overlapLeft = Math.max(playerLeft, Math.min(start.x, end.x));
  const overlapRight = Math.min(playerRight, Math.max(start.x, end.x));
  if (overlapLeft > overlapRight) return false;

  const surfaceY = x => {
    const fraction = (x - start.x) / (end.x - start.x);
    return start.y + (end.y - start.y) * fraction;
  };
  const highestSurfaceY = Math.min(surfaceY(overlapLeft), surfaceY(overlapRight));
  return player.y + player.h <= highestSurfaceY + tolerance;
}

export function hasPlayerClearedPlatformBelow(player, platform) {
  return player.y >= platform.y + platform.h;
}