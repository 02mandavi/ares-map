// LW: build the planner for one grid, slope limits, rover speed setting and habitat position.
// opts.cost     = costField(...) result: route cost multipliers (Stage 4). Times are never changed by it.
// opts.pessimistic = per-class speed factors for "if the ground is bad" (Stage 4; null = off).
// opts.straighten = false keeps raw cell-centre paths (Stage 6 is on by default).
import { PLANNER } from './config.js'
import { makeAgent, homeMap, mapAt, astar, pathHours, contours, cellOf, cellXZ, gridToXZ, distKm } from './grid.js'
import { pathEnergyKwh } from './cost.js'
import { straightenPath, polylineHours } from './straighten.js'

export function buildPlanner(g0, classes, limits, roverKmh, habXZ, opts = {}) {
  const g = opts.cost ? { ...g0, mult: opts.cost.mult, minMult: opts.cost.minMult } : g0
  const bad = opts.pessimistic === undefined ? PLANNER.pessimistic.value : opts.pessimistic
  const home = cellOf(g, habXZ)
  const unknown = classes.indexOf('unknown')
  const agents = {
    rover: makeAgent('rover', classes, limits, roverKmh),
    foot: makeAgent('foot', classes, limits),
    robot: makeAgent('robot', classes, limits),
  }
  const badAgents = bad
    ? { rover: makeAgent('rover', classes, limits, roverKmh, bad), foot: makeAgent('foot', classes, limits, undefined, bad) }
    : agents
  // Each time-to-home map is a full Dijkstra, so it is built the first time something reads it
  // (a field replan needs only roverTo and roverToBad).
  const maps = {}
  const lazy = (obj, name, make) => {
    let v
    Object.defineProperty(obj, name, { enumerable: true, get: () => v ?? (v = make()) })
  }
  lazy(maps, 'roverTo', () => homeMap(g, agents.rover, home, 'to'))
  lazy(maps, 'roverFrom', () => homeMap(g, agents.rover, home, 'from'))
  lazy(maps, 'footTo', () => homeMap(g, agents.foot, home, 'to'))
  lazy(maps, 'roverToBad', () => (bad ? homeMap(g, badAgents.rover, home, 'to') : maps.roverTo))
  lazy(maps, 'roverFromBad', () => (bad ? homeMap(g, badAgents.rover, home, 'from') : maps.roverFrom))
  lazy(maps, 'footToBad', () => (bad ? homeMap(g, badAgents.foot, home, 'to') : maps.footTo))
  const read = (map, xz) => mapAt(g, map, cellOf(g, xz))

  // A leg is routed on expected route cost; its bad-ground time is the same path at bad speeds.
  function leg(kind, fromXZ, toXZ) {
    const a = cellOf(g, fromXZ)
    const b = cellOf(g, toXZ)
    const exact = kind === 'rover' ? maps.roverTo : kind === 'foot' ? maps.footTo : null
    const r = astar(g, agents[kind], a, b, exact)
    if (!r) {
      return { pts: [fromXZ, toXZ], km: distKm(fromXZ, toXZ), kmStraight: distKm(fromXZ, toXZ), hours: NaN, hoursBad: NaN, energyKwh: 0, maxSlope: NaN, unknown: 1, shadowH: 0, blocked: true }
    }
    return describe(kind, fromXZ, toXZ, r.cells, r.hours)
  }

  function describe(kind, fromXZ, toXZ, cells, hours) {
    const raw = [fromXZ, ...cells.slice(1, -1).map((c) => cellXZ(g, c)), toXZ]
    let pts = raw
    let hoursBad = badAgents[kind] ? pathHours(g, badAgents[kind], cells) : hours
    let energyKwh = kind === 'rover' ? pathEnergyKwh(g, cells) : 0
    if (opts.straighten !== false && raw.length > 2) {
      // Stage 6: time of the straightened path = A* time × (sampled time straight / sampled time raw),
      // so legs stay consistent with the time-to-home maps.
      const sp = straightenPath(g, agents[kind], cells, raw)
      if (sp.length < raw.length) {
        const ends = new Set([cells[0], cells[cells.length - 1]])
        const ratio = (agent) => polylineHours(g, agent, sp, ends).hours / polylineHours(g, agent, raw, ends).hours
        const k = ratio(agents[kind])
        const kb = badAgents[kind] ? ratio(badAgents[kind]) : k
        if (Number.isFinite(k) && Number.isFinite(kb) && k <= 1 + 1e-9 && kb <= 1 + 1e-9) { // no slower, hopeful or bad
          pts = sp
          hours *= k
          hoursBad *= kb
          if (kind === 'rover') energyKwh = polylineHours(g, agents.rover, sp, ends).kwh
        }
      }
    }
    let km = 0
    for (let i = 1; i < pts.length; i++) km += distKm(pts[i - 1], pts[i])
    const shadowCells = g.vis ? cells.filter((c) => !g.vis[c]).length / cells.length : 0
    return {
      pts,
      rawPts: raw,
      cells,
      km,
      kmStraight: distKm(fromXZ, toXZ),
      hours,
      hoursBad,
      energyKwh,
      maxSlope: Math.max(...cells.map((c) => g.slope[c])),
      unknown: cells.filter((c) => g.cls[c] === unknown).length / cells.length,
      shadowH: hours * shadowCells,
      blocked: false,
    }
  }

  const legs = (kind, stops) => {
    const pts = [habXZ, ...stops.map((s) => s.xz), habXZ]
    return pts.slice(1).map((p, i) => leg(kind, pts[i], p))
  }
  const add = (a, b) => a.map((x, i) => x + b[i])
  const lines = (values, level) => (level > 0 ? contours(g, values, level).map((l) => l.map((p) => gridToXZ(g, p))) : [])
  const vals = {}
  lazy(vals, 'reach', () => add(maps.roverFrom.t, maps.roverTo.t))
  lazy(vals, 'walk', () => add(maps.roverFrom.t, maps.footTo.t))
  lazy(vals, 'reachBad', () => add(maps.roverFromBad.t, maps.roverToBad.t))
  lazy(vals, 'walkBad', () => add(maps.roverFromBad.t, maps.footToBad.t))

  return {
    grid: g,
    home,
    agents,
    badAgents,
    maps,
    leg,
    legs,
    describe,
    roverHome: (xz, isBad = false) => read(isBad ? maps.roverToBad : maps.roverTo, xz),
    roverOut: (xz, isBad = false) => read(isBad ? maps.roverFromBad : maps.roverFrom, xz),
    footHome: (xz, isBad = false) => read(isBad ? maps.footToBad : maps.footTo, xz),
    // Reach and walk-back are feasibility rules, so by default they use bad-ground times.
    inReach: (xz, workH, budgetH, isBad = true) =>
      read(isBad ? maps.roverFromBad : maps.roverFrom, xz) + workH + read(isBad ? maps.roverToBad : maps.roverTo, xz) <= budgetH,
    inWalkBack: (xz, workH, budgetH, isBad = true) =>
      read(isBad ? maps.roverFromBad : maps.roverFrom, xz) + workH + read(isBad ? maps.footToBad : maps.footTo, xz) <= budgetH,
    reachLines: (workH, budgetH, isBad = true) => lines(isBad ? vals.reachBad : vals.reach, budgetH - workH),
    walkLines: (workH, budgetH, isBad = true) => lines(isBad ? vals.walkBad : vals.walk, budgetH - workH),
    homeLines: (h, isBad = false) => lines(isBad ? maps.roverToBad.t : maps.roverTo.t, h),
    farthestKm: (values, level) => {
      let best = 0
      for (let c = 0; c < values.length; c++) if (values[c] <= level) best = Math.max(best, distKm(cellXZ(g, c), habXZ))
      return best
    },
    get reachVal() { return vals.reach },
    get walkVal() { return vals.walk },
    get reachValBad() { return vals.reachBad },
    get walkValBad() { return vals.walkBad },
  }
}

// "14:20 expected · 15:05 if the ground is bad"
export const clockOf = (startH, h) => {
  const m = Math.round((startH + h) * 60)
  const days = Math.floor(m / 1440)
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${days ? ` +${days} d` : ''}`
}
export const homeTimes = (startH, expectedH, badH) => `${clockOf(startH, expectedH)} expected · ${clockOf(startH, badH)} if the ground is bad`

// App-facing helpers kept from Stage 3 (App.jsx builds the grid from the site and reads cells by xz).
export { cellOf } from './grid.js'
export function makeGrid(site, cls, slopes, vis = null) { // vis: 1 = line of sight to the habitat antenna (optional)
  const { w, h } = site.meta.dem
  return { w, h, dx: site.W / w, dz: site.H / h, W: site.W, H: site.H, elev: site.dem, slope: slopes, cls, vis, site }
}
