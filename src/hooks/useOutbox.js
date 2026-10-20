// src/hooks/useOutbox.js
import { useSyncExternalStore, useCallback, useMemo } from 'react';
import outboxService, { ownerOf } from '../services/outboxService';
import authService from '../services/authService';

/**
 * Live view of the offline outbox, optionally filtered to one entry type.
 * `pending` is what's still trying to send; `failed` is what the server kept
 * rejecting and now waits for the user to Retry or Discard.
 * @param {string|null} type - e.g. 'daily_report'. Omit for every entry.
 * @param {string|null} [agentId] - only this account's entries (one phone can
 *   hold several accounts' items). null while the account is loading = none.
 *   Omit for the logged-in account.
 * @returns {{ pending: Array, pendingCount: number, failed: Array, retryNow: Function, discard: Function }}
 */
export default function useOutbox(type = null, agentId) {
  const entries = useSyncExternalStore(outboxService.subscribeOutbox, outboxService.getEntries);

  const owner = agentId === undefined ? authService.peekCurrentUserId() : agentId;
  const ofType = useMemo(
    () => entries.filter((e) => (!type || e.type === type) && owner && ownerOf(e) === owner),
    [entries, type, owner]
  );
  const pending = useMemo(() => ofType.filter((e) => !e.failed), [ofType]);
  const failed = useMemo(() => ofType.filter((e) => e.failed), [ofType]);

  // A manual Retry also tries items the server rejected earlier, without
  // waiting out their retry delay.
  const retryNow = useCallback(() => outboxService.flush({ force: true }), []);
  const discard = useCallback((id) => outboxService.discard(id), []);

  return { pending, pendingCount: pending.length, failed, retryNow, discard };
}
