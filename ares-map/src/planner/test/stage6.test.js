import { describe, it, expect } from 'vitest'
import { CLS } from '../config.js'
import { makeAgent, astar, cellOf, cellXZ, distKm } from '../grid.js'
import { straightenPath, cellsOnSegment } from '../straighten.js'
import { buildPlanner } from '../plan.js'
import { testGrid, idx, xzOf, LIMITS, CLASSES, rng } from './helpers.js'

const rover = makeAgent('rover', CLASSES, LIMITS, 8)
const rawPts = (g, cells, a, b) => [a, ...cells.slice(1, -1).map((c) => cellXZ(g, c)), b]
const len = (pts) => pts.slice(1).reduce((s, p, i) => s + distKm(pts[i], p), 0)
// independent check: every 5 m along the polyline
const touched = (g, pts) => {
  const out = new Set()
  for (let i = 1; i < pts.length; i++) {
    const n = Math.ceil(distKm(pts[i - 1], pts[i]) / 0.005)
    for (let k = 0; k <= n; k++) out.add(cellOf(g, [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / n, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / n]))
  }
  return out
}

describe('Stage 6: straighten paths', () => {
  it('open ground: the zigzag becomes one straight segment, shorter and no slower', () => {
    const g = testGrid(12, 6)
    const a = xzOf(g, 0, 0), b = xzOf(g, 11, 4)
    const r = astar(g, rover, idx(g, 0, 0), idx(g, 11, 4))
    const raw = rawPts(g, r.cells, a, b)
    const sp = straightenPath(g, rover, r.cells, raw)
    expect(sp).toEqual([a, b])
    expect(len(sp)).toBeLessThan(len(raw))
    const P = buildPlanner(g, CLASSES, LIMITS, 8, a)
    const leg = P.leg('rover', a, b)
    expect(leg.km).toBeCloseTo(distKm(a, b), 12)
    expect(leg.hours).toBeLessThan(r.hours)
    expect(buildPlanner(g, CLASSES, LIMITS, 8, a, { straighten: false }).leg('rover', a, b).hours).toBeCloseTo(r.hours, 12)
  })

  it('never crosses a blocked cell (40 random obstacle grids)', () => {
    const r = rng(7)
    let shortened = 0
    for (let t = 0; t < 40; t++) {
      const blocked = Array.from({ length: 30 * 20 }, () => r() < 0.22)
      const g = testGrid(30, 20, { cls: (x, y) => (blocked[y * 30 + x] && !(x === 0 && y === 0) && !(x === 29 && y === 19) ? 'steep' : 'smooth') })
      const p = astar(g, rover, idx(g, 0, 0), idx(g, 29, 19))
      if (!p) continue
      const raw = rawPts(g, p.cells, xzOf(g, 0, 0), xzOf(g, 29, 19))
      const sp = straightenPath(g, rover, p.cells, raw)
      if (sp.length < raw.length) shortened++
      for (const c of touched(g, sp)) expect(g.cls[c]).not.toBe(CLS.steep)
      // every segment straightening created touches no steep cell, not even at a corner. (A*'s own
      // single diagonal steps may pass the corner point between two steep cells: that is the existing
      // 8-connected rule, unchanged here.)
      const rawKey = new Set(raw.map((p) => p.join()))
      for (let i = 1; i < sp.length; i++) {
        const ia = raw.findIndex((p) => p.join() === sp[i - 1].join())
        const ib = raw.findIndex((p) => p.join() === sp[i].join())
        expect(rawKey.has(sp[i].join())).toBe(true)
        if (ib - ia > 1) for (const c of cellsOnSegment(g, sp[i - 1], sp[i])) expect(g.cls[c]).not.toBe(CLS.steep)
      }
      expect(len(sp)).toBeLessThanOrEqual(len(raw) + 1e-12)
    }
    expect(shortened).toBeGreaterThan(20)
  })

  it('does not cut across costlier ground the path went round', () => {
    // rough block in the middle; smooth all round. A* goes round it; straightening must too.
    const g = testGrid(15, 9, { cls: (x, y) => (x >= 5 && x <= 9 && y >= 2 && y <= 6 ? 'rough' : 'smooth') })
    const a = xzOf(g, 0, 4), b = xzOf(g, 14, 4)
    const p = astar(g, rover, idx(g, 0, 4), idx(g, 14, 4))
    expect(p.cells.some((c) => g.cls[c] === CLS.rough)).toBe(false)
    const sp = straightenPath(g, rover, p.cells, rawPts(g, p.cells, a, b))
    for (const c of touched(g, sp)) expect(g.cls[c]).not.toBe(CLS.rough)
  })

  it('a corner crossing counts both side cells', () => {
    const g = testGrid(3, 3)
    const cells = cellsOnSegment(g, xzOf(g, 0, 0), xzOf(g, 2, 2))
    expect(new Set(cells)).toEqual(new Set([0, 1, 3, 4, 5, 7, 8]))
  })
})
