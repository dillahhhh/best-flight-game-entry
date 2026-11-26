// SUNSET STRAIT — world.js
// The strait: two islands, a sea, a coastal city, a runway and six glowing
// rings. All geometry is seeded and deterministic. Rendering is a
// painter's-algorithm projection of quads through the camera in math3d.js.

// ---- layout (metres; north = -Z, sea level y = 0) ----
const WORLD = {
  seed: 20261126,
  // West island (the coast you fly along), centre + radius + peak height.
  westIsland: { x: -1500, z: 700, r: 1600, h: 210 },
  // North island (runway + city), centre + radius + peak height.
  northIsland: { x: 500, z: -3700, r: 1350, h: 130 },
  runway: { x: 150, z: -3400, len: 720, wid: 48, heading: 0 }, // heading 0 = north-south
  city: { x0: 380, x1: 1150, z0: -4050, z1: -3150 },
  // Rings along the coastal route, from the start to the runway.
  rings: [
    { x: -40, y: 150, z: 1500, r: 55 },
    { x: 120, y: 190, z: 650, r: 55 },
    { x: -90, y: 230, z: -200, r: 55 },
    { x: 80, y: 260, z: -1050, r: 55 },
    { x: -60, y: 240, z: -1900, r: 55 },
    { x: 140, y: 180, z: -2700, r: 55 },
  ],
  start: { x: 0, y: 200, z: 2500, yaw: 0, speed: 55 },
  lighthouse: { x: -420, z: 2450 },
};

function buildWorld() {
  const noise = makeNoise(WORLD.seed);
  const noise2 = makeNoise(WORLD.seed + 77);

  function islandH(cx, cz, ix, iz, ir, ih) {
    const dx = (cx - ix) / ir, dz = (cz - iz) / ir;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= 1) return 0;
    const fall = Math.pow(Math.cos(d * Math.PI * 0.5), 1.4);
    const n = noise2(cx * 0.0016 + 7.3, cz * 0.0016 + 2.9) * 0.5 + 0.5;
    const n2 = noise2(cx * 0.006 + 1.1, cz * 0.006 + 8.4) * 0.5 + 0.5;
    return ih * fall * (0.45 + 0.55 * n) * (0.8 + 0.2 * n2);
  }

  // Flatten the ground under the runway, the city apron and a wide, flat
  // approach corridor, so a landing is about lineup, not dodging hills.
  // The flat patch runs well past both runway ends so a long landing is safe.
  function flatten(x, z, h) {
    const rw = WORLD.runway;
    const lx = Math.abs(x - rw.x), lz = Math.abs(z - rw.z);
    const halfX = rw.wid * 6, halfZ = rw.len / 2 + 320;
    if (lx < halfX && lz < halfZ) {
      const edge = Math.max(lx / halfX, lz / halfZ);
      return h * Math.pow(clamp((edge - 0.45) / 0.55, 0, 1), 1.5);
    }
    const c = WORLD.city;
    if (x > c.x0 - 80 && x < c.x1 + 80 && z > c.z0 - 80 && z < c.z1 + 80) {
      return Math.min(h, 14);
    }
    return h;
  }

  function groundHeight(x, z) {
    let h = 0;
    h += islandH(x, z, WORLD.westIsland.x, WORLD.westIsland.z, WORLD.westIsland.r, WORLD.westIsland.h);
    h += islandH(x, z, WORLD.northIsland.x, WORLD.northIsland.z, WORLD.northIsland.r, WORLD.northIsland.h);
    // A low rocky point for the lighthouse, south tip of the west island.
    const ldx = (x - WORLD.lighthouse.x) / 260, ldz = (z - WORLD.lighthouse.z) / 260;
    const ld = Math.sqrt(ldx * ldx + ldz * ldz);
    if (ld < 1) h += 26 * Math.pow(Math.cos(ld * Math.PI * 0.5), 1.2);
    return flatten(x, z, h);
  }

  // ---- terrain grid (precomputed vertices + quads) ----
  const GX0 = -3200, GX1 = 2300, GZ0 = -5200, GZ1 = 3000, CELL = 80;
  const NX = Math.round((GX1 - GX0) / CELL), NZ = Math.round((GZ1 - GZ0) / CELL);
  const verts = new Float32Array((NX + 1) * (NZ + 1) * 3);
  for (let j = 0; j <= NZ; j++) {
    for (let i = 0; i <= NX; i++) {
      const x = GX0 + i * CELL, z = GZ0 + j * CELL;
      const k = (j * (NX + 1) + i) * 3;
      verts[k] = x; verts[k + 1] = groundHeight(x, z); verts[k + 2] = z;
    }
  }
  // Sun low ahead-left on the northbound route (in frame from the chase cam).
  const SUN = { x: -0.42, y: 0.16, z: -0.89 };
  // Per-quad colour: a smooth height ramp (sand -> grass -> forest -> rock)
  // with a fixed sun shade and a touch of per-quad tint so the ground reads
  // as terrain, not a patchwork.
  function quadColor(h, nx, nz, jit) {
    const stops = [
      [0, 216, 178, 128], [6, 150, 158, 92], [40, 96, 125, 66],
      [110, 58, 92, 46], [170, 122, 106, 88], [260, 122, 106, 88],
    ];
    let r = 122, g = 106, b = 88;
    for (let s = 0; s < stops.length - 1; s++) {
      const a = stops[s], c = stops[s + 1];
      if (h >= a[0] && h <= c[0]) {
        const t = (h - a[0]) / (c[0] - a[0] || 1);
        r = lerp(a[1], c[1], t); g = lerp(a[2], c[2], t); b = lerp(a[3], c[3], t);
        break;
      }
    }
    const shade = 0.90 + 0.10 * clamp(nx * SUN.x + nz * SUN.z + 0.4, 0, 1);
    const tint = 0.90 + jit * 0.20;
    return `rgb(${r * shade * tint | 0},${g * shade * tint | 0},${b * shade * tint | 0})`;
  }
  const quads = [];
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      const h = (verts[a * 3 + 1] + verts[b * 3 + 1] + verts[c * 3 + 1] + verts[d * 3 + 1]) * 0.25;
      if (h < 1.2) continue; // sea, not land
      const cx = (verts[a * 3] + verts[d * 3]) * 0.5;
      const cz = (verts[a * 3 + 2] + verts[d * 3 + 2]) * 0.5;
      // Cheap normal from the diagonal.
      const nx = verts[d * 3 + 1] - verts[a * 3 + 1], nz = verts[c * 3 + 1] - verts[b * 3 + 1];
      const nl = Math.hypot(nx, nz) || 1;
      const jit = noise2(cx * 0.02 + 3.7, cz * 0.02 + 9.1) * 0.5 + 0.5;
      quads.push({ v: [a, b, d, c], cx, cz, h, color: quadColor(h, nx / nl, nz / nl, jit) });
    }
  }

  // ---- city: seeded boxes on the flat apron ----
  const rand = mulberry32(WORLD.seed + 5);
  const buildings = [];
  const c = WORLD.city;
  for (let n = 0; n < 52; n++) {
    const bx = c.x0 + rand() * (c.x1 - c.x0);
    const bz = c.z0 + rand() * (c.z1 - c.z0);
    // Keep the runway strip clear.
    if (Math.abs(bx - WORLD.runway.x) < 120 && Math.abs(bz - WORLD.runway.z) < 420) continue;
    const w = 22 + rand() * 34, d = 22 + rand() * 34;
    const h = 10 + rand() * rand() * 46;
    const warm = 150 + rand() * 60 | 0;
    buildings.push({
      x: bx, z: bz, w, d, h, y: groundHeight(bx, bz),
      color: `rgb(${warm},${warm - 28 | 0},${warm - 66 | 0})`,
      top: `rgb(${warm + 18},${warm - 8 | 0},${warm - 40 | 0})`,
      floors: 1 + (h / 7 | 0),
    });
  }

  // ---- clouds: soft puffs high over the strait ----
  const clouds = [];
  for (let n = 0; n < 16; n++) {
    clouds.push({
      x: -2600 + rand() * 5200,
      y: 520 + rand() * 320,
      z: -4800 + rand() * 7400,
      s: 180 + rand() * 260,
      a: 0.10 + rand() * 0.16,
    });
  }

  return {
    groundHeight, verts, NX, NZ, quads, buildings, clouds,
    sunDir: SUN, rings: WORLD.rings, runway: WORLD.runway, lighthouse: WORLD.lighthouse,
  };
}

// ---- drawing helpers (all take ctx + camera) ----
function drawPoly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// Project the terrain's shared vertices once per frame into a cache.
function projectTerrain(world, cam, cache) {
  const v = world.verts, n = v.length / 3;
  for (let i = 0; i < n; i++) {
    cache[i] = cam.project(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
  }
}

function drawTerrain(world, cam, cache, items) {
  const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  for (const q of world.quads) {
    const dx = q.cx - cam.x, dz = q.cz - cam.z;
    const dist2 = dx * dx + dz * dz;
    if (dist2 > 2600 * 2600) continue;
    if (dx * fx + dz * fz < -200) continue; // behind the camera
    const p0 = cache[q.v[0]], p1 = cache[q.v[1]], p2 = cache[q.v[2]], p3 = cache[q.v[3]];
    if (!p0 || !p1 || !p2 || !p3) continue;
    items.push({ d: (p0.d + p1.d + p2.d + p3.d) * 0.25, pts: [p0, p1, p2, p3], fill: q.color });
  }
}

function drawSea(ctx, world, cam, time) {
  const w = cam.w, h = cam.h;
  // Horizon line: project a far sea point straight ahead.
  const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  const hp = cam.project(cam.x + fx * 6000, 0, cam.z + fz * 6000);
  const hy = hp ? hp.y : h * 0.52;
  const g = ctx.createLinearGradient(0, hy, 0, h);
  g.addColorStop(0, '#c96b2e');
  g.addColorStop(0.25, '#14505e');
  g.addColorStop(1, '#082e3c');
  ctx.fillStyle = g;
  ctx.fillRect(0, hy, w, h - hy);
  // Gentle wave strokes so the water is not a flat void.
  ctx.save();
  for (let i = 0; i < 70; i++) {
    const t = (i / 70) + Math.sin(time * 0.5 + i * 1.7) * 0.008;
    const y = hy + (h - hy) * t * t;
    const spread = (y - hy) * 0.9 + 10;
    const x = ((Math.sin(i * 78.233) * 43758.5453 % 1) + 1) % 1 * w;
    const lw = 10 + (y - hy) * 0.22;
    ctx.globalAlpha = 0.04 + 0.08 * Math.abs(Math.sin(time * 0.9 + i * 2.1));
    ctx.fillStyle = '#9fd8e8';
    ctx.fillRect(x - lw / 2, y, lw, 1.6);
  }
  ctx.restore();
  // Sun glitter: bright dashes along the sun's reflection lane.
  const sd = world.sunDir;
  const sun = cam.project(cam.x + sd.x * 6000, 60, cam.z + sd.z * 6000);
  if (sun) {
    const gx = clamp(sun.x, -200, w + 200);
    ctx.save();
    for (let i = 0; i < 42; i++) {
      const t = (i / 42) + Math.sin(time * 0.7 + i * 2.7) * 0.012;
      const y = hy + (h - hy) * t * t;
      const spread = (y - hy) * 0.55 + 8;
      const x = gx + (Math.sin(i * 12.9898) * 43758.5453 % 1) * spread * 2 - spread;
      const lw = 8 + (y - hy) * 0.16;
      ctx.globalAlpha = 0.05 + 0.22 * (1 - t) * Math.abs(Math.sin(time * 1.3 + i));
      ctx.fillStyle = '#ffd9a0';
      ctx.fillRect(x, y, lw, 2);
    }
    ctx.restore();
  }
  return hy;
}

function drawSky(ctx, world, cam, time) {
  const w = cam.w, h = cam.h;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#141c3d');
  g.addColorStop(0.42, '#4a2c55');
  g.addColorStop(0.62, '#a34d3a');
  g.addColorStop(0.74, '#ff9a3c');
  g.addColorStop(1, '#2a1a2e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Sun: low ahead-left on the northbound route.
  const sd = world.sunDir;
  const sp = cam.project(cam.x + sd.x * 8000, 500, cam.z + sd.z * 8000);
  if (sp && sp.x > -300 && sp.x < w + 300 && sp.y > -200 && sp.y < h * 0.8) {
    const glow = ctx.createRadialGradient(sp.x, sp.y, 4, sp.x, sp.y, 260);
    glow.addColorStop(0, 'rgba(255,214,140,0.95)');
    glow.addColorStop(0.25, 'rgba(255,150,70,0.55)');
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sp.x - 260, sp.y - 260, 520, 520);
    ctx.fillStyle = '#fff3cf';
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 34, 0, Math.PI * 2); ctx.fill();
  }
}

function drawClouds(ctx, world, cam) {
  for (const cl of world.clouds) {
    const p = cam.project(cl.x, cl.y, cl.z);
    if (!p || p.d > 9000) continue;
    const s = cl.s * p.s * 0.5;
    ctx.fillStyle = `rgba(255,214,190,${cl.a})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s, s * 0.32, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - s * 0.55, p.y + s * 0.08, s * 0.6, s * 0.24, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + s * 0.6, p.y + s * 0.06, s * 0.65, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRunway(ctx, world, cam) {
  const rw = world.runway || WORLD.runway;
  const y = 1.2;
  const hl = rw.len / 2, hw = rw.wid / 2;
  // The strip is drawn in segments: when the plane is on short final the
  // nearest segments fall behind the camera plane and are skipped, while
  // the rest of the runway still draws (a whole-strip draw would vanish).
  const SEGS = 12;
  for (let s = 0; s < SEGS; s++) {
    const z0 = rw.z - hl + (rw.len * s) / SEGS;
    const z1 = rw.z - hl + (rw.len * (s + 1)) / SEGS;
    const corners = [
      cam.project(rw.x - hw, y, z0), cam.project(rw.x + hw, y, z0),
      cam.project(rw.x + hw, y, z1), cam.project(rw.x - hw, y, z1),
    ];
    if (corners.some(p => !p)) continue;
    drawPoly(ctx, corners, '#23262e');
  }
  // Centreline dashes.
  ctx.fillStyle = '#f2f2e8';
  for (let d = -hl + 30; d < hl - 10; d += 60) {
    const a = cam.project(rw.x - 2, y + 0.2, rw.z + d);
    const b = cam.project(rw.x + 2, y + 0.2, rw.z + d + 34);
    if (!a || !b) continue;
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x) + 1.5, Math.abs(b.y - a.y) + 1.5);
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    const z = rw.z + end * (hl - 22);
    for (let k = -2; k <= 2; k++) {
      const a = cam.project(rw.x + k * 9 - 3, y + 0.2, z);
      const b = cam.project(rw.x + k * 9 + 3, y + 0.2, z + 14);
      if (!a || !b) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x) + 1, Math.abs(b.y - a.y) + 1);
    }
  }
  // Edge lights: warm dots down both sides.
  for (let d = -hl + 20; d <= hl - 20; d += 80) {
    for (const side of [-1, 1]) {
      const p = cam.project(rw.x + side * (hw + 3), y + 1, rw.z + d);
      if (!p) continue;
      const r = clamp(90 / p.d, 1, 4);
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawBuildings(ctx, world, cam, items) {
  for (const b of world.buildings) {
    const dx = b.x - cam.x, dz = b.z - cam.z;
    if (dx * dx + dz * dz > 3000 * 3000) continue;
    const hw = b.w / 2, hd = b.d / 2, top = b.y + b.h;
    // Sink the base 15 m into the ground: the terrain grid is coarse, so a
    // building's exact base height can sit above the rendered quads and
    // read as floating. Burying the base hides the gap.
    const baseY = b.y - 15;
    const c = [
      cam.project(b.x - hw, baseY, b.z - hd), cam.project(b.x + hw, baseY, b.z - hd),
      cam.project(b.x + hw, baseY, b.z + hd), cam.project(b.x - hw, baseY, b.z + hd),
      cam.project(b.x - hw, top, b.z - hd), cam.project(b.x + hw, top, b.z - hd),
      cam.project(b.x + hw, top, b.z + hd), cam.project(b.x - hw, top, b.z + hd),
    ];
    if (c.some(p => !p)) continue;
    const depth = (c[0].d + c[6].d) * 0.5;
    items.push({ d: depth, draw: () => {
      // Roof.
      drawPoly(ctx, [c[4], c[5], c[6], c[7]], b.top);
      // Two camera-facing walls: pick by which side the camera is on.
      const faces = [];
      if (cam.z > b.z + hd) faces.push([c[2], c[3], c[7], c[6]]); // south wall
      else if (cam.z < b.z - hd) faces.push([c[0], c[1], c[5], c[4]]); // north wall
      if (cam.x > b.x + hw) faces.push([c[1], c[2], c[6], c[5]]); // east wall
      else if (cam.x < b.x - hw) faces.push([c[3], c[0], c[4], c[7]]); // west wall
      for (const f of faces) drawPoly(ctx, f, b.color);
      // Lit windows on the walls: a few warm dots.
      ctx.fillStyle = '#ffd98a';
      for (const f of faces) {
        const rows = Math.max(1, Math.min(4, b.floors));
        for (let rI = 0; rI < rows; rI++) {
          for (let cI = 0; cI < 3; cI++) {
            const u = 0.2 + cI * 0.3, v = 0.25 + rI * (0.6 / rows);
            const px = f[0].x + (f[1].x - f[0].x) * u + (f[3].x - f[0].x) * v - (f[1].x - f[0].x) * v * 0;
            const py = f[0].y + (f[1].y - f[0].y) * u + (f[3].y - f[0].y) * v;
            // Interpolate properly across the quad.
            const ix = f[0].x * (1 - u) * (1 - v) + f[1].x * u * (1 - v) + f[2].x * u * v + f[3].x * (1 - u) * v;
            const iy = f[0].y * (1 - u) * (1 - v) + f[1].y * u * (1 - v) + f[2].y * u * v + f[3].y * (1 - u) * v;
            void px; void py;
            if (((rI * 3 + cI + b.x) % 3) !== 0) continue;
            ctx.fillRect(ix - 1.5, iy - 1.5, 3, 3);
          }
        }
      }
    }});
  }
}

function drawLighthouse(ctx, world, cam, time) {
  const L = world.lighthouse || WORLD.lighthouse;
  const gy = world.groundHeight(L.x, L.z);
  const base = cam.project(L.x, gy, L.z);
  const top = cam.project(L.x, gy + 42, L.z);
  if (!base || !top) return;
  const wBottom = clamp(900 / base.d, 2, 14), wTop = wBottom * 0.55;
  // Tapered tower: alternating red/white bands.
  const bands = 4;
  for (let i = 0; i < bands; i++) {
    const y0 = gy + (42 * i) / bands, y1 = gy + (42 * (i + 1)) / bands;
    const p0 = cam.project(L.x - wBottom, y0, L.z), p1 = cam.project(L.x + wBottom, y0, L.z);
    const p2 = cam.project(L.x + wTop, y1, L.z), p3 = cam.project(L.x - wTop, y1, L.z);
    if (!p0 || !p1 || !p2 || !p3) continue;
    drawPoly(ctx, [p0, p1, p2, p3], i % 2 ? '#e8e2d4' : '#c23b2e');
  }
  // Lamp room + rotating beam.
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath(); ctx.arc(top.x, top.y - 3, clamp(700 / top.d, 2, 8), 0, Math.PI * 2); ctx.fill();
  const ang = time * 0.5;
  const bx = top.x + Math.cos(ang) * 90, by = top.y - 3 + Math.sin(ang) * 10;
  const beam = ctx.createLinearGradient(top.x, top.y, bx, by);
  beam.addColorStop(0, 'rgba(255,220,150,0.5)');
  beam.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y - 3);
  ctx.lineTo(bx + 8, by + 4); ctx.lineTo(bx - 8, by - 10);
  ctx.closePath(); ctx.fill();
}

function drawRings(ctx, world, cam, passed, showLabels) {
  const next = passed.findIndex((p) => !p);
  for (let i = 0; i < world.rings.length; i++) {
    const R = world.rings[i];
    const c = cam.project(R.x, R.y, R.z);
    if (!c) continue;
    const done = passed[i];
    const col = done ? '#39d353' : '#ffb020';
    // Sample the circle (ring faces south, toward the incoming plane).
    const pts = [];
    for (let k = 0; k <= 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      const p = cam.project(R.x + Math.cos(a) * R.r, R.y + Math.sin(a) * R.r, R.z);
      pts.push(p);
    }
    if (pts.some(p => !p)) continue;
    const lw = clamp(260 / c.d, 1.5, 7);
    ctx.save();
    ctx.lineJoin = 'round';
    if (done) {
      // Cleared rings fade to a thin green trace so they never dominate.
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1, lw * 0.7);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      continue;
    }
    for (const [width, alpha] of [[lw * 3.2, 0.16], [lw * 1.8, 0.35], [lw, 0.95]]) {
      ctx.strokeStyle = col;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
    // Label only the next ring, below it so it never sits on the plane,
    // and only once it is close enough to loom large.
    if (showLabels !== false && i === next && c.d < 1200 && R.r * c.s > 55) {
      ctx.fillStyle = 'rgba(10,16,30,0.75)';
      const label = `RING ${i + 1}`;
      ctx.font = 'bold 13px Arial, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillRect(c.x - tw / 2 - 6, c.y + R.r * c.s + 6, tw + 12, 20);
      ctx.fillStyle = '#ffd98a';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, c.x, c.y + R.r * c.s + 16);
    }
  }
}
