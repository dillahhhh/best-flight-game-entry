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
waterfront city, clouds, and a 720 m runway with centreline, threshold bars
and edge lights. Chase and cockpit cameras, a lit instrument panel
(artificial horizon, altimeter, airspeed, compass tape), HUD with altitude,
speed, heading, throttle, rings and score, and WebAudio synth beeps for
rings, landing and crashes.

## How to play

| Key | Action |
| --- | --- |
| Enter | Start |
| ← / → or A / D | Bank (turns the plane) |
| ↑ / ↓ or W / S | Pitch (up = climb) |
| Shift / Ctrl or + / − | Throttle up / down |
| Mouse (click canvas first) | Steer |
| C | Toggle cockpit / chase camera |
| P | Pause |
| R | Restart |

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

- `game/index.html` — the page; loads the five scripts in `game/src/`.
- `game/src/math3d.js` — seeded RNG, value noise, perspective camera.
- `game/src/world.js` — the islands, sea, sky, city, lighthouse, rings, runway.
- `game/src/plane.js` — flight model, landing/crash checks, plane drawing.
- `game/src/hud.js` — HUD chips, lit instruments, title and end screens.
- `game/src/main.js` — loop, input, cameras, states, shot compositions.
- `screenshots/` — 4 real renders from the running game: chase, cockpit,
  rings, landing.
- `main.ts` — hand-in program (copies `game/` + `screenshots/`, builds the
  dossier with the vendored make.fun library in `vendor/makefun-game.ts`).
