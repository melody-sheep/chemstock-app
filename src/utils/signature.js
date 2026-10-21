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
// so the PDF is exactly what it was before.
export function signatureToSvg(signature) {
  if (!signature || !signature.paths?.length) return '';
  const paths = signature.paths
    .map((d) => `<path d="${d}" fill="none" stroke="#272632" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${signature.width} ${signature.height}" style="display:block;width:150px;height:${Math.round((150 * signature.height) / signature.width)}px;">${paths}</svg>`;
}
