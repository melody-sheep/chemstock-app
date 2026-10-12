// src/utils/quickLocation.js
import * as Location from 'expo-location';

// A last-known fix newer than this is used as-is, with no GPS wait.
const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000;

const toCoords = (position) =>
  position?.coords
    ? { latitude: position.coords.latitude, longitude: position.coords.longitude }
    : null;

/**
 * The device's position without an open-ended wait. A bare
 * getCurrentPositionAsync() can take 15–30s indoors, and a button that awaits
 * it looks frozen. This returns the last known fix when it is recent, and
 * otherwise waits for a fresh one only up to `timeoutMs`.
 *
 * The caller asks for location permission first. Resolves to null when no
 * fix arrives in time; it never throws.
 *
 * @param {{ timeoutMs?: number }} options
 * @returns {Promise<{ latitude: number, longitude: number } | null>}
 */
export async function getQuickPosition({ timeoutMs = 4000 } = {}) {
  try {
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    if (lastKnown) return toCoords(lastKnown);
  } catch (error) {
    // No last-known fix available; fall through to a fresh one.
  }

  try {
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return toCoords(fresh);
  } catch (error) {
    return null;
  }
}

/**
 * For an action that must send coordinates (the trip-start and checkpoint
 * tables both store latitude/longitude as NOT NULL). Tries the fast paths
 * first, then an older last-known fix, then waits a little longer for a
 * fresh one. Typically returns in well under a second; the worst case is
 * about 15s. Resolves to null only when the device has no position at all —
 * the caller must then stop and tell the user, not send nulls.
 *
 * @returns {Promise<{ latitude: number, longitude: number } | null>}
 */
export async function getRequiredPosition() {
  const quick = await getQuickPosition({ timeoutMs: 5000 });
  if (quick) return quick;

  try {
    const anyAge = await Location.getLastKnownPositionAsync();
    if (anyAge) return toCoords(anyAge);
  } catch (error) {
    // Fall through to one longer wait.
  }

  try {
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((resolve) => setTimeout(() => resolve(null), 10000)),
    ]);
    return toCoords(fresh);
  } catch (error) {
    return null;
  }
}

export default getQuickPosition;
