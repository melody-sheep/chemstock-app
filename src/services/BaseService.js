// src/services/BaseService.js
import { isRLSError, getFriendlyErrorMessage } from './supabaseClient';
import { logError } from '../utils/logger';

export class BaseService {
  constructor(serviceName = 'BaseService') {
    this.serviceName = serviceName;
    console.log(`🏗️ [${this.serviceName}] Initialized`);
  }

  /**
   * Handle errors with RLS detection
   */
  handleError(error, context = {}) {
    console.error(`❌ [${this.serviceName}] Error occurred:`, error);
    console.log(`🔍 [${this.serviceName}] Error code:`, error?.code);
    console.log(`🔍 [${this.serviceName}] Error message:`, error?.message);
    console.log(`🔍 [${this.serviceName}] Context:`, context);

    const isRls = isRLSError(error);
    if (isRls) {
      console.log(`🔒 [${this.serviceName}] This is an RLS error!`);
    }

    const friendlyMessage = getFriendlyErrorMessage(error);
    console.log(`💬 [${this.serviceName}] Friendly message:`, friendlyMessage);

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
        console.log(`🔍 ${prefix}`, message, data);
        break;
      case 'info':
        console.log(`ℹ️ ${prefix}`, message, data);
        break;
      case 'warn':
        console.warn(`⚠️ ${prefix}`, message, data);
        break;
      case 'error':
        console.error(`❌ ${prefix}`, message, data);
        break;
      default:
        console.log(prefix, message, data);
    }
  }

  /**
   * Validate required fields
   */
  validateRequired(fields, data) {
    console.log(`🔍 [${this.serviceName}] Validating required fields:`, fields);
    
    for (const field of fields) {
      const value = data[field];
      if (!value || (typeof value === 'string' && !value.trim())) {
        const error = new Error(`${field} is required`);
        console.warn(`⚠️ [${this.serviceName}] Validation failed:`, error.message);
        throw error;
      }
    }
    
    console.log(`✅ [${this.serviceName}] Validation passed`);
    return true;
  }
}

export default BaseService;