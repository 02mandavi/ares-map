// Mars colour for the grey images: the area-weighted mean colour of the USGS Viking MDIM 2.1 colourised global mosaic.
// Reads every (H/120)th row of the three bands (one uncompressed strip per row per band) and every 4th pixel of each row.
// Usage: node tools/viking.mjs  ->  prints the channel ratios that go in MARS_COLOR (src/layers.js).
import { fromUrl } from 'geotiff';

const URL_ = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif';
const im = await (await fromUrl(URL_)).getImage(), fd = im.fileDirectory, W = im.getWidth(), H = im.getHeight();
if (fd.getValue('Compression') !== 1 || fd.getValue('RowsPerStrip') !== 1 || fd.getValue('PlanarConfiguration') !== 2) throw new Error('unexpected TIFF layout');
const offs = await fd.loadValue('StripOffsets'), N = 120, sum = [0, 0, 0];
const get = async (c, y) => {
  for (let t = 0; ; t++) {
    try {
      const s = Number(offs[c * H + y]), r = await fetch(URL_, { headers: { Range: `bytes=${s}-${s + W - 1}` } });
      if (r.status !== 206) throw new Error('HTTP ' + r.status);
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) { if (t > 4) throw e; }
  }
};
const queue = Array.from({ length: N }, (_, k) => Math.floor((k + 0.5) * H / N));
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const y = queue.shift(), [R, G, B] = await Promise.all([0, 1, 2].map((c) => get(c, y)));
    const wt = Math.cos((90 - (y + 0.5) * 180 / H) * Math.PI / 180); // equal-angle rows: weight by area
    for (let i = 0; i < W; i += 4) if (R[i] || G[i] || B[i]) { sum[0] += R[i] * wt; sum[1] += G[i] * wt; sum[2] += B[i] * wt; }
  }
}));
const Y = (sum[0] + sum[1] + sum[2]) / 3;
console.log('Viking MDIM 2.1 global mean colour ratios (R, G, B):', sum.map((v) => +(v / Y).toFixed(3)));
