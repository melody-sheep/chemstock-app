// src/hooks/useCachedFocusLoader.js
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { debugLog } from '../utils/logger';

// Last successful result per screen, kept for the whole app session. It lives
// outside React state so it survives the screen unmounting and remounting.
const snapshots = new Map();

// A result this recent is reused as-is on a revisit, so tabbing between
// screens doesn't re-query the database every time.
const FRESH_MS = 30 * 1000;

/**
 * Loads a screen's data each time the screen comes into focus, but only shows
 * the loading skeleton when there is nothing to show yet. Coming back to a
 * screen paints the last result straight away and refreshes it quietly.
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
    const cached = snapshots.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < FRESH_MS) {
      debugLog('debug', 'Cache', 'Fresh, reused without a request', { screen: cacheKey });
      return;
    }

    // Skeleton only when there's no cached result yet — never on a revisit.
    if (!cached) setIsLoading(true);
    debugLog('info', 'Cache', cached ? 'Stale, refreshing in background' : 'No cache, loading', { screen: cacheKey });

    const startedAt = Date.now();
    try {
      const next = await loadRef.current(cached?.data ?? null);
      snapshots.set(cacheKey, { data: next, fetchedAt: Date.now() });
      setData(next);
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
