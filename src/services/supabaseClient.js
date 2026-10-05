import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { markOnline, markOffline } from './connectionStatus';

// ============================================
// Supabase credentials
// ============================================
const SUPABASE_URL = 'https://nxxsjbmuetgamcvfajhl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bVHYEZwnhL6Hh894mfIuWg_-ecxTXcK';

// ============================================
// Initialize Supabase Client
// ============================================
// Every request goes through this wrapper, so the app always knows whether the
// server is reachable (see connectionStatus.js). A network failure surfaces as
// a TypeError from fetch; it's rethrown unchanged so callers behave as before.
const trackedFetch = async (input, init) => {
  try {
    const response = await fetch(input, init);
    markOnline();
    return response;
  } catch (error) {
    if (error instanceof TypeError) markOffline();
    throw error;
  }
};

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