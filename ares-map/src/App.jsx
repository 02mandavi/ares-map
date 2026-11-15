import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import MapScene, { Draped, Ring, Label } from './MapScene.jsx';
import { loadSite, makeSurface, distKm } from './geo.js';
import { loadImage, reliefLayer, slopeDeg, slopeLayer, viewshed, radioLayer, coverageLayer, robotLayer, compose, canvas, ctxFilled, colorize } from './layers.js';
import { HAB, CRATER, PLACEHOLDERS, EVA_H, planTimeline, positionAt, alongKm, CRACK_COLORS, fmtClock, download } from './mission.js';
import { LayerPanel, OverviewPanel, PrintSheets } from './Panels.jsx';
import { VitalsPanel, LogPanel } from './Ops.jsx';
import Login from './Login.jsx';
import Chat from './Chat.jsx';
import { person } from './roles.js';
import { DEFAULT_VITALS } from './vitals.js';
import Start from './Start.jsx';
import Boot from './Boot.jsx';
import SolsView from './Sols.jsx';
import { ARES } from './sols.js';
import { RoverViewer, RoverSpecs } from './RoverCad.jsx';
import { readings, autoMode, holdModes, MODE_STEP_KM } from './monitor.js';
import { MissionScene, MissionHud, habScaleFor } from './Mission.jsx';
import { AGENTS, CLASSES, classify, terrainLayer } from './terrain.js';
import { buildPlanner, makeGrid, cellOf } from './planner/plan.js';
import { feasibility } from './planner/feasible.js';
import { rankRoutes, routeStats } from './planner/choose.js';
import { PLANNER } from './planner/config.js';
import { costField, hiriseMask, edgeMask, distanceMap } from './planner/cost.js';
import { shouldReplan, fieldReplan } from './planner/live.js';

const MODES = ['plan', 'mission', 'sols', 'debrief', 'vitals', 'log', 'print']; // Field folded into Mission (team review 2026-11-15)
const MODE_NAMES = { plan: 'Overview', mission: 'Mission', sols: 'Sols', field: 'Field', debrief: 'Rover', vitals: 'Vitals', log: 'Log', print: 'Print' };

// The mission's sites are the sol briefs' sites: one site per day, base → site → base, low risk first.
// Drive time is the brief's (worked at 8 km/h) scaled to the speed setting; the route's shape comes from the planner.
function solStations(site, habXZ, speed, work) {
  return ARES.days().filter((d) => d.kind !== 'buffer').map((d, i) => {
    const id = 'S' + (i + 1), xz = site.toXZ(d.site.lon, d.site.lat), driveH = d.driveMin / 60 * PLANNER.roverRefKmh.value / speed;
    const windowMin = d.phases[d.phases.length - 1].t1 - d.phases[0].t0, reserveMin = d.phases.filter((p) => p.type === 'reserve').reduce((s, p) => s + p.t1 - p.t0, 0);
    return { id, sol: d.n, name: d.terrain.split(/[,;]/)[0].replace(/\.$/, ''), lon: d.site.lon, lat: d.site.lat, xz, distKm: distKm(habXZ, xz), elev: site.elevXZ(xz[0], xz[1]),
      driveH, reserveMin, work: work[id] ?? Math.max(0, windowMin - reserveMin - 2 * driveH * 60), risk: d.risk, riskLevel: d.riskLevel, type: d.risk, status: d.risk,
      goal: d.terrain, question: '', interpretations: [], evidence: [], negative: [], who: [], tasks: (d.experiments ?? []).map((x) => `${x.name} (crew ${x.who})`),
      rec: { action: 'scout', why: `Sol ${d.n}, ${d.risk}: out, work, back to base the same day.` } };
  });
}

// shortcut: state in the query string and localStorage only, no backend; fine for one crew device.
function useStored(key, init) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked for some viewers (signed-out, private mode): keep state in memory */ } }, [key, v]);
  return [v, setV];
}
function useQuery(key, init) {
  const [v, setV] = useState(() => { try { return new URLSearchParams(location.search).get(key) ?? init; } catch { return init; } });
  useEffect(() => { try { const q = new URLSearchParams(location.search); if (v == null || v === init) q.delete(key); else q.set(key, v); history.replaceState(null, '', '?' + q.toString()); } catch { /* sandboxed host frame may refuse URL changes: the state still works, it is just not in the address */ } }, [key, v, init]);
  return [v, setV];
}

export default function App() {
  const [data, setData] = useState(null), [err, setErr] = useState(null), [done, setDone] = useState({});
  useEffect(() => {
    const tick = (k, p) => p.then((v) => { setDone((d) => ({ ...d, [k]: k === 'ctx' ? v.src : true })); return v; }); // each row of the first screen ticks when its own file is in
    Promise.all([tick('site', loadSite()), tick('ctx', loadImage('data/ctx.jpg')), tick('themis_day', loadImage('data/themis_day.jpg')), tick('themis_night', loadImage('data/themis_night.jpg'))])
      .then(([site, ctx, day, night]) => setData({ site, imgs: { ctx, themis_day: day, themis_night: night } }))
      .catch((e) => setErr(e));
  }, []);
  if (err) return (
    <div className="state-screen" role="alert">
      <h1>The site data did not load</h1>
      <p>{String(err.message || err)}. The app reads <code>public/data/</code>; rebuild it with <code>node tools/fetch.mjs</code> then <code>python -I tools/prep.py &lt;download folder&gt;</code>.</p>
      <button className="btn" onClick={() => location.reload()}>Try again</button>
    </div>
  );
  if (!data) return <Boot done={done} ctxSrc={done.ctx} />;
  return <Mission site={data.site} imgs={data.imgs} />;
}

function Mission({ site, imgs }) {
  const [rawMode, setMode] = useQuery('mode', 'start');
  const mode = rawMode === 'start' || MODES.includes(rawMode) ? rawMode : 'mission'; // old links (e.g. ?mode=field) land on Mission
  const start = mode === 'start';
  const [base, setBase] = useQuery('base', 'ctx');
  const [sel, setSel] = useQuery('st', null);
  const [layers, setLayers] = useStored('ares.layers.v2', { hirise: true, coverage: false, cracks: true, stations: true, slope: false, robot: false, radio: false, route: true, terrain: false, paths: false }); // opens on the real images; analysis layers are one click away
  const [ve, setVe] = useState(1.5); // ×3 tripled every 200 m facet; ×1.5 still shows the crater rim
  const [stored, setPlan] = useStored('ares.plan.sols', { speed: 8, workH: 3, route: ['S1'], work: {} });
  const plan = { ...stored, start: '07:30', reserveH: 0.25 }; // fixed by the sol briefs (07:30 start, 15 min reserve); no control edits them, so never read them from storage
  const [limits, setLimits] = useState({ walk: PLACEHOLDERS.slopeWalk, rover: PLACEHOLDERS.slopeRover });
  const [cracks, setCracks] = useStored('ares.cracks', []);
  const [tracing, setTracing] = useState(null);
  const [descentPick, setDescentPick] = useState(null); // crack id waiting for a map tap
  const [layersFull, setLayersFull] = useState(false);
  const [cadK, setCadK] = useState(null); // null = follow the rover's current mode
  const [pov, setPov] = useState(null);
  const [tour, setTour] = useState({ t: 0, running: false, rate: 300 }); // Mission view replay, separate from the Field clock so it leaves no track
  const [view, setView] = useState('chase');
  const [modeOverride, setModeOverride] = useState(null); // rover mode set by a person ({ mode, by }); null = the autonomous pick
  const [notes, setNotes] = useStored('ares.notes', {});
  const [track, setTrack] = useStored('ares.track', null);
  const [sim, setSim] = useState({ t: 0, running: false, rate: 60 });
  const [drawer, setDrawer] = useState(false);
  const [userId, setUserId] = useStored('ares.user', 'c1');
  const user = person(userId);
  const [vitals, setVitals] = useStored('ares.vitals', DEFAULT_VITALS);
  const [decisions, setDecisions] = useStored('ares.decisions', []);
  const [outcomes, setOutcomes] = useStored('ares.outcomes', []);
  const [objectives, setObjectives] = useStored('ares.objectives', {});
  const [auditLog, setAuditLog] = useStored('ares.audit', []);
  const audit = useCallback((what) => setAuditLog((l) => [...l, { at: new Date().toISOString(), who: userId, what }]), [userId, setAuditLog]);
  const rig = useRef(null);
  const fly = useCallback((...args) => { if (rig.current) rig.current.fly(...args); else rig.pending = args; }, []);

  const habXZ = useMemo(() => site.toXZ(HAB.lon, HAB.lat), [site]);
  const stations = useMemo(() => solStations(site, habXZ, plan.speed, plan.work), [site, habXZ, plan.speed, plan.work]);
  const routeStops = useMemo(() => plan.route.map((id) => stations.find((s) => s.id === id)).filter(Boolean), [plan.route, stations]);
  const surface = useMemo(() => makeSurface(site, pov || mode === 'mission' ? 1 : ve, pov ? pov.xz : null), [site, ve, pov, mode]); // crew and mission views at true height

  // --- 2D layer stack
  const derived = useMemo(() => {
    const slopes = slopeDeg(site);
    const vis = viewshed(site, habXZ, PLACEHOLDERS.mastM);
    return { slopes, vis, relief: reliefLayer(site), radio: radioLayer(site, vis), coverage: coverageLayer(site, imgs.ctx), robot: robotLayer(site) };
  }, [site, habXZ, imgs.ctx]);
  const baseMap = useMemo(() => { // display only: CTX, with THEMIS day IR where CTX has no data, in Mars colour (MARS_COLOR)
    const f = ctxFilled(imgs.ctx, imgs.themis_day), img = colorize(f.img);
    return { ...f, img, url: img.toDataURL('image/jpeg', 0.86) };
  }, [imgs.ctx, imgs.themis_day]);
  const cls = useMemo(() => classify(site, imgs, derived.slopes, limits), [site, imgs, derived.slopes, limits]);
  const terrainImg = useMemo(() => terrainLayer(site, cls), [site, cls]);
  // Travel-time planner: time-to-home maps rebuilt only when speed, slope limits or classes change
  const grid = useMemo(() => makeGrid(site, cls, derived.slopes, derived.vis), [site, cls, derived.slopes, derived.vis]);
  const crackXZ = useMemo(() => cracks.filter((c) => c.conf !== 'rejected').map((c) => c.pts.map((p) => site.toXZ(...p))), [cracks, site]);
  // Stage 4 route cost: HiRISE bonus, setback from the trough, rim crest and traced cracks, radio-shadow cost (no relay set). Reported times stay real time.
  const cost = useMemo(() => costField(grid, { hirise: hiriseMask(site), edgeDist: distanceMap(grid, edgeMask(grid, { craterXZ: site.toXZ(CRATER.lon, CRATER.lat), cracks: crackXZ })), vis: derived.vis, relay: false }), [grid, site, crackXZ, derived.vis]);
  const planner = useMemo(() => buildPlanner(grid, CLASSES.map((c) => c.id), limits, plan.speed, habXZ, { cost }), [grid, cost, limits, plan.speed, habXZ]);
  const paths = useMemo(() => Object.fromEntries(Object.keys(AGENTS).map((a) => [a, planner.legs(a, routeStops)])), [planner, routeStops]); // A* per leg, in hours
  // one site per day: drive out and back take the brief's time; the planner gives the path (it bends round slopes and rough ground)
  const dayLegs = useMemo(() => (routeStops.length === 1 ? paths.rover.map((l) => ({ ...l, hours: routeStops[0].driveH })) : paths.rover), [routeStops, paths]);
  const timeline = useMemo(() => planTimeline(habXZ, routeStops, plan.speed, undefined, dayLegs), [habXZ, routeStops, plan.speed, dayLegs]);
  // Stage 4: the same day if the ground is bad. Each drive leg keeps the brief's time, scaled by the planner's bad ÷ hopeful time for that path.
  const ground = useMemo(() => {
    const raw = paths.rover, f = (i, v) => (raw[i] && !raw[i].blocked && raw[i].hours > 0 ? v(raw[i]) : 0);
    const drive = dayLegs.map((l) => (l.blocked ? 0 : l.hours));
    return {
      badH: timeline.totalH + drive.reduce((a, h, i) => a + f(i, (r) => h * (r.hoursBad / r.hours - 1)), 0),
      kwh: raw.reduce((a, r) => a + (r.blocked ? 0 : r.energyKwh), 0),
      shadowH: drive.reduce((a, h, i) => a + f(i, (r) => h * r.shadowH / r.hours), 0),
    };
  }, [paths, dayLegs, timeline]);
  const noCtx = useMemo(() => stations.filter((s) => CLASSES[cls[cellOf(planner.grid, s.xz)]]?.id === 'unknown'), [stations, cls, planner]); // sites outside the CTX strip
  const siteRoutes = useMemo(() => stations.map((s) => planner.leg('rover', habXZ, s.xz)), [stations, planner, habXZ]); // Overview: base to every site
  const totalFor = useCallback((st) => planTimeline(habXZ, st, plan.speed, undefined, planner.legs('rover', st)).totalH, [habXZ, plan.speed, planner]);
  const chooseOpts = useMemo(() => { // inputs for ranking stop sets; rover legs between any two places are cached per planner
    const cache = new Map(), xz = (id) => (id === 'HAB' ? habXZ : stations.find((s) => s.id === id).xz);
    const legOf = (a, b) => { const k = a + '>' + b; if (!cache.has(k)) cache.set(k, planner.leg('rover', xz(a), xz(b))); return cache.get(k); };
    return { legOf, science: PLANNER.science.value, evaH: EVA_H, reserveH: plan.reserveH, inWalkBack: (s) => planner.inWalkBack(s.xz, plan.workH, EVA_H) };
  }, [planner, stations, habXZ, plan.reserveH, plan.workH]);
  const withShadow = useCallback((sts) => sts.map((s) => ({ ...s, shadow: !derived.vis[cellOf(planner.grid, s.xz)] })), [derived.vis, planner]);
  const rankFor = useCallback((sts) => rankRoutes({ ...chooseOpts, stations: withShadow(sts) }), [chooseOpts, withShadow]);
  const statsFor = useCallback((ids) => routeStats({ ...chooseOpts, stations: withShadow(stations) }, ids), [chooseOpts, withShadow, stations]);
  const feas = useMemo(() => feasibility({ legs: dayLegs, totalH: timeline.totalH, evaH: EVA_H, reserveH: plan.reserveH, stops: routeStops, inWalkBack: (s) => planner.inWalkBack(s.xz, plan.workH, EVA_H), backup: plan.backup }), [dayLegs, timeline, plan.reserveH, plan.workH, plan.backup, routeStops, planner]);
  const slopeImg = useMemo(() => slopeLayer(site, derived.slopes, limits.walk, limits.rover), [site, derived.slopes, limits]);
  const dim = useMemo(() => { const c = canvas(2, 2), g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 2, 2); return c; }, []);
  const texCanvas = useMemo(() => canvas(site.meta.tex.w, site.meta.tex.h), [site]);
  const texture = useMemo(() => { const t = new THREE.CanvasTexture(texCanvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }, [texCanvas]);
  const field = mode === 'field';
  const on = useCallback((k) => layers[k] || (field && (k === 'slope' || k === 'robot' || k === 'route')), [layers, field]); // safety layers cannot be hidden in Field
  useEffect(() => {
    const baseImg = base === 'relief' ? { img: derived.relief, smooth: false } : base === 'ctx' || !imgs[base] ? { img: baseMap.img } : { img: imgs[base] };
    const stack = [];
    if (pov || mode === 'mission') { compose(texCanvas, site, baseImg, stack); texture.needsUpdate = true; return; } // crew and mission views show imagery only, so the route reads first
    if (on('coverage') && !field) stack.push({ img: derived.coverage });
    if (on('terrain') && !field) stack.push({ img: dim, opacity: 0.4 }, { img: terrainImg, pixelated: true, opacity: 0.6 }); // dim the photo so the analysis reads first
    if (on('slope')) stack.push({ img: slopeImg, pixelated: true, opacity: 0.85 });
    if (on('radio')) stack.push({ img: derived.radio, pixelated: true });
    if (on('robot')) stack.push({ img: derived.robot });
    compose(texCanvas, site, baseImg, stack); texture.needsUpdate = true;
  }, [base, on, field, derived, dim, terrainImg, slopeImg, imgs, baseMap, site, texCanvas, texture, pov, mode]);

  // --- Field simulation clock (sim.t in hours)
  const pos = useMemo(() => positionAt(timeline, sim.t), [timeline, sim.t]);
  useEffect(() => {
    if (!sim.running) return;
    let last = performance.now(), raf;
    const tick = (now) => {
      if (now - last < 50) { raf = requestAnimationFrame(tick); return; } // 20 updates a second: every frame re-rendered the map and tripped React's update-depth guard
      const dt = (now - last) / 3600000 * sim.rate; last = now;
      setSim((s) => { const t = Math.min(s.t + dt, EVA_H); return { ...s, t, running: t < EVA_H && !positionAt(timeline, t).done }; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [sim.running, sim.rate, timeline]);
  useEffect(() => { // record a breadcrumb every simulated minute
    if (!sim.running) return;
    setTrack((tr) => {
      const pts = tr?.pts ?? [];
      if (pts.length && sim.t - pts[pts.length - 1].t < 1 / 60) return tr;
      const arrivals = { ...(tr?.arrivals ?? {}) };
      if (pos.leg?.kind === 'work' && arrivals[pos.leg.stop.id] == null) arrivals[pos.leg.stop.id] = sim.t;
      return { date: tr?.date ?? new Date().toLocaleDateString('en-CA'), route: plan.route, pts: [...pts, { t: sim.t, xz: pos.xz }], arrivals };
    });
  }, [sim.t, sim.running, pos, plan.route, setTrack]);
  // dead-reckoning error grows with distance driven since the last station fix
  const errKm = useMemo(() => {
    if (pos.leg?.kind !== 'drive') return 0.02;
    return Math.max(0.02, distKm(pos.leg.from, pos.xz) * PLACEHOLDERS.drErrorPct / 100);
  }, [pos]);

  // --- camera
  const flyTo = useCallback((xz, d = 6) => {
    const y = surface.y(xz[0], xz[1]);
    fly([xz[0] + d * 0.35, y + d * 0.8, xz[1] + d * 0.75], [xz[0], y, xz[1]]);
  }, [surface, fly]);
  const overview = useCallback(() => fly([4, 46, 30], [4, 0, -6]), [fly]); // frames the base and all five sol sites (x -7..15 km, z -12..-1 km)
  const topDown = useCallback(() => fly([0, 46, 0.01], [0, 0, 0], 0), [fly]);
  useEffect(() => { if (mode === 'print') return; const t = setTimeout(overview, 50); return () => clearTimeout(t); }, [overview]); // eslint-disable-line react-hooks/exhaustive-deps
  const crewView = useCallback((xz, lookXZ, label) => setPov({ xz, look: lookXZ, label, yaw: 0 }), []);
  useEffect(() => { // place the eye 1.8 m above ground, looking at the target
    if (!pov) return;
    const s = makeSurface(site, 1, pov.xz), eye = [pov.xz[0], s.y(pov.xz[0], pov.xz[1]) + 0.0018, pov.xz[1]];
    const dx = pov.look[0] - pov.xz[0], dz = pov.look[1] - pov.xz[1], a = Math.atan2(dz, dx) + pov.yaw;
    const t = setTimeout(() => fly(eye, [eye[0] + Math.cos(a), eye[1] - 0.004, eye[2] + Math.sin(a)], 0), 30);
    return () => clearTimeout(t);
  }, [pov, site, fly]);
  const mission = mode === 'mission';
  const wasMission = useRef(mission);
  useEffect(() => { // leaving Mission: stop the replay and lift the camera back to the overview
    if (!mission) setTour((s) => ({ ...s, running: false }));
    if (wasMission.current && !mission && !field) setTimeout(overview, 30);
    wasMission.current = mission;
  }, [mission]); // eslint-disable-line react-hooks/exhaustive-deps
  // Stage 5: replan during Mission playback every 5 sim-minutes, or when the rover is more than one cell off the path,
  // on hazards widened by the position error. A turn-back is logged once per drive.
  const [replan, setReplan] = useState(null);
  useEffect(() => {
    if (!mission) return;
    const t = tour.t, p = positionAt(timeline, t), startH = +plan.start.slice(0, 2) + +plan.start.slice(3) / 60;
    if (p.done || t === 0) { setReplan(null); return; }
    if (replan && t >= replan.atH && !shouldReplan(planner.grid, { nowH: t, lastReplanH: replan.atH, roverXZ: p.xz, pathPts: replan.pathPts })) return;
    const l = p.leg, kmSinceStation = l?.kind === 'drive' ? (t - l.t0) / (l.t1 - l.t0 || 1) * l.km : 0;
    const stops = timeline.legs.filter((x) => x.kind === 'work' && x.t1 > t && !(x === l)).map((x) => x.stop);
    const r = fieldReplan(planner.grid, CLASSES.map((c) => c.id), limits, plan.speed, habXZ, { roverXZ: p.xz, stops, nowH: t, evaH: EVA_H, reserveH: plan.reserveH, kmSinceStation, cracks: crackXZ, cost, startH });
    const next = { atH: t, xz: p.xz, errKm: r.errKm, homeBadH: r.homeBadH, extraH: Math.max(0, r.homeBadH - planner.roverHome(p.xz, true)), pathPts: r.legs[0]?.pts ?? [p.xz], event: r.mustGoHome ? r.event : null };
    if (next.event && !replan?.event && tour.running) ARES.logEvent(routeStops[0]?.sol ?? null, 'turn-back', next.event.text, (startH + t) * 60);
    setReplan(next);
  }, [mission, tour.t]); // eslint-disable-line react-hooks/exhaustive-deps
  const freeCam = useCallback(() => setView('free'), []);
  useEffect(() => { if (field) { const t = setTimeout(() => flyTo([habXZ[0] - 4, habXZ[1]], 9), 50); return () => clearTimeout(t); } }, [field]); // eslint-disable-line react-hooks/exhaustive-deps
  const exitPov = () => { setPov(null); setTimeout(overview, 30); };

  const pick = tracing ? (xz) => setTracing((t) => ({ ...t, pts: [...t.pts, site.toLonLat(...xz)] }))
    : descentPick ? (xz) => { setCracks((all) => all.map((c) => (c.id === descentPick ? { ...c, descent: { pt: site.toLonLat(...xz), by: userId, at: new Date().toISOString() } } : c))); audit(`cleared descent spot on crack ${descentPick}`); setDescentPick(null); }
    : null;
  const selStation = stations.find((s) => s.id === sel);
  const accessOf = (xz) => { // slope and radio line of sight at the 200 m cell under a point
    const { w, h } = site.meta.dem, i = Math.min(w - 1, Math.max(0, Math.floor((xz[0] / site.W + 0.5) * w))), j = Math.min(h - 1, Math.max(0, Math.floor((xz[1] / site.H + 0.5) * h)));
    return { slope: derived.slopes[j * w + i], radio: !!derived.vis[j * w + i], terrain: CLASSES[cls[j * w + i]] };
  };
  const checkStop = (s) => { // planning check of a stop against the slope and terrain limits
    const a = accessOf(s.xz), crack = a.terrain.id === 'trough', ok = a.slope <= limits.walk && !['steep', 'unknown', 'trough'].includes(a.terrain.id);
    return { ok, crack, text: `${a.terrain.name.toLowerCase()}, slope ${a.slope.toFixed(0)}° at 200 m, ${crack ? 'cracks: robot only, crew stays at the rim until a descent spot is cleared' : ok ? 'inside the set limits' : 'OUTSIDE the set limits: check before the crew goes in'}` };
  };
  const storm = vitals.rows.some((r) => r.kind === 'balance' && r.dust > 0);
  const autoAt = (xz) => { const a = accessOf(xz); return autoMode(a.slope, a.terrain.id, storm); };
  const legModes = useMemo(() => timeline.legs.map((l) => { // the autonomous pick every 200 m along each drive leg, held so it does not flip
    if (l.kind !== 'drive') return null;
    const n = Math.max(2, Math.ceil(l.km / MODE_STEP_KM) + 1), pts = l.pts ?? [l.from, l.to];
    return holdModes(Array.from({ length: n }, (_, i) => autoAt(alongKm(pts, l.km * i / (n - 1)))));
  }), [timeline, storm, cls, derived]); // eslint-disable-line react-hooks/exhaustive-deps
  const modeAt = (tH) => { // rover mode at plan time tH: the held pick on a drive leg, the ground at a stop, or a person's override
    const p = positionAt(timeline, tH), l = p.leg, m = l && legModes[timeline.legs.indexOf(l)];
    const auto = m ? m[Math.round((tH - l.t0) / (l.t1 - l.t0 || 1) * (m.length - 1))] : autoAt(p.xz);
    return modeOverride ? { ...modeOverride, auto: false, autoPick: auto } : { ...auto, auto: true, autoPick: auto };
  };
  const [session, setSession] = useState(() => { try { return sessionStorage.getItem('ares.session'); } catch { return null; } }); // login screen on every new visit
  const signIn = (id) => { setUserId(id); setSession(id); try { sessionStorage.setItem('ares.session', id); } catch { /* private mode: login lasts this page only */ } setAuditLog((l) => [...l, { at: new Date().toISOString(), who: id, what: 'signed in' }]); setMode('start'); };
  const signOut = () => { audit('signed out'); setSession(null); try { sessionStorage.removeItem('ares.session'); } catch { /* ignore */ } };
  const setRoverMode = (m) => { setModeOverride(m ? { mode: m, by: `${user.name}, ${user.role}` } : null); audit(m ? `set rover mode ${m} (override)` : 'returned rover mode to autonomous'); };
  const roverMode = modeAt(sim.t);
  const monitor = useMemo(() => readings(timeline, sim.t, pos, roverMode.mode, storm), [timeline, sim.t, pos, roverMode.mode, storm]); // eslint-disable-line react-hooks/exhaustive-deps
  const budgetH = EVA_H - plan.reserveH;
  const reach = useMemo(() => planner.farthestKm(planner.reachVal, budgetH - plan.workH), [planner, plan.workH, budgetH]); // farthest straight-line km inside each area
  const walk = useMemo(() => planner.farthestKm(planner.walkVal, EVA_H - plan.workH), [planner, plan.workH]);
  const timeLeftH = budgetH - sim.t;
  const posCell = cellOf(planner.grid, pos.xz);
  const homeLeg = useMemo(() => planner.leg('rover', pos.xz, habXZ), [planner, posCell, habXZ]); // eslint-disable-line react-hooks/exhaustive-deps
  const homeKm = homeLeg.km, turnBackInH = timeLeftH - planner.roverHome(pos.xz);
  const ctx = { site, mode, base, setBase, layers, setLayers, ve, setVe, plan, setPlan, limits, setLimits, stations, sel, setSel, selStation, routeStops, timeline,
    user, vitals, setVitals, decisions, setDecisions, outcomes, setOutcomes, objectives, setObjectives, auditLog, audit, accessOf,
    reach, walk, planner, feas, totalFor, rankFor, statsFor, paths, cracks, setCracks, tracing, setTracing, descentPick, setDescentPick, layersFull, setLayersFull, monitor, storm, roverMode, setRoverMode, flyTo, crewView, habXZ, sim, setSim, pos, errKm, turnBackInH, homeKm, notes, setNotes, track, setTrack, rig, topDown, field, surface, ground, replan };

  return (
    <div className="app" data-mode={mode}>
      <header className="topbar">
        <div className="brand"><button className="wordmark-btn" onClick={() => { setMode('start'); setPov(null); }} aria-label="Back to the start screen">A.R.E.S.<span>FIELD MAP</span></button><span className="muted">Chryse crater site · 28.43° N, 319.77° E</span></div>
        <nav className="modes" aria-label="Mode">
          {MODES.map((m) => <button key={m} className="tab" aria-pressed={mode === m} onClick={() => { setMode(m); setPov(null); }}>{MODE_NAMES[m]}</button>)}
        </nav>
        <span className="user">{user.role}<button className="btn btn-s" onClick={signOut}>Sign out</button></span>
        <div className="clock num" aria-live="off">
          <span className="muted">EVA</span> <span>{fmtClock(plan.start, sim.t)}</span>
          <span className="muted">· {Math.floor(sim.t)}:{String(Math.floor(sim.t * 60 % 60)).padStart(2, '0')} of {EVA_H}:00</span>
        </div>
      </header>

      {mode === 'plan' && (
        <aside className={'panel left' + (drawer ? ' is-open' : '') + (layersFull ? ' is-full' : '')} aria-label="Layers">
          <LayerPanel {...ctx} />
        </aside>
      )}

      <main className="map">
        <MapScene close={mission} habScale={mission ? habScaleFor(view) : undefined} spin={start} site={site} surface={surface} texture={texture} habXZ={habXZ} rig={rig} pov={pov} onPick={pick}
          pins={start ? [] : mission || layers.stations ? stations : []} activePin={sel} onPin={(id) => { setSel(id); const w = mission && timeline.legs.find((l) => l.kind === 'work' && l.stop.id === id); if (w) setTour((s) => ({ ...s, t: w.t0 + 1 / 600 })); else flyTo(stations.find((s) => s.id === id).xz); }}
          hirise={layers.hirise && !field ? site.meta.hirise : []}>
          {mission ? <MissionScene surface={surface} timeline={timeline} t={tour.t} habXZ={habXZ} view={view} roverMode={modeAt(tour.t).mode} onUserMove={freeCam} /> : <>
          {on('route') && siteRoutes.map((l, i) => <Draped key={'r' + i} surface={surface} pts={l.pts} color={l.blocked ? '#e24c40' : AGENTS.rover.color} width={2.5} dashed={l.blocked} step={0.1} />)}
          {on('route') && siteRoutes.map((l, i) => l.blocked && <Label key={'nb' + i} surface={surface} xz={alongKm(l.pts, l.km / 2)}>no route found</Label>)}
          {layers.cracks && !field && cracks.map((c) => <Draped key={c.id} surface={surface} pts={c.pts.map((p) => site.toXZ(...p))} color={CRACK_COLORS[c.conf]} width={c.conf === 'confirmed' ? 3.5 : 2} dashed={c.conf === 'rejected'} step={0.05} />)}
          {layers.cracks && cracks.filter((c) => c.descent).map((c) => <Ring key={'d' + c.id} surface={surface} c={site.toXZ(...c.descent.pt)} r={0.08} color="#5ec27a" width={3} />)}
          {tracing?.pts.length > 0 && <Draped surface={surface} pts={tracing.pts.map((p) => site.toXZ(...p))} color="#af50ff" width={3} step={0.05} />}
          </>}
          {(mode === 'plan' || mission) && <Label surface={surface} xz={habXZ} tone="base">Base · habitat</Label>}
          {mode === 'plan' && noCtx.map((s) => <Label key={'nc' + s.id} surface={surface} xz={[s.xz[0], s.xz[1] + 0.9]}>{s.id}: 100 m image only</Label>)}
        </MapScene>

        {pov ? (
          <div className="pov-bar" role="region" aria-label="Crew view">
            <p><strong>Crew view from {pov.label}</strong> · eye 1.8 m, true vertical scale, Mars curvature on. Horizon for a standing person is about 3.6 km (R = 3,396 km). Built from the 200 m DEM and ~15 m CTX: shapes are real, detail is not.</p>
            <div className="row">
              <button className="btn" onClick={() => setPov((p) => ({ ...p, yaw: p.yaw - Math.PI / 6 }))} aria-label="Look left">Look left</button>
              <button className="btn" onClick={() => setPov((p) => ({ ...p, yaw: p.yaw + Math.PI / 6 }))} aria-label="Look right">Look right</button>
              <button className="btn" onClick={() => download(rig.current.capture(), `ares-crew-view-${pov.label}.png`)}>Save image</button>
              <button className="btn btn-primary" onClick={exitPov}>Back to map</button>
            </div>
          </div>
        ) : mission ? (
          <MissionHud {...{ stations, site, timeline, tour, setTour, view, setView, plan, setPlan, habXZ, planner, feas, totalFor, accessOf, limits, checkStop, modeAt, legModes, user, setRoverMode, objectives, ground, replan }} />
        ) : !start && (
          <div className="map-hud">
            {mode === 'plan' && <button className="btn drawer-toggle" aria-expanded={drawer} onClick={() => setDrawer((d) => !d)}>Layers</button>}
            <button className="btn" onClick={overview}>Overview</button>
            <button className="btn" onClick={() => flyTo(habXZ, 4)}>Habitat</button>
            <span className="hud-note num">Height ×{ve} · ground smoothed for display · symbols not to scale</span>
          </div>
        )}
        {mode === 'sols' && <SolsView site={site} baseUrl={baseMap.url} noCtx={new Set(noCtx.map((s) => s.sol))} routes={Object.fromEntries(stations.map((s, i) => [s.sol, siteRoutes[i].pts]))} />}
        {mode === 'debrief' && <RoverViewer k={cadK ?? 'drill'} setK={setCadK} rover={monitor.rover} />}
        {descentPick && <p className="trace-hint" role="status">Tap the spot on crack {descentPick} where the crew may go down. <button className="btn" onClick={() => setDescentPick(null)}>Cancel</button></p>}
        {tracing && <p className="trace-hint" role="status">Tracing: tap the terrain along the crack. {tracing.pts.length} points.</p>}
      </main>

      <aside className="panel right" aria-label={MODE_NAMES[mode]}>
        {mode === 'plan' && <OverviewPanel {...ctx} siteRoutes={siteRoutes} />}
        {mode === 'debrief' && <RoverSpecs k={cadK ?? 'drill'} />}
        {mode === 'print' && <PrintSheets {...ctx} />}
        {mode === 'vitals' && <VitalsPanel {...ctx} />}
        {mode === 'log' && <LogPanel {...ctx} />}
      </aside>
      {start && <Start go={(m) => setMode(m)} {...{ plan, reach, user, signOut, timeline, feas, monitor, objectives, setObjectives, audit, sim, ground }} route={routeStops} />}
      {!session && <Login onPick={signIn} />}
      <Chat {...ctx} signedIn={!!session} />
    </div>
  );
}

