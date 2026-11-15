// Stage 6: straighten an A* cell path. A waypoint is dropped when the straight segment between its
// neighbours touches no blocked cell and no cell costlier (per km) than the worst cell it replaces,
// and no 50 m sample along it is steeper than the traveller's limit.
import { PLANNER } from './config.js'
import { slopeFactor, cellOf, cellXZ, distKm } from './grid.js'

// Every cell a segment touches (supercover DDA). Corner crossings add both side cells.
export function cellsOnSegment(g, a, b) {
  const gx = (p) => (p[0] + g.W / 2) / g.dx
  const gy = (p) => (p[1] + g.H / 2) / g.dz
  let x0 = gx(a), y0 = gy(a)
  const x1 = gx(b), y1 = gy(b)
  let cx = Math.min(g.w - 1, Math.max(0, Math.floor(x0)))
  let cy = Math.min(g.h - 1, Math.max(0, Math.floor(y0)))
  const ex = Math.min(g.w - 1, Math.max(0, Math.floor(x1)))
  const ey = Math.min(g.h - 1, Math.max(0, Math.floor(y1)))
  const dx = x1 - x0, dy = y1 - y0
  const sx = Math.sign(dx), sy = Math.sign(dy)
  const tdx = sx ? Math.abs(1 / dx) : Infinity
  const tdy = sy ? Math.abs(1 / dy) : Infinity
  let tmx = sx > 0 ? (cx + 1 - x0) * tdx : sx < 0 ? (x0 - cx) * tdx : Infinity
  let tmy = sy > 0 ? (cy + 1 - y0) * tdy : sy < 0 ? (y0 - cy) * tdy : Infinity
  const out = [cy * g.w + cx]
  const push = (x, y) => { if (x >= 0 && y >= 0 && x < g.w && y < g.h) out.push(y * g.w + x) }
  for (let guard = 0; (cx !== ex || cy !== ey) && guard < 4 * (g.w + g.h); guard++) {
    if (Math.abs(tmx - tmy) < 1e-9) { // through a corner: both side cells count
      push(cx + sx, cy)
      push(cx, cy + sy)
      cx += sx; cy += sy; tmx += tdx; tmy += tdy
    } else if (tmx < tmy) { cx += sx; tmx += tdx } else { cy += sy; tmy += tdy }
    if (tmx > 1 + 1e-9 && tmy > 1 + 1e-9 && (cx !== ex || cy !== ey)) { cx = ex; cy = ey } // float guard
    push(cx, cy)
  }
  return out
}

// Bilinear elevation at xz from cell centres.
export function elevAt(g, [x, z]) {
  const fx = Math.min(Math.max((x + g.W / 2) / g.dx - 0.5, 0), g.w - 1)
  const fz = Math.min(Math.max((z + g.H / 2) / g.dz - 0.5, 0), g.h - 1)
  const x0 = Math.floor(fx), z0 = Math.floor(fz)
  const x1 = Math.min(x0 + 1, g.w - 1), z1 = Math.min(z0 + 1, g.h - 1)
  const tx = fx - x0, tz = fz - z0
  const e = (xx, zz) => g.elev[zz * g.w + xx]
  return (e(x0, z0) * (1 - tx) + e(x1, z0) * tx) * (1 - tz) + (e(x0, z1) * (1 - tx) + e(x1, z1) * tx) * tz
}

// Per-km route cost of a cell for this agent; Infinity = blocked.
const perKm = (g, agent, c) => {
  const v = g.slope[c] > agent.limit ? 0 : agent.v[g.cls[c]]
  return v > 0 ? (g.mult ? g.mult[c] : 1) / v : Infinity
}

// Hours (and kWh) to drive a polyline, sampled every sampleKm. Endpoint cells may be blocked
// (a station on a slope): they are driven at the slowest speed, as in stepHours.
export function polylineHours(g, agent, pts, ends, cfg = PLANNER) {
  const step = cfg.straighten.sampleKm
  let hours = 0, kwh = 0
  for (let i = 1; i < pts.length; i++) {
    const L = distKm(pts[i - 1], pts[i])
    const n = Math.max(1, Math.ceil(L / step))
    for (let k = 0; k < n; k++) {
      const p = [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / n, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / n]
      const q = [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * (k + 1)) / n, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * (k + 1)) / n]
      const ds = L / n
      const mid = cellOf(g, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])
      const relax = ends.has(mid)
      let v = g.slope[mid] > agent.limit ? 0 : agent.v[g.cls[mid]]
      if (!(v > 0)) v = relax ? agent.slowest : 0
      const dz = elevAt(g, q) - elevAt(g, p)
      const f = slopeFactor(agent, Number.isFinite(dz) ? dz / (ds * 1000) : 0, relax)
      if (!v || !f) return { hours: Infinity, kwh: Infinity }
      hours += ds / v / f
      kwh += cfg.energy.kwhPerKm * ds + (dz > 0 ? (cfg.energy.climbKwhPer100m * dz) / 100 : 0)
    }
  }
  return { hours, kwh }
}

// Greedy string-pulling. cells = A* cells (from → to); pts = [fromXZ, centres…, toXZ].
// Returns the straightened points, or the original if nothing could be dropped.
export function straightenPath(g, agent, cells, pts, cfg = PLANNER) {
  if (pts.length <= 2) return pts
  const ends = new Set([cells[0], cells[cells.length - 1]])
  const out = [pts[0]]
  let i = 0
  while (i < pts.length - 1) {
    let next = i + 1
    for (let j = pts.length - 1; j > i + 1; j--) {
      let worst = 0
      for (let k = i; k <= j; k++) if (!ends.has(cells[k])) worst = Math.max(worst, perKm(g, agent, cells[k]))
      if (segmentOk(g, agent, pts[i], pts[j], worst, ends, cfg) &&
        polylineHours(g, agent, [pts[i], pts[j]], ends, cfg).hours <= polylineHours(g, agent, pts.slice(i, j + 1), ends, cfg).hours + 1e-12) {
        next = j
        break
      }
    }
    out.push(pts[next])
    i = next
  }
  return out
}

function segmentOk(g, agent, a, b, worst, ends, cfg) {
  for (const c of cellsOnSegment(g, a, b)) {
    if (ends.has(c)) continue
    if (perKm(g, agent, c) > worst + 1e-12) return false // blocked (Infinity) or costlier
  }
  return Number.isFinite(polylineHours(g, agent, [a, b], ends, cfg).hours) // no sample over the slope limit
}

export { cellXZ }
