// SUNSET STRAIT — math3d.js
// Tiny 3D math core for the Canvas 2D renderer: vectors, seeded random,
// rotation helpers and a perspective projector. No libraries, all original.

// Seeded random (mulberry32) so the world is identical on every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value-noise with smooth interpolation, built on the seeded random.
function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const t = base[i]; base[i] = base[j]; base[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  function fade(t) { return t * t * (3 - 2 * t); }
  function grad(h, x, y) {
    // 4-direction gradient picked by hash.
    switch (h & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  }
  return function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const u = fade(xf), v = fade(yf);
    const aa = grad(perm[X + perm[Y]], xf, yf);
    const ba = grad(perm[X + 1 + perm[Y]], xf - 1, yf);
    const ab = grad(perm[X + perm[Y + 1]], xf, yf - 1);
    const bb = grad(perm[X + 1 + perm[Y + 1]], xf - 1, yf - 1);
    const x1 = aa + u * (ba - aa);
    const x2 = ab + u * (bb - ab);
    return (x1 + v * (x2 - x1)) * 0.7071; // ~[-1, 1]
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
// Shortest-arc angle lerp (angles in radians).
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function deg(rad) { return rad * 180 / Math.PI; }
function rad(deg) { return deg * Math.PI / 180; }

// Camera: position + yaw (heading, 0 = north = -Z) + pitch (look up positive).
// project() turns a world point into screen space; returns null when behind.
function makeCamera(fovDeg, width, height) {
  const f = (height * 0.5) / Math.tan(rad(fovDeg) * 0.5);
  const cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: fovDeg, w: width, h: height, f };
  cam.resize = function (w, h) {
    cam.w = w; cam.h = h;
    cam.f = (h * 0.5) / Math.tan(rad(cam.fov) * 0.5);
  };
  cam.project = function (x, y, z) {
    // Translate to camera space, then rotate by -yaw around Y, then -pitch around X.
    let dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    const cy = Math.cos(-cam.yaw), sy = Math.sin(-cam.yaw);
    let rx = dx * cy - dz * sy;
    let rz = dx * sy + dz * cy;
    const cp = Math.cos(-cam.pitch), sp = Math.sin(-cam.pitch);
    let ry = dy * cp - rz * sp;
    rz = dy * sp + rz * cp;
    // Camera looks down -Z after rotation; flip so forward is +Z depth.
    const depth = -rz;
    if (depth < 0.5) return null;
    const s = cam.f / depth;
    return { x: cam.w * 0.5 + rx * s, y: cam.h * 0.5 - ry * s, d: depth, s };
  };
  return cam;
}

// Rotate a point around the Y axis (heading) — used for runway/ring placement.
function rotY(x, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: x * c - z * s, z: x * s + z * c };
}
