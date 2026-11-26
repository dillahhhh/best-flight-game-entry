// SUNSET STRAIT — features.js
// The visible systems that turn a flight into decisions: a live minimap,
// floating score popups, and the pause/help overlay. Every one of them is
// drawn from live game state — nothing here is a dead decoration.

// ---- minimap: plane, rings, runway and islands, bottom-left ----
// World bounds of the chart: x -3200..2300, z -5200..3000.
function drawMinimap(ctx, plane, world, passed, W, H) {
  const mw = 196, mh = 148;
  const mx = 16, my = H - mh - 16;
  const X = (x) => mx + ((x + 3200) / 5500) * mw;
  const Z = (z) => my + ((z + 5200) / 8200) * mh;
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,28,0.72)';
  roundRect(ctx, mx, my, mw, mh, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,130,0.4)'; ctx.lineWidth = 1;
  roundRect(ctx, mx, my, mw, mh, 8); ctx.stroke();
  ctx.save();
  roundRect(ctx, mx, my, mw, mh, 8); ctx.clip();
  // Sea.
  ctx.fillStyle = '#0e3a4a';
  ctx.fillRect(mx, my, mw, mh);
  // Islands as filled blobs (west + north + lighthouse rock).
  ctx.fillStyle = '#4d7a3d';
  ctx.beginPath(); ctx.ellipse(X(-1500), Z(700), 1600 / 5500 * mw, 1600 / 8200 * mh, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5d8148';
  ctx.beginPath(); ctx.ellipse(X(500), Z(-3700), 1350 / 5500 * mw, 1350 / 8200 * mh, 0, 0, Math.PI * 2); ctx.fill();
  // Runway strip.
  const rw = world.runway;
  ctx.strokeStyle = '#f2f2e8'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(X(rw.x), Z(rw.z - rw.len / 2));
  ctx.lineTo(X(rw.x), Z(rw.z + rw.len / 2));
  ctx.stroke();
  // Rings: green when cleared, amber for the next one, dim for the rest.
  const next = passed.findIndex((p) => !p);
  for (let i = 0; i < world.rings.length; i++) {
    const R = world.rings[i];
    ctx.fillStyle = passed[i] ? '#39d353' : i === next ? '#ffb020' : 'rgba(255,176,32,0.35)';
    ctx.beginPath(); ctx.arc(X(R.x), Z(R.z), i === next ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Plane: a white triangle rotated by heading.
  ctx.translate(X(plane.x), Z(plane.z));
  ctx.rotate(Math.PI - plane.yaw);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // North arrow + label.
  ctx.fillStyle = '#ffe1a8';
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('N ↑', mx + 6, my + 13);
  ctx.fillText('STRAIT CHART', mx + mw - 78, my + 13);
  ctx.restore();
}

// ---- score popups: "+100" floats up from the ring just threaded ----
// popups: [{x, y, z, text, until}] in world space; drawn while nowSec < until.
function drawScorePopups(ctx, cam, popups, nowSec) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of popups) {
    if (nowSec >= p.until) continue;
    const pt = cam.project(p.x, p.y, p.z);
    if (!pt) continue;
    const age = 1 - (p.until - nowSec) / 1.2;
    const y = pt.y - age * 46;
    ctx.globalAlpha = clamp(1 - age, 0, 1);
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillStyle = 'rgba(8,14,28,0.7)';
    const tw = ctx.measureText(p.text).width;
    roundRect(ctx, pt.x - tw / 2 - 10, y - 20, tw + 20, 40, 8); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillText(p.text, pt.x, y);
  }
  ctx.restore();
}

// ---- help overlay (H): every control, the mission, fuel and wind ----
function drawHelp(ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,24,0.72)';
  ctx.fillRect(0, 0, W, H);
  const pw = 620, ph = 430, px = (W - pw) / 2, py = (H - ph) / 2;
  ctx.fillStyle = 'rgba(12,16,28,0.95)';
  roundRect(ctx, px, py, pw, ph, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,110,0.5)'; ctx.lineWidth = 1.5;
  roundRect(ctx, px, py, pw, ph, 14); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('HOW TO FLY KAKATUA-9', px + 28, py + 44);
  ctx.fillStyle = '#ffe1a8';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillText('MISSION — Thread 6 rings along the coast, then land on the island runway.', px + 28, py + 74);
  const rows = [
    ['← → / A D', 'Bank — banking turns the plane'],
    ['↑ ↓ / W S', 'Pitch — pull back to climb'],
    ['SHIFT / CTRL', 'Throttle up / down'],
    ['MOUSE (click)', 'Steer with the mouse'],
    ['G', 'Landing gear — land with it DOWN'],
    ['F', 'Flaps — slower, steadier landing'],
    ['B (hold)', 'Speedbrake — shed speed fast'],
    ['C', 'Cockpit / chase camera'],
    ['P', 'Pause'],
    ['R', 'Restart'],
    ['H', 'Close this help'],
  ];
  ctx.font = '15px Arial, sans-serif';
  let y = py + 108;
  for (const [key, desc] of rows) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText(key, px + 28, y);
    ctx.fillStyle = '#c9d4e8';
    ctx.font = '15px Arial, sans-serif';
    ctx.fillText(desc, px + 190, y);
    y += 26;
  }
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText('Fuel burns with throttle — mind the gauge. Wind blows from the west (8 kt).', px + 28, py + ph - 22);
  ctx.restore();
}
