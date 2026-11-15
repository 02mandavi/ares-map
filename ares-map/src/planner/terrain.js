// Per-cell inputs to the planner: slope, ground class, radio visibility, site geometry.
// Pure functions on plain arrays. Image sampling (THEMIS / CTX pixels) is done by the caller.
import { CLS } from './config.js'

export const MARS_R_KM = 3396.19 // aS in the live build
export const HABITAT = { lon: 319.77, lat: 28.43 } // dS
export const CRATER = { lon: 319.54, lat: 28.425, rKm: 7.65 } // fS
export const TROUGH = { rIn: 9, rOut: 11, fromDeg: -40, toDeg: 40 } // pS

// oS (minus the fetch): site.json + dem.json → the site object the app uses.
export function makeSite(meta, demArray) {
  const dem = Float32Array.from(demArray, (v) => v ?? NaN)
  if (dem.length !== meta.dem.w * meta.dem.h) throw Error(`dem.json has ${dem.length} cells, site.json expects ${meta.dem.w * meta.dem.h}`)
  const b = meta.bounds
  const W = meta.widthKm
  const H = meta.heightKm
  const lon0 = (b.w + b.e) / 2
  const lat0 = (b.n + b.s) / 2
  const kx = W / (b.e - b.w)
  const kz = H / (b.n - b.s)
  const { w, h } = meta.dem
  const cell = (x, y) => {
    x = Math.min(Math.max(x - 0.5, 0), w - 1)
    y = Math.min(Math.max(y - 0.5, 0), h - 1)
    const x0 = Math.floor(x), y0 = Math.floor(y)
    const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1)
    const fx = x - x0, fy = y - y0
    return (dem[y0 * w + x0] * (1 - fx) + dem[y0 * w + x1] * fx) * (1 - fy) + (dem[y1 * w + x0] * (1 - fx) + dem[y1 * w + x1] * fx) * fy
  }
  return {
    meta, dem, W, H,
    toXZ: (lon, lat) => [(lon - lon0) * kx, -(lat - lat0) * kz],
    toLonLat: (x, z) => [x / kx + lon0, -z / kz + lat0],
    elevXZ: (x, z) => cell((x / W + 0.5) * w, (z / H + 0.5) * h),
    cell,
    base: meta.dem.min,
  }
}

const cellKm = (site) => [site.W / site.meta.dem.w, site.H / site.meta.dem.h] // vC

// yC: central-difference slope in degrees (direction-free).
export function slopes(site) {
  const { w, h } = site.meta.dem
  const [dx, dz] = cellKm(site)
  const at = (x, y) => site.dem[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = (at(x + 1, y) - at(x - 1, y)) / (2 * dx * 1000)
      const gz = (at(x, y + 1) - at(x, y - 1)) / (2 * dz * 1000)
      out[y * w + x] = (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI
    }
  }
  return out
}

// IC: value at fraction p of the sorted array.
export const percentile = (arr, p) => {
  const s = Float32Array.from(arr).sort()
  return s[Math.floor(p * (s.length - 1))]
}

// RC: ground class per cell, first match wins.
// night = THEMIS night IR brightness per cell, texture = CTX std-dev per cell,
// missing = 1 where CTX has no data. Percentiles are of this one site (see PLANNER_TODO.md).
export function classify(site, { night, texture, missing }, slope, limits) {
  const { w, h } = site.meta.dem
  const loose = percentile(night, 0.2)
  const rocky = percentile(night, 0.8)
  const rough = percentile(texture, 0.85)
  const [cx, cz] = site.toXZ(CRATER.lon, CRATER.lat)
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const px = ((x + 0.5) / w) * site.W - site.W / 2
      const pz = ((y + 0.5) / h) * site.H - site.H / 2
      const r = Math.hypot(px - cx, pz - cz)
      const deg = (Math.atan2(pz - cz, px - cx) * 180) / Math.PI
      out[i] = missing[i] ? CLS.unknown
        : r >= TROUGH.rIn && r <= TROUGH.rOut && deg >= TROUGH.fromDeg && deg <= TROUGH.toDeg ? CLS.trough
        : slope[i] > limits.rover ? CLS.steep
        : night[i] <= loose ? CLS.loose
        : texture[i] >= rough ? CLS.rough
        : night[i] >= rocky ? CLS.rocky
        : CLS.smooth
    }
  }
  return out
}

// wC: 1 where a cell (2 m antenna) sees the habitat mast, 0 = radio shadow. Includes Mars curvature.
export function visibility(site, habXZ, mastM) {
  const { w, h } = site.meta.dem
  const [dx, dz] = cellKm(site)
  const sx = (habXZ[0] / site.W + 0.5) * w
  const sz = (habXZ[1] / site.H + 0.5) * h
  const eye = site.cell(sx, sz) + mastM
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5, pz = y + 0.5
      const d = Math.hypot((px - sx) * dx, (pz - sz) * dz)
      if (d < 0.3) { out[y * w + x] = 1; continue }
      const n = Math.ceil(d / 0.08)
      let horizon = -Infinity
      for (let k = 1; k < n; k++) {
        const t = k / n
        const m = d * t * 1000
        horizon = Math.max(horizon, (site.cell(sx + (px - sx) * t, sz + (pz - sz) * t) - eye) / m - m / (2 * MARS_R_KM * 1000))
      }
      const m = d * 1000
      out[y * w + x] = +((site.cell(px, pz) + 2 - eye) / m - m / (2 * MARS_R_KM * 1000) >= horizon)
    }
  }
  return out
}
