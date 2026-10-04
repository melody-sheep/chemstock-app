// src/utils/logger.js

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

const CURRENT_LOG_LEVEL = __DEV__ ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
const MAX_BUFFER_LINES = 500;
const SENSITIVE_KEY = /password|token|secret/i;

let currentScreen = 'app-start';
const buffer = [];

const redact = (value, depth = 0) => {
  if (value === null || typeof value !== 'object' || depth > 4) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(value[key], depth + 1);
  }
  return out;
};

const stringifyData = (data) => {
  if (data === null || data === undefined || data === '') return '';
  try {
    return JSON.stringify(redact(data));
  } catch (error) {
    return '[unserializable data]';
  }
};

const pushToBuffer = (level, module, message, data) => {
  const time = new Date().toISOString().slice(11, 23);
  const line = `${time} ${level.toUpperCase()} [screen:${currentScreen}] [${module}] ${message}${
    stringifyData(data) ? ` ${stringifyData(data)}` : ''
  }`;
  buffer.push(line);
  if (buffer.length > MAX_BUFFER_LINES) buffer.shift();
};

export const setCurrentScreen = (screenName) => {
  currentScreen = screenName || 'unknown';
};

/**
 * Logs to the console (gated by level) and always to the in-app buffer, so
 * Settings → Share Debug Log can export the recent session for diagnosis.
 */
export const debugLog = (level, module, message, data = null) => {
  const levelKey = level.toUpperCase();
  const levelValue = LOG_LEVELS[levelKey];
  pushToBuffer(levelKey, module, message, data);

  if (levelValue === undefined || levelValue < CURRENT_LOG_LEVEL) {
    return;
  }

  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}] [${levelKey}] [${currentScreen}] [${module}]`;
  const payload = data ? data : '';

  switch (level.toLowerCase()) {
    case 'debug':
      console.debug(logPrefix, message, payload);
      break;
    case 'warn':
      console.warn(logPrefix, message, payload);
      break;
    case 'error':
      console.error(logPrefix, message, payload);
      break;
    default:
      console.log(logPrefix, message, payload);
  }
};

/** Records a user-facing or workflow milestone, e.g. logEvent('ProductSelect', 'done', { count: 3 }). */
export const logEvent = (module, event, data = null) => {
  debugLog('info', module, `EVENT ${event}`, data);
};

export const perfLog = (label, callback) => {
  const start = performance.now();
  debugLog('debug', 'Performance', `${label} - started`);

  const result = callback();

  const end = performance.now();
  debugLog('info', 'Performance', `${label} - completed`, { duration: `${(end - start).toFixed(2)}ms` });

  return result;
};

export const logError = (module, error, context = {}) => {
  debugLog('error', module, error?.message || 'Unknown error', {
    stack: error?.stack,
    ...context,
  });
};

/** Full session buffer as plain text, ready to copy and paste. */
export const getLogText = () => {
  const header = `ChemStock debug log — ${new Date().toISOString()} — last screen: ${currentScreen}`;
  return [header, ...buffer].join('\n');
};

export const clearLogBuffer = () => {
  buffer.length = 0;
};

/**
 * Captures uncaught JavaScript errors (the crash/"Something went wrong"
 * cases) with the screen they happened on, then hands off to the default
 * handler so the red-box/crash behavior is unchanged.
 */
export const installGlobalErrorHandler = () => {
  if (typeof ErrorUtils === 'undefined') return;
  const previousHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    logError('GlobalError', error, { isFatal: Boolean(isFatal) });
    if (previousHandler) previousHandler(error, isFatal);
  });
};
