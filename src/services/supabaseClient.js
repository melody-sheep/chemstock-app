// src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// 🔐 YOUR SUPABASE CREDENTIALS
// ============================================
const SUPABASE_URL = 'https://nxxsjbmuetgamcvfajhl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eHNqYm11ZXRnYW1jdmZhamhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDQ1NjQsImV4cCI6MjA5NjY4MDU2NH0.7OeYnak6VawjgzE84FU7Q46RmdukMFCVtJPDPSrOxtk';

// ============================================
// 🚀 Initialize Supabase Client
// ============================================
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ============================================
// 🧪 Debug Functions - FIXED to use activation_keys
// ============================================
export const testConnection = async () => {
  console.log('🔌 Testing Supabase connection...');
  try {
    // ✅ FIX: Use 'activation_keys' (your data is here!)
    const { data, error } = await supabase
      .from('activation_keys')  // ← CORRECT TABLE NAME
      .select('count', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log('✅ Supabase connected successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    return { success: false, error: error.message };
  }
};

export default supabase;