// Sol 2: Site 2, giant-polygon troughs. Only this sol's data and features live here.
import { ARES, useSolState } from './sols.js';

const ZONE_KM = 0.5; // soft trough floor: the last 0.5 km before the site
const inZone = (day, rover) => rover.alongKm >= day.pathKm - ZONE_KM && rover.alongKm > 0;
// Simulated slip: about 4 % on firm ground, rising across the soft zone to about 20 % at the site (verify with real wheel odometry).
const slipAt = (day) => (rover) => (!rover.moving ? 0 : inZone(day, rover) ? 6 + 14 * (rover.alongKm - (day.pathKm - ZONE_KM)) / ZONE_KM : 4);

const METRICS = [['tempC', 'Temperature', '°C'], ['moisture', 'Moisture (relative permittivity)', ''], ['methanePpb', 'TLS methane', 'ppb']];

function Features({ day, rover }) {
  return <>
    <Trafficability day={day} rover={rover} />
    <Compare />
    <VsSol1 />
  </>;
}

// 1. Trafficability: soft-floor warning in the trough zone; slip is shown in telemetry, amber above 15 %.
function Trafficability({ day, rover }) {
  const z = inZone(day, rover), slip = day.slipAt(rover);
  return (
    <section className={'sol-card' + (z ? ' is-amber' : '')} aria-labelledby="tr-h">
      <h2 id="tr-h" className="sol-h2">Trafficability</h2>
      <p className="small">Soft trough floors, mild entrapment risk. Flagged zone: the last {ZONE_KM} km before Site 2 ({(day.pathKm - ZONE_KM).toFixed(1)}-{day.pathKm} km along the path).</p>
      <p className="small num" role="status">{z ? `Rover is in the trough zone · wheel slip ${slip.toFixed(0)}%${slip > 15 ? ', above 15%' : ''}` : 'Rover is outside the trough zone.'}</p>
    </section>
  );
}

// 2. Trough vs plateau: fills as values are typed or simulated, both plotted on one small chart.
function Compare() {
  const [v, setV] = useSolState(2, 'readings', { trough: {}, plateau: {}, simulated: false });
  const put = (where, k, val) => setV((r) => ({ ...r, [where]: { ...r[where], [k]: val }, simulated: false }));
  const num = (x) => (x === '' || x == null ? null : +x);
  return (
    <section className="sol-card" aria-labelledby="cmp-h">
      <h2 id="cmp-h" className="sol-h2">Trough vs plateau {v.simulated && <span className="small muted">simulated values</span>}</h2>
      <table className="sol-table">
        <thead><tr><th scope="col">Reading</th><th scope="col">Trough floor</th><th scope="col">Polygon plateau</th></tr></thead>
        <tbody>
          {METRICS.map(([k, name, unit]) => (
            <tr key={k}><th scope="row" className="small">{name}{unit ? ` (${unit})` : ''}</th>
              {['trough', 'plateau'].map((w) => <td key={w}><input type="number" step="any" aria-label={`${name}, ${w}`} value={v[w][k] ?? ''} onChange={(e) => put(w, k, e.target.value)} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn-s" onClick={() => setV({ trough: { tempC: '-41', moisture: '3.4', methanePpb: '0.62' }, plateau: { tempC: '-28', moisture: '2.9', methanePpb: '0.44' }, simulated: true })}>Fill with simulated values</button>
      <svg viewBox="0 0 320 96" className="sol-chart" role="img" aria-label="Trough and plateau readings side by side">
        {METRICS.map(([k, name], i) => {
          const a = num(v.trough[k]), b = num(v.plateau[k]), m = Math.max(Math.abs(a ?? 0), Math.abs(b ?? 0)) || 1, y = 6 + i * 30;
          return <g key={k}>
            <text x="0" y={y + 9} className="sol-tick">{name.split(' (')[0]}</text>
            {a != null && <><rect x="110" y={y} width={Math.abs(a) / m * 150} height="9" className="sol-bar is-trough" /><text x={114 + Math.abs(a) / m * 150} y={y + 8} className="sol-tick">{a}</text></>}
            {b != null && <><rect x="110" y={y + 11} width={Math.abs(b) / m * 150} height="9" className="sol-bar is-plateau" /><text x={114 + Math.abs(b) / m * 150} y={y + 19} className="sol-tick">{b}</text></>}
          </g>;
        })}
      </svg>
      <p className="small muted"><span className="sol-key is-trough" /> trough floor <span className="sol-key is-plateau" /> polygon plateau · bars scaled per reading</p>
    </section>
  );
}

// 3. Sol 1 vs Sol 2, using the saved Sol 1 baseline.
function VsSol1() {
  const [v] = useSolState(2, 'readings', { trough: {}, plateau: {} }), b = ARES.getBaseline(1);
  const row = (name, key, unit, k2) => {
    const cell = (w) => { const x = v[w]?.[k2]; const dlt = ARES.diffFromBaseline(key, x); return x === '' || x == null ? '—' : `${x} ${unit} (${dlt > 0 ? '+' : ''}${dlt?.toFixed(2) ?? '?'})`; };
    return <tr key={key}><th scope="row" className="small">{name}</th><td className="num">{b ? `${b[key]} ${unit}` : '—'}</td><td className="num">{cell('trough')}</td><td className="num">{cell('plateau')}</td></tr>;
  };
  return (
    <section className="sol-card" aria-labelledby="vs-h">
      <h2 id="vs-h" className="sol-h2">Sol 1 vs Sol 2</h2>
      {!b && <p className="warn small">No Sol 1 baseline saved yet. Save it on Sol 1 to see the differences.</p>}
      <table className="sol-table">
        <thead><tr><th scope="col">Reading</th><th scope="col">Sol 1 baseline</th><th scope="col">Sol 2 trough</th><th scope="col">Sol 2 plateau</th></tr></thead>
        <tbody>{row('Temperature', 'tempC', '°C', 'tempC')}{row('Methane', 'methanePpb', 'ppb', 'methanePpb')}</tbody>
      </table>
      <p className="small muted">Brackets: difference from the Sol 1 baseline.</p>
    </section>
  );
}

// 5. Map: the trough polygon as a decorative hatched zone, and the soft last 0.5 km of the road.
function MapExtras({ fs, bx, by, sx, sy, day }) {
  // same along-path fraction the rover marker uses
  const f = 1 - ZONE_KM / day.pathKm, zx = bx + (sx - bx) * f, zy = by + (sy - by) * f;
  const r = 1.1, poly = [0, 55, 115, 170, 235, 300].map((a, i) => { const rr = r * (i % 2 ? 0.8 : 1), t = a * Math.PI / 180; return `${(sx + 0.5 + rr * Math.cos(t)).toFixed(2)},${(sy - 0.3 + rr * Math.sin(t)).toFixed(2)}`; }).join(' ');
  return <>
    <polygon points={poly} className="sol-zone" fill="url(#sol-hatch)" />
    <text x={sx + 0.5} y={sy - 1.6} fontSize={fs * 0.8} textAnchor="middle" className="sol-label">polygon terrain (hypothesis)</text>
    <line x1={zx} y1={zy} x2={sx} y2={sy} className="sol-route is-soft" />
    <text x={zx} y={zy + fs * 1.3} fontSize={fs * 0.75} className="sol-label">soft floor, last {ZONE_KM} km</text>
  </>;
}

const day = ARES.registerDay(2, {
  siteName: 'Site 2', risk: 'low-moderate risk', riskLevel: 'moderate',
  site: { lat: 28.459, lon: 319.959 }, straightKm: 10, pathKm: 12.0, bearing: 80, driveMin: 90,
  terrain: 'Giant-polygon troughs with a thin dusty cover over cemented or ice-poor sediment; soft trough floors, mild entrapment risk.',
  netWorkMin: 195, scienceMin: 160, endSoc: 68,
  phases: `
07:30-09:00 | drive_out | - | C drives; D nav/comms/health; A+B review Sol 1 results and trough hazard map.
09:00-09:20 | setup | - | A+C anchor lines and rim markers, probe trafficability of trough floor; B+D unpack TLS, thermal camera, probes, drone.
09:20-10:25 | science | A+B | A thermal imaging of trough walls, soil-moisture/permittivity probes on the floor; B tunable-laser-spectrometer methane sampling on trough floor, wall-scrape samples. Inside: C stage drone and battery-swap kit; D vitals, comms, monitors TLS stream.
10:25-10:40 | break | - | Break 1.
10:40-11:45 | science | C+D | C soil columns at trough centre and at polygon plateau, tether and anchor safety; D first nanodrone descent mapping temperature, humidity and light. Inside: A thermal and permittivity interpretation; B ATP/lipid assay and microscopy of wall scrapes.
11:45-12:00 | break | - | Break 2.
12:00-12:30 | science | A+B | A second TLS reading on the polygon plateau for comparison; B collects a wall sample at the drone-flagged depth. Inside: C drone data recovery and battery swap; D health check and relay.
12:30-12:45 | closeout | - | Seal samples, tool count, rim check, photos.
12:45-14:15 | drive_back | - | A drives, C co-driver; B stow samples; D comms/health.
14:15-14:30 | reserve | - | Dock, recharge, debrief.`,
  experiments: [
    { name: 'Thermal imaging of trough walls', who: 'A' },
    { name: 'Soil-moisture/permittivity probes', who: 'A' },
    { name: 'TLS methane sampling, floor then plateau', who: 'B' },
    { name: 'Wall-scrape samples', who: 'B' },
    { name: 'Soil columns at trough centre and plateau', who: 'C' },
    { name: 'ATP/lipid assay and microscopy', who: 'B' },
  ],
  highlight: ['slip'],
  alertsAt: (rover) => (inZone(day, rover) && rover.moving ? ['Soft trough floor: mild entrapment risk. Slow down and watch wheel slip.'] : []),
  Features, MapExtras,
});
day.slipAt = slipAt(day);
