// src/utils/signaturePng.js
// Turns the manager's drawn signature into a small transparent PNG, for the
// Excel report. The PDF draws the same strokes as an inline SVG, but a
// spreadsheet needs a normal picture. No library: the strokes (simple
// "M x y L x y ..." lines, see SignaturePad) are drawn pixel by pixel with
// smooth edges, then written as a PNG with uncompressed data blocks.
import { crc32, toBase64 } from './xlsx';

const INK = 0x27; // grey of the pen, the same #272632 as the PDF (grey + alpha PNG)
const PEN_WIDTH = 2.2; // in signature units, as in signatureToSvg
const PAD = 3; // crop padding in signature units, as in signatureToSvg

const adler32 = (bytes) => {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
};

// zlib stream made of "stored" (uncompressed) deflate blocks.
const zlibStored = (raw) => {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const out = new Uint8Array(2 + blocks * 5 + raw.length + 4);
  let o = 0;
  out[o++] = 0x78;
  out[o++] = 0x01;
  for (let pos = 0, n = 0; n < blocks; n += 1, pos += 65535) {
    const len = Math.min(65535, raw.length - pos);
    out[o++] = n === blocks - 1 ? 1 : 0;
    out[o++] = len & 255;
    out[o++] = (len >> 8) & 255;
    out[o++] = ~len & 255;
    out[o++] = (~len >> 8) & 255;
    out.set(raw.subarray(pos, pos + len), o);
    o += len;
  }
  const sum = adler32(raw);
  out[o++] = (sum >>> 24) & 255;
  out[o++] = (sum >>> 16) & 255;
  out[o++] = (sum >>> 8) & 255;
  out[o++] = sum & 255;
  return out;
};

const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

const chunk = (type, data) => {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i += 1) body[i] = type.charCodeAt(i);
  body.set(data, 4);
  return Uint8Array.from([...u32(data.length), ...body, ...u32(crc32(body))]);
};

// 8-bit grey + alpha PNG (colour type 4). `alpha` is width*height values 0-255.
const encodePng = (width, height, alpha) => {
  const raw = new Uint8Array(height * (1 + width * 2));
  let o = 0;
  for (let y = 0; y < height; y += 1) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      raw[o++] = INK;
      raw[o++] = alpha[y * width + x];
    }
  }
  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', Uint8Array.from([...u32(width), ...u32(height), 8, 4, 0, 0, 0])),
    chunk('IDAT', zlibStored(raw)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let pos = 0;
  parts.forEach((p) => {
    out.set(p, pos);
    pos += p.length;
  });
  return out;
};

const parseStroke = (d) => {
  const nums = (String(d).match(/-?\d+(\.\d+)?/g) || []).map(Number);
  const points = [];
  for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
  return points;
};

/**
 * @param signature { width, height, paths: string[] } as saved by SignaturePad
 * @returns { base64, widthPx, heightPx } - the PNG (cropped to the ink) and the size
 *          it should be shown at, or null when there is no signature.
 */
export function signatureToPng(signature, { maxWidth = 150, maxHeight = 44, scale = 3 } = {}) {
  if (!signature || !Array.isArray(signature.paths) || signature.paths.length === 0) return null;
  const strokes = signature.paths.map(parseStroke).filter((points) => points.length > 0);
  if (strokes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  strokes.forEach((points) =>
    points.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    })
  );
  if (!Number.isFinite(minX)) return null;

  const w = Math.max(maxX - minX + PAD * 2, 8);
  const h = Math.max(maxY - minY + PAD * 2, 8);
  const fit = Math.min(maxWidth / w, maxHeight / h);
  const widthPx = Math.max(1, Math.round(w * fit));
  const heightPx = Math.max(1, Math.round(h * fit));
  const width = widthPx * scale;
  const height = heightPx * scale;
  const unit = width / w; // image pixels per signature unit
  const radius = (PEN_WIDTH / 2) * unit;
  const ox = minX - PAD;
  const oy = minY - PAD;
  const coverage = new Float32Array(width * height);

  // Round caps and joins = every pixel within `radius` of the line counts as ink.
  const paint = (ax, ay, bx, by) => {
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - radius - 1));
    const x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx) + radius + 1));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - radius - 1));
    const y1 = Math.min(height - 1, Math.ceil(Math.max(ay, by) + radius + 1));
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
        const dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
        const a = Math.max(0, Math.min(1, radius + 0.5 - dist));
        const i = y * width + x;
        if (a > coverage[i]) coverage[i] = a;
      }
    }
  };

  strokes.forEach((points) => {
    const scaled = points.map(([x, y]) => [(x - ox) * unit, (y - oy) * unit]);
    if (scaled.length === 1) paint(scaled[0][0], scaled[0][1], scaled[0][0], scaled[0][1]);
    for (let i = 0; i + 1 < scaled.length; i += 1) paint(scaled[i][0], scaled[i][1], scaled[i + 1][0], scaled[i + 1][1]);
  });

  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = Math.round(coverage[i] * 255);

  return { base64: toBase64(encodePng(width, height, alpha)), widthPx, heightPx };
}
