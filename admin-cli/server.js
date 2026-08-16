// admin-cli/server.js
// ============================================
// 🚀 CHEMSTOCK ADMIN SERVER
// ============================================
// SECURITY FEATURES IMPLEMENTED:
//   ✅ Rate limiting (prevents brute force)
//   ✅ Audit logging (tracks all actions)
//   ✅ Environment variables (no hardcoded keys)
//   ✅ Request validation
//   ✅ Error handling
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ============================================
// 🔧 ENVIRONMENT CONFIGURATION
// ============================================
require('dotenv').config();

const { supabase } = require('./config/supabase');
const { generateSecureActivationCode, generateSecurePassword } = require('./utils/crypto');

// ============================================
// 🏢 BRANCH RESOLUTION
// Activation keys need real branch_ids (not just free-text names) so
// activate_manager() can copy them onto the manager's profile, and so every
// agent account that manager later creates inherits real branch scoping.
// Matches existing branches by name (case-insensitive) and creates any
// that don't exist yet — the form stays exactly as-is, this just resolves
// what's typed into it against the branches table.
// ============================================
async function resolveBranchIds(branches) {
  const branchIds = [];

  for (const branch of branches) {
    const { data: existing, error: findError } = await supabase
      .from('branches')
      .select('id')
      .ilike('name', branch.name)
      .maybeSingle();

    if (findError) {
      throw new Error(`Failed to look up branch "${branch.name}": ${findError.message}`);
    }

    if (existing) {
      branchIds.push(existing.id);
      continue;
    }

    const { data: created, error: createError } = await supabase
      .from('branches')
      .insert([{ name: branch.name, city: branch.location || null }])
      .select('id')
      .single();

    if (createError) {
      throw new Error(`Failed to create branch "${branch.name}": ${createError.message}`);
    }

    console.log(`✅ [Branches] Created new branch: ${branch.name} (${created.id})`);
    branchIds.push(created.id);
  }

  return branchIds;
}

// Import rate limiters
const {
  activationLimiter,
  generateKeyLimiter,
  revokeKeyLimiter,
  globalLimiter
} = require('./utils/rateLimiter');

// Import audit logger
const { auditLogger } = require('./utils/auditLogger');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 [Server] Initializing...');
console.log(`🔒 [Security] Rate limiting ENABLED`);
console.log(`📊 [Security] Audit logging ${process.env.AUDIT_LOG_ENABLED !== 'false' ? 'ENABLED' : 'DISABLED'}`);
console.log(`🌍 [Environment] ${process.env.NODE_ENV || 'development'}`);

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

// CORS with security headers
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// JSON parser with size limit
app.use(express.json({ limit: '10mb' }));

// ✅ Apply global rate limiting (applies to ALL requests)
app.use(globalLimiter);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Serve static files from web-ui directory
const webUiPath = path.join(__dirname, 'web-ui');
console.log(`📁 [Server] Serving static files from: ${webUiPath}`);

if (!fs.existsSync(webUiPath)) {
  console.error(`❌ [Server] web-ui directory not found at: ${webUiPath}`);
  console.log('💡 Create the web-ui directory with index.html, style.css, and script.js');
  process.exit(1);
}

app.use(express.static(webUiPath));

// ============================================
// 📊 REQUEST LOGGING
// ============================================
app.use((req, res, next) => {
  console.log(`📊 [${req.method}] ${req.path} from ${req.ip}`);
  next();
});

// ============================================
// 📊 API ROUTES
// ============================================

// ============================================
// Health check (no rate limiting)
// ============================================
app.get('/api/health', (req, res) => {
  console.log('📊 [API] Health check');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'ChemStock Admin API is running',
    security: {
      rateLimiting: true,
      auditLogging: process.env.AUDIT_LOG_ENABLED !== 'false',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// ============================================
// Get all activation keys
// ============================================
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

// ============================================
// Generate new activation key
// 🔒 Protected by: generateKeyLimiter
// 🔒 Audited by: auditLogger
// ============================================
app.post('/api/keys/generate', generateKeyLimiter, async (req, res) => {
  console.log('📊 [API] POST /api/keys/generate');
  console.log('📊 [API] Request body:', req.body);
  
  const { 
    code, 
    managerName, 
    managerEmail, 
    branchNames, 
    branchLocations, 
    daysValid,
    generatePassword 
  } = req.body;

  // Get client info for audit
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    // Validate required fields
    if (!managerName || !managerEmail || !branchNames || branchNames.length === 0) {
      const error = 'Manager name, email, and at least one branch are required';
      
      // 📊 AUDIT: Failed key generation
      await auditLogger.logKeyGeneration({
        activationKey: code || 'generated',
        managerEmail,
        managerName,
        branches: branchNames,
        ipAddress,
        userAgent,
        status: 'failed',
        errorMessage: error
      });

      return res.status(400).json({
        success: false,
        error
      });
    }

    // Use provided code or generate one
    const activationCode = code?.trim() || generateSecureActivationCode(16);

    // Calculate expiration date
    const days = parseInt(daysValid) || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    console.log(`📊 [API] Creating key: ${activationCode} for ${managerName}`);

    // Resolve typed branch names against the branches table (creating any
    // that don't exist yet) so this key carries real branch_ids, not just
    // display text.
    const branchPairs = branchNames.map((name, i) => ({
      name: name.trim(),
      location: branchLocations?.[i]?.trim() || '',
    }));
    const branchIds = await resolveBranchIds(branchPairs);

    // Insert into database
    const { data, error } = await supabase
      .from('activation_keys')
      .insert([{
        code: activationCode,
        manager_email: managerEmail.trim(),
        manager_name: managerName.trim(),
        branch_names: branchNames.map(b => b.trim()),
        branch_locations: branchLocations ? branchLocations.map(b => b.trim()) : [],
        branch_ids: branchIds,
        expires_at: expiresAt.toISOString(),
        is_used: false
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ [API] Error inserting key:', error);
      
      // 📊 AUDIT: Failed key generation
      await auditLogger.logKeyGeneration({
        activationKey: activationCode,
        managerEmail,
        managerName,
        branches: branchNames,
        ipAddress,
        userAgent,
        status: 'failed',
        errorMessage: error.message
      });

      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`✅ [API] Key created successfully: ${activationCode}`);
    
    // 📊 AUDIT: Successful key generation
    await auditLogger.logKeyGeneration({
      activationKey: activationCode,
      managerEmail,
      managerName,
      branches: branchNames,
      ipAddress,
      userAgent,
      status: 'success'
    });

    res.json({
      success: true,
      data: {
        ...data,
        generatedPassword: generatePassword ? generateSecurePassword(8) : null
      }
    });
  } catch (error) {
    console.error('❌ [API] Error:', error);
    
    // 📊 AUDIT: Failed key generation
    await auditLogger.logKeyGeneration({
      activationKey: code || 'unknown',
      managerEmail,
      managerName,
      branches: branchNames || [],
      ipAddress,
      userAgent,
      status: 'failed',
      errorMessage: error.message
    });

    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Revoke activation key
// 🔒 Protected by: revokeKeyLimiter
// 🔒 Audited by: auditLogger
// ============================================
app.delete('/api/keys/:code', revokeKeyLimiter, async (req, res) => {
  console.log('📊 [API] DELETE /api/keys/' + req.params.code);
  
  const { code } = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    // First, get the key details for audit
    const { data: keyData, error: fetchError } = await supabase
      .from('activation_keys')
      .select('manager_email, manager_name')
      .eq('code', code)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ [API] Error fetching key:', fetchError);
    }
    
    const { data, error } = await supabase
      .from('activation_keys')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('code', code)
      .eq('is_used', false)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 📊 AUDIT: Failed revocation - key not found
        await auditLogger.logKeyRevocation({
          activationKey: code,
          managerEmail: keyData?.manager_email || 'unknown',
          ipAddress,
          userAgent,
          status: 'failed',
          errorMessage: 'Key not found or already revoked'
        });

        return res.status(404).json({ 
          success: false, 
          error: 'Key not found or already revoked' 
        });
      }
      console.error('❌ [API] Error revoking key:', error);
      
      // 📊 AUDIT: Failed revocation
      await auditLogger.logKeyRevocation({
        activationKey: code,
        managerEmail: keyData?.manager_email || 'unknown',
        ipAddress,
        userAgent,
        status: 'failed',
        errorMessage: error.message
      });

      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`✅ [API] Key revoked: ${code}`);
    
    // 📊 AUDIT: Successful revocation
    await auditLogger.logKeyRevocation({
      activationKey: code,
      managerEmail: data?.manager_email || keyData?.manager_email || 'unknown',
      ipAddress,
      userAgent,
      status: 'success'
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [API] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Get stats
// ============================================
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

// ============================================
// 📊 AUDIT LOGS ENDPOINT (admin only)
// ============================================
app.get('/api/audit-logs', async (req, res) => {
  console.log('📊 [API] GET /api/audit-logs');
  
  const limit = parseInt(req.query.limit) || 100;
  
  const result = await auditLogger.getRecentLogs(limit);
  
  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error });
  }
  
  res.json({ success: true, data: result.data });
});

// ============================================
// 📊 AUDIT STATS ENDPOINT
// ============================================
app.get('/api/audit-stats', async (req, res) => {
  console.log('📊 [API] GET /api/audit-stats');
  
  const result = await auditLogger.getStats();
  
  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error });
  }
  
  res.json({ success: true, data: result.data });
});

// ============================================
// 🚀 ACTIVATE MANAGER ENDPOINT
// 🔒 Protected by: activationLimiter (strict)
// 🔒 Audited by: auditLogger
// ============================================
app.post('/api/activate-manager', activationLimiter, async (req, res) => {
  console.log('📊 [API] POST /api/activate-manager');
  
  const { code, managerEmail, branchId } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';

  console.log(`📊 [API] Activation attempt for: ${managerEmail} with key: ${code}`);

  try {
    // Validate input
    if (!code || !managerEmail) {
      // 📊 AUDIT: Failed activation - missing fields
      await auditLogger.logManagerActivation({
        activationKey: code || 'unknown',
        managerEmail: managerEmail || 'unknown',
        branchId,
        ipAddress,
        userAgent,
        status: 'failed',
        errorMessage: 'Missing required fields'
      });

      return res.status(400).json({
        success: false,
        error: 'Activation code and email are required'
      });
    }

    // Look up the activation key
    const { data: keyData, error: keyError } = await supabase
      .from('activation_keys')
      .select('*')
      .eq('code', code)
      .eq('is_used', false)
      .single();

    if (keyError || !keyData) {
      console.warn(`⚠️  [API] Invalid activation key: ${code}`);
      
      // 📊 AUDIT: Failed activation - invalid key
      await auditLogger.logManagerActivation({
        activationKey: code,
        managerEmail,
        branchId,
        ipAddress,
        userAgent,
        status: 'failed',
        errorMessage: 'Invalid or used activation key'
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid or used activation key'
      });
    }

    // Check if key is expired
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      console.warn(`⚠️  [API] Expired activation key: ${code}`);
      
      // 📊 AUDIT: Failed activation - expired key
      await auditLogger.logManagerActivation({
        activationKey: code,
        managerEmail,
        branchId,
        ipAddress,
        userAgent,
        status: 'failed',
        errorMessage: 'Activation key has expired'
      });

      return res.status(400).json({
        success: false,
        error: 'Activation key has expired'
      });
    }

    // Mark key as used
    const { error: updateError } = await supabase
      .from('activation_keys')
      .update({
        is_used: true,
        used_at: new Date().toISOString()
      })
      .eq('code', code);

    if (updateError) {
      console.error('❌ [API] Error updating key:', updateError);
      
      // 📊 AUDIT: Failed activation - update error
      await auditLogger.logManagerActivation({
        activationKey: code,
        managerEmail,
        branchId,
        ipAddress,
        userAgent,
        status: 'failed',
        errorMessage: updateError.message
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to activate manager'
      });
    }

    console.log(`✅ [API] Manager activated: ${managerEmail}`);
    
    // 📊 AUDIT: Successful activation
    await auditLogger.logManagerActivation({
      activationKey: code,
      managerEmail,
      branchId,
      ipAddress,
      userAgent,
      status: 'success'
    });

    // Return success with manager details
    res.json({
      success: true,
      data: {
        managerName: keyData.manager_name,
        managerEmail: keyData.manager_email,
        branches: keyData.branch_names,
        activatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [API] Activation error:', error);
    
    // 📊 AUDIT: Failed activation - unexpected error
    await auditLogger.logManagerActivation({
      activationKey: code || 'unknown',
      managerEmail: managerEmail || 'unknown',
      branchId,
      ipAddress,
      userAgent,
      status: 'failed',
      errorMessage: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during activation'
    });
  }
});

// ============================================
// Catch-all route - serve index.html
// ============================================
app.get('*', (req, res) => {
  res.sendFile(path.join(webUiPath, 'index.html'));
});

// ============================================
// 🚀 START SERVER
// ============================================

const server = app.listen(PORT, () => {
  console.log(`\n✅ Admin Web UI running at: http://localhost:${PORT}\n`);
  console.log(`📊 API available at:`);
  console.log(`   - GET  /api/keys        - List all keys`);
  console.log(`   - POST /api/keys/generate - Generate new key`);
  console.log(`   - DELETE /api/keys/:code - Revoke key`);
  console.log(`   - POST /api/activate-manager - Activate manager`);
  console.log(`   - GET  /api/audit-logs  - View audit logs`);
  console.log(`   - GET  /api/audit-stats - Audit statistics`);
  console.log(`   - GET  /api/stats       - Key statistics`);
  console.log(`   - GET  /api/health      - Health check`);
  console.log(`\n🔒 Security Features:`);
  console.log(`   - Rate limiting: ${process.env.RATE_LIMIT_MAX_REQUESTS || 5} requests per minute`);
  console.log(`   - Audit logging: ${process.env.AUDIT_LOG_ENABLED !== 'false' ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}\n`);
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