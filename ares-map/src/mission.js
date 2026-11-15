// Mission facts and planning maths. Every number that is a team placeholder says so in `note`.
import { distKm } from './geo.js';

export const EVA_H = 7; // hours outside per day (team decision, Part 6)
export const HAB = { id: 'H', name: 'Habitat', lon: 319.77, lat: 28.43 };
export const CRATER = { lon: 319.54, lat: 28.425, rKm: 7.65 }; // centre and radius measured on the HRSC-MOLA DEM
export const TROUGH_ZONE = { rIn: 9, rOut: 11, fromDeg: -40, toDeg: 40 }; // km from crater centre; bearings around due east

export const PLACEHOLDERS = {
  speeds: [5, 8, 15], // km/h rover average over rough ground (team question M1)
  walkKmh: 2.5, // suited walking speed, 2–3 km/h (verify, M3)
  tortuosity: 1.3, // route length ÷ straight line (placeholder)
  drErrorPct: 2, // dead-reckoning error as % of distance driven (placeholder, verify)
  mastM: 10, // habitat antenna height (placeholder)
  slopeWalk: 15, slopeRover: 20, // degrees (team question L3)
};

// Points of interest. Text comes from ARES_planning_questions.md Parts 7-9 (CTX/HiRISE reading 2026-11-14); nothing here is a measurement on the ground.
export const STATIONS = [
  { id: 'S1', who: ['c2', 'c1', 'auto', 'c3'], tasks: ['Edge survey: width, length and wall photos', 'Ground-penetrating radar across the trough from the rover', 'Robot descent with camera and spectrometer', 'Leave a seismometer near the trough (runs all stay)'], name: 'Concentric troughs', lon: 319.735, lat: 28.43, work: 60, status: 'candidate', type: 'trough / possible fracture',
    goal: 'Crack candidates 1–3 km west of the habitat, concentric to the crater. Measure width and length and image the walls from the edge. The inside of a trough is robot-only.',
    interpretations: ['Concentric fractures or graben from the impact', 'Troughs between ejecta ridges, not fractures'],
    question: 'Is this an open fracture that reaches below the ejecta? An exposed wall with layering, or a fracture fill, would answer it.',
    evidence: ['CTX P15_006980_2087, ~5.7 m: long curved troughs parallel to the rim, tens of metres wide'],
    negative: ['No HiRISE over the east rim: nothing seen below ~6 m', 'No elevation model below 200 m: depth and wall slope unknown'],
    rec: { action: 'scout', why: 'Closest crack target and inside every reach ring. Scout from the edge first; the robot goes in only after the edge setback is set.' } },
  { id: 'S2', who: ['c3', 'c4', 'c2'], tasks: ['Panorama and layer sketch into the crater', 'Radio relay check toward the floor', 'Portable weather and dust reading'], name: 'East rim crest', lon: 319.6927, lat: 28.43, work: 45, status: 'no HiRISE', type: 'crater rim',
    goal: 'Look into the crater from the rim. Rim layers show how the target rocks were stacked. Footing unknown: no HiRISE covers the east rim.',
    interpretations: ['Uplifted, overturned target rock at the rim'],
    question: 'What layers make up the rim, and in what order?',
    evidence: ['CTX: sharp rim crest, ~7.4 km from the crater centre', 'The old habitat point fell here; moved off because rims are steep and blocky'],
    negative: ['No HiRISE: blocks and slope at walking scale unknown'],
    rec: { action: 'scout', why: 'Viewpoint into the crater and a radio relay spot for the floor. Stay back from the crest until slopes are known.' } },
  { id: 'S3', who: ['c2', 'c3', 'c3', 'c2'], tasks: ['Describe and sample wall layers from the terrace', 'Handheld XRF and Raman on each layer', 'Short core where layering is clear', 'Keep out of the gullies (possible Special Region, verify)'], name: 'Inner wall and terraces', lon: 319.655, lat: 28.43, work: 60, status: 'HiRISE', type: 'crater wall',
    goal: 'Wall layers exposed by the impact, inside HiRISE ESP_022869_2085. Slope class unknown below 200 m.',
    interpretations: ['Slumped terrace blocks', 'Intact layered wall'],
    question: 'The best natural cross-section of the layers: what are they, and do any record water?',
    evidence: ['HiRISE ESP_022869_2085 at 1 m: slumped terraces and gullies, stacked layers in the wall'],
    negative: ['No open fractures visible at 1 m', 'Gullied inner walls may be a Special Region (verify)'],
    rec: { action: 'map', why: 'Best layer exposure with 0.5 m imagery. Image from the terrace; do not enter the gullies.' } },
  { id: 'S4', who: ['auto', 'c3', 'c2'], tasks: ['Robot drill, 2 m class', 'Cache samples with context photos and position', 'Heat-flow probe (proposed)'], name: 'Central peak', lon: 319.54, lat: 28.425, work: 90, status: 'HiRISE', type: 'central peak',
    goal: 'Rock lifted from depth by the impact: the deepest material reachable without drilling. Robot drill site (2 m class drill, as on Rosalind Franklin).',
    interpretations: ['Uplifted deep bedrock', 'Mixed breccia and sand'],
    question: 'What is the deepest rock here, and does it hold altered minerals or organics worth drilling?',
    evidence: ['HiRISE at 1 m: knobby rock, rippled sand patches, a terrace scarp', 'Peak ~1–2 km wide'],
    negative: ['No open cracks visible at 1 m', 'Route down the wall not found: needs a DTM', 'Likely in radio shadow behind the rim'],
    rec: { action: 'defer', why: 'Highest science value but ~12 km away (edge of reach at 8 km/h), down a wall with no known route. Defer until a stereo DTM finds one.' } },
  { id: 'S5', who: ['c3', 'c2'], tasks: ['Field geology of the ejecta texture', 'Photograph wind grooves for dust studies'], name: 'Lobate ejecta grooves', lon: 319.846, lat: 28.497, work: 45, status: 'rejected as cracks', type: 'ejecta',
    goal: 'Grooves on the ejecta read as wind-eroded at full resolution, not fractures. Kept as a rock-formation stop.',
    interpretations: ['Wind-carved grooves (current reading)', 'Fractures (rejected)'],
    question: 'How was the ejecta laid down and later eroded?',
    evidence: ['HiRISE ESP_050666_2090, 2017: pitted, knobby texture with long lineations'],
    negative: ['Lineations read as wind grooves, not fractures'],
    rec: { action: 'defer', why: 'Not a crack target. Visit only if a day has spare time.' } },
];

// Who does what. who[i] owns tasks[i]; walkers are EVA lead and scientist, the commander and medic stay in the cab (placeholder ops rule).
export const DUTIES = {
  c1: 'Drive the rover and make the turn-back call',
  c2: 'Lead each walk and keep everyone back from crack edges',
  c3: 'Log and seal every sample with a photo and its position',
  c4: 'Suit and health checks before and after each walk; radio link to the habitat',
  mc: 'Watch weather and the turn-back clock. Advice arrives minutes late; decisions stay with the crew',
  auto: 'Run the crack robot; a person approves each descent',
};
export const tasksFor = (id, stops) => stops.flatMap((s) => (s.tasks ?? []).filter((_, i) => s.who?.[i] === id).map((task) => ({ stop: s, task })));
if (import.meta.env?.DEV) {
  console.assert(STATIONS.every((s) => s.who.length === s.tasks.length), 'every task has one owner');
  console.assert(tasksFor('c3', STATIONS).length === 6 && tasksFor('c4', STATIONS).length === 1 && tasksFor('mc', STATIONS).length === 0, 'tasks split by owner');
}

// Provenance for every layer (brief: cite every claim).
export const SOURCES = {
  ctx: { title: 'CTX image', product: 'MRO CTX P15_006980_2087 (EDR); east strip (S1, S2, S5) from J15_050666_2087 (2017-05-18, same orbit as HiRISE ESP_050666)', res: '~5.7 m/px, shown ~15 m/px', date: '2008-01-28 (verify)', crs: 'placed by footprint corners, shifted −0.4 km E, −2.0 km N to match THEMIS (corr 0.47)', credit: 'NASA/JPL/MSSS', url: 'https://ode.rsl.wustl.edu/mars/', note: 'J15_050666_2087 placed by its ODE footprint, then shifted 0.8 km W, 1.0 km S to match the first CTX where they overlap (corr 0.82), brightness matched (tools/ctx-add.mjs). The few pixels neither image covers show THEMIS day IR at 100 m, display only. Colour: the grey image is tinted with the average colour of the USGS Viking MDIM 2.1 colourised global mosaic (R 1.18, G 0.92, B 0.90 of grey, tools/viking.mjs), strength doubled so it reads on screen. Brightness and detail come from the camera unchanged; display only.' },
  hirise: { title: 'HiRISE strips', product: 'ESP_022869_2085 (2011-06-13), ESP_050666_2090 (2017-05-18), RED RDR', res: '0.5 m/px source, 2 m/px in detail view', date: 'see product', crs: 'equirectangular, PDS label bounds', credit: 'NASA/JPL/University of Arizona', url: 'https://hirise.lpl.arizona.edu/', note: 'RED is a single grey band.'+' Colour: the grey image is tinted with the average colour of the USGS Viking MDIM 2.1 colourised global mosaic (R 1.18, G 0.92, B 0.90 of grey, tools/viking.mjs), strength doubled so it reads on screen. Brightness and detail come from the camera unchanged; display only.' },
  themis_day: { title: 'THEMIS day IR', product: 'THEMIS controlled mosaic MC-11 Oxia Palus, day IR', res: '100 m/px', date: 'mosaic', crs: 'equirectangular, clon 0', credit: 'NASA/JPL/ASU, USGS', url: 'https://stac.astrogeology.usgs.gov/' },
  themis_night: { title: 'THEMIS night IR', product: 'THEMIS controlled mosaic MC-11 Oxia Palus, night IR', res: '100 m/px', date: 'mosaic', crs: 'equirectangular, clon 0', credit: 'NASA/JPL/ASU, USGS', url: 'https://stac.astrogeology.usgs.gov/', note: 'Bright at night = holds heat = rock or coarse ground. Dark = dust or fine sand.' },
  relief: { title: 'Shaded relief', product: 'HRSC-MOLA blended DEM v2', res: '200 m/px', date: 'global mosaic', crs: 'geographic, Mars 2000 sphere', credit: 'ESA/DLR/FU Berlin, NASA MOLA, USGS', url: 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m' },
  slope: { title: 'Slope classes', product: 'computed from the 200 m DEM', res: '200 m cells', crs: '', credit: 'derived', note: 'A 200 m cell averages away boulders, steps and crack walls. Clear here does not mean walkable: it means not steep at 200 m.' },
  coverage: { title: 'Coverage', product: 'hatch = no image better than ~6 m; cross = no CTX either', res: '', credit: 'derived', note: 'Unknown ground is never drawn as safe.' },
  terrain: { title: 'Terrain classes', product: 'rules over slope (200 m DEM), THEMIS night IR and CTX texture; no trained model', res: '200 m cells', credit: 'derived, estimated', note: 'Ranked against this site only: darkest 20% at night = loose, brightest 20% = rocky, roughest 15% of CTX texture = rough. Not checked against the ground. Slope limits are placeholders. Crew paths may cross the approximate trough band at 6× cost; cross only on a line the robot has scouted.' },
  robot: { title: 'Robot-only zone', product: 'trough band 9–11 km from the crater centre, east side', res: 'approximate', credit: 'team reading of CTX, 2026-11-14; not traced', note: 'Inside a crack could be a COSPAR Special Region (verify). Crew stays at the edge; only the cleaned depth rover goes in, except at a spot the crew has cleared after the robot examined it.' },
  radio: { title: 'Radio shadow', product: `line of sight from a habitat mast over the 200 m DEM, with curvature`, res: '200 m cells', credit: 'derived', note: 'Shaded cells cannot see the habitat antenna directly. Needs a relay (rover on the rim).' },
  radiation: { title: 'Surface radiation', product: 'MSL RAD, Gale crater: 0.21 ± 0.04 mGy/day absorbed, 0.64 ± 0.12 mSv/day dose equivalent', res: 'one site, 2012–2013', credit: 'Hassler et al. 2014, Science 343, 1244797 (verify)', note: 'Measured at Gale, not here. Chryse is about 0.7 km lower, so the dose here is likely similar or slightly lower (verify).' },
};

// One-way reach (km, straight line): drive out, work, drive back, keep reserve.
export const reachKm = (speed, workH, reserveH) => Math.max(0, speed * (EVA_H - workH - reserveH) / 2);
// Walk-back reach: drive out, work, rover fails, walk home, reserve used as margin.
export const walkBackKm = (speed, workH, walk = PLACEHOLDERS.walkKmh) => Math.max(0, (EVA_H - workH) / (1 / speed + 1 / walk));

// Plan timeline: legs in hours from EVA start. pts are xz km. Returns legs and totals.
// paths (optional): one { pts, km, hours } per drive leg from the travel-time planner; without it, straight line × tortuosity.
// A blocked leg (no route found) adds no time or km: it is left out of the totals and the plan is refused (planner/feasible.js).
export function planTimeline(habXZ, stops, speed, tort = PLACEHOLDERS.tortuosity, paths = null) {
  const legs = []; let t = 0, at = habXZ, km = 0;
  for (const [n, s] of [...stops, null].entries()) {
    const to = s ? s.xz : habXZ, p = paths?.[n], d = p?.blocked ? 0 : p ? p.km : distKm(at, to) * tort, dt = p?.blocked ? 0 : Number.isFinite(p?.hours) ? p.hours : d / speed;
    legs.push({ kind: 'drive', from: at, to, t0: t, t1: t + dt, km: d, stop: s, pts: p?.pts, blocked: !!p?.blocked }); t += dt; km += d;
    if (s) { legs.push({ kind: 'work', at: to, t0: t, t1: t + s.work / 60, stop: s }); t += s.work / 60; }
    at = to;
  }
  return { legs, totalH: t, km };
}

export function alongKm(pts, d) { // point d km along a polyline
  for (let i = 1; i < pts.length; i++) {
    const s = distKm(pts[i - 1], pts[i]);
    if (d <= s) { const f = s ? d / s : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; }
    d -= s;
  }
  return pts[pts.length - 1];
}

export function positionAt(timeline, tH) {
  for (const l of timeline.legs) {
    if (tH > l.t1) continue;
    if (l.kind === 'work') return { xz: l.at, leg: l };
    const k = Math.max(0, (tH - l.t0) / (l.t1 - l.t0 || 1));
    if (l.pts) return { xz: alongKm(l.pts, k * l.km), leg: l };
    return { xz: [l.from[0] + (l.to[0] - l.from[0]) * k, l.from[1] + (l.to[1] - l.from[1]) * k], leg: l };
  }
  const last = timeline.legs[timeline.legs.length - 1];
  return { xz: last ? last.to : [0, 0], leg: null, done: true };
}

export const fmtH = (h) => { const s = h < 0 ? '−' : ''; h = Math.abs(h); const m = Math.round(h * 60); return `${s}${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

export const CRACK_COLORS = { confirmed: '#f7f9fa', possible: '#e8a838', proposed: '#5ab4ff', rejected: '#828384' };
export const bearing = (from, to) => (Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180 / Math.PI + 360) % 360; // degrees from north, x east, z south

export function fmtClock(start, tH) {
  const [h, m] = start.split(':').map(Number), mins = Math.round(h * 60 + m + tH * 60);
  return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
export function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }

if (import.meta.env?.DEV) {
  console.assert(reachKm(8, 3, 1) === 12, 'reach 8 km/h = 12 km (Part 7 table)');
  console.assert(Math.abs(walkBackKm(8, 3) - 7.62) < 0.01, 'walk-back 7.6 km');
  const tl = planTimeline([0, 0], [{ xz: [4, 0], work: 60 }], 8, 1);
  console.assert(Math.abs(tl.totalH - 2) < 1e-9 && positionAt(tl, 0.25).xz[0] === 2, 'timeline');
}

if (import.meta.env?.DEV) {
  console.assert(Math.round(bearing([0, 0], [1, 0])) === 90 && Math.round(bearing([0, 0], [0, -1])) === 0, 'bearing east and north');
}

// --- Mission view guidance
// Douglas–Peucker: the A* path steps cell to cell (200 m), so simplify before reading turns from it.
export function simplify(pts, tol = 0.15) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]], L = distKm(a, b) || 1e-9;
  let far = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L;
    if (d > far) { far = d; at = i; }
  }
  if (far <= tol) return [a, b];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}
// Turns along a leg: km from the leg start, signed change in degrees (+ = right), the new bearing.
export function turnsOf(pts, minDeg = 30) {
  const s = simplify(pts), out = []; let km = 0;
  for (let i = 1; i < s.length - 1; i++) {
    km += distKm(s[i - 1], s[i]);
    const b0 = bearing(s[i - 1], s[i]), b1 = bearing(s[i], s[i + 1]), d = ((b1 - b0 + 540) % 360) - 180;
    if (Math.abs(d) >= minDeg) out.push({ km, deg: d, to: b1, xz: s[i] });
  }
  return out;
}
// Heading (radians, scene yaw for a model facing +x) the rover is pointing at time tH; at a stop, the heading it arrived on.
export function headingAt(timeline, tH) {
  const p = positionAt(timeline, tH), l = p.leg;
  const t1 = l?.kind === 'drive' ? Math.min(l.t1, tH + 0.03) : l ? l.t0 : timeline.totalH; // ~0.5 km chord at 8 km/h smooths the 200 m A* steps
  const a = positionAt(timeline, Math.max(0, t1 - 0.06)).xz, b = positionAt(timeline, t1).xz;
  return Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
}
export const compass = (deg) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];

if (import.meta.env?.DEV) {
  const L = [[0, 0], [0.5, 0.01], [1, 0], [1, 1]]; // east 1 km, then south: a right turn onto 180°
  console.assert(simplify(L).length === 3, 'simplify drops the wiggle');
  const t = turnsOf(L); console.assert(t.length === 1 && Math.round(t[0].deg) === 90 && Math.round(t[0].to) === 180 && Math.abs(t[0].km - 1) < 0.01, 'right turn found');
}

// Smallest fix for a plan past the reserve line: the one stop whose removal fits, keeping the most time spare. null = no single drop fits.
// totalFor(stops) = planned hours for that stop list (the app passes the travel-time planner's timeline).
export function bestDrop(stops, totalFor, budgetH) {
  let best = null;
  for (const s of stops) {
    const spare = budgetH - totalFor(stops.filter((x) => x !== s));
    if (spare >= 0 && (!best || spare > best.spare)) best = { id: s.id, spare };
  }
  return best;
}
if (import.meta.env?.DEV) {
  const a = { id: 'a', xz: [1, 0], work: 60 }, b = { id: 'b', xz: [10, 0], work: 60 };
  const tot = (st) => planTimeline([0, 0], st, 10, 1).totalH;
  console.assert(bestDrop([a, b], tot, 1.5)?.id === 'b' && bestDrop([a, b], tot, 0.5) === null, 'bestDrop');
}
