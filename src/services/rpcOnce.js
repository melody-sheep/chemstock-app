// src/services/rpcOnce.js
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';

// Functions the database doesn't have yet (the SQL hasn't been run), so they
// are not asked for again this session.
const missing = new Set();

const isMissingFunction = (error) =>
  error?.code === 'PGRST202' ||
  error?.code === '42883' ||
  /could not find the function|schema cache/i.test(String(error?.message || ''));

/**
 * Calls a "_once" function (which recognises a repeated request id) and, if
 * the database doesn't have it, the original function with the original
 * arguments — so the app works before and after 2026-10-20c is run.
 */
export async function rpcOnce(onceName, onceParams, legacyName, legacyParams) {
  if (!missing.has(onceName)) {
    const result = await supabase.rpc(onceName, onceParams);
    if (!(result.error && isMissingFunction(result.error))) return result;
    missing.add(onceName);
    debugLog('warn', 'Rpc', `${onceName} not in the database, using ${legacyName}`);
  }
  return supabase.rpc(legacyName, legacyParams);
}
