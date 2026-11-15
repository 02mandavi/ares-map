// Sol 5: Site 4, pitted cones / possible mud volcanoes, high risk. Only this sol's data and features live here.
import { ARES, useSolState, toMin, fmtDur } from './sols.js';
import { GasPanel, ReturnCard, PnrMarker, AbortCard } from './solkit.jsx';

const CORE_CUTOFF = '11:50'; // start the shallow core only before this

function Features({ day, t }) {
  return <>
    <Risk t={t} />
    <GasPanel n={5} t={t} label="Gas panel (TLS)" />
    <TimePressure day={day} t={t} />
    <ReturnCard day={day} t={t} />
  </>;
}

// 5. Risk: rim-collapse abort trigger and the two-rover convoy status.
function Risk({ t }) {
  const [c, setC] = useSolState(5, 'convoy', { r1: 'nominal', r2: 'in convoy' });
  return <>
    <AbortCard n={5} t={t} label="Rim collapse: abort now" reason="rim collapse" />
    <section className={'sol-card' + (c.r1 !== 'nominal' || c.r2 !== 'in convoy' ? ' is-amber' : '')} aria-labelledby="cv-h">
      <h2 id="cv-h" className="sol-h2">Convoy status</h2>
      <div className="sol-verify"><span className="small">Rover 1</span><span className="seg" role="group" aria-label="Rover 1">{['nominal', 'fault'].map((v) => <button key={v} className="tab" aria-pressed={c.r1 === v} onClick={() => setC((x) => ({ ...x, r1: v }))}>{v}</button>)}</span></div>
      <div className="sol-verify"><span className="small">Rover 2</span><span className="seg" role="group" aria-label="Rover 2">{['in convoy', 'not in convoy'].map((v) => <button key={v} className="tab" aria-pressed={c.r2 === v} onClick={() => setC((x) => ({ ...x, r2: v }))}>{v}</button>)}</span></div>
      {c.r2 !== 'in convoy' && <p className="warn small">The safety plan asks to consider a two-rover convoy on this sol.</p>}
      {c.r1 !== 'nominal' && <p className="warn small">Rover 1 fault: weigh the abort before going further.</p>}
    </section>
  </>;
}

// 3. Time pressure: science minutes left of the net 121, and the shallow-core cutoff.
function TimePressure({ day, t }) {
  const sci = day.phases.filter((p) => p.type === 'science'), left = sci.reduce((s, p) => s + Math.max(0, p.t1 - Math.max(t, p.t0)), 0);
  const total = sci.reduce((s, p) => s + p.t1 - p.t0, 0), cut = toMin(CORE_CUTOFF);
  return (
    <section className="sol-card" aria-labelledby="tp-h">
      <h2 id="tp-h" className="sol-h2">Time pressure</h2>
      <p className="sol-big num">{Math.round(left)} min <span className="small muted">left for science, of {total} (plan net {day.scienceMin})</span></p>
      <p className={'small num' + (t >= cut ? ' warn' : '')}>Optional shallow hand-auger core: start only before {CORE_CUTOFF}. {t < cut ? `${fmtDur(cut - t)} left to start it.` : 'Too late to start; do best-sample resampling instead.'}</p>
    </section>
  );
}

// 2 and 4. Map: flank hazard zone, the stable-side arrow and the point of no return.
function MapExtras(p) {
  const { fs, sx, sy, day } = p, stable = (day.bearing + 180) % 360, b = stable * Math.PI / 180, L = 1.3;
  return <>
    <circle cx={sx} cy={sy} r={0.7} className="sol-hazard" />
    <text x={sx} y={sy + 0.7 + fs * 1.1} fontSize={fs * 0.75} textAnchor="middle" className="sol-label">flank and rim-collapse caution (extent not measured)</text>
    <line x1={sx + 0.75 * Math.sin(b)} y1={sy - 0.75 * Math.cos(b)} x2={sx + L * 1.6 * Math.sin(b)} y2={sy - L * 1.6 * Math.cos(b)} className="sol-arrow-stable" markerEnd="url(#sol-arrow)" />
    <text x={sx + L * 1.6 * Math.sin(b) + fs * 0.6} y={sy - L * 1.6 * Math.cos(b)} fontSize={fs * 0.7} className="sol-label">stay on the stable side: {stable}° (approach side, assumed)</text>
    <PnrMarker {...p} />
  </>;
}

ARES.registerDay(5, {
  siteName: 'Site 4', risk: 'high risk', riskLevel: 'high', badges: ['Higher risk'],
  site: { lat: 28.637, lon: 319.684 }, straightKm: 13, pathKm: 15.6, bearing: 340, driveMin: 117,
  terrain: 'Pitted-cone / possible mud-volcano field, fine-grained clay- or salt-bearing breccia; unstable cone flanks and rim collapse risk.',
  netWorkMin: 141, scienceMin: 121, endSoc: 64,
  phases: `
07:30-09:27 | drive_out | - | C drives; D nav/comms/health; A+B review Sol 4 target ranking and cone-flank hazard map. Consider a two-rover convoy per the safety plan.
09:27-09:37 | setup | - | A+C anchor safety lines on stable ground, mark the no-go flank zone; B+D unpack Raman, microfluidic drone and gas sensor.
09:37-10:32 | science | A+B | A hand-lens and rim stability check, breccia description; B Raman screening of breccia and crack walls for clays and salts, quick ATP/lipid screens. Inside: C rover systems; D microfluidic nanodrone prep and vitals.
10:32-10:47 | break | - | Break 1.
10:47-11:32 | science | C+D | D gas profiling at pit vents and microfluidic nanodrone sampling in the deeper fracture; C tether anchoring and sampling pole. Inside: A hazard and sample target mapping; B microscopy and assays on block-1 samples.
11:32-11:47 | break | - | Break 2.
11:47-12:08 | science | A+B | A+B shallow hand-auger core only if time and rim safety allow (compare with Site 3); otherwise best-sample resampling. Inside: C stow; D data backup.
12:08-12:18 | closeout | - | Seal samples, tool count, rim check.
12:18-14:15 | drive_back | - | A drives, C co-driver; B stow samples; D comms/health.
14:15-14:30 | reserve | - | Dock, recharge, debrief.`,
  experiments: [
    { name: 'Hand-lens plus Raman screening of breccia and walls for clays and salts', who: 'A/B' },
    { name: 'ATP/lipid screening of the best samples', who: 'B' },
    { name: 'Gas profiling at pit vents', who: 'D' },
    { name: 'Optional shallow core', who: 'A/B' },
  ],
  Features, MapExtras,
});
