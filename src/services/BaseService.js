// src/services/BaseService.js
import { isRLSError, getFriendlyErrorMessage } from './supabaseClient';
import { logError } from '../utils/logger';

export class BaseService {
  constructor(serviceName = 'BaseService') {
    this.serviceName = serviceName;
    console.log(`[INFO] [${this.serviceName}] Initialized`);
  }

  /**
   * Handle errors with RLS detection
   */
  handleError(error, context = {}) {
    const isRls = isRLSError(error);
    const friendlyMessage = getFriendlyErrorMessage(error);

    logError(this.serviceName, error, { ...context, isRls });

    const enhancedError = new Error(friendlyMessage);
    enhancedError.originalError = error;
    enhancedError.isRLSError = isRls;
    enhancedError.code = error?.code || 'UNKNOWN_ERROR';

    throw enhancedError;
  }

  /**
   * Log debug messages
   */
  log(level, message, data = {}) {
    const prefix = `[${this.serviceName}]`;
    switch (level) {
      case 'debug':
        console.log(`[DEBUG] ${prefix}`, message, data);
        break;
      case 'info':
        console.log(`[INFO] ${prefix}`, message, data);
        break;
      case 'warn':
        console.warn(`[WARN] ${prefix}`, message, data);
        break;
      case 'error':
        console.error(`[ERROR] ${prefix}`, message, data);
        break;
      default:
        console.log(prefix, message, data);
    }
  }

  /**
   * Validate required fields
   */
  validateRequired(fields, data) {
    for (const field of fields) {
      const value = data[field];
      if (!value || (typeof value === 'string' && !value.trim())) {
        const error = new Error(`${field} is required`);
        console.warn(`[WARN] [${this.serviceName}] Validation failed:`, error.message);
        throw error;
      }
    }
    return true;
  }
}

export default BaseService;