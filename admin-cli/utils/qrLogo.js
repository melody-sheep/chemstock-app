// admin-cli/utils/qrLogo.js
// A QR code with the ChemStock bird in the middle. The code is made with the
// highest error correction (30% can be hidden and it still scans) and the logo
// covers only the centre ~22% of its width, so it scans like a plain one.
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { PNG } = require('pngjs');

const LOGO_PATH = path.join(__dirname, '..', 'web-ui', 'assets', 'logo.png');
const SIZE = 480;
const LOGO_SHARE = 0.22; // width of the white tile, as a share of the QR
const LOGO_INSET = 0.8; // the bird's width inside that tile
const TILE_RADIUS = 10;

let logo = null;
const loadLogo = () => {
  if (!logo) logo = PNG.sync.read(fs.readFileSync(LOGO_PATH));
  return logo;
};

function sample(img, x, y) {
  const x0 = Math.max(0, Math.min(img.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(img.height - 1, Math.floor(y)));
  const x1 = Math.min(img.width - 1, x0 + 1);
  const y1 = Math.min(img.height - 1, y0 + 1);
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const px = (xx, yy) => {
    const i = (yy * img.width + xx) * 4;
    const a = img.data[i + 3] / 255;
    return [img.data[i] * a, img.data[i + 1] * a, img.data[i + 2] * a, a]; // premultiplied
  };
  const out = [0, 0, 0, 0];
  [[px(x0, y0), (1 - fx) * (1 - fy)], [px(x1, y0), fx * (1 - fy)], [px(x0, y1), (1 - fx) * fy], [px(x1, y1), fx * fy]].forEach(([p, w]) => {
    for (let k = 0; k < 4; k += 1) out[k] += p[k] * w;
  });
  return out;
}

/** @returns {Promise<string>} a PNG data URL of the code with the logo in the middle */
async function qrWithLogo(text) {
  const plain = await QRCode.toBuffer(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: SIZE,
    color: { dark: '#03045E', light: '#FFFFFF' },
  });
  const qr = PNG.sync.read(plain);
  const mark = loadLogo();

  const tile = Math.round(qr.width * LOGO_SHARE);
  const tx = Math.round((qr.width - tile) / 2);
  const ty = Math.round((qr.height - tile) / 2);
  const bird = tile * LOGO_INSET;
  const scale = bird / Math.max(mark.width, mark.height);
  const bw = mark.width * scale;
  const bh = mark.height * scale;
  const bx = tx + (tile - bw) / 2;
  const by = ty + (tile - bh) / 2;

  for (let y = 0; y < tile; y += 1) {
    for (let x = 0; x < tile; x += 1) {
      // white rounded tile
      const rx = Math.min(x + 0.5, tile - x - 0.5);
      const ry = Math.min(y + 0.5, tile - y - 0.5);
      let cover = 1;
      if (rx < TILE_RADIUS && ry < TILE_RADIUS) {
        cover = Math.min(1, Math.max(0, TILE_RADIUS - Math.hypot(TILE_RADIUS - rx, TILE_RADIUS - ry) + 0.5));
      }
      let r = 255 * cover;
      let g = 255 * cover;
      let b = 255 * cover;
      const i = ((ty + y) * qr.width + (tx + x)) * 4;
      // the bird over the tile
      const lx = (tx + x + 0.5 - bx) / scale;
      const ly = (ty + y + 0.5 - by) / scale;
      if (lx >= 0 && ly >= 0 && lx < mark.width && ly < mark.height) {
        const [pr, pg, pb, pa] = sample(mark, lx, ly);
        r = pr + r * (1 - pa);
        g = pg + g * (1 - pa);
        b = pb + b * (1 - pa);
      }
      // blend the tile over the QR pixels (the corners stay QR)
      qr.data[i] = Math.round(r + qr.data[i] * (1 - cover));
      qr.data[i + 1] = Math.round(g + qr.data[i + 1] * (1 - cover));
      qr.data[i + 2] = Math.round(b + qr.data[i + 2] * (1 - cover));
      qr.data[i + 3] = 255;
    }
  }
  return `data:image/png;base64,${PNG.sync.write(qr).toString('base64')}`;
}

module.exports = { qrWithLogo };
