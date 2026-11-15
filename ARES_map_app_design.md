# A.R.E.S. mission map: web app design draft v0 (2026-11-14)

Status: **design thinking only, nothing built.** Based on what the team has decided so far (see `ARES_planning_questions.md`, Parts 6–9). Items marked **Q** need a team answer; the questions are listed at the end.

## 1. What the app is (first principles)

**One job:** help four astronauts decide, before and during each daily EVA, where they can safely go to study cracks and get back to the habitat before the 7-hour limit, with what is known and **what is not known** always visible.

**Signature (what the app is remembered by):** the **time-bounded reach map**. Every point on the ground shows *"can we get there, work, and return in time?"* rather than just *"what is here?"*. The turn-back line moves as the day goes on.

**Pre-flight (Hallmark step 0):** no web project, design system or tokens exist in this folder yet. Material available: CTX P15_006980_2087 (5.7 m), HiRISE ESP_022869_2085 and ESP_050666_2090 (0.5 m), the habitat point (~28.43° N, 319.77° E), the crack targets, and the reach maths. Missing: DTM, real thermal-satellite data (the satellite is an assumed asset), real rover or helmet tracks.

## 2. Four modes, one map

| Mode | Who | Where | What it shows |
|---|---|---|---|
| **Plan** | the whole crew, the evening before | habitat, laptop or large screen | all layers, route building, time budget per station, print export |
| **Field** | rover driver and EVA lead | rover screen; a simplified view on the helmet | position with an error circle, the next station, time to turn back, hazards nearby. Few layers, big type, dark |
| **Debrief** | crew, after the EVA | habitat | planned route vs actual track, notes and photos per station, what changed on the map |
| **Print** | — | — | produces the paper sheets: overview, target sheet, route sheet |

The paper copy stays the primary backup; the app *produces* it and does not replace it.

## 3. Layer stack (bottom to top)

Every layer carries a **provenance card** (source, product ID, date, resolution, CRS, licence) because the brief requires a citation for every claim.

### A. Base imagery (choose one)
| Layer | Source | Resolution | Coverage |
|---|---|---|---|
| CTX image | MRO CTX P15_006980_2087 | ~5.7 m | crater + habitat (full area) |
| HiRISE strips | ESP_022869_2085, ESP_050666_2090 | 0.5 m | two strips only, not the east rim |
| Shaded relief | MOLA global | ~463 m | context only |
| Thermal (day/night) | THEMIS IR | ~100 m | rock vs dust |

### B. Knowledge layers (what we know and how well)
| Layer | Content | Style idea |
|---|---|---|
| **Coverage / confidence** | where 0.5 m, 5.7 m, or only 100 m data exists | areas not seen at high resolution are visibly hatched as "unknown", never shown as safe |
| **Cracks** | crack lines traced by the team; each tagged *confirmed* / *possible* / *rejected (wind groove)* | line weight shows confidence |
| **Science targets** | troughs (1–3 km W), crater wall layers, central peak, wind-carved ejecta | numbered stations matching the paper map |
| **Thermal satellite (simulated)** | the assumed asset; must be labelled *simulated* until real data exists | **Q** |

### C. Safety layers (where the crew may go)
| Layer | Content |
|---|---|
| **Slope classes** | green, amber or red by walk and rover slope limits. **Blocked: no DTM yet.** Shown as "no data" |
| **Robot-only zones** | possible Special Regions (gullied inner walls, inside cracks): crew not allowed |
| **Edge setback** | buffer along each crack edge (distance **Q**, K-L1) |
| **Radio shadow** | areas hidden from the habitat antenna. **New point:** the crater rim blocks line of sight, so the crater floor and peak are likely in radio shadow and need a relay (rover or mast) |

### D. Time layers (the signature)
| Layer | Content |
|---|---|
| **Reach rings** | rover reach for the chosen speed (5, 8 or 15 km/h) and the 7 h limit minus work time and reserve |
| **Walk-back ring** | how far the crew can be and still walk home if both rovers fail |
| **Turn-back line** | updates with the clock in Field mode: past this line you must start back now |
| **Route + stations** | planned legs with time per leg, work time per station, and reserve left |

### E. Position layers (Field / Debrief)
| Layer | Content |
|---|---|
| Rover and helmet position | dot plus **error circle** (no GPS on Mars; dead reckoning, landmark matching and orbiter fixes) |
| Landmarks | skyline features used for position checks (crater rim, scarp, small fresh craters) |
| Track | breadcrumbs, replayed in Debrief |

**Layer rules:** at most about 5 layers visible at once in Field mode; safety layers can never be hidden while moving; "unknown" always looks different from "safe".

## 4. Screen layout (app screen, not a marketing page)

- **Top bar:** mission day, the clock (EVA elapsed and remaining), the mode switch (Plan, Field, Debrief), the habitat link status.
- **Map:** full width.
- **Left panel (Plan):** layer list in groups A–E with on/off and opacity; the provenance card opens inline.
- **Right panel (Plan):** route builder (stations, times, reserve), and the print button.
- **Field mode:** panels collapse, big type, a single "time to turn back" readout, high-contrast dark theme.
- All states drawn: loading tiles, no data (e.g. DTM missing), error (lost position), full.

## 5. Technical notes (for the team's stack decision)

- **Mars coordinates:** use equirectangular, planetocentric, east-positive, Mars 2015 sphere (R = 3,396,190 m). Web map libraries default to Earth Web Mercator. OpenLayers and Leaflet support custom projections; MapLibre needs workarounds. **Q**
- **Image prep:** projecting the raw CTX EDR needs ISIS3 or a pre-projected product (e.g. a Murray Lab CTX mosaic tile); HiRISE RDRs are already projected. Tile with GDAL (`gdal2tiles`). QGIS for crack tracing.
- **Offline:** on Mars there is no internet; the app must run from local files in the habitat and rover. **Q**
- **Print:** export sheets as PDF at fixed scale.

## 6. Open questions → see chat (round 5, design)
