// src/hooks/useCachedFocusLoader.js
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { debugLog } from '../utils/logger';
import storage from '../utils/storage';
import { getConnectionStatus } from '../services/connectionStatus';

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
          debugLog('debug', 'Cache', `📀 [${cacheKey}] Hydrated from disk`, { online: getConnectionStatus().online });
        }
      } catch (error) {
        debugLog('error', 'Cache', `❌ [${cacheKey}] Disk hydration failed`, { error: error.message });
      }
    }

    if (cached && Date.now() - cached.fetchedAt < FRESH_MS) {
      const { online } = getConnectionStatus();
      debugLog('debug', 'Cache', `${online ? '✅' : '✅ OFFLINE —'} [${cacheKey}] Reused without a request`, { online, ageMs: Date.now() - cached.fetchedAt });
      return;
    }

    // Skeleton only when there's no cached result yet (memory or disk) —
    // never on a revisit.
    if (!cached) setIsLoading(true);
    const { online: onlineBeforeLoad } = getConnectionStatus();
    debugLog('info', 'Cache', `${cached ? 'Stale, refreshing in background' : 'No cache, loading'} [${cacheKey}]`, { online: onlineBeforeLoad });

    const startedAt = Date.now();
    try {
      const next = await loadRef.current(cached?.data ?? null);
      const snapshot = { data: next, fetchedAt: Date.now() };
      snapshots.set(cacheKey, snapshot);
      setData(next);
      storage.set(STORAGE_PREFIX + cacheKey, snapshot); // fire-and-forget, non-blocking
      const { online: onlineAfterLoad } = getConnectionStatus();
      if (onlineAfterLoad) {
        debugLog('info', 'Cache', `✅ [${cacheKey}] Loaded live data from server`, { ms: Date.now() - startedAt });
      } else {
        // The connection is down, yet loadRef.current() still resolved —
        // this only happens because the screen's own load() function caught
        // its failed fetch(es) internally and fell back to the previous
        // snapshot it was handed. In other words: confirmed successful
        // offline degradation, not a fluke.
        debugLog('warn', 'Cache', `✅ OFFLINE — [${cacheKey}] Live refresh failed as expected, screen is showing cached data`, { ms: Date.now() - startedAt, hadPreviousSnapshot: !!cached });
      }
    } catch (error) {
      const { online } = getConnectionStatus();
      if (cached) {
        debugLog('warn', 'Cache', `⚠️ [${cacheKey}] Refresh failed, kept last-known cached data on screen`, { online, error: error.message });
      } else {
        debugLog('error', 'Cache', `❌ [${cacheKey}] Refresh failed and there is no cached data to fall back to — screen will show empty/error state`, { online, error: error.message });
      }
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
