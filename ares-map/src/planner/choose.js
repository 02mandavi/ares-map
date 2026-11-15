// RW / zW / BW: every subset and order of stations, scored and ranked.
import { feasibility } from './feasible.js'
import { energyCheck } from './cost.js'

// RW: every non-empty ordered subset (325 for 5 stations).
export function orderings(ids) {
  const out = []
  const walk = (prefix, rest) => {
    if (prefix.length) out.push(prefix)
    rest.forEach((id, i) => walk([...prefix, id], [...rest.slice(0, i), ...rest.slice(i + 1)]))
  }
  walk([], ids)
  return out
}

// zW: score one route. ctx.legOf(fromId, toId) returns a planner leg (cached by the caller).
// Stage 4: feasibility and reserve use the bad-ground time (leg.hoursBad); totalExpH is the hopeful one.
// ctx.socPct (optional) = rover charge now, from Vitals.
export function scoreRoute({ stations, legOf, science, evaH, reserveH, inWalkBack, socPct = null }, ids) {
  const byId = Object.fromEntries(stations.map((s) => [s.id, s]))
  const stops = ids.map((id) => byId[id])
  const seq = ['HAB', ...ids, 'HAB']
  const legs = seq.slice(1).map((id, i) => legOf(seq[i], id))
  const workH = stops.reduce((a, s) => a + s.work / 60, 0)
  const totalExpH = legs.reduce((a, l) => a + (l.blocked ? 0 : l.hours), 0) + workH
  const totalH = legs.reduce((a, l) => a + (l.blocked ? 0 : l.hoursBad ?? l.hours), 0) + workH
  const needBackup = stops.filter((s) => !inWalkBack(s)).map((s) => s.id)
  const f = feasibility({ legs, totalH, evaH, reserveH, stops, inWalkBack, backup: Object.fromEntries(needBackup.map((id) => [id, true])) })
  const km = legs.reduce((a, l) => a + l.km, 0)
  const energyKwh = legs.reduce((a, l) => a + (l.energyKwh ?? 0), 0)
  const energy = socPct == null ? null : energyCheck(energyKwh, socPct)
  if (energy && !energy.ok) {
    f.feasible = false
    f.reasons.push(`Energy: ${energyKwh.toFixed(1)} kWh leaves ${energy.endPct.toFixed(0)} %, below the ${energy.floorPct} % floor`)
  }
  return {
    ids,
    legs,
    totalH,
    totalExpH,
    energyKwh,
    energy,
    reserveLeftH: f.reserveLeftH,
    km,
    needBackup,
    feasible: f.feasible,
    reasons: f.reasons,
    maxSlope: Math.max(...legs.map((l) => (l.blocked ? 0 : l.maxSlope))),
    unknown: km ? legs.reduce((a, l) => a + l.unknown * l.km, 0) / km : 0,
    science: ids.reduce((a, id) => a + (science[id] ?? 0), 0),
    shadowH: legs.reduce((a, l) => a + (l.shadowH ?? 0), 0) + stops.reduce((a, s) => a + (s.shadow ? s.work / 60 : 0), 0),
  }
}

// BW: feasible routes, most science first, then most reserve left, then least radio shadow.
// Day 2 = call again with the stations day 1 left over.
export function rankRoutes(ctx) {
  return orderings(ctx.stations.map((s) => s.id))
    .map((ids) => scoreRoute(ctx, ids))
    .filter((r) => r.feasible)
    .sort((a, b) => b.science - a.science || b.reserveLeftH - a.reserveLeftH || a.shadowH - b.shadowH)
}

export const routeStats = scoreRoute // the name App.jsx uses
