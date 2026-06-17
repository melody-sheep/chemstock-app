// admin-cli/utils/crypto.js
const crypto = require('crypto');

/**
 * Generate a secure random activation code
 * ✅ NO special characters - only letters and numbers
 */
function generateSecureActivationCode(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  
  return code;
}

/**
 * Generate a secure random password
 */
function generateSecurePassword(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
  
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[crypto.randomInt(0, chars.length)];
  }
  
  return password;
}

module.exports = {
  generateSecureActivationCode,
  generateSecurePassword
};