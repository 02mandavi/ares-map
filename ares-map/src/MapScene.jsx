import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MapControls, Line, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { densify, circle } from './geo.js';
import { colorize } from './layers.js';
import { Habitat, RoverModel } from './models.jsx';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lift = 0.012; // km above ground for draped lines
const hasWebGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();

function Terrain({ site, surface, texture, onPick }) {
  const geo = useMemo(() => {
    const { w, h } = site.meta.dem, g = new THREE.PlaneGeometry(site.W, site.H, 2 * w - 1, 2 * h - 1); // two vertices per DEM cell so the ground curves between samples
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, surface.y(p.getX(k), p.getZ(k)));
    g.computeVertexNormals(); return g;
  }, [site, surface]);
  return (
    <mesh geometry={geo} onPointerDown={onPick && ((e) => { e.stopPropagation(); onPick([e.point.x, e.point.z]); })}>
      <meshStandardMaterial map={texture} roughness={1} metalness={0} />
    </mesh>
  );
}

function Hirise({ site, surface, item }) {
  const tex = useTexture(`data/${item.id}.jpg`);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const map = useMemo(() => { // Mars colour (MARS_COLOR); the grey strip stays the alpha map so its black border still drops out
    const t = new THREE.CanvasTexture(colorize(tex.image, undefined, { floor: 2 }));
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }, [tex]);
  useEffect(() => () => map.dispose(), [map]);
  const geo = useMemo(() => {
    const b = item.bounds, [x0, z0] = site.toXZ(b.w, b.n), [x1, z1] = site.toXZ(b.e, b.s);
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 30, 120); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, surface.y(p.getX(k), p.getZ(k)) + 0.004);
    g.computeVertexNormals(); return g;
  }, [site, surface, item]);
  return <mesh geometry={geo}><meshStandardMaterial map={map} alphaMap={tex} alphaTest={0.008} roughness={1} polygonOffset polygonOffsetFactor={-2} />{/* black no-data border of the map-projected strip drops out */}</mesh>;
}

export function Draped({ surface, pts, color, width = 2, dashed, opacity = 1, step, lift: up = lift }) {
  const p3 = useMemo(() => densify(pts, step).map(([x, z]) => [x, surface.y(x, z) + up, z]), [pts, surface, step, up]);
  if (p3.length < 2) return null;
  return <Line points={p3} color={color} lineWidth={width} dashed={dashed} dashSize={0.25} gapSize={0.18} transparent opacity={opacity} />;
}

export function Label({ surface, xz, children, tone }) { // a short note pinned to the ground, e.g. "no route found"; tone 'base' = the habitat marker
  const box = useThree((st) => st.gl.domElement.parentNode.parentNode); // the .scene div: a fixed target, else drei re-roots when the event source connects and the label renders empty
  return <Html portal={{ current: box }} position={[xz[0], surface.y(xz[0], xz[1]) + 0.3, xz[1]]} center className={'map-label' + (tone ? ' is-' + tone : '')}>{children}</Html>;
}

export function Ring({ surface, c, r, ...rest }) {
  const pts = useMemo(() => circle(c, r), [c, r]);
  return r > 0 ? <Draped surface={surface} pts={pts} step={0.3} {...rest} /> : null;
}

export function Rover({ surface, xz, errKm, mode, scale, yaw }) {
  return (
    <group>
      <RoverModel surface={surface} xz={xz} mode={mode} scale={scale} yaw={yaw} />
      {errKm > 0.02 && <Ring surface={surface} c={xz} r={errKm} color="#f7f9fa" width={1.5} dashed opacity={0.8} />}
    </group>
  );
}

function Pin({ surface, xz, active }) {
  const y = surface.y(xz[0], xz[1]);
  return <Line points={[[xz[0], y, xz[1]], [xz[0], y + 0.45, xz[1]]]} color={active ? '#af50ff' : '#f7f9fa'} lineWidth={active ? 2.5 : 1.5} />;
}

// Moves the DOM pin buttons (outside the canvas) to their projected 3D anchors every frame.
function ProjectPins({ pins, els, surface }) {
  const { camera, size } = useThree(), v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const p of pins) {
      const el = els.current[p.id]; if (!el) continue;
      v.set(p.xz[0], surface.y(p.xz[0], p.xz[1]) + 0.45, p.xz[1]).project(camera);
      const off = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
      el.style.visibility = off ? 'hidden' : 'visible';
      el.style.transform = `translate(${(v.x + 1) / 2 * size.width}px, ${(1 - v.y) / 2 * size.height}px) translate(-50%, -50%)`;
    }
  });
  return null;
}

function CameraRig({ api, onUserMove }) {
  const { camera, controls, gl, scene } = useThree();
  const anim = useRef(null);
  useEffect(() => {
    api.current = {
      fly(pos, look, ms = 1100) { // starts on the next frame that has controls, so calls made during mount are not lost
        anim.current = { p1: new THREE.Vector3(...pos), t1: new THREE.Vector3(...look), ms: reduceMotion() ? 0 : ms };
      },
      capture(labels = []) { // canvas image plus station labels (the on-screen pins are HTML, not in the canvas)
        gl.render(scene, camera);
        const src = gl.domElement, c = Object.assign(document.createElement('canvas'), { width: src.width, height: src.height }), g = c.getContext('2d');
        g.drawImage(src, 0, 0); g.font = `600 ${Math.round(src.height / 45)}px "JetBrains Mono", monospace`; g.textBaseline = 'middle';
        for (const l of labels) {
          const v = new THREE.Vector3(...l.xyz).project(camera), x = (v.x + 1) / 2 * src.width, y = (1 - v.y) / 2 * src.height, w = g.measureText(l.text).width + 12, h = src.height / 30;
          g.fillStyle = '#090909'; g.fillRect(x - w / 2, y - h / 2, w, h); g.strokeStyle = '#f7f9fa'; g.strokeRect(x - w / 2, y - h / 2, w, h);
          g.fillStyle = '#f7f9fa'; g.textAlign = 'center'; g.fillText(l.text, x, y);
        }
        return c.toDataURL('image/png');
      },
    };
    if (api.pending) { api.current.fly(...api.pending); api.pending = null; } // a fly asked for before the canvas mounted
  }, [api, camera, gl, scene]);
  useEffect(() => {
    if (!controls) return;
    const stop = () => { anim.current = null; onUserMove?.(); };
    controls.addEventListener('start', stop); return () => controls.removeEventListener('start', stop);
  }, [controls, onUserMove]);
  useFrame(() => {
    const a = anim.current; if (!a || !controls) return;
    if (!a.p0) Object.assign(a, { p0: camera.position.clone(), t0: controls.target.clone(), s: performance.now() });
    const k = a.ms ? Math.min(1, (performance.now() - a.s) / a.ms) : 1, e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
    camera.position.lerpVectors(a.p0, a.p1, e); controls.target.lerpVectors(a.t0, a.t1, e); controls.update();
    if (k === 1) anim.current = null;
  });
  return null;
}

export default function MapScene({ site, surface, texture, habXZ, pins, activePin, onPin, hirise, children, rig, onPick, pov, onUserMove, spin, close }) {
  const pinEls = useRef({});
  if (!hasWebGL) return <p className="empty no-gl" role="alert">The 3D map needs WebGL, which this browser or device has switched off. Open the link in a current Chrome, Edge or Firefox with hardware acceleration on.</p>;
  return (
    <>
    <Canvas className="scene" gl={{ preserveDrawingBuffer: true, antialias: true }} dpr={[1, 2]}
      camera={{ position: [10, 16, 22], fov: 40, near: 0.0005, far: 400 }} onCreated={({ gl }) => gl.setClearColor('#090909', 0)}>
      {(pov || close) && <color attach="background" args={['#3a2a22']} />}
      {(pov || close) && <fog attach="fog" args={['#6b4a3a', 2, 30]} />}
      <hemisphereLight args={['#f2e6dc', '#1a1512', 0.9]} />
      <directionalLight position={[-20, 12, 6]} intensity={1.6} />
      <Terrain site={site} surface={surface} texture={texture} onPick={onPick} />
      <Suspense fallback={null}>{hirise.map((h) => <Hirise key={h.id} site={site} surface={surface} item={h} />)}</Suspense>
      <Habitat surface={surface} xz={habXZ} scale={close ? 0.001 : undefined} />{/* true metres in the Mission view */}
      {!pov && pins.map((p) => <Pin key={p.id} surface={surface} xz={p.xz} active={activePin === p.id} />)}
      <ProjectPins pins={pov ? [] : pins} els={pinEls} surface={surface} />
      {!pov && children}
      <MapControls makeDefault enabled={!pov} autoRotate={spin && !reduceMotion()} autoRotateSpeed={0.35} maxPolarAngle={close ? Math.PI / 2 : Math.PI / 2.15} minDistance={close ? 0.005 : 0.3} maxDistance={70} enableDamping dampingFactor={0.12} />
      <CameraRig api={rig} onUserMove={onUserMove} />
    </Canvas>
    {!pov && (
      <div className="pins">
        {pins.map((p) => (
          <button key={p.id} ref={(el) => { pinEls.current[p.id] = el; }} className={'pin' + (activePin === p.id ? ' is-active' : '')}
            aria-pressed={activePin === p.id} aria-label={`Station ${p.id} ${p.name ?? ''}`} onClick={() => onPin(p.id)}>{p.id}</button>
        ))}
      </div>
    )}
    </>
  );
}
