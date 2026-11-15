// Parts that Sols 5 and 6 share: TLS gas panel, return energy and point of no return, abort.
import { ARES, useSolState, returnPlan, fmtMin, fmtDur } from './sols.js';
import { ROVER_KWH } from './monitor.js';
import { download } from './mission.js';

export const saveFile = (name, text, type) => download(URL.createObjectURL(new Blob([text], { type })), name);

// ---- simulated TLS: flat baseline, a test button adds a decaying methane spike ----
const SPIKE_PPB = 3, DECAY_MIN = 10, FALLBACK_PPB = 0.41;
export const gasBaseline = () => { const b = ARES.getBaseline(1); return b?.methanePpb != null ? { ppb: +b.methanePpb, src: 'Sol 1 baseline' } : { ppb: FALLBACK_PPB, src: 'simulated default; no Sol 1 baseline saved' }; };
export const methaneAt = (events, t) => gasBaseline().ppb + events.reduce((s, at) => s + (t >= at ? SPIKE_PPB * Math.exp(-(t - at) / DECAY_MIN) : 0), 0);
export const methanePeak = (n) => { const ev = ARES.get(n, 'gasEvents', []); return Math.max(gasBaseline().ppb, ...ev.map((at) => methaneAt(ev, at))); };

export function GasPanel({ n, t, label = 'TLS gas' }) {
  const [ev, setEv] = useSolState(n, 'gasEvents', []), [thr, setThr] = useSolState(n, 'gasThreshold', 1);
  const base = gasBaseline(), ppb = methaneAt(ev, t), hit = ppb - base.ppb > thr;
  return (
    <section className={'sol-card' + (hit ? ' is-amber' : '')} aria-labelledby={`gas-h${n}`}>
      <h2 id={`gas-h${n}`} className="sol-h2">{label} <span className="small muted">simulated</span></h2>
      <dl className="sol-dl">
        <div><dt>Methane</dt><dd className="num">{ppb.toFixed(2)} ppb</dd></div>
        <div><dt>Baseline</dt><dd className="num">{base.ppb.toFixed(2)} ppb ({base.src})</dd></div>
        <div><dt>Water vapour</dt><dd className="num">200 ppm (flat, simulated)</dd></div>
        <div><dt>CO₂</dt><dd className="num">95% (flat, simulated)</dd></div>
        <div><dt>Peak today</dt><dd className="num">{methanePeak(n).toFixed(2)} ppb</dd></div>
      </dl>
      <label className="field small">Alert above baseline by (ppb)<input type="number" min="0.1" step="0.1" value={thr} onChange={(e) => setThr(Math.max(0.1, +e.target.value || 0.1))} /></label>
      {hit && <p className="sol-alarm small" role="alert"><strong>Significant detection - re-sample and confirm.</strong> {(ppb - base.ppb).toFixed(2)} ppb above baseline at {fmtMin(t)}.</p>}
      <button className="btn btn-s" onClick={() => { setEv((e) => [...e, t]); ARES.logEvent(n, 'detection', `Test methane detection event (+${SPIKE_PPB} ppb, simulated)`, t); }}>Test a detection event</button>
    </section>
  );
}

// ---- battery and return ----
export function ReturnCard({ day, t, longest }) {
  const [floor, setFloor] = useSolState('mission', 'socFloor', 25), r = returnPlan(day, t), back = day.phases.find((p) => p.type === 'drive_back');
  const kwh = (pct) => (pct * ROVER_KWH / 100).toFixed(1);
  const others = ARES.days().filter((d) => d.driveMin && d.n !== day.n).map((d) => d.driveMin), isLongest = day.driveMin >= Math.max(0, ...others);
  return (
    <section className={'sol-card' + (r.marginPct < 0 ? ' is-amber' : '')} aria-labelledby={`ret-h${day.n}`}>
      <h2 id={`ret-h${day.n}`} className="sol-h2">Battery and return</h2>
      {longest && <p className={'small' + (isLongest ? ' sol-banner' : '')}>{day.driveMin} min drive each way{isLongest ? ': the longest drive of the mission' : ''}.</p>}
      <dl className="sol-dl">
        <div><dt>Leave site by</dt><dd className="num">{back.from} ({t < back.t0 ? `${fmtDur(back.t0 - t)} left` : 'passed'})</dd></div>
        <div><dt>Remaining now</dt><dd className="num">{r.soc.toFixed(0)}% · {kwh(r.soc)} kWh</dd></div>
        <div><dt>Needed to return ×{r.factor}</dt><dd className="num">{r.needPct.toFixed(1)}% · {kwh(r.needPct)} kWh</dd></div>
        <div><dt>Margin over floor</dt><dd className="num">{r.marginPct.toFixed(1)}%</dd></div>
        <div><dt>Point of no return</dt><dd className="num">{r.pnrKm <= day.pathKm ? `${r.pnrKm.toFixed(1)} km out, before the site` : `beyond the site (${r.pnrKm.toFixed(0)} km out); today's route never reaches it`}</dd></div>
      </dl>
      <label className="field small">Battery floor (%)<input type="number" min="0" max="90" value={floor} onChange={(e) => setFloor(Math.min(90, Math.max(0, +e.target.value || 0)))} /></label>
      <p className="small muted">Return energy comes from the plan's own battery model; kWh use the {ROVER_KWH} kWh placeholder pack. The floor is an assumption: verify against the flight rules.</p>
    </section>
  );
}

export function PnrMarker({ fs, bx, by, sx, sy, day }) {
  const r = returnPlan(day, 0), f = Math.min(1, r.pnrKm / day.pathKm), px = bx + (sx - bx) * f, py = by + (sy - by) * f;
  return <>
    <rect x={px - fs * 0.35} y={py - fs * 0.35} width={fs * 0.7} height={fs * 0.7} transform={`rotate(45 ${px} ${py})`} className="sol-pnr" />
    <text x={px - fs * 0.8} y={py + fs * 1.6} fontSize={fs * 0.7} textAnchor="end" className="sol-label">{f < 1 ? `point of no return, ${r.pnrKm.toFixed(1)} km` : `point of no return: beyond site (${r.pnrKm.toFixed(0)} km)`}</text>
  </>;
}

// ---- abort ----
export function AbortCard({ n, t, label, reason, children }) {
  const [a, setA] = useSolState(n, 'aborted', null), day = ARES.getDay(n);
  return (
    <section className={'sol-card' + (a ? ' sol-alarm' : '')} aria-labelledby={`ab-h${n}`}>
      <h2 id={`ab-h${n}`} className="sol-h2">Abort</h2>
      {a ? <>
        <p role="alert"><strong>ABORTED at {fmtMin(a.at)}: {a.reason}.</strong> Leave site now; back at base about {fmtMin(a.at + day.driveMin)}.</p>
        {children}
        <button className="btn btn-s" onClick={() => { setA(null); ARES.logEvent(n, 'abort', `Abort cancelled (${a.reason})`, t); }}>Cancel the abort</button>
      </> : <button className="btn btn-s sol-abort" onClick={() => { setA({ at: t, reason }); ARES.logEvent(n, 'abort', `Abort: ${reason}`, t); }}>{label}</button>}
    </section>
  );
}
