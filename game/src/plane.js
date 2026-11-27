// plane.js — the Kestrel-9 floatplane, redesigned to read as a REAL
// bush floatplane (de Havilland Beaver / Cessna Caravan on floats) at
// first glance, even as a 300 px thumbnail.
//
// Proportions first, detail second: a long tapered fuselage, a tapered
// high wing whose span is proportional to the body, a balanced tail and
// slim stepped floats. As a flat black silhouette it must still say
// "airplane", not "box". Livery stays orange/cream with the "9" on the
// fin; overall size stays ~12 long / 15.5 span (scale 1.25) so the four
// screenshot framings do not move.
//
// Local space: nose forward = -z, +y up. The fuselage is a lathe
// (radius profile along its length) so the cross-section is round and
// the nose tapers smoothly instead of a plain cylinder + cone.

import * as THREE from 'three';

// Fuselage profile: [radius, station] with station 0 = tail tip,
// station 12 = nose tip. Lathe +Y maps to -Z after rotation, so the
// mesh sits at z = +5.4 (tail tip) and the nose lands at z = -6.6.
const FUSE_PROFILE = [
  [0.06, 0.0], [0.30, 0.7], [0.48, 1.6], [0.60, 2.6], [0.70, 3.8],
  [0.80, 5.0], [0.88, 6.2], [0.93, 7.2], [0.95, 8.0], [0.93, 8.8],
  [0.88, 9.6], [0.84, 10.4], [0.76, 11.1], [0.62, 11.6], [0.45, 12.0],
];
const FUSE_LEN = 12.0;
const FUSE_Z = 5.4;   // world z of the tail tip
const FUSE_Y = 0.35;  // fuselage centreline height
const FUSE_W = 0.88;  // cross-section: narrower than tall
const FUSE_H = 1.12;

function radiusAt(station) {
  const p = FUSE_PROFILE;
  if (station <= p[0][1]) return p[0][0];
  for (let i = 1; i < p.length; i++) {
    if (station <= p[i][1]) {
      const [r0, s0] = p[i - 1], [r1, s1] = p[i];
      return r0 + (r1 - r0) * (station - s0) / (s1 - s0);
    }
  }
  return p[p.length - 1][0];
}

// Thin flat panel from a planform outline: points are [spanwise x,
// chordwise y] with +y = forward. Extruded thin, laid flat (shape +y
// becomes -z), then given a slight dihedral lift (|x| * dihedral).
function flatPanel(pts, thickness, mat, dihedral = 0.05) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -thickness / 2, 0);
  if (dihedral) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) + Math.abs(pos.getX(i)) * dihedral);
    }
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// Streamlined strut between two points: a flattened box whose long
// axis runs a->b and whose wide face runs fore-aft.
function strutBetween(a, b, w, d, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

export function buildPlane() {
  const plane = new THREE.Group();
  const orange = new THREE.MeshLambertMaterial({ color: 0xe86a1a });
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2ead8 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8, emissive: 0x2a5a6a, transparent: true, opacity: 0.45 });

  // ---- Fuselage: lathe, round section, long taper to the nose ----
  const fusePts = FUSE_PROFILE.map(([r, s]) => new THREE.Vector2(r, s));
  const fuseGeo = new THREE.LatheGeometry(fusePts, 28);
  fuseGeo.scale(FUSE_W, 1, FUSE_H);
  const body = new THREE.Mesh(fuseGeo, orange);
  body.rotation.x = -Math.PI / 2; // lathe +Y -> -Z (nose forward)
  body.position.set(0, FUSE_Y, FUSE_Z);
  plane.add(body);

  // Cream nose cap: the last 1.4 m of the lathe, radius +0.015 so it
  // sits proud of the orange cowling — the pale nose reads in the
  // cockpit view (shots 3/4) and from the front 3/4 (shot 1).
  const nosePts = FUSE_PROFILE.filter(([, s]) => s >= 10.6)
    .map(([r, s]) => new THREE.Vector2(r + 0.015, s));
  nosePts.unshift(new THREE.Vector2(radiusAt(10.6) + 0.015, 10.6));
  const noseGeo = new THREE.LatheGeometry(nosePts, 28);
  noseGeo.scale(FUSE_W, 1, FUSE_H);
  const nose = new THREE.Mesh(noseGeo, cream);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, FUSE_Y, FUSE_Z);
  plane.add(nose);

  // Cowling separation ring: thin dark band where the cream nose meets
  // the orange cowling — one crisp line, visible at range.
  const cowlingRing = new THREE.Mesh(new THREE.TorusGeometry(0.845, 0.035, 8, 32), dark);
  cowlingRing.position.set(0, FUSE_Y, FUSE_Z - 10.6);
  cowlingRing.scale.set(FUSE_W, FUSE_H, 1);
  plane.add(cowlingRing);

  // Cheatline: cream tube hugging the fuselage flank on each side,
  // following the taper (radiusAt) instead of a straight box floating
  // off a tapered body. One bold stripe, readable at 300 px.
  for (const sx of [-1, 1]) {
    const curvePts = [];
    for (let z = -4.2; z <= 2.8; z += 0.35) {
      const st = FUSE_Z - z;
      curvePts.push(new THREE.Vector3(sx * (radiusAt(st) * FUSE_W + 0.01), 0.42, z));
    }
    const stripe = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), 32, 0.16, 6, false), cream);
    plane.add(stripe);
    // Side window beside the canopy.
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 1.6), glass);
    win.position.set(sx * 0.72, 0.75, -0.6);
    plane.add(win);
    // Exhaust stack on the cowling.
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), dark);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(sx * 0.72, 0.05, -5.4);
    plane.add(exhaust);
  }
  // Antenna mast behind the canopy.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), dark);
  mast.position.set(0, 1.6, 2.0);
  plane.add(mast);
  // Wraparound windshield / canopy: flattened bubble, tucked forward
  // under the wing leading edge so it never pokes through the wing,
  // with the lit instrument glow inside.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 18), glass);
  canopy.scale.set(0.88, 0.5, 1.45);
  canopy.position.set(0, 1.3, -2.5);
  plane.add(canopy);
  const panelGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.7),
    new THREE.MeshBasicMaterial({ color: 0x7dffb0 }));
  panelGlow.position.set(0, 1.15, -2.6);
  panelGlow.rotation.x = -0.5;
  plane.add(panelGlow);

  // ---- High wing: tapered planform, thin dihedral, orange tips ----
  // Root chord 2.6, tip chord 1.5, leading edge sweeps 0.45 aft to the
  // tip. Outline is a hexagon: root LE -> tip LE -> tip TE -> root TE.
  const wing = flatPanel([
    [0, 1.3], [7.75, 0.30], [7.75, -1.20], [0, -1.3], [-7.75, -1.20], [-7.75, 0.30],
  ], 0.26, cream, 0.05);
  wing.position.set(0, 1.9, -0.6);
  plane.add(wing);
  // Orange tip caps, exact taper match at the outer 0.7 m.
  for (const sx of [-1, 1]) {
    const x0 = 7.05, x1 = 7.75;
    const le = (x) => 1.3 - (1.0 * x) / 7.75;
    const te = (x) => -1.3 + (0.1 * x) / 7.75;
    const cap = flatPanel([
      [sx * x0, le(x0)], [sx * x1, le(x1)], [sx * x1, te(x1)], [sx * x0, te(x0)],
    ], 0.28, orange, 0.05);
    cap.position.set(0, 1.9, -0.6);
    plane.add(cap);
    // Dark aileron line on the trailing edge, following the sweep.
    const ail = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.05, 0.35), dark);
    ail.position.set(sx * 4.6, 1.9 + 4.6 * 0.05 + 0.14, 0.55);
    ail.rotation.y = -sx * 0.013;
    plane.add(ail);
  }
  // Wing-root fairing / cabane: bridges the fuselage crown to the wing
  // so the wing never looks like it floats above the body.
  const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 2.4), orange);
  fairing.position.set(0, 1.62, -0.6);
  plane.add(fairing);
  // Wing struts: from the lower fuselage up to the wing spar — real
  // structure, angled, fore-aft wide.
  for (const sx of [-1, 1]) {
    plane.add(strutBetween(
      new THREE.Vector3(sx * 0.78, 0.15, -0.6),
      new THREE.Vector3(sx * 3.1, 1.95, -0.75), 0.14, 0.45, dark));
  }

  // ---- Tail: tapered stabiliser + swept fin with the "9" flash ----
  const stab = flatPanel([
    [0, 0.85], [2.7, 0.15], [2.7, -0.85], [0, -0.85], [-2.7, -0.85], [-2.7, 0.15],
  ], 0.2, cream, 0);
  stab.position.set(0, 0.55, 4.6);
  plane.add(stab);
  // Fin: swept shape, extruded thin. Shape space x = -z (forward is
  // +x), y = up; rotated so it stands vertical on the tail cone.
  const finShape = new THREE.Shape();
  finShape.moveTo(-3.7, 0.35);
  finShape.lineTo(-4.5, 2.9);
  finShape.lineTo(-5.4, 2.9);
  finShape.lineTo(-5.6, 0.35);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.2, bevelEnabled: false });
  finGeo.rotateY(Math.PI / 2);
  finGeo.translate(-0.1, 0, 0);
  const fin = new THREE.Mesh(finGeo, orange);
  plane.add(fin);
  // "9" on both sides of the fin, drawn once on a canvas texture.
  const nineCanvas = document.createElement('canvas');
  nineCanvas.width = 64; nineCanvas.height = 128;
  const nctx = nineCanvas.getContext('2d');
  nctx.fillStyle = '#ffffff';
  nctx.font = 'bold 96px sans-serif';
  nctx.textAlign = 'center'; nctx.textBaseline = 'middle';
  nctx.fillText('9', 32, 66);
  const nineTex = new THREE.CanvasTexture(nineCanvas);
  const nineMat = new THREE.MeshBasicMaterial({ map: nineTex, transparent: true });
  for (const sx of [-1, 1]) {
    const nine = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), nineMat);
    nine.position.set(sx * 0.13, 1.6, 4.7);
    nine.rotation.y = sx * Math.PI / 2;
    plane.add(nine);
  }

  // ---- Twin floats: slim lathe with a pointed nose and a step ----
  // Profile: station 0 = tail tip, 7.2 = nose tip. The notch at
  // station ~4.0 is the planing step.
  const floatProfile = [
    [0.10, 0.0], [0.28, 0.6], [0.40, 1.5], [0.48, 2.6], [0.50, 3.4],
    [0.50, 3.9], [0.44, 4.05], [0.50, 4.25], [0.50, 5.2], [0.46, 6.0],
    [0.34, 6.6], [0.18, 7.0], [0.03, 7.2],
  ].map(([r, s]) => new THREE.Vector2(r, s));
  for (const sx of [-1, 1]) {
    const fGeo = new THREE.LatheGeometry(floatProfile, 20);
    fGeo.scale(0.8, 1, 1.2); // narrower than tall, like a real float
    const fl = new THREE.Mesh(fGeo, cream);
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(sx * 2.1, -1.7, 2.6); // nose at z=-4.6, tail at +2.6
    plane.add(fl);
    // Orange nose tip on the float.
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 12), orange);
    tip.rotation.x = -Math.PI / 2;
    tip.scale.set(0.8, 1.15, 1);
    tip.position.set(sx * 2.1, -1.7, -5.0);
    plane.add(tip);
    // Float struts: front + rear, angled in to meet the lower fuselage.
    plane.add(strutBetween(
      new THREE.Vector3(sx * 2.1, -1.15, -2.6),
      new THREE.Vector3(sx * 0.75, -0.25, -2.4), 0.12, 0.4, dark));
    plane.add(strutBetween(
      new THREE.Vector3(sx * 2.1, -1.15, 1.6),
      new THREE.Vector3(sx * 0.45, -0.2, 1.8), 0.12, 0.4, dark));
  }
  // Landing lights in the wing leading edge: two white lenses that read
  // at night, plus a nose point light washing the cowling and a forward
  // spotlight pooling on the runway ahead.
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  for (const sx of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), lensMat);
    lens.position.set(sx * 3.0, 2.05, -1.55);
    plane.add(lens);
  }
  const noseLight = new THREE.PointLight(0xffe8b0, 30, 32, 1.6);
  noseLight.position.set(0, 1.0, -6.6);
  plane.add(noseLight);
  const spot = new THREE.SpotLight(0xfff2cf, 3000, 600, 0.45, 0.6, 1.2);
  spot.position.set(0, 0.35, -7.3);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -10, -140);
  plane.add(spotTarget);
  spot.target = spotTarget;
  plane.add(spot);
  // disc, spun by main.js. A spinning prop reads as a blur, not a black
  // bar across the cockpit view — the blades are 12% opaque.
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 16), orange);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.5;
  prop.add(spinner);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), dark);
  prop.add(hub);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36, transparent: true, opacity: 0.12, depthWrite: false });
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.6, 0.12), bladeMat);
    blade.rotation.z = a;
    prop.add(blade);
  }
  const blurDisc = new THREE.Mesh(new THREE.CircleGeometry(2.55, 24),
    new THREE.MeshBasicMaterial({ color: 0x1a1d22, transparent: true, opacity: 0.02, side: THREE.DoubleSide, depthWrite: false }));
  prop.add(blurDisc);
  prop.position.set(0, 0.35, -6.9);
  plane.add(prop);
  // Nav lights: red left, green right, white tail.
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  navL.position.set(-7.85, 2.3, -0.15);
  plane.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2aff5a }));
  navR.position.set(7.85, 2.3, -0.15);
  plane.add(navR);
  const navT = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  navT.position.set(0, 0.6, 5.2);
  plane.add(navT);
  plane.userData.prop = prop;
  plane.userData.canopy = canopy;
  plane.userData.panelGlow = panelGlow;
  plane.scale.setScalar(1.25);
  return plane;
}

// Pose the plane group from flight state. Heading 0 = north (-z).
export function posePlane(plane, s) {
  plane.position.set(s.x, s.y, s.z);
  plane.rotation.order = 'YXZ';
  // Nose (local -z) must point along the flight direction (sin h, -cos h):
  // three.js R_y(theta) maps -z to (-sin theta, -cos theta), so theta = -h.
  plane.rotation.y = -s.heading;
  plane.rotation.z = -s.bank;
  plane.rotation.x = s.pitch;
  plane.userData.prop.rotation.z += 0.25 + s.throttle * 0.9;
}
