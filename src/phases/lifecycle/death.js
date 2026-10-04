export function freezeMatterRun(state, matter, playerBody, enemyBody, world) {
  if (state.mode === 'dead') return false;

  state.mode = 'dead';
  matter.setVelocity(playerBody, 0, 0);
  playerBody.setIgnoreGravity(true);
  playerBody.setStatic(true);

  if (enemyBody) {
    matter.setVelocity(enemyBody, 0, 0);
    enemyBody.setIgnoreGravity(true);
    enemyBody.setStatic(true);
  }

  world.pause();
  return true;
}