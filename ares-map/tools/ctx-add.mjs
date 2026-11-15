// Data prep: add CTX images where public/data/ctx.jpg has no data (the east strip added when the box was widened).
// Same method as tools/prep.py for the first CTX image, in Node so it runs without Python:
//   1. footprint corners from NASA ODE (uncontrolled, SPICE only), 2. orientation and shift found by correlation with the
//      CTX already in ctx.jpg where they overlap (that strip was registered to THEMIS by prep.py), 3. forward-map the
//      pixels onto the texture grid, 4. match brightness to the existing CTX, and write only into the empty pixels.
// Run:
//   node tools/ctx-add.mjs J15_050666_2087_XI_28N040W [more product ids]
// Downloads each EDR into tools/raw/ctx/ if missing. Updates public/data/ctx.jpg and site.json (ctxAdded).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import jpeg from 'jpeg-js';

const here = (p) => new URL(p, import.meta.url);
const OUT = here('../public/data/'), RAW = here('./raw/');
const R = 3396190, D2R = Math.PI / 180;
const site = JSON.parse(readFileSync(new URL('site.json', OUT)));
const B = site.meta?.bounds ?? site.bounds, TEX = site.tex.w, TEXH = site.tex.h;
const HOLE = 4; // ctx.jpg pixels at or below this are empty (JPEG leaves a little noise round 0)


// existing CTX texture
const cur = jpeg.decode(readFileSync(new URL('ctx.jpg', OUT)), { useTArray: true });
if (cur.width !== TEX || cur.height !== TEXH) throw new Error(`ctx.jpg is ${cur.width}x${cur.height}, site.json says ${TEX}x${TEXH}`);
const tex = new Uint8Array(TEX * TEXH);
for (let i = 0; i < tex.length; i++) tex[i] = cur.data[i * 4];

async function product(id) {
  const q = `https://oderest.rsl.wustl.edu/live2/?query=product&results=fmp&output=JSON&target=mars&ihid=MRO&iid=CTX&pt=EDR&productid=${id}`;
  const j = (await (await fetch(q)).json()).ODEResults, p = [].concat(j.Products?.Product ?? [])[0];
  if (!p) throw new Error('ODE has no product ' + id);
  const poly = p.Footprint_C0_geometry.match(/\(\((.*)\)\)/)[1].split(',').map((s) => s.trim().split(/\s+/).map(Number)).map(([lon, lat]) => [lon + 360, lat]);
  const ring = poly.slice(0, 4); // closed ring: 4 corners + the first again
  // corners by position: north pair (higher lat) and south pair, each split east/west
  const north = [...ring].sort((a, b) => b[1] - a[1]).slice(0, 2), south = [...ring].sort((a, b) => a[1] - b[1]).slice(0, 2);
  const [NW, NE] = north.sort((a, b) => a[0] - b[0]), [SW, SE] = south.sort((a, b) => a[0] - b[0]);
  const url = p.Product_files.Product_file.find((f) => f.Type === 'Product').URL;
  return { id, NE, SE, SW, NW, url, date: p.UTC_start_time.slice(0, 10), inc: +p.Incidence_angle, mPerPx: +p.Map_scale };
}

function readEdr(file) {
  const buf = readFileSync(file), head = buf.subarray(0, 20000).toString('latin1');
  const val = (k) => { const m = head.match(new RegExp('^\\s*' + k.replace('^', '\\^') + '\\s*=\\s*(\\S+)', 'm')); return m && m[1]; };
  const rec = +val('RECORD_BYTES'), at = +val('^IMAGE'), lines = +val('LINES'), samples = +val('LINE_SAMPLES');
  if (+val('SAMPLE_BITS') !== 8 || +val('LINE_PREFIX_BYTES') || +val('LINE_SUFFIX_BYTES')) throw new Error(file + ': expected plain 8-bit lines');
  const img = new Float32Array(lines * samples), off = rec * (at - 1);
  for (let i = 0; i < img.length; i++) img[i] = buf[off + i];
  for (let x = 0; x < samples; x++) { // remove the cross-track brightness ramp (column means), as prep.py
    let s = 0; for (let y = 0; y < lines; y++) s += img[y * samples + x];
    const m = s / lines; for (let y = 0; y < lines; y++) img[y * samples + x] -= m;
  }
  return { img, lines, samples };
}

// forward-map every step-th pixel through bilinear corners c = [(u,v)=(0,0),(1,0),(1,1),(0,1)] onto a lat/lon grid
function place(e, c, step, nLon, nLat, b) {
  const sum = new Float64Array(nLon * nLat), cnt = new Uint32Array(nLon * nLat);
  const [[a0, b0], [a1, b1], [a2, b2], [a3, b3]] = c, kx = nLon / (b.e - b.w), ky = nLat / (b.n - b.s);
  for (let y = 0; y < e.lines; y += step) {
    const v = y / e.lines;
    for (let x = 0; x < e.samples; x += step) {
      const u = x / e.samples, w0 = (1 - u) * (1 - v), w1 = u * (1 - v), w2 = u * v, w3 = (1 - u) * v;
      const ix = Math.floor(((a0 * w0 + a1 * w1 + a2 * w2 + a3 * w3) - b.w) * kx), iy = Math.floor((b.n - (b0 * w0 + b1 * w1 + b2 * w2 + b3 * w3)) * ky);
      if (ix < 0 || ix >= nLon || iy < 0 || iy >= nLat) continue;
      const k = iy * nLon + ix; sum[k] += e.img[y * e.samples + x]; cnt[k]++;
    }
  }
  const out = new Float32Array(nLon * nLat).fill(NaN);
  for (let k = 0; k < out.length; k++) if (cnt[k]) out[k] = sum[k] / cnt[k];
  return out;
}
function corr(g, ref, mask) {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let k = 0; k < g.length; k++) {
    const a = g[k], b = ref[k]; if (Number.isNaN(a) || !(b > 0) || (mask && !mask[k])) continue;
    n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
  }
  return n < 50 ? -1 : (sab / n - (sa / n) * (sb / n)) / Math.sqrt((saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2));
}

const added = [];
for (const id of process.argv.slice(2)) {
  const p = await product(id);
  mkdirSync(new URL('ctx/', RAW), { recursive: true });
  const file = new URL(`ctx/${id}.IMG`, RAW);
  if (!existsSync(file)) { console.log('downloading', p.url); writeFileSync(file, Buffer.from(await (await fetch(p.url)).arrayBuffer())); }
  const e = readEdr(file);
  console.log(id, e.samples, 'x', e.lines, 'corners NE', p.NE, 'SE', p.SE, 'SW', p.SW, 'NW', p.NW);
  // Register against the CTX already in ctx.jpg where the two overlap: same camera and light, so the match is far
  // stronger than against THEMIS day IR (which tracks temperature: dark ground is warm, so it can anti-correlate).
  // The existing strip was itself shifted onto THEMIS (site.json ctxShiftKm), so this keeps both in one frame.
  const ref = (f) => { // ctx.jpg averaged over f x f blocks; 0 where any pixel is empty
    const w = Math.floor(TEX / f), h = Math.floor(TEXH / f), out = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let s = 0, ok = true;
      for (let y = 0; y < f && ok; y++) for (let x = 0; x < f; x++) { const v = tex[(j * f + y) * TEX + i * f + x]; if (v <= HOLE) { ok = false; break; } s += v; }
      out[j * w + i] = ok ? s / (f * f) : 0;
    }
    return { w, h, g: out, b: { ...B, e: B.w + (B.e - B.w) * (w * f) / TEX, s: B.n - (B.n - B.s) * (h * f) / TEXH } };
  };
  const coarse = ref(4), fine = ref(2);
  const score = (c, step, r) => corr(place(e, c, step, r.w, r.h, r.b), r.g, null);
  const { NE, SE, SW, NW } = p;
  const HYP = { 'line0=N,s0=W': [NW, NE, SE, SW], 'line0=N,s0=E': [NE, NW, SW, SE], 'line0=S,s0=W': [SW, SE, NE, NW], 'line0=S,s0=E': [SE, SW, NW, NE] };
  const kx = 1 / (R * Math.cos(28.44 * D2R) * D2R / 1000), ky = 1 / (R * D2R / 1000); // deg per km
  const moved = (c, dx, dy) => c.map(([a, b]) => [a + dx * kx, b + dy * ky]);
  let best = null;
  for (const [k, c0] of Object.entries(HYP)) { // coarse: +-4 km in 0.25 km steps for each orientation
    let top = { dx: 0, dy: 0, r: -2 };
    for (let dx = -4; dx <= 4.001; dx += 0.25) for (let dy = -4; dy <= 4.001; dy += 0.25) {
      const r = score(moved(c0, dx, dy), 8, coarse); if (r > top.r) top = { dx, dy, r };
    }
    console.log(`  orientation ${k}: best corr with existing CTX ${top.r.toFixed(3)} at ${top.dx.toFixed(2)} km E, ${top.dy.toFixed(2)} km N`);
    if (!best || top.r > best.r) best = { k, c: c0, ...top };
  }
  let shift = { dx: best.dx, dy: best.dy, r: -2 };
  for (let dx = best.dx - 0.4; dx <= best.dx + 0.401; dx += 0.05) for (let dy = best.dy - 0.4; dy <= best.dy + 0.401; dy += 0.05) { // fine: 50 m steps
    const r = score(moved(best.c, dx, dy), 4, fine); if (r > shift.r) shift = { dx, dy, r };
  }
  const atEdge = Math.abs(shift.dx) > 3.9 || Math.abs(shift.dy) > 3.9;
  console.log(`  orientation ${best.k}; shift east ${shift.dx.toFixed(2)} km, north ${shift.dy.toFixed(2)} km, corr ${shift.r.toFixed(3)}${atEdge ? '  (AT THE SEARCH EDGE: check)' : ''}`);
  if (shift.r < 0.3 || atEdge) throw new Error(id + ': placement not trustworthy (corr ' + shift.r.toFixed(3) + '); ctx.jpg left unchanged');
  const c = moved(best.c, shift.dx, shift.dy);

  // full placement on the texture grid, then match brightness to the existing CTX where both cover
  const g = place(e, c, 2, TEX, TEXH, B);
  let n = 0, sg = 0, sgg = 0, st = 0, stt = 0, filled = 0;
  for (let k = 0; k < g.length; k++) if (!Number.isNaN(g[k]) && tex[k] > HOLE) { n++; sg += g[k]; sgg += g[k] ** 2; st += tex[k]; stt += tex[k] ** 2; }
  let gain, offset;
  if (n > 1000) { const mg = sg / n, mt = st / n; gain = Math.sqrt((stt / n - mt * mt) / (sgg / n - mg * mg)); offset = mt - mg * gain; }
  else { // no overlap: 1-99 % stretch, as prep.py
    const v = [...g].filter((x) => !Number.isNaN(x)).sort((a, b) => a - b), lo = v[Math.floor(v.length * 0.01)], hi = v[Math.floor(v.length * 0.99)];
    gain = 255 / (hi - lo); offset = -lo * gain;
  }
  // also overwrite a thin band along the old strip's edge: JPEG darkens the last pixels next to the black fill
  const EDGE = 3, open = new Uint8Array(tex.length);
  for (let y = 0; y < TEXH; y++) for (let x = 0; x < TEX; x++) {
    if (tex[y * TEX + x] > HOLE) continue;
    for (let dy = -EDGE; dy <= EDGE; dy++) for (let dx = -EDGE; dx <= EDGE; dx++) {
      const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < TEXH && xx >= 0 && xx < TEX) open[yy * TEX + xx] = 1;
    }
  }
  for (let k = 0; k < g.length; k++) if (!Number.isNaN(g[k]) && open[k]) { tex[k] = Math.max(HOLE + 1, Math.min(255, Math.round(g[k] * gain + offset))); filled++; }
  console.log(`  filled ${(100 * filled / tex.length).toFixed(1)} % of the texture (brightness matched on ${n} shared pixels)`);
  added.push({ id, date: p.date, incidenceDeg: p.inc, mPerPx: p.mPerPx, orientation: best.k, shiftKm: [+shift.dx.toFixed(1), +shift.dy.toFixed(1)], ctxCorr: +shift.r.toFixed(3), filledPct: +(100 * filled / tex.length).toFixed(1) });
}

const rgba = new Uint8Array(TEX * TEXH * 4);
for (let i = 0; i < tex.length; i++) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = tex[i]; rgba[i * 4 + 3] = 255; }
writeFileSync(new URL('ctx.jpg', OUT), jpeg.encode({ data: rgba, width: TEX, height: TEXH }, 86).data);
let empty = 0; for (const v of tex) if (v <= HOLE) empty++;
site.ctxAdded = [...(site.ctxAdded ?? []).filter((a) => !added.some((b) => b.id === a.id)), ...added];
writeFileSync(new URL('site.json', OUT), JSON.stringify(site, null, 1));
console.log(`ctx.jpg written; ${(100 * empty / tex.length).toFixed(1)} % of the texture still has no CTX`);
