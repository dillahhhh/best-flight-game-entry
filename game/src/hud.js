// hud.js — every DOM instrument: mission panel + objective checklist,
// compass strip, ALT/SPD/HDG readouts, fuel/damage/wind, throttle and
// gear/flap state, a live minimap, radio messages and the title/pause/
// win/crash screens. Big numerals stay readable at 300 px wide.

import { AIRFIELDS, EMBER_ARCH } from './terrain.js';

export function buildHud(root) {
  root.innerHTML = `
  <div id="hud-top">
    <div id="mission-panel" class="panel">
      <div id="mission-mode">RING RUN</div>
      <div id="mission-name">Harbour Ring Trial</div>
      <div id="mission-brief"></div>
      <div id="objectives"></div>
      <div id="score-line">SCORE <b id="score">0</b> &nbsp;·&nbsp; <span id="clock">0:00</span></div>
    </div>
    <div id="compass-wrap"><div id="compass"></div><div id="compass-needle">▲</div></div>
    <div id="sys-panel" class="panel">
      <div class="sys-row"><span>ENG</span><b id="sys-eng">—</b></div>
      <div class="sys-row"><span>FUEL</span><div class="bar"><i id="bar-fuel"></i></div><b id="sys-fuel">100%</b></div>
      <div class="sys-row"><span>DMG</span><div class="bar"><i id="bar-dmg"></i></div><b id="sys-dmg">0%</b></div>
      <div class="sys-row"><span>WIND</span><b id="sys-wind">300°/12KT</b></div>
      <div class="sys-row"><span>GEAR</span><b id="sys-gear">DOWN</b></div>
      <div class="sys-row"><span>FLAPS</span><b id="sys-flaps">UP</b></div>
    </div>
  </div>
  <div id="radio" class="hidden"></div>
  <div id="centre-msg"></div>
  <div id="hud-bottom">
    <div id="gauges" class="panel">
      <div class="gauge"><div class="g-label">ALTITUDE</div><div class="g-big"><span id="g-alt">0</span><small> FT</small></div><div class="g-sub">VS <span id="g-vs">0</span> FT/MIN</div></div>
      <div class="gauge"><div class="g-label">AIRSPEED</div><div class="g-big"><span id="g-spd">0</span><small> KT</small></div><div class="g-sub">THR <span id="g-thr">0</span>%</div></div>
      <div class="gauge"><div class="g-label">HEADING</div><div class="g-big"><span id="g-hdg">000</span><small>°</small></div><div class="g-sub">BANK <span id="g-bank">0</span>°</div></div>
      <div id="thr-wrap"><div class="g-label">THROTTLE</div><div id="thr-bar"><i id="thr-fill"></i></div></div>
    </div>
    <div id="minimap-wrap" class="panel"><canvas id="minimap" width="220" height="220"></canvas><div id="minimap-label">STRAIT MAP — N ↑</div></div>
  </div>
  <div id="hint">ARROWS pitch + bank &nbsp;·&nbsp; SHIFT / CTRL throttle &nbsp;·&nbsp; C camera &nbsp;·&nbsp; G gear &nbsp;·&nbsp; F flaps &nbsp;·&nbsp; B brakes &nbsp;·&nbsp; P pause &nbsp;·&nbsp; R restart &nbsp;·&nbsp; M sound &nbsp;·&nbsp; 1–8 missions</div>
  <div id="screen" class="hidden"></div>`;
  return {
    el: (id) => root.querySelector('#' + id),
    minimap: root.querySelector('#minimap'),
  };
}

function fmtClock(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ':' + String(s).padStart(2, '0');
}
function hdgDeg(heading) {
  let d = Math.round((heading * 180) / Math.PI) % 360;
  if (d < 0) d += 360;
  return d;
}

export function updateHud(hud, s, mission, opts) {
  const $ = hud.el;
  $('mission-mode').textContent = mission.mode + '  ·  MISSION ' + mission.id + '/8';
  $('mission-name').textContent = mission.name;
  $('mission-brief').textContent = mission.brief;
  const objs = [];
  mission.rings.forEach((r, i) => {
    objs.push(`<div class="obj ${i < s.ringIndex ? 'done' : i === s.ringIndex ? 'live' : ''}">${i < s.ringIndex ? '✓' : '○'} RING ${i + 1}/${mission.rings.length}</div>`);
  });
  const field = AIRFIELDS.find((f) => f.id === mission.landAt);
  objs.push(`<div class="obj ${s.landed ? 'done' : s.ringIndex >= mission.rings.length ? 'live' : ''}">${s.landed ? '✓' : '○'} LAND ${field.name.toUpperCase()}</div>`);
  $('objectives').innerHTML = objs.join('');
  $('score').textContent = s.score.toLocaleString('en-US');
  $('clock').textContent = fmtClock(s.time);

  // Compass strip: one tick every 30° of absolute heading, cardinal labels.
  const hd = hdgDeg(s.heading);
  let ticks = '';
  const start = Math.floor((hd - 90) / 30) * 30;
  for (let a = start; a <= hd + 90; a += 30) {
    const v = ((a % 360) + 360) % 360;
    const d = a - hd;
    const label = v % 90 === 0 ? ({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' })[v] : String(v).padStart(3, '0');
    ticks += `<span class="tick" style="left:${50 + d * 0.55}%">${label}<i></i></span>`;
  }
  // Half-ticks between labels.
  for (let a = start + 15; a <= hd + 90; a += 30) {
    const d = a - hd;
    ticks += `<span class="tick" style="left:${50 + d * 0.55}%"><i></i></span>`;
  }
  $('compass').innerHTML = ticks;

  $('sys-fuel').textContent = Math.round(s.fuel) + '%';
  $('bar-fuel').style.width = s.fuel + '%';
  $('bar-fuel').style.background = s.fuel < 25 ? '#ff5a4d' : '#7dff9a';
  $('sys-dmg').textContent = Math.round(s.damage) + '%';
  $('bar-dmg').style.width = s.damage + '%';
  $('sys-wind').textContent = `${mission.windDeg}°/${mission.windKts}KT${mission.gustKts ? ' G' + (mission.windKts + mission.gustKts) : ''}`;
  $('sys-eng').textContent = s.fuel <= 0 ? 'FLAMEOUT' : s.throttle > 0.7 ? 'MAX' : s.throttle > 0.3 ? 'CRUISE' : s.throttle > 0 ? 'IDLE' : 'OFF';
  $('sys-gear').textContent = s.gearDown ? 'DOWN' : 'UP';
  $('sys-flaps').textContent = s.flaps ? 'DOWN' : 'UP';

  $('g-alt').textContent = Math.max(0, Math.round(s.y * 3.28084)).toLocaleString('en-US');
  $('g-vs').textContent = Math.round(s.vspeed * 196.85);
  $('g-spd').textContent = Math.round(s.speedKts);
  $('g-thr').textContent = Math.round(s.throttle * 100);
  $('g-hdg').textContent = String(hd).padStart(3, '0');
  $('g-bank').textContent = Math.round((s.bank * 180) / Math.PI);
  $('thr-fill').style.height = s.throttle * 100 + '%';

  // Radio toast: newest message, 6 seconds.
  const radio = $('radio');
  if (s.message && s.time - s.messageAt < 6) {
    radio.classList.remove('hidden');
    radio.textContent = '📻 ' + s.message;
  } else radio.classList.add('hidden');
  const cm = $('centre-msg');
  if (s.finished) {
    cm.textContent = s.won ? '★ SORTIE COMPLETE ★' : s.crashed ? '✕ AIRCRAFT LOST' : 'LANDED';
    cm.className = s.won ? 'win' : 'lose';
  } else if (opts.paused) {
    cm.textContent = 'PAUSED — P TO RESUME';
    cm.className = 'pause';
  } else cm.textContent = '';

  drawMinimap(hud.minimap, s, mission);
}

export function drawMinimap(canvas, s, mission) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const toMap = (x, z) => [((x + 3000) / 6000) * W, ((z + 3000) / 6000) * H];
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0e2a44';
  ctx.fillRect(0, 0, W, H);
  // Island blobs (same centres as the real terrain, simplified).
  ctx.fillStyle = '#3f7a3a';
  const blobs = [[-1500, -1150, 42], [0, 620, 52], [1420, -560, 34], [980, 1560, 28], [-2350, 900, 22], [2300, 900, 20], [-700, 2100, 18], [2400, -1700, 19], [-2600, -1900, 16]];
  for (const [x, z, r] of blobs) {
    const [mx, my] = toMap(x, z);
    ctx.beginPath(); ctx.arc(mx, my, r * (W / 6000) * 2.4, 0, Math.PI * 2); ctx.fill();
  }
  // Volcano marker.
  const [vx, vy] = toMap(-1500, -1150);
  ctx.fillStyle = '#ff5a1a';
  ctx.beginPath(); ctx.arc(vx, vy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('BARA', vx + 7, vy + 3);
  // Ember Arch landmark marker (orange diamond + label).
  const [ax, ay] = toMap(EMBER_ARCH.x, EMBER_ARCH.z);
  ctx.fillStyle = '#ffb020';
  ctx.beginPath(); ctx.moveTo(ax, ay - 5); ctx.lineTo(ax + 5, ay); ctx.lineTo(ax, ay + 5); ctx.lineTo(ax - 5, ay); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('ARCH', ax + 7, ay + 3);
  // Runways.
  ctx.strokeStyle = '#f5f5f0'; ctx.lineWidth = 2;
  for (const f of AIRFIELDS) {
    const [fx, fy] = toMap(f.x, f.z);
    const a = (f.headingDeg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(fx - Math.sin(a) * 12, fy + Math.cos(a) * 12);
    ctx.lineTo(fx + Math.sin(a) * 12, fy - Math.cos(a) * 12);
    ctx.stroke();
  }
  // Rings: next ring gold, done green, later dim.
  mission.rings.forEach((r, i) => {
    const [rx, ry] = toMap(r.x, r.z);
    ctx.strokeStyle = i < s.ringIndex ? '#7dff9a' : i === s.ringIndex ? '#ffb020' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = i === s.ringIndex ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(rx, ry, 5, 0, Math.PI * 2); ctx.stroke();
  });
  // Plane arrow.
  const [px, py] = toMap(s.x, s.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(s.heading);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function showScreen(hud, html) {
  const sc = hud.el('screen');
  sc.innerHTML = html;
  sc.classList.remove('hidden');
}
export function hideScreen(hud) { hud.el('screen').classList.add('hidden'); }

export function titleScreenHtml() {
  return `
  <div class="screen-inner">
    <div class="title-kicker">EMBER STRAIT · VOLCANIC ARCHIPELAGO FLIGHT</div>
    <h1>EMBER STRAIT</h1>
    <p class="title-sub">Fly the Kestrel-9 floatplane across a living volcanic strait — 8 sorties, 4 modes,
    ring trials, island landings and a night freight run. Fuel burns, wind bites, the volcano smokes.</p>
    <div class="title-modes"><span>RING RUN</span><span>VOLCANO SURVEY</span><span>ISLAND HOPPER</span><span>NIGHT CARGO</span></div>
    <p class="title-keys">ENTER — fly &nbsp;·&nbsp; ARROWS pitch + bank &nbsp;SHIFT / CTRL throttle &nbsp;C camera &nbsp;1–8 missions &nbsp;?demo=1 autopilot</p>
    <p class="title-foot">MARA VOSS on tower · THEO spotting · DR. ILYA SORN at the crater</p>
  </div>`;
}
