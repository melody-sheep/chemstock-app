import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { markOnline, markOffline, getConnectionStatus } from './connectionStatus';
import { debugLog } from '../utils/logger';

// ============================================
// Supabase credentials
// ============================================
const SUPABASE_URL = 'https://nxxsjbmuetgamcvfajhl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bVHYEZwnhL6Hh894mfIuWg_-ecxTXcK';

// ============================================
// Initialize Supabase Client
// ============================================
// Mobile data that's switched on but has no load doesn't fail a request — it
// leaves it hanging. Android also runs only a few requests per server at once,
// so a handful of hung ones block every later request, even after Wi-Fi comes
// back. Every request is therefore cut off after a limit; photo uploads get a
// longer one so slow-but-working data can still finish them.
const REQUEST_TIMEOUT_MS = 15 * 1000;
const UPLOAD_TIMEOUT_MS = 60 * 1000;

const isPhotoUpload = (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const method = (init?.method || 'GET').toUpperCase();
  return (
    method !== 'GET' &&
    url.includes('/storage/v1/object/') &&
    !url.includes('/storage/v1/object/sign/')
  );
};

// With Wi-Fi and no-load mobile data both on, a single connection can land on
// the dead mobile path while the next one goes through Wi-Fi. Requests that
// only read (and the login steps) get one more try after a network failure.
// Anything that writes is never retried here: the first try may have reached
// the server, and a second could create a duplicate.
const RETRY_DELAY_MS = 700;
// Named get_ but writes: auto-files missed daily reports (SQL 2026-10-10).
const NOT_READ_ONLY_RPCS = new Set(['get_my_sr_report_status']);

const urlOf = (input) => (typeof input === 'string' ? input : input?.url || '');
const pathOf = (url) => url.replace(SUPABASE_URL, '').split('?')[0];

const isSafeToRetry = (input, init) => {
  const url = urlOf(input);
  const method = (init?.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return true;
  if (url.includes('/auth/v1/token?grant_type=password')) return true;
  const rpc = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/);
  if (!rpc || NOT_READ_ONLY_RPCS.has(rpc[1])) return false;
  return rpc[1].startsWith('get_') || rpc[1] === 'verify_agent_login';
};

// Short reason for the log, per the logging rules in the October TODO.
const failureReason = (error, timedOut) => {
  if (timedOut) return 'timeout';
  const message = String(error?.message || '');
  if (message.includes('UnknownHost')) return 'no-dns';
  if (message.includes('ConnectException') || message.includes('Failed to connect')) return 'no-connect';
  if (message.includes('SocketTimeout') || message.includes('timeout')) return 'timeout';
  if (message.includes('canceled') || message.includes('aborted')) return 'aborted';
  return message.slice(0, 80) || 'network-error';
};

const fetchOnce = async (input, init, timeoutMs) => {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // Keep honouring a caller's own abort (the heartbeat below uses one).
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    error.networkReason = failureReason(error, timedOut);
    error.callerAborted = Boolean(callerSignal?.aborted);
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// Every request goes through this wrapper, so the app always knows whether the
// server is reachable (see connectionStatus.js). fetch() only rejects for a
// network-level failure (an HTTP error status still resolves), so a rejection
// means offline. The error is rethrown unchanged so callers behave as before.
const trackedFetch = async (input, init) => {
  const timeoutMs = isPhotoUpload(input, init) ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  const wasOnline = getConnectionStatus().online;
  // Offline already, a retry would only double the wait for a known failure.
  const maxAttempts = wasOnline && isSafeToRetry(input, init) ? 2 : 1;
  const path = pathOf(urlOf(input));
  const startedAt = Date.now();

  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetchOnce(input, init, timeoutMs);
      if (attempt > 1) debugLog('info', 'Net', `${path} ok on attempt ${attempt}`, { ms: Date.now() - startedAt });
      markOnline();
      return response;
    } catch (error) {
      const isLastAttempt = attempt >= maxAttempts || error.callerAborted;
      // Logged when it matters (the app thought it was online); repeated
      // failures while already offline are left out to keep the log readable.
      debugLog(wasOnline ? 'warn' : 'debug', 'Net', `${path} failed: ${error.networkReason}`, {
        attempt,
        ms: Date.now() - startedAt,
        retrying: !isLastAttempt,
      });
      if (isLastAttempt) {
        markOffline();
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
};

// The status above only changes when a request happens, so a screen that sits
// idle (a Collector on the trip map, the login form) kept showing "Online"
// after the signal dropped until the next tap failed. This small probe keeps
// it current, and brings the app back online — which also flushes the offline
// outbox — without the user having to trigger a request.
const HEARTBEAT_INTERVAL_MS = 15 * 1000;
const HEARTBEAT_TIMEOUT_MS = 8 * 1000;

const probeConnection = async () => {
  if (AppState.currentState !== 'active') return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
  try {
    await trackedFetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: controller.signal,
    });
  } catch (error) {
    // trackedFetch has already marked the app offline.
  } finally {
    clearTimeout(timer);
  }
};

setInterval(probeConnection, HEARTBEAT_INTERVAL_MS);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: trackedFetch },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

console.log('[INFO] [supabaseClient] Supabase client initialized');

// Same key supabase-js uses by default (`sb-<project ref>-auth-token`).
// Built from the string because React Native's URL has no `hostname`.
const AUTH_STORAGE_KEY = `sb-${SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0]}-auth-token`;

/**
 * Whether a manager's Supabase login is saved on this phone. Reads storage
 * only — unlike auth.getSession(), it never tries to refresh the token over
 * the network, so it can't hold up app launch.
 */
export const hasStoredAuthSession = async () => {
  try {
    return Boolean(await AsyncStorage.getItem(AUTH_STORAGE_KEY));
  } catch (error) {
    return false;
  }
};

// ============================================
// RLS Error Detection Helper
// ============================================
export const isRLSError = (error) => {
  const isRls = error?.code === '42501' ||
                error?.message?.includes('permission denied') ||
                error?.message?.includes('row-level security') ||
                error?.message?.includes('RLS');

  if (isRls) {
    console.warn('[WARN] [supabaseClient] RLS error detected:', error);
  }

  return isRls;
};

export const getFriendlyErrorMessage = (error) => {
  if (isRLSError(error)) {
    return 'Permission denied. Please check your activation code or contact support.';
  }
  
  if (error?.code === 'PGRST116') {
    return 'No matching record found. Please check your input.';
  }
  
  if (error?.code === '23505') {
    return 'Duplicate entry. This record already exists.';
  }
  
  if (error?.code === '22P02') {
    return 'Invalid input format. Please check your data.';
  }
  
  return error?.message || 'An unexpected error occurred.';
};

// ============================================
// Debug Functions
// ============================================
export const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('activation_keys')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('[ERROR] [supabaseClient] Connection test failed:', error);
      throw error;
    }

    console.log('[INFO] [supabaseClient] Connected successfully');
    return { success: true };
  } catch (error) {
    console.error('[ERROR] [supabaseClient] Connection test error:', error.message);
    return { success: false, error: error.message };
  }
};

export default supabase;