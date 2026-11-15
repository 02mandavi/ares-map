# A.R.E.S. Mission Concept Review

Reviewer role: conceptual systems-engineering review, not NASA, not flight-qualified. Date: 2026-11-14.

**Evidence labels.** [V] = seen in a source this session (web search snippet or fetched page; landing pages and PDS labels not yet opened). [U] = unverified or from memory; check before relying. [A] = my assumption.

## 0. Limits of this review (read first)

- **Existing A.R.E.S. material (found 2026-11-14 in `Documents/Codex/2026-11-12/first-principles-thinking-first-principles-thinking/outputs/`).** No map, code or data pipeline exists. What exists:

| Item | What it is | Direction it tells |
|---|---|---|
| `ARES_Mars_Survival_Map.pdf` | Original 7-page concept ("Autonomous Real-time Extravehicular Synthesis"): five layers, terrain mesh to oxygen-horizon routing, visor + mission-control views | Crewed EVA to **Mount Sharp boxwork** (Gale). **File not found on disk**; known only through the reviews below |
| `ARES_First_Principles_and_Lateral_Review.pdf` (12 Nov) | Codex review: "plan the next safe decision, not just the best route"; rejects guarantee language, synthetic terrain, single score | EVA decisions |
| `ARES_Mars_Explainer.mp4` + `.srt`, `TREATMENT.md`, `VOICEOVER.md` | **Built:** 2-min narrated paper-cut film, end card "Concept visualization. Not flight validated." | Crewed EVA to Mount Sharp boxwork |
| `ARES_Mars_Mission_Full_Context_Updated.md` (14 Nov) | Working document: team **NASA Walo Ka Group**, **Delhi** local event. Pressure test, SCAMPER, 2025-winner benchmark, five judging criteria, challenge resource list, CTA | **"Current direction": rover/science team triages fractures; scout first; refuse to drill when evidence is weak** |

- **The two directions conflict.** The film shows an astronaut EVA to Gale; the current CTA ("A crack is a clue, not a conclusion…") is about fracture triage for a rover team, with no site named. This review resolves that in section 1.
- **Challenge text:** still not read from spaceappschallenge.org (TLS error to my tools). The team's working document lists the challenge resources as Mars Trek, the USGS–NASA Planetary Geologic Mapping Program, **JPL's Curiosity proposed-path-up-Mount-Sharp map (PIA23179)**, NASA Worldview and the Perseverance raw-image gallery, and gives the five judging criteria as Impact, Creativity, Validity, Relevance, Presentation (from 2025 pages). Treat these as secondhand until someone reads the 2026 page.
- **The official challenge page was not read.** spaceappschallenge.org failed with a TLS certificate error from the fetch tool. Challenge text comes from an unofficial third-party summary (spacedata.swapniltamse.com, which says it is not affiliated with NASA). Open the official page yourselves and check the deliverable and judging criteria.
- Search snippets, not full dataset landing pages, back most of the data facts below. Section 5 lists what still needs checking per layer.

## 1. Executive recommendation

**Strongest concept: "A.R.E.S. as a candidate-feature triage and stop-rule tool for one named study area."** Not a rover autonomy system, not a life detector, not a drill planner.

**Key finding: your framing and the challenge probably do not match.** The unofficial summary describes the challenge as layering several NASA Mars datasets into one view of a location or route so a future astronaut can plan a safe, science-rich Marswalk [V, unofficial]. A.R.E.S. as briefed (rover, subsurface habitability, deep drill, sample concept) is a different mission. Judges scoring against "Martian Map" may see it as off-topic.

**Recommended reframe:** keep the decision-support core (evidence, uncertainty, stop rules). Primary user: the **science-operations team planning which fracture to scout next** (the team's current direction). Output: a **layered map** with a per-fracture recommendation (map / scout first / defer / stop), plus the access and return check along the route to it. The film's crewed EVA becomes the **future phase** that the same evidence would serve. Drilling and subsurface sampling stay "concept, later phase".

**Study area (revised 2026-11-14): Mount Sharp boxwork, Gale crater** [recommended; team to confirm]. Earlier drafts used Jezero; Gale is stronger for this team because:
1. **The feature is a fracture network.** NASA describes the boxwork as crisscrossing ridges 1–2 m tall over 10–20 km of Mount Sharp, with calcium-sulfate veins and nodules left by groundwater, implying a higher, longer-lived water table [V, NASA/JPL releases via search]. That fits "fractures + habitability motivation" exactly, without any life claim. The ridge-formation mechanism is not yet verified from a primary source [U].
2. **Ground truth exists at the site.** Curiosity studied the boxwork from mid-2025 until about March 2026 [V, snippet], so orbital fracture calls can be checked against rover views.
3. **It matches what the team already built:** the film, the original concept PDF, and the challenge's own Curiosity Mount Sharp route resource.
4. **Curiosity RAD becomes site data**, not just an illustration (it was flagged as Gale-only in section 5).
5. **Coverage is confirmed** [V, STAC API, search box lon 137.25–137.55° E, lat 5.0–4.6° S]: 12 HiRISE DTMs (about 1 m), at least 100 CTX DTMs (20 m), and at least 100 HiRISE observations (0.25–0.5 m). The search returned 100, the request limit. The search box approximates the boxwork area; confirm the boxwork coordinates.

Jezero stays the fallback: its stage-2 source matrix (section 5) is complete, and the method transfers unchanged (same STAC collections, same CRS).

### 1b. Site comparison, including Acidalia Planitia (added 2026-11-14)

The team proposed two Acidalia sites targeting mounds thought to be mud volcanoes:
- **A: 44.5° N, 317.2° E.** HiRISE ESP_019612_2250 (2 Oct 2010), NASA/JPL PIA13652 "Proposed Future Mars Landing Site". Stereo partner ESP_025203_2250 [V].
- **B: 40.1° N, 333.3° E.** HiRISE ESP_017950_2205 (26 May 2010), "A Potential Future Mars Landing Site: Mounds in Acidalia Planitia". Stereo partner ESP_018583_2205 [V].

Both are 2010 proposals; I found no later selection status [V, absence in search].

| Criterion | Gale / boxwork | Acidalia mounds (A or B) | Jezero |
|---|---|---|---|
| Fit to "subsurface habitability" motivation | Good: groundwater mineral veins and nodules [V] | **Best:** mud volcanoes would bring material up from meters to kilometers depth; NASA says sediment "could contain organic materials" [V]. Lets A.R.E.S. **sample what Mars already brought up instead of drilling** | Good: lake/delta, carbonates [V] |
| Fit to fractures | **Direct:** boxwork ridges are a fracture-related network [V; mechanism U] | Indirect: mounds are discrete; giant polygons (fracture troughs) are linked to fluid expulsion (Oehler & Allen 2012) [V, snippet] | Mapped fractured floor units [V] |
| Candidate count for triage | One large network | **Thousands of similar mounds** (over 18,000 mapped, maybe over 40,000) [V], ideal for "chosen target vs rejected look-alike" | Several units |
| Interpretation certainty | Rover-confirmed groundwater minerals | **Contested:** mud vs igneous, hydrothermal springs, pseudocraters [V]; mounds possibly 2–3 Gyr old (Tanaka), weakening life relevance [V] | Partly rover-confirmed |
| Ground truth | **Curiosity at the site, 2025–26** [V] | **None:** no lander has examined a putative mud volcano [V] | Perseverance (PLACES) [V] |
| Elevation data (USGS STAC) | 12 HiRISE DTMs + ≥100 CTX DTMs [V] | **0 HiRISE DTMs; 1 CTX DTM (~23 m) per site** [V]. HiRISE stereo pairs exist, so a DTM is possible, but building one (e.g., Ames Stereo Pipeline) is a large job | 16 HiRISE + 66 CTX [V] |
| HiRISE images in box | ≥100 | **A: 8, B: 4** (two observations × RED/COLOR each), 0.25–0.55 m [V] | 476 |
| Subsurface / ice | n/a | SHARAD: no significant reflectors, heavy clutter (SWIM, LPSC 2019); shallow ice unresolved [V, snippet] | n/a |
| Human-mission angle | Matches the film's EVA | Mid-latitude; ice for ISRU not established here (better evidence in Arcadia) [V] | Weak |
| Matches existing team assets | **Film, concept PDF, challenge's Mount Sharp route resource** | None | Challenge's Perseverance image resource |

**Recommendation: keep Gale/boxwork as the prototype site.** It wins on Validity (rover ground truth, dense elevation data) and continuity (the film and concept already exist), and the feature *is* fractures.

**When Acidalia is the better choice:** if the team decides the core story is "reach subsurface material without drilling". That story is distinctive and judges would remember it. Go in knowing the costs:
1. The prototype must say "mounds **interpreted as** mud volcanoes" and show the competing hypotheses on every card.
2. Hazard checks run on about 23 m elevation data, so most of the map stays "unknown at boot/wheel scale". That is honest, but visually thin.
3. There is nothing to validate against except published mapping. The baseline becomes the Oehler & Allen mound catalog, if its data are obtainable [U].
4. The film no longer matches the site.

**Low-cost way to use both:** build on Gale; use Acidalia only as a closing "where A.R.E.S. goes next" slide, stating the "sample what Mars brought up" idea as a future concept. Do not build two sites.

## 2. Mission definition

| Item | Definition |
|---|---|
| Primary user | A science/EVA planner on a student-scale mission design team (assumption; confirm). |
| Decision | For a route through the study area, which fracture/crater features deserve close inspection, which need a scouting pass first, and which should be skipped or deferred. |
| Objective | Produce a reproducible, source-cited map with per-feature evidence, uncertainty and a recommendation (map / scout / defer / stop). |
| Success measures | (a) Every displayed claim links to a layer and its limits. (b) Recommendations change correctly when inputs are degraded (failure injection). (c) A reviewer can reproduce the ranking from raw data. Metrics are defined in section 9; no numbers are claimed yet. |
| Constraints [A] | Student team, public data only, no hardware, web or Python prototype, deadline per the official challenge page [U]. |
| Non-goals | Detecting life; proving habitability; driving a rover; designing a drill; flight-qualified safety analysis; any claim about subsurface biology from surface cracks or radar. |

## 3. Assumptions and evidence ledger

| # | Statement | Status | Verification action |
|---|---|---|---|
| 1 | Challenge title exists in the 2026 Space Apps list | [V] several third-party pages list it | Read official page |
| 2 | Deliverable is a layered location/route view for Marswalk planning | [V, unofficial paraphrase] | Read official text and judging rubric |
| 3 | 66 USGS CTX DTMs cover the study box: 20 m posts, ~3–5 m expected vertical precision, MOLA-controlled, CC0-1.0, DOI 10.5066/P9JKVWR3 | [V, STAC API + docs, stage 2] | Download; read `qa_metrics.txt` per DTM |
| 4 | 16 HiRISE DTMs cover the box (1–2 m posts, "tens of centimeters" precision, CC0-1.0). The separate Mars 2020 TRN HiRISE mosaic reportedly has <2.3 m inter-DTM offsets (99th pct) except at the rim | [V, STAC + UArizona]; TRN mosaic figure [V, snippet only] | Open the TRN mosaic page in a browser (403 to tools); test registration yourself |
| 5 | SHARAD is a 20 MHz sounder that can theoretically reach about 1 km; vast regions have no SHARAD returns | [V, snippets] | Check SHARAD coverage at your site on PDS |
| 6 | Radar interfaces can be ice/bedrock or lava-flow boundaries (ambiguous) | [V, Cerberus Palus snippet] | Treat all radar interfaces as ambiguous |
| 7 | COSPAR planetary protection uses Category IVa/IVb/IVc; IVc applies to access to Special Regions | [V, secondary sources, older] | Read current COSPAR policy; do not rely on Wikipedia or 2006-era reports |
| 8 | Mars Trek serves a CTX global mosaic (5 m, uncontrolled) and MOLA hillshade via WMTS | [V, unofficial list] | Fetch the capabilities XML and test tiles |
| 9 | CRISM MTRDR, HiRISE, Ames climate simulations and Curiosity RAD are listed starting points | [V, unofficial list] | Confirm each exists at your site; Curiosity RAD is measured at Gale only, not Jezero |
| 10 | Lower Séítah is described as a polygonally fractured, olivine-bearing unit; HiRISE-based floor maps exist at 1:5000 and 1:2500 | [V, abstracts/snippets] | Read full papers (Crumpler et al. 2023; PMC7116714) before naming features |
| 12 | Perseverance localizations are public (PLACES bundle, sols 0–1897) | [V, PDS page] | Read the SIS for the coordinate frame |
| 13 | Orbital "marginal carbonates" not yet confirmed on the ground by Perseverance | [V, 2022 snippet; may be outdated by 2026] | Check later mission papers |
| 11 | Team size, skills, compute, deadline | Unknown | Ask the team |

## 4. Options and selected concept

| Option | Fit to challenge | Feasibility | Credibility risk | Verdict |
|---|---|---|---|---|
| A. Fracture network mapper (automatic detection) | Medium | Medium; needs labeled ground truth | High: false detections, scale dependence | Reject as the core; use as one input |
| B. Crater reconnaissance | Medium | High | Low | Fold in as a feature class |
| C. Candidate-site triage with stop rules (selected) | High if user is a route/EVA planner | High | Low-medium | **Select** |
| D. Route-to-target planner (slope, hazards, distance) | Very high | Medium-high | Low | Include as a layer inside C, not a separate system |
| E. Subsurface habitability / drill concept | Low | Low | Very high: no data supports it | Reject; state as long-term motivation only |

**Selected slice:** C + D for one study area, about 5 to 15 hand-curated candidate features along or near a route, each with an evidence card.

## 5. Dataset / source matrix

> **Site note:** the tables below were verified for **Jezero**. If the team confirms **Gale / Mount Sharp boxwork** (section 1), redo rows 1–5 for Gale. Same STAC collections and CRS; coverage is already confirmed. Swap the Jezero-specific rows: SIM 3464 → a Gale/Mount Sharp geologic map; Mars 2020 PLACES → MSL (Curiosity) localization products; Jezero papers → boxwork papers. Applies at any site: uncontrolled HiRISE observations carry **about 100 m** ground-location uncertainty [V, STAC item description]. Never measure on them before co-registration.

**Stage 2 status (2026-11-14).** Verified by: (a) querying the USGS Astrogeology STAC API directly (`stac.astrogeology.usgs.gov/api`), (b) reading PDS Geosciences Node, HiRISE and Mars Trek pages, (c) search snippets where pages refused automated access (all `astrogeology.usgs.gov/search/...` pages and `pubs.usgs.gov` returned HTTP 403 or TLS errors; open them in a normal browser). Study-area search box used: lon 76.8–78.2° E, lat 17.7–19.0° N.

"Type": M = measured, D = derived, I = interpreted, Mod = modeled.

### 5a. Minimum viable layer set (recommended for the prototype)

| # | Layer | Product and access | Type | Verified facts | Supports | Cannot support |
|---|---|---|---|---|---|---|
| 1 | Regional elevation | **USGS CTX DTMs** (STAC collection `mro_ctx_controlled_usgs_dtms`); Cloud-Optimized GeoTIFFs on AWS S3 (`astrogeo-ard`). Citation: Laura et al. 2023, DOI 10.5066/P9JKVWR3 | D | **66** DTMs intersect the box [V, STAC]. 20 m post spacing; true resolution coarser (10–20 image pixels); expected vertical precision about 3–5 m; absolutely controlled to MOLA via `pc_align`; aeroid-referenced; license CC0-1.0 [V, STAC docs]. Each item ships `dtm`, `orthoimage`, `hillshade`, `intersection_error` rasters and a `qa_metrics.txt` of CTX–MOLA differences [V] | Regional slope and relief; route corridor screening; uncertainty map from `intersection_error` | Meter-scale hazards (boulders, small scarps); seams between adjacent DTMs (offsets "may look like cliffs") |
| 2 | Local elevation + orthoimage | **HiRISE DTMs** (STAC `mro_hirise_socet_dtms`, derived from PDS `MRO-M-HIRISE-5-DTM-V1.0`); COGs on S3 | D | **16** DTMs intersect the box, about 1 m (U-series) or 2 m (A-series) gsd [V, STAC]. Several made for "Candidate landing site for 2020 mission in Jezero Crater" [V, item description]. Each ships `dtm`, `hillshade`, orthoimages and a `fom` (figure-of-merit) raster [V]. UArizona: post spacing 1–2 m; "vertical precision in the tens of centimeters"; known artifacts include 0.5–1 m "boxes", CCD seams, faceting in bland or shadowed terrain, manually interpolated areas [V]. License CC0-1.0 [V] | Local slope near candidates; morphology; error-aware hazard map | Areas outside the 16 footprints (patchy); FOM meaning not documented on the pages read [U] |
| 3 | High-res imagery | **HiRISE observations** (STAC `mro_hirise_uncontrolled_observations`) | M | **476** observations intersect the box, about 0.25–0.5 m gsd, newest dated 2026-07-22 [V, STAC]. **Uncontrolled**: positions not tied to MOLA [V, collection name] | Fractures, boulders, textures; repeat imaging for shadow/lighting comparison | Absolute position (must co-register to layer 2 before measuring) |
| 4 | Geologic context | **Sun & Stack 2020, USGS SIM 3464**, *Geologic Map of Jezero Crater and the Nili Planum Region, Mars*, DOI 10.3133/sim3464 | I | 1:75,000; about 60 × 60 km (1° × 1°; per snippet, roughly lon 76.8–77.8° E, lat 17.7–18.7° N; check the sheet); base CTX mosaic 6 m/px; GIS database zip (349 MB) [V, search snippet; page 403] | Unit boundaries; which candidates sit in which unit | Anything finer than map scale; map is an interpretation |
| 5 | Ground truth (validation only) | **Mars 2020 PLACES bundle**, PDS Geosciences Node | M | "rover localizations and mechanism positions"; Release 16 covers 2021-02-18 to 2026-06-21, sols 0–1897; collections include Localizations, Maps, Orbital [V]. Coordinate frame and DOI not stated on page; see `Mars2020_Rover_PLACES_PDS_SIS.pdf` [U] | Checking A.R.E.S. route/hazard calls against where the rover actually drove | Use as training labels for "safe" (rover routes reflect many non-terrain factors) |

### 5b. Optional / context layers

| Layer | Product | Type | Verified facts | Use | Caveat |
|---|---|---|---|---|---|
| Basemap | Mars Trek `CTX_beta01_uncontrolled_5m_Caltech` (WMTS) | M | Global extent; PNG tiles; levels 0–11, tile set `default028mm`; CRS `EPSG::104905`; tiles served from `astro.arcgis.com` [V, GetCapabilities]. No usage terms stated [V] | Display basemap only | Title says **BETA, uncontrolled**: do not measure on it |
| Mineralogy | CRISM MTRDR (PDS4), volume MROCR_4001 | D | Covers 2006-09-30 to 2012-05-21; "map-projected using terrain models"; CRISM L detector stopped 2018-02-15 (cooler failure) [V]. Pixel scale and projection not stated on page [U] | Mineral context (olivine, carbonate) per candidate | Footprints at your candidates not yet checked |
| Mineral interpretation | Horgan et al. 2020, Icarus, DOI 10.1016/j.icarus.2019.113526; Brown et al. 2020, JGR Planets | I | "Marginal carbonates" along inner rim near inlet and delta, proposed possible lacustrine carbonates; olivine–carbonate association [V, snippets]. A 2022 paper notes Perseverance had not encountered the marginal-carbonate lithology [V, snippet] | Science-interest axis, cited | Orbital mineral ≠ confirmed on ground; use as hypothesis |
| Fracture context | Lower Séítah unit described as "polygonally fractured" with CRISM olivine signatures (GSA 2021 abstract); HiRISE-based photogeologic map at 1:5000 (PMC7116714); Crumpler et al. 2023 JGR Planets field mapping [V, snippets] | I | | Defines which fractures are known/mapped; ground truth for a fracture detector | Abstracts and snippets only; read full papers before citing specifics |
| Thermal | THEMIS IR controlled mosaics (STAC `mo_themis_controlled_mosaics`, quad MC-13 Syrtis Major, day and night, 100 m) | M/D | 2 items cover the box [V, STAC] | Night IR as a proxy for surface texture or rockiness | 100 m; proxy, not a hazard measurement |
| Radar | SHARAD US radargrams (PDS4 `mro_sharad_us_radargrams`, 2006-12-06 to 2026-02-09) + clutter simulations; 3D volumes exist (Putzig/MDAP) [V] | M, I | | Context only | Ground tracks over Jezero not checked; ambiguous interfaces; **do not use for any habitability claim** |
| Climate | Ames Mars climate simulations | Mod | Listed [V, unofficial] | Environmental context, labeled "model" | Not site-measured |
| Radiation | Curiosity RAD | M | Listed [V, unofficial] | Illustrative only | Measured at **Gale**, not Jezero |

### 5c. Data-use and alignment notes

- **Licenses:** USGS STAC Mars collections are labeled **CC0-1.0** [V]. Still cite the producers (Laura et al. 2023 for CTX; UArizona HiRISE team and Kirk et al. 2008, DOI 10.1029/2007JE003000, for HiRISE DTM methods). HiRISE image credit policy is at `uahirise.org/media/usage.php` (not read). Mars Trek terms not stated.
- **One CRS:** both DTM collections use *Mars (2015) – Sphere / Ocentric / Equirectangular, clon = 0* (radius 3,396,190 m), planetocentric, east-positive longitude [V, STAC `proj:wkt2`]. Reproject everything to this; Mars Trek uses a different CRS ID.
- **STAC date fields are not acquisition dates.** HiRISE DTM items show `2006-09-29` and CTX DTM items `2023-04-18` [V]; these are placeholders or processing dates. Get acquisition dates from the source image IDs and PDS labels.
- **Elevation reference:** CTX DTMs are adjusted to the Mars aeroid (geoid) [V]; check that HiRISE DTMs use the same vertical datum before differencing them.
- **Not allowed:** NASA Worldview or other Earth data presented as Mars data.

### 5d. Planetary protection (for the stop rules)

COSPAR categories: IVa (other surface missions), IVb (searching for extant life), IVc (accessing Special Regions) [V, secondary]. A 2025 COSPAR policy reportedly sets Special Region lower limits at water activity 0.5 and −28 °C, approved 2025-11-07 [V, slide-deck excerpt only]; the 2015 policy used 0.5 and −25 °C [V]. **Read the current COSPAR policy text before citing numbers.** For A.R.E.S., the stop rule is simple: any candidate flagged as a possible Special Region or Uncertain Region goes to STOP with "planetary-protection review required"; the tool never recommends sampling there.

## 6. System architecture and workflow

```
Raw layers (DEM, imagery, CRISM, SHARAD, geologic map)
  -> Registration check (reproject to one CRS, measure offsets at control points)
  -> Candidate list (hand-curated first; automatic suggestions labeled "proposed")
  -> Per-feature evidence card (4 separate axes + provenance)
  -> Route / access check (slope, relief, distance, shadows)
  -> Recommendation: MAP / SCOUT / DEFER / STOP, with reasons and ledger
```

**Workflow for the user:** regional view -> pick candidate -> evidence card -> access check -> recommendation with "why this, why not the nearest alternative".

**Four axes kept separate (no averaged score):**
1. Scientific interest (morphology, mineral context, geologic setting).
2. Traversability (slope, relief, surface texture, from DEM and imagery).
3. Safety hazards (cliffs, rim edges, steep walls, unknown terrain). **A hard hazard overrides the others and forces STOP or SCOUT.**
4. Return feasibility (distance, time, comms), stated as assumptions because no vehicle is specified.

Each card also lists **negative evidence** (layers that were checked and showed nothing or were absent) so "no data" is never shown as "no hazard".

## 7. Failure analysis and risk register

Ratings are qualitative (H/M/L) because I have no measured rates.

| Layer / step | Failure mode | Severity | Likelihood | Detect by | Mitigation | Fallback | Residual |
|---|---|---|---|---|---|---|---|
| DEM | Misregistration vs image (rim noted as worse) [V] | H | M | Compare ridge/crater edges across DEM and image; report offset | Mark low-confidence zones | Downgrade to SCOUT | M |
| DEM | Scale mismatch: 20 m DEM hides meter-scale hazards | H | H | Compare DEM slope with HiRISE boulder counts | State DEM minimum resolvable feature | Hazard = unknown, not low | M |
| DEM mosaic | Seams between adjacent CTX DTMs look like cliffs (documented [V]) | H | M | Map DTM footprint edges; check for slope spikes along them | Never mosaic blindly; flag slope on seams | Hazard = "artifact suspected", SCOUT | L |
| DEM | Stereo artifacts: CTX jitter "washboard", matching pits/bumps; HiRISE 0.5–1 m "boxes", faceting in shadow [V] | M | M | `intersection_error` / `fom` rasters; hillshade visual check | Mask high-error pixels; show error layer next to slope | Downgrade confidence | M |
| Dates | STAC date fields treated as acquisition dates (they are placeholders [V]) | M | H | Compare with image IDs/PDS labels | Parse dates from source image labels | Show "date unknown" | L |
| Imagery | Uncontrolled HiRISE images offset from DTMs | M | H | Tie points against DTM orthoimage | Co-register before measuring | Measure only on DTM orthoimages | L |
| Imagery | Shadows/dust hide fractures or hazards | M | H | Check sun angle and acquisition date | Use multiple images when available | DEFER | M |
| Fracture detection | False positives (shadow lines, rock edges, polygons, tracks) | M | H | Compare with hand labels on a held-out area | Label as "proposed"; require human confirm | Hand-curated list only | M |
| Fracture detection | Scale dependence of "fracture" | M | H | Run at two scales and compare | Report network at stated scale | Skip network statistics | M |
| CRISM | Patchy/missing coverage; low-quality pixels | M | H | Footprint overlay; quality flags | Show "no coverage" explicitly | Do not infer composition | L |
| SHARAD | Ambiguous interface; clutter; gaps [V] | M | H | Cross-check with geologic map | Never use radar to claim ice or habitability | Treat as "possible interface, unresolved" | M |
| Layer conflict | Layers disagree (e.g., mineral says X, morphology says Y) | M | M | Rule-based conflict flag | Show both, no averaging | SCOUT | L |
| Stale data | Newer imagery exists | L | M | Record acquisition date per layer | Display age | DEFER | L |
| Return / comms | Time delay or loss | H | H | Not simulated in prototype | Asynchronous plan with pre-agreed stop rules | Stop, hold position | M |
| Contamination | Sample/drill near potential Special Region | H | L-M | Flag features in or near gullies, recurrent features, or ice | Defer to planetary-protection review; do not recommend | STOP | M |
| Human overtrust | User treats ranking as truth | H | M | Show uncertainty and ledger prominently | Abstain when evidence is thin | STOP/DEFER | M |

## 8. Novel process ideas

| Idea | Solves | Value | Feasibility | Demo | Keep? |
|---|---|---|---|---|---|
| Uncertainty-aware abstention ("not enough evidence") | Overconfident rankings | High | High | High | **Yes** |
| Why-this / why-not-the-nearest-alternative explanation | Opaque ranking | High | High | High | **Yes** |
| Explicit negative-evidence list | "No data" read as "safe" | High | High | Medium | **Yes** |
| Stop-rule ledger (pre-committed triggers, logged) | Mission creep, overreach | High | High | High | **Yes** |
| Value-of-information: "which one extra scouting image most changes the decision?" | Choosing what to observe next | High | Medium | High | Yes if time |
| Competing-hypothesis display per feature | Premature interpretation | Medium | Medium | Medium | Maybe |
| Scale-aware fracture network | False detections | Medium | Low-Medium | Medium | Later |
| Low-bandwidth packet (a compact decision bundle) | Comms delay | Medium | Medium | Low | Later |
| Generic "AI ranking" | None specific | Low | High | Low | **No** |

## 9. Prototype plan

**Milestones**
1. Official challenge text and rubric read; study area and route fixed (day 1).
2. Layers downloaded, one CRS, offsets measured and recorded.
3. 5 to 15 candidates hand-curated with cards and ledger.
4. Decision logic (four axes, hard-hazard override, abstention).
5. Web map with layer toggles, evidence card, why/why-not panel.
6. Failure-injection demo and recorded video.

**Acceptance criteria (measurement method, no invented targets)**
- Provenance: 100% of displayed facts link to a source layer and date (checked by audit script).
- Reproducibility: a teammate regenerates the ranking from raw data (pass/fail).
- Baseline: compare against "rank by DEM slope only" and "rank by distance only"; report where A.R.E.S. differs and why, judged against Perseverance traverse or published geologic map where applicable.
- Fracture detector (if included): precision and recall against hand labels on a held-out tile; report as measured.

**Failure-injection scenarios**
1. Shift the DEM by a stated offset: confidence drops; recommendation moves from MAP to SCOUT.
2. Remove HiRISE coverage at a candidate: abstains / DEFER.
3. Add a steep rim-adjacent hazard: STOP regardless of science score.
4. CRISM and morphology conflict: SCOUT with both shown.
5. Candidate near a Special-Region-type flag: STOP and defer to planetary-protection review.

## 10. Submission package

- **Title (working):** A.R.E.S.: Evidence-First Martian Map for Route and Target Triage.
- **Summary:** A layered Mars map for one study area that ranks fracture and crater candidates on separate science, access, hazard and return axes, shows uncertainty and missing data, and recommends map, scout, defer or stop with a logged reason.
- **Rubric mapping** (official rubric unread; check names): impact = safer, faster EVA/route planning; creativity = stop-rule ledger, abstention, why-not; validity = sourced layers, measured registration, failure injection; relevance = layered Mars data for a route (matches the unofficial challenge description); presentation = storyboard below.
- **Storyboard:** (1) region map; (2) pick a candidate; (3) evidence card with negative evidence; (4) route/access check; (5) inject a fault; (6) recommendation flips to SCOUT; (7) ledger and credits.
- **Demo script (90 s):** state the user and decision; show the map; open a card; inject a DEM shift; show the flip and the ledger entry; end on what is *not* claimed.
- **Credits:** each source with provider, DOI/landing page and access date (fill from section 5 once pages are opened). Mars Trek, USGS Astrogeology, UArizona HiRISE, NASA PDS.
- **Claims must match build.** If it is not running, say "concept".

## 11. Ten red flags

1. Claiming life, habitability or subsurface biology from images or radar.
2. Framing mismatch with the challenge (rover/drill vs. Marswalk map).
3. Averaged risk score hiding a hard hazard.
4. "No data" displayed as "no hazard".
5. Unmeasured registration between DEM and imagery.
6. Using Gale (Curiosity RAD) or Earth data as Jezero or Mars-site data.
7. Invented accuracy numbers or unlabeled model output.
8. Missing licenses, citations, access dates.
9. Fiction or concept art presented as engineering evidence.
10. Claiming rover autonomy, drilling or return capability that is not built or tested.

**Added after reading the existing material:** the finished film tells the **EVA** story while the CTA and product tell the **fracture-triage** story. If judges see both unreconciled, Relevance and Presentation suffer. Fix by either (a) re-cutting the film's narration around one boxwork fracture decision, or (b) presenting the film explicitly as "the crewed future phase" after the fracture-triage demo. The film's existing guardrails (no NASA imagery, "Not flight validated" end card) are good; keep them.

## 12. Next five actions

1. Open the official challenge page in a normal browser; copy the deliverable, rubric, deadline and resource list into the repo.
2. Decide the user and the study area (confirm Jezero or choose another); commit the A.R.E.S. files to this folder.
3. Open each section-5 landing page; record DOI, CRS, resolution, license, coverage at your site.
4. Download the layers, reproject, measure DEM/image offsets, and record the numbers.
5. Hand-curate 5 to 15 candidates, build evidence cards, and write the failure-injection tests before any detector.

## Staged skills and tooling

Your list says to use skills in stages, not all at once. Mapping to this plan (the Codex skills do not transfer; the purpose is carried here as instructions):

| Stage | Skill purpose | What it produces | Notes |
|---|---|---|---|
| 1. Frame | First-principles; lateral thinking | Sections 2 to 4 of this review; "scout before sample" is already a kept idea | Done in draft |
| 2. Evidence | Deep / academic research | Filled source matrix: DOI, CRS, scale, date, license, coverage per layer; geologic map and papers for the study area | Done 2026-11-14 (section 5). Open items: SIM 3464 and TRN mosaic pages (403 to tools), CRISM footprints, full papers |
| 3. Validate data | Data exploration and validation | Offset measurements, coverage footprints, CRS table | Needs GDAL or rasterio, see tooling below |
| 4. Design | Architecture / system design | Section 6 data flow and interfaces turned into a diagram and module list | Prototype boundary: hand-curated candidates |
| 5. Build and show | Data visualization; accessibility review | Map, uncertainty display, evidence cards; contrast, labels, keyboard and colorblind-safe check | Uncertainty must be visible, not a tooltip only |
| 6. Package | PDF/document; video/storyboard | Report with citations; 2-minute explainer | Only after the mission story is stable |
| Not needed now | Reverse-engineer anything | Applies to existing code, maps or documents | There are none; use it if you later import a teammate's prototype |

**Tooling on this machine (checked 2026-11-14):** Python 3.13 and Node are installed. GDAL, QGIS and git were not found on PATH. Python has numpy but not rasterio, pyproj or geopandas. Before stage 3, install QGIS (includes GDAL) or `pip install rasterio pyproj`. Raster work needs no other dependency. Git not on PATH matters if you want version history of the project.

**Source rules from your list, applied:** NASA Worldview and Earthdata are Earth data, used only for analogue tests and interface ideas. Rover archives only where location and context are known. A dataset is not used until coverage, resolution, CRS, date, license and suitability for the decision are recorded.

## Questions that change the recommendation

- **Site:** Gale / Mount Sharp boxwork (recommended), Acidalia mounds (if the "sample without drilling" story matters most; see 1b), or Jezero?
- **Film:** re-cut its narration around the fracture decision, or present it as the crewed future phase?
- Does the official 2026 challenge page match the resource list in your working document? (Read it in a normal browser.)
- Team size, skills (GIS, Python, web), and the Delhi event's submission deadline?
- Where is `ARES_Mars_Survival_Map.pdf`? It is the original concept, and I could not find it on disk.

## Sources

Stage 2, read directly (2026-11-14):
- USGS Astrogeology STAC API: https://stac.astrogeology.usgs.gov/api (collections `mro_ctx_controlled_usgs_dtms`, `mro_hirise_socet_dtms`, `mro_hirise_uncontrolled_observations`, `mo_themis_controlled_mosaics`)
- CTX DTM documentation: https://stac.astrogeology.usgs.gov/docs/data/mars/ctxdtms/
- HiRISE DTM about page: https://www.uahirise.org/dtm/about.php
- PDS Geosciences CRISM: https://pds-geosciences.wustl.edu/missions/mro/crism.htm
- PDS Geosciences SHARAD: https://pds-geosciences.wustl.edu/missions/mro/sharad.htm
- Mars 2020 PLACES: https://pds-geosciences.wustl.edu/missions/mars2020/places.htm
- Mars Trek API and CTX WMTS capabilities: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars

Stage 2, search snippets only (pages refused automated access or not opened):
- Sun & Stack 2020, SIM 3464: https://pubs.usgs.gov/publication/sim3464
- Horgan et al. 2020: https://pubs.usgs.gov/publication/70211826 ; Brown et al. 2020: https://arxiv.org/pdf/1904.11414 ; 2022 caveat: https://arxiv.org/pdf/2206.13380
- Jezero floor mapping: https://pmc.ncbi.nlm.nih.gov/articles/PMC7116714 ; https://gsa.confex.com/gsa/2021AM/webprogram/Paper369062.html ; Crumpler et al. 2023: https://ntrs.nasa.gov/api/citations/20230016438/downloads/Crumpler%20et%20al%202023%20JGR%20Planets%20Mapping%20of%20Jezero.pdf
- COSPAR special regions: https://appel.nasa.gov/2016/03/09/mars-special-regions-redefined ; https://www.nap.edu/read/21816/chapter/3

Gale / boxwork (search snippets of NASA/JPL releases, 2026-11-14):
- https://www.jpl.nasa.gov/news/nasas-curiosity-mars-rover-starts-unpacking-boxwork-formations/
- https://www.jpl.nasa.gov/news/nasas-curiosity-rover-sees-martian-spiderwebs-up-close/
- https://www.jpl.nasa.gov/images/pia26560-curiosity-views-boxwork-patterns-at-a-distance/
- Challenge resource: https://www.jpl.nasa.gov/images/pia23179-curiositys-proposed-path-up-mount-sharp/ (from the team's working document)

Acidalia (pages found via search, 2026-11-14; STAC queried directly):
- https://www.uahirise.org/ESP_019612_2250 ; https://photojournal.jpl.nasa.gov/catalog/PIA13652 ; https://hirise.lpl.arizona.edu/ESP_025203_2250
- https://www.uahirise.org/ESP_017950_2205 ; https://hirise.lpl.arizona.edu/ESP_018583_2205
- Oehler & Allen 2010, Icarus: https://lpl.arizona.edu/~shane/PTYS_554_2019/reading/oehler_allen_icarus_2010.pdf
- Hemmi & Miyamoto 2018, Geosciences: https://mdpi.com/2076-3263/8/5/152
- SWIM LPSC 2019 (SHARAD in Acidalia): https://swim.psi.edu/resources/abstracts/LPSC2019/2069.pdf

Stage 1 (search results):

- https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic
- https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic
- https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_hirise_dtm_mosaic
- https://spacedata.swapniltamse.com/challenges/martian-map/ (unofficial)
- https://www.planetary.org/space-images/sharad-radargram-ground-ice
- https://www.nap.edu/read/21816/chapter/3 (planetary protection background)
