// Print size, bbox, resolution and overviews of remote COGs (data-prep only).
import { fromUrl } from 'geotiff';
for (const url of process.argv.slice(2)) {
  const t = await fromUrl(url);
  const n = await t.getImageCount();
  const im = await t.getImage();
  console.log(url.split('/').pop(), { size: [im.getWidth(), im.getHeight()], bbox: im.getBoundingBox(), res: im.getResolution(), bands: im.getSamplesPerPixel(), bits: im.getBitsPerSample(), overviews: n, nodata: im.getGDALNoData() });
  const k = im.getGeoKeys(); console.log(JSON.stringify(k).slice(0, 600));
}
