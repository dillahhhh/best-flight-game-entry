// SUNSET STRAIT — hud.js
// The HUD and the lit instrument panel: altitude / speed / heading chips,
// an altimeter, an airspeed dial, a compass tape and an artificial horizon,
// all drawn on the game canvas with a warm amber backlight. Plus the
// title, crash and landing screens and the centre message banners.

function drawChip(ctx, x, y, label, value, unit, w) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,28,0.62)';
  roundRect(ctx, x, y, w, 52, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,130,0.35)'; ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, 52, 8); ctx.stroke();
  ctx.fillStyle = '#ffb85e';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, x + 10, y + 17);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillText(value, x + 10, y + 43);
  // Measure the value in ITS OWN (24px) font: measuring after switching
  // to the 12px unit font under-measures and the unit overlaps the value.
  const valueW = ctx.measureText(value).width;
  ctx.fillStyle = '#c9d4e8';
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.fillText(unit, x + 10 + valueW + 6, y + 43);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHud(ctx, plane, score, ringsGot, ringsTotal, timeSec, objective, nowSec) {
  const w = ctx.canvas.width;
  const altFt = Math.max(0, Math.round(plane.y * 3.281));
  const spdKt = Math.round(plane.speed * 1.944);
  const hdg = Math.round(((deg(plane.yaw) % 360) + 360) % 360);
  drawChip(ctx, 16, 14, 'ALTITUDE', String(altFt), 'FT', 148);
  drawChip(ctx, 172, 14, 'AIRSPEED', String(spdKt), 'KT', 148);
  drawChip(ctx, 328, 14, 'HEADING', String(hdg).padStart(3, '0'), '°', 128);
  drawChip(ctx, 464, 14, 'THROTTLE', Math.round(plane.throttle * 100) + '', '%', 128);
  // Fuel chip with a burn bar: green > 50, amber 25-50, red + flashing below 25.
  const fuel = Math.max(0, Math.round(plane.fuel));
  const lowFuel = fuel < 25;
  const flash = lowFuel && Math.floor(nowSec * 2) % 2 === 0;
  drawChip(ctx, 608, 14, 'FUEL', String(fuel), '%', 128);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(618, 52, 108, 5);
  ctx.fillStyle = flash ? '#ff2e2e' : fuel > 50 ? '#39d353' : fuel >= 25 ? '#ffb020' : '#ff2e2e';
  ctx.fillRect(618, 52, 108 * fuel / 100, 5);
  if (flash) {
    ctx.strokeStyle = '#ff2e2e'; ctx.lineWidth = 2;
    roundRect(ctx, 608, 14, 128, 52, 8); ctx.stroke();
  }
  ctx.restore();
  // Wind chip: direction the wind blows FROM, plus its speed.
  drawChip(ctx, 744, 14, 'WIND', String(WORLD.wind.fromDeg) + '°', WORLD.wind.speedKt + ' KT', 148);
  // Right side: rings + score + time.
  drawChip(ctx, w - 268, 14, 'RINGS', ringsGot + '/' + ringsTotal, '', 124);
  drawChip(ctx, w - 136, 14, 'SCORE', String(score), '', 120);
  // Objective line under the chips.
  ctx.save();
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,14,28,0.6)';
  const tw = ctx.measureText(objective).width;
  roundRect(ctx, w / 2 - tw / 2 - 14, 76, tw + 28, 28, 8); ctx.fill();
  ctx.fillStyle = '#ffe1a8';
  ctx.textBaseline = 'middle';
  ctx.fillText(objective, w / 2, 91);
  ctx.restore();
  // Low-fuel warning under the objective line.
  if (lowFuel) {
    ctx.save();
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = flash ? '#ff5a3c' : '#ffb020';
    ctx.fillText('LOW FUEL — LAND AT THE RUNWAY SOON', w / 2, 122);
    ctx.restore();
  }
  // Timer, bottom-right.
  const mm = String(Math.floor(timeSec / 60)).padStart(2, '0');
  const ss = String(Math.floor(timeSec % 60)).padStart(2, '0');
  ctx.save();
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`TIME ${mm}:${ss}`, w - 16, ctx.canvas.height - 16);
  ctx.restore();
}

// ---- lit instrument panel (bottom centre) ----
// The amber panel glow depends only on the panel box: cache it per box.
let _panelGlow = null, _panelGlowKey = '';
function drawInstruments(ctx, plane, w, h, cockpit) {
  const pw = cockpit ? 560 : 420;
  const ph = cockpit ? 132 : 96;
  const px = (w - pw) / 2, py = h - ph - 12;
  ctx.save();
  const glowKey = `${px},${py},${pw},${ph}`;
  if (!_panelGlow || _panelGlowKey !== glowKey) {
    const glow = ctx.createRadialGradient(w / 2, py + ph / 2, 10, w / 2, py + ph / 2, pw * 0.6);
    glow.addColorStop(0, 'rgba(255,170,80,0.20)');
    glow.addColorStop(1, 'rgba(255,170,80,0)');
    _panelGlow = glow; _panelGlowKey = glowKey;
  }
  ctx.fillStyle = _panelGlow;
  ctx.fillRect(px - 40, py - 40, pw + 80, ph + 80);
  ctx.fillStyle = 'rgba(12,16,28,0.88)';
  roundRect(ctx, px, py, pw, ph, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,110,0.45)'; ctx.lineWidth = 1.5;
  roundRect(ctx, px, py, pw, ph, 12); ctx.stroke();
  const cy = py + ph / 2;
  const r = (ph - 26) / 2;
  // Artificial horizon (left).
  drawHorizon(ctx, px + 12 + r, cy, r, plane.pitch, plane.roll);
  // Altimeter dial.
  drawDial(ctx, px + 24 + r * 2 + r, cy, r, Math.max(0, plane.y * 3.281), 0, 9000, 'ALT', 'FT');
  // Airspeed dial.
  drawDial(ctx, px + 36 + r * 4 + r, cy, r, plane.speed * 1.944, 0, 200, 'SPD', 'KT');
  // Compass tape (right), leaving room for the GEAR / FULL lamps.
  const tx = px + 48 + r * 6 + 6, tw = pw - (48 + r * 6 + 6) - 46;
  drawCompass(ctx, tx, py + 14, tw, ph - 28, plane.yaw);
  // Gear / flap / speedbrake / full-throttle lamps.
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.textAlign = 'center';
  lamp(ctx, px + pw - 30, py + 14, plane.gearDown, 'GEAR');
  lamp(ctx, px + pw - 30, py + 34, plane.flaps, 'FLAP');
  lamp(ctx, px + pw - 30, py + 54, plane.speedbrake, 'BRK');
  lamp(ctx, px + pw - 30, py + 74, plane.throttle > 0.85, 'FULL');
  ctx.restore();
}

function lamp(ctx, x, y, on, label) {
  ctx.fillStyle = on ? '#39d353' : 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = on ? '#b8ffce' : 'rgba(255,255,255,0.45)';
  ctx.font = 'bold 9px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 9, y + 3);
}

function drawHorizon(ctx, x, y, r, pitch, roll) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-roll);
  const off = clamp(pitch, -0.6, 0.6) * r * 1.4;
  ctx.fillStyle = '#2b4a6b';
  ctx.fillRect(-r, -r + off, r * 2, r);
  ctx.fillStyle = '#c97a2e';
  ctx.fillRect(-r, off, r * 2, r);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-r, off); ctx.lineTo(r, off); ctx.stroke();
  ctx.restore();
  // Fixed wings marker.
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, 0); ctx.lineTo(-r * 0.2, 0);
  ctx.moveTo(r * 0.2, 0); ctx.lineTo(r * 0.55, 0);
  ctx.moveTo(0, -3); ctx.lineTo(0, 3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,190,110,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawDial(ctx, x, y, r, value, min, max, label, unit) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#101828'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,110,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  // Ticks.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const x0 = x + Math.cos(a) * (r - 3), y0 = y + Math.sin(a) * (r - 3);
    const x1 = x + Math.cos(a) * (r - 8), y1 = y + Math.sin(a) * (r - 8);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // Needle.
  const frac = clamp((value - min) / (max - min), 0, 1);
  const a = Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10)); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + r * 0.45);
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.fillStyle = '#ffd98a';
  ctx.fillText(String(Math.round(value)), x, y - r * 0.42);
  ctx.restore();
}

function drawCompass(ctx, x, y, w, h, yaw) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(16,24,40,0.9)';
  ctx.fillRect(x, y, w, h);
  const hdg = ((deg(yaw) % 360) + 360) % 360;
  const pxPerDeg = w / 90;
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 5) {
    const hd = Math.round((hdg + d) / 5) * 5;
    const off = ((hd - hdg + 540) % 360) - 180;
    const sx = x + w / 2 + off * pxPerDeg;
    if (sx < x - 10 || sx > x + w + 10) continue;
    const major = hd % 30 === 0;
    ctx.strokeStyle = major ? '#ffd98a' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(sx, y + 6); ctx.lineTo(sx, y + (major ? 18 : 12)); ctx.stroke();
    if (major) {
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      const hh = ((hd % 360) + 360) % 360;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(names[hh] || String(hh).padStart(3, '0'), sx, y + h - 8);
    }
  }
  // Centre lubber line.
  ctx.fillStyle = '#ff5a3c';
  ctx.fillRect(x + w / 2 - 1, y + 2, 2, h - 4);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,190,110,0.5)';
  ctx.strokeRect(x, y, w, h);
}

// ---- banners & screens ----
function drawBanner(ctx, text, sub, w, h) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.fillStyle = 'rgba(8,14,28,0.65)';
  const tw = ctx.measureText(text).width;
  roundRect(ctx, w / 2 - tw / 2 - 20, h * 0.3 - 30, tw + 40, 58, 10); ctx.fill();
  ctx.fillStyle = '#ffe1a8';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h * 0.3);
  if (sub) {
    ctx.font = 'bold 17px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, w / 2, h * 0.3 + 42);
  }
  ctx.restore();
}

function drawTitle(ctx, w, h, time) {
  ctx.save();
  // Title shade is static per canvas size: cache the gradient.
  const key = `${w}x${h}`;
  if (drawTitle._gradKey !== key) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(10,12,30,0.25)');
    g.addColorStop(0.55, 'rgba(10,12,30,0)');
    g.addColorStop(1, 'rgba(10,12,30,0.55)');
    drawTitle._grad = g; drawTitle._gradKey = key;
  }
  ctx.fillStyle = drawTitle._grad;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('M A K E . F U N   P R E S E N T S', w / 2, h * 0.2);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px Arial, sans-serif';
  ctx.shadowColor = 'rgba(255,150,60,0.8)'; ctx.shadowBlur = 34;
  ctx.fillText('SUNSET STRAIT', w / 2, h * 0.2 + 88);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillStyle = '#ffe1a8';
  ctx.shadowColor = 'rgba(10,10,25,0.9)'; ctx.shadowBlur = 10;
  ctx.fillText('Fly the golden coast. Thread six rings. Land on the island runway.', w / 2, h * 0.2 + 132);
  ctx.shadowBlur = 0;
  const blink = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.globalAlpha = blink;
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PRESS ENTER OR CLICK TO FLY', w / 2, h * 0.80);
  ctx.globalAlpha = 1;
  ctx.font = '15px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('← → bank  •  ↑ ↓ pitch  •  SHIFT / CTRL throttle  •  MOUSE steer  •  G gear  •  F flaps  •  B brake  •  C cockpit  •  H help  •  R restart  •  P pause', w / 2, h * 0.80 + 34);
  ctx.restore();
}

function drawEnd(ctx, w, h, kind, score, ringsGot, ringsTotal, timeSec) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,24,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  if (kind === 'landed') {
    ctx.fillStyle = '#7dff9b';
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.fillText('TOUCHDOWN!', w / 2, h * 0.34);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('You landed Kakatua-9 on the island runway.', w / 2, h * 0.34 + 48);
  } else {
    ctx.fillStyle = '#ff7a5c';
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.fillText('CRASHED', w / 2, h * 0.34);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(kind === 'sea' ? 'Kakatua-9 ditched into the strait.'
      : kind === 'gear' ? 'Kakatua-9 touched down gear-up — lower the gear (G) to land.'
      : 'Kakatua-9 hit the hillside.', w / 2, h * 0.34 + 48);
  }
  const mm = String(Math.floor(timeSec / 60)).padStart(2, '0');
  const ss = String(Math.floor(timeSec % 60)).padStart(2, '0');
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillStyle = '#ffe1a8';
  ctx.fillText(`SCORE ${score}   •   RINGS ${ringsGot}/${ringsTotal}   •   TIME ${mm}:${ss}`, w / 2, h * 0.34 + 96);
  if (kind === 'landed') {
    // Itemised landing score: rings + landing bonus + time bonus.
    const ringsPts = ringsGot * 100;
    const timeBonus = Math.max(0, 300 - Math.floor(timeSec));
    const landBonus = score - ringsPts - timeBonus;
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillStyle = '#c9d4e8';
    ctx.fillText(`RINGS ${ringsGot} × 100 = ${ringsPts}   •   LANDING +${landBonus}   •   TIME BONUS +${timeBonus}`, w / 2, h * 0.34 + 128);
  }
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(Date.now() / 300);
  ctx.fillText('PRESS R TO FLY AGAIN', w / 2, h * 0.34 + 168);
  ctx.restore();
}
