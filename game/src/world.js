// world.js — builds the Ember Strait in three.js from terrain.js.
// Terrain mesh, sea, volcano smoke, harbour town, pine forests, cumulus
// clouds, a 7-phase sky dome, stars, runways and glowing rings.

import * as THREE from 'three';
import { terrainHeight, terrainTint, AIRFIELDS, WORLD_SIZE, EMBER_ARCH } from './terrain.js';

const SKY_PHASES = {
  dawn: { sky: 0x8a6f8e, fog: 0x9a7f8e, sun: 0xffb37a, sunI: 1.6, hemi: 0.55, stars: 0.25, amb: 0x8a7a90 },
  morning: { sky: 0x7fb4dd, fog: 0x9cc3de, sun: 0xfff2cf, sunI: 2.4, hemi: 0.8, stars: 0, amb: 0xaac4de },
  noon: { sky: 0x5ea9e6, fog: 0xa8cbe8, sun: 0xffffff, sunI: 2.8, hemi: 0.95, stars: 0, amb: 0xbfd8ee },
  afternoon: { sky: 0x6fa8d8, fog: 0xa9c4d8, sun: 0xffe9b0, sunI: 2.5, hemi: 0.85, stars: 0, amb: 0xb8c8d8 },
  golden: { sky: 0xe8965a, fog: 0xe8a06a, sun: 0xff9a3d, sunI: 2.5, hemi: 0.75, stars: 0.05, amb: 0xd89a6a },
  dusk: { sky: 0x4a3a6e, fog: 0x6a5578, sun: 0xff7a4d, sunI: 1.6, hemi: 0.55, stars: 0.45, amb: 0x6a5a7a },
  night: { sky: 0x0a1026, fog: 0x141a33, sun: 0x8fa8ff, sunI: 0.5, hemi: 0.22, stars: 1, amb: 0x2a3455 },
};
export const PHASE_ORDER = ['dawn', 'morning', 'noon', 'afternoon', 'golden', 'dusk', 'night'];

function lerpColor(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

export function buildWorld(scene) {
  const world = { rings: [], ringMeshes: [], clouds: [], smoke: null, beacons: [], cityLights: null, stars: null, sun: null, hemi: null, skyDome: null };
  scene.fog = new THREE.Fog(0x9cc3de, 900, 5200);

  // --- Sky dome: big inverted sphere, vertex colours fade horizon->zenith.
  const skyGeo = new THREE.SphereGeometry(4800, 24, 14);
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true, fog: false });
  const pos = skyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  world.skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(world.skyDome);

  // --- Terrain: 256x256 grid, vertex colours by height tint + mottling.
  // The palette is deliberately FLAT and calm — big quiet colour fields,
  // not high-frequency noise: Tidewing proves a plain lime field reads
  // cleaner in a 300 px thumbnail than dense mottling. Colour changes
  // happen at broad scale (120 m cells); the fine mottle is only ±4%,
  // enough to kill banding, too small to read as texture.
  const SEG = 256;
  const tg = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
  tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position;
  const tc = new Float32Array(tp.count * 3);
  const SAND = new THREE.Color(0xd9c08a), SAND_L = new THREE.Color(0xe8d6a8),
    GRASS_A = new THREE.Color(0x58a647), GRASS_B = new THREE.Color(0x478c3a),
    GRASS_C = new THREE.Color(0x6fb04e), ROCK = new THREE.Color(0x8a7a68),
    ROCK_D = new THREE.Color(0x6a5f52), ASH = new THREE.Color(0x5f574c),
    ASH_D = new THREE.Color(0x3d362e);
  const CROPS = [0xc9a86a, 0x7a8a3a, 0x3f7a34, 0x8a6a44, 0x86b04a, 0xa8b858].map((h) => new THREE.Color(h));
  const c = new THREE.Color(), c2 = new THREE.Color();
  const hash2 = (x, z) => {
    const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    const h = terrainHeight(x, z);
    tp.setY(i, h);
    const t = terrainTint(x, z, h);
    c.copy(t === 0 ? SAND : t === 1 ? GRASS_A : t === 2 ? ROCK : ASH);
    // Broad colour fields: the green blend changes at 120 m cells, so a
    // hillside reads as one calm field, not speckle. The fine mottle is
    // only ±4% — it kills banding without reading as texture.
    const m1 = hash2(Math.floor(x / 34), Math.floor(z / 34));
    const m2 = hash2(Math.floor(x / 120) + 40, Math.floor(z / 120) + 40);
    const mottle = 0.96 + (m1 - 0.5) * 0.08;
    if (t === 1) {
      // Blend between two greens by the coarse noise cell.
      c2.copy(m2 > 0.5 ? GRASS_C : GRASS_A);
      c.lerp(c2, 0.4);
    } else if (t === 0) {
      c.lerp(SAND_L, m1 * 0.5);
    } else if (t === 2) {
      c.lerp(ROCK_D, m1 * 0.4);
    }
    // Patchwork crop fields on Lumen's lower slopes (not town, not runway):
    // BIG cells (280 m), only three colours — calm blocks, not confetti.
    const inFields = h > 12 && h < 130 && Math.abs(x) < 950 && z > -150 && z < 1450
      && !(x > -320 && x < 320 && z > 900 && z < 1350) // town
      && !(Math.abs(x) < 70 && z > 150 && z < 1100); // runway strip
    if (inFields) {
      const cell = hash2(Math.floor(x / 280), Math.floor(z / 280));
      if (cell > 0.35) c.lerp(CROPS[[0, 2, 5][Math.floor(cell * 3) % 3]], 0.7);
    }
    // Ash streaks radiating down Bara's flanks: broad and few, so the
    // cone reads as one dark solid silhouette.
    const dxB = x + 1500, dzB = z + 1150;
    const dB = Math.sqrt(dxB * dxB + dzB * dzB);
    if (dB < 1000 && h > 140) {
      const ang = Math.atan2(dzB, dxB);
      const streak = 0.5 + 0.5 * Math.sin(ang * 4 + dB * 0.01);
      if (streak > 0.6) c.lerp(ASH_D, Math.min(0.6, (1 - dB / 1000) * 0.8));
    }
    c.multiplyScalar(mottle);
    tc[i * 3] = c.r; tc[i * 3 + 1] = c.g; tc[i * 3 + 2] = c.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(terrain);

  // --- Sea: translucent plane just above water level, gentle opacity.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE * 1.6, WORLD_SIZE * 1.6),
    new THREE.MeshLambertMaterial({ color: 0x1d6f9e, transparent: true, opacity: 0.82 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 2;
  scene.add(sea);

  // --- Shallow-water halo: a turquoise disc hugging each main island's
  // coast. It sits at y = 2.2 — above the sea, below the beach — so it
  // shows exactly where the water is shallow and vanishes under the
  // land, tracing the real coastline in a pale turquoise ring.
  const shallowMat = new THREE.MeshLambertMaterial({ color: 0x3fc4c4, transparent: true, opacity: 0.5 });
  for (const [cx, cz, r] of [[-1500, -1150, 1150], [0, 620, 1350], [1420, -560, 950], [980, 1560, 800], [EMBER_ARCH.x, EMBER_ARCH.z, 170]]) {
    const halo = new THREE.Mesh(new THREE.CircleGeometry(r, 48), shallowMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(cx, 2.2, cz);
    scene.add(halo);
  }

  // --- Lights.
  world.sun = new THREE.DirectionalLight(0xfff2cf, 2.4);
  world.sun.position.set(1200, 1600, 600);
  scene.add(world.sun);
  scene.add(new THREE.AmbientLight(0xaac4de, 0.5));
  world.hemi = new THREE.HemisphereLight(0xbfd8ee, 0x3a5a3a, 0.8);
  scene.add(world.hemi);

  // --- Stars: points on the dome, faded in at night. Round sprite so
  // they read as stars, not square pixels.
  const starCanvas = document.createElement('canvas');
  starCanvas.width = 32; starCanvas.height = 32;
  const sctx = starCanvas.getContext('2d');
  const grad = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 32, 32);
  const starTex = new THREE.CanvasTexture(starCanvas);
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.42 + 0.08;
    starPos.push(Math.cos(a) * Math.cos(e) * 4600, Math.sin(e) * 4600, Math.sin(a) * Math.cos(e) * 4600);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  world.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 14, sizeAttenuation: false, map: starTex, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(world.stars);

  // --- Volcano smoke: a short, compact white plume on the dark cone —
  // a bright vertical accent, not a long grey bead string. Nine big
  // overlapping puffs, tight column, high opacity, so it reads as one
  // solid plume against the blue sky.
  const smokeGroup = new THREE.Group();
  const smokeCols = [0xd8d2c8, 0xcfc9c0, 0xc4beb4];
  for (let i = 0; i < 9; i++) {
    const r = 26 + i * 4 + Math.random() * 8;
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8),
      new THREE.MeshLambertMaterial({ color: smokeCols[i % smokeCols.length], transparent: true, opacity: 0.8 }));
    s.position.set(-1500 + (Math.random() * 2 - 1) * (14 + i * 4) + i * 5, 450 + i * 24, -1150 + (Math.random() * 2 - 1) * (12 + i * 4) - i * 3);
    s.scale.set(1.3, 0.75, 1.15);
    smokeGroup.add(s);
  }
  world.smoke = smokeGroup;
  scene.add(smokeGroup);
  // Lava glow in the crater: wide emissive disc + orange point light.
  const lava = new THREE.Mesh(new THREE.CircleGeometry(72, 20),
    new THREE.MeshBasicMaterial({ color: 0xff5a1a, fog: false }));
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(-1500, 302, -1150);
  scene.add(lava);
  const lavaLight = new THREE.PointLight(0xff6a2a, 900, 1100, 1.6);
  lavaLight.position.set(-1500, 340, -1150);
  scene.add(lavaLight);

  // --- Pine forests: FEW and SPACED, so every tree reads on its own —
  // Tidewing's trees are sparse simple cones with gaps between them, not
  // a dense dark mass. 750 trees in separated stands, bigger, crisper
  // 8-sided cones, brighter greens.
  const treeSpots = [];
  let tries = 0;
  while (treeSpots.length < 750 && tries < 30000) {
    tries++;
    const x = (Math.random() * 2 - 1) * 2800, z = (Math.random() * 2 - 1) * 2800;
    const h = terrainHeight(x, z);
    if (h < 12 || h > 150) continue;
    if (Math.abs(x) < 260 && Math.abs(z - 620) < 480) continue; // keep town clear
    if (Math.abs(x) < 70 && z > 150 && z < 1100) continue; // keep runway clear
    // Clump gate: only where the low-frequency stand noise is high —
    // a high gate leaves wide gaps between stands.
    const cl = Math.sin(x * 0.004 + 1.7) * Math.sin(z * 0.004 + 0.6)
      + 0.5 * Math.sin(x * 0.011 + 4.2) * Math.sin(z * 0.011 + 2.1);
    if (cl < 0.15) continue;
    treeSpots.push([x, h, z]);
  }
  const cone = new THREE.ConeGeometry(7, 26, 8);
  const coneMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const cones = new THREE.InstancedMesh(cone, coneMat, treeSpots.length);
  const trunkGeo = new THREE.CylinderGeometry(1.1, 1.5, 9, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2e });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const treeGreens = [new THREE.Color(0x2f7a2e), new THREE.Color(0x3d8a37), new THREE.Color(0x63b84a), new THREE.Color(0x2a6e33)];
  treeSpots.forEach(([x, h, z], i) => {
    const s = 0.9 + Math.random() * 1.2;
    m4.compose(v3.set(x, h + 13 * s, z), q4.identity(), s3.set(s, s, s));
    cones.setMatrixAt(i, m4);
    cones.setColorAt(i, treeGreens[i % treeGreens.length]);
    m4.compose(v3.set(x, h + 4 * s, z), q4.identity(), s3.set(s, s, s));
    trunks.setMatrixAt(i, m4);
  });
  cones.instanceColor.needsUpdate = true;
  scene.add(cones);
  scene.add(trunks);

  // --- Boulders on the slopes + low bushes on the grass.
  const rockGeo = new THREE.DodecahedronGeometry(6, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a8178 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 180);
  const eul = new THREE.Euler();
  for (let i = 0; i < 180; i++) {
    const x = (Math.random() * 2 - 1) * 2700, z = (Math.random() * 2 - 1) * 2700;
    const h = terrainHeight(x, z);
    if (h < 30 || h > 330) { rocks.setMatrixAt(i, m4.makeScale(0.001, 0.001, 0.001)); continue; }
    const s = 0.6 + Math.random() * 1.8;
    eul.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6);
    q4.setFromEuler(eul);
    m4.compose(v3.set(x, h + 2 * s, z), q4, s3.set(s, s * 0.75, s));
    rocks.setMatrixAt(i, m4);
  }
  scene.add(rocks);
  const bushGeo = new THREE.SphereGeometry(4, 6, 5);
  const bushMat = new THREE.MeshLambertMaterial({ color: 0x3a6e2f });
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, 280);
  for (let i = 0; i < 280; i++) {
    const x = (Math.random() * 2 - 1) * 2700, z = (Math.random() * 2 - 1) * 2700;
    const h = terrainHeight(x, z);
    if (h < 10 || h > 160) { bushes.setMatrixAt(i, m4.makeScale(0.001, 0.001, 0.001)); continue; }
    const s = 0.7 + Math.random() * 1.4;
    m4.compose(v3.set(x, h + 1.5 * s, z), q4.identity(), s3.set(s, s * 0.6, s));
    bushes.setMatrixAt(i, m4);
  }
  scene.add(bushes);

  // --- Coastal road: a ribbon hugging Lumen's coast, following the
  // terrain, so the home island reads as inhabited from the air.
  {
    const pts = [];
    for (let a = 0; a < Math.PI * 2; a += Math.PI * 2 / 110) {
      const x = 780 * Math.cos(a), z = 620 + 620 * Math.sin(a);
      if (terrainHeight(x, z) < 9) continue;
      pts.push([x, z]);
    }
    const posArr = [], idxArr = [];
    pts.forEach(([x, z], i) => {
      const [nx, nz] = pts[(i + 1) % pts.length];
      const [px, pz] = pts[(i - 1 + pts.length) % pts.length];
      let tx = nx - px, tz = nz - pz;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl; tz /= tl;
      const ox = -tz * 4.5, oz = tx * 4.5;
      posArr.push(x - ox, terrainHeight(x - ox, z - oz) + 1.2, z - oz);
      posArr.push(x + ox, terrainHeight(x + ox, z + oz) + 1.2, z + oz);
      if (i > 0) {
        const b = (i - 1) * 2;
        idxArr.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    });
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    rg.setIndex(idxArr);
    rg.computeVertexNormals();
    scene.add(new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: 0x3d4148 })));
  }

  // --- Port Lumen town: boxes with warm emissive windows, plus a lighthouse.
  const town = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc8 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xb0522e });
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let i = 0; i < 64; i++) {
    const bx = -260 + (i % 8) * 62 + (Math.random() * 20 - 10);
    const bz = 980 + Math.floor(i / 8) * 58 + (Math.random() * 16 - 8);
    const h = terrainHeight(bx, bz);
    if (h < 8) continue;
    const w = 16 + Math.random() * 14, d = 14 + Math.random() * 12, ht = 10 + Math.random() * 22;
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), wallMat);
    house.position.set(bx, h + ht / 2, bz);
    town.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 6, 4), roofMat);
    roof.position.set(bx, h + ht + 3, bz);
    roof.rotation.y = Math.PI / 4;
    town.add(roof);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, 3), winMat);
    win.position.set(bx, h + ht * 0.55, bz - d / 2 - 0.1);
    win.rotation.y = Math.PI;
    town.add(win);
  }
  // Lighthouse on the harbour point, striped tower + lamp.
  const light = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 55, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
  light.position.set(-330, terrainHeight(-330, 420) + 27, 420);
  town.add(light);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
  lamp.position.set(-330, terrainHeight(-330, 420) + 58, 420);
  town.add(lamp);
  // Hijau hamlet: a dozen small houses by the Hijau Strip.
  for (let i = 0; i < 12; i++) {
    const bx = 1180 + (i % 4) * 55 + (Math.random() * 16 - 8);
    const bz = -420 + Math.floor(i / 4) * 48 + (Math.random() * 12 - 6);
    const h = terrainHeight(bx, bz);
    if (h < 8) continue;
    const w = 12 + Math.random() * 8, d = 11 + Math.random() * 8, ht = 8 + Math.random() * 10;
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), wallMat);
    house.position.set(bx, h + ht / 2, bz);
    town.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 5, 4), roofMat);
    roof.position.set(bx, h + ht + 2.5, bz);
    roof.rotation.y = Math.PI / 4;
    town.add(roof);
  }
  world.cityLights = town;
  scene.add(town);

  // --- Ember Arch: the strait's landmark. A natural rock arch on a sea
  // stack in the southern sea — two dark red-brown pillars and a thick
  // lintel, one solid silhouette against the sky and sea. It is the
  // place's signature: it reads at thumbnail size, it recurs across
  // shots, and no other entry has it. (NOT a red suspension bridge —
  // that is SKYBOUND's. This is rock, and it is ours.)
  {
    const arch = new THREE.Group();
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x6a4034 });
    const rockDark = new THREE.MeshLambertMaterial({ color: 0x54332a });
    // Islet base: a low rock slab breaking the water.
    const base = new THREE.Mesh(new THREE.CylinderGeometry(62, 78, 14, 12), rockDark);
    base.position.set(EMBER_ARCH.x, -2, EMBER_ARCH.z);
    arch.add(base);
    // Two pillars, slightly tapered, leaning a touch outward.
    for (const sx of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, 56, 10), rockMat);
      pillar.position.set(EMBER_ARCH.x + sx * 38, 26, EMBER_ARCH.z);
      pillar.rotation.z = -sx * 0.05;
      arch.add(pillar);
    }
    // Lintel: a half-torus crowning the pillars, tube thick enough to
    // read as one bold band. Top of the arch ≈ 99 m above the sea.
    const lintel = new THREE.Mesh(
      new THREE.TorusGeometry(38, 11, 10, 24, Math.PI), rockMat);
    lintel.position.set(EMBER_ARCH.x, 50, EMBER_ARCH.z);
    arch.add(lintel);
    // A couple of boulders at the foot, so the stack meets the water.
    for (const [ox, oz, s] of [[-58, 18, 9], [55, -22, 11], [20, 48, 7]]) {
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockDark);
      b.position.set(EMBER_ARCH.x + ox, 1, EMBER_ARCH.z + oz);
      b.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
      arch.add(b);
    }
    scene.add(arch);
  }

  // --- Cumulus clouds: FEW, small and white, riding high — Tidewing's
  // sky is mostly clean blue with a handful of small white puffs, not a
  // crowded deck. 26 clusters, kept high so they never sit in a shot.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 26; i++) {
    const cl = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < puffs; j++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(30 + Math.random() * 26, 10, 8), cloudMat);
      p.position.set(j * 40 - puffs * 18 + Math.random() * 14, Math.random() * 12, Math.random() * 30 - 15);
      p.scale.y = 0.55;
      cl.add(p);
    }
    cl.position.set((Math.random() * 2 - 1) * 2700, 520 + Math.random() * 280, (Math.random() * 2 - 1) * 2700);
    cl.userData.speed = 2 + Math.random() * 3;
    scene.add(cl);
    world.clouds.push(cl);
  }
  // Low storm clouds: only 3, pale grey — no dark masses in the sky.
  const stormMat = new THREE.MeshLambertMaterial({ color: 0xaab0c6, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 3; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(46 + Math.random() * 30, 10, 8), stormMat);
      p.position.set(j * 52 - 70 + Math.random() * 14, Math.random() * 10, Math.random() * 30 - 15);
      p.scale.y = 0.5;
      cl.add(p);
    }
    cl.position.set((Math.random() * 2 - 1) * 2400, 380 + Math.random() * 60, (Math.random() * 2 - 1) * 2400);
    cl.userData.speed = 3 + Math.random() * 3;
    scene.add(cl);
    world.clouds.push(cl);
  }

  // --- Runways: dark strips + white centre dashes + threshold bars + edge lights.
  for (const f of AIRFIELDS) {
    const g = new THREE.Group();
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(f.wid, f.len),
      new THREE.MeshLambertMaterial({ color: 0x2c2f36 }));
    strip.rotation.x = -Math.PI / 2;
    g.add(strip);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
    for (let d = -f.len / 2 + 40; d < f.len / 2 - 30; d += 60) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 26), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.y = 0.15;
      dash.position.z = d;
      g.add(dash);
    }
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x7dff9a });
    const lightMat2 = new THREE.MeshBasicMaterial({ color: 0xff5a4d });
    for (let d = -f.len / 2 + 10; d <= f.len / 2 - 10; d += 80) {
      for (const side of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(2.6, 6, 6), side < 0 ? lightMat : lightMat2);
        l.position.set(side * (f.wid / 2 + 3), 1.6, d);
        g.add(l);
      }
    }
    // Approach lights: a white bar leading in from behind the threshold,
    // so a night final reads as a runway, not a dark field.
    const appMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let k = 1; k <= 5; k++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(2.2, 6, 6), appMat);
      l.position.set(0, 1.6, f.len / 2 + k * 45);
      g.add(l);
    }
    g.position.set(f.x, f.alt + 0.6, f.z);
    // Strip long axis = landing direction (sin a, -cos a): rotation.y = pi - a.
    g.rotation.y = Math.PI - (f.headingDeg * Math.PI) / 180;
    scene.add(g);
  }

  // --- Windsock at Lumen + harbour boats (simple hulls on the water).
  const sock = new THREE.Mesh(new THREE.ConeGeometry(4, 18, 8),
    new THREE.MeshLambertMaterial({ color: 0xff7a1a }));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(60, 26, 620);
  scene.add(sock);
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xdadada });
  // Anchorage: rejection-sampled onto real water (terrain < 5 m) in the
  // southern strait and the western bay — boats on land would be buried.
  const boatSpots = [];
  let bTries = 0;
  while (boatSpots.length < 14 && bTries < 2000) {
    bTries++;
    const band = Math.random() < 0.7;
    const x = band ? (Math.random() * 2 - 1) * 1500 : -2600 + Math.random() * 700;
    const z = band ? 1600 + Math.random() * 800 : 1500 + Math.random() * 700;
    if (terrainHeight(x, z) > 5) continue;
    boatSpots.push([x, z]);
  }
  for (const [bx, bz] of boatSpots) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(26, 5, 9), boatMat);
    boat.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 7),
      new THREE.MeshLambertMaterial({ color: 0x2e6fb0 }));
    cab.position.set(-3, 5, 0);
    boat.add(cab);
    boat.position.set(bx, 4, bz);
    boat.rotation.y = Math.random() * Math.PI;
    scene.add(boat);
  }
  return world;
}

export function applySkyPhase(world, scene, phase, t = 0) {
  const p = SKY_PHASES[phase] || SKY_PHASES.morning;
  scene.fog.color.setHex(p.fog);
  world.sun.color.setHex(p.sun);
  world.sun.intensity = p.sunI;
  world.sun.position.set(1200 + Math.sin(t) * 200, phase === 'night' ? 500 : 1600, 600);
  world.hemi.intensity = p.hemi;
  world.stars.material.opacity = p.stars;
  // Sky dome gradient: horizon pale, zenith deep.
  const top = lerpColor(0x2a4a7a, 0x0a1026, phase === 'night' || phase === 'dusk' ? 1 : 0);
  const horizon = new THREE.Color(p.sky);
  const posA = world.skyDome.geometry.attributes.position;
  const colA = world.skyDome.geometry.attributes.color;
  for (let i = 0; i < posA.count; i++) {
    const y = posA.getY(i) / 4800; // -1..1
    const k = Math.max(0, Math.min(1, (y + 0.05) * 1.6));
    const cc = horizon.clone().lerp(top, k);
    colA.setXYZ(i, cc.r, cc.g, cc.b);
  }
  colA.needsUpdate = true;
  scene.background = new THREE.Color(p.sky);
}

// Ring meshes: torus + translucent disc, rebuilt per mission.
export function buildRings(scene, rings) {
  const group = new THREE.Group();
  const meshes = [];
  rings.forEach((ring, i) => {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(ring.r, 2.2, 10, 40),
      new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffb020 : 0xff5a1a }),
    );
    torus.position.set(ring.x, ring.y, ring.z);
    // Face the ring toward the previous ring / start so the pilot sees the hole.
    const prev = i === 0 ? { x: 0, y: 120, z: 950 } : rings[i - 1];
    torus.lookAt(prev.x, prev.y, prev.z);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(ring.r * 0.94, 28),
      new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.10, side: THREE.DoubleSide }),
    );
    disc.position.copy(torus.position);
    disc.quaternion.copy(torus.quaternion);
    group.add(torus, disc);
    meshes.push(torus);
  });
  scene.add(group);
  return { group, meshes };
}
