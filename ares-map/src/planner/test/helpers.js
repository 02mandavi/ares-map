// Small made-up grids where the right answer is obvious.
import { CLASSES, CLS } from '../config.js'

export const LIMITS = { rover: 20, walk: 15 }

// w × h cells of `cellKm`; elev(x, y) in metres; cls(x, y) a class name. Slope is set from elev.
export function testGrid(w, h, { cellKm = 0.2, elev = () => 0, cls = () => 'smooth', vis = null } = {}) {
  const n = w * h
  const e = new Float32Array(n)
  const c = new Uint8Array(n)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    e[y * w + x] = elev(x, y)
    c[y * w + x] = CLS[cls(x, y)]
  }
  const s = new Float32Array(n)
  const at = (x, y) => e[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = (at(x + 1, y) - at(x - 1, y)) / (2 * cellKm * 1000)
    const gz = (at(x, y + 1) - at(x, y - 1)) / (2 * cellKm * 1000)
    s[y * w + x] = (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI
  }
  const g = { w, h, dx: cellKm, dz: cellKm, W: w * cellKm, H: h * cellKm, elev: e, slope: s, cls: c, vis }
  // the site-shaped object the live MW() expects
  g.site = { meta: { dem: { w, h } }, W: g.W, H: g.H, dem: e }
  return g
}

export const idx = (g, x, y) => y * g.w + x
export const xzOf = (g, x, y) => [(x + 0.5) * g.dx - g.W / 2, (y + 0.5) * g.dz - g.H / 2]
export { CLASSES }

// deterministic pseudo-random numbers for the equivalence test
export function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}
