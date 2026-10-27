// src/utils/signature.js
import storage from './storage';

// The manager's drawn signature, kept only on this phone (never uploaded). One per manager account.
const KEY_PREFIX = 'chemstock_signature:';

export async function getSignature(managerId) {
  if (!managerId) return null;
  const saved = await storage.get(`${KEY_PREFIX}${managerId}`);
  return saved && Array.isArray(saved.paths) && saved.paths.length > 0 ? saved : null;
}

export async function saveSignature(managerId, signature) {
  if (!managerId) return;
  await storage.set(`${KEY_PREFIX}${managerId}`, signature);
}

export async function clearSignature(managerId) {
  if (!managerId) return;
  await storage.remove(`${KEY_PREFIX}${managerId}`);
}

// The signature as an inline SVG for the printed report. Empty string when there is none,
// so the PDF is exactly what it was before. The drawing is cropped to the ink, so the pen strokes sit
// directly on the line above the manager's name instead of floating above empty pad space.
const boundsOf = (paths) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  paths.forEach((d) => {
    const numbers = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      minX = Math.min(minX, numbers[i]);
      maxX = Math.max(maxX, numbers[i]);
      minY = Math.min(minY, numbers[i + 1]);
      maxY = Math.max(maxY, numbers[i + 1]);
    }
  });
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
};

export function signatureToSvg(signature) {
  if (!signature || !signature.paths?.length) return '';
  const paths = signature.paths
    .map((d) => `<path d="${d}" fill="none" stroke="#272632" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('');
  const box = boundsOf(signature.paths);
  const pad = 3;
  const x = box ? box.minX - pad : 0;
  const y = box ? box.minY - pad : 0;
  const w = box ? Math.max(box.maxX - box.minX + pad * 2, 8) : signature.width;
  const h = box ? Math.max(box.maxY - box.minY + pad * 2, 8) : signature.height;
  // At most 150 px wide and 46 px tall, whichever limit is reached first.
  const scale = Math.min(150 / w, 46 / h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" style="display:block;margin:0 0 -2px 0;width:${Math.round(w * scale)}px;height:${Math.round(h * scale)}px;">${paths}</svg>`;
}
