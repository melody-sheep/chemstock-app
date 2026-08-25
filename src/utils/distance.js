// src/utils/distance.js

const EARTH_RADIUS_METERS = 6371000;

/**
 * Straight-line (haversine) distance in meters between two lat/long points.
 * Used only for advisory UI (the Collector's "how far is this stop"
 * display and the Finish-Delivery proximity hint) — never a server-side
 * gate, so a rough approximation is fine here.
 */
export function distanceInMeters(from, to) {
  if (!from || !to) return null;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * "450m" under 1km, "12.3km" at or above — matches the mockup's distance
 * pills ("20km", "10km").
 */
export function formatDistance(meters) {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
