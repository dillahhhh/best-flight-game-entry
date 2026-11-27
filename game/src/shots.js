// shots.js — the four screenshot framings. Each preset places the real
// flight state, the real mission and the real time-of-day phase, then
// freezes physics so the frame is deterministic. Nothing here draws
// anything the game itself does not draw in normal play.
//
// The set is built on Tidewing's lesson: bright flat daylight, big calm
// colour blocks, one big plane, one landmark. Shot 1 is the hero cover
// (noon, 3/4, plane ~35% of the frame, Ember Arch in the sea); the dusk
// storm shot is dropped — it was the darkest, noisiest frame.

export const SHOTS = [
  {
    // Cover / HERO: noon 3/4 showcase on the Grand Strait Tour leg to
    // ring 6 — the whole Kestrel-9 big in frame (rear-starboard), low
    // over the southern sea, the Ember Arch standing off the port bow
    // and ring 5 green in the distance. Plane, arch and ring sit in the
    // free centre strip between the mission panel and the minimap; sea
    // and sky are big clean blocks. The plane flies low (80 m) so the
    // arch's lintel reads above the horizon instead of sinking behind
    // the gauges.
    missionIndex: 7, phase: 'noon', camera: 'hero',
    pose: { x: 650, y: 80, z: 2600, heading: 0, pitch: 0.02, bank: 0.12, speedKts: 128, throttle: 0.62, fuel: 88, ringIndex: 5, score: 1200 },
    radio: 'MARA VOSS (TOWER): Kestrel-9, Ember Arch ahead — ring six beyond it.',
  },
  {
    // Chase: golden-hour over the harbour, ring 1 ahead, town below,
    // Bara volcano on the horizon.
    missionIndex: 0, phase: 'golden', camera: 'chase',
    pose: { x: -60, y: 165, z: 420, heading: 0.35, pitch: 0.03, bank: -0.12, speedKts: 128, throttle: 0.62, fuel: 87, ringIndex: 0, score: 0 },
    radio: 'MARA VOSS (TOWER): Kestrel-9, wind 300 at 12, rings are live. Fly clean.',
  },
  {
    // Cockpit: noon survey run on the volcano — crater and smoke ahead,
    // ring 8 gold and face-on from this bearing, ring 7 green beside it.
    missionIndex: 1, phase: 'noon', camera: 'cockpit',
    pose: { x: -850, y: 430, z: -700, heading: -0.9, pitch: 0.02, bank: 0.15, speedKts: 122, throttle: 0.58, fuel: 76, ringIndex: 7, score: 3500 },
    radio: 'DR. ILYA SORN: Crater rim is live — hold 400 metres, ash is thin today.',
  },
  {
    // Night freight final: cockpit on the 120° final to the lit Atoll Sandbar.
    missionIndex: 3, phase: 'night', camera: 'cockpit',
    pose: { x: 500, y: 48, z: 1330, heading: 2.09, pitch: -0.05, bank: 0.0, speedKts: 74, throttle: 0.3, fuel: 43, ringIndex: 5, score: 2500 },
    radio: 'THEO (SPOTTER): Stars are out. Trust the instruments, not your eyes.',
  },
];

export function getShot(n) {
  return SHOTS[(n - 1) % SHOTS.length];
}
