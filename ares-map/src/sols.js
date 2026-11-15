// Sol foundation: a registry of mission days, the LMST clock, a simple telemetry model and per-sol saved state.
// Each sol file calls ARES.registerDay(n, config); nothing here knows about a particular sol.
import { useEffect, useState } from 'react';
import { HAB } from './mission.js';

const R_KM = 3396.19, K_LAT = R_KM * Math.PI / 180; // km per degree of latitude on Mars
const days = new Map(), listeners = new Set();
const emit = () => listeners.forEach((f) => f());

// ---- LMST clock: minutes after local midnight ----
export const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const fmtMin = (min) => { const m = Math.round(min); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const fmtDur = (min) => { const m = Math.max(0, Math.round(min)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

// "07:30-08:42 | drive_out | - | tasks" lines, kept verbatim from the sol brief so no word is lost.
export function parsePhases(text) {
  return text.trim().split('\n').map((l) => {
    const [span, type, pair, ...tasks] = l.split('|').map((x) => x.trim());
    const [from, to] = span.split('-');
    return { from, to, t0: toMin(from), t1: toMin(to), type, pair: pair === '-' ? null : pair, tasks: tasks.join(' | ') };
  });
}

// ---- geometry: flat local projection around the habitat, good to a few metres over 10-15 km ----
export function offset(lat, lon, km, bearingDeg) { // point km away from lat/lon on a compass bearing
  const b = bearingDeg * Math.PI / 180;
  return { lat: lat + km * Math.cos(b) / K_LAT, lon: lon + km * Math.sin(b) / (K_LAT * Math.cos(lat * Math.PI / 180)) };
}
export function distBearing(a, b) {
  const dy = (b.lat - a.lat) * K_LAT, dx = (b.lon - a.lon) * K_LAT * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return { km: Math.hypot(dx, dy), deg: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360 };
}
export const compass16 = (deg) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(deg / 22.5) % 16];

// ---- where the rover is, from the phase table ----
export function phaseAt(day, t) { return day.phases.find((p) => t >= p.t0 && t < p.t1) ?? null; }
export function roverAt(day, t) { // alongKm on the path from base (0) to the site (day.pathKm)
  const out = day.phases.find((p) => p.type === 'drive_out'), back = day.phases.find((p) => p.type === 'drive_back');
  if (!out) return { where: 'At base, no rover travel', alongKm: 0, moving: false }; // buffer day
  if (t < out.t0) return { where: 'At base, before the drive', alongKm: 0, moving: false };
  if (t < out.t1) return { where: 'Driving out', alongKm: day.pathKm * (t - out.t0) / (out.t1 - out.t0), moving: true, dir: 1 };
  if (t < back.t0) return { where: 'At the site', alongKm: day.pathKm, moving: false };
  if (t < back.t1) return { where: 'Driving back', alongKm: day.pathKm * (1 - (t - back.t0) / (back.t1 - back.t0)), moving: true, dir: -1 };
  return { where: 'Back at base', alongKm: 0, moving: false };
}

// Battery forecast: start 100 %, reach the expected end SOC at docking. Drives draw 3x the parked rate (verify against the real power budget).
export function socAt(day, t) {
  if (day.socModel) return day.socModel(t); // e.g. a charging day
  if (!day.phases.some((p) => p.type === 'drive_back')) return day.startSoc ?? 100; // no drive and no model: hold
  const dock = day.phases.find((p) => p.type === 'drive_back').t1, w = (p) => (p.type.startsWith('drive') ? 3 : 1);
  const active = day.phases.filter((p) => p.t1 <= dock || p.t0 < dock), total = active.reduce((s, p) => s + w(p) * (Math.min(p.t1, dock) - p.t0), 0);
  let used = 0;
  for (const p of active) { if (t <= p.t0) break; used += w(p) * (Math.min(t, p.t1, dock) - p.t0); }
  return 100 - (100 - day.endSoc) * Math.min(1, used / total) + (day.socAdjust?.(t) ?? 0); // socAdjust: extra loads such as a drill
}

// ---- the registry ----
export const ARES = {
  registerDay(n, config) {
    const phases = parsePhases(config.phases), site = config.kind === 'buffer' ? { lat: HAB.lat, lon: HAB.lon } : { lat: config.site.lat, lon: config.site.lon };
    const day = { n, ...config, phases, site, base: { lat: HAB.lat, lon: HAB.lon }, window: [phases[0].from, phases[phases.length - 1].to] };
    const check = distBearing(day.base, site); // the brief's distance and bearing should match its coordinates
    day.check = { km: check.km, deg: check.deg, ok: config.kind === 'buffer' || Math.abs(check.km - config.straightKm) < 0.5 && Math.abs(((check.deg - config.bearing + 540) % 360) - 180) < 3 };
    days.set(n, day); emit(); return day;
  },
  getDay: (n) => days.get(+n),
  days: () => [...days.values()].sort((a, b) => a.n - b.n),
  // Saved per-sol values (baselines, checklists, readings). Browser storage only: one crew device.
  get(n, key, init) { try { const s = localStorage.getItem(`ares.sol.${n}.${key}`); return s ? JSON.parse(s) : init; } catch { return init; } },
  set(n, key, v) { try { localStorage.setItem(`ares.sol.${n}.${key}`, JSON.stringify(v)); } catch { /* storage blocked: value lasts this page only */ } mem.set(`${n}.${key}`, v); emit(); },
  getBaseline: (n = 1) => ARES.get(n, 'baseline', null),
  saveBaseline: (n, data) => ARES.set(n, 'baseline', { ...data, savedAt: new Date().toISOString() }),
  diffFromBaseline: (key, value, n = 1) => { const b = ARES.getBaseline(n)?.[key]; return b == null || value == null || value === '' ? null : +value - +b; },
  // Warnings a sol adds to a later sol's buffer plan, e.g. a failed Sol 1 check lands on Sol 4.
  bufferWarnings: (target) => ARES.get(target, 'bufferWarnings', {}),
  // Mission-wide event log (incidents, aborts, detections), read by the Sol 7 dashboard.
  events: () => ARES.get('mission', 'events', []),
  logEvent: (sol, kind, text, t) => ARES.set('mission', 'events', [...ARES.events(), { sol, kind, text, lmst: t == null ? null : fmtMin(t), at: new Date().toISOString() }]),
  setBufferWarning(target, id, text) { const w = { ...ARES.bufferWarnings(target) }; if (text) w[id] = text; else delete w[id]; ARES.set(target, 'bufferWarnings', w); },
};
const mem = new Map();
if (typeof window !== 'undefined') window.ARES = ARES; // the name the sol briefs use

export function useSols() { // re-render when a day registers or saved state changes
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((x) => x + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  return ARES;
}
export function useSolState(n, key, init) {
  useSols();
  const v = mem.has(`${n}.${key}`) ? mem.get(`${n}.${key}`) : ARES.get(n, key, init);
  return [v, (next) => ARES.set(n, key, typeof next === 'function' ? next(ARES.get(n, key, init)) : next)];
}

if (import.meta.env?.DEV) { // self-check of the clock and geometry
  const p = offset(28.43, 319.77, 8, 20), d = distBearing({ lat: 28.43, lon: 319.77 }, p);
  console.assert(Math.abs(d.km - 8) < 0.01 && Math.abs(d.deg - 20) < 0.1 && fmtMin(toMin('07:30') + 72) === '08:42' && compass16(20) === 'NNE' && compass16(80) === 'E', 'sols geometry/clock');
}

// Return energy, in SOC points, from the plan's own battery model. Point of no return: the distance out where
// the charge left would just cover the drive home times the margin and still keep the floor.
export function returnPlan(day, t, factor = 1.2) {
  const out = day.phases.find((p) => p.type === 'drive_out'), back = day.phases.find((p) => p.type === 'drive_back');
  const floor = ARES.get('mission', 'socFloor', 25);
  const outPerKm = (100 - socAt(day, out.t1)) / day.pathKm, backPerKm = (socAt(day, back.t0) - socAt(day, back.t1)) / day.pathKm;
  const rover = roverAt(day, t), soc = socAt(day, t), needPct = rover.alongKm * backPerKm * factor;
  return { soc, needPct, marginPct: soc - needPct - floor, floor, factor, backPerKm, pnrKm: (100 - floor) / (outPerKm + backPerKm * factor), rover };
}
