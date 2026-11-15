// Mission view: full screen, the planned EVA replayed from the crew's side. The CAD rover drives the planned
// path at true size, the camera rides with it (chase, driver eye), and every objective stays on screen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { Draped, Ring, Rover, Label } from './MapScene.jsx';
import { EVA_H, planTimeline, positionAt, headingAt, turnsOf, alongKm, fmtClock, fmtH, bearing, compass, bestDrop, DUTIES } from './mission.js';
import { distKm } from './geo.js';
import { RoverModeControl, modeLine, TaskRows } from './Ops.jsx';
import { CAD } from './RoverCad.jsx';

export const TRUE_SCALE = 9 / 5.4 / 1000; // the rover model is drawn 5.4 units long; MARS-X HORIZON is about 9 m (team spec Rev 0.1)
export const VIEWS = [['chase', 'Chase'], ['driver', 'Driver eye'], ['overview', 'Whole route']];
const ROVER_SCALE = { chase: TRUE_SCALE, driver: TRUE_SCALE, overview: 0.02, free: 0.02 };
const COL = { now: '#af50ff', done: '#5ec27a', later: '#f7f9fa' };

// Work legs in order, with their place in the plan.
export const stopsOf = (timeline) => timeline.legs.filter((l) => l.kind === 'work').map((l, n) => ({ ...l, n: n + 1 }));
const driveTo = (timeline, s) => timeline.legs.find((x) => x.kind === 'drive' && x.stop === s.stop);
const stateOf = (s, t, timeline) => (t >= s.t1 ? 'done' : t >= (driveTo(timeline, s)?.t0 ?? s.t0) ? 'now' : 'later');

function splitPts(pts, d) { // the part of a polyline before and after d km
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const s = distKm(pts[i - 1], pts[i]);
    if (acc + s >= d) { const p = alongKm(pts, d); return [[...pts.slice(0, i), p], [p, ...pts.slice(i)]]; }
    acc += s;
  }
  return [pts, [pts[pts.length - 1]]];
}
const legPts = (l) => l.pts ?? (l.kind === "work" ? [l.at] : [l.from, l.to]); // work legs stand at one point

function Beacon({ surface, xz, color }) { // a light column, drawn in screen pixels so the next objective shows from kilometres away and from the cab
  const y = surface.y(xz[0], xz[1]), pts = [[xz[0], y, xz[1]], [xz[0], y + 0.45, xz[1]]]; // same height as the map pin, so its label sits on top
  return (
    <group>
      <Line points={pts} color={color} lineWidth={14} transparent opacity={0.25} depthWrite={false} />
      <Line points={pts} color={color} lineWidth={4} />
      <Ring surface={surface} c={xz} r={0.12} color={color} width={3} lift={0.003} />
    </group>
  );
}

// Moves the camera with the rover. Hands control back (view 'free') as soon as the user drags.
function Follow({ surface, timeline, t, view, onUserMove }) {
  const { camera, controls } = useThree(), yaw = useRef(null), settle = useRef(0);
  const tv = useMemo(() => ({ cam: new THREE.Vector3(), look: new THREE.Vector3() }), []);
  useEffect(() => { settle.current = 1.6; }, [view]);
  useEffect(() => {
    if (!controls) return;
    controls.addEventListener('start', onUserMove); return () => controls.removeEventListener('start', onUserMove);
  }, [controls, onUserMove]);
  useFrame((_, dt) => {
    if (!controls || view === 'free') return;
    if (view === 'overview' && settle.current <= 0) return; // fly there once, then the user orbits
    settle.current -= dt;
    const p = positionAt(timeline, t).xz, h = headingAt(timeline, t);
    yaw.current = yaw.current == null ? h : yaw.current + Math.atan2(Math.sin(h - yaw.current), Math.cos(h - yaw.current)) * Math.min(1, dt * 2.5);
    const f = [Math.cos(yaw.current), -Math.sin(yaw.current)], at = (d, up) => [p[0] + f[0] * d, surface.y(p[0] + f[0] * d, p[1] + f[1] * d) + up, p[1] + f[1] * d];
    let cam, look;
    if (view === 'chase') { cam = at(-0.024, 0.008); look = at(0.02, 0); } // rover in the lower middle, horizon in the top quarter
    else if (view === 'driver') { cam = at(0.0055, 0.0032); look = at(0.45, 0.001); } // eye in the front of the cab, about 3 m up
    else { // whole route from above, a little south
      const xs = timeline.legs.flatMap((l) => legPts(l)), cx = xs.reduce((s, q) => s + q[0], 0) / xs.length, cz = xs.reduce((s, q) => s + q[1], 0) / xs.length;
      cam = [cx, surface.y(cx, cz) + 9, cz + 8]; look = [cx, surface.y(cx, cz), cz];
    }
    tv.cam.set(...cam); tv.look.set(...look);
    const k = 1 - Math.exp(-dt * (view === 'driver' ? 8 : 4));
    camera.position.lerp(tv.cam, k); controls.target.lerp(tv.look, k); controls.update();
  });
  return null;
}

export function MissionScene({ surface, timeline, t, habXZ, view, roverMode, onUserMove }) {
  const pos = positionAt(timeline, t), drives = timeline.legs.filter((l) => l.kind === 'drive');
  const stops = stopsOf(timeline);
  return (
    <group>
      {drives.map((l, i) => {
        const pts = legPts(l), st = t >= l.t1 ? 'done' : t >= l.t0 ? 'now' : 'later';
        if (st !== 'now') return <Draped key={i} surface={surface} pts={pts} lift={0.003} step={0.05} color={st === 'done' ? COL.done : '#c9a6ff'} width={st === 'done' ? 3 : 4} opacity={st === 'done' ? 0.55 : 0.75} />;
        const [gone, ahead] = splitPts(pts, (t - l.t0) / (l.t1 - l.t0 || 1) * l.km);
        return (
          <group key={i}>
            {gone.length > 1 && <Draped surface={surface} pts={gone} lift={0.003} step={0.05} color={COL.done} width={3} opacity={0.6} />}
            {ahead.length > 1 && <Draped surface={surface} pts={ahead} lift={0.003} step={0.05} color={COL.now} width={12} opacity={0.35} />}
            {ahead.length > 1 && <Draped surface={surface} pts={ahead} lift={0.0032} step={0.05} color="#f3e6ff" width={4} />}
          </group>
        );
      })}
      {stops.map((s) => <Beacon key={s.stop.id} surface={surface} xz={s.at} color={COL[stateOf(s, t, timeline)]} />)}
      {pos.leg?.kind === 'work' && <Label surface={surface} xz={pos.leg.at} tone="base">Sol {pos.leg.stop.sol} · on site at {pos.leg.stop.id}: rover parked, crew working</Label>}
      {drives.length > 0 && t >= drives[drives.length - 1].t0 && <Beacon surface={surface} xz={habXZ} color={pos.done ? COL.done : '#5ab4ff'} />}{/* home beacon once the crew is heading back */}
      <Rover surface={surface} xz={pos.xz} errKm={0} mode={roverMode} scale={ROVER_SCALE[view]} yaw={headingAt(timeline, t)} />
      <Follow surface={surface} timeline={timeline} t={t} view={view} onUserMove={onUserMove} />
    </group>
  );
}

// --- the screen around the 3D view

// The plan past its own reserve line, with the one-click fix the app computed.
// The plan's verdict in the existing red, every reason listed, plus the smallest fix when the plan runs long.
export function OverFix({ stops, plan, setPlan, feas, totalFor }) {
  if (!feas || feas.feasible) return null;
  const fix = feas.overH > 0 && stops.length > 1 && bestDrop(stops, totalFor, EVA_H - plan.reserveH);
  return (
    <div className="over-fix" role="status">
      <strong>This plan does not fit.</strong>
      <ul className="reasons">{feas.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      {feas.overH > 0 && (fix ? <>Dropping {fix.id} fits, about {fmtH(fix.spare)} to spare. <button className="btn" onClick={() => setPlan((p) => ({ ...p, route: p.route.filter((id) => id !== fix.id) }))}>Drop {fix.id}</button></>
        : stops.length > 1 ? 'No single stop can go to fit: cut work time at a stop.' : 'Pick a nearer stop: see Suggested routes.')}
    </div>
  );
}

function profileOf(site, accessOf, pts, km, n = 90) {
  return Array.from({ length: n + 1 }, (_, i) => { const d = km * i / n, xz = alongKm(pts, d); return { d, z: site.elevXZ(xz[0], xz[1]), slope: accessOf(xz).slope }; });
}

const MODE_FILL = { A: 'color-mix(in oklab, var(--color-ink) 22%, transparent)', B: 'var(--color-caution)', C: 'var(--color-accent)' };

function Profile({ site, accessOf, modes, leg, doneKm, limits, title }) {
  const pr = useMemo(() => profileOf(site, accessOf, legPts(leg), leg.km), [site, accessOf, leg]);
  const W = 360, H = 110, lo = Math.min(...pr.map((p) => p.z)), hi = Math.max(...pr.map((p) => p.z)), span = Math.max(20, hi - lo);
  const X = (d) => d / (leg.km || 1) * W, Y = (z) => H - 30 - (z - lo) / span * (H - 42);
  const line = pr.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)},${Y(p.z).toFixed(1)}`).join(' ');
  let climb = 0; for (let i = 1; i < pr.length; i++) climb += Math.max(0, pr[i].z - pr[i - 1].z);
  const maxS = Math.max(...pr.map((p) => p.slope));
  const tone = (s) => (s > limits.rover ? 'var(--color-danger)' : s > limits.walk ? 'var(--color-caution)' : 'var(--color-ok)');
  return (
    <section className="mx-card mx-profile" aria-label="Ground profile of this leg">
      <p className="label">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Elevation from ${Math.round(lo)} to ${Math.round(hi)} m, ${Math.round(climb)} m of climbing, steepest ${maxS.toFixed(0)} degrees at 200 m`}>
        <path d={`${line} L${W},${H - 26} L0,${H - 26} Z`} fill="color-mix(in oklab, var(--color-accent) 18%, transparent)" />
        <path d={line} fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
        {modes?.map((p, i) => { const mx = (k) => X(Math.min(leg.km, Math.max(0, (k - 0.5) / (modes.length - 1) * leg.km))); return <rect key={'m' + i} x={mx(i)} y={H - 22} width={mx(i + 1) - mx(i) + 0.5} height="11" fill={MODE_FILL[p.mode]} />; })}
        {modes?.map((p, i) => (i === 0 || p.mode !== modes[i - 1].mode) && <text key={'t' + i} x={X(Math.max(0, (i - 0.5) / (modes.length - 1) * leg.km)) + 2} y={H - 13} className="mode-t">{p.mode}</text>)}
        {pr.slice(1).map((p, i) => <rect key={i} x={X(pr[i].d)} y={H - 8} width={X(p.d) - X(pr[i].d) + 0.5} height="6" fill={tone(p.slope)} />)}
        {doneKm != null && <line x1={X(doneKm)} x2={X(doneKm)} y1="4" y2={H - 8} stroke="var(--color-accent)" strokeWidth="2" />}
      </svg>
      <p className="small num">{leg.km.toFixed(1)} km · {Math.round(lo)} to {Math.round(hi)} m · +{Math.round(climb)} m climb · steepest {maxS.toFixed(0)}° <span className="muted">(200 m cells. Upper strip: rover mode the autonomous system picks, A flat, B slope or rocks. Lower strip: green ≤ {limits.walk}°, amber ≤ {limits.rover}°, red over)</span></p>
    </section>
  );
}

function Objectives({ timeline, t, plan, checkStop, setT, user, objectives, ground }) {
  const stops = stopsOf(timeline), home = timeline.legs[timeline.legs.length - 1];
  return (
    <ol className="mx-objectives" aria-label="Objectives in route order">
      <li><button className={'mx-obj is-' + (t > 0 ? 'done' : 'now')} onClick={() => setT(0)}>
        <span className="mx-n">H</span><span className="mx-name">Habitat</span><span className="small num">leave {fmtClock(plan.start, 0)}</span></button></li>
      {stops.map((s) => {
        const st = objectives[s.stop.id]?.done ? 'done' : stateOf(s, t, timeline), c = checkStop(s.stop);
        return (
          <li key={s.stop.id}><button className={'mx-obj is-' + st} aria-current={st === 'now' ? 'step' : undefined} onClick={() => setT(s.t0 + 1 / 600)}>
            <span className="mx-n">{objectives[s.stop.id]?.done ? '✓' : s.n}</span>
            <span className="mx-name">{s.stop.id} {s.stop.name}{objectives[s.stop.id]?.done && <span className="badge">milestone</span>}</span>
            <span className="small num">{fmtClock(plan.start, s.t0)}–{fmtClock(plan.start, s.t1)} · {Math.round((s.t1 - s.t0) * 60)} min</span>
            <span className="small mx-task">{(() => { const i = s.stop.who?.indexOf(user.id) ?? -1; return i >= 0 ? `You: ${s.stop.tasks[i]}` : s.stop.tasks?.[0]; })()}</span>
            <span className={'mx-chip ' + (c.crack ? 'is-robot' : c.ok ? 'is-ok' : 'is-bad')}>{c.crack ? 'Cracks: robot only' : c.ok ? 'Inside limits' : 'Outside limits'}</span>
          </button></li>
        );
      })}
      <li><button className={'mx-obj is-' + (t >= timeline.totalH ? 'done' : 'later')} onClick={() => setT(home?.t0 ?? 0)}>
        <span className="mx-n">H</span><span className="mx-name">Home</span><span className="small num">back {fmtClock(plan.start, timeline.totalH)}{ground && ` · ${fmtClock(plan.start, ground.badH)} if the ground is bad`}</span></button></li>
    </ol>
  );
}

// hours until the crew must head home: the rover's time-to-home map at bad-ground speeds (Stage 4), plus the extra the last replan found on hazards widened by the position error (Stage 5)
const turnBackAt = (pos, t, plan, planner, replan) => EVA_H - plan.reserveH - t - planner.roverHome(pos.xz, true) - (replan?.extraH ?? 0);
// Each owner works through their own tasks in parallel, splitting the stop's work time (EVA lead and scientist walk side by side).
export const taskAt = (l, t) => {
  const s = l.stop, tasks = s.tasks ?? [], len = l.t1 - l.t0, n = {}, k = {};
  tasks.forEach((_, i) => { const w = s.who?.[i] ?? '-'; n[w] = (n[w] ?? 0) + 1; });
  return tasks.map((task, i) => {
    const w = s.who?.[i] ?? '-', each = len / n[w], t0 = l.t0 + (k[w] = (k[w] ?? -1) + 1) * each;
    return { task, who: s.who?.[i], t0, state: t < t0 ? '' : t < t0 + each ? 'is-now' : 'is-done' };
  }).sort((a, b) => a.t0 - b.t0);
};
if (import.meta.env?.DEV) {
  const rows = taskAt({ t0: 0, t1: 1, stop: { who: ['a', 'b', 'b'], tasks: ['x', 'y', 'z'] } }, 0.6);
  console.assert(rows.map((r) => r.task + r.t0 + r.state).join() === 'x0is-now,y0is-done,z0.5is-now', 'owners work in parallel');
}
const nextTurn = (l, t) => { const done = (t - l.t0) / (l.t1 - l.t0 || 1) * l.km; return { done, left: l.km - done, next: turnsOf(legPts(l)).find((x) => x.km > done + 0.02) }; };

// Helmet: one instruction and the turn-back time, nothing else (the BASALT overload and Apollo cuff-checklist finding, planning questions Part 5).
function HelmetCard({ timeline, t, plan, planner, user, replan }) {
  const pos = positionAt(timeline, t), l = pos.leg, turnBack = turnBackAt(pos, t, plan, planner, replan);
  let say = 'EVA complete';
  if (!pos.done && l?.kind === 'work') { const mine = taskAt(l, t).filter((x) => x.who === user.id); say = (mine.find((x) => x.state === 'is-now') ?? mine.find((x) => !x.state))?.task ?? `No task for you at ${l.stop.id}: ${DUTIES[user.id]}`; }
  else if (!pos.done && l) { const { done, left, next } = nextTurn(l, t); say = next ? `In ${(next.km - done).toFixed(1)} km bear ${next.deg > 0 ? 'right' : 'left'}` : `Straight on ${left.toFixed(1)} km to ${l.stop ? l.stop.id : 'the habitat'}`; }
  return (
    <section className="mx-card mx-helmet" aria-live="polite">
      <p className="mx-big">{say}</p>
      <p className={'num ' + (turnBack < 0 ? 'is-bad' : turnBack < 0.25 ? 'is-watch' : '')}>{pos.done ? `Back ${fmtClock(plan.start, timeline.totalH)}` : turnBack < 0 ? `Turn back now, ${fmtH(-turnBack)} late` : `Turn back in ${fmtH(turnBack)}`}</p>
    </section>
  );
}

function NowCard({ timeline, t, plan, habXZ, planner, accessOf, limits, checkStop, modeAt, user, replan }) {
  const pos = positionAt(timeline, t), l = pos.leg, turnBack = turnBackAt(pos, t, plan, planner, replan), m = modeAt(t);
  const a = accessOf(pos.xz), slopeTone = a.slope > limits.rover ? 'is-bad' : a.slope > limits.walk ? 'is-watch' : 'is-ok';
  const ground = <dl className="kv num"><dt>Ground here</dt><dd>{a.terrain.name}</dd><dt>Slope</dt><dd className={slopeTone}>{a.slope.toFixed(0)}° at 200 m</dd><dt>Rover mode</dt><dd>{m.mode} · {CAD[m.mode].name.split(' · ')[1]}<span className="muted"> · {modeLine(m)}</span></dd><dt>Radio to base</dt><dd>{a.radio ? 'line of sight' : 'shadow: relay needed'}</dd><dt>Turn back</dt><dd className={turnBack < 0 ? 'is-bad' : turnBack < 0.25 ? 'is-watch' : ''}>{turnBack < 0 ? 'now, ' + fmtH(-turnBack) + ' late' : 'in ' + fmtH(turnBack)}<span className="muted"> · if the ground is bad, position ±{Math.round((replan?.errKm ?? 0.02) * 1000)} m</span></dd></dl>;
  if (pos.done || !l) return <section className="mx-card mx-now"><p className="label">EVA complete</p><p className="mx-big">Back at the habitat {fmtClock(plan.start, timeline.totalH)}</p></section>;
  if (l.kind === 'work') {
    const s = l.stop, rows = taskAt(l, t), c = checkStop(s);
    return (
      <section className="mx-card mx-now is-work" aria-live="polite">
        <p className="label">Objective {stopsOf(timeline).find((x) => x === l || x.stop.id === s.id)?.n} · working at {s.id}</p>
        <p className="mx-big">{s.name}</p>
        <TaskRows rows={rows} plan={plan} user={user} />
        {!c.ok && <p className="small warn">{c.text}.</p>}
        <details className="more">
          <summary>About this stop</summary>
          <p className="small">{s.goal}</p>
          <p className="small"><strong>Question.</strong> {s.question}</p>
          {s.negative?.[0] && <p className="small muted">Unknown: {s.negative[0]}.</p>}
          <p className="small muted">On foot: EVA lead and scientist. In the cab: commander and medic (placeholder ops rule).</p>
          {ground}
        </details>
      </section>
    );
  }
  const { done, left, next } = nextTurn(l, t), to = l.stop;
  const hdg = (Math.round(-headingAt(timeline, t) * 180 / Math.PI + 90) % 360 + 360) % 360; // scene yaw back to a compass bearing
  return (
    <section className="mx-card mx-now" aria-live="polite">
      <p className="label">Driving to {to ? to.id : 'the habitat'}</p>
      <p className="mx-big">{to ? to.name : 'Home'}</p>
      <div className="mx-instr">
        <span className="mx-arrow" style={{ transform: `rotate(${next ? Math.sign(next.deg) * Math.min(90, Math.abs(next.deg)) : 0}deg)` }} aria-hidden="true">↑</span>
        <p>{next ? <>In <strong className="num">{(next.km - done).toFixed(1)} km</strong> bear {next.deg > 0 ? 'right' : 'left'} onto <span className="num">{Math.round(next.to)}° {compass(next.to)}</span></> : <>Straight on <strong className="num">{left.toFixed(1)} km</strong> to {to ? to.id : 'the habitat'}</>}</p>
      </div>
      <dl className="kv num">
        <dt>Left on this leg</dt><dd>{left.toFixed(1)} of {l.km.toFixed(1)} km</dd>
        <dt>Arrive</dt><dd>{fmtClock(plan.start, l.t1)} at {plan.speed} km/h</dd>
        <dt>Heading</dt><dd>{hdg}° {compass(hdg)} · {to ? `${to.id} bears ${Math.round(bearing(pos.xz, to.xz))}°` : `base bears ${Math.round(bearing(pos.xz, habXZ))}°`}</dd>
      </dl>
      {to && <p className={'small ' + (checkStop(to).ok ? 'muted' : 'warn')}>At {to.id}: {checkStop(to).text}.</p>}
      {ground}
    </section>
  );
}

export function MissionHud({ stations, site, timeline, tour, setTour, view, setView, plan, setPlan, habXZ, planner, feas, totalFor, accessOf, limits, checkStop, modeAt, legModes, user, setRoverMode, objectives, ground, replan }) {
  const [helmet, setHelmet] = useState(false), { t } = tour, setT = (v) => setTour((s) => ({ ...s, t: Math.max(0, Math.min(timeline.totalH, v)) }));
  useEffect(() => { // playback clock, 20 updates a second like Field
    if (!tour.running) return;
    let last = performance.now(), raf;
    const tick = (now) => {
      if (now - last >= 50) { const dt = (now - last) / 3600000 * tour.rate; last = now; setTour((s) => { const v = Math.min(timeline.totalH, s.t + dt); return { ...s, t: v, running: v < timeline.totalH }; }); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [tour.running, tour.rate, timeline, setTour]);
  const pos = positionAt(timeline, t), l = pos.leg;
  const profLeg = l?.kind === 'drive' ? l : timeline.legs[timeline.legs.indexOf(l) + 1];
  if (!timeline.legs.some((x) => x.kind === 'work')) return <div className="mx-empty"><p className="empty">No route planned. Pick stops in Plan, then come back to see the drive.</p></div>;
  return (
    <div className="mx">
      {helmet ? <HelmetCard {...{ timeline, t, plan, planner, user, replan }} /> : <>
      <Objectives {...{ timeline, t, plan, checkStop, setT, user, objectives, ground }} />
      {replan?.event && <p className="mx-card small is-bad" role="alert">{replan.event.text}</p>}
      <NowCard {...{ timeline, t, plan, habXZ, planner, accessOf, limits, checkStop, modeAt, user, replan }} />
      <DaysPanel {...{ stations, site, habXZ, planner, plan, setPlan, timeline, tour, setTour }} />
      </>}
      {!helmet && profLeg && <Profile site={site} accessOf={accessOf} modes={legModes[timeline.legs.indexOf(profLeg)]} leg={profLeg} limits={limits} doneKm={l === profLeg ? (t - l.t0) / (l.t1 - l.t0 || 1) * l.km : null}
        title={l === profLeg ? `This leg · to ${profLeg.stop ? profLeg.stop.id : 'the habitat'}` : `Next leg · to ${profLeg.stop ? profLeg.stop.id : 'the habitat'}`} />}
      <div className="mx-card mx-bar">
        <button className="btn btn-primary" onClick={() => setTour((s) => ({ ...s, running: !s.running, t: s.t >= timeline.totalH ? 0 : s.t }))}>{tour.running ? 'Pause' : t >= timeline.totalH ? 'Replay' : t > 0 ? 'Resume' : 'Start drive'}</button>
        <div className="mx-scrub">
          <div className="mx-legs" aria-hidden="true">{timeline.legs.map((x, i) => <span key={i} className={'is-' + x.kind} style={{ flexGrow: x.t1 - x.t0 }}>{x.kind === 'work' ? x.stop.id : ''}</span>)}</div>
          <input type="range" min="0" max={timeline.totalH} step={1 / 600} value={t} onChange={(e) => setT(+e.target.value)} aria-label="Mission time" aria-valuetext={fmtClock(plan.start, t)} />
        </div>
        <span className="num mx-clock">{fmtClock(plan.start, t)}</span>
        <select value={tour.rate} onChange={(e) => setTour((s) => ({ ...s, rate: +e.target.value }))} aria-label="Playback speed">
          <option value="60">1 min/s</option><option value="300">5 min/s</option><option value="900">15 min/s</option>
        </select>
        <div className="seg" role="group" aria-label="Camera">
          {VIEWS.map(([id, name]) => <button key={id} className="tab" aria-pressed={view === id} onClick={() => setView(id)}>{name}</button>)}
          {view === 'free' && <span className="small muted">Free camera</span>}
        </div>
        <RoverModeControl cur={modeAt(t)} user={user} setRoverMode={setRoverMode} />
        <button className="tab" aria-pressed={helmet} onClick={() => { setHelmet((h) => !h); if (!helmet) setView('driver'); }}>Helmet view</button>
        <OverFix stops={stopsOf(timeline).map((s) => s.stop)} {...{ plan, setPlan, feas, totalFor }} />
        <p className="mx-foot small muted">Replay of the plan, not live tracking. Ground is the 200 m elevation model under ~15 m CTX at true height: hills are real, rocks and crack edges are not shown. Rover drawn at true size in Chase and Driver eye.</p>
      </div>
    </div>
  );
}

// One site per sol, in the briefs' order (low risk first): the rover leaves base, works there, and is back the same day.
// "Run all five sols" plays them one after another: out, work, back to base, then the next sol.
function DaysPanel({ stations, site, habXZ, planner, plan, setPlan, timeline, tour, setTour }) {
  const days = useMemo(() => stations.map((s) => ({ s, tl: planTimeline(habXZ, [s], plan.speed, undefined, planner.legs('rover', [s]).map((l) => ({ ...l, hours: s.driveH }))) })), [stations, habXZ, plan.speed, planner]);
  const cur = plan.route.length === 1 ? plan.route[0] : null, t = tour.t, leg = positionAt(timeline, t).leg, end = t >= timeline.totalH - 1 / 120; // within 30 s of the end counts as home
  const pick = (id, run = false) => { setPlan((p) => ({ ...p, route: [id] })); setTour((x) => ({ ...x, t: 0, running: run, all: run && x.all })); };
  const idx = stations.findIndex((s) => s.id === cur);
  useEffect(() => { // all sols: when one is back at base, load the next
    if (!tour.all || tour.running || !end) return;
    const next = stations[idx + 1], id = setTimeout(() => (next ? pick(next.id, true) : setTour((x) => ({ ...x, all: false }))), 1200);
    return () => clearTimeout(id);
  }, [tour.all, tour.running, end, idx]); // eslint-disable-line react-hooks/exhaustive-deps
  const ll = (xz) => { const [lon, lat] = site.toLonLat(...xz); return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`; };
  const phase = end ? 'Back at base' : t <= 0 ? 'At base, ready' : leg?.kind === 'work' ? `On site at ${leg.stop.id}` : leg?.stop ? `Driving out to ${leg.stop.id}` : 'Driving back to base';
  return (
    <section className="mx-card mx-days" aria-labelledby="days-h">
      <h2 id="days-h" className="mx-days-h">Mission days</h2>
      <ol className="mx-days-list">
        {days.map(({ s, tl: est }, i) => { const tl = cur === s.id ? timeline : est; return ( // the picked day uses the slope-aware path, others a straight-line estimate
          <li key={s.id}>
            <button className={'mx-day' + (cur === s.id ? ' is-on' : '')} aria-pressed={cur === s.id} onClick={() => pick(s.id)}>
              <span className="mx-name">Sol {s.sol} · {s.id} Site {i + 1} <span className={'badge risk-' + s.riskLevel}>{s.risk}</span></span>
              <span className="small muted num">{ll(s.xz)}</span>
              <span className="small num">Out {fmtH(tl.legs[0].t1 - tl.legs[0].t0)}, on site {fmtH(tl.legs[1].t1 - tl.legs[1].t0)}, back by {fmtClock(plan.start, tl.totalH)}</span>
              {(s.work <= 0 || tl.totalH > EVA_H - plan.reserveH + 1e-6) && <span className="mx-chip is-bad">Does not fit the day at {plan.speed} km/h</span>}
            </button>
          </li>
        ); })}
      </ol>
      {cur ? <div className="mx-count" role="timer" aria-live="off">
        <p className="small">{phase}</p>
        <p className="num mx-count-n">{end ? 'Done' : `${fmtH(timeline.totalH - t)} to base`}</p>
        <button className="btn btn-primary" onClick={() => setTour((x) => ({ ...x, t: end ? 0 : x.t, running: !x.running }))}>{tour.running ? 'Pause' : end ? 'Run it again' : t > 0 ? 'Resume' : `Run Sol ${stations[idx]?.sol ?? ''}`}</button>
        <button className="btn" aria-pressed={!!tour.all} onClick={() => { if (tour.all) setTour((x) => ({ ...x, all: false, running: false })); else { setTour((x) => ({ ...x, all: true })); pick(stations[0].id, true); } }}>{tour.all ? 'Stop the sequence' : 'Run all five sols'}</button>
      </div> : <p className="small muted">Pick a sol to load its site and countdown.</p>}
    </section>
  );
}
