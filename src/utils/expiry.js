// src/utils/expiry.js
// Whether a batch is past its expiry date. Dates are compared as Philippine
// calendar days (the same rule release_stock_batch enforces on the server): a
// batch that expires today can still go out, one that expired yesterday can't.
import { formatDisplayDate } from './formatters';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export const manilaToday = () => new Date(Date.now() + MANILA_OFFSET_MS).toISOString().slice(0, 10);

/** The Philippine calendar day (YYYY-MM-DD) of a time, or null if it isn't a valid time. */
export function manilaDateOf(value) {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** @param {string|null|undefined} expDate 'YYYY-MM-DD' (or an ISO date-time) */
export function isExpired(expDate) {
  if (!expDate) return false;
  return String(expDate).slice(0, 10) < manilaToday();
}

/**
 * "Exp: 12/25/2026" for a receiving batch's printed/saved QR label — or
 * "Earliest Exp: ..." when the batch has more than one product and they
 * don't all expire on the same day, so the label never implies a single
 * date for stock that doesn't share one. Returns null when no item in the
 * batch has an expiry date.
 * @param {Array<{expDate?: string|null}>} items
 */
export function earliestExpiryLabel(items) {
  const dates = (items || []).map((item) => item.expDate).filter(Boolean);
  if (dates.length === 0) return null;
  const soonest = dates.reduce((soonestSoFar, candidate) => (new Date(candidate) < new Date(soonestSoFar) ? candidate : soonestSoFar));
  const isSingleDate = new Set(dates).size === 1;
  return `${isSingleDate ? 'Exp' : 'Earliest Exp'}: ${formatDisplayDate(soonest)}`;
}
