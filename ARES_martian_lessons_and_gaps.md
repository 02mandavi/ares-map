# A.R.E.S.: lessons from *The Martian*, gaps, and the learning loop (v0, 2026-11-14)

Status: **design thinking only, nothing built.** Fiction is used as a **scenario source and test-case library, not evidence** (review red flag #9). Numbers from the novel are never cited as Mars data. Paraphrased; no text copied.

## 1. Scientific thinking patterns the book models (the "skill")

Each is a rule A.R.E.S. should follow, with the book event that shows why.

| # | Rule | Book event | What it means in A.R.E.S. |
|---|---|---|---|
| T1 | **Everything is a flow: stock, burn rate, days left, margin** | Calories per day vs days to rescue; kWh per sol vs oxygen per sol; CO2-filter hours | Vitals ledger (section 3). No consumable shown without "days remaining at current burn" |
| T2 | **Estimate, then pad** ("50 km a day to be safe") | Planned 90 km/sol, budgeted 50 | Every plan shows nominal and pessimistic side by side |
| T3 | **Test small, nearby, before committing** | Sirius 1-4, "plugs-out" test, driving laps within 500 m | A "rehearsal" status on every procedure: untested / tested near base / tested in field |
| T4 | **Reconcile expected vs observed; a gap is a signal** | 60 L of water missing led to the discovery of unburned hydrogen | Each plan stores a prediction; any residual above a threshold raises a flag, never a silent correction |
| T5 | **Hidden coupling kills** | Drill leaned on a bench grounded Pathfinder; the exhaled oxygen fed the explosion | Dependency graph per procedure: "what else does this touch?" before approval |
| T6 | **Wear is a state** | Airlock canvas fatigued over hundreds of cycles, then failed | Cycle and age counters on airlocks, seams, filters, batteries, suit seals |
| T7 | **Common-cause failure** | Four comm systems all rode in one vehicle | Redundancy check asks "do the backups share a cause?" |
| T8 | **Instrument the unknown** | Power loggers mapped the dust storm; sextant and Phobos gave position | Unknown layers get a measurement plan, and position always has an error circle |
| T9 | **Two views catch what one misses** | Orbit saw the pop-tents and clean panels; the ground missed the powder pit | Orbital layer and ground layer are shown separately and compared. Orbital imagery cannot see 5 cm dust: "unknown at wheel scale" |
| T10 | **Decide on stated risk, record dissent** | One life at high risk vs six at lower risk; inspections skipped at 2.5% | Decision log (section 5): options, probabilities, who decided, who objected, outcome |
| T11 | **Abort rules before the problem** | No abort for the MAV launch; fixed turn-back time | Pre-committed stop rules (already in the review); turn-back line in Field mode |
| T12 | **Humans are a subsystem** | Back injury, sleep, morale, boredom, potatoes | Crew vitals are first-class, not a footnote |

## 2. Gaps: what the current docs lack

Ranked by value for the team.

1. **No people model.** No roles, no per-person login, no audit trail. (Section 4.)
2. **No consumables/vitals ledger.** The map app is about *where*; nothing tracks *how long we can last*. (Section 3.)
3. **No learning loop.** Nothing records a prediction and its outcome, so nothing can improve. (Section 5.)
4. **No clickable point-of-interest card spec.** The review defines the evidence card; the app design does not say what opens on click or where its data lives. (Section 6.)
5. **No model for the satellite layer.** "AI finds cracks" is mentioned, but with no training data, validation or labeling rule. (Section 7.)
6. **No degradation scenarios from the book.** Dust storm (power drops), slow wear failure, lost comms, a drill short. Add them to the failure-injection list.
7. **No handling of latency.** Earth is 4-24 light-minutes away. The app must work offline and queue decisions. (Already a Q in the design; elevate it.)
8. **No unit/consistency checker.** The book's mistakes were mostly arithmetic or assumption errors; a cheap sanity check (units, sign, "does the total add up") is worth building.

## 3. Vitals checklist (draft)

One row per consumable. Fields: **stock, unit, burn per sol, days left, minimum reserve, margin, last updated, who updated, source (measured / estimated)**. Red if days left < days to next resupply or return.

| Group | Items | Notes |
|---|---|---|
| Life support | O2, N2, CO2-scrubber hours, cabin pressure, humidity | CO2 removal, not O2, is usually the limiter |
| Water | drinking, hygiene, reserve, reclaimer state | |
| Food | calories per person per sol, protein, stock, days | per-person, not just total |
| Power | battery kWh, solar kW now, forecast (dust), load per system | dust forecast reduces generation |
| Suits/EVA | per-suit O2, scrubber hours used, seal cycles, last leak check | per-person login ties each suit to its wearer |
| Mobility | rover charge, wheel/motor status, distance to base, turn-back time | |
| Comms | link state, last contact, relay status, radio shadow | |
| Habitat/equipment | airlock cycles, seam inspections, spares, pending repairs | wear counters (T6) |
| Crew health | sleep, exertion, injuries, mood note, medical supplies | private to the person and the medic role |
| Time | EVA elapsed, turn-back, mission sol, next resupply/return window | |

Source of truth: **one file or small database per habitat**, edited through the app. Every value stores *measured vs estimated* (never mix them silently).

## 4. Accounts and roles

- **One login per person.** No shared accounts. Each action in the audit log carries the person.
- **Roles (draft):** Commander, EVA lead, Science, Medic, Systems/Sysop, Mission Control (remote, read-mostly), Observer.
- **"Autonomous" is its own account**, an AI agent principal. It may *read everything, propose, simulate, annotate*. It may **not** approve a high-risk step or change safety rules or vitals values it did not measure. A named human approves anything above a risk threshold (the book's "someone has the call" lesson; Mitch vs Teddy shows a conflict must have a defined owner).
- **Privacy:** crew health visible only to that person and the medic role, with an emergency override that is logged. (The book shows what goes wrong when information is withheld from the crew; the rule here is: withhold nothing that affects safety, hide only personal health detail.)
- **Offline-first:** logins verified locally in the habitat; no cloud dependency. Passwords stored hashed; no secrets in the repo.
- Decision for the team: **local accounts file now, real auth later.** Do not build more until the roles are agreed.

## 5. The learning loop ("how I train you, how you learn")

**Honest limit:** I do not keep learning between sessions by myself. What persists is **files**. So the learning has to live in the project, and I read it at the start of every session. That makes it durable, reviewable, and shareable with the team.

Four plain files in the repo:

1. `thinking/principles.md`: the rules T1-T12 above, plus any you add. I read this first each session. Edit freely.
2. `thinking/decision_log.jsonl`: one line per decision: `id, date, who, question, options, chosen, probability (my stated confidence), reasons, dissent`.
3. `thinking/outcomes.jsonl`: one line per result: `decision id, what happened, was it right, what we missed`.
4. `thinking/lessons.md`: short rules distilled from mismatches between 2 and 3 (e.g. "orbital imagery overstated safe terrain: add wheel-scale unknown band").

**Cycle:** predict (with a probability) -> decide -> record outcome -> **score calibration** (do my 70% calls come true about 70% of the time?) -> change a rule or a threshold -> log why.

**How you tell me results:** type or paste the outcome in plain words; I turn it into an `outcomes` line, show you the line, and only save it after you say yes. A correction from you outranks my earlier lesson, and I mark the old lesson superseded instead of deleting it.

**What this is not:** the map model (section 7) is retrained only on labels a human reviewed, never directly on my own outputs.

## 6. Clickable mission objectives and points of interest

Click a marker -> a side card with these tabs (all fields are cited or marked unknown):

- **What it is:** name, type (crack, trough, crater wall, central peak), position with error, **competing interpretations**.
- **Why study it:** science question and the observation that would answer it.
- **Evidence:** layers used, date, resolution, **negative evidence** (checked, nothing found; or no data).
- **Access:** distance, slope class, hazard, radio shadow, reach and turn-back time.
- **Recommendation:** map / scout / defer / stop, with why-this and why-not-the-nearest.
- **Vitals impact:** estimated oxygen, power and time cost of the visit (from the ledger).
- **History:** past visits, notes, photos, decisions on this feature, outcomes.

Objectives (mission goals) are a list with a status and linked POIs; ticking an objective requires an outcome entry, which feeds the learning loop.

## 7. Satellite layer from a trained model

- An **LLM is the wrong tool for pixels.** Use a **vision model** (segmentation or detection). A language model can *explain and draft cards* around the output.
- **Training data:** the team's own traced cracks on HiRISE/CTX (confirmed / possible / rejected wind groove), split by **area** so test tiles are never near training tiles.
- **Every model output is labeled "proposed"**, shows a confidence, and needs a human confirm before it becomes a crack on the map.
- Keep a **model card**: training tiles, label counts, precision and recall on held-out tiles, known failure cases (shadows, rock edges, tracks, scale).
- Simulated or assumed satellite data (e.g. the thermal asset) stays labeled **simulated**.

## 8. Extra scenarios to inject (from the book)

1. **Dust storm:** generation falls gradually (20 percent is the book's worst case); does the plan still close its power budget?
2. **Slow wear failure:** a seam or airlock passes its cycle limit; does the vitals ledger warn before it fails?
3. **Hidden slope/soft ground:** orbit says safe; ground says soft. Recommendation must widen the error band.
4. **Comms loss:** 24 hours with no Earth; can the plan run on pre-agreed stop rules?
5. **Accidental short or bad connection** during a repair: dependency check (T5) must list what shares the circuit.
6. **Unit slip:** an input in the wrong unit; the sanity checker catches it.

## 9. Suggested build order (smallest first)

1. `thinking/` files and this principles list (no code).
2. Vitals ledger as one JSON file plus a read-only page with days-left maths.
3. Local accounts file and role checks, with the audit log.
4. Clickable POI card using hand-entered data for 5 to 15 candidates.
5. Decision log and outcomes UI, calibration score.
6. Vision model, only after enough hand labels exist.

## Open questions for the team

- Roles: are the four astronauts and Mission Control enough, or do you need more?
- Which approvals must always be human (list the actions)?
- Offline only, or a sync to a remote site when a link exists?
- Who owns the final call when the crew and Earth disagree?
