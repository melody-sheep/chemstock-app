// src/services/BaseService.js
import { debugLog, logError } from '../utils/logger';

/**
 * Abstract Base Service Class
 * Implements common HTTP methods and error handling
 */
export class BaseService {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || process.env.API_URL || 'https://your-api-url.com';
    this.timeout = config.timeout || 30000;
    this.retryCount = config.retryCount || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.headers = config.headers || {
      'Content-Type': 'application/json',
    };
    
    debugLog('info', this.constructor.name, 'Service initialized', { 
      apiUrl: this.apiUrl,
      timeout: this.timeout,
      retryCount: this.retryCount
    });
  }
  
  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
    if (token) {
      this.headers['Authorization'] = `Bearer ${token}`;
      debugLog('debug', this.constructor.name, 'Token set', { tokenLength: token.length });
    } else {
      delete this.headers['Authorization'];
      debugLog('debug', this.constructor.name, 'Token cleared');
    }
  }
  
  /**
   * HTTP request with retry logic
   */
  async request(endpoint, options = {}, retryAttempt = 1) {
    const url = `${this.apiUrl}${endpoint}`;
    const startTime = Date.now();
    
    debugLog('debug', this.constructor.name, `Request to ${endpoint}`, { 
      method: options.method || 'GET',
      retryAttempt,
      body: options.body ? 'present' : 'none'
    });
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...options,
        headers: { ...this.headers, ...options.headers },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      debugLog('info', this.constructor.name, `Response from ${endpoint}`, { 
        status: response.status,
        duration: `${duration}ms`,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (error) {
      clearTimeout();
      
      // Handle network errors with retry
      if (error.name === 'AbortError') {
        logError(this.constructor.name, error, { endpoint, timeout: this.timeout });
        throw new Error('Request timeout. Please check your connection.');
      }
      
      // Retry logic for network errors
      if (retryAttempt < this.retryCount && (error.message.includes('network') || error.message.includes('fetch'))) {
        debugLog('warn', this.constructor.name, `Retrying request (${retryAttempt}/${this.retryCount})`, { endpoint });
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * retryAttempt));
        return this.request(endpoint, options, retryAttempt + 1);
      }
      
      logError(this.constructor.name, error, { endpoint, retryAttempt });
      throw error;
    }
  }
  
  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }
  
  /**
   * POST request
   */
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  /**
   * PUT request
   */
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}