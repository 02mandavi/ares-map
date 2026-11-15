// Live monitoring: each crew member, the habitat and the MARS-X HORIZON cabin, driven by the EVA clock.
// Every reading is SIMULATED and every range is a placeholder to check against the cited standard (verify) before use.
import { RATES } from './vitals.js';

// [ok, watch] bounds; outside watch = act now. lo/hi say which side is bad.
export const RANGES = {
  hr: { name: 'Heart rate', unit: 'bpm', hi: [140, 160], src: 'placeholder EVA limits (verify with the flight surgeon)' },
  spo2: { name: 'Blood oxygen (SpO2)', unit: '%', lo: [95, 90], src: 'clinical pulse-oximetry bands' },
  core: { name: 'Core temperature', unit: '°C', hi: [38, 38.5], src: 'placeholder (verify, NASA-STD-3001 Vol. 1)' },
  suitP: { name: 'Suit pressure', unit: 'kPa', lo: [28, 26], src: 'NASA EMU about 29.6 kPa / 4.3 psi (verify)' },
  suitO2: { name: 'Suit oxygen left', unit: '%', lo: [40, 25], src: 'placeholder, 8 h suit supply assumed' },
  suitCO2: { name: 'Suit CO2', unit: 'mmHg', hi: [5, 7.6], src: 'placeholder (verify, NASA-STD-3001 Vol. 2)' },
  dose: { name: 'Dose today', unit: 'mSv', hi: [1, 2], src: 'Curiosity RAD about 0.64 mSv/sol on the surface (Hassler 2014, verify)' },
  cabP: { name: 'Pressure', unit: 'kPa', lo: [55, 52], src: 'exploration atmosphere 56.5 kPa / 34% O2 (NASA EAWG, verify)' },
  habP: { name: 'Pressure', unit: 'kPa', lo: [97, 90], src: 'sea-level 101.3 kPa habitat assumed (placeholder)' },
  o2pct: { name: 'Oxygen', unit: '%', lo: [19.5, 18], src: 'placeholder for a 101.3 kPa habitat (verify)' },
  cabO2: { name: 'Oxygen', unit: '%', lo: [32, 30], src: 'exploration atmosphere 34% O2 (verify)' },
  co2: { name: 'CO2', unit: 'mmHg', hi: [3, 4], src: 'ISS-style limit about 3 mmHg (verify, NASA-STD-3001 Vol. 2)' },
  temp: { name: 'Temperature', unit: '°C', hi: [27, 30], src: 'placeholder 18–27 °C comfort band (verify)' },
  rh: { name: 'Humidity', unit: '%', hi: [70, 80], src: 'placeholder 25–70% band (verify)' },
  batt: { name: 'Battery', unit: '%', lo: [50, 25], src: 'capacity TBD in the MARS-X spec; placeholder 100 kWh' },
};

export function level(id, v) {
  const r = RANGES[id];
  if (r.hi) return v <= r.hi[0] ? 'ok' : v <= r.hi[1] ? 'watch' : 'bad';
  return v >= r.lo[0] ? 'ok' : v >= r.lo[1] ? 'watch' : 'bad';
}

// Rover drive mode for the ground under it. The autonomous system picks it; a crew member or Mission Control may override.
// Thresholds are placeholders (verify against the MARS-X HORIZON spec, Rev 0.1 gives no numbers).
export const MODE_B_SLOPE = 12;
export const MODE_GUIDE = [
  { mode: 'A', ground: 'Flat or gentle ground: smooth ground, loose dust or sand', slope: `up to ${MODE_B_SLOPE}°` },
  { mode: 'B', ground: 'Slopes, rocky ground, rough texture', slope: `over ${MODE_B_SLOPE}°, up to the rover limit` },
  { mode: 'C', ground: 'Any ground in a dust storm: parked, anchors and solar out', slope: 'any' },
  { mode: null, ground: 'Steeper than the rover limit: no mode is safe, the route goes around', slope: 'over the rover limit' },
];
export function autoMode(slope, terrainId, storm) {
  if (storm) return { mode: 'C', why: 'dust storm' };
  if (slope > MODE_B_SLOPE) return { mode: 'B', why: `slope ${slope.toFixed(0)}°, over ${MODE_B_SLOPE}°` };
  if (terrainId === 'rocky' || terrainId === 'rough') return { mode: 'B', why: terrainId === 'rocky' ? 'rocky ground' : 'rough ground' };
  return { mode: 'A', why: `slope ${slope.toFixed(0)}°, ${terrainId === 'loose' ? 'loose ground' : 'smooth ground'}` };
}

// Along a drive leg (picks every 200 m): switch to B one step early, and go back to A only after `minA` steps of easy ground.
// Without this the mode would flip on every rocky 200 m cell.
export const MODE_STEP_KM = 0.2;
export function holdModes(picks, minA = 3) {
  const out = picks.map((p, i) => (p.mode === 'A' && picks[i + 1]?.mode === 'B' ? { mode: 'B', why: `${picks[i + 1].why} just ahead` } : p));
  for (let i = 0; i < out.length;) {
    let j = i; while (j < out.length && out[j].mode === 'A') j++;
    if (j > i && i > 0 && j < out.length && j - i < minA) for (let k = i; k < j; k++) out[k] = { mode: 'B', why: 'holding B: under 0.6 km of easy ground before more slope or rock' };
    i = Math.max(j, i + 1);
  }
  return out;
}

// Who leaves the rover at a stop (placeholder ops rule: the EVA lead and the scientist walk; commander and medic stay in the cabin).
export const EVA_PAIR = ['c2', 'c3'];
export const ROVER_KWH = 100; // placeholder: the MARS-X spec leaves battery capacity TBD
const wob = (t, k) => Math.sin(t * 7.3 + k * 1.7) * 0.5 + Math.sin(t * 2.1 + k) * 0.5; // smooth, repeatable "noise" in -1..1

// pos = positionAt(timeline, t); mode = the rover's drive mode now (autoMode or an override); storm = dust-storm test on.
export function readings(timeline, t, pos, mode, storm) {
  const work = pos.leg?.kind === 'work' && !pos.done, out = t > 0 && !pos.done;
  let onFootH = 0, km = 0; // hours the EVA pair has spent on foot so far, km the rover has driven
  for (const l of timeline.legs) {
    const a = Math.min(t, l.t1) - l.t0; if (a <= 0) continue;
    if (l.kind === 'work') onFootH += a; else km += (l.km ?? 0) * a / (l.t1 - l.t0);
  }
  const crew = ['c1', 'c2', 'c3', 'c4'].map((id, k) => {
    const walking = work && EVA_PAIR.includes(id), where = !out ? 'Habitat' : walking ? `On foot at ${pos.leg.stop.id}` : 'Rover cabin';
    const suited = EVA_PAIR.includes(id) && out;
    const r = {
      hr: Math.round((walking ? 112 : 72) + 8 * wob(t, k)),
      spo2: Math.round(97.5 + 1 * wob(t, k + 3)),
      core: +(36.8 + (walking ? 0.5 : 0) + 0.15 * wob(t, k + 5)).toFixed(1),
      dose: +(t / 24.6 * 0.64 * (walking ? 1 : 0.6) + onFootH / 24.6 * 0.64 * 0.4 * (EVA_PAIR.includes(id) ? 1 : 0)).toFixed(3),
    };
    if (suited) Object.assign(r, { suitP: +(29.6 + 0.2 * wob(t, k + 7)).toFixed(1), suitO2: Math.round(100 - onFootH / 8 * 100), suitCO2: +(walking ? 3.2 + 0.8 * wob(t, k + 9) : 1.5).toFixed(1) });
    return { id, where, walking, r };
  });
  const habitat = { crewIn: out ? 0 : 4, r: { habP: 101.2, o2pct: 20.9, co2: +(out ? 1.1 : 2.4 + 0.3 * wob(t, 11)).toFixed(1), temp: 21.5, rh: 42 } };
  const aboard = !out ? 0 : work ? 4 - EVA_PAIR.length : 4;
  const rover = {
    mode, aboard, anchors: mode === 'C' ? 'deployed' : 'stowed', drill: work && pos.leg.stop.tasks?.some((x) => /core|drill/i.test(x)) ? 'deployed' : 'stowed',
    km: +km.toFixed(1),
    r: { cabP: +(56.5 + 0.3 * wob(t, 13)).toFixed(1), cabO2: +(34 + 0.4 * wob(t, 15)).toFixed(1), co2: +(1 + aboard * 0.5 + 0.2 * wob(t, 17)).toFixed(1), temp: +(21 + aboard * 0.6).toFixed(1), batt: Math.max(0, Math.round(100 - km * RATES.roverKwhPerKm / ROVER_KWH * 100 - (storm ? 10 : 0))) },
  };
  return { crew, habitat, rover };
}

if (import.meta.env?.DEV) {
  console.assert(level('spo2', 96) === 'ok' && level('spo2', 92) === 'watch' && level('spo2', 85) === 'bad', 'low-side bands');
  console.assert(level('co2', 2) === 'ok' && level('co2', 5) === 'bad', 'high-side bands');
  const tl = { legs: [{ kind: 'drive', t0: 0, t1: 1, km: 8 }, { kind: 'work', t0: 1, t1: 3, stop: { id: 'S1', tasks: ['short core'] } }], totalH: 3 };
  const m = readings(tl, 2, { leg: tl.legs[1], done: false }, 'A', false);
  console.assert(holdModes(['A', 'A', 'A', 'B', 'A', 'B', 'A', 'A', 'A', 'A'].map((mode) => ({ mode }))).map((p) => p.mode).join('') === 'AABBBBAAAA', 'holdModes');
  console.assert(autoMode(5, 'smooth', false).mode === 'A' && autoMode(15, 'smooth', false).mode === 'B' && autoMode(3, 'rocky', false).mode === 'B' && autoMode(3, 'smooth', true).mode === 'C', 'autoMode');
  console.assert(m.crew[1].walking && !m.crew[0].walking && m.crew[1].r.suitO2 === 88 && m.rover.aboard === 2 && m.rover.drill === 'deployed' && m.rover.km === 8, 'monitor at a stop');
}
