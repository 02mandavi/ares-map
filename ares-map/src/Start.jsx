import { useEffect, useState } from 'react';
import { EVA_H, SOURCES, DUTIES, fmtClock, tasksFor, positionAt } from './mission.js';
import { PEOPLE, can, person } from './roles.js';
import { level } from './monitor.js';
import { taskAt, stopsOf } from './Mission.jsx';

// Mars Coordinated Time and local mean solar time at the site.
// Allison & McEwen 2000 / Mars24 algorithm: MSD = (JD_TT − 2405522.0028779) / 1.0274912517 (verify constants against Mars24).
const TT_UTC_S = 69.184; // 37 leap seconds + 32.184 s (valid since 2017)
export function marsClock(date, lonEast) {
  const jdTT = date.getTime() / 86400000 + 2440587.5 + TT_UTC_S / 86400;
  const msd = (jdTT - 2405522.0028779) / 1.0274912517;
  const mtc = ((24 * msd) % 24 + 24) % 24;
  return { sol: Math.floor(msd), lmst: ((mtc + lonEast / 15) % 24 + 24) % 24 };
}
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(h * 60 % 60)).padStart(2, '0')}`;
if (import.meta.env?.DEV) {
  const m = marsClock(new Date(Date.UTC(2000, 0, 6) - TT_UTC_S * 1000), 0); // Mars24: MSD = 44796.0 − 0.0009626 = 44795.99904 at 2000-01-06 00:00 TT
  console.assert(m.sol === 44795 && Math.abs(m.lmst - 23.977) < 0.005, 'Mars clock epoch');
}

const ROWS = [
  ['plan', 'Overview', 'The base, the five sol sites and the route to each, over the orbital data layers.'],
  ['mission', 'Mission', 'Full screen: the rover drives each sol, base to site and back, one site per day.'],
  ['sols', 'Sols', 'One mission day per site: LMST clock, phases, telemetry and that day’s own checks.'],
  ['debrief', 'Rover', 'The rover’s modes in motion (drilling, solar, steep descent, storm stand) and its specs.'],
  ['vitals', 'Vitals', 'Days of air, water, food and power left, nominal and padded.'],
  ['log', 'Log', 'Decisions, outcomes and how well the crew calls its odds.'],
  ['print', 'Print', 'Paper sheets for when the screens go dark.'],
];
const DATA = ['ctx', 'hirise', 'themis_night', 'relief'];

const Arrow = () => <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h17M14 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;

function Barcode({ seed }) { // decorative bars drawn from the route text, not a scannable code
  const bars = [...seed].flatMap((ch, i) => { const c = ch.charCodeAt(0); return [1 + c % 3, 1 + (c >> 2) % 2, 1 + (c + i) % 4]; });
  let x = 0;
  return (
    <svg className="barcode" viewBox={`0 0 ${bars.reduce((a, b) => a + b * 2, 0)} 40`} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((w, i) => { const r = i % 2 ? null : <rect key={i} x={x} width={w} height="40" />; x += w * 2; return r; })}
    </svg>
  );
}

const LEVEL = { ok: 'OK', watch: 'Watch', bad: 'Act now' };
const WHERE = { mc: 'Earth, messages arrive minutes late', auto: 'Rover computer' };

// What one person is doing at plan time t: their task now, else their next stop task, else their all-day duty.
function doing(id, timeline, t) {
  const pos = positionAt(timeline, t), l = pos.leg;
  if (!pos.done && l?.kind === 'work') { const now = taskAt(l, t).find((x) => x.who === id && x.state === 'is-now'); if (now) return { label: 'Now', text: now.task, at: l.stop.id }; }
  for (const s of stopsOf(timeline)) if (s.t1 > t) { const i = s.stop.who?.indexOf(id) ?? -1; if (i >= 0) return { label: 'Next', text: s.stop.tasks[i], at: s.stop.id }; }
  return { label: 'All day', text: DUTIES[id] };
}

function CrewNow({ user, timeline, monitor, t }) {
  return (
    <ul className="crew-now">
      {PEOPLE.map((p) => {
        const c = monitor.crew.find((x) => x.id === p.id), d = doing(p.id, timeline, t);
        const worst = c && ['bad', 'watch', 'ok'].find((lv) => Object.entries(c.r).some(([k, v]) => level(k, v) === lv));
        return (
          <li key={p.id} className={'crew-card' + (p.id === user.id ? ' is-me' : '')} aria-current={p.id === user.id ? 'true' : undefined}>
            <p className="crew-role">{p.role}{p.id === user.id && <span className="muted"> (you)</span>}</p>
            <p className="small muted">{c ? c.where : WHERE[p.id]}</p>
            <p className="crew-task"><span className="crew-tag">{d.label}{d.at ? ` at ${d.at}` : ''}</span> {d.text}</p>
            {c && <p className="small">Health: {can(user, 'see-health', p.id) ? <span className={'lv-' + worst}>{LEVEL[worst]}</span> : <span className="muted">private</span>}</p>}
          </li>
        );
      })}
    </ul>
  );
}

// Objectives as a timeline: each stop becomes a milestone when the crew marks it complete.
function Milestones({ user, timeline, plan, feas, objectives, setObjectives, audit, ground }) {
  const stops = stopsOf(timeline), ok = can(user, 'complete-objective');
  const done = stops.filter((s) => objectives[s.stop.id]?.done).length;
  const mark = (id) => { setObjectives((o) => ({ ...o, [id]: { done: true, at: new Date().toLocaleDateString('en-CA'), by: user.id } })); audit(`completed objective ${id}`); };
  return (
    <>
      <p className="small">{done} of {stops.length} milestones complete</p>
      <ol className="milestones">
        <li className="ms is-start"><span className="ms-dot" aria-hidden="true" /><span className="ms-time num">{fmtClock(plan.start, 0)}</span><span className="ms-name">Leave the habitat</span></li>
        {stops.map((s) => { const o = objectives[s.stop.id]; return (
          <li key={s.stop.id} className={'ms' + (o?.done ? ' is-done' : '')}>
            <span className="ms-dot" aria-hidden="true">{o?.done ? '✓' : s.n}</span>
            <span className="ms-time num">{fmtClock(plan.start, s.t0)}</span>
            <span className="ms-name">{s.stop.name} <span className="muted num">{s.stop.id}</span></span>
            <span className="ms-state small">{o?.done ? `Complete · ${person(o.by).role}, ${o.at}` : ok ? <button className="btn btn-s" onClick={() => mark(s.stop.id)}>Mark complete</button> : 'Planned'}</span>
          </li>); })}
        <li className="ms is-end"><span className="ms-dot" aria-hidden="true" /><span className={'ms-time num' + (feas.feasible ? '' : ' bad')}>{fmtClock(plan.start, timeline.totalH)}</span><span className="ms-name">Back home{ground && <span className="small muted num"> · {fmtClock(plan.start, ground.badH)} if the ground is bad</span>}{!feas.feasible && <span className="small bad"> · turn back by {fmtClock(plan.start, EVA_H - plan.reserveH)}</span>}</span></li>
      </ol>
      {!feas.feasible && <p className="small bad" role="status">This plan does not fit: {feas.reasons.join('. ')}.</p>}
      {!ok && <p className="note">Only crew on site can mark a milestone complete.</p>}
    </>
  );
}

export default function Start({ go, plan, reach, user, route, signOut, timeline, feas, monitor, objectives, setObjectives, audit, sim, ground }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const mc = marsClock(now, 319.77), dest = route[0];
  return (
    <div className="start">
      <header className="start-nav">
        <span className="wordmark">A.R.E.S.<span>FIELD MAP</span></span>
        <button className="stamp-link" onClick={() => go('plan')}>[ OPEN MAP ]</button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1 className="display">
            <span className="l"><span className="serif">Every step</span></span>
            <span className="l sans">planned to come home</span>
            <span className="l dim"><span className="serif">before seven hours</span></span>
          </h1>
          <p className="lede">A crater near Chryse Planitia, read from orbit, so a crew knows when to turn back before they leave.</p>
          <button className="play" onClick={() => go('mission')}>
            <span>Ride the planned EVA</span><i aria-hidden="true" />
          </button>
        </div>

        <aside className="pass" aria-label="Boarding pass for the planned EVA">
          <p className="stamp-sm">{dest ? `Next EVA, Sol ${dest.sol}` : 'Next EVA'}</p>
          <h2>{dest ? dest.name : 'Pick a sol in Mission'}</h2>
          <div className="route num" aria-label={`From the habitat to ${dest ? dest.id : 'no station yet'}`}><span>HAB</span><Arrow /><span>{dest ? dest.id : 'none'}</span></div>
          <dl className="pass-kv num">
            <dt>Signed in</dt><dd>{user.role} <button className="btn btn-s" onClick={signOut}>Sign out</button></dd>
            <dt>Depart</dt><dd>{plan.start}</dd>
            <dt>Turn back by</dt><dd>{fmtClock(plan.start, EVA_H - plan.reserveH)}</dd>
            <dt>Reach</dt><dd>{reach.toFixed(1)} km at {plan.speed} km/h</dd>
            {!feas.feasible && <><dt>Plan</dt><dd className="bad">{feas.reasons[0]}{feas.reasons.length > 1 ? ` (+${feas.reasons.length - 1} more)` : ''}</dd></>}
          </dl>
          <Barcode seed={'HAB' + route.map((s) => s.id).join('')} />
          <div className="pass-actions">
            <button className="pill" onClick={() => go('plan')}>Open the map</button>
            <button className="pill" onClick={() => go('mission')}>Run the mission</button>
          </div>
        </aside>
      </section>

      <section className="start-band" aria-labelledby="work-h">
        <h2 id="work-h" className="display-s">Your work, <em className="serif">{user.role}</em></h2>
        <p>{DUTIES[user.id]}.</p>
        {(() => { const mine = tasksFor(user.id, route); return mine.length ? (
          <ol className="my-tasks">{mine.map(({ stop, task }) => <li key={stop.id + task}><span className="num">{stop.id}</span> {task} <span className="muted">at {stop.name}</span></li>)}</ol>
        ) : <p className="small muted">No stop tasks on this route{route.length ? '' : ': pick stations in Plan'}.</p>; })()}
        <h3 className="stamp-sm">How the work is divided on this route</h3>
        <table className="work-split">
          <thead><tr><th scope="col">Who</th><th scope="col">Stop tasks</th><th scope="col">All day</th></tr></thead>
          <tbody>{PEOPLE.map((p) => { const n = tasksFor(p.id, route); return (
            <tr key={p.id} className={p.id === user.id ? 'is-me' : ''} aria-current={p.id === user.id ? 'true' : undefined}>
              <th scope="row">{p.name === p.role ? p.name : `${p.name}, ${p.role}`}{p.id === user.id && <span className="muted"> (you)</span>}</th>
              <td>{n.length ? n.map((x) => `${x.stop.id} ${x.task}`).join('; ') : 'none'}</td>
              <td>{DUTIES[p.id]}</td>
            </tr>); })}</tbody>
        </table>
        <p className="note">The map and the rover's vitals are shared by everyone. Task owners are a placeholder split: the EVA lead and scientist walk, the commander and medic stay in the cab.</p>
      </section>

      <section className="start-band" aria-labelledby="crew-h">
        <h2 id="crew-h" className="display-s">The crew right now</h2>
        <CrewNow user={user} timeline={timeline} monitor={monitor} t={sim.t} />
        <p className="note">Health shows only to the person and the medic. All readings are simulated.</p>
      </section>

      <section className="start-band" aria-labelledby="ms-h">
        <h2 id="ms-h" className="display-s">Mission milestones</h2>
        {route.length ? <Milestones {...{ user, timeline, plan, feas, objectives, setObjectives, audit, ground }} /> : <p className="empty small">No stops on the route yet. Pick them in Plan.</p>}
      </section>

      <section className="start-band" aria-labelledby="modes-h">
        <h2 id="modes-h" className="stamp-sm">Modes</h2>
        <ul className="stamp-rows">
          {ROWS.map(([id, name, line]) => (
            <li key={id}><button onClick={() => go(id)}><span className="stamp">{name}</span><span className="row-line">{line}</span><Arrow /></button></li>
          ))}
        </ul>
      </section>

      <section className="start-band" aria-labelledby="data-h">
        <h2 id="data-h" className="display-s"><em className="serif">Four</em> kinds of orbit data, <em className="serif">one</em> route</h2>
        <ol className="legs">
          {DATA.map((k, i) => (
            <li key={k}>
              <span className="leg-n num">0{i + 1}</span>
              <p className="stamp-sm">{SOURCES[k].title}</p>
              <p className="small">{SOURCES[k].res}</p>
              <p className="small muted">{SOURCES[k].credit}</p>
            </li>
          ))}
        </ol>
        <p className="note">Thermal layer is THEMIS. Inside the cracks, only the robot goes; nothing here claims life.</p>
      </section>

      <footer className="start-foot">
        <span className="stamp-sm">[ A.R.E.S. footer ]</span>
        <span>NASA Space Apps 2026, NASA Walo Ka Group, Delhi. Built with help from AI (Anthropic Claude) for code and copy; all map data is NASA, ESA and USGS, credited above.</span>
        <span className="num coords"><span>28.43° N 319.77° E</span><span>Sol {mc.sol}</span><span>{hhmm(mc.lmst)} local mean solar time</span></span>
      </footer>
    </div>
  );
}
