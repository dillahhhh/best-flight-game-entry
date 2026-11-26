// SUNSET STRAIT — plane.js
// The bush plane "Kakatua-9": a forgiving arcade flight model and two ways
// to draw it — a detailed vector chase view, and a cockpit frame with a
// visible nose for the cockpit camera.

function makePlane(world) {
  const S = WORLD.start;
  const plane = {
    x: S.x, y: S.y, z: S.z, yaw: S.yaw, pitch: 0, roll: 0,
    speed: S.speed, throttle: 0.62,
    gearDown: false, flaps: false, speedbrake: false,
    fuel: 100, lowFuelWarned: false,
    crashed: false, landed: false, crashReason: '',
    propAngle: 0,
  };

  // input: { roll: -1..1, pitch: -1..1, throttle: -1..1 } per frame, plus dt.
  plane.update = function (dt, input) {
    if (plane.crashed || plane.landed) return;
    // Roll banks the plane; bank turns the heading.
    const targetRoll = clamp(input.roll, -1, 1) * 0.85;
    plane.roll = lerp(plane.roll, targetRoll, 1 - Math.pow(0.0015, dt));
    plane.yaw += -plane.roll * 0.55 * clamp(plane.speed / 55, 0.4, 1.4) * dt;
    // Pitch: stick back (input.pitch > 0) climbs.
    const targetPitch = clamp(input.pitch, -1, 1) * 0.38;
    plane.pitch = lerp(plane.pitch, targetPitch, 1 - Math.pow(0.004, dt));
    // Throttle 0..1, speed chases it with drag. Flaps cost 10 kt of speed
    // but lower the stall; the speedbrake sheds 25 kt while held.
    plane.throttle = clamp(plane.throttle + input.throttle * dt * 0.5, 0, 1);
    let targetSpeed = 28 + plane.throttle * 62;
    if (plane.flaps) targetSpeed -= 10;
    if (plane.speedbrake) targetSpeed -= 25;
    // Out of fuel the engine idles: the plane sinks and must be landed.
    if (plane.fuel <= 0) targetSpeed = Math.min(targetSpeed, 26);
    plane.speed = lerp(plane.speed, targetSpeed, 1 - Math.pow(0.35, dt));
    // Fuel burns with throttle: a full tank lasts ~6 minutes at cruise,
    // a full route takes ~3.5, so fuel is a decision, not a timer trap.
    plane.fuel = Math.max(0, plane.fuel - dt * (0.10 + plane.throttle * 0.20));
    // Move along the heading, climbing with pitch; a slow plane sinks.
    // The wind pushes the airframe sideways (from the west, 8 kt).
    const fx = Math.sin(plane.yaw), fz = -Math.cos(plane.yaw);
    const climb = Math.sin(plane.pitch) * plane.speed;
    const stall = plane.flaps ? 28 : 34;
    const sink = plane.speed < stall ? (stall - plane.speed) * 0.55 : 0;
    plane.x += fx * Math.cos(plane.pitch) * plane.speed * dt + WORLD.wind.x * dt;
    plane.z += fz * Math.cos(plane.pitch) * plane.speed * dt + WORLD.wind.z * dt;
    plane.y += (climb - sink) * dt;
    plane.propAngle += dt * (6 + plane.throttle * 26);
    // Ground / sea contact.
    const g = world.groundHeight(plane.x, plane.z);
    const rw = WORLD.runway;
    // Touchdown zone: the strip plus the flat apron around it.
    const overRunway = Math.abs(plane.x - rw.x) < rw.wid / 2 + 90 &&
      Math.abs(plane.z - rw.z) < rw.len / 2 + 100;
    if (plane.y <= g + 2.2) {
      const landSpeed = plane.flaps ? 58 : 52;
      if (overRunway && g < 6 && Math.abs(plane.roll) < 0.4 &&
          Math.abs(plane.pitch) < 0.3 && plane.speed < landSpeed && plane.speed > 24) {
        if (!plane.gearDown) { plane.crashed = true; plane.crashReason = 'gear'; }
        else { plane.landed = true; plane.y = g + 2.2; }
      } else if (g > 1.5) {
        plane.crashed = true; plane.crashReason = 'terrain';
      } else {
        plane.crashed = true; plane.crashReason = 'sea';
      }
    }
    if (plane.y < 1.2) { plane.crashed = true; plane.crashReason = 'sea'; }
  };

  plane.reset = function () {
    plane.x = S.x; plane.y = S.y; plane.z = S.z;
    plane.yaw = S.yaw; plane.pitch = 0; plane.roll = 0;
    plane.speed = S.speed; plane.throttle = 0.62;
    plane.gearDown = false; plane.flaps = false; plane.speedbrake = false;
    plane.fuel = 100; plane.lowFuelWarned = false;
    plane.crashed = false; plane.landed = false; plane.crashReason = '';
  };

  // Forward vector of the plane (world space).
  plane.forward = function () {
    return { x: Math.sin(plane.yaw), y: Math.sin(plane.pitch), z: -Math.cos(plane.yaw) };
  };

  return plane;
}

// ---- chase view: draw the plane as a vector illustration ----
// The plane sits low-centre, slightly below the screen middle, banked with
// its roll. Drawn in screen space after the world, so it is always crisp.
function drawChasePlane(ctx, plane, w, h, time, cyFrac, scaleMul) {
  const cx = w * 0.5, cy = h * (cyFrac || 0.62);
  const S = clamp(w / 1280, 0.7, 1.2) * (scaleMul || 1); // scale with viewport
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll * 0.55);
  ctx.scale(S, S);
  // Soft shadow on the "air" beneath: a faint dark ellipse grounds it.
  ctx.fillStyle = 'rgba(10,10,25,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 118, 150, 16, 0, 0, Math.PI * 2); ctx.fill();

  // Tailplane.
  ctx.fillStyle = '#e8590c';
  ctx.beginPath();
  ctx.moveTo(-14, -58); ctx.lineTo(-86, -92); ctx.lineTo(-80, -70); ctx.lineTo(-14, -44);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, -58); ctx.lineTo(86, -92); ctx.lineTo(80, -70); ctx.lineTo(14, -44);
  ctx.closePath(); ctx.fill();
  // Vertical fin.
  ctx.fillStyle = '#0f766e';
  ctx.beginPath();
  ctx.moveTo(-6, -52); ctx.lineTo(-10, -104); ctx.lineTo(10, -104); ctx.lineTo(8, -52);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(-10, -104, 20, 7);
  // Main wings: cream with teal tips.
  ctx.fillStyle = '#f4ead2';
  ctx.beginPath();
  ctx.moveTo(-16, -30); ctx.lineTo(-238, 26); ctx.lineTo(-228, 52); ctx.lineTo(-14, 6);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, -30); ctx.lineTo(238, 26); ctx.lineTo(228, 52); ctx.lineTo(14, 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0f766e';
  ctx.beginPath(); ctx.moveTo(-238, 26); ctx.lineTo(-262, 32); ctx.lineTo(-252, 56); ctx.lineTo(-228, 52); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(238, 26); ctx.lineTo(262, 32); ctx.lineTo(252, 56); ctx.lineTo(228, 52); ctx.closePath(); ctx.fill();
  // Wing struts.
  ctx.strokeStyle = '#8a7a5c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-20, 4); ctx.lineTo(-120, 40); ctx.moveTo(20, 4); ctx.lineTo(120, 40); ctx.stroke();
  // Fuselage: warm cream with a teal cheatline and orange nose.
  // The body gradient lives in fixed local coordinates, so one cached
  // gradient serves every frame (no per-frame createLinearGradient).
  if (!drawChasePlane._bodyGrad) {
    const body = ctx.createLinearGradient(0, -110, 0, 60);
    body.addColorStop(0, '#fbf3dd');
    body.addColorStop(0.6, '#f4ead2');
    body.addColorStop(1, '#e8d5ae');
    drawChasePlane._bodyGrad = body;
  }
  ctx.fillStyle = drawChasePlane._bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, -118);
  ctx.bezierCurveTo(20, -100, 26, -60, 24, -10);
  ctx.bezierCurveTo(23, 30, 16, 58, 0, 66);
  ctx.bezierCurveTo(-16, 58, -23, 30, -24, -10);
  ctx.bezierCurveTo(-26, -60, -20, -100, 0, -118);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(-24, -34, 48, 7);
  ctx.fillStyle = '#e8590c';
  ctx.beginPath();
  ctx.moveTo(0, -118); ctx.bezierCurveTo(12, -108, 18, -92, 18, -78); ctx.lineTo(-18, -78);
  ctx.bezierCurveTo(-18, -92, -12, -108, 0, -118); ctx.closePath(); ctx.fill();
  // Cockpit windows: two dark glass panes with a sunset glint.
  ctx.fillStyle = '#16324a';
  ctx.beginPath();
  ctx.moveTo(-15, -84); ctx.lineTo(-3, -84); ctx.lineTo(-3, -64); ctx.lineTo(-17, -66);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(15, -84); ctx.lineTo(3, -84); ctx.lineTo(3, -64); ctx.lineTo(17, -66);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,110,0.85)';
  ctx.fillRect(-14, -80, 5, 3); ctx.fillRect(9, -80, 5, 3);
  // Registration on the fuselage.
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('KAKATUA-9', 0, -8);
  // Propeller: spinning disc + blades (blur by angle).
  ctx.save();
  ctx.translate(0, -112);
  ctx.fillStyle = 'rgba(40,40,55,0.20)';
  ctx.beginPath(); ctx.ellipse(0, 0, 52, 52, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(plane.propAngle % Math.PI);
  ctx.fillStyle = 'rgba(30,30,42,0.55)';
  ctx.fillRect(-4, -52, 8, 104);
  ctx.rotate(Math.PI / 2);
  ctx.fillRect(-4, -52, 8, 104);
  ctx.restore();
  ctx.fillStyle = '#e8590c';
  ctx.beginPath(); ctx.arc(0, -112, 8, 0, Math.PI * 2); ctx.fill();
  // Nav lights: red left, green right, blinking white tail.
  ctx.fillStyle = '#ff2e2e';
  ctx.beginPath(); ctx.arc(-258, 44, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2eff5e';
  ctx.beginPath(); ctx.arc(258, 44, 4, 0, Math.PI * 2); ctx.fill();
  if (Math.floor(time * 2) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, -100, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---- cockpit view: frame, nose and panel surround ----
// Drawn in screen space; the 3D world is visible through the windscreen.
function drawCockpitFrame(ctx, plane, w, h) {
  // Nose: the engine cowling peeking over the panel, banked with the roll.
  ctx.save();
  ctx.translate(w * 0.5, h * 0.78);
  ctx.rotate(-plane.roll * 0.25);
  ctx.fillStyle = '#e8d5ae';
  ctx.beginPath();
  ctx.moveTo(-190, 0);
  ctx.quadraticCurveTo(0, -96, 190, 0);
  ctx.lineTo(150, 60); ctx.lineTo(-150, 60);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(-190, -6, 380, 8);
  // Propeller disc seen over the nose.
  ctx.fillStyle = 'rgba(40,40,55,0.16)';
  ctx.beginPath(); ctx.ellipse(0, -58, 120, 26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(30,30,42,0.5)';
  ctx.fillRect(-3, -110, 6, 104);
  ctx.fillStyle = '#e8590c';
  ctx.beginPath(); ctx.arc(0, -58, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Canopy pillars.
  ctx.fillStyle = '#20242e';
  ctx.save();
  ctx.translate(w * 0.5, 0);
  ctx.rotate(-plane.roll * 0.12);
  ctx.fillRect(-w * 0.42, -20, 16, h * 0.8);
  ctx.fillRect(w * 0.42 - 16, -20, 16, h * 0.8);
  ctx.restore();
  // Top glare strip.
  const g = ctx.createLinearGradient(0, 0, 0, 54);
  g.addColorStop(0, 'rgba(8,10,22,0.85)');
  g.addColorStop(1, 'rgba(8,10,22,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, 54);
}
