// admin-cli/utils/rateLimiter.js
// ============================================
// 🔒 RATE LIMITING MIDDLEWARE
// Fixed for express-rate-limit v7+
// ============================================

const rateLimit = require('express-rate-limit');

// ============================================
// 📊 ACTIVATION ENDPOINT LIMITER
// ============================================
const activationLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5, // 5 attempts per minute
  message: {
    success: false,
    error: 'Too many activation attempts. Please try again in 1 minute.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';
    return `${ip}:${userAgent.substring(0, 20)}`;
  },
  handler: (req, res) => {
    // ⚠️ onLimitReached is REMOVED in v7
    // We handle logging here instead
    console.log(`⚠️  [Rate Limit] Too many attempts from ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many attempts. Please wait 1 minute before trying again.',
      retryAfter: 60
    });
  }
});

// ============================================
// 📊 GENERATE KEY LIMITER
// ============================================
const generateKeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Too many key generation attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  handler: (req, res) => {
    console.log(`⚠️  [Rate Limit] Too many generate attempts from ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many generate attempts. Please try again later.'
    });
  }
});

// ============================================
// 📊 GLOBAL LIMITER
// ============================================
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/api/health';
  },
  handler: (req, res) => {
    console.log(`⚠️  [Rate Limit] Global limit exceeded by ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.'
    });
  }
});

// ============================================
// 📊 REVOKE KEY LIMITER
// ============================================
const revokeKeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Too many revocation attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`⚠️  [Rate Limit] Too many revocation attempts from ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many revocation attempts. Please try again later.'
    });
  }
});

module.exports = {
  activationLimiter,
  generateKeyLimiter,
  revokeKeyLimiter,
  globalLimiter
};