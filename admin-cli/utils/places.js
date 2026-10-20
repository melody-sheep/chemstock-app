// admin-cli/utils/places.js
// Location search for branches, through OpenStreetMap's free Nominatim
// service (Philippines only). Their usage policy allows at most one request
// per second with an identifying User-Agent, so requests are spaced out and
// results are cached for the session.

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'ChemStockAdmin/2.0 (capstone inventory admin tool)';
const MIN_GAP_MS = 1100;

const cache = new Map();
let lastRequestAt = 0;
let queue = Promise.resolve();

function toPlace(item) {
  const a = item.address || {};
  const city = a.city || a.town || a.municipality || a.village || a.suburb || a.county || '';
  const region = a.state || a.region || a.province || '';
  return {
    label: item.display_name,
    name: item.name || city || item.display_name.split(',')[0],
    city,
    region,
    address: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  };
}

function search(query) {
  const q = String(query || '').trim();
  if (q.length < 3) return Promise.resolve([]);
  const key = q.toLowerCase();
  if (cache.has(key)) return Promise.resolve(cache.get(key));

  // One at a time, at least MIN_GAP_MS apart.
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    const url = `${ENDPOINT}?format=jsonv2&addressdetails=1&countrycodes=ph&limit=6&q=${encodeURIComponent(q)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' }, signal: controller.signal });
      if (!response.ok) throw new Error(`Location search failed (${response.status})`);
      const places = (await response.json()).map(toPlace);
      cache.set(key, places);
      return places;
    } finally {
      clearTimeout(timer);
    }
  });
  queue = run.catch(() => {});
  return run;
}

module.exports = { search };
