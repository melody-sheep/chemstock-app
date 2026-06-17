// admin-cli/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { supabase } = require('./config/supabase');
const { generateSecureActivationCode, generateSecurePassword } = require('./utils/crypto');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 [Server] Initializing...');

// ============================================
// ✅ CHECK DEPENDENCIES
// ============================================
try {
  console.log('📦 [Server] Checking dependencies...');
  console.log(`   - express: ${require('express/package.json').version}`);
  console.log(`   - cors: ${require('cors/package.json').version}`);
  console.log('✅ [Server] Dependencies OK');
} catch (err) {
  console.error('❌ [Server] Missing dependencies:', err.message);
  console.log('💡 Run: npm install express cors');
  process.exit(1);
}

// ============================================
// ✅ CHECK SUPABASE CONFIG
// ============================================
try {
  console.log('📦 [Server] Checking Supabase config...');
  const { supabase: sb } = require('./config/supabase');
  console.log('✅ [Server] Supabase config OK');
} catch (err) {
  console.error('❌ [Server] Supabase config error:', err.message);
  console.log('💡 Check your .env file');
  process.exit(1);
}

// ============================================
// ✅ MIDDLEWARE
// ============================================
console.log('🔧 [Server] Setting up middleware...');
app.use(cors());
app.use(express.json());

// Serve static files from web-ui directory
const webUiPath = path.join(__dirname, 'web-ui');
console.log(`📁 [Server] Serving static files from: ${webUiPath}`);

// Check if web-ui directory exists
const fs = require('fs');
if (!fs.existsSync(webUiPath)) {
  console.error(`❌ [Server] web-ui directory not found at: ${webUiPath}`);
  console.log('💡 Create the web-ui directory with index.html, style.css, and script.js');
  process.exit(1);
}

app.use(express.static(webUiPath));

// ============================================
// 📊 API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  console.log('📊 [API] Health check');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'ChemStock Admin API is running'
  });
});

// Get all activation keys
app.get('/api/keys', async (req, res) => {
  console.log('📊 [API] GET /api/keys');
  
  try {
    const { data, error } = await supabase
      .from('activation_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Error fetching keys:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`✅ [API] Retrieved ${data?.length || 0} keys`);
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('❌ [API] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate new activation key
app.post('/api/keys/generate', async (req, res) => {
  console.log('📊 [API] POST /api/keys/generate');
  console.log('📊 [API] Request body:', req.body);
  
  try {
    const { 
      code, 
      managerName, 
      managerEmail, 
      branchNames, 
      branchLocations, 
      daysValid,
      generatePassword 
    } = req.body;

    // Validate required fields
    if (!managerName || !managerEmail || !branchNames || branchNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Manager name, email, and at least one branch are required'
      });
    }

    // Use provided code or generate one
    const activationCode = code?.trim() || generateSecureActivationCode(16);
    
    // Calculate expiration date
    const days = parseInt(daysValid) || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    console.log(`📊 [API] Creating key: ${activationCode} for ${managerName}`);

    // Insert into database
    const { data, error } = await supabase
      .from('activation_keys')
      .insert([{
        code: activationCode,
        manager_email: managerEmail.trim(),
        manager_name: managerName.trim(),
        branch_names: branchNames.map(b => b.trim()),
        branch_locations: branchLocations ? branchLocations.map(b => b.trim()) : [],
        expires_at: expiresAt.toISOString(),
        is_used: false
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ [API] Error inserting key:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`✅ [API] Key created successfully: ${activationCode}`);
    
    res.json({
      success: true,
      data: {
        ...data,
        generatedPassword: generatePassword ? generateSecurePassword(8) : null
      }
    });
  } catch (error) {
    console.error('❌ [API] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Revoke activation key
app.delete('/api/keys/:code', async (req, res) => {
  console.log('📊 [API] DELETE /api/keys/' + req.params.code);
  
  try {
    const { code } = req.params;
    
    const { data, error } = await supabase
      .from('activation_keys')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('code', code)
      .eq('is_used', false)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false, 
          error: 'Key not found or already revoked' 
        });
      }
      console.error('❌ [API] Error revoking key:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`✅ [API] Key revoked: ${code}`);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [API] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stats
app.get('/api/stats', async (req, res) => {
  console.log('📊 [API] GET /api/stats');
  
  try {
    const { data, error } = await supabase
      .from('activation_keys')
      .select('*');

    if (error) {
      console.error('❌ [API] Error getting stats:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    const total = data?.length || 0;
    const available = data?.filter(k => !k.is_used).length || 0;
    const used = data?.filter(k => k.is_used).length || 0;
    const expired = data?.filter(k => 
      k.expires_at && new Date(k.expires_at) < new Date()
    ).length || 0;

    console.log(`✅ [API] Stats: Total: ${total}, Available: ${available}, Used: ${used}, Expired: ${expired}`);
    
    res.json({
      success: true,
      data: { total, available, used, expired }
    });
  } catch (error) {
    console.error('❌ [API] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Catch-all route - serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(webUiPath, 'index.html'));
});

// ============================================
// 🚀 START SERVER
// ============================================

const server = app.listen(PORT, () => {
  console.log(`\n✅ Admin Web UI running at: http://localhost:${PORT}\n`);
  console.log(`📊 API available at: http://localhost:${PORT}/api/keys`);
  console.log(`📊 Stats at: http://localhost:${PORT}/api/stats`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health\n`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.log(`💡 Try running: node index.js --kill to kill the existing process`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.log('💡 Server will continue running...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  console.log('💡 Server will continue running...');
});

module.exports = { app, server };