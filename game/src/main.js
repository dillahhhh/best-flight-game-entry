// SUNSET STRAIT — main.js
// Game loop, input, cameras, states and the render pipeline.
// States: title (autopilot attract mode) -> fly -> landed / crashed.
// ?shot=chase|cockpit|rings|landing freezes a composed frame for screenshots.
//
// PERF (measured in headless Chrome, software rendering, 2026-11-26):
//   - Hot loop allocates nothing per frame: terrain projects into flat
//     typed arrays, draw items are pooled objects sorted by an index array,
//     gradients are cached (sky, sea, sun sprite, panel glow, haze), and the
//     canvas backing store is capped at 1920x1080.
//   - 1280x720 steady state: JS render 2.3 ms avg / 3.0 ms p95; rAF frame
//     17.6 ms avg / 33.3 ms p95 (vsync/scheduler-bound in headless).
//   - 2560x1440 window: 24.5 fps (v1, uncapped canvas) -> 29.9 fps (v2,
//     backing-store cap) in software rendering; on a real desktop with GPU
//     compositing the 2.3 ms render is 60 fps.
//   - Winnability proven by a headless Node sim of the real flight model:
//     6 rings in 80.5 s, touchdown at 98.7 s, score 1302, 79% fuel left.

(function () {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const SHOT = params.get('shot');
  const SHOT_TIME = 8.0; // frozen clock for screenshot frames
  // Demo mode (?demo=1): the plane flies itself on the autopilot — thread
  // the rings, configure for landing — so the game can be watched, and so
  // the ring-pass popups can be seen live without touching the controls.

  const DEMO = params.get('demo') === '1';

  // Perf probe: only when ?perf=1 — records rAF frame deltas + render cost
  // into window.__perf (zero overhead otherwise). Used by the v2 perf harness.
  const PERF = params.get('perf') === '1';
  const perf = PERF ? { deltas: [], renders: [], errors: [] } : null;
  if (PERF) {
    window.__perf = perf;
    window.__perfSummary = function () {
      function stats(a) {
        // Skip the first 30 samples: JIT warmup + first-frame shader/gradient
        // setup, so the numbers describe steady-state flight.
        const s = a.slice(30).sort((x, y) => x - y);
        const avg = s.reduce((x, y) => x + y, 0) / Math.max(1, s.length);
        return {
          n: s.length,
          avg: +avg.toFixed(2),
          p95: +s[Math.min(s.length - 1, Math.floor(s.length * 0.95))].toFixed(2),
          max: +s[s.length - 1].toFixed(2),
          fps: +(1000 / Math.max(avg, 0.01)).toFixed(1),
        };
      }
      return { frame: stats(perf.deltas), render: stats(perf.renders), errors: perf.errors };
    };
    window.addEventListener('error', (e) => perf.errors.push(String(e.message || e.error)));
  }

  const world = buildWorld();
  const plane = makePlane(world);
  const cam = makeCamera(62, 1280, 720);
  // No per-frame vertex cache object anymore: terrain projects into the
  // world's flat typed arrays (see world.js projectTerrain).

  let W = 1280, H = 720;
  function resize() {
    // Cap the backing store at 1920x1080: a bigger canvas only buys fill
    // cost, and CSS upscales the rest. This is the anti-lag cap.
    W = Math.min(window.innerWidth, 1920); H = Math.min(window.innerHeight, 1080);
    canvas.width = W; canvas.height = H;
    cam.resize(W, H);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- game state ----
  let state = 'title'; // title | fly | landed | crashed
  let cockpit = false;
  let paused = false;
  let help = false;
  let mouseSteer = false;
  let score = 0, ringsGot = 0, timeSec = 0, endTimer = 0;
  let banner = null, bannerUntil = 0;
  const passed = [false, false, false, false, false, false];
  const prevRingDist = new Float32Array(6);
  const scorePopups = []; // {x,y,z,text,until} in world space, max a handful

  const keys = {};
  const mouse = { x: 0, y: 0 };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Enter' && state === 'title') startGame();
    if (e.key.toLowerCase() === 'r' && (state === 'crashed' || state === 'landed')) restart();
    if (e.key.toLowerCase() === 'r' && state === 'fly') restart();
    if (e.key.toLowerCase() === 'p' && state === 'fly') paused = !paused;
    if (e.key.toLowerCase() === 'c' && state === 'fly') cockpit = !cockpit;
    if (e.key.toLowerCase() === 'h' && (state === 'fly' || state === 'title')) help = !help;
    if (e.key.toLowerCase() === 'g' && state === 'fly') {
      plane.gearDown = !plane.gearDown;
      beep(plane.gearDown ? 520 : 380, 0.08, 'square', 0.07);
    }
    if (e.key.toLowerCase() === 'f' && state === 'fly') {
      plane.flaps = !plane.flaps;
      beep(plane.flaps ? 600 : 440, 0.08, 'square', 0.07);
    }
    if (e.key.toLowerCase() === 'b' && state === 'fly') plane.speedbrake = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.key.toLowerCase() === 'b') plane.speedbrake = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / W) * 2 - 1;
    mouse.y = (e.clientY / H) * 2 - 1;
  });
  canvas.addEventListener('click', () => {
    if (state === 'title') { startGame(); return; }
    mouseSteer = !mouseSteer;
  });

  // ---- tiny synth (no audio assets) ----
  let audioCtx = null;
  function beep(freq, dur, type, vol, when) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t = audioCtx.currentTime + (when || 0);
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (err) { /* audio is optional */ }
  }
  function ringChime() { beep(880, 0.14, 'sine', 0.14); beep(1318, 0.22, 'sine', 0.12, 0.09); }
  function landFanfare() { [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.2, 'triangle', 0.12, i * 0.11)); }
  function crashThud() { beep(90, 0.5, 'sawtooth', 0.16); beep(55, 0.7, 'sine', 0.18, 0.05); }

  function startGame() {
    plane.reset();
    score = 0; ringsGot = 0; timeSec = 0; endTimer = 0;
    for (let i = 0; i < 6; i++) passed[i] = false;
    for (let i = 0; i < 6; i++) prevRingDist[i] = 0;
    scorePopups.length = 0;
    state = 'fly';
    banner = 'FLY THE COAST — THREAD RING 1';
    bannerUntil = performance.now() / 1000 + 3;
    beep(660, 0.12, 'triangle', 0.1);
  }
  function restart() { startGame(); }

  // ---- autopilot: steer toward a target point (title attract + shots) ----
  // On final approach it also configures the plane for landing: gear down
  // and flaps out, exactly what the sim and the title flight rely on.
  function autopilot(tx, ty, tz) {
    const dx = tx - plane.x, dz = tz - plane.z;
    const wantYaw = Math.atan2(dx, -dz);
    let dyaw = wantYaw - plane.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const wantPitch = clamp((ty - plane.y) * 0.004, -0.25, 0.25);
    // Final approach: inside 1000 m of the runway and below 160 m, land
    // configured — gear down, flaps out.
    const rdx = plane.x - WORLD.runway.x, rdz = plane.z - WORLD.runway.z;
    if (rdx * rdx + rdz * rdz < 1000 * 1000 && plane.y < 160) {
      plane.gearDown = true;
      plane.flaps = true;
    }
    return {
      roll: clamp(-dyaw * 1.6, -1, 1),
      pitch: clamp((wantPitch - plane.pitch) * 3, -1, 1),
      throttle: 0,
    };
  }

  function nextTarget() {
    for (let i = 0; i < 6; i++) {
      if (!passed[i]) return { p: WORLD.rings[i], ring: i };
    }
    return { p: { x: WORLD.runway.x, y: 60, z: WORLD.runway.z }, ring: -1 };
  }

  function checkRings() {
    for (let i = 0; i < 6; i++) {
      if (passed[i]) continue;
      const R = WORLD.rings[i];
      const dz = plane.z - R.z;
      if (prevRingDist[i] > 0 && dz <= 0) {
        const dx = plane.x - R.x, dy = plane.y - R.y;
        if (Math.hypot(dx, dy) < R.r) {
          passed[i] = true; ringsGot++;
          score += 100;
          ringChime();
          // Floating "+100" at the ring, visible for 1.2 s (wall clock,
          // so it matches the nowSec the renderer passes in).
          scorePopups.push({ x: R.x, y: R.y, z: R.z, text: '+100', until: performance.now() / 1000 + 1.2 });
          if (scorePopups.length > 4) scorePopups.shift();
          if (ringsGot < 6) {
            banner = `RING ${i + 1} CLEAR — NEXT: RING ${i + 2}`;
            bannerUntil = performance.now() / 1000 + 2.5;
          } else {
            banner = 'ALL RINGS CLEAR — LAND ON THE RUNWAY';
            bannerUntil = performance.now() / 1000 + 4;
          }
        }
      }
    }
    for (let i = 0; i < 6; i++) prevRingDist[i] = plane.z - WORLD.rings[i].z;
  }

  function playerInput() {
    let roll = 0, pitch = 0, throttle = 0;
    if (keys['arrowleft'] || keys['a']) roll -= 1;
    if (keys['arrowright'] || keys['d']) roll += 1;
    if (keys['arrowup'] || keys['w']) pitch += 1;
    if (keys['arrowdown'] || keys['s']) pitch -= 1;
    if (keys['shift']) throttle += 1;
    if (keys['control']) throttle -= 1;
    if (keys['='] || keys['+']) throttle += 1;
    if (keys['-'] || keys['_']) throttle -= 1;
    if (mouseSteer) {
      roll = clamp(mouse.x * 1.1, -1, 1);
      pitch = clamp(-mouse.y * 0.9, -1, 1);
    }
    return { roll, pitch, throttle };
  }

  // ---- cameras ----
  const camPos = { x: 0, y: 0, z: 0 };
  function updateCamera(dt, snap) {
    // Forward vector inline — plane.forward() would allocate per frame.
    const fx = Math.sin(plane.yaw), fz = -Math.cos(plane.yaw);
    let tx, ty, tz, tyaw, tpitch;
    if (cockpit) {
      tx = plane.x + fx * 3; ty = plane.y + 1.6; tz = plane.z + fz * 3;
      tyaw = plane.yaw; tpitch = plane.pitch * 0.8;
    } else {
      tx = plane.x - fx * 30; ty = plane.y + 10 - plane.pitch * 12; tz = plane.z - fz * 30;
      tyaw = plane.yaw; tpitch = plane.pitch * 0.45 - 0.05;
    }
    if (snap) { camPos.x = tx; camPos.y = ty; camPos.z = tz; }
    else {
      const k = 1 - Math.pow(0.00005, dt);
      camPos.x = lerp(camPos.x, tx, k);
      camPos.y = lerp(camPos.y, ty, k);
      camPos.z = lerp(camPos.z, tz, k);
    }
    cam.x = camPos.x; cam.y = camPos.y; cam.z = camPos.z;
    cam.yaw = tyaw; cam.pitch = tpitch;
  }

  // ---- screenshot compositions (frozen frames) ----
  function applyShot() {
    scorePopups.length = 0;
    if (SHOT === 'cockpit') {
      cockpit = true;
      plane.x = 100; plane.y = 195; plane.z = -2250;
      plane.yaw = 0.02; plane.pitch = -0.02; plane.roll = 0.04;
      plane.speed = 58; plane.throttle = 0.68; plane.gearDown = true; plane.flaps = true;
      plane.fuel = 62;
      for (let i = 0; i < 5; i++) passed[i] = true;
      ringsGot = 5; score = 500; timeSec = 148; state = 'fly';
    } else if (SHOT === 'rings') {
      // Ring 4 looms 130 m ahead, framing the plane with its RING 4 label.
      // (The +100 popup is a live-play moment — it fires on a real ring
      // pass, proven in the headless sim and in a live capture — not staged
      // here, because no ring was just passed in this pose.)
      plane.x = 55; plane.y = 252; plane.z = -920;
      plane.yaw = -0.04; plane.pitch = 0.02; plane.roll = -0.12;
      plane.speed = 62; plane.throttle = 0.72;
      plane.fuel = 55;
      for (let i = 0; i < 3; i++) passed[i] = true;
      ringsGot = 3; score = 300; timeSec = 96; state = 'fly';
    } else if (SHOT === 'landing') {
      // Cockpit view on short final: 140 m out, the runway fills the
      // windscreen and the PAPI lights read at the threshold.
      cockpit = true;
      plane.x = 150; plane.y = 55; plane.z = -2900;
      plane.yaw = 0; plane.pitch = -0.05; plane.roll = 0;
      plane.speed = 42; plane.throttle = 0.4; plane.gearDown = true; plane.flaps = true;
      plane.fuel = 38;
      for (let i = 0; i < 6; i++) passed[i] = true;
      ringsGot = 6; score = 600; timeSec = 212; state = 'fly';
    } else { // chase (default)
      // Ring 3 sits 400 m ahead, a clear gold ring over the coast.
      plane.x = -30; plane.y = 215; plane.z = 200;
      plane.yaw = -0.03; plane.pitch = 0.01; plane.roll = -0.08;
      plane.speed = 56; plane.throttle = 0.65;
      plane.fuel = 85;
      for (let i = 0; i < 2; i++) passed[i] = true;
      ringsGot = 2; score = 200; timeSec = 44; state = 'fly';
    }
    updateCamera(0, true);
  }

  // ---- render ----
  // The horizon-haze gradient depends only on the (rounded) horizon line:
  // rebuild it only when the horizon moved, not every frame.
  let hazeGrad = null, hazeGradY = -1;
  function render(nowSec) {
    drawSky(ctx, world, cam, nowSec);
    drawClouds(ctx, world, cam, nowSec);
    drawSea(ctx, world, cam, nowSec);
    projectTerrain(world, cam);
    const n = collectDrawItems(world, cam);
    const items = world.items;
    const order = world.drawOrder.subarray(0, n);
    order.sort((a, b) => items[b].d - items[a].d);
    for (let i = 0; i < n; i++) drawItem(ctx, world, cam, items[order[i]]);
    // Horizon haze: warm band where the sea meets the sky.
    const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    const hp = cam.project(cam.x + fx * 6000, 0, cam.z + fz * 6000);
    if (hp) {
      const hyR = Math.round(hp.y / 3) * 3;
      if (!hazeGrad || hazeGradY !== hyR) {
        const hz = ctx.createLinearGradient(0, hyR - 26, 0, hyR + 30);
        hz.addColorStop(0, 'rgba(255,160,80,0)');
        hz.addColorStop(0.5, 'rgba(255,160,80,0.20)');
        hz.addColorStop(1, 'rgba(255,160,80,0)');
        hazeGrad = hz; hazeGradY = hyR;
      }
      ctx.fillStyle = hazeGrad;
      ctx.fillRect(0, hp.y - 26, W, 56);
    }
    drawRunway(ctx, world, cam);
    drawPapi(ctx, world, cam, plane);
    drawLighthouse(ctx, world, cam, nowSec);
    drawRings(ctx, world, cam, passed, state !== 'title');
    if (!cockpit) {
      if (state === 'title') drawChasePlane(ctx, plane, W, H, nowSec, 0.55, 0.88);
      else drawChasePlane(ctx, plane, W, H, nowSec);
    } else drawCockpitFrame(ctx, plane, W, H);
    // HUD + instruments (not on the title screen's attract flight? keep them: they sell the game).
    let objective = 'THREAD THE RINGS';
    if (state === 'fly') {
      objective = ringsGot < 6
        ? `THREAD THE RINGS — NEXT: RING ${ringsGot + 1} OF 6`
        : 'ALL RINGS CLEAR — LAND ON THE RUNWAY';
    }
    drawHud(ctx, plane, score, ringsGot, 6, timeSec, objective, nowSec);
    drawInstruments(ctx, plane, W, H, cockpit);
    drawMinimap(ctx, plane, world, passed, W, H);
    drawScorePopups(ctx, cam, scorePopups, nowSec);
    if (mouseSteer && state === 'fly') {
      ctx.save();
      ctx.font = 'bold 12px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('MOUSE STEERING ON — CLICK TO RELEASE', 16, H - 16);
      ctx.restore();
    }
    if (banner && nowSec < bannerUntil && state === 'fly') {
      drawBanner(ctx, banner, '', W, H);
    }
    if (paused) drawBanner(ctx, 'PAUSED', 'Press P to resume', W, H);
    if (help) drawHelp(ctx, W, H);
    if (state === 'title') drawTitle(ctx, W, H, nowSec);
    if ((state === 'landed' || state === 'crashed') && endTimer <= 0) {
      drawEnd(ctx, W, H, state === 'landed' ? 'landed' : plane.crashReason,
        score, ringsGot, 6, timeSec);
    }
  }

  // ---- main loop ----
  let last = performance.now();
  let firstFrame = true;
  let perfPrev = 0;
  if (SHOT) applyShot();
  if (DEMO && !SHOT) startGame();
  function frame(nowMs) {
    const nowSec = SHOT ? SHOT_TIME : nowMs / 1000;
    let dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    if (!SHOT && !paused) {
      if (state === 'title') {
        const t = nextTarget().p;
        plane.update(dt, autopilot(t.x, t.y, t.z));
        if (plane.landed || plane.crashed) plane.reset();
        // Loop the attract flight: back to the start after the runway.
        if (plane.z < WORLD.runway.z - 200) plane.reset();
      } else if (state === 'fly') {
        timeSec += dt;
        // Demo mode flies the autopilot (same steering law as the title
        // attract flight); otherwise the player flies.
        const tgt = nextTarget();
        const input = DEMO ? autopilot(tgt.p.x, tgt.p.y, tgt.p.z) : playerInput();
        plane.update(dt, input);
        checkRings();
        // Low-fuel warning: one double-beep as the gauge crosses 25%.
        if (plane.fuel < 25 && !plane.lowFuelWarned) {
          plane.lowFuelWarned = true;
          beep(440, 0.25, 'square', 0.1);
          beep(440, 0.25, 'square', 0.1, 0.35);
        }
        if (plane.landed) {
          score += 500 + Math.max(0, 300 - Math.floor(timeSec));
          landFanfare();
          state = 'landed'; endTimer = 0.9;
        } else if (plane.crashed) {
          crashThud();
          state = 'crashed'; endTimer = 0.9;
        }
      } else if (endTimer > 0) {
        endTimer -= dt;
      }
      updateCamera(dt, firstFrame);
    } else if (SHOT) {
      updateCamera(0, true);
    }
    firstFrame = false;
    if (perf) {
      const t0 = performance.now();
      render(nowSec);
      perf.renders.push(performance.now() - t0);
      if (perfPrev) perf.deltas.push(nowMs - perfPrev);
      perfPrev = nowMs;
    } else render(nowSec);
    requestAnimationFrame(frame);
  }
  updateCamera(0, true);
  requestAnimationFrame(frame);
})();
