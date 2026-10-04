export function consumeVoidShield(state) {
  if (!state.owned.voidShield || state.voidShieldUsed) return false;
  state.voidShieldUsed = true;
  return true;
}

export function getVoidRescuePosition(platforms, playerHeight, dropDistance = 90) {
  if (!platforms.length) return null;
  const highestPlatform = platforms.reduce((highest, platform) => platform.y < highest.y ? platform : highest);
  return {
    x: highestPlatform.x + highestPlatform.w / 2,
    y: highestPlatform.y - playerHeight / 2 - dropDistance,
    groundY: highestPlatform.y,
    platformId: highestPlatform.id
  };
}