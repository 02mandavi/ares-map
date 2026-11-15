import { describe, it, expect } from 'vitest'
import { CLS } from '../config.js'
import { positionErrorKm, offPathKm, shouldReplan, widenHazards, fieldReplan } from '../live.js'
import { testGrid, idx, xzOf, LIMITS, CLASSES } from './helpers.js'

describe('Stage 5: position error and hazards', () => {
  it('error is 2 % of km since the station, 20 m floor', () => {
    expect(positionErrorKm(0)).toBe(0.02)
    expect(positionErrorKm(10)).toBeCloseTo(0.2, 12)
  })

  it('widens steep and trough cells by the error radius', () => {
    const g = testGrid(9, 9, { cls: (x, y) => (x === 4 && y === 4 ? 'steep' : x === 0 ? 'trough' : 'smooth') })
    const w = widenHazards(g, 0.25)
    expect(w[idx(g, 5, 4)]).toBe(CLS.steep) // 200 m away
    expect(w[idx(g, 5, 5)]).toBe(CLS.smooth) // diagonal, 283 m away
    expect(w[idx(g, 1, 3)]).toBe(CLS.trough)
    expect(w[idx(g, 2, 3)]).toBe(CLS.smooth)
    expect(widenHazards(g, 0.02)).toEqual(Uint8Array.from(g.cls))
  })

  it('a widened hazard closes a gap the route used', () => {
    // a wall of steep cells at x = 5 with a one-cell gap at y = 3: open at 20 m error, shut at 250 m.
    const g = testGrid(11, 7, { cls: (x, y) => (x === 5 && y !== 3 ? 'steep' : 'smooth') })
    const hab = xzOf(g, 0, 3)
    const stop = { id: 'S1', xz: xzOf(g, 10, 3), work: 0 }
    const open = fieldReplan(g, CLASSES, LIMITS, 8, hab, { roverXZ: hab, stops: [stop], nowH: 0, reserveH: 0.25, kmSinceStation: 0 })
    expect(open.legs[0].blocked).toBe(false)
    const shut = fieldReplan(g, CLASSES, LIMITS, 8, hab, { roverXZ: hab, stops: [stop], nowH: 0, reserveH: 0.25, kmSinceStation: 12.5 })
    expect(shut.legs[0].blocked).toBe(true)
    expect(shut.turnBack).toBe(true)
  })
})

describe('Stage 5: when to replan', () => {
  const g = testGrid(20, 5)
  const path = [xzOf(g, 0, 2), xzOf(g, 19, 2)]
  it('more than 1 cell off the path', () => {
    expect(shouldReplan(g, { nowH: 1, lastReplanH: 1, roverXZ: xzOf(g, 5, 3), pathPts: path }).replan).toBe(false) // exactly 1 cell
    expect(shouldReplan(g, { nowH: 1, lastReplanH: 1, roverXZ: xzOf(g, 5, 4), pathPts: path })).toEqual({ replan: true, why: '400 m off the path' })
  })
  it('every 5 simulated minutes', () => {
    expect(shouldReplan(g, { nowH: 1 + 4 / 60, lastReplanH: 1, roverXZ: xzOf(g, 5, 2), pathPts: path }).replan).toBe(false)
    expect(shouldReplan(g, { nowH: 1 + 5 / 60, lastReplanH: 1, roverXZ: xzOf(g, 5, 2), pathPts: path }).replan).toBe(true)
  })
  it('offPathKm', () => {
    expect(offPathKm([0, 1], [[-1, 0], [1, 0]])).toBe(1)
    expect(offPathKm([3, 0], [[-1, 0], [1, 0]])).toBe(2)
  })
})

describe('Stage 5: a slower rover triggers "Turn back now" at the right moment', () => {
  // Flat smooth corridor, 0.2 km cells. Stop 20 km out with 1 h of work; plan at 8 km/h.
  // Bad ground on smooth = 0.9 × 8 = 7.2 km/h. Turn-back at 7 − 0.25 = 6.75 h.
  const g = testGrid(121, 1)
  const hab = xzOf(g, 0, 0)
  const stop = { id: 'S1', xz: xzOf(g, 100, 0), work: 62 } // 62, not 60: keeps ticks off the exact 6.75 h tie
  const run = (actualKmh) => {
    for (let k = 0; ; k++) {
      const nowH = (k * 5) / 60
      const cell = Math.min(100, Math.floor((actualKmh * nowH) / 0.2))
      const r = fieldReplan(g, CLASSES, LIMITS, 8, hab, { roverXZ: xzOf(g, cell, 0), stops: [stop], nowH, reserveH: 0.25, kmSinceStation: cell * 0.2, startH: 7.5 })
      if (r.turnBack || cell === 100) return { k, nowH, cell, r }
    }
  }

  it('at plan speed the trip fits and no warning fires on the way out', () => {
    // bad: 20 km / 7.2 = 2.78 h out-time-left + 1 h work + 2.78 h back: fits from the start (5.56 h ≤ 6.75)
    const r = run(8)
    expect(r.cell).toBe(100)
    expect(r.r.turnBack).toBe(false)
  })

  it('at 4 km/h it fires at the first tick where the rest no longer fits', () => {
    const r = run(4)
    // remaining (bad) = now + (100 − cell)·0.2/7.2 + 1 + 100·0.2/7.2, with cell = floor(4·now/0.2)
    const finish = (now) => {
      const cell = Math.floor((4 * now) / 0.2)
      return now + ((100 - cell) * 0.2) / 7.2 + 62 / 60 + (100 * 0.2) / 7.2
    }
    expect(finish(r.nowH)).toBeGreaterThan(6.75)
    expect(finish(r.nowH - 5 / 60)).toBeLessThanOrEqual(6.75)
    expect(r.r.mustGoHome).toBe(false)
    expect(r.r.event.kind).toBe('turn-back')
    expect(r.r.event.at).toBe(`${String(Math.floor(7.5 + r.nowH)).padStart(2, '0')}:${String(Math.round(((7.5 + r.nowH) % 1) * 60)).padStart(2, '0')}`)
    expect(r.r.event.text).toMatch(/^Turn back now: finishing S1 would be \d+ min past the turn-back time/)
  })
})
