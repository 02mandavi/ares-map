// Every planner number lives here, each with its source.
// Recovered from the live build (dist 4b21142, bundle index-K_L0XHp8.js) on 2026-11-15.

const BRIEF = 'team planner brief 2026-11-15, placeholder (verify)'
const STAGE4 = 'planner brief Stage 4, placeholder (verify)'

export const CLASSES = ['smooth', 'rocky', 'rough', 'loose', 'steep', 'trough', 'unknown']
export const CLS = Object.fromEntries(CLASSES.map((id, i) => [id, i]))

export const PLANNER = {
  speedKmh: {
    rover: { smooth: 8, rocky: 5, rough: 3.2, loose: 2.7, steep: 0, trough: 1.3, unknown: 1 },
    foot: { smooth: 2.5, rocky: 1.8, rough: 1.25, loose: 1.25, steep: 0, trough: 0.4, unknown: 0.3 },
    robot: { smooth: 0.5, rocky: 0.333, rough: 0.25, loose: 0.2, steep: 0, trough: 0.5, unknown: 0.0625 },
    source: BRIEF + '; robot derived from the old 0.5 km/h and cost table',
  },
  roverRefKmh: {
    value: 8,
    source: 'the rover row above is for the 8 km/h setting; flat smooth = the speed setting (5/8/15)',
  },
  roverSlopeFloor: {
    value: 0.4,
    source: BRIEF + ': rover slows linearly to 40% at the slope limit, climbing or descending',
  },
  tobler: {
    a: 6, b: 3.5, c: 0.05,
    source: 'Tobler 1993 hiking function v = 6 exp(-3.5 |tan θ + 0.05|), scaled so flat ground = the class speed',
  },
  slopeLimitDeg: {
    rover: 20, walk: 15,
    source: 'mission.js PLACEHOLDERS.slopeRover / slopeWalk (team question L3, verify)',
  },
  science: {
    value: { S4: 5, S3: 4, S1: 4, S2: 2, S5: 1 },
    source: BRIEF + ': science value per station, higher = more worth the day',
  },

  // ---- Stage 4: honest about uncertainty ----
  pessimistic: {
    value: { smooth: 0.9, rocky: 0.6, rough: 0.6, loose: 0.6, steep: 1, trough: 1, unknown: 0.6 },
    source: STAGE4 + ': bad-ground speed = this × hopeful speed. Trough not given in the brief, left at 1',
  },
  hiriseBonus: {
    value: 0.1,
    source: STAGE4 + ': route cost × (1 − this) inside HiRISE strips (site.json hirise bounds), so routes prefer ground we can see',
  },
  edgeSetback: {
    km: 0.3, penalty: 1,
    source: STAGE4 + ': cost × (1 + penalty × (1 − d / km)) within km of the trough band, rim crest or a traced crack',
  },
  rimCrest: {
    rInKm: 7.4, rOutKm: 7.9,
    source: 'brief: rim crest about 7.4–7.9 km from the crater centre (319.54° E, 28.425° N)',
  },
  radioShadow: {
    costPerMin: 0.5,
    source: STAGE4 + ': extra cost-minutes per minute driven in radio shadow, unless a relay is set (rover parked on the rim)',
  },
  // ---- Stage 5: during the drive ----
  replan: {
    everyMin: 5, offPathCells: 1,
    source: 'planner brief Stage 5: replan every 5 simulated minutes, or when the rover is more than 1 cell off the path',
  },
  positionError: {
    pctOfKm: 2, minKm: 0.02,
    source: 'mission.js PLACEHOLDERS.drErrorPct (2 % of distance since the last station, reset at each station); 20 m floor as in the live Field ring',
  },
  // ---- Stage 6: smoother, shorter paths ----
  straighten: {
    sampleKm: 0.05,
    source: 'planner brief Stage 6: sample straightened segments every 50 m (grade and time); blocked/costlier cells are checked on every cell the segment touches',
  },
  energy: {
    kwhPerKm: 0.5, climbKwhPer100m: 1, packKwh: 100, floorPct: 25,
    source: STAGE4 + ': 0.5 kWh/km from the brief; climb term per 100 m of ascent is a guess; 100 kWh pack and 25 % floor from the live Sols battery model (both "placeholder, verify")',
  },
}
