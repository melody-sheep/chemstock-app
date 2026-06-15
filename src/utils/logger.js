// src/utils/logger.js

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

// Current log level (set to DEBUG for development, INFO for production)
const CURRENT_LOG_LEVEL = __DEV__ ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

/**
 * Centralized logging utility
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} module - Module name (e.g., 'AuthService', 'LoginScreen')
 * @param {string} message - Log message
 * @param {any} data - Optional data to log
 */
export const debugLog = (level, module, message, data = null) => {
  const levelValue = LOG_LEVELS[level.toUpperCase()];
  
  if (!levelValue || levelValue < CURRENT_LOG_LEVEL) {
    return;
  }
  
  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}] [${level.toUpperCase()}] [${module}]`;
  
  switch (level.toLowerCase()) {
    case 'debug':
      console.debug(logPrefix, message, data ? data : '');
      break;
    case 'info':
      console.log(logPrefix, message, data ? data : '');
      break;
    case 'warn':
      console.warn(logPrefix, message, data ? data : '');
      break;
    case 'error':
      console.error(logPrefix, message, data ? data : '');
      break;
    default:
      console.log(logPrefix, message, data ? data : '');
  }
};

/**
 * Performance logger for measuring execution time
 */
export const perfLog = (label, callback) => {
  const start = performance.now();
  debugLog('debug', 'Performance', `${label} - started`);
  
  const result = callback();
  
  const end = performance.now();
  debugLog('info', 'Performance', `${label} - completed`, { duration: `${(end - start).toFixed(2)}ms` });
  
  return result;
};

/**
 * Error logging with stack trace
 */
export const logError = (module, error, context = {}) => {
  debugLog('error', module, error.message || 'Unknown error', {
    stack: error.stack,
    ...context
  });
};