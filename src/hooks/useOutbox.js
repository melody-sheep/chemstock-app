// src/hooks/useOutbox.js
import { useSyncExternalStore, useCallback, useMemo } from 'react';
import outboxService from '../services/outboxService';

/**
 * Live view of the offline outbox, optionally filtered to one entry type.
 * `pending` is what's still trying to send; `failed` is what the server kept
 * rejecting and now waits for the user to Retry or Discard.
 * @param {string|null} type - e.g. 'daily_report'. Omit for every entry.
 * @returns {{ pending: Array, pendingCount: number, failed: Array, retryNow: Function, discard: Function }}
 */
export default function useOutbox(type = null) {
  const entries = useSyncExternalStore(outboxService.subscribeOutbox, outboxService.getEntries);

  const ofType = useMemo(
    () => (type ? entries.filter((e) => e.type === type) : entries),
    [entries, type]
  );
  const pending = useMemo(() => ofType.filter((e) => !e.failed), [ofType]);
  const failed = useMemo(() => ofType.filter((e) => e.failed), [ofType]);

  // A manual Retry also tries items the server rejected earlier, without
  // waiting out their retry delay.
  const retryNow = useCallback(() => outboxService.flush({ force: true }), []);
  const discard = useCallback((id) => outboxService.discard(id), []);

  return { pending, pendingCount: pending.length, failed, retryNow, discard };
}
