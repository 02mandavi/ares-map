import { Suspense, useRef } from 'react';
import { Cad, Base } from './RoverCad.jsx';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Habitat and rover, modelled in metres and scaled up as map symbols (the legend says "symbols not to scale").
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = { shell: '#d9dcdf', shell2: '#c4c7cb', frame: '#8d9196', dark: '#3a3a3a', cell: '#1f2a44', glass: '#14181f', foil: '#c9a64a', accent: '#af50ff' };

const Mat = ({ c, r = 0.6, m = 0, ...rest }) => <meshStandardMaterial color={c} roughness={r} metalness={m} {...rest} />;

function Panel({ position, tilt = 0.45 }) { // one solar panel on a post, tilted toward the south (+z) for 28° N
  return (
    <group position={position}>
      <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.06, 0.06, 1.4, 6]} /><Mat c={C.frame} /></mesh>
      <mesh position={[0, 1.45, 0]} rotation={[tilt, 0, 0]}><boxGeometry args={[3.6, 0.06, 1.8]} /><Mat c={C.cell} r={0.3} m={0.4} /></mesh>
    </group>
  );
}

// The team's base station CAD at the habitat point; the hand-built symbol shows while the 3 MB file loads.
// Overview: 12x true size, the same as the rover symbol (0.02 x 5.4 units = 9 m), so the two stay in proportion. Mission view: true metres.
export function Habitat({ surface, xz, scale }) {
  const y = surface.y(xz[0], xz[1]);
  return (
    <Suspense fallback={<HabitatSymbol surface={surface} xz={xz} scale={scale ?? 0.011} />}>
      <group position={[xz[0], y, xz[1]]} scale={scale ?? 0.012}>
        <group position={[-36, 0, 0]}><Base map /></group>{/* base footprint is x -36..30 m in the CAD: shifted west so its east edge is 6 m clear of the site point, where the rover starts */}
      </group>
    </Suspense>
  );
}

function HabitatSymbol({ surface, xz, scale = 0.011 }) {
  const dish = useRef(), beacon = useRef();
  useFrame(({ clock }) => {
    if (still()) return;
    const t = clock.elapsedTime;
    if (dish.current) dish.current.rotation.y = Math.sin(t * 0.25) * 0.6; // slow tracking sweep
    if (beacon.current) beacon.current.emissiveIntensity = 0.6 + 0.6 * Math.max(0, Math.sin(t * 3));
  });
  const y = surface.y(xz[0], xz[1]);
  return (
    <group position={[xz[0], y, xz[1]]} scale={scale}>
      <group position={[-13, 0, 0]}>{/* drawn west of the site point so the rover, which starts at that point, parks by the airlock */}
      {/* main module: raised drum with dome and ribs */}
      {[0, 1, 2, 3, 4, 5].map((i) => { const a = i * Math.PI / 3; return (
        <mesh key={i} position={[Math.cos(a) * 3.4, 0.35, Math.sin(a) * 3.4]}><cylinderGeometry args={[0.18, 0.25, 0.7, 6]} /><Mat c={C.frame} /></mesh>); })}
      <mesh position={[0, 2.3, 0]}><cylinderGeometry args={[4, 4, 3.2, 32]} /><Mat c={C.shell} /></mesh>
      <mesh position={[0, 3.9, 0]} scale={[1, 0.45, 1]}><sphereGeometry args={[4, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><Mat c={C.shell2} r={0.5} /></mesh>
      {[1.1, 2.3, 3.5].map((h) => <mesh key={h} position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[4.03, 0.07, 6, 48]} /><Mat c={C.frame} /></mesh>)}
      {/* lab module to the west, joined by a tunnel */}
      <mesh position={[-8.5, 1.9, 0]}><cylinderGeometry args={[2.6, 2.6, 2.6, 24]} /><Mat c={C.shell} /></mesh>
      <mesh position={[-8.5, 3.2, 0]} scale={[1, 0.4, 1]}><sphereGeometry args={[2.6, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><Mat c={C.shell2} /></mesh>
      <mesh position={[-5, 1.8, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.9, 0.9, 3, 16]} /><Mat c={C.shell2} /></mesh>
      {/* airlock to the east with a gold-foil hatch */}
      <mesh position={[5.4, 1.6, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[1.25, 1.25, 3, 20]} /><Mat c={C.shell2} /></mesh>
      <mesh position={[6.95, 1.6, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.9, 0.9, 0.12, 20]} /><Mat c={C.foil} r={0.35} m={0.6} /></mesh>
      <mesh position={[7.6, 0.4, 0]}><boxGeometry args={[1.6, 0.15, 2.4]} /><Mat c={C.frame} /></mesh>
      {/* solar field to the south */}
      {[-6, -2, 2, 6].flatMap((x) => [8, 11.5].map((z) => <Panel key={x + ',' + z} position={[x, 0, z]} />))}
      {/* radiators to the north */}
      {[-2.2, 2.2].map((x) => <mesh key={x} position={[x, 2, -7]}><boxGeometry args={[3.4, 3.2, 0.08]} /><Mat c="#eef0f2" r={0.4} /></mesh>)}
      {/* 10 m comms mast (mastM placeholder) with dish and beacon */}
      <group position={[3.5, 0, -4.5]}>
        <mesh position={[0, 5, 0]}><cylinderGeometry args={[0.1, 0.16, 10, 8]} /><Mat c={C.frame} /></mesh>
        <group ref={dish} position={[0, 9.4, 0]}>
          <mesh rotation={[-0.9, 0, 0]} position={[0, 0, 0.3]}><sphereGeometry args={[1.1, 20, 8, 0, Math.PI * 2, 0, 0.9]} /><Mat c={C.shell} side={THREE.DoubleSide} /></mesh>
        </group>
        <mesh position={[0, 10.2, 0]}><sphereGeometry args={[0.28, 12, 8]} /><meshStandardMaterial ref={beacon} color="#e1bdff" emissive={C.accent} emissiveIntensity={0.8} /></mesh>
      </group>
      </group>
    </group>
  );
}

const WHEELS = [-2, 0, 2].flatMap((x) => [-1.55, 1.55].map((z) => [x, z]));

export function RoverModel({ surface, xz, scale = 0.02, mode = 'A', yaw: fixedYaw }) { // yaw given = follow it (Mission view), else turn toward the direction of travel
  const body = useRef(), wheels = useRef([]), last = useRef(null), yaw = useRef(0), spin = useRef(0), at = useRef(xz);
  at.current = xz;
  useFrame((_, dt) => {
    const [x, z] = at.current, g = body.current; if (!g) return;
    g.position.set(x, surface.y(x, z) + scale * 0.1, z); // 2 m clear at symbol scale, 0.17 m at true scale
    const p = last.current; last.current = [x, z]; if (!p) return;
    const dx = x - p[0], dz = z - p[1], d = Math.hypot(dx, dz);
    if (d > 1e-6 || fixedYaw != null) {
      const target = fixedYaw ?? Math.atan2(-dz, dx), k = still() ? 1 : Math.min(1, dt * 6);
      yaw.current += Math.atan2(Math.sin(target - yaw.current), Math.cos(target - yaw.current)) * k; // shortest turn
      spin.current -= d / (0.55 * scale); // wheel radius in km
    }
    g.rotation.y = yaw.current;
    for (const w of wheels.current) if (w) w.rotation.y = spin.current;
  });
  return (
    <group ref={body} scale={scale}>
      <Suspense fallback={<group>
      {/* chassis, rocker arms, six wheels; model faces +x */}
      <mesh position={[0, 0.9, 0]}><boxGeometry args={[5.4, 0.25, 2.4]} /><Mat c={C.frame} /></mesh>
      {[-1.3, 1.3].map((z) => <mesh key={z} position={[0, 0.65, z]}><boxGeometry args={[4.6, 0.12, 0.12]} /><Mat c={C.dark} /></mesh>)}
      {WHEELS.map(([wx, wz], i) => (
        <group key={i} position={[wx, 0.55, wz]} rotation={[Math.PI / 2, 0, 0]}>
          <group ref={(el) => { wheels.current[i] = el; }}>
            <mesh><cylinderGeometry args={[0.55, 0.55, 0.45, 16]} /><Mat c={C.dark} r={0.9} /></mesh>
            <mesh><boxGeometry args={[0.9, 0.47, 0.12]} /><Mat c={C.frame} /></mesh>
          </group>
        </group>
      ))}
      {/* pressurised cabin with a dark windscreen at the front */}
      <mesh position={[-0.3, 1.9, 0]}><boxGeometry args={[4.4, 1.8, 2.2]} /><Mat c={C.shell} /></mesh>
      <mesh position={[2.1, 1.75, 0]} rotation={[0, 0, -0.35]}><boxGeometry args={[0.9, 1.4, 2.1]} /><Mat c={C.glass} r={0.15} m={0.3} /></mesh>
      {[-0.75, 0.75].map((z) => <mesh key={z} position={[2.55, 1.15, z]}><boxGeometry args={[0.05, 0.18, 0.4]} /><meshStandardMaterial color="#ffffff" emissive="#fff4dd" emissiveIntensity={1.2} /></mesh>)}
      {/* rear suitport hatches, roof solar, camera mast, antenna */}
      {[-0.55, 0.55].map((z) => <mesh key={z} position={[-2.53, 1.9, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.38, 0.38, 0.08, 16]} /><Mat c={C.foil} r={0.35} m={0.6} /></mesh>)}
      <mesh position={[-0.6, 2.86, 0]}><boxGeometry args={[3.4, 0.06, 2]} /><Mat c={C.cell} r={0.3} m={0.4} /></mesh>
      <mesh position={[1.3, 3.4, 0.7]}><cylinderGeometry args={[0.05, 0.05, 1.1, 6]} /><Mat c={C.frame} /></mesh>
      <mesh position={[1.3, 4, 0.7]}><boxGeometry args={[0.35, 0.25, 0.5]} /><Mat c={C.dark} /></mesh>
      <mesh position={[-1.8, 3.6, -0.7]}><cylinderGeometry args={[0.02, 0.02, 1.5, 4]} /><Mat c={C.frame} /></mesh>
      </group>}><Cad k={mode} len={5.4} /></Suspense>
    </group>
  );
}

