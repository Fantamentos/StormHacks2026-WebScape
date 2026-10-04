import { nearestUncollectedDot } from './dots.js';
import { getPlatformShape } from './platforms/index.js';
import { getUpgradePurchaseInfo } from './upgrades.js';

function colorValue(value) {
  return Number.parseInt(value.replace('#', ''), 16);
}

function roundedRect(graphics, x, y, width, height, radius, color, alpha = 1) {
  graphics.fillStyle(colorValue(color), alpha);
  graphics.fillRoundedRect(x, y, width, height, radius);
}

export function getPlatformColors(platform, state) {
  if (platform.warning) {
    const elapsed = state.collapse.warningElapsed;
    if (elapsed >= 4 || Math.floor(elapsed * 2) % 2 === 0) return { fill: '#ffffff', top: '#ffffff' };
  }
  if (platform.id === state.startPlatform?.id) {
    return state.mode === 'collapse' || state.mode === 'shop'
      ? { fill: '#287451', top: '#9fe3bd' }
      : { fill: '#a8443d', top: '#ff826f' };
  }
  return { fill: '#34484a', top: '#86b69a' };
}

function drawRamp(graphics, platform, section, color, alpha) {
  const angle = platform.angle || 0;
  const centerX = platform.x + section.x + section.width / 2;
  const centerY = platform.y + section.y + section.height / 2;
  const halfWidth = section.width / 2;
  const halfHeight = section.height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const points = [
    [-halfWidth, -halfHeight], [halfWidth, -halfHeight],
    [halfWidth, halfHeight], [-halfWidth, halfHeight]
  ].map(([x, y]) => ({ x: centerX + x * cos - y * sin, y: centerY + x * sin + y * cos }));
  graphics.fillStyle(colorValue(color), alpha);
  graphics.fillPoints(points, true);
}

function drawPlatform(graphics, platform, state) {
  const shape = getPlatformShape(platform.shape);
  const colors = getPlatformColors(platform, state);
  const alpha = platform.warning ? 1 : 1;

  if (shape.detail === 'y-support') {
    graphics.lineStyle(9, colorValue(colors.fill), alpha);
    graphics.beginPath();
    graphics.moveTo(platform.x + platform.w / 2, platform.y + platform.h - 3);
    graphics.lineTo(platform.x + 30, platform.y + 8);
    graphics.moveTo(platform.x + platform.w / 2, platform.y + platform.h - 3);
    graphics.lineTo(platform.x + platform.w - 30, platform.y + 8);
    graphics.strokePath();
  }

  for (const section of shape.bodySections) {
    if (shape.detail === 'ramp') {
      drawRamp(graphics, platform, section, colors.fill, alpha);
    } else {
      roundedRect(graphics, platform.x + section.x, platform.y + section.y, section.width, section.height, shape.cornerRadius, colors.fill, alpha);
    }
    if (section.y === 0 && shape.detail !== 'ramp') {
      graphics.fillStyle(colorValue(colors.top), alpha);
      graphics.fillRect(platform.x + section.x + shape.cornerRadius, platform.y + section.y, section.width - shape.cornerRadius * 2, 3);
    }
  }

  if (platform.warning) return;
  if (shape.detail === 'supports') {
    graphics.fillStyle(0x0c1919, 0.22);
    graphics.fillRect(platform.x + 12, platform.y + 7, 3, platform.h - 9);
    graphics.fillRect(platform.x + platform.w - 15, platform.y + 7, 3, platform.h - 9);
  } else if (shape.detail === 'stripe' || shape.detail === 'step') {
    graphics.fillStyle(0xd3f1dc, 0.32);
    graphics.fillRect(platform.x + 7, platform.y + 5, platform.w - 14, 1);
  } else if (shape.detail === 't-support') {
    graphics.fillStyle(0x0c1919, 0.24);
    graphics.fillRect(platform.x + platform.w / 2 - 2, platform.y + 17, 4, platform.h - 20);
  } else if (shape.detail === 'l-support') {
    graphics.fillStyle(0x0c1919, 0.24);
    graphics.fillRect(platform.x + 7, platform.y + 17, 4, platform.h - 20);
  }
}

function drawDasher(graphics, state, scene) {
  for (const { model: dasher, visual } of scene.dashers) {
    graphics.fillStyle(0x401b22, 1);
    graphics.fillCircle(visual.x - 4, visual.y - 2, 2);
    graphics.fillCircle(visual.x + 4, visual.y - 2, 2);
    graphics.fillStyle(0xffb0a3, 1);
    graphics.fillRect(visual.x - 4, visual.y + 4, 8, 2);

    if (!['telegraph', 'followupTelegraph'].includes(dasher.phase) || !dasher.target) continue;
    const startX = visual.x;
    const startY = visual.y;
    const deltaX = dasher.target.x - startX;
    const deltaY = dasher.target.y - startY;
    const length = Math.hypot(deltaX, deltaY);
    const dashLength = 14;
    const gapLength = 12;
    const segmentCount = Math.ceil(length / (dashLength + gapLength));
    graphics.lineStyle(2, 0xff655f, 0.32);
    for (let index = 0; index < segmentCount; index += 2) {
      const startDistance = index * (dashLength + gapLength);
      const endDistance = Math.min(length, startDistance + dashLength);
      graphics.lineBetween(
        startX + deltaX / length * startDistance,
        startY + deltaY / length * startDistance,
        startX + deltaX / length * endDistance,
        startY + deltaY / length * endDistance
      );
    }
  }
}

function drawDoppelgangers(graphics, state, scene) {
  for (const entry of scene.doppelgangerRuns) {
    for (const copy of entry.run.copies) {
      const top = copy.y - state.player.h / 2;
      graphics.fillStyle(0x49265d, 1);
      graphics.fillRoundedRect(copy.x - state.player.w / 2, copy.y - state.player.h / 2, state.player.w, state.player.h, 7);
      graphics.fillStyle(0x24132f, 1);
      graphics.fillRect(copy.x - 6, top + state.player.h * 0.3, 4, 4);
      graphics.fillRect(copy.x + 2, top + state.player.h * 0.3, 4, 4);
      graphics.fillRect(copy.x - 8, top + state.player.h - 7, 7, 5);
      graphics.fillRect(copy.x + 1, top + state.player.h - 7, 7, 5);
    }
  }
}

function drawSentinel(graphics, state, scene) {
  for (const { model: sentinel, visual } of scene.sentinels) {
    graphics.fillStyle(0x583d1c, 1);
    graphics.fillCircle(visual.x - 5, visual.y - 2, 2);
    graphics.fillCircle(visual.x + 5, visual.y - 2, 2);
    graphics.fillStyle(0xffd16d, 1);
    graphics.fillRect(visual.x - 4, visual.y + 4, 8, 2);

    if (sentinel.phase !== 'telegraph' || !sentinel.target) continue;
    const deltaX = sentinel.target.x - visual.x;
    const deltaY = sentinel.target.y - visual.y;
    const length = Math.hypot(deltaX, deltaY);
    const segmentLength = 12;
    const gapLength = 12;
    graphics.lineStyle(2, 0xffd16d, 0.3);
    for (let distance = 0; distance < length; distance += segmentLength + gapLength) {
      const end = Math.min(length, distance + segmentLength);
      graphics.lineBetween(
        visual.x + deltaX / length * distance,
        visual.y + deltaY / length * distance,
        visual.x + deltaX / length * end,
        visual.y + deltaY / length * end
      );
    }
  }
}

function drawCompass(graphics, state, scene) {
  const camera = scene.cameras.main;
  const playerX = state.player.x + state.player.w / 2 - camera.scrollX;
  const playerY = state.player.y + state.player.h / 2 - camera.scrollY;
  const target = nearestUncollectedDot(state.player, state.dots);
  if (!target) return;
  const targetX = target.x - camera.scrollX;
  const targetY = target.y - camera.scrollY;
  const angle = Math.atan2(targetY - playerY, targetX - playerX);
  const radius = 54;
  const arrowX = playerX + Math.cos(angle) * radius;
  const arrowY = playerY + Math.sin(angle) * radius;
  const points = [
    { x: arrowX + Math.cos(angle) * 13, y: arrowY + Math.sin(angle) * 13 },
    { x: arrowX + Math.cos(angle + 2.5) * 11, y: arrowY + Math.sin(angle + 2.5) * 11 },
    { x: arrowX + Math.cos(angle + Math.PI) * 3, y: arrowY + Math.sin(angle + Math.PI) * 3 },
    { x: arrowX + Math.cos(angle - 2.5) * 11, y: arrowY + Math.sin(angle - 2.5) * 11 }
  ];
  graphics.fillStyle(target.type === 'currency' ? 0xffd16d : 0x9fe3bd, 1);
  graphics.fillPoints(points, true);
}

function updateOverlay(scene, state) {
  const mode = state.mode;
  const overlay = ['ready', 'dead', 'victory'].includes(mode);
  const intermission = mode === 'intermission';
  scene.uiGraphics.clear();
  scene.overlayTitle.setVisible(overlay);
  scene.overlayCopy.setVisible(mode === 'ready');
  scene.overlayPrompt.setVisible(overlay);
  scene.intermissionTitle.setVisible(intermission);
  scene.intermissionSubtitle.setVisible(intermission);
  scene.intermissionSkip.setVisible(intermission && state.intermission?.stage === 'modifier');
  scene.intermissionSkipZone.setVisible(intermission && state.intermission?.stage === 'modifier');
  const choices = intermission ? state.intermissionChoices : [];
  scene.intermissionCards.forEach((card, index) => {
    const visible = index < choices.length;
    card.name.setVisible(visible);
    card.description.setVisible(visible);
    card.zone.setVisible(visible);
  });
  scene.shopTitle.setVisible(mode === 'shop');
  scene.shopSubtitle.setVisible(mode === 'shop');
  scene.shopCredits.setVisible(mode === 'shop');
  scene.roundLabel.setVisible(mode === 'collect' || mode === 'collapse');
  for (const item of scene.shopItems) {
    item.name.setVisible(mode === 'shop');
    item.cost.setVisible(mode === 'shop');
    item.detail.setVisible(mode === 'shop');
    item.action.setVisible(mode === 'shop');
  }
  scene.shopZones.forEach(zone => zone.setVisible(mode === 'shop'));

  if (overlay) {
    scene.uiGraphics.fillStyle(0x0a1214, 0.7);
    scene.uiGraphics.fillRect(0, 0, state.width, state.height);
    scene.uiGraphics.fillStyle(0x172225, 0.98);
    scene.uiGraphics.lineStyle(1, 0x526760, 1);
    scene.uiGraphics.fillRoundedRect(216, 202, 528, 196, 8);
    scene.uiGraphics.strokeRoundedRect(216, 202, 528, 196, 8);
    scene.overlayTitle.setText(mode === 'dead' ? 'RUN ENDED' : mode === 'victory' ? 'RUN CLEARED' : 'UPDRAFT');
    scene.overlayCopy.setText('Collect every pale dot to start the collapse.');
    scene.overlayPrompt.setText(mode === 'dead'
      ? `Credits banked: ${state.credits}  ·  Press ENTER to retry`
      : mode === 'victory'
        ? `Five levels cleared  ·  Credits banked: ${state.credits}`
        : 'Press ENTER to drop in');
  }

  if (intermission) {
    scene.uiGraphics.fillStyle(0x0a1214, 0.82);
    scene.uiGraphics.fillRect(0, 0, state.width, state.height);
    scene.uiGraphics.fillStyle(0x172427, 1);
    scene.uiGraphics.lineStyle(1, 0x526760, 1);
    scene.uiGraphics.fillRoundedRect(104, 74, 752, 452, 8);
    scene.uiGraphics.strokeRoundedRect(104, 74, 752, 452, 8);
    const isModifier = state.intermission.stage === 'modifier';
    scene.intermissionTitle.setText(isModifier
      ? `LEVEL ${String(state.round).padStart(2, '0')}  /  MODIFIER`
      : `LEVEL ${String(state.round).padStart(2, '0')}  /  ENEMY ${state.intermission.selectionIndex + 1} OF 2`);
    scene.intermissionSubtitle.setText(isModifier
      ? 'Choose one modifier for the run or skip this offer.'
      : 'Choose an enemy to add to this level. Picks can repeat while capacity remains.');

    const cardWidth = choices.length >= 4 ? 160 : choices.length === 3 ? 220 : choices.length === 2 ? 280 : 400;
    const cardHeight = 174;
    const gap = 12;
    const totalWidth = choices.length * cardWidth + Math.max(0, choices.length - 1) * gap;
    const startX = (state.width - totalWidth) / 2;
    choices.forEach((choice, index) => {
      const x = startX + index * (cardWidth + gap);
      const y = 232;
      scene.uiGraphics.fillStyle(0x1d2b2e, 1);
      scene.uiGraphics.lineStyle(1, 0x647a70, 1);
      scene.uiGraphics.fillRoundedRect(x, y, cardWidth, cardHeight, 6);
      scene.uiGraphics.strokeRoundedRect(x, y, cardWidth, cardHeight, 6);
      scene.uiGraphics.fillStyle(0x365c49, 1);
      scene.uiGraphics.fillRoundedRect(x + 12, y + 126, cardWidth - 24, 34, 4);
      scene.intermissionCards[index].name
        .setText(`${index + 1}. ${choice.name}`)
        .setWordWrapWidth(cardWidth - 24)
        .setPosition(x + cardWidth / 2, y + 22);
      scene.intermissionCards[index].description
        .setText(choice.description)
        .setWordWrapWidth(cardWidth - 24)
        .setPosition(x + 16, y + 58);
      scene.intermissionCards[index].zone
        .setSize(cardWidth, cardHeight)
        .setPosition(x + cardWidth / 2, y + cardHeight / 2);
    });
    scene.intermissionSkip.setText('SKIP MODIFIER  ·  NO REWARD').setPosition(480, 454);
  }

  if (mode === 'shop') {
    scene.uiGraphics.fillStyle(0x0a1214, 0.78);
    scene.uiGraphics.fillRect(0, 0, state.width, state.height);
    scene.uiGraphics.fillStyle(0x172427, 1);
    scene.uiGraphics.lineStyle(1, 0x526760, 1);
    scene.uiGraphics.fillRoundedRect(104, 74, 752, 452, 8);
    scene.uiGraphics.strokeRoundedRect(104, 74, 752, 452, 8);
    scene.shopItems.forEach((item, index) => {
      const upgrade = state.upgrades[index];
      const purchase = getUpgradePurchaseInfo(state, upgrade);
      const affordable = !purchase.soldOut && !purchase.spent && state.credits >= purchase.cost;
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = 134 + column * 236;
      const y = 192 + row * 158;
      scene.uiGraphics.fillStyle(affordable ? 0x1d2b2e : 0x213b33, 1);
      scene.uiGraphics.lineStyle(1, colorValue(affordable ? '#647a70' : '#9fe3bd'), 1);
      scene.uiGraphics.fillRoundedRect(x, y, 220, 146, 6);
      scene.uiGraphics.strokeRoundedRect(x, y, 220, 146, 6);
      scene.uiGraphics.fillStyle(affordable ? 0x365c49 : 0x28493a, 1);
      scene.uiGraphics.fillRoundedRect(x + 12, y + 112, 196, 28, 4);
      const countLabel = upgrade.maxPurchases ? `  ${purchase.count}/${upgrade.maxPurchases}` : '';
      const costLabel = purchase.spent
        ? 'SPENT'
        : purchase.soldOut
          ? (upgrade.maxPurchases ? 'MAXED' : 'OWNED')
          : `${purchase.cost} CREDITS`;
      const actionLabel = purchase.spent
        ? 'SPENT'
        : purchase.soldOut
          ? (upgrade.maxPurchases ? 'MAXED' : 'PURCHASED')
          : affordable
            ? 'BUY'
            : 'NOT ENOUGH';
      item.name.setText(`${upgrade.title}${countLabel}`).setPosition(x + 12, y + 34);
      item.cost.setText(costLabel).setPosition(x + 12, y + 12);
      item.detail.setText(upgrade.detail).setPosition(x + 12, y + 62);
      item.action.setText(actionLabel).setPosition(x + 110, y + 126);
    });
    scene.uiGraphics.fillStyle(0x1c302b, 1);
    scene.uiGraphics.fillRoundedRect(136, 499, 688, 20, 4);
    scene.shopCredits.setPosition(148, 502).setText(`${state.credits} credits available · upgrades persist`);
  }
}

export function createSceneUi(scene, state) {
  const textStyle = { fontFamily: 'Space Grotesk, sans-serif', color: '#eef2e7' };
  scene.uiGraphics = scene.add.graphics().setScrollFactor(0).setDepth(100);
  scene.overlayTitle = scene.add.text(480, 296, '', { ...textStyle, fontSize: '38px', fontStyle: '600' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
  scene.overlayCopy = scene.add.text(480, 330, '', { ...textStyle, color: '#b4c0b8', fontSize: '15px' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
  scene.overlayPrompt = scene.add.text(480, 368, '', { ...textStyle, color: '#ffd16d', fontFamily: 'DM Mono, monospace', fontSize: '13px' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
  scene.shopTitle = scene.add.text(136, 123, 'Upgrade station', { ...textStyle, fontSize: '32px', fontStyle: '600' }).setScrollFactor(0).setDepth(101);
  scene.shopSubtitle = scene.add.text(136, 181, '', { ...textStyle, color: '#a1ada5', fontSize: '14px' }).setScrollFactor(0).setDepth(101);
  scene.shopCredits = scene.add.text(157, 455, '', { ...textStyle, fontSize: '14px' }).setScrollFactor(0).setDepth(101);
  scene.roundLabel = scene.add.text(940, 24, '', { ...textStyle, color: '#c1ccc5', fontFamily: 'DM Mono, monospace', fontSize: '11px' }).setOrigin(1, 0).setScrollFactor(0).setDepth(101);
  scene.intermissionTitle = scene.add.text(480, 126, '', { ...textStyle, color: '#9fe3bd', fontFamily: 'DM Mono, monospace', fontSize: '13px' }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
  scene.intermissionSubtitle = scene.add.text(480, 170, '', { ...textStyle, color: '#a1ada5', fontSize: '14px' }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
  scene.intermissionCards = [0, 1, 2, 3].map(index => {
    const name = scene.add.text(0, 0, '', { ...textStyle, fontSize: '17px', fontStyle: '600', align: 'center', wordWrap: { width: 188 } }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101).setVisible(false);
    const description = scene.add.text(0, 0, '', { ...textStyle, color: '#a1ada5', fontSize: '13px', align: 'center', wordWrap: { width: 188 } }).setScrollFactor(0).setDepth(101).setVisible(false);
    const zone = scene.add.zone(0, 0, 220, 174).setScrollFactor(0).setDepth(102).setInteractive().setVisible(false);
    zone.on('pointerdown', () => scene.chooseIntermissionOption(index));
    return { name, description, zone };
  });
  scene.intermissionSkip = scene.add.text(480, 454, '', { ...textStyle, color: '#ffd16d', fontFamily: 'DM Mono, monospace', fontSize: '12px' }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
  scene.intermissionSkipZone = scene.add.zone(480, 454, 300, 38).setScrollFactor(0).setDepth(102).setInteractive().setVisible(false);
  scene.intermissionSkipZone.on('pointerdown', () => scene.skipIntermissionModifier());
  scene.shopItems = state.upgrades.map(upgrade => ({
    name: scene.add.text(0, 0, '', { ...textStyle, fontSize: '17px', fontStyle: '600' }).setScrollFactor(0).setDepth(101),
    cost: scene.add.text(0, 0, '', { ...textStyle, color: '#ffd16d', fontFamily: 'DM Mono, monospace', fontSize: '11px' }).setScrollFactor(0).setDepth(101),
    detail: scene.add.text(0, 0, upgrade.detail, { ...textStyle, color: '#a1ada5', fontSize: '13px', wordWrap: { width: 196 } }).setScrollFactor(0).setDepth(101),
    action: scene.add.text(0, 0, '', { ...textStyle, fontFamily: 'DM Mono, monospace', fontSize: '12px' }).setOrigin(0.5).setScrollFactor(0).setDepth(101)
  }));
}

export function drawGame(scene, state) {
  const graphics = scene.gameGraphics;
  const camera = scene.cameras.main;
  graphics.clear();
  graphics.fillStyle(0x162326, 1);
  graphics.fillRect(camera.scrollX, camera.scrollY, state.width, state.height);
  graphics.lineStyle(1, 0xb2d3be, 0.055);
  for (let x = Math.floor(camera.scrollX / 48) * 48; x < camera.scrollX + state.width; x += 48) {
    for (let y = Math.floor(camera.scrollY / 48) * 48; y < camera.scrollY + state.height; y += 48) graphics.strokeCircle(x + 30, y + 24, 1.2);
  }

  for (const platform of state.platforms) drawPlatform(graphics, platform, state);
  for (const dot of state.dots) {
    if (dot.taken) continue;
    const color = dot.type === 'currency' ? 0xffd16d : 0xd7f2de;
    graphics.fillStyle(color, 0.16); graphics.fillCircle(dot.x, dot.y, 12);
    graphics.fillStyle(color, 1); graphics.fillCircle(dot.x, dot.y, dot.type === 'currency' ? 6 : 5);
    graphics.fillStyle(0xffffff, 1); graphics.fillCircle(dot.x - 1, dot.y - 1, 1.6);
  }

  if (state.exit && (state.mode === 'collapse' || state.mode === 'shop')) {
    roundedRect(graphics, state.exit.x, state.exit.y, state.exit.w, state.exit.h, 5, '#143f3a');
    graphics.lineStyle(3, 0xb8f1cb, 1);
    graphics.strokeRect(state.exit.x + 8, state.exit.y + 8, 26, 34);
  }

  drawDoppelgangers(graphics, state, scene);
  drawDasher(graphics, state, scene);
  drawSentinel(graphics, state, scene);

  graphics.fillStyle(0xb7edc8, 1);
  graphics.fillRoundedRect(state.player.x, state.player.y, state.player.w, state.player.h, 7);
  graphics.lineStyle(2, 0xffffff, 1);
  graphics.strokeRoundedRect(state.player.x, state.player.y, state.player.w, state.player.h, 7);
  if (!state.player.shieldUsed) {
    graphics.lineStyle(2, 0x9fe3bd, 0.75);
    graphics.strokeCircle(state.player.x + state.player.w / 2, state.player.y + state.player.h / 2, 22);
  }
  graphics.fillStyle(0x203b32, 1);
  graphics.fillRect(state.player.x + (state.player.facing > 0 ? 15 : 5), state.player.y + state.player.h * 0.3, 4, 4);
  graphics.fillStyle(0x6daf88, 1);
  graphics.fillRect(state.player.x + 4, state.player.y + state.player.h - 7, 7, 5);
  graphics.fillRect(state.player.x + 15, state.player.y + state.player.h - 7, 7, 5);

  scene.roundLabel.setText(`ROUND ${String(state.round).padStart(2, '0')}  /  COLLECT DOTS`);
  updateOverlay(scene, state);
  if (state.owned.compass && (state.mode === 'collect' || state.mode === 'collapse')) drawCompass(scene.uiGraphics, state, scene);
}