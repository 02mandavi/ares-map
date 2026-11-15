// Sol 4: buffer / rendezvous day at base. No rover travel. Only this sol's data and features live here.
import { ARES, useSolState, toMin, fmtMin, fmtDur, socAt } from './sols.js';
import { ROVER_KWH } from './monitor.js';

const CHARGE_KW = 6;

function Features({ day, t }) {
  return <>
    <Inventory />
    <Targets />
    <GoNoGo />
    <Charging day={day} t={t} />
    <Equipment />
  </>;
}

// 1. Sample inventory: editable, saved in browser storage (ARES.set wraps it in try/catch), with counters.
const STATUS = ['unprocessed', 'processed', 'flagged'];
const PLANNED = [ // the samples the Sol 1-3 phase plans call for; crew edits depth and status
  ['S1-01', 1, 'Site 1', 'surface', 'surface soil'], ['S1-02', 1, 'Site 1', '10-30 cm', 'scoop sample'],
  ['S2-01', 2, 'Site 2', 'trough wall', 'wall scrape'], ['S2-02', 2, 'Site 2', '', 'soil column, trough centre'],
  ['S2-03', 2, 'Site 2', '', 'soil column, polygon plateau'], ['S2-04', 2, 'Site 2', '', 'wall sample'],
  ['S3-01', 3, 'Site 3', '1-2 m', 'drill core'], ['S3-02', 3, 'Site 3', '', 'aseptic core sub-sample'],
];
function Inventory() {
  const [rows, setRows] = useSolState(4, 'inventory', []);
  const put = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const add = (x) => setRows((r) => [...r, x]);
  return (
    <section className="sol-card" aria-labelledby="inv-h">
      <h2 id="inv-h" className="sol-h2">Sample inventory <span className="small muted">{rows.length} samples · {STATUS.map((s) => `${rows.filter((x) => x.status === s).length} ${s}`).join(', ')}</span></h2>
      <div className="sol-scroll">
        <table className="sol-table">
          <thead><tr><th scope="col">ID</th><th scope="col">Sol</th><th scope="col">Site</th><th scope="col">Depth</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={i}>
                {['id', 'sol', 'site', 'depth', 'type'].map((k) => <td key={k}><input value={x[k]} aria-label={`${k}, row ${i + 1}`} onChange={(e) => put(i, k, e.target.value)} /></td>)}
                <td><select value={x.status} aria-label={`Status, row ${i + 1}`} onChange={(e) => put(i, 'status', e.target.value)}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></td>
                <td><button className="btn btn-s" aria-label={`Remove ${x.id || `row ${i + 1}`}`} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="small muted">No samples logged yet.</p>}
      <div className="row">
        <button className="btn btn-s" onClick={() => add({ id: '', sol: '', site: '', depth: '', type: '', status: 'unprocessed' })}>Add a sample</button>
        <button className="btn btn-s" onClick={() => setRows((r) => [...r, ...PLANNED.filter(([id]) => !r.some((x) => x.id === id)).map(([id, sol, site, depth, type]) => ({ id, sol: String(sol), site, depth, type, status: 'unprocessed' }))])}>Add the samples Sols 1-3 plan for</button>
      </div>
    </section>
  );
}

// 2. Target selector for Sites 4 and 5: ranked, reorderable, saved for the Sol 5 and Sol 6 pages.
const SEED = [ // target kinds the Sol 1-3 plans produce; the crew renames, assigns and ranks them
  'GPR-flagged spot in the fracture (from Sol 1)', 'Core interval with an organics flag (from Sol 3)',
];
function Targets() {
  const [list, setList] = useSolState(4, 'targets', SEED.map((name, i) => ({ id: `t${i}`, name, site: '' })));
  const saved = ARES.get(4, 'targetsSaved', null);
  const move = (i, d) => setList((l) => { const x = [...l], j = i + d; if (j < 0 || j >= x.length) return x; [x[i], x[j]] = [x[j], x[i]]; return x; });
  const put = (i, k, v) => setList((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <section className="sol-card" aria-labelledby="tg-h">
      <h2 id="tg-h" className="sol-h2">Targets for Sites 4 and 5 <span className="small muted">ranked, top first</span></h2>
      <ol className="sol-rank">
        {list.map((x, i) => (
          <li key={x.id}>
            <input value={x.name} aria-label={`Target ${i + 1}`} onChange={(e) => put(i, 'name', e.target.value)} />
            <select value={x.site} aria-label={`Site for target ${i + 1}`} onChange={(e) => put(i, 'site', e.target.value)}><option value="">site?</option><option value="4">Site 4</option><option value="5">Site 5</option></select>
            <button className="btn btn-s" aria-label={`Move target ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>Up</button>
            <button className="btn btn-s" aria-label={`Move target ${i + 1} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>Down</button>
            <button className="btn btn-s" aria-label={`Remove target ${i + 1}`} onClick={() => setList((l) => l.filter((_, j) => j !== i))}>×</button>
          </li>
        ))}
      </ol>
      <div className="row">
        <button className="btn btn-s" onClick={() => setList((l) => [...l, { id: `t${Date.now()}`, name: '', site: '' }])}>Add a target</button>
        <button className="btn btn-primary btn-s" onClick={() => ARES.set(4, 'targetsSaved', { list: list.filter((x) => x.name.trim()), savedAt: new Date().toISOString() })}>Save the ranking</button>
      </div>
      <p className="small muted">{saved ? `Saved ${new Date(saved.savedAt).toLocaleString()}; shown on Sol 5 and Sol 6 as "priority targets".` : 'Not saved yet. The saved ranking shows on Sol 5 and Sol 6 as "priority targets".'}</p>
    </section>
  );
}

// 3. Sol 5 Go/No-Go.
const GO = [['weather', 'Weather'], ['battery', 'Battery 100%'], ['suits', 'Suits'], ['drills', 'Drills'], ['comms', 'Comms'], ['health', 'Crew health']];
function GoNoGo() {
  const [c, setC] = useSolState(4, 'goNoGo', {}), go = GO.every(([k]) => c[k]);
  return (
    <section className="sol-card" aria-labelledby="gn-h">
      <h2 id="gn-h" className="sol-h2">Sol 5 Go/No-Go</h2>
      <ul className="sol-checks sol-cols">
        {GO.map(([k, name]) => <li key={k}><label><input type="checkbox" checked={!!c[k]} onChange={(e) => setC((x) => ({ ...x, [k]: e.target.checked }))} /> {name}</label></li>)}
      </ul>
      <p className={'sol-go ' + (go ? 'is-go' : 'is-nogo')} role="status">{go ? 'GO' : 'NO-GO'}</p>
      {!go && <p className="warn small"><strong>Slip plan:</strong> shift Sol 5 to Sol 7 and run the contingency prompt for the slipped sol. Not ready: {GO.filter(([k]) => !c[k]).map(([, n]) => n.toLowerCase()).join(', ')}.</p>}
    </section>
  );
}

// 4. Charging curve: modelled at 6 kW from Sol 3's expected end SOC.
function Charging({ day, t }) {
  const s = toMin(day.window[0]), e = toMin(day.window[1]), W = 300, H = 90, x = (m) => (m - s) / (e - s) * W, y = (v) => H - (v - 50) / 50 * H;
  const soc = socAt(day, t), full = s + (100 - day.startSoc) / (CHARGE_KW / ROVER_KWH * 100) * 60, target = toMin('14:15');
  const pts = []; for (let m = s; m <= e; m += 5) pts.push(`${x(m).toFixed(1)},${y(socAt(day, m)).toFixed(1)}`);
  return (
    <section className="sol-card" aria-labelledby="ch-h">
      <h2 id="ch-h" className="sol-h2">Charging <span className="small muted">modelled</span></h2>
      <p className="small num">SOC now {soc.toFixed(0)}% · {soc >= 100 ? 'full' : `full in ${fmtDur(full - t)} (${fmtMin(full)})`} · target 100% by 14:15 {full <= target ? 'met' : 'missed'}</p>
      <svg viewBox={`-28 -6 ${W + 36} ${H + 22}`} className="sol-chart" role="img" aria-label={`Charging from ${day.startSoc}% at ${day.window[0]} to 100% at ${fmtMin(full)}`}>
        {[100, 75, 50].map((v) => <g key={v}><line x1="0" x2={W} y1={y(v)} y2={y(v)} className="sol-grid" /><text x="-4" y={y(v) + 3} className="sol-tick" textAnchor="end">{v}%</text></g>)}
        <line x1={x(target)} x2={x(target)} y1="0" y2={H} className="sol-grid" /><text x={x(target) - 2} y={H - 4} className="sol-tick" textAnchor="end">14:15</text>
        <polyline points={pts.join(' ')} className="sol-line" />
        <line x1={x(t)} x2={x(t)} y1="0" y2={H} className="sol-now" />
        <text x="0" y={H + 14} className="sol-tick">{day.window[0]}</text><text x={W} y={H + 14} className="sol-tick" textAnchor="end">{day.window[1]}</text>
      </svg>
      <p className="small muted">Model: {CHARGE_KW} kW into a {ROVER_KWH} kWh pack (placeholder capacity, verify) from {day.startSoc}%, Sol 3's expected end SOC, charging from {day.window[0]}. No overnight charge assumed.</p>
    </section>
  );
}

// 5. Equipment health carried over from Sols 1-3.
function Equipment() {
  const [ok, setOk] = useSolState(4, 'equipmentChecked', {});
  const v1 = ARES.get(1, 'verification', {}), bl = ARES.getBaseline(1), drill = ARES.get(3, 'drill', null), core = ARES.get(3, 'contamination', {});
  const faults = bl ? Object.entries(bl.instruments ?? {}).filter(([, s]) => s === 'fault').map(([i]) => i) : null;
  const res = (x) => (x ? x : 'not run');
  const rows = [
    ['bit', 'Drill bit wear', `Sol 1 drill-protocol test: ${res(v1.drill)}. Sol 3: ${drill ? `drill record at ${drill.rate} cm/min${drill.stopped ? ', stopped early' : drill.pausedMin ? `, paused ${Math.round(drill.pausedMin)} min` : ''}` : 'no drill record'}. Inspect and replace bits (C).`],
    ['relay', 'Relay beacon', `Sol 1 link test: ${res(v1.relay)}.`],
    ['instruments', 'Instruments', faults == null ? 'No Sol 1 baseline saved.' : faults.length ? `Faults at Sol 1 baseline: ${faults.join(', ')}.` : 'All OK at Sol 1 baseline.'],
    ['cal', 'Calibration', `Sol 1: ${res(v1.calibration)}.`],
    ['wheels', 'Drive-train and wheels', `Sol 2 trough floor and Sol 3 boulder field driven. Sol 3 slow-zone speed ${ARES.get(3, 'slowKmh', 8)} km/h.`],
    ['cold', 'Core cold chain', core.sealedAt ? 'Sol 3 core sealed with all contamination checks.' : 'Sol 3 core not recorded as sealed.'],
  ];
  return (
    <section className="sol-card" aria-labelledby="eq-h">
      <h2 id="eq-h" className="sol-h2">Equipment health <span className="small muted">carried over from Sols 1-3</span></h2>
      <ul className="sol-checks">
        {rows.map(([k, name, note]) => <li key={k}><label><input type="checkbox" checked={!!ok[k]} onChange={(e) => setOk((x) => ({ ...x, [k]: e.target.checked }))} /> <strong>{name}</strong>: {note}</label></li>)}
      </ul>
    </section>
  );
}

// 6. Map: base area only, with a 500 m EVA test circle.
function MapExtras({ fs, bx, by }) {
  const on = ARES.get(4, 'evaCircle', true);
  return on ? <>
    <circle cx={bx} cy={by} r={0.5} className="sol-zone sol-eva" />
    <text x={bx} y={by - 0.5 - fs * 0.4} fontSize={fs * 0.8} textAnchor="middle" className="sol-label">500 m EVA test limit (C+D)</text>
  </> : null;
}
function MapToggle() {
  const [on, setOn] = useSolState(4, 'evaCircle', true);
  return <label className="small"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Show the 500 m EVA test circle on the map</label>;
}

const day = ARES.registerDay(4, {
  kind: 'buffer', siteName: 'Base', risk: 'buffer / rendezvous', riskLevel: 'low', badges: ['No rover travel'],
  purpose: 'Analyse Sol 1-3 samples, maintain equipment, choose targets for Sites 4-5, absorb a one-sol weather or fault slip.',
  mapPadKm: 1.2, startSoc: 63,
  phases: `
07:30-08:00 | admin | - | D daily health check, radiation dose and consumables audit; C rover and suit inspection; A+B review the sample inventory.
08:00-10:15 | lab | - | B ATP/lipid assays, microscopy, organics screening; A core and rock logging, mineral ID; C rover drive-train and wheel check, replace drill bits; D nanodrone battery and firmware service, data review.
10:15-10:30 | break | - | Break 1.
10:30-12:15 | admin | - | Data fusion: all crew merge GPR, thermal, TLS, drone and core data to rank drill and drone targets for Sites 4-5; update the risk ranking. Optional short EVA by C+D within 500 m of base for equipment tests (A+B inside).
12:15-12:30 | break | - | Break 2.
12:30-13:45 | admin | - | Earth uplink and report (4-24 min one-way delay), weather and dust check, Go/No-Go decision for Sol 5.
13:45-14:15 | admin | - | Rover recharge to 100%, consumable restock, contingency decision (slip schedule if needed).
14:15-14:30 | reserve | - | Wrap-up and Sol 5 brief.`,
  experiments: [
    { name: 'ATP/lipid assays', who: 'B' },
    { name: 'Microscopy', who: 'B' },
    { name: 'Organics screening', who: 'B' },
    { name: 'Core logging', who: 'A' },
    { name: 'Target ranking', who: 'all' },
    { name: 'Drill-bit replacement', who: 'C' },
  ],
  Features: (p) => <><MapToggle /><Features {...p} /></>, MapExtras,
});
day.socModel = (t) => Math.min(100, day.startSoc + CHARGE_KW / ROVER_KWH * 100 * Math.max(0, t - toMin(day.window[0])) / 60);
