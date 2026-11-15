// Sol 6: Site 5, large fracture/pit, highest risk and highest science value. Only this sol's data and features live here.
import { useState } from 'react';
import { ARES, useSolState, toMin, fmtMin, fmtDur, socAt } from './sols.js';
import { GasPanel, ReturnCard, PnrMarker, AbortCard, methanePeak } from './solkit.jsx';

const SEAL_BY = '11:55', STATUS = ['planned', 'collected', 'sealed', 'stowed'], DRONE_PHASES = ['09:46', '11:41'];

function Features({ day, t }) {
  return <>
    <Countdown day={day} t={t} />
    <RimSafety t={t} />
    <DroneFeed day={day} t={t} />
    <Queue t={t} />
    <GasPanel n={6} t={t} label="Tethered gas probe (TLS)" />
    <ReturnCard day={day} t={t} longest />
    <AbortCard n={6} t={t} label="Abort the sol" reason="day aborted">
      <p className="small"><strong>Sol 7 contingency:</strong> switch Sol 7 to Plan B and repeat Site 5.</p>
    </AbortCard>
    <Summary day={day} t={t} />
  </>;
}

// 3. Final-science countdown to the leave-site deadline; red below 20 min.
function Countdown({ day, t }) {
  const back = day.phases.find((p) => p.type === 'drive_back'), arrive = day.phases.find((p) => p.type === 'drive_out').t1;
  const left = back.t0 - t, red = left < 20, frac = Math.max(0, Math.min(1, left / (back.t0 - arrive)));
  return (
    <section className="sol-card" aria-labelledby="cd-h">
      <h2 id="cd-h" className="sol-h2">Leave-site countdown</h2>
      <p className="sol-big num">{left > 0 ? fmtDur(left) : 'leave now'} <span className="small muted">to {back.from}</span></p>
      <div className={'sol-strip' + (red ? ' is-red' : '')} style={{ transform: `scaleX(${red ? 1 : frac})`, transformOrigin: 'left' }} role="img" aria-label={red ? 'Under 20 minutes left' : `${Math.round(left)} minutes left`} />
    </section>
  );
}

// 4. Strict rim safety: tethers per crew member; wall-sample retrieval blocked until A and B are tethered.
function RimSafety({ t }) {
  const [tt, setTt] = useSolState(6, 'tethers', {}), [ret, setRet] = useSolState(6, 'retrievalStart', null), ok = tt.A && tt.B;
  return (
    <section className={'sol-card' + (ok ? '' : ' is-amber')} aria-labelledby="rs-h">
      <h2 id="rs-h" className="sol-h2">Rim safety <span className="small muted">anchor lines at least 2 m back from the rim</span></h2>
      <ul className="sol-checks sol-cols">
        {['A', 'B', 'C', 'D'].map((m) => <li key={m}><label><input type="checkbox" checked={!!tt[m]} onChange={(e) => setTt((x) => ({ ...x, [m]: e.target.checked }))} /> {m} tether connected</label></li>)}
      </ul>
      {ret != null ? <p className="small num">Wall-sample retrieval started {fmtMin(ret)}. <button className="btn btn-s" onClick={() => setRet(null)}>Reset</button></p>
        : <button className="btn btn-primary btn-s" disabled={!ok} onClick={() => { setRet(t); ARES.logEvent(6, 'eva', 'Wall-sample retrieval started, A and B tethered', t); }}>Start wall-sample retrieval</button>}
      {!ok && <p className="small">Blocked until both A and B tethers are connected. Never closer than 2 m to the rim.</p>}
    </section>
  );
}

// 2. Drone interior view: simulated feed, depth, light, temperature, flag a wall-sample target.
const droneAt = (day, t, maxM) => { // descend over 60% of each drone slot, hover, climb out in the last 15%
  for (const from of DRONE_PHASES) {
    const p = day.phases.find((x) => x.from === from); if (t < p.t0 || t >= p.t1) continue;
    const f = (t - p.t0) / (p.t1 - p.t0), top = from === '11:41' ? maxM * 0.6 : maxM; // final sweep stays shallower
    return f < 0.6 ? top * f / 0.6 : f < 0.85 ? top : top * (1 - f) / 0.15;
  }
  return null;
};
const droneMinutes = (day, t) => DRONE_PHASES.reduce((s, from) => { const p = day.phases.find((x) => x.from === from); return s + Math.max(0, Math.min(t, p.t1) - p.t0); }, 0);
function DroneFeed({ day, t }) {
  const [maxM, setMaxM] = useSolState(6, 'droneMaxM', 40), [, setQ] = useSolState(6, 'queue', null), [flagged, setFlagged] = useState(null);
  const depth = droneAt(day, t, maxM), light = depth == null ? null : 100 * Math.exp(-depth / 12), temp = depth == null ? null : -45 + depth * 0.4;
  const flag = () => {
    const lmst = fmtMin(t), name = `Wall-sample target at ${depth.toFixed(0)} m (drone-flagged ${lmst})`;
    setQ((q) => [...(q ?? seedQueue()), { id: `f${Date.now()}`, name, high: true, status: 'planned' }]); setFlagged(name);
    ARES.logEvent(6, 'target', name, t);
  };
  return (
    <section className="sol-card" aria-labelledby="df-h">
      <h2 id="df-h" className="sol-h2">Drone interior view</h2>
      <div className="sol-feed" role="img" aria-label="Simulated drone feed placeholder">SIMULATED DRONE FEED</div>
      <dl className="sol-dl">
        <div><dt>Depth</dt><dd className="num">{depth == null ? 'drone not flying' : `${depth.toFixed(1)} m of ${maxM} m`}</dd></div>
        <div><dt>Light level</dt><dd className="num">{light == null ? '—' : `${light.toFixed(0)}% of surface`}</dd></div>
        <div><dt>Temperature</dt><dd className="num">{temp == null ? '—' : `${temp.toFixed(0)} °C`}</dd></div>
        <div><dt>Drone minutes today</dt><dd className="num">{Math.round(droneMinutes(day, t))}</dd></div>
      </dl>
      <label className="field small">Deepest planned imaging (m, assumed)<input type="number" min="5" max="200" value={maxM} onChange={(e) => setMaxM(Math.max(5, +e.target.value || 5))} /></label>
      <button className="btn btn-s" disabled={depth == null} onClick={flag}>Target flagged</button>
      {flagged && <p className="small" role="status">Added to the sample queue: {flagged}</p>}
      <p className="small muted">Flying during {DRONE_PHASES.join(' and ')} slots. Depth, light and temperature are simulated.</p>
    </section>
  );
}

// 1. Sample priority queue: drag to reorder (or Up/Down), status, warning if a high-priority item is unsealed at 11:55.
const seedQueue = () => (ARES.get(4, 'targetsSaved', null)?.list ?? []).filter((x) => x.site === '5' || !x.site).map((x, i) => ({ id: `s${x.id}`, name: x.name, high: i < 3, status: 'planned' }));
function Queue({ t }) {
  const [q0, setQ] = useSolState(6, 'queue', null), q = q0 ?? seedQueue(), [drag, setDrag] = useState(null), [name, setName] = useState('');
  const save = (f) => setQ(() => f(q));
  const move = (i, j) => save((l) => { if (j < 0 || j >= l.length) return l; const x = [...l]; const [it] = x.splice(i, 1); x.splice(j, 0, it); return x; });
  const late = t >= toMin(SEAL_BY), unsealed = q.filter((x) => x.high && (x.status === 'planned' || x.status === 'collected'));
  return (
    <section className={'sol-card' + (late && unsealed.length ? ' sol-alarm' : '')} aria-labelledby="sq-h">
      <h2 id="sq-h" className="sol-h2">Sample priority queue <span className="small muted">best first; drag or use Up/Down</span></h2>
      {late && unsealed.length > 0 && <p role="alert" className="small"><strong>{unsealed.length} high-priority sample{unsealed.length > 1 ? 's' : ''} not sealed by {SEAL_BY}:</strong> {unsealed.map((x) => x.name).join('; ')}.</p>}
      {!late && unsealed.length > 0 && <p className="small muted">{unsealed.length} high-priority item(s) to seal by {SEAL_BY} ({fmtDur(toMin(SEAL_BY) - t)} left).</p>}
      <ol className="sol-queue">
        {q.map((x, i) => (
          <li key={x.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag != null) move(drag, i); setDrag(null); }} className={late && x.high && (x.status === 'planned' || x.status === 'collected') ? 'is-late' : ''}>
            <span><strong>{i + 1}.</strong> {x.name}</span>
            <label className="small"><input type="checkbox" checked={x.high} onChange={(e) => save((l) => l.map((y) => (y.id === x.id ? { ...y, high: e.target.checked } : y)))} /> high</label>
            <select value={x.status} aria-label={`Status of ${x.name}`} onChange={(e) => save((l) => l.map((y) => (y.id === x.id ? { ...y, status: e.target.value } : y)))}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
            <button className="btn btn-s" aria-label={`Move ${x.name} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>Up</button>
            <button className="btn btn-s" aria-label={`Move ${x.name} down`} disabled={i === q.length - 1} onClick={() => move(i, i + 1)}>Down</button>
            <button className="btn btn-s" aria-label={`Remove ${x.name}`} onClick={() => save((l) => l.filter((y) => y.id !== x.id))}>×</button>
          </li>
        ))}
      </ol>
      {!q.length && <p className="small muted">Empty. Save Sol 4's target ranking, flag drone targets, or add samples here.</p>}
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; save((l) => [...l, { id: `m${Date.now()}`, name: name.trim(), high: false, status: 'planned' }]); setName(''); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a sample" aria-label="New sample name" />
        <button className="btn btn-s">Add</button>
      </form>
    </section>
  );
}

// 6. Day-close summary.
function Summary({ day, t }) {
  const q = ARES.get(6, 'queue', null) ?? seedQueue(), back = day.phases.find((p) => p.type === 'drive_back'), close = day.phases.find((p) => p.type === 'closeout');
  const done = t >= close.t1;
  return (
    <section className="sol-card" aria-labelledby="sm-h">
      <h2 id="sm-h" className="sol-h2">Day summary <span className="small muted">{done ? `closed ${close.to}` : `fills in until close at ${close.to}`}</span></h2>
      <dl className="sol-dl">
        <div><dt>Samples collected</dt><dd className="num">{q.filter((x) => x.status !== 'planned').length} of {q.length} in the queue</dd></div>
        <div><dt>Drone minutes</dt><dd className="num">{Math.round(droneMinutes(day, t))}</dd></div>
        <div><dt>Methane peak</dt><dd className="num">{methanePeak(6).toFixed(2)} ppb (simulated)</dd></div>
        <div><dt>SOC at return</dt><dd className="num">{socAt(day, back.t1).toFixed(0)}% at {back.to} (modelled)</dd></div>
      </dl>
    </section>
  );
}

// 4 and 5. Map: rim with the 2 m setback ring (symbols, not to scale) and the point of no return.
function MapExtras(p) {
  const { fs, sx, sy } = p;
  return <>
    <circle cx={sx} cy={sy} r={0.35} className="sol-rim" />
    <circle cx={sx} cy={sy} r={0.5} className="sol-rim is-setback" />
    <text x={sx} y={sy + 0.5 + fs * 1.1} fontSize={fs * 0.75} textAnchor="middle" className="sol-label">rim and 2 m setback ring (not to scale)</text>
    <PnrMarker {...p} />
  </>;
}

ARES.registerDay(6, {
  siteName: 'Site 5', risk: 'highest risk', riskLevel: 'high', badges: ['Mission highlight', 'Highest science value'],
  site: { lat: 28.582, lon: 319.976 }, straightKm: 14, pathKm: 16.8, bearing: 50, driveMin: 126,
  terrain: 'Large fracture/pit in blocky, ejecta-influenced ground; hardest rock, deepest exposure, hazardous rim.',
  netWorkMin: 123, scienceMin: 103, endSoc: 63,
  phases: `
07:30-09:36 | drive_out | - | C drives; D nav/comms/health; A+B final review of priority targets and the sample priority list. Convoy with a second rover and tow gear.
09:36-09:46 | setup | - | A+C anchor lines at least 2 m back from the rim and set markers; B+D unpack drones, extension pole and gas probe.
09:46-10:31 | science | C+D | D nanodrone interior imaging of the fracture (deepest imaging); C tether and anchor safety. Inside: A+B pick wall-sample targets from live drone imagery.
10:31-10:46 | break | - | Break 1.
10:46-11:26 | science | A+B | A wall-sample retrieval with extension pole or sampling drone at chosen targets (never closer than 2 m to the rim); B tethered gas probe profiling and sterile handling. Inside: C stages drill; D vitals and comms.
11:26-11:41 | break | - | Break 2.
11:41-11:59 | science | C+D | C shallow drill hole only if time and rim are safe; D final drone sweep or retrieval. Inside: A+B priority triage and sealing of samples.
11:59-12:09 | closeout | - | Seal samples, tool count, rim check, final photos.
12:09-14:15 | drive_back | - | A drives, C co-driver; B stow best samples first; D comms/health.
14:15-14:30 | reserve | - | Dock, recharge, debrief.`,
  experiments: [
    { name: 'Nanodrone interior imaging', who: 'D' },
    { name: 'Wall-sample retrieval', who: 'A' },
    { name: 'Tethered gas profiling', who: 'B' },
    { name: 'Shallow drill hole last', who: 'C' },
    { name: 'Sample triage and sealing', who: 'A/B' },
  ],
  Features, MapExtras,
});
