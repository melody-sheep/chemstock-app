// src/container.js
import { debugLog } from './utils/logger';

/**
 * Service Container for Dependency Injection
 * Implements Singleton pattern for service management
 */
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.instances = new Map();
    debugLog('info', 'ServiceContainer', 'Container initialized');
  }
  
  /**
   * Register a service class
   * @param {string} name - Service name
   * @param {Class} serviceClass - Service class
   * @param {Object} dependencies - Dependencies for the service
   */
  register(name, serviceClass, dependencies = {}) {
    debugLog('debug', 'ServiceContainer', `Registering service: ${name}`);
    this.services.set(name, { serviceClass, dependencies });
    return this;
  }
  
  /**
   * Get a service instance (lazy loading)
   * @param {string} name - Service name
   * @returns {Object} Service instance
   */
  get(name) {
    if (this.instances.has(name)) {
      debugLog('debug', 'ServiceContainer', `Returning cached instance: ${name}`);
      return this.instances.get(name);
    }
    
    const registration = this.services.get(name);
    if (!registration) {
      debugLog('error', 'ServiceContainer', `Service not found: ${name}`);
      throw new Error(`Service "${name}" not registered`);
    }
    
    const { serviceClass, dependencies } = registration;
    
    // Resolve dependencies
    const resolvedDeps = {};
    for (const [depName, depValue] of Object.entries(dependencies)) {
      if (typeof depValue === 'string') {
        resolvedDeps[depName] = this.get(depValue);
      } else {
        resolvedDeps[depName] = depValue;
      }
    }
    
    // Create instance
    const instance = new serviceClass(resolvedDeps);
    this.instances.set(name, instance);
    
    debugLog('info', 'ServiceContainer', `Service instantiated: ${name}`);
    return instance;
  }
  
  /**
   * Check if service is registered
   */
  has(name) {
    return this.services.has(name);
  }
  
  /**
   * Clear all instances (useful for testing)
   */
  clearInstances() {
    this.instances.clear();
    debugLog('debug', 'ServiceContainer', 'All instances cleared');
  }
}

// Create and export singleton container
export const container = new ServiceContainer();

// Register default services (to be called after imports to avoid circular dependencies)
export const initializeContainer = () => {
  debugLog('info', 'ServiceContainer', 'Initializing services...');
  
  // Lazy imports to avoid circular dependencies
  const AuthService = require('./services/authService').default;
  const ActivationService = require('./services/activationService').default;
  
  container.register('authService', AuthService);
  container.register('activationService', ActivationService);
  
  debugLog('info', 'ServiceContainer', 'Services initialized');
};