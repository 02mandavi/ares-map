# A.R.E.S. Mission Planning: First-Principles Question Set

Date: 2026-11-14. Team direction as of today: **A.R.E.S. is a scientific map for an astronaut on Mars**, at **Acidalia Planitia site A (44.5° N, 317.2° E)**, mounds interpreted as mud volcanoes. *How* the astronaut uses it is not decided yet. This file is for the team to fill in. Write answers under each question.

How this file was made:
- **/research, adapted.** The skill is built to mine user complaints about a software product. A.R.E.S. has no users yet, so the "user evidence" is how astronauts and field geologists have actually used maps (Apollo, NASA analog field tests).
- **/review-agent, adapted.** The skill reviews code diffs. Its rule is applied to the plan instead: only concrete, fixable findings, ranked P0 (blocker) to P3 (minor).
- **First-principles method:** for each topic, ask what must be true, what is only assumed, and what breaks.

---

## Part 1. Research brief: how astronauts actually use science maps

**Executive read.** The evidence says the hard part of a crew science map is not the picture. It is knowing **where you are**, **what the terrain is really like up close**, and **how to balance the science plan against the procedure under time pressure**. Apollo 14's crew got lost near Cone Crater because the terrain looked different on the ground than on the map. NASA's Mars-analog field tests (BASALT) found that scientists were overwhelmed juggling cue-card procedures with science goals, and that crews followed the cue cards rigidly even when discovery called for adapting. Precursor high-resolution imagery was critical for choosing stations. A Mars crew also works under communication delay, so Earth cannot steer in real time. For A.R.E.S., this points to a map that gives **landmarks and checkpoints**, makes the **science goal of each stop explicit**, and makes **unknown terrain visible**, rather than a richer 3D picture.

| # | Finding | Evidence (cited) | Confidence | What it means for A.R.E.S. |
|---|---|---|---|---|
| R1 | Crews can lose position when terrain looks different on the ground than on the map | Apollo 14 crew could not determine their location near Cone Crater "due to large boulders and various ridges"; they turned back about 30 m short of the rim (LRO reconstruction). Mitchell named "the roughness and the undulation of the terrain" as the main problem [NASA SP-350 ch. 12-6; Apollo Lunar Surface Journal; LRO accounts] | High (well documented) | Map needs **ground-view landmarks and checkpoints**, not only top-down imagery. Mounds roughly 1 km wide look alike, so this risk is real at Acidalia |
| R2 | Accurate maps near the landing site were important to the crew | 1971 account of Apollo 14: readings showed "the importance to astronauts of accurate and complete maps of the regions near landing sites" [NTRS 19710012245] | Medium (contemporary statement) | Map quality near the habitat matters most |
| R3 | Station selection needs high-resolution precursor imagery | BASALT: "a critical need for high-resolution precursor imagery to support site selection" [NTRS 20170000363 / 20170002364] | High (NASA analog test report) | At site A only 0.25–0.5 m HiRISE images exist; **no HiRISE elevation model** (see review P1-1) |
| R4 | Crews follow procedures rigidly and get cognitively overloaded | BASALT: scientists "cognitively overwhelmed" balancing cue-card protocol and science objectives; crews followed execution aids closely even in discovery work [PMC6442238 / PMC6442258, Beaton et al.] | High (peer-reviewed analog study) | The map must state the **science purpose of each stop** so crews can adapt; keep on-EVA information minimal |
| R5 | Mars-like time delay changes how Earth science support works | BASALT ran under Mars-like latency and bandwidth limits; lessons include better timeline sharing and text exchange across delay [NTRS 20170000363] | High | Assume **no real-time Earth help** during an EVA; plan decisions before the walk |
| R6 | Route tools help, but humans still choose | BASALT used SEXTANT route optimization, exported from xGDS; manual plans risked missing obstacles [NTRS 20170000367] | Medium | A route aid is useful; it must not hide obstacles it doesn't know about |
| R7 | Human landing sites are framed as ~100 km Exploration Zones | NASA 2015 First Landing Site / Exploration Zone workshop: Regions of Interest within ~100 km of the landing site; 47 proposals; Acidalia appears in a summary slide (details unconfirmed) [NASA HLS2 overview; NTRS 20150013826] | Medium | Define A.R.E.S.'s zone and which ROIs are on foot vs by rover. No source gave an EVA walking radius |
| R8 | Planetary protection still applies to crews | National Academies: human missions must follow COSPAR, including Special Region limits; humans cannot be sterilized; a forward/back-contamination protocol is still needed [NAP 21816; NASA 2022 PP guidelines slides] | High (Academies), Medium (current COSPAR text not read) | Sampling material brought up from depth is exactly where contamination rules bite. The map must flag it |

**Where the evidence is weak:** I did not find (a) what map products BASALT crews carried, or how they used them minute to minute; (b) any published EVA walking radius for Mars; (c) the current COSPAR text for crewed missions; (d) the Acidalia proposal from the 2015 workshop. The /research skill's social-media sources (Reddit, X, GitHub) have no signal for this question, so I didn't search them.

---

## Part 2. Review of the current plan (adapted /review-agent)

Target: `ARES_mission_review.md` plus today's team decisions.

**[P0] The review document's user is a science-operations team; the team now says the user is an astronaut.** `ARES_mission_review.md` §1–2. The mission definition, decision, workflow (§6) and demo (§9–10) are all written for a ground team choosing which fracture to scout. An astronaut needs different things: position and landmarks, return margin, minimal workload. The whole workflow must be rebuilt around the astronaut, or the team must say which astronaut moment (planning before the EVA vs during it) A.R.E.S. serves.

**[P0] The review document's site is Gale (or Jezero), not Acidalia.** §1 recommends Gale; §5's verified tables are Jezero. None of the source matrix applies to site A yet. Not fixable until the team confirms site A (Part 3, Q-B1).

**[P1-1] There is no HiRISE elevation model at site A, so astronaut-scale terrain cannot be measured.** Verified 2026-11-14: USGS STAC returns 0 HiRISE DTMs; PDS ODE returns 0 (the same query returns 6 at Jezero, so the query works). The only elevation model is one CTX DTM at about 23 m, which hides anything walking-sized. A stereo pair exists (ESP_019612_2250 + ESP_025203_2250), so a 1–2 m DTM could be made with Ames Stereo Pipeline, but that is a large job. As planned, an "astronaut map" here would show slope only at about 23 m, and must label everything finer as unknown.

**[P1-2] The mud-volcano interpretation is contested, and the plan doesn't say how the astronaut would tell.** Alternatives include igneous volcanoes, hydrothermal springs and lava over wet ground; a 2018 study of about 1,300 mounds fit mud flow but did not rule out igneous [Hemmi & Miyamoto 2018]. Mounds may be 2–3 billion years old [Tanaka, via press]. If the astronaut's science task is to test the hypothesis, the map must say **what observation in the field would distinguish the explanations**. Today nothing does.

**[P1-3] Planetary protection isn't in the plan, but the science goal triggers it.** The stated reason for the site is that mounds may carry material, and possibly organics, up from depth [NASA PIA13652]. Crewed missions are held to COSPAR limits and cannot be sterilized [NAP 21816]. A map that guides an astronaut to sample there must carry a contamination/sampling-protocol flag, or the team must state the science goal as observation-only.

**[P2-1] The existing film tells a Gale EVA story.** `ARES_Mars_Explainer.mp4` shows Mount Sharp boxwork. With site A, both the site and the story differ. Re-cut it or retire it.

**[P2-2] There is no ground truth at site A.** No lander has examined these mounds [press summaries of Oehler & Allen]. The plan's acceptance criteria (§9) assume comparison against rover data. Validation must instead rest on published mapping, cross-image consistency, and failure injection.

**[P2-3] Mound size versus walking is unexamined.** Mounds average about 1 km across, with relief up to 180 m [Oehler & Allen 2010, via search summary; re-check in the paper]. Whether an astronaut walks to, around, or onto a mound, and how far the habitat is from it, sets the whole hazard and return model. The plan doesn't address it.

**[P3-1] The challenge text is still secondhand.** Read the 2026 official page in a normal browser before locking the user and deliverable.

**Overall assessment.** The evidence-first principles in the existing documents (no single score, unknown ≠ safe, stop rules) still hold, and they matter more for an astronaut. But the user and site changed today, so the mission definition, data plan and workflow need rebuilding. The biggest technical risk is P1-1: the site lacks walking-scale elevation data. The biggest science risk is P1-2: an unverifiable interpretation.

---

## Part 3. First-principles question set

How to use: answer **★ questions first** (they change everything downstream). For each, also say **how sure you are**: *know*, *believe*, or *guess*. "We don't know" is a valid answer; it becomes a labeled assumption.

### A. Purpose and the astronaut (who and when)

- ★ **A1.** Finish this sentence: "After using A.R.E.S., the astronaut can ___, which they cannot do today." One sentence.
- ★ **A2.** *When* does the astronaut use it: (a) the day before the EVA, planning in the habitat; (b) during the walk; (c) after, to log what they found; or (d) several of these? If several, which one is the prototype?
  - **Team answer (2026-11-14):** Throughout the mission. A **physical paper copy** carries all calculations and markings, done in advance. **Live position tracking** is shown in both the **rover and the helmet**. *(Confidence: not stated.)*
  - **Reviewer notes:**
    1. **Paper copy: strong choice.** It matches Apollo/ISS cuff checklists and is the fallback if electronics fail (E6).
    2. **"GPS" needs renaming.** Mars has no satellite navigation system. Call it **position tracking** and say where the position comes from: rover wheel and visual odometry, an inertial sensor, and matching landmarks against the map. The display must show the position **with an error circle** that grows with distance driven, shrinking again at each recognized landmark. A local radio-beacon network or future Mars navigation satellites would be assumptions to label, not features.
    3. **Rover and helmet need different screens.** In the rover: the full map, route, timeline. In the helmet: only position, next checkpoint, time to turn back (see Part 5, flips 1 and 4).
    4. **Prototype choice still open.** "Throughout" covers three moments. For the demo, pick one to build for real (suggested: the pre-EVA marked map + rover display) and show the others as mock-ups labeled "concept".
- **A3.** Is it one astronaut, or a crew of two (the usual minimum for EVAs)? Who decides when they disagree?
- **A4.** What is the astronaut's background: a trained geologist, or a pilot/engineer following a science plan? (BASALT found that crews need to understand the *science goal* to adapt, R4.)
- **A5.** Who else uses the map: the habitat crew member (IV), the Earth science team (with delay), mission control? What does each need from it?
- **A6.** What does the astronaut do *without* A.R.E.S.? (Baseline: paper map, cue card, tablet, memory.) What specifically is better with it?

### B. Site and mission context (what is fixed)

- ★ **B1.** Confirm site A (44.5° N, 317.2° E), the official NASA/HiRISE proposed site, over site B. Yes or no?
- ★ **B2.** Where is the habitat/lander relative to the mounds? On the plains next to them, or among them? Distance to the first mound?
- **B3.** Is there a pressurized rover or unpressurized rover, or is it on foot only? Each changes the reachable area completely.
- **B4.** How long is one EVA (hours)? How many EVAs in the mission? Is this the first EVA or the tenth (how familiar is the terrain)?
- **B5.** Mission phase: first human mission (most conservative rules), or a later one?
- **B6.** What time of Mars year and day? Lighting, temperature, and dust-storm season change visibility and hazards. Should the map show when to go?
- **B7.** Communications: relay orbiter? Delay assumed (minutes)? Blackout periods? What happens on the EVA if the link drops?

### C. Science (why go at all)

- ★ **C1.** What is the **one science question** at the mounds? Examples: "Are these mud volcanoes or igneous cones?", "Is there fine-grained sediment from depth at the summit?", "Is there evidence of past fluid flow?" Pick one for the prototype.
- ★ **C2.** What **observation or sample would answer it**? What would the astronaut see, photograph, measure or collect? (P1-2: the map must point to observations that distinguish hypotheses.)
- **C3.** What would each competing explanation predict that the astronaut could check? (Mud: fine-grained, layered, possibly salts? Igneous: vesicular rock, lava textures?) These are questions for your research, not answers; verify each in the literature.
- **C4.** Where on a mound is the best evidence likely to be: summit pit or crater, flank flows, base, the plains between mounds? Why?
- **C5.** Is sampling allowed, or is it observation and photography only? (Ties to F.)
- **C6.** What counts as "mission success" scientifically, if the answer is ambiguous? (A useful "we couldn't tell, here's why" outcome?)
- **C7.** How does this connect to habitability, honestly? What can it show, and what can it never show? (Draft: it can show material from depth; it cannot show life.)

### D. The map itself (what goes on it)

- ★ **D1.** What *scale* does the astronaut need: mound field (km), one mound (100 m), or one stop (m)? Different scales need different data, and site A lacks the m-scale data (P1-1).
- ★ **D2.** Do we commit to building a 1–2 m elevation model from the HiRISE stereo pair (big job, needs Ames Stereo Pipeline), or accept 23 m CTX elevation and label finer terrain "unknown"?
- **D3.** Which layers must be there, and which are nice to have? For each, say what decision it supports. Candidates verified at site A: HiRISE images (4 observations, 2008–2011, sun angles 43–70°), 1 CTX DTM, 2 CRISM mineral maps (2008, 2010), THEMIS day/night infrared mosaics (100 m), CTX images to 2025, geologic map SIM 2888 (1:15M, regional only).
- **D4.** How will the map show **unknown**, **inferred** and **measured** differently, so no one mistakes a guess for ground truth?
- **D5.** Landmarks (R1): what can the astronaut recognize from the ground to know where they are? Which mounds are distinctive? How do we show a ground-level view, not just top-down?
- **D6.** Should the map show *time*: image dates, lighting, and how old each layer is?
- **D7.** What does the map *not* show, on purpose, to keep workload low (R4)?

### E. Safety and return (non-negotiables)

- ★ **E1.** What is the **turn-back rule**? What triggers it: time, consumables, distance, a hazard, an "unknown" patch, crew condition?
- **E2.** What hazards matter at a mud-volcano mound for someone on foot: slopes, loose or soft material, pits, boulders, poor footing on flows? Which can we see in the data, and which can't we?
- **E3.** Mounds up to ~180 m high (re-check): does the astronaut climb one? What is the maximum slope we'd allow, and on what evidence?
- **E4.** What is the return margin, and how is it shown? (Earlier review: multi-resource, not oxygen-only; no "guaranteed" language.)
- **E5.** Decision points: where along the route does the crew stop and decide continue, pause, alternate or return? How are they chosen?
- **E6.** What does the astronaut do if A.R.E.S. (the device) fails mid-EVA? What is the paper or memory fallback?

### F. Planetary protection and contamination

- ★ **F1.** Is the prototype **observation-only**, or does it plan sampling? (Sampling material from depth is where COSPAR rules matter most, R8 / P1-3.)
- **F2.** Could a mound be treated as an Uncertain or Special Region? What would A.R.E.S. do: avoid, flag, stop?
- **F3.** How are samples labeled, contained, and documented (location, depth, time, chain of custody)?
- **F4.** Back-contamination: what happens when the astronaut comes back into the habitat?

### G. Operations and communication

- **G1.** What is planned before the EVA, and what is decided during it? Who approves changes?
- **G2.** How does the Earth science team contribute under delay: before the EVA, after it, or during it via queued messages (R5)?
- **G3.** What gets logged during the EVA (photos, positions, notes), and how does that update the map for the next EVA?
- **G4.** How does the crew report "the map was wrong here"?

### H. Interface and human factors

- ★ **H1.** What is the device: a paper map and cue card, a wrist display, a tablet in the rover, a helmet display? (Earlier review: a visor display is a hypothesis, not a requirement.)
- **H2.** How much can the astronaut read or handle during a walk with gloves, dust, fatigue and time pressure? What is the *one screen* they'd look at?
- **H3.** How does the map present the **science goal** of each stop, so the crew can adapt intelligently (R4)?
- **H4.** Accessibility and legibility: contrast in bright or dusty light, colorblind-safe colors, text size.

### I. Data, evidence and verification

- **I1.** For each claim on the map, can we trace it to a product, date, scale and coordinate system? (Source matrix to be rebuilt for site A.)
- **I2.** With no ground truth at site A (P2-2), how do we show the map is right? Options: compare to published mound mapping; check consistency across the four HiRISE dates and lighting; failure injection.
- **I3.** What do we show when two layers disagree (e.g., CRISM vs imagery)?
- **I4.** Which failure cases must the demo show? (E.g., stale data, missing elevation, "unknown" on the route, lost comms, misregistered image.)

### J. Hackathon reality (what we can actually build)

- ★ **J1.** How many people, with what skills (GIS, Python, web, design, video)? How many hours until submission? What is the Delhi deadline?
- ★ **J2.** What exactly will judges *see working*? One sentence.
- **J3.** What are we deliberately **not** building? (Draft: no autonomy, no drill, no live sensors, no life claims.)
- **J4.** Which award category is the target: Best Use of Data, or Best Mission Concept? (Earlier working document's suggestion.)
- **J5.** Does the existing Gale film get re-cut, retired, or used differently (P2-1)?

---

## Part 4. The ten questions to answer first

1. A1: one-sentence purpose
2. A2: when the astronaut uses it (prototype moment)
3. B1: confirm site A
4. B2: habitat location relative to the mounds
5. C1: the one science question
6. C2: the observation that answers it
7. D1/D2: map scale, and whether we build the HiRISE elevation model
8. E1: turn-back rule
9. F1: observation-only or sampling
10. J1/J2: team capacity, deadline, and what judges see working

## Part 5. The team's workflow v0 (as told, 2026-11-14) and inversion results

**Workflow v0, restated (team to confirm):**
1. **Bounded area, not boundless exploration.** The astronaut does not wander; they go to defined objectives and collect data.
2. **Pre-processed orbital map.** Algorithms process satellite data into a base map. Known: terrain from orbit. Unknown: composition and what the ground looks like from the surface.
3. **Scout first.** A small vehicle (RC car / scout rover) goes ahead to check limits and positives for the astronaut.
4. **Rover between objectives.** Objectives 1 and 2 are far apart; the astronaut rides the rover between them.
5. **Objectives unfold progressively.** Each objective reached gives a wider view and shapes the next. Objective 3 is wider and more dangerous; up to 4–5 objectives.
6. **Helmet projector.** A display inside the helmet shows the map, GPS position and everything else.
7. **Timeline per station.** Each station has a fixed time budget; how much gets mapped is bounded by the timeline.
8. **Return when goals are met.** E.g., once sedimentation is studied, the astronaut can map the rest from a safe distance and return.
9. **After the mission:** debrief using the astronaut's own observations to update the map.

**Inversion results, ranked (details in chat transcript):**

| Rank | Assumption | Flip | Where the flip is true | Verdict |
|---|---|---|---|---|
| 1 | Return when goals are met | **Within each day:** fix the turn-back time first (before dark), then visit that day's farthest station first and work back. **Across days:** easier objectives first (team's order). Farthest ≠ riskiest | Mountaineering turnaround times; Apollo J-mission traverse planning (farthest-first: **verify**) | **Live, strongest.** Corrected 2026-11-14 |
| 2 | Value = map as much area as time allows | Value = a few deep, well-chosen stations; leaving area unmapped is fine | Apollo and BASALT station-based traverses | **Live.** Answers "kitna map" with "enough to answer the question" |
| 3 | GPS in the helmet | No satellite positioning at Mars; position from landmarks + rover odometry | Apollo (no GPS); Mars rovers today | **Live, a correction:** GPS does not exist at Mars |
| 4 | Helmet projector shows everything | Helmet shows almost nothing; pre-brief + wrist card + voice | Apollo/ISS cuff checklists; BASALT overload finding | **Live** |
| 5 | Scout drives ahead | Robot trails the astronaut as comms relay / mule | Apollo LRV carried TV and comms; pack animals in field geology | **Live, weaker.** Mounds may block radio line of sight (verify geometry) |
| 6 | Map made by algorithms before the mission | Map made mostly from the crew's own observations | Field geology; post-Apollo site maps | **Weak:** already in step 9; not new |
| 7 | Satellites can't tell composition; humans must go | Orbital data is enough | Regional minerals yes (CRISM), but mud vs igneous is unresolved after 15+ years of orbital study | **Dead.** Original holds: this is why the astronaut goes |

**Correction from the team (2026-11-14): the objectives are spread over more than one day, not done in a single EVA.** This changes rank 1:
- **Across days (campaign level): the team's order is right.** Start with the nearer, easier objectives and move to the wider, riskier ones later. Each day's ground observations check and correct the orbital map before anyone relies on it for the dangerous objective. This is the "wider view each time" idea, and it is a strength.
- **Within each day (one EVA): the flip still applies.** Fix that day's turn-back time first; go to the day's farthest station first and work back toward the rover or habitat.
- **New rule this suggests:** an objective is unlocked only when the previous days have verified the map along the way to it (landmarks found where expected, slopes as predicted). If the map was wrong on day 1, objective 3 waits.
- **New questions:** how many days in total? How many rest days or spare days for bad weather or dust?
- **Team answer: the astronaut returns to the habitat every night.** Consequences:
  1. **Every objective must fit in one day's round trip:** drive out + work at stations + drive back + reserve. So each objective's **maximum distance from the habitat** = (daily time outside − station work time − reserve) ÷ 2 × rover speed. No numbers yet; they come from B3/B4.
  2. **Objectives beyond that distance are out of reach**, however interesting. The map should draw this **daily reach boundary** around the habitat, a clear visual for judges.
  3. **Far objectives cost a whole day.** If objectives 1 and 2 are far apart, the day for objective 2 is mostly driving, with little station time.
  4. **Rover breakdown is the main return risk.** Apollo limited lunar rover drives to a distance the crew could walk back on foot (**verify**). A.R.E.S. should draw a second boundary, the **walk-back boundary**: the farthest point from which the astronaut could walk home if the rover fails. Objectives outside it need a backup (second rover, or an accepted risk stated openly).
  5. **Each evening is a map update:** the day's photos and notes go into the map in the habitat, and the next day's objective unlocks (or not).

## Part 6. Team answers, round 2 (2026-11-14)

| Topic | Team answer | Reviewer note |
|---|---|---|
| Daylight | Crew goes out only in daylight and is back before dark. About **7 hours** outside per day; the mission continues day by day until objectives are done | **Turn-back time = sunset − drive-back time − reserve.** Day length at 44.5° N changes with the Martian season, so the mission season must be stated (assumption to choose) |
| Season | **Reviewer's choice (team delegated): northern summer, Ls 60–120** (Ls = Mars's position around the Sun, 90 = northern summer solstice) | Daylight at 44.5° N, computed (obliquity 25.19°, sol 24 h 39.6 min, sunrise to sunset, no twilight): **15.5–16.1 h** in this window; 12.3 h at equinox; **8.6 h** in northern winter. So in summer the **7-hour EVA limit binds, not daylight**: turn-back = min(start + 7 h, sunset) − drive-back − reserve, and sunset leaves 8+ h of slack. In winter, daylight would almost equal the EVA. Also believed: northern summer is outside the main dust-storm season (**verify**) |
| Farthest vs riskiest | Farthest station is not the same as the riskiest | Agreed; row 1 of Part 5 corrected |
| Crew | **4 crew**, each with their own specialty, working on their own goals **at the same time** | The map needs a layer per specialist and a "who is where" view. The group's turn-back time is the **earliest** of all four. **Team answer: all four go out at once; no one stays in the habitat.** Consequences: (1) no one inside watches the map or the habitat, and Earth is minutes away, so **A.R.E.S. itself becomes the coordination layer**: who is where, each person's turn-back time, check-in times; (2) suggested buddy rule: **two pairs, one pair per rover** (survey rover + crack rover), so nobody works alone and each pair has a vehicle home; (3) the habitat must run unattended (automatic alarms to the crew's helmets) — an assumption to state; (4) if one person is hurt, the other three are close by, which is a strength |
| Rovers | A **surveillance rover** for wide-area survey, and a **second rover** for close inspection of the cracks | Two rovers also give a **rescue backup**: the walk-back boundary can become a "second-rover rescue boundary" |
| Thermal | **Assumed:** one dedicated thermal-imaging satellite is deployed | Label it "assumed asset" on the map. Need: its resolution, revisit time, day and night passes. Day + night thermal → thermal inertia → loose fine material vs rocky ground (a proxy, not a firmness measurement) |
| Positioning | Team assumed GPS; asked how on-point positioning is really determined | See "Positioning design" below |
| Map coverage | Depends on the dataset layers and how they were fetched and calculated | The map must show a **coverage layer**: where each dataset exists and at what resolution. No ground truth exists to train a model on at site A; any detector is "proposed", checked by people |
| Site choice | Use mound geometry and risk factors to choose mission sites | See "Mound risk factors" below |
| Tech stack | To be decided by the team | — |

### Positioning design (no GPS at Mars)

Combine four sources, and always show **position + error circle**:
1. **Dead reckoning:** rover wheel and camera odometry plus motion sensors; a step count and motion sensor for walking. Always on; error grows with distance.
2. **"Mound fingerprint" horizon matching (the innovation):** a camera on the rover or helmet captures the skyline of the surrounding mounds and matches it against horizons computed from the elevation model. Single mounds look alike, but **the arrangement of mounds seen from one spot is unique**, so the site's thousands of mounds become the landmarks. Published rover work: horizon matching cut errors over 60% vs wheel odometry over 3 km (Nefian et al.); JPL reports sub-meter accuracy with 1 m elevation models (2024). **Risk:** site A has only a ~23 m CTX elevation model, so accuracy there must be tested; the HiRISE stereo pair would improve it.
3. **Radio fix from orbit:** relay orbiters' radios (e.g., Electra) can locate a surface vehicle from Doppler shift, roughly 50 m, only during passes. The assumed thermal satellite could also carry a relay radio (assumption).
4. **"Rover as lighthouse" (innovation):** the surveillance rover parks on a mound top as a radio reference station. Range to it plus range to the habitat gives a position fix, and it relays voice over mounds that would block the radio signal.

Rule: if the error circle reaches a mapped hazard or the turn-back boundary, the display says **stop and re-fix position** before moving on.

### Mound risk factors for choosing sites

Measure per mound, from the data listed:

| Factor | How to measure | Data | Limit |
|---|---|---|---|
| Height and width | Elevation model | CTX DTM (~23 m) | Small mounds blur |
| Average flank slope | angle = atan(2 × height ÷ width). E.g., 180 m high, 1 km wide → about 20° (180 m is the upper end reported; verify) | CTX DTM | Hides steep local steps |
| Summit pit or crater rim edges | Visual mapping | HiRISE images | Only in the 4 HiRISE strips |
| Boulders and blocks | Visual counting | HiRISE 0.25–0.5 m | Same |
| Flow lobes (unknown firmness) | Visual + thermal | HiRISE + assumed thermal satellite | Firmness unknown until visited |
| Corridor width between mounds | Distance between mound edges | CTX DTM / images | — |
| Shadowed side at EVA time | Sun angle for chosen season and hour | Elevation model + sun position | — |
| Radio shadow from habitat | Line of sight from habitat / relay rover | Elevation model | Radio range model is an assumption |
| Distance from habitat | Route length | Map | Must fit the daily reach |

A mound becomes a mission site only if: it is inside the daily reach, its route has no "unknown" stretch longer than an agreed limit, and its flank slope is under an agreed maximum (team to set, with source).

**Meta-pattern:** in v0, the return is *downstream* of the objectives (go until done, escalate risk as you go). Every live flip moves safety *upstream*: fix time, position and return first, then fit the science inside.

## Sources

- Apollo 14 navigation: https://www.nasa.gov/wp-content/uploads/static/history/SP-350/ch-12-6.html ; https://nasa.gov/wp-content/uploads/static/history/alsj/a14/a14.summary.html ; https://ntrs.nasa.gov/api/citations/19710012245/downloads/19710012245.pdf ; https://svs.gsfc.nasa.gov/4883
- BASALT: https://ntrs.nasa.gov/api/citations/20170000363/downloads/20170000363.pdf ; https://ntrs.nasa.gov/api/citations/20170002364/downloads/20170002364.pdf ; https://ntrs.nasa.gov/api/citations/20170000367/downloads/20170000367.pdf ; https://pmc.ncbi.nlm.nih.gov/articles/PMC6442238 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC6442258
- Exploration Zones: https://www.nasa.gov/wp-content/uploads/2015/11/hls2-overview-v3tagged.pdf ; https://ntrs.nasa.gov/api/citations/20150013826/downloads/20150013826.pdf
- Planetary protection, crewed: https://www.nap.edu/read/21816/chapter/3 ; https://ntrs.nasa.gov/api/citations/20220006192/downloads/ScienceObjectivesHumanMars_PPGuidelines_2022May.pdf
- Site A and mounds: https://www.uahirise.org/ESP_019612_2250 ; https://photojournal.jpl.nasa.gov/catalog/PIA13652 ; https://lpl.arizona.edu/~shane/PTYS_554_2019/reading/oehler_allen_icarus_2010.pdf ; https://mdpi.com/2076-3263/8/5/152
- Geologic map: https://pubs.usgs.gov/publication/sim2888
- Data coverage at site A: USGS STAC API and PDS ODE REST API, queried 2026-11-14

## Part 7. Landing site and round 3 (2026-11-14)

**Team answer:** landing site **28.4333° N, −40.3073° (= 319.69° E)**. The assumed thermal satellite covers the team's area. Each day the crew goes to the end of the cracks and completes that day's goals.

**Reviewer check (HiRISE pages and USGS STAC, read 2026-11-14):**
- This point is the **centre of Chryse Planitia**. Nearby HiRISE images show a **"Well-Preserved Crater with Central Peak in Chryse Planitia"** centred at 28.446° N, 319.564° E, about 7 km west (ESP_022869_2085, ESP_013810_2085), and **"Lobate Crater Ejecta"** at 28.488° N, 319.856° E (ESP_050666_2090). No mound field is shown there.
- **Data:** 0 CTX elevation models, 0 HiRISE elevation models, 3 HiRISE observations. Only global MOLA elevation, which is far too coarse for walking.
- **Distance to the mounds:** site A (44.5° N) is **958 km** away. The nearest NASA/HiRISE-proposed mound landing sites ("Possible Future Mars Landing Site with Mounds in Chryse Region", ESP_026284_2060 / ESP_024016_2065, about 26.0–26.3° N, 326.3° E) are about **370 km** away. With a return every night, neither is reachable.
- **Team decision:** the Chryse mound site (~26.0° N, 326.3° E) is **not considered**.
- **Decision needed:** (a) move the landing site to site A (44.5° N, 317.2° E); or (b) keep 28.43° N and change the science target to the **fresh central-peak crater**. A central peak lifts up rock from depth, so the "Mars already did the drilling" idea still works, but the target is impact material, not mud volcanoes.

### More positioning innovations (lateral thinking: forced analogy)

Problem shape in one sentence: *a moving traveller in a wide area of look-alike shapes must know their exact spot; outside signals come and go; errors build up the longer they go without a check.*

| Domain | Maps to | Mechanism carried back | Verdict |
|---|---|---|---|
| Desert ants (find their nest in featureless desert) | Ant = astronaut; nest = rover/habitat | Ants count steps and use the sun as a compass, and they **remember snapshots of the view near the nest**. A.R.E.S.: the helmet or rover camera auto-saves a photo every few hundred metres on the way out. On the way back, the current view is matched to the saved photo, so the **return route is guaranteed even if the map is wrong** | **Strongest:** simple, cheap, easy to demo |
| Ships before GPS | Ship = rover; stars/sun = Mars sun | Dead reckoning, corrected by **sun sightings**. Rovers already use the sun for heading. Sun position + clock gives direction always, and a rough position check | Good for heading; position only coarse |
| Air-traffic control | Planes = 4 crew + 2 rovers | Every unit reports its position, and controllers see everyone. A.R.E.S.: suits and rovers **measure radio distance to each other**, forming a moving network, so each person's position is cross-checked by the others. Also gives the "who is where" view the crew needs with no one in the habitat | Strong: fits "all four out" |
| Trail cairns / inuksuk (stone markers) | Marker = small beacon or flag left at checkpoints | Later trips navigate by markers left by earlier trips. A.R.E.S.: drop small radio or visual markers at verified checkpoints; day 2 follows day 1's markers | Useful; leaves hardware on Mars (planetary-protection note) |
| Migrating birds (magnetic sense) | Bird = astronaut; Earth's magnetic field = ? | **Abandoned.** Mars has no global magnetic field, so the role "field to follow" has no Mars equivalent without a second forced assumption | Dead |

**Meta-pattern:** every useful transplant uses **references the crew creates or carries itself** (photos, markers, each other, the sun) rather than waiting for an outside system like GPS. A.R.E.S. can build its own reference grid day by day, and that fits the team's "wider view each day" idea.

### Habitat decision (team, 2026-11-14)

**Team answer:** 28.4333° N, 319.69° E is the **landing and habitat site** for the Acidalia study.

**Reviewer check: what is near the habitat** (HiRISE image titles and centres, uahirise.org; searched 28.4–31.5° N, 317.7–321.7° E; distances computed):

| Distance | Feature (HiRISE title) | Relevance |
|---|---|---|
| 6–7 km | Well-preserved crater with central peak | Material from depth; ejecta hazard |
| 9–18 km | Lobate crater ejecta | Flow-like ejecta; ground may be ice-related (**verify**) |
| 49–59 km | Fresh rayed craters | Young impacts |
| 53 km, 84 km | "Crater with steep slopes" / repeated **"Slope Monitoring"** | Repeat imaging suggests active slope changes; **find out why before planning a visit** (possible planetary-protection relevance) |
| 97 km | Irregular circular depressions near Makhambet Crater | Unknown origin |
| 112–153 km | **Troughs and ridges in Chryse Planitia** | Closest "crack-like" targets found |
| — | **No image titled with mounds within ~180 km** of the habitat (north and either side searched; south not searched) | |

**Mound facts (Amador, Allen & Oehler, LPSC 2010 abstract, read 2026-11-14):** "mapped mounds are limited to the Acidalia basin"; about 45 % of southern Acidalia surveyed; diameters 0.81–1.06 km, average 830 m; mounds are **dark in THEMIS night-time infrared**, i.e. lower thermal inertia, "fine-grained or unconsolidated" (soft ground: a walking hazard).

**Consequences:**
1. With a return every night, the targets must sit within one day's reach. Unless the rover is very fast, sites 100+ km away are out of reach, and no mounds are known within ~180 km.
2. **The assumed thermal satellite can settle this.** Mounds show up dark in night-time thermal images, so a night-time thermal map around the habitat would show whether any mounds lie within reach. THEMIS night mosaics (100 m, already public) can test this today.
3. ~~Open decision: keep 28.43° N and make the science crater + trough (crack) focused, or move the habitat into the mound field.~~ **Decided below.**

**Team decision (2026-11-14): keep the habitat at 28.43° N, 319.69° E. Science focus = places with cracks inside the habitat's area.** Mounds are no longer the target; the title "Acidalia study" should be checked against this (the habitat is in Chryse Planitia, ~958 km from the mound site).

### Daily reach: which cracks can the crew actually get to?

First principle: the crew must be back each night, inside a 7-hour EVA. So the farthest point is set by time, not by the map.

**One-way reach = rover speed × (7 h − work time at the site − reserve) ÷ 2**

| Assumption (team to confirm) | Value |
|---|---|
| Work time at the crack site | 3 h |
| Reserve kept unused | 1 h |
| Driving time left (out + back) | 3 h → 1.5 h each way |

| Rover average speed over rough ground | One-way reach |
|---|---|
| 5 km/h | 7.5 km |
| 8 km/h (about Apollo rover average; **verify**) | 12 km |
| 15 km/h | 22 km |
| Needed for the troughs at 112 km | ~75 km/h, not realistic |

Apollo also kept the rover within walking distance of the lander, in case the rover broke (Apollo 17's farthest point was about 7.6 km; **verify**). The team's second rover can act as the rescue vehicle, which may allow more than walking distance; this should be stated as a rule.

**What falls inside reach:**

| Target | Distance | Crack evidence? |
|---|---|---|
| Crater with central peak | 6–7 km | Not yet. Impact craters often have fractures in their walls and floors, but none are documented here. **Look at CTX/HiRISE images first.** |
| Lobate ejecta | 9–18 km | Not yet. Edge of reach at 8 km/h. **Check the images.** |
| Troughs and ridges | 112–153 km | Yes ("troughs" in the title), but **out of daily reach.** |

**Conclusion:** the only documented crack-like features are out of reach. Inside reach, cracks are **possible but not shown yet**. The next evidence step is to look at the CTX and HiRISE images of the crater and ejecta (within ~20 km of the habitat) for fractures, and to map them.

### Image datasets near the habitat (checked 2026-11-14)

Search box 28.0–28.8° N, 319.2–320.1° E (about ±25 km), PDS ODE REST (`oderest.rsl.wustl.edu/live2`). Distances from the habitat 28.4333° N, 319.6927° E use 59.27 km per degree of latitude and 52.13 km per degree of longitude.

| Dataset | Products found | Resolution | Use for cracks |
|---|---|---|---|
| MRO HiRISE RDR | 6 observations (RED + COLOR) | 0.25–0.5 m/px (full res) | Best: shows cracks of about 1 m and wider |
| MRO CTX EDR | 23 images (incl. P15_006980_2087 at 28.45° N, 319.53° E, directly over the crater) | ~6 m/px | Mapping cracks wider than about 20 m over the whole area |
| MRO CRISM MTRDR | 4 | ~18 m/px | Minerals on crack walls |
| Odyssey THEMIS IR RDR | 71 | ~100 m/px | Day/night temperature: rock vs dust |
| HiRISE / CTX DTMs | **0** | — | **No elevation model, so no slope or crack-depth numbers yet** |

| HiRISE observation | Title | Centre | Distance from habitat |
|---|---|---|---|
| ESP_013810_2085, ESP_022869_2085 (repeat pair) | Well-Preserved Crater with Central Peak in Chryse Planitia | 28.44° N, 319.56–319.57° E | **6.3–6.9 km W** |
| ESP_050666_2090 | Lobate Crater Ejecta | 28.49° N, 319.86° E | **9.1 km ENE** |
| ESP_013098_2085 | Lobate Ejecta | 28.36° N, 319.37° E | 17.6 km W |
| PSP_006835_2085, PSP_007481_2085 | Lobate Margin of Impact Ejecta | 28.14° N, 319.18° E | 31.9 km SW (**outside a 22 km reach**) |

**What the browse images show (reduced resolution, a few m/px; reviewer's visual read, not a mapped result):**
- **Crater (6–7 km W):** steep inner walls with gullies and spurs (the south wall is dark and deeply fluted), terraces, wind ripples on the floor, small fresh craters. **No clear open cracks are visible at this resolution.** The crater looks roughly 10 km across, measured from the scale bar (rough), so the habitat may sit just outside the east rim, on the crater's own ejecta. **Verify with CTX.**
- **Lobate ejecta (9 km ENE):** a dense pitted, knobby and meshed texture with long lineations (grooves) across it. These lineations are the most crack-like features inside reach, **but they could be grooves, not fractures.** This needs the full-resolution HiRISE image to decide.
- **Rampart margin (32 km SW):** a steep lobe edge with ripples at its foot; out of reach.

**Result:** no confirmed cracks within daily reach yet. The best candidates are (1) the lineations on the ejecta 9 km ENE and (2) the crater walls and terraces 6–7 km W. **Next evidence step:** open the full-resolution HiRISE RED images (JP2, 0.25 m/px) for ESP_050666_2090 and ESP_022869_2085 and trace any linear features in QGIS. Then measure their width and length, and check CTX P15_006980_2087 for cracks between the habitat and the crater. Without a DTM, crack depth and wall slope cannot be computed. A HiRISE stereo pair over the target, or a team-made DTM from the two crater images if their geometry allows it (**verify**), would be needed.

**Open choice for the team:**
- **A.** Keep "back each night": study cracks in and around the nearby crater (first confirm they exist in the images).
- **B.** Allow one planned multi-day trip (for example a pressurised rover that sleeps out) to reach the troughs at 112+ km. This breaks the "back each night" rule, so it needs its own safety plan.

## Part 8. Round 4 questions: crack-focused mission (2026-11-14)

These questions follow from the habitat decision and the daily-reach limit. Answer in any order; the starred ones block the map design.

**K. What counts as a "crack" (the science)**
- K1\*. What do you want to learn from a crack? (a) how it formed, e.g. an impact fracture or ground ice shrinking; (b) what the walls expose, i.e. layers below the surface; (c) whether it is still changing. Pick one main question.
- K2\*. What is the smallest crack worth visiting: 10 cm, 1 m, or 10 m wide? HiRISE sees about 1 m and wider, and CTX about 20 m and wider. Anything smaller must be found on the ground by the scout rover.
- K3. What does "the end of the crack" mean for the daily goal: the tip where it stops, the deepest point, or the point where the walls show the most layers?
- K4. Will the crew look only (photos, measurements) or also take samples? Sampling changes the time per stop and the gear carried.

**K1 team answer (2026-11-14):** "how rocks were formed, dig in it and view such that if any life form is still present in the depth". The team believes no one has done this, and asked to base the system on the closest existing mission.

**Reviewer notes on K1:**
1. **Wording rule (from the brief): no life claims.** The goal must read "**search for biosignatures** (chemical or physical traces that life *could* leave) and understand how the rock formed". It must never say "find life". A biosignature is a clue, not proof.
2. **Someone is already doing this.** ESA's Rosalind Franklin (ExoMars) rover is built to drill about 2 m down to look for biosignatures, with launch planned for about 2028 (**verify**). It is the closest existing system, so A.R.E.S. should borrow from it, not claim to be first. Other close systems: Perseverance (cores about 6 cm deep, cached for return; **verify**), Curiosity (drills about 6.5 cm and analyses on board; **verify**), and Viking 1976 (the first on-board life-detection experiments; the results are still debated).
3. **Why depth matters (first principle).** Radiation from space breaks down organic molecules in roughly the top 1–2 m of Martian soil and rock (**verify** the exact depth). That is why Rosalind Franklin drills 2 m.
4. **The insight for A.R.E.S.:** **a crack is a natural drill hole.** Its walls expose rock layers from below the surface without drilling. Deep, freshly exposed crack walls are the best place to look for (a) how the rock formed, from its layers, and (b) protected material. This ties the crack focus directly to the science question.
5. **Planetary-protection constraint (a hard rule).** If a crack could hold ice or liquid water, it may count as a COSPAR "Special Region", where Earth microbes could survive. Humans carry microbes, so **astronauts should not enter or touch the inside of such a crack.** Only a cleaned (sterilised) robot, i.e. the depth rover, goes in. The crew works from the rim. This also protects the samples from Earth contamination, which would otherwise produce a false "life" signal.
6. **What changes in the plan:**
   - The depth rover becomes the main science tool. It needs a camera, a close-up imager, and either a scoop/drill or a spectrometer, and it must be cleaned to planetary-protection standard.
   - The map adds a layer: **"robot-only zones"** (possible Special Regions) vs "crew allowed".
   - The crew's role is to choose targets, guide the rover from the rim, and log context on the paper map, not to dig by hand inside the crack.
   - Contamination control: a clean sample chain from crack → rover → sealed container → habitat lab.

**New questions from K1:**
- K5. How deep must the sampling go: the crack wall surface, 10 cm into the wall, or about 2 m (drill)?
- K6. Are samples analysed in the habitat lab or sealed for return to Earth?
- K7. What does the crew do while the depth rover works inside the crack: wait at the rim, or work other targets?

**L. Safety at the crack edge**
- L1\*. How close may an astronaut stand to a crack edge? Edges can crumble. Pick a setback, e.g. 2 m, or a multiple of the crack depth.
- L2. Who goes into the crack: no one, only the depth rover, or an astronaut on a tether?
- L3. What is the maximum walkable slope and the maximum rover slope? These two numbers turn the elevation model into the green/amber/red zones on the map.
- L4. What happens if the depth rover gets stuck inside a crack? Is it abandoned, is a recovery attempted, or does the day end?

**M. Daily reach (numbers needed for the map)**
- M1\*. Rover average speed over rough ground: 5, 8 or 15 km/h? This sets the reach circle drawn on the paper map.
- M2. Work time at a crack site and the reserve kept unused (assumed 3 h and 1 h)?
- M3. Walk-back rule: must every point be within walking distance of the habitat if both rovers fail? Walking speed in a suit is roughly 2–3 km/h (**verify**).
- M4. Do both pairs drive out in one rover, or does each pair have its own?

**N. The paper map (what is printed on it)**
- N1\*. Scale and size: one sheet per day's target, e.g. 1:10,000 on A3, plus one overview sheet with the reach circle?
- N2. Which layers are printed: the image base, crack lines, hazard zones, the reach circle, turn-back time per waypoint, landmarks used for positioning? Which ones are only on the helmet display?
- N3. How does the crew mark the paper in the field: pencil symbols, a fixed legend, or numbered stations?
- N4. How is "unknown" shown? Areas with no HiRISE coverage should look different from areas checked and found safe.

**O. The thermal satellite (assumed asset)**
- O1. Resolution and repeat time? A 1-day revisit at about 10 m would be very different from THEMIS (100 m, irregular).
- O2. What is it for: finding cracks (they cool differently at night), spotting loose sand vs rock, or checking for frost and ice?
- O3. Is its data on the paper map (printed before the EVA) or only live on the helmet and rover?

**P. Crew and rovers**
- P1. Four specialists: which four specialties (e.g. geologist, navigator/EVA lead, rover operator, imaging and sampling)?
- P2. Do the two pairs ever split to different cracks on the same day, or do they always work the same site?
- P3. What does the survey rover do the day before: drive the route, image the crack from the rim, or both?

**Q. Deliverable for Space Apps**
- Q1\*. What will the judges see: a printed sample map sheet, an interactive demo of the helmet/rover display, a video, or all three?
- Q2. Team size, skills (GIS, coding, design, video) and the submission deadline?
- Q3. Which single real image becomes the demo map? Suggested: ESP_022869_2085 (the crater, 6–7 km W) or ESP_050666_2090 (the ejecta, 9 km ENE), whichever shows real cracks.

## Part 9. Full-resolution image check: cracks near the habitat (2026-11-14)

**Data used**
- **HiRISE ESP_022869_2085_RED**, 2011-06-13. Projected at 0.5 m/px and decoded at 1 m/px. It covers 28.11–28.78° N, 319.46–319.66° E. This strip does **not** reach the habitat, which lies about 1.6 km east of its edge.
- **CTX P15_006980_2087_XN_28N040W**, 2008-01-22. Raw, unprojected, about 5.7 m/px, 5056 × 10240 pixels. Its footprint corners are (-40.26, 28.98), (-40.12, 27.97), (-40.67, 27.91) and (-40.81, 28.92) in °E-360 and °N. It covers the whole crater **and** the habitat.
- **HiRISE ESP_050666_2090_RED** (the ejecta 9 km ENE): the first download was cut off. **Not checked yet.**

Two images were saved to `images/`: `ctx_habitat_crater.png` (habitat marked) and `ctx_east_rim_troughs.png`.

Method: the raw CTX image was oriented by its footprint and by the shading. The image was taken about 15:00 local time, so sunlit walls face west and shaded walls face east; left = west (**verify** in a GIS). The habitat was placed using the crater's centre, about 319.55° E, 28.44° N.

### Finding 1 (important): the habitat point sits on the crater rim

- The crater is about **15 km across** (15.3 km from both CTX and HiRISE; rough) and fresh, with a central peak, terraces and steep, gullied inner walls.
- The habitat (319.693° E) is about **7.4 km east of the crater centre**, which is roughly **on the east rim crest**, within about ±0.5 km.
- 28.4333° N, 319.6927° E is the **catalogue centre point of the whole Chryse Planitia plain** in the USGS Gazetteer of Planetary Nomenclature (planetarynames.wr.usgs.gov/Feature/1203). It was never chosen as a landing spot, and it happens to fall on this rim.
- **Why it matters:** a rim crest is one of the worst places to land: steep slopes on both sides, blocks, and loose ejecta. Landing sites need gentle slopes, typically under about 15° (**verify**).
- **Suggested fix (team decision):** keep the same area but move the landing/habitat point **2–4 km east, onto the flatter outer ejecta**. The crater, its walls and the troughs below stay within a short drive.

### Finding 2: crack-like features within walking distance

| Feature | Where | Size (rough) | Crack? | Fit with K1 (rock formation + biosignatures at depth) |
|---|---|---|---|---|
| **Concentric troughs outside the east rim** | about 0.5–2.5 km outside the rim, so about **1–3 km from the habitat** | long, curved, parallel to the rim; tens of metres wide (CTX) | **Most crack-like features found.** They could be concentric fractures or graben, or troughs between ejecta ridges. Full-resolution HiRISE is needed, and the east side has **no HiRISE coverage**. | Exposes ejecta, i.e. material dug up from depth by the impact |
| Crater inner walls and terraces | 0–7 km (from the rim inward) | walls hundreds of metres high (**DTM needed**) | Slumped terrace blocks and gullies. **No open fractures visible at 1 m in HiRISE.** | **Best natural cross-section of the layers.** The wall shows stacked rock layers |
| Central peak and floor | about 7 km, but **down inside the crater** | peak about 1–2 km wide | At 1 m: knobby rock, sand patches with ripples, a terrace scarp. **No open cracks visible.** | Central peaks bring up rock from the greatest depth of any target. The rule of thumb is about 1/10 of the crater diameter, so ~1.5 km here (**verify**). That makes it the **deepest material reachable without drilling.** |
| Pitted ejecta texture (9 km ENE) | 9 km | pits metres to tens of metres | Pits and flow lineations, not clear fractures (reduced-resolution check only) | Lower priority |

### What this means

1. **The site is better than expected for K1.** A fresh 15 km crater is a natural core sample. The walls show the layers, the central peak brings up deep rock, and the concentric troughs next to the habitat are the crack targets.
2. **Hazard:** the crater walls are steep and hundreds of metres high, so getting down to the floor or the peak needs a rover route through a terrace or slump. That route must be **found on a DTM**, and none exists. **Request a HiRISE stereo pair** over the east rim and troughs (via HiWish) as part of the plan.
3. **Planetary protection:** the fresh, steep, gullied inner walls should be checked against Special Region criteria before any crew access (gullies are one of the features studied for possible recent water activity). Default rule: robot-only until this is cleared.
4. **Paper map layout (proposal):**
   - **Sheet 1:** crater overview with the habitat, the reach circle and the troughs.
   - **Sheet 2:** east-rim troughs at large scale (day 1–2 targets).
   - **Sheet 3:** wall and terrace descent route (later days, once a DTM exists).

**Ejecta 9 km ENE (ESP_050666_2090_RED, 2017-05-18, checked at 1 m/px after the download completed):** the surface is wind-eroded. It is covered in parallel elongated ridges and hollows (yardang-like) and pits a few metres to tens of metres across, with streamlined troughs about 10–30 m wide and hundreds of metres long, all aligned in one direction. That pattern points to **wind sculpting, not fractures.** A few thin straight lines cut across the texture at an angle, and these *could* be small fractures (**uncertain**). Verdict: **low priority for cracks.** It is rough ground for driving (ridges and pits) but would make a good stop for wind-erosion context.

### Habitat moved (team decision, 2026-11-14)

**New landing and habitat point: about 28.43° N, 319.77° E (−40.23° E).** This is about **4 km east of the old rim point** (319.69° E) and about 11.5 km east of the crater centre.

Why this spot (from CTX, about 5.7 m/px):
- 0–3 km east of the rim is rough: rim blocks, the curved troughs, and a steep outward-facing scarp about 3 km out, which is probably the edge of the thick ejecta (**verify**).
- From about 3.5 km east onward, the ground is a smoother plain with small pits. That is the first reasonably even surface on this line.
- At 4 km, the **trough targets are 1–3 km west**, within walking distance. The rim is about 4 km away, the central peak about 11.5 km (and in the crater), and the ejecta 9 km ENE.

| Target | Distance from the new habitat |
|---|---|
| Curved troughs (main crack targets) | 1–3 km W |
| Outer ejecta scarp | ~1 km W |
| East rim crest | ~4 km W |
| Central peak (on the crater floor) | ~11.5 km W, needs a route down the wall |
| Wind-eroded ejecta (ESP_050666) | ~5.6 km NE (image centre) |

Limits: the position comes from an unprojected CTX image oriented by its footprint and shading, so it is good to about ±0.5–1 km. **Before printing the map, confirm in QGIS** with a projected CTX product and check slopes on a DTM. No DTM exists here yet.

The old point, 28.4333° N, 319.6927° E, was the catalogue centre of Chryse Planitia, not a landing site. It is kept only as a reference.

`images/ctx_habitat_crater.png` was updated: orange marks the old rim point and red marks the new habitat.

### Still open
- ~~Full-resolution check of ESP_050666_2090~~ Done (see above).
- ~~Team decision: keep habitat on the rim or move east~~ Moved east (above).
- Confirm the CTX orientation and the habitat position in QGIS with a projected CTX product (e.g. a Murray Lab CTX mosaic tile).
- Team decision: keep the habitat exactly on the rim point, or move it 2–4 km east onto the ejecta?
