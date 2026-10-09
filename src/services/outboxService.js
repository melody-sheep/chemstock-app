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
  if (entries.length > 0 && !intervalHandle) {
    // Safety net for reconnecting while idle on a screen that doesn't
    // naturally trigger a request of its own — the connectionStatus
    // subscription below handles the common case.
    intervalHandle = setInterval(() => flush(), FLUSH_INTERVAL_MS);
  } else if (entries.length === 0 && intervalHandle) {
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
 * Each entry `type` maps to an executor that replays the real service calls
 * a screen would have made live. An executor must throw on any failure
 * (network or real rejection) — the queue doesn't try to distinguish them,
 * it just retries on the next flush.
 */
const EXECUTORS = {
  daily_report: async (entry) => {
    if (!entry.localPhotoUri) {
      throw new Error('Missing handover photo for queued report');
    }
    const storagePath = await reportService.uploadDailyReportPhoto(entry.localPhotoUri, entry.payload.agentId);
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
    const storagePath = await inventoryService.uploadDiscrepancyPhoto(entry.localPhotoUri, entry.payload.agentId);
    const result = await reportService.requestDiscrepancyResolution({ ...entry.payload, storagePath });
    if (!result.success) {
      throw new Error(result.message || 'Failed to submit queued return request');
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
export async function enqueue(type, payload, photoUri = null) {
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
    localPhotoUri,
    createdAt: Date.now(),
    lastAttemptAt: null,
    lastError: null,
    attempts: 0,
  };

  entries = [...entries, entry];
  await persist();
  debugLog('info', 'Outbox', 'Enqueued', { id, type });

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

/**
 * Replays every queued entry, in order, one at a time. Safe to call
 * whenever — a concurrent call is a no-op, and it does nothing if offline
 * or the queue is empty.
 */
export async function flush() {
  if (flushing) return;
  await ensureLoaded();
  if (entries.length === 0 || !getConnectionStatus().online) return;

  flushing = true;
  try {
    // Snapshot so an enqueue happening mid-flush isn't processed out of turn.
    const queue = [...entries];
    for (const queued of queue) {
      if (!getConnectionStatus().online) break; // went offline again mid-flush

      const executor = EXECUTORS[queued.type];
      if (!executor) {
        debugLog('error', 'Outbox', 'No executor registered, dropping entry', { id: queued.id, type: queued.type });
        await removeEntry(queued.id);
        continue;
      }

      const entry = { ...queued, attempts: queued.attempts + 1, lastAttemptAt: Date.now() };

      try {
        await executor(entry);
        debugLog('info', 'Outbox', 'Synced', { id: entry.id, type: entry.type });
        if (entry.localPhotoUri) {
          FileSystem.deleteAsync(entry.localPhotoUri, { idempotent: true }).catch(() => {});
        }
        await removeEntry(entry.id);
      } catch (error) {
        entry.lastError = error.message || 'Sync failed';
        debugLog('error', 'Outbox', 'Sync attempt failed, will retry later', {
          id: entry.id,
          type: entry.type,
          attempts: entry.attempts,
          error: entry.lastError,
        });
        entries = entries.map((e) => (e.id === entry.id ? entry : e));
        await persist();
        // Stop here rather than racing through the rest of the queue — a
        // failure here is likely to repeat for everything behind it (same
        // network state), and FIFO means this one goes first next time too.
        break;
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
  flush,
  getEntries,
  getPendingCount,
  subscribeOutbox,
  registerExecutor,
};
