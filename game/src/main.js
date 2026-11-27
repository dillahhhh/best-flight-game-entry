// main.js — Ember Strait bootstrap and game loop.
// Owns the renderer, the cameras (chase / cockpit / orbit), the state
// machine (title -> flying -> paused / landed / crashed), the demo
// autopilot, the ?shot= presets and the measurement hooks the
// verification harness reads (window.__ember).

import * as THREE from 'three';
import { MISSIONS, newFlightState, stepFlight, autopilotInput, autopilotTarget } from './flight.js';
import { terrainHeight, AIRFIELDS } from './terrain.js';
import { buildWorld, applySkyPhase, buildRings, PHASE_ORDER } from './world.js';
import { buildPlane, posePlane } from './plane.js';
import { buildHud, updateHud, showScreen, hideScreen, titleScreenHtml } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { getShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot') ? Number(params.get('shot') || 1) : 0;
const DEMO = params.has('demo');
const SIM = params.has('sim');
const SIM_MISSION = Number(params.get('mission') || 1);

const canvasHost = document.getElementById('scene');
const hudRoot = document.getElementById('hud');
const dashEl = document.getElementById('cockpit-dash');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 12000);
const world = buildWorld(scene);
const plane = buildPlane();
scene.add(plane);

const hud = buildHud(hudRoot);
const inputCtl = createInput();
const audio = createAudio();

const game = {
  missionIndex: 0,
  mission: MISSIONS[0],
  state: null,
  mode: 'title', // title | flying | paused | over
  cameraMode: 'chase',
  frozen: false,
  phase: 'golden',
  time: 0,
  frameCount: 0,
  frameMsEMA: 0,
  worstMs: 0,
  ringPulse: 0,
  simResult: null,
  ready: false,
};
window.__ember = game;

// Live dashboard needles: each dial maps its value to -120..+120 deg.
const dialNeedles = [...document.querySelectorAll('#cockpit-dash .dial .needle')];
function updateDials(s) {
  if (!dialNeedles.length) return;
  const altFt = Math.max(0, s.y * 3.28084);
  const hd = ((Math.round((s.heading * 180) / Math.PI) % 360) + 360) % 360;
  const vals = [
    Math.min(1, altFt / 2500), // ALT 0..2500 ft
    Math.min(1, s.speedKts / 200), // SPD 0..200 kt
    hd / 360, // HDG 0..360 deg
    Math.max(0, Math.min(1, s.fuel / 100)), // FUEL 0..100%
  ];
  dialNeedles.forEach((n, i) => {
    n.style.transform = `rotate(${-120 + vals[i] * 240}deg)`;
  });
}

let ringGroup = null;
let ringMeshes = [];

function loadMission(i, keepState) {
  game.missionIndex = ((i % MISSIONS.length) + MISSIONS.length) % MISSIONS.length;
  game.mission = MISSIONS[game.missionIndex];
  if (ringGroup) { scene.remove(ringGroup.group); }
  const built = buildRings(scene, game.mission.rings);
  ringGroup = built.group; ringMeshes = built.meshes;
  game.phase = game.mission.timeOfDay;
  applySkyPhase(world, scene, game.phase);
  if (!keepState) game.state = newFlightState(game.mission);
  game.state.message = game.mission.radio[0];
  game.state.messageAt = 0;
}

function startFlying() {
  game.mode = 'flying';
  hideScreen(hud);
  audio.ensure();
}

function applyShot(n) {
  const shot = getShot(n);
  loadMission(shot.missionIndex);
  game.cameraMode = shot.camera;
  game.frozen = true;
  game.mode = 'flying';
  hideScreen(hud);
  const s = game.state;
  Object.assign(s, shot.pose);
  s.time = 42;
  s.message = shot.radio;
  s.messageAt = s.time;
  s.gearDown = true;
  applySkyPhase(world, scene, shot.phase);
  game.phase = shot.phase;
}

function updateCamera(dt) {
  const s = game.state;
  const fwd = new THREE.Vector3(Math.sin(s.heading), 0, -Math.cos(s.heading));
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3(s.x, s.y, s.z);
  let target, look;
  if (game.cameraMode === 'hero') {
    // Hero: rear-starboard 3/4 showcase — the whole floatplane big in
    // frame, seen from behind-starboard with the nose pointing up-frame
    // toward the next ring and the Ember Arch down-frame in the sea.
    // Deterministic: no time dependence, so a frozen shot renders
    // identically every load.
    plane.userData.canopy.visible = true;
    plane.userData.panelGlow.visible = true;
    const right = new THREE.Vector3(Math.cos(s.heading), 0, Math.sin(s.heading));
    target = pos.clone().addScaledVector(fwd, -20).addScaledVector(right, 19).add(new THREE.Vector3(0, 5, 0));
    // Look 5 m above the plane: it drops the plane into the free slot
    // between the mission panel (ends y~200) and the gauges (start
    // y~250), so the tail fin clears the panel instead of hiding behind
    // it. The arch's lintel stays high in the frame, clear of the HUD.
    look = pos.clone().addScaledVector(fwd, 10).add(new THREE.Vector3(0, 5, 0));
    dashEl.classList.add('hidden');
    document.body.classList.remove('cockpit');
    document.body.classList.add('hero');
  } else if (game.cameraMode === 'cockpit') {
    // Cockpit camera: pilot's-eye, at the canopy, BELOW the high wing —
    // the orange cowling runs down the centre to the cream nose cone and
    // the spinner, the wing struts angle up at the frame edges, horizon
    // ahead. (A camera above the wing can never see the nose: the wing
    // itself blocks it. The canopy glass and panel glow are hidden from
    // this camera; they sit around the pilot, not in front of him.)
    target = pos.clone().addScaledVector(fwd, 2.0).add(new THREE.Vector3(0, 2.4, 0));
    look = pos.clone().addScaledVector(fwd, 220).add(new THREE.Vector3(0, -2 + Math.sin(s.pitch) * 40, 0));
    plane.userData.canopy.visible = false;
    plane.userData.panelGlow.visible = false;
    dashEl.classList.remove('hidden');
    document.body.classList.add('cockpit');
    document.body.classList.remove('hero');
  } else if (game.cameraMode === 'orbit') {
    plane.userData.canopy.visible = true;
    plane.userData.panelGlow.visible = true;
    const a = game.time * 0.12;
    target = pos.clone().add(new THREE.Vector3(Math.sin(a) * 42, 12, Math.cos(a) * 42));
    look = pos.clone();
    dashEl.classList.add('hidden');
    document.body.classList.remove('cockpit');
    document.body.classList.remove('hero');
  } else {
    // Chase: behind and above, eased so the camera never fights the pilot.
    plane.userData.canopy.visible = true;
    plane.userData.panelGlow.visible = true;
    const back = pos.clone().addScaledVector(fwd, -40).add(new THREE.Vector3(0, 10.5, 0));
    if (!updateCamera.last) updateCamera.last = back.clone();
    updateCamera.last.lerp(back, Math.min(1, dt * 4));
    target = updateCamera.last.clone();
    look = pos.clone().addScaledVector(fwd, 60).add(new THREE.Vector3(0, 1, 0));
    dashEl.classList.add('hidden');
    document.body.classList.remove('cockpit');
    document.body.classList.remove('hero');
  }
  camera.position.copy(target);
  camera.lookAt(look);
  // Roll the chase camera a little with the bank so turns feel banked.
  if (game.cameraMode === 'chase') camera.rotation.z += s.bank * 0.35;
}

function setRadioLines() {
  const s = game.state, m = game.mission;
  if (m.radio[1] && s.time > 14 && s.time < 14.5) { s.message = m.radio[1]; s.messageAt = s.time; }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const t0 = performance.now();
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  game.time += dt;
  game.frameCount++;

  const { input, events } = inputCtl.poll();
  for (const ev of events) {
    if (ev.type === 'start' && game.mode === 'title') startFlying();
    if (ev.type === 'camera') {
      game.cameraMode = game.cameraMode === 'chase' ? 'cockpit' : game.cameraMode === 'cockpit' ? 'orbit' : 'chase';
    }
    if (ev.type === 'gear' && game.state) game.state.gearDown = !game.state.gearDown;
    if (ev.type === 'flaps' && game.state) game.state.flaps = game.state.flaps ? 0 : 1;
    if (ev.type === 'pause' && game.mode === 'flying') game.mode = 'paused';
    else if (ev.type === 'pause' && game.mode === 'paused') game.mode = 'flying';
    if (ev.type === 'restart') { loadMission(game.missionIndex); game.mode = 'flying'; hideScreen(hud); }
    if (ev.type === 'mute') audio.toggleMute();
    if (ev.type === 'mission') { loadMission(ev.index); game.mode = 'flying'; hideScreen(hud); }
    if (ev.type === 'wheel' && game.state) game.state.throttle = Math.max(0, Math.min(1, game.state.throttle + ev.delta));
  }

  const s = game.state;
  if (game.mode === 'flying' && !game.frozen) {
    let drive = input;
    if (DEMO || SIM) {
      const tgt = autopilotTarget(s, game.mission);
      drive = autopilotInput(s, game.mission, tgt);
    }
    const prevRings = s.ringsPassed;
    const prevFinished = s.finished;
    stepFlight(s, game.mission, drive, dt);
    if (s.ringsPassed > prevRings) audio.ring();
    if (s.finished && !prevFinished) { if (s.crashed) audio.crash(); else audio.land(); }
    setRadioLines();
    audio.update(s);
    if (s.finished) {
      game.mode = 'over';
      const mins = Math.floor(s.time / 60), secs = Math.floor(s.time % 60);
      showScreen(hud, `<div class="screen-inner"><h1>${s.won ? '★ SORTIE COMPLETE ★' : s.crashed ? 'AIRCRAFT LOST' : 'LANDED'}</h1>
        <p class="title-sub">${game.mission.name} — ${s.ringsPassed}/${game.mission.rings.length} rings · ${mins}:${String(secs).padStart(2, '0')} · fuel ${Math.round(s.fuel)}% left</p>
        <p class="title-sub">SCORE <b>${s.score.toLocaleString('en-US')}</b> &nbsp;·&nbsp; R — fly again &nbsp;·&nbsp; 1–8 — next sortie</p></div>`);
    }
  }

  // Ring pulse: the live ring breathes so the eye finds it.
  game.ringPulse += dt;
  ringMeshes.forEach((m, i) => {
    if (i === s.ringIndex) {
      const k = 1 + Math.sin(game.ringPulse * 4) * 0.08;
      m.scale.setScalar(k);
      m.material.color.setHex(0xffb020);
    } else if (i < s.ringIndex) {
      m.material.color.setHex(0x2aff5a);
      m.scale.setScalar(1);
    } else {
      m.material.color.setHex(0xff5a1a);
      m.scale.setScalar(1);
    }
  });

  // Clouds drift with the wind; smoke rises off the crater.
  for (const cl of world.clouds) {
    cl.position.x += cl.userData.speed * dt;
    if (cl.position.x > 2900) cl.position.x = -2900;
  }
  world.smoke.children.forEach((puff, i) => {
    puff.position.y += dt * 3;
    if (puff.position.y > 450 + 9 * 24 + 60) puff.position.y = 450 + i * 24;
  });

  posePlane(plane, s);
  updateCamera(game.mode === 'title' ? 0.016 : dt);
  renderer.render(scene, camera);
  updateHud(hud, s, game.mission, { paused: game.mode === 'paused' });
  updateDials(s);

  const ms = performance.now() - t0;
  game.frameMsEMA = game.frameCount <= 2 ? ms : game.frameMsEMA * 0.95 + ms * 0.05;
  if (ms > game.worstMs) game.worstMs = ms;
  if (game.frameCount === 30) game.ready = true;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- boot ----
loadMission(0);
if (SHOT) {
  applyShot(SHOT);
} else if (SIM) {
  loadMission(SIM_MISSION - 1);
  game.mode = 'flying';
  hideScreen(hud);
} else if (DEMO) {
  game.mode = 'flying';
  hideScreen(hud);
  game.state.throttle = 0.6;
} else {
  game.mode = 'title';
  game.cameraMode = 'orbit';
  showScreen(hud, titleScreenHtml());
  game.state.throttle = 0;
}
if (SIM) {
  // Accelerated in-browser sim: run the real model at 20x until the sortie ends.
  const runSim = () => {
    const s = game.state, m = game.mission;
    let steps = 0;
    while (!s.finished && steps < 60 * 12 * 20) {
      const tgt = autopilotTarget(s, m);
      stepFlight(s, m, autopilotInput(s, m, tgt), 1 / 60);
      steps++;
    }
    game.simResult = {
      mission: m.id, name: m.name, rings: `${s.ringsPassed}/${m.rings.length}`,
      score: s.score, time: Math.round(s.time * 10) / 10, landed: s.landed,
      crashed: s.crashed, won: s.won, fuel: Math.round(s.fuel), damage: Math.round(s.damage),
      steps,
    };
    document.title = 'SIM-DONE ' + JSON.stringify(game.simResult);
  };
  setTimeout(runSim, 600);
}
requestAnimationFrame(frame);
