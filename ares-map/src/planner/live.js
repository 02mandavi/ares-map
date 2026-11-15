// Stage 5: during the drive. Pure functions the Mission / Field playback calls each tick.
import { PLANNER, CLS } from './config.js'
import { distKm } from './grid.js'
import { distanceMap, markPolyline } from './cost.js'
import { buildPlanner, clockOf } from './plan.js'
import { fmtDur } from './feasible.js'

// Dead-reckoning error: 2 % of km driven since the last station (reset there), 20 m floor.
export const positionErrorKm = (kmSinceStation, cfg = PLANNER.positionError) =>
  Math.max(cfg.minKm, (kmSinceStation * cfg.pctOfKm) / 100)

// Distance (km) from a point to a polyline.
export function offPathKm(xz, pts) {
  if (pts.length < 2) return pts.length ? distKm(xz, pts[0]) : Infinity
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i]
    const L2 = (bx - ax) ** 2 + (bz - az) ** 2
    const t = L2 ? Math.max(0, Math.min(1, ((xz[0] - ax) * (bx - ax) + (xz[1] - az) * (bz - az)) / L2)) : 0
    best = Math.min(best, distKm(xz, [ax + t * (bx - ax), az + t * (bz - az)]))
  }
  return best
}

// Replan every 5 simulated minutes, or as soon as the rover is more than 1 cell off its path.
export function shouldReplan(g, { nowH, lastReplanH, roverXZ, pathPts }, cfg = PLANNER.replan) {
  if (lastReplanH == null) return { replan: true, why: 'first plan' }
  const off = offPathKm(roverXZ, pathPts)
  if (off > cfg.offPathCells * Math.max(g.dx, g.dz) + 1e-9) return { replan: true, why: `${Math.round(off * 1000)} m off the path` }
  if (nowH - lastReplanH >= cfg.everyMin / 60 - 1e-9) return { replan: true, why: `${cfg.everyMin} min since the last plan` }
  return { replan: false, why: '' }
}

// Widen hazards by the position error: cells within radiusKm of a steep cell (or a traced crack)
// become steep (blocked); cells within radiusKm of the trough band become trough.
export function widenHazards(g, radiusKm, cracks = []) {
  const steep = new Uint8Array(g.w * g.h)
  const trough = new Uint8Array(g.w * g.h)
  for (let c = 0; c < steep.length; c++) {
    if (g.cls[c] === CLS.steep) steep[c] = 1
    if (g.cls[c] === CLS.trough) trough[c] = 1
  }
  for (const line of cracks) markPolyline(g, steep, line)
  const dS = distanceMap(g, steep)
  const dT = distanceMap(g, trough)
  const cls = Uint8Array.from(g.cls)
  for (let c = 0; c < cls.length; c++) {
    if (dS[c] <= radiusKm + 1e-9) cls[c] = CLS.steep
    else if (dT[c] <= radiusKm + 1e-9 && cls[c] !== CLS.unknown) cls[c] = CLS.trough
  }
  return cls
}

// Replan from where the rover is now: rover → remaining stops → home, on hazards widened by the
// current position error. turnBack = the bad-ground time straight home leaves less than the reserve.
export function fieldReplan(g, classes, limits, roverKmh, habXZ, {
  roverXZ, stops = [], nowH, evaH = 7, reserveH, kmSinceStation = 0, cracks = [], cost = null, startH = 0,
}) {
  const errKm = positionErrorKm(kmSinceStation)
  const wide = { ...g, cls: widenHazards(g, errKm, cracks) }
  const P = buildPlanner(wide, classes, limits, roverKmh, habXZ, { cost })
  const seq = [roverXZ, ...stops.map((s) => s.xz), habXZ]
  const legs = seq.slice(1).map((p, i) => P.leg('rover', seq[i], p))
  const homeBadH = P.roverHome(roverXZ, true)
  const workH = stops.reduce((a, s) => a + s.work / 60, 0)
  const finishBadH = nowH + legs.reduce((a, l) => a + (l.blocked ? Infinity : l.hoursBad), 0) + workH
  const turnBackAtH = evaH - reserveH
  // Turn back = finishing the remaining stops and getting home (bad ground) no longer leaves the reserve.
  // mustGoHome = even going straight home now does not leave it.
  const turnBack = !(finishBadH <= turnBackAtH)
  const mustGoHome = !(nowH + homeBadH <= turnBackAtH)
  const lateH = (mustGoHome ? nowH + homeBadH : finishBadH) - turnBackAtH
  return {
    errKm,
    legs,
    homeBadH,
    finishBadH,
    turnBack,
    mustGoHome,
    event: turnBack
      ? {
        at: clockOf(startH, nowH),
        kind: 'turn-back',
        text: mustGoHome
          ? `Turn back now: even straight home is ${fmtDur(lateH)} past the turn-back time if the ground is bad`
          : `Turn back now: finishing ${stops.map((s) => s.id).join(', ')} would be ${Number.isFinite(lateH) ? fmtDur(lateH) : 'impossible,'} past the turn-back time if the ground is bad; home ${clockOf(startH, nowH + homeBadH)} if you go now`,
      }
      : null,
  }
}
