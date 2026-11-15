// Sol 7: buffer / contingency day. Plan A (nominal) at base; Plan B repeats a site by borrowing that sol's registered plan.
import { useState } from 'react';
import { ARES, useSolState, socAt, fmtMin } from './sols.js';
import { ReturnCard, saveFile } from './solkit.jsx';

const SITE_SOL = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 6 }; // Site N was visited on this sol

const completion = (n, d = ARES.getDay(n)) => { if (!d?.experiments.length) return null; const c = ARES.get(n, 'experiments', {}); return d.experiments.filter((e) => c[e.name]).length / d.experiments.length; };
// Default Plan B site: Site 5 if Sol 6 was aborted, else the site with the lowest completion (ties go to the later site).
function suggestSite() {
  if (ARES.get(6, 'aborted', null)) return { site: 5, why: 'Sol 6 was aborted' };
  const c = Object.entries(SITE_SOL).filter(([, n]) => ARES.getDay(n)).map(([s, n]) => [+s, completion(n) ?? 0]);
  const [site, pct] = c.reduce((a, b) => (b[1] <= a[1] ? b : a));
  return { site, why: `lowest completion (${Math.round(pct * 100)}%)` };
}
const planBSite = () => ARES.get(7, 'site', null) ?? suggestSite().site;

function Features(p) {
  return <>
    <PlanSwitch {...p} />
    {p.day.kind !== 'buffer' && <ReturnCard day={p.day} t={p.t} />}
    <Departure />
    <Manifest />
    <Dashboard />
  </>;
}

// 1. Plan A / Plan B with a confirmation before starting an EVA day.
function PlanSwitch({ day }) {
  const [plan, setPlan] = useSolState(7, 'plan', 'A'), [site, setSite] = useSolState(7, 'site', null), [ask, setAsk] = useState(false);
  const sug = suggestSite(), cur = site ?? sug.site, src = SITE_SOL[cur], six = ARES.getDay(6);
  return <>
    {plan === 'B' && <p className="sol-banner" role="status">Contingency Sol: repeat of Site {cur} (Sol {src}'s plan)</p>}
    <section className="sol-card" aria-labelledby="pl-h">
      <h2 id="pl-h" className="sol-h2">Plan</h2>
      <div className="seg" role="group" aria-label="Sol 7 plan">
        <button className="tab" aria-pressed={plan === 'A'} onClick={() => { setPlan('A'); setAsk(false); ARES.logEvent(7, 'plan', 'Sol 7 set to Plan A (nominal)'); }}>Plan A: nominal</button>
        <button className="tab" aria-pressed={plan === 'B'} onClick={() => plan !== 'B' && setAsk(true)}>Plan B: repeat a site</button>
      </div>
      <label className="field small">Site to repeat
        <select value={cur} onChange={(e) => setSite(+e.target.value)}>
          {Object.entries(SITE_SOL).map(([s, n]) => <option key={s} value={s} disabled={!ARES.getDay(n)}>Site {s} (Sol {n}, {Math.round((completion(n) ?? 0) * 100)}% done){+s === sug.site ? ' · suggested' : ''}</option>)}
        </select>
      </label>
      <p className="small muted">Suggested: Site {sug.site}, {sug.why}.{site != null && site !== sug.site ? ' You picked another site.' : ''}</p>
      {ask && <div className="warn small" role="alertdialog" aria-label="Confirm Plan B">
        <p><strong>Switching to Plan B starts an EVA day; battery must be 100%.</strong> {six ? `Sol 6 is planned to end at about ${six.endSoc}% and no overnight charge is modelled: check the charge first.` : ''}</p>
        <div className="row">
          <button className="btn btn-primary btn-s" onClick={() => { setPlan('B'); setAsk(false); ARES.logEvent(7, 'plan', `Sol 7 set to Plan B: repeat Site ${cur}`); }}>Start Plan B</button>
          <button className="btn btn-s" onClick={() => setAsk(false)}>Cancel</button>
        </div>
      </div>}
      {plan === 'B' && day.carried && <p className="small">Priority list: {day.carried.length ? `${day.carried.length} experiment${day.carried.length > 1 ? 's' : ''} Sol ${src} left incomplete, listed below.` : `Sol ${src} logged every experiment done; its full list is below.`}</p>}
    </section>
  </>;
}

// 4. Departure Go/No-Go.
const DEP = [['sealed', 'All samples sealed'], ['decon', 'Decontamination complete'], ['archived', 'Data archived'], ['ascent', 'Ascent-vehicle checks']];
function Departure() {
  const [c, setC] = useSolState(7, 'departure', {}), go = DEP.every(([k]) => c[k]);
  const m = ARES.get(7, 'manifest', []), open = m.filter((x) => x.cold !== 'sealed, cold').length;
  return (
    <section className="sol-card" aria-labelledby="dp-h">
      <h2 id="dp-h" className="sol-h2">Departure Go/No-Go</h2>
      <ul className="sol-checks sol-cols">
        {DEP.map(([k, name]) => <li key={k}><label><input type="checkbox" checked={!!c[k]} onChange={(e) => setC((x) => ({ ...x, [k]: e.target.checked }))} /> {name}</label></li>)}
      </ul>
      <p className={'sol-go ' + (go ? 'is-go' : 'is-nogo')} role="status">{go ? 'GO' : 'NO-GO'}</p>
      {c.sealed && open > 0 && <p className="warn small">"All samples sealed" is ticked but {open} manifest row{open > 1 ? 's are' : ' is'} not "sealed, cold".</p>}
    </section>
  );
}

// 3. Return-sample manifest, pulled from the Sol 4 inventory (and Sol 6's collected queue), editable, CSV export.
const COLD = ['not checked', 'sealed, cold', 'sealed, warm', 'breach'], COLS = [['id', 'ID'], ['site', 'Site'], ['depth', 'Depth'], ['type', 'Type'], ['container', 'Container']];
function Manifest() {
  const [rows, setRows] = useSolState(7, 'manifest', []);
  const put = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const pull = () => setRows((r) => {
    const inv = ARES.get(4, 'inventory', []).map((x) => ({ id: x.id, site: x.site, depth: x.depth, type: x.type }));
    const q6 = (ARES.get(6, 'queue', null) ?? []).filter((x) => x.status !== 'planned').map((x) => ({ id: `S5-${x.id}`, site: 'Site 5', depth: '', type: x.name }));
    return [...r, ...[...inv, ...q6].filter((x) => x.id && !r.some((y) => y.id === x.id)).map((x) => ({ ...x, container: '', cold: 'not checked' }))];
  });
  const csv = () => saveFile('ares-return-manifest.csv', [[...COLS.map(([, h]) => h), 'Cold-chain status'], ...rows.map((x) => [...COLS.map(([k]) => x[k]), x.cold])]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n'), 'text/csv');
  return (
    <section className="sol-card" aria-labelledby="mf-h">
      <h2 id="mf-h" className="sol-h2">Return-sample manifest <span className="small muted">{rows.length} samples</span></h2>
      <div className="sol-scroll">
        <table className="sol-table">
          <thead><tr>{COLS.map(([k, h]) => <th key={k} scope="col">{h}</th>)}<th scope="col">Cold chain</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={i}>
                {COLS.map(([k, h]) => <td key={k}><input value={x[k] ?? ''} aria-label={`${h}, row ${i + 1}`} onChange={(e) => put(i, k, e.target.value)} /></td>)}
                <td><select value={x.cold} aria-label={`Cold chain, row ${i + 1}`} onChange={(e) => put(i, 'cold', e.target.value)}>{COLD.map((s) => <option key={s}>{s}</option>)}</select></td>
                <td><button className="btn btn-s" aria-label={`Remove ${x.id || `row ${i + 1}`}`} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="small muted">Empty. Pull the Sol 4 inventory or add rows.</p>}
      <div className="row">
        <button className="btn btn-s" onClick={pull}>Pull from the Sol 4 inventory</button>
        <button className="btn btn-s" onClick={() => setRows((r) => [...r, { id: '', site: '', depth: '', type: '', container: '', cold: 'not checked' }])}>Add a row</button>
        <button className="btn btn-s" disabled={!rows.length} onClick={csv}>Export CSV</button>
      </div>
    </section>
  );
}

// 2. Mission completion dashboard. EVA minutes, km and battery come from the phase plans (planned, not measured).
function stats() {
  const days = ARES.days().filter((d) => d.n !== 7), b = ARES.get(7, 'plan', 'A') === 'B' ? ARES.getDay(7).resolve() : null;
  const all = b ? [...days, b] : days, eva = {}, rows = ARES.get(7, 'manifest', []), src = rows.length ? rows : ARES.get(4, 'inventory', []);
  for (const d of all) for (const p of d.phases) if (p.pair) for (const m of p.pair.split('+')) eva[m] = (eva[m] ?? 0) + p.t1 - p.t0;
  const perSite = {}; for (const x of src) { const k = x.site || 'site not set'; perSite[k] = (perSite[k] ?? 0) + 1; }
  return {
    sols: all.map((d) => ({ sol: d.n, site: d.siteName, completionPct: completion(d.n, d) == null ? null : Math.round(completion(d.n, d) * 100), aborted: !!ARES.get(d.n, 'aborted', null),
      kmDriven: d.kind === 'buffer' ? 0 : +(2 * d.pathKm).toFixed(1), batteryUsedPct: d.kind === 'buffer' ? null : Math.round(100 - socAt(d, d.phases.find((p) => p.type === 'drive_back').t1)) })),
    samplesPerSite: perSite, samplesFrom: rows.length ? 'Sol 7 manifest' : 'Sol 4 inventory', evaMinutes: eva,
    totalKm: +all.reduce((s, d) => s + (d.kind === 'buffer' ? 0 : 2 * d.pathKm), 0).toFixed(1), events: ARES.events(), exportedAt: new Date().toISOString(),
  };
}
function Dashboard() {
  const s = stats(), ev = s.events.filter((e) => e.kind === 'abort' || e.kind === 'detection' || e.kind === 'incident');
  const print = () => { const done = () => { document.body.classList.remove('sol-printing'); window.removeEventListener('afterprint', done); }; document.body.classList.add('sol-printing'); window.addEventListener('afterprint', done); window.print(); };
  return (
    <section className="sol-card sol-print-target" aria-labelledby="db-h">
      <h2 id="db-h" className="sol-h2">Mission completion <span className="small muted">planned figures from the phase tables, checklists from this device</span></h2>
      <div className="sol-scroll">
        <table className="sol-table">
          <thead><tr><th scope="col">Sol</th><th scope="col">Site</th><th scope="col">Done</th><th scope="col">km</th><th scope="col">Battery used</th></tr></thead>
          <tbody>{s.sols.map((d) => <tr key={d.sol}><td>{d.sol}</td><td>{d.site}{d.aborted ? ' (aborted)' : ''}</td><td className="num">{d.completionPct == null ? '—' : `${d.completionPct}%`}</td><td className="num">{d.kmDriven}</td><td className="num">{d.batteryUsedPct == null ? 'charging / none' : `${d.batteryUsedPct}%`}</td></tr>)}</tbody>
        </table>
      </div>
      <dl className="sol-dl">
        <div><dt>Total driven</dt><dd className="num">{s.totalKm} km (planned paths, both ways)</dd></div>
        <div><dt>Samples per site</dt><dd className="num">{Object.keys(s.samplesPerSite).length ? Object.entries(s.samplesPerSite).map(([k, v]) => `${k}: ${v}`).join('; ') : 'none logged'} ({s.samplesFrom})</dd></div>
        <div><dt>EVA minutes</dt><dd className="num">{Object.entries(s.evaMinutes).sort().map(([k, v]) => `${k} ${v}`).join(', ')} (planned)</dd></div>
      </dl>
      <h3 className="small">Incidents and aborts ({ev.length})</h3>
      {ev.length ? <ul className="small">{ev.map((e, i) => <li key={i}>Sol {e.sol}{e.lmst ? ` ${e.lmst}` : ''}: {e.text}</li>)}</ul> : <p className="small muted">None logged.</p>}
      <div className="row">
        <button className="btn btn-s" onClick={() => saveFile('ares-mission-summary.json', JSON.stringify(stats(), null, 2), 'application/json')}>Export JSON</button>
        <button className="btn btn-s" onClick={print}>Print</button>
      </div>
    </section>
  );
}

const day = ARES.registerDay(7, {
  kind: 'buffer', siteName: 'Base', risk: 'buffer / contingency', riskLevel: 'low', badges: ['Plan A: nominal'],
  purpose: 'Final sample triage, decontamination and departure preparation; or Plan B, repeat a site.',
  mapPadKm: 1.2, startSoc: 100,
  phases: `
07:30-08:00 | admin | - | D health, radiation dose and consumables audit; C rover and suit inspection.
08:00-10:30 | lab | - | A+B final sample triage, sealing and cold-storage inventory; C rover and drill decontamination and maintenance; D data archive and uplink.
10:30-10:45 | break | - | Break 1.
10:45-12:30 | admin | - | Planetary-protection decontamination (drills, drones, suits), instrument stowage and inventory, all crew.
12:30-12:45 | break | - | Break 2.
12:45-14:15 | admin | - | Departure preparation, final report, ascent-vehicle checks, return-sample manifest.
14:15-14:30 | reserve | - | Final debrief and mission close-out.`,
  experiments: [],
  Features,
});
// Plan B: copy the chosen sol's registered day (phases, rover, battery, map) under Sol 7; checklists stay Sol 7's own.
day.resolve = () => {
  if (ARES.get(7, 'plan', 'A') !== 'B') return day;
  const src = ARES.getDay(SITE_SOL[planBSite()]); if (!src) return day;
  const done = ARES.get(src.n, 'experiments', {}), carried = src.experiments.filter((e) => !done[e.name]);
  return { ...src, n: 7, Features, socAdjust: undefined, resolve: undefined, carried, experiments: carried.length ? carried : src.experiments,
    badges: [...(src.badges ?? []), `Contingency: repeat of Sol ${src.n}`] };
};
if (import.meta.env?.DEV) console.assert(fmtMin(day.phases[0].t0) === '07:30' && day.phases.length === 7, 'sol7 phases');
