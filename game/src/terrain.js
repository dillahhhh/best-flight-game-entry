// terrain.js — pure heightfield for Ember Strait. No DOM, no three.js:
// the same function builds the 3D mesh (world.js) and decides crashes
// (flight.js), so what you see is exactly what you can hit.

export const WORLD_SIZE = 6000; // metres, x and z run -3000..3000
export const WATER_Y = 2;

// Airfields: flat pads carved into the heightfield. {x,z} centre,
// headingDeg 0 = runway points north (-z), len/wid in metres, alt in m.
export const AIRFIELDS = [
  { id: 'LUMEN', name: 'Port Lumen', x: 0, z: 620, headingDeg: 0, len: 760, wid: 46, alt: 9 },
  { id: 'HIJAU', name: 'Hijau Strip', x: 1420, z: -560, headingDeg: 55, len: 520, wid: 34, alt: 26 },
  { id: 'ATOLL', name: 'Atoll Sandbar', x: 980, z: 1560, headingDeg: 120, len: 460, wid: 30, alt: 6 },
];

function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const u = smooth(fx), v = smooth(fz);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, z) {
  return valueNoise(x, z) * 0.55 + valueNoise(x * 2.13 + 7.7, z * 2.13 + 3.1) * 0.3
    + valueNoise(x * 4.31 + 13.7, z * 4.31 + 9.4) * 0.15;
}
function gauss(x, z, cx, cz, sigma) {
  const dx = (x - cx) / sigma, dz = (z - cz) / sigma;
  return Math.exp(-(dx * dx + dz * dz) / 2);
}

// Islands: [cx, cz, sigma, peak, ridge]
// Bara = the volcano (crater carved below), Lumen = home island + town,
// Hijau = green hills, Atoll = low sandbar, plus small rocky islets.
const ISLANDS = [
  { cx: -1500, cz: -1150, sigma: 760, peak: 470, ridge: 60, crater: true },
  { cx: 0, cz: 620, sigma: 980, peak: 150, ridge: 42, crater: false },
  { cx: 1420, cz: -560, sigma: 620, peak: 190, ridge: 55, crater: false },
  { cx: 980, cz: 1560, sigma: 520, peak: 46, ridge: 12, crater: false },
  { cx: -2350, cz: 900, sigma: 420, peak: 120, ridge: 40, crater: false },
  { cx: 2300, cz: 900, sigma: 380, peak: 95, ridge: 34, crater: false },
  { cx: -700, cz: 2100, sigma: 330, peak: 70, ridge: 26, crater: false },
  { cx: 2400, cz: -1700, sigma: 360, peak: 88, ridge: 30, crater: false },
  { cx: -2600, cz: -1900, sigma: 300, peak: 64, ridge: 22, crater: false },
];

// Ember Arch: the strait's landmark — a natural rock arch on a sea stack
// in the southern sea, south-east of the Atoll approach. One shared
// constant so world.js, hud.js (minimap) and shots.js all agree.
export const EMBER_ARCH = { x: 550, z: 2400 };

export function terrainHeight(x, z) {
  let h = -26; // seabed
  for (const isl of ISLANDS) {
    const g = gauss(x, z, isl.cx, isl.cz, isl.sigma);
    if (g < 0.001) continue;
    let peak = isl.peak + isl.ridge * fbm(x * 0.004 + isl.cx, z * 0.004 + isl.cz);
    h += peak * g;
    if (isl.crater) {
      const cg = gauss(x, z, isl.cx, isl.cz, 190);
      h -= 190 * cg; // crater bowl
    }
  }
  h += 6 * fbm(x * 0.002, z * 0.002);
  if (h < -26) h = -26;
  // Carve every airfield flat so runways sit on level ground.
  // Runway axis is the landing direction (sin a, -cos a): heading a.
  for (const f of AIRFIELDS) {
    const a = (f.headingDeg * Math.PI) / 180;
    const dx = x - f.x, dz = z - f.z;
    const along = dx * Math.sin(a) - dz * Math.cos(a);
    const across = dx * Math.cos(a) + dz * Math.sin(a);
    const dAlong = Math.max(0, Math.abs(along) - f.len / 2) / 300;
    const dAcross = Math.max(0, Math.abs(across) - f.wid / 2) / 260;
    const d = Math.max(dAlong, dAcross);
    const w = d <= 0 ? 1 : Math.max(0, 1 - d);
    if (w > 0) h = h * (1 - w) + f.alt * w;
    // Approach corridor: flat ground behind the threshold (the side the
    // plane comes in from), 260 m wide, 1600 m long, so the glide never
    // has to clear a hillside on short final.
    const behind = -along - f.len / 2; // >0 past the threshold end
    if (behind > -100 && behind < 1600) {
      const wA = Math.max(0, 1 - Math.max(0, Math.abs(across) - 260) / 200);
      const wB = Math.max(0, 1 - Math.max(0, behind - 1300) / 300);
      const wc = Math.min(wA, wB);
      if (wc > 0) h = h * (1 - wc) + f.alt * wc;
    }
  }
  return h;
}

// Slope tint helper for the mesh painter: 0 sand, 1 grass, 2 rock, 3 ash/snow.
export function terrainTint(x, z, h) {
  if (h < 7) return 0;
  const n = fbm(x * 0.01 + 40, z * 0.01 + 40);
  if (h > 300) return 3;
  if (h > 200) return n > 0.1 ? 2 : 1;
  if (h > 110) return n > 0.35 ? 2 : 1;
  return 1;
}
