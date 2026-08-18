// src/utils/base64.js
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decodes a base64 string into a Uint8Array with no external dependency.
 * React Native's fetch(uri).blob() on a local file:// URI is unreliable for
 * binary data — the actual root cause behind shipment photos uploading
 * "successfully" but the stored bytes being unreadable ("unknown image
 * format"). Reading the file as base64 (expo-file-system) and decoding it
 * here avoids that RN Blob bug entirely.
 */
export function base64ToUint8Array(base64) {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');

  const lookup = new Uint8Array(256);
  for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    lookup[BASE64_ALPHABET.charCodeAt(i)] = i;
  }

  let padding = 0;
  if (clean.endsWith('==')) padding = 2;
  else if (clean.endsWith('=')) padding = 1;

  const byteLength = (clean.length / 4) * 3 - padding;
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];

    const chunk = (a << 18) | (b << 12) | (c << 6) | d;

    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = chunk & 0xff;
  }

  return bytes;
}
