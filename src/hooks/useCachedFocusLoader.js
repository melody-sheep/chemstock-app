// src/hooks/useCachedFocusLoader.js
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { debugLog } from '../utils/logger';
import storage from '../utils/storage';

// Last successful result per screen, kept for the whole app session. It lives
// outside React state so it survives the screen unmounting and remounting.
// This in-memory copy alone doesn't survive an app restart — see
// STORAGE_PREFIX below for the part that does.
const snapshots = new Map();

// A result this recent is reused as-is on a revisit, so tabbing between
// screens doesn't re-query the database every time.
const FRESH_MS = 30 * 1000;

// Every successful load is also written here (AsyncStorage, same wrapper
// AGENT_SESSION_KEY already uses), so a cold app launch with no network can
// still paint the last-known data instead of a stuck skeleton. Tier 1/2 of
// the PM's offline tiers — see Alther_TODO_October.md.
const STORAGE_PREFIX = 'chemstock_cache_';

/**
 * Loads a screen's data each time the screen comes into focus, but only shows
 * the loading skeleton when there is nothing to show yet — not in memory and
 * not on disk. Coming back to a screen, or relaunching the app offline,
 * paints the last result straight away and refreshes it quietly once online.
 *
 * load(previous) must resolve to the complete data object. `previous` is the
 * last result (or null), so a request that fails can keep its old value.
 *
 * @returns {{ data: Object|null, isLoading: boolean }}
 */
export default function useCachedFocusLoader(cacheKey, load) {
  const [data, setData] = useState(() => snapshots.get(cacheKey)?.data ?? null);
  const [isLoading, setIsLoading] = useState(() => !snapshots.has(cacheKey));
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    let cached = snapshots.get(cacheKey);

    // Nothing in memory yet — e.g. the app was just (re)launched. Check disk
    // before deciding whether to show a bare skeleton. This read is async,
    // so the very first frame still renders with isLoading=true from the
    // useState initializer above; this just shortens that to one frame
    // instead of waiting on a live request that might never arrive offline.
    if (!cached) {
      try {
        const stored = await storage.get(STORAGE_PREFIX + cacheKey);
        if (stored) {
          snapshots.set(cacheKey, stored);
          setData(stored.data);
          setIsLoading(false);
          cached = stored;
          debugLog('debug', 'Cache', 'Hydrated from disk', { screen: cacheKey });
        }
      } catch (error) {
        debugLog('error', 'Cache', 'Disk hydration failed', { screen: cacheKey, error: error.message });
      }
    }

    if (cached && Date.now() - cached.fetchedAt < FRESH_MS) {
      debugLog('debug', 'Cache', 'Fresh, reused without a request', { screen: cacheKey });
      return;
    }

    // Skeleton only when there's no cached result yet (memory or disk) —
    // never on a revisit.
    if (!cached) setIsLoading(true);
    debugLog('info', 'Cache', cached ? 'Stale, refreshing in background' : 'No cache, loading', { screen: cacheKey });

    const startedAt = Date.now();
    try {
      const next = await loadRef.current(cached?.data ?? null);
      const snapshot = { data: next, fetchedAt: Date.now() };
      snapshots.set(cacheKey, snapshot);
      setData(next);
      storage.set(STORAGE_PREFIX + cacheKey, snapshot); // fire-and-forget, non-blocking
      debugLog('info', 'Cache', 'Loaded', { screen: cacheKey, ms: Date.now() - startedAt });
    } catch (error) {
      debugLog('error', 'Cache', 'Refresh failed', { screen: cacheKey, error: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { data, isLoading };
}
