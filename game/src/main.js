// SUNSET STRAIT — main.js
// Game loop, input, cameras, states and the render pipeline.
// States: title (autopilot attract mode) -> fly -> landed / crashed.
// ?shot=chase|cockpit|rings|landing freezes a composed frame for screenshots.

(function () {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const SHOT = params.get('shot');
  const SHOT_TIME = 8.0; // frozen clock for screenshot frames

  const world = buildWorld();
  const plane = makePlane(world);
  const cam = makeCamera(62, 1280, 720);
  const vertCache = new Array((world.NX + 1) * (world.NZ + 1));

  let W = 1280, H = 720;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W; canvas.height = H;
    cam.resize(W, H);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- game state ----
  let state = 'title'; // title | fly | landed | crashed
  let cockpit = false;
  let paused = false;
  let mouseSteer = false;
  let score = 0, ringsGot = 0, timeSec = 0, endTimer = 0;
  let banner = null, bannerUntil = 0;
  const passed = [false, false, false, false, false, false];
  let prevRingDist = null;

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
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
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
    prevRingDist = null;
    state = 'fly';
    banner = 'FLY THE COAST — THREAD RING 1';
    bannerUntil = performance.now() / 1000 + 3;
    beep(660, 0.12, 'triangle', 0.1);
  }
  function restart() { startGame(); }

  // ---- autopilot: steer toward a target point (title attract + shots) ----
  function autopilot(tx, ty, tz) {
    const dx = tx - plane.x, dz = tz - plane.z;
    const wantYaw = Math.atan2(dx, -dz);
    let dyaw = wantYaw - plane.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const wantPitch = clamp((ty - plane.y) * 0.004, -0.25, 0.25);
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
      if (prevRingDist !== null && prevRingDist[i] > 0 && dz <= 0) {
        const dx = plane.x - R.x, dy = plane.y - R.y;
        if (Math.hypot(dx, dy) < R.r) {
          passed[i] = true; ringsGot++;
          score += 100;
          ringChime();
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
    prevRingDist = WORLD.rings.map((R) => plane.z - R.z);
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
    const f = plane.forward();
    let tx, ty, tz, tyaw, tpitch;
    if (cockpit) {
      tx = plane.x + f.x * 3; ty = plane.y + 1.6; tz = plane.z + f.z * 3;
      tyaw = plane.yaw; tpitch = plane.pitch * 0.8;
    } else {
      tx = plane.x - f.x * 30; ty = plane.y + 10 - plane.pitch * 12; tz = plane.z - f.z * 30;
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
    if (SHOT === 'cockpit') {
      cockpit = true;
      plane.x = 100; plane.y = 195; plane.z = -2250;
      plane.yaw = 0.02; plane.pitch = -0.02; plane.roll = 0.04;
      plane.speed = 58; plane.throttle = 0.68; plane.gearDown = true;
      for (let i = 0; i < 5; i++) passed[i] = true;
      ringsGot = 5; score = 500; timeSec = 148; state = 'fly';
    } else if (SHOT === 'rings') {
      plane.x = 55; plane.y = 252; plane.z = -920;
      plane.yaw = -0.04; plane.pitch = 0.02; plane.roll = -0.12;
      plane.speed = 62; plane.throttle = 0.72;
      for (let i = 0; i < 3; i++) passed[i] = true;
      ringsGot = 3; score = 300; timeSec = 96; state = 'fly';
    } else if (SHOT === 'landing') {
      // Cockpit view on short final: the runway fills the windscreen.
      cockpit = true;
      plane.x = 150; plane.y = 45; plane.z = -3050;
      plane.yaw = 0; plane.pitch = -0.03; plane.roll = 0;
      plane.speed = 40; plane.throttle = 0.35; plane.gearDown = true;
      for (let i = 0; i < 6; i++) passed[i] = true;
      ringsGot = 6; score = 600; timeSec = 212; state = 'fly';
    } else { // chase (default)
      plane.x = -30; plane.y = 215; plane.z = 880;
      plane.yaw = -0.03; plane.pitch = 0.01; plane.roll = -0.08;
      plane.speed = 56; plane.throttle = 0.65;
      for (let i = 0; i < 2; i++) passed[i] = true;
      ringsGot = 2; score = 200; timeSec = 44; state = 'fly';
    }
    updateCamera(0, true);
  }

  // ---- render ----
  function render(nowSec) {
    const items = [];
    drawSky(ctx, world, cam, nowSec);
    drawClouds(ctx, world, cam);
    drawSea(ctx, world, cam, nowSec);
    projectTerrain(world, cam, vertCache);
    drawTerrain(world, cam, vertCache, items);
    drawBuildings(ctx, world, cam, items);
    items.sort((a, b) => b.d - a.d);
    for (const it of items) {
      if (it.draw) it.draw();
      else drawPoly(ctx, it.pts, it.fill);
    }
    // Horizon haze: warm band where the sea meets the sky.
    const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    const hp = cam.project(cam.x + fx * 6000, 0, cam.z + fz * 6000);
    if (hp) {
      const hz = ctx.createLinearGradient(0, hp.y - 26, 0, hp.y + 30);
      hz.addColorStop(0, 'rgba(255,160,80,0)');
      hz.addColorStop(0.5, 'rgba(255,160,80,0.20)');
      hz.addColorStop(1, 'rgba(255,160,80,0)');
      ctx.fillStyle = hz;
      ctx.fillRect(0, hp.y - 26, W, 56);
    }
    drawRunway(ctx, world, cam);
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
    drawHud(ctx, plane, score, ringsGot, 6, timeSec, objective);
    drawInstruments(ctx, plane, W, H, cockpit);
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
    if (state === 'title') drawTitle(ctx, W, H, nowSec);
    if ((state === 'landed' || state === 'crashed') && endTimer <= 0) {
      drawEnd(ctx, W, H, state === 'landed' ? 'landed' : plane.crashReason,
        score, ringsGot, 6, timeSec);
    }
  }

  // ---- main loop ----
  let last = performance.now();
  let firstFrame = true;
  if (SHOT) applyShot();
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
        plane.update(dt, playerInput());
        checkRings();
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
    render(nowSec);
    requestAnimationFrame(frame);
  }
  updateCamera(0, true);
  requestAnimationFrame(frame);
})();
