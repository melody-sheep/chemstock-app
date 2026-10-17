// src/hooks/useOutbox.js
import { useSyncExternalStore, useCallback, useMemo } from 'react';
import outboxService from '../services/outboxService';

/**
 * Live view of the offline outbox, optionally filtered to one entry type.
 * @param {string|null} type - e.g. 'daily_report'. Omit for every entry.
 * @returns {{ pending: Array, pendingCount: number, retryNow: Function }}
 */
export default function useOutbox(type = null) {
  const entries = useSyncExternalStore(outboxService.subscribeOutbox, outboxService.getEntries);

  const pending = useMemo(
    () => (type ? entries.filter((e) => e.type === type) : entries),
    [entries, type]
  );

  // A manual Retry also tries items the server rejected earlier, without
  // waiting out their retry delay.
  const retryNow = useCallback(() => outboxService.flush({ force: true }), []);

  return { pending, pendingCount: pending.length, retryNow };
}
