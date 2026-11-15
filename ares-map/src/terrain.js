// Rule-based terrain classes on the 200 m DEM grid, and A* paths over them. No trained model:
// classes come from slope, THEMIS night IR (looseness) and CTX texture, ranked against this site only (estimated).
import { CRATER, TROUGH_ZONE } from './mission.js';
import { canvas } from './layers.js';

export const CLASSES = [
  { id: 'smooth', name: 'Smooth ground', rgb: [150, 205, 140] },
  { id: 'rocky', name: 'Rocky / holds heat', rgb: [120, 155, 200] },
  { id: 'rough', name: 'Rough texture', rgb: [232, 200, 80] },
  { id: 'loose', name: 'Loose dust or sand', rgb: [236, 140, 60] },
  { id: 'steep', name: 'Too steep for the rover', rgb: [226, 76, 64] },
  { id: 'trough', name: 'Trough band: cracks robot-only', rgb: [175, 80, 255] },
  { id: 'unknown', name: 'No CTX: unknown', rgb: null },
];
const C = Object.fromEntries(CLASSES.map((c, i) => [c.id, i]));

// Who travels. Speeds per class are in planner/config.js (placeholders, verify).
// The trough band is approximate (not traced), so crew paths may cross it slowly; the cracks inside stay robot-only.
export const AGENTS = {
  rover: { name: 'Pressurised rover', color: '#f7f9fa' },
  foot: { name: 'Crew on foot', color: '#5ec27a' },
  robot: { name: 'Crack robot', color: '#af50ff' },
};

const pct = (arr, p) => { const s = Float32Array.from(arr).sort(); return s[Math.floor(p * (s.length - 1))]; };
function sample(img, w, h, k = 1) { // image resampled onto the DEM grid (k sub-pixels per cell side)
  const c = canvas(w * k, h * k), g = c.getContext('2d'); g.drawImage(img, 0, 0, w * k, h * k);
  return g.getImageData(0, 0, w * k, h * k).data;
}

export function classify(site, imgs, slopes, limits) {
  const { w, h } = site.meta.dem, n = w * h, K = 8;
  const night = sample(imgs.themis_night, w, h), ctx = sample(imgs.ctx, w, h, K);
  const nir = new Float32Array(n), tex = new Float32Array(n), blank = new Uint8Array(n);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = j * w + i; nir[c] = night[c * 4];
    let s = 0, s2 = 0, dark = 0;
    for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) { const v = ctx[((j * K + y) * w * K + i * K + x) * 4]; s += v; s2 += v * v; if (v < 4) dark++; }
    const m = s / K / K; tex[c] = Math.sqrt(Math.max(0, s2 / K / K - m * m)); blank[c] = dark > K * K / 2;
  }
  const loose = pct(nir, 0.2), rocky = pct(nir, 0.8), rough = pct(tex, 0.85);
  const [cx, cz] = site.toXZ(CRATER.lon, CRATER.lat), cls = new Uint8Array(n);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = j * w + i, x = (i + 0.5) / w * site.W - site.W / 2, z = (j + 0.5) / h * site.H - site.H / 2;
    const r = Math.hypot(x - cx, z - cz), a = Math.atan2(z - cz, x - cx) * 180 / Math.PI; // same angle convention as robotLayer's canvas arc
    cls[c] = blank[c] ? C.unknown
      : r >= TROUGH_ZONE.rIn && r <= TROUGH_ZONE.rOut && a >= TROUGH_ZONE.fromDeg && a <= TROUGH_ZONE.toDeg ? C.trough
      : slopes[c] > limits.rover ? C.steep
      : nir[c] <= loose ? C.loose
      : tex[c] >= rough ? C.rough
      : nir[c] >= rocky ? C.rocky : C.smooth;
  }
  return cls;
}

export function terrainLayer(site, cls) {
  const { w, h } = site.meta.dem, c = canvas(w, h), g = c.getContext('2d'), im = g.createImageData(w, h);
  for (let k = 0; k < cls.length; k++) { const rgb = CLASSES[cls[k]].rgb; if (rgb) im.data.set([...rgb, 255], k * 4); }
  g.putImageData(im, 0, 0); return c;
}
