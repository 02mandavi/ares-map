import { useState } from 'react';
import { PLACEHOLDERS, EVA_H, fmtH, download, fmtClock } from './mission.js';
import { PEOPLE, person, can } from './roles.js';
import { assess, PAD, RATES } from './vitals.js';
import { RANGES, level, EVA_PAIR, MODE_GUIDE } from './monitor.js';
import { CAD } from './RoverCad.jsx';

const today = () => new Date().toLocaleDateString('en-CA');
const LEVEL = { ok: 'OK', watch: 'Watch', bad: 'Act now' };
const SOURCE = { placeholder: 'placeholder', measured: 'measured', estimated: 'estimated', simulated: 'simulated', proposed: 'proposed' };
const fmtDays = (d) => (d === Infinity ? 'no drain' : `${d.toFixed(d < 10 ? 1 : 0)} sols`);
const jsonl = (rows) => 'data:application/x-ndjson,' + encodeURIComponent(rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

function Tabs({ tabs, value, onChange, label }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {tabs.map(([k, l]) => <button key={k} role="tab" className="tab" aria-selected={value === k} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

export function UserPicker({ userId, setUserId }) {
  return (
    <label className="user">
      <span className="visually-hidden">Signed in as</span>
      <select value={userId} onChange={(e) => setUserId(e.target.value)}>
        {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
      </select>
    </label>
  );
}

// One row per task: time, what, who. Your own rows stand out.
export function TaskRows({ rows, plan, user }) {
  return (
    <ol className="task-rows">
      {rows.map((x) => (
        <li key={x.task} className={x.state + (x.who === user.id ? ' is-mine' : '')}>
          {plan && <span className="num tr-time">{fmtClock(plan.start, x.t0)}</span>}
          <span className="tr-task">{x.task}</span>
          {x.who && <span className="tr-who">{x.who === user.id ? 'You' : person(x.who).role}</span>}
        </li>
      ))}
    </ol>
  );
}

// ---------- Objective card (replaces the plain station card)
export function ObjectiveCard({ s, user, plan, setPlan, flyTo, crewView, habXZ, stations, accessOf, planner, objectives, setObjectives, outcomes, setOutcomes, decisions, notes, audit }) {
  const [tab, setTab] = useState('overview');
  const [closing, setClosing] = useState(null);
  const inRoute = plan.route.includes(s.id), done = objectives[s.id]?.done;
  const target = stations.find((o) => o.id === (s.id === 'S4' ? 'S2' : 'S4')) ?? s;
  const a = accessOf(s.xz), out = planner.leg('rover', habXZ, s.xz), back = planner.leg('rover', s.xz, habXZ), driveH = out.hours;
  const visitH = out.hours + back.hours + s.work / 60, km = out.km + back.km;
  const hist = outcomes.filter((o) => o.decision_id === 'obj-' + s.id || decisions.some((d) => d.id === o.decision_id && d.poi === s.id));
  const finish = () => {
    const o = { decision_id: 'obj-' + s.id, date: today(), what_happened: closing.text, correct: closing.correct, missed: closing.missed, by: user.id };
    setOutcomes((all) => [...all, o]); setObjectives((ob) => ({ ...ob, [s.id]: { done: true, at: today(), by: user.id } }));
    audit(`completed objective ${s.id} (${closing.correct})`); setClosing(null);
  };
  return (
    <section className="card stack-s" aria-label={`Objective ${s.id}`}>
      <h2 className="title-serif"><span className="num">{s.id}</span>{s.name}{done && <span className="badge">done</span>}</h2>
      <p className="small muted">{s.type} · {s.status}</p>
      <Tabs label="Objective detail" value={tab} onChange={setTab} tabs={[['overview', 'Overview'], ['evidence', 'Evidence'], ['access', 'Access'], ['history', 'History']]} />
      {tab === 'overview' && (
        <div className="stack-s">
          <p className="small">{s.goal}</p>
          {s.tasks && <TaskRows rows={s.tasks.map((task, i) => ({ task, who: s.who?.[i] }))} user={user} />}
          <div className={'rec rec-' + s.rec.action}><strong>Recommend: {s.rec.action}.</strong> {s.rec.why}</div>
          <details className="more"><summary>The science question</summary><p className="small">{s.question}</p><p className="note">Recommendation from orbital data only (T9): unknown at wheel scale.</p></details>
        </div>
      )}
      {tab === 'evidence' && (
        <div className="stack-s small">
          <h3>Competing readings</h3><ul className="bullets">{s.interpretations.map((t) => <li key={t}>{t}</li>)}</ul>
          <h3>Seen</h3><ul className="bullets">{s.evidence.map((t) => <li key={t}>{t}</li>)}</ul>
          <h3>Checked, not seen, or no data</h3><ul className="bullets">{s.negative.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
      {tab === 'access' && (
        <dl className="kv num small">
          <dt>Distance</dt><dd>{s.distKm.toFixed(1)} km straight{out.blocked || back.blocked ? ': no rover route found' : `, ${fmtH(driveH)} drive out, ${fmtH(back.hours)} back`}</dd>
          <dt>Reach</dt><dd>{planner.inWalkBack(s.xz, plan.workH, EVA_H) ? 'inside the walk-back area' : planner.inReach(s.xz, plan.workH, EVA_H - plan.reserveH) ? 'inside reach, outside walk-back: second rover is the backup' : 'outside daily reach'}</dd>
          <dt>Slope</dt><dd>{a.slope.toFixed(0)}° at 200 m{a.slope > PLACEHOLDERS.slopeRover ? ': too steep for the rover' : ''}</dd>
          <dt>Radio</dt><dd>{a.radio ? 'line of sight to the habitat' : 'in radio shadow: needs a relay'}</dd>
          <dt>Elevation</dt><dd>{Math.round(s.elev)} m</dd>
          <dt>Visit time</dt><dd>{fmtH(visitH)} of {EVA_H}:00, {km.toFixed(1)} km driven</dd>
          <dt>Rover energy</dt><dd>{(RATES.roverKwhPerKm * km).toFixed(0)} kWh (placeholder rate)</dd>
          <dt>Suit oxygen</dt><dd>{(RATES.suitO2KgPerPersonH * RATES.crewOut * visitH).toFixed(1)} kg for {RATES.crewOut} crew (placeholder rate)</dd>
        </dl>
      )}
      {tab === 'history' && (
        hist.length === 0 && !notes[s.id] ? <p className="empty small">No visits or outcomes yet.</p> : (
          <ul className="list small">
            {notes[s.id] && <li>Debrief note: {notes[s.id]}</li>}
            {hist.map((o, i) => <li key={i}>{o.date} · {person(o.by).name}: {o.what_happened} ({String(o.correct)})</li>)}
          </ul>
        )
      )}
      <label className="field small">Work time, min<input type="number" min="0" max="300" step="5" value={s.work} onChange={(e) => setPlan((p) => ({ ...p, work: { ...p.work, [s.id]: +e.target.value } }))} /></label>
      <div className="row">
        <button className="btn" onClick={() => flyTo(s.xz, 3)}>Fly to</button>
        <button className="btn" onClick={() => crewView(s.xz, ['S1', 'S2', 'S5'].includes(s.id) ? target.xz : habXZ, s.id)}>Crew view</button>
        <button className={'btn' + (inRoute ? '' : ' btn-primary')} onClick={() => setPlan((p) => ({ ...p, route: inRoute ? p.route.filter((x) => x !== s.id) : [...p.route, s.id] }))}>{inRoute ? 'Remove from route' : 'Add to route'}</button>
      </div>
      {!done && !closing && (can(user, 'complete-objective')
        ? <button className="btn" onClick={() => setClosing({ text: '', correct: 'partial', missed: '' })}>Mark done…</button>
        : <p className="note">Only crew on site can mark an objective done. {user.human ? '' : 'The autonomous account can propose it in the decision log.'}</p>)}
      {closing && (
        <div className="stack-s closing">
          <label className="field small">What happened<textarea rows="3" value={closing.text} onChange={(e) => setClosing((c) => ({ ...c, text: e.target.value }))} /></label>
          <label className="field small">Was the recommendation right?
            <select value={closing.correct} onChange={(e) => setClosing((c) => ({ ...c, correct: e.target.value }))}><option value="true">Yes</option><option value="partial">Partly</option><option value="false">No</option></select></label>
          <label className="field small">What did the map miss?<input type="text" value={closing.missed} onChange={(e) => setClosing((c) => ({ ...c, missed: e.target.value }))} /></label>
          <div className="row"><button className="btn btn-primary" disabled={!closing.text.trim()} onClick={finish}>Save outcome</button><button className="btn" onClick={() => setClosing(null)}>Cancel</button></div>
        </div>
      )}
    </section>
  );
}

// ---------- Vitals ledger
// Live readings for one place or person: value, unit, OK / Watch / Act now against the placeholder range.
function Readings({ r }) {
  return (
    <table className="table num vitals">
      <tbody>
        {Object.entries(r).map(([k, v]) => { const g = RANGES[k], lv = level(k, v); return (
          <tr key={k} className={'lv-' + lv}>
            <th scope="row">{g.name}<span className="src">{g.src}</span></th>
            <td>{v} {g.unit}</td>
            <td className="lv"><span>{LEVEL[lv]}</span></td>
          </tr>
        ); })}
      </tbody>
    </table>
  );
}

// Rover mode: Auto (the autonomous pick) or a person's override. cur = modeAt(...) from App.
export function RoverModeControl({ cur, user, setRoverMode }) {
  const ok = can(user, 'set-rover-mode');
  return (
    <div className="seg" role="group" aria-label={ok ? 'Rover mode' : 'Rover mode (crew or Mission Control can change it)'}>
      <button className="tab" aria-pressed={cur.auto} disabled={!ok} onClick={() => setRoverMode(null)}>Auto{cur.auto ? ` · ${cur.mode}` : ''}</button>
      {['A', 'B', 'C'].map((m) => <button key={m} className="tab" aria-pressed={!cur.auto && cur.mode === m} disabled={!ok} title={CAD[m].name} onClick={() => setRoverMode(m)}>{m}</button>)}
    </div>
  );
}
export const modeLine = (cur) => (cur.auto ? `Auto: ${cur.why}` : `Set by ${cur.by}${cur.autoPick.mode !== cur.mode ? `; auto would pick ${cur.autoPick.mode} (${cur.autoPick.why})` : ''}`);

export function ModeGuide({ cur }) {
  return (
    <table className="table mode-guide">
      <thead><tr><th>Mode</th><th>Suits</th><th>Slope</th></tr></thead>
      <tbody>{MODE_GUIDE.map((g) => (
        <tr key={g.mode ?? 'none'} className={g.mode && g.mode === cur.mode ? 'is-now' : ''} aria-current={g.mode && g.mode === cur.mode ? 'true' : undefined}>
          <td>{g.mode ? CAD[g.mode].name : 'No mode'}</td><td>{g.ground}</td><td className="num">{g.slope}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function Monitor({ user, monitor, storm, sim, plan, roverMode, setRoverMode }) {
  const { crew, habitat, rover } = monitor;
  const alerts = [...crew.flatMap((c) => can(user, 'see-health', c.id) ? Object.entries(c.r) : []), ...Object.entries(habitat.r), ...Object.entries(rover.r)].filter(([k, v]) => level(k, v) !== 'ok').length;
  return (
    <>
      <section className="stack-s">
        <h2 className="title-serif">Live <em>monitor</em></h2>
        <p className="num">EVA clock {fmtClock(plan.start, sim.t)} · {alerts ? <strong style={{ color: 'var(--color-danger)' }}>{alerts} reading{alerts > 1 ? 's' : ''} outside range</strong> : 'all readings in range'}</p>
        <p className="note">Simulated from the EVA clock: run the drive in Field, then come back here. No real sensors are connected. Ranges are placeholders with their source to verify.</p>
      </section>
      <div className="vitals-grid">
      <section className="stack-s">
        <h2>Crew</h2>
        {crew.map((c) => (
          <details key={c.id} className="crew-vitals" open={c.walking}>
            <summary><strong>{person(c.id).name}</strong> · {person(c.id).role} · {c.where}{c.r.suitP != null ? ' · suited' : ''}</summary>
            {can(user, 'see-health', c.id) ? <Readings r={c.r} /> : <p className="muted small">Private to this crew member and the medic. Location is shared.</p>}
          </details>
        ))}
      </section>
      <section className="stack-s">
        <h2>Habitat</h2>
        <p className="small muted">{habitat.crewIn} crew inside{habitat.crewIn ? '' : ', monitored remotely while everyone is out'}.</p>
        <Readings r={habitat.r} />
      </section>
      <section className="stack-s">
        <h2>Rover cabin · MARS-X HORIZON</h2>
        <dl className="kv num">
          <dt>Mode</dt><dd>{CAD[rover.mode].name}{storm ? ' (dust storm test on)' : ''}</dd>
          <dt>Why</dt><dd>{modeLine(roverMode)}</dd>
          <dt>Crew aboard</dt><dd>{rover.aboard} of 4</dd>
          <dt>Anchors (4)</dt><dd>{rover.anchors}</dd>
          <dt>Drill</dt><dd>{rover.drill}</dd>
          <dt>Driven</dt><dd>{rover.km} km</dd>
        </dl>
        <Readings r={rover.r} />
        <RoverModeControl cur={roverMode} user={user} setRoverMode={setRoverMode} />
        <ModeGuide cur={roverMode} />
        <p className="note">The autonomous system picks the mode from the slope and ground along the planned route: it switches to B just before slope or rock, and goes back to A only after 0.6 km of easy ground, so it does not flip back and forth. A crew member or Mission Control can override it, and every change goes in the Log. Thresholds are placeholders to check against the MARS-X spec. The Rover page shows the model in each mode.</p>
      </section>
      </div>
    </>
  );
}

export function VitalsPanel({ user, vitals, setVitals, audit, monitor, storm, sim, plan, roverMode, setRoverMode }) {
  const [tab, setTab] = useState('live');
  const edit = (id, patch) => {
    setVitals((v) => ({ ...v, rows: v.rows.map((r) => (r.id === id ? { ...r, ...patch, source: 'measured', by: user.id, at: new Date().toISOString() } : r)) }));
    audit(`updated vitals ${id}: ${JSON.stringify(patch)}`);
  };
  const editable = can(user, 'edit-vitals');
  const groups = [...new Set(vitals.rows.map((r) => r.group))];
  const counts = vitals.rows.reduce((c, r) => { const l = assess(r, vitals.daysToReturn).level; c[l] = (c[l] || 0) + 1; return c; }, {});
  const num = (r, k) => editable ? <input type="number" className="cell-input" aria-label={`${r.name} ${k}`} value={r[k]} onChange={(e) => edit(r.id, { [k]: +e.target.value })} /> : r[k];
  return (
    <div className="stack vitals-full">
      <div className="row" role="group" aria-label="Vitals view">
        <button className="tab" aria-pressed={tab === 'live'} onClick={() => setTab('live')}>Live monitor</button>
        <button className="tab" aria-pressed={tab === 'supplies'} onClick={() => setTab('supplies')}>Supplies</button>
      </div>
      {tab === 'live' ? <Monitor user={user} monitor={monitor} storm={storm} sim={sim} plan={plan} roverMode={roverMode} setRoverMode={setRoverMode} /> : <>
      <section className="stack-s">
        <h2 className="title-serif">Days <em>left</em></h2>
        <div className="stats"><div><span className="stat num" style={{ color: counts.bad ? 'var(--color-danger)' : undefined }}>{counts.bad || 0}</span><span className="muted small">act now</span></div><div><span className="stat num">{counts.watch || 0}</span><span className="muted small">watch</span></div></div>
        <label className="field small inline">Sols to resupply or return
          {editable ? <input type="number" min="0" value={vitals.daysToReturn} onChange={(e) => setVitals((v) => ({ ...v, daysToReturn: +e.target.value }))} /> : <span className="num">{vitals.daysToReturn}</span>}</label>
        <p className="note">Starting values are placeholders, not mission data. A value turns “measured” when a crew member enters it. Pessimistic = burn × {PAD} (T2).{editable ? '' : ` ${user.name} can read but not edit.`}</p>
      </section>
      <div className="vitals-grid">
      {groups.map((g) => (
        <section key={g} className="stack-s">
          <h2>{g}</h2>
          <table className="table num vitals">
            <tbody>
              {vitals.rows.filter((r) => r.group === g).map((r) => {
                if (r.kind === 'health' && !can(user, 'see-health', r.owner)) return <tr key={r.id}><th scope="row">{r.name}</th><td colSpan="2" className="muted">private to this crew member and the medic</td></tr>;
                const x = assess(r, vitals.daysToReturn);
                return (
                  <tr key={r.id} className={'lv-' + x.level}>
                    <th scope="row">{r.name}<span className={'src src-' + r.source}>{SOURCE[r.source]}{r.by ? ` · ${person(r.by).name}` : ''}</span></th>
                    <td>
                      {r.kind === 'flow' && <>{num(r, 'stock')} {r.unit}, burn {num(r, 'burn')}/sol</>}
                      {r.kind === 'balance' && <>gen {num(r, 'gen')}, load {num(r, 'load')} {r.unit}, dust {num(r, 'dust')}%</>}
                      {r.kind === 'wear' && <>{num(r, 'used')} of {r.limit} {r.unit}</>}
                      {r.kind === 'level' && <>{num(r, 'value')}{r.unit}</>}
                      {r.kind === 'status' && (editable ? <input type="text" className="cell-input wide" aria-label={r.name} value={r.value} onChange={(e) => edit(r.id, { value: e.target.value })} /> : r.value)}
                      {r.kind === 'health' && <>sleep {num(r, 'sleep')} h · {editable ? <input type="text" className="cell-input" aria-label={`${r.name} note`} value={r.value} onChange={(e) => edit(r.id, { value: e.target.value })} /> : r.value}</>}
                    </td>
                    <td className="lv">
                      <span>{LEVEL[x.level]}</span>
                      {x.nominal != null && <span className="small">{fmtDays(x.nominal)} / {fmtDays(x.pessimistic)}</span>}
                      {x.frac != null && <span className="small">{Math.round(x.frac * 100)}% of life</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
      </div>
      <div className="row">
        <button className="btn" onClick={() => download('data:application/json,' + encodeURIComponent(JSON.stringify(vitals, null, 1)), 'ares-vitals.json')}>Export ledger</button>
        <button className="btn" onClick={() => { audit('ran dust storm test: power generation −30%'); setVitals((v) => ({ ...v, rows: v.rows.map((r) => (r.kind === 'balance' ? { ...r, dust: 30, source: 'simulated', by: user.id } : r)) })); }}>Dust storm test</button>
      </div>
      </>}
      {storm && <button className="btn" onClick={() => { audit('ended dust storm test'); setVitals((v) => ({ ...v, rows: v.rows.map((r) => (r.kind === 'balance' ? { ...r, dust: 0, source: 'simulated', by: user.id } : r)) })); }}>End dust storm test</button>}
    </div>
  );
}

// ---------- Decision log, outcomes, calibration, audit
export function LogPanel({ user, decisions, setDecisions, outcomes, setOutcomes, auditLog, audit, stations }) {
  const [tab, setTab] = useState('decisions');
  const blank = { question: '', options: '', chosen: '', probability: 70, reasons: '', dissent: '', risk: 'low', poi: '' };
  const [draft, setDraft] = useState(blank);
  const [result, setResult] = useState({});
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const add = () => {
    const needsHuman = draft.risk === 'high' || !user.human;
    const d = { id: 'd' + Date.now().toString(36), date: today(), who: user.id, question: draft.question, options: draft.options.split(',').map((o) => o.trim()).filter(Boolean), chosen: draft.chosen,
      probability: +draft.probability / 100, reasons: draft.reasons, dissent: draft.dissent, risk: draft.risk, poi: draft.poi || undefined,
      status: needsHuman && !can(user, 'approve') ? 'proposed' : 'approved', approved_by: needsHuman && !can(user, 'approve') ? null : user.id };
    setDecisions((all) => [...all, d]); audit(`${d.status} decision ${d.id}: ${d.question}`); setDraft(blank);
  };
  const approve = (d) => { setDecisions((all) => all.map((x) => (x.id === d.id ? { ...x, status: 'approved', approved_by: user.id } : x))); audit(`approved decision ${d.id}`); };
  const record = (d) => {
    const r = result[d.id]; setOutcomes((all) => [...all, { decision_id: d.id, date: today(), what_happened: r.text, correct: r.correct === 'true' ? true : r.correct === 'false' ? false : 'partial', missed: r.missed || '', by: user.id }]);
    audit(`recorded outcome for ${d.id}`); setResult((x) => ({ ...x, [d.id]: undefined }));
  };
  // Calibration (T14): bucket stated probability, compare with how often it came true
  const scored = decisions.map((d) => ({ d, o: outcomes.find((o) => o.decision_id === d.id) })).filter((x) => x.o && x.o.correct !== 'partial');
  const buckets = [0.5, 0.6, 0.7, 0.8, 0.9].map((lo) => {
    const xs = scored.filter((x) => x.d.probability >= lo && x.d.probability < lo + 0.1 + (lo === 0.9 ? 0.01 : 0));
    return { lo, n: xs.length, hit: xs.filter((x) => x.o.correct === true).length };
  });
  return (
    <div className="stack">
      <Tabs label="Log" value={tab} onChange={setTab} tabs={[['decisions', 'Decisions'], ['calibration', 'Calibration'], ['audit', 'Audit']]} />
      {tab === 'decisions' && (
        <>
          <section className="stack-s">
            <h2>New decision</h2>
            <label className="field small">Question<input type="text" value={draft.question} onChange={set('question')} placeholder="Go to S4 tomorrow?" /></label>
            <label className="field small">Options, comma separated<input type="text" value={draft.options} onChange={set('options')} /></label>
            <div className="grid2">
              <label className="field small">Chosen<input type="text" value={draft.chosen} onChange={set('chosen')} /></label>
              <label className="field small">Chance it is right, %<input type="number" min="50" max="99" value={draft.probability} onChange={set('probability')} /></label>
              <label className="field small">Risk<select value={draft.risk} onChange={set('risk')}><option value="low">Low</option><option value="high">High: crew must approve</option></select></label>
              <label className="field small">Linked objective<select value={draft.poi} onChange={set('poi')}><option value="">None</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.id} {s.name}</option>)}</select></label>
            </div>
            <label className="field small">Reasons<textarea rows="2" value={draft.reasons} onChange={set('reasons')} /></label>
            <label className="field small">Dissent (who objected and why)<input type="text" value={draft.dissent} onChange={set('dissent')} /></label>
            <button className="btn btn-primary" disabled={!draft.question.trim() || !draft.chosen.trim()} onClick={add}>{user.human ? 'Record decision' : 'Propose decision'}</button>
          </section>
          <section className="stack-s">
            <h2>Log</h2>
            {decisions.length === 0 ? <p className="empty small">No decisions yet. Each one records options, a probability, the owner and any dissent (T10).</p> : (
              <ul className="list decisions">
                {[...decisions].reverse().map((d) => {
                  const o = outcomes.find((x) => x.decision_id === d.id), r = result[d.id];
                  return (
                    <li key={d.id} className="stack-s card">
                      <p><strong>{d.question}</strong> → {d.chosen} <span className="num muted">{Math.round(d.probability * 100)}%</span></p>
                      <p className="small muted">{d.date} · {person(d.who).name} · {d.risk} risk · {d.status}{d.approved_by ? ` by ${person(d.approved_by).name}` : ''}{d.dissent ? ` · dissent: ${d.dissent}` : ''}</p>
                      {d.status === 'proposed' && (can(user, 'approve') ? <button className="btn btn-primary" onClick={() => approve(d)}>Approve as {user.name}</button> : <p className="note">Waiting for a crew member to approve.</p>)}
                      {o ? <p className="small">Outcome {o.date}: {o.what_happened} ({String(o.correct)})</p> : d.status === 'approved' && (r ? (
                        <div className="stack-s">
                          <input type="text" aria-label="What happened" placeholder="What happened" value={r.text} onChange={(e) => setResult((x) => ({ ...x, [d.id]: { ...r, text: e.target.value } }))} />
                          <div className="row">
                            <select aria-label="Was it right" value={r.correct} onChange={(e) => setResult((x) => ({ ...x, [d.id]: { ...r, correct: e.target.value } }))}><option value="true">Right</option><option value="partial">Partly</option><option value="false">Wrong</option></select>
                            <button className="btn btn-primary" disabled={!r.text.trim()} onClick={() => record(d)}>Save outcome</button>
                          </div>
                        </div>
                      ) : <button className="btn" onClick={() => setResult((x) => ({ ...x, [d.id]: { text: '', correct: 'true' } }))}>Record outcome</button>)}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <div className="row">
            <button className="btn" disabled={!decisions.length} onClick={() => download(jsonl(decisions), 'decision_log.jsonl')}>Export decisions</button>
            <button className="btn" disabled={!outcomes.length} onClick={() => download(jsonl(outcomes), 'outcomes.jsonl')}>Export outcomes.jsonl</button>
          </div>
          <p className="note">Save the exports into the repo’s thinking/ folder so the next session reads them.</p>
        </>
      )}
      {tab === 'calibration' && (
        <section className="stack-s">
          <h2 className="title-serif">Do 70% calls come true <em>70% of the time?</em></h2>
          {scored.length === 0 ? <p className="empty small">No scored outcomes yet. Partly-right outcomes are left out of the score.</p> : (
            <table className="table num">
              <thead><tr><th>Stated</th><th>Decisions</th><th>Came true</th><th>Gap</th></tr></thead>
              <tbody>{buckets.filter((b) => b.n).map((b) => {
                const rate = b.hit / b.n, mid = b.lo + 0.05, gap = rate - mid;
                return <tr key={b.lo}><td>{Math.round(b.lo * 100)} to {Math.round(b.lo * 100) + 9}%</td><td>{b.n}</td><td>{Math.round(rate * 100)}%</td><td className={Math.abs(gap) > 0.15 ? 'bad' : ''}>{gap > 0 ? '+' : ''}{Math.round(gap * 100)} pts</td></tr>;
              })}</tbody>
            </table>
          )}
          <p className="note">Few decisions make a noisy score; read it after about 10 per row.</p>
        </section>
      )}
      {tab === 'audit' && (
        <section className="stack-s">
          <h2>Audit trail</h2>
          {auditLog.length === 0 ? <p className="empty small">Nothing recorded yet.</p> : (
            <ul className="list small">{[...auditLog].reverse().slice(0, 200).map((e, i) => <li key={i}><span className="num muted">{new Date(e.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> {person(e.who).name}: {e.what}</li>)}</ul>
          )}
          <button className="btn" disabled={!auditLog.length} onClick={() => download(jsonl(auditLog), 'ares-audit.jsonl')}>Export audit</button>
        </section>
      )}
    </div>
  );
}
