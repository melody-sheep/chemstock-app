// admin-cli/utils/crypto.js
const crypto = require('crypto');
const KeyStrength = require('./keyStrength');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no 0/O, 1/l/I look-alikes

/** A random character from CHARS with no modulo bias. */
function randomChar() {
  const limit = 256 - (256 % CHARS.length);
  for (;;) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < limit) return CHARS[byte % CHARS.length];
  }
}

/**
 * A secure random activation code that also passes the strength rules
 * (mixed case + digits, no sequences) — regenerated until it does.
 * @param {number} length - default 16
 */
function generateSecureActivationCode(length = 16) {
  for (;;) {
    let code = '';
    for (let i = 0; i < length; i += 1) code += randomChar();
    if (KeyStrength.check(code).level === 'very_strong') return code;
  }
}

module.exports = { generateSecureActivationCode };
