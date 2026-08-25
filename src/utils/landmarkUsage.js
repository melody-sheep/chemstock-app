// src/utils/landmarkUsage.js
import { storage } from './storage';

const LANDMARK_USAGE_KEY = 'chemstock_landmark_usage_counts';

/**
 * Tracks how often a Collector types each landmark label when logging a
 * delivery checkpoint, purely on-device (AsyncStorage via the shared
 * storage wrapper) — powers the checkpoint modal's suggestion list without
 * a geocoding API, same idiom as utils/productUsage.js.
 */
export async function recordLandmarkUsage(label) {
  const trimmed = (label || '').trim();
  if (!trimmed) return;

  const counts = (await storage.get(LANDMARK_USAGE_KEY)) || {};
  counts[trimmed] = (counts[trimmed] || 0) + 1;
  await storage.set(LANDMARK_USAGE_KEY, counts);
}

/**
 * Landmark labels ordered most- to least-frequently used, capped at `limit`.
 */
export async function getFrequentLandmarks(limit = 6) {
  const counts = (await storage.get(LANDMARK_USAGE_KEY)) || {};
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}
