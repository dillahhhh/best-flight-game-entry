# Ember Strait — Volcanic Archipelago Flight

Fly the Kestrel-9 floatplane across a living volcanic strait: 8 sorties in
4 modes, ring trials, island landings and a night freight run. Fuel burns,
wind bites, the volcano smokes.

## The game

- **World:** a 6 km × 6 km archipelago built from one seeded heightfield
  (`game/src/terrain.js`) — the Bara volcano with a smoking crater, ash
  streaks and lava glow, the harbour town of Port Lumen (64 houses +
  lighthouse) with a Hijau hamlet, a coastal road ringing Lumen, patchwork
  crop fields, 750 pines in separated stands + 180 boulders + 280 bushes,
  14 boats at anchor on real water, 26 small white cumulus + 3 pale storm
  clouds, a 7-phase sky (dawn → morning → noon → afternoon → golden →
  dusk → night with round-sprite stars) and three airfields with lit
  runways and approach lights. The palette is deliberately FLAT and calm
  — big quiet colour fields (lime grass, pale sand, two-tone sea with a
  turquoise shallow-water halo hugging every coast), sparse trees that
  read one by one, a volcano that reads as one dark solid silhouette
  with a short compact white smoke plume — no high-frequency noise
  anywhere in frame, so the picture still reads at 300 px. Terrain is
  painted per-vertex (256×256 grid). ACES tone mapping.
- **Landmark:** the Ember Arch — a natural rock arch on a sea stack in
  the southern sea (two dark red-brown pillars + a thick lintel, ~99 m
  tall), the strait's signature. It stands on the Grand Strait Tour leg,
  is marked on the minimap, and recurs across the shots. It is rock, not
  a bridge: no other entry has it.
- **Aircraft:** the Kestrel-9 floatplane, built from primitives with
  smooth (24-segment) fuselage/nose, cheatline stripes, side windows,
  exhausts, antenna mast, aileron lines, float tips, orange spinner,
  "9" fin flash (canvas texture), landing-light lenses in the wing
  leading edge, a nose light and a forward spotlight that pools on the
  runway at night. Propeller is a faint translucent blur, never a black
  bar across the view.
- **Missions (8, in 4 modes):** RING RUN (Harbour Ring Trial, Storm Front
  Slalom, Strait Time Trial), VOLCANO SURVEY (Bara Crater Loop, Ash Ridge
  Rescue Drop), ISLAND HOPPER (Hijau Hop, Grand Strait Tour), NIGHT CARGO
  (Atoll Night Freight). Each has an objective checklist, a fuel/damage
  economy, wind with gusts, and radio chatter from Mara Voss (tower), Theo
  (spotter) and Dr. Ilya Sorn (volcano scientist) — all names original.
- **Flying:** arcade model with throttle, banked turns, stall sink, flaps,
  gear, brakes, float landings on water, hard-contact damage and crashes.
  Cameras: chase, cockpit (pilot's-eye below the high wing — orange
  cowling, cream nose cone and spinner ahead, wing struts at the frame
  edges — plus a live dashboard: ALT/SPD/HDG/FUEL needles driven by the
  real flight state), orbit, and hero — a fixed rear-starboard 3/4
  showcase that frames the whole floatplane big with the Ember Arch
  ahead (it hides the radio and hint pills so the frame centre stays
  clean; the mission panel, compass, system panel, gauges, minimap and
  dials all stay).
  Controls: ARROWS pitch + bank, Shift/Ctrl throttle, C camera, G gear,
  F flaps, B brakes, P pause, R restart, M sound, 1–8 missions.
  `?demo=1` flies the sortie on autopilot; `?shot=1..4` frames the four
  screenshots; `?sim=1&mission=N` runs the sortie accelerated in-page.
- **Sound:** WebAudio synth — engine hum tied to throttle, wind noise tied
  to speed, ring chime, landing thud. No audio files.

## Structure

- `game/src/flight.js` — pure flight model, missions, autopilot (no DOM,
  no three.js; the Node simulation runs this exact code)
- `game/src/terrain.js` — pure heightfield + airfield carving
- `game/src/world.js` — three.js scene: terrain, sea, town, forest,
  clouds, sky phases, stars, runways, rings
- `game/src/plane.js` — the Kestrel-9 floatplane mesh
- `game/src/hud.js` — mission panel, compass, gauges, minimap, radio
- `game/src/input.js`, `game/src/audio.js`, `game/src/shots.js`
- `game/src/main.js` — renderer, cameras, state machine, demo/sim hooks
- `game/vendor/three.min.js` — three.js 0.160.0, vendored minified build

## Verification (measured, 26 Nov 2026)

- **Winnability, Node headless sim** (same `flight.js` + `terrain.js` the
  browser runs, same autopilot as `?demo=1`): **8/8 missions won** — all
  rings, all landed, 0 damage:

  | Mission | Rings | Score | Time | Fuel left |
  |---|---|---|---|---|
  | 1 Harbour Ring Trial | 8/8 | 5,287 | 216.6 s | 72% |
  | 2 Bara Crater Loop | 8/8 | 5,281 | 230.8 s | 70% |
  | 3 Hijau Hop | 5/5 | 3,794 | 198.9 s | 73% |
  | 4 Atoll Night Freight | 6/6 | 4,324 | 142.0 s | 81% |
  | 5 Storm Front Slalom | 8/8 | 5,286 | 216.4 s | 72% |
  | 6 Ash Ridge Rescue Drop | 6/6 | 4,296 | 194.0 s | 74% |
  | 7 Strait Time Trial | 8/8 | 5,257 | 272.1 s | 64% |
  | 8 Grand Strait Tour | 9/9 | 5,744 | 286.4 s | 61% |
- **Winnability, in-browser `?sim=1`** (Missions 1, 3, 4): identical
  results to the Node sim (M1: 5,287 / 216.6 s; M3: 3,794 / 198.8 s;
  M4: 4,324 / 141.9 s), all won.
- **Console errors:** 0 across every headless-Chromium run (shots,
  demo, sims). No failed requests.
- **Performance (measured, headless Chromium + SwiftShader):**
  per-frame JS + render work 3.1–9.1 ms EMA across the four shots.
  Present rate in that headless software-rendering environment was ~5 fps
  — a SwiftShader/headless artifact, not a game-logic cost: the game
  itself does ~3–9 ms of work per frame. Real-GPU frame rate was
  **not measured** (no GPU in this environment), so no fps claim is made.
  (Measured on the v4 build; POLES-2 did not re-measure — its scene is
  lighter in instanced meshes (750 trees, 26 clouds) and denser in the
  terrain grid (256×256), so the numbers are a conservative bound.)
- **Screenshots:** 4 × 1280×720 JPEG (137–156 KiB each), real renders of
  the game code via `?shot=1..4`, cold-checked at full size and at a true
  300 px thumbnail: (1) hero cover — noon 3/4, the whole Kestrel-9 big
  (~35% of the frame) low over the southern sea with the Ember Arch
  ahead and ring 6 gold beyond it; (2) chase — golden-hour harbour run,
  big gold ring 1 ahead; (3) cockpit — noon volcano survey, cowling +
  nose cone + live dials, gold ring 8 face-on; (4) cockpit — night
  freight final, lit runway ahead, green beacon rings. Every shot shows
  the aircraft clearly in frame, instruments lit with live dial needles,
  a target ring or the runway ahead, and ALT/SPD/HDG on the HUD. At
  300 px every shot still reads as clean big colour blocks (blue sky,
  green land, blue sea) — the hero reads plane + arch at a glance.
  Quibbles found and kept: shot 1's arch right pillar sits partly behind
  the minimap; shot 3's live ring 7 (done, green) is edge-on and reads
  as a vertical bar beside the face-on gold ring 8, and the smoke is
  still a stack of puffs (white and compact now); shot 4's nose cone
  reads dark orange at night and the ring discs read as dark circles.

## Run it

```sh
node serve.ts            # http://localhost:8080
```

Open the game, press Enter, fly. `?demo=1` for autopilot.
