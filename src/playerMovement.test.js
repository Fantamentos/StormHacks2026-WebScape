import assert from 'node:assert/strict';
import test from 'node:test';
import Matter from 'matter-js';
import { canPlayerJump, hasPlayerClearedPlatformBelow, isPlayerAboveOneWaySection, landPlayer, leavePlatform } from './playerMovement.js';
import { PLAYER_CATEGORY, PLATFORM_CATEGORY } from './matterFilters.js';
import { PLATFORM_SHAPES } from './platforms/index.js';

function createPhysicsCase(shape, playerY) {
  const engine = Matter.Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 0;
  engine.gravity.scale = 0;
  const platform = { x: 100, y: 100, w: shape.width, h: shape.height, angle: shape.angle || 0 };
  const platformBodies = shape.bodySections.map(section => {
    const body = Matter.Bodies.rectangle(
      platform.x + section.x + section.width / 2,
      platform.y + section.y + section.height / 2,
      section.width,
      section.height,
      {
        isStatic: true,
        angle: platform.angle,
        collisionFilter: { category: PLATFORM_CATEGORY, mask: PLAYER_CATEGORY }
      }
    );
    Matter.Composite.add(engine.world, body);
    return { body, section };
  });
  const player = Matter.Bodies.rectangle(platform.x + shape.width / 2, playerY, 20, 20, {
    friction: 0,
    frictionAir: 0,
    restitution: 0,
    collisionFilter: { category: PLAYER_CATEGORY, mask: PLATFORM_CATEGORY }
  });
  Matter.Composite.add(engine.world, player);

  return {
    engine,
    platform,
    platformBodies,
    player,
    updateOneWay() {
      const playerRect = {
        x: player.position.x - 10,
        y: player.position.y - 10,
        w: 20,
        h: 20
      };
      for (const { body, section } of platformBodies) {
        body.collisionFilter.mask = isPlayerAboveOneWaySection(playerRect, platform, section, player.velocity.y)
          ? PLAYER_CATEGORY
          : 0;
      }
      Matter.Engine.update(engine, 1000 / 60);
    }
  };
}

test('one air jump is available by default and the upgrade grants one additional air jump', () => {
  assert.equal(canPlayerJump({ grounded: true, jumps: 2 }), true);
  assert.equal(canPlayerJump({ grounded: false, jumps: 1 }), true);
  assert.equal(canPlayerJump({ grounded: false, jumps: 2 }), false);
  assert.equal(canPlayerJump({ grounded: false, jumps: 1 }, 2), true);
  assert.equal(canPlayerJump({ grounded: false, jumps: 2 }, 2), true);
  assert.equal(canPlayerJump({ grounded: false, jumps: 3 }, 2), false);
});

test('landing replenishes both jumps', () => {
  const player = { grounded: false, jumps: 2 };
  landPlayer(player);

  assert.deepEqual(player, { grounded: true, jumps: 0 });
  assert.equal(canPlayerJump(player), true);
});

test('walking off a platform counts the regular jump as spent before the one air jump', () => {
  const player = { grounded: true, jumps: 0 };
  leavePlatform(player);

  assert.deepEqual(player, { grounded: false, jumps: 1 });
  assert.equal(canPlayerJump(player), true);
  assert.equal(canPlayerJump({ ...player, jumps: 2 }), false);
});

test('every platform shape only catches a descending player from above its top sections', () => {
  for (const shape of PLATFORM_SHAPES) {
    const platform = { x: 100, y: 100, w: shape.width, h: shape.height, angle: shape.angle || 0 };
    for (const section of shape.bodySections) {
      const centerX = platform.x + section.x + section.width / 2;
      const player = { x: centerX - 10, y: 50, w: 20, h: 30 };

      assert.equal(isPlayerAboveOneWaySection(player, platform, section, 1), true, `${shape.type} catches a falling player above section y=${section.y}`);
      assert.equal(isPlayerAboveOneWaySection(player, platform, section, -1), false, `${shape.type} lets a rising player pass section y=${section.y}`);
      assert.equal(isPlayerAboveOneWaySection({ ...player, y: 180 }, platform, section, 1), false, `${shape.type} lets a player below section y=${section.y} fall through`);
    }
  }
});

test('drop-through remains active until the full platform is above the player', () => {
  for (const shape of PLATFORM_SHAPES) {
    const platform = { x: 0, y: 100, h: shape.height };
    assert.equal(hasPlayerClearedPlatformBelow({ y: platform.y + platform.h - 1 }, platform), false);
    assert.equal(hasPlayerClearedPlatformBelow({ y: platform.y + platform.h }, platform), true);
  }
});

test('Matter lets players rise through, land on, and drop through every platform shape', () => {
  for (const shape of PLATFORM_SHAPES) {
    const rising = createPhysicsCase(shape, 150);
    Matter.Body.setVelocity(rising.player, { x: 0, y: -5 });
    for (let frame = 0; frame < 30; frame += 1) rising.updateOneWay();
    assert.ok(rising.player.position.y < rising.platform.y - 10, `${shape.type} blocks upward passage`);

    const falling = createPhysicsCase(shape, 30);
    Matter.Body.setVelocity(falling.player, { x: 0, y: 5 });
    for (let frame = 0; frame < 40; frame += 1) falling.updateOneWay();
    assert.ok(falling.player.position.y < falling.platform.y + 10, `${shape.type} fails to catch a falling player`);

    for (const { body } of falling.platformBodies) body.collisionFilter.mask = 0;
    const lowerPlatform = { ...falling.platform, y: falling.platform.y + 120 };
    const lowerBodies = shape.bodySections.map(section => {
      const body = Matter.Bodies.rectangle(
        lowerPlatform.x + section.x + section.width / 2,
        lowerPlatform.y + section.y + section.height / 2,
        section.width,
        section.height,
        {
          isStatic: true,
          angle: lowerPlatform.angle,
          collisionFilter: { category: PLATFORM_CATEGORY, mask: PLAYER_CATEGORY }
        }
      );
      Matter.Composite.add(falling.engine.world, body);
      return { body, section };
    });
    Matter.Body.setVelocity(falling.player, { x: 0, y: 4 });
    for (let frame = 0; frame < 60; frame += 1) {
      const playerRect = {
        x: falling.player.position.x - 10,
        y: falling.player.position.y - 10,
        w: 20,
        h: 20
      };
      for (const { body, section } of lowerBodies) {
        body.collisionFilter.mask = isPlayerAboveOneWaySection(
          playerRect,
          lowerPlatform,
          section,
          falling.player.velocity.y
        ) ? PLAYER_CATEGORY : 0;
      }
      Matter.Engine.update(falling.engine, 1000 / 60);
    }
    assert.ok(falling.player.position.y < lowerPlatform.y + 10, `${shape.type} fails to land on the next platform after drop-through`);
  }
});