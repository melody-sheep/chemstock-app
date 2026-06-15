// src/utils/validationStrategies.js
import { debugLog } from './logger';

/**
 * Base Validation Strategy (Abstract)
 */
class ValidationStrategy {
  validate(value) {
    throw new Error('validate() must be implemented by subclass');
  }
  
  getErrorMessage() {
    throw new Error('getErrorMessage() must be implemented by subclass');
  }
}

/**
 * Activation Key Validation Strategy
 */
export class ActivationKeyStrategy extends ValidationStrategy {
  validate(key) {
    debugLog('debug', 'ActivationKeyStrategy', 'Validating activation key', { keyLength: key?.length });
    
    if (!key || !key.trim()) {
      return false;
    }
    
    const trimmedKey = key.trim();
    const isValid = /^\d{4}$/.test(trimmedKey);
    
    debugLog('debug', 'ActivationKeyStrategy', 'Validation result', { isValid, key: trimmedKey });
    return isValid;
  }
  
  getErrorMessage() {
    return 'Activation code must be 4 digits';
  }
}

/**
 * Username Validation Strategy
 */
export class UsernameStrategy extends ValidationStrategy {
  constructor(minLength = 3) {
    super();
    this.minLength = minLength;
  }
  
  validate(username) {
    debugLog('debug', 'UsernameStrategy', 'Validating username', { usernameLength: username?.length });
    
    if (!username || !username.trim()) {
      return false;
    }
    
    const trimmedUsername = username.trim();
    const isValid = trimmedUsername.length >= this.minLength;
    
    debugLog('debug', 'UsernameStrategy', 'Validation result', { isValid, minLength: this.minLength });
    return isValid;
  }
  
  getErrorMessage() {
    return `Username must be at least ${this.minLength} characters`;
  }
}

/**
 * Password Validation Strategy
 */
export class PasswordStrategy extends ValidationStrategy {
  constructor(minLength = 4) {
    super();
    this.minLength = minLength;
  }
  
  validate(password) {
    debugLog('debug', 'PasswordStrategy', 'Validating password', { passwordLength: password?.length });
    
    if (!password) {
      return false;
    }
    
    const isValid = password.length >= this.minLength;
    
    debugLog('debug', 'PasswordStrategy', 'Validation result', { isValid, minLength: this.minLength });
    return isValid;
  }
  
  getErrorMessage() {
    return `Password must be at least ${this.minLength} characters`;
  }
}

/**
 * Required Field Validation Strategy
 */
export class RequiredStrategy extends ValidationStrategy {
  validate(value) {
    return value !== null && value !== undefined && value.toString().trim().length > 0;
  }
  
  getErrorMessage() {
    return 'This field is required';
  }
}

/**
 * Composite Strategy (combines multiple strategies)
 */
export class CompositeStrategy extends ValidationStrategy {
  constructor(strategies) {
    super();
    this.strategies = strategies;
  }
  
  validate(value) {
    return this.strategies.every(strategy => strategy.validate(value));
  }
  
  getErrorMessage() {
    const errors = this.strategies.map(s => s.getErrorMessage());
    return errors.join(', ');
  }
}