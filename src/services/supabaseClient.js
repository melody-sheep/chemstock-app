import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// 🔐 YOUR SUPABASE CREDENTIALS - UPDATED!
// ============================================
const SUPABASE_URL = 'https://nxxsjbmuetgamcvfajhl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bVHYEZwnhL6Hh894mfIuWg_-ecxTXcK';

// ============================================
// 🚀 Initialize Supabase Client
// ============================================
console.log('🚀 [supabaseClient] Initializing Supabase client...');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

console.log('✅ [supabaseClient] Supabase client initialized');

// ============================================
// 🔍 RLS Error Detection Helper
// ============================================
export const isRLSError = (error) => {
  const isRls = error?.code === '42501' || 
                error?.message?.includes('permission denied') ||
                error?.message?.includes('row-level security') ||
                error?.message?.includes('RLS');
  
  if (isRls) {
    console.log('🔒 [supabaseClient] RLS error detected:', error);
  }
  
  return isRls;
};

export const getFriendlyErrorMessage = (error) => {
  console.log('🔍 [supabaseClient] Getting friendly message for:', error?.code, error?.message);
  
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
// 🧪 Debug Functions
// ============================================
export const testConnection = async () => {
  console.log('🔌 [supabaseClient] Testing Supabase connection...');
  console.log('📡 [supabaseClient] URL:', SUPABASE_URL);
  console.log('🔑 [supabaseClient] Using ANON key (length):', SUPABASE_ANON_KEY.length);
  
  try {
    const { data, error } = await supabase
      .from('activation_keys')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ [supabaseClient] Connection test failed:', error);
      throw error;
    }
    
    console.log('✅ [supabaseClient] Connected successfully!');
    console.log('📊 [supabaseClient] Table count:', data);
    return { success: true };
  } catch (error) {
    console.error('❌ [supabaseClient] Connection test error:', error.message);
    return { success: false, error: error.message };
  }
};

export default supabase;