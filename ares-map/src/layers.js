// 2D layers drawn into one canvas that textures the terrain. DEM-derived layers stay at 200 m cells (drawn pixelated on purpose).
import { R_KM } from './geo.js';
import { CRATER, TROUGH_ZONE } from './mission.js';

const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
export const loadImage = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('could not load ' + src)); i.src = src; });

function demCanvas(site, paint) {
  const { w, h } = site.meta.dem, c = canvas(w, h), g = c.getContext('2d'), im = g.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const p = paint(i, j); if (p) im.data.set(p, (j * w + i) * 4); }
  g.putImageData(im, 0, 0); return c;
}
const cellKm = (site) => [site.W / site.meta.dem.w, site.H / site.meta.dem.h];

export function slopeDeg(site) {
  const { w, h } = site.meta.dem, [kx, kz] = cellKm(site), e = site.dem, out = new Float32Array(w * h);
  const at = (i, j) => e[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * kx * 1000), dz = (at(i, j + 1) - at(i, j - 1)) / (2 * kz * 1000);
    out[j * w + i] = Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
  }
  return out;
}

export function reliefLayer(site) {
  const { w } = site.meta.dem, [kx, kz] = cellKm(site), e = site.dem, { min, max } = site.meta.dem;
  const az = 290 * Math.PI / 180, alt = 35 * Math.PI / 180, h = site.meta.dem.h;
  return demCanvas(site, (i, j) => {
    const at = (a, b) => e[Math.min(h - 1, Math.max(0, b)) * w + Math.min(w - 1, Math.max(0, a))];
    const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * kx * 1000) * 3, dz = (at(i, j + 1) - at(i, j - 1)) / (2 * kz * 1000) * 3;
    const slope = Math.atan(Math.hypot(dx, dz)), aspect = Math.atan2(dz, -dx);
    const shade = Math.max(0, Math.sin(alt) * Math.cos(slope) + Math.cos(alt) * Math.sin(slope) * Math.cos(az - aspect));
    const t = (at(i, j) - min) / (max - min), v = Math.round(40 + 150 * shade * (0.55 + 0.45 * t));
    return [v, v, v, 255];
  });
}

const SLOPE_AMBER = [232, 168, 56], SLOPE_RED = [226, 76, 64];
export function slopeLayer(site, slopes, walk, rover) {
  return demCanvas(site, (i, j) => {
    const s = slopes[j * site.meta.dem.w + i];
    return s > rover ? [...SLOPE_RED, 200] : s > walk ? [...SLOPE_AMBER, 170] : null;
  });
}

// Line of sight from the habitat mast to a crew member (2 m) at each cell, with Mars curvature.
export function viewshed(site, habXZ, mastM) {
  const { w, h } = site.meta.dem, [kx, kz] = cellKm(site);
  const hi = (habXZ[0] / site.W + 0.5) * w, hj = (habXZ[1] / site.H + 0.5) * h;
  const h0 = site.cell(hi, hj) + mastM, out = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ti = i + 0.5, tj = j + 0.5, dKm = Math.hypot((ti - hi) * kx, (tj - hj) * kz);
    if (dKm < 0.3) { out[j * w + i] = 1; continue; }
    const n = Math.ceil(dKm / 0.08); let maxA = -Infinity;
    for (let k = 1; k < n; k++) {
      const f = k / n, dm = dKm * f * 1000;
      maxA = Math.max(maxA, (site.cell(hi + (ti - hi) * f, hj + (tj - hj) * f) - h0) / dm - dm / (2 * R_KM * 1000));
    }
    const dm = dKm * 1000, a = (site.cell(ti, tj) + 2 - h0) / dm - dm / (2 * R_KM * 1000);
    out[j * w + i] = a >= maxA ? 1 : 0;
  }
  return out;
}
export const radioLayer = (site, vis) => demCanvas(site, (i, j) => vis[j * site.meta.dem.w + i] ? null : [88, 156, 255, 120]);

function pattern(g, color, cross, gap = 10) {
  const p = canvas(gap, gap), c = p.getContext('2d');
  c.strokeStyle = color; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, gap); c.lineTo(gap, 0); if (cross) { c.moveTo(0, 0); c.lineTo(gap, gap); } c.stroke();
  return g.createPattern(p, 'repeat');
}

// Hatch where only CTX (or worse) exists; cross-hatch where CTX is missing too.
export function coverageLayer(site, ctxImg) {
  const { w: TW, h: TH } = site.meta.tex, c = canvas(TW, TH), g = c.getContext('2d'), b = site.meta.bounds;
  g.fillStyle = pattern(g, 'rgba(240,242,245,0.28)', false); g.fillRect(0, 0, TW, TH);
  g.globalCompositeOperation = 'destination-out';
  for (const hr of site.meta.hirise) {
    const x0 = (hr.bounds.w - b.w) / (b.e - b.w) * TW, x1 = (hr.bounds.e - b.w) / (b.e - b.w) * TW;
    const y0 = (b.n - hr.bounds.n) / (b.n - b.s) * TH, y1 = (b.n - hr.bounds.s) / (b.n - b.s) * TH;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  // CTX gaps: build a mask from black ctx pixels, then fill it with cross-hatch
  const m = canvas(TW, TH), mg = m.getContext('2d'); mg.drawImage(ctxImg, 0, 0, TW, TH);
  const d = mg.getImageData(0, 0, TW, TH);
  for (let k = 0; k < d.data.length; k += 4) d.data[k + 3] = d.data[k] < 4 ? 255 : 0;
  mg.putImageData(d, 0, 0); mg.globalCompositeOperation = 'source-in';
  mg.fillStyle = pattern(mg, 'rgba(240,242,245,0.45)', true, 8); mg.fillRect(0, 0, TW, TH);
  g.globalCompositeOperation = 'source-over'; g.drawImage(m, 0, 0);
  return c;
}

export function robotLayer(site) {
  const { w: TW, h: TH } = site.meta.tex, c = canvas(TW, TH), g = c.getContext('2d');
  const [cx, cz] = site.toXZ(CRATER.lon, CRATER.lat), px = (x) => (x / site.W + 0.5) * TW, pz = (z) => (z / site.H + 0.5) * TH;
  const sx = TW / site.W, sz = TH / site.H, a0 = TROUGH_ZONE.fromDeg * Math.PI / 180, a1 = TROUGH_ZONE.toDeg * Math.PI / 180;
  g.beginPath();
  g.ellipse(px(cx), pz(cz), TROUGH_ZONE.rOut * sx, TROUGH_ZONE.rOut * sz, 0, a0, a1);
  g.ellipse(px(cx), pz(cz), TROUGH_ZONE.rIn * sx, TROUGH_ZONE.rIn * sz, 0, a1, a0, true);
  g.closePath();
  g.fillStyle = pattern(g, 'rgba(232,168,56,0.75)', false, 7); g.fill();
  g.strokeStyle = 'rgba(232,168,56,0.9)'; g.lineWidth = 2; g.stroke();
  return c;
}

export function compose(target, site, base, layers) {
  const { w: TW, h: TH } = site.meta.tex, g = target.getContext('2d');
  g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, TW, TH);
  g.imageSmoothingEnabled = base.smooth !== false; g.drawImage(base.img, 0, 0, TW, TH);
  for (const l of layers) { g.globalAlpha = l.opacity ?? 1; g.imageSmoothingEnabled = !l.pixelated; g.drawImage(l.img, 0, 0, TW, TH); }
  g.globalAlpha = 1;
}
export { canvas };
