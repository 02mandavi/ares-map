// iV: is a plan feasible? Reasons are the strings the Plan panel, boarding pass and timeline show.

export const fmtDur = (h) => {
  const m = Math.round(Math.abs(h) * 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`
}

export function feasibility({ legs, totalH, evaH, reserveH, stops, inWalkBack, backup = {} }) {
  const overH = totalH - (evaH - reserveH)
  const reserveLeftH = evaH - totalH
  const reasons = []
  if (overH > 1e-9) {
    reasons.push(`${fmtDur(overH)} over the turn-back time; reserve left: ${reserveLeftH > 0 ? fmtDur(reserveLeftH) : `none, ${fmtDur(reserveLeftH)} past the ${evaH} h limit`}`)
  }
  const ids = ['HAB', ...stops.map((s) => s.id), 'HAB']
  legs.forEach((l, i) => {
    if (l.blocked) reasons.push(`No route found from ${ids[i]} to ${ids[i + 1]}`)
  })
  for (const s of stops) {
    if (!backup[s.id] && !inWalkBack(s)) reasons.push(`${s.id} is outside walk-back and the second rover is not marked as backup`)
  }
  return { feasible: reasons.length === 0, reasons, overH, reserveLeftH }
}
