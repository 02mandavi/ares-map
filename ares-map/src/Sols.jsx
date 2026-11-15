// Sols view: one mission day per site. Picker, LMST clock, telemetry, phase timeline, experiments and a 2D route map.
// Day-specific parts come from each sol's own file through ARES.registerDay(n, { Features, MapExtras, ... }).
import { useEffect, useState } from 'react';
import { ARES, useSols, useSolState, phaseAt, roverAt, socAt, fmtMin, fmtDur, toMin, compass16 } from './sols.js';
import './sol1.jsx';
import './sol2.jsx';
import './sol3.jsx';
import './sol4.jsx';
import './sol5.jsx';
import './sol6.jsx';
import './sol7.jsx';

const TYPE = { drive_out: 'Drive out', setup: 'Setup', science: 'Science EVA', break: 'Break', closeout: 'Close-out', drive_back: 'Drive back', reserve: 'Reserve', admin: 'Admin', lab: 'Lab' };

// routes: { [sol n]: route polyline in map km } from the planner, so the map shows the bent path, not a straight line.
export default function SolsView({ site, routes = {} }) {
  const [big, setBig] = useState(false); // the map sits small beside the day's data; tap to enlarge
  useSols();
  const days = ARES.days();
  const [n, setN] = useState(() => { try { return +(localStorage.getItem('ares.sol.current') ?? days[0]?.n ?? 1); } catch { return days[0]?.n ?? 1; } });
  const raw = ARES.getDay(n) ?? days[0], day = raw.resolve?.() ?? raw; // resolve: a sol that borrows another's plan (Sol 7 Plan B)
  const [t, setT] = useState(() => toMin(day.window[0])), [running, setRunning] = useState(false), [rate, setRate] = useState(5); // LMST minutes per second
  const end = toMin(day.window[1]);
  useEffect(() => { // the clock
    if (!running) return;
    const id = setInterval(() => setT((x) => { const v = Math.min(end, x + rate / 4); if (v >= end) setRunning(false); return v; }), 250);
    return () => clearInterval(id);
  }, [running, rate, end]);
  const pick = (k) => { setN(k); try { localStorage.setItem('ares.sol.current', k); } catch { /* fine */ } setRunning(false); setT(toMin(ARES.getDay(k).window[0])); };
  const ctx = { day, t, setT, running, setRunning, rover: roverAt(day, t), soc: socAt(day, t), phase: phaseAt(day, t) };
  const buffer = Object.entries(ARES.bufferWarnings(4));

  return (
    <div className="sols">
      <SolMap site={site} {...ctx} route={routes[day.n]} big={big} setBig={setBig} />
      <div className="sols-side">
        <nav className="seg" aria-label="Sol">
          {days.map((d) => <button key={d.n} className="tab" aria-pressed={d.n === day.n} onClick={() => pick(d.n)}>Sol {d.n}</button>)}
        </nav>
        {buffer.length > 0 && <div className="warn small" role="status"><strong>Sol 4 buffer plan</strong>{ARES.getDay(4) ? '' : ' (Sol 4 not built yet)'} carries {buffer.length} warning{buffer.length > 1 ? 's' : ''}: {buffer.map(([, v]) => v).join(' ')}</div>}
        <Header day={day} />
        <Clock {...ctx} rate={rate} setRate={setRate} />
        <Telemetry {...ctx} />
        {day.Features && <day.Features {...ctx} />}
        <Timeline {...ctx} />
        <Experiments day={day} />
        {(day.n === 5 || day.n === 6) && <PriorityTargets />}
      </div>
    </div>
  );
}

function Header({ day }) {
  const back = day.phases.find((p) => p.type === 'drive_back');
  const rows = day.kind === 'buffer' ? [
    ['Location', `base, ${day.base.lat.toFixed(3)}°N, ${day.base.lon.toFixed(3)}°E`],
    ['Rover travel', 'none'],
    ['Window', `${day.window[0]}-${day.window[1]} LMST, ${day.phases.filter((p) => p.type === 'break').length} breaks`],
    ['Purpose', day.purpose],
  ] : [
    ['Coordinates', `${day.site.lat.toFixed(3)}°N, ${day.site.lon.toFixed(3)}°E`],
    ['Distance', `straight ${day.straightKm} km, path ${day.pathKm.toFixed(1)} km`],
    ['Bearing', `${String(day.bearing).padStart(3, '0')}° (${compass16(day.bearing)})`],
    ['One-way drive', `${day.driveMin} min`],
    ['Terrain', day.terrain],
    ['Window', `${day.window[0]}-${day.window[1]} LMST`],
    ['Leave site by', back.from], ['Back at base', back.to],
    ['Net work', `${day.netWorkMin} min, science ${day.scienceMin} min`],
    ['Expected end SOC', `about ${day.endSoc}%`],
  ];
  return (
    <section className="sol-card" aria-labelledby="sol-h">
      <h2 id="sol-h" className="sol-h">Sol {day.n} · {day.siteName} <span className={'sol-risk is-' + day.riskLevel}>{day.risk}</span>{day.badges?.map((b) => <span key={b} className="sol-badge">{b}</span>)}</h2>
      <dl className="sol-dl">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
      {!day.check.ok && <p className="warn small">The coordinates put the site {day.check.km.toFixed(1)} km at {day.check.deg.toFixed(0)}° from the habitat, not {day.straightKm} km at {day.bearing}° as the brief says. Check the brief.</p>}
    </section>
  );
}

function Clock({ day, t, setT, running, setRunning, rate, setRate, phase, rover }) {
  const s = toMin(day.window[0]), e = toMin(day.window[1]), back = day.phases.find((p) => p.type === 'drive_back');
  const left = (to) => (t < to ? `in ${fmtDur(to - t)}` : 'passed');
  return (
    <section className="sol-card sol-clock" aria-label="LMST clock">
      <p className="sol-time num">{fmtMin(t)} <span className="small muted">LMST</span></p>
      <p className="small">{phase ? `${TYPE[phase.type]}${phase.pair ? `, EVA pair ${phase.pair}` : ''}, until ${phase.to}` : t >= e ? 'Sol complete' : 'Before the window'} · {rover.where}</p>
      {back && <p className="small num">Leave site by {back.from} ({left(back.t0)}) · Back at base {back.to} ({left(back.t1)})</p>}
      <input type="range" min={s} max={e} step="1" value={t} onChange={(ev) => setT(+ev.target.value)} aria-label="LMST time" aria-valuetext={fmtMin(t)} />
      <div className="row">
        <button className="btn btn-primary" onClick={() => { if (t >= e) setT(s); setRunning((r) => !r); }}>{running ? 'Pause' : t >= e ? 'Run the sol again' : t > s ? 'Resume' : 'Run the sol'}</button>
        <select value={rate} onChange={(ev) => setRate(+ev.target.value)} aria-label="Clock speed">
          <option value="1">1 min/s</option><option value="5">5 min/s</option><option value="15">15 min/s</option>
        </select>
      </div>
    </section>
  );
}

function Telemetry({ day, t, rover, soc, phase }) {
  const drive = phase?.type?.startsWith('drive') ? phase : null;
  const speed = drive && day.pathKm ? day.pathKm / ((drive.t1 - drive.t0) / 60) : 0;
  const slip = day.slipAt?.(rover, t);
  const alerts = day.alertsAt?.(rover, t) ?? [];
  const slipHi = day.highlight?.includes('slip');
  return (
    <section className="sol-card" aria-labelledby="tm-h">
      <h2 id="tm-h" className="sol-h2">Telemetry <span className="small muted">simulated from the plan</span></h2>
      <dl className="sol-dl sol-tm">
        <div><dt>Battery (SOC)</dt><dd className="num">{soc.toFixed(0)}%</dd></div>
        {day.kind !== 'buffer' && <><div><dt>Along path from base</dt><dd className="num">{rover.alongKm.toFixed(1)} of {day.pathKm} km</dd></div>
        <div><dt>Speed</dt><dd className="num">{speed.toFixed(1)} km/h</dd></div></>}
        {slip != null && <div className={slipHi ? 'is-hi' + (slip > 15 ? ' is-amber' : '') : ''}><dt>Wheel slip</dt><dd className="num">{slip.toFixed(0)}%{slip > 15 ? ' · above 15%' : ''}</dd></div>}
      </dl>
      {alerts.map((a) => <p key={a} className="warn small" role="alert">{a}</p>)}
    </section>
  );
}

function Timeline({ day, t, setT }) {
  return (
    <section className="sol-card" aria-labelledby="tl-h">
      <h2 id="tl-h" className="sol-h2">Phases</h2>
      <ol className="sol-phases">
        {day.phases.map((p) => {
          const first = day.firstTime?.[p.from];
          return (
            <li key={p.from} className={'sol-phase is-' + p.type + (t >= p.t0 && t < p.t1 ? ' is-now' : '') + (t >= p.t1 ? ' is-past' : '') + (first ? ' is-first' : '')}>
              <button className="sol-phase-time num" onClick={() => setT(p.t0)} aria-label={`Jump to ${p.from}`}>{p.from}-{p.to}</button>
              <div>
                <p className="sol-phase-type">{TYPE[p.type] ?? p.type}{p.pair ? ` · EVA pair ${p.pair}` : ''}</p>
                <p className="small">{p.tasks}</p>
                {first && <p className="sol-first small">First time: {first.join('; ')}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Experiments({ day }) {
  const [done, setDone] = useSolState(day.n, 'experiments', {});
  if (!day.experiments?.length) return null;
  const n = day.experiments.filter((x) => done[x.name]).length;
  return (
    <section className="sol-card" aria-labelledby="ex-h">
      <h2 id="ex-h" className="sol-h2">Experiments checklist <span className="small muted">{n} of {day.experiments.length} done</span></h2>
      <ul className="sol-checks">
        {day.experiments.map((x) => (
          <li key={x.name}><label><input type="checkbox" checked={!!done[x.name]} onChange={(e) => setDone((d) => ({ ...d, [x.name]: e.target.checked }))} /> {x.name} <span className="muted">({x.who})</span></label></li>
        ))}
      </ul>
    </section>
  );
}

// ---- map module: CTX image in km around the habitat, route, rover, and anything the sol adds ----
function SolMap({ site, day, t, rover, route, big, setBig }) {
  const { w, e, n, s } = site.meta.bounds, kLat = 3396.19 * Math.PI / 180, kLon = kLat * Math.cos(((n + s) / 2) * Math.PI / 180);
  const P = (lat, lon) => [(lon - w) * kLon, (n - lat) * kLat], W = (e - w) * kLon, H = (n - s) * kLat;
  const [bx, by] = P(day.base.lat, day.base.lon), [sx, sy] = P(day.site.lat, day.site.lon);
  const buffer = day.kind === 'buffer', pad = buffer ? day.mapPadKm ?? 1.2 : 2.2, x0 = Math.min(bx, sx) - pad, y0 = Math.min(by, sy) - pad, vw = Math.abs(sx - bx) + 2 * pad, vh = Math.abs(sy - by) + 2 * pad;
  const path = !buffer && route ? route.map(([x, z]) => { const [lon, lat] = site.toLonLat(x, z); return P(lat, lon); }) : null; // planner path, in this map's km
  const f = buffer ? 0 : rover.alongKm / day.pathKm;
  const [rx, ry] = path ? along(path, f) : [bx + (sx - bx) * f, by + (sy - by) * f];
  const off = !buffer && (sx < 0 || sx > W || sy < 0 || sy > H), edgeF = off ? Math.min(...[(W - bx) / (sx - bx), (0 - bx) / (sx - bx), (H - by) / (sy - by), (0 - by) / (sy - by)].filter((v) => v > 0 && v < 1)) : 1;
  const ex = bx + (sx - bx) * edgeF, ey = by + (sy - by) * edgeF, beyondKm = day.straightKm * (1 - edgeF);
  const fs = Math.max(vw, vh) / (buffer ? 30 : 42), mx = (bx + sx) / 2, my = (by + sy) / 2;
  const tools = { P, fs, bx, by, sx, sy, day, t, rover };
  return (
    <figure className={'sol-map' + (big ? ' is-big' : '')} aria-label={`Map: base to ${day.siteName}`}>
      <button className="btn btn-s sol-map-toggle" aria-expanded={big} onClick={() => setBig((b) => !b)}>{big ? 'Close map' : 'Enlarge map'}</button>
      <svg onClick={() => setBig((b) => !b)} viewBox={`${x0} ${y0} ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={buffer ? 'Base area' : `Route ${day.straightKm} km at ${day.bearing} degrees from base to ${day.siteName}`}>
        <defs>
          <marker id="sol-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className="sol-arrowhead" /></marker>
          <pattern id="sol-hatch" width={fs * 0.6} height={fs * 0.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2={fs * 0.6} className="sol-hatch-line" /></pattern>
        </defs>
        <image href="data/ctx.jpg" x="0" y="0" width={W} height={H} preserveAspectRatio="none" />
        <rect x="0" y="0" width={W} height={H} className="sol-edge" />
        {off && <text x={ex + fs * 0.4} y={ey - fs * 1.2} fontSize={fs * 0.8} className="sol-label">imagery ends</text>}
        {path && <polyline points={path.map((q) => q.join(',')).join(' ')} className="sol-route" fill="none" />}
        {!buffer && !path && <line x1={bx} y1={by} x2={ex} y2={ey} className="sol-route" />}
        {off && !path && <line x1={ex} y1={ey} x2={sx} y2={sy} className="sol-route is-beyond" markerEnd="url(#sol-arrow)" />}
        {day.MapExtras && <day.MapExtras {...tools} />}
        <circle cx={bx} cy={by} r={fs * 0.45} className="sol-base" /><text x={bx + fs * 0.7} y={by + fs * 0.3} fontSize={fs} className="sol-label">Base</text>
        {!buffer && <><circle cx={sx} cy={sy} r={fs * 0.45} className="sol-site" />
        <text x={sx > bx ? sx - fs * 0.7 : sx + fs * 0.7} y={sy - fs * 0.8} textAnchor={sx > bx ? 'end' : 'start'} fontSize={fs} className="sol-label">{day.siteName}{off ? ` · about ${beyondKm.toFixed(1)} km beyond imagery` : ''}</text></>}
        {!buffer && <text x={mx + fs * 0.6} y={my} fontSize={fs * 0.9} className="sol-label sol-dir">{day.dirLabel ?? `${String(day.bearing).padStart(3, '0')}° ${compass16(day.bearing)}`} · {day.straightKm} km straight, {day.pathKm.toFixed(1)} km path</text>}
        <circle cx={rx} cy={ry} r={fs * 0.35} className={'sol-rover' + (rover.moving ? ' is-moving' : '')}><title>Rover: {rover.where}</title></circle>
      </svg>
      <figcaption className="small muted">{buffer ? `CTX image, north up. Base area only, ${pad} km around the habitat. No rover travel.` : <>CTX image, north up. {path ? 'Route from the travel-time planner: it bends round slopes and rough ground.' : 'Route drawn as a straight line.'} The brief's path is {day.pathKm.toFixed(1)} km. Rover position is the plan replayed, not live tracking.</>}</figcaption>
    </figure>
  );
}

function along(pts, f) { // point a fraction f of the way along a polyline
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])), total = seg.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const k = seg[i] ? d / seg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; } d -= seg[i]; }
  return pts[pts.length - 1];
}

// Carried from Sol 4's target selector to the Sol 5 and Sol 6 pages.
function PriorityTargets() {
  const saved = ARES.get(4, 'targetsSaved', null);
  return (
    <section className="sol-card" aria-labelledby="pt-h">
      <h2 id="pt-h" className="sol-h2">Priority targets <span className="small muted">chosen on Sol 4</span></h2>
      {saved?.list?.length ? <ol className="small">{saved.list.map((x) => <li key={x.id}>{x.name}{x.site ? ` (Site ${x.site})` : ''}</li>)}</ol> : <p className="small muted">No targets saved on Sol 4 yet.</p>}
    </section>
  );
}
