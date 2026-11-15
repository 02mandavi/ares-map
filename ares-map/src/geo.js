// Site grid and terrain sampling. Scene units are km: x east, z south (three.js -z = north), y up.
// Coordinates are planetocentric, east-positive, Mars 2000 sphere (R = 3396.19 km).
export const R_KM = 3396.19;

export async function loadSite(base = 'data/') {
  const meta = await (await fetch(base + 'site.json')).json();
  const dem = Float32Array.from(await (await fetch(base + 'dem.json')).json(), (v) => v ?? NaN); // null = no data, as NaN like the old float32 file
  if (dem.length !== meta.dem.w * meta.dem.h) throw new Error(`dem.json has ${dem.length} cells, site.json expects ${meta.dem.w * meta.dem.h}`);
  const b = meta.bounds, W = meta.widthKm, H = meta.heightKm;
  const lon0 = (b.w + b.e) / 2, lat0 = (b.n + b.s) / 2;
  const kLon = W / (b.e - b.w), kLat = H / (b.n - b.s);
  const { w, h } = meta.dem;
  const toXZ = (lon, lat) => [(lon - lon0) * kLon, -(lat - lat0) * kLat];
  const toLonLat = (x, z) => [x / kLon + lon0, -z / kLat + lat0];
  // DEM sample in metres at fractional cell coords (cell centres at i + 0.5)
  const sampler = (g) => (fx, fy) => {
    fx = Math.min(Math.max(fx - 0.5, 0), w - 1); fy = Math.min(Math.max(fy - 0.5, 0), h - 1);
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
    const tx = fx - x0, ty = fy - y0;
    const a = g[y0 * w + x0], c = g[y0 * w + x1], d = g[y1 * w + x0], e = g[y1 * w + x1];
    return (a * (1 - tx) + c * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
  };
  const cell = sampler(dem);
  const elevXZ = (x, z) => cell((x / W + 0.5) * w, (z / H + 0.5) * h);
  // display only: a 5x5 binomial blur hides the 200 m facets and MOLA track stripes; slope, reach, routes and line of sight keep the raw DEM
  const soft = blur(blur(dem, w, h), w, h), softCell = sampler(soft);
  const elevSoftXZ = (x, z) => softCell((x / W + 0.5) * w, (z / H + 0.5) * h);
  return { meta, dem, W, H, toXZ, toLonLat, elevXZ, elevSoftXZ, cell, base: meta.dem.min };
}

// 3x3 binomial blur (1 2 1), skipping no-data cells; exported for the self-test
export function blur(g, w, h) {
  const out = new Float32Array(w * h), k = [1, 2, 1];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let s = 0, n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const x = i + di, y = j + dj, v = x >= 0 && x < w && y >= 0 && y < h ? g[y * w + x] : NaN;
      if (!Number.isNaN(v)) { const wt = k[di + 1] * k[dj + 1]; s += v * wt; n += wt; }
    }
    out[j * w + i] = n ? s / n : NaN;
  }
  return out;
}

// Height function for the 3D scene. ve = vertical exaggeration; pov = [x,z] adds Mars curvature drop seen from that point.
export function makeSurface(site, ve, pov = null) {
  const y = (x, z) => {
    let m = ((site.elevSoftXZ ?? site.elevXZ)(x, z) - site.base) * ve;
    if (pov) { const d2 = (x - pov[0]) ** 2 + (z - pov[1]) ** 2; m -= (d2 / (2 * R_KM)) * 1000; }
    return m / 1000;
  };
  return { ve, pov, y };
}

export const distKm = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Resample a polyline (xz km) every `step` km so it can be draped on the terrain.
export function densify(pts, step = 0.15) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], n = Math.max(1, Math.ceil(distKm(a, b) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  if (pts.length) out.push(pts[pts.length - 1]);
  return out;
}

export const circle = (c, r, n = 160) => Array.from({ length: n + 1 }, (_, i) => [c[0] + r * Math.cos(i / n * 2 * Math.PI), c[1] + r * Math.sin(i / n * 2 * Math.PI)]);

// self-check: round trip and circle closure
if (import.meta.env?.DEV) {
  const c = circle([1, 2], 3, 8); console.assert(Math.abs(c[0][0] - c[8][0]) < 1e-9, 'circle closes');
  console.assert(densify([[0, 0], [1, 0]], 0.25).length === 5, 'densify count');
}
