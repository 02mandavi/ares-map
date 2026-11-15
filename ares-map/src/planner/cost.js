// Stage 4: route-cost field (HiRISE bonus, edge setback, radio shadow) and energy. Pure functions.
import { PLANNER, CLS } from './config.js'
import { eachNeighbour, heap, stepKm, cellOf, distKm } from './grid.js'

// 1 where the cell centre lies inside a HiRISE strip (site.json hirise[].bounds).
export function hiriseMask(site) {
  const { w, h } = site.meta.dem
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [lon, lat] = site.toLonLat(((x + 0.5) / w) * site.W - site.W / 2, ((y + 0.5) / h) * site.H - site.H / 2)
    out[y * w + x] = site.meta.hirise?.some((s) => lon >= s.bounds.w && lon <= s.bounds.e && lat >= s.bounds.s && lat <= s.bounds.n) ? 1 : 0
  }
  return out
}

// Mark the cells a polyline (xz km) passes through, sampled every 50 m.
export function markPolyline(g, mask, pts, stepKmSample = 0.05) {
  for (let i = 1; i < pts.length; i++) {
    const n = Math.max(1, Math.ceil(distKm(pts[i - 1], pts[i]) / stepKmSample))
    for (let k = 0; k <= n; k++) {
      const t = k / n
      mask[cellOf(g, [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t])] = 1
    }
  }
  return mask
}

// Edge cells: trough band (class), rim crest ring round the crater, and traced cracks (xz polylines).
export function edgeMask(g, { craterXZ = null, cracks = [] } = {}) {
  const mask = new Uint8Array(g.w * g.h)
  const { rInKm, rOutKm } = PLANNER.rimCrest
  for (let c = 0; c < mask.length; c++) {
    if (g.cls[c] === CLS.trough) mask[c] = 1
    if (craterXZ) {
      const x = ((c % g.w) + 0.5) * g.dx - g.W / 2
      const z = (Math.floor(c / g.w) + 0.5) * g.dz - g.H / 2
      const r = Math.hypot(x - craterXZ[0], z - craterXZ[1])
      if (r >= rInKm && r <= rOutKm) mask[c] = 1
    }
  }
  for (const line of cracks) markPolyline(g, mask, line)
  return mask
}

// km from every cell to the nearest masked cell (8-connected chamfer distance, Dijkstra).
export function distanceMap(g, mask) {
  const d = new Float64Array(g.w * g.h).fill(Infinity)
  const q = heap()
  for (let c = 0; c < mask.length; c++) if (mask[c]) { d[c] = 0; q.push([0, c]) }
  while (q.size) {
    const [k, c] = q.pop()
    if (k > d[c]) continue
    eachNeighbour(g, c, (m) => {
      const v = k + stepKm(g, c, m)
      if (v < d[m]) { d[m] = v; q.push([v, m]) }
    })
  }
  return d
}

// The per-cell cost multiplier the router uses (time is never changed by it).
export function costField(g, { hirise = null, edgeDist = null, vis = null, relay = false, cfg = PLANNER } = {}) {
  const n = g.w * g.h
  const mult = new Float64Array(n)
  const bonus = cfg.hiriseBonus.value
  const { km: setback, penalty } = cfg.edgeSetback
  const radio = cfg.radioShadow.costPerMin
  for (let c = 0; c < n; c++) {
    let m = hirise?.[c] ? 1 - bonus : 1
    if (edgeDist && setback > 0) m *= 1 + penalty * Math.max(0, 1 - edgeDist[c] / setback)
    if (vis && !relay && !vis[c]) m += radio // cost-minutes per minute in shadow
    mult[c] = m
  }
  return { mult, minMult: hirise ? 1 - bonus : 1 }
}

// Rover energy along a cell path: kWh/km × distance + climb term per 100 m of ascent.
export function pathEnergyKwh(g, cells, cfg = PLANNER.energy) {
  let kwh = 0
  for (let i = 1; i < cells.length; i++) {
    const dz = g.elev[cells[i]] - g.elev[cells[i - 1]]
    kwh += cfg.kwhPerKm * stepKm(g, cells[i - 1], cells[i]) + (Number.isFinite(dz) && dz > 0 ? (cfg.climbKwhPer100m * dz) / 100 : 0)
  }
  return kwh
}

// Is there charge for the plan? socPct = rover state of charge now (Vitals).
export function energyCheck(kwh, socPct, cfg = PLANNER.energy) {
  const endPct = socPct - (100 * kwh) / cfg.packKwh
  return { kwh, startPct: socPct, endPct, floorPct: cfg.floorPct, ok: endPct >= cfg.floorPct }
}
