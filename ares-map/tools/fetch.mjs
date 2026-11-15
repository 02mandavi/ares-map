// Data prep: cut the site window out of NASA/USGS cloud rasters into raw arrays in tools/raw/.
// Site box (planetocentric, east-positive): lat 28.18..28.70, lon 319.30..320.06 E (east edge widened from 319.90 so Sol sites S2 and S5 are on the terrain).
import { fromUrl } from 'geotiff';
import { writeFileSync, mkdirSync } from 'node:fs';

const BOX = { s: 28.18, n: 28.70, w: 319.30 - 360, e: 320.06 - 360 };
const R = 3396190, d2r = Math.PI / 180;
mkdirSync(new URL('./raw/', import.meta.url), { recursive: true });

function save(name, r, win, nodata) {
  const w = win[2] - win[0], h = win[3] - win[1];
  if (r.length !== w * h) throw new Error(`${name}: got ${r.length} cells, expected ${w * h}`);
  writeFileSync(new URL(`./raw/${name}.bin`, import.meta.url), Buffer.from(r.buffer, r.byteOffset, r.byteLength));
  writeFileSync(new URL(`./raw/${name}.json`, import.meta.url), JSON.stringify({ w, h, type: r.constructor.name, win, nodata }));
  console.log(name, w, h, r.constructor.name);
}
const windowOf = (toPix) => { const [x0, y0] = toPix(BOX.w, BOX.n), [x1, y1] = toPix(BOX.e, BOX.s); return [Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1)]; };

async function cut(url, name, toPix) { // tiled rasters: the window needs only a few tiles
  const im = await (await fromUrl(url)).getImage(), win = windowOf(toPix);
  const [r] = await im.readRasters({ window: win });
  save(name, r, win, im.getGDALNoData());
}

// The DEM is uncompressed int16, one strip per 106 694 px row: geotiff fetches whole rows ~155 at once and S3 drops them.
// Read just the window's bytes from each row, a few requests at a time.
async function cutRows(url, name, toPix) {
  const im = await (await fromUrl(url)).getImage(), fd = im.fileDirectory, win = windowOf(toPix);
  if (fd.getValue('Compression') !== 1 || fd.getValue('RowsPerStrip') !== 1 || fd.getValue('BitsPerSample')[0] !== 16) throw new Error(name + ': expected uncompressed 16-bit rows');
  const offs = await fd.loadValue('StripOffsets'), w = win[2] - win[0], h = win[3] - win[1], out = new Int16Array(w * h);
  const row = async (j) => {
    const start = Number(offs[win[1] + j]) + win[0] * 2;
    for (let tries = 0; ; tries++) {
      try {
        const res = await fetch(url, { headers: { Range: `bytes=${start}-${start + w * 2 - 1}` } });
        if (res.status !== 206) throw new Error('HTTP ' + res.status);
        const dv = new DataView(await res.arrayBuffer());
        for (let i = 0; i < w; i++) out[j * w + i] = dv.getInt16(i * 2, im.littleEndian);
        return;
      } catch (e) { if (tries >= 4) throw e; }
    }
  };
  const queue = [...Array(h).keys()];
  await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await row(queue.shift()); }));
  save(name, out, win, im.getGDALNoData());
}

// HRSC+MOLA blended DEM: geographic degrees, origin (-180, 90), 0.003374120830641 deg/px.
const dres = 0.003374120830641;
await cutRows('https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif', 'dem',
  (lon, lat) => [(lon + 180) / dres, (90 - lat) / dres]);

// THEMIS controlled mosaics MC-11: equirectangular clon=0, lat_ts=0, origin x=-2667400 y=1778300, 100 m/px.
const tp = (lon, lat) => [(R * lon * d2r + 2667400) / 100, (1778300 - R * lat * d2r) / 100];
const base = 'https://astrogeo-ard.s3.us-west-2.amazonaws.com/mars/mo/themis/controlled_mosaics/';
await cut(base + 'mc11_oxia_palus_dir/mc11_oxia_palus_dir.tif', 'themis_day', tp);
await cut(base + 'mc11_oxia_palus_nir/mc11_oxia_palus_nir.tif', 'themis_night', tp);
