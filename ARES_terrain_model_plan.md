# A.R.E.S. terrain model: layers, training, colored map, path planning

Site: 28.43° N, 319.77° E. Status: **plan only. Nothing here is trained yet.** Items marked (verify) still need checking against the source.

## 1. What the research says

| Work | Input | Output | Use for us |
|---|---|---|---|
| SPOC (NASA JPL) | HiRISE, 25 cm | 17 terrain classes per pixel, DeepLab FCN, >90 % agreement with human labels | The pattern to copy for the HiRISE strips |
| NOAH-H (ESA ExoMars) | HiRISE | DeepLab terrain classes, also worked at Jezero | Shows a model can carry over to a new site |
| DoMars16k | CTX, 6 m | 15 landforms, 16,150 tiles of 200 px (~1.2 km), **pretrained models on Zenodo** | Covers the whole site at CTX scale |
| Mars-Bench | HiRISE, CTX, others | Standard train and test splits | Use to report accuracy honestly |
| MOMO (2026) | Orbital images | Mars foundation model (verify licence and weights) | Starting weights for larger-scale training |
| AI4Mars | **Rover cameras, not orbit** | soil, bedrock, sand, big rock | Not for the map; only for a later rover-camera view |
| Thermal inertia slip studies (JPL, CMU) | THEMIS, DEM | Slip prediction error drops 26 % with thermal inertia | Night IR goes into the cost, not into the classifier |

No paper found joins all of these into one cost map. We do that ourselves (section 4).

## 2. Which layers go where

All layers are resampled to one grid: **6 m site-wide**, with **0.5 m inside the HiRISE strips**.

| Layer (already in the app) | Resolution | Feeds | Why |
|---|---|---|---|
| HiRISE ESP_022869_2085, ESP_050666_2090 | 0.5 m | Model A (pixel classes) | Rocks, ripples, crack edges, outcrop texture |
| CTX P15_006980_2087 | ~6 m | Model B (landform tiles) | Crater rim, ejecta, troughs, dunes, site-wide |
| THEMIS night IR | 100 m | Cost (loose ground) and an extra model channel | Dark at night = fine dust or sand = slip risk |
| THEMIS day IR | 100 m | Extra model channel | Albedo and temperature context |
| HRSC-MOLA DEM | 200 m | Slope, roughness, radio shadow | Hard slope limits. Too coarse for boulders |

**Biggest accuracy gain to add:** a HiRISE or CTX stereo DTM (1 to 20 m) instead of the 200 m DEM. Without it, slope is only "not steep at 200 m" (the app already says this).

## 3. Training at larger scale

1. **Labels**
   - Use SPOC-style classes on HiRISE (verify the public class list).
   - Use DoMars16k classes on CTX.
   - The team hand-labels about 30 to 50 HiRISE tiles from this site for fine-tuning.
2. **Pretraining.** Start from MOMO or DoMars16k weights, then fine-tune on other HiRISE images of Chryse and Oxia, downloaded from PDS ODE. More images is the "larger scale".
3. **Model A (HiRISE).**
   - DeepLabv3+ or SegFormer.
   - Input: 512 px tiles. Channels: HiRISE, plus THEMIS night and day upsampled, plus slope.
4. **Model B (CTX).** Classify 200 px tiles with the DoMars16k model, then slide with overlap to get a smooth class map.
5. **Validation.**
   - Hold out a whole HiRISE image, not random tiles, so the score is not inflated.
   - Report per-class IoU and calibration.
   - Any pixel below a confidence of 0.6 (to tune) becomes **unknown**, and unknown is never drawn as safe.
6. **Scale.**
   - 1 GPU (Colab or Kaggle T4) is enough to fine-tune. Full HiRISE strips need tiling.
   - Inference across the site takes minutes, done offline. The app only loads the result as a PNG plus a class-ID raster.

## 4. Colored view

One fixed colour per class. Confidence is shown as opacity, and unknown is drawn as the existing coverage hatch.

| Class group | Colour | Crew walk cost |
|---|---|---|
| Smooth regolith | pale green | 1 |
| Bedrock / outcrop | blue-grey | 1.5 |
| Rough or rocky regolith | yellow | 3 |
| Ripples / sand sheets | orange | 6, plus extra cost if night IR is dark |
| Dunes, loose sand | red | blocked |
| Crack, trough, steep wall | purple | blocked for crew, allowed for the robot |
| Unknown / low confidence | hatch | blocked |

Show it as one more toggle in the Layers drawer, under "What we know".

## 5. Path planning for each traveller and each leg

```
cost(cell) = class_cost[agent][class]
           × slope_factor(slope)          # blocked over the agent's slope limit
           × (1 + k · loose(night_IR))    # slip risk
           + unknown_penalty
```

- **Agents.** Each has its own cost table:
  - crew on foot: slope limit 15° (verify)
  - pressurised rover: 20° (verify)
  - crack robot: may enter the purple class
- **Search.**
  - Run A* on an 8-connected grid for each leg: HAB→S1, S1→S2, and so on, then the last station back to HAB.
  - Time per leg = path length ÷ speed. That time feeds the existing turn-back clock.
  - If a leg makes the EVA go past turn-back, mark it.
- **Output.**
  - Draw the path in each agent's colour.
  - Per leg: show km, minutes, highest slope, and the share of the path on unknown ground.
  - Label the path "proposed". The crew still approves the route.

## 6. Smallest version that still works (for the hackathon)

- Skip training.
- Run the published DoMars16k model on CTX.
- Add slope and night IR rules.
- Run A* per leg.

This gives the colored map and real paths in about a day. Model A on HiRISE comes after.

## Sources
- [SPOC, nasa-jpl/SPOC](https://www.github.com/nasa-jpl/SPOC/blob/master/index.html), [Solar rover autonomy, arXiv 1805.05451](https://arxiv.org/pdf/1805.05451)
- [Machine Learning for Mars Exploration, arXiv 2111.11537](https://arxiv.org/pdf/2111.11537)
- [NOAH-H, Journal of Maps 2022](https://doaj.org/article/bc74cfe2e30e403d8110e165f06b0be3), [EPSC2020-676](https://meetingorganizer.copernicus.org/EPSC2020/EPSC2020-676.html)
- [DoMars16k paper](https://mdpi.com/2072-4292/12/23/3981), [DoMars16k data and models, Zenodo](https://zenodo.org/record/4291940)
- [MOMO, arXiv 2604.02719](https://arxiv.org/pdf/2604.02719), [Mars-Bench, NeurIPS ML4PS 2025](https://ml4physicalsciences.github.io/2025/files/NeurIPS_ML4PS_2025_114.pdf)
- [AI4MARS, CVPRW 2021](https://openaccess.thecvf.com/content/CVPR2021W/AI4Space/papers/Swan_AI4MARS_A_Dataset_for_Terrain-Aware_Autonomous_Driving_on_Mars_CVPRW_2021_paper.pdf)
- [Thermal imaging for traversability, CMU](https://www.ri.cmu.edu/publications/improving-prediction-traversability-planetary-rovers-using-thermal-imaging), [Slip from thermal inertia, NTRS](https://ntrs.nasa.gov/citations/20210006223), [D* cost-map planner, JPL](https://www-robotics.jpl.nasa.gov/media/documents/ROB-08-0042.pdf)
- [THEMIS terrain and thermophysics at Gusev, USGS](https://pubs.usgs.gov/publication/70036862)
