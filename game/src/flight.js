// flight.js — pure arcade flight model for Ember Strait.
// No DOM, no three.js: the browser game and the Node headless simulation
// run this exact code, so a simulated win is a real win of the same model.

import { terrainHeight, AIRFIELDS, WATER_Y } from './terrain.js';

export const KTS_TO_MS = 0.514444;
export const MAX_SPEED_KTS = 205;
export const STALL_KTS = 52;

export function airfieldById(id) {
  return AIRFIELDS.find((f) => f.id === id);
}

// Missions: 8 sorties across 4 modes. Rings are {x,y,z,r} in metres.
// Names, people and places are original to this game.
export const MISSIONS = [
  {
    id: 1, mode: 'RING RUN', name: 'Harbour Ring Trial',
    brief: 'Thread all 8 harbour rings, then land back at Port Lumen.',
    rings: [
      { x: 0, y: 170, z: -100, r: 42 }, { x: -420, y: 225, z: -620, r: 42 },
      { x: -900, y: 275, z: -300, r: 42 }, { x: -700, y: 260, z: 350, r: 42 },
      { x: -150, y: 200, z: 700, r: 42 }, { x: 480, y: 170, z: 350, r: 42 },
      { x: 700, y: 210, z: -250, r: 42 }, { x: 320, y: 160, z: -700, r: 42 },
    ],
    landAt: 'LUMEN', windDeg: 300, windKts: 12, gustKts: 4, timeOfDay: 'golden',
    fuelStart: 100, radio: ['MARA VOSS (TOWER): Kestrel-9, wind 300 at 12, rings are live. Fly clean.', 'THEO (SPOTTER): Ring one dead ahead — keep it smooth, not fast.'],
  },
  {
    id: 2, mode: 'VOLCANO SURVEY', name: 'Bara Crater Loop',
    brief: 'Circle the Bara volcano through 8 survey rings, mind the ash wind.',
    rings: [
      { x: -1150, y: 400, z: -1500, r: 46 }, { x: -1500, y: 430, z: -1750, r: 46 },
      { x: -1900, y: 400, z: -1450, r: 46 }, { x: -2050, y: 380, z: -950, r: 46 },
      { x: -1850, y: 350, z: -600, r: 46 }, { x: -1400, y: 405, z: -650, r: 46 },
      { x: -1050, y: 415, z: -950, r: 46 }, { x: -1250, y: 410, z: -1250, r: 46 },
    ],
    landAt: 'LUMEN', windDeg: 40, windKts: 18, gustKts: 9, timeOfDay: 'noon',
    fuelStart: 100, radio: ['DR. ILYA SORN: Crater rim is live — hold 400 metres, ash is thin today.', 'MARA VOSS (TOWER): Gusts off the cone, 18 knots. Watch your bank.'],
  },
  {
    id: 3, mode: 'ISLAND HOPPER', name: 'Hijau Hop',
    brief: 'Fly the 5 gate rings, then put her down on Hijau Strip.',
    rings: [
      { x: 300, y: 180, z: 100, r: 44 }, { x: 700, y: 200, z: -250, r: 44 },
      { x: 1050, y: 190, z: -500, r: 44 }, { x: 1300, y: 185, z: -420, r: 44 },
      { x: 1420, y: 120, z: -560, r: 44 },
    ],
    landAt: 'HIJAU', windDeg: 90, windKts: 9, gustKts: 3, timeOfDay: 'morning',
    fuelStart: 100, radio: ['THEO (SPOTTER): Hijau strip is short — come in slow, flaps down.', 'MARA VOSS (TOWER): Kestrel-9 cleared to land Hijau, runway 55.'],
  },
  {
    id: 4, mode: 'NIGHT CARGO', name: 'Atoll Night Freight',
    brief: 'Night run: 6 beacon rings over dark water, land on the lit Atoll Sandbar.',
    rings: [
      { x: 250, y: 160, z: 900, r: 44 }, { x: 500, y: 180, z: 1250, r: 44 },
      { x: 800, y: 170, z: 1500, r: 44 }, { x: 980, y: 140, z: 1650, r: 44 },
      { x: 700, y: 180, z: 1350, r: 44 }, { x: 400, y: 170, z: 1100, r: 44 },
    ],
    landAt: 'ATOLL', windDeg: 210, windKts: 8, gustKts: 2, timeOfDay: 'night',
    fuelStart: 100, radio: ['MARA VOSS (TOWER): Night freight is yours — beacon rings lit, sandbar lit.', 'THEO (SPOTTER): Stars are out. Trust the instruments, not your eyes.'],
  },
  {
    id: 5, mode: 'RING RUN', name: 'Storm Front Slalom',
    brief: '8 rings in a 26-knot crosswind. Throttle discipline wins this one.',
    rings: [
      { x: -300, y: 200, z: -200, r: 40 }, { x: -800, y: 315, z: -700, r: 40 },
      { x: -1300, y: 275, z: -200, r: 40 }, { x: -900, y: 240, z: 400, r: 40 },
      { x: -300, y: 200, z: 800, r: 40 }, { x: 300, y: 210, z: 400, r: 40 },
      { x: 800, y: 230, z: -100, r: 40 }, { x: 400, y: 190, z: -600, r: 40 },
    ],
    landAt: 'LUMEN', windDeg: 270, windKts: 26, gustKts: 12, timeOfDay: 'dusk',
    fuelStart: 100, radio: ['MARA VOSS (TOWER): Front is moving in — 26 knots, gusts to 38. Hold on.', 'DR. ILYA SORN: If she bucks, ease off. The rings will wait.'],
  },
  {
    id: 6, mode: 'VOLCANO SURVEY', name: 'Ash Ridge Rescue Drop',
    brief: 'Drop the supply crate through the ridge gap ring, then circle back and land at Lumen.',
    rings: [
      { x: -900, y: 370, z: -900, r: 48 }, { x: -1500, y: 415, z: -1500, r: 48 },
      { x: -2100, y: 370, z: -1100, r: 48 }, { x: -1600, y: 360, z: -500, r: 48 },
      { x: -900, y: 220, z: 100, r: 48 }, { x: -300, y: 180, z: 400, r: 48 },
    ],
    landAt: 'LUMEN', windDeg: 120, windKts: 14, gustKts: 6, timeOfDay: 'afternoon',
    fuelStart: 100, radio: ['DR. ILYA SORN: Rangers are waiting at the ridge gap — one clean pass, crate away.', 'MARA VOSS (TOWER): Drop ring is live. After the drop, Lumen is yours.'],
  },
  {
    id: 7, mode: 'RING RUN', name: 'Strait Time Trial',
    brief: '8 rings, one clock. Beat 3:30 for gold — fuel bonus if you land with 25% left.',
    rings: [
      { x: 0, y: 170, z: -300, r: 38 }, { x: -600, y: 280, z: -800, r: 38 },
      { x: -1100, y: 295, z: -300, r: 38 }, { x: -800, y: 210, z: 300, r: 38 },
      { x: -200, y: 190, z: 600, r: 38 }, { x: 500, y: 200, z: 200, r: 38 },
      { x: 900, y: 220, z: -400, r: 38 }, { x: 300, y: 180, z: -800, r: 38 },
    ],
    landAt: 'LUMEN', windDeg: 350, windKts: 10, gustKts: 3, timeOfDay: 'morning',
    fuelStart: 100, radio: ['THEO (SPOTTER): Clock is running, Kestrel. Smooth is fast — remember that.', 'MARA VOSS (TOWER): Time trial live. Gold is 3:30. Go.'],
  },
  {
    id: 8, mode: 'ISLAND HOPPER', name: 'Grand Strait Tour',
    brief: 'The whole strait: 9 rings past every island, finish on the Atoll Sandbar.',
    rings: [
      { x: 0, y: 170, z: -200, r: 44 }, { x: -900, y: 370, z: -900, r: 44 },
      { x: -1500, y: 400, z: -1400, r: 44 }, { x: -2200, y: 250, z: 600, r: 44 },
      { x: -600, y: 220, z: 1700, r: 44 }, { x: 600, y: 200, z: 1900, r: 44 },
      { x: 1400, y: 180, z: 900, r: 44 }, { x: 1900, y: 200, z: -200, r: 44 },
      { x: 1300, y: 160, z: 1000, r: 44 },
    ],
    landAt: 'ATOLL', windDeg: 180, windKts: 11, gustKts: 5, timeOfDay: 'golden',
    fuelStart: 100, radio: ['MARA VOSS (TOWER): Grand tour, Kestrel-9. Every island, one sortie. Make it count.', 'THEO (SPOTTER): Last ring then the sandbar. Bring her home.'],
  },
];

export function newFlightState(mission) {
  const field = airfieldById('LUMEN');
  return {
    x: field.x, y: field.alt + 3, z: field.z + field.len / 2 - 60,
    heading: 0, pitch: 0, bank: 0, speedKts: 0, throttle: 0,
    fuel: mission.fuelStart, damage: 0, gearDown: true, flaps: 0,
    brakes: false, time: 0, ringIndex: 0, ringsPassed: 0, score: 0,
    landed: false, crashed: false, won: false, finished: false, airborne: false,
    departed: false, approach: 0,
    vspeed: 0, lastRingAt: -1, message: '', messageAt: 0,
  };
}

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// One physics step. input: {pitch:-1..1 (up+), roll:-1..1 (right+),
// throttle:-1..1 delta, throttleSet, gear, flaps, brakes} — all optional.
export function stepFlight(s, mission, input, dt) {
  if (s.finished) return s;
  s.time += dt;
  const windA = (mission.windDeg * Math.PI) / 180;
  const gust = mission.gustKts * Math.sin(s.time * 0.7) * Math.sin(s.time * 1.7 + 1.3);
  const windKts = mission.windKts + gust;
  const wx = Math.sin(windA) * windKts * KTS_TO_MS;
  const wz = -Math.cos(windA) * windKts * KTS_TO_MS;

  if (input.throttleSet !== undefined) s.throttle = clamp(input.throttleSet, 0, 1);
  if (input.throttle) s.throttle = clamp(s.throttle + input.throttle * dt * 0.55, 0, 1);
  if (input.gear !== undefined) s.gearDown = input.gear;
  if (input.flaps !== undefined) s.flaps = input.flaps;
  s.brakes = !!input.brakes;

  const onGround = s.y <= terrainHeight(s.x, s.z) + 3.2 && s.speedKts < 90;
  const targetSpeed = s.fuel <= 0 ? 0 : 38 + s.throttle * (MAX_SPEED_KTS - 38) - (s.flaps ? 14 : 0);
  const accel = onGround ? 26 : 14;
  s.speedKts += clamp(targetSpeed - s.speedKts, -accel * dt, accel * dt);
  if (s.brakes && onGround) s.speedKts = Math.max(0, s.speedKts - 40 * dt);

  const pitchIn = clamp(input.pitch || 0, -1, 1);
  const rollIn = clamp(input.roll || 0, -1, 1);
  const targetBank = rollIn * 0.72; // ~41 deg max bank
  s.bank += (targetBank - s.bank) * Math.min(1, dt * 3.2);
  // On the runway the nose stays down until rotation speed, then she flies.
  const rotate = onGround && s.speedKts < 68;
  const targetPitch = rotate ? 0 : pitchIn * 0.30;
  s.pitch += (targetPitch - s.pitch) * Math.min(1, dt * 2.6);
  // Turn: bank rolls the nose around. Stall: nose drops, sink grows.
  const stalled = s.speedKts < STALL_KTS && !onGround;
  if (stalled) s.pitch += (-0.22 - s.pitch) * Math.min(1, dt * 1.5);
  const turnRate = Math.sin(s.bank) * (s.speedKts / 120) * 0.55;
  s.heading += turnRate * dt;

  const spd = s.speedKts * KTS_TO_MS;
  const climb = Math.sin(s.pitch) * spd - (stalled ? 9 : 0) + (s.flaps ? 0.5 : 0);
  s.vspeed = climb;
  s.x += (Math.sin(s.heading) * Math.cos(s.pitch) * spd + wx) * dt;
  s.z += (-Math.cos(s.heading) * Math.cos(s.pitch) * spd + wz) * dt;
  s.y += climb * dt;

  // Fuel burn: throttle-heavy, flaps add drag burn.
  if (s.speedKts > 5) s.fuel = Math.max(0, s.fuel - dt * (0.055 + s.throttle * 0.16 + s.flaps * 0.02));
  if (s.fuel <= 0 && s.throttle > 0) s.throttle = 0;

  // Rings: 3D distance to the live ring centre.
  const ring = mission.rings[s.ringIndex];
  if (ring) {
    const dx = s.x - ring.x, dy = s.y - ring.y, dz = s.z - ring.z;
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) < ring.r) {
      s.ringIndex++; s.ringsPassed++;
      s.score += 500;
      s.lastRingAt = s.time;
      s.message = `RING ${s.ringsPassed} OF ${mission.rings.length} — +500`;
      s.messageAt = s.time;
    }
  }

  // Ground / water contact.
  const ground = terrainHeight(s.x, s.z);
  if (s.y > ground + 25 || s.speedKts > 85) s.airborne = true;
  const field = airfieldById(mission.landAt);
  // Near-field test in runway coordinates: along the strip, across it.
  let nearField = false;
  if (field) {
    const a = (field.headingDeg * Math.PI) / 180;
    const dx = s.x - field.x, dz = s.z - field.z;
    const along = Math.abs(dx * Math.sin(a) - dz * Math.cos(a));
    const across = Math.abs(dx * Math.cos(a) + dz * Math.sin(a));
    nearField = along < field.len / 2 + 90 && across < 160;
  }
  if (s.y <= ground + 3.0 || s.y <= WATER_Y + 2.5) {
    const overWater = ground < WATER_Y;
    const sinkRate = -s.vspeed;
    const gentle = sinkRate < 4.5 && s.speedKts < 95 && Math.abs(s.bank) < 0.35
      && Math.abs(s.pitch) < 0.12 && s.gearDown && nearField && !overWater;
    if (gentle || (!s.airborne && nearField)) {
      s.y = ground + 3.0;
      if (s.airborne && s.speedKts < 12) {
        s.landed = true; s.finished = true; s.won = s.ringIndex >= mission.rings.length;
        s.score += s.won ? 1000 : 250;
        s.score += Math.round(s.fuel * 4);
        s.message = s.won ? 'LANDED — SORTIE COMPLETE' : 'LANDED — RINGS MISSED';
        s.messageAt = s.time;
      }
    } else if (overWater && sinkRate < 3.5 && s.speedKts < 85 && Math.abs(s.bank) < 0.3) {
      // Floatplane water landing: splash down gently, bleed speed.
      s.y = WATER_Y + 2.5;
      s.speedKts = Math.max(0, s.speedKts - 30 * dt);
      if (s.airborne && s.speedKts < 12) {
        s.landed = true; s.finished = true; s.won = false;
        s.score += 250;
        s.message = 'DITCHED — FLOATS DOWN, CREW SAFE';
        s.messageAt = s.time;
      }
    } else if (s.y <= ground + 3.0 || s.y <= WATER_Y + 2.5) {
      const hard = sinkRate > 9 || s.speedKts > 130;
      s.damage += hard ? 100 : 34;
      s.y = Math.max(s.y, ground + 3.0);
      if (s.damage >= 100 || hard) {
        s.crashed = true; s.finished = true; s.won = false;
        s.message = overWater ? 'DITCHED IN THE STRAIT' : 'CRASHED — HULL LOST';
        s.messageAt = s.time;
      } else {
        s.message = 'HARD CONTACT — DAMAGE +' + (hard ? 100 : 34) + '%';
        s.messageAt = s.time;
        s.y = ground + 12; s.speedKts *= 0.55; s.pitch = 0.12;
      }
    }
  }
  // World edge: turn back with a radio nudge, never a void.
  if (Math.abs(s.x) > 2950 || Math.abs(s.z) > 2950) {
    s.heading += Math.PI * dt * 0.4;
    s.message = 'MARA VOSS (TOWER): Kestrel-9, you are leaving the strait — turn back.';
    s.messageAt = s.time;
  }
  // All rings done + still airborne: tower calls the landing.
  if (s.ringIndex >= mission.rings.length && !s.message.startsWith('ALL RINGS')) {
    s.message = `ALL RINGS CLEAR — LAND AT ${field.name.toUpperCase()}`;
    s.messageAt = s.time;
  }
  return s;
}

// Pure autopilot: steer the real model toward a target point.
// Used by ?demo=1 in the browser and by the Node winnability simulation.
export function autopilotInput(s, mission, target) {
  const dx = target.x - s.x, dz = target.z - s.z;
  const dist = Math.hypot(dx, dz);
  // Crab into the wind: aim upwind of the target by the drift the wind
  // will cause over the time to get there, so the ground track stays true.
  const windA = (mission.windDeg * Math.PI) / 180;
  const gust = mission.gustKts * Math.sin(s.time * 0.7) * Math.sin(s.time * 1.7 + 1.3);
  const windKts = mission.windKts + gust;
  const wx = Math.sin(windA) * windKts * KTS_TO_MS;
  const wz = -Math.cos(windA) * windKts * KTS_TO_MS;
  const eta = dist / Math.max(30, s.speedKts * KTS_TO_MS);
  const ax = target.x - wx * eta * 0.9, az = target.z - wz * eta * 0.9;
  let desiredHeading = Math.atan2(ax - s.x, -(az - s.z));
  const altErr = target.y - s.y;
  const landing = !!target.landing;
  let speedTarget = landing ? (dist > 600 ? 95 : dist > 200 ? 70 : 58) : 135;
  if (dist < 120 && !landing) speedTarget = 95;
  const throttleSet = clamp((speedTarget - s.speedKts) / 60 + 0.45, 0, 1);
  let roll = clamp(angDiff(desiredHeading, s.heading) * 2.2, -1, 1);
  let pitch = clamp(altErr / 70, -0.7, 0.7);
  // On final the glide must be tracked tightly: strong pitch gain, and a
  // flare that eases the descent as the wheels near the ground. On the
  // approach leg the descent stays gentle — never a dive over high ground.
  if (landing && s.approach === 1) pitch = clamp((altErr + 4) / 25, -0.85, 0.5);
  else if (landing) pitch = clamp(altErr / 70, -0.3, 0.7);
  if (landing && s.approach === 1) {
    // FINAL LEG: follow the extended centreline as a LINE, not a point.
    // Cross-track steers the heading; the glide only descends once the
    // plane is on the line and aligned — never a dive through a turn.
    const field = airfieldById(mission.landAt);
    const a = (field.headingDeg * Math.PI) / 180;
    const fdx = Math.sin(a), fdz = -Math.cos(a);
    const px = Math.cos(a), pz = Math.sin(a); // right of the flight direction
    const tx = field.x - fdx * 150, tz = field.z - fdz * 150;
    const cross = (s.x - tx) * px + (s.z - tz) * pz;
    const along = (s.x - tx) * fdx + (s.z - tz) * fdz; // <0 before touchdown
    const glideY = field.alt + 4 + Math.max(0, -along) * 0.09;
    desiredHeading = a + clamp(-cross / 150, -0.6, 0.6);
    roll = clamp(angDiff(desiredHeading, s.heading) * 3.0, -1, 1);
    const hErr = Math.abs(angDiff(a, s.heading));
    if (Math.abs(cross) > 150 || hErr > 0.6) {
      pitch = clamp((Math.max(s.y, glideY + 15) - s.y) / 30, -0.2, 0.7);
      speedTarget = 65;
    } else {
      // Inside 100 m of the touchdown point, aim at the runway itself so
      // the flare actually puts the wheels down instead of floating.
      const gy = along > -100 ? field.alt + 2 : glideY;
      pitch = clamp((gy + 4 - s.y) / 25, -0.85, 0.5);
      speedTarget = along > -200 ? 58 : 65;
    }
    // Plant it: within 400 m of the touchdown point and under 14 m above
    // the ground, push the nose down and idle the throttle — no floating.
    const gndNow = terrainHeight(s.x, s.z);
    if (along > -400 && s.y < gndNow + 14) {
      pitch = -0.4;
      speedTarget = 55;
    }
    return {
      pitch, roll,
      throttleSet: clamp((speedTarget - s.speedKts) / 60 + 0.45, 0, 1),
      gear: true, flaps: 1,
      brakes: s.y <= terrainHeight(s.x, s.z) + 4 && s.speedKts < 90,
    };
  }
  // Terrain avoidance: if the ground 300 m ahead is close, climb now.
  // It stays on during the approach leg, and switches off only on the
  // final line, where the altitude hold already protects the glide.
  const aheadGround = terrainHeight(
    s.x + Math.sin(s.heading) * 300, s.z - Math.cos(s.heading) * 300);
  if (!(landing && s.approach === 1) && s.y < aheadGround + 70) pitch = Math.max(pitch, 0.7);
  return {
    pitch, roll, throttleSet,
    gear: true, flaps: landing && dist < 900 ? 1 : 0,
    brakes: landing && s.y <= terrainHeight(s.x, s.z) + 4 && s.speedKts < 90,
  };
}

export function autopilotTarget(s, mission) {
  const ring = mission.rings[s.ringIndex];
  // Departure: climb straight out to 230 m before turning for ring 1,
  // so the turn never cuts across the hillside beside the runway.
  // Latched: once she is up, the departure never re-triggers.
  if (s.y > 190) s.departed = true;
  if (ring && s.ringIndex === 0 && !s.departed) {
    const field = airfieldById('LUMEN');
    return { x: field.x, y: 230, z: field.z - 1300, landing: false };
  }
  if (ring) return { x: ring.x, y: ring.y, z: ring.z, landing: false };
  const field = airfieldById(mission.landAt);
  const a = (field.headingDeg * Math.PI) / 180;
  // Landing is a two-leg pattern. Leg 1: fly to the approach point, 900 m
  // behind the threshold on the approach side, 110 m up. Leg 2 (only once
  // aligned at the approach point): a steady 9% glide to the threshold.
  // Overshoot the field on final and the pattern resets for a go-around
  // instead of a low turn back into the ground.
  const ax = field.x - Math.sin(a) * 1400, az = field.z + Math.cos(a) * 1400;
  const dist = Math.hypot(s.x - field.x, s.z - field.z);
  const fdx = Math.sin(a), fdz = -Math.cos(a); // landing flight direction
  const pastField = (s.x - field.x) * fdx + (s.z - field.z) * fdz;
  // Go around only if she flies past the far end still airborne — a high
  // pass over the touchdown point still has runway ahead to settle onto.
  if (s.approach === 1 && pastField > 500 && s.y > terrainHeight(s.x, s.z) + 20) s.approach = 0;
  if (s.approach === 0) {
    // Capture the final only when close to the approach point AND roughly
    // aligned with the runway — otherwise keep flying the pattern around.
    const a0 = (field.headingDeg * Math.PI) / 180;
    const aligned = Math.abs(angDiff(a0, s.heading)) < 0.9;
    const near = Math.hypot(s.x - ax, s.z - az);
    if ((near < 300 && aligned) || near < 120) s.approach = 1;
    // Approach altitude sits ON the 9% glide, so the final starts on-slope.
    else return { x: ax, y: field.alt + 140, z: az, landing: true };
  }
  // Touchdown point: 150 m before the centre, on the centreline, so the
  // rollout has the whole strip ahead of it.
  const tx = field.x - fdx * 150, tz = field.z - fdz * 150;
  const distT = Math.hypot(s.x - tx, s.z - tz);
  return { x: tx, y: field.alt + 4 + distT * 0.09, z: tz, landing: true };
}
