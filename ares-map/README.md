# A.R.E.S. field map

NASA Space Apps Challenge 2026, "Interplanetary Survival Guide: Martian Map". Team: NASA Walo Ka Group, Delhi.

Live: https://02mandavi.github.io/ares-map/

A layered 3D map of one crater site near Chryse Planitia (28.43° N, 319.77° E). It plans a seven-sol surface mission so a crew knows, before they leave, where they can drive, where they can walk back from, and when they must turn back.

## What it does

- **Overview**: the base, five sol sites and the rover route to each, drawn over NASA orbital layers. The routes bend round steep and rough ground (an A* planner over slope and terrain classes).
- **Mission**: full-screen 3D. The rover drives each sol, base to site and back, with a turn-back clock. "Run all five sols" plays the week.
- **Sols**: one mission day per page, on Mars local time (LMST). Phases, battery, and that day's own checks: tether lock on the crater rim (Sol 6), gas alert and abort (Sol 5), and a contingency Sol 7 that repeats the least finished site.
- **Rover, Vitals, Log, Print**: rover modes, days of air, water, food and power left, a decision log, and paper sheets for when screens go dark.

## NASA and partner data

| Layer | Product | Resolution | Credit |
|---|---|---|---|
| CTX image | MRO CTX P15_006980_2087 | ~5.7 m/px, shown ~20 m/px | NASA/JPL/MSSS |
| HiRISE strips | ESP_022869_2085, ESP_050666_2090 | 0.5 m/px source, 2 m/px shown | NASA/JPL/University of Arizona |
| THEMIS day and night IR | THEMIS controlled mosaic MC-11 | 100 m/px | NASA/JPL/ASU, USGS |
| Heights | HRSC-MOLA blended DEM v2 | 200 m/px | ESA/DLR/FU Berlin, NASA MOLA, USGS |
| Surface radiation | MSL RAD at Gale crater | one site | Hassler et al. 2014, Science (verify) |

Derived layers (slope, coverage, radio shadow, terrain classes) are computed in the browser from these. `tools/prep.py` rebuilds the data files from the raw downloads in `tools/raw`.

## Limits, stated plainly

- Heights are a 200 m grid. In the 3D view the ground is smoothed for display only; slope, reach, routes and line of sight use the raw grid.
- The CTX image is placed by its footprint and shifted 2 km to match THEMIS (correlation 0.47), so it can sit a few hundred metres off.
- Slope limits, walking speed and terrain classes are placeholders, not checked on the ground. Numbers marked "verify" are not confirmed.
- Radiation is Gale crater's measurement, not this site's.
- No backend: state lives in the browser. Sign-in has no password (one shared demo device).

## Use of AI

We used AI (Anthropic Claude, via Claude Code) to help write code, copy and documentation, and to review the code. The team chose the site, the mission design and the data, and checked the results. All map data is from NASA, ESA and USGS, credited above; no images are AI-generated.

The in-app assistant (Chat) runs only with a key the user pastes in (Google Gemini, Anthropic) or a local Ollama model. Without a key it is off.

## Run it

```bash
npm install
npm run dev
```

Tests: `npm test`. Build: `npx vite build`.

## Working from any computer

The code lives on the `source` branch; the live site is the built `dist` on `main`.

```bash
git clone -b source https://github.com/02mandavi/ares-map.git ares
cd ares/ares-map && npm install
git clone -b main https://github.com/02mandavi/ares-map.git dist   # once, for deploys
```

Before you start: `git pull`. When done: commit, then `git push`.
Deploy: `npx vite build`, then in `dist`: `git add -A`, commit, `git push`. Vite keeps `dist/.git` when it rebuilds.
