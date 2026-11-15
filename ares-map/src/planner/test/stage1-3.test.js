import { describe, it, expect } from 'vitest'
import * as live from './fixtures/live-planner.min.js'
import { makeAgent, slopeFactor, stepHours, homeMap, mapAt, astar } from '../grid.js'
import { buildPlanner } from '../plan.js'
import { feasibility } from '../feasible.js'
import { orderings, rankRoutes } from '../choose.js'
import { testGrid, idx, xzOf, LIMITS, CLASSES, rng } from './helpers.js'

const R2 = Math.SQRT2

describe('recovered code matches the live build', () => {
  const r = rng(42)
  const names = ['smooth', 'smooth', 'smooth', 'rocky', 'rough', 'loose', 'trough', 'unknown']
  const pick = Array.from({ length: 30 * 24 }, () => names[Math.floor(r() * names.length)])
  const t = testGrid(30, 24, { elev: (x, y) => 40 * Math.sin(x / 4) + 25 * Math.cos(y / 3), cls: (x, y) => pick[y * 30 + x] })
  const liveGrid = live.MW(t.site, t.cls, t.slope)
  const g = liveGrid // both versions run on the identical grid object

  it('step times, home maps and A* are identical', () => {
    for (const kind of ['rover', 'foot']) {
      const mine = makeAgent(kind, CLASSES, LIMITS, 8)
      const theirs = live.CW(kind, CLASSES, LIMITS, 8)
      expect(mine).toEqual(theirs)
      const a = homeMap(g, mine, idx(g, 5, 5), 'to')
      const b = live.OW(liveGrid, theirs, idx(g, 5, 5), 'to')
      expect(Array.from(a.t)).toEqual(Array.from(b.t))
      const p = astar(g, mine, idx(g, 1, 1), idx(g, 28, 20), a)
      const q = live.AW(liveGrid, theirs, idx(g, 1, 1), idx(g, 28, 20), b)
      expect({ cells: p.cells, hours: p.hours }).toEqual(q)
      expect(p.cost).toBe(p.hours) // no cost field: cost = time
    }
  })

  it('buildPlanner legs equal the live LW legs', () => {
    const hab = xzOf(g, 15, 12)
    const stops = [{ id: 'S1', xz: xzOf(g, 3, 3) }, { id: 'S2', xz: xzOf(g, 26, 20) }]
    const mine = buildPlanner(g, CLASSES, LIMITS, 8, hab, { straighten: false })
    const theirs = live.LW(liveGrid, CLASSES, LIMITS, 8, hab)
    const strip = (l) => ({ km: l.km, hours: l.hours, blocked: l.blocked, pts: l.pts })
    expect(mine.legs('rover', stops).map(strip)).toEqual(theirs.legs('rover', stops).map(strip))
    expect(mine.roverHome(stops[0].xz)).toBe(theirs.roverHome(stops[0].xz))
  })
})

describe('Stage 1: travel time is the cost', () => {
  const rover = makeAgent('rover', CLASSES, LIMITS, 8)
  const foot = makeAgent('foot', CLASSES, LIMITS)

  it('rover speed setting scales flat smooth speed', () => {
    expect(makeAgent('rover', CLASSES, LIMITS, 15).v[0]).toBe(15)
    expect(makeAgent('rover', CLASSES, LIMITS, 5).v[0]).toBe(5)
  })

  it('walking: Tobler, gentle downhill faster than flat, uphill slower', () => {
    expect(slopeFactor(foot, 0)).toBeCloseTo(1, 9)
    expect(slopeFactor(foot, -0.05)).toBeCloseTo(Math.exp(3.5 * 0.05), 9) // the peak of Tobler
    expect(slopeFactor(foot, 0.1)).toBeLessThan(slopeFactor(foot, -0.1))
  })

  it('rover: 40% at the limit, same climbing or descending, blocked past it', () => {
    const atLimit = Math.tan((20 * Math.PI) / 180)
    expect(slopeFactor(rover, atLimit)).toBeCloseTo(0.4, 9)
    expect(slopeFactor(rover, -atLimit)).toBeCloseTo(0.4, 9)
    expect(slopeFactor(rover, 0.2)).toBe(slopeFactor(rover, -0.2))
    expect(slopeFactor(rover, Math.tan((21 * Math.PI) / 180))).toBe(0)
  })

  it('uphill step is slower than the same step downhill on foot', () => {
    const g = testGrid(2, 1, { elev: (x) => x * 20 }) // 20 m over 200 m: 10 % grade
    const up = stepHours(g, foot, 0, 1)
    const down = stepHours(g, foot, 1, 0)
    expect(up).toBeGreaterThan(down)
    expect(up).toBeCloseTo(0.2 / 2.5 / (Math.exp(-3.5 * 0.15) / Math.exp(-3.5 * 0.05)), 9)
  })

  it('time-to-home on flat smooth ground is octile distance / speed', () => {
    const g = testGrid(11, 11)
    const m = homeMap(g, rover, idx(g, 5, 5), 'to')
    expect(m.t[idx(g, 5, 5)]).toBe(0)
    expect(m.t[idx(g, 10, 5)]).toBeCloseTo((5 * 0.2) / 8, 12)
    expect(m.t[idx(g, 10, 10)]).toBeCloseTo((5 * 0.2 * R2) / 8, 12)
    expect(m.t[idx(g, 10, 8)]).toBeCloseTo(((3 * R2 + 2) * 0.2) / 8, 12)
  })

  it('home map goes round a wall of steep cells, and a cell inside one reads through its neighbours', () => {
    const g = testGrid(9, 9, { cls: (x, y) => (x === 4 && y < 8 ? 'steep' : 'smooth') })
    const m = homeMap(g, rover, idx(g, 2, 2), 'to')
    expect(m.t[idx(g, 6, 2)]).toBeGreaterThan((4 * 0.2) / 8 + 1e-9)
    expect(Number.isFinite(m.t[idx(g, 4, 2)])).toBe(false)
    expect(Number.isFinite(mapAt(g, m, idx(g, 4, 2)))).toBe(true)
  })

  it('A* to home with the exact home map gives the home map time', () => {
    const g = testGrid(12, 9, { elev: (x, y) => 15 * Math.sin(x / 2) * Math.cos(y / 3), cls: (x, y) => ((x + y) % 5 === 0 ? 'rough' : 'smooth') })
    const m = homeMap(g, rover, idx(g, 1, 1), 'to')
    const p = astar(g, rover, idx(g, 10, 7), idx(g, 1, 1), m)
    expect(p.hours).toBeCloseTo(m.t[idx(g, 10, 7)], 12)
  })
})

describe('Stage 2: refuse plans that do not fit', () => {
  it('reports the overrun and reserve left', () => {
    const f = feasibility({ legs: [{}], totalH: 6 + 57 / 60, evaH: 7, reserveH: 1, stops: [], inWalkBack: () => true })
    expect(f.feasible).toBe(false)
    expect(f.reasons[0]).toBe('57 min over the turn-back time; reserve left: 3 min')
  })
  it('a blocked leg and a stop outside walk-back are reasons', () => {
    const f = feasibility({ legs: [{ blocked: true }, {}], totalH: 1, evaH: 7, reserveH: 1, stops: [{ id: 'S4' }], inWalkBack: () => false })
    expect(f.reasons).toEqual(['No route found from HAB to S4', 'S4 is outside walk-back and the second rover is not marked as backup'])
    expect(feasibility({ legs: [{}, {}], totalH: 1, evaH: 7, reserveH: 1, stops: [{ id: 'S4' }], inWalkBack: () => false, backup: { S4: true } }).feasible).toBe(true)
  })
})

describe('Stage 3: choose stops and order', () => {
  it('325 ordered subsets of 5 stations', () => {
    expect(orderings(['a', 'b', 'c', 'd', 'e']).length).toBe(325)
  })
  it('picks the most science that fits, then the most reserve', () => {
    const legOf = (a, b) => ({ hours: a === 'HAB' || b === 'HAB' ? 1 : 0.5, km: 8, maxSlope: 0, unknown: 0, blocked: false })
    const stations = [{ id: 'A', work: 120 }, { id: 'B', work: 120 }, { id: 'C', work: 60 }]
    const ranked = rankRoutes({ stations, legOf, science: { A: 4, B: 4, C: 1 }, evaH: 7, reserveH: 1, inWalkBack: () => true })
    // A+B+C = 2 + 1 + 5 h = 8 h: too long. A+B = 2 + 0.5 + 4 = 6.5 h > 6: too long. A+C = 2 + .5 + 3 = 5.5 h fits.
    expect(ranked[0].science).toBe(5)
    expect(ranked.every((r) => r.feasible)).toBe(true)
    expect(ranked.find((r) => r.ids.length === 3)).toBeUndefined()
  })
})
