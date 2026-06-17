// admin-cli/utils/crypto.js
const crypto = require('crypto');

/**
 * Generate a secure random activation code
 * @param {number} length - Length of the code (default: 16)
 * @returns {string} Secure random alphanumeric code
 */
function generateSecureActivationCode(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    const index = randomBytes[i] % chars.length;
    code += chars[index];
  }
  
  return code;
}

/**
 * Generate a secure random password
 * @param {number} length - Length of the password (default: 8)
 * @returns {string} Secure random alphanumeric password
 */
function generateSecurePassword(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    const index = randomBytes[i] % chars.length;
    password += chars[index];
  }
  
  return password;
}

module.exports = {
  generateSecureActivationCode,
  generateSecurePassword
};