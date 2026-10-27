// admin-cli/server.js
// ============================================
// 🚀 CHEMSTOCK ADMIN SERVER
// Runs on this computer only (127.0.0.1). Every /api route except health and
// login needs a logged-in admin (utils/adminAuth.js). It holds the
// service-role key, so it never sends that key or secrets to the page.
// ============================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const { qrWithLogo } = require('./utils/qrLogo');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { supabase } = require('./config/supabase');
const { generateSecureActivationCode } = require('./utils/crypto');
const KeyStrength = require('./utils/keyStrength');
const { findSimilar } = require('./utils/branchMatch');
const places = require('./utils/places');
const adminAuth = require('./utils/adminAuth');
const { generateKeyLimiter, revokeKeyLimiter, globalLimiter } = require('./utils/rateLimiter');
const { auditLogger } = require('./utils/auditLogger');
const activity = require('./utils/activityLog');
const { checkEmailLegit } = require('./utils/emailCheck');

const PORT = process.env.PORT || 3001;
// Only this computer can open the admin tool — not other devices on the Wi-Fi.
const HOST = '127.0.0.1';
const ALLOWED_ORIGINS = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
const PHOTO_BUCKET = 'shipment-media';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Activation codes are secrets: logs show only the first and last 2 characters.
const maskCode = (code) => {
  const text = String(code || '');
  return text.length <= 4 ? '****' : `${text.slice(0, 2)}…${text.slice(-2)}`;
};

// activation_keys timestamps are stored without a time zone (written as UTC).
const asUtc = (value) => {
  if (!value) return null;
  const text = String(value);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text}Z`);
};

const app = express();
const webUiPath = path.join(__dirname, 'web-ui');

// ============================================
// 🔒 MIDDLEWARE
// ============================================
app.use(express.json({ limit: '100kb' }));
app.use(globalLimiter);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; " +
      "frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  );
  next();
});

app.use(adminAuth.requireSameOrigin(ALLOWED_ORIGINS));
app.post('/api/auth/login', adminAuth.login);
app.post('/api/auth/logout', adminAuth.logout);
app.get('/api/auth/me', adminAuth.me);
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));
app.use('/api', adminAuth.requireAdmin);

app.use('/vendor/phosphor', express.static(path.join(__dirname, 'node_modules/@phosphor-icons/web/src')));
app.get('/shared/keyStrength.js', (req, res) => res.sendFile(path.join(__dirname, 'utils/keyStrength.js')));
app.use(express.static(webUiPath));

const clientInfo = (req) => ({ ipAddress: req.ip, userAgent: req.headers['user-agent'] || 'unknown' });

// Writes to the audit log; actions the table doesn't allow yet (before
// 2026-10-20d is run) are only printed, never break the request.
const ACTIVITY_NAMES = {
  generate_key: 'key_generated',
  revoke_key: 'key_revoked',
  extend_key: 'key_extended',
  deactivate_manager: 'manager_deactivated',
  reactivate_manager: 'manager_reactivated',
  update_manager_branches: 'manager_branches_changed',
  update_branch: 'branch_edited',
};

async function audit(req, action, { code = '-', email = null, status = 'success', error = null, branchId = null } = {}) {
  const { ipAddress, userAgent } = clientInfo(req);
  if (ACTIVITY_NAMES[action]) {
    activity.log(adminAuth.whoIs(req), ACTIVITY_NAMES[action], {
      target: email || (branchId ? `branch ${branchId}` : null),
      details: code && code !== '-' ? { key: activity.maskCode(code) } : error ? { error } : null,
      status,
    });
  }
  await auditLogger.logActivation({
    action, activationKey: code, managerEmail: email, status, ipAddress, userAgent, errorMessage: error, branchId,
  });
}

const fail = (res, status, error, extra = {}) => res.status(status).json({ success: false, error, ...extra });

// ============================================
// 📦 DATA HELPERS
// ============================================
async function loadBranches() {
  const { data, error } = await supabase.from('branches').select('*').order('name');
  if (error) throw error;
  return data || [];
}

async function loadProfiles(roles) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, username, full_name, email, role, branch_ids, phone_number, created_at, last_seen_at, profile_media_id, created_by')
    .in('role', roles);
  if (error) throw error;
  return data || [];
}

async function revokedCodes() {
  const { data } = await supabase
    .from('activation_audit_log')
    .select('activation_key')
    .eq('action', 'revoke_key')
    .eq('status', 'success');
  return new Set((data || []).map((r) => r.activation_key));
}

function keyStatus(key, revoked) {
  if (key.is_used) return revoked.has(key.code) ? 'revoked' : 'used';
  const expires = asUtc(key.expires_at);
  if (expires && expires < new Date()) return 'expired';
  return 'available';
}

async function signedPhotoUrls(profiles) {
  const mediaIds = profiles.map((p) => p.profile_media_id).filter(Boolean);
  if (mediaIds.length === 0) return {};
  const { data: media } = await supabase.from('media').select('id, storage_path').in('id', mediaIds);
  const paths = (media || []).map((m) => m.storage_path);
  if (paths.length === 0) return {};
  const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  const byPath = Object.fromEntries((signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  return Object.fromEntries((media || []).map((m) => [m.id, byPath[m.storage_path] || null]));
}

async function authUsersById() {
  const users = {};
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    (data?.users || []).forEach((u) => { users[u.id] = u; });
    if (!data?.users || data.users.length < 1000) break;
  }
  return users;
}

const isBanned = (user) => Boolean(user?.banned_until && new Date(user.banned_until) > new Date());

// ============================================
// 📊 DASHBOARD
// ============================================
app.get('/api/stats', async (req, res) => {
  try {
    const [{ data: keys, error }, revoked, branches, managers] = await Promise.all([
      supabase.from('activation_keys').select('code, is_used, expires_at'),
      revokedCodes(),
      loadBranches(),
      loadProfiles(['manager']),
    ]);
    if (error) throw error;
    const counts = { total: keys.length, available: 0, used: 0, expired: 0, revoked: 0, expiringSoon: 0 };
    const weekAhead = Date.now() + 7 * 24 * 60 * 60 * 1000;
    keys.forEach((k) => {
      const status = keyStatus(k, revoked);
      counts[status] += 1;
      const expires = asUtc(k.expires_at);
      if (status === 'available' && expires && expires.getTime() < weekAhead) counts.expiringSoon += 1;
    });
    res.json({ success: true, data: { ...counts, branches: branches.length, managers: managers.length } });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

// ============================================
// 🔑 ACTIVATION KEYS
// ============================================
app.get('/api/keys', async (req, res) => {
  try {
    const [{ data, error }, revoked, managers] = await Promise.all([
      supabase.from('activation_keys').select('*').order('created_at', { ascending: false }),
      revokedCodes(),
      loadProfiles(['manager']),
    ]);
    if (error) throw error;
    const managerByEmail = Object.fromEntries(managers.map((m) => [String(m.email).toLowerCase(), m.full_name]));
    res.json({
      success: true,
      data: data.map((k) => ({
        id: k.id,
        code: k.code,
        managerName: k.manager_name,
        managerEmail: k.manager_email,
        branchNames: k.branch_names || [],
        branchLocations: k.branch_locations || [],
        status: keyStatus(k, revoked),
        createdAt: asUtc(k.created_at),
        expiresAt: asUtc(k.expires_at),
        usedAt: asUtc(k.used_at),
        activatedBy: k.is_used ? managerByEmail[String(k.manager_email).toLowerCase()] || null : null,
      })),
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

// Live checks for the Generate Key form.
app.post('/api/keys/check-code', async (req, res) => {
  const code = String(req.body?.code || '').trim();
  if (!code) return res.json({ success: true, data: { exists: false } });
  const { data } = await supabase.from('activation_keys').select('id').eq('code', code).maybeSingle();
  res.json({ success: true, data: { exists: Boolean(data) } });
});

app.get('/api/keys/suggest', (req, res) => res.json({ success: true, data: { code: generateSecureActivationCode(16) } }));

app.get('/api/check-email', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return res.json({ success: true, data: { valid: false } });
    const legit = await checkEmailLegit(email);
    const [{ data: profile }, { data: keys }, revoked] = await Promise.all([
      supabase.from('user_profiles').select('id, full_name, role, branch_ids').ilike('email', email).maybeSingle(),
      supabase.from('activation_keys').select('code, manager_name, is_used, expires_at').ilike('manager_email', email),
      revokedCodes(),
    ]);
    const openKey = (keys || []).find((k) => keyStatus(k, revoked) === 'available');
    let branchNames = [];
    if (profile?.branch_ids?.length) {
      const { data: b } = await supabase.from('branches').select('name').in('id', profile.branch_ids);
      branchNames = (b || []).map((x) => x.name);
    }
    res.json({
      success: true,
      data: {
        valid: true,
        legit,
        account: profile ? { name: profile.full_name, role: profile.role, branches: branchNames } : null,
        openKey: openKey ? { managerName: openKey.manager_name, expiresAt: asUtc(openKey.expires_at) } : null,
      },
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

/**
 * POST /api/keys/generate
 * { managerName, managerEmail, daysValid, code?, acceptMedium?,
 *   branches: [{ id } | { name, city, region, address, createAnyway? }] }
 */
app.post('/api/keys/generate', generateKeyLimiter, async (req, res) => {
  const body = req.body || {};
  const managerName = String(body.managerName || '').trim().replace(/\s+/g, ' ');
  const managerEmail = String(body.managerEmail || '').trim().toLowerCase();
  const daysValid = Math.min(Math.max(parseInt(body.daysValid, 10) || 30, 1), 365);
  const requested = Array.isArray(body.branches) ? body.branches : [];

  if (managerName.length < 3) return fail(res, 400, 'Enter the manager’s full name.');
  if (!EMAIL_PATTERN.test(managerEmail)) return fail(res, 400, 'Enter a valid email address.');
  const emailLegit = await checkEmailLegit(managerEmail);
  if (!emailLegit.legit) return fail(res, 400, emailLegit.message);
  if (requested.length === 0) return fail(res, 400, 'Pick at least one branch.');

  try {
    // ---- the code
    let code = String(body.code || '').trim();
    if (code) {
      const strength = KeyStrength.check(code, {
        name: managerName,
        email: managerEmail,
        branches: requested.map((b) => b.name).filter(Boolean),
      });
      if (!strength.allowed) return fail(res, 400, 'That key is too weak. Use a generated key or follow the checklist.');
      if (strength.needsConfirm && !body.acceptMedium) return fail(res, 409, 'This key is only medium strength.', { needsConfirm: true });
      const { data: existing } = await supabase.from('activation_keys').select('id').eq('code', code).maybeSingle();
      if (existing) return fail(res, 409, 'That key was already used. Pick another one.');
    } else {
      code = generateSecureActivationCode(16);
    }

    // ---- the branches
    const branches = await loadBranches();
    const chosen = [];
    for (const item of requested) {
      if (item.id) {
        const found = branches.find((b) => b.id === item.id);
        if (!found) return fail(res, 400, 'One of the selected branches no longer exists.');
        if (!chosen.some((c) => c.id === found.id)) chosen.push(found);
        continue;
      }
      const name = String(item.name || '').trim().replace(/\s+/g, ' ');
      if (name.length < 2) return fail(res, 400, 'Each new branch needs a name.');
      const similar = findSimilar(name, branches);
      if (similar.length > 0 && !item.createAnyway) {
        return fail(res, 409, `A branch like "${name}" already exists.`, {
          similarBranches: similar.slice(0, 5).map((b) => ({ id: b.id, name: b.name, city: b.city, reason: b.reason })),
          forName: name,
        });
      }
      const { data: created, error: createError } = await supabase
        .from('branches')
        .insert([{ name: name.toUpperCase(), city: item.city || null, region: item.region || null, address: item.address || null }])
        .select('*')
        .single();
      if (createError) throw createError;
      branches.push(created);
      chosen.push(created);
    }

    const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from('activation_keys')
      .insert([{
        code,
        manager_email: managerEmail,
        manager_name: managerName.toUpperCase(),
        branch_names: chosen.map((b) => b.name),
        branch_locations: chosen.map((b) => [b.city, b.region].filter(Boolean).join(', ') || b.address || ''),
        branch_ids: chosen.map((b) => b.id),
        expires_at: expiresAt.toISOString(),
        is_used: false,
      }])
      .select('id, code, manager_name, manager_email, branch_names, expires_at')
      .single();
    if (error) throw error;

    console.log(`✅ [Keys] Created ${maskCode(code)} for ${managerName}`);
    await audit(req, 'generate_key', { code, email: managerEmail });
    res.json({
      success: true,
      data: { id: data.id, code: data.code, managerName: data.manager_name, managerEmail: data.manager_email, branchNames: data.branch_names, expiresAt: asUtc(data.expires_at) },
    });
  } catch (error) {
    await audit(req, 'generate_key', { code: maskCode(body.code), email: managerEmail, status: 'failed', error: error.message });
    fail(res, 500, error.message);
  }
});

app.delete('/api/keys/:id', revokeKeyLimiter, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('activation_keys')
      .update({ is_used: true, used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('is_used', false)
      .select('code, manager_email')
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail(res, 404, 'Key not found or already used.');
    await audit(req, 'revoke_key', { code: data.code, email: data.manager_email });
    console.log(`✅ [Keys] Revoked ${maskCode(data.code)}`);
    res.json({ success: true });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

app.post('/api/keys/:id/extend', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.body?.days, 10) || 7, 1), 90);
    const { data: key, error } = await supabase.from('activation_keys').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!key || key.is_used) return fail(res, 400, 'Only an unused key can be extended.');
    const base = Math.max(Date.now(), asUtc(key.expires_at)?.getTime() || 0);
    const expiresAt = new Date(base + days * 24 * 60 * 60 * 1000);
    const { error: updateError } = await supabase
      .from('activation_keys')
      .update({ expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', key.id);
    if (updateError) throw updateError;
    await audit(req, 'extend_key', { code: key.code, email: key.manager_email });
    res.json({ success: true, data: { expiresAt } });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

app.get('/api/keys/:id/qr', async (req, res) => {
  try {
    const { data: key } = await supabase.from('activation_keys').select('code').eq('id', req.params.id).maybeSingle();
    if (!key) return fail(res, 404, 'Key not found.');
    activity.log(adminAuth.whoIs(req), 'qr_shown', { target: activity.maskCode(key.code) });
    const dataUrl = await qrWithLogo(key.code);
    res.json({ success: true, data: { dataUrl } });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

// ============================================
// 👤 MANAGERS
// ============================================
app.get('/api/managers', async (req, res) => {
  try {
    const [managers, branches, authUsers, agents] = await Promise.all([
      loadProfiles(['manager']),
      loadBranches(),
      authUsersById(),
      loadProfiles(['sales_rep', 'collector']),
    ]);
    const photos = await signedPhotoUrls(managers);
    const branchName = Object.fromEntries(branches.map((b) => [b.id, b.name]));
    res.json({
      success: true,
      data: managers
        .map((m) => {
          const user = authUsers[m.id];
          return {
            id: m.id,
            name: m.full_name,
            username: m.username,
            email: m.email,
            phone: m.phone_number,
            branchIds: m.branch_ids || [],
            branchNames: (m.branch_ids || []).map((id) => branchName[id]).filter(Boolean),
            photoUrl: m.profile_media_id ? photos[m.profile_media_id] || null : null,
            createdAt: m.created_at,
            lastSeenAt: m.last_seen_at,
            lastSignInAt: user?.last_sign_in_at || null,
            active: !isBanned(user),
            agentCount: agents.filter((a) => a.created_by === m.id).length,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

// Deactivate = the manager's login is blocked (Supabase ban); the app logs
// them out at its next check. Reactivate lifts it.
app.post('/api/managers/:id/status', async (req, res) => {
  try {
    const active = Boolean(req.body?.active);
    const { data: profile } = await supabase.from('user_profiles').select('id, email, role').eq('id', req.params.id).maybeSingle();
    if (!profile || profile.role !== 'manager') return fail(res, 404, 'Manager not found.');
    const { error } = await supabase.auth.admin.updateUserById(profile.id, { ban_duration: active ? 'none' : '876000h' });
    if (error) throw error;
    await audit(req, active ? 'reactivate_manager' : 'deactivate_manager', { email: profile.email });
    console.log(`✅ [Managers] ${active ? 'Reactivated' : 'Deactivated'} ${profile.email}`);
    res.json({ success: true });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

app.put('/api/managers/:id/branches', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.branchIds) ? [...new Set(req.body.branchIds)] : [];
    if (ids.length === 0) return fail(res, 400, 'A manager needs at least one branch.');
    const branches = await loadBranches();
    if (!ids.every((id) => branches.some((b) => b.id === id))) return fail(res, 400, 'One of the branches no longer exists.');
    const { data: profile } = await supabase.from('user_profiles').select('id, email, role').eq('id', req.params.id).maybeSingle();
    if (!profile || profile.role !== 'manager') return fail(res, 404, 'Manager not found.');
    const { error } = await supabase
      .from('user_profiles')
      .update({ branch_ids: ids, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (error) throw error;
    await audit(req, 'update_manager_branches', { email: profile.email });
    res.json({ success: true });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

// ============================================
// 🏢 BRANCHES
// ============================================
app.get('/api/branches', async (req, res) => {
  try {
    const [branches, people] = await Promise.all([loadBranches(), loadProfiles(['manager', 'sales_rep', 'collector'])]);
    res.json({
      success: true,
      data: branches.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        region: b.region,
        address: b.address,
        isActive: b.is_active,
        createdAt: b.created_at,
        managers: people.filter((p) => p.role === 'manager' && (p.branch_ids || []).includes(b.id)).map((p) => p.full_name),
        agentCount: people.filter((p) => p.role !== 'manager' && (p.branch_ids || []).includes(b.id)).length,
      })),
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

app.get('/api/branches/similar', async (req, res) => {
  try {
    const branches = await loadBranches();
    const similar = findSimilar(String(req.query.name || ''), branches, req.query.exclude || null);
    res.json({ success: true, data: similar.slice(0, 5).map((b) => ({ id: b.id, name: b.name, city: b.city, reason: b.reason })) });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

app.put('/api/branches/:id', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2) return fail(res, 400, 'Enter a branch name.');
    const branches = await loadBranches();
    const similar = findSimilar(name, branches, req.params.id);
    if (similar.length > 0 && !req.body?.saveAnyway) {
      return fail(res, 409, `A branch like "${name}" already exists.`, {
        similarBranches: similar.slice(0, 5).map((b) => ({ id: b.id, name: b.name, city: b.city, reason: b.reason })),
      });
    }
    const { error } = await supabase
      .from('branches')
      .update({
        name: name.toUpperCase(),
        city: req.body?.city || null,
        region: req.body?.region || null,
        address: req.body?.address || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);
    if (error) throw error;
    await audit(req, 'update_branch', { branchId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

app.get('/api/places', async (req, res) => {
  try {
    res.json({ success: true, data: await places.search(req.query.q) });
  } catch (error) {
    fail(res, 502, 'Location search is unavailable right now. You can type the location instead.');
  }
});

// ============================================
// 📝 ADMIN ACTIVITY (who used the admin tool and what they did)
// ============================================
const CLIENT_EVENTS = new Set(['codes_revealed', 'code_copied', 'audit_exported', 'activity_exported']);

app.post('/api/activity/event', async (req, res) => {
  const type = String(req.body?.type || '');
  if (!CLIENT_EVENTS.has(type)) return fail(res, 400, 'Unknown event.');
  await activity.log(adminAuth.whoIs(req), type, { target: req.body?.target ? String(req.body.target).slice(0, 80) : null });
  res.json({ success: true });
});

app.get('/api/admin-activity', async (req, res) => {
  try {
    const rows = await activity.recent(Math.min(parseInt(req.query.limit, 10) || 500, 2000));
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        admin: r.admin_name,
        machine: r.machine,
        action: r.action,
        target: r.target,
        details: r.details,
        status: r.status,
        localOnly: Boolean(r.local),
      })),
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

// ============================================
// 📜 AUDIT LOG (keys masked — the page never needs them in full)
// ============================================
app.get('/api/audit-logs', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 300, 1000);
  const result = await auditLogger.getRecentLogs(limit);
  if (!result.success) return fail(res, 500, result.error);
  res.json({
    success: true,
    data: result.data.map((log) => ({
      id: log.id,
      createdAt: log.created_at,
      action: log.action,
      key: log.activation_key && log.activation_key !== '-' ? maskCode(log.activation_key) : '—',
      email: log.manager_email,
      status: log.status,
      error: log.error_message,
    })),
  });
});

app.get('*', (req, res) => res.sendFile(path.join(webUiPath, 'index.html')));

// ============================================
// 🚀 START
// ============================================
if (!fs.existsSync(webUiPath)) {
  console.error(`❌ [Server] web-ui folder not found at ${webUiPath}`);
  process.exit(1);
}

const server = app.listen(PORT, HOST, () => {
  console.log(`\n✅ Admin Web UI running at: http://localhost:${PORT} (this computer only)\n`);
  if (!adminAuth.isConfigured()) console.log('⚠️  No admin password set yet — run: npm run set-password\n');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use! Run: node index.js --kill`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => console.error('❌ Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('❌ Unhandled Rejection:', reason));
