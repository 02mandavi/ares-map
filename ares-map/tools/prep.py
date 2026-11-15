"""Data prep, step 2: turn tools/raw/* + downloaded CTX/HiRISE into web assets in public/data/.
Run: python -I tools/prep.py <dir with ctx.IMG and r1_ESP_*_full.png>
     python -I tools/prep.py --reuse-images   (after widening the box in fetch.mjs: keeps the current CTX/HiRISE)
Grid: planetocentric lat/lon, east-positive, Mars 2000/2015 sphere R=3396190 m."""
import json, sys, os
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
RAW, OUT = os.path.join(HERE, 'raw'), os.path.join(HERE, '..', 'public', 'data')
SRC = sys.argv[1]
REUSE = SRC == '--reuse-images'  # no raw CTX/HiRISE at hand: keep the current CTX texture and HiRISE overlays
os.makedirs(OUT, exist_ok=True)

def load(name):
    m = json.load(open(os.path.join(RAW, name + '.json')))
    dt = {'Int16Array': np.int16, 'Uint8Array': np.uint8}[m['type']]
    return np.fromfile(os.path.join(RAW, name + '.bin'), dtype=dt).reshape(m['h'], m['w']), m

# --- exact bounds of the cut windows
dem, dm = load('dem')
DRES = 0.003374120830641
x0, y0, x1, y1 = dm['win']
B = dict(w=x0 * DRES - 180 + 360, e=x1 * DRES - 180 + 360, n=90 - y0 * DRES, s=90 - y1 * DRES)
R, D2R = 3396190.0, np.pi / 180
tday, tm = load('themis_day')
tnight, _ = load('themis_night')
tx0, ty0, tx1, ty1 = tm['win']
TB = dict(w=(tx0 * 100 - 2667400) / R / D2R + 360, e=(tx1 * 100 - 2667400) / R / D2R + 360,
          n=(1778300 - ty0 * 100) / R / D2R, s=(1778300 - ty1 * 100) / R / D2R)
print('DEM bounds', B, 'THEMIS bounds', TB)

# Common output grid = DEM bounds. Textures at TEX px across.
TEX = 2048
W_KM = (B['e'] - B['w']) * D2R * R * np.cos(28.44 * D2R) / 1000
H_KM = (B['n'] - B['s']) * D2R * R / 1000
TEXH = round(TEX * H_KM / W_KM)
lon = np.linspace(B['w'], B['e'], TEX, endpoint=False) + (B['e'] - B['w']) / TEX / 2
lat = np.linspace(B['n'], B['s'], TEXH, endpoint=False) - (B['n'] - B['s']) / TEXH / 2
LON, LAT = np.meshgrid(lon, lat)

def stretch(a, valid):
    lo, hi = np.percentile(a[valid], [1, 99])
    return (np.clip((a - lo) / (hi - lo), 0, 1) * 255).astype(np.uint8)

def resample_regular(img, b, mode=Image.BILINEAR):
    """img covers lat/lon box b (pixel edges); sample it onto LON/LAT."""
    h, w = img.shape[:2]
    fx = (LON - b['w']) / (b['e'] - b['w']) * w - 0.5
    fy = (b['n'] - LAT) / (b['n'] - b['s']) * h - 0.5
    ix = np.clip(np.round(fx).astype(int), 0, w - 1); iy = np.clip(np.round(fy).astype(int), 0, h - 1)
    out = img[iy, ix]
    out[(fx < -0.5) | (fx > w - 0.5) | (fy < -0.5) | (fy > h - 0.5)] = 0
    return out

# --- THEMIS day/night onto the grid
for name, a in (('themis_day', tday), ('themis_night', tnight)):
    g = resample_regular(a, TB)
    Image.fromarray(g).save(os.path.join(OUT, name + '.jpg'), quality=88)

# --- Reuse mode: widen the grid without the raw CTX/HiRISE downloads. The current public/data/ctx.jpg is placed
# on the new grid by its old bounds (same north/south rows, new columns stay 0 = no CTX); HiRISE overlays keep their own bounds.
if REUSE:
    old = json.load(open(os.path.join(OUT, 'site.json')))
    ob = old['bounds']
    assert abs(ob['n'] - B['n']) < 1e-9 and abs(ob['s'] - B['s']) < 1e-9 and ob['w'] >= B['w'] and ob['e'] <= B['e'], 'reuse needs the old box inside the new one, same rows'
    xa, xb = round((ob['w'] - B['w']) / (B['e'] - B['w']) * TEX), round((ob['e'] - B['w']) / (B['e'] - B['w']) * TEX)
    ctxtex = np.zeros((TEXH, TEX), np.uint8)
    ctxtex[:, xa:xb] = np.asarray(Image.open(os.path.join(OUT, 'ctx.jpg')).convert('L').resize((xb - xa, TEXH), Image.LANCZOS))
    Image.fromarray(ctxtex).save(os.path.join(OUT, 'ctx.jpg'), quality=86)
    best = (old['ctxOrientation'], old['ctxThemisCorr'], None)
    CTX_SHIFT_KM, hires = old['ctxShiftKm'], old['hirise']
else:
    # --- CTX: raw EDR placed by its footprint (bilinear corners). Orientation chosen by correlation with THEMIS day.
    ctx = np.fromfile(os.path.join(SRC, 'ctx.IMG'), dtype=np.uint8, offset=5056, count=5056 * 10240).reshape(10240, 5056).astype(np.float32)
    ctx -= ctx.mean(axis=0, keepdims=True)  # remove cross-track brightness ramp
    NE, SE, SW, NW = (319.74, 28.9824), (319.88, 27.9689), (319.33, 27.9093), (319.19, 28.9227)
    # Each hypothesis: corners at (u,v) = (0,0),(1,0),(1,1),(0,1)  [u = sample, v = line]
    HYP = {'line0=N,s0=W': (NW, NE, SE, SW), 'line0=N,s0=E': (NE, NW, SW, SE),
           'line0=S,s0=W': (SW, SE, NE, NW), 'line0=S,s0=E': (SE, SW, NW, NE)}
    step = 4
    vv, uu = np.mgrid[0:10240:step, 0:5056:step]
    u, v = uu / 5056.0, vv / 10240.0
    small = ctx[::step, ::step]

    def place(c, n_lon, n_lat, b):
        (a0, b0), (a1, b1), (a2, b2), (a3, b3) = c
        plon = a0 * (1 - u) * (1 - v) + a1 * u * (1 - v) + a2 * u * v + a3 * (1 - u) * v
        plat = b0 * (1 - u) * (1 - v) + b1 * u * (1 - v) + b2 * u * v + b3 * (1 - u) * v
        ix = ((plon - b['w']) / (b['e'] - b['w']) * n_lon).astype(int)
        iy = ((b['n'] - plat) / (b['n'] - b['s']) * n_lat).astype(int)
        ok = (ix >= 0) & (ix < n_lon) & (iy >= 0) & (iy < n_lat)
        idx = iy[ok] * n_lon + ix[ok]
        s = np.bincount(idx, small[ok], n_lon * n_lat); c_ = np.bincount(idx, minlength=n_lon * n_lat)
        out = np.where(c_ > 0, s / np.maximum(c_, 1), np.nan).reshape(n_lat, n_lon)
        return out

    th, tw = tday.shape
    best = None
    for k, c in HYP.items():
        g = place(c, tw, th, TB)
        m = ~np.isnan(g) & (tday > 0)
        r = np.corrcoef(g[m], tday[m].astype(np.float32))[0, 1]
        print(f'CTX orientation {k}: corr with THEMIS day = {r:.3f}')
        if best is None or r > best[1]:
            best = (k, r, c)
    print('CTX orientation chosen:', best[0], round(best[1], 3))

    # ODE footprints are uncontrolled (SPICE only): refine with a shift search against THEMIS (controlled mosaic).
    kx, ky = 1 / (R * np.cos(28.44 * D2R) * D2R / 1000), 1 / (R * D2R / 1000)  # deg per km
    shift = (0.0, 0.0, best[1])
    for dx in np.arange(-3, 3.01, 0.2):
        for dy in np.arange(-3, 3.01, 0.2):
            c = [(a + dx * kx, b_ + dy * ky) for a, b_ in best[2]]
            g = place(c, tw, th, TB); m = ~np.isnan(g) & (tday > 0)
            r = np.corrcoef(g[m], tday[m].astype(np.float32))[0, 1]
            if r > shift[2]: shift = (dx, dy, r)
    print(f'CTX shift east {shift[0]:.1f} km, north {shift[1]:.1f} km, corr {shift[2]:.3f}')
    best = (best[0], shift[2], [(a + shift[0] * kx, b_ + shift[1] * ky) for a, b_ in best[2]])
    CTX_SHIFT_KM = [round(float(shift[0]), 1), round(float(shift[1]), 1)]

    # full-res placement at ~5.7 m: forward-map every pixel (step 1) onto the texture grid
    vv, uu = np.mgrid[0:10240:2, 0:5056:2]; u, v = uu / 5056.0, vv / 10240.0; small = ctx[::2, ::2]
    g = place(best[2], TEX, TEXH, B)
    valid = ~np.isnan(g)
    ctxtex = np.zeros(g.shape, np.uint8); ctxtex[valid] = stretch(g, valid)[valid]
    Image.fromarray(ctxtex).save(os.path.join(OUT, 'ctx.jpg'), quality=86)

    # --- HiRISE strips (already map-projected, lat/lon bounds from their PDS labels)
    HI = {'ESP_022869_2085': dict(n=28.778145214213, s=28.113499914426, e=319.65943910936, w=319.46097307293, date='2011-06-13'),
          'ESP_050666_2090': dict(n=28.690010569033, s=28.288424662701, e=319.93752681815, w=319.78481720225, date='2017-05-18')}
    hires = []
    for pid, b in HI.items():
        im = np.asarray(Image.open(os.path.join(SRC, f'r1_{pid}_full.png')).convert('L'))
        # crop to the site box and save at ~2 m/px as its own overlay with exact bounds
        h, w = im.shape
        cw, ce = max(b['w'], B['w']), min(b['e'], B['e']); cn, cs = min(b['n'], B['n']), max(b['s'], B['s'])
        xa = int((cw - b['w']) / (b['e'] - b['w']) * w); xb = int((ce - b['w']) / (b['e'] - b['w']) * w)
        ya = int((b['n'] - cn) / (b['n'] - b['s']) * h); yb = int((b['n'] - cs) / (b['n'] - b['s']) * h)
        crop = Image.fromarray(im[ya:yb, xa:xb])
        # 3D overlay: long side 4096 (WebGL-safe on tablets)
        k = 4096 / max(crop.size)
        crop.resize((round(crop.width * k), round(crop.height * k)), Image.LANCZOS).save(os.path.join(OUT, f'{pid}.jpg'), quality=85)
        # detail viewer: 2 m/px, cut into 2048 px tall chunks, north first
        half = crop.resize((crop.width // 2, crop.height // 2), Image.LANCZOS)
        chunks = []
        for i, y in enumerate(range(0, half.height, 2048)):
            half.crop((0, y, half.width, min(y + 2048, half.height))).save(os.path.join(OUT, f'{pid}_{i}.jpg'), quality=82)
            chunks.append(f'{pid}_{i}.jpg')
        hires.append(dict(id=pid, date=b['date'], bounds=dict(w=cw, e=ce, n=cn, s=cs), detailPx=[half.width, half.height], mPerPx=2, chunks=chunks))

# --- DEM: metres above Mars datum, int16 -> float32 grid
demf = dem.astype(np.float32); demf[dem == dm['nodata']] = np.nan
json.dump([None if np.isnan(v) else round(float(v), 1) for v in demf.ravel()], open(os.path.join(OUT, 'dem.json'), 'w'), separators=(',', ':'))  # JSON, not raw float32: the artifact host refuses .f32/.bin

meta = dict(
    bounds=B, widthKm=W_KM, heightKm=H_KM, radius=R,
    dem=dict(w=dem.shape[1], h=dem.shape[0], min=float(np.nanmin(demf)), max=float(np.nanmax(demf))),
    tex=dict(w=TEX, h=TEXH), ctxOrientation=best[0], ctxThemisCorr=round(float(best[1]), 3), ctxShiftKm=CTX_SHIFT_KM, hirise=hires)
json.dump(meta, open(os.path.join(OUT, 'site.json'), 'w'), indent=1)
print(json.dumps(meta, indent=1))
