// Sol 1: Site 1, the nearest, lowest-risk site; the crew's learning day. Only this sol's data and features live here.
import { ARES, useSolState, socAt, toMin, fmtMin } from './sols.js';

const INSTRUMENTS = ['GPR', 'Magnetometer', 'Raman/UV-fluorescence', 'ATP/lipid assay and microscope', 'Drill', 'Nanodrone'];
const CHECKS = [
  ['relay', 'Relay beacon link test'],
  ['calibration', 'Instrument calibration'],
  ['drill', 'First drill-protocol test'],
];

function Features({ day, t }) {
  return <>
    <BaselineCard />
    <Verification />
    <Battery day={day} t={t} />
  </>;
}

// 1. Sol 1 baseline: first-day calibration readings, saved so later sols can show the difference from them.
function BaselineCard() {
  const saved = ARES.getBaseline(1);
  const [draft, setDraft] = useSolState(1, 'baselineDraft', { instruments: {}, methanePpb: '', tempC: '', simulated: false });
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v, simulated: false }));
  return (
    <section className="sol-card" aria-labelledby="bl-h">
      <h2 id="bl-h" className="sol-h2">Sol 1 baseline</h2>
      <p className="small muted">First-day calibration readings. Later sols show "difference from Sol 1 baseline".</p>
      <fieldset className="sol-fs"><legend className="small">Instrument checks</legend>
        {INSTRUMENTS.map((i) => (
          <label key={i} className="sol-inline small">{i}
            <select value={draft.instruments[i] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, instruments: { ...d.instruments, [i]: e.target.value } }))}>
              <option value="">not checked</option><option value="ok">OK</option><option value="fault">fault</option>
            </select>
          </label>
        ))}
      </fieldset>
      <label className="field small">Baseline gas: methane (ppb)<input type="number" step="0.01" value={draft.methanePpb} onChange={(e) => set('methanePpb', e.target.value)} /></label>
      <label className="field small">Baseline temperature (°C)<input type="number" step="0.1" value={draft.tempC} onChange={(e) => set('tempC', e.target.value)} /></label>
      <div className="row">
        <button className="btn btn-primary btn-s" disabled={draft.methanePpb === '' || draft.tempC === ''} onClick={() => ARES.saveBaseline(1, { instruments: draft.instruments, methanePpb: +draft.methanePpb, tempC: +draft.tempC, simulated: draft.simulated })}>Save baseline</button>
        <button className="btn btn-s" onClick={() => setDraft({ instruments: Object.fromEntries(INSTRUMENTS.map((i) => [i, 'ok'])), methanePpb: '0.41', tempC: '-32', simulated: true })}>Fill with simulated values</button>
      </div>
      {saved ? <p className="small num">Saved {new Date(saved.savedAt).toLocaleString()}: methane {saved.methanePpb} ppb, {saved.tempC} °C, {Object.values(saved.instruments ?? {}).filter((v) => v === 'ok').length} of {INSTRUMENTS.length} instruments OK{saved.simulated ? ' (simulated values)' : ''}.</p>
        : <p className="small muted">No baseline saved yet.</p>}
    </section>
  );
}

// 2. Systems verification. A failed item adds a warning to the Sol 4 buffer plan.
function Verification() {
  const [res, setRes] = useSolState(1, 'verification', {});
  const mark = (id, label, v) => {
    setRes((r) => ({ ...r, [id]: v }));
    ARES.setBufferWarning(4, `sol1-${id}`, v === 'fail' ? `Sol 1 ${label.toLowerCase()} failed: schedule a retry.` : null);
  };
  return (
    <section className="sol-card" aria-labelledby="sv-h">
      <h2 id="sv-h" className="sol-h2">Systems verification</h2>
      <ul className="sol-checks">
        {CHECKS.map(([id, label]) => (
          <li key={id} className="sol-verify">
            <span className="small">{label}</span>
            <span className="seg" role="group" aria-label={label}>
              {[['', 'Not run'], ['pass', 'Pass'], ['fail', 'Fail']].map(([v, name]) => <button key={name} className="tab" aria-pressed={(res[id] ?? '') === v} onClick={() => mark(id, label, v)}>{name}</button>)}
            </span>
          </li>
        ))}
      </ul>
      {CHECKS.some(([id]) => res[id] === 'fail') && <p className="warn small">Failed items are added to the Sol 4 buffer plan.</p>}
    </section>
  );
}

// 4. Battery forecast: 100 % at the start, about 70 % at the end.
function Battery({ day, t }) {
  const s = toMin(day.window[0]), e = toMin(day.window[1]), W = 300, H = 90, x = (m) => (m - s) / (e - s) * W, y = (v) => H - (v - 50) / 50 * H;
  const pts = []; for (let m = s; m <= e; m += 5) pts.push(`${x(m).toFixed(1)},${y(socAt(day, m)).toFixed(1)}`);
  return (
    <section className="sol-card" aria-labelledby="bat-h">
      <h2 id="bat-h" className="sol-h2">Battery forecast <span className="small muted">start 100%, end about {day.endSoc}%</span></h2>
      <svg viewBox={`-28 -6 ${W + 36} ${H + 22}`} className="sol-chart" role="img" aria-label={`Battery from 100% at ${day.window[0]} to about ${day.endSoc}% at docking`}>
        {[100, 75, 50].map((v) => <g key={v}><line x1="0" x2={W} y1={y(v)} y2={y(v)} className="sol-grid" /><text x="-4" y={y(v) + 3} className="sol-tick" textAnchor="end">{v}%</text></g>)}
        <polyline points={pts.join(' ')} className="sol-line" />
        <line x1={x(t)} x2={x(t)} y1="0" y2={H} className="sol-now" />
        <text x="0" y={H + 14} className="sol-tick">{day.window[0]}</text><text x={W} y={H + 14} className="sol-tick" textAnchor="end">{day.window[1]}</text>
        <text x={Math.min(W - 40, x(t) + 4)} y="8" className="sol-tick">{fmtMin(t)} · {socAt(day, t).toFixed(0)}%</text>
      </svg>
      <p className="small muted">Model: drives draw three times the parked rate. Verify against the rover's power budget.</p>
    </section>
  );
}

ARES.registerDay(1, {
  siteName: 'Site 1', risk: 'low risk', riskLevel: 'low', badges: ['Learning day'],
  site: { lat: 28.557, lon: 319.823 }, straightKm: 8, pathKm: 9.6, bearing: 20, driveMin: 72,
  terrain: 'Dust-mantled smooth Vastitas Borealis plains, shallow fracture.',
  netWorkMin: 231, scienceMin: 196, endSoc: 70,
  phases: `
07:30-08:42 | drive_out | - | C drives; D navigation, comms, baseline health; A route and hazard review; B sterile-kit check.
08:42-09:02 | setup | - | A+C anchor safety lines and rim markers; B+D unpack instruments; D deploys the portable relay beacon at the rim and runs a link test.
09:02-10:22 | science | A+B | A geological context mapping, rim stability survey, regolith description; B surface soil and 10-30 cm scoop sampling, in-situ Raman/UV-fluorescence screening. Inside: C rover power and thermal check, drill-bit dry-run prep; D vitals, comms, drone pre-flight.
10:22-10:37 | break | - | Break 1 (all crew; hydrate, snack, suit check).
10:37-11:52 | science | C+D | C ground-penetrating radar transects across the fracture and a drill-protocol test (0.3 m pilot hole); D magnetometer survey and nanodrone crack-mouth survey. Inside: A GPR and geology interpretation; B ATP/lipid assay and microscopy of block-1 samples.
11:52-12:07 | break | - | Break 2.
12:07-12:48 | science | A+B | A+B targeted resampling at GPR- and drone-flagged spots, seal samples, retrieve drone. Inside: C stow instruments and prep rover; D data backup and relay-pass comms.
12:48-13:03 | closeout | - | Seal samples, tool count, final rim check, photos. All crew.
13:03-14:15 | drive_back | - | A drives, C co-driver and tool check; B label and stow samples; D comms and health log.
14:15-14:30 | reserve | - | Dock, plug in charger, debrief.`,
  experiments: [
    { name: 'GPR transects across fracture', who: 'C' },
    { name: 'Magnetometer survey', who: 'D' },
    { name: 'Surface soil sample', who: 'B' },
    { name: '10-30 cm scoop samples', who: 'B' },
    { name: 'Nanodrone crack-mouth survey', who: 'D' },
    { name: 'Raman/UV-fluorescence screening', who: 'B' },
    { name: 'ATP/lipid assay of block-1 samples', who: 'B' },
    { name: 'Drill protocol test on easiest ground', who: 'C' },
  ],
  // 3. Learning day: procedures done for the first time, highlighted in the timeline.
  firstTime: {
    '08:42': ['anchoring safety lines and rim markers', 'relay beacon deployment and link test'],
    '09:02': ['rim stability survey', 'surface and 10-30 cm scoop sampling', 'in-situ Raman/UV-fluorescence screening', 'drone pre-flight'],
    '10:37': ['GPR transects', 'drill-protocol test (0.3 m pilot hole)', 'magnetometer survey', 'nanodrone crack-mouth survey', 'ATP/lipid assay and microscopy'],
    '12:07': ['targeted resampling at GPR- and drone-flagged spots', 'drone retrieval', 'relay-pass comms'],
  },
  Features,
});
