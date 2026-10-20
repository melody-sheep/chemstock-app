// src/utils/placeSearch.js
import { storage } from './storage';

const RECENT_PLACES_KEY = 'chemstock_recent_places';
const MAX_RECENT_PLACES = 30;
const ONLINE_TIMEOUT_MS = 6000;

// Search results are biased (not limited) to Cagayan de Oro / Misamis Oriental:
// left, top, right, bottom in degrees.
const REGION_VIEWBOX = '124.0,8.8,125.2,8.0';

/**
 * Looks a place up on OpenStreetMap (Nominatim) — knows schools, malls and
 * landmarks that the phone's own geocoder usually doesn't. Needs a connection:
 * throws when the request fails or times out, so the caller can fall back to
 * its offline sources. Resolves to [] when nothing matches.
 */
export async function searchPlacesOnline(query, limit = 5) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ONLINE_TIMEOUT_MS);
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0' +
      `&limit=${limit}&countrycodes=ph&viewbox=${REGION_VIEWBOX}&bounded=0` +
      `&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ChemStock-Mobile/1.0', 'Accept-Language': 'en' },
    });
    if (!response.ok) throw new Error(`Place search failed (${response.status})`);
    const rows = await response.json();
    return (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const parts = String(row.display_name || '').split(',').map((part) => part.trim());
        return {
          id: `osm-${row.place_id}`,
          name: row.name || parts[0] || query,
          detail: parts.slice(1, 4).join(', '),
          latitude: Number(row.lat),
          longitude: Number(row.lon),
        };
      })
      .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
  } finally {
    clearTimeout(timer);
  }
}

/** Places picked from search before, kept on the device so they work offline. */
export async function getRecentPlaces() {
  const saved = await storage.get(RECENT_PLACES_KEY);
  return Array.isArray(saved) ? saved : [];
}

export async function rememberPlace(place) {
  if (!place || !place.name || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return;
  const entry = {
    id: `recent-${place.name}-${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}`,
    name: place.name,
    detail: place.detail || '',
    latitude: place.latitude,
    longitude: place.longitude,
  };
  const saved = await getRecentPlaces();
  const next = [entry, ...saved.filter((item) => item.id !== entry.id)].slice(0, MAX_RECENT_PLACES);
  await storage.set(RECENT_PLACES_KEY, next);
}
