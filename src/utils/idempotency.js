// src/utils/idempotency.js
// Every request that can be saved offline and sent later carries its own id,
// so the server can recognise a repeat (a reply lost on a weak connection
// makes the phone send the same thing again) and keep only one copy.
// Used with the "_once" database functions (2026-10-20c_offline_safe_sending.sql).

const TTL_MS = 30 * 60 * 1000;
// Fields that are not part of what the user did, so they don't change its id.
const IGNORED = new Set(['storagePath', 'clientId', 'savedAt', 'reportDate', 'deliveredAt']);
const remembered = new Map(); // fingerprint -> { id, at }

/** A random version-4 UUID. */
export function newClientId() {
  const hex = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) id += '-';
    else if (i === 14) id += '4';
    else if (i === 19) id += hex[8 + Math.floor(Math.random() * 4)];
    else id += hex[Math.floor(Math.random() * 16)];
  }
  return id;
}

const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((key) => !IGNORED.has(key) && value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

/**
 * The id for this action. The same action (same kind and details) gets the
 * same id for 30 minutes, so a live attempt that loses its reply and the
 * queued copy saved right after it are recognised as one.
 */
export function clientIdFor(kind, payload) {
  const now = Date.now();
  for (const [key, entry] of remembered) {
    if (now - entry.at > TTL_MS) remembered.delete(key);
  }
  const fingerprint = `${kind}:${stable(payload)}`;
  const known = remembered.get(fingerprint);
  if (known) return known.id;
  const id = newClientId();
  remembered.set(fingerprint, { id, at: now });
  return id;
}
