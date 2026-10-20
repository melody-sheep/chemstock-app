// admin-cli/utils/adminAuth.js
// ============================================
// 🔐 ADMIN LOGIN
// The admin tool holds the service-role key, so every API route needs a
// logged-in admin. One shared admin password, stored only as a scrypt hash
// in .env (ADMIN_PASSWORD_HASH) — set it with: npm run set-password
// Sessions live in memory (restart = log in again), in an HttpOnly,
// SameSite=Strict cookie that page scripts can't read and other sites can't send.
// ============================================

const crypto = require('crypto');
const activity = require('./activityLog');

const COOKIE_NAME = 'cs_admin';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const IDLE_TTL_MS = 60 * 60 * 1000; // 1 hour without activity
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

const sessions = new Map(); // token -> { createdAt, lastSeenAt }
let failures = { count: 0, lockedUntil: 0 };

const { hashPassword, verifyPassword } = require('./passwordHash');

const adminName = () => String(process.env.ADMIN_NAME || '').trim();
const isConfigured = () => Boolean(process.env.ADMIN_PASSWORD_HASH) && Boolean(adminName());

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function getSession(req) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  const now = Date.now();
  if (now - session.createdAt > SESSION_TTL_MS || now - session.lastSeenAt > IDLE_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  session.lastSeenAt = now;
  return { token, ...session };
}

function setSessionCookie(res, token, maxAgeMs) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}`
  );
}

/** POST /api/auth/login — { password } */
function login(req, res) {
  if (!isConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Admin name or password not set on this computer. Run: npm run set-password'
    });
  }
  const now = Date.now();
  if (failures.lockedUntil > now) {
    const minutes = Math.ceil((failures.lockedUntil - now) / 60000);
    activity.log({ adminName: adminName(), ip: req.ip }, 'login_blocked', { details: { reason: 'locked' }, status: 'failed' });
    return res.status(429).json({ success: false, error: `Too many wrong passwords. Try again in ${minutes} minute(s).` });
  }

  const ok = verifyPassword(req.body?.password, process.env.ADMIN_PASSWORD_HASH);
  if (!ok) {
    failures.count += 1;
    if (failures.count >= MAX_FAILURES) {
      failures = { count: 0, lockedUntil: now + LOCK_MS };
      console.warn(`🔒 [Auth] Admin login locked for 15 min after ${MAX_FAILURES} wrong passwords (last from ${req.ip})`);
      activity.log({ adminName: adminName(), ip: req.ip }, 'login_locked', { details: { failures: MAX_FAILURES, minutes: 15 }, status: 'failed' });
    } else {
      console.warn(`⚠️  [Auth] Wrong admin password from ${req.ip} (${failures.count}/${MAX_FAILURES})`);
    }
    activity.log({ adminName: adminName(), ip: req.ip }, 'login_failed', { details: { attempt: failures.count || MAX_FAILURES }, status: 'failed' });
    return res.status(401).json({ success: false, error: 'Wrong password.' });
  }

  failures = { count: 0, lockedUntil: 0 };
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: now, lastSeenAt: now, adminName: adminName() });
  setSessionCookie(res, token, SESSION_TTL_MS);
  console.log(`✅ [Auth] ${adminName()} logged in from ${req.ip}`);
  activity.log({ adminName: adminName(), ip: req.ip }, 'login');
  res.json({ success: true, data: { adminName: adminName() } });
}

/** POST /api/auth/logout */
function logout(req, res) {
  const session = getSession(req);
  if (session) {
    activity.log({ adminName: session.adminName, ip: req.ip }, 'logout');
    sessions.delete(session.token);
  }
  setSessionCookie(res, '', 0);
  res.json({ success: true });
}

/** GET /api/auth/me */
function me(req, res) {
  const session = getSession(req);
  res.json({
    success: true,
    data: { loggedIn: Boolean(session), configured: isConfigured(), adminName: session ? session.adminName : null }
  });
}

/** Blocks every API route without a valid admin session. */
function requireAdmin(req, res, next) {
  if (getSession(req)) return next();
  res.status(401).json({ success: false, error: 'Please log in.' });
}

/**
 * CSRF guard for changes: the request must come from this page (custom
 * header + same origin). SameSite=Strict already keeps other sites' requests
 * cookie-less; this is the second lock.
 */
function requireSameOrigin(allowedOrigins) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (req.headers['x-requested-with'] !== 'chemstock-admin' || (origin && !allowedOrigins.includes(origin))) {
      return res.status(403).json({ success: false, error: 'Request blocked.' });
    }
    next();
  };
}

/** Who is making this request: { adminName, ip }. */
const whoIs = (req) => ({ adminName: getSession(req)?.adminName || 'unknown', ip: req.ip });

module.exports = { hashPassword, verifyPassword, login, logout, me, requireAdmin, requireSameOrigin, isConfigured, whoIs };
