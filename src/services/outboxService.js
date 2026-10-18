// src/services/outboxService.js
// A persisted, single-writer-safe retry queue for submit actions that
// happen while offline. Each entry replays the exact same service calls the
// screen would have made live — the outbox never talks to Supabase
// directly, so no new tables/RPCs are needed for this. See
// capstone_docs/MD Folder/Jay_Sprint1.1.md §65 for the full design this
// implements.
//
// daily_report and discrepancy_resolution are wired up so far (the PM's
// explicit ask — see Alther_TODO_October.md's "PM Priority Check-In"
// section, item C — plus the same shape reused for return requests).
// Stock-request submission is next, same pattern. Collector trip
// start/finish is deliberately not scoped here yet (see the TODO's open
// GPS-checkpoint conflict for Alther to resolve first).
import * as FileSystem from 'expo-file-system/legacy';
import storage from '../utils/storage';
import { getConnectionStatus, subscribeConnectionStatus } from './connectionStatus';
import { debugLog } from '../utils/logger';
import reportService from './reportService';
import inventoryService from './inventoryService';
import requestService from './requestService';
import deliveryService from './deliveryService';

const OUTBOX_KEY = 'chemstock_offline_outbox';
const PENDING_PHOTO_DIR = `${FileSystem.documentDirectory}pending-outbox/`;
const FLUSH_INTERVAL_MS = 45 * 1000;

let entries = [];
let loaded = false;
let loadingPromise = null;
let flushing = false;
let intervalHandle = null;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener());

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureLoaded() {
  if (loaded) return;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      entries = (await storage.get(OUTBOX_KEY)) || [];
      loaded = true;
    })();
  }
  await loadingPromise;
}

function syncIntervalState() {
  // Only items still trying need the timer; failed ones wait for the user.
  const hasActive = entries.some((e) => !e.failed);
  if (hasActive && !intervalHandle) {
    // Safety net for reconnecting while idle on a screen that doesn't
    // naturally trigger a request of its own — the connectionStatus
    // subscription below handles the common case.
    intervalHandle = setInterval(() => flush(), FLUSH_INTERVAL_MS);
  } else if (!hasActive && intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

async function persist() {
  await storage.set(OUTBOX_KEY, entries);
  syncIntervalState();
  notify();
}

async function ensurePendingDir() {
  try {
    const info = await FileSystem.getInfoAsync(PENDING_PHOTO_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(PENDING_PHOTO_DIR, { intermediates: true });
    }
  } catch (error) {
    debugLog('error', 'Outbox', 'Failed to prepare pending-outbox directory', { error: error.message });
  }
}

/**
 * Uploads an entry's photo the first time only. The storage path is saved on
 * the entry before the submit call, so a retry after a failed submit reuses
 * the uploaded photo instead of uploading a new copy each time.
 */
async function uploadOnce(entry, upload) {
  if (entry.uploadedPath) return entry.uploadedPath;
  const path = await upload();
  entry.uploadedPath = path;
  entries = entries.map((e) => (e.id === entry.id ? { ...e, uploadedPath: path } : e));
  await persist();
  return path;
}

/**
 * Each entry `type` maps to an executor that replays the real service calls
 * a screen would have made live. An executor must throw on any failure;
 * flush() then tells a network failure (app went offline) from a server
 * rejection (still online) by the connection status.
 */
const EXECUTORS = {
  daily_report: async (entry) => {
    if (!entry.localPhotoUri) {
      throw new Error('Missing handover photo for queued report');
    }
    const storagePath = await uploadOnce(entry, () =>
      reportService.uploadDailyReportPhoto(entry.localPhotoUri, entry.payload.agentId)
    );
    const result = await reportService.submitDailyReport({ ...entry.payload, storagePath });
    if (!result.success) {
      throw new Error(result.message || 'Failed to submit queued report');
    }
    return result;
  },

  discrepancy_resolution: async (entry) => {
    if (!entry.localPhotoUri) {
      throw new Error('Missing photo proof for queued return request');
    }
    const storagePath = await uploadOnce(entry, () =>
      inventoryService.uploadDiscrepancyPhoto(entry.localPhotoUri, entry.payload.agentId)
    );
    const result = await reportService.requestDiscrepancyResolution({ ...entry.payload, storagePath });
    if (!result.success) {
      throw new Error(result.message || 'Failed to submit queued return request');
    }
    return result;
  },

  // Only the final confirmation step — the QR scan + lookup that produced
  // this payload always happened live first (a QR code has no data of its
  // own, so the lookup itself can never be queued). This just replays the
  // "Accept" tap: upload the handover photo, then confirm receipt.
  receive_stock: async (entry) => {
    if (!entry.localPhotoUri) {
      throw new Error('Missing photo proof for queued stock receipt');
    }
    const storagePath = await uploadOnce(entry, () =>
      inventoryService.uploadStockAcceptancePhoto(entry.localPhotoUri, entry.payload.agentId)
    );
    const result = await inventoryService.acceptStockRelease({ ...entry.payload, storagePath });
    if (!result.success) {
      throw new Error(result.message || 'Failed to confirm queued stock receipt');
    }
    return result;
  },

  // No photo involved — just a payload replayed straight through the RPC.
  stock_request: async (entry) => {
    const result = await requestService.submitStockRequest(entry.payload);
    if (!result.success) {
      throw new Error(result.message || 'Failed to submit queued stock request');
    }
    return result;
  },

  // A manual, one-shot event (Collector taps a landmark label) — not
  // continuous tracking — confirmed safe to queue once capturedAt (not the
  // sync time) was wired through, see 2026-10-08_delivery_checkpoint_*.sql.
  delivery_checkpoint: async (entry) => {
    const result = await deliveryService.logDeliveryCheckpoint(entry.payload);
    if (!result.success) {
      throw new Error(result.message || 'Failed to submit queued checkpoint');
    }
    return result;
  },

  // "Mark delivered" — matches the PM's Discord list almost verbatim
  // ("only after the initial QR scan/lookup already happened online"): by
  // the time this screen exists, the transaction/leg already has a real
  // server id, so queuing just the status flip is safe. startDeliveryTrip
  // is deliberately NOT given an executor — it navigates into a screen
  // that needs a server-generated tripId, which doesn't exist until the
  // call actually runs. Queuing that would strand the Collector on a
  // screen with nothing to show. Not on the PM's list either.
  finish_delivery_leg: async (entry) => {
    const result = await deliveryService.finishDeliveryLeg(entry.payload);
    if (!result.success) {
      throw new Error(result.message || 'Failed to submit queued delivery confirmation');
    }
    return result;
  },

  // SR-side handoff confirmation, queued while offline. Server-side
  // (confirm_delivery_handoff RPC) rejects if the collector's
  // finish_delivery_leg hasn't yet landed — the outbox naturally retries
  // on the next flush until both events have synced. See "wait-for-
  // collector-sync" design decision.
  confirm_delivery_handoff: async (entry) => {
    if (!entry.localPhotoUri) {
      throw new Error('Missing photo proof for queued handoff confirmation');
    }
    if (!entry.payload?.scannedQrCode) {
      throw new Error('Missing scanned QR for queued handoff confirmation');
    }
    const storagePath = await uploadOnce(entry, () =>
      inventoryService.uploadStockAcceptancePhoto(entry.localPhotoUri, entry.payload.agentId)
    );
    const result = await inventoryService.confirmDeliveryHandoff({ ...entry.payload, storagePath });
    if (!result.success) {
      throw new Error(result.message || 'Failed to confirm queued handoff');
    }
    return result;
  },
};

/** Lets a screen register an executor for a new entry type later. */
export function registerExecutor(type, executor) {
  EXECUTORS[type] = executor;
}

/**
 * Queues an action for later. `photoUri` (if given) is copied out of the OS
 * cache directory into stable app storage right away, since a queued item
 * might sit around a while and the camera's own URI isn't guaranteed to
 * survive that.
 */
// `display` is an optional on-phone copy for showing the item before it syncs
// (e.g. what was received); it is never sent to the server.
export async function enqueue(type, payload, photoUri = null, display = null) {
  await ensureLoaded();

  const id = makeId();
  let localPhotoUri = null;

  if (photoUri) {
    await ensurePendingDir();
    const destination = `${PENDING_PHOTO_DIR}${id}.jpg`;
    try {
      await FileSystem.copyAsync({ from: photoUri, to: destination });
      localPhotoUri = destination;
    } catch (error) {
      debugLog('error', 'Outbox', 'Failed to persist queued photo, keeping original URI', { error: error.message });
      localPhotoUri = photoUri; // best-effort fallback, may not survive a long queue wait
    }
  }

  const entry = {
    id,
    type,
    payload,
    display,
    localPhotoUri,
    createdAt: Date.now(),
    lastAttemptAt: null,
    lastError: null,
    attempts: 0,
  };

  entries = [...entries, entry];
  await persist();
  debugLog('info', 'Queue', `enqueued ${type}`, { id, photo: Boolean(localPhotoUri) });

  // In case we're actually back online already (e.g. the triggering
  // failure was momentary), try right away rather than waiting for the
  // next connectivity change or the interval.
  flush();

  return entry;
}

async function removeEntry(id) {
  entries = entries.filter((e) => e.id !== id);
  await persist();
}

/** Removes an item the user chose to discard, with its saved photo. */
export async function discard(id) {
  await ensureLoaded();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  if (entry.localPhotoUri) {
    FileSystem.deleteAsync(entry.localPhotoUri, { idempotent: true }).catch(() => {});
  }
  await removeEntry(id);
  debugLog('info', 'Queue', `discarded ${entry.type}`, { id, rejections: entry.rejections || 0, reason: entry.lastError });
}

// An entry the server rejected (while online) waits this long before its next
// try, growing with each rejection, instead of retrying every 45 s forever.
// Retry on screen (retryNow) skips the wait.
const REJECTED_RETRY_DELAYS_MS = [30 * 1000, 60 * 1000, 2 * 60 * 1000, 5 * 60 * 1000];
const rejectedRetryDelay = (rejections) =>
  REJECTED_RETRY_DELAYS_MS[Math.min(rejections, REJECTED_RETRY_DELAYS_MS.length) - 1];

// After this many server rejections the item stops retrying and is shown as
// "couldn't be sent" with its reason, so the user can discard it. Offline
// failures never count — they aren't rejections.
const GIVE_UP_AFTER_REJECTIONS = 5;

/**
 * Replays queued entries in order, one at a time. Safe to call whenever — a
 * concurrent call is a no-op, and it does nothing if offline or empty.
 *
 * A network failure stops the whole flush (everything behind it would fail
 * the same way). A server rejection only holds back entries of that same
 * type, keeping their order; other types still go through, so e.g. a handoff
 * confirmation waiting for the Collector's own sync no longer holds back the
 * Sales Rep's report and stock requests.
 *
 * options.force — try every entry now, ignoring rejection waits.
 */
export async function flush({ force = false } = {}) {
  if (flushing) return;
  await ensureLoaded();
  if (entries.length === 0 || !getConnectionStatus().online) return;

  flushing = true;
  try {
    // Snapshot so an enqueue happening mid-flush isn't processed out of turn.
    const queue = [...entries];
    const heldTypes = new Set();
    for (const queued of queue) {
      if (!getConnectionStatus().online) break; // went offline again mid-flush
      // A failed item waits for the user (Retry or Discard) and holds nothing back.
      if (queued.failed && !force) continue;
      if (heldTypes.has(queued.type)) continue;

      const executor = EXECUTORS[queued.type];
      if (!executor) {
        debugLog('error', 'Queue', 'No executor registered, dropping entry', { id: queued.id, type: queued.type });
        await removeEntry(queued.id);
        continue;
      }

      if (!force && queued.nextAttemptAt && Date.now() < queued.nextAttemptAt) {
        heldTypes.add(queued.type);
        continue;
      }

      const entry = { ...queued, attempts: queued.attempts + 1, lastAttemptAt: Date.now() };

      try {
        await executor(entry);
        debugLog('info', 'Queue', `sent ${entry.type}`, { id: entry.id, attempts: entry.attempts });
        if (entry.localPhotoUri) {
          FileSystem.deleteAsync(entry.localPhotoUri, { idempotent: true }).catch(() => {});
        }
        await removeEntry(entry.id);
      } catch (error) {
        entry.lastError = error.message || 'Sync failed';

        if (!getConnectionStatus().online) {
          debugLog('warn', 'Queue', `${entry.type} not sent: offline`, { id: entry.id, attempts: entry.attempts });
          entries = entries.map((e) => (e.id === entry.id ? entry : e));
          await persist();
          break;
        }

        entry.rejections = (queued.rejections || 0) + 1;
        if (entry.rejections >= GIVE_UP_AFTER_REJECTIONS) {
          entry.failed = true;
          entry.nextAttemptAt = null;
          debugLog('warn', 'Queue', `${entry.type} gave up after ${entry.rejections} rejections: ${entry.lastError}`, {
            id: entry.id,
          });
          entries = entries.map((e) => (e.id === entry.id ? entry : e));
          await persist();
          continue;
        }
        const delayMs = rejectedRetryDelay(entry.rejections);
        entry.nextAttemptAt = Date.now() + delayMs;
        debugLog('warn', 'Queue', `${entry.type} rejected: ${entry.lastError}`, {
          id: entry.id,
          attempts: entry.attempts,
          retryInSec: Math.round(delayMs / 1000),
        });
        entries = entries.map((e) => (e.id === entry.id ? entry : e));
        await persist();
        heldTypes.add(entry.type);
      }
    }
  } finally {
    flushing = false;
  }
}

subscribeConnectionStatus(() => {
  if (getConnectionStatus().online) flush();
});

// Pick up anything queued in a prior app session.
ensureLoaded().then(() => {
  syncIntervalState();
  if (entries.length > 0) flush();
});

export function getEntries() {
  return entries;
}

export function getPendingCount(type = null) {
  return type ? entries.filter((e) => e.type === type).length : entries.length;
}

export function subscribeOutbox(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export default {
  enqueue,
  discard,
  flush,
  getEntries,
  getPendingCount,
  subscribeOutbox,
  registerExecutor,
};
