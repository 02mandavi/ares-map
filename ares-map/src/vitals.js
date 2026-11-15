// Vitals ledger (rules T1 flow, T2 pad, T6 wear, T12 humans, T13 labels).
// Every starting value is a PLACEHOLDER for the team to replace; the app shows that label until a human enters a measurement.
export const PAD = 1.25; // pessimistic burn = nominal × 1.25 (T2)

const P = 'placeholder';
export const DEFAULT_VITALS = {
  daysToReturn: 30, // sols until the next resupply or return window (placeholder)
  rows: [
    { id: 'o2', group: 'Life support', name: 'Oxygen', kind: 'flow', stock: 400, unit: 'kg', burn: 3.4, reserve: 40, source: P },
    { id: 'co2', group: 'Life support', name: 'CO2 scrubber life', kind: 'flow', stock: 2000, unit: 'h', burn: 24, reserve: 168, source: P },
    { id: 'h2o', group: 'Water', name: 'Water', kind: 'flow', stock: 1200, unit: 'L', burn: 40, reserve: 100, source: P },
    ...['c1', 'c2', 'c3', 'c4'].map((c, i) => ({ id: 'food-' + c, group: 'Food', name: `Food, Crew ${i + 1}`, kind: 'flow', stock: 80000, unit: 'kcal', burn: 2800, reserve: 8400, source: P })),
    { id: 'pwr', group: 'Power', name: 'Power balance', kind: 'balance', gen: 32, load: 26, dust: 0, battery: 60, unit: 'kWh/sol', source: P },
    ...['c1', 'c2', 'c3', 'c4'].map((c, i) => ({ id: 'suit-' + c, group: 'Suits', name: `Suit ${i + 1} seal cycles`, kind: 'wear', used: 40 + i * 6, limit: 250, unit: 'cycles', owner: c, source: P })),
    { id: 'lock', group: 'Habitat', name: 'Airlock cycles', kind: 'wear', used: 160, limit: 1000, unit: 'cycles', source: P },
    { id: 'filt', group: 'Habitat', name: 'Dust filter hours', kind: 'wear', used: 410, limit: 500, unit: 'h', source: P },
    { id: 'rov1', group: 'Mobility', name: 'Survey rover charge', kind: 'level', value: 100, unit: '%', source: P },
    { id: 'rov2', group: 'Mobility', name: 'Crack rover charge', kind: 'level', value: 100, unit: '%', source: P },
    { id: 'link', group: 'Comms', name: 'Earth link', kind: 'status', value: 'up, 12 min one-way delay', source: P },
    ...['c1', 'c2', 'c3', 'c4'].map((c, i) => ({ id: 'health-' + c, group: 'Crew health', name: `Crew ${i + 1}`, kind: 'health', owner: c, sleep: 7, value: 'fit', source: P })),
  ],
};

// Returns { text, nominal, pessimistic, level: 'ok'|'watch'|'bad' } for one row.
export function assess(r, daysToReturn) {
  if (r.kind === 'flow') {
    const nominal = (r.stock - r.reserve) / r.burn, pess = (r.stock - r.reserve) / (r.burn * PAD);
    return { nominal, pessimistic: pess, level: pess < daysToReturn ? 'bad' : nominal < daysToReturn * PAD ? 'watch' : 'ok' };
  }
  if (r.kind === 'balance') {
    const net = r.gen * (1 - r.dust / 100) - r.load, netP = r.gen * (1 - r.dust / 100) / PAD - r.load;
    const days = (n) => (n >= 0 ? Infinity : r.battery / -n);
    return { net, nominal: days(net), pessimistic: days(netP), level: net < 0 ? 'bad' : netP < 0 ? 'watch' : 'ok' };
  }
  if (r.kind === 'wear') { const f = r.used / r.limit; return { frac: f, level: f >= 0.9 ? 'bad' : f >= 0.75 ? 'watch' : 'ok' }; }
  if (r.kind === 'level') return { level: r.value < 25 ? 'bad' : r.value < 50 ? 'watch' : 'ok' };
  return { level: 'ok' };
}

// Rough cost of one EVA visit, for the objective card. Placeholder rates, labelled in the UI.
export const RATES = { suitO2KgPerPersonH: 0.1, roverKwhPerKm: 0.5, crewOut: 4 };

if (import.meta.env?.DEV) {
  const a = assess({ kind: 'flow', stock: 100, reserve: 0, burn: 10 }, 9);
  console.assert(a.nominal === 10 && a.pessimistic === 8 && a.level === 'bad', 'flow days and padding');
  console.assert(assess({ kind: 'balance', gen: 30, load: 26, dust: 20, battery: 60 }, 1).level === 'bad', 'dust storm flips power');
}
