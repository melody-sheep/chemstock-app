// src/utils/productUsage.js
import { storage } from './storage';

const PRODUCT_USAGE_KEY = 'chemstock_product_usage_counts';

/**
 * Tracks how often each product code gets added to a batch, purely on-device
 * (AsyncStorage via the shared storage wrapper) — powers the "Frequently
 * Added" quick-pick row on Add New Batches. No server round-trip needed
 * since this is just a per-manager, per-device UX shortcut, not shared data.
 */
export async function recordProductUsage(code) {
  const counts = (await storage.get(PRODUCT_USAGE_KEY)) || {};
  counts[code] = (counts[code] || 0) + 1;
  await storage.set(PRODUCT_USAGE_KEY, counts);
}

/**
 * Product codes ordered most- to least-frequently added, capped at `limit`.
 */
export async function getFrequentProductCodes(limit = 6) {
  const counts = (await storage.get(PRODUCT_USAGE_KEY)) || {};
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code]) => code);
}
