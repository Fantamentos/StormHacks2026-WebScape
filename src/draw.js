function roundedRect(ctx, x, y, w, h, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1b3032');
  gradient.addColorStop(1, '#162326');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(178, 211, 190, 0.055)';
  ctx.lineWidth = 1;
  for (let x = 30; x < width; x += 48) {
    for (let y = 24; y < height; y += 48) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(159, 227, 189, .05)';
  ctx.beginPath(); ctx.arc(180, 150, 115, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(760, 230, 160, 0, Math.PI * 2); ctx.fill();
}

function drawCompass(ctx, state, width) {
  const target = state.dots.filter(dot => !dot.taken).sort((a, b) => {
    const da = (a.x - state.player.x) ** 2 + (a.y - state.player.y) ** 2;
    const db = (b.x - state.player.x) ** 2 + (b.y - state.player.y) ** 2;
    return da - db;
  })[0];
  if (!target) return;

  const angle = Math.atan2(target.y - state.player.y, target.x - state.player.x);
  ctx.save();
  ctx.translate(width / 2, 42);
  ctx.rotate(angle + Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath();
  ctx.fillStyle = target.type === 'currency' ? '#ffd16d' : '#9fe3bd';
  ctx.fill();
  ctx.restore();
  ctx.textAlign = 'center'; ctx.fillStyle = '#d0dbd2'; ctx.font = '10px "DM Mono", monospace'; ctx.fillText('NEAREST DOT', width / 2, 66);
}

function drawOverlay(ctx, width, height, title, copy, prompt) {
  ctx.fillStyle = 'rgba(10, 18, 20, .70)'; ctx.fillRect(0, 0, width, height);
  roundedRect(ctx, 216, 202, 528, 196, 8, 'rgba(23, 34, 37, .97)', '#526760');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a5e7bd'; ctx.font = '500 12px "DM Mono", monospace'; ctx.fillText('STORMHACKS 2026  /  ARENA PROTOTYPE', width / 2, 247);
  ctx.fillStyle = '#eef2e7'; ctx.font = '600 38px "Space Grotesk", sans-serif'; ctx.fillText(title, width / 2, 296);
  ctx.fillStyle = '#b4c0b8'; ctx.font = '15px "Space Grotesk", sans-serif'; ctx.fillText(copy, width / 2, 330);
  ctx.fillStyle = '#ffd16d'; ctx.font = '500 13px "DM Mono", monospace'; ctx.fillText(prompt, width / 2, 368);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else line = next;
  }
  ctx.fillText(line, x, y);
}

function drawShop(ctx, state, width, height, rounded) {
  ctx.fillStyle = 'rgba(10, 18, 20, .78)'; ctx.fillRect(0, 0, width, height);
  rounded(ctx, 104, 74, 752, 452, 8, '#172427', '#526760');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fe3bd'; ctx.font = '500 11px "DM Mono", monospace'; ctx.fillText(`ROUND ${String(state.round).padStart(2, '0')} COMPLETE`, 136, 116);
  ctx.fillStyle = '#eef2e7'; ctx.font = '600 32px "Space Grotesk", sans-serif'; ctx.fillText('Upgrade station', 136, 155);
  ctx.fillStyle = '#a1ada5'; ctx.font = '14px "Space Grotesk", sans-serif'; ctx.fillText(`${state.credits} credits available · upgrades persist between attempts`, 136, 181);
  state.shopButtons = [];
  state.upgrades.forEach((upgrade, index) => {
    const x = 126 + index * 178;
    const y = 218;
    const bought = state.owned[upgrade.key];
    const affordable = state.credits >= upgrade.cost;
    const stroke = bought ? '#9fe3bd' : (affordable ? '#647a70' : '#3b4b4d');
    rounded(ctx, x, y, 160, 174, 6, bought ? '#213b33' : '#1d2b2e', stroke);
    ctx.fillStyle = bought ? '#9fe3bd' : (affordable ? '#ffd16d' : '#87958e');
    ctx.font = '500 11px "DM Mono", monospace'; ctx.fillText(bought ? 'OWNED' : `${upgrade.cost} CREDITS`, x + 16, y + 27);
    ctx.fillStyle = '#eef2e7'; ctx.font = '600 17px "Space Grotesk", sans-serif'; ctx.fillText(upgrade.title, x + 16, y + 59);
    ctx.fillStyle = '#a1ada5'; ctx.font = '13px "Space Grotesk", sans-serif';
    wrapText(ctx, upgrade.detail, x + 14, y + 88, 132, 18);
    rounded(ctx, x + 10, y + 126, 140, 32, 4, bought ? '#28493a' : (affordable ? '#365c49' : '#2a3739'));
    ctx.textAlign = 'center'; ctx.fillStyle = bought ? '#b8f1cb' : '#eef2e7'; ctx.font = '500 12px "DM Mono", monospace';
    ctx.fillText(bought ? 'PURCHASED' : (affordable ? 'BUY' : 'NOT ENOUGH'), x + 80, y + 147);
    ctx.textAlign = 'left';
    state.shopButtons.push({ x: x + 10, y: y + 126, w: 140, h: 32, index });
  });
  rounded(ctx, 136, 430, 688, 62, '#1c302b', '#58715f');
  ctx.fillStyle = '#c6ead0'; ctx.font = '14px "Space Grotesk", sans-serif'; ctx.fillText('Ready for another run?', 157, 455);
  ctx.fillStyle = '#a1ada5'; ctx.font = '12px "DM Mono", monospace'; ctx.fillText('PRESS ENTER  ·  REPLAY THE ARENA', 157, 477);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd16d'; ctx.font = '500 13px "DM Mono", monospace'; ctx.fillText(`${state.credits} CREDITS`, 801, 467);
}

export function getPlatformColors(platform, state) {
  if (platform.warning) {
    const warningElapsed = state.collapse.warningElapsed;
    const blinkOn = warningElapsed >= 4 || Math.floor(warningElapsed * 2) % 2 === 0;
    if (blinkOn) return { fill: '#ffffff', top: '#ffffff' };
  }
  if (platform.id === state.startPlatform?.id) {
    return state.mode === 'collapse' || state.mode === 'shop'
      ? { fill: '#287451', top: '#9fe3bd' }
      : { fill: '#a8443d', top: '#ff826f' };
  }
  return { fill: '#34484a', top: '#86b69a' };
}

export function drawGame(ctx, state, width, height) {
  drawBackground(ctx, width, height);
  ctx.save();
  ctx.translate(-state.camera.x, -state.camera.y);
  for (const platform of state.platforms) {
    const colors = getPlatformColors(platform, state);
    ctx.fillStyle = colors.fill; ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = colors.top; ctx.fillRect(platform.x, platform.y, platform.w, 3);
  }
  for (const dot of state.dots) {
    if (dot.taken) continue;
    const isCurrency = dot.type === 'currency';
    ctx.beginPath(); ctx.fillStyle = isCurrency ? '#ffd16d' : '#d7f2de';
    ctx.shadowColor = isCurrency ? '#ffd16d' : '#d7f2de'; ctx.shadowBlur = 13;
    ctx.arc(dot.x, dot.y, isCurrency ? 6 : 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.fillStyle = isCurrency ? '#fff0bb' : '#ffffff'; ctx.arc(dot.x - 1, dot.y - 1, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  if (state.exit && (state.mode === 'collapse' || state.mode === 'shop')) {
    ctx.globalAlpha = 0.6 + Math.sin(state.elapsed * 4) * 0.12;
    roundedRect(ctx, state.exit.x, state.exit.y, state.exit.w, state.exit.h, 5, '#143f3a', '#9fe3bd');
    ctx.fillStyle = '#b8f1cb'; ctx.fillRect(state.exit.x + 8, state.exit.y + 8, 26, 3);
    ctx.fillRect(state.exit.x + 8, state.exit.y + 8, 3, 33); ctx.fillRect(state.exit.x + 31, state.exit.y + 8, 3, 33);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#c5d4cd'; ctx.font = '11px "DM Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('EXIT', state.exit.x + state.exit.w / 2, state.exit.y - 8);
  }
  roundedRect(ctx, state.enemy.x, state.enemy.y, state.enemy.w, state.enemy.h, 6, '#e87965');
  ctx.fillStyle = '#381f21'; ctx.fillRect(state.enemy.x + 7, state.enemy.y + 9, 4, 4); ctx.fillRect(state.enemy.x + 20, state.enemy.y + 9, 4, 4);
  ctx.fillStyle = '#ffc0a7'; ctx.fillRect(state.enemy.x + 10, state.enemy.y + 21, 11, 2);
  const blink = state.player.invulnerable > 0 && Math.floor(state.elapsed * 16) % 2 === 0;
  if (!blink) {
    if (!state.player.shieldUsed) {
      ctx.beginPath(); ctx.strokeStyle = 'rgba(159, 227, 189, .75)'; ctx.lineWidth = 2;
      ctx.arc(state.player.x + state.player.w / 2, state.player.y + state.player.h / 2, 22, 0, Math.PI * 2); ctx.stroke();
    }
    roundedRect(ctx, state.player.x, state.player.y, state.player.w, state.player.h, 7, '#b7edc8');
    ctx.fillStyle = '#203b32'; ctx.fillRect(state.player.x + (state.player.facing > 0 ? 15 : 5), state.player.y + 10, 4, 4);
    ctx.fillStyle = '#6daf88'; ctx.fillRect(state.player.x + 4, state.player.y + 27, 7, 5); ctx.fillRect(state.player.x + 15, state.player.y + 27, 7, 5);
  }
  ctx.restore();

  const voidFall = (state.mode === 'collect' || state.mode === 'collapse') ? (state.player.y - state.player.groundY) / state.voidDeathDepth : 0;
  if (voidFall > 0.15) {
    const depth = Math.min(1, voidFall);
    const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.25, width / 2, height / 2, height * 0.85);
    vignette.addColorStop(0, 'rgba(6, 8, 14, 0)');
    vignette.addColorStop(1, `rgba(6, 8, 14, ${(depth * 0.9).toFixed(2)})`);
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffad9f'; ctx.font = '500 12px "DM Mono", monospace';
    ctx.fillText('FALLING INTO THE VOID', width / 2, height - 28);
  }
  if (state.owned.compass && (state.mode === 'collect' || state.mode === 'collapse')) drawCompass(ctx, state, width);
  if (state.mode === 'ready') drawOverlay(ctx, width, height, 'UPDRAFT', 'Collect every pale dot to start the collapse.', 'Press ENTER to drop in');
  if (state.mode === 'dead') drawOverlay(ctx, width, height, 'RUN ENDED', 'You fell into the void or were struck by the enemy.', `Credits banked: ${state.credits}  ·  Press ENTER to retry`);
  if (state.mode === 'escaped') drawOverlay(ctx, width, height, 'ARENA CLEARED', 'The exit is yours. Spend your credits on upgrades.', 'Press ENTER to continue');
  if (state.mode === 'shop') drawShop(ctx, state, width, height, roundedRect);
  if (state.messageTimer > 0 && state.mode === 'collapse') {
    roundedRect(ctx, 336, 24, 288, 42, 6, 'rgba(18, 32, 34, .9)', '#527165');
    ctx.fillStyle = '#c8f0d5'; ctx.font = '14px "Space Grotesk", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Collapse! Return to the start.', width / 2, 51);
  }
  if (state.mode === 'collect' || state.mode === 'collapse') {
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(238, 242, 231, .64)'; ctx.font = '11px "DM Mono", monospace';
    ctx.fillText(`ENDLESS  /  ROUND ${String(state.round).padStart(2, '0')}`, width - 20, 24);
  }
}