// Grid, travellers, step time, Dijkstra home maps, A*, contours.
// Pure functions: no React, no Three.js. Recovered from the live build (bundle names in comments).

import { PLANNER } from './config.js'

export const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]

const toblerFlat = () => Math.exp(-PLANNER.tobler.b * PLANNER.tobler.c)

// CW: a traveller's speed per class (km/h), slope limit and top speed (for the heuristic).
// factors (Stage 4): per-class multiplier, e.g. PLANNER.pessimistic.value for bad ground.
export function makeAgent(kind, classes, limits, roverKmh = PLANNER.roverRefKmh.value, factors = null) {
  const row = PLANNER.speedKmh[kind]
  const scale = kind === 'rover' ? roverKmh / PLANNER.roverRefKmh.value : 1
  const v = classes.map((c) => row[c] * scale * (factors?.[c] ?? 1))
  const limit = kind === 'foot' ? limits.walk : limits.rover
  const downhillBoost = kind === 'foot' ? 1 / toblerFlat() : 1
  return {
    kind,
    v,
    slowest: Math.min(...v.filter((x) => x > 0)),
    limit,
    vMax: Math.max(...v) * downhillBoost,
  }
}

// wW: speed factor for a step with grade = rise / run (signed). 0 = blocked.
export function slopeFactor(agent, grade, allowSteep = false) {
  const deg = (Math.atan(Math.abs(grade)) * 180) / Math.PI
  if (deg > agent.limit && !allowSteep) return 0
  if (agent.kind === 'foot') {
    const g = Math.sign(grade) * Math.min(Math.abs(grade), Math.tan((agent.limit * Math.PI) / 180))
    return Math.exp(-PLANNER.tobler.b * Math.abs(g + PLANNER.tobler.c)) / toblerFlat()
  }
  return 1 - ((1 - PLANNER.roverSlopeFloor.value) * Math.min(deg, agent.limit)) / agent.limit
}

export const stepKm = (g, a, b) =>
  Math.hypot(((b % g.w) - (a % g.w)) * g.dx, (Math.floor(b / g.w) - Math.floor(a / g.w)) * g.dz)

// TW: hours to step from cell a to the neighbouring cell b. relaxA/relaxB let a blocked
// start or end cell be entered at the traveller's slowest speed (a station can sit on a slope).
export function stepHours(g, agent, a, b, relaxA = false, relaxB = false) {
  const km = stepKm(g, a, b)
  const speed = (c, relax) => {
    const v = g.slope[c] > agent.limit ? 0 : agent.v[g.cls[c]]
    return v > 0 ? v : relax ? agent.slowest : 0
  }
  const va = speed(a, relaxA)
  const vb = speed(b, relaxB)
  if (!va || !vb) return Infinity
  const dz = g.elev[b] - g.elev[a]
  const f = slopeFactor(agent, Number.isFinite(dz) ? dz / (km * 1000) : 0, relaxA || relaxB)
  return f ? (km * (0.5 / va + 0.5 / vb)) / f : Infinity
}

// Stage 4: route cost of a step = its time × the mean of the two cells' cost multipliers
// (g.mult: HiRISE bonus, edge setback, radio shadow). No g.mult → cost = time.
export const stepCost = (g, hours, a, b) => (g.mult ? hours * 0.5 * (g.mult[a] + g.mult[b]) : hours)

// EW: binary min-heap of [key, cell].
export function heap() {
  const a = []
  return {
    get size() { return a.length },
    push(x) {
      a.push(x)
      let i = a.length - 1
      while (i) {
        const p = (i - 1) >> 1
        if (a[p][0] <= x[0]) break
        a[i] = a[p]
        i = p
      }
      a[i] = x
    },
    pop() {
      const top = a[0]
      const last = a.pop()
      if (a.length) {
        let i = 0
        for (;;) {
          let c = 2 * i + 1
          if (c >= a.length) break
          if (c + 1 < a.length && a[c + 1][0] < a[c][0]) c++
          if (a[c][0] >= last[0]) break
          a[i] = a[c]
          i = c
        }
        a[i] = last
      }
      return top
    },
  }
}

// DW: call fn for each in-grid 8-neighbour of cell c.
export function eachNeighbour(g, c, fn) {
  const x = c % g.w
  const y = (c - x) / g.w
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = x + dx
    const ny = y + dy
    if (nx >= 0 && ny >= 0 && nx < g.w && ny < g.h) fn(ny * g.w + nx)
  }
}

// OW: Dijkstra from `home` on route cost. dir 'to' = from every cell to home; 'from' = home → cell.
// t = hours along the cheapest route, cost = its route cost (equal when g.mult is absent).
export function homeMap(g, agent, home, dir = 'to') {
  const n = g.w * g.h
  const t = new Float64Array(n).fill(Infinity)
  const cost = g.mult ? new Float64Array(n).fill(Infinity) : t
  const q = heap()
  t[home] = 0
  cost[home] = 0
  q.push([0, home])
  while (q.size) {
    const [d, c] = q.pop()
    if (d > cost[c]) continue
    eachNeighbour(g, c, (m) => {
      const s = dir === 'to' ? stepHours(g, agent, m, c, false, c === home) : stepHours(g, agent, c, m, c === home, false)
      const k = d + stepCost(g, s, m, c)
      if (k < cost[m]) {
        if (cost !== t) t[m] = t[c] + s
        cost[m] = k
        q.push([k, m])
      }
    })
  }
  return { t, cost, home, dir, agent }
}

// kW: hours home from cell c; a blocked cell (a station on a slope) reads through its cheapest neighbour.
export function mapAt(g, map, c) {
  if (Number.isFinite(map.t[c]) || c === map.home) return map.t[c]
  let best = Infinity
  let hours = Infinity
  eachNeighbour(g, c, (m) => {
    const s = map.dir === 'to' ? stepHours(g, map.agent, c, m, true, m === map.home) : stepHours(g, map.agent, m, c, m === map.home, true)
    const k = stepCost(g, s, c, m) + map.cost[m]
    if (k < best) {
      best = k
      hours = s + map.t[m]
    }
  })
  return hours
}

// AW: A* on route cost from cell a to cell b. If `exact` is a 'to' home map whose home is b,
// its cost is the (exact) heuristic; otherwise straight line / top speed × the cheapest multiplier.
export function astar(g, agent, a, b, exact = null) {
  const n = g.w * g.h
  const dist = new Float64Array(n).fill(Infinity)
  const hours = g.mult ? new Float64Array(n).fill(Infinity) : dist
  const prev = new Int32Array(n).fill(-1)
  const done = new Uint8Array(n)
  const minMult = g.minMult ?? 1
  const h = exact?.home === b
    ? (c) => (Number.isFinite(exact.cost[c]) ? exact.cost[c] : 0)
    : (c) => (Math.hypot(((c % g.w) - (b % g.w)) * g.dx, (Math.floor(c / g.w) - Math.floor(b / g.w)) * g.dz) / agent.vMax) * minMult
  const q = heap()
  dist[a] = 0
  hours[a] = 0
  q.push([h(a), a])
  while (q.size) {
    const [, c] = q.pop()
    if (done[c]) continue
    done[c] = 1
    if (c === b) break
    eachNeighbour(g, c, (m) => {
      if (done[m]) return
      const s = stepHours(g, agent, c, m, c === a, m === b)
      const d = dist[c] + stepCost(g, s, c, m)
      if (d < dist[m]) {
        if (hours !== dist) hours[m] = hours[c] + s
        dist[m] = d
        prev[m] = c
        q.push([d + h(m), m])
      }
    })
  }
  if (dist[b] === Infinity) return null
  const cells = []
  for (let c = b; c !== -1; c = prev[c]) cells.push(c)
  return { cells: cells.reverse(), hours: hours[b], cost: dist[b] }
}

// Hours for the same agent to drive a given cell path (used for the bad-ground time of a leg).
export function pathHours(g, agent, cells) {
  let h = 0
  for (let i = 1; i < cells.length; i++) h += stepHours(g, agent, cells[i - 1], cells[i], i === 1, i === cells.length - 1)
  return h
}

// jW: marching squares on cell centres; returns polylines in grid units where value = level.
export function contours(g, values, level) {
  const { w, h } = g
  const at = (x, y) => {
    const v = values[y * w + x]
    return Number.isFinite(v) ? v : 1e9
  }
  const lerp = (p, q, vp, vq) => {
    const t = Math.min(1, Math.max(0, (level - vp) / (vq - vp)))
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
  }
  const segs = []
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const p = [[x + 0.5, y + 0.5], [x + 1.5, y + 0.5], [x + 1.5, y + 1.5], [x + 0.5, y + 1.5]]
      const v = [at(x, y), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1)]
      const hits = []
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4
        if ((v[i] <= level) !== (v[j] <= level)) hits.push(lerp(p[i], p[j], v[i], v[j]))
      }
      if (hits.length === 2) segs.push(hits)
      else if (hits.length === 4) segs.push([hits[0], hits[1]], [hits[2], hits[3]])
    }
  }
  const key = (p) => p[0].toFixed(4) + ',' + p[1].toFixed(4)
  const byEnd = new Map()
  segs.forEach((s, i) => s.forEach((p) => {
    const k = key(p)
    if (!byEnd.has(k)) byEnd.set(k, [])
    byEnd.get(k).push(i)
  }))
  const used = new Uint8Array(segs.length)
  const lines = []
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue
    used[i] = 1
    const line = [...segs[i]]
    for (const atStart of [false, true]) {
      for (;;) {
        const end = atStart ? line[0] : line[line.length - 1]
        const next = byEnd.get(key(end)).find((k) => !used[k])
        if (next === undefined) break
        used[next] = 1
        const [p, q] = segs[next]
        const other = key(p) === key(end) ? q : p
        if (atStart) line.unshift(other)
        else line.push(other)
      }
    }
    lines.push(line)
  }
  return lines
}

// MW: planner grid from the loaded site (site.meta.dem, site.dem, site.W/H in km).
export function makeGrid(site, cls, slope, vis = null) {
  const { w, h } = site.meta.dem
  return { w, h, dx: site.W / w, dz: site.H / h, W: site.W, H: site.H, elev: site.dem, slope, cls, vis }
}

// NW / PW / FW: map xz (km, origin at the box centre) ↔ cell index ↔ grid units.
export const cellOf = (g, xz) =>
  Math.min(g.h - 1, Math.max(0, Math.floor(xz[1] / g.dz + g.h / 2))) * g.w +
  Math.min(g.w - 1, Math.max(0, Math.floor(xz[0] / g.dx + g.w / 2)))
export const cellXZ = (g, c) => [((c % g.w) + 0.5) * g.dx - g.W / 2, (Math.floor(c / g.w) + 0.5) * g.dz - g.H / 2]
export const gridToXZ = (g, [x, y]) => [x * g.dx - g.W / 2, y * g.dz - g.H / 2]
export const distKm = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])
