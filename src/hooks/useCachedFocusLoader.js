// src/hooks/useCachedFocusLoader.js
import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { debugLog } from '../utils/logger';
import storage from '../utils/storage';
import { getConnectionStatus } from '../services/connectionStatus';
import authService from '../services/authService';
import { setFocusedSavedAt, clearFocusedSavedAt } from '../utils/savedDataTime';
import { getDataVersion, subscribeDataVersion } from '../utils/dataVersion';

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

// Saved data is kept per account, so two users of one phone (e.g. two Sales
// Reps) each keep their own copy: switching accounts no longer leaves the
// next person offline with an empty screen, or shows them the last person's data.
const scopedKey = (cacheKey, userId) => `${cacheKey}:${userId || 'signed-out'}`;

const resolveUserId = async () => {
  const peeked = authService.peekCurrentUserId();
  if (peeked) return peeked;
  const savedUser = await authService.getSavedUser();
  return savedUser?.id ?? null;
};

// The account a snapshot belongs to. Each screen's loader stores it under one
// of these fields.
const ownerOf = (data) =>
  data?.user?.id ?? data?.agentId ?? data?.managerId ?? data?.agent?.id ?? data?.manager?.id ?? null;

// Builds up to 1.0.2 saved one shared copy per screen. Reused once, only if
// it belongs to the same account, so updating while offline isn't empty.
const readLegacySnapshot = async (cacheKey, userId) => {
  if (!userId) return null;
  const legacy = await storage.get(STORAGE_PREFIX + cacheKey);
  return legacy && ownerOf(legacy.data) === userId ? legacy : null;
};

/** A screen's saved data for the current account (memory, then disk), or null. */
export async function readSavedData(cacheKey) {
  const userId = await resolveUserId();
  const key = scopedKey(cacheKey, userId);
  const cached = snapshots.get(key) ?? (await storage.get(STORAGE_PREFIX + key));
  return cached?.data ?? null;
}

/**
 * Refreshes another screen's saved copy in the background, so screens the
 * user hasn't opened lately aren't left with old data (and an older
 * "as of" time) when the phone goes offline. Saves only a live result.
 */
export async function primeSavedData(cacheKey, load) {
  if (!getConnectionStatus().online) return;
  try {
    const userId = await resolveUserId();
    const key = scopedKey(cacheKey, userId);
    const cached = snapshots.get(key) ?? (await storage.get(STORAGE_PREFIX + key));
    const next = await load(cached?.data ?? null);
    if (!getConnectionStatus().online) return;
    const snapshot = { data: next, fetchedAt: Date.now() };
    snapshots.set(key, snapshot);
    storage.set(STORAGE_PREFIX + key, snapshot);
  } catch (error) {
    debugLog('warn', 'Cache', `[${cacheKey}] Background refresh failed`, { error: error.message });
  }
}

/**
 * Loads a screen's data each time the screen comes into focus, but only shows
 * the loading skeleton when there is nothing to show yet — not in memory and
 * not on disk. Coming back to a screen, or relaunching the app offline,
 * paints the last result straight away and refreshes it quietly once online.
 *
 * load(previous) must resolve to the complete data object. `previous` is the
 * last result (or null), so a request that fails can keep its old value.
 *
 * options.freshMs — how long a result is reused without a request (default
 * 30s). Pass 0 for a screen that must refetch every time it is opened.
 *
 * refresh({ force: true }) refetches now, ignoring the fresh window — for
 * pull-to-refresh and polling.
 *
 * savedAt is when the data shown was loaded from the server (null if none).
 * isUnavailable is true offline when nothing was saved yet, so the screen
 * can say so instead of showing an empty state as if there were no items.
 *
 * @returns {{ data: Object|null, isLoading: boolean, refresh: Function, savedAt: number|null, isUnavailable: boolean }}
 */
export default function useCachedFocusLoader(cacheKey, load, { freshMs = FRESH_MS } = {}) {
  const initialKey = scopedKey(cacheKey, authService.peekCurrentUserId());
  const [data, setData] = useState(() => snapshots.get(initialKey)?.data ?? null);
  const [isLoading, setIsLoading] = useState(() => !snapshots.has(initialKey));
  // When the data shown was loaded from the server, and whether there is no
  // real data at all (offline, nothing saved yet).
  const [savedAt, setSavedAt] = useState(() => snapshots.get(initialKey)?.fetchedAt ?? null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async ({ force = false } = {}) => {
    const userId = await resolveUserId();
    const key = scopedKey(cacheKey, userId);
    let cached = snapshots.get(key);

    // Nothing in memory yet — e.g. the app was just (re)launched. Check disk
    // before deciding whether to show a bare skeleton. This read is async,
    // so the very first frame still renders with isLoading=true from the
    // useState initializer above; this just shortens that to one frame
    // instead of waiting on a live request that might never arrive offline.
    if (!cached) {
      try {
        const stored = (await storage.get(STORAGE_PREFIX + key)) ?? (await readLegacySnapshot(cacheKey, userId));
        if (stored) {
          snapshots.set(key, stored);
          setData(stored.data);
          setIsLoading(false);
          cached = stored;
          debugLog('debug', 'Cache', `📀 [${cacheKey}] Hydrated from disk`, { online: getConnectionStatus().online });
        }
      } catch (error) {
        debugLog('error', 'Cache', `❌ [${cacheKey}] Disk hydration failed`, { error: error.message });
      }
    }

    if (cached) {
      // Also picks up a copy refreshed elsewhere (primeSavedData) while this
      // screen stayed mounted.
      setData(cached.data);
      setSavedAt(cached.fetchedAt);
      setIsUnavailable(false);
    }

    if (!force && cached && Date.now() - cached.fetchedAt < freshMs) {
      const { online } = getConnectionStatus();
      debugLog('debug', 'Cache', `${online ? '✅' : '✅ OFFLINE —'} [${cacheKey}] Reused without a request`, { online, ageMs: Date.now() - cached.fetchedAt });
      return;
    }

    // Skeleton only when there's no cached result yet (memory or disk) —
    // never on a revisit. Clearing data here also means nothing from another
    // account can stay on screen while this one loads.
    if (!cached) {
      setData(null);
      setIsLoading(true);
    }
    const { online: onlineBeforeLoad } = getConnectionStatus();
    debugLog('info', 'Cache', `${cached ? 'Stale, refreshing in background' : 'No cache, loading'} [${cacheKey}]`, { online: onlineBeforeLoad });

    const startedAt = Date.now();
    try {
      const next = await loadRef.current(cached?.data ?? null);
      const { online: onlineAfterLoad } = getConnectionStatus();
      if (!onlineAfterLoad && !cached) {
        // Every request failed and there was nothing saved: `next` is just
        // empty defaults, not real data. Show it, but don't save it as if it
        // were, and let the screen say it isn't saved yet instead of "none".
        setData(next);
        setIsUnavailable(true);
        setSavedAt(null);
        debugLog('warn', 'Cache', `❌ OFFLINE — [${cacheKey}] Nothing saved on this phone yet`, { ms: Date.now() - startedAt });
        return;
      }
      // Offline, load() can only hand back the previous data, so keep that
      // data's real load time; the Offline pill shows it ("as of 7:25 PM").
      const fetchedAt = onlineAfterLoad ? Date.now() : cached.fetchedAt;
      const snapshot = { data: next, fetchedAt };
      snapshots.set(key, snapshot);
      setData(next);
      setIsUnavailable(false);
      setSavedAt(fetchedAt);
      storage.set(STORAGE_PREFIX + key, snapshot); // fire-and-forget, non-blocking
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
        if (!online) setIsUnavailable(true);
        debugLog('error', 'Cache', `❌ [${cacheKey}] Refresh failed and there is no cached data to fall back to — screen will show empty/error state`, { online, error: error.message });
      }
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, freshMs]);

  // Something reached the server since this screen last loaded (a queued
  // item synced, a profile edit): refetch instead of reusing the saved copy,
  // and keep doing so while the screen stays open.
  const seenVersion = useRef(getDataVersion());
  useFocusEffect(
    useCallback(() => {
      const changed = seenVersion.current !== getDataVersion();
      seenVersion.current = getDataVersion();
      refresh({ force: changed });
      return subscribeDataVersion(() => {
        seenVersion.current = getDataVersion();
        refresh({ force: true });
      });
    }, [refresh])
  );

  // Tell the Offline pill how old this screen's data is while it's in front.
  useFocusEffect(
    useCallback(() => {
      setFocusedSavedAt(savedAt);
      return () => clearFocusedSavedAt(savedAt);
    }, [savedAt])
  );

  // Pull-to-refresh: a manual way to fetch now, next to the automatic
  // refreshes. Offline it just ends (the saved copy stays on screen).
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh({ force: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);
  const refreshControl = <RefreshControl refreshing={isRefreshing} onRefresh={pullToRefresh} colors={['#03045E']} tintColor="#03045E" />;

  return { data, isLoading, refresh, savedAt, isUnavailable, refreshControl };
}
