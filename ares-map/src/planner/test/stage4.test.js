import { describe, it, expect } from 'vitest'
import { PLANNER } from '../config.js'
import { makeAgent, homeMap, astar } from '../grid.js'
import { buildPlanner, homeTimes } from '../plan.js'
import { costField, distanceMap, edgeMask, pathEnergyKwh, energyCheck } from '../cost.js'
import { scoreRoute } from '../choose.js'
import { testGrid, idx, xzOf, LIMITS, CLASSES } from './helpers.js'

const withCost = (g, cost) => ({ ...g, mult: cost.mult, minMult: cost.minMult })

describe('Stage 4: every number is in the config with a source', () => {
  it('each PLANNER entry has a source string', () => {
    for (const [k, v] of Object.entries(PLANNER)) expect(typeof v.source, k).toBe('string')
  })
})

describe('Stage 4: hopeful and bad-ground times', () => {
  it('flat smooth: bad time = expected / 0.9; rough: / 0.6', () => {
    const g = testGrid(11, 1)
    const P = buildPlanner(g, CLASSES, LIMITS, 8, xzOf(g, 0, 0))
    const far = xzOf(g, 10, 0)
    expect(P.roverHome(far, true)).toBeCloseTo(P.roverHome(far) / 0.9, 12)
    const r = testGrid(11, 1, { cls: () => 'rough' })
    const R = buildPlanner(r, CLASSES, LIMITS, 8, xzOf(r, 0, 0))
    expect(R.roverHome(far, true)).toBeCloseTo(R.roverHome(far) / 0.6, 12)
    const leg = R.leg('rover', xzOf(r, 0, 0), far)
    expect(leg.hoursBad).toBeCloseTo(leg.hours / 0.6, 12)
  })

  it('feasibility uses the bad-ground time', () => {
    // 2 h out + 2 h back expected; ×1/0.6 bad = 6.67 h; plus 0.5 h work > 7 − 0.25
    const legOf = () => ({ hours: 2, hoursBad: 2 / 0.6, km: 16, maxSlope: 0, unknown: 0, blocked: false })
    const r = scoreRoute({ stations: [{ id: 'S1', work: 30 }], legOf, science: {}, evaH: 7, reserveH: 0.25, inWalkBack: () => true }, ['S1'])
    expect(r.totalExpH).toBeCloseTo(4.5, 12)
    expect(r.feasible).toBe(false)
    expect(r.reasons[0]).toMatch(/over the turn-back time/)
  })

  it('formats both home times', () => {
    expect(homeTimes(9, 5 + 20 / 60, 6 + 5 / 60)).toBe('14:20 expected · 15:05 if the ground is bad')
  })
})

describe('Stage 4: route cost (time is never changed)', () => {
  const rover = makeAgent('rover', CLASSES, LIMITS, 8)

  it('prefers HiRISE ground when two routes take the same time', () => {
    // 5 × 3 grid, go from (0,1) to (4,1). Row 0 is HiRISE: a detour through it is longer, so
    // with a 10 % bonus the straight row 1 still wins; with a big bonus the router takes row 0.
    const g = testGrid(5, 3)
    const hirise = new Uint8Array(15).map((_, c) => (Math.floor(c / 5) === 0 ? 1 : 0))
    const straight = astar(withCost(g, costField(g, { hirise })), rover, idx(g, 0, 1), idx(g, 4, 1))
    expect(straight.cells.every((c) => Math.floor(c / 5) === 1)).toBe(true)
    const cfg = { ...PLANNER, hiriseBonus: { value: 0.5, source: 'test' } }
    const via = astar(withCost(g, costField(g, { hirise, cfg })), rover, idx(g, 0, 1), idx(g, 4, 1))
    expect(via.cells.some((c) => Math.floor(c / 5) === 0)).toBe(true)
    expect(via.hours).toBeGreaterThan(straight.hours) // reported hours are real time, not cost
  })

  it('distance map and setback keep routes off an edge', () => {
    // a crack along row 0; from (0,1) to (8,1). Without setback the route hugs row 1, with it goes lower.
    const g = testGrid(9, 6)
    const mask = edgeMask(g, { cracks: [[xzOf(g, 0, 0), xzOf(g, 8, 0)]] })
    const d = distanceMap(g, mask)
    expect(d[idx(g, 3, 0)]).toBe(0)
    expect(d[idx(g, 3, 2)]).toBeCloseTo(0.4, 12)
    const near = astar(g, rover, idx(g, 0, 1), idx(g, 8, 1))
    const cfg = { ...PLANNER, edgeSetback: { km: 0.6, penalty: 3, source: 'test' } }
    const kept = astar(withCost(g, costField(g, { edgeDist: d, cfg })), rover, idx(g, 0, 1), idx(g, 8, 1))
    const meanRow = (p) => p.cells.reduce((a, c) => a + Math.floor(c / 9), 0) / p.cells.length
    expect(meanRow(kept)).toBeGreaterThan(meanRow(near))
  })

  it('avoids radio shadow unless a relay is set', () => {
    const g = testGrid(7, 3)
    const vis = new Uint8Array(21).fill(1)
    vis[idx(g, 3, 1)] = 0 // one shadow cell on the straight line
    // crossing it costs 2 steps × ½ × costPerMin × 0.025 h; the diagonal detour costs 0.021 h more.
    // At the default 0.5 crossing is cheaper (0.0125 h), so the router is right to go through:
    expect(astar(withCost(g, costField(g, { vis })), rover, idx(g, 0, 1), idx(g, 6, 1)).cells).toContain(idx(g, 3, 1))
    const cfg = { ...PLANNER, radioShadow: { costPerMin: 2, source: 'test' } } // 0.05 h > 0.021 h
    const around = astar(withCost(g, costField(g, { vis, cfg })), rover, idx(g, 0, 1), idx(g, 6, 1))
    expect(around.cells).not.toContain(idx(g, 3, 1))
    const relay = astar(withCost(g, costField(g, { vis, relay: true, cfg })), rover, idx(g, 0, 1), idx(g, 6, 1))
    expect(relay.cells).toContain(idx(g, 3, 1))
  })

  it('home map times stay real time when a cost field is set', () => {
    const g = testGrid(9, 9)
    const hirise = new Uint8Array(81).fill(1)
    const m = homeMap(withCost(g, costField(g, { hirise })), rover, idx(g, 4, 4), 'to')
    expect(m.t[idx(g, 8, 4)]).toBeCloseTo((4 * 0.2) / 8, 12)
    expect(m.cost[idx(g, 8, 4)]).toBeCloseTo(((4 * 0.2) / 8) * 0.9, 12)
  })
})

describe('Stage 4: energy', () => {
  it('0.5 kWh/km flat, plus the climb term going up only', () => {
    const flat = testGrid(11, 1)
    const cells = Array.from({ length: 11 }, (_, i) => i)
    expect(pathEnergyKwh(flat, cells)).toBeCloseTo(0.5 * 2, 12) // 2 km
    const hill = testGrid(11, 1, { elev: (x) => x * 10 }) // 100 m up over 2 km
    expect(pathEnergyKwh(hill, cells)).toBeCloseTo(1 + 1, 12)
    expect(pathEnergyKwh(hill, [...cells].reverse())).toBeCloseTo(1, 12)
  })
  it('checks the charge against the floor', () => {
    expect(energyCheck(20, 50).ok).toBe(true) // 50 − 20 = 30 % ≥ 25 %
    expect(energyCheck(30, 50).ok).toBe(false)
  })
})
