import { useEffect, useState } from 'react';
import { can } from './roles.js';
import { CLASSES } from './terrain.js';
import { SOURCES, PLACEHOLDERS, EVA_H, fmtH, HAB, CRACK_COLORS, fmtClock, download, bearing } from './mission.js';

function Source({ k }) {
  const s = SOURCES[k];
  return (
    <details className="source">
      <summary>Source</summary>
      <dl>
        <dt>Product</dt><dd>{s.product}</dd>
        {s.res && <><dt>Resolution</dt><dd>{s.res}</dd></>}
        {s.date && <><dt>Date</dt><dd>{s.date}</dd></>}
        {s.crs && <><dt>Placement</dt><dd>{s.crs}</dd></>}
        <dt>Credit</dt><dd>{s.credit}</dd>
      </dl>
      {s.note && <p className="note">{s.note}</p>}
      {s.url && <a href={s.url} target="_blank" rel="noreferrer">{s.url.replace('https://', '')}</a>}
    </details>
  );
}

function Toggle({ id, label, layers, setLayers, locked, children, src }) {
  return (
    <div className="layer">
      <label className="check">
        <input type="checkbox" checked={locked || !!layers[id]} disabled={locked} onChange={(e) => setLayers((l) => ({ ...l, [id]: e.target.checked }))} />
        <span>{label}</span>{locked && <span className="muted small">always on in Field</span>}
      </label>
      {children}
      {src && <Source k={src} />}
    </div>
  );
}

export function LayerPanel({ base, setBase, layers, setLayers, ve, setVe, limits, setLimits, layersFull, setLayersFull }) {
  const bases = [['ctx', 'CTX image, ~20 m (shrunk from 6 m)'], ['themis_day', 'THEMIS day IR, 100 m'], ['themis_night', 'THEMIS night IR, 100 m'], ['relief', 'Shaded relief, 200 m']];
  const t = { layers, setLayers };
  useEffect(() => { if (!layersFull) return; const k = (e) => e.key === 'Escape' && setLayersFull(false); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [layersFull, setLayersFull]);
  return (
    <div className="stack">
      <button className="btn layers-full-btn" aria-pressed={layersFull} onClick={() => setLayersFull((f) => !f)}>{layersFull ? 'Close full screen' : 'Open layers full screen'}</button>
      <section>
        <h2>Base image</h2>
        <div role="radiogroup" aria-label="Base image" className="stack-s">
          {bases.map(([k, l]) => (
            <div className="layer" key={k}>
              <label className="check"><input type="radio" name="base" checked={base === k} onChange={() => setBase(k)} /><span>{l}</span></label>
              {base === k && <Source k={k} />}
            </div>
          ))}
        </div>
        <Toggle id="hirise" label="HiRISE strips, 0.5 m" src="hirise" {...t} />
        <label className="field">Height exaggeration <span className="num">×{ve}</span>
          <input type="range" min="1" max="6" step="0.5" value={ve} onChange={(e) => setVe(+e.target.value)} />
        </label>
      </section>
      <section>
        <h2>What we know</h2>
        <Toggle id="coverage" label="Coverage: unseen ground hatched" src="coverage" {...t} />
        <Toggle id="cracks" label="Traced cracks" {...t} />
        <Toggle id="stations" label="Stations" {...t} />
        <Toggle id="terrain" label="Terrain classes (estimated)" src="terrain" {...t}>
          <div className="legend">{CLASSES.filter((c) => c.rgb).map((c) => <span key={c.id}><i style={{ background: `rgb(${c.rgb})` }} /> {c.name} </span>)}</div>
        </Toggle>
      </section>
      <section>
        <h2>Safety</h2>
        <Toggle id="slope" label="Slope classes" src="slope" {...t}>
          <div className="legend"><i style={{ background: 'var(--color-caution)' }} /> over {limits.walk}°, no walking <i style={{ background: 'var(--color-danger)' }} /> over {limits.rover}°, no rover</div>
          <label className="field small">Walk limit <span className="num">{limits.walk}°</span>
            <input type="range" min="5" max="30" value={limits.walk} onChange={(e) => setLimits((l) => ({ ...l, walk: +e.target.value, rover: Math.max(l.rover, +e.target.value) }))} /></label>
          <label className="field small">Rover limit <span className="num">{limits.rover}°</span>
            <input type="range" min="5" max="35" value={limits.rover} onChange={(e) => setLimits((l) => ({ ...l, rover: Math.max(+e.target.value, l.walk) }))} /></label>
          <p className="note">Both limits are placeholders until the team sets them (question L3).</p>
        </Toggle>
        <Toggle id="robot" label="Robot-only zone" src="robot" {...t} />
        <Toggle id="radio" label="Radio shadow" src="radio" {...t} />
      </section>
      <section>
        <h2>Time</h2>
        <Toggle id="route" label="Planned route (rover path)" {...t} />
      </section>
    </div>
  );
}

function Cracks({ cracks, setCracks, tracing, setTracing, user, audit, setDescentPick }) {
  const [conf, setConf] = useState('possible');
  const finish = () => {
    const c0 = user.human ? conf : 'proposed'; // agent and model output stays proposed until a crew member reviews it
    if (tracing.pts.length > 1) { audit(`traced crack (${c0})`); setCracks((c) => [...c, { id: Date.now().toString(36), conf: c0, by: user.id, pts: tracing.pts, date: new Date().toLocaleDateString('en-CA') }]); }
    setTracing(null);
  };
  const geojson = () => download('data:application/geo+json,' + encodeURIComponent(JSON.stringify({
    type: 'FeatureCollection', features: cracks.map((c) => ({ type: 'Feature', properties: { id: c.id, confidence: c.conf, traced: c.date, crs: 'Mars 2000 sphere, planetocentric, east-positive' }, geometry: { type: 'LineString', coordinates: c.pts } })),
  })), 'ares-cracks.geojson');
  return (
    <section className="stack-s">
      <h2>Cracks</h2>
      {tracing ? (
        <div className="row">
          {!user.human && <span className="small muted">Saved as proposed</span>}{user.human && <select value={conf} onChange={(e) => setConf(e.target.value)} aria-label="Confidence"><option value="confirmed">Confirmed</option><option value="possible">Possible</option><option value="rejected">Rejected (wind groove)</option></select>}
          <button className="btn btn-primary" onClick={finish} disabled={tracing.pts.length < 2}>Save line</button>
          <button className="btn" onClick={() => setTracing(null)}>Cancel</button>
        </div>
      ) : cracks.length === 0 ? (
        <p className="empty">No cracks traced yet. The trough band is marked from a CTX reading, not traced. Turn on HiRISE, zoom in, then trace each line you can see.</p>
      ) : (
        <ul className="list">
          {cracks.map((c) => (
            <li key={c.id}><i style={{ background: CRACK_COLORS[c.conf] }} /> {c.conf} · {c.pts.length} points · {c.date}
              {c.conf === 'proposed' && can(user, 'confirm-crack') && <>
                <button className="btn" onClick={() => { audit(`accepted crack ${c.id} as possible`); setCracks((all) => all.map((x) => (x.id === c.id ? { ...x, conf: 'possible', reviewed_by: user.id } : x))); }}>Accept</button>
                <button className="btn" onClick={() => { audit(`rejected proposed crack ${c.id}`); setCracks((all) => all.map((x) => (x.id === c.id ? { ...x, conf: 'rejected', reviewed_by: user.id } : x))); }}>Reject</button></>}
              {c.conf !== 'rejected' && c.conf !== 'proposed' && can(user, 'clear-descent') && (c.examined
                ? <button className="btn" onClick={() => setDescentPick(c.id)}>{c.descent ? 'Move descent spot' : 'Clear a descent spot'}</button>
                : <button className="btn" onClick={() => { audit(`marked crack ${c.id} examined by robot`); setCracks((all) => all.map((x) => (x.id === c.id ? { ...x, examined: { by: user.id, at: new Date().toISOString() } } : x))); }}>Mark examined by robot</button>)}
              {c.examined && <span className="small muted"> · examined</span>}{c.descent && <span className="small"> · descent spot cleared by {c.descent.by}</span>}
              <button className="icon" aria-label="Delete line" onClick={() => { audit(`deleted crack ${c.id}`); setCracks((all) => all.filter((x) => x.id !== c.id)); }}>×</button></li>
          ))}
        </ul>
      )}
      <p className="note">Inside a crack is robot-only. The crew may go down only at a spot a crew member clears after the robot has examined that crack (green ring). A crack may be a COSPAR Special Region (verify): crew entry also needs planetary-protection sign-off.</p>
      {!tracing && <div className="row"><button className="btn" onClick={() => setTracing({ pts: [] })}>Trace a crack</button>{cracks.length > 0 && <button className="btn" onClick={geojson}>Export GeoJSON</button>}</div>}
    </section>
  );
}

// Overview: the base, the five sol sites and the route to each. One site per day, back to base every day; Sol 4 and Sol 7 stay at base.
export function OverviewPanel(p) {
  const { stations, plan, setPlan, siteRoutes, habXZ, flyTo, setSel, sel } = p;
  const ll = (lat, lon) => `${lat.toFixed(3)}° N, ${lon.toFixed(3)}° E`;
  return (
    <div className="stack">
      <section className="stack-s">
        <h2>Mission overview</h2>
        <p className="small">Five sites in five sols, lowest risk first. The rover goes from base to one site, works, and is back the same day ({plan.start} start, {EVA_H} h window). Sol 4 and Sol 7 are buffer days at base.</p>
        <div className="seg" role="radiogroup" aria-label="Rover speed">
          {PLACEHOLDERS.speeds.map((s) => <button key={s} className="tab" aria-pressed={plan.speed === s} onClick={() => setPlan((q) => ({ ...q, speed: s }))}>{s} km/h</button>)}
        </div>
        <p className="note">Drive times come from the sol briefs, worked at 8 km/h, and scale with this speed: faster driving leaves more time at the site.</p>
      </section>
      <table className="table num ov-table">
        <thead><tr><th>Sol</th><th>Place</th><th>From base</th><th>Drive each way</th><th>At site</th></tr></thead>
        <tbody>
          <tr><td>–</td><td><strong>Base</strong><br /><span className="small muted">{ll(HAB.lat, HAB.lon)}</span></td><td>–</td><td>–</td><td>–</td></tr>
          {stations.map((s, i) => (
            <tr key={s.id} aria-selected={sel === s.id} className="ov-row" tabIndex={0} onClick={() => { setSel(s.id); flyTo(s.xz); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(s.id); flyTo(s.xz); } }}>
              <td>{s.sol}</td>
              <td><strong>{s.id} · Site {i + 1}</strong> <span className={'badge risk-' + s.riskLevel}>{s.risk}</span><br /><span className="small muted">{ll(s.lat, s.lon)} · {s.name}</span></td>
              <td>{s.distKm.toFixed(1)} km straight, {Math.round(bearing(habXZ, s.xz))}°<br /><span className="small muted">route {siteRoutes[i].km.toFixed(1)} km</span></td>
              <td>{fmtH(s.driveH)}</td>
              <td className={s.work <= 0 ? 'bad' : ''}>{s.work <= 0 ? 'does not fit' : fmtH(s.work / 60)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">Sites and times: the sol briefs. Route lines: the travel-time planner on the 200 m elevation model and terrain classes, so they bend round slopes and rough ground (placeholder speeds, verify). Tap a row to fly there.</p>
      <details className="more"><summary>Traced cracks</summary><Cracks {...p} /></details>
    </div>
  );
}

export function PrintSheets({ rig, topDown, routeStops, timeline, plan, reach, walk, limits, stations, surface, habXZ, planner, ground }) {
  const [shot, setShot] = useState(null);
  const labels = [{ text: 'H', xz: habXZ }, ...stations.map((s) => ({ text: s.id, xz: s.xz }))].map((l) => ({ text: l.text, xyz: [l.xz[0], surface.y(l.xz[0], l.xz[1]), l.xz[1]] }));
  const snap = () => setShot(rig.current?.capture(labels));
  useEffect(() => { topDown(); const t = setTimeout(snap, 600); return () => clearTimeout(t); }, [rig, topDown]); // eslint-disable-line react-hooks/exhaustive-deps
  const arrive = timeline.legs.filter((l) => l.kind === 'work');
  const budget = EVA_H - plan.reserveH;
  return (
    <div className="sheets stack">
      <div className="row no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>Print or save PDF</button>
        <button className="btn" onClick={snap}>Recapture map</button>
      </div>
      <article className="sheet">
        <h1>A.R.E.S. EVA sheet 1 · Overview</h1>
        <p className="small">Chryse crater site. Habitat 28.43° N, 319.77° E. North up, 31.5 × 31.0 km. Mars 2000 sphere.</p>
        {shot ? <img src={shot} alt="Top-down map of the site with the routes and stations" /> : <div className="skeleton-map" aria-busy="true" />}
        <dl className="kv small num">
          <dt>Reach area</dt><dd>up to {reach.toFixed(1)} km at {plan.speed} km/h (travel time)</dd>
          <dt>Walk-back area</dt><dd>up to {walk.toFixed(1)} km</dd>
          <dt>Slope</dt><dd>amber over {limits.walk}°, red over {limits.rover}° (200 m DEM)</dd>
          <dt>Hatched</dt><dd>no image better than ~6 m</dd>
        </dl>
      </article>
      <article className="sheet">
        <h1>Sheet 2 · Route and turn-back times</h1>
        <table className="table num">
          <thead><tr><th>Stop</th><th>Goal</th><th>Arrive</th><th>Work</th><th>Leave by</th></tr></thead>
          <tbody>{routeStops.map((s, i) => (
            <tr key={s.id}><td>{s.id} {s.name}</td><td className="small">{s.goal}</td><td>{fmtClock(plan.start, arrive[i].t0)}</td><td>{s.work} min</td><td>{fmtClock(plan.start, budget - planner.roverHome(s.xz))}</td></tr>
          ))}</tbody>
        </table>
        <dl className="kv small num">
          <dt>Back at the habitat</dt><dd>{fmtClock(plan.start, timeline.totalH)} expected · {fmtClock(plan.start, ground.badH)} if the ground is bad</dd>
          <dt>Rover energy</dt><dd>{ground.kwh.toFixed(1)} kWh on the planner's path (placeholder rates)</dd>
          <dt>Radio shadow</dt><dd>{ground.shadowH > 0 ? `about ${Math.round(ground.shadowH * 60)} min out of line of sight` : 'none: line of sight all the way'}</dd>
          <dt>Hard limit</dt><dd>{fmtClock(plan.start, EVA_H)}, reserve {plan.reserveH} h</dd>
          <dt>Rover fails</dt><dd>beyond {walk.toFixed(1)} km, call the second rover</dd>
        </dl>
      </article>
      <article className="sheet">
        <h1>Sheet 3 · Sources</h1>
        <ul className="list small">{Object.entries(SOURCES).map(([k, s]) => <li key={k}><strong>{s.title}.</strong> {s.product}. {s.res} {s.credit}.{s.note ? ' ' + s.note : ''}</li>)}</ul>
        <p className="small">Stations: {stations.map((s) => `${s.id} ${s.lat.toFixed(3)}° N ${s.lon.toFixed(3)}° E`).join('; ')}.</p>
      </article>
    </div>
  );
}
