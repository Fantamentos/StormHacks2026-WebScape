export function isGroundContact(pair, playerBody) {
  const playerIsA = pair.bodyA === playerBody;
  const playerIsB = pair.bodyB === playerBody;
  if (!playerIsA && !playerIsB) return false;

  const normalY = playerIsA ? -pair.collision.normal.y : pair.collision.normal.y;
  return normalY > 0.35;
}