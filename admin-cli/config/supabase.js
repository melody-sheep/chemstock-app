const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ============================================
// 🔒 VALIDATE CREDENTIALS
// ============================================
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please create a .env file with:');
  console.error('  SUPABASE_URL=your_url');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  console.error('');
  console.error('⚠️ IMPORTANT: Never commit .env to git!');
  process.exit(1);
}

// ============================================
// 🚀 CREATE SUPABASE CLIENT
// ============================================
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ============================================
// 🔒 SECURITY CHECK - Warn if in dev mode
// ============================================
if (process.env.NODE_ENV !== 'production') {
  console.log('⚠️  [Security] Running in DEVELOPMENT mode');
  console.log('⚠️  [Security] Service role key has full database access');
  console.log('⚠️  [Security] Ensure RLS is enabled on all tables');
}

// ============================================
// 📊 TEST CONNECTION
// ============================================
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('activation_keys')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ [Supabase] Connection successful');
    return true;
  } catch (error) {
    console.error('❌ [Supabase] Connection failed:', error.message);
    return false;
  }
}

// Test connection (non-blocking)
testConnection();

module.exports = { supabase };