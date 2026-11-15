// MARS-X HORIZON CAD models (team's Blender export, public/models/*.json, glTF with embedded data: the artifact host refuses .glb): a viewer for the Vitals screen and the rover symbol on the map.
import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PLACEHOLDERS } from './mission.js';

const base = import.meta.env.BASE_URL;
export const CAD = {
  A: { file: 'mode-a.json', name: 'Mode A · Normal driving' },
  B: { file: 'mode-b.json', name: 'Mode B · Rock crawling' },
  C: { file: 'mode-c.json', name: 'Mode C · Storm, anchors and solar deployed' },
  cabin: { file: 'cabin.json', name: 'Cabin cutaway · 4 seats, life support' },
  exploded: { file: 'exploded.json', name: 'Exploded assembly' },
  base: { file: 'base.glb', name: 'Base station · HAB-X habitat, GAR-X garage, COM-X comms, POWER-X power' },
};
const url = (k) => base + 'models/' + CAD[k].file;

// The model, centred on the ground, its long side on +x, scaled so the rover's long side is `len` units.
// env = keep the file's own ground and rocks (viewer only; the map has real terrain). anim = one of CLIPS' motions (viewer only).
export function Cad({ k, len = 9, env = false, anim = null }) {
  const { scene } = useGLTF(url(k));
  const { obj, rig } = useMemo(() => {
    const o = scene.clone(true), g = new THREE.Group(); g.add(o);
    const ground = o.getObjectByName('Martian_Environment');
    if (ground) ground.parent.remove(ground); // measure the rover alone
    const rig = anim ? rigOf(o, anim) : null; // before any transform: the CAD bakes every part in model space
    const under = named(o, UNDER).map((n) => [n, n.parent]); under.forEach(([n, p]) => p.remove(n)); // measure what stands on the ground
    let b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
    if (s.z > s.x) { o.rotation.y = Math.PI / 2; b = new THREE.Box3().setFromObject(g); s = b.getSize(new THREE.Vector3()); }
    under.forEach(([n, p]) => p.add(n));
    if (ground && env) o.children[0].add(ground);
    const c = b.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
    g.scale.setScalar(len / Math.max(s.x, s.z)); return { obj: g, rig };
  }, [scene, len, env, anim]);
  return <>{rig && <Motion rig={rig} />}<primitive object={obj} /></>;
}

// Mode clips for the Rover tab: what each mode does, moved with the CAD's own parts.
export const CLIPS = {
  drill: { model: 'C', anim: 'drill', name: 'Drilling', note: 'Anchors down, the CAD\'s own drill string turns and feeds down below the deck (the grid is the ground). The CAD draws the string about 9 m deep (verify); the Sol 3 brief plans a 1-2 m core at about 3.5 cm/min (simulated), 1.8 kW while turning (placeholder).' },
  solar: { model: 'C', anim: 'solar', name: 'Solar recharge', note: 'Solar wings deployed on the tracking pedestal; the array turns to follow the Sun. Battery capacity is TBD in the MARS-X spec (placeholder 100 kWh).' },
  descent: { model: 'B', anim: 'descent', name: 'Steep descent', note: `Mode B, rock crawling, going down a ${PLACEHOLDERS.slopeRover}° slope: the rover's slope limit (team question L3, verify). Past it the planner blocks the ground.` },
  stand: { model: 'C', anim: 'stand', name: 'Storm stand', note: 'Mode C: the four anchor augers screw into the ground and the rover holds still through a dust storm.' },
};

const UNDER = /^(Drill_Rod_String_8x|Drill_Rod_Couplings|Drill_Bit_Tungsten|Drill_Core_Barrel_Section|Subsurface_Section_Proxy)$/;
const centre = (nodes) => nodes.reduce((b, n) => b.expandByObject(n), new THREE.Box3()).getCenter(new THREE.Vector3());
// A group in the root's frame (y up), at c, holding the parts with their world placement kept. The CAD nests parts under a rotated Z-up node, so never turn them in their own parent's frame.
const pivotAt = (o, nodes, c) => { const p = new THREE.Group(); p.position.copy(c); o.add(p); p.updateMatrixWorld(true); nodes.forEach((n) => p.attach(n)); return p; };
const pivot = (o) => (n) => pivotAt(o, [n], centre([n])); // turn a part in place
const named = (o, re) => { const out = []; o.traverse((x) => { if (re.test(x.name)) out.push(x); }); return out; };
function rigOf(o, anim) {
  o.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
  const rig = { wheelAxis: size.x >= size.z ? 'z' : 'x' }; // wheels turn about the short horizontal axis
  if (anim === 'descent') rig.wheels = named(o, /^Wheel_(FL|FR|ML|MR|RL|RR)$/).map(pivot(o));
  if (anim === 'stand' || anim === 'drill') rig.augers = ['FL', 'FR', 'RL', 'RR'].map((k) => named(o, new RegExp(`^Anchor_${k}_(Auger|Helical_Ground_Screw)$`))).filter((n) => n.length).map((n) => pivotAt(o, n, centre(n))).map((p) => ({ p, y: p.position.y }));
  if (anim === 'solar') {
    const w = o.getObjectByName('Solar_Wings'), ped = o.getObjectByName('Solar_Tracking_Pedestal');
    if (w && ped) rig.wings = pivotAt(o, [w], centre([ped]));
  }
  if (anim === 'drill') {
    const string = named(o, /^(Drill_Rod_String_8x|Drill_Rod_Couplings|Drill_Bit_Tungsten|Drill_Core_Barrel_Section)$/);
    if (string.length) { const c = centre(string); rig.drill = pivotAt(o, string, new THREE.Vector3(c.x, 0, c.z)); }
  }
  return rig;
}
function Motion({ rig }) {
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    rig.wheels?.forEach((w) => { w.rotation[rig.wheelAxis] = t * 1.5; });
    rig.augers?.forEach((a) => { a.p.rotation.y = t * 6; a.p.position.y = a.y - 0.25 * Math.min(1, (t % 8) / 6); }); // screw down, then hold
    if (rig.wings) rig.wings.rotation.y = 0.35 * Math.sin(t * 0.4);
    if (rig.drill) { rig.drill.rotation.y = t * 4; rig.drill.position.y = 1 - (t % 10) / 10; } // turns and feeds 1 m down, looped
  });
  return null;
}
function Slope({ deg, children }) { // the rover drives down a ramp at the given slope, over and over
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) ref.current.position.x = 6 - (clock.elapsedTime * 1.2) % 12; });
  return (
    <group rotation={[0, 0, deg * Math.PI / 180]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><planeGeometry args={[40, 14]} /><meshStandardMaterial color="#8a4f32" roughness={1} /></mesh>
      <gridHelper args={[40, 40, '#5a3422', '#6e3f29']} />
      <group ref={ref}>{children}</group>
    </group>
  );
}

// The team's base station CAD (Y-up, metres), centred on its own origin. map = drop the file's ground, rocks, beam effects and parked rover:
// the map has real terrain and draws the moving rover itself.
const DROP_ON_MAP = ['00_ENVIRONMENT', '03_MARS_X_ROVER', '08_PRESENTATION_EFFECTS'];
export function Base({ map = false }) {
  const { scene } = useGLTF(base + 'models/base.glb');
  const obj = useMemo(() => {
    const o = scene.clone(true);
    if (map) DROP_ON_MAP.forEach((n) => { const x = o.getObjectByName(n); if (x) x.visible = false; });
    return o;
  }, [scene, map]);
  return <primitive object={obj} />;
}

// k: a CLIPS id (animated mode) or a CAD id (static model)
export function RoverViewer({ k, setK, rover }) {
  const clip = CLIPS[k], model = clip ? clip.model : k, isBase = model === 'base';
  const body = clip?.anim === 'descent' ? <Slope deg={PLACEHOLDERS.slopeRover}><Cad k={model} len={5} anim="descent" /></Slope> : <Cad k={model} env={!clip} anim={clip?.anim ?? null} />;
  return (
    <div className="cad">
      <Canvas key={isBase ? 'base' : 'rover'} camera={isBase ? { position: [70, 45, 85], fov: 35, far: 2000 } : { position: [13, 8, 17], fov: 35 }} dpr={[1, 2]}>
        <color attach="background" args={['#0b0b0c']} />
        <hemisphereLight args={['#fff4e8', '#3a2418', 1.2]} />
        <directionalLight position={[8, 12, 6]} intensity={2.2} />
        {!isBase && clip?.anim !== 'descent' && <gridHelper args={[30, 30, '#3a3a3a', '#1e1e1e']} />}
        <Suspense fallback={null}>{isBase ? <Base /> : body}</Suspense>
        <OrbitControls makeDefault target={isBase ? [0, 3, 0] : [0, 1.6, 0]} maxPolarAngle={Math.PI / 2.05} maxDistance={isBase ? 400 : 60} />
      </Canvas>
      <div className="cad-bar" role="group" aria-label="Rover modes and models">
        {Object.entries(CLIPS).map(([id, c]) => <button key={id} className="tab" aria-pressed={k === id} onClick={() => setK(id)}>{c.name}</button>)}
        <span className="cad-sep" aria-hidden="true" />
        {Object.entries(CAD).map(([id, c]) => <button key={id} className="tab" aria-pressed={k === id} onClick={() => setK(id)}>{c.name.split(' · ')[0]}{rover?.mode === id ? ' (now)' : ''}</button>)}
      </div>
      <p className="cad-note small">{clip ? clip.note : CAD[k].name + '. ' + (isBase ? 'MARS-X HORIZON base concept CAD at true size; all dimensions are preliminary design targets (verify).' : 'MARS-X HORIZON concept CAD, 8–9 m long, six wheels, four anchors (team spec Rev 0.1).')} Drag to orbit.</p>
    </div>
  );
}

// Specs from the team's CAD and spec Rev 0.1; anything the spec leaves open says so.
const SPECS = [
  ['Name', 'MARS-X HORIZON pressurised rover (concept)'],
  ['Length', '8–9 m (team spec Rev 0.1)'],
  ['Running gear', 'six wheels; four anchor arms with augers'],
  ['Cabin', '4 seats, life support, airlock hatch'],
  ['Science', 'fore and aft drill bays, robotic sample transfer arm'],
  ['Power', 'two solar wings on a tracking pedestal, thermal radiator; battery capacity TBD (placeholder 100 kWh)'],
  ['Speed', `${PLACEHOLDERS.speeds.join(' / ')} km/h settings (team question M1, placeholder)`],
  ['Slope limit', `${PLACEHOLDERS.slopeRover}° driving (team question L3, verify)`],
  ['Modes', 'A normal driving, B rock crawling, C storm: anchors and solar deployed'],
];
export function RoverSpecs({ k }) {
  const clip = CLIPS[k];
  return (
    <div className="stack">
      <section className="stack-s">
        <h2>Rover · MARS-X HORIZON</h2>
        <p className="small">{clip ? <><strong>{clip.name}.</strong> {clip.note}</> : CAD[k]?.name}</p>
      </section>
      <dl className="kv">{SPECS.map(([a, b]) => [<dt key={a}>{a}</dt>, <dd key={a + 'v'}>{b}</dd>])}</dl>
      <p className="note">From the team's Blender CAD and spec Rev 0.1. Numbers marked placeholder or verify are not measured.</p>
    </div>
  );
}
