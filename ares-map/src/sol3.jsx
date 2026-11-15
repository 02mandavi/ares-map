// Sol 3: Site 3, knobby rocky terrain, first drilling day. Only this sol's data and features live here.
import { useState } from 'react';
import { ARES, useSolState, fmtMin, fmtDur } from './sols.js';
import { ROVER_KWH } from './monitor.js';
import { download } from './mission.js';

const DRILL_KW = 1.8, MAX_M = 2, SLOW_KM = 2, PLAN_KMH = 8, BLOCK_CM = 10;
const DRILL0 = { rate: 3.5, stopped: false, stoppedAt: null, pausedMin: 0 }; // rate in cm/min, simulated
const drillPhase = (day) => day.phases.find((p) => p.from === '09:38'); // "C drills a 1-2 m core"

// Minutes the bit has been turning by LMST t. shortcut: one stop/resume history, scrubbing the clock backwards past a stop is not undone; fine for a replay.
function drillMin(day, d, t) {
  const p = drillPhase(day), end = Math.min(t, p.t1, d.stopped && d.stoppedAt != null ? d.stoppedAt : Infinity);
  return Math.max(0, Math.min(end - p.t0 - d.pausedMin, (MAX_M * 100) / d.rate));
}
const drillState = (day, t) => {
  const d = ARES.get(3, 'drill', DRILL0), p = drillPhase(day), min = drillMin(day, d, t), depth = Math.min(MAX_M, (min * d.rate) / 100);
  const active = t >= p.t0 && t < p.t1 && !d.stopped && depth < MAX_M;
  return { d, min, depth, active, kw: active ? DRILL_KW : 0, bitC: active ? 20 + depth * 15 : null, torque: active ? 40 + depth * 35 : 0 };
};

function Features({ day, t, rover }) {
  return <>
    <Drill day={day} t={t} />
    <CoreLog day={day} t={t} />
    <Contamination />
    <Traction day={day} rover={rover} />
    <Abort day={day} t={t} rover={rover} />
  </>;
}

// 1. Drill panel. Drill power feeds the battery model through socAdjust below.
function Drill({ day, t }) {
  const [, setD] = useSolState(3, 'drill', DRILL0), s = drillState(day, t), p = drillPhase(day);
  const toggle = () => setD((d) => (d.stopped ? { ...d, stopped: false, pausedMin: d.pausedMin + Math.max(0, Math.min(t, p.t1) - Math.max(d.stoppedAt, p.t0)), stoppedAt: null } : { ...d, stopped: true, stoppedAt: Math.max(t, p.t0) }));
  return (
    <section className="sol-card" aria-labelledby="dl-h">
      <h2 id="dl-h" className="sol-h2">Drill <span className="small muted">simulated · {p.from}-{p.to}, C drills</span></h2>
      <div className="sol-progress" role="progressbar" aria-label="Drill depth" aria-valuemin="0" aria-valuemax={MAX_M} aria-valuenow={s.depth.toFixed(2)}><span style={{ transform: `scaleX(${s.depth / MAX_M})` }} /></div>
      <p className="small num">Depth {s.depth.toFixed(2)} of {MAX_M} m · {s.active ? 'drilling' : s.d.stopped ? 'stopped' : s.depth >= MAX_M ? 'reached 2 m' : t < p.t0 ? 'not started' : 'drill slot ended'}</p>
      <dl className="sol-dl">
        <div><dt>Rate (simulated)</dt><dd className="num"><input type="number" min="0.5" max="10" step="0.5" value={s.d.rate} aria-label="Drill rate, cm per minute" onChange={(e) => setD((d) => ({ ...d, rate: Math.max(0.5, +e.target.value || 0.5) }))} /> cm/min</dd></div>
        <div><dt>Bit temperature</dt><dd className="num">{s.bitC == null ? '—' : `${s.bitC.toFixed(0)} °C`}</dd></div>
        <div><dt>Torque</dt><dd className="num">{s.torque.toFixed(0)} N·m</dd></div>
        <div><dt>Drill power</dt><dd className="num">{s.kw} kW · {(DRILL_KW * s.min / 60).toFixed(2)} kWh so far</dd></div>
      </dl>
      <label className="sol-switch"><input type="checkbox" role="switch" checked={s.d.stopped} onChange={toggle} /> Stop drilling</label>
      <p className="small muted">Battery: +{DRILL_KW} kW while the drill turns, drawn from a {ROVER_KWH} kWh pack (placeholder capacity, verify). The plan's {day.endSoc}% end is treated as excluding the drill.</p>
    </section>
  );
}

// 2. Core log: one block per 10 cm, each taggable, exported as JSON.
const ROCK = ['', 'basalt', 'sandstone', 'siltstone/mudstone', 'breccia', 'conglomerate', 'regolith', 'ice-cemented sediment', 'other'];
const GRAIN = ['', 'clay', 'silt', 'fine sand', 'medium sand', 'coarse sand', 'gravel', 'crystalline'];
function CoreLog({ day, t }) {
  const [log, setLog] = useSolState(3, 'coreLog', {}), [sel, setSel] = useState(0), depthCm = drillState(day, t).depth * 100;
  const n = (MAX_M * 100) / BLOCK_CM, b = log[sel] ?? {};
  const put = (k, v) => setLog((l) => ({ ...l, [sel]: { ...l[sel], [k]: v } }));
  const exportJson = () => {
    const blocks = Array.from({ length: n }, (_, i) => ({ fromCm: i * BLOCK_CM, toCm: (i + 1) * BLOCK_CM, ...log[i] })).filter((x) => x.rock || x.colour || x.grain || x.organics);
    download(URL.createObjectURL(new Blob([JSON.stringify({ sol: 3, site: 'Site 3', drilledM: +(depthCm / 100).toFixed(2), blocks }, null, 2)], { type: 'application/json' })), 'sol3-core-log.json');
  };
  return (
    <section className="sol-card" aria-labelledby="cl-h">
      <h2 id="cl-h" className="sol-h2">Core log <span className="small muted">one block per {BLOCK_CM} cm</span></h2>
      <div className="sol-core">
        <ol className="sol-column" aria-label="Core column, top to bottom">
          {Array.from({ length: n }, (_, i) => {
            const x = log[i] ?? {}, drilled = (i + 1) * BLOCK_CM <= depthCm + 0.01;
            return <li key={i}><button className={'sol-block' + (sel === i ? ' is-sel' : '') + (drilled ? '' : ' is-undrilled') + (x.organics ? ' is-org' : '')} aria-pressed={sel === i} onClick={() => setSel(i)}>
              <span className="num">{i * BLOCK_CM}-{(i + 1) * BLOCK_CM} cm</span> <span>{x.rock || (drilled ? 'untagged' : 'not drilled')}</span>
            </button></li>;
          })}
        </ol>
        <div className="stack-s">
          <p className="small">Block {sel * BLOCK_CM}-{(sel + 1) * BLOCK_CM} cm</p>
          <label className="field small">Rock type<select value={b.rock ?? ''} onChange={(e) => put('rock', e.target.value)}>{ROCK.map((r) => <option key={r} value={r}>{r || 'not set'}</option>)}</select></label>
          <label className="field small">Colour<input value={b.colour ?? ''} onChange={(e) => put('colour', e.target.value)} placeholder="e.g. reddish brown" /></label>
          <label className="field small">Grain<select value={b.grain ?? ''} onChange={(e) => put('grain', e.target.value)}>{GRAIN.map((r) => <option key={r} value={r}>{r || 'not set'}</option>)}</select></label>
          <label className="small"><input type="checkbox" checked={!!b.organics} onChange={(e) => put('organics', e.target.checked)} /> Organics flag</label>
          <button className="btn btn-s" onClick={exportJson}>Export core log as JSON</button>
        </div>
      </div>
    </section>
  );
}

// 3. Contamination control: every item ticked before the core can be sealed.
const CLEAN = [['bits', 'Sterilised bits'], ['bags', 'Sterile bags'], ['blanks', 'Blanks'], ['cold', 'Cold chain']];
function Contamination() {
  const [c, setC] = useSolState(3, 'contamination', {}), ready = CLEAN.every(([k]) => c[k]);
  return (
    <section className="sol-card" aria-labelledby="cc-h">
      <h2 id="cc-h" className="sol-h2">Contamination control</h2>
      <ul className="sol-checks">
        {CLEAN.map(([k, name]) => <li key={k}><label><input type="checkbox" checked={!!c[k]} disabled={!!c.sealedAt} onChange={(e) => setC((x) => ({ ...x, [k]: e.target.checked }))} /> {name}</label></li>)}
      </ul>
      {c.sealedAt ? <p className="small num">Core sealed at {new Date(c.sealedAt).toLocaleTimeString()}. <button className="btn btn-s" onClick={() => setC((x) => ({ ...x, sealedAt: null }))}>Undo</button></p>
        : <button className="btn btn-primary btn-s" disabled={!ready} onClick={() => setC((x) => ({ ...x, sealedAt: new Date().toISOString() }))}>Seal core</button>}
      {!ready && !c.sealedAt && <p className="small muted">Tick all {CLEAN.length} items to unlock "Seal core".</p>}
    </section>
  );
}

// 4. Rover traction: boulder field in the last 2 km, slow zone and the ETA slip.
function Traction({ day, rover }) {
  const [v, setV] = useSolState(3, 'slowKmh', PLAN_KMH), slipMin = Math.max(0, (SLOW_KM / v - SLOW_KM / PLAN_KMH) * 60);
  const inZone = rover.alongKm >= day.pathKm - SLOW_KM && rover.alongKm > 0;
  const out = day.phases.find((p) => p.type === 'drive_out'), back = day.phases.find((p) => p.type === 'drive_back');
  return (
    <section className={'sol-card' + (inZone && rover.moving ? ' is-amber' : '')} aria-labelledby="tc-h">
      <h2 id="tc-h" className="sol-h2">Rover traction</h2>
      <p className="small">Boulder field in the last {SLOW_KM} km before Site 3 ({(day.pathKm - SLOW_KM).toFixed(1)}-{day.pathKm.toFixed(1)} km along the path). The plan assumes {PLAN_KMH} km/h.</p>
      <label className="field small">Speed in the slow zone (km/h)<input type="number" min="1" max={PLAN_KMH} step="0.5" value={v} onChange={(e) => setV(Math.min(PLAN_KMH, Math.max(1, +e.target.value || 1)))} /></label>
      <p className="small num" role="status">{slipMin < 0.5 ? 'No ETA slip at plan speed.' : `ETA slip +${fmtDur(slipMin)} each way: on site ${fmtMin(out.t1 + slipMin)} instead of ${out.to}; back at base ${fmtMin(back.t1 + slipMin)} instead of ${back.to}.`}</p>
    </section>
  );
}

// 5. Weather/comms abort: the longest drive home so far, 108 min.
function Abort({ day, t, rover }) {
  const home = rover.alongKm / PLAN_KMH * 60, other = ARES.days().filter((d) => d.n !== 3 && d.driveMin).map((d) => `Sol ${d.n} ${d.driveMin} min`);
  return (
    <section className="sol-card" aria-labelledby="ab-h">
      <h2 id="ab-h" className="sol-h2">Abort (weather or comms)</h2>
      <p className="sol-big num">{day.driveMin} min <span className="small muted">drive home from Site 3</span></p>
      <p className="small">Longer than {other.join(', ') || 'earlier sols'}. Abort now ({fmtMin(t)}): back at base about {fmtMin(t + home)}{rover.alongKm > 0 ? ` (${fmtDur(home)} drive from ${rover.alongKm.toFixed(1)} km out)` : ''}.</p>
    </section>
  );
}

// 6. Map: west of the base, the slow zone and the "WNW 285°" label.
function MapExtras({ fs, bx, by, sx, sy, day }) {
  const v = ARES.get(3, 'slowKmh', PLAN_KMH), f = 1 - SLOW_KM / day.pathKm, zx = bx + (sx - bx) * f, zy = by + (sy - by) * f;
  return <>
    <line x1={zx} y1={zy} x2={sx} y2={sy} className="sol-route is-soft" />
    <text x={zx} y={zy + fs * 1.4} fontSize={fs * 0.8} textAnchor="middle" className="sol-label">slow zone, boulders: last {SLOW_KM} km</text>
    <text x={zx} y={zy + fs * 2.4} fontSize={fs * 0.7} textAnchor="middle" className="sol-label">plan {PLAN_KMH} km/h{v < PLAN_KMH ? `; at ${v} km/h, +${Math.round((SLOW_KM / v - SLOW_KM / PLAN_KMH) * 60)} min` : ''}</text>
  </>;
}

const day = ARES.registerDay(3, {
  siteName: 'Site 3', risk: 'moderate risk', riskLevel: 'moderate', badges: ['First drilling day'],
  site: { lat: 28.483, lon: 319.547 }, straightKm: 12, pathKm: 14.4, bearing: 285, driveMin: 108, dirLabel: 'WNW 285°',
  terrain: 'Knobby rocky terrain with Chryse-margin outflow sediment, consolidated layers, boulders, slower driving.',
  netWorkMin: 159, scienceMin: 124, endSoc: 63,
  phases: `
07:30-09:18 | drive_out | - | C drives; D nav/comms/health; A+B review drill plan and sterile-handling procedure.
09:18-09:38 | setup | - | A+C anchor drill rig and rim markers; B+D unpack core-handling kit; B sterilises bits and tools.
09:38-10:28 | science | C+D | C drills a 1-2 m core; D drill telemetry and safety monitoring, dust control. Inside: A prepares core-logging station; B contamination-free core handling setup (sterile bags, cold box).
10:28-10:43 | break | - | Break 1.
10:43-11:33 | science | A+B | A core logging and rock surface-versus-interior comparison; B aseptic core sub-sampling. Inside: C borehole preparation and drill-bit inspection; D borehole drone prep.
11:33-11:48 | break | - | Break 2.
11:48-12:12 | science | C+D | D borehole drone imaging; C retrieves the drone, caps and marks the borehole. Inside: A+B perchlorate and organics assay on core sub-samples.
12:12-12:27 | closeout | - | Seal and cold-store core, tool count, final checks.
12:27-14:15 | drive_back | - | A drives, C co-driver; B secure core in cold box; D comms/health.
14:15-14:30 | reserve | - | Dock, recharge, debrief.`,
  experiments: [
    { name: 'Drill 1-2 m core', who: 'C' },
    { name: 'Core logging', who: 'A' },
    { name: 'Aseptic sub-sampling', who: 'B' },
    { name: 'Rock surface-versus-interior comparison', who: 'A' },
    { name: 'Perchlorate assay', who: 'A/B' },
    { name: 'Organics assay', who: 'B' },
    { name: 'Borehole drone imaging', who: 'D' },
  ],
  alertsAt: (rover) => (rover.moving && rover.alongKm >= day.pathKm - SLOW_KM ? ['Boulder field: last 2 km before Site 3. Slow down.'] : []),
  Features, MapExtras,
});
day.socAdjust = (t) => -(DRILL_KW * drillState(day, t).min / 60) / ROVER_KWH * 100;

if (import.meta.env?.DEV) { // 3.5 cm/min for the 50-minute slot reaches 1.75 m; 2 m caps it
  console.assert(Math.abs(drillMin(day, DRILL0, 10 * 60 + 28) - 50) < 1e-9 && drillMin(day, { ...DRILL0, rate: 10 }, 11 * 60) === 20, 'sol3 drill model');
}
