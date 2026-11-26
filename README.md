# Sunset Strait

[![best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/dillahhhh/best-flight-game-entry/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/dillahhhh/best-flight-game-entry/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

**Sunset Strait** — a make.fun entry for
[best-flight-game-20261126-0057](https://make.fun/bounty/best-flight-game-20261126-0057):
a 3D-ish flight game that runs in a desktop browser from static files, no
network, no external assets, no library — hand-written Canvas 2D pseudo-3D.

You are Kakatua-9, a bush plane flying a golden-hour strait between two
islands. Thread 6 glowing rings along the coast, then put her down on the
island runway. The world is a seeded, deterministic coastline: a west island
with a lighthouse, a strait with sun glitter, a north island with a lit
waterfront city, clouds that drift with the wind, farmland patches, a coastal
road and a river, and a 720 m runway with centreline, threshold bars, edge
lights and PAPI approach lights. Chase and cockpit cameras, a lit instrument
panel (artificial horizon, altimeter, airspeed, compass tape, GEAR / FLAP /
BRK / FULL lamps), HUD with altitude, speed, heading, throttle, fuel gauge,
wind, rings, score and timer, a live minimap (Strait Chart), floating +100
score popups, and WebAudio synth beeps for rings, landing, low fuel and
crashes.

Fuel burns with throttle — a full tank lasts ~6 minutes at cruise, a full
route takes ~3.5, so fuel is a decision. The wind blows from the west at
8 kt and pushes the plane and the clouds. Flaps slow you for landing,
the speedbrake sheds speed fast, and landing gear-up on the runway is a
crash. Score: +100 per ring, landing bonus 500 + up to 300 for a quick
time, with an itemised breakdown on the touchdown screen.

## Performance (measured, headless Chrome, software rendering)

The hot loop allocates nothing per frame: terrain projects into flat typed
arrays, draw items are pooled objects sorted by an index array, gradients
are cached (sky, sea, sun sprite, panel glow, horizon haze) and the canvas
backing store is capped at 1920×1080. Measured steady-state at 1280×720:
JS render 2.3 ms average / 3.0 ms p95; at 2560×1440 the cap lifts the frame
rate from 24.5 fps (v1, uncapped canvas) to 29.9 fps in software rendering
— on a real desktop with GPU compositing the 2.3 ms render is 60 fps.
Winnability is proven by a headless Node simulation of the real flight
model: 6 rings in 80.5 s, touchdown at 98.7 s, score 1302, 79% fuel left.

## How to play

| Key | Action |
| --- | --- |
| Enter | Start |
| ← / → or A / D | Bank (turns the plane) |
| ↑ / ↓ or W / S | Pitch (up = climb) |
| Shift / Ctrl or + / − | Throttle up / down |
| Mouse (click canvas first) | Steer |
| G | Landing gear (land with it DOWN) |
| F | Flaps (slower, steadier landing) |
| B (hold) | Speedbrake |
| C | Toggle cockpit / chase camera |
| H | Help overlay |
| P | Pause |
| R | Restart |

Open `?demo=1` to watch the autopilot fly the route itself. `?shot=chase |
cockpit | rings | landing` freezes a composed frame (used for the
screenshots). `?perf=1` records frame times into `window.__perf`.

Score: +100 per ring, landing bonus 500 + up to 300 for a quick time. Crash
into terrain or the sea and it is game over.

## Run

```sh
node serve.ts
# open http://localhost:8080
```

Hand it in (writes `dossier.json` next to the copied game and screenshots):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `game/index.html` — the page; loads the six scripts in `game/src/`.
- `game/src/math3d.js` — seeded RNG, value noise, perspective camera
  (plus `projectInto`, the zero-allocation projector).
- `game/src/world.js` — the islands, sea, sky, city, lighthouse, rings,
  runway, PAPI, fields/roads/river decals, and the pooled, zero-allocation
  render pipeline (flat projection arrays, pooled draw items).
- `game/src/plane.js` — flight model (fuel, wind, flaps, speedbrake, gear
  rules), landing/crash checks, plane drawing.
- `game/src/hud.js` — HUD chips (altitude, speed, heading, throttle, fuel
  gauge, wind), lit instruments, title, help and end screens.
- `game/src/features.js` — live minimap, floating score popups, help overlay.
- `game/src/main.js` — loop, input, cameras, states, shot compositions,
  autopilot demo mode, perf probe.
- `screenshots/` — 4 real renders from the running game: chase, cockpit,
  rings, landing.
- `main.ts` — hand-in program (copies `game/` + `screenshots/`, builds the
  dossier with the vendored make.fun library in `vendor/makefun-game.ts`).
