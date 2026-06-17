// src/services/BaseService.js
import { supabase } from './supabaseClient';
import { debugLog, logError } from '../utils/logger';

/**
 * Abstract base class for all services
 * Implements common HTTP methods and error handling
 */
export class BaseService {
  constructor(config = {}) {
    this.timeout = config.timeout || 30000;
    this.retryCount = config.retryCount || 3;
    this.supabase = supabase;
  }
  
  /**
   * Handle API errors consistently
   */
  handleError(error, context = {}) {
    logError(this.constructor.name, error, context);
    
    if (error.message?.includes('JWT')) {
      throw new Error('Authentication expired. Please login again.');
    }
    if (error.message?.includes('network')) {
      throw new Error('Network error. Please check your connection.');
    }
    if (error.message?.includes('permission')) {
      throw new Error('You don\'t have permission for this action.');
    }
    
    throw error;
  }
  
  /**
   * Log debug information
   */
  log(method, message, data = null) {
    debugLog('info', this.constructor.name, `${method}: ${message}`, data);
  }
  
  /**
   * Sleep utility for retries
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Retry failed operations
   */
  async retry(operation, context, retries = this.retryCount) {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === retries - 1) throw error;
        this.log('retry', `Attempt ${i + 1} failed, retrying...`, context);
        await this.sleep(1000 * (i + 1));
      }
    }
  }
}

export default BaseService;