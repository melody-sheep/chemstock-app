// src/utils/dataVersion.js
// A shared "the server data changed" signal. Bumped when something this phone
// did has just reached the server (a queued item synced, a profile edit), so
// saved screen data refreshes right away instead of showing the old copy
// until the user logs out and back in. No imports, so services and hooks can
// both use it without circular imports.
let version = 0;
const listeners = new Set();
let timer = null;

export function getDataVersion() {
  return version;
}

/** Marks saved data as out of date. Several calls in a row are combined. */
export function invalidateSavedData() {
  version += 1;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    listeners.forEach((listener) => listener());
  }, 400);
}

export function subscribeDataVersion(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
