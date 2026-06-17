// src/utils/validationStrategies.js
import { debugLog } from './logger';

/**
 * Base validation strategy class
 * Implements Strategy pattern for validation
 */
export class ValidationStrategy {
  validate(value) {
    throw new Error('validate() must be implemented by subclass');
  }
  
  getErrorMessage() {
    throw new Error('getErrorMessage() must be implemented by subclass');
  }
}

/**
 * Activation Key Validation Strategy
 * Validates activation keys (min 4 chars, alphanumeric)
 */
export class ActivationKeyStrategy extends ValidationStrategy {
  constructor(minLength = 4) {
    super();
    this.minLength = minLength;
    console.log(`🔑 [ActivationKeyStrategy] Initialized with minLength: ${minLength}`);
  }
  
  validate(value) {
    console.log(`🔍 [ActivationKeyStrategy] Validating: "${value}"`);
    if (!value || typeof value !== 'string') {
      console.log('❌ [ActivationKeyStrategy] Validation failed: empty or not string');
      return false;
    }
    
    const trimmed = value.trim();
    const isValid = trimmed.length >= this.minLength;
    console.log(`✅ [ActivationKeyStrategy] Validation ${isValid ? 'passed' : 'failed'} - length: ${trimmed.length}`);
    return isValid;
  }
  
  getErrorMessage() {
    return `Activation code must be at least ${this.minLength} characters`;
  }
}

/**
 * Username Validation Strategy
 */
export class UsernameValidationStrategy extends ValidationStrategy {
  constructor(minLength = 3, maxLength = 50) {
    super();
    this.minLength = minLength;
    this.maxLength = maxLength;
    console.log(`👤 [UsernameValidationStrategy] Initialized with min: ${minLength}, max: ${maxLength}`);
  }
  
  validate(value) {
    console.log(`🔍 [UsernameValidationStrategy] Validating: "${value}"`);
    if (!value || typeof value !== 'string') {
      console.log('❌ [UsernameValidationStrategy] Validation failed: empty or not string');
      return false;
    }
    
    const trimmed = value.trim();
    const isValid = trimmed.length >= this.minLength && trimmed.length <= this.maxLength;
    console.log(`✅ [UsernameValidationStrategy] Validation ${isValid ? 'passed' : 'failed'}`);
    return isValid;
  }
  
  getErrorMessage() {
    return `Username must be between ${this.minLength} and ${this.maxLength} characters`;
  }
}

/**
 * Password Validation Strategy
 */
export class PasswordValidationStrategy extends ValidationStrategy {
  constructor(minLength = 6) {
    super();
    this.minLength = minLength;
    console.log(`🔑 [PasswordValidationStrategy] Initialized with minLength: ${minLength}`);
  }
  
  validate(value) {
    console.log(`🔍 [PasswordValidationStrategy] Validating (length: ${value?.length})`);
    if (!value || typeof value !== 'string') {
      console.log('❌ [PasswordValidationStrategy] Validation failed: empty or not string');
      return false;
    }
    
    const isValid = value.length >= this.minLength;
    console.log(`✅ [PasswordValidationStrategy] Validation ${isValid ? 'passed' : 'failed'}`);
    return isValid;
  }
  
  getErrorMessage() {
    return `Password must be at least ${this.minLength} characters`;
  }
}

/**
 * Email Validation Strategy
 */
export class EmailValidationStrategy extends ValidationStrategy {
  validate(value) {
    console.log(`🔍 [EmailValidationStrategy] Validating: "${value}"`);
    if (!value || typeof value !== 'string') {
      console.log('❌ [EmailValidationStrategy] Validation failed: empty or not string');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(value.trim());
    console.log(`✅ [EmailValidationStrategy] Validation ${isValid ? 'passed' : 'failed'}`);
    return isValid;
  }
  
  getErrorMessage() {
    return 'Please enter a valid email address';
  }
}

/**
 * Compose multiple validation strategies
 */
export class ComposeValidationStrategy extends ValidationStrategy {
  constructor(strategies) {
    super();
    this.strategies = strategies;
    console.log(`📦 [ComposeValidationStrategy] Initialized with ${strategies.length} strategies`);
  }
  
  validate(value) {
    console.log(`🔍 [ComposeValidationStrategy] Validating with ${this.strategies.length} strategies`);
    for (const strategy of this.strategies) {
      if (!strategy.validate(value)) {
        console.log('❌ [ComposeValidationStrategy] Strategy failed:', strategy.constructor.name);
        return false;
      }
    }
    console.log('✅ [ComposeValidationStrategy] All strategies passed');
    return true;
  }
  
  getErrorMessage() {
    for (const strategy of this.strategies) {
      if (!strategy.validate(this._lastValue)) {
        return strategy.getErrorMessage();
      }
    }
    return 'Validation failed';
  }
}

// Export default object for easy imports
export default {
  ValidationStrategy,
  ActivationKeyStrategy,
  UsernameValidationStrategy,
  PasswordValidationStrategy,
  EmailValidationStrategy,
  ComposeValidationStrategy,
};